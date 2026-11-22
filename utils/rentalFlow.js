// QUY TRÌNH ĐƠN THUÊ: trạng thái, thanh toán, giao — nhận đồ (dùng chung cho controller + view)
//
//  Thanh toán (khách trả 1 lần = tiền thuê − giảm giá + tiền cọc):
//   - COD: trả khi nhận đồ (tại shop / cho shipper) -> đơn giữ chỗ ngay ("Đã cọc" = chờ giao đồ)
//   - Chuyển khoản: "Chờ cọc" (= chờ thanh toán), giữ chỗ PAY_MINUTES phút. Khách quét VietQR, SePay báo tiền về
//     -> tự sang "Đã cọc" (utils/payments.js). Quá hạn -> tự hủy; tiền về muộn -> vào sổ hoàn tiền.
//
//  Tự đến lấy:  Chờ thanh toán → Chờ giao đồ → (khách đến lấy) Đang thuê → (khách mang trả) Hoàn tất
//  Giao tận nơi: Chờ thanh toán → Chờ giao đồ → (đóng đơn, giao shipper + mã vận đơn) Đang giao
//               → (khách nhận) Đang thuê → (khách gửi trả + mã vận đơn) Đang gửi trả → (shop nhận, kiểm tra) Hoàn tất
//  (Giá trị lưu trong CSDL giữ tên cũ "Chờ cọc" / "Đã cọc" để không phải đổi dữ liệu; chỉ đổi chữ hiển thị.)
const { addDays, todayStr } = require('./dates');
const PAY_MINUTES = 5;   // thời gian giữ chỗ để khách chuyển khoản

const STATUS = {
  'Chờ cọc':      { label: 'Chờ thanh toán', cls: 'secondary', icon: 'bi-hourglass-split' },
  'Đã cọc':       { label: 'Chờ giao đồ', cls: 'info text-dark', icon: 'bi-box-seam' },
  'Đang giao':    { label: 'Đang giao', cls: 'primary', icon: 'bi-truck' },
  'Đang thuê':    { label: 'Đang thuê', cls: 'warning text-dark', icon: 'bi-bag-check' },
  'Đang gửi trả': { label: 'Đang gửi trả', cls: 'dark', icon: 'bi-arrow-return-left' },
  'Hoàn tất':     { label: 'Hoàn tất', cls: 'success', icon: 'bi-check-circle' },
  'Đã hủy':       { label: 'Đã hủy', cls: 'danger', icon: 'bi-x-circle' },
  'Đã đặt':       { label: 'Đã đặt', cls: 'secondary', icon: 'bi-receipt' },   // dữ liệu rất cũ
};
const ORDER = ['Chờ cọc', 'Đã cọc', 'Đang giao', 'Đang thuê', 'Đang gửi trả', 'Hoàn tất', 'Đã hủy'];
const label = (s) => (STATUS[s] || { label: s }).label;
const cls = (s) => (STATUS[s] || { cls: 'secondary' }).cls;

// Phương thức thanh toán
const PAY = { COD: 'COD', BANK: 'Chuyển khoản' };
const PAY_LABEL = { COD: 'Thanh toán khi nhận đồ (COD)', 'Chuyển khoản': 'Chuyển khoản', 'Tiền mặt': 'Tiền mặt', 'Ví điện tử': 'Ví điện tử' };
const payLabel = (m) => PAY_LABEL[m] || m || '';
const isPaid = (r) => ['Đã thanh toán', 'Đã cọc'].includes(r.PaymentStatus);   // 'Đã cọc' = dữ liệu cũ

// Đơn COD giao tận nơi đã rời shop mà nhân viên chưa xác nhận thu tiền
const codPending = (r) => r.PaymentMethod === PAY.COD && !isPaid(r) && ['Đang giao', 'Đang thuê', 'Đang gửi trả'].includes(r.Status);

// Đơn vị vận chuyển nhân viên chọn khi gửi đồ
const CARRIERS = ['Ahamove', 'Grab Express', 'Shipper của shop', 'GHN', 'Viettel Post', 'GHTK', 'J&T Express'];

const num = (v) => Number(v) || 0;
// Khách phải trả = tiền thuê − giảm giá + tiền cọc
const amountDue = (r) => num(r.RentFee) - num(r.Discount) + num(r.Deposit);
const isDelivery = (r) => r.DeliveryMethod === 'Giao tận nơi';
// Ngày shop gửi đồ đi (= ngày nhận − số ngày vận chuyển); tự đến lấy = ngày nhận
const shipDay = (r) => addDays(r.StartDate, -(num(r.ShipDays)));
// Ngày đồ dự kiến về tới shop
const backDay = (r) => addDays(r.ReturnSentDate || r.EndDate, num(r.ShipDays));

// Giờ chốt đóng đơn trong ngày gửi (gợi ý cho nhân viên)
const PACK_CUTOFF_HOUR = 12;
// Hạn chuyển khoản: PAY_MINUTES phút sau khi đặt
const paymentDeadline = (r) => new Date(new Date(r.createdAt || Date.now()).getTime() + PAY_MINUTES * 60e3);
// Đơn của bản cũ (khách tự báo đã chuyển khoản) -> không tự hủy, chờ nhân viên xác nhận
const transferClaimed = (r) => !!r.TransferClaimedAt;

// Các bước hiển thị trên thanh tiến trình của trang đơn
function steps(r) {
  const list = isDelivery(r)
    ? [['Đặt đơn', 'Chờ cọc'], ['Chờ giao', 'Đã cọc'], ['Đang giao', 'Đang giao'], ['Đang thuê', 'Đang thuê'], ['Gửi trả', 'Đang gửi trả'], ['Hoàn tất', 'Hoàn tất']]
    : [['Đặt đơn', 'Chờ cọc'], ['Chờ nhận đồ', 'Đã cọc'], ['Đang thuê', 'Đang thuê'], ['Hoàn tất', 'Hoàn tất']];
  const idx = list.findIndex(([, s]) => s === r.Status);
  return list.map(([text], i) => ({ text, done: idx > i || r.Status === 'Hoàn tất', current: i === idx && r.Status !== 'Hoàn tất' }));
}

module.exports = {
  STATUS, ORDER, label, cls, PAY, PAY_LABEL, payLabel, isPaid, codPending, CARRIERS,
  amountDue, isDelivery, shipDay, backDay, paymentDeadline, transferClaimed, PAY_MINUTES, PACK_CUTOFF_HOUR, steps, todayStr,
};
