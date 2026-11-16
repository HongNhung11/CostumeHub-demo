// Xử lý ngày dạng 'YYYY-MM-DD' (DATEONLY) theo giờ máy chủ (Việt Nam)
const pad = (n) => String(n).padStart(2, '0');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}
const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const viDate = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

module.exports = { todayStr, addDays, daysBetween, isDateStr, viDate };
