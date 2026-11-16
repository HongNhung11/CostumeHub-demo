const express = require('express');
const router = express.Router();
const c = require('../controllers/rentalController');
const { requireLogin, requireStaff } = require('../middlewares/auth');
const { uploadImage } = require('../middlewares/upload');

// Khách đặt thuê (phải đăng nhập; có upload ảnh CCCD)
router.post('/', requireLogin, uploadImage.single('IDCardImage'), c.create);

// Danh sách đơn (cần đăng nhập)
router.get('/', requireLogin, c.index);

// Nhân viên: giao đồ / nhận trả
router.post('/:id/handover', requireStaff, c.handover);
router.get('/:id/return', requireStaff, c.returnForm);
router.post('/:id/return', requireStaff, c.receiveReturn);

// Xem đơn / hủy (đặt đã bao gồm cọc nên không có bước thanh toán riêng)
router.get('/:id', c.show);
router.post('/:id/cancel', c.cancel);

module.exports = router;
