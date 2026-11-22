// KẾT NỐI SEPAY
// - Webhook: https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
// - API đối soát: https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach
const crypto = require('crypto');

const MAX_SKEW_SECONDS = 300;

// HMAC-SHA256 của "{timestamp}.{raw body}"; header X-SePay-Signature = "sha256=<hex>"
function verifySignature({ secret, signature, timestamp, rawBody, now = Date.now() }) {
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  const ts = String(timestamp || '');
  if (!/^\d{9,12}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > MAX_SKEW_SECONDS) return false;
  const want = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.`).update(rawBody).digest('hex'));
  const got = Buffer.from(String(signature || ''));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// "2026-11-22 14:05:33" là giờ Việt Nam; dạng ISO thì đã kèm múi giờ
function parseTime(value) {
  const s = String(value || '').trim();
  const iso = /(Z|[+-]\d\d:\d\d)$/.test(s) ? s : s.replace(' ', 'T') + '+07:00';
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

// Số tiền phải là số nguyên đồng ("2000.00" cũng hợp lệ, "2000.5" thì không)
function money(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Hai nguồn -> cùng 1 dạng. Trả về null nếu không phải giao dịch tiền vào hợp lệ
function fromWebhook(p) {
  if (!p || p.transferType !== 'in') return null;
  return build({
    source: 'webhook', id: p.id, account: p.accountNumber, va: p.subAccount, amount: p.transferAmount,
    time: p.transactionDate, content: p.content, reference: p.referenceCode, code: p.code,
  });
}
function fromApi(p) {
  if (!p || p.transfer_type !== 'in') return null;
  return build({
    source: 'api', id: p.id, account: p.account_number, va: p.va, amount: p.amount_in,
    time: p.transaction_date, content: p.transaction_content, reference: p.reference_number, code: p.code,
  });
}
function build(x) {
  const amount = money(x.amount), paidAt = parseTime(x.time);
  if (!amount || !paidAt) return null;
  const t = {
    source: x.source, amount, paidAt,
    providerId: String(x.id ?? '').slice(0, 64),
    account: String(x.account ?? '').replace(/\s/g, '').slice(0, 40),
    va: String(x.va ?? '').replace(/\s/g, '').slice(0, 40),
    content: String(x.content ?? '').slice(0, 1000),
    reference: String(x.reference ?? '').trim().slice(0, 100),
    code: String(x.code ?? '').slice(0, 40),
  };
  const key = t.reference
    ? ['ref', t.account, t.reference, amount]
    : ['raw', t.account, Math.floor(paidAt.getTime() / 1000), amount, t.content.replace(/\s+/g, ' ').trim().toUpperCase()];
  t.fingerprint = crypto.createHash('sha256').update(key.join('|')).digest('hex');
  return t;
}

// Các giao dịch tiền vào từ `since` tới nay. Đọc lại khoảng này mỗi lần là an toàn vì đã chống trùng.
async function listIncoming(cfg, since, fetchImpl = fetch) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(since);
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const q = new URLSearchParams({
      transfer_type: 'in', transaction_date_from: day, transaction_date_sort: 'asc',
      per_page: '100', page: String(page), timestamp_format: 'iso8601',
    });
    const res = await fetchImpl(`${cfg.apiBase}/transactions?${q}`, {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`SePay API trả HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.data)) throw new Error('SePay API trả dữ liệu không đúng định dạng');
    for (const row of body.data) { const t = fromApi(row); if (t) out.push(t); }
    if (!body.meta?.pagination?.has_more) break;
    await new Promise(r => setTimeout(r, 400));       // giới hạn 3 request/giây
  }
  return out;
}

module.exports = { verifySignature, fromWebhook, fromApi, listIncoming, parseTime };
