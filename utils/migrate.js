// NÂNG CẤP CSDL 11/2026 (chạy lại nhiều lần vẫn an toàn, không xóa dữ liệu)
const { Op, DataTypes } = require('sequelize');
const { sequelize, User, Rental, RentalItem, Payment, LedgerEntry, Notification } = require('../models');
const { normalize } = require('./text');

const DEMO_ADDRESS = 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội';

async function upgrade() {
  const qi = sequelize.getQueryInterface();
  const added = new Set();

  const addKind = async (table) => {
    if ((await qi.describeTable(table)).DataKind) return;
    await qi.addColumn(table, 'DataKind', { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'real' });
    added.add(`${table}.DataKind`);
  };
  for (const t of ['Rentals', 'Payments', 'LedgerEntries']) await addKind(t);

  const columns = {
    Rentals: [Rental, ['CancelReason', 'ReturnClaimedDate', 'ReturnSentBy', 'RefundBank', 'RefundAccount', 'RefundHolder', 'SearchText']],
    LedgerEntries: [LedgerEntry, ['SentTo']],
    Users: [User, ['EmailVerifiedAt', 'PendingEmail', 'EmailVerifyHash', 'EmailVerifyExpires']],
    Notifications: [Notification, ['EmailNextAt']],
  };
  for (const [table, [model, names]] of Object.entries(columns)) {
    const have = await qi.describeTable(table);
    for (const name of names) {
      if (have[name]) continue;
      await qi.addColumn(table, name, { type: model.rawAttributes[name].type, allowNull: true });
      added.add(`${table}.${name}`);
    }
  }

  // Đơn mẫu của bản cũ chưa có nhãn. Nhận diện chặt bằng 3 dấu của seed:
  // không có lúc đồng ý nội quy (đơn khách đặt luôn có) + CCCD giả 0010000010xx + đúng địa chỉ mẫu.
  if (added.has('Rentals.DataKind')) {
    const cards = Array.from({ length: 20 }, (_, i) => '0010' + String(1000 + i).padStart(8, '0'));
    const [n] = await Rental.unscoped().update({ DataKind: 'demo' }, {
      where: { TermsAcceptedAt: null, CustomerIDCard: { [Op.in]: cards }, CustomerAddress: DEMO_ADDRESS },
      silent: true, hooks: false,
    });
    if (n) console.log(`🏷️  Đã đánh dấu ${n} đơn mẫu (ẩn khi DEMO_DATA=false, không xóa).`);
  }

  // Ngày gửi trả của đơn đang gửi về do khách tự bấm -> chuyển thành "khách báo", chờ nhân viên đối chiếu
  if (added.has('Rentals.ReturnClaimedDate')) {
    const list = await Rental.unscoped().findAll({ where: { Status: 'Đang gửi trả', ReturnSentDate: { [Op.ne]: null } } });
    for (const r of list) await r.update({ ReturnClaimedDate: r.ReturnSentDate, ReturnSentDate: null }, { silent: true });
    if (list.length) console.log(`🔁 ${list.length} đơn đang gửi trả chờ nhân viên đối chiếu ngày gửi.`);
  }

  await protectOrders();

  const indexes = [
    ['Rentals', ['DataKind', 'RentalID'], 'rentals_kind_id'],
    ['Rentals', ['DataKind', 'Status', 'RentalID'], 'rentals_kind_status_id'],
    ['Rentals', ['UserID', 'RentalID'], 'rentals_user_id'],
    ['RentalItems', ['RentalID'], 'rental_items_rental'],
    ['RentalItems', ['ProductID'], 'rental_items_product'],
  ];
  for (const [table, fields, name] of indexes) {
    if (!(await qi.showIndex(table)).some(i => i.name === name)) await qi.addIndex(table, fields, { name });
  }
}

// Khóa ngoại tới Products: CASCADE / SET NULL -> RESTRICT (xóa sản phẩm không bao giờ được làm mất đơn).
// SQLite không sửa được khóa ngoại của bảng có sẵn: ở đó chỉ có lớp chặn trong productController.
async function protectOrders() {
  if (sequelize.getDialect() !== 'postgres') return;
  for (const table of ['Rentals', 'RentalItems']) {
    const [rows] = await sequelize.query(
      `SELECT conname, confdeltype FROM pg_constraint
        WHERE contype = 'f' AND conrelid = '"${table}"'::regclass AND confrelid = '"Products"'::regclass`,
    );
    const wrong = rows.filter(r => r.confdeltype !== 'r');
    if (!wrong.length) continue;
    await sequelize.transaction(async (transaction) => {
      for (const { conname } of wrong) await sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`, { transaction });
      if (wrong.length === rows.length) {
        await sequelize.query(
          `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_ProductID_fkey" FOREIGN KEY ("ProductID")
             REFERENCES "Products" ("ProductID") ON UPDATE CASCADE ON DELETE RESTRICT`, { transaction },
        );
      }
    });
    console.log(`🔒 ${table}: xóa sản phẩm không còn kéo theo đơn.`);
  }
}

// Chuỗi tìm kiếm không dấu của đơn, để tìm ngay trong CSDL
const searchTextOf = (customerName, items) =>
  normalize([customerName, ...items.map(i => i.ProductName || i.product?.ProductName)].filter(Boolean).join(' | '));

async function fillSearchText() {
  const Plain = Rental.unscoped();
  for (;;) {
    const rows = await Plain.findAll({ where: { SearchText: null }, attributes: ['RentalID', 'CustomerName'], order: [['RentalID', 'ASC']], limit: 500 });
    if (!rows.length) return;
    const items = await RentalItem.findAll({ where: { RentalID: { [Op.in]: rows.map(r => r.RentalID) } }, attributes: ['RentalID', 'ProductName'], raw: true });
    await sequelize.transaction(async (transaction) => {
      for (const r of rows) {
        await Plain.update({ SearchText: searchTextOf(r.CustomerName, items.filter(i => i.RentalID === r.RentalID)) },
          { where: { RentalID: r.RentalID }, silent: true, hooks: false, transaction });
      }
    });
  }
}

module.exports = { upgrade, fillSearchText, searchTextOf, DEMO_ADDRESS };
