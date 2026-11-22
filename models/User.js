const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  fullName: { type: DataTypes.STRING },
  // Thông tin liên hệ (đăng ký bắt buộc SĐT + email; địa chỉ, CCCD điền ở Tài khoản của tôi, tự điền vào form đặt thuê)
  phone: { type: DataTypes.STRING(20), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true },
  role: { type: DataTypes.STRING, defaultValue: 'khach' }, // admin | nhanvien | khach
  // --- Xác minh danh tính (OCR CCCD) ---
  idCardNumber: { type: DataTypes.STRING },
  idCardImage: { type: DataTypes.STRING },
  ResetHash: { type: DataTypes.STRING(64), allowNull: true },      // hash mã đặt lại mật khẩu
  ResetExpires: { type: DataTypes.DATE, allowNull: true },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },   // false = bị admin khóa
}, {
  tableName: 'Users',
  timestamps: true,
});

// Băm mật khẩu trước khi lưu (tạo mới, hoặc khi admin đặt lại mật khẩu)
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});
User.beforeUpdate(async (user) => {
  if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10);
});

User.prototype.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = User;
