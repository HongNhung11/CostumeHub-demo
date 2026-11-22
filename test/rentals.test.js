// Lỗi 6, 7, 8, 9 + tài khoản nhận hoàn, nhật ký
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, day } = require('./helpers');

let t, staff;
before(async () => { t = await start(); staff = await t.staff(); });
after(() => t?.stop());

const set = (id, fields) => {
  const keys = Object.keys(fields);
  return t.db.query(`UPDATE "Rentals" SET ${keys.map((k, i) => `"${k}"=$${i + 2}`).join(',')} WHERE "RentalID"=$1`, [id, ...Object.values(fields)]);
};

test('#6 "Đang giao" quá hạn vẫn giữ đồ', async () => {
  const pid = await t.product();
  const id = await t.book((await t.customer()).c, pid, { zone: 'local', start: 20 });
  await set(id, { Status: 'Đang giao', StartDate: day(-8), EndDate: day(-5), ShippedAt: day(-9) });
  assert.equal(await t.book((await t.customer()).c, pid, { start: 1, days: 1 }), 0);
});

test('#7 đổi size: size vừa mặc bận hết ngày giặt rồi mới rảnh', async () => {
  const pid = await t.product({ sizes: ['M', 'L'] });
  const id = await t.book((await t.customer()).c, pid, { start: 5 });
  await set(id, { Status: 'Đang thuê', StartDate: day(0), EndDate: day(4) });
  const it = await t.one('SELECT "ItemID" FROM "RentalItems" WHERE "RentalID"=$1', [id]);
  await staff(`/rentals/${id}/size`, { ItemID: String(it.ItemID), Target: 'L|Do' });
  assert.equal((await t.one('SELECT "Size" FROM "RentalItems" WHERE "RentalID"=$1', [id])).Size, 'L');
  assert.equal(await t.book((await t.customer()).c, pid, { start: 1, days: 1 }), 0, 'ngày giặt: chưa cho thuê');
  assert.ok(await t.book((await t.customer()).c, pid, { start: 2, days: 1 }), 'sau ngày giặt: thuê được');
});

async function outForDelivery(method = 'COD') {
  const u = await t.customer();
  const id = await t.book(u.c, await t.product(), { zone: 'local', start: 10, method });
  await set(id, { Status: 'Đang thuê', PaymentStatus: 'Đã thanh toán', StartDate: day(-6), EndDate: day(-3), ShippedAt: day(-7) });
  return { u, id };
}

test('#8 khách bấm "đã gửi trả": chưa chốt ngày tính phí', async () => {
  const { u, id } = await outForDelivery();
  await u.c(`/rentals/${id}/sent-back`, { ReturnTrackingCode: 'BUA123' });
  const r = await t.rental(id);
  assert.equal(r.Status, 'Đang gửi trả');
  assert.equal(r.ReturnSentDate, null);
});

test('#8 phí trễ theo ngày nhân viên đối chiếu vận đơn', async () => {
  const { u, id } = await outForDelivery();
  await u.c(`/rentals/${id}/sent-back`, { ReturnTrackingCode: 'BUA123' });
  // khách đã bấm đúng hạn, nhưng vận đơn cho thấy hôm nay mới gửi
  const col = (await t.rental(id)).ReturnSentDate ? 'ReturnSentDate' : 'ReturnClaimedDate';
  await set(id, { [col]: day(-3) });
  await staff(`/rentals/${id}/return`, { ReturnDate: day(0), SentDate: day(0) });
  assert.equal(Number((await t.rental(id)).LateFee), 3 * 50000);
});

test('#8 thiếu ngày gửi đã đối chiếu: chưa cho hoàn tất', async () => {
  const { u, id } = await outForDelivery();
  await u.c(`/rentals/${id}/sent-back`, { ReturnTrackingCode: 'BUA123' });
  await staff(`/rentals/${id}/return`, { ReturnDate: day(0) });
  assert.equal((await t.rental(id)).Status, 'Đang gửi trả');
});

test('#8 khách không tự chốt được ngày gửi', async () => {
  const { u, id } = await outForDelivery();
  await u.c(`/rentals/${id}/sent-back`, { ReturnTrackingCode: 'BUA123', SentDate: day(-3) });
  await u.c(`/rentals/${id}/sent-confirm`, { SentDate: day(-3) });
  assert.equal((await t.rental(id)).ReturnSentDate, null);
});

test('#9 CSDL từ chối xóa sản phẩm đang có đơn', async () => {
  const pid = await t.product();
  const id = await t.book((await t.customer()).c, pid);
  await assert.rejects(t.db.query('DELETE FROM "Products" WHERE "ProductID"=$1', [pid]));
  assert.ok(await t.rental(id));
});

test('#9 xóa đúng lúc có người đặt: không mất đơn', async () => {
  const admin = await t.admin();
  const u = await t.customer();
  for (let i = 0; i < 16; i++) {
    const pid = await t.product();
    await u.c('/cart');
    const booking = t.book(u.c, pid);
    await new Promise(r => setTimeout(r, i * 7));
    const [id, del] = await Promise.all([booking, i % 2 ? admin('/products/delete-many', { ids: String(pid) }) : admin(`/products/${pid}?_method=DELETE`, {})]);
    assert.ok(del.status < 500, 'xóa không lỗi 500');
    if (id) {
      const r = await t.rental(id);
      assert.ok(r, `đơn ${id} bị mất`);
      const it = await t.one('SELECT "ProductID" FROM "RentalItems" WHERE "RentalID"=$1', [id]);
      assert.equal(it.ProductID, pid);
    }
  }
});

test('#9 vẫn xóa được sản phẩm chưa có đơn', async () => {
  const pid = await t.product();
  await (await t.admin())(`/products/${pid}?_method=DELETE`, {});
  assert.equal(await t.one('SELECT 1 FROM "Products" WHERE "ProductID"=$1', [pid]), undefined);
});

async function cancelledPaid() {
  const u = await t.customer();
  const id = await t.book(u.c, await t.product());
  await set(id, { PaymentStatus: 'Đã thanh toán' });
  await u.c(`/rentals/${id}/cancel`, {});
  const e = await t.one('SELECT "EntryID" FROM "LedgerEntries" WHERE "RentalID"=$1', [id]);
  return { u, id, entry: e.EntryID };
}
const bank = (password, account = '1234567890') => ({ RefundBank: 'MB', RefundAccount: account, RefundHolder: 'NGUYEN VAN A', currentPassword: password });
const entryStatus = async (id) => (await t.one('SELECT "Status" FROM "LedgerEntries" WHERE "EntryID"=$1', [id])).Status;

test('Bổ sung 1: khách khai tài khoản nhận hoàn, phải có mật khẩu', async () => {
  const { u, id } = await cancelledPaid();
  await u.c(`/rentals/${id}/refund-account`, bank('sai-mat-khau'));
  assert.equal((await t.rental(id)).RefundAccount, null);
  await u.c(`/rentals/${id}/refund-account`, bank(u.password));
  assert.equal((await t.rental(id)).RefundAccount, '1234567890');
});

test('Bổ sung 1: người khác không sửa được tài khoản nhận hoàn', async () => {
  const { id } = await cancelledPaid();
  const other = await t.customer();
  await other.c(`/rentals/${id}/refund-account`, bank(other.password));
  assert.equal((await t.rental(id)).RefundAccount, null);
});

test('Bổ sung 1: chưa có tài khoản thì không ghi "đã chuyển khoản hoàn"', async () => {
  const { entry } = await cancelledPaid();
  await staff(`/admin/money/ledger/${entry}`, { Method: 'Chuyển khoản', Reference: 'HOAN001' });
  assert.equal(await entryStatus(entry), 'pending');
});

test('Bổ sung 1: khách đổi tài khoản lúc nhân viên đang chuyển thì phải xem lại', async () => {
  const { u, id, entry } = await cancelledPaid();
  await u.c(`/rentals/${id}/refund-account`, bank(u.password));
  await staff(`/admin/money/ledger/${entry}`, { Method: 'Chuyển khoản', Reference: 'HOAN002', SentTo: 'MB 9999999999' });
  assert.equal(await entryStatus(entry), 'pending');
  await staff(`/admin/money/ledger/${entry}`, { Method: 'Chuyển khoản', Reference: 'HOAN002', SentTo: 'MB 1234567890' });
  assert.equal(await entryStatus(entry), 'done');
});

test('Bổ sung 2: thu COD lưu tên nhân viên', async () => {
  const id = await t.book((await t.customer()).c, await t.product(), { zone: 'local' });
  await set(id, { Status: 'Đang thuê' });
  await staff(`/rentals/${id}/cod-collected`, {});
  const a = await t.one(`SELECT * FROM "AuditLogs" WHERE "RentalID"=$1 AND "Action"='payment.cod'`, [id]);
  assert.ok(a, 'có dòng nhật ký');
  assert.equal(a.ActorName, 'nhanvien');
  assert.ok(Number(a.Amount) > 0);
});

test('Bổ sung 2: xác nhận tay lưu tên nhân viên', async () => {
  const id = await t.book((await t.customer()).c, await t.product());
  await set(id, { Status: 'Chờ cọc', PaymentMethod: 'Chuyển khoản', PaymentStatus: 'Chưa thanh toán' });
  await staff(`/rentals/${id}/deposit`, {});
  const a = await t.one(`SELECT * FROM "AuditLogs" WHERE "RentalID"=$1 AND "Action"='payment.manual'`, [id]);
  assert.ok(a);
  assert.equal(a.ActorName, 'nhanvien');
});

test('Bổ sung 2: chỉ admin xem nhật ký toàn shop', async () => {
  assert.equal((await staff('/admin/audit')).status, 302);
  assert.equal((await (await t.admin())('/admin/audit')).status, 200);
});

test('trùng lịch: 10 khách giành bộ cuối, đúng 1 người được', async () => {
  const people = await Promise.all(Array.from({ length: 10 }, () => t.customer()));
  for (let i = 0; i < 4; i++) {
    const pid = await t.product();
    const ids = await Promise.all(people.map(p => t.book(p.c, pid)));
    assert.equal(ids.filter(Boolean).length, 1);
  }
});

test('COD: khách bấm đã nhận đồ không được tính là đã trả tiền', async () => {
  const u = await t.customer();
  const id = await t.book(u.c, await t.product(), { zone: 'local' });
  await set(id, { Status: 'Đang giao' });
  await u.c(`/rentals/${id}/delivered`, {});
  assert.equal((await t.rental(id)).PaymentStatus, 'Thu khi nhận đồ');
});
