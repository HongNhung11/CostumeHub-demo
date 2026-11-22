const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// NHẬT KÝ: ai làm gì với tiền / đơn. Chỉ ghi thêm, không có chức năng sửa hay xóa.
const AuditLog = sequelize.define('AuditLog', {
  LogID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ActorID: { type: DataTypes.INTEGER, allowNull: true },                   // trống = hệ thống (SePay)
  ActorName: { type: DataTypes.STRING(100), allowNull: false },            // lưu chữ: đổi / xóa tài khoản vẫn còn tên
  ActorRole: { type: DataTypes.STRING(20) },
  Action: { type: DataTypes.STRING(40), allowNull: false },                // utils/audit.js ACTIONS
  RentalID: { type: DataTypes.INTEGER, allowNull: true },
  Amount: { type: DataTypes.DECIMAL(14, 0), allowNull: true },
  Detail: { type: DataTypes.STRING(500) },
}, {
  tableName: 'AuditLogs',
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ['RentalID'] }],
});

module.exports = AuditLog;
