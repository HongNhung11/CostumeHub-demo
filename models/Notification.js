const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Thông báo cho khách (hiện ở chuông trên menu + trang Thông báo): đơn đổi trạng thái, nhắc ngày nhận / trả
const Notification = sequelize.define('Notification', {
  NotificationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  RentalID: { type: DataTypes.INTEGER, allowNull: true },
  Level: { type: DataTypes.STRING, defaultValue: 'info' },   // info | success | warning | danger (màu hiển thị)
  Title: { type: DataTypes.STRING, allowNull: false },
  Message: { type: DataTypes.TEXT },
  Link: { type: DataTypes.STRING },                          // trang mở khi bấm vào (VD /rentals/12)
  Key: { type: DataTypes.STRING, allowNull: true },          // chống tạo trùng lời nhắc (VD "pickup-tmr-12")
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'Notifications',
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ['UserID', 'isRead'] }, { unique: true, fields: ['UserID', 'Key'] }],
});

module.exports = Notification;
