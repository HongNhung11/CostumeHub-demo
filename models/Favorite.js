const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Danh sách yêu thích của khách (mỗi khách × sản phẩm 1 dòng)
const Favorite = sequelize.define('Favorite', {
  FavoriteID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'Favorites',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['UserID', 'ProductID'] }],
});

module.exports = Favorite;
