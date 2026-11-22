// Lỗi 1, 2: tiền lệch / tiền báo muộn + các quy tắc thanh toán nền tảng
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let t;
before(async () => { t = await start({ env: { SEPAY_MODE: 'live' } }); });
after(() => t?.stop());

async function bankOrder(opts = {}) {
  const u = await t.customer();
  const pid = await t.product();
  const id = await t.book(u.c, pid, { method: 'Chuyển khoản', ...opts });
  assert.ok(id, 'tạo được đơn chuyển khoản');
  const r = await t.rental(id);
  return { u, pid, id, code: r.PayCode, due: t.due(r) };
}
const status = async (id) => (await t.rental(id)).Status;
const entries = (id) => t.all('SELECT "Direction","Amount" FROM "LedgerEntries" WHERE "RentalID"=$1', [id]);

test('#1 chuyển thiếu: đơn KHÔNG tự hủy khi đang chờ xử lý', async () => {
  const o = await bankOrder();
  await t.age(o.id, 8);
  await t.transfer(o.code, o.due - 1000, { minutesAgo: 6 });
  await o.u.c(`/rentals/${o.id}`);
  assert.equal(await status(o.id), 'Chờ cọc');
});

test('#1 chuyển bù đủ: tự xác nhận theo tổng các lần chuyển', async () => {
  const o = await bankOrder();
  await t.transfer(o.code, o.due - 50000);
  await t.transfer(o.code, 50000);
  assert.equal(await status(o.id), 'Đã cọc');
  assert.deepEqual(await entries(o.id), []);
});

test('#1 chuyển thừa: nhân viên nhận vào đơn, chỉ hoàn phần dư', async () => {
  const o = await bankOrder();
  await t.transfer(o.code, o.due + 30000);
  const p = await t.one('SELECT "PaymentID" FROM "Payments" WHERE "RentalID"=$1', [o.id]);
  await (await t.staff())(`/admin/money/payments/${p.PaymentID}`, { Action: 'accept' });
  assert.equal(await status(o.id), 'Đã cọc');
  assert.deepEqual((await entries(o.id)).map(e => [e.Direction, Number(e.Amount)]), [['out', 30000]]);
});

test('#1 chưa đủ tiền: không được "nhận vào đơn"', async () => {
  const o = await bankOrder();
  await t.transfer(o.code, o.due - 1000);
  const p = await t.one('SELECT "PaymentID" FROM "Payments" WHERE "RentalID"=$1', [o.id]);
  await (await t.staff())(`/admin/money/payments/${p.PaymentID}`, { Action: 'accept' });
  assert.equal(await status(o.id), 'Chờ cọc');
});

test('#1 chưa quyết định thì không được đóng giao dịch, kẻo đơn lại tự hủy', async () => {
  const o = await bankOrder();
  await t.transfer(o.code, o.due - 1000);
  const p = await t.one('SELECT "PaymentID" FROM "Payments" WHERE "RentalID"=$1', [o.id]);
  await (await t.staff())(`/admin/money/payments/${p.PaymentID}`, { Action: 'keep' });
  assert.equal((await t.one('SELECT "State" FROM "Payments" WHERE "PaymentID"=$1', [p.PaymentID])).State, 'review');
});

test('#1 khách hủy khi đã chuyển lệch: tiền đó vào sổ hoàn', async () => {
  const o = await bankOrder();
  await t.transfer(o.code, o.due - 1000);
  await o.u.c(`/rentals/${o.id}/cancel`, {});
  assert.equal(await status(o.id), 'Đã hủy');
  assert.deepEqual((await entries(o.id)).map(e => [e.Direction, Number(e.Amount)]), [['out', o.due - 1000]]);
});

test('#2 chuyển đúng giờ, báo về muộn: đơn được khôi phục', async () => {
  const o = await bankOrder();
  await t.age(o.id, 10);
  await o.u.c(`/rentals/${o.id}`);
  assert.equal(await status(o.id), 'Đã hủy', 'đã tự hủy trước khi SePay báo');
  await t.transfer(o.code, o.due, { minutesAgo: 8 });
  assert.equal(await status(o.id), 'Đã cọc');
  assert.deepEqual(await entries(o.id), []);
});

test('#2 báo muộn nhưng chỗ đã có người khác: hoàn tiền, không đặt trùng', async () => {
  const o = await bankOrder();
  await t.age(o.id, 10);
  await o.u.c(`/rentals/${o.id}`);
  assert.ok(await t.book((await t.customer()).c, o.pid), 'khách khác đặt được chỗ vừa trống');
  await t.transfer(o.code, o.due, { minutesAgo: 8 });
  assert.equal(await status(o.id), 'Đã hủy');
  assert.equal((await entries(o.id)).length, 1);
});

test('#2 khách đã tự hủy: tiền về muộn không khôi phục đơn', async () => {
  const o = await bankOrder();
  await o.u.c(`/rentals/${o.id}/cancel`, {});
  await t.transfer(o.code, o.due);
  assert.equal(await status(o.id), 'Đã hủy');
  assert.equal((await entries(o.id)).length, 1);
});

test('#2 chuyển sau hạn: không khôi phục', async () => {
  const o = await bankOrder();
  await t.age(o.id, 20);
  await o.u.c(`/rentals/${o.id}`);
  await t.transfer(o.code, o.due);
  assert.equal(await status(o.id), 'Đã hủy');
});

test('#2 API đối soát đang lỗi: hoãn tự hủy', async () => {
  const o = await bankOrder();
  await t.age(o.id, 10);
  // Giả lập SePay chết: fetch luôn lỗi, không gọi mạng thật
  await t.exec(`global.fetch = async () => { throw new Error('down') };
    const { SEPAY } = require('./utils/env');
    require('./utils/payments').reconcile(SEPAY).catch(() => {})
      .then(() => require('./utils/notify').expirePending()).then(() => process.exit(0))`, { SEPAY_API_TOKEN: 'gia' });
  assert.equal(await status(o.id), 'Chờ cọc');
});

test('webhook trùng cùng lúc: ghi 1 lần, không sinh khoản hoàn', async () => {
  const o = await bankOrder();
  const ref = 'FTDUP' + o.id;
  const codes = await Promise.all(Array.from({ length: 15 }, () => t.transfer(o.code, o.due, { ref })));
  assert.ok(codes.every(c => c === 200));
  assert.equal(await status(o.id), 'Đã cọc');
  assert.equal(Number((await t.one('SELECT count(*) n FROM "Payments" WHERE "Reference"=$1', [ref])).n), 1);
  assert.deepEqual(await entries(o.id), []);
});

test('sai chữ ký / sai tài khoản nhận: không xác nhận', async () => {
  const o = await bankOrder();
  assert.equal(await t.transfer(o.code, o.due, { secret: 'sai' }), 401);
  await t.transfer(o.code, o.due, { account: '9999999999' });
  assert.equal(await status(o.id), 'Chờ cọc');
});

test('hủy đúng lúc tiền về: luôn có đúng 1 khoản hoàn', async () => {
  for (let i = 0; i < 8; i++) {
    const o = await bankOrder();
    await Promise.all([t.transfer(o.code, o.due), o.u.c(`/rentals/${o.id}/cancel`, {})]);
    assert.equal(await status(o.id), 'Đã hủy');
    assert.deepEqual((await entries(o.id)).map(e => Number(e.Amount)), [o.due]);
  }
});
