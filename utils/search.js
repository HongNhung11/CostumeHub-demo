// Tìm kiếm sản phẩm chính xác hơn:
// - Không phân biệt hoa/thường, có dấu/không dấu ("ao dai" = "Áo dài" = "ÁO DÀI").
//   (SQLite LIKE chỉ bỏ qua hoa/thường với chữ không dấu nên "áo dài" không khớp "Áo dài")
// - Ưu tiên khớp ở Tên / Loại / Màu. Chỉ khi KHÔNG có sản phẩm nào khớp như vậy
//   mới lấy các sản phẩm chỉ nhắc tới từ khóa trong Mô tả
//   (tránh tìm "áo dài" lại ra "Vòng cổ ngọc trai ... hợp với áo dài").
const { normalize } = require('./text');

const newer = (a, b) =>
  (new Date(b.CreateDate) - new Date(a.CreateDate)) || (b.ProductID - a.ProductID);

function searchProducts(products, q) {
  const nq = normalize(q);
  if (!nq) return products;
  const tokens = nq.split(' ');

  const primary = [], secondary = [];
  for (const p of products) {
    if (/^\d+$/.test(nq) && p.ProductID === Number(nq)) { primary.push({ p, score: 100 }); continue; }
    const name = normalize(p.ProductName);
    const type = normalize(p.ProductType);
    const head = `${name} ${type} ${normalize(p.Color)}`;
    if (tokens.every(t => head.includes(t))) {
      let score = 10;
      if (name.includes(nq)) score += 20;
      if (type.includes(nq)) score += 15;
      if (name.startsWith(nq)) score += 5;
      primary.push({ p, score });
    } else if (tokens.every(t => `${head} ${normalize(p.Description)}`.includes(t))) {
      secondary.push({ p, score: 1 });
    }
  }
  const list = primary.length ? primary : secondary;
  return list.sort((a, b) => (b.score - a.score) || newer(a.p, b.p)).map(x => x.p);
}

module.exports = { searchProducts };
