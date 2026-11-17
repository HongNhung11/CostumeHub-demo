const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Số lượng theo từng SIZE × MÀU của một mẫu trang phục.
// Mỗi mẫu tự khai danh sách size / màu riêng (không bắt buộc đủ S, M, L, XL).
// Product.Quantity = tổng Quantity các biến thể (giữ để hiển thị / tương thích).
const ProductVariant = sequelize.define('ProductVariant', {
  VariantID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  Size: { type: DataTypes.STRING, allowNull: false },
  Color: { type: DataTypes.STRING, allowNull: false },
  Quantity: { type: DataTypes.INTEGER, defaultValue: 0 },   // số bộ shop có của size × màu này
}, {
  tableName: 'ProductVariants',
  timestamps: false,
  indexes: [{ unique: true, fields: ['ProductID', 'Size', 'Color'] }],
});

module.exports = ProductVariant;
