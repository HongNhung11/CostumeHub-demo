// Tạo .env từ .env.example với mật khẩu ngẫu nhiên. Đã có .env thì không đụng vào, không in bí mật ra màn hình.
//   node scripts/setup-env.js
//   node scripts/setup-env.js --existing-db    (máy đã có volume Postgres của bản cũ, mật khẩu "postgres")
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const target = path.join(root, '.env');
if (fs.existsSync(target)) {
  console.log('.env đã có, giữ nguyên.');
  process.exit(0);
}
const secret = (n) => crypto.randomBytes(n).toString('hex');
const dbPassword = process.argv.includes('--existing-db') ? 'postgres' : secret(20);
const text = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
  .replace(/^SESSION_SECRET=.*$/m, () => `SESSION_SECRET=${secret(32)}`)
  .replace(/^ADMIN_PASSWORD=.*$/m, () => `ADMIN_PASSWORD=${secret(10)}`)
  .replace(/^DB_PASSWORD=.*$/m, () => `DB_PASSWORD=${dbPassword}`);
fs.writeFileSync(target, text, { flag: 'wx', mode: 0o600 });
console.log('Đã tạo .env. Điền SEPAY_* để nhận chuyển khoản, SMTP_* để gửi email.');
