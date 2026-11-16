// Tiện ích xử lý chuỗi tiếng Việt + kiểm tra dữ liệu nhập

// Chuẩn hóa để so khớp: thường hóa, bỏ dấu, đ -> d, gộp khoảng trắng.
// "Áo Dài" / "áo dài" / "ao dai" / chuỗi gõ dấu tổ hợp (NFD) đều về "ao dai".
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Tách danh sách "S, M, L" -> ['S','M','L']
function splitList(s) {
  return String(s || '').split(/[,;/]/).map(x => x.trim()).filter(Boolean);
}

// SĐT di động Việt Nam: 10 số, đầu 03/05/07/08/09 (chấp nhận +84 / 84 thay cho 0)
function normalizePhone(s) {
  let p = String(s || '').replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (/^84\d{9}$/.test(p)) p = '0' + p.slice(2);
  return p;
}
const isValidPhone = (s) => /^0(3|5|7|8|9)\d{8}$/.test(normalizePhone(s));

// CCCD gắn chip: đúng 12 chữ số, 3 số đầu là mã tỉnh (001–096)
function isValidCCCD(s) {
  const v = String(s || '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(v)) return false;
  const province = parseInt(v.slice(0, 3), 10);
  return province >= 1 && province <= 96;
}

module.exports = { normalize, splitList, normalizePhone, isValidPhone, isValidCCCD };
