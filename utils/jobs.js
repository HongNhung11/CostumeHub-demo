// VIỆC CHẠY NỀN. Mỗi việc không chồng lên chính nó; lỗi 1 việc không làm dừng việc khác.
const { SEPAY } = require('./env');
const { reconcile } = require('./payments');
const { expirePending, remindAll } = require('./notify');
const mailer = require('./mailer');

function every(name, ms, fn) {
  let running = false, lastError = '';
  const run = async () => {
    if (running) return;
    running = true;
    try { await fn(); lastError = ''; }
    catch (e) {
      if (e.message !== lastError) console.error(`Việc nền "${name}" lỗi:`, e.message);   // không spam log cùng 1 lỗi
      lastError = e.message;
    } finally { running = false; }
  };
  setInterval(run, ms).unref();
  run();
}

function start({ store }) {
  if (SEPAY.enabled && SEPAY.token) every('đối soát SePay', 10e3, () => reconcile(SEPAY));
  every('hủy đơn quá hạn chuyển khoản', 30e3, expirePending);
  every('nhắc ngày nhận / hạn trả', 15 * 60e3, remindAll);
  if (mailer.enabled) every('gửi email thông báo', 15e3, mailer.sendPending);
  every('xóa ảnh CCCD hết hạn lưu', 6 * 60 * 60e3, require('./retention').purgeIdCards);
  every('dọn session hết hạn', 60 * 60e3, () => store.purge());
}

module.exports = { start, every };
