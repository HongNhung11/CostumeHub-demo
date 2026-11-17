// GIỎ HÀNG (lưu trong session): khách chọn nhiều món rồi đặt thuê 1 lần
const { Op } = require('sequelize');
const { Product } = require('../models');
const { splitList } = require('../utils/text');
const { availableMap, checkDates, MAX_RENT_DAYS } = require('../utils/availability');

const getCart = (req) => (req.session.cart ||= []);
const MAX_LINES = 20;

// Nạp sản phẩm cho từng dòng giỏ; bỏ các dòng mà sản phẩm đã bị xóa / ngừng cho thuê
async function loadCart(req) {
  const cart = getCart(req);
  const products = cart.length
    ? await Product.findAll({ where: { ProductID: { [Op.in]: cart.map(l => l.productId) } } })
    : [];
  const byId = Object.fromEntries(products.map(p => [p.ProductID, p]));
  const lines = [], removed = [];
  for (const l of cart) {
    const p = byId[l.productId];
    if (p && p.Status === 'Còn trống') lines.push({ ...l, product: p });
    else removed.push(l);
  }
  if (removed.length) req.session.cart = lines.map(({ product, ...l }) => l);
  return { lines, products, removedCount: removed.length };
}
exports.loadCart = loadCart;

// Tổng số lượng mỗi sản phẩm trong giỏ (1 SP có thể nằm ở nhiều dòng khác size/màu)
function needByProduct(lines) {
  const need = {};
  for (const l of lines) need[l.productId] = (need[l.productId] || 0) + l.qty;
  return need;
}
exports.needByProduct = needByProduct;

// ===== Thêm vào giỏ (từ trang chi tiết) =====
exports.add = async (req, res) => {
  const productId = parseInt(req.body.ProductID);
  const back = `/products/${productId}`;
  const product = await Product.findByPk(productId);
  if (!product) { req.flash('error', 'Không tìm thấy sản phẩm.'); return res.redirect('/products'); }
  if (product.Status !== 'Còn trống') { req.flash('error', `Sản phẩm hiện ${product.Status.toLowerCase()}, chưa thể thuê.`); return res.redirect(back); }

  const size = String(req.body.Size || '').trim(), color = String(req.body.Color || '').trim();
  const sizes = splitList(product.Size), colors = splitList(product.Color);
  if (sizes.length && !sizes.includes(size)) { req.flash('error', 'Vui lòng chọn size.'); return res.redirect(back); }
  if (colors.length && !colors.includes(color)) { req.flash('error', 'Vui lòng chọn màu.'); return res.redirect(back); }

  const qty = parseInt(req.body.Quantity);
  if (!(qty >= 1)) { req.flash('error', 'Số lượng phải từ 1 trở lên.'); return res.redirect(back); }

  const cart = getCart(req);
  const inCart = cart.filter(l => l.productId === productId).reduce((s, l) => s + l.qty, 0);
  if (inCart + qty > product.Quantity) {
    req.flash('error', `Cửa hàng chỉ có ${product.Quantity} ${product.Unit} mẫu này (giỏ đã có ${inCart}).`);
    return res.redirect(back);
  }

  const same = cart.find(l => l.productId === productId && l.size === size && l.color === color);
  if (same) same.qty += qty;
  else {
    if (cart.length >= MAX_LINES) { req.flash('error', `Giỏ hàng tối đa ${MAX_LINES} dòng.`); return res.redirect(back); }
    cart.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productId, size, color, qty });
  }

  if (req.body.buyNow) return res.redirect('/cart');
  req.flash('success', `Đã thêm "${product.ProductName}" vào giỏ thuê.`);
  res.redirect(back);
};

// ===== Xem giỏ + đặt thuê (thanh toán) =====
exports.view = async (req, res) => {
  const { lines, removedCount } = await loadCart(req);
  if (removedCount) res.locals.error = [`${removedCount} món trong giỏ không còn cho thuê nên đã được bỏ ra.`];
  const old = req.session.checkoutOld || {};
  delete req.session.checkoutOld;
  // Ngày khách đã chọn khi xem lịch trống ở cửa hàng / trang chi tiết -> tự điền
  const saved = req.session.rentDates;
  const rentDates = saved && !checkDates(saved.start, saved.end) ? saved : null;
  res.render('cart/index', { title: 'Giỏ thuê & đặt thuê', lines, old, rentDates, MAX_RENT_DAYS });
};

// ===== Đổi số lượng 1 dòng =====
exports.update = async (req, res) => {
  const cart = getCart(req);
  const line = cart.find(l => l.key === req.params.key);
  if (line) {
    const qty = parseInt(req.body.qty);
    const product = await Product.findByPk(line.productId);
    const others = cart.filter(l => l !== line && l.productId === line.productId).reduce((s, l) => s + l.qty, 0);
    if (!(qty >= 1)) req.flash('error', 'Số lượng phải từ 1 trở lên.');
    else if (product && qty + others > product.Quantity) req.flash('error', `Cửa hàng chỉ có ${product.Quantity} ${product.Unit} mẫu "${product.ProductName}".`);
    else line.qty = qty;
  }
  res.redirect('/cart');
};

// ===== Bỏ 1 dòng khỏi giỏ =====
exports.remove = (req, res) => {
  req.session.cart = getCart(req).filter(l => l.key !== req.params.key);
  res.redirect('/cart');
};

// ===== API: kiểm tra còn trống theo ngày cho cả giỏ (gọi khi khách đổi ngày) =====
exports.availability = async (req, res) => {
  const { start, end } = req.query;
  const err = checkDates(start, end);
  if (err) return res.json({ ok: false, error: err, products: {} });
  req.session.rentDates = { start, end };   // nhớ ngày khách đang chọn
  const { lines, products } = await loadCart(req);
  const avail = await availableMap(products, start, end);
  const need = needByProduct(lines);
  const result = {};
  for (const p of products) {
    result[p.ProductID] = { name: p.ProductName, available: avail[p.ProductID], need: need[p.ProductID] || 0 };
  }
  const ok = Object.values(result).every(r => r.need <= r.available);
  res.json({ ok, products: result });
};
