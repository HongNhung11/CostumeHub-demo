// Kiểm tra dữ liệu tài khoản (dùng chung cho Đăng ký và trang Quản lý tài khoản của admin)
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ');

function checkFullName(fullName) {
  return fullName.length < 2 || fullName.length > 100 ? 'Họ tên phải từ 2 đến 100 ký tự.' : null;
}
function checkUsername(username) {
  return USERNAME_RE.test(username) ? null : 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới.';
}
function checkPassword(password, username = '') {
  if (password.length < 6 || password.length > 100) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (username && password.toLowerCase() === username.toLowerCase()) return 'Mật khẩu không được trùng tên đăng nhập.';
  return null;
}

// Trả về lỗi đầu tiên hoặc null
function validateAccount({ fullName, username, password }) {
  return checkFullName(fullName) || checkUsername(username) || checkPassword(password, username);
}

module.exports = { cleanName, checkFullName, checkUsername, checkPassword, validateAccount };
