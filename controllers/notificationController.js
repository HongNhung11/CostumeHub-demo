// THÔNG BÁO CỦA TÔI: xem danh sách, bấm để mở đơn (đánh dấu đã đọc), đánh dấu tất cả đã đọc
const { Notification } = require('../models');

const PAGE_SIZE = 20;

exports.index = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const { rows, count } = await Notification.findAndCountAll({
    where: { UserID: req.session.user.id },
    order: [['createdAt', 'DESC'], ['NotificationID', 'DESC']],
    limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
  });
  res.render('notifications/index', { title: 'Thông báo', list: rows, page, totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)), count });
};

// Bấm vào 1 thông báo: đánh dấu đã đọc rồi mở trang liên quan (chỉ đường dẫn nội bộ)
exports.open = async (req, res) => {
  const n = await Notification.findOne({ where: { NotificationID: req.params.id, UserID: req.session.user.id } });
  if (!n) return res.redirect('/notifications');
  if (!n.isRead) await n.update({ isRead: true });
  res.redirect(n.Link && /^\/[a-z]/.test(n.Link) ? n.Link : '/notifications');
};

exports.readAll = async (req, res) => {
  const [n] = await Notification.update({ isRead: true }, { where: { UserID: req.session.user.id, isRead: false } });
  req.flash('success', n ? `Đã đánh dấu ${n} thông báo là đã đọc.` : 'Không có thông báo chưa đọc.');
  res.redirect('/notifications');
};

// Vài thông báo mới nhất (cho trang Tài khoản)
exports.latest = (userId, limit = 5) =>
  Notification.findAll({ where: { UserID: userId }, order: [['createdAt', 'DESC'], ['NotificationID', 'DESC']], limit });
