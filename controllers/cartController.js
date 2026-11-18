// GIỎ THUÊ (lưu trong session): khách chọn nhiều món rồi đặt thuê 1 lần.
// Mỗi dòng = 1 sản phẩm + 1 size + 1 màu; số bộ được kiểm tra theo đúng size × màu đó.
const { Op } = require('sequelize');
const { Product, ProductVariant } = require('../models');
const { productAvailability, checkDates, MAX_RENT_DAYS } = require('../utils/availability');
const { keyOf } = require('../utils/variants');

const getCart = (req) => (req.session.cart ||= []);
const MAX_LINES = 20;
const lineKey = (l) => keyOf(l.productId, l.size, l.color);

// Số bộ shop có của 1 size × màu (0 nếu không có tổ hợp đó)
async function stockOf(productId, size, color) {
  const v = await ProductVariant.findOne({ where: { ProductID: productId, Size: size, Color: color } });
  return v ? v.Quantity : 0;
}

// Nạp sản phẩm cho từng dòng giỏ; bỏ các dòng mà sản phẩm đã bị xóa / ngừng cho thuê / không còn size × màu đó
async function loadCart(req) {
  const cart = getCart(req);
  const ids = [...new Set(cart.map(l => l.productId))];
  const products = ids.length ? await Product.findAll({ where: { ProductID: { [Op.in]: ids } } }) : [];
  const variants = ids.length ? await ProductVariant.findAll({ where: { ProductID: { [Op.in]: ids } } }) : [];
  const byId = Object.fromEntries(products.map(p => [p.ProductID, p]));
  const stock = Object.fromEntries(variants.map(v => [keyOf(v.ProductID, v.Size, v.Color), v.Quantity]));
  const lines = [], removed = [];
  for (const l of cart) {
    const p = byId[l.productId];
    if (p && p.Status === 'Còn trống' && stock[lineKey(l)] > 0) lines.push({ ...l, product: p, stock: stock[lineKey(l)] });
    else removed.push(l);
  }
  if (removed.length) req.session.cart = lines.map(({ product, stock, ...l }) => l);
  return { lines, products: products.filter(p => lines.some(l => l.productId === p.ProductID)), removedCount: removed.length };
}
exports.loadCart = loadCart;

// Tổng số bộ khách cần theo từng size × màu (cùng 1 tổ hợp có thể nằm ở 1 dòng duy nhất, nhưng cứ cộng cho chắc)
function needByVariant(lines) {
  const need = {};
  for (const l of lines) need[lineKey(l)] = (need[lineKey(l)] || 0) + l.qty;
  return need;
}
exports.needByVariant = needByVariant;
exports.lineKey = lineKey;

// ===== Thêm vào giỏ (từ trang chi tiết) =====
exports.add = async (req, res) => {
  const productId = parseInt(req.body.ProductID);
  const back = `/products/${productId}`;
  const product = await Product.findByPk(productId);
  if (!product) { req.flash('error', 'Không tìm thấy sản phẩm.'); return res.redirect('/products'); }
  if (product.Status !== 'Còn trống') { req.flash('error', `Sản phẩm hiện ${product.Status.toLowerCase()}, chưa thể thuê.`); return res.redirect(back); }

  const size = String(req.body.Size || '').trim(), color = String(req.body.Color || '').trim();
  if (!size) { req.flash('error', 'Vui lòng chọn size / kích thước.'); return res.redirect(back); }
  if (!color) { req.flash('error', 'Vui lòng chọn màu.'); return res.redirect(back); }
  const stock = await stockOf(productId, size, color);
  if (!stock) { req.flash('error', `Mẫu này không có size ${size} màu ${color}.`); return res.redirect(back); }

  const qty = parseInt(req.body.Quantity);
  if (!(qty >= 1)) { req.flash('error', 'Số lượng phải từ 1 trở lên.'); return res.redirect(back); }

  const cart = getCart(req);
  const same = cart.find(l => l.productId === productId && l.size === size && l.color === color);
  const inCart = same ? same.qty : 0;
  if (inCart + qty > stock) {
    req.flash('error', `Size ${size} – ${color} không đủ số lượng bạn chọn${inCart ? ` (giỏ đã có ${inCart})` : ''}. Vui lòng giảm số lượng.`);
    return res.redirect(back);
  }

  await Product.increment('CartAdds', { by: 1, where: { ProductID: productId } });   // tính nhãn HOT
  if (same) same.qty += qty;
  else {
    if (cart.length >= MAX_LINES) { req.flash('error', `Giỏ thuê tối đa ${MAX_LINES} dòng.`); return res.redirect(back); }
    cart.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productId, size, color, qty });
  }

  // Mã giảm giá chọn ở trang chi tiết -> nhớ lại để giỏ thuê điền sẵn (khi đặt máy chủ vẫn kiểm tra lại)
  if (req.body.CouponCode !== undefined) {
    const code = String(req.body.CouponCode).trim().toUpperCase().replace(/\s+/g, '').slice(0, 30);
    if (code) req.session.couponCode = code; else delete req.session.couponCode;
  }

  if (req.body.buyNow) return res.redirect('/cart');
  req.flash('success', `Đã thêm "${product.ProductName}" (size ${size} – ${color}) vào giỏ thuê.`);
  res.redirect(back);
};

// ===== Xem giỏ + đặt thuê (thanh toán) =====
exports.view = async (req, res) => {
  const { lines, removedCount } = await loadCart(req);
  if (removedCount) res.locals.error = [`${removedCount} món trong giỏ không còn cho thuê (hoặc không còn size / màu đã chọn) nên đã được bỏ ra.`];
  const old = req.session.checkoutOld || {};
  delete req.session.checkoutOld;
  // Ngày khách đã chọn khi xem lịch trống ở cửa hàng / trang chi tiết -> tự điền
  const saved = req.session.rentDates;
  const rentDates = saved && !checkDates(saved.start, saved.end) ? saved : null;
  // Mã giảm giá đang áp dụng (gợi ý cho khách bấm chọn)
  const { activeCoupons, summary } = require('../utils/coupons');
  const coupons = (await activeCoupons()).map(c => ({ code: c.Code, text: c.Description || summary(c), summary: summary(c) }));
  res.render('cart/index', { title: 'Giỏ thuê & đặt thuê', lines, old, rentDates, MAX_RENT_DAYS, lineKey, coupons, savedCoupon: req.session.couponCode || '' });
};

// ===== Đổi số lượng 1 dòng =====
exports.update = async (req, res) => {
  const cart = getCart(req);
  const line = cart.find(l => l.key === req.params.key);
  if (line) {
    const qty = parseInt(req.body.qty);
    const stock = await stockOf(line.productId, line.size, line.color);
    if (!(qty >= 1)) req.flash('error', 'Số lượng phải từ 1 trở lên.');
    else if (qty > stock) req.flash('error', `Size ${line.size} – ${line.color} không đủ số lượng bạn chọn. Vui lòng giảm số lượng.`);
    else line.qty = qty;
  }
  res.redirect('/cart');
};

// ===== Bỏ 1 dòng khỏi giỏ =====
exports.remove = (req, res) => {
  req.session.cart = getCart(req).filter(l => l.key !== req.params.key);
  res.redirect('/cart');
};

// ===== API: kiểm tra còn trống theo ngày cho từng dòng giỏ (gọi khi khách đổi ngày) =====
exports.availability = async (req, res) => {
  const { start, end } = req.query;
  const err = checkDates(start, end);
  if (err) return res.json({ ok: false, error: err, lines: {} });
  req.session.rentDates = { start, end };   // nhớ ngày khách đang chọn
  const { lines, products } = await loadCart(req);
  const avail = await productAvailability(products, start, end);
  const need = needByVariant(lines);
  const result = {};
  for (const l of lines) {
    const k = lineKey(l);
    const v = avail[l.productId].variants.find(x => x.Size === l.size && x.Color === l.color);
    result[k] = { name: l.product.ProductName, size: l.size, color: l.color, available: v ? v.free : 0, need: need[k] };
  }
  const ok = Object.values(result).every(r => r.need <= r.available);
  res.json({ ok, lines: result });
};

// ===== API: kiểm tra mã giảm giá (khách bấm "Áp dụng" ở giỏ thuê) =====
// Tiền thuê = tổng giá/ngày của giỏ × số ngày đang chọn. Khi đặt, máy chủ kiểm tra lại lần nữa.
exports.coupon = async (req, res) => {
  const { applyCoupon } = require('../utils/coupons');
  const { daysBetween } = require('../utils/dates');
  const { start, end, code } = req.query;
  const err = checkDates(start, end);
  if (err) return res.json({ ok: false, error: err });
  const { lines } = await loadCart(req);
  if (!lines.length) return res.json({ ok: false, error: 'Giỏ thuê đang trống.' });
  const { priceOf } = require('../utils/pricing');
  const rentFee = lines.reduce((s, l) => s + priceOf(l.product) * l.qty, 0) * daysBetween(start, end);
  const r = await applyCoupon(code, req.session.user ? req.session.user.id : null, rentFee);
  if (r.error) return res.json({ ok: false, error: r.error });
  res.json({ ok: true, code: r.coupon.Code, discount: r.discount, rentFee, description: r.coupon.Description || '' });
};
