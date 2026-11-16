const { Op, fn, col } = require('sequelize');
const fs = require('fs');
const XLSX = require('xlsx');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { Product } = require('../models');
const { searchProducts } = require('../utils/search');
const { bookedOutRanges, peakFutureUsage, productsInRentals } = require('../utils/availability');
const { viDate } = require('../utils/dates');

// Sắp xếp: sản phẩm tạo GẦN NHẤT lên đầu
const NEWEST_FIRST = [['CreateDate', 'DESC'], ['ProductID', 'DESC']];
const PRODUCT_TYPES = ['Áo dài', 'Váy tiệc', 'Phụ kiện', 'Khác'];
const PRODUCT_STATUSES = ['Còn trống', 'Đang cho thuê', 'Chờ xử lý', 'Ngừng cho thuê'];

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

const formView = (extra) => ({ TYPES: PRODUCT_TYPES, STATUSES: PRODUCT_STATUSES, errors: [], ...extra });

// ===== CỬA HÀNG: lưới thẻ sản phẩm + lọc danh mục + tìm kiếm + phân trang =====
exports.index = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 12;
  const q = (req.query.q || '').trim();
  const type = (req.query.type || '').trim();

  const where = {};
  if (type) where.ProductType = type;

  // Mới tạo gần nhất lên đầu; có từ khóa thì xếp theo độ khớp
  // (tìm không phân biệt dấu/hoa thường, ưu tiên khớp Tên/Loại/Màu)
  let list = await Product.findAll({ where, order: NEWEST_FIRST });
  if (q) list = searchProducts(list, q);
  const count = list.length;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const rows = list.slice((page - 1) * limit, page * limit);

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

  let list = await Product.findAll({ order: NEWEST_FIRST });   // SP mới lưu nằm đầu
  if (q) list = searchProducts(list, q);
  const count = list.length;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const rows = list.slice((page - 1) * limit, page * limit);
  const highlight = parseInt(req.query.new) || null;           // làm nổi bật SP vừa thêm

  res.render('products/manage', {
    title: 'Quản lý Trang phục',
    products: rows, columns: COLUMNS,
    page, totalPages, limit, q, count, highlight,
  });
};

// ===== 4: XEM CHI TIẾT =====
exports.show = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  // Lịch các ngày đã kín (hết bộ trống) trong 60 ngày tới
  const bookedOut = product.Status === 'Còn trống' ? await bookedOutRanges(product, 60) : [];
  const inCart = (req.session.cart || []).filter(l => l.productId === product.ProductID).reduce((s, l) => s + l.qty, 0);
  res.render('products/show', { title: 'Chi tiết sản phẩm', product, bookedOut, inCart, viDate });
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
  const errors = validateProduct(req.body, { hasImage: !!req.file });
  if (errors.length) {
    removeUpload(req.file);
    return res.status(400).render('products/form', formView({
      title: 'Thêm trang phục', product: req.body, action: '/products', method: 'POST', back, errors,
    }));
  }
  try {
    const data = pickBody(req.body);
    data.PathImage = '/uploads/' + req.file.filename;
    const created = await Product.create(data);
    req.flash('success', `Đã thêm "${created.ProductName}" — sản phẩm mới hiển thị ở đầu danh sách.`);
    // 7: quay về TRANG 1 của danh sách (SP mới nằm đầu)
    const listPath = back.split('?')[0];
    res.redirect(listPath === '/products/manage' ? `/products/manage?new=${created.ProductID}` : listPath);
  } catch (e) {
    removeUpload(req.file);
    req.flash('error', 'Lỗi khi thêm: ' + e.message);
    res.redirect('/products/new');
  }
};

// Form Sửa — nhớ trang danh sách để quay về
exports.editForm = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Không tìm thấy' });
  res.render('products/form', formView({
    title: 'Cập nhật trang phục', product,
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
    const errors = validateProduct(req.body, { hasImage: !!req.file || !!product.PathImage });
    // Không cho giảm số bộ xuống dưới số bộ khách đang giữ cùng lúc (tránh trùng lịch)
    const newQty = Number(req.body.Quantity);
    if (!errors.length && newQty < product.Quantity) {
      const peak = await peakFutureUsage(product.ProductID);
      if (newQty < peak) errors.push(`Không thể giảm số lượng xuống ${newQty}: đang có ${peak} ${product.Unit} được khách đặt cùng lúc. Tối thiểu là ${peak}.`);
    }
    if (errors.length) {
      removeUpload(req.file);
      return res.status(400).render('products/form', formView({
        title: 'Cập nhật trang phục',
        product: { ...req.body, ProductID: product.ProductID, PathImage: product.PathImage },
        action: `/products/${product.ProductID}?_method=PUT`, method: 'POST', back, errors,
      }));
    }
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
    await Product.destroy({ where: { ProductID: id } });
    req.flash('success', 'Đã xóa 1 trang phục.');
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
    const n = await Product.destroy({ where: { ProductID: { [Op.in]: ok } } });
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
  const fields = ['ProductName', 'ProductType', 'Unit', 'Color', 'Size', 'Description', 'PathImage', 'Status'];
  const nums = ['Quantity', 'Price', 'DepositValue', 'LateFeePerDay'];
  for (const f of fields) if (body[f] !== undefined && body[f] !== '') d[f] = String(body[f]).trim();
  for (const f of nums) if (body[f] !== undefined && body[f] !== '') d[f] = Number(body[f]) || 0;
  return d;
}
function toArray(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(Number).filter(Boolean);
}

// Kiểm tra dữ liệu Thêm/Sửa: bắt buộc mọi trường, giá từ 1.000 đ trở lên
function validateProduct(body, { hasImage }) {
  const errors = [];
  const str = (k) => String(body[k] ?? '').trim();
  const required = {
    ProductName: 'Tên trang phục', ProductType: 'Loại', Quantity: 'Số lượng', Unit: 'Đơn vị',
    Price: 'Giá thuê / ngày', DepositValue: 'Tiền cọc', LateFeePerDay: 'Phí phạt trễ / ngày',
    Color: 'Màu sắc', Size: 'Size', Status: 'Tình trạng', Description: 'Mô tả',
  };
  for (const [k, label] of Object.entries(required)) if (!str(k)) errors.push(`Vui lòng nhập "${label}".`);
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
  return errors;
}
function safeBack(v) {
  return typeof v === 'string' && /^\/products(\/manage)?(\?|$)/.test(v) ? v : '/products/manage';
}
function removeUpload(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}
