const express = require('express');
const router = express.Router();
const c = require('../controllers/cartController');
const { requireLogin } = require('../middlewares/auth');

// Thêm vào giỏ: khách vãng lai cũng thêm được (giỏ giữ nguyên sau khi đăng nhập)
router.post('/add', c.add);

// Xem giỏ + đặt thuê: cần đăng nhập (đăng nhập xong quay lại /cart)
router.get('/', requireLogin, c.view);
router.get('/availability', c.availability);
router.post('/:key/update', c.update);
router.post('/:key/remove', c.remove);

module.exports = router;
