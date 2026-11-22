const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ảnh trang phục: công khai (phục vụ qua /uploads)
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
// Ảnh CCCD: RIÊNG TƯ — không nằm trong /public, chỉ xem qua route có kiểm tra quyền
const privateDir = path.join(__dirname, '..', 'private_uploads');
for (const d of [uploadDir, privateDir]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

// Chỉ nhận ảnh; đuôi file lấy theo loại ảnh (không tin đuôi người dùng gửi lên)
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const imageFilter = (req, file, cb) => {
  if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
  const err = new Error('Chỉ chấp nhận file ảnh JPG, PNG, WEBP hoặc GIF.');
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
};
const randomName = (prefix, file) => `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${IMAGE_TYPES[file.mimetype]}`;

const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, randomName('tp', file)),
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Thêm / sửa sản phẩm: 1 ảnh chính ("image") + tối đa 6 ảnh phụ ("gallery")
const MAX_GALLERY = 6;
const productUploader = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, randomName('tp', file)),
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 + MAX_GALLERY },
}).fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: MAX_GALLERY }]);
// Gom lại: req.file = ảnh chính, req.galleryFiles = các ảnh phụ
const uploadProductImages = (req, res, next) => productUploader(req, res, (err) => {
  if (err) return next(err);
  req.file = (req.files && req.files.image && req.files.image[0]) || undefined;
  req.galleryFiles = (req.files && req.files.gallery) || [];
  next();
});

// Ảnh đánh giá của khách: công khai, tối đa 3 ảnh
const uploadReviewImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, randomName('rv', file)),
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
}).array('images', 3);

const uploadIDCard = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, privateDir),
    filename: (req, file, cb) => cb(null, randomName('cccd', file)),
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Ảnh tình trạng đồ lúc giao / nhận lại: riêng tư
const handoverDir = path.join(privateDir, 'handover');
fs.mkdirSync(handoverDir, { recursive: true });
const uploadHandover = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, handoverDir),
    filename: (req, file, cb) => cb(null, randomName('hg', file)),
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
}).array('photos', 10);

// Import dữ liệu (excel/json/xml): giữ trong bộ nhớ, chỉ nhận đúng đuôi
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|xls|csv|json|xml)$/i.test(file.originalname)) return cb(null, true);
    const err = new Error('Chỉ import được file .xlsx, .xls, .csv, .json hoặc .xml.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = { uploadImage, uploadProductImages, uploadReviewImages, MAX_GALLERY, uploadIDCard, uploadMemory, uploadHandover, handoverDir, privateDir, uploadDir };
