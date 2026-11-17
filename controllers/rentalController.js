const fs = require('fs');
const { sequelize, Rental, RentalItem, Product } = require('../models');
const { normalizePhone, isValidPhone, isValidCCCD, splitList } = require('../utils/text');
const { todayStr, daysBetween, viDate, isDateStr } = require('../utils/dates');
const { normalize } = require('../utils/text');
const { DAMAGE_RULES, lossAmount } = require('../utils/fees');
const { productAvailability, checkDates } = require('../utils/availability');
const { loadCart, needByVariant, lineKey } = require('./cartController');

const path = require('path');
const { privateDir, uploadDir } = require('../middlewares/upload');

const num = (v) => Number(v) || 0;
const withItems = { include: [{ model: RentalItem, as: 'items', include: [Product] }, Product] };

// Chỉ chủ đơn hoặc nhân viên/admin mới được xem / hủy đơn
const isStaff = (u) => u && (u.role === 'admin' || u.role === 'nhanvien');
const canAccess = (req, rental) => isStaff(req.session.user) || (rental.UserID && rental.UserID === req.session.user.id);
function denied(req, res) {
  req.flash('error', 'Bạn không có quyền xem đơn thuê này.');
  return res.redirect('/rentals');
}

// ===== Đặt thuê toàn bộ giỏ hàng (1 đơn nhiều món) =====
exports.create = async (req, res) => {
  const fail = (msg) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    const { IDCardImage, ...old } = req.body;
    req.session.checkoutOld = old;          // giữ lại dữ liệu khách đã nhập
    req.flash('error', msg);
    return res.redirect('/cart');
  };

  try {
    const { StartDate, EndDate, Note, DeliveryMethod, DeliveryAddress } = req.body;
    const CustomerName = (req.body.CustomerName || '').trim();
    const CustomerPhone = normalizePhone(req.body.CustomerPhone);
    const CustomerIDCard = String(req.body.CustomerIDCard || '').replace(/\s/g, '');

    const { lines, products, removedCount } = await loadCart(req);
    if (removedCount) return fail(`${removedCount} món trong giỏ không còn cho thuê (hoặc không còn size / màu đã chọn) nên đã được bỏ ra. Vui lòng xem lại giỏ trước khi đặt.`);
    if (!lines.length) return fail('Giỏ thuê đang trống.');

    // (loadCart đã bỏ các dòng có size × màu không còn trong kho của mẫu)

    const dateErr = checkDates(StartDate, EndDate);
    if (dateErr) return fail(dateErr);
    const rentDays = daysBetween(StartDate, EndDate);

    // Thông tin khách: họ tên, SĐT di động VN, CCCD 12 số
    if (CustomerName.length < 2) return fail('Vui lòng nhập họ tên.');
    if (!isValidPhone(CustomerPhone)) return fail('Số điện thoại không hợp lệ: phải gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
    if (!isValidCCCD(CustomerIDCard)) return fail('Số CCCD không hợp lệ: phải gồm đúng 12 chữ số (3 số đầu là mã tỉnh 001–096).');
    if (DeliveryMethod === 'Giao tận nơi' && (DeliveryAddress || '').trim().length < 10) {
      return fail('Vui lòng nhập địa chỉ nhận hàng đầy đủ (số nhà, đường, phường/xã, quận/huyện, tỉnh/TP).');
    }
    if (req.body.agree !== '1') return fail('Vui lòng đọc và đồng ý nội quy thuê đồ trước khi đặt.');

    // Kiểm tra trùng lịch THEO TỪNG SIZE × MÀU + tạo đơn trong 1 transaction (tránh 2 khách cùng giữ 1 bộ)
    const need = needByVariant(lines);
    const rental = await sequelize.transaction(async (t) => {
      const avail = await productAvailability(products, StartDate, EndDate, { transaction: t });
      const freeOf = (l) => (avail[l.productId].variants.find(v => v.Size === l.size && v.Color === l.color) || { free: 0 }).free;
      const short = lines.filter(l => need[lineKey(l)] > freeOf(l));
      if (short.length) {
        const range = `từ ${viDate(StartDate)} đến ${viDate(EndDate)}`;
        const e = new Error(short.map(l => {
          const f = freeOf(l), what = `"${l.product.ProductName}" size ${l.size} – ${l.color}`;
          return f > 0 ? `${what} chỉ còn ${f} ${l.product.Unit} trống ${range}` : `${what} đã kín lịch ${range}`;
        }).join('; ') + '. Vui lòng đổi ngày, đổi size hoặc giảm số lượng.');
        e.userFacing = true;
        throw e;
      }

      let pricePerDay = 0, deposit = 0, totalQty = 0;
      for (const l of lines) {
        pricePerDay += num(l.product.Price) * l.qty;
        deposit += num(l.product.DepositValue) * l.qty;
        totalQty += l.qty;
      }
      const r = await Rental.create({
        ProductID: lines[0].productId,
        UserID: req.session.user ? req.session.user.id : null,
        CustomerName, CustomerPhone, CustomerIDCard,
        IDCardImage: req.file ? req.file.filename : null,   // file trong private_uploads/
        DeliveryMethod: DeliveryMethod === 'Giao tận nơi' ? 'Giao tận nơi' : 'Tự đến lấy',
        DeliveryAddress: DeliveryMethod === 'Giao tận nơi' ? DeliveryAddress.trim() : null,
        StartDate, EndDate, RentDays: rentDays, Quantity: totalQty,
        PricePerDay: pricePerDay,
        RentFee: pricePerDay * rentDays,
        Deposit: deposit,
        PaymentMethod: ['Tiền mặt', 'Chuyển khoản', 'Ví điện tử'].includes(req.body.method) ? req.body.method : 'Tiền mặt',
        PaymentStatus: 'Đã cọc',
        Status: 'Đã cọc',
        TermsAcceptedAt: new Date(),
        Note,
      }, { transaction: t });

      await RentalItem.bulkCreate(lines.map(l => ({
        RentalID: r.RentalID, ProductID: l.productId, ProductName: l.product.ProductName,
        Size: l.size || null, Color: l.color || null, Quantity: l.qty,
        PricePerDay: num(l.product.Price), DepositPerUnit: num(l.product.DepositValue),
        LateFeePerDay: num(l.product.LateFeePerDay),
      })), { transaction: t });
      return r;
    });

    req.session.cart = [];
    req.flash('success', `Đặt thuê thành công ${rental.Quantity} món! Đã cọc ${num(rental.Deposit).toLocaleString('vi-VN')} đ (${rental.PaymentMethod}). Đơn được giữ chỗ.`);
    res.redirect(`/rentals/${rental.RentalID}`);
  } catch (e) {
    return fail(e.userFacing ? e.message : 'Lỗi đặt thuê: ' + e.message);
  }
};

// ===== Xem đơn thuê / hóa đơn =====
exports.show = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  if (!canAccess(req, rental)) return denied(req, res);
  rental.alert = alertOf(rental);
  let damageDetails = [];
  try { damageDetails = JSON.parse(rental.DamageDetails || '[]'); } catch (_) { damageDetails = []; }
  res.render('rentals/show', { title: `Đơn thuê #${rental.RentalID}`, rental, damageDetails });
};

// ===== Ảnh CCCD (riêng tư): chỉ chủ đơn / nhân viên =====
exports.idCardImage = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id);
  if (!rental || !rental.IDCardImage) return res.status(404).render('404', { title: 'Không tìm thấy ảnh' });
  if (!canAccess(req, rental)) return denied(req, res);
  // Đơn mới: chỉ lưu tên file trong thư mục riêng tư; đơn cũ: đường dẫn /uploads/...
  const file = rental.IDCardImage.startsWith('/uploads/')
    ? path.join(uploadDir, path.basename(rental.IDCardImage))
    : path.join(privateDir, path.basename(rental.IDCardImage));
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(file, (err) => { if (err && !res.headersSent) res.status(404).render('404', { title: 'Không tìm thấy ảnh' }); });
};

// ===== Hủy đơn (tính phí hủy theo mốc ngày) =====
exports.cancel = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  if (!canAccess(req, rental)) return denied(req, res);
  if (['Đang thuê', 'Hoàn tất', 'Đã hủy'].includes(rental.Status)) {
    req.flash('error', 'Đơn này không thể hủy.'); return res.redirect(`/rentals/${rental.RentalID}`);
  }

  const daysToStart = daysBetween(todayStr(), rental.StartDate);
  let cancelFee = 0;
  if (daysToStart >= 3) cancelFee = 0;                       // hoàn 100% cọc
  else if (daysToStart >= 1) cancelFee = Math.round(num(rental.Deposit) * 0.5); // giữ 50%
  else cancelFee = num(rental.Deposit);                      // mất cọc

  rental.CancelFee = cancelFee;
  rental.RefundAmount = rental.PaymentStatus === 'Đã cọc' ? num(rental.Deposit) - cancelFee : 0;
  rental.Status = 'Đã hủy';                                  // hủy => các bộ tự trống lại theo lịch
  await rental.save();

  req.flash('success', `Đã hủy đơn. Phí hủy: ${cancelFee.toLocaleString('vi-VN')} đ. Hoàn lại: ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect(`/rentals/${rental.RentalID}`);
};

// Cảnh báo theo ngày: quá hạn trả, quá ngày nhận mà chưa lấy đồ, hôm nay giao / hôm nay trả
function alertOf(r, today = todayStr()) {
  if (r.Status === 'Đang thuê' && r.EndDate < today) return { level: 'danger', text: `Quá hạn trả ${daysBetween(r.EndDate, today)} ngày`, overdue: true };
  if (r.Status === 'Đã cọc' && r.StartDate < today) return { level: 'warning', text: `Quá ngày nhận ${daysBetween(r.StartDate, today)} ngày, chưa lấy đồ`, overdue: true };
  if (r.Status === 'Đang thuê' && r.EndDate === today) return { level: 'info', text: 'Hạn trả hôm nay' };
  if (r.Status === 'Đã cọc' && r.StartDate === today) return { level: 'info', text: 'Nhận đồ hôm nay' };
  return null;
}
exports.alertOf = alertOf;

const STATUS_TABS = ['Đã cọc', 'Đang thuê', 'Hoàn tất', 'Đã hủy'];
const PAGE_SIZE = 15;

// ===== Danh sách đơn thuê: tìm kiếm + lọc trạng thái / quá hạn + phân trang =====
exports.index = async (req, res) => {
  const u = req.session.user;
  const staff = isStaff(u);
  const q = String(req.query.q || '').trim().slice(0, 100);
  const status = String(req.query.status || '');
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const today = todayStr();

  const where = staff ? {} : { UserID: u.id };
  let rentals = await Rental.findAll({ where, ...withItems, order: [['RentalID', 'DESC']] });
  rentals.forEach(r => { r.alert = alertOf(r, today); });

  // Đếm cho các tab lọc (trước khi lọc)
  const counts = { all: rentals.length, overdue: rentals.filter(r => r.alert && r.alert.overdue).length };
  for (const s of STATUS_TABS) counts[s] = rentals.filter(r => r.Status === s).length;

  if (status === 'quahan') rentals = rentals.filter(r => r.alert && r.alert.overdue);
  else if (STATUS_TABS.includes(status)) rentals = rentals.filter(r => r.Status === status);

  // Tìm theo mã đơn, tên khách, SĐT, tên trang phục (không phân biệt dấu)
  if (q) {
    const nq = normalize(q.replace(/^#/, ''));
    const digits = q.replace(/\D/g, '');
    rentals = rentals.filter(r =>
      String(r.RentalID) === nq ||
      normalize(r.CustomerName).includes(nq) ||
      (digits.length >= 3 && String(r.CustomerPhone || '').includes(digits)) ||
      r.items.some(it => normalize(it.ProductName).includes(nq)));
  }

  const total = rentals.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = rentals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  res.render('rentals/index', {
    title: 'Đơn thuê', rentals: pageRows, isStaff: staff,
    q, status, page, totalPages, total, counts, STATUS_TABS, today,
  });
};

// ===== Nhân viên: Giao đồ =====
exports.handover = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  // Phải thanh toán cọc xong mới được giao đồ
  if (rental.Status !== 'Đã cọc') {
    req.flash('error', 'Khách chưa thanh toán cọc — không thể giao đồ.');
    return res.redirect('/rentals');
  }
  // Giao sớm hơn ngày nhận sẽ chiếm lịch của những ngày chưa được đặt
  if (rental.StartDate > todayStr()) {
    req.flash('error', `Đơn #${rental.RentalID} chưa đến ngày nhận (${viDate(rental.StartDate)}), chưa thể giao đồ.`);
    return res.redirect('/rentals');
  }
  rental.Status = 'Đang thuê';
  await rental.save();
  req.flash('success', `Đã giao đồ cho đơn #${rental.RentalID}.`);
  res.redirect('/rentals');
};

// ===== Nhân viên: Form nhận đồ trả =====
exports.returnForm = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  if (rental.Status !== 'Đang thuê') { req.flash('error', 'Đơn chưa ở trạng thái đang thuê.'); return res.redirect('/rentals'); }
  res.render('rentals/return', { title: `Nhận trả đơn #${rental.RentalID}`, rental, today: todayStr(), alert: alertOf(rental) });
};

// Tính các khoản trừ theo bảng nội quy từ form nhận trả.
// Form gửi: fee_<ItemID>_<mã phí> = số bộ bị ảnh hưởng; OtherFee + OtherNote cho trường hợp khác.
// (Dùng tên phẳng: kiểu fee[13][...] bị thư viện đọc form biến thành mảng và mất mã món.)
function computeDamage(rental, body) {
  const details = [];
  for (const it of rental.items) {
    for (const rule of DAMAGE_RULES) {
      const raw = String(body[`fee_${it.ItemID}_${rule.code}`] ?? '0').trim() || '0';
      if (!/^\d+$/.test(raw)) return { error: 'Số bộ bị trừ phí phải là số nguyên ≥ 0.' };
      const n = Number(raw);
      if (!n) continue;
      if (n > it.Quantity) return { error: `"${it.ProductName}" chỉ có ${it.Quantity} bộ, không thể trừ phí "${rule.label}" cho ${n} bộ.` };
      const unit = rule.amount ?? lossAmount(it, it.Product);
      details.push({ item: it.ProductName, code: rule.code, label: rule.label, qty: n, unit, amount: unit * n });
    }
  }
  const other = String(body.OtherFee ?? '0').trim() || '0';
  if (!/^\d+$/.test(other)) return { error: 'Phí khác phải là số nguyên ≥ 0.' };
  const note = String(body.OtherNote || '').trim().slice(0, 200);
  if (Number(other) > 0) {
    if (note.length < 3) return { error: 'Vui lòng ghi lý do cho "Phí khác" (VD: mất nón lá đi kèm).' };
    details.push({ item: 'Khác', code: 'khac', label: note, qty: 1, unit: Number(other), amount: Number(other) });
  }
  return { details };
}

// ===== Nhân viên: Xử lý nhận đồ trả (tính phí trễ + hư hỏng, hoàn cọc) =====
exports.receiveReturn = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  if (rental.Status !== 'Đang thuê') { req.flash('error', 'Đơn chưa ở trạng thái đang thuê.'); return res.redirect('/rentals'); }

  // Ngày trả thực tế: phải là ngày hợp lệ, KHÔNG trước ngày nhận và KHÔNG sau hôm nay
  const returnDate = String(req.body.ReturnDate || '');
  const backForm = `/rentals/${rental.RentalID}/return`;
  if (!isDateStr(returnDate)) { req.flash('error', 'Vui lòng chọn ngày trả thực tế.'); return res.redirect(backForm); }
  if (returnDate < rental.StartDate) { req.flash('error', `Ngày trả thực tế không được trước ngày nhận (${viDate(rental.StartDate)}).`); return res.redirect(backForm); }
  if (returnDate > todayStr()) { req.flash('error', 'Ngày trả thực tế không được ở tương lai.'); return res.redirect(backForm); }
  // Phí vệ sinh / hư hỏng: tính theo BẢNG NỘI QUY (utils/fees.js) — nhân viên chỉ chọn số bộ bị ảnh hưởng
  const { details, error } = computeDamage(rental, req.body);
  if (error) { req.flash('error', error); return res.redirect(backForm); }
  const damageFee = details.reduce((s, d) => s + d.amount, 0);

  // Phí trễ = số ngày trễ × tổng (phí trễ/ngày × SL) của các món trong đơn
  const lateDays = Math.max(0, daysBetween(rental.EndDate, returnDate));
  const latePerDay = rental.items.reduce((s, it) => s + num(it.LateFeePerDay) * it.Quantity, 0);
  const lateFee = lateDays * latePerDay;

  rental.ReturnDate = returnDate;
  rental.LateFee = lateFee;
  rental.DamageFee = damageFee;
  rental.DamageDetails = details.length ? JSON.stringify(details) : null;
  rental.RefundAmount = num(rental.Deposit) - lateFee - damageFee; // có thể âm (khách đền thêm)
  rental.Status = 'Hoàn tất';                                      // hoàn tất => các bộ trống lại
  await rental.save();

  req.flash('success', `Đã nhận trả đơn #${rental.RentalID}. Phí trễ ${lateFee.toLocaleString('vi-VN')} đ · Hư hỏng ${damageFee.toLocaleString('vi-VN')} đ · Hoàn cọc ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect('/rentals');
};
