const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Mỗi dòng = 1 giao dịch TIỀN VÀO nhận từ SePay (webhook hoặc API đối soát)
const Payment = sequelize.define('Payment', {
  PaymentID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  // Dấu vân tay giao dịch: webhook và API dùng 2 loại id khác nhau nên không chống trùng bằng id được
  Fingerprint: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  ProviderID: { type: DataTypes.STRING(64) },
  Source: { type: DataTypes.STRING(10) },                     // webhook | api
  RentalID: { type: DataTypes.INTEGER, allowNull: true },
  Amount: { type: DataTypes.DECIMAL(14, 0), allowNull: false },
  Account: { type: DataTypes.STRING(40) },
  Reference: { type: DataTypes.STRING(100) },
  Content: { type: DataTypes.TEXT },
  PaidAt: { type: DataTypes.DATE },
  // confirmed: đã khớp đơn | refund: phải hoàn | review: lệch, chờ xem | unmatched: không thấy mã đơn | resolved: đã xử lý
  State: { type: DataTypes.STRING(12), allowNull: false },
  Reason: { type: DataTypes.STRING(255) },
  HandledBy: { type: DataTypes.STRING(100) },
}, {
  tableName: 'Payments',
  timestamps: true,
  indexes: [{ fields: ['State'] }, { fields: ['RentalID'] }],
});

module.exports = Payment;
