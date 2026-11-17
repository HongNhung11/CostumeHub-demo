const express = require('express');
const router = express.Router();
const users = require('../controllers/userController');
const { requireAdmin } = require('../middlewares/auth');

// Toàn bộ khu vực /admin chỉ dành cho ADMIN
router.use(requireAdmin);

// Thống kê: doanh thu theo tháng, đơn theo trạng thái, mẫu thuê nhiều nhất
router.get('/stats', require('../controllers/statsController').index);

// Quản lý tài khoản
// Mã giảm giá
const coupons = require('../controllers/couponController');
router.get('/coupons', coupons.index);
router.post('/coupons', coupons.create);
router.post('/coupons/:id/toggle', coupons.toggle);
router.post('/coupons/:id/delete', coupons.remove);

router.get('/users', users.index);
router.post('/users', users.create);
router.post('/users/:id/role', users.changeRole);
router.post('/users/:id/lock', users.toggleLock);
router.post('/users/:id/password', users.resetPassword);

module.exports = router;
