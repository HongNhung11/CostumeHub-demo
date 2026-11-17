const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Mã giảm giá — chỉ giảm vào TIỀN THUÊ (không giảm tiền cọc). Admin tạo / tắt mã.
const Coupon = sequelize.define('Coupon', {
  CouponID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Code: { type: DataTypes.STRING(30), allowNull: false, unique: true },      // VIẾT HOA, không dấu, không khoảng trắng
  Description: { type: DataTypes.STRING },                                    // VD "Giảm 10% cho đơn đầu tiên"
  DiscountType: { type: DataTypes.STRING, defaultValue: 'percent' },          // percent | amount
  Value: { type: DataTypes.DECIMAL(12, 0), allowNull: false },                // % (1–100) hoặc số tiền
  MaxDiscount: { type: DataTypes.DECIMAL(12, 0), allowNull: true },           // giảm tối đa (với mã %)
  MinOrder: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },              // tiền thuê tối thiểu
  StartDate: { type: DataTypes.DATEONLY, allowNull: true },                   // trống = áp dụng ngay
  EndDate: { type: DataTypes.DATEONLY, allowNull: true },                     // trống = không hết hạn
  UsageLimit: { type: DataTypes.INTEGER, allowNull: true },                   // tổng lượt dùng; trống = không giới hạn
  FirstOrderOnly: { type: DataTypes.BOOLEAN, defaultValue: false },           // chỉ cho đơn đầu tiên của khách
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'Coupons',
  timestamps: true,
});

module.exports = Coupon;
