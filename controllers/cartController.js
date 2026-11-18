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
// opts.selectedOnly: chỉ lấy các món khách đánh dấu để đặt (dòng có off = true là đang bỏ chọn)
async function loadCart(req, opts = {}) {
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
  const picked = opts.selectedOnly ? lines.filter(l => !l.off) : lines;
  return { lines: picked, products: products.filter(p => picked.some(l => l.productId === p.ProductID)), removedCount: removed.length };
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
  // Trang chi tiết / xem nhanh gọi bằng fetch (không tải lại trang) -> trả JSON để hiện khung "Đã thêm vào giỏ"
  const wantsJson = req.get('X-Requested-With') === 'fetch' && !req.body.buyNow;
  const fail = (msg, to = back) => {
    if (wantsJson) return res.json({ ok: false, error: msg });
    req.flash('error', msg); return res.redirect(to);
  };
  const product = await Product.findByPk(productId);
  if (!product) return fail('Không tìm thấy sản phẩm.', '/products');
  if (product.Status !== 'Còn trống') return fail(`Sản phẩm hiện ${product.Status.toLowerCase()}, chưa thể thuê.`);

  const size = String(req.body.Size || '').trim(), color = String(req.body.Color || '').trim();
  if (!size) return fail('Vui lòng chọn size / kích thước.');
  if (!color) return fail('Vui lòng chọn màu.');
  const stock = await stockOf(productId, size, color);
  if (!stock) return fail(`Mẫu này không có size ${size} màu ${color}.`);

  const qty = parseInt(req.body.Quantity);
  if (!(qty >= 1)) return fail('Số lượng phải từ 1 trở lên.');

  const cart = getCart(req);
  const same = cart.find(l => l.productId === productId && l.size === size && l.color === color);
  const inCart = same ? same.qty : 0;
  if (inCart + qty > stock) return fail(`Size ${size} – ${color} không đủ số lượng bạn chọn${inCart ? ` (giỏ đã có ${inCart})` : ''}. Vui lòng giảm số lượng.`);
  if (!same && cart.length >= MAX_LINES) return fail(`Giỏ thuê tối đa ${MAX_LINES} dòng.`);

  await Product.increment('CartAdds', { by: 1, where: { ProductID: productId } });   // tính nhãn HOT
  if (same) same.qty += qty;
  else cart.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productId, size, color, qty });

  // Mã giảm giá chọn ở trang chi tiết -> nhớ lại để giỏ thuê điền sẵn (khi đặt máy chủ vẫn kiểm tra lại)
  if (req.body.CouponCode !== undefined) {
    const code = String(req.body.CouponCode).trim().toUpperCase().replace(/\s+/g, '').slice(0, 30);
    if (code) req.session.couponCode = code; else delete req.session.couponCode;
  }

  if (req.body.buyNow) {
    // Thuê ngay: chỉ đặt món vừa chọn, các món khác vẫn nằm trong giỏ nhưng bỏ chọn
    for (const l of cart) l.off = !(l.productId === productId && l.size === size && l.color === color);
    // Thuê ngay khi chưa đăng nhập: đồ đã vào giỏ -> đăng nhập xong quay lại giỏ để đặt
    if (!req.session.user) {
      req.flash('error', `Vui lòng đăng nhập để thuê ngay. "${product.ProductName}" đã được thêm vào giỏ, đăng nhập xong bạn tiếp tục đặt thuê.`);
      return res.redirect('/login?next=/cart/checkout');
    }
    return res.redirect('/cart/checkout');
  }
  if (wantsJson) {
    return res.json({ ok: true, name: product.ProductName, size, color, qty, image: product.PathImage || '',
      cartCount: cart.reduce((n, l) => n + l.qty, 0) });
  }
  req.flash('success', `Đã thêm "${product.ProductName}" (size ${size} – ${color}) vào giỏ thuê.`);
  res.redirect(back);
};

// Dữ liệu chung cho bước 1 (giỏ thuê) và bước 2 (đặt thuê & giao nhận)
async function cartData(req, res, opts = {}) {
  const { lines, removedCount } = await loadCart(req, opts);
  if (removedCount) res.locals.error = [`${removedCount} món trong giỏ không còn cho thuê (hoặc không còn size / màu đã chọn) nên đã được bỏ ra.`];
  const old = req.session.checkoutOld || {};
  delete req.session.checkoutOld;
  // Ngày khách đã chọn khi xem lịch trống ở cửa hàng / trang chi tiết -> tự điền
  const saved = req.session.rentDates;
  const rentDates = saved && !checkDates(saved.start, saved.end) ? saved : null;
  // Mã giảm giá đang áp dụng (gợi ý cho khách bấm chọn)
  const { activeCoupons, summary } = require('../utils/coupons');
  const coupons = (await activeCoupons()).map(c => ({ code: c.Code, text: c.Description || summary(c), summary: summary(c) }));
  // Thông tin cá nhân đã lưu -> tự điền SĐT / CCCD / địa chỉ
  let profile = {};
  if (req.session.user) {
    const u = await require('../models').User.findByPk(req.session.user.id, { attributes: ['phone', 'idCardNumber', 'address'] });
    if (u) profile = u.get({ plain: true });
  }
  return { lines, old, rentDates, MAX_RENT_DAYS, lineKey, coupons, profile, ZONES: require('../utils/shipping').ZONES, rentZone: req.session.rentZone || 'pickup', savedCoupon: req.session.couponCode || '' };
}

// ===== Bước 1: Giỏ thuê — xem lại món, số lượng (ai cũng xem được) =====
exports.view = async (req, res) => {
  res.render('cart/index', { title: 'Giỏ thuê', ...(await cartData(req, res)) });
};

// ===== Bước 2: Đặt thuê & giao nhận — ngày thuê, cách nhận đồ, thông tin, thanh toán (cần đăng nhập) =====
exports.checkout = async (req, res) => {
  const data = await cartData(req, res, { selectedOnly: true });
  if (!data.lines.length) {
    req.flash('error', (req.session.cart || []).length ? 'Vui lòng chọn ít nhất 1 món để đặt thuê.' : 'Giỏ thuê đang trống.');
    return res.redirect('/cart');
  }
  res.render('cart/checkout', { title: 'Đặt thuê & giao nhận', ...data });
};

// ===== Đổi số lượng 1 dòng =====
exports.update = async (req, res) => {
  const cart = getCart(req);
  const line = cart.find(l => l.key === req.params.key);
  // Trang giỏ gọi bằng fetch (không tải lại trang) -> trả JSON; gửi form thường thì vẫn chuyển trang như cũ
  const wantsJson = req.get('X-Requested-With') === 'fetch';
  let error = null;
  if (!line) error = 'Món này không còn trong giỏ.';
  else {
    const qty = parseInt(req.body.qty);
    const stock = await stockOf(line.productId, line.size, line.color);
    if (!(qty >= 1)) error = 'Số lượng phải từ 1 trở lên.';
    else if (qty > stock) error = `Size ${line.size} – ${line.color} chỉ còn ${stock} bộ.`;
    else line.qty = qty;
  }
  if (wantsJson) return res.json({ ok: !error, error, qty: line ? line.qty : 0 });
  if (error) req.flash('error', error);
  res.redirect('/cart');
};

// ===== Chọn / bỏ chọn món để đặt thuê (body: keys = danh sách key được chọn, cách nhau dấu phẩy) =====
exports.select = (req, res) => {
  const keys = new Set(String(req.body.keys || '').split(',').filter(Boolean));
  for (const l of getCart(req)) l.off = !keys.has(l.key);
  if (req.get('X-Requested-With') === 'fetch') return res.json({ ok: true });
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
  // Khu vực nhận đồ: giao xa thì giữ đồ thêm ngày vận chuyển 2 đầu
  const { zoneOf } = require('../utils/shipping');
  const zone = zoneOf(req.query.zone);
  const zoneErr = require('../utils/shipping').checkZoneDates(zone, start, end);
  if (zoneErr) return res.json({ ok: false, error: zoneErr, lines: {} });
  const { lines, products } = await loadCart(req, { selectedOnly: true });
  const avail = await productAvailability(products, start, end, { shipDays: zone.days });
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
  const { rentDaysOf } = require('../utils/dates');
  const { start, end, code } = req.query;
  const err = checkDates(start, end);
  if (err) return res.json({ ok: false, error: err });
  const { lines } = await loadCart(req, { selectedOnly: true });
  if (!lines.length) return res.json({ ok: false, error: 'Chưa chọn món nào để đặt thuê.' });
  const { priceOf } = require('../utils/pricing');
  const rentFee = lines.reduce((s, l) => s + priceOf(l.product) * l.qty, 0) * rentDaysOf(start, end);
  const r = await applyCoupon(code, req.session.user ? req.session.user.id : null, rentFee);
  if (r.error) return res.json({ ok: false, error: r.error });
  res.json({ ok: true, code: r.coupon.Code, discount: r.discount, rentFee, description: r.coupon.Description || '' });
};
