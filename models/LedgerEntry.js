const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { CURRENT, VISIBLE } = require('../utils/dataKind');

// SỔ HOÀN CỌC / THU THÊM: mỗi khoản phải chi hoặc phải thu chỉ có đúng 1 dòng (Key duy nhất)
const LedgerEntry = sequelize.define('LedgerEntry', {
  EntryID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Key: { type: DataTypes.STRING(60), allowNull: false, unique: true },   // return:12 | cancel:12 | payment:5
  RentalID: { type: DataTypes.INTEGER, allowNull: true },
  Direction: { type: DataTypes.STRING(3), allowNull: false },            // out: shop hoàn khách | in: khách đền thêm
  Amount: { type: DataTypes.DECIMAL(14, 0), allowNull: false },
  Reason: { type: DataTypes.STRING(255) },
  Status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'pending' },   // pending | done
  Method: { type: DataTypes.STRING(30) },                                // Chuyển khoản | Tiền mặt
  Reference: { type: DataTypes.STRING(100) },                            // mã giao dịch / số phiếu
  DataKind: { type: DataTypes.STRING(8), allowNull: false, defaultValue: CURRENT },   // real | demo | test (utils/dataKind.js)
  SentTo: { type: DataTypes.STRING(160), allowNull: true },              // tài khoản đã chuyển hoàn vào (lưu lại lúc ghi sổ)
  DoneBy: { type: DataTypes.STRING(100) },
  DoneAt: { type: DataTypes.DATE },
}, {
  tableName: 'LedgerEntries',
  timestamps: true,
  defaultScope: { where: { DataKind: VISIBLE } },
  indexes: [{ fields: ['Status'] }],
});

module.exports = LedgerEntry;
