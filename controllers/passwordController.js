// QUÊN MẬT KHẨU: liên kết dùng 1 lần, hết hạn sau 30 phút; CSDL chỉ lưu hash của mã
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, sequelize } = require('../models');
const { checkPassword, checkEmail, cleanEmail } = require('../utils/account');
const { APP_URL } = require('../utils/env');
const mailer = require('../utils/mailer');

const TTL_MINUTES = 30;
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

function byToken(token, opts = {}) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  return User.findOne({ where: { ResetHash: hash(token), ResetExpires: { [Op.gt]: new Date() }, isActive: true }, ...opts });
}

function expired(req, res) {
  req.flash('error', 'Liên kết không đúng, đã dùng hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.');
  return res.redirect('/quen-mat-khau');
}

exports.forgotForm = (req, res) => res.render('auth/forgot', { title: 'Quên mật khẩu', mailOn: mailer.enabled });

exports.forgot = (req, res) => {
  const email = cleanEmail(req.body.email);
  const err = checkEmail(email);
  if (err || !mailer.enabled) {
    req.flash('error', err || 'Cửa hàng chưa bật gửi email. Vui lòng liên hệ cửa hàng để được đặt lại mật khẩu.');
    return res.redirect('/quen-mat-khau');
  }
  // Trả lời ngay và giống nhau dù email có tồn tại hay không (không dò được tài khoản)
  req.flash('success', `Nếu email đã được xác minh cho một tài khoản, liên kết đặt lại mật khẩu đã được gửi (hết hạn sau ${TTL_MINUTES} phút).`);
  res.redirect('/login');
  issue(email).catch(e => console.error('Không gửi được email đặt lại mật khẩu:', e.code || e.message));
};

async function issue(email) {
  for (const user of await User.findAll({ where: { email, isActive: true, EmailVerifiedAt: { [Op.ne]: null } }, limit: 3 })) {
    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ ResetHash: hash(token), ResetExpires: new Date(Date.now() + TTL_MINUTES * 60e3) });
    await mailer.send(email, 'Đặt lại mật khẩu',
      `Tài khoản: ${user.username}\n\nMở liên kết sau để đặt mật khẩu mới (dùng 1 lần, hết hạn sau ${TTL_MINUTES} phút):\n${APP_URL}/dat-lai-mat-khau/${token}\n\nKhông phải bạn yêu cầu? Hãy bỏ qua email này.`);
  }
}

exports.resetForm = async (req, res) => {
  if (!(await byToken(req.params.token))) return expired(req, res);
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' });   // không lộ mã qua Referer
  res.render('auth/reset', { title: 'Đặt lại mật khẩu', token: req.params.token });
};

exports.reset = async (req, res) => {
  const password = String(req.body.password || ''), confirm = String(req.body.confirm || '');
  const result = await sequelize.transaction(async (t) => {
    const user = await byToken(req.params.token, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) return { expired: true };
    const error = checkPassword(password, user.username) || (password !== confirm ? 'Nhập lại mật khẩu không khớp.' : null);
    if (error) return { error };
    await user.update({ password, ResetHash: null, ResetExpires: null, PendingEmail: null, EmailVerifyHash: null }, { transaction: t });
    return { username: user.username };
  });
  if (result.expired) return expired(req, res);
  if (result.error) { req.flash('error', result.error); return res.redirect(`/dat-lai-mat-khau/${req.params.token}`); }
  delete req.session.user;
  require('../utils/device').remember(req, res, result.username);   // có email = chính chủ: không bị người lạ khóa nữa
  req.flash('success', 'Đã đặt mật khẩu mới. Mọi thiết bị đang đăng nhập đã được đăng xuất.');
  res.redirect('/login');
};
