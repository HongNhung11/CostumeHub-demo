const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Size vừa được đổi ra khi khách đang thuê: còn bận tới khi về shop và giặt xong (utils/availability.js)
const SwapHold = sequelize.define('SwapHold', {
  HoldID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  RentalID: { type: DataTypes.INTEGER, allowNull: false },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  Size: { type: DataTypes.STRING },
  Color: { type: DataTypes.STRING },
  Quantity: { type: DataTypes.INTEGER, allowNull: false },
  FromDate: { type: DataTypes.DATEONLY, allowNull: false },
  ToDate: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'SwapHolds', timestamps: true, updatedAt: false, indexes: [{ fields: ['ProductID', 'ToDate'] }] });

module.exports = SwapHold;
