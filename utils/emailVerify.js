// XÁC MINH EMAIL: liên kết dùng 1 lần, hết hạn sau 24 giờ, phải mở khi đang đăng nhập đúng tài khoản
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const mailer = require('./mailer');
const { APP_URL } = require('./env');

const TTL_HOURS = 24;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function issue(user, email) {
  if (!mailer.enabled || !email) return false;
  const token = crypto.randomBytes(32).toString('hex');
  await user.update({ PendingEmail: email, EmailVerifyHash: hash(token), EmailVerifyExpires: new Date(Date.now() + TTL_HOURS * 36e5) });
  await mailer.send(email, 'Xác minh email',
    `Tài khoản: ${user.username}\n\nĐăng nhập tài khoản này rồi mở liên kết để xác minh email (hết hạn sau ${TTL_HOURS} giờ):\n${APP_URL}/xac-minh-email/${token}\n\nKhông phải bạn? Hãy bỏ qua email này.`);
  return true;
}

function pending(userId, token, opts = {}) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  return User.findOne({ where: { id: userId, EmailVerifyHash: hash(token), EmailVerifyExpires: { [Op.gt]: new Date() } }, ...opts });
}

async function confirm(userId, token) {
  const result = await sequelize.transaction(async (t) => {
    const user = await pending(userId, token, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user || !user.PendingEmail) return { error: 'Liên kết không đúng, đã dùng hoặc đã hết hạn.' };
    const email = user.PendingEmail;
    if (await User.count({ where: { email, EmailVerifiedAt: { [Op.ne]: null }, id: { [Op.ne]: user.id } }, transaction: t })) {
      return { error: 'Email này đã được tài khoản khác xác minh.' };
    }
    const previous = user.EmailVerifiedAt && user.email !== email ? user.email : null;
    await user.update({
      email, EmailVerifiedAt: new Date(), PendingEmail: null, EmailVerifyHash: null, EmailVerifyExpires: null,
      ResetHash: null, ResetExpires: null,       // link đặt lại gửi tới email cũ hết hiệu lực
    }, { transaction: t });
    return { email, previous, username: user.username };
  });
  if (result.previous) {
    mailer.send(result.previous, 'Email tài khoản đã được đổi',
      `Email của tài khoản ${result.username} vừa được đổi sang địa chỉ khác. Nếu không phải bạn, hãy liên hệ cửa hàng ngay.`)
      .catch(e => console.error('Không báo được email cũ:', e.code || e.message));
  }
  return result;
}

module.exports = { issue, pending, confirm };
