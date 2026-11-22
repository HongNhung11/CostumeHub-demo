const { User } = require('../models');
const passwordVersion = require('../utils/passwordVersion');
const { cleanName, validateAccount, checkPhone, checkEmail, cleanEmail, normalizePhone } = require('../utils/account');

// Lấy đích quay lại (ưu tiên query ?next=, rồi session.returnTo)
function getReturnTo(req) {
  const next = req.query.next || req.body.returnTo || req.session.returnTo;
  if (typeof next === 'string' && /^\/(?![/\\])[^\\\r\n\t]*$/.test(next)) return next;   // chỉ đường dẫn trong web
  return '/';
}

// Đổi session id khi đăng nhập (chống session fixation), giữ lại giỏ và lựa chọn thuê
async function startSession(req, user) {
  const keep = {};
  for (const k of ['cart', 'rentDates', 'rentZone', 'couponCode', 'viewed']) if (req.session[k] !== undefined) keep[k] = req.session[k];
  await new Promise((ok, fail) => req.session.regenerate(e => (e ? fail(e) : ok())));
  Object.assign(req.session, keep);
  req.session.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role, pv: passwordVersion(user.password) };
}

exports.loginForm = (req, res) =>
  res.render('auth/login', { title: 'Đăng nhập', returnTo: getReturnTo(req) });
exports.registerForm = (req, res) => {
  const old = req.session.registerOld || {};
  delete req.session.registerOld;
  res.render('auth/register', { title: 'Đăng ký', returnTo: getReturnTo(req), old });
};

exports.register = async (req, res) => {
  const returnTo = getReturnTo(req);
  const back = '/register' + (returnTo !== '/' ? '?next=' + encodeURIComponent(returnTo) : '');
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const fullName = cleanName(req.body.fullName);
    const phone = normalizePhone(req.body.phone);
    const email = cleanEmail(req.body.email);
    // Giữ lại thông tin đã nhập (trừ mật khẩu) khi có lỗi
    req.session.registerOld = { fullName, username, phone: req.body.phone || '', email };

    // Kiểm tra ở máy chủ (không chỉ dựa vào trình duyệt)
    const err = validateAccount({ fullName, username, password }) || checkPhone(phone) || checkEmail(email);
    if (err) { req.flash('error', err); return res.redirect(back); }

    const exists = await User.findOne({ where: { username } });
    if (exists) { req.flash('error', 'Tên đăng nhập đã tồn tại.'); return res.redirect(back); }
    if (await User.findOne({ where: { email } })) { req.flash('error', 'Email này đã được dùng cho tài khoản khác.'); return res.redirect(back); }
    const user = await User.create({ username, password, fullName, phone, email, role: 'khach' });
    delete req.session.registerOld;
    // Đăng ký xong đăng nhập luôn rồi quay lại trang trước đó
    await startSession(req, user);
    req.flash('success', `Chào mừng ${fullName || username}! Đăng ký thành công.`);
    res.redirect(returnTo);
  } catch (e) {
    req.flash('error', 'Lỗi đăng ký: ' + e.message);
    res.redirect(back);
  }
};

exports.login = async (req, res) => {
  const returnTo = getReturnTo(req);
  const username = String(req.body.username || '').slice(0, 100), password = String(req.body.password || '').slice(0, 200);
  const user = await User.findOne({ where: { username } });
  if (!user || !(await user.checkPassword(password))) {
    req.flash('error', 'Sai tên đăng nhập hoặc mật khẩu.');
    return res.redirect('/login');
  }
  if (user.isActive === false) {
    req.flash('error', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ cửa hàng.');
    return res.redirect('/login');
  }
  await startSession(req, user);
  res.locals.loginOk = true;   // đăng nhập đúng thì không tính vào giới hạn
  req.flash('success', `Xin chào ${user.fullName || user.username}!`);
  res.redirect(returnTo);
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
