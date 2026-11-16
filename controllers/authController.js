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
  const back = '/register' + (returnTo !== '/' ? '?next=' + encodeURIComponent(returnTo) : '');
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const fullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ');

    // Kiểm tra ở máy chủ (không chỉ dựa vào trình duyệt)
    let err = null;
    if (fullName.length < 2 || fullName.length > 100) err = 'Họ tên phải từ 2 đến 100 ký tự.';
    else if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) err = 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới.';
    else if (password.length < 6 || password.length > 100) err = 'Mật khẩu phải có ít nhất 6 ký tự.';
    else if (password.toLowerCase() === username.toLowerCase()) err = 'Mật khẩu không được trùng tên đăng nhập.';
    if (err) { req.flash('error', err); return res.redirect(back); }

    const exists = await User.findOne({ where: { username } });
    if (exists) { req.flash('error', 'Tên đăng nhập đã tồn tại.'); return res.redirect(back); }
    const user = await User.create({ username, password, fullName, role: 'khach' });
    // Đăng ký xong đăng nhập luôn rồi quay lại trang trước đó
    req.session.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    delete req.session.returnTo;
    req.flash('success', `Chào mừng ${fullName || username}! Đăng ký thành công.`);
    res.redirect(returnTo);
  } catch (e) {
    req.flash('error', 'Lỗi đăng ký: ' + e.message);
    res.redirect(back);
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
