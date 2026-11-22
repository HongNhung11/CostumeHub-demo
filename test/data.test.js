// Bổ sung 3, 4, 5: dữ liệu mẫu, Test mode, phân trang trong CSDL
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { start, day } = require('./helpers');

const count = async (t, sql) => Number((await t.one(`SELECT count(*) n FROM ${sql}`)).n);
const listed = (html) => new Set([...html.matchAll(/<td><a href="\/rentals\/(\d+)">/g)].map(m => Number(m[1])));

test('Bổ sung 3: CSDL mới + DEMO_DATA=false: không có dữ liệu giả', async (ctx) => {
  const t = await start({ env: { DEMO_DATA: 'false' } });
  ctx.after(() => t.stop());
  assert.equal(await count(t, '"Rentals"'), 0);
  assert.equal(await count(t, '"Coupons"'), 0);
  assert.equal(await count(t, '"Products"'), 0);
  assert.equal(await count(t, `"Users" WHERE username IN ('nhanvien','khachhang')`), 0);
  await t.admin();
});

test('Bổ sung 3: tắt công tắc: ẩn đơn mẫu, không xóa, không chiếm lịch; bật lại thì hiện', async (ctx) => {
  const t = await start();
  ctx.after(() => t.stop());
  assert.equal(listed((await (await t.admin())('/rentals')).text).size > 0, true);
  const held = await t.one(`SELECT r."RentalID", r."EndDate", it."ProductID", it."Size", it."Color", it."Quantity" FROM "Rentals" r JOIN "RentalItems" it USING ("RentalID")
    WHERE r."Status"='Đã cọc' ORDER BY r."RentalID" LIMIT 1`);

  await t.restart({ DEMO_DATA: 'false' });
  const admin = await t.admin();
  assert.equal(listed((await admin('/rentals')).text).size, 0, 'danh sách không còn đơn mẫu');
  assert.equal((await admin(`/rentals/${held.RentalID}`)).status, 404);
  assert.match((await admin('/admin/stats')).text, /0 đơn thuê từ trước tới nay/);
  assert.equal(await count(t, '"Rentals"'), 20, 'dữ liệu vẫn còn trong CSDL');
  const out = await t.exec(`require('./utils/availability').freeByVariant({ ProductID: ${held.ProductID} }, '${day(0)}', '${day(8)}')
    .then(f => { console.log('FREE=' + JSON.stringify(f)); process.exit(0) })`);
  const free = JSON.parse(out.match(/FREE=(.*)/)[1]);
  const stock = await t.one('SELECT "Quantity" FROM "ProductVariants" WHERE "ProductID"=$1 AND "Size"=$2 AND "Color"=$3', [held.ProductID, held.Size, held.Color]);
  assert.equal(free[`${held.Size}|${held.Color}`], stock.Quantity, 'đơn mẫu không chiếm lịch');

  await t.restart({ DEMO_DATA: 'true' });
  assert.equal(listed((await (await t.admin())('/rentals')).text).size > 0, true);
});

test('Bổ sung 3: tiền thật thì mặc định không dùng dữ liệu mẫu', async (ctx) => {
  const t = await start({ env: { SEPAY_MODE: 'live', DEMO_DATA: '' } });
  ctx.after(() => t.stop());
  assert.equal(listed((await (await t.admin())('/rentals')).text).size, 0);
});

test('Bổ sung 4: đơn Test mode tách khỏi tiền thật', async (ctx) => {
  const t = await start({ env: { SEPAY_MODE: 'sandbox', DEMO_DATA: 'false' } });
  ctx.after(() => t.stop());
  const pid = await t.product();
  const testOrder = await t.book((await t.customer()).c, pid, { method: 'Chuyển khoản' });
  assert.ok(testOrder);
  const before = await t.rental(testOrder);
  await t.transfer(before.PayCode, t.due(before));
  assert.equal((await t.rental(testOrder)).Status, 'Đã cọc', 'Test mode vẫn tự xác nhận');
  await t.db.query(`UPDATE "Rentals" SET "Status"='Hoàn tất', "ReturnDate"=$2 WHERE "RentalID"=$1`, [testOrder, day(0)]);
  assert.match((await (await t.admin())('/admin/stats')).text, /0 đơn hoàn tất/, 'Test mode không vào doanh thu');

  await t.restart({ SEPAY_MODE: 'live' });
  const admin = await t.admin();
  assert.equal((await admin(`/rentals/${testOrder}`)).status, 404, 'live không thấy đơn thử');
  assert.ok(!(await admin('/admin/money?tab=all')).text.includes(before.PayCode), 'sổ live không có tiền thử');

  await t.transfer(before.PayCode, t.due(before));
  const p = await t.one('SELECT "State" FROM "Payments" ORDER BY "PaymentID" DESC LIMIT 1');
  assert.notEqual(p.State, 'confirmed', 'tiền thật không khớp vào đơn thử');

  const real = await t.book((await t.customer()).c, pid, { method: 'Chuyển khoản' });
  assert.ok(real, 'đơn thử không chiếm lịch thật');
  await t.restart({ SEPAY_MODE: 'sandbox' });
  const r = await t.rental(real);
  await t.transfer(r.PayCode, t.due(r));
  assert.equal((await t.rental(real)).Status, 'Chờ cọc', 'tiền thử không xác nhận được đơn thật');
});

test('Bổ sung 5: phân trang, tìm kiếm, đếm làm trong CSDL', async (ctx) => {
  const t = await start();
  ctx.after(() => t.stop());
  const u = await t.customer();
  const pid = await t.product({ qty: 2, name: 'Váy lụa Đặc Biệt' });
  const id = await t.book(u.c, pid, { name: 'Đỗ Thị Ánh' });
  const admin = await t.admin();

  for (const q of ['do thi anh', 'ĐỖ THỊ', 'vay lua dac biet', '#' + id]) {
    assert.ok(listed((await admin('/rentals?q=' + encodeURIComponent(q))).text).has(id), 'tìm thấy theo ' + q);
  }
  assert.equal(listed((await admin('/rentals?q=' + encodeURIComponent('%'))).text).size, 0, '% là ký tự thường');
  assert.deepEqual([...listed((await u.c('/rentals')).text)], [id], 'khách chỉ thấy đơn mình');

  await t.db.query(`INSERT INTO "Rentals" ("ProductID","CustomerName","CustomerPhone","StartDate","EndDate","Status","createdAt","updatedAt","version")
    SELECT $1, 'Khach ' || g, '0912345678', $2::date, $2::date, 'Hoàn tất', now(), now(), 0 FROM generate_series(1, 30000) g`, [pid, day(-100)]);
  const page1 = await admin('/rentals');
  assert.equal(listed(page1.text).size, 15);
  assert.ok(page1.text.includes('30021 đơn'), 'tổng đếm đúng');
  const began = Date.now();
  await admin('/rentals?page=3');
  assert.ok(Date.now() - began < 600, `30.000 đơn phải dưới 600ms, đo được ${Date.now() - began}ms`);

  // "Quá hạn" tính bằng SQL phải trùng với quy tắc alertOf
  await t.db.query(`DELETE FROM "Rentals" WHERE "CustomerName" LIKE 'Khach %' AND "Status"='Hoàn tất' AND "StartDate"=$1`, [day(-100)]);
  for (let offset = -7; offset <= 3; offset++) {
    for (const [status, method, ship] of [['Đã cọc', 'Tự đến lấy', 0], ['Đã cọc', 'Giao tận nơi', 3], ['Đang giao', 'Giao tận nơi', 1], ['Đang thuê', 'Tự đến lấy', 0], ['Đang gửi trả', 'Giao tận nơi', 2]]) {
      await t.db.query(`INSERT INTO "Rentals" ("ProductID","CustomerName","CustomerPhone","StartDate","EndDate","Status","DeliveryMethod","ShipDays","createdAt","updatedAt","version")
        VALUES ($1,'Ma tran','0912345678',$2,$3,$4,$5,$6,now(),now(),0)`, [pid, day(offset), day(offset + 1), status, method, ship]);
    }
  }
  const out = await t.exec(`const { Rental } = require('./models'); const { alertOf } = require('./controllers/rentalController');
    Rental.findAll().then(l => { console.log('IDS=' + JSON.stringify(l.filter(r => alertOf(r)?.overdue).map(r => r.RentalID).sort((a, b) => a - b))); process.exit(0) })`);
  const want = JSON.parse(out.match(/IDS=(.*)/)[1]);
  const got = new Set();
  for (let p = 1; p <= Math.ceil(want.length / 15); p++) for (const x of listed((await admin(`/rentals?status=quahan&page=${p}`)).text)) got.add(x);
  assert.deepEqual([...got].sort((a, b) => a - b), want);
});
