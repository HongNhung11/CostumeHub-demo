// BẢNG SỐ ĐO THEO SIZE (cm): vòng ngực, eo, mông + chiều cao gợi ý.
// Lưu ở Product.SizeChart dạng JSON: { "S": { bust: "80-84", waist: "62-66", hip: "86-90", height: "150-158" }, ... }
// Không bắt buộc (phụ kiện thường không cần). Mỗi ô ghi 1 số (82) hoặc khoảng (80-84).
const { splitList } = require('./text');

const FIELDS = [
  { key: 'bust', label: 'Vòng ngực' },
  { key: 'waist', label: 'Vòng eo' },
  { key: 'hip', label: 'Vòng mông' },
  { key: 'height', label: 'Chiều cao' },
];
const VALUE_RE = /^\d{2,3}(\s*[-–]\s*\d{2,3})?$/;

// Số đo tham khảo cho size chữ phổ biến (dùng cho dữ liệu mẫu)
const STANDARD = {
  XS: { bust: '76-80', waist: '58-62', hip: '82-86', height: '145-152' },
  S: { bust: '80-84', waist: '62-66', hip: '86-90', height: '150-158' },
  M: { bust: '84-88', waist: '66-70', hip: '90-94', height: '155-162' },
  L: { bust: '88-92', waist: '70-74', hip: '94-98', height: '158-165' },
  XL: { bust: '92-96', waist: '74-78', hip: '98-102', height: '160-168' },
  XXL: { bust: '96-100', waist: '78-82', hip: '102-106', height: '160-170' },
};

function parseChart(str) {
  try { const o = JSON.parse(str || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
}

// Các dòng của bảng theo đúng thứ tự size của sản phẩm; chỉ lấy size có ít nhất 1 số đo
function chartRows(product) {
  const chart = parseChart(product.SizeChart);
  return splitList(product.Size)
    .map(size => ({ size, ...(chart[size] || {}) }))
    .filter(r => FIELDS.some(f => r[f.key]));
}

// Đọc bảng từ form (scSize[] + scBust[] / scWaist[] / scHip[] / scHeight[]); chỉ giữ size đang khai
function readChartForm(body, sizeList) {
  const arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const sizes = arr(body.scSize);
  const cols = { bust: arr(body.scBust), waist: arr(body.scWaist), hip: arr(body.scHip), height: arr(body.scHeight) };
  const chart = {}, errors = [];
  sizes.forEach((s, i) => {
    s = String(s).trim();
    if (!sizeList.includes(s)) return;
    const row = {};
    for (const f of FIELDS) {
      const v = String(cols[f.key][i] ?? '').trim().replace(/\s*[-–]\s*/, '-');
      if (!v) continue;
      if (!VALUE_RE.test(v)) { errors.push(`Bảng số đo size ${s} — ${f.label.toLowerCase()}: ghi 1 số (VD 82) hoặc khoảng (VD 80-84), đơn vị cm.`); continue; }
      row[f.key] = v;
    }
    if (Object.keys(row).length) chart[s] = row;
  });
  return { chart, json: Object.keys(chart).length ? JSON.stringify(chart) : null, errors: [...new Set(errors)].slice(0, 3) };
}

// Bảng chuẩn cho các size chữ có trong danh sách (dùng cho dữ liệu mẫu)
function standardChart(sizeStr) {
  const chart = {};
  for (const s of splitList(sizeStr)) if (STANDARD[s.toUpperCase()]) chart[s] = STANDARD[s.toUpperCase()];
  return Object.keys(chart).length ? JSON.stringify(chart) : null;
}

module.exports = { FIELDS, parseChart, chartRows, readChartForm, standardChart };
