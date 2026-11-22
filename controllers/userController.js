// ===== QUẢN LÝ TÀI KHOẢN (chỉ ADMIN) =====
// Tạo tài khoản nhân viên/admin/khách, đổi vai trò, khóa/mở khóa, đặt lại mật khẩu.
const { Op } = require('sequelize');
const { User, Rental } = require('../models');
const { ROLES } = require('../utils/constants');
const { cleanName, validateAccount, checkPassword } = require('../utils/account');
const { normalize } = require('../utils/text');

const PAGE_SIZE = 15;
const back = (req) => {
  const ref = req.get('Referer') || '';
  return /\/admin\/users(\?|$)/.test(ref) ? ref : '/admin/users';
};

// Còn ít nhất 1 admin đang hoạt động ngoài tài khoản này không?
async function otherActiveAdmins(exceptId) {
  return User.count({ where: { role: 'admin', isActive: true, id: { [Op.ne]: exceptId } } });
}

// ===== Danh sách tài khoản: tìm kiếm + lọc vai trò / trạng thái + phân trang =====
exports.index = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const role = ROLES[req.query.role] ? req.query.role : '';
  const state = ['active', 'locked'].includes(req.query.state) ? req.query.state : '';
  const page = Math.max(1, parseInt(req.query.page) || 1);

  let users = await User.findAll({ order: [['id', 'ASC']], attributes: { exclude: ['password'] } });
  const counts = { all: users.length, locked: users.filter(u => u.isActive === false).length };
  for (const r of Object.keys(ROLES)) counts[r] = users.filter(u => u.role === r).length;

  if (role) users = users.filter(u => u.role === role);
  if (state === 'active') users = users.filter(u => u.isActive !== false);
  if (state === 'locked') users = users.filter(u => u.isActive === false);
  if (q) {
    const nq = normalize(q);
    users = users.filter(u => normalize(u.username).includes(nq) || normalize(u.fullName).includes(nq));
  }

  // Số đơn thuê của mỗi tài khoản trên trang
  const total = users.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rentalCounts = {};
  if (rows.length) {
    const rs = await Rental.findAll({ attributes: ['UserID'], where: { UserID: { [Op.in]: rows.map(u => u.id) } }, raw: true });
    rs.forEach(r => { rentalCounts[r.UserID] = (rentalCounts[r.UserID] || 0) + 1; });
  }

  const old = req.session.userFormOld || {};
  delete req.session.userFormOld;
  res.render('admin/users', {
    title: 'Quản lý tài khoản', users: rows, rentalCounts, counts, ROLES,
    q, role, state, page, totalPages, total, old, me: req.session.user,
  });
};

// ===== Tạo tài khoản mới (thường là nhân viên) =====
exports.create = async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const fullName = cleanName(req.body.fullName);
  const role = ROLES[req.body.role] ? req.body.role : 'nhanvien';
  const fail = (msg) => {
    req.session.userFormOld = { username, fullName, role };
    req.flash('error', msg);
    return res.redirect('/admin/users#tao-tai-khoan');
  };

  const err = validateAccount({ fullName, username, password });
  if (err) return fail(err);
  if (await User.findOne({ where: { username } })) return fail(`Tên đăng nhập "${username}" đã tồn tại.`);

  await User.create({ username, password, fullName, role, isVerified: true, isActive: true });
  req.flash('success', `Đã tạo tài khoản ${ROLES[role]} "${username}".`);
  res.redirect('/admin/users');
};

// ===== Đổi vai trò =====
exports.changeRole = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  const role = req.body.role;
  if (!user || !ROLES[role]) { req.flash('error', 'Dữ liệu không hợp lệ.'); return res.redirect(back(req)); }
  if (user.id === req.session.user.id) { req.flash('error', 'Bạn không thể tự đổi vai trò của chính mình.'); return res.redirect(back(req)); }
  if (user.role === 'admin' && role !== 'admin' && user.isActive && !(await otherActiveAdmins(user.id))) {
    req.flash('error', 'Phải còn ít nhất 1 admin đang hoạt động.'); return res.redirect(back(req));
  }
  if (user.role !== role) {
    const from = ROLES[user.role] || user.role;
    user.role = role;
    await user.save();
    req.flash('success', `Đã đổi "${user.username}" từ ${from} sang ${ROLES[role]}.`);
  }
  res.redirect(back(req));
};

// ===== Khóa / mở khóa =====
exports.toggleLock = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) { req.flash('error', 'Không tìm thấy tài khoản.'); return res.redirect(back(req)); }
  if (user.id === req.session.user.id) { req.flash('error', 'Bạn không thể tự khóa tài khoản của chính mình.'); return res.redirect(back(req)); }
  const locking = user.isActive !== false;
  if (locking && user.role === 'admin' && !(await otherActiveAdmins(user.id))) {
    req.flash('error', 'Phải còn ít nhất 1 admin đang hoạt động.'); return res.redirect(back(req));
  }
  user.isActive = !locking;
  await user.save();
  req.flash('success', locking
    ? `Đã khóa "${user.username}". Tài khoản này bị đăng xuất và không thể đăng nhập.`
    : `Đã mở khóa "${user.username}".`);
  res.redirect(back(req));
};

// ===== Đặt lại mật khẩu =====
exports.resetPassword = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) { req.flash('error', 'Không tìm thấy tài khoản.'); return res.redirect(back(req)); }
  const password = String(req.body.password || '');
  const err = checkPassword(password, user.username);
  if (err) { req.flash('error', `Không đổi được mật khẩu "${user.username}": ${err}`); return res.redirect(back(req)); }
  Object.assign(user, { ResetHash: null, ResetExpires: null, PendingEmail: null, EmailVerifyHash: null });
  user.password = password;              // hook beforeUpdate sẽ băm mật khẩu
  await user.save();
  req.flash('success', `Đã đặt lại mật khẩu cho "${user.username}".`);
  res.redirect(back(req));
};
