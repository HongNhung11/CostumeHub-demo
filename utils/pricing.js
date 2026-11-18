// GIÁ THUÊ ĐANG ÁP DỤNG (sale của cửa hàng)
// Sản phẩm có SalePrice (giá khuyến mãi, thấp hơn giá gốc) và SaleEnd (ngày kết thúc, trống = không hạn).
// Khác voucher: sale do cửa hàng đặt cho từng mẫu, ai cũng thấy; voucher là mã khách nhập ở giỏ thuê.
const { todayStr } = require('./dates');

// Giá sale đang hiệu lực, hoặc null nếu không sale
function saleOf(p) {
  const sale = Number(p.SalePrice), base = Number(p.Price);
  if (!(sale > 0) || !(sale < base)) return null;
  if (p.SaleEnd && String(p.SaleEnd).slice(0, 10) < todayStr()) return null;   // đã hết hạn
  return sale;
}

// Giá thuê / ngày thực tế (dùng để hiển thị, lọc, sắp xếp và tính tiền khi đặt)
const priceOf = (p) => saleOf(p) ?? Number(p.Price);

// % giảm (làm tròn) để hiện nhãn "-20%"
function salePercent(p) {
  const s = saleOf(p);
  return s === null ? 0 : Math.round((1 - s / Number(p.Price)) * 100);
}

module.exports = { saleOf, priceOf, salePercent };
