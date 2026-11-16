const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Lưu ảnh trang phục ra ổ đĩa
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'tp_' + Date.now() + '_' + Math.round(Math.random() * 1e4) + ext);
  },
});
const uploadImage = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Giữ file import trong bộ nhớ (excel/json/xml)
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadImage, uploadMemory };
