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

// Thông báo trên chuông -> gửi thêm email. Chỉ lấy thông báo 24 giờ gần nhất để bật SMTP không gửi dồn tin cũ.
const MAX_TRIES = 5;
async function sendPending() {
  if (!enabled) return 0;
  const { Notification, User } = require('../models');
  const rows = await Notification.findAll({
    where: {
      EmailedAt: null,
      createdAt: { [Op.gte]: new Date(Date.now() - 864e5) },
      [Op.or]: [{ EmailTries: null }, { EmailTries: { [Op.lt]: MAX_TRIES } }],
    },
    order: [['NotificationID', 'ASC']], limit: 30,
  });
  let sent = 0;
  for (const n of rows) {
    const user = await User.findByPk(n.UserID, { attributes: ['email', 'isActive'] });
    if (!user?.email || user.isActive === false) { await n.update({ EmailTries: MAX_TRIES }); continue; }
    try {
      await send(user.email, n.Title, [n.Message, n.Link ? `Xem chi tiết: ${APP_URL}${n.Link}` : ''].filter(Boolean).join('\n\n'));
      await n.update({ EmailedAt: new Date() });
      sent++;
    } catch (e) {
      await n.update({ EmailTries: (n.EmailTries || 0) + 1 });
      console.error(`Không gửi được email thông báo #${n.NotificationID}:`, e.code || e.message);
      break;   // SMTP đang lỗi: để lượt sau thử tiếp
    }
  }
  return sent;
}

module.exports = { enabled, send, sendPending };
