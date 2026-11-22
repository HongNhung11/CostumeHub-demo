// Lỗi 3, 4, 5, 10, 11
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, until, ADMIN_PASS } = require('./helpers');

let t, adminSession;   // đăng nhập trước, để test #4 (khóa admin) không che kết quả các test #11
before(async () => { t = await start(); adminSession = await t.admin(); });
after(() => t?.stop());

test('#4 người lạ gõ sai (cùng IP) không khóa được admin trên máy quen', async () => {
  const mine = await t.admin();
  await mine('/logout');
  const stranger = t.client();
  for (let i = 0; i < 8; i++) await stranger('/login', { username: 'admin', password: 'sai' + i });
  assert.equal((await mine('/login', { username: 'admin', password: ADMIN_PASS })).to, '/');
});

test('#4 máy lạ vẫn bị chặn dò mật khẩu', async () => {
  const u = await t.customer();
  for (let i = 0; i < 6; i++) await t.client()('/login', { username: u.username, password: 'sai' + i });
  assert.notEqual((await t.client()('/login', { username: u.username, password: u.password })).to, '/');
});

test('#4 máy quen vẫn bị giới hạn (không dò vô hạn bằng cookie)', async () => {
  const u = await t.customer();
  const c = await t.login(u.username, u.password);
  await c('/logout');
  for (let i = 0; i < 12; i++) await c('/login', { username: u.username, password: 'sai' + i });
  assert.notEqual((await c('/login', { username: u.username, password: u.password })).to, '/');
});

test('#4 cookie máy quen giả mạo không có tác dụng', async () => {
  const u = await t.customer();
  for (let i = 0; i < 6; i++) await t.client()('/login', { username: u.username, password: 'sai' + i });
  const c = t.client();
  c.jar.set('ch.dev', 'a'.repeat(32) + '.' + 'b'.repeat(64));
  assert.notEqual((await c('/login', { username: u.username, password: u.password })).to, '/');
});

test('#4 120 lần sai từ chung IP không khóa khách khác', async () => {
  const u = await t.customer();
  const c = t.client();
  for (let i = 0; i < 120; i++) await c('/login', { username: 'khongco' + i, password: 'x' });
  assert.equal((await t.client()('/login', { username: u.username, password: u.password })).to, '/');
});

test('#5 khách vãng lai xem web không tạo session', async () => {
  const count = async () => Number((await t.one('SELECT count(*) n FROM "Sessions"')).n);
  const before = await count();
  for (let i = 0; i < 4; i++) {
    for (const url of ['/', '/products', '/products/1', '/cart', '/login', '/combo', '/hoi-dap', '/khong-co']) await t.client()(url);
  }
  assert.equal(await count(), before);
});

test('#5 giỏ và "sản phẩm đã xem" của khách vãng lai vẫn hoạt động', async () => {
  const pid = await t.product();
  const c = t.client();
  await c('/cart/add', { ProductID: String(pid), Size: 'M', Color: 'Do', Quantity: '1' });
  assert.match((await c('/cart')).text, /\/cart\/[a-z0-9]+\/remove/);
  await c('/products/1');
  assert.match((await c('/products/2')).text, /Sản phẩm đã xem/);
});

test('#3 máy chủ thư hỏng lâu: thư không bị bỏ', async () => {
  const u = await t.customer();
  await t.db.query('UPDATE "Users" SET "EmailVerifiedAt"=now() WHERE id=$1', [u.id]).catch(() => {});
  const { NotificationID: id } = await t.one(
    `INSERT INTO "Notifications" ("UserID","Title","Message","Level","isRead","createdAt") VALUES ($1,'Thu mail hong','Noi dung','info',false,now()) RETURNING "NotificationID"`, [u.id]);
  const send = () => t.exec("require('./utils/mailer').sendPending().then(() => process.exit(0))");
  const dueNow = () => t.db.query('UPDATE "Notifications" SET "EmailNextAt"=NULL WHERE "NotificationID"=$1', [id]).catch(() => {});
  t.smtp.down = true;
  for (let i = 0; i < 7; i++) { await send(); await dueNow(); }
  t.smtp.down = false;
  await send();
  assert.ok(await until(() => t.smtp.mails.some(m => m.text.includes('Thu mail hong')), 20000), 'thư tới sau khi máy chủ thư sống lại');
});

test('#10 đổi email không có mật khẩu: từ chối', async () => {
  const u = await t.customer();
  await u.c('/account/profile', { fullName: 'Khach thu', phone: '0912345678', email: 'ke.trom@example.test' });
  assert.equal((await t.one('SELECT email FROM "Users" WHERE id=$1', [u.id])).email, u.email);
});

test('#10 đổi email: chỉ có hiệu lực sau khi xác minh, link dùng 1 lần', async () => {
  const u = await t.customer();
  const next = `moi${u.id}@example.test`;
  await u.c('/account/profile', { fullName: 'Khach thu', phone: '0912345678', email: next, currentPassword: u.password });
  assert.equal((await t.one('SELECT email FROM "Users" WHERE id=$1', [u.id])).email, u.email, 'chưa xác minh thì giữ email cũ');

  const mail = await until(() => t.smtp.mails.find(m => m.to === next), 10000);
  assert.ok(mail, 'có thư xác minh');
  const url = mail.text.match(/\/xac-minh-email\/[a-f0-9]{64}/)[0];

  const other = await t.customer();
  await other.c(url, {});
  assert.equal((await t.one('SELECT email FROM "Users" WHERE id=$1', [u.id])).email, u.email, 'người khác mở link không được');

  assert.equal((await u.c(url)).status, 200);
  assert.equal((await t.one('SELECT email FROM "Users" WHERE id=$1', [u.id])).email, u.email, 'chỉ mở link (GET) thì chưa đổi');
  await u.c(url, {});
  assert.equal((await t.one('SELECT email FROM "Users" WHERE id=$1', [u.id])).email, next);
});

test('#10 email chưa xác minh không nhận link đặt lại mật khẩu', async () => {
  const u = await t.customer();
  await t.client()('/quen-mat-khau', { email: u.email });
  const got = await until(() => t.smtp.mails.some(m => m.to === u.email && m.text.includes('/dat-lai-mat-khau/')), 3000);
  assert.ok(!got);
});

test('#10 email đã xác minh: đặt lại mật khẩu được', async () => {
  const u = await t.customer();
  const verify = await until(() => t.smtp.mails.find(m => m.to === u.email && m.text.includes('/xac-minh-email/')), 10000);
  assert.ok(verify, 'đăng ký xong có thư xác minh');
  await u.c(verify.text.match(/\/xac-minh-email\/[a-f0-9]{64}/)[0], {});
  await t.client()('/quen-mat-khau', { email: u.email });
  const reset = await until(() => t.smtp.mails.find(m => m.to === u.email && m.text.includes('/dat-lai-mat-khau/')), 10000);
  assert.ok(reset, 'có thư đặt lại');
  await t.client()(reset.text.match(/\/dat-lai-mat-khau\/[a-f0-9]{64}/)[0], { password: 'moi123456', confirm: 'moi123456' });
  await t.login(u.username, 'moi123456');
});

for (const url of ['/products/abc', '/products/99999999999', '/products/1.5', '/products/abc/quick', '/products/abc/edit', '/rentals/abc', '/rentals/99999999999', '/rentals/abc/return', '/notifications/abc']) {
  test(`#11 GET ${url} -> 404`, async () => {
    assert.equal((await adminSession(url)).status, 404);
  });
}

test('#11 POST với id sai không gây lỗi 500', async () => {
  const a = adminSession;
  for (const [url, body] of [['/reviews/abc/delete', {}], ['/admin/users/abc/lock', {}], ['/admin/coupons/abc/toggle', {}], ['/admin/contacts/abc', {}], ['/cart/add', { ProductID: 'abc' }], ['/cart/add', { ProductID: '99999999999' }]]) {
    assert.ok((await a(url, body)).status < 500, url);
  }
});

test('#11 tham số truy vấn lạ không gây lỗi 500', async () => {
  const a = adminSession;
  for (const url of ['/notifications?page=99999999999999999999', '/admin/money?page=99999999999999999999', '/rentals?page=99999999999999999999', '/products?q[a]=1', '/products/manage?q=a&q=b', '/products/manage?limit=-5']) {
    assert.ok((await a(url)).status < 500, url);
  }
});

test('CSRF: POST từ trang khác bị chặn', async () => {
  assert.equal((await t.client()('/login', { username: 'admin', password: ADMIN_PASS }, { origin: 'http://evil.example' })).status, 403);
});
