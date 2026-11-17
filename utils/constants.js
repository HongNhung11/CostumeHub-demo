// Hằng số dùng chung

// Tình trạng sản phẩm: chỉ còn 2 loại.
// Việc "còn bộ nào trống" được tính theo NGÀY THUÊ (utils/availability.js), không đặt tay nữa.
const PRODUCT_STATUSES = ['Còn trống', 'Ngừng cho thuê'];
// Trạng thái cũ -> trạng thái mới (dữ liệu cũ / file import cũ)
const LEGACY_STATUS = { 'Đang cho thuê': 'Còn trống', 'Chờ xử lý': 'Ngừng cho thuê' };
const normalizeStatus = (s) => LEGACY_STATUS[String(s || '').trim()] || String(s || '').trim();

const PRODUCT_TYPES = ['Áo dài', 'Váy tiệc', 'Phụ kiện', 'Khác'];

const ROLES = { admin: 'Admin', nhanvien: 'Nhân viên', khach: 'Khách' };

// Đặt thuê xong đơn ở trạng thái "Chờ cọc": khách có DEPOSIT_HOLD_HOURS giờ để cọc (chuyển khoản / ví / tiền mặt tại shop).
// Nhân viên kiểm tra đã nhận tiền rồi bấm "Xác nhận đã cọc". Quá hạn chưa cọc -> đơn tự hủy.
const DEPOSIT_HOLD_HOURS = 24;
// Thông tin nhận cọc hiển thị cho khách — SỐ TÀI KHOẢN DEMO, sửa lại thông tin thật của cửa hàng khi dùng
const SHOP_BANK = { bank: 'Vietcombank', account: '0123 456 789', owner: 'CUA HANG COSTUMEHUB', demo: true };

module.exports = { PRODUCT_STATUSES, LEGACY_STATUS, normalizeStatus, PRODUCT_TYPES, ROLES, DEPOSIT_HOLD_HOURS, SHOP_BANK };
