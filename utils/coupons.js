// MÃ GIẢM GIÁ — kiểm tra điều kiện + tính số tiền giảm (chỉ trừ vào tiền thuê, không trừ cọc)
const { Op } = require('sequelize');
const { Coupon, Rental } = require('../models');
const { todayStr, viDate } = require('./dates');

const normCode = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

// Số tiền giảm cho 1 mã với tiền thuê `rentFee` (đã làm tròn xuống nghìn đồng)
function discountOf(c, rentFee) {
  let d = c.DiscountType === 'percent' ? rentFee * Number(c.Value) / 100 : Number(c.Value);
  if (c.DiscountType === 'percent' && Number(c.MaxDiscount) > 0) d = Math.min(d, Number(c.MaxDiscount));
  d = Math.min(d, rentFee);
  return Math.floor(d / 1000) * 1000;
}

// Mô tả ngắn cho khách: "Giảm 10% (tối đa 100.000 đ) · đơn đầu tiên · tiền thuê từ 300.000 đ · đến 31/12/2026"
function summary(c) {
  const parts = [c.DiscountType === 'percent'
    ? `Giảm ${Number(c.Value)}%${Number(c.MaxDiscount) > 0 ? ` (tối đa ${vnd(c.MaxDiscount)})` : ''}`
    : `Giảm ${vnd(c.Value)}`];
  if (c.FirstOrderOnly) parts.push('đơn đầu tiên');
  if (Number(c.MinOrder) > 0) parts.push(`tiền thuê từ ${vnd(c.MinOrder)}`);
  if (c.EndDate) parts.push(`đến ${viDate(c.EndDate)}`);
  return parts.join(' · ');
}

// Số lượt đã dùng (không tính đơn đã hủy — hủy đơn thì trả lại lượt)
const usedCount = (code, where = {}, transaction) =>
  Rental.count({ where: { CouponCode: code, Status: { [Op.ne]: 'Đã hủy' }, ...where }, transaction });

// Kiểm tra mã cho khách `userId` với tiền thuê `rentFee`.
// Trả về { coupon, discount } hoặc { error }
async function applyCoupon(rawCode, userId, rentFee, { transaction } = {}) {
  const code = normCode(rawCode);
  if (!code) return { error: 'Vui lòng nhập mã giảm giá.' };
  const c = await Coupon.findOne({ where: { Code: code }, transaction });
  if (!c || !c.isActive) return { error: `Mã "${code}" không tồn tại hoặc đã ngừng áp dụng.` };
  const today = todayStr();
  if (c.StartDate && today < c.StartDate) return { error: `Mã "${code}" áp dụng từ ngày ${viDate(c.StartDate)}.` };
  if (c.EndDate && today > c.EndDate) return { error: `Mã "${code}" đã hết hạn (${viDate(c.EndDate)}).` };
  if (Number(c.MinOrder) > 0 && rentFee < Number(c.MinOrder)) return { error: `Mã "${code}" chỉ áp dụng khi tiền thuê từ ${vnd(c.MinOrder)} (đơn của bạn: ${vnd(rentFee)}).` };
  if (c.UsageLimit && await usedCount(code, {}, transaction) >= c.UsageLimit) return { error: `Mã "${code}" đã hết lượt sử dụng.` };
  if (userId) {
    if (await usedCount(code, { UserID: userId }, transaction)) return { error: `Bạn đã dùng mã "${code}" rồi (mỗi khách dùng 1 lần).` };
    if (c.FirstOrderOnly && await Rental.count({ where: { UserID: userId, Status: { [Op.ne]: 'Đã hủy' } }, transaction })) {
      return { error: `Mã "${code}" chỉ dành cho đơn thuê đầu tiên.` };
    }
  }
  const discount = discountOf(c, rentFee);
  if (discount <= 0) return { error: `Mã "${code}" không giảm được cho đơn này.` };
  return { coupon: c, discount };
}

// Các mã đang áp dụng (hiện gợi ý ở giỏ thuê)
async function activeCoupons() {
  const today = todayStr();
  const list = await Coupon.findAll({
    where: {
      isActive: true,
      [Op.and]: [
        { [Op.or]: [{ StartDate: null }, { StartDate: { [Op.lte]: today } }] },
        { [Op.or]: [{ EndDate: null }, { EndDate: { [Op.gte]: today } }] },
      ],
    },
    order: [['CouponID', 'ASC']],
  });
  const out = [];
  for (const c of list) if (!c.UsageLimit || await usedCount(c.Code) < c.UsageLimit) out.push(c);
  return out;
}

module.exports = { normCode, discountOf, summary, applyCoupon, activeCoupons, usedCount };
