// LOẠI DỮ LIỆU của đơn, giao dịch, sổ tiền
//   real : dữ liệu thật
//   demo : đơn mẫu do seed tạo (công tắc DEMO_DATA)
//   test : phát sinh khi SEPAY_MODE=sandbox (Test mode)
// Model đặt defaultScope theo VISIBLE: dữ liệu bị ẩn không hiện, không chiếm lịch, không vào thống kê, nhưng KHÔNG bị xóa.
// Việc phải thấy mọi dữ liệu (chặn xóa sản phẩm, chống trùng giao dịch, dọn ảnh CCCD) thì dùng .unscoped().
const mode = String(process.env.SEPAY_MODE || 'off').trim().toLowerCase();
const flag = String(process.env.DEMO_DATA || '').trim();

const SANDBOX = mode === 'sandbox';
// Không khai: bật khi demo, tự tắt khi nhận tiền thật
const DEMO_DATA = flag ? /^(1|true|yes|on)$/i.test(flag) : mode !== 'live';

const CURRENT = SANDBOX ? 'test' : 'real';      // loại của dữ liệu tạo mới
const VISIBLE = ['real', ...(DEMO_DATA ? ['demo'] : []), ...(SANDBOX ? ['test'] : [])];

// Tiền thử chỉ khớp đơn thử, tiền thật chỉ khớp đơn thật
const canPay = (rental) => rental.DataKind === CURRENT;

module.exports = { DEMO_DATA, SANDBOX, CURRENT, VISIBLE, canPay };
