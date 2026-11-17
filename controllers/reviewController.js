// ĐÁNH GIÁ SẢN PHẨM (có ảnh)
// - Chỉ khách đã thuê xong (đơn "Hoàn tất" có mẫu này) mới đánh giá được; mỗi khách 1 đánh giá / mẫu.
// - Khách sửa lại hoặc xóa đánh giá của mình; nhân viên ẩn / hiện hoặc xóa đánh giá không phù hợp.
const fs = require('fs');
const path = require('path');
const { Review, Product } = require('../models');
const { uploadDir } = require('../middlewares/upload');
const { FIT_NOTES } = require('../utils/reviews');
const { lastCompletedItem } = require('./productController');

const isStaff = (u) => u && (u.role === 'admin' || u.role === 'nhanvien');
const removeFiles = (files) => (files || []).forEach(f => f && f.path && fs.unlink(f.path, () => {}));
const unlinkImages = (list) => list.forEach(p => { if (p && p.startsWith('/uploads/')) fs.unlink(path.join(uploadDir, path.basename(p)), () => {}); });
const back = (id) => `/products/${id}#reviews`;

// Thêm / sửa đánh giá của chính mình
exports.save = async (req, res) => {
  const productId = parseInt(req.params.id);
  const u = req.session.user;
  const fail = (msg) => { removeFiles(req.files); req.flash('error', msg); return res.redirect(back(productId)); };

  const product = await Product.findByPk(productId);
  if (!product) return fail('Không tìm thấy sản phẩm.');
  const rating = parseInt(req.body.Rating);
  if (!(rating >= 1 && rating <= 5)) return fail('Vui lòng chọn số sao (1 – 5).');
  const comment = String(req.body.Comment || '').trim();
  if (comment.length < 10) return fail('Nội dung đánh giá cần ít nhất 10 ký tự.');
  if (comment.length > 1000) return fail('Nội dung đánh giá tối đa 1000 ký tự.');
  const fit = FIT_NOTES.includes(req.body.FitNote) ? req.body.FitNote : null;

  let review = await Review.findOne({ where: { ProductID: productId, UserID: u.id } });
  const item = await lastCompletedItem(u.id, productId);
  if (!review && !item) return fail('Bạn chỉ có thể đánh giá sau khi đã thuê và trả mẫu này (đơn hoàn tất).');

  // Ảnh: giữ ảnh cũ không bị tick xóa + ảnh mới, tối đa 3
  const old = review ? review.imageList() : [];
  const drop = new Set([].concat(req.body.removeImages || []));
  const keep = old.filter(p => !drop.has(p));
  const added = (req.files || []).map(f => '/uploads/' + f.filename);
  if (keep.length + added.length > 3) return fail(`Tối đa 3 ảnh cho mỗi đánh giá (đang giữ ${keep.length}, chọn thêm ${added.length}).`);

  const data = {
    Rating: rating, Comment: comment, FitNote: fit,
    Images: JSON.stringify([...keep, ...added]),
  };
  if (review) await review.update(data);
  else {
    review = await Review.create({
      ...data, ProductID: productId, UserID: u.id, RentalID: item.RentalID,
      SizeWorn: [item.Size, item.Color].filter(Boolean).join(' · ') || null,
    });
  }
  unlinkImages(old.filter(p => drop.has(p)));
  req.flash('success', 'Cảm ơn bạn đã đánh giá! Đánh giá giúp khách sau chọn size và mẫu dễ hơn.');
  res.redirect(back(productId));
};

// Xóa: chủ đánh giá hoặc nhân viên
exports.remove = async (req, res) => {
  const r = await Review.findByPk(req.params.rid);
  if (!r) { req.flash('error', 'Không tìm thấy đánh giá.'); return res.redirect('/products'); }
  const u = req.session.user;
  if (r.UserID !== u.id && !isStaff(u)) { req.flash('error', 'Bạn không có quyền xóa đánh giá này.'); return res.redirect(back(r.ProductID)); }
  const imgs = r.imageList();
  await r.destroy();
  unlinkImages(imgs);
  req.flash('success', 'Đã xóa đánh giá.');
  res.redirect(back(r.ProductID));
};

// Nhân viên: ẩn / hiện đánh giá
exports.toggleHide = async (req, res) => {
  const r = await Review.findByPk(req.params.rid);
  if (!r) { req.flash('error', 'Không tìm thấy đánh giá.'); return res.redirect('/products'); }
  r.isHidden = !r.isHidden;
  await r.save();
  req.flash('success', r.isHidden ? 'Đã ẩn đánh giá (khách không còn thấy).' : 'Đã hiện lại đánh giá.');
  res.redirect(back(r.ProductID));
};
