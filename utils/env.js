// CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (.env) — đọc ở một chỗ, kiểm tra ngay khi khởi động
const BANKS = require('../config/banks.json');

const str = (k, d = '') => String(process.env[k] ?? d).trim();
const bool = (k, d = false) => (str(k) ? /^(1|true|yes|on)$/i.test(str(k)) : d);
const int = (k, d, min, max) => {
  const n = Number(str(k) || d);
  return Number.isInteger(n) && n >= min && n <= max ? n : d;
};

const findBank = (key) => {
  const k = key.toLowerCase();
  return k ? BANKS.find(b => [b.code, b.bin, b.name].some(v => v.toLowerCase() === k)) || null : null;
};

// SEPAY_MODE: off (không nhận chuyển khoản) | sandbox (Test mode, không có tiền thật) | live (tiền thật)
function sepayConfig() {
  const mode = str('SEPAY_MODE', 'off').toLowerCase();
  const c = {
    mode,
    account: str('SEPAY_ACCOUNT').replace(/\s/g, ''),
    va: str('SEPAY_VA').replace(/\s/g, ''),          // một số ngân hàng bắt buộc chuyển vào tài khoản ảo
    owner: str('SEPAY_ACCOUNT_NAME').toUpperCase(),
    bank: findBank(str('SEPAY_BANK')),
    secret: str('SEPAY_WEBHOOK_SECRET'),              // khóa HMAC của webhook
    token: str('SEPAY_API_TOKEN'),                    // API token để đối soát (chạy được ở localhost)
    problems: [],
  };
  c.apiBase = mode === 'sandbox' ? 'https://userapi-sandbox.sepay.vn/v2' : 'https://userapi.sepay.vn/v2';
  if (mode === 'off') c.problems.push('SEPAY_MODE đang là off');
  else {
    if (!['sandbox', 'live'].includes(mode)) c.problems.push('SEPAY_MODE chỉ nhận off, sandbox hoặc live');
    if (!/^[A-Za-z0-9]{4,19}$/.test(c.account)) c.problems.push('SEPAY_ACCOUNT trống hoặc sai định dạng');
    if (c.va && !/^[A-Za-z0-9]{4,19}$/.test(c.va)) c.problems.push('SEPAY_VA sai định dạng');
    // Số tài khoản mẫu của bản demo cũ: tuyệt đối không cho khách chuyển tiền thật vào đây
    if (mode === 'live' && ['0123456789', '0000000000'].includes(c.account)) c.problems.push('SEPAY_ACCOUNT vẫn là số tài khoản mẫu');
    if (!c.bank) c.problems.push('SEPAY_BANK không có trong config/banks.json (VD MB, VCB, ACB)');
    if (!c.owner) c.problems.push('SEPAY_ACCOUNT_NAME trống');
    if (!c.secret && !c.token) c.problems.push('Cần SEPAY_WEBHOOK_SECRET hoặc SEPAY_API_TOKEN để tự xác nhận');
  }
  c.enabled = !c.problems.length;
  c.receiveAccount = c.va || c.account;
  return c;
}

module.exports = {
  findBank,
  sepayConfig,
  SEPAY: sepayConfig(),
  APP_URL: str('APP_URL', `http://localhost:${str('PORT', '3000')}`).replace(/\/+$/, ''),
  SHOW_DEMO_ACCOUNTS: bool('SHOW_DEMO_ACCOUNTS'),
  TRUST_PROXY: int('TRUST_PROXY', 0, 0, 5),
  IDCARD_KEEP_DAYS: int('IDCARD_KEEP_DAYS', 30, 1, 3650),
  SMTP: {
    host: str('SMTP_HOST'),
    port: int('SMTP_PORT', 587, 1, 65535),
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS').replace(/\s/g, ''),        // mật khẩu ứng dụng Gmail hiển thị kèm khoảng trắng
    from: str('SMTP_FROM') || str('SMTP_USER'),
  },
};
