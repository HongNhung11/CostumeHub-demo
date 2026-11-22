// SỔ HOÀN CỌC + GIAO DỊCH CẦN XỬ LÝ (nhân viên / admin)
const { Op } = require('sequelize');
const { sequelize, LedgerEntry, Payment, Rental } = require('../models');
const ledger = require('../utils/ledger');
const { status } = require('../utils/payments');
const { SEPAY, APP_URL } = require('../utils/env');

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
  const rentals = ids.length ? await Rental.findAll({ where: { RentalID: { [Op.in]: ids } }, attributes: ['RentalID', 'CustomerName', 'CustomerPhone'] }) : [];
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
  const [n] = await LedgerEntry.update(
    { Status: 'done', Method: method, Reference: reference, DoneBy: who(req), DoneAt: new Date() },
    { where: { EntryID: parseInt(req.params.id) || 0, Status: 'pending' } },
  );
  req.flash(n ? 'success' : 'error', n ? 'Đã ghi sổ.' : 'Khoản này đã được xử lý trước đó.');
  res.redirect('/admin/money');
};

exports.resolve = async (req, res) => {
  const refund = req.body.Action === 'refund';
  const done = await sequelize.transaction(async (t) => {
    const p = await Payment.findByPk(parseInt(req.params.id) || 0, { transaction: t, lock: t.LOCK.UPDATE });
    if (!p || !['review', 'unmatched'].includes(p.State)) return false;
    if (refund) await ledger.post({ key: `payment:${p.PaymentID}`, rentalId: p.RentalID, amount: p.Amount, reason: `Hoàn giao dịch lệch: ${p.Reason || ''}` }, { transaction: t });
    await p.update({ State: refund ? 'refund' : 'resolved', HandledBy: who(req) }, { transaction: t });
    return true;
  });
  req.flash(done ? 'success' : 'error', !done ? 'Giao dịch này đã được xử lý trước đó.' : refund ? 'Đã đưa vào danh sách cần hoàn.' : 'Đã đánh dấu xử lý xong.');
  res.redirect('/admin/money?tab=issues');
};
