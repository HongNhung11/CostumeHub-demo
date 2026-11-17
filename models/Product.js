const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Bảng Products = Trang phục (module trọng tâm 11 chức năng)
const Product = sequelize.define('Product', {
  ProductID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ProductName: { type: DataTypes.STRING, allowNull: false },     // Tên trang phục
  PathImage: { type: DataTypes.STRING, allowNull: true },         // Đường dẫn ảnh
  ProductType: { type: DataTypes.STRING, allowNull: true },       // Loại: Áo dài / Vest / Dạ hội / Cosplay...
  Quantity: { type: DataTypes.INTEGER, defaultValue: 0 },         // Số lượng tồn
  Unit: { type: DataTypes.STRING, defaultValue: 'bộ' },           // Đơn vị
  Price: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },     // Giá thuê / ngày
  Color: { type: DataTypes.STRING, allowNull: true },            // Màu sắc
  Size: { type: DataTypes.STRING, allowNull: true },             // Size
  Description: { type: DataTypes.TEXT, allowNull: true },         // Mô tả
  DepositValue: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },   // Tiền cọc
  LateFeePerDay: { type: DataTypes.DECIMAL(12, 0), defaultValue: 0 },  // Phí phạt trễ/ngày
  ProductValue: { type: DataTypes.DECIMAL(12, 0), allowNull: true },   // Giá trị SP (đền bù khi mất / hư nặng); trống = mất cọc
  Status: { type: DataTypes.STRING, defaultValue: 'Còn trống' },      // Tình trạng
  SizeChart: { type: DataTypes.TEXT, allowNull: true },               // JSON bảng số đo theo size: { "M": { bust, waist, hip, height } }
}, {
  tableName: 'Products',
  timestamps: true,
  createdAt: 'CreateDate',   // Ánh xạ CreateDate
  updatedAt: 'UpdateDate',   // Ánh xạ UpdateDate
});

module.exports = Product;
