// ===== TÀI KHOẢN CỦA TÔI (mọi vai trò): xem thông tin, sửa họ tên, đổi mật khẩu =====
const { User, Rental } = require('../models');
const { ROLES } = require('../utils/constants');
const { cleanName, checkFullName, checkPassword, checkPhone, checkEmail, cleanEmail, normalizePhone } = require('../utils/account');
const { isValidCCCD } = require('../utils/text');
const { Op } = require('sequelize');
const { ACTIVE } = require('../utils/availability');

exports.show = async (req, res) => {
  const user = await User.findByPk(req.session.user.id, { attributes: { exclude: ['password'] } });
  const rentals = await Rental.findAll({ where: { UserID: user.id }, attributes: ['Status'], raw: true });
  const stats = { total: rentals.length, active: rentals.filter(r => ACTIVE.includes(r.Status)).length, done: rentals.filter(r => r.Status === 'Hoàn tất').length };
  const notifications = await require('./notificationController').latest(user.id, 5);
  res.render('account/index', { title: 'Tài khoản của tôi', user, stats, ROLES, notifications });
};

exports.updateProfile = async (req, res) => {
  const back = '/account#thong-tin';
  const fullName = cleanName(req.body.fullName);
  const phone = normalizePhone(req.body.phone);
  const email = cleanEmail(req.body.email);
  const idCardNumber = String(req.body.idCardNumber || '').replace(/\s/g, '');
  const address = String(req.body.address || '').trim().replace(/\s+/g, ' ');
  const err = checkFullName(fullName) || checkPhone(phone) || checkEmail(email)
    || (idCardNumber && !isValidCCCD(idCardNumber) ? 'Số CCCD không hợp lệ: đúng 12 chữ số (3 số đầu là mã tỉnh 001–096).' : null)
    || (address && (address.length < 10 || address.length > 255) ? 'Địa chỉ từ 10 đến 255 ký tự.' : null);
  if (err) { req.flash('error', err); return res.redirect(back); }
  const me = req.session.user.id;
  if (await User.findOne({ where: { email, id: { [Op.ne]: me } } })) { req.flash('error', 'Email này đã được dùng cho tài khoản khác.'); return res.redirect(back); }
  await User.update({ fullName, phone, email, idCardNumber: idCardNumber || null, address: address || null }, { where: { id: me } });
  req.session.user.fullName = fullName;
  req.flash('success', 'Đã cập nhật thông tin cá nhân.');
  res.redirect(back);
};

exports.changePassword = async (req, res) => {
  const user = await User.findByPk(req.session.user.id);
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  const confirm = String(req.body.confirmPassword || '');

  if (!(await user.checkPassword(current))) { req.flash('error', 'Mật khẩu hiện tại không đúng.'); return res.redirect('/account#doi-mat-khau'); }
  const err = checkPassword(next, user.username);
  if (err) { req.flash('error', err); return res.redirect('/account#doi-mat-khau'); }
  if (next !== confirm) { req.flash('error', 'Nhập lại mật khẩu mới không khớp.'); return res.redirect('/account#doi-mat-khau'); }
  if (await user.checkPassword(next)) { req.flash('error', 'Mật khẩu mới phải khác mật khẩu hiện tại.'); return res.redirect('/account#doi-mat-khau'); }

  user.password = next;   // hook beforeUpdate sẽ băm mật khẩu
  await user.save();
  req.flash('success', 'Đã đổi mật khẩu.');
  res.redirect('/account');
};
