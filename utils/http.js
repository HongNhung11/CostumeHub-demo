// Đầu vào từ URL / form: mã số, cookie, tham số truy vấn
const ID_RE = /^[1-9]\d{0,8}$/;       // nằm gọn trong INTEGER của Postgres

// Mã hợp lệ -> số, không hợp lệ -> 0 (không bản ghi nào có mã 0)
const intId = (v) => (ID_RE.test(String(v ?? '')) ? Number(v) : 0);

// Gắn vào router: mã sai định dạng -> 404, không để lọt xuống CSDL
function numericParams(router, ...names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) =>
      (ID_RE.test(value) ? next() : res.status(404).render('404', { title: 'Không tìm thấy trang' })));
  }
}

// ?q[a]=1, ?q=a&q=b -> luôn là chuỗi; page / limit trong khoảng hợp lý
function cleanQuery(req, res, next) {
  for (const [k, v] of Object.entries(req.query)) {
    const one = Array.isArray(v) ? v[0] : v;
    req.query[k] = typeof one === 'string' ? one : '';
  }
  const clamp = (key, max) => {
    if (req.query[key] === undefined) return;
    const n = parseInt(req.query[key], 10);
    req.query[key] = n >= 1 ? String(Math.min(n, max)) : '';
  };
  clamp('page', 100000);
  clamp('limit', 50);
  next();
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return ''; }
    }
  }
  return '';
}

module.exports = { intId, numericParams, cleanQuery, readCookie };
