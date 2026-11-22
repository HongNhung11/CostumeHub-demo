const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Đơn thuê (1 đơn có thể gồm nhiều món — xem RentalItem)
const Rental = sequelize.define('Rental', {
  RentalID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },  // món đầu tiên của đơn (tương thích dữ liệu cũ)
  UserID: { type: DataTypes.INTEGER, allowNull: true },

  // Thông tin khách thuê
  CustomerName: { type: DataTypes.STRING, allowNull: false },
  CustomerPhone: { type: DataTypes.STRING, allowNull: false },
  CustomerIDCard: { type: DataTypes.STRING },             // số CCCD (sau này OCR tự điền)
  IDCardImage: { type: DataTypes.STRING },                // ảnh chụp CCCD
  IDCardDeletedAt: { type: DataTypes.DATE, allowNull: true },    // đã tự xóa theo quy định lưu trữ
  BundleName: { type: DataTypes.TEXT, allowNull: true },         // ưu đãi combo / nhóm đã áp dụng
  BundleDiscount: { type: DataTypes.DECIMAL(12, 0), allowNull: true },   // phần giảm đó (đã nằm trong Discount)
  DeliveryMethod: { type: DataTypes.STRING, defaultValue: 'Tự đến lấy' }, // Tự đến lấy / Giao tận nơi
  DeliveryZone: { type: DataTypes.STRING(20), allowNull: true },  // pickup | local | province (utils/shipping.js)
  ShipDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },   // số ngày vận chuyển mỗi chiều (lưu lại lúc đặt)
  // Giao — nhận đồ (đơn giao tận nơi)
  Carrier: { type: DataTypes.STRING(50), allowNull: true },             // đơn vị vận chuyển chiều đi
  TrackingCode: { type: DataTypes.STRING(50), allowNull: true },        // mã vận đơn chiều đi
  ShippedAt: { type: DataTypes.DATEONLY, allowNull: true },             // ngày giao cho shipper
  ReturnTrackingCode: { type: DataTypes.STRING(50), allowNull: true },  // mã vận đơn khách gửi trả
  ReturnSentDate: { type: DataTypes.DATEONLY, allowNull: true },        // ngày khách gửi trả (tính trễ theo ngày này)
  TransferClaimedAt: { type: DataTypes.DATE, allowNull: true },         // (bản cũ) lúc khách tự báo đã chuyển khoản
  DeliveryAddress: { type: DataTypes.STRING },            // địa chỉ nhận (nếu giao tận nơi)
  CustomerAddress: { type: DataTypes.STRING(255), allowNull: true },   // địa chỉ liên hệ của khách (bắt buộc khi đặt)

  // Thời gian thuê
  StartDate: { type: DataTypes.DATEONLY, allowNull: false },
  EndDate: { type: DataTypes.DATEONLY, allowNull: false },
  RentDays: { type: DataTypes.INTEGER, defaultValue: 1 },
  Quantity: { type: DataTypes.INTEGER, defaultValue: 1 },  // tổng số món trong đơn
  ReturnDate: { type: DataTypes.DATEONLY },               // ngày trả thực tế

  // Tiền
  PricePerDay: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },  // tổng giá thuê/ngày của cả đơn
  RentFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // tiền thuê
  Deposit: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // tiền cọc
  LateFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // phí trễ
  DamageFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // phí hư hỏng (tổng)
  DamageDetails: { type: DataTypes.TEXT },                           // JSON: từng khoản trừ theo bảng nội quy
  TermsAcceptedAt: { type: DataTypes.DATE },                         // lúc khách tick "đồng ý nội quy"
  CancelFee: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // phí hủy
  RefundAmount: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },// tiền hoàn lại
  CouponCode: { type: DataTypes.STRING },                            // mã giảm giá đã dùng
  Discount: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },    // số tiền giảm (trừ vào tiền thuê)

  PaymentMethod: { type: DataTypes.STRING },                        // tiền mặt / chuyển khoản / ví
  PaymentStatus: { type: DataTypes.STRING, defaultValue: 'Chưa thanh toán' },
  PayCode: { type: DataTypes.STRING(16), allowNull: true },          // mã nội dung chuyển khoản (CH + 8 số)
  PaidVia: { type: DataTypes.STRING(10), allowNull: true },          // sepay | manual | cod
  DepositPaidAt: { type: DataTypes.DATE },                           // lúc nhân viên xác nhận đã nhận cọc

  // Trạng thái đơn: Chờ cọc -> Đã cọc -> Đang thuê -> Hoàn tất | Đã hủy  ("Đã đặt": dữ liệu cũ)
  Status: { type: DataTypes.STRING, defaultValue: 'Đã đặt' },
  Note: { type: DataTypes.TEXT },
}, {
  tableName: 'Rentals',
  timestamps: true,
  version: true,   // khóa lạc quan: 2 người cùng sửa 1 đơn thì người sau bị báo, không ghi đè
});

module.exports = Rental;
