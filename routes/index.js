const express = require('express');
const router = express.Router();
const home = require('../controllers/homeController');
const auth = require('../controllers/authController');
const productRoutes = require('./products');
const rentalRoutes = require('./rentals');

// Trang chủ + liên hệ
router.get('/', home.home);
router.get('/contact', require('../controllers/contactController').form);
router.get('/noi-quy', (req, res) => res.render('home/rules', { title: 'Nội quy thuê đồ' }));
// Trang hỗ trợ khách: cách thức thuê, hỏi đáp, chính sách đổi size
router.get('/cach-thue', (req, res) => res.render('home/how', { title: 'Cách thức thuê đồ' }));
router.get('/hoi-dap', (req, res) => res.render('home/faq', { title: 'Câu hỏi thường gặp' }));
router.get('/doi-size', (req, res) => res.render('home/exchange', { title: 'Chính sách đổi size', SWAP_DAYS: require('../controllers/rentalController').SWAP_DAYS_AFTER_PICKUP }));
router.post('/contact', require('../controllers/contactController').submit);

// Auth
router.get('/login', auth.loginForm);
router.post('/login', auth.login);
router.get('/register', auth.registerForm);
router.post('/register', auth.register);
router.get('/logout', auth.logout);

// Module Trang phục
router.use('/products', productRoutes);

// Tài khoản của tôi (mọi vai trò, cần đăng nhập)
{
  const account = require('../controllers/accountController');
  const { requireLogin } = require('../middlewares/auth');
  router.get('/account', requireLogin, account.show);
  router.post('/account/profile', requireLogin, account.updateProfile);
  router.post('/account/password', requireLogin, account.changePassword);
  // Thông báo của tôi
  const noti = require('../controllers/notificationController');
  router.get('/notifications', requireLogin, noti.index);
  router.post('/notifications/read-all', requireLogin, noti.readAll);
  router.get('/notifications/:id', requireLogin, noti.open);
}

// Yêu thích + đánh giá sản phẩm (cần đăng nhập)
{
  const { requireLogin, requireStaff } = require('../middlewares/auth');
  const fav = require('../controllers/favoriteController');
  const rv = require('../controllers/reviewController');
  const { uploadReviewImages } = require('../middlewares/upload');
  router.get('/favorites', requireLogin, fav.index);
  router.post('/favorites/:id', requireLogin, fav.toggle);
  // Khách chưa đăng nhập bấm tim -> đăng nhập xong quay về trang sản phẩm
  router.get('/favorites/:id', (req, res) => res.redirect(`/products/${parseInt(req.params.id) || ''}`));
  router.post('/products/:id/reviews', requireLogin, uploadReviewImages, rv.save);
  router.post('/reviews/:rid/delete', requireLogin, rv.remove);
  router.post('/reviews/:rid/hide', requireStaff, rv.toggleHide);
}

// Khách liên hệ cần tư vấn: admin + nhân viên (đặt trước router /admin vì router đó chỉ cho admin)
{
  const { requireStaff, requireAdmin } = require('../middlewares/auth');
  const contacts = require('../controllers/contactController');
  router.get('/admin/contacts', requireStaff, contacts.index);
  router.post('/admin/contacts/:id', requireStaff, contacts.update);
  router.post('/admin/contacts/:id/delete', requireAdmin, contacts.remove);
}

// Khu vực quản trị (chỉ admin): thống kê, mã giảm giá, quản lý tài khoản
router.use('/admin', require('./admin'));

// Giỏ thuê (nhiều món / 1 đơn)
router.use('/cart', require('./cart'));

// Module Đơn thuê
router.use('/rentals', rentalRoutes);

module.exports = router;
