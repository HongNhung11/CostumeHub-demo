const express = require('express');
const router = express.Router();
require('../utils/http').numericParams(router, 'id', 'pid');
const { limits } = require('../middlewares/security');
const c = require('../controllers/rentalController');
const { requireLogin, requireStaff } = require('../middlewares/auth');
const { uploadIDCard, uploadHandover } = require('../middlewares/upload');
const photos = require('../controllers/photoController');

// Khách đặt thuê (phải đăng nhập; có upload ảnh CCCD — lưu ở thư mục riêng tư)
router.post('/', requireLogin, uploadIDCard.single('IDCardImage'), c.create);

// Danh sách đơn (cần đăng nhập)
router.get('/', requireLogin, c.index);
// Nhân viên: việc cần làm hôm nay (đóng đơn, giao, thu hồi, giặt)
router.get('/today', requireStaff, c.today);
router.get('/calendar', requireStaff, require('../controllers/calendarController').index);

// Nhân viên: giao đồ / nhận trả
router.post('/:id/handover', requireStaff, c.handover);
router.post('/:id/ship', requireStaff, c.ship);                // đã đóng đơn, giao shipper (nhập mã vận đơn)
router.get('/:id/slip', requireStaff, c.slip);                 // phiếu đơn để in
// Khách (chủ đơn) hoặc nhân viên: đã nhận đồ / đã gửi trả (kiểm tra quyền trong controller)
router.post('/:id/delivered', requireLogin, c.delivered);
router.post('/:id/sent-back', requireLogin, c.sentBack);
router.get('/:id/qr.png', requireLogin, c.qr);                  // ảnh QR chuyển khoản
router.post('/:id/photos', requireStaff, uploadHandover, photos.upload);
router.get('/:id/photos/:pid', requireLogin, photos.view);
router.get('/:id/pay-state', requireLogin, c.payState);         // trang đơn tự cập nhật khi tiền về
router.post('/:id/cod-collected', requireStaff, c.confirmCod);   // chỉ nhân viên: đã thu tiền COD
router.post('/:id/sent-confirm', requireStaff, c.confirmSent);   // nhân viên chốt ngày khách gửi trả
router.post('/:id/refund-account', requireLogin, limits.reauth, c.setRefundAccount);
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
