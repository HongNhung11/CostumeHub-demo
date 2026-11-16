// CHỐNG TRÙNG LỊCH THUÊ
// Product.Quantity = TỔNG số bộ cửa hàng có (không trừ khi đặt nữa).
// Số bộ còn trống trong khoảng [start, end] = Tổng − (số bộ bị đơn khác giữ vào NGÀY ĐÔNG NHẤT trong khoảng đó).
// - Một đơn giữ đồ từ ngày nhận đến HẾT ngày trả (ngày trả còn để kiểm tra/giặt) => khách sau nhận từ hôm sau.
// - Đơn "Đang thuê" mà quá hạn chưa trả vẫn tính là đang giữ đồ tới hôm nay.
const { Op } = require('sequelize');
const { Rental, RentalItem } = require('../models');
const { todayStr, addDays, daysBetween } = require('./dates');

const ACTIVE = ['Đã đặt', 'Đã cọc', 'Đang thuê'];
const MAX_RENT_DAYS = 30;

// Lấy các dòng đơn đang giữ đồ của các sản phẩm, có chồng lên [start, end]
async function activeHolds(productIds, start, end, { transaction, excludeRentalId } = {}) {
  const today = todayStr();
  const items = await RentalItem.findAll({
    where: { ProductID: { [Op.in]: productIds } },
    include: [{
      model: Rental,
      attributes: ['RentalID', 'StartDate', 'EndDate', 'Status'],
      where: {
        Status: { [Op.in]: ACTIVE },
        StartDate: { [Op.lte]: end },
        ...(excludeRentalId ? { RentalID: { [Op.ne]: excludeRentalId } } : {}),
      },
    }],
    transaction,
  });
  return items
    .map(it => {
      const r = it.Rental;
      let holdEnd = r.EndDate;
      if (r.Status === 'Đang thuê' && holdEnd < today) holdEnd = today; // quá hạn chưa trả
      return { productId: it.ProductID, qty: it.Quantity, from: r.StartDate, to: holdEnd };
    })
    .filter(h => h.to >= start);
}

// Số bộ bị giữ theo từng ngày trong [start, end]: { productId: { 'YYYY-MM-DD': qty } }
function usageByDay(holds, start, end) {
  const usage = {};
  for (const h of holds) {
    const from = h.from > start ? h.from : start;
    const to = h.to < end ? h.to : end;
    const u = (usage[h.productId] ||= {});
    for (let d = from; d <= to; d = addDays(d, 1)) u[d] = (u[d] || 0) + h.qty;
  }
  return usage;
}

// { productId: số bộ còn trống trong cả khoảng [start, end] }
async function availableMap(products, start, end, opts) {
  const ids = products.map(p => p.ProductID);
  const usage = usageByDay(await activeHolds(ids, start, end, opts), start, end);
  const out = {};
  for (const p of products) {
    const peak = Math.max(0, ...Object.values(usage[p.ProductID] || {}));
    out[p.ProductID] = Math.max(0, p.Quantity - peak);
  }
  return out;
}

// Lịch kín của 1 sản phẩm trong N ngày tới: danh sách khoảng ngày đã hết bộ trống
async function bookedOutRanges(product, days = 60) {
  const start = todayStr(), end = addDays(start, days - 1);
  const usage = usageByDay(await activeHolds([product.ProductID], start, end), start, end)[product.ProductID] || {};
  const ranges = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if ((usage[d] || 0) >= product.Quantity) {
      const last = ranges[ranges.length - 1];
      if (last && addDays(last.to, 1) === d) last.to = d; else ranges.push({ from: d, to: d });
    }
  }
  return ranges;
}

// Kiểm tra khoảng ngày thuê hợp lệ; trả về chuỗi lỗi hoặc null
function checkDates(start, end) {
  const { isDateStr } = require('./dates');
  if (!isDateStr(start) || !isDateStr(end)) return 'Vui lòng chọn ngày nhận và ngày trả.';
  if (start < todayStr()) return 'Ngày nhận không được ở quá khứ.';
  const n = daysBetween(start, end);
  if (n < 1) return 'Ngày trả phải sau ngày nhận ít nhất 1 ngày.';
  if (n > MAX_RENT_DAYS) return `Mỗi đơn thuê tối đa ${MAX_RENT_DAYS} ngày.`;
  return null;
}

module.exports = { ACTIVE, MAX_RENT_DAYS, availableMap, bookedOutRanges, checkDates };
