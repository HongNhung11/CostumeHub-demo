// "MÁY QUEN" (OWASP device cookie)
// Qua Docker mọi khách chung 1 IP, nên giới hạn theo IP + tài khoản cho phép người lạ khóa chính chủ.
// Máy đã từng đăng nhập đúng có bộ đếm riêng: người lạ gõ sai chỉ khóa các máy lạ.
const crypto = require('crypto');
const { readCookie } = require('./http');

const NAME = 'ch.dev';
const norm = (u) => String(u || '').trim().toLowerCase();
const sign = (nonce, username) =>
  crypto.createHmac('sha256', String(process.env.SESSION_SECRET || '')).update(`device|${nonce}|${norm(username)}`).digest('hex');

// Trả về mã máy nếu cookie hợp lệ cho đúng tài khoản này
function knownDevice(req, username) {
  if (!norm(username)) return null;
  const m = readCookie(req, NAME).match(/^([a-f0-9]{32})\.([a-f0-9]{64})$/);
  if (!m) return null;
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(sign(m[1], username))) ? m[1] : null;
}

function remember(req, res, username) {
  if (knownDevice(req, username)) return;
  const nonce = crypto.randomBytes(16).toString('hex');
  res.cookie(NAME, `${nonce}.${sign(nonce, username)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 180 * 864e5, path: '/' });
}

module.exports = { knownDevice, remember };
