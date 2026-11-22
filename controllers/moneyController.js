// SỔ HOÀN CỌC + GIAO DỊCH CẦN XỬ LÝ (nhân viên / admin)
const { Op } = require('sequelize');
const { sequelize, LedgerEntry, Payment, Rental } = require('../models');
const ledger = require('../utils/ledger');
const { status } = require('../utils/payments');
const { SEPAY, APP_URL } = require('../utils/env');
const { amountDue, PAY } = require('../utils/rentalFlow');
const { notify } = require('../utils/notify');
const audit = require('../utils/audit');
const { intId } = require('../utils/http');
const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

const METHODS = ['Chuyển khoản', 'Tiền mặt'];
const who = (req) => String(req.session.user.fullName || req.session.user.username).slice(0, 100);
const PAGE_SIZE = 20;

exports.index = async (req, res) => {
  const tab = ['pending', 'done', 'issues', 'all'].includes(req.query.tab) ? req.query.tab : 'pending';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const paging = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  const ISSUE = { State: { [Op.in]: ['review', 'unmatched'] } };

  const { rows, count } = tab === 'issues' || tab === 'all'
    ? await Payment.findAndCountAll({ where: tab === 'issues' ? ISSUE : {}, order: [['PaymentID', 'DESC']], ...paging })
    : await LedgerEntry.findAndCountAll({ where: { Status: tab }, order: [['EntryID', 'DESC']], ...paging });

  const ids = [...new Set(rows.map(r => r.RentalID).filter(Boolean))];
  const rentals = ids.length ? await Rental.findAll({ where: { RentalID: { [Op.in]: ids } }, attributes: ['RentalID', 'CustomerName', 'CustomerPhone', 'Status', 'RefundBank', 'RefundAccount', 'RefundHolder'] }) : [];
  const [out, inn, issues] = await Promise.all([
    LedgerEntry.sum('Amount', { where: { Status: 'pending', Direction: 'out' } }),
    LedgerEntry.sum('Amount', { where: { Status: 'pending', Direction: 'in' } }),
    Payment.count({ where: ISSUE }),
  ]);
  res.render('admin/money', {
    title: 'Sổ hoàn cọc', tab, rows, page, totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    customer: Object.fromEntries(rentals.map(r => [r.RentalID, r])),
    totals: { out: Number(out) || 0, in: Number(inn) || 0, issues },
    METHODS, SEPAY, status, webhookUrl: `${APP_URL}/webhooks/sepay`,
  });
};

exports.settle = async (req, res) => {
  const method = METHODS.includes(req.body.Method) ? req.body.Method : null;
  const reference = String(req.body.Reference || '').trim().slice(0, 100);
  if (!method || (method === 'Chuyển khoản' && reference.length < 3)) {
    req.flash('error', 'Chuyển khoản thì phải ghi mã giao dịch (ít nhất 3 ký tự).');
    return res.redirect('/admin/money');
  }
  const error = await sequelize.transaction(async (t) => {
    const id = intId(req.params.id);
    const peek = await LedgerEntry.findByPk(id, { transaction: t });
    if (!peek) return 'Không tìm thấy khoản này.';
    // khóa đơn trước: khách không đổi được tài khoản nhận giữa chừng
    const rental = peek.RentalID ? await Rental.findByPk(peek.RentalID, { transaction: t, lock: t.LOCK.UPDATE }) : null;
    const e = await LedgerEntry.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (e.Status !== 'pending') return 'Khoản này đã được xử lý trước đó.';

    let sentTo = null;
    if (e.Direction === 'out' && method === 'Chuyển khoản' && e.RentalID) {
      if (!rental?.RefundAccount) return 'Chưa có tài khoản nhận hoàn. Nhắc khách khai ở trang đơn, hoặc hoàn tiền mặt.';
      sentTo = `${rental.RefundBank} ${rental.RefundAccount}`;
      if (String(req.body.SentTo || '') !== sentTo) return 'Tài khoản nhận hoàn vừa được đổi. Kiểm tra lại đã chuyển đúng tài khoản chưa rồi ghi sổ lại.';
    }
    await e.update({ Status: 'done', Method: method, Reference: reference, SentTo: sentTo, DoneBy: who(req), DoneAt: new Date() }, { transaction: t });
    await audit.log(req, 'ledger.done', {
      rentalId: e.RentalID, amount: e.Amount, transaction: t,
      detail: [e.Direction === 'out' ? 'Hoàn' : 'Thu', method, reference, sentTo ? `tới ${rental.RefundBank} ****${rental.RefundAccount.slice(-4)}` : ''].filter(Boolean).join(' · '),
    });
    return null;
  });
  req.flash(error ? 'error' : 'success', error || 'Đã ghi sổ.');
  res.redirect('/admin/money');
};

exports.resolve = async (req, res) => {
  const action = ['refund', 'accept', 'keep'].includes(req.body.Action) ? req.body.Action : '';
  const id = intId(req.params.id);
  const result = await sequelize.transaction(async (t) => {
    const peek = await Payment.findByPk(id, { transaction: t });
    if (!peek || !action) return { error: 'Không tìm thấy giao dịch.' };
    const rental = peek.RentalID ? await Rental.findByPk(peek.RentalID, { transaction: t, lock: t.LOCK.UPDATE }) : null;
    const p = await Payment.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!['review', 'unmatched'].includes(p.State)) return { error: 'Giao dịch này đã được xử lý trước đó.' };
    const waiting = rental?.Status === 'Chờ cọc';
    const by = who(req);

    if (action === 'refund') {
      await ledger.post({ key: `payment:${p.PaymentID}`, rentalId: p.RentalID, amount: p.Amount, reason: `Hoàn giao dịch lệch: ${p.Reason || ''}`, kind: p.DataKind }, { transaction: t });
      await p.update({ State: 'refund', HandledBy: by }, { transaction: t });
      await audit.log(req, 'payment.refund', { rentalId: p.RentalID, amount: p.Amount, detail: p.Reason, transaction: t });
      return { message: 'Đã đưa vào danh sách cần hoàn.' };
    }
    if (action === 'keep') {
      if (waiting) return { error: 'Đơn còn chờ thanh toán: chọn "Nhận vào đơn" hoặc "Cần hoàn", nếu đóng thì đơn sẽ tự hủy.' };
      await p.update({ State: 'resolved', HandledBy: by }, { transaction: t });
      await audit.log(req, 'payment.keep', { rentalId: p.RentalID, amount: p.Amount, detail: p.Reason, transaction: t });
      return { message: 'Đã đánh dấu xử lý xong.' };
    }
    // accept: gộp mọi lần chuyển lệch của đơn, phần dư vào sổ hoàn
    if (!waiting || rental.PaymentMethod !== PAY.BANK) return { error: 'Chỉ nhận được vào đơn đang chờ chuyển khoản.' };
    const held = await Payment.findAll({ where: { RentalID: rental.RentalID, State: 'review' }, transaction: t });
    const total = held.reduce((s, x) => s + Number(x.Amount), 0), due = amountDue(rental);
    if (total < due) return { error: `Còn thiếu ${vnd(due - total)}. Chờ khách chuyển bù (tự xác nhận khi đủ) hoặc chọn "Cần hoàn".` };
    for (const x of held) await x.update({ State: 'confirmed', HandledBy: by }, { transaction: t });
    await rental.update({ Status: 'Đã cọc', PaymentStatus: 'Đã thanh toán', DepositPaidAt: new Date(), PaidVia: 'sepay' }, { transaction: t });
    if (total > due) await ledger.post({ key: `excess:${rental.RentalID}`, rentalId: rental.RentalID, amount: total - due, reason: 'Hoàn phần chuyển thừa', kind: rental.DataKind }, { transaction: t });
    await audit.log(req, 'payment.accept', { rental, amount: due, detail: `Đã nhận ${vnd(total)}, hoàn dư ${vnd(total - due)}`, transaction: t });
    return { message: 'Đã nhận vào đơn.', paid: rental };
  });
  if (result.paid) {
    await notify(result.paid, { key: `paid-${result.paid.RentalID}`, level: 'success', title: `Đã nhận thanh toán — đơn #${result.paid.RentalID}`, message: `Cửa hàng đã nhận đủ ${vnd(amountDue(result.paid))}. Đơn được giữ chỗ.` });
  }
  req.flash(result.error ? 'error' : 'success', result.error || result.message);
  res.redirect('/admin/money?tab=issues');
};
