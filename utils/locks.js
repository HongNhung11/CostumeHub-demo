// KHÓA DÒNG chống đặt trùng lịch trên Postgres.
// READ COMMITTED: sau khi chờ được khóa, các câu SELECT tiếp theo thấy dữ liệu bên trước vừa ghi.
// Luôn khóa theo thứ tự người dùng -> sản phẩm (id tăng dần) -> mã giảm giá để không kẹt chéo.
// SQLite bỏ qua FOR UPDATE (mỗi lúc chỉ có 1 giao dịch ghi).
const { Op } = require('sequelize');
const { Product, User, Coupon } = require('../models');

const locked = (t) => ({ transaction: t, lock: t.LOCK.UPDATE });

async function lockUser(id, t) {
  return User.findByPk(id, { attributes: ['id'], ...locked(t) });
}

async function lockProducts(ids, t) {
  const list = [...new Set(ids)].filter(Boolean).sort((a, b) => a - b);
  if (!list.length) return [];
  return Product.findAll({ where: { ProductID: { [Op.in]: list } }, order: [['ProductID', 'ASC']], ...locked(t) });
}

async function lockCoupon(code, t) {
  return Coupon.findOne({ where: { Code: code }, ...locked(t) });
}

module.exports = { lockUser, lockProducts, lockCoupon };
