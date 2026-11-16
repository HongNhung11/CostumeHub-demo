const { Op, fn, col } = require('sequelize');
const XLSX = require('xlsx');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const sequelize = require('../config/database');
const { Product } = require('../models');

// Toán tử LIKE theo dialect (postgres hỗ trợ iLike, sqlite dùng like)
const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

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

function buildSearchOr(q) {
  const or = [
    { ProductName: { [likeOp]: `%${q}%` } },
    { Description: { [likeOp]: `%${q}%` } },
    { ProductType: { [likeOp]: `%${q}%` } },
  ];
  if (/^\d+$/.test(q)) or.push({ ProductID: parseInt(q) });
  return or;
}

// ===== CỬA HÀNG: lưới thẻ sản phẩm + lọc danh mục + tìm kiếm + phân trang =====
exports.index = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 12;
  const q = (req.query.q || '').trim();
  const type = (req.query.type || '').trim();

  const where = {};
  if (type) where.ProductType = type;
  if (q) where[Op.or] = buildSearchOr(q);

  // Ưu tiên hiển thị TRANG PHỤC trước, PHỤ KIỆN sau (khi xem Tất cả)
  const { count, rows } = await Product.findAndCountAll({
    where, limit, offset: (page - 1) * limit,
    order: [
      [sequelize.literal(`CASE WHEN "ProductType" = 'Phụ kiện' THEN 1 ELSE 0 END`), 'ASC'],
      ['ProductID', 'ASC'],
    ],
  });
  const totalPages = Math.max(1, Math.ceil(count / limit));

  // Đếm số lượng theo từng loại (cho menu danh mục)
  const grouped = await Product.findAll({
    attributes: ['ProductType', [fn('COUNT', col('ProductID')), 'cnt']],
    group: ['ProductType'], raw: true,
  });
  const counts = {};
  grouped.forEach(g => { counts[g.ProductType] = Number(g.cnt); });
  const totalAll = await Product.count();

  res.render('products/index', {
    title: 'Trang phục & Phụ kiện',
    products: rows, counts, totalAll, type, q, page, totalPages, count,
    COSTUME_TYPES, ACCESSORY_TYPES,
  });
};

// ===== 1 + 6: TRANG QUẢN LÝ (bảng) có PHÂN TRANG + TÌM KIẾM =====
exports.manage = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10); // 10-15 item/trang
  const q = (req.query.q || '').trim();

  const where = {};
  if (q) where[Op.or] = buildSearchOr(q);

  const { count, rows } = await Product.findAndCountAll({
    where, limit, offset: (page - 1) * limit, order: [['ProductID', 'ASC']],
  });
  const totalPages = Math.max(1, Math.ceil(count / limit));

  res.render('products/manage', {
    title: 'Quản lý Trang phục',
    products: rows, columns: COLUMNS,
    page, totalPages, limit, q, count,
  });
};

// ===== 4: XEM CHI TIẾT =====
exports.show = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  res.render('products/show', { title: 'Chi tiết sản phẩm', product });
};

// ===== Trang ĐẶT THUÊ / THANH TOÁN (cần đăng nhập) =====
exports.bookForm = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  if (product.Status !== 'Còn trống' || product.Quantity <= 0) {
    req.flash('error', 'Sản phẩm hiện không thể đặt thuê.');
    return res.redirect(`/products/${product.ProductID}`);
  }
  res.render('products/book', { title: 'Đặt thuê & thanh toán', product });
};

// Form Thêm mới — nhớ trang danh sách đã bấm "Thêm" để quay về
exports.createForm = (req, res) => {
  res.render('products/form', {
    title: 'Thêm trang phục', product: {}, action: '/products', method: 'POST',
    back: backToList(req),
  });
};

// ===== 2: THÊM MỚI =====
exports.create = async (req, res) => {
  const back = req.body.back || '/products/manage';
  try {
    const data = pickBody(req.body);
    if (req.file) data.PathImage = '/uploads/' + req.file.filename;
    await Product.create(data);
    req.flash('success', 'Đã thêm trang phục mới.');
    res.redirect(back);                       // 7: quay về trang danh sách
  } catch (e) {
    req.flash('error', 'Lỗi khi thêm: ' + e.message);
    res.redirect('/products/new');
  }
};

// Form Sửa — nhớ trang danh sách để quay về
exports.editForm = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  res.render('products/form', {
    title: 'Cập nhật trang phục', product,
    action: `/products/${product.ProductID}?_method=PUT`, method: 'POST',
    back: backToList(req),
  });
};

// ===== 3: CẬP NHẬT =====
exports.update = async (req, res) => {
  const back = req.body.back || '/products/manage';
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
    const data = pickBody(req.body);
    if (req.file) data.PathImage = '/uploads/' + req.file.filename;
    await product.update(data);
    req.flash('success', 'Đã cập nhật trang phục.');
    res.redirect(back);                       // 7: quay về trang danh sách
  } catch (e) {
    req.flash('error', 'Lỗi khi cập nhật: ' + e.message);
    res.redirect(`/products/${req.params.id}/edit`);
  }
};

// ===== 5a: XÓA 1 BẢN GHI =====
exports.destroy = async (req, res) => {
  await Product.destroy({ where: { ProductID: req.params.id } });
  req.flash('success', 'Đã xóa 1 trang phục.');
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 5b: XÓA NHIỀU BẢN GHI (checkbox) =====
exports.destroyMany = async (req, res) => {
  const ids = toArray(req.body.ids);
  if (ids.length) {
    await Product.destroy({ where: { ProductID: { [Op.in]: ids } } });
    req.flash('success', `Đã xóa ${ids.length} trang phục được chọn.`);
  } else {
    req.flash('error', 'Chưa chọn bản ghi nào.');
  }
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 7 + 8: SAO CHÉP 1 / NHIỀU BẢN GHI =====
exports.copyMany = async (req, res) => {
  const ids = toArray(req.body.ids);
  if (!ids.length) {
    req.flash('error', 'Chưa chọn bản ghi nào để sao chép.');
    return res.redirect(backToList(req));
  }
  const list = await Product.findAll({ where: { ProductID: { [Op.in]: ids } } });
  for (const p of list) {
    const clone = p.toJSON();
    delete clone.ProductID;
    delete clone.CreateDate;
    delete clone.UpdateDate;
    clone.ProductName = clone.ProductName + ' (Copy)';
    await Product.create(clone);
  }
  req.flash('success', `Đã sao chép ${list.length} bản ghi.`);
  res.redirect(backToList(req));              // 7: quay về trang danh sách
};

// ===== 9a: EXPORT (excel / json / xml) =====
exports.exportData = async (req, res) => {
  const type = req.params.type;
  const rows = (await Product.findAll({ order: [['ProductID', 'ASC']] })).map(r => r.toJSON());

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

    let n = 0;
    for (const r of records) {
      const data = pickBody(r);
      if (!data.ProductName) continue;
      await Product.create(data);
      n++;
    }
    req.flash('success', `Đã import ${n} trang phục từ file.`);
  } catch (e) {
    req.flash('error', 'Lỗi import: ' + e.message);
  }
  res.redirect('/products');
};

// ---------- helpers ----------
function pickBody(body) {
  const d = {};
  const fields = ['ProductName', 'ProductType', 'Unit', 'Description', 'PathImage', 'Status'];
  const nums = ['Quantity', 'Price', 'DepositValue', 'LateFeePerDay'];
  for (const f of fields) if (body[f] !== undefined && body[f] !== '') d[f] = body[f];
  for (const f of nums) if (body[f] !== undefined && body[f] !== '') d[f] = Number(body[f]) || 0;
  return d;
}
function toArray(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(Number).filter(Boolean);
}
