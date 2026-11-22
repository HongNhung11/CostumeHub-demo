// TỰ XÁC NHẬN CHUYỂN KHOẢN
// Chỉ xác nhận khi: đúng tài khoản nhận + đúng mã đơn + đúng số tiền + đơn đang chờ thanh toán.
// Mọi trường hợp khác vẫn được ghi lại để nhân viên xử lý, không tự đoán.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Rental, RentalItem, Payment } = require('../models');
const { lockProducts } = require('./locks');
const { canPay, CURRENT } = require('./dataKind');
const audit = require('./audit');
const { amountDue, isPaid, PAY, PAY_GRACE_MS, paymentDeadline, isDelivery, shipDay } = require('./rentalFlow');
const { viDate, todayStr } = require('./dates');
const ledger = require('./ledger');
const sepay = require('./sepay');

const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

// Mã chuyển khoản ngẫu nhiên (CH + 8 số): không dùng số đơn vì tạo lại CSDL sẽ trùng với giao dịch cũ.
// Khai báo ở SePay: tiền tố CH, hậu tố 8–8 ký tự, loại "Số nguyên".
const newPayCode = () => 'CH' + String(crypto.randomInt(10000000, 100000000));

function codeOf(t) {
  for (const s of [t.code, t.content, t.content.replace(/[^A-Za-z0-9]/g, '')]) {
    const m = String(s || '').match(/CH[\s.-]?(\d{8})/i);
    if (m) return 'CH' + m[1];
  }
  return null;
}

const toOurAccount = (cfg, t) =>
  t.account === cfg.account || (!!cfg.va && (t.account === cfg.va || t.va === cfg.va));

const sumOf = (rows) => rows.reduce((s, p) => s + Number(p.Amount), 0);

// Đơn tự hủy vì quá hạn mà tiền thực ra về đúng giờ: khôi phục nếu đồ vẫn còn trống (sản phẩm đã khóa)
async function canRevive(rental, t, products, transaction) {
  if (rental.CancelReason !== 'expired' || rental.PaymentMethod !== PAY.BANK) return false;
  if (t.paidAt.getTime() > paymentDeadline(rental).getTime() + PAY_GRACE_MS) return false;
  if (rental.StartDate < todayStr()) return false;
  const items = await RentalItem.findAll({ where: { RentalID: rental.RentalID }, transaction });
  if (!items.length || items.some(i => !products.some(p => p.ProductID === i.ProductID && p.Status === 'Còn trống'))) return false;
  const { productAvailability } = require('./availability');
  const avail = await productAvailability(products, rental.StartDate, rental.EndDate, { transaction, shipDays: rental.ShipDays || 0 });
  const need = new Map();
  for (const i of items) {
    const key = JSON.stringify([i.ProductID, i.Size, i.Color]);
    need.set(key, (need.get(key) || 0) + i.Quantity);
  }
  for (const [key, qty] of need) {
    const [id, size, color] = JSON.parse(key);
    const v = avail[id]?.variants.find(x => x.Size === size && x.Color === color);
    if (!v || v.free < qty) return false;
  }
  return true;
}

// Quyết định cho 1 giao dịch, gọi khi đã khóa sản phẩm + đơn
async function decide(rental, t, products, transaction) {
  if (!rental) return { state: 'unmatched', reason: 'Không tìm thấy mã đơn trong nội dung chuyển khoản' };
  const due = amountDue(rental);

  if (t.paidAt < new Date(new Date(rental.createdAt).getTime() - 10 * 60e3)) {
    return { state: 'review', reason: 'Giao dịch có trước khi đơn được tạo' };
  }
  if (isPaid(rental)) {
    // Nhân viên đã xác nhận tay rồi giao dịch mới về: ghép vào, miễn là tổng không vượt số phải trả
    if (rental.PaidVia === 'manual') {
      const linked = await Payment.findAll({ where: { RentalID: rental.RentalID, State: 'confirmed' }, transaction });
      if (sumOf(linked) + t.amount <= due) return { state: 'confirmed', reason: 'Khớp với xác nhận tay của nhân viên' };
    }
    return { state: 'refund', reason: 'Đơn đã thanh toán trước đó (chuyển thừa / chuyển 2 lần)' };
  }
  if (rental.Status === 'Đã hủy') {
    if (t.amount === due && await canRevive(rental, t, products, transaction)) {
      return { state: 'confirmed', confirmOrder: true, revived: true, reason: 'Tiền về đúng giờ, báo muộn: đã khôi phục đơn' };
    }
    return { state: 'refund', reason: 'Tiền về sau khi đơn đã hủy' };
  }
  if (rental.Status !== 'Chờ cọc' || rental.PaymentMethod !== PAY.BANK) {
    return { state: 'review', reason: 'Đơn không ở trạng thái chờ chuyển khoản' };
  }
  // Cộng cả các lần chuyển lệch đang chờ: khách chuyển bù cho đủ thì tự xác nhận
  const held = await Payment.findAll({ where: { RentalID: rental.RentalID, State: 'review' }, transaction });
  const total = sumOf(held) + t.amount;
  if (total === due) return { state: 'confirmed', confirmOrder: true, settles: held, reason: held.length ? 'Đủ tiền sau khi chuyển bù' : 'Tự xác nhận qua SePay' };
  return { state: 'review', reason: `${total < due ? 'Thiếu' : 'Thừa'} ${vnd(Math.abs(due - total))}: cần ${vnd(due)}, đã nhận ${vnd(total)}` };
}

// Vân tay tách theo chế độ: giao dịch thử trùng số tham chiếu không được che mất giao dịch thật
const fingerprintOf = (t) => (CURRENT === 'test' ? crypto.createHash('sha256').update(`test|${t.fingerprint}`).digest('hex') : t.fingerprint);

async function record(t) {
  const code = codeOf(t);
  // Biết trước đơn gồm món nào để khóa đúng thứ tự sản phẩm -> đơn (như lúc đặt), không kẹt chéo
  const peek = code ? await Rental.findOne({ where: { PayCode: code }, attributes: ['RentalID', 'DataKind'] }) : null;
  const match = peek && canPay(peek) ? peek : null;     // tiền thử không khớp đơn thật và ngược lại
  const productIds = match ? (await RentalItem.findAll({ where: { RentalID: match.RentalID }, attributes: ['ProductID'] })).map(i => i.ProductID) : [];
  const fingerprint = fingerprintOf(t);

  return sequelize.transaction(async (transaction) => {
    const products = await lockProducts(productIds, transaction);
    const rental = match ? await Rental.findOne({ where: { RentalID: match.RentalID }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    // Kiểm tra trùng SAU khi khóa đơn: 2 nguồn báo cùng lúc thì bên vào sau thấy dòng của bên vào trước
    if (await Payment.unscoped().findOne({ where: { Fingerprint: fingerprint }, transaction })) return { duplicate: true };

    const d = await decide(rental, t, products, transaction);
    const payment = await Payment.create({
      Fingerprint: fingerprint, ProviderID: t.providerId, Source: t.source,
      RentalID: rental ? rental.RentalID : null, Amount: t.amount, Account: t.account,
      Reference: t.reference, Content: t.content, PaidAt: t.paidAt, State: d.state, Reason: d.reason,
    }, { transaction });

    if (d.confirmOrder) {
      for (const p of d.settles || []) await p.update({ State: 'confirmed', HandledBy: 'Hệ thống' }, { transaction });
      await rental.update({
        Status: 'Đã cọc', PaymentStatus: 'Đã thanh toán', DepositPaidAt: t.paidAt, PaidVia: 'sepay',
        ...(d.revived ? { CancelReason: null, Note: [rental.Note, `[${viDate(todayStr())}] Khôi phục: tiền về đúng giờ, SePay báo muộn.`].filter(Boolean).join('\n') } : {}),
      }, { transaction });
      await audit.log(null, 'payment.auto', { rental, amount: amountDue(rental), detail: `${d.reason} · GD ${t.reference || t.providerId}`, transaction });
    } else if (d.state === 'refund') {
      await ledger.post({ key: `payment:${payment.PaymentID}`, rentalId: rental.RentalID, amount: t.amount, reason: d.reason, kind: rental.DataKind }, { transaction });
    }
    return { payment, rental, ...d };
  });
}

async function announce({ rental, state, confirmOrder, payment, reason }) {
  if (!rental) return;
  const { notify } = require('./notify');
  const id = rental.RentalID, got = vnd(confirmOrder ? amountDue(rental) : payment.Amount);
  if (confirmOrder) {
    const when = isDelivery(rental)
      ? `shop gửi đồ ngày ${viDate(shipDay(rental))}, bạn nhận ngày ${viDate(rental.StartDate)}`
      : `nhận đồ tại cửa hàng ngày ${viDate(rental.StartDate)}`;
    await notify(rental, { key: `paid-${id}`, level: 'success', title: `Đã nhận thanh toán — đơn #${id}`, message: `Đã nhận ${got}. Đơn được giữ chỗ: ${when}.` });
  } else if (state === 'refund' || state === 'review') {
    await notify(rental, { key: `pay-issue-${payment.PaymentID}`, level: 'warning', title: `Cần kiểm tra chuyển khoản — đơn #${id}`, message: `Cửa hàng nhận được ${got}. ${reason}. Nhân viên sẽ liên hệ để xử lý.` });
  }
}

async function processTransfer(cfg, t) {
  if (!t || !toOurAccount(cfg, t)) return { ignored: true };
  let result;
  try {
    result = await record(t);
  } catch (e) {
    // Giao dịch không có mã đơn thì không có gì để khóa: 2 bên chèn cùng lúc -> 1 bên vi phạm khóa duy nhất
    if (e.name === 'SequelizeUniqueConstraintError' && await Payment.unscoped().count({ where: { Fingerprint: fingerprintOf(t) } })) return { duplicate: true };
    throw e;
  }
  // Tiền đã ghi xong; lỗi thông báo không được làm SePay gửi lại / làm hỏng vòng đối soát
  if (!result.duplicate) await announce(result).catch(e => console.error('Lỗi thông báo thanh toán:', e.message));
  return result;
}

// Đối soát qua API: chạy được khi máy chủ không có tên miền công khai
const status = { lastOkAt: null, okStartedAt: null, lastError: null };   // okStartedAt: giờ BẮT ĐẦU của lượt đối soát thành công gần nhất
async function reconcile(cfg, { fetchImpl, days = status.lastOkAt ? 2 : 7 } = {}) {   // mới khởi động: đọc lùi 7 ngày, phòng máy vừa tắt lâu
  if (!cfg.enabled || !cfg.token) return 0;
  const began = new Date();
  try {
    const list = await sepay.listIncoming(cfg, new Date(Date.now() - days * 864e5), fetchImpl);
    let added = 0;
    for (const t of list) {
      const r = await processTransfer(cfg, t);
      if (!r.duplicate && !r.ignored) added++;
    }
    status.lastOkAt = new Date(); status.okStartedAt = began; status.lastError = null;
    return added;
  } catch (e) {
    status.lastError = e.message;
    throw e;
  }
}

module.exports = { newPayCode, codeOf, processTransfer, reconcile, status };
