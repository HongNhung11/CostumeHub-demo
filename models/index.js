const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User');
const Rental = require('./Rental');
const RentalItem = require('./RentalItem');
const ProductVariant = require('./ProductVariant');
const ProductImage = require('./ProductImage');
const Review = require('./Review');
const Favorite = require('./Favorite');
const Coupon = require('./Coupon');
const Notification = require('./Notification');
const ContactRequest = require('./ContactRequest');
const Payment = require('./Payment');
const LedgerEntry = require('./LedgerEntry');
const Session = require('./Session');
const Bundle = require('./Bundle');
const HandoverPhoto = require('./HandoverPhoto');
const AuditLog = require('./AuditLog');
const SwapHold = require('./SwapHold');

// Số lượng theo size × màu (xóa SP thì xóa luôn biến thể)
Product.hasMany(ProductVariant, { foreignKey: 'ProductID', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'ProductID' });

// Ảnh phụ của sản phẩm
Product.hasMany(ProductImage, { foreignKey: 'ProductID', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'ProductID' });

// Quan hệ
// Rental.ProductID = sản phẩm đầu tiên trong đơn (giữ để tương thích dữ liệu cũ)
// RESTRICT: xóa sản phẩm không được kéo theo đơn (CSDL cũ: utils/migrate.js đổi khóa ngoại)
Product.hasMany(Rental, { foreignKey: 'ProductID', onDelete: 'RESTRICT' });
Rental.belongsTo(Product, { foreignKey: 'ProductID', onDelete: 'RESTRICT' });
Rental.hasMany(SwapHold, { foreignKey: 'RentalID', onDelete: 'CASCADE' });
SwapHold.belongsTo(Rental, { foreignKey: 'RentalID', onDelete: 'CASCADE' });

User.hasMany(Rental, { foreignKey: 'UserID' });
Rental.belongsTo(User, { foreignKey: 'UserID' });

// Một đơn thuê có nhiều món
Rental.hasMany(RentalItem, { foreignKey: 'RentalID', as: 'items' });
RentalItem.belongsTo(Rental, { foreignKey: 'RentalID' });
Product.hasMany(RentalItem, { foreignKey: 'ProductID', onDelete: 'RESTRICT' });
RentalItem.belongsTo(Product, { foreignKey: 'ProductID', onDelete: 'RESTRICT' });

// Đánh giá + yêu thích
Product.hasMany(Review, { foreignKey: 'ProductID', onDelete: 'CASCADE' });
Review.belongsTo(Product, { foreignKey: 'ProductID' });
User.hasMany(Review, { foreignKey: 'UserID' });
Review.belongsTo(User, { foreignKey: 'UserID' });
Product.hasMany(Favorite, { foreignKey: 'ProductID', onDelete: 'CASCADE' });
Favorite.belongsTo(Product, { foreignKey: 'ProductID' });
User.hasMany(Favorite, { foreignKey: 'UserID' });

User.hasMany(Notification, { foreignKey: 'UserID' });

module.exports = { sequelize, Product, User, Rental, RentalItem, ProductVariant, ProductImage, Review, Favorite, Coupon, Notification, ContactRequest, Payment, LedgerEntry, Session, Bundle, HandoverPhoto, AuditLog, SwapHold };
