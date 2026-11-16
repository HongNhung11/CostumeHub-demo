require('dotenv').config();
const express = require('express');
require('express-async-errors');   // lỗi trong hàm async được chuyển tới bộ xử lý lỗi bên dưới (không treo trang)
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const { sequelize } = require('./models');
const routes = require('./routes');
const seed = require('./seed/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(flash());

// Biến dùng chung cho mọi view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.path = req.path;
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
  const userError =
    err instanceof multer.MulterError ? (err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn (tối đa 5MB với ảnh, 10MB với file import).' : 'File tải lên không hợp lệ.')
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
  const rentals = await Rental.findAll({ include: Product });
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

// Khởi động
(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Kết nối CSDL (${sequelize.getDialect()}) thành công.`);
    await sequelize.sync();            // tạo bảng nếu chưa có
    await migrateRentalsToItems();     // chuyển dữ liệu đơn thuê cũ (nếu có)
    await seed();                      // nạp dữ liệu mẫu nếu rỗng
    app.listen(PORT, () => {
      console.log(`🚀 CostumeHub chạy tại: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌ Lỗi khởi động:', e.message);
    process.exit(1);
  }
})();
