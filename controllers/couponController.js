// QUẢN LÝ MÃ GIẢM GIÁ (admin): tạo mã, bật / tắt, xóa mã chưa dùng
const { Coupon, Rental } = require('../models');
const { normCode, summary, usedCount } = require('../utils/coupons');
const { isDateStr } = require('../utils/dates');

exports.index = async (req, res) => {
  const coupons = await Coupon.findAll({ order: [['CouponID', 'DESC']] });
  for (const c of coupons) { c.used = await usedCount(c.Code); c.summary = summary(c); }
  const old = req.session.couponOld || {};
  delete req.session.couponOld;
  res.render('admin/coupons', { title: 'Mã giảm giá', coupons, old });
};

exports.create = async (req, res) => {
  const b = req.body;
  const fail = (msg) => { req.session.couponOld = b; req.flash('error', msg); return res.redirect('/admin/coupons'); };
  const code = normCode(b.Code);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail('Mã gồm 3–30 ký tự: chữ không dấu, số, "-" hoặc "_" (VD: CHAOBANMOI).');
  if (await Coupon.findOne({ where: { Code: code } })) return fail(`Mã "${code}" đã tồn tại.`);
  const type = b.DiscountType === 'amount' ? 'amount' : 'percent';
  const int = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : NaN);
  const value = int(b.Value);
  if (type === 'percent' && !(value >= 1 && value <= 100)) return fail('Phần trăm giảm phải từ 1 đến 100.');
  if (type === 'amount' && !(value >= 1000 && value % 1000 === 0)) return fail('Số tiền giảm phải từ 1.000 đ và tròn nghìn.');
  const optInt = (v, label, round) => {
    if (String(v ?? '').trim() === '') return null;
    const n = int(v);
    if (!(n >= 0) || (round && n % 1000 !== 0)) throw new Error(`${label} phải là số nguyên ≥ 0${round ? ', tròn nghìn' : ''}.`);
    return n;
  };
  let maxDiscount, minOrder, limit;
  try {
    maxDiscount = type === 'percent' ? optInt(b.MaxDiscount, 'Giảm tối đa', true) : null;
    minOrder = optInt(b.MinOrder, 'Tiền thuê tối thiểu', true) || 0;
    limit = optInt(b.UsageLimit, 'Số lượt dùng', false);
  } catch (e) { return fail(e.message); }
  const start = String(b.StartDate || ''), end = String(b.EndDate || '');
  if (start && !isDateStr(start)) return fail('Ngày bắt đầu không hợp lệ.');
  if (end && !isDateStr(end)) return fail('Ngày kết thúc không hợp lệ.');
  if (start && end && end < start) return fail('Ngày kết thúc phải sau ngày bắt đầu.');

  const c = await Coupon.create({
    Code: code, Description: String(b.Description || '').trim().slice(0, 200) || null,
    DiscountType: type, Value: value, MaxDiscount: maxDiscount || null, MinOrder: minOrder,
    StartDate: start || null, EndDate: end || null, UsageLimit: limit || null,
    FirstOrderOnly: b.FirstOrderOnly === '1', isActive: true,
  });
  req.flash('success', `Đã tạo mã ${c.Code}: ${summary(c)}.`);
  res.redirect('/admin/coupons');
};

exports.toggle = async (req, res) => {
  const c = await Coupon.findByPk(req.params.id);
  if (c) { c.isActive = !c.isActive; await c.save(); req.flash('success', `Đã ${c.isActive ? 'bật' : 'tắt'} mã ${c.Code}.`); }
  res.redirect('/admin/coupons');
};

// Chỉ xóa mã chưa từng dùng (để hóa đơn cũ vẫn ghi đúng mã); đã dùng thì tắt
exports.remove = async (req, res) => {
  const c = await Coupon.findByPk(req.params.id);
  if (!c) return res.redirect('/admin/coupons');
  if (await Rental.unscoped().count({ where: { CouponCode: c.Code } })) {
    req.flash('error', `Mã ${c.Code} đã được dùng trong đơn thuê — không xóa được, hãy bấm "Tắt" để ngừng áp dụng.`);
  } else {
    await c.destroy();
    req.flash('success', `Đã xóa mã ${c.Code}.`);
  }
  res.redirect('/admin/coupons');
};
