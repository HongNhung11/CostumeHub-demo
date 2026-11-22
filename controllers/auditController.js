// NHẬT KÝ TIỀN toàn cửa hàng (chỉ admin)
const { AuditLog } = require('../models');
const { ACTIONS } = require('../utils/audit');
const { intId } = require('../utils/http');

const PAGE_SIZE = 30;

exports.index = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const action = Object.hasOwn(ACTIONS, req.query.action || '') ? req.query.action : '';
  const rental = intId(req.query.rental);
  const where = { ...(action ? { Action: action } : {}), ...(rental ? { RentalID: rental } : {}) };
  const { rows, count } = await AuditLog.findAndCountAll({ where, order: [['LogID', 'DESC']], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  res.render('admin/audit', { title: 'Nhật ký tiền', rows, page, action, rental, ACTIONS, count, totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)) });
};
