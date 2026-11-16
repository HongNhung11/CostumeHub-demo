const express = require('express');
const router = express.Router();
const users = require('../controllers/userController');
const { requireAdmin } = require('../middlewares/auth');

// Toàn bộ khu vực /admin chỉ dành cho ADMIN
router.use(requireAdmin);

// Quản lý tài khoản
router.get('/users', users.index);
router.post('/users', users.create);
router.post('/users/:id/role', users.changeRole);
router.post('/users/:id/lock', users.toggleLock);
router.post('/users/:id/password', users.resetPassword);

module.exports = router;
