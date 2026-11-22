// Khóa phiên: lấy từ .env, không có thì tự sinh 1 lần và giữ trong state/ (Docker: volume "appstate").
// Nhờ vậy tải project về là chạy được, xóa thư mục tải lại cũng không bị đăng xuất.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureSessionSecret() {
  if (String(process.env.SESSION_SECRET || '').length) return;   // có khai thì server.js kiểm tra độ dài
  const dir = path.join(__dirname, '..', 'state');
  const file = path.join(dir, 'session-secret');
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  process.env.SESSION_SECRET = fs.readFileSync(file, 'utf8').trim();
}

module.exports = { ensureSessionSecret };
