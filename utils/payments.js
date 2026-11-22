// TỰ XÁC NHẬN CHUYỂN KHOẢN
// Chỉ xác nhận khi: đúng tài khoản nhận + đúng mã đơn + đúng số tiền + đơn đang chờ thanh toán.
// Mọi trường hợp khác vẫn được ghi lại để nhân viên xử lý, không tự đoán.
const crypto = require('crypto');
const { sequelize, Rental, Payment } = require('../models');
const { amountDue, isPaid, PAY, isDelivery, shipDay } = require('./rentalFlow');
const { viDate } = require('./dates');
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

// Quyết định cho 1 giao dịch, gọi khi đã khóa đơn
async function decide(rental, t, transaction) {
  if (!rental) return { state: 'unmatched', reason: 'Không tìm thấy mã đơn trong nội dung chuyển khoản' };
  const due = amountDue(rental);

  if (t.paidAt < new Date(new Date(rental.createdAt).getTime() - 10 * 60e3)) {
    return { state: 'review', reason: 'Giao dịch có trước khi đơn được tạo' };
  }
  if (isPaid(rental)) {
    // Nhân viên đã xác nhận tay rồi giao dịch mới về: ghép vào, không coi là chuyển thừa
    if (rental.PaidVia === 'manual' && t.amount === due) {
      const linked = await Payment.count({ where: { RentalID: rental.RentalID, State: 'confirmed' }, transaction });
      if (!linked) return { state: 'confirmed', reason: 'Khớp với xác nhận tay của nhân viên' };
    }
    return { state: 'refund', reason: 'Đơn đã thanh toán trước đó (chuyển thừa / chuyển 2 lần)' };
  }
  if (rental.Status === 'Đã hủy') return { state: 'refund', reason: 'Tiền về sau khi đơn đã hủy' };
  if (rental.Status !== 'Chờ cọc' || rental.PaymentMethod !== PAY.BANK) {
    return { state: 'review', reason: 'Đơn không ở trạng thái chờ chuyển khoản' };
  }
  if (t.amount !== due) return { state: 'review', reason: `Sai số tiền: cần ${vnd(due)}, nhận ${vnd(t.amount)}` };
  return { state: 'confirmed', confirmOrder: true, reason: 'Tự xác nhận qua SePay' };
}

async function record(t) {
  return sequelize.transaction(async (transaction) => {
    const code = codeOf(t);
    const rental = code ? await Rental.findOne({ where: { PayCode: code }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    // Kiểm tra trùng SAU khi khóa đơn: 2 nguồn báo cùng lúc thì bên vào sau thấy dòng của bên vào trước
    if (await Payment.findOne({ where: { Fingerprint: t.fingerprint }, transaction })) return { duplicate: true };

    const d = await decide(rental, t, transaction);
    const payment = await Payment.create({
      Fingerprint: t.fingerprint, ProviderID: t.providerId, Source: t.source,
      RentalID: rental ? rental.RentalID : null, Amount: t.amount, Account: t.account,
      Reference: t.reference, Content: t.content, PaidAt: t.paidAt, State: d.state, Reason: d.reason,
    }, { transaction });

    if (d.confirmOrder) {
      await rental.update({ Status: 'Đã cọc', PaymentStatus: 'Đã thanh toán', DepositPaidAt: t.paidAt, PaidVia: 'sepay' }, { transaction });
    } else if (d.state === 'refund') {
      await ledger.post({ key: `payment:${payment.PaymentID}`, rentalId: rental.RentalID, amount: t.amount, reason: d.reason }, { transaction });
    }
    return { payment, rental, ...d };
  });
}

async function announce({ rental, state, confirmOrder, payment, reason }) {
  if (!rental) return;
  const { notify } = require('./notify');
  const id = rental.RentalID, got = vnd(payment.Amount);
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
    if (e.name === 'SequelizeUniqueConstraintError' && await Payment.findOne({ where: { Fingerprint: t.fingerprint } })) return { duplicate: true };
    throw e;
  }
  // Tiền đã ghi xong; lỗi thông báo không được làm SePay gửi lại / làm hỏng vòng đối soát
  if (!result.duplicate) await announce(result).catch(e => console.error('Lỗi thông báo thanh toán:', e.message));
  return result;
}

// Đối soát qua API: chạy được khi máy chủ không có tên miền công khai
const status = { lastOkAt: null, lastError: null };
async function reconcile(cfg, { fetchImpl, days = 2 } = {}) {
  if (!cfg.enabled || !cfg.token) return 0;
  try {
    const list = await sepay.listIncoming(cfg, new Date(Date.now() - days * 864e5), fetchImpl);
    let added = 0;
    for (const t of list) {
      const r = await processTransfer(cfg, t);
      if (!r.duplicate && !r.ignored) added++;
    }
    status.lastOkAt = new Date(); status.lastError = null;
    return added;
  } catch (e) {
    status.lastError = e.message;
    throw e;
  }
}

module.exports = { newPayCode, codeOf, processTransfer, reconcile, status };
