// DANH MỤC CON trên menu "Danh mục" (lọc theo nhóm từ khóa, khớp BẤT KỲ từ nào trong nhóm)
// - Nhóm phụ kiện: khớp theo TÊN sản phẩm (VD "Túi xách tay màu đỏ" thuộc "Túi xách")
// - inDescription: true -> khớp cả MÔ TẢ (dùng cho nhóm theo dịp nếu sau này cần)
// Thêm / sửa danh mục ở đây là menu và bộ lọc cập nhật theo.
const { normalize } = require('./text');

const CATEGORIES = {
  'day-chuyen': { label: 'Dây chuyền – Vòng cổ', group: 'Phụ kiện', type: 'Phụ kiện', keywords: ['day chuyen', 'vong co'] },
  'bong-tai':   { label: 'Bông tai', group: 'Phụ kiện', type: 'Phụ kiện', keywords: ['bong tai', 'khuyen tai'] },
  'nhan':       { label: 'Nhẫn', group: 'Phụ kiện', type: 'Phụ kiện', keywords: ['nhan'] },
  'vong-tay':   { label: 'Vòng tay – Lắc tay', group: 'Phụ kiện', type: 'Phụ kiện', keywords: ['vong tay', 'lac tay'] },
  'tui-xach':   { label: 'Túi xách', group: 'Phụ kiện', type: 'Phụ kiện', keywords: ['tui'] },
};

// Khớp nguyên cụm từ (không khớp "nhan" bên trong "nhanh")
const hasWord = (text, kw) => (` ${text.replace(/[^a-z0-9 ]/g, ' ')} `).includes(` ${kw} `);

function filterByCategory(products, key) {
  const c = CATEGORIES[key];
  if (!c) return products;
  return products.filter(p => {
    if (c.type && p.ProductType !== c.type) return false;
    const text = normalize(c.inDescription ? `${p.ProductName} ${p.Description}` : p.ProductName);
    return c.keywords.some(kw => hasWord(text, kw));
  });
}

// Menu: [{ group, items: [{ key, label }] }] theo thứ tự khai báo
function menuGroups() {
  const out = [];
  for (const [key, c] of Object.entries(CATEGORIES)) {
    let g = out.find(x => x.group === c.group);
    if (!g) out.push(g = { group: c.group, items: [] });
    g.items.push({ key, label: c.label });
  }
  return out;
}

module.exports = { CATEGORIES, filterByCategory, menuGroups };
