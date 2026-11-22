// EMAIL qua SMTP (Gmail: dùng "Mật khẩu ứng dụng"). Chưa khai SMTP thì chỉ có thông báo trên web.
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { SMTP, APP_URL } = require('./env');

const enabled = !!(SMTP.host && SMTP.from);
const transport = enabled ? nodemailer.createTransport({
  host: SMTP.host, port: SMTP.port,
  secure: SMTP.port === 465,
  requireTLS: !!SMTP.user && SMTP.port !== 465,   // có mật khẩu thì không gửi qua kết nối trần
  auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass } : undefined,
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
}) : null;

async function send(to, subject, text) {
  if (!enabled) return false;
  await transport.sendMail({
    from: { name: 'CostumeHub', address: SMTP.from },
    to, subject: `[CostumeHub] ${String(subject).replace(/[\r\n]+/g, ' ')}`,
    text: `${text}\n\n—\nCostumeHub\n${APP_URL}`,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return true;
}

// Thông báo trên chuông -> gửi thêm email (chỉ tới email đã xác minh).
//  - Máy chủ thư hỏng: dừng lượt này, KHÔNG tính là 1 lần thử; thư chờ tới KEEP_HOURS.
//  - Riêng 1 địa chỉ lỗi: thử lại giãn dần, không chặn thư của người khác.
const KEEP_HOURS = 72;
const BACKOFF_MIN = [1, 5, 15, 60, 180, 360, 720, 1440];
const MAX_TRIES = BACKOFF_MIN.length;
const SERVER_DOWN = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EAUTH', 'EDNS', 'ETLS', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'EOAUTH2', 'ENOAUTH']);

async function sendPending() {
  if (!enabled) return 0;
  const { Notification, User, Rental } = require('../models');
  const rows = await Notification.findAll({
    where: {
      EmailedAt: null,
      createdAt: { [Op.gte]: new Date(Date.now() - KEEP_HOURS * 36e5) },
      [Op.and]: [
        { [Op.or]: [{ EmailTries: null }, { EmailTries: { [Op.lt]: MAX_TRIES } }] },
        { [Op.or]: [{ EmailNextAt: null }, { EmailNextAt: { [Op.lte]: new Date() } }] },
      ],
    },
    order: [['NotificationID', 'ASC']], limit: 30,
  });
  let sent = 0;
  for (const n of rows) {
    const user = await User.findByPk(n.UserID, { attributes: ['email', 'isActive', 'EmailVerifiedAt'] });
    const deliverable = user?.email && user.EmailVerifiedAt && user.isActive !== false
      && (!n.RentalID || await Rental.count({ where: { RentalID: n.RentalID } }));   // đơn mẫu / đơn thử đang ẩn thì không gửi
    if (!deliverable) { await n.update({ EmailTries: MAX_TRIES }); continue; }
    try {
      await send(user.email, n.Title, [n.Message, n.Link ? `Xem chi tiết: ${APP_URL}${n.Link}` : ''].filter(Boolean).join('\n\n'));
      await n.update({ EmailedAt: new Date() });
      sent++;
    } catch (e) {
      console.error(`Không gửi được email thông báo #${n.NotificationID}:`, e.code || e.message);
      if (SERVER_DOWN.has(e.code)) break;
      const tries = n.EmailTries || 0;
      await n.update({ EmailTries: tries + 1, EmailNextAt: new Date(Date.now() + BACKOFF_MIN[tries] * 60e3) });
    }
  }
  return sent;
}

module.exports = { enabled, send, sendPending };
