// LIÊN HỆ / TƯ VẤN
// - Khách: gửi form ở trang /contact -> lưu vào bảng ContactRequests
// - Admin + nhân viên: /admin/contacts xem danh sách, gọi lại tư vấn, đổi trạng thái, ghi chú
const { ContactRequest, User } = require('../models');
const { normalizePhone, isValidPhone, normalize } = require('../utils/text');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ===== Trang liên hệ (khách) — điền sẵn thông tin nếu đã đăng nhập =====
exports.form = async (req, res) => {
  let prefill = {};
  if (req.session.user) {
    const u = await User.findByPk(req.session.user.id);
    if (u) prefill = { name: u.fullName || '', phone: u.phone || '', email: u.email || '' };
  }
  res.render('home/contact', { title: 'Liên hệ', TOPICS: ContactRequest.TOPICS, old: req.session.contactOld || prefill });
  delete req.session.contactOld;
};

// ===== Khách gửi form =====
exports.submit = async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(req.body.phone);
  const email = String(req.body.email || '').trim().toLowerCase();
  const topic = ContactRequest.TOPICS.includes(req.body.topic) ? req.body.topic : 'Khác';
  const message = String(req.body.message || '').trim();

  let error = null;
  if (name.length < 2 || name.length > 100) error = 'Vui lòng nhập họ tên (2–100 ký tự).';
  else if (!isValidPhone(phone)) error = 'Số điện thoại không hợp lệ: 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.';
  else if (email && !EMAIL_RE.test(email)) error = 'Email không hợp lệ.';
  else if (message.length < 5 || message.length > 2000) error = 'Nội dung từ 5 đến 2000 ký tự.';
  if (error) {
    req.session.contactOld = { name, phone: req.body.phone, email, topic, message };
    req.flash('error', error);
    return res.redirect('/contact');
  }
  await ContactRequest.create({
    UserID: req.session.user ? req.session.user.id : null,
    Name: name, Phone: phone, Email: email || null, Topic: topic, Message: message,
  });
  req.flash('success', 'Cảm ơn bạn! Nhân viên CostumeHub sẽ gọi lại tư vấn trong giờ làm việc (8:00 – 21:00).');
  res.redirect('/contact');
};

// ===== Danh sách cho admin / nhân viên =====
const PAGE_SIZE = 20;
exports.index = async (req, res) => {
  const status = ContactRequest.STATUSES.includes(req.query.status) ? req.query.status : '';
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);

  const where = status ? { Status: status } : {};
  let list = await ContactRequest.findAll({ where, order: [['createdAt', 'DESC']] });
  if (q) {
    const nq = normalize(q), digits = q.replace(/\D/g, '');
    list = list.filter(c => normalize(c.Name).includes(nq) || normalize(c.Message).includes(nq) ||
      (c.Email || '').includes(q.toLowerCase()) || (digits.length >= 3 && c.Phone.includes(digits)));
  }
  const counts = { all: await ContactRequest.count() };
  for (const s of ContactRequest.STATUSES) counts[s] = await ContactRequest.count({ where: { Status: s } });

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  res.render('admin/contacts', {
    title: 'Khách liên hệ', status, q, page, pages, counts,
    list: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    STATUSES: ContactRequest.STATUSES,
  });
};

// ===== Đổi trạng thái + ghi chú =====
exports.update = async (req, res) => {
  const c = await ContactRequest.findByPk(req.params.id);
  if (!c) { req.flash('error', 'Không tìm thấy yêu cầu liên hệ.'); return res.redirect('/admin/contacts'); }
  const status = ContactRequest.STATUSES.includes(req.body.Status) ? req.body.Status : c.Status;
  const note = String(req.body.Note || '').trim().slice(0, 2000);
  const me = req.session.user;
  await c.update({ Status: status, Note: note || null, HandledBy: me.fullName || me.username });
  req.flash('success', `Đã cập nhật yêu cầu của ${c.Name}.`);
  // quay lại đúng trang / bộ lọc đang xem
  const back = String(req.body.back || '');
  res.redirect(back.startsWith('/admin/contacts') ? back : '/admin/contacts');
};

// ===== Xóa (chỉ admin) =====
exports.remove = async (req, res) => {
  await ContactRequest.destroy({ where: { ContactID: req.params.id } });
  req.flash('success', 'Đã xóa yêu cầu liên hệ.');
  res.redirect('/admin/contacts');
};

// Số yêu cầu "Mới" (badge đỏ trên menu Liên hệ của nhân viên)
exports.countNew = () => ContactRequest.count({ where: { Status: 'Mới' } });
