// Ghi nhật ký thao tác tiền. Luôn truyền transaction của thao tác: ghi tiền được thì nhật ký cũng phải có.
const { AuditLog } = require('../models');

const ACTIONS = {
  'payment.auto': 'SePay tự xác nhận',
  'payment.manual': 'Xác nhận chuyển khoản bằng tay',
  'payment.accept': 'Nhận giao dịch lệch vào đơn',
  'payment.refund': 'Chuyển giao dịch sang cần hoàn',
  'payment.keep': 'Đóng giao dịch cần xử lý',
  'payment.cod': 'Xác nhận đã thu COD',
  'order.cancel': 'Hủy đơn',
  'return.sent': 'Chốt ngày khách gửi trả',
  'return.done': 'Nhận trả, chốt phí và hoàn cọc',
  'refund.account': 'Đổi tài khoản nhận hoàn',
  'ledger.done': 'Ghi đã hoàn / đã thu',
};

async function log(req, action, { rental = null, rentalId = null, amount = null, detail = '', transaction } = {}) {
  const u = req?.session?.user;
  return AuditLog.create({
    ActorID: u ? u.id : null,
    ActorName: u ? String(u.username).slice(0, 100) : 'Hệ thống',
    ActorRole: u ? u.role : 'system',
    Action: action,
    RentalID: rental ? rental.RentalID : rentalId,
    Amount: amount === null ? null : Math.round(Number(amount) || 0),
    Detail: String(detail || '').slice(0, 500),
  }, { transaction });
}

module.exports = { log, ACTIONS };
