// Dấu của mật khẩu hiện tại, lưu trong session: đổi mật khẩu thì phiên cũ hết hiệu lực
const crypto = require('crypto');

module.exports = (passwordHash) => crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 20);
