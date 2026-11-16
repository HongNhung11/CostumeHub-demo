const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User');
const Rental = require('./Rental');

// Quan hệ
Product.hasMany(Rental, { foreignKey: 'ProductID' });
Rental.belongsTo(Product, { foreignKey: 'ProductID' });

User.hasMany(Rental, { foreignKey: 'UserID' });
Rental.belongsTo(User, { foreignKey: 'UserID' });

module.exports = { sequelize, Product, User, Rental };
