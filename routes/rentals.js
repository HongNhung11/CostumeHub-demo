const express = require('express');
const router = express.Router();
const c = require('../controllers/rentalController');
const { requireLogin, requireStaff } = require('../middlewares/auth');
const { uploadIDCard } = require('../middlewares/upload');

// Khách đặt thuê (phải đăng nhập; có upload ảnh CCCD — lưu ở thư mục riêng tư)
router.post('/', requireLogin, uploadIDCard.single('IDCardImage'), c.create);

// Danh sách đơn (cần đăng nhập)
router.get('/', requireLogin, c.index);

// Nhân viên: giao đồ / nhận trả
router.post('/:id/handover', requireStaff, c.handover);
router.post('/:id/deposit', requireStaff, c.confirmDeposit);   // xác nhận đã nhận cọc (Chờ cọc -> Đã cọc)
router.get('/:id/return', requireStaff, c.returnForm);
router.post('/:id/return', requireStaff, c.receiveReturn);

// Xem đơn / ảnh CCCD / hủy: chỉ CHỦ ĐƠN hoặc NHÂN VIÊN (kiểm tra trong controller)
router.get('/:id', requireLogin, c.show);
router.get('/:id/cccd', requireLogin, c.idCardImage);
router.post('/:id/cancel', requireLogin, c.cancel);
// Đổi size / màu của 1 món (chính sách đổi size — kiểm tra quyền và thời hạn trong controller)
router.post('/:id/size', requireLogin, c.changeSize);

module.exports = router;
