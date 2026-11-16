const { User } = require('../models');

// Lấy đích quay lại (ưu tiên query ?next=, rồi session.returnTo)
function getReturnTo(req) {
  const next = req.query.next || req.body.returnTo || req.session.returnTo;
  if (next && typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

exports.loginForm = (req, res) =>
  res.render('auth/login', { title: 'Đăng nhập', returnTo: getReturnTo(req) });
exports.registerForm = (req, res) =>
  res.render('auth/register', { title: 'Đăng ký', returnTo: getReturnTo(req) });

exports.register = async (req, res) => {
  const returnTo = getReturnTo(req);
  try {
    const { username, password, fullName } = req.body;
    const exists = await User.findOne({ where: { username } });
    if (exists) { req.flash('error', 'Tên đăng nhập đã tồn tại.'); return res.redirect('/register'); }
    const user = await User.create({ username, password, fullName, role: 'khach' });
    // Đăng ký xong đăng nhập luôn rồi quay lại trang trước đó
    req.session.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    delete req.session.returnTo;
    req.flash('success', `Chào mừng ${fullName || username}! Đăng ký thành công.`);
    res.redirect(returnTo);
  } catch (e) {
    req.flash('error', 'Lỗi đăng ký: ' + e.message);
    res.redirect('/register');
  }
};

exports.login = async (req, res) => {
  const returnTo = getReturnTo(req);
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user || !(await user.checkPassword(password))) {
    req.flash('error', 'Sai tên đăng nhập hoặc mật khẩu.');
    return res.redirect('/login');
  }
  req.session.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
  delete req.session.returnTo;
  req.flash('success', `Xin chào ${user.fullName || user.username}!`);
  res.redirect(returnTo);
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
