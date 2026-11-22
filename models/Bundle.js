const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ƯU ĐÃI COMBO / NHÓM
//  - combo: thuê đủ mỗi mẫu trong danh sách 1 bộ -> giảm Percent% cho bộ combo đó
//  - group: tổng số bộ của các mẫu trong danh sách đạt MinQty -> giảm Percent% (kỷ yếu, bê tráp)
const Bundle = sequelize.define('Bundle', {
  BundleID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Kind: { type: DataTypes.STRING(10), allowNull: false },       // combo | group
  Description: { type: DataTypes.STRING(300) },
  ProductIDs: { type: DataTypes.TEXT, allowNull: false },       // JSON: [1, 2, 3]
  Percent: { type: DataTypes.INTEGER, allowNull: false },
  MinQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'Bundles', timestamps: true });

Bundle.prototype.productIds = function () {
  try { const a = JSON.parse(this.ProductIDs); return Array.isArray(a) ? a.map(Number).filter(Boolean) : []; } catch (_) { return []; }
};

module.exports = Bundle;
