// BẢO MẬT CHUNG: header an toàn, chống CSRF, giới hạn số lần thử
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { APP_URL } = require('../utils/env');
const { knownDevice } = require('../utils/device');

function headers(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
}

// CSRF theo khuyến nghị OWASP: Fetch Metadata + kiểm tra Origin (cookie cũng đặt SameSite=Lax).
// Áp dụng cho mọi form, kể cả multipart, mà không phải nhét token vào từng form.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const appOrigin = (() => { try { return new URL(APP_URL).origin; } catch (_) { return null; } })();

function sameOrigin(req) {
  const site = req.get('Sec-Fetch-Site');
  if (site === 'same-origin') return true;
  if (site && site !== 'none') return false;               // cross-site / same-site
  const source = req.get('Origin') || req.get('Referer');
  if (!source) return false;
  try {
    const u = new URL(source);
    return u.origin === appOrigin || u.origin === `${req.protocol}://${req.get('host')}`;
  } catch (_) { return false; }
}

function csrf(req, res, next) {
  if (SAFE_METHODS.has(req.method) || sameOrigin(req)) return next();
  return res.status(403).type('text/plain; charset=utf-8')
    .send('Yêu cầu bị từ chối vì không xuất phát từ trang CostumeHub. Hãy tải lại trang rồi thử lại.');
}

const keyPart = (v) => crypto.createHash('sha256').update(String(v || '').trim().toLowerCase().slice(0, 200)).digest('hex').slice(0, 24);
const minutesLeft = (req) => Math.max(1, Math.ceil(((req.rateLimit?.resetTime?.getTime() || 0) - Date.now()) / 60e3));
const common = { standardHeaders: 'draft-7', legacyHeaders: false };
const tooMany = (back) => (req, res) => {
  req.flash('error', `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${minutesLeft(req)} phút.`);
  res.redirect(back);
};

// Qua Docker mọi khách chung 1 IP (172.17.0.1), nên:
//  - máy quen (cookie đã ký): bộ đếm riêng theo máy, người lạ gõ sai không khóa được chính chủ
//  - máy lạ: 5 lần / 15 phút theo IP + tài khoản
//  - giới hạn gộp theo IP để rất rộng khi IP là địa chỉ nội bộ (nhiều người chung)
const sharedIp = (ip) => /^(::1$|(::ffff:)?(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd][0-9a-f]{2}:)/i.test(String(ip || ''));
const byIp = (normal, shared) => (req) => (sharedIp(req.ip) ? shared : normal);
const loginOptions = {
  ...common, windowMs: 15 * 60e3,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.locals.loginOk === true,
  handler: tooMany('/login'),
};
const device = (req) => knownDevice(req, req.body?.username);
const loginKnown = rateLimit({
  ...loginOptions, limit: 10,
  skip: (req) => !device(req),
  keyGenerator: (req) => `device:${device(req)}:${keyPart(req.body?.username)}`,
});
const loginUnknown = rateLimit({
  ...loginOptions, limit: 5,
  skip: (req) => !!device(req),
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${keyPart(req.body?.username)}`,
});
const loginByIp = rateLimit({ ...loginOptions, limit: byIp(100, 2000), skip: (req) => !!device(req) });
const register = rateLimit({ ...common, windowMs: 60 * 60e3, limit: byIp(30, 600), handler: tooMany('/register') });
const forgot = rateLimit({
  ...common, windowMs: 60 * 60e3, limit: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${keyPart(req.body?.email)}`,
  handler: tooMany('/quen-mat-khau'),
});
const forgotByIp = rateLimit({ ...common, windowMs: 60 * 60e3, limit: byIp(30, 300), handler: tooMany('/quen-mat-khau') });
const passwordChange = rateLimit({
  ...common, windowMs: 15 * 60e3, limit: 10,
  keyGenerator: (req) => `user:${req.session?.user?.id || 0}`,
  handler: tooMany('/account'),
});
// Các form phải nhập mật khẩu hiện tại (đổi email, tài khoản nhận hoàn): chỉ tính lần sai
const reauth = rateLimit({
  ...common, windowMs: 15 * 60e3, limit: 10,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.locals.reauthFailed !== true,
  keyGenerator: (req) => `reauth:${req.session?.user?.id || 0}`,
  handler: tooMany('/account'),
});

module.exports = {
  headers, csrf,
  limits: { login: [loginByIp, loginKnown, loginUnknown], register, forgot: [forgotByIp, forgot], passwordChange, reauth },
};
