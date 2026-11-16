require('dotenv').config();
const express = require('express');
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
  next();
});

app.use('/', routes);

// 404
app.use((req, res) => res.status(404).render('404', { title: 'Không tìm thấy trang' }));

// sync() không thêm cột vào bảng đã tồn tại -> tự thêm các cột mới (không mất dữ liệu)
async function addMissingColumns() {
  const qi = sequelize.getQueryInterface();
  const { Rental } = require('./models');
  const table = await qi.describeTable('Rentals');
  for (const name of ['SelectedSize', 'SelectedColor']) {
    if (!table[name]) await qi.addColumn('Rentals', name, Rental.rawAttributes[name].type);
  }
}

// Khởi động
(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Kết nối CSDL (${sequelize.getDialect()}) thành công.`);
    await sequelize.sync();            // tạo bảng nếu chưa có
    await addMissingColumns();         // bổ sung cột mới cho CSDL đã tạo từ trước
    await seed();                      // nạp dữ liệu mẫu nếu rỗng
    app.listen(PORT, () => {
      console.log(`🚀 CostumeHub chạy tại: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌ Lỗi khởi động:', e.message);
    process.exit(1);
  }
})();
