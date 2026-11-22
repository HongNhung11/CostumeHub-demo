// MÃ VIETQR ĐỘNG (chuẩn EMVCo / NAPAS 247) — sinh ngay tại máy chủ, không gửi thông tin đơn cho dịch vụ khác
const QRCode = require('qrcode');

// Mỗi trường: mã (2 ký tự) + độ dài (2 chữ số) + giá trị
function field(id, value) {
  const v = String(value);
  if (v.length > 99) throw new Error(`VietQR: trường ${id} quá dài`);
  return id + String(v.length).padStart(2, '0') + v;
}

// CRC-16/CCITT-FALSE
function crc16(s) {
  let crc = 0xffff;
  for (const byte of Buffer.from(s, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function payload({ bin, account, amount, content }) {
  if (!/^\d{6}$/.test(bin)) throw new Error('VietQR: BIN không hợp lệ');
  if (!/^[A-Za-z0-9]{4,19}$/.test(account)) throw new Error('VietQR: số tài khoản không hợp lệ');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('VietQR: số tiền không hợp lệ');
  if (!/^[A-Za-z0-9 ]{1,25}$/.test(content)) throw new Error('VietQR: nội dung không hợp lệ');
  const merchant = field('00', 'A000000727') + field('01', field('00', bin) + field('01', account)) + field('02', 'QRIBFTTA');
  const body = field('00', '01') + field('01', '12') + field('38', merchant)
    + field('53', '704') + field('54', amount) + field('58', 'VN') + field('62', field('08', content)) + '6304';
  return body + crc16(body);
}

const png = (opts) => QRCode.toBuffer(payload(opts), { errorCorrectionLevel: 'M', margin: 4, width: 520 });

module.exports = { payload, png, crc16 };
