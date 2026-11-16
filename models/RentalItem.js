const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Chi tiết đơn thuê: mỗi dòng = 1 trang phục / phụ kiện trong đơn (giỏ hàng nhiều món)
// Lưu lại giá tại thời điểm đặt để sau này sửa giá sản phẩm không làm sai hóa đơn cũ.
const RentalItem = sequelize.define('RentalItem', {
  ItemID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  RentalID: { type: DataTypes.INTEGER, allowNull: false },
  ProductID: { type: DataTypes.INTEGER, allowNull: true },
  ProductName: { type: DataTypes.STRING, allowNull: false },          // tên lúc đặt
  Size: { type: DataTypes.STRING },                                    // size khách chọn
  Color: { type: DataTypes.STRING },                                   // màu khách chọn
  Quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  PricePerDay: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // giá thuê/ngày/bộ
  DepositPerUnit: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },  // cọc/bộ
  LateFeePerDay: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // phí trễ/ngày/bộ
}, {
  tableName: 'RentalItems',
  timestamps: false,
});

module.exports = RentalItem;
