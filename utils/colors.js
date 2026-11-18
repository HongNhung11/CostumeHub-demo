// Mã màu cho tên màu tiếng Việt -> hiện chấm màu (color dot) cạnh tên màu, kiểu tinastore.
// Tìm theo từ khóa dài nhất trước ("đỏ đô" trước "đỏ"); không nhận ra thì dùng màu hồng đất mặc định.
const { normalize } = require('./text');

const COLOR_MAP = [
  ['do do', '#7b1e2b'], ['do cham bi', '#c62828'], ['do', '#d32f2f'],
  ['hong pastel', '#f4b6c2'], ['hong', '#e8a0b4'],
  ['tim', '#7e57c2'],
  ['cam dat', '#c26a3d'], ['cam san ho', '#ff7f6e'], ['cam', '#f39c12'],
  ['xanh navy', '#1f2f5c'], ['xanh ngoc', '#26a69a'], ['xanh pastel', '#a7d3e8'], ['xanh la', '#43a047'], ['xanh mint', '#98e2cf'], ['xanh', '#5b8fd6'],
  ['trang ngoc', '#f6f1e7'], ['trang', '#ffffff'], ['kem', '#f3e5c8'], ['be', '#e8d5b7'],
  ['den', '#222222'], ['bac', '#c0c0c0'], ['vang gold', '#d4af37'], ['vang', '#f1c40f'], ['nau', '#8d6e63'], ['xam', '#9e9e9e'],
].sort((a, b) => b[0].length - a[0].length);

function colorHex(name) {
  const n = ` ${normalize(name)} `;
  const hit = COLOR_MAP.find(([k]) => n.includes(` ${k} `) || n.includes(` ${k}`));
  return hit ? hit[1] : '#b8847e';
}

module.exports = { colorHex };
