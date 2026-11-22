require('dotenv').config();
require('./utils/secret').ensureSessionSecret();   // không có .env vẫn chạy
const express = require('express');
require('express-async-errors');   // lỗi trong hàm async được chuyển tới bộ xử lý lỗi bên dưới (không treo trang)
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const { sequelize } = require('./models');
const ENV = require('./utils/env');
const security = require('./middlewares/security');
const { DbStore, TTL_MS } = require('./config/sessionStore');
const passwordVersion = require('./utils/passwordVersion');
const { cleanQuery } = require('./utils/http');
const { remember } = require('./utils/device');
const { DEMO_DATA, SANDBOX } = require('./utils/dataKind');

const SECRET = process.env.SESSION_SECRET || '';
if (SECRET.length < 32) {
  console.error('❌ Thiếu SESSION_SECRET (tối thiểu 32 ký tự). Chạy: node scripts/setup-env.js');
  process.exit(1);
}
const routes = require('./routes');
const seed = require('./seed/seed');

const app = express();
app.disable('x-powered-by');
if (ENV.TRUST_PROXY) app.set('trust proxy', ENV.TRUST_PROXY);
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.locals.FEES = require('./utils/fees');   // bảng nội quy trừ phí, dùng trong mọi view
app.locals.colorHex = require('./utils/colors').colorHex;   // chấm màu cạnh tên màu
Object.assign(app.locals, require('./utils/pricing'));   // saleOf / priceOf / salePercent: giá sale trong mọi view
app.locals.IDCARD_KEEP_DAYS = ENV.IDCARD_KEEP_DAYS;
app.locals.SEPAY_ON = ENV.SEPAY.enabled;
app.locals.SANDBOX = SANDBOX;
app.locals.SHOW_DEMO_ACCOUNTS = ENV.SHOW_DEMO_ACCOUNTS;
app.locals.unreadCount = 0;                  // số thông báo chưa đọc (ghi đè cho từng người ở middleware bên dưới)
app.locals.CAT_GROUPS = require('./utils/categories').menuGroups();   // danh mục con trên menu "Danh mục"

// Middlewares
app.use(security.headers);
app.get('/healthz', async (req, res) => {
  try { await sequelize.authenticate(); res.json({ ok: true }); } catch (_) { res.status(503).json({ ok: false }); }
});
app.use('/webhooks', require('./routes/webhooks'));   // trước body parser / session / CSRF
app.use(express.static(path.join(__dirname, 'public')));
app.use(security.csrf);
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(methodOverride('_method'));
app.use(cleanQuery);
const store = new DbStore();
app.use(session({
  name: 'ch.sid',
  secret: SECRET,
  store,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: TTL_MS },
}));
app.use(flash());

// Đồng bộ tài khoản đang đăng nhập với CSDL: bị khóa / bị xóa -> đăng xuất ngay; đổi vai trò -> có hiệu lực ngay
app.use(async (req, res, next) => {
  const su = req.session.user;
  if (!su) return next();
  const { User } = require('./models');
  const u = await User.findByPk(su.id, { attributes: ['id', 'username', 'password', 'fullName', 'role', 'isActive'] });
  if (!u || u.isActive === false) {
    delete req.session.user;
    req.session.cart = [];
    req.flash('error', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ cửa hàng.');
    return res.redirect('/login');
  }
  // Đổi / đặt lại mật khẩu -> mọi phiên cũ bị đăng xuất
  if (su.pv !== passwordVersion(u.password)) {
    delete req.session.user;
    req.flash('error', 'Mật khẩu đã thay đổi, vui lòng đăng nhập lại.');
    return res.redirect('/login');
  }
  req.session.user = { id: u.id, username: u.username, fullName: u.fullName, role: u.role, pv: su.pv };
  remember(req, res, u.username);   // máy đang đăng nhập đúng = máy quen
  next();
});

// Thông báo: tự hủy đơn chờ cọc quá hạn (tối đa 1 lần / phút), tạo lời nhắc cho khách (1 lần / 5 phút / phiên),
// đếm thông báo chưa đọc cho chuông trên menu
{
  const { expirePending, remindersFor } = require('./utils/notify');
  let lastExpire = 0;
  app.use(async (req, res, next) => {
    if (Date.now() - lastExpire > 60e3) { lastExpire = Date.now(); await expirePending(); }
    res.locals.unreadCount = 0;
    const u = req.session.user;
    if (u) {
      if (!req.session.remindAt || Date.now() - req.session.remindAt > 5 * 60e3) {
        req.session.remindAt = Date.now();
        await remindersFor(u.id);
      }
      const { Notification } = require('./models');
      res.locals.unreadCount = await Notification.count({ where: { UserID: u.id, isRead: false } });
      // Admin / nhân viên: số khách liên hệ mới chưa tư vấn (badge trên menu "Liên hệ")
      if (u.role === 'admin' || u.role === 'nhanvien') res.locals.newContacts = await require('./controllers/contactController').countNew();
    }
    next();
  });
}

// Biến dùng chung cho mọi view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  // chỉ đọc khi thật sự có: req.flash() tự tạo session cho mọi khách / bot ghé qua
  const flashed = req.session.flash || {};
  res.locals.success = flashed.success?.length ? req.flash('success') : [];
  res.locals.error = flashed.error?.length ? req.flash('error') : [];
  res.locals.path = req.path;
  res.locals.SHIP = require('./utils/shipping');
  res.locals.FLOW = require('./utils/rentalFlow');   // trạng thái đơn, thanh toán, giao — nhận (dùng trong view)   // khu vực giao + số ngày vận chuyển (dùng trong view)
  res.locals.reqUrl = req.originalUrl;   // để form (VD thả tim) quay lại đúng trang đang xem
  res.locals.cartCount = (req.session.cart || []).reduce((s, l) => s + l.qty, 0);
  next();
});

app.use('/', routes);

// 404
app.use((req, res) => res.status(404).render('404', { title: 'Không tìm thấy trang' }));

// Bộ xử lý lỗi chung: báo lỗi dễ hiểu, không lộ chi tiết kỹ thuật cho người dùng
const multer = require('multer');
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'SequelizeOptimisticLockError') {
    req.flash('error', 'Đơn vừa được cập nhật bởi thao tác khác (VD tiền vừa về). Vui lòng xem lại rồi thao tác tiếp.');
    const id = req.originalUrl.match(/^\/rentals\/(\d+)/);
    return res.redirect(id ? '/rentals/' + id[1] : '/rentals');
  }
  // lớp chặn cuối: giá trị không phải số / quá lớn lọt xuống CSDL
  if (err.name === 'SequelizeDatabaseError' && ['22P02', '22003'].includes(err.parent?.code) && !res.headersSent) {
    return res.status(404).render('404', { title: 'Không tìm thấy' });
  }
  if (err.type === 'entity.too.large') return res.status(413).type('text/plain').send('Dữ liệu gửi lên quá lớn.');
  if (err.type === 'entity.parse.failed') return res.status(400).type('text/plain').send('Dữ liệu gửi lên không hợp lệ.');
  const userError =
    err instanceof multer.MulterError ? (err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn (tối đa 5MB với ảnh, 8MB với ảnh tình trạng đồ, 10MB với file import).'
      : ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(err.code) ? 'Chọn quá nhiều ảnh (sản phẩm: tối đa 6 ảnh phụ · đánh giá: tối đa 3 ảnh).' : 'File tải lên không hợp lệ.')
    : err.code === 'INVALID_FILE_TYPE' ? err.message
    : null;

  if (userError) {
    // Quay lại trang trước (cùng trang web) và hiện thông báo
    const ref = req.get('Referer') || '';
    let back = '/';
    try { const u = new URL(ref); if (u.host === req.get('host')) back = u.pathname + u.search; } catch (_) {}
    req.flash('error', userError);
    return res.redirect(back);
  }

  console.error(`❌ Lỗi ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500);
  if (req.accepts(['html', 'json']) === 'json') return res.json({ ok: false, error: 'Lỗi máy chủ' });
  res.render('500', { title: 'Có lỗi xảy ra' });
});

// Chuyển CSDL cũ (mỗi đơn 1 sản phẩm, trừ tồn kho khi đặt) sang cách mới
// (đơn nhiều món + tính chỗ trống theo ngày). Chỉ chạy 1 lần: khi bảng RentalItems còn trống.
async function migrateRentalsToItems() {
  const { Rental, RentalItem, Product } = require('./models');
  const { ACTIVE } = require('./utils/availability');
  if (await RentalItem.count() > 0) return;
  const rentals = await Rental.unscoped().findAll({ include: Product });
  if (!rentals.length) return;
  await sequelize.transaction(async (t) => {
    for (const r of rentals) {
      const p = r.Product;
      const qty = r.Quantity || 1;
      await RentalItem.create({
        RentalID: r.RentalID, ProductID: r.ProductID,
        ProductName: p ? p.ProductName : `Sản phẩm #${r.ProductID}`,
        Quantity: qty,
        PricePerDay: r.PricePerDay,
        DepositPerUnit: Math.round(Number(r.Deposit) / qty),
        LateFeePerDay: p ? p.LateFeePerDay : 0,
      }, { transaction: t });
      // Cách cũ đã trừ tồn kho cho đơn đang hoạt động -> cộng lại (Quantity giờ là TỔNG số bộ)
      if (p && ACTIVE.includes(r.Status)) {
        p.Quantity += qty;
        if (p.Status === 'Đang cho thuê') p.Status = 'Còn trống';
        await p.save({ transaction: t });
      }
    }
  });
  console.log(`🔁 Đã chuyển ${rentals.length} đơn thuê cũ sang dạng nhiều món / lịch theo ngày.`);
}

// Bổ sung cột mới cho bảng đã có (sync() không tự thêm cột) + chuyển trạng thái SP cũ
async function migrateSchema() {
  const { User, Product, Rental, Notification } = require('./models');
  const { LEGACY_STATUS } = require('./utils/constants');
  const qi = sequelize.getQueryInterface();
  const users = await qi.describeTable('Users');
  if (!users.isActive) {
    await qi.addColumn('Users', 'isActive', { type: User.rawAttributes.isActive.type, defaultValue: true });
    await User.update({ isActive: true }, { where: {}, hooks: false });
  }
  // Các cột mới khác (đều cho phép trống)
  const NEW_COLUMNS = { Products: [Product, ['ProductValue', 'SizeChart', 'Material', 'Style', 'Length', 'Occasion', 'CareGuide', 'CartAdds', 'SalePrice', 'SaleEnd']], Rentals: [Rental, ['DamageDetails', 'TermsAcceptedAt', 'CouponCode', 'Discount', 'DepositPaidAt', 'CustomerAddress', 'DeliveryZone', 'ShipDays', 'Carrier', 'TrackingCode', 'ShippedAt', 'ReturnTrackingCode', 'ReturnSentDate', 'TransferClaimedAt', 'PayCode', 'PaidVia', 'IDCardDeletedAt', 'BundleName', 'BundleDiscount']], Users: [User, ['phone', 'email', 'address', 'ResetHash', 'ResetExpires']], Notifications: [Notification, ['EmailedAt', 'EmailTries']] };
  const added = [];
  const rentalCols = await qi.describeTable('Rentals');
  if (!rentalCols.version) await qi.addColumn('Rentals', 'version', { type: require('sequelize').INTEGER, allowNull: false, defaultValue: 0 });
  for (const [table, [model, cols]] of Object.entries(NEW_COLUMNS)) {
    const desc = await qi.describeTable(table);
    for (const c of cols) if (!desc[c]) { await qi.addColumn(table, c, { type: model.rawAttributes[c].type, allowNull: true }); added.push(c); }
  }
  const indexes = await qi.showIndex('Rentals');
  if (!indexes.some(i => i.name === 'rentals_pay_code')) await qi.addIndex('Rentals', ['PayCode'], { name: 'rentals_pay_code', unique: true });
  // Vừa thêm cột thông tin chi tiết -> điền gợi ý từ tên / mô tả (nhân viên sửa lại sau)
  if (added.includes('Material')) {
    const { guessDetails } = require('./utils/details');
    const list = await Product.findAll();
    for (const p of list) await p.update(guessDetails(p), { silent: true });
    if (list.length) console.log(`📝 Đã thêm thông tin chi tiết gợi ý cho ${list.length} sản phẩm.`);
  }
  // Vừa thêm cột bảng số đo -> điền số đo tham khảo cho áo dài / váy tiệc có size chữ (S, M, L...); nhân viên sửa lại sau
  if (added.includes('SizeChart')) {
    const { standardChart } = require('./utils/sizeChart');
    let n = 0;
    for (const p of await Product.findAll({ where: { ProductType: ['Áo dài', 'Váy tiệc'] } })) {
      const chart = standardChart(p.Size);
      if (chart) { await p.update({ SizeChart: chart }, { silent: true }); n++; }
    }
    if (n) console.log(`📏 Đã thêm bảng số đo tham khảo cho ${n} sản phẩm.`);
  }
  // Trạng thái SP cũ: "Đang cho thuê" -> "Còn trống", "Chờ xử lý" -> "Ngừng cho thuê"
  for (const [oldS, newS] of Object.entries(LEGACY_STATUS)) {
    const [n] = await Product.update({ Status: newS }, { where: { Status: oldS }, silent: true });
    if (n) console.log(`🔁 Đổi ${n} sản phẩm từ "${oldS}" sang "${newS}".`);
  }
}

// Tạo số lượng theo SIZE × MÀU cho sản phẩm chưa có (dữ liệu cũ / dữ liệu mẫu vừa nạp):
// chia đều tổng số bộ hiện có cho các tổ hợp size × màu (nhân viên sửa lại cho đúng sau).
// Các món trong đơn cũ chưa ghi size/màu -> gán vào tổ hợp có nhiều bộ nhất của mẫu đó.
async function migrateVariants() {
  const { Product, ProductVariant, RentalItem } = require('./models');
  const { splitQuantity, sizesOf, colorsOf, saveVariants } = require('./utils/variants');
  const { Op } = require('sequelize');
  const products = await Product.findAll({ include: [{ model: ProductVariant, as: 'variants' }] });
  let n = 0;
  await sequelize.transaction(async (t) => {
    for (const p of products) {
      if (p.variants.length) continue;
      if (!sizesOf(p).length) p.Size = 'Free size';
      if (!colorsOf(p).length) p.Color = 'Một màu';
      await saveVariants(p, splitQuantity(p.Quantity || 0, sizesOf(p), colorsOf(p)), { transaction: t });
      if (p.changed()) await p.save({ transaction: t });
      n++;
    }
    const orphan = await RentalItem.findAll({ where: { [Op.or]: [{ Size: null }, { Color: null }], ProductID: { [Op.ne]: null } }, transaction: t });
    for (const it of orphan) {
      const v = await ProductVariant.findOne({ where: { ProductID: it.ProductID }, order: [['Quantity', 'DESC']], transaction: t });
      if (v) { it.Size = it.Size || v.Size; it.Color = it.Color || v.Color; await it.save({ transaction: t }); }
    }
  });
  if (n) console.log(`🔁 Đã tạo số lượng theo size × màu cho ${n} sản phẩm.`);
}

// Tiền thật mà admin / nhân viên còn mật khẩu mẫu (có trong README) -> không bật chuyển khoản:
// ai cũng đăng nhập được rồi tự bấm "Xác nhận tay" hoặc ghi sổ hoàn tiền.
async function guardLivePayments() {
  if (ENV.SEPAY.mode !== 'live' || !ENV.SEPAY.enabled) return;
  const { User } = require('./models');
  const weak = [];
  for (const u of await User.findAll({ where: { role: ['admin', 'nhanvien'], isActive: true } })) {
    if (await u.checkPassword('admin123') || await u.checkPassword('123456')) weak.push(u.username);
  }
  if (!weak.length) return;
  ENV.SEPAY.enabled = false;
  ENV.SEPAY.problems.push(`Đổi mật khẩu mẫu của "${weak.join('", "')}" rồi khởi động lại mới bật được tiền thật`);
  app.locals.SEPAY_ON = false;
}

// Khởi động
(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Kết nối CSDL (${sequelize.getDialect()}) thành công.`);
    await sequelize.sync();            // tạo bảng nếu chưa có
    await require('./utils/migrate').upgrade();   // trước migrateSchema: các model đã đọc cột mới
    await migrateSchema();             // thêm cột mới, chuyển trạng thái SP cũ
    await migrateRentalsToItems();     // chuyển dữ liệu đơn thuê cũ (nếu có)
    await seed();                      // nạp dữ liệu mẫu nếu rỗng
    await migrateVariants();           // số lượng theo size × màu cho SP chưa có
    await require('./utils/migrate').fillSearchText();
    await guardLivePayments();
    require('./utils/jobs').start({ store });
    if (ENV.SEPAY.enabled) console.log(`💳 SePay: ${ENV.SEPAY.mode} · webhook ${ENV.SEPAY.secret ? 'bật' : 'tắt'} · đối soát ${ENV.SEPAY.token ? 'bật' : 'tắt'}`);
    else console.log('💳 Chuyển khoản đang TẮT: ' + ENV.SEPAY.problems.join('; '));
    if (DEMO_DATA && ENV.SEPAY.mode === 'live') console.log('⚠️  DEMO_DATA=true trong khi nhận tiền thật: đơn mẫu vẫn chiếm lịch và vào thống kê.');
    app.listen(PORT, () => {
      console.log(`🚀 CostumeHub chạy tại: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌ Lỗi khởi động:', e.message);
    process.exit(1);
  }
})();
