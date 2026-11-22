const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Phiên đăng nhập + giỏ thuê: lưu trong CSDL để khởi động lại không bị mất
const Session = sequelize.define('Session', {
  // Chỉ lưu hash của session id: lộ bản sao lưu CSDL cũng không chiếm được phiên
  SidHash: { type: DataTypes.STRING(64), primaryKey: true },
  Data: { type: DataTypes.TEXT, allowNull: false },
  ExpiresAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'Sessions',
  timestamps: false,
  indexes: [{ fields: ['ExpiresAt'] }],
});

module.exports = Session;
