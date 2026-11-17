const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Ảnh phụ của sản phẩm (ảnh chính vẫn là Product.PathImage). Trang chi tiết hiện ảnh chính + các ảnh này.
const ProductImage = sequelize.define('ProductImage', {
  ImageID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  Path: { type: DataTypes.STRING, allowNull: false },          // /uploads/... hoặc /img/...
  SortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'ProductImages',
  timestamps: false,
});

module.exports = ProductImage;
