const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Yêu cầu liên hệ / tư vấn khách gửi từ trang Liên hệ -> nhân viên gọi lại tư vấn
const ContactRequest = sequelize.define('ContactRequest', {
  ContactID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: true },          // khách đã đăng nhập thì lưu lại
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Phone: { type: DataTypes.STRING(20), allowNull: false },
  Email: { type: DataTypes.STRING(150), allowNull: true },
  Topic: { type: DataTypes.STRING(50), allowNull: true },         // Tư vấn chọn đồ / Đặt lịch thử đồ / Đơn thuê / Khác
  Message: { type: DataTypes.TEXT, allowNull: false },
  Status: { type: DataTypes.STRING(20), defaultValue: 'Mới' },    // Mới | Đang tư vấn | Đã tư vấn
  Note: { type: DataTypes.TEXT, allowNull: true },                // ghi chú của nhân viên
  HandledBy: { type: DataTypes.STRING(100), allowNull: true },    // tên nhân viên xử lý gần nhất
}, {
  tableName: 'ContactRequests',
  timestamps: true,
  indexes: [{ fields: ['Status'] }],
});

ContactRequest.STATUSES = ['Mới', 'Đang tư vấn', 'Đã tư vấn'];
ContactRequest.TOPICS = ['Tư vấn chọn đồ', 'Đặt lịch thử đồ', 'Hỏi về đơn thuê', 'Khác'];

module.exports = ContactRequest;
