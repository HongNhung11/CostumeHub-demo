const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User');
const Rental = require('./Rental');
const RentalItem = require('./RentalItem');
const ProductVariant = require('./ProductVariant');

// Số lượng theo size × màu (xóa SP thì xóa luôn biến thể)
Product.hasMany(ProductVariant, { foreignKey: 'ProductID', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'ProductID' });

// Quan hệ
// Rental.ProductID = sản phẩm đầu tiên trong đơn (giữ để tương thích dữ liệu cũ)
Product.hasMany(Rental, { foreignKey: 'ProductID' });
Rental.belongsTo(Product, { foreignKey: 'ProductID' });

User.hasMany(Rental, { foreignKey: 'UserID' });
Rental.belongsTo(User, { foreignKey: 'UserID' });

// Một đơn thuê có nhiều món
Rental.hasMany(RentalItem, { foreignKey: 'RentalID', as: 'items' });
RentalItem.belongsTo(Rental, { foreignKey: 'RentalID' });
Product.hasMany(RentalItem, { foreignKey: 'ProductID' });
RentalItem.belongsTo(Product, { foreignKey: 'ProductID' });

module.exports = { sequelize, Product, User, Rental, RentalItem, ProductVariant };
