const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Đánh giá sản phẩm: chỉ khách ĐÃ THUÊ XONG (đơn "Hoàn tất" có món này) mới được đánh giá, mỗi khách 1 lần / sản phẩm.
const Review = sequelize.define('Review', {
  ReviewID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  RentalID: { type: DataTypes.INTEGER, allowNull: true },       // đơn đã thuê (để biết size đã mặc)
  Rating: { type: DataTypes.INTEGER, allowNull: false },        // 1 – 5 sao
  Comment: { type: DataTypes.TEXT },
  SizeWorn: { type: DataTypes.STRING },                         // size khách đã thuê, VD "M · Đỏ"
  FitNote: { type: DataTypes.STRING },                          // Vừa / Hơi chật / Hơi rộng
  Images: { type: DataTypes.TEXT },                             // JSON: ["/uploads/rv_...jpg", ...] (tối đa 3)
  isHidden: { type: DataTypes.BOOLEAN, defaultValue: false },   // nhân viên ẩn đánh giá không phù hợp
}, {
  tableName: 'Reviews',
  timestamps: true,
  indexes: [{ unique: true, fields: ['ProductID', 'UserID'] }],
});

Review.prototype.imageList = function () {
  try { const a = JSON.parse(this.Images || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
};

module.exports = Review;
