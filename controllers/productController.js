const { Op, fn, col } = require('sequelize');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { sequelize, Product, ProductVariant, ProductImage, Review, Favorite, User, Rental, RentalItem } = require('../models');
const { searchProducts } = require('../utils/search');
const { peakFutureUsage, productsInRentals, productAvailability, rentDatesFrom, MAX_RENT_DAYS } = require('../utils/availability');
const { splitQuantity, formatVariants, parseVariants, sizesOf, colorsOf, variantGrid, saveVariants } = require('../utils/variants');
const { splitList } = require('../utils/text');
const { viDate, rentDaysOf } = require('../utils/dates');
const { PRODUCT_TYPES, PRODUCT_STATUSES, normalizeStatus } = require('../utils/constants');
const { uploadDir, MAX_GALLERY } = require('../middlewares/upload');
const { FIELDS: CHART_FIELDS, parseChart, chartRows, readChartForm } = require('../utils/sizeChart');
const { ratingMap, reviewSummary } = require('../utils/reviews');
const { CATEGORIES, filterByCategory, menuGroups } = require('../utils/categories');
const { DETAIL_FIELDS } = require('../utils/details');
const { hotSet, hotScores } = require('../utils/hot');
const { saleOf, priceOf, salePercent } = require('../utils/pricing');

// Thứ tự size: XS → S → M → L → XL → XXL (kể cả "S+", "M/L"), rồi Free size, rồi size số / ni / kích thước (theo số tăng dần)
const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
function sizeRank(s) {
  const t = String(s).trim().toUpperCase();
  const m = t.match(/^(XXXL|XXL|XL|XXS|XS|S|M|L)(?!\p{L})/u);   // không nhầm "Lớn" là "L"
  if (m) return [0, LETTER_SIZES.indexOf(m[1]), t];
  const w = ['NHỎ', 'VỪA', 'LỚN'].indexOf(t);
  if (w >= 0) return [0.5, w, t];
  if (/FREE/.test(t)) return [1, 0, t];
  const n = t.match(/\d+(\.\d+)?/);
  return [2, n ? Number(n[0]) : 9999, t];
}
function bySize(a, b) {
  const x = sizeRank(a), y = sizeRank(b);
  return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], 'vi', { numeric: true });
}
exports.bySize = bySize;

// Bộ lọc giá thuê / ngày (cột trái trang cửa hàng)
const PRICE_RANGES = [
  { key: 'duoi-100k', label: 'Dưới 100.000 đ', min: 0, max: 100000 },
  { key: '100-200k', label: '100.000 – 200.000 đ', min: 100000, max: 200000 },
  { key: '200-300k', label: '200.000 – 300.000 đ', min: 200000, max: 300000 },
  { key: 'tren-300k', label: 'Từ 300.000 đ', min: 300000, max: Infinity },
];
const SORTS = [
  { key: '', label: 'Mới nhất' },
  { key: 'oldest', label: 'Cũ nhất' },
  { key: 'price-asc', label: 'Giá tăng dần' },
  { key: 'price-desc', label: 'Giá giảm dần' },
  { key: 'popular', label: 'Nổi bật (HOT)' },
  { key: 'rating', label: 'Đánh giá cao' },
  { key: 'sale', label: 'Giảm giá nhiều nhất' },
];

// Sắp xếp: sản phẩm tạo GẦN NHẤT lên đầu
const NEWEST_FIRST = [['CreateDate', 'DESC'], ['ProductID', 'DESC']];
// Cửa hàng chỉ hiện sản phẩm đang cho thuê (ẩn "Ngừng cho thuê"); trang Quản lý vẫn thấy hết
const ON_SALE = { Status: { [Op.ne]: 'Ngừng cho thuê' } };

// Danh sách cột có thể ẩn/hiện (chức năng 10)
const COLUMNS = [
  { key: 'ProductID', label: 'Mã' },
  { key: 'PathImage', label: 'Ảnh' },
  { key: 'ProductName', label: 'Tên trang phục' },
  { key: 'ProductType', label: 'Loại' },
  { key: 'Quantity', label: 'SL' },
  { key: 'Unit', label: 'ĐV' },
  { key: 'Price', label: 'Giá thuê/ngày' },
  { key: 'DepositValue', label: 'Cọc' },
  { key: 'Status', label: 'Tình trạng' },
  { key: 'Description', label: 'Mô tả' },
];

// Nhóm danh mục — shop trang phục NỮ
const COSTUME_TYPES = ['Áo dài', 'Váy tiệc'];
const ACCESSORY_TYPES = ['Phụ kiện'];

// Trang danh sách để quay về sau Thêm/Sửa/Xóa (ưu tiên trang trước đó)
function backToList(req, fallback = '/products/manage') {
  const ref = req.get('Referer') || '';
  // Chỉ nhận lại Referer nếu là một trang danh sách sản phẩm (tránh quay lại chính form)
  if (/\/products(\/manage)?(\?|$)/.test(ref) && !/\/(new|edit)\b/.test(ref)) return ref;
  return fallback;
}

const formView = (extra) => ({ TYPES: PRODUCT_TYPES, STATUSES: PRODUCT_STATUSES, errors: [], grid: [], gallery: [], chart: {}, CHART_FIELDS, MAX_GALLERY, DETAIL_FIELDS, ...extra });

// ===== CỬA HÀNG: lưới thẻ sản phẩm + lọc danh mục + tìm kiếm + phân trang =====
exports.index = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 16;   // 16 mẫu/trang: ~80 mẫu chia thành khoảng 5 trang, lưới 4 cột vừa 4 hàng
  const q = (req.query.q || '').trim();
  const type = (req.query.type || '').trim();

  const where = { ...ON_SALE };
  if (type) where.ProductType = type;

  // Mới tạo gần nhất lên đầu; có từ khóa thì xếp theo độ khớp
  // (tìm không phân biệt dấu/hoa thường, ưu tiên khớp Tên/Loại/Màu)
  let list = await Product.findAll({ where, order: NEWEST_FIRST });
  if (q) list = searchProducts(list, q);
  // Danh mục con từ menu "Danh mục" (VD ?cat=tui-xach, ?cat=cuoi)
  const cat = CATEGORIES[req.query.cat] ? String(req.query.cat) : '';
  if (cat) list = filterByCategory(list, cat);

  // Bộ lọc ở cột trái: màu sắc + khoảng giá (danh sách màu lấy từ các mẫu đang hiện)
  const colorOptions = [...new Set(list.flatMap(p => splitList(p.Color)))].sort((a, b) => a.localeCompare(b, 'vi'));
  const color = colorOptions.includes(String(req.query.color || '')) ? String(req.query.color) : '';
  if (color) list = list.filter(p => splitList(p.Color).includes(color));
  const price = PRICE_RANGES.find(r => r.key === req.query.price) ? String(req.query.price) : '';
  if (price) { const r = PRICE_RANGES.find(x => x.key === price); list = list.filter(p => priceOf(p) >= r.min && priceOf(p) < r.max); }
  const onSale = req.query.sale === '1';
  if (onSale) list = list.filter(p => saleOf(p) !== null);

  // Danh sách size để lọc (lấy từ các mẫu đang hiện, chỉ size shop thực sự có bộ)
  const allVariants = list.length ? await ProductVariant.findAll({ where: { ProductID: { [Op.in]: list.map(p => p.ProductID) }, Quantity: { [Op.gt]: 0 } } }) : [];
  const sizesOfP = {};
  for (const v of allVariants) (sizesOfP[v.ProductID] ||= new Set()).add(v.Size);
  const sizeOptions = [...new Set(allVariants.map(v => v.Size))].sort(bySize);
  const size = sizeOptions.includes(String(req.query.size || '')) ? String(req.query.size) : '';
  if (size) list = list.filter(p => sizesOfP[p.ProductID] && sizesOfP[p.ProductID].has(size));   // chỉ mẫu CÓ size này

  // Tag lịch thuê — CHỈ khi khách chọn ngày:
  //  - lọc size: size đó hết bộ -> "Đã thuê size X"
  //  - không lọc size: mẫu 1 size hết bộ, hoặc mẫu nhiều size mà MỌI size đều hết -> "Đã kín lịch"
  //    (mẫu nhiều size còn size khác thì giữ nguyên, không gắn tag)
  const { dates, error: dateError } = rentDatesFrom(req);
  if (dateError) res.locals.error = [dateError];
  const tags = {};
  const onlyFree = !!dates && req.query.free === '1';
  if (dates) {
    const avail = await productAvailability(list, dates.start, dates.end);   // theo size × màu
    for (const p of list) {
      const a = avail[p.ProductID];
      if (size) {
        const freeOfSize = a.variants.filter(v => v.Size === size).reduce((s, v) => s + v.free, 0);
        if (!freeOfSize) tags[p.ProductID] = `Đã thuê size ${size}`;
      } else if (!a.free) {
        tags[p.ProductID] = 'Đã kín lịch';
      }
    }
    if (onlyFree) list = list.filter(p => !tags[p.ProductID]);
  }

  // Sắp xếp (mặc định: mới nhất; đang tìm kiếm thì giữ thứ tự theo độ khớp)
  const sort = SORTS.find(s => s.key === req.query.sort) ? String(req.query.sort) : '';
  if (sort === 'price-asc') list.sort((a, b) => priceOf(a) - priceOf(b));
  else if (sort === 'price-desc') list.sort((a, b) => priceOf(b) - priceOf(a));
  else if (sort === 'sale') list.sort((a, b) => salePercent(b) - salePercent(a));
  else if (sort === 'rating') {
    const all = await ratingMap(list.map(p => p.ProductID));
    const sc = (p) => (all[p.ProductID] ? all[p.ProductID].avg * 1000 + all[p.ProductID].count : 0);
    list.sort((a, b) => sc(b) - sc(a));
  } else if (sort === 'popular') {
    const sc = await hotScores();   // thuê nhiều + thêm vào giỏ nhiều
    list.sort((a, b) => (sc[b.ProductID] || 0) - (sc[a.ProductID] || 0));
  } else if (sort === 'oldest') {
    list.sort((a, b) => (new Date(a.CreateDate) - new Date(b.CreateDate)) || (a.ProductID - b.ProductID));
  }

  const count = list.length;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const rows = list.slice((page - 1) * limit, page * limit);

  // Đếm số lượng theo từng loại (cho menu danh mục)
  const grouped = await Product.findAll({
    attributes: ['ProductType', [fn('COUNT', col('ProductID')), 'cnt']],
    where: ON_SALE, group: ['ProductType'], raw: true,
  });
  const counts = {};
  grouped.forEach(g => { counts[g.ProductType] = Number(g.cnt); });
  const totalAll = await Product.count({ where: ON_SALE });

  // Sao đánh giá trung bình + mẫu khách đã thả tim
  const ratings = await ratingMap(rows.map(p => p.ProductID));
  const favSet = await favoriteSet(req, rows.map(p => p.ProductID));
  const hot = await hotSet();

  res.render('products/index', {
    title: 'Trang phục & Phụ kiện',
    products: rows, counts, totalAll, type, q, page, totalPages, count, ratings, favSet, cat, catLabel: cat ? CATEGORIES[cat].label : '',
    color, colorOptions, price, PRICE_RANGES, sort, SORTS, CAT_GROUPS: menuGroups(), hot, onSale,
    COSTUME_TYPES, ACCESSORY_TYPES,
    dates, tags, onlyFree, size, sizeOptions, viDate, rentDays: dates ? rentDaysOf(dates.start, dates.end) : 0, MAX_RENT_DAYS,
  });
};

// ===== 1 + 6: TRANG QUẢN LÝ (bảng) có PHÂN TRANG + TÌM KIẾM =====
exports.manage = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10); // 10-15 item/trang
  const q = (req.query.q || '').trim();

  let list = await Product.findAll({ order: NEWEST_FIRST });   // SP mới lưu nằm đầu
  if (q) list = searchProducts(list, q);
  const count = list.length;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const rows = list.slice((page - 1) * limit, page * limit);
  const highlight = parseInt(req.query.new) || null;           // làm nổi bật SP vừa thêm

  res.render('products/manage', {
    title: 'Quản lý sản phẩm',
    products: rows, columns: COLUMNS,
    page, totalPages, limit, q, count, highlight,
  });
};

// ===== 4: XEM CHI TIẾT =====
exports.show = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  const variants = await ProductVariant.findAll({ where: { ProductID: product.ProductID } });
  // Không hiện lịch đã thuê khi xem bình thường; khách chọn ngày thì mới báo còn trống / đã kín (theo size × màu)
  // Khu vực nhận đồ khách chọn ngay trên ô lịch (nhớ trong phiên, giỏ thuê chọn sẵn theo)
  const { ZONES, zoneKeyOf } = require('../utils/shipping');
  if (req.query.zone) req.session.rentZone = zoneKeyOf(req.query.zone);
  const zoneKey = zoneKeyOf(req.session.rentZone);
  const { dates, error: dateError } = rentDatesFrom(req);
  if (dateError) res.locals.error = [dateError];
  // Giao xa mà ngày nhận quá sớm (không kịp gửi đồ) -> báo, không tính lịch trống
  // (sai khu vực: không kịp gửi đồ / thuê ít hơn số ngày tối thiểu)
  const tooSoon = dates ? require('../utils/shipping').checkZoneDates(ZONES[zoneKey], dates.start, dates.end) : null;
  const avail = dates && !tooSoon && product.Status === 'Còn trống'
    ? (await productAvailability([product], dates.start, dates.end, { shipDays: ZONES[zoneKey].days }))[product.ProductID]
    : null;
  res.locals.zoneKey = zoneKey;
  res.locals.tooSoon = tooSoon;
  // Bảng size × màu cho trang: số bộ shop có, số bộ còn trống (nếu đã chọn ngày), số bộ đã có trong giỏ
  const cart = req.session.cart || [];
  const freeOf = avail ? Object.fromEntries(avail.variants.map(v => [`${v.Size}|${v.Color}`, v.free])) : null;
  const stock = variantGrid(product, variants).map(v => ({
    ...v,
    free: freeOf ? (freeOf[`${v.Size}|${v.Color}`] ?? 0) : null,
    inCart: cart.filter(l => l.productId === product.ProductID && l.size === v.Size && l.color === v.Color).reduce((s, l) => s + l.qty, 0),
  }));
  const inCart = stock.reduce((s, v) => s + v.inCart, 0);

  // Ảnh: ảnh chính + ảnh phụ
  const extra = await ProductImage.findAll({ where: { ProductID: product.ProductID }, order: [['SortOrder', 'ASC'], ['ImageID', 'ASC']] });
  const images = [product.PathImage, ...extra.map(i => i.Path)].filter(Boolean);

  // Đánh giá: khách không thấy đánh giá bị ẩn; nhân viên thấy hết để kiểm duyệt
  const u = req.session.user;
  const staff = !!u && (u.role === 'admin' || u.role === 'nhanvien');
  const reviews = await Review.findAll({
    where: { ProductID: product.ProductID, ...(staff ? {} : { isHidden: false }) },
    include: [{ model: User, attributes: ['fullName', 'username'] }],
    order: [['createdAt', 'DESC']],
  });
  const summary = reviewSummary(reviews.filter(r => !r.isHidden));
  const withPhotos = req.query.photo === '1';
  // Khách được đánh giá khi: đã có đơn "Hoàn tất" chứa mẫu này và chưa đánh giá mẫu này
  let canReview = null, myReview = null;
  if (u) {
    myReview = await Review.findOne({ where: { ProductID: product.ProductID, UserID: u.id } });
    if (!myReview) canReview = await lastCompletedItem(u.id, product.ProductID);
  }
  const isFav = u ? !!(await Favorite.findOne({ where: { UserID: u.id, ProductID: product.ProductID } })) : false;

  // Sản phẩm liên quan: cùng loại, mới nhất trước (tối đa 8)
  const related = await Product.findAll({
    where: { ...ON_SALE, ProductType: product.ProductType, ProductID: { [Op.ne]: product.ProductID } },
    order: NEWEST_FIRST, limit: 8,
  });
  // Sản phẩm đã xem: nhớ trong phiên (tối đa 8, mới xem nằm đầu)
  const seenIds = (req.session.viewed || []).filter(id => id !== product.ProductID);
  req.session.viewed = [product.ProductID, ...seenIds].slice(0, 9);
  const viewed = seenIds.length
    ? (await Product.findAll({ where: { ...ON_SALE, ProductID: { [Op.in]: seenIds } } })).sort((a, b) => seenIds.indexOf(a.ProductID) - seenIds.indexOf(b.ProductID)).slice(0, 8)
    : [];
  const cardRatings = await ratingMap([...related, ...viewed].map(p => p.ProductID));
  const favs = await favoriteSet(req, [...related, ...viewed].map(p => p.ProductID));
  // Khuyến mãi dành cho bạn: các mã giảm giá đang áp dụng
  const { activeCoupons, summary: couponSummary } = require('../utils/coupons');
  const promos = (await activeCoupons()).map(c => ({ code: c.Code, text: c.Description || couponSummary(c) }));

  res.render('products/show', {
    title: product.ProductName, product, dates, avail, stock, inCart, viDate, MAX_RENT_DAYS,
    sizes: sizesOf(product), colors: colorsOf(product),
    images, chart: chartRows(product), CHART_FIELDS,
    reviews: withPhotos ? reviews.filter(r => r.imageList().length) : reviews, withPhotos, summary, canReview, myReview, isFav, staff,
    related, viewed, cardRatings, favs, promos, DETAIL_FIELDS, hot: await hotSet(), savedCoupon: req.session.couponCode || '',
  });
};

// ===== XEM NHANH (khung nhỏ ở trang cửa hàng, không kèm layout) =====
exports.quick = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).send('Không tìm thấy sản phẩm');
  const extra = await ProductImage.findAll({ where: { ProductID: product.ProductID }, order: [['SortOrder', 'ASC'], ['ImageID', 'ASC']] });
  const reviews = await Review.findAll({ where: { ProductID: product.ProductID, isHidden: false } });
  const u = req.session.user;
  const isFav = u ? !!(await Favorite.findOne({ where: { UserID: u.id, ProductID: product.ProductID } })) : false;
  const ref = req.get('Referer') || '';
  let back = '/products';
  try { const x = new URL(ref); if (x.pathname === '/products') back = x.pathname + x.search; } catch (_) {}
  // Size / màu nào shop có bộ (khách không thấy số bộ, chỉ biết chọn được hay không)
  const variants = await ProductVariant.findAll({ where: { ProductID: product.ProductID, Quantity: { [Op.gt]: 0 } } });
  res.render('products/quick', {
    layout: false, product, isFav, back,
    combos: variants.map(v => [v.Size, v.Color]),
    images: [product.PathImage, ...extra.map(i => i.Path)].filter(Boolean),
    sizes: sizesOf(product), colors: colorsOf(product), summary: reviewSummary(reviews),
  });
};

// Link cũ /products/:id/book -> giờ chọn size/màu ở trang chi tiết rồi đặt qua giỏ thuê
exports.bookForm = (req, res) => res.redirect(`/products/${parseInt(req.params.id) || ''}`);

// Form Thêm mới — nhớ trang danh sách đã bấm "Thêm" để quay về
exports.createForm = (req, res) => {
  res.render('products/form', formView({
    title: 'Thêm trang phục', product: {}, action: '/products', method: 'POST',
    back: backToList(req),
  }));
};

// ===== 2: THÊM MỚI =====
exports.create = async (req, res) => {
  const back = safeBack(req.body.back);
  const { combos, errors: gridErrors } = readVariantForm(req.body);
  const { chart, json: chartJson, errors: chartErrors } = readChartForm(req.body, splitList(normalizedLists(req.body).Size));
  const errors = [...validateProduct(req.body, { hasImage: !!req.file, withGrid: true }), ...gridErrors, ...chartErrors];
  if (errors.length) {
    removeUploads(req);
    return res.status(400).render('products/form', formView({
      title: 'Thêm trang phục', product: req.body, grid: combos, chart, action: '/products', method: 'POST', back, errors,
    }));
  }
  try {
    const data = pickBody(req.body);
    data.PathImage = '/uploads/' + req.file.filename;
    Object.assign(data, normalizedLists(req.body));
    data.SizeChart = chartJson;
    const created = await sequelize.transaction(async (t) => {
      const p = await Product.create({ ...data, Quantity: 0 }, { transaction: t });
      await saveVariants(p, combos, { transaction: t });
      await addGallery(p.ProductID, req.galleryFiles, 0, t);
      return p;
    });
    req.flash('success', `Đã thêm "${created.ProductName}" — sản phẩm mới hiển thị ở đầu danh sách.`);
    // 7: quay về TRANG 1 của danh sách (SP mới nằm đầu)
    const listPath = back.split('?')[0];
    res.redirect(listPath === '/products/manage' ? `/products/manage?new=${created.ProductID}` : listPath);
  } catch (e) {
    removeUploads(req);
    req.flash('error', 'Lỗi khi thêm: ' + e.message);
    res.redirect('/products/new');
  }
};

// Form Sửa — nhớ trang danh sách để quay về
exports.editForm = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  const variants = await ProductVariant.findAll({ where: { ProductID: product.ProductID } });
  const gallery = await ProductImage.findAll({ where: { ProductID: product.ProductID }, order: [['SortOrder', 'ASC'], ['ImageID', 'ASC']] });
  res.render('products/form', formView({
    title: 'Cập nhật trang phục', product, grid: variantGrid(product, variants), gallery, chart: parseChart(product.SizeChart),
    action: `/products/${product.ProductID}?_method=PUT`, method: 'POST',
    back: backToList(req),
  }));
};

// ===== 3: CẬP NHẬT =====
exports.update = async (req, res) => {
  const back = safeBack(req.body.back);
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
    const { combos, errors: gridErrors } = readVariantForm(req.body);
    const { chart, json: chartJson, errors: chartErrors } = readChartForm(req.body, splitList(normalizedLists(req.body).Size));
    const errors = [...validateProduct(req.body, { hasImage: !!req.file || !!product.PathImage, withGrid: true }), ...gridErrors, ...chartErrors];
    // Ảnh phụ: bỏ những ảnh được tick "Xóa", thêm ảnh mới — tổng không quá MAX_GALLERY
    const gallery = await ProductImage.findAll({ where: { ProductID: product.ProductID }, order: [['SortOrder', 'ASC'], ['ImageID', 'ASC']] });
    const removeIds = new Set(toArray(req.body.removeImages));
    const keep = gallery.filter(g => !removeIds.has(g.ImageID));
    if (keep.length + req.galleryFiles.length > MAX_GALLERY) errors.push(`Tối đa ${MAX_GALLERY} ảnh phụ (đang giữ ${keep.length}, chọn thêm ${req.galleryFiles.length}).`);
    // Không cho giảm số bộ của một size × màu xuống dưới số bộ khách đang giữ cùng lúc (kể cả bỏ size / màu đó đi)
    if (!errors.length) {
      const peaks = await peakFutureUsage(product.ProductID);
      const newQty = Object.fromEntries(combos.map(c => [`${c.Size}|${c.Color}`, c.Quantity]));
      for (const [k, peak] of Object.entries(peaks)) {
        const [size, color] = k.split('|');
        const q = newQty[k] || 0;
        if (q < peak) errors.push(`Size ${size} – ${color}: đang có ${peak} ${product.Unit} được khách đặt cùng lúc, không thể ${k in newQty ? `giảm xuống ${q}` : 'bỏ size / màu này'}. Tối thiểu là ${peak}.`);
      }
    }
    if (errors.length) {
      removeUploads(req);
      return res.status(400).render('products/form', formView({
        title: 'Cập nhật trang phục',
        product: { ...req.body, ProductID: product.ProductID, PathImage: product.PathImage }, grid: combos, gallery, chart,
        action: `/products/${product.ProductID}?_method=PUT`, method: 'POST', back, errors,
      }));
    }
    const data = pickBody(req.body);
    delete data.PathImage;                    // ảnh chỉ đổi khi upload file mới
    delete data.Quantity;                     // tổng số bộ tính từ bảng size × màu
    Object.assign(data, normalizedLists(req.body));
    data.SizeChart = chartJson;
    const oldImage = product.PathImage;
    if (req.file) data.PathImage = '/uploads/' + req.file.filename;
    const removed = gallery.filter(g => removeIds.has(g.ImageID));
    await sequelize.transaction(async (t) => {
      await product.update(data, { transaction: t });
      await saveVariants(product, combos, { transaction: t });
      if (removed.length) await ProductImage.destroy({ where: { ImageID: { [Op.in]: removed.map(g => g.ImageID) } }, transaction: t });
      await addGallery(product.ProductID, req.galleryFiles, keep.reduce((m, g) => Math.max(m, g.SortOrder + 1), 0), t);
    });
    if (req.file) await removeImageIfUnused(oldImage);   // đổi ảnh -> xóa ảnh cũ nếu không SP nào dùng
    for (const g of removed) await removeImageIfUnused(g.Path);
    req.flash('success', 'Đã cập nhật trang phục.');
    res.redirect(back);                       // 7: quay về trang danh sách
  } catch (e) {
    removeUploads(req);
    req.flash('error', 'Lỗi khi cập nhật: ' + e.message);
    res.redirect(`/products/${req.params.id}/edit`);
  }
};

// ===== 5a: XÓA 1 BẢN GHI =====
// Không xóa sản phẩm đã có đơn thuê:
// - đơn chưa xong (đã cọc / đang thuê) -> khách đang giữ đồ
// - đơn đã xong / đã hủy -> xóa SP sẽ làm mất luôn hóa đơn cũ (lịch sử doanh thu)
// Thay vào đó đổi Tình trạng sang "Ngừng cho thuê" để không ai đặt được nữa.
function blockedMessages({ active, history }) {
  const list = (s) => '#' + [...s].join(', #');
  const msgs = [];
  if (active.size) msgs.push(`Không xóa ${list(active)}: đang có đơn thuê chưa hoàn tất. Hãy đổi Tình trạng sang "Ngừng cho thuê".`);
  if (history.size) msgs.push(`Không xóa ${list(history)}: đã có lịch sử đơn thuê (xóa sẽ mất hóa đơn cũ). Hãy đổi Tình trạng sang "Ngừng cho thuê" để ngừng cho thuê.`);
  return msgs;
}

exports.destroy = async (req, res) => {
  const id = parseInt(req.params.id);
  const used = await productsInRentals([id]);
  if (used.active.has(id) || used.history.has(id)) {
    { const m = blockedMessages(used); if (m.length) req.flash('error', m.join(' ')); }
  } else {
    const p = await Product.findByPk(id);
    if (p) {
      const extra = await ProductImage.findAll({ where: { ProductID: id } });
      await ProductVariant.destroy({ where: { ProductID: id } });
      await ProductImage.destroy({ where: { ProductID: id } });
      await Favorite.destroy({ where: { ProductID: id } });
      await p.destroy();
      for (const img of [p.PathImage, ...extra.map(g => g.Path)]) await removeImageIfUnused(img);
      req.flash('success', 'Đã xóa 1 trang phục.');
    }
  }
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 5b: XÓA NHIỀU BẢN GHI (checkbox) =====
exports.destroyMany = async (req, res) => {
  const ids = toArray(req.body.ids);
  if (!ids.length) {
    req.flash('error', 'Chưa chọn bản ghi nào.');
    return res.redirect(backToList(req));
  }
  const used = await productsInRentals(ids);
  const ok = ids.filter(id => !used.active.has(id) && !used.history.has(id));
  if (ok.length) {
    const images = (await Product.findAll({ attributes: ['PathImage'], where: { ProductID: { [Op.in]: ok } } })).map(p => p.PathImage)
      .concat((await ProductImage.findAll({ where: { ProductID: { [Op.in]: ok } } })).map(g => g.Path));
    await ProductVariant.destroy({ where: { ProductID: { [Op.in]: ok } } });
    await ProductImage.destroy({ where: { ProductID: { [Op.in]: ok } } });
    await Favorite.destroy({ where: { ProductID: { [Op.in]: ok } } });
    const n = await Product.destroy({ where: { ProductID: { [Op.in]: ok } } });
    for (const img of new Set(images)) await removeImageIfUnused(img);
    if (n) req.flash('success', `Đã xóa ${n} trang phục được chọn.`);
  }
  { const m = blockedMessages(used); if (m.length) req.flash('error', m.join(' ')); }
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 7 + 8: SAO CHÉP 1 / NHIỀU BẢN GHI =====
exports.copyMany = async (req, res) => {
  const ids = toArray(req.body.ids);
  if (!ids.length) {
    req.flash('error', 'Chưa chọn bản ghi nào để sao chép.');
    return res.redirect(backToList(req));
  }
  const list = await Product.findAll({ where: { ProductID: { [Op.in]: ids } }, include: [{ model: ProductVariant, as: 'variants' }, { model: ProductImage, as: 'images' }] });
  for (const p of list) {
    const clone = p.toJSON();
    delete clone.ProductID;
    delete clone.CreateDate;
    delete clone.UpdateDate;
    delete clone.variants;
    delete clone.images;
    clone.ProductName = clone.ProductName + ' (Copy)';
    await sequelize.transaction(async (t) => {
      const c = await Product.create(clone, { transaction: t });
      await saveVariants(c, p.variants.map(v => ({ Size: v.Size, Color: v.Color, Quantity: v.Quantity })), { transaction: t });
      if (p.images.length) await ProductImage.bulkCreate(p.images.map(g => ({ ProductID: c.ProductID, Path: g.Path, SortOrder: g.SortOrder })), { transaction: t });
    });
  }
  req.flash('success', `Đã sao chép ${list.length} bản ghi.`);
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 9a: EXPORT (excel / json / xml) =====
exports.exportData = async (req, res) => {
  const type = req.params.type;
  // Kèm cột "SoLuongTheoSizeMau" dạng "S|Tím=1; M|Tím=2" để import lại giữ đúng số bộ từng size × màu
  const rows = (await Product.findAll({ order: [['ProductID', 'ASC']], include: [{ model: ProductVariant, as: 'variants' }] }))
    .map(r => { const o = r.toJSON(); o.SoLuongTheoSizeMau = formatVariants(o.variants || []); delete o.variants; return o; });

  if (type === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="products.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(rows, null, 2));
  }

  if (type === 'xml') {
    const builder = new XMLBuilder({ format: true, arrayNodeName: 'Product' });
    const xml = builder.build({ Products: { Product: rows } });
    res.setHeader('Content-Disposition', 'attachment; filename="products.xml"');
    res.setHeader('Content-Type', 'application/xml');
    return res.send('<?xml version="1.0" encoding="UTF-8"?>\n' + xml);
  }

  // mặc định: excel
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buf);
};

// ===== 9b: IMPORT (excel / json / xml) =====
exports.importData = async (req, res) => {
  try {
    if (!req.file) { req.flash('error', 'Chưa chọn file.'); return res.redirect('/products'); }
    const name = req.file.originalname.toLowerCase();
    let records = [];

    if (name.endsWith('.json')) {
      records = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (name.endsWith('.xml')) {
      const parser = new XMLParser();
      const obj = parser.parse(req.file.buffer.toString('utf8'));
      records = obj?.Products?.Product || [];
      if (!Array.isArray(records)) records = [records];
    } else {
      // excel / csv
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(ws);
    }

    if (!Array.isArray(records)) throw new Error('File không đúng định dạng danh sách sản phẩm.');

    // Mỗi dòng phải qua ĐÚNG quy định như thêm tay (bắt buộc đủ trường, giá ≥ 1.000 đ tròn nghìn...)
    // Dòng sai -> bỏ qua và báo lại số dòng + lý do
    const valid = [], bad = [];
    records.forEach((r, i) => {
      const row = { ...r, Status: normalizeStatus(r.Status ?? 'Còn trống') };
      const img = String(row.PathImage ?? '').trim();
      // Có cột SoLuongTheoSizeMau -> dùng đúng số bộ từng size × màu; không có -> chia đều "Quantity"
      const detail = parseVariants(row.SoLuongTheoSizeMau);
      const lists = normalizedLists(row);
      if (detail.length) row.Quantity = detail.reduce((s, v) => s + v.Quantity, 0);
      const errors = validateProduct(row, { hasImage: !!img });
      if (img && !SAFE_IMAGE_PATH.test(img)) errors.push('Đường dẫn ảnh không hợp lệ (chỉ /img/..., /uploads/... hoặc http(s)://).');
      if (detail.some(v => !splitList(lists.Size).includes(v.Size) || !splitList(lists.Color).includes(v.Color))) {
        errors.push('Cột SoLuongTheoSizeMau có size / màu không nằm trong cột Size / Color.');
      }
      // Dòng 1 của Excel là tiêu đề -> dữ liệu bắt đầu từ dòng 2
      const rowNo = name.endsWith('.json') || name.endsWith('.xml') ? `#${i + 1}` : `dòng ${i + 2}`;
      if (errors.length) bad.push(`${rowNo}${row.ProductName ? ` (${String(row.ProductName).slice(0, 30)})` : ''}: ${errors[0]}`);
      else {
        const combos = detail.length
          ? splitList(lists.Size).flatMap(Size => splitList(lists.Color).map(Color => ({ Size, Color, Quantity: (detail.find(v => v.Size === Size && v.Color === Color) || {}).Quantity || 0 })))
          : splitQuantity(Number(row.Quantity), splitList(lists.Size), splitList(lists.Color));
        // Bảng số đo (cột SizeChart dạng JSON) — sai định dạng thì bỏ qua, không chặn dòng
        const chart = parseChart(typeof row.SizeChart === 'string' ? row.SizeChart : JSON.stringify(row.SizeChart || {}));
        valid.push({ data: { ...pickBody(row), ...lists, SizeChart: Object.keys(chart).length ? JSON.stringify(chart) : null }, combos });
      }
    });

    if (valid.length) {
      await sequelize.transaction(async (t) => {
        for (const v of valid) {
          const p = await Product.create({ ...v.data, Quantity: 0 }, { transaction: t });
          await saveVariants(p, v.combos, { transaction: t });
        }
      });
    }
    if (valid.length) req.flash('success', `Đã import ${valid.length} trang phục từ file.`);
    if (bad.length) {
      const shown = bad.slice(0, 5).map(s => s.replace(/\.$/, '')).join(' · ');
      req.flash('error', `Bỏ qua ${bad.length} dòng không hợp lệ — ${shown}${bad.length > 5 ? ` · và ${bad.length - 5} dòng khác` : ''}.`);
    }
    if (!valid.length && !bad.length) req.flash('error', 'File không có dòng dữ liệu nào.');
  } catch (e) {
    req.flash('error', 'Lỗi import: ' + e.message);
  }
  res.redirect('/products/manage');
};

// ---------- helpers ----------
// Ô tiền nhập dạng "145.000" -> bỏ dấu chấm / khoảng trắng / "đ" trước khi kiểm tra và lưu
const MONEY_FIELDS = ['Price', 'DepositValue', 'LateFeePerDay', 'ProductValue', 'SalePrice'];
function cleanMoney(body) {
  for (const f of MONEY_FIELDS) if (typeof body[f] === 'string') body[f] = body[f].replace(/[.\s,đ]/gi, '');
  return body;
}
function pickBody(body) {
  cleanMoney(body);
  const d = {};
  const fields = ['ProductName', 'ProductType', 'Unit', 'Color', 'Size', 'Description', 'PathImage', 'Status'];
  // Thông tin chi tiết: không bắt buộc, để trống = xóa
  for (const f of DETAIL_FIELDS) if (body[f.key] !== undefined) d[f.key] = String(body[f.key]).trim().slice(0, f.key === 'CareGuide' ? 500 : 150) || null;
  const nums = ['Quantity', 'Price', 'DepositValue', 'LateFeePerDay'];
  for (const f of fields) if (body[f] !== undefined && body[f] !== '') d[f] = String(body[f]).trim();
  for (const f of nums) if (body[f] !== undefined && body[f] !== '') d[f] = Number(body[f]) || 0;
  // Giá khuyến mãi (sale): không bắt buộc; để trống = bỏ sale
  if (body.SalePrice !== undefined) d.SalePrice = String(body.SalePrice).trim() === '' ? null : Number(body.SalePrice) || null;
  if (body.SaleEnd !== undefined) d.SaleEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(body.SaleEnd)) ? String(body.SaleEnd) : null;
  // Giá trị SP: không bắt buộc; để trống = xóa giá trị (khi mất đồ sẽ mất cọc)
  if (body.ProductValue !== undefined) d.ProductValue = String(body.ProductValue).trim() === '' ? null : Number(body.ProductValue) || null;
  return d;
}
function toArray(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(Number).filter(Boolean);
}

// Danh sách size / màu đã chuẩn hóa: bỏ trùng, bỏ khoảng trắng thừa -> "S, M, L"
function normalizedLists(body) {
  const uniq = (s) => [...new Set(splitList(s))].join(', ');
  return { Size: uniq(body.Size), Color: uniq(body.Color) };
}

// Đọc bảng số lượng size × màu từ form (vSize[] / vColor[] / vQty[]).
// Chỉ lấy đúng các tổ hợp của danh sách size / màu đang khai; tổ hợp không nhập = 0 bộ.
function readVariantForm(body) {
  const arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const S = arr(body.vSize), C = arr(body.vColor), Q = arr(body.vQty);
  const posted = new Map();
  const errors = [];
  S.forEach((s, i) => {
    const raw = String(Q[i] ?? '0').trim() || '0';
    if (!/^\d+$/.test(raw) || Number(raw) > 999) { errors.push(`Số bộ của size ${s} – ${C[i]} phải là số nguyên từ 0 đến 999.`); return; }
    posted.set(`${String(s).trim()}|${String(C[i]).trim()}`, Number(raw));
  });
  const lists = normalizedLists(body);
  const combos = [];
  for (const Size of splitList(lists.Size)) for (const Color of splitList(lists.Color)) {
    combos.push({ Size, Color, Quantity: posted.get(`${Size}|${Color}`) || 0 });
  }
  if (!errors.length && combos.length && combos.every(c => c.Quantity === 0)) {
    errors.push('Vui lòng nhập số bộ cho ít nhất một size × màu.');
  }
  return { combos, errors: [...new Set(errors)].slice(0, 3) };
}

// Kiểm tra dữ liệu Thêm/Sửa: bắt buộc mọi trường, giá từ 1.000 đ trở lên
// withGrid: số lượng nhập theo bảng size × màu (không dùng ô "Số lượng" chung)
function validateProduct(body, { hasImage, withGrid = false }) {
  cleanMoney(body);
  const errors = [];
  const str = (k) => String(body[k] ?? '').trim();
  const required = {
    ProductName: 'Tên trang phục', ProductType: 'Loại', ...(withGrid ? {} : { Quantity: 'Số lượng' }), Unit: 'Đơn vị',
    Price: 'Giá thuê / ngày', DepositValue: 'Tiền cọc', LateFeePerDay: 'Phí phạt trễ / ngày',
    Color: 'Màu sắc', Size: 'Size / kích thước', Status: 'Tình trạng', Description: 'Mô tả',
  };
  for (const [k, label] of Object.entries(required)) if (!str(k)) errors.push(`Vui lòng nhập "${label}".`);
  // Size / màu: mỗi mẫu tự khai (1 size cũng được; phụ kiện ghi kích thước: "Ni 6, Ni 7", "40cm"...)
  for (const [k, label] of [['Size', 'size / kích thước'], ['Color', 'màu']]) {
    const items = splitList(str(k));
    if (items.length > 10) errors.push(`Tối đa 10 ${label} cho một mẫu.`);
    if (items.some(x => x.length > 30)) errors.push(`Mỗi ${label} tối đa 30 ký tự.`);
    if (items.some(x => /[|=]/.test(x))) errors.push(`Tên ${label} không được chứa ký tự "|" hoặc "=".`);
  }
  if (!hasImage) errors.push('Vui lòng chọn ảnh trang phục.');

  if (str('ProductName') && str('ProductName').length < 3) errors.push('Tên trang phục phải có ít nhất 3 ký tự.');
  if (str('ProductType') && !PRODUCT_TYPES.includes(str('ProductType'))) errors.push('Loại không hợp lệ.');
  if (str('Status') && !PRODUCT_STATUSES.includes(str('Status'))) errors.push('Tình trạng không hợp lệ.');

  const int = (k) => (/^\d+$/.test(str(k)) ? Number(str(k)) : NaN);
  if (str('Quantity') && !(int('Quantity') >= 0)) errors.push('Số lượng phải là số nguyên ≥ 0.');
  if (str('Price')) {
    const price = int('Price');
    if (!(price >= 1000)) errors.push('Giá thuê phải từ 1.000 đ trở lên.');
    else if (price % 1000 !== 0) errors.push('Giá thuê phải tròn nghìn đồng (VD: 150000).');
  }
  for (const [k, label] of [['DepositValue', 'Tiền cọc'], ['LateFeePerDay', 'Phí phạt trễ']]) {
    if (!str(k)) continue;
    const v = int(k);
    if (!(v >= 0)) errors.push(`${label} phải là số nguyên ≥ 0.`);
    else if (v % 1000 !== 0) errors.push(`${label} phải tròn nghìn đồng.`);
  }
  if (str('SalePrice')) {
    const v = int('SalePrice'), base = int('Price');
    if (!(v >= 1000) || v % 1000 !== 0) errors.push('Giá khuyến mãi phải từ 1.000 đ và tròn nghìn (hoặc để trống).');
    else if (base >= 1000 && v >= base) errors.push('Giá khuyến mãi phải thấp hơn giá thuê gốc.');
  }
  if (str('SaleEnd') && !/^\d{4}-\d{2}-\d{2}$/.test(str('SaleEnd'))) errors.push('Ngày kết thúc khuyến mãi không hợp lệ.');
  if (str('ProductValue')) {
    const v = int('ProductValue');
    if (!(v >= 1000) || v % 1000 !== 0) errors.push('Giá trị sản phẩm phải từ 1.000 đ trở lên và tròn nghìn (hoặc để trống).');
  }
  return errors;
}
function safeBack(v) {
  return typeof v === 'string' && /^\/products(\/manage)?(\?|$)/.test(v) ? v : '/products/manage';
}
function removeUpload(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}
// Form lỗi -> xóa mọi ảnh vừa upload (ảnh chính + ảnh phụ)
function removeUploads(req) {
  removeUpload(req.file);
  (req.galleryFiles || []).forEach(removeUpload);
}
// Lưu các ảnh phụ vừa upload
async function addGallery(productId, files, startOrder, transaction) {
  if (!files || !files.length) return;
  await ProductImage.bulkCreate(files.map((f, i) => ({ ProductID: productId, Path: '/uploads/' + f.filename, SortOrder: startOrder + i })), { transaction });
}
// Món gần nhất trong đơn "Hoàn tất" của khách có mẫu này (cho phép đánh giá + ghi size đã mặc)
async function lastCompletedItem(userId, productId) {
  return RentalItem.findOne({
    where: { ProductID: productId },
    include: [{ model: Rental, where: { UserID: userId, Status: 'Hoàn tất' }, attributes: ['RentalID', 'ReturnDate'] }],
    order: [[Rental, 'RentalID', 'DESC']],
  });
}
exports.lastCompletedItem = lastCompletedItem;
// Tập ProductID mà khách đang đăng nhập đã thả tim
async function favoriteSet(req, ids) {
  const u = req.session.user;
  if (!u || !ids.length) return new Set();
  const rows = await Favorite.findAll({ where: { UserID: u.id, ProductID: { [Op.in]: ids } }, attributes: ['ProductID'] });
  return new Set(rows.map(r => r.ProductID));
}
exports.favoriteSet = favoriteSet;

const SAFE_IMAGE_PATH = /^(\/(img|uploads)\/[\w\-./]+|https?:\/\/[^\s"'<>]+)$/i;

// Xóa file ảnh đã upload nếu không còn sản phẩm nào dùng (bản sao dùng chung ảnh với bản gốc)
async function removeImageIfUnused(img) {
  if (!img || !img.startsWith('/uploads/')) return;          // ảnh mẫu /img/... thì giữ
  if (await Product.count({ where: { PathImage: img } })) return;
  if (await ProductImage.count({ where: { Path: img } })) return;
  fs.unlink(path.join(uploadDir, path.basename(img)), () => {});
}
