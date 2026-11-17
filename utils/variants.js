// Tiện ích cho số lượng theo SIZE × MÀU (ProductVariant)
const { splitList } = require('./text');

const keyOf = (productId, size, color) => `${productId}|${size}|${color}`;

// Chia đều tổng số bộ cho các tổ hợp size × màu (dùng cho dữ liệu cũ / import không có chi tiết).
// Phần dư dồn vào các tổ hợp ở giữa danh sách (size giữa thường bán chạy nhất).
function splitQuantity(total, sizes, colors) {
  const combos = [];
  for (const Size of sizes) for (const Color of colors) combos.push({ Size, Color, Quantity: 0 });
  if (!combos.length) return combos;
  const n = combos.length;
  const base = Math.floor(total / n);
  let rest = total - base * n;
  combos.forEach(c => { c.Quantity = base; });
  const mid = Math.floor((n - 1) / 2);
  for (let k = 0; rest > 0; k++, rest--) {
    const i = mid + (k % 2 ? -Math.ceil(k / 2) : Math.ceil(k / 2));   // giữa, rồi lan ra hai bên
    combos[(i + n) % n].Quantity++;
  }
  return combos;
}

// Chuỗi dùng trong Export/Import: "S|Tím=1; M|Tím=2"  (dùng "|" vì kích thước có thể chứa "/", VD "40/42")
const formatVariants = (variants) => variants.map(v => `${v.Size}|${v.Color}=${v.Quantity}`).join('; ');
function parseVariants(str) {
  const out = [];
  for (const part of String(str || '').split(';')) {
    const m = part.trim().match(/^(.+?)\|(.+?)=(\d+)$/);
    if (m) out.push({ Size: m[1].trim(), Color: m[2].trim(), Quantity: Number(m[3]) });
  }
  return out;
}

// Danh sách size / màu của SP (theo thứ tự khai báo)
const sizesOf = (p) => splitList(p.Size);
const colorsOf = (p) => splitList(p.Color);

// Bảng đầy đủ size × màu của SP, lấy số lượng từ biến thể đã lưu (thiếu = 0)
function variantGrid(product, variants) {
  const have = new Map(variants.map(v => [`${v.Size}|${v.Color}`, v.Quantity]));
  const grid = [];
  for (const Size of sizesOf(product)) for (const Color of colorsOf(product)) {
    grid.push({ Size, Color, Quantity: have.get(`${Size}|${Color}`) || 0 });
  }
  return grid;
}

// Ghi lại toàn bộ biến thể của 1 SP và cập nhật tổng số bộ
async function saveVariants(product, combos, { transaction } = {}) {
  const { ProductVariant } = require('../models');
  await ProductVariant.destroy({ where: { ProductID: product.ProductID }, transaction });
  if (combos.length) {
    await ProductVariant.bulkCreate(combos.map(c => ({ ProductID: product.ProductID, Size: c.Size, Color: c.Color, Quantity: c.Quantity })), { transaction });
  }
  const total = combos.reduce((s, c) => s + c.Quantity, 0);
  if (product.Quantity !== total) { product.Quantity = total; await product.save({ transaction }); }
  return total;
}

module.exports = { keyOf, splitQuantity, formatVariants, parseVariants, sizesOf, colorsOf, variantGrid, saveVariants };
