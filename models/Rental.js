const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Đơn thuê (mỗi đơn thuê 1 trang phục, có số lượng)
const Rental = sequelize.define('Rental', {
  RentalID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  UserID: { type: DataTypes.INTEGER, allowNull: true },

  // Thông tin khách thuê
  CustomerName: { type: DataTypes.STRING, allowNull: false },
  CustomerPhone: { type: DataTypes.STRING, allowNull: false },
  CustomerIDCard: { type: DataTypes.STRING },             // số CCCD (sau này OCR tự điền)
  IDCardImage: { type: DataTypes.STRING },                // ảnh chụp CCCD
  DeliveryMethod: { type: DataTypes.STRING, defaultValue: 'Tự đến lấy' }, // Tự đến lấy / Giao tận nơi
  DeliveryAddress: { type: DataTypes.STRING },            // địa chỉ nhận (nếu giao tận nơi)

  // Thời gian thuê
  StartDate: { type: DataTypes.DATEONLY, allowNull: false },
  EndDate: { type: DataTypes.DATEONLY, allowNull: false },
  RentDays: { type: DataTypes.INTEGER, defaultValue: 1 },
  Quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  ReturnDate: { type: DataTypes.DATEONLY },               // ngày trả thực tế

  // Tiền
  PricePerDay: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },
  RentFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // tiền thuê
  Deposit: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // tiền cọc
  LateFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // phí trễ
  DamageFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // phí hư hỏng
  CancelFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // phí hủy
  RefundAmount: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },// tiền hoàn lại

  PaymentMethod: { type: DataTypes.STRING },                        // tiền mặt / chuyển khoản / ví
  PaymentStatus: { type: DataTypes.STRING, defaultValue: 'Chưa thanh toán' },

  // Trạng thái đơn: Đã đặt -> Đã cọc -> Đang thuê -> Hoàn tất | Đã hủy
  Status: { type: DataTypes.STRING, defaultValue: 'Đã đặt' },
  Note: { type: DataTypes.TEXT },
}, {
  tableName: 'Rentals',
  timestamps: true,
});

module.exports = Rental;
