// COMBO & THUÊ THEO NHÓM: khách chọn nhiều size cùng lúc; admin tạo / bật / tắt ưu đãi
const { Op } = require('sequelize');
const { Bundle, Product, ProductVariant } = require('../models');
const { MAX_LINES } = require('./cartController');
const { keyOf } = require('../utils/variants');

const MAX_PRODUCTS = 12;

async function withProducts(bundles) {
  const ids = [...new Set(bundles.flatMap(b => b.productIds()))];
  const products = ids.length ? await Product.findAll({ where: { ProductID: { [Op.in]: ids } }, include: [{ model: ProductVariant, as: 'variants' }] }) : [];
  const byId = new Map(products.map(p => [p.ProductID, p]));
  return bundles.map(b => ({ bundle: b, products: b.productIds().map(id => byId.get(id)).filter(Boolean) }));
}

exports.index = async (req, res) => {
  const list = await withProducts(await Bundle.findAll({ where: { isActive: true }, order: [['BundleID', 'DESC']] }));
  // Combo thiếu 1 mẫu thì không đặt được -> ẩn
  const usable = list
    .map(x => ({ ...x, products: x.products.filter(p => p.Status === 'Còn trống' && p.variants.some(v => v.Quantity > 0)) }))
    .filter(x => (x.bundle.Kind === 'combo' ? x.products.length === x.bundle.productIds().length : x.products.length > 0));
  res.render('bundles/index', { title: 'Combo & thuê theo nhóm', list: usable });
};

// Form gửi: qty_<VariantID> = số bộ
exports.add = async (req, res) => {
  const fail = (msg) => { req.flash('error', msg); return res.redirect('/combo'); };
  const b = await Bundle.findByPk(parseInt(req.params.id) || 0);
  if (!b || !b.isActive) return fail('Ưu đãi này không còn áp dụng.');

  const wanted = new Map();
  for (const [k, v] of Object.entries(req.body)) {
    const m = k.match(/^qty_(\d{1,9})$/), n = Number(v || 0);
    if (!m || !n) continue;
    if (!Number.isInteger(n) || n < 0 || n > 999) return fail('Số bộ phải là số nguyên.');
    wanted.set(Number(m[1]), n);
  }
  if (!wanted.size) return fail('Hãy nhập số bộ cho size bạn cần.');

  const ids = b.productIds();
  const variants = await ProductVariant.findAll({ where: { VariantID: { [Op.in]: [...wanted.keys()] }, ProductID: { [Op.in]: ids } }, include: [Product] });
  if (variants.length !== wanted.size) return fail('Có size / màu không thuộc ưu đãi này.');

  const byProduct = {};
  for (const v of variants) byProduct[v.ProductID] = (byProduct[v.ProductID] || 0) + wanted.get(v.VariantID);
  if (b.Kind === 'combo' && ids.some(id => !byProduct[id])) return fail('Combo cần chọn ít nhất 1 bộ cho mỗi mẫu.');
  const total = Object.values(byProduct).reduce((s, n) => s + n, 0);
  if (b.Kind === 'group' && total < b.MinQty) return fail(`"${b.Name}" cần từ ${b.MinQty} bộ, bạn mới chọn ${total}.`);

  // Kiểm tra hết rồi mới ghi: không để giỏ bị thêm một nửa
  const cart = (req.session.cart || []).map(l => ({ ...l }));
  const chosen = new Set();
  for (const v of variants) {
    const n = wanted.get(v.VariantID), key = keyOf(v.ProductID, v.Size, v.Color);
    const label = `"${v.Product.ProductName}" size ${v.Size} – ${v.Color}`;
    if (v.Product.Status !== 'Còn trống') return fail(`${label} đang ngừng cho thuê.`);
    if (n > v.Quantity) return fail(`${label} không đủ ${n} bộ.`);
    const line = cart.find(l => keyOf(l.productId, l.size, l.color) === key);
    if (line) line.qty = n;
    else cart.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productId: v.ProductID, size: v.Size, color: v.Color, qty: n });
    chosen.add(key);
  }
  if (cart.length > MAX_LINES) return fail(`Giỏ thuê tối đa ${MAX_LINES} dòng. Hãy bỏ bớt món trong giỏ.`);
  for (const l of cart) l.off = !chosen.has(keyOf(l.productId, l.size, l.color));   // chỉ tick các món vừa chọn
  req.session.cart = cart;
  req.flash('success', `Đã đưa "${b.Name}" vào giỏ và chọn sẵn để đặt. Ưu đãi tự trừ ở bước đặt thuê.`);
  res.redirect('/cart');
};

// ----- Admin -----
exports.manage = async (req, res) => {
  const list = await withProducts(await Bundle.findAll({ order: [['BundleID', 'DESC']] }));
  const products = await Product.findAll({ where: { Status: 'Còn trống' }, order: [['ProductType', 'ASC'], ['ProductName', 'ASC']] });
  const old = req.session.bundleOld || {};
  delete req.session.bundleOld;
  res.render('admin/bundles', { title: 'Combo & thuê nhóm', list, products, old, MAX_PRODUCTS });
};

exports.create = async (req, res) => {
  const kind = req.body.Kind === 'group' ? 'group' : 'combo';
  const name = String(req.body.Name || '').trim();
  const description = String(req.body.Description || '').trim();
  const percent = Number(req.body.Percent);
  const minQty = kind === 'group' ? Number(req.body.MinQty) : 1;
  const ids = [...new Set([].concat(req.body.ProductIDs || []).map(Number).filter(Number.isInteger))];
  const fail = (msg) => {
    req.session.bundleOld = { Kind: kind, Name: name, Description: description, Percent: req.body.Percent, MinQty: req.body.MinQty, ids };
    req.flash('error', msg);
    return res.redirect('/admin/bundles');
  };
  if (name.length < 3 || name.length > 100) return fail('Tên ưu đãi từ 3 đến 100 ký tự.');
  if (description.length > 300) return fail('Mô tả tối đa 300 ký tự.');
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) return fail('Phần trăm giảm từ 1 đến 90.');
  if (!ids.length || ids.length > MAX_PRODUCTS) return fail(`Chọn từ 1 đến ${MAX_PRODUCTS} mẫu.`);
  if (kind === 'combo' && ids.length < 2) return fail('Combo cần ít nhất 2 mẫu khác nhau.');
  if (kind === 'group' && (!Number.isInteger(minQty) || minQty < 2 || minQty > 999)) return fail('Thuê nhóm cần số bộ tối thiểu từ 2.');
  if (await Product.count({ where: { ProductID: { [Op.in]: ids } } }) !== ids.length) return fail('Có mẫu không tồn tại.');

  await Bundle.create({ Name: name, Kind: kind, Description: description, Percent: percent, MinQty: minQty, ProductIDs: JSON.stringify(ids), isActive: true });
  req.flash('success', `Đã tạo và bật "${name}".`);
  res.redirect('/admin/bundles');
};

exports.toggle = async (req, res) => {
  const b = await Bundle.findByPk(parseInt(req.params.id) || 0);
  if (b) {
    await b.update({ isActive: !b.isActive });
    req.flash('success', `Đã ${b.isActive ? 'bật' : 'tắt'} "${b.Name}".`);
  }
  res.redirect('/admin/bundles');
};

exports.remove = async (req, res) => {
  const b = await Bundle.findByPk(parseInt(req.params.id) || 0);
  if (b) { await b.destroy(); req.flash('success', `Đã xóa "${b.Name}". Đơn cũ vẫn giữ mức giảm đã tính.`); }
  res.redirect('/admin/bundles');
};
