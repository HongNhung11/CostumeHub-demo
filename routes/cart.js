const express = require('express');
const router = express.Router();
const c = require('../controllers/cartController');
const { requireLogin } = require('../middlewares/auth');

// Thêm vào giỏ: khách vãng lai cũng thêm được (giỏ giữ nguyên sau khi đăng nhập)
router.post('/add', c.add);

// Xem giỏ: ai cũng xem được; form đặt thuê chỉ hiện khi đã đăng nhập (POST /rentals vẫn bắt đăng nhập)
router.get('/', c.view);
// Bước 2: đặt thuê & giao nhận (cần đăng nhập; đăng nhập xong quay lại đây)
router.get('/checkout', requireLogin, c.checkout);
router.get('/availability', c.availability);
router.get('/coupon', requireLogin, c.coupon);
router.post('/select', c.select);
router.post('/:key/update', c.update);
router.post('/:key/remove', c.remove);

module.exports = router;
