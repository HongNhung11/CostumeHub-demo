const express = require('express');
const router = express.Router();
require('../utils/http').numericParams(router, 'id');
const users = require('../controllers/userController');
const { requireAdmin } = require('../middlewares/auth');

// Toàn bộ khu vực /admin chỉ dành cho ADMIN
router.use(requireAdmin);

// Thống kê: doanh thu theo tháng, đơn theo trạng thái, mẫu thuê nhiều nhất
router.get('/stats', require('../controllers/statsController').index);

router.get('/audit', require('../controllers/auditController').index);

// Quản lý tài khoản
// Mã giảm giá
const coupons = require('../controllers/couponController');
router.get('/coupons', coupons.index);
router.post('/coupons', coupons.create);
router.post('/coupons/:id/toggle', coupons.toggle);
router.post('/coupons/:id/delete', coupons.remove);

const bundles = require('../controllers/bundleController');
router.get('/bundles', bundles.manage);
router.post('/bundles', bundles.create);
router.post('/bundles/:id/toggle', bundles.toggle);
router.post('/bundles/:id/delete', bundles.remove);

router.get('/users', users.index);
router.post('/users', users.create);
router.post('/users/:id/role', users.changeRole);
router.post('/users/:id/lock', users.toggleLock);
router.post('/users/:id/password', users.resetPassword);

module.exports = router;
