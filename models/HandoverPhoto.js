const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Ảnh tình trạng đồ lúc giao (out) và lúc nhận lại (in). Là bằng chứng khi trừ cọc nên không có nút xóa.
const HandoverPhoto = sequelize.define('HandoverPhoto', {
  PhotoID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  RentalID: { type: DataTypes.INTEGER, allowNull: false },
  Stage: { type: DataTypes.STRING(3), allowNull: false },
  File: { type: DataTypes.STRING(100), allowNull: false },      // tên file trong private_uploads/handover
  Note: { type: DataTypes.STRING(200) },
  TakenBy: { type: DataTypes.STRING(100) },
}, { tableName: 'HandoverPhotos', timestamps: true, updatedAt: false, indexes: [{ fields: ['RentalID'] }] });

module.exports = HandoverPhoto;
