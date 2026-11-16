const express = require('express');
const router = express.Router();
const home = require('../controllers/homeController');
const auth = require('../controllers/authController');
const productRoutes = require('./products');
const rentalRoutes = require('./rentals');

// Trang chủ + liên hệ
router.get('/', home.home);
router.get('/contact', home.contact);
router.post('/contact', home.contactSubmit);

// Auth
router.get('/login', auth.loginForm);
router.post('/login', auth.login);
router.get('/register', auth.registerForm);
router.post('/register', auth.register);
router.get('/logout', auth.logout);

// Module Trang phục
router.use('/products', productRoutes);

// Khu vực quản trị (chỉ admin): quản lý tài khoản
router.use('/admin', require('./admin'));

// Giỏ thuê (nhiều món / 1 đơn)
router.use('/cart', require('./cart'));

// Module Đơn thuê
router.use('/rentals', rentalRoutes);

module.exports = router;
