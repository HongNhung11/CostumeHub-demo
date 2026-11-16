// Yêu cầu đã đăng nhập
exports.requireLogin = (req, res, next) => {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.originalUrl; // nhớ trang đang muốn vào
  req.flash('error', 'Vui lòng đăng nhập để tiếp tục.');
  return res.redirect('/login');
};

// Yêu cầu quyền quản trị (admin hoặc nhân viên)
exports.requireStaff = (req, res, next) => {
  const u = req.session.user;
  if (u && (u.role === 'admin' || u.role === 'nhanvien')) return next();
  req.flash('error', 'Bạn không có quyền truy cập khu vực quản lý (chỉ nhân viên/admin).');
  return res.redirect('/products');
};

// Yêu cầu quyền ADMIN (cao hơn nhân viên)
exports.requireAdmin = (req, res, next) => {
  const u = req.session.user;
  if (u && u.role === 'admin') return next();
  req.flash('error', 'Chỉ Admin mới được thực hiện thao tác này (xóa / import dữ liệu).');
  return res.redirect('/products/manage');
};
