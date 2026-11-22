// BẢO MẬT CHUNG: header an toàn, chống CSRF, giới hạn số lần thử
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { APP_URL } = require('../utils/env');

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

// Trong Docker mọi khách có thể chung 1 IP (gateway) -> giới hạn chặt theo IP + tài khoản, nới theo IP
const loginByAccount = rateLimit({
  ...common, windowMs: 15 * 60e3, limit: 5,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.locals.loginOk === true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${keyPart(req.body?.username)}`,
  handler: tooMany('/login'),
});
const loginByIp = rateLimit({
  ...common, windowMs: 15 * 60e3, limit: 100,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.locals.loginOk === true,
  handler: tooMany('/login'),
});
const register = rateLimit({ ...common, windowMs: 60 * 60e3, limit: 30, handler: tooMany('/register') });
const forgot = rateLimit({
  ...common, windowMs: 60 * 60e3, limit: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${keyPart(req.body?.email)}`,
  handler: tooMany('/quen-mat-khau'),
});
const forgotByIp = rateLimit({ ...common, windowMs: 60 * 60e3, limit: 30, handler: tooMany('/quen-mat-khau') });
const passwordChange = rateLimit({
  ...common, windowMs: 15 * 60e3, limit: 10,
  keyGenerator: (req) => `user:${req.session?.user?.id || 0}`,
  handler: tooMany('/account'),
});

module.exports = {
  headers, csrf,
  limits: { login: [loginByIp, loginByAccount], register, forgot: [forgotByIp, forgot], passwordChange },
};
