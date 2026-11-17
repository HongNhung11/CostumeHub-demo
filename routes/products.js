const express = require('express');
const router = express.Router();
const c = require('../controllers/productController');
const { uploadProductImages, uploadMemory } = require('../middlewares/upload');
const { requireLogin, requireStaff, requireAdmin } = require('../middlewares/auth');

// Cửa hàng - lưới thẻ (ai cũng xem được)
router.get('/', c.index);

// Trang quản lý - bảng 11 chức năng (CHỈ nhân viên/admin)
router.get('/manage', requireStaff, c.manage);

// Export: nhân viên/admin xem được. Import: CHỈ admin (ghi đè dữ liệu)
router.get('/export/:type', requireStaff, c.exportData);
router.post('/import', requireAdmin, uploadMemory.single('file'), c.importData);

// Xóa nhiều: CHỈ admin. Sao chép nhiều: nhân viên/admin
router.post('/delete-many', requireAdmin, c.destroyMany);
router.post('/copy-many', requireStaff, c.copyMany);

// Thêm mới (nhân viên/admin)
router.get('/new', requireStaff, c.createForm);
router.post('/', requireStaff, uploadProductImages, c.create);

// Trang đặt thuê / thanh toán (cần đăng nhập)
router.get('/:id/book', requireLogin, c.bookForm);

// Chi tiết (công khai) / Sửa, Cập nhật (nhân viên) / Xóa 1 (admin)
router.get('/:id/quick', c.quick);   // xem nhanh (khung nhỏ ở trang cửa hàng)
router.get('/:id', c.show);
router.get('/:id/edit', requireStaff, c.editForm);
router.put('/:id', requireStaff, uploadProductImages, c.update);
router.delete('/:id', requireAdmin, c.destroy);

module.exports = router;
