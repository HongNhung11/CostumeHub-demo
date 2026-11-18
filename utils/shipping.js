// KHU VỰC NHẬN ĐỒ + SỐ NGÀY VẬN CHUYỂN (mỗi chiều)
// Bộ đồ bận từ (ngày nhận − days) đến (ngày trả + days + ngày giặt sấy):
//   - trước ngày nhận: shop gửi đồ đi, đồ đang trên đường tới khách
//   - sau ngày trả: khách gửi trả, đồ đang trên đường về shop
// Khách giao xa: "ngày trả" = ngày khách GỬI đồ đi (có mã vận đơn), không phải ngày đồ về tới shop.
// minDays: số ngày thuê tối thiểu (ngoại tỉnh vận chuyển lâu -> thuê ít ngày không bõ).
// swapAfterShip: còn đổi size được sau khi đồ đã gửi đi không (ngoại tỉnh: gửi đi gửi lại không kịp -> không).
// Muốn đổi số ngày: sửa ở đây (áp dụng cho đơn mới; đơn cũ giữ số ngày đã lưu).
const ZONES = {
  pickup:   { label: 'Tự đến lấy tại cửa hàng', short: 'Tự đến lấy', days: 0, minDays: 1, swapAfterShip: true, delivery: false, note: 'Nhận ngay tại shop' },
  local:    { label: 'Giao nội thành Hà Nội', short: 'Nội thành Hà Nội', days: 1, minDays: 1, swapAfterShip: true, delivery: true, note: 'Giao trong 1 ngày' },
  province: { label: 'Giao ngoại tỉnh', short: 'Ngoại tỉnh', days: 3, minDays: 3, swapAfterShip: false, delivery: true, note: 'Giao trong 3 ngày, thuê từ 3 ngày, không đổi size sau khi gửi' },
};
const MAX_SHIP_DAYS = Math.max(...Object.values(ZONES).map(z => z.days));

const zoneOf = (key) => ZONES[key] || ZONES.pickup;
const zoneKeyOf = (key) => (ZONES[key] ? key : 'pickup');

// Kiểm tra ngày theo khu vực: kịp gửi đồ + đủ số ngày thuê tối thiểu. Trả về chuỗi lỗi hoặc null.
function checkZoneDates(zone, start, end) {
  const { todayStr, daysBetween, addDays, viDate } = require('./dates');
  if (zone.days && daysBetween(todayStr(), start) < zone.days) {
    return `Không kịp giao: ${zone.label.toLowerCase()} mất ${zone.days} ngày vận chuyển, đặt hôm nay thì ngày nhận sớm nhất là ${viDate(addDays(todayStr(), zone.days))}. Vui lòng chọn ngày nhận khác hoặc tự đến lấy tại cửa hàng.`;
  }
  if (daysBetween(start, end) + 1 < zone.minDays) return `${zone.label}: thuê tối thiểu ${zone.minDays} ngày (vận chuyển mất ${zone.days} ngày mỗi chiều).`;
  return null;
}

module.exports = { ZONES, MAX_SHIP_DAYS, zoneOf, zoneKeyOf, checkZoneDates };
