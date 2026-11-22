// ===== TÀI KHOẢN CỦA TÔI (mọi vai trò): xem thông tin, sửa họ tên, đổi mật khẩu =====
const { User, Rental } = require('../models');
const { ROLES } = require('../utils/constants');
const { cleanName, checkFullName, checkPassword, checkPhone, checkEmail, cleanEmail, normalizePhone } = require('../utils/account');
const { isValidCCCD } = require('../utils/text');
const { Op } = require('sequelize');
const { ACTIVE } = require('../utils/availability');
const mailer = require('../utils/mailer');
const emailVerify = require('../utils/emailVerify');

exports.show = async (req, res) => {
  const user = await User.findByPk(req.session.user.id, { attributes: { exclude: ['password'] } });
  const rentals = await Rental.findAll({ where: { UserID: user.id }, attributes: ['Status'], raw: true });
  const stats = { total: rentals.length, active: rentals.filter(r => ACTIVE.includes(r.Status)).length, done: rentals.filter(r => r.Status === 'Hoàn tất').length };
  const notifications = await require('./notificationController').latest(user.id, 5);
  res.render('account/index', { mailOn: mailer.enabled, title: 'Tài khoản của tôi', user, stats, ROLES, notifications });
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
  const me = await User.findByPk(req.session.user.id);
  const changingEmail = email !== (me.email || '') && email !== (me.PendingEmail || '');
  if (changingEmail) {
    if (!(await me.checkPassword(String(req.body.currentPassword || '')))) {
      res.locals.reauthFailed = true;
      req.flash('error', 'Đổi email cần nhập đúng mật khẩu hiện tại.');
      return res.redirect(back);
    }
    if (await User.count({ where: { email, EmailVerifiedAt: { [Op.ne]: null }, id: { [Op.ne]: me.id } } })) {
      req.flash('error', 'Email này đã được dùng cho tài khoản khác.');
      return res.redirect(back);
    }
  }
  const fields = { fullName, phone, idCardNumber: idCardNumber || null, address: address || null };
  // Chưa bật SMTP thì không xác minh được: đổi luôn nhưng coi là chưa xác minh (không nhận thư, không đặt lại mật khẩu)
  if (changingEmail && !mailer.enabled) Object.assign(fields, { email, EmailVerifiedAt: null, PendingEmail: null, EmailVerifyHash: null, ResetHash: null, ResetExpires: null });
  await me.update(fields);
  req.session.user.fullName = fullName;

  if (changingEmail && mailer.enabled) {
    try {
      await emailVerify.issue(me, email);
      req.flash('success', `Đã lưu. Mở thư vừa gửi tới ${email} để xác minh; tới lúc đó email cũ vẫn được dùng.`);
    } catch (e) {
      console.error('Không gửi được email xác minh:', e.code || e.message);
      req.flash('error', 'Đã lưu thông tin nhưng chưa gửi được thư xác minh. Bấm "Gửi lại thư xác minh" sau ít phút.');
    }
    return res.redirect(back);
  }
  req.flash('success', 'Đã cập nhật thông tin cá nhân.');
  res.redirect(back);
};

exports.resendVerify = async (req, res) => {
  const user = await User.findByPk(req.session.user.id);
  const target = user.PendingEmail || (user.EmailVerifiedAt ? null : user.email);
  try {
    const sent = await emailVerify.issue(user, target);
    req.flash(sent ? 'success' : 'error', sent ? `Đã gửi thư xác minh tới ${target}.` : 'Không có email cần xác minh, hoặc cửa hàng chưa bật gửi thư.');
  } catch (e) {
    console.error('Không gửi được email xác minh:', e.code || e.message);
    req.flash('error', 'Chưa gửi được thư. Thử lại sau ít phút.');
  }
  res.redirect('/account#thong-tin');
};

exports.verifyForm = async (req, res) => {
  const user = await emailVerify.pending(req.session.user.id, req.params.token);
  if (!user) {
    req.flash('error', 'Liên kết không đúng, đã hết hạn, hoặc bạn đang đăng nhập tài khoản khác.');
    return res.redirect('/account#thong-tin');
  }
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' });
  res.render('account/verify-email', { title: 'Xác minh email', email: user.PendingEmail, token: req.params.token });
};

exports.verifyEmail = async (req, res) => {
  const r = await emailVerify.confirm(req.session.user.id, req.params.token);
  req.flash(r.error ? 'error' : 'success', r.error || `Đã xác minh ${r.email}.`);
  res.redirect('/account#thong-tin');
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

  Object.assign(user, { ResetHash: null, ResetExpires: null });
  user.password = next;   // hook beforeUpdate sẽ băm mật khẩu
  await user.save();
  req.session.user.pv = require('../utils/passwordVersion')(user.password);   // phiên này giữ nguyên, phiên khác bị đăng xuất
  req.flash('success', 'Đã đổi mật khẩu.');
  res.redirect('/account');
};
