const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  fullName: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'khach' }, // admin | nhanvien | khach
  // --- Xác minh danh tính (OCR CCCD) ---
  idCardNumber: { type: DataTypes.STRING },
  idCardImage: { type: DataTypes.STRING },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'Users',
  timestamps: true,
});

// Băm mật khẩu trước khi lưu
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

User.prototype.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = User;
