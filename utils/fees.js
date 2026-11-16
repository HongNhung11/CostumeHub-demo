// BẢNG NỘI QUY TRỪ PHÍ — dùng chung cho: trang Nội quy, form Nhận trả của nhân viên, hóa đơn.
// Sửa mức phí ở MỘT chỗ này là cả 3 nơi cập nhật theo.

// Phí hư hỏng / vệ sinh tính theo từng bộ (nhân viên chọn khi nhận trả)
const DAMAGE_RULES = [
  { code: 'ban_nhe',   label: 'Bẩn nhẹ — giặt thường',                        amount: 30000,  group: 'Vệ sinh' },
  { code: 'ban_nang',  label: 'Bẩn nặng (mỹ phẩm, rượu, thức ăn) — giặt hấp', amount: 80000,  group: 'Vệ sinh' },
  { code: 'sua_nho',   label: 'Sứt chỉ, mất cúc, bung khóa — sửa nhỏ',        amount: 50000,  group: 'Hư hỏng sửa được' },
  { code: 'sua_vua',   label: 'Rách, thủng nhỏ — vá / sửa',                    amount: 150000, group: 'Hư hỏng sửa được' },
  // Hư nặng / mất: đền theo "Giá trị sản phẩm"; nếu SP chưa có giá trị -> mất tiền cọc của bộ đó
  { code: 'mat_do',    label: 'Hư nặng không sửa được / mất đồ',              amount: null,   group: 'Hư nặng / mất' },
];
const RULE_BY_CODE = Object.fromEntries(DAMAGE_RULES.map(r => [r.code, r]));

// Chính sách hủy đơn (đã dùng trong rentalController.cancel)
const CANCEL_POLICY = [
  { when: 'Từ 3 ngày trở lên trước ngày nhận', fee: 'Hoàn 100% cọc' },
  { when: '1 – 2 ngày trước ngày nhận',        fee: 'Giữ 50% cọc' },
  { when: 'Trong ngày nhận hoặc sau đó',       fee: 'Mất toàn bộ cọc' },
];

// Số tiền đền khi hư nặng / mất 1 bộ
function lossAmount(item, product) {
  const v = product ? Number(product.ProductValue) : 0;
  return v > 0 ? v : Number(item.DepositPerUnit) || 0;
}

module.exports = { DAMAGE_RULES, RULE_BY_CODE, CANCEL_POLICY, lossAmount };
