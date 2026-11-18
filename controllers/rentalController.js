const fs = require('fs');
const { sequelize, Rental, RentalItem, Product, User } = require('../models');
const { normalizePhone, isValidPhone, isValidCCCD, splitList } = require('../utils/text');
const { zoneOf, zoneKeyOf, checkZoneDates } = require('../utils/shipping');
const { todayStr, daysBetween, viDate, isDateStr } = require('../utils/dates');
const { normalize } = require('../utils/text');
const { DAMAGE_RULES, lossAmount } = require('../utils/fees');
const { productAvailability, checkDates } = require('../utils/availability');
const { loadCart, needByVariant, lineKey } = require('./cartController');
const { applyCoupon } = require('../utils/coupons');
const { priceOf } = require('../utils/pricing');
const { ProductVariant } = require('../models');
const { addDays } = require('../utils/dates');
const { notify } = require('../utils/notify');
const FLOW = require('../utils/rentalFlow');
const { amountDue, isDelivery, shipDay, paymentDeadline, isPaid } = FLOW;
const { DEPOSIT_HOLD_HOURS, SHOP_BANK, vietQrUrl } = require('../utils/constants');
const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
const timeVi = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

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
    return res.redirect('/cart/checkout');
  };

  try {
    const { StartDate, EndDate, Note, DeliveryAddress } = req.body;
    // Khu vực nhận đồ -> số ngày vận chuyển mỗi chiều (utils/shipping.js)
    const zoneKey = zoneKeyOf(req.body.DeliveryZone);
    const zone = zoneOf(zoneKey);
    const DeliveryMethod = zone.delivery ? 'Giao tận nơi' : 'Tự đến lấy';
    const CustomerName = (req.body.CustomerName || '').trim();
    const CustomerPhone = normalizePhone(req.body.CustomerPhone);
    const CustomerIDCard = String(req.body.CustomerIDCard || '').replace(/\s/g, '');
    const CustomerAddress = String(req.body.CustomerAddress || '').trim().replace(/\s+/g, ' ');

    const { lines, products, removedCount } = await loadCart(req);
    if (removedCount) return fail(`${removedCount} món trong giỏ không còn cho thuê (hoặc không còn size / màu đã chọn) nên đã được bỏ ra. Vui lòng xem lại giỏ trước khi đặt.`);
    if (!lines.length) return fail('Giỏ thuê đang trống.');

    // (loadCart đã bỏ các dòng có size × màu không còn trong kho của mẫu)

    const dateErr = checkDates(StartDate, EndDate);
    if (dateErr) return fail(dateErr);
    const rentDays = daysBetween(StartDate, EndDate);
    // Giao xa: kịp gửi đồ (ngày nhận ≥ hôm nay + số ngày giao) + thuê đủ số ngày tối thiểu của khu vực
    const zoneErr = checkZoneDates(zone, StartDate, EndDate);
    if (zoneErr) return fail(zoneErr);

    // Thông tin khách: họ tên, SĐT di động VN, CCCD 12 số
    if (CustomerName.length < 2) return fail('Vui lòng nhập họ tên.');
    if (!isValidPhone(CustomerPhone)) return fail('Số điện thoại không hợp lệ: phải gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
    if (!isValidCCCD(CustomerIDCard)) return fail('Số CCCD không hợp lệ: phải gồm đúng 12 chữ số (3 số đầu là mã tỉnh 001–096).');
    if (CustomerAddress.length < 10 || CustomerAddress.length > 255) return fail('Vui lòng nhập địa chỉ của bạn (số nhà, đường, phường/xã, quận/huyện, tỉnh/TP).');
    if (DeliveryMethod === 'Giao tận nơi' && (DeliveryAddress || '').trim().length < 10) {
      return fail('Vui lòng nhập địa chỉ nhận hàng đầy đủ (số nhà, đường, phường/xã, quận/huyện, tỉnh/TP).');
    }
    if (req.body.agree !== '1') return fail('Vui lòng đọc và đồng ý nội quy thuê đồ trước khi đặt.');
    const payMethod = req.body.method === FLOW.PAY.BANK ? FLOW.PAY.BANK : FLOW.PAY.COD;

    // Kiểm tra trùng lịch THEO TỪNG SIZE × MÀU + tạo đơn trong 1 transaction (tránh 2 khách cùng giữ 1 bộ)
    const need = needByVariant(lines);
    const rental = await sequelize.transaction(async (t) => {
      const avail = await productAvailability(products, StartDate, EndDate, { transaction: t, shipDays: zone.days });
      const freeOf = (l) => (avail[l.productId].variants.find(v => v.Size === l.size && v.Color === l.color) || { free: 0 }).free;
      const short = lines.filter(l => need[lineKey(l)] > freeOf(l));
      if (short.length) {
        const range = `từ ${viDate(StartDate)} đến ${viDate(EndDate)}`;
        const e = new Error(short.map(l => {
          const f = freeOf(l), what = `"${l.product.ProductName}" size ${l.size} – ${l.color}`;
          return f > 0 ? `${what} không đủ số bộ trống ${range}` : `${what} đã kín lịch ${range}`;
        }).join('; ') + '. Vui lòng đổi ngày, đổi size hoặc giảm số lượng.');
        e.userFacing = true;
        throw e;
      }

      let pricePerDay = 0, deposit = 0, totalQty = 0;
      for (const l of lines) {
        pricePerDay += priceOf(l.product) * l.qty;   // giá sale nếu đang khuyến mãi
        deposit += num(l.product.DepositValue) * l.qty;
        totalQty += l.qty;
      }
      // Mã giảm giá (không bắt buộc): chỉ trừ vào tiền thuê, kiểm tra lại trong transaction
      const rentFee = pricePerDay * rentDays;
      let couponCode = null, discount = 0;
      if (String(req.body.CouponCode || '').trim()) {
        const cp = await applyCoupon(req.body.CouponCode, req.session.user.id, rentFee, { transaction: t });
        if (cp.error) { const e = new Error(cp.error + ' Bạn có thể xóa mã để đặt không dùng mã.'); e.userFacing = true; throw e; }
        couponCode = cp.coupon.Code; discount = cp.discount;
      }

      const r = await Rental.create({
        ProductID: lines[0].productId,
        UserID: req.session.user ? req.session.user.id : null,
        CustomerName, CustomerPhone, CustomerIDCard, CustomerAddress,
        IDCardImage: req.file ? req.file.filename : null,   // file trong private_uploads/
        DeliveryMethod, DeliveryZone: zoneKey, ShipDays: zone.days,
        DeliveryAddress: DeliveryMethod === 'Giao tận nơi' ? DeliveryAddress.trim() : null,
        StartDate, EndDate, RentDays: rentDays, Quantity: totalQty,
        PricePerDay: pricePerDay,
        RentFee: rentFee,
        CouponCode: couponCode,
        Discount: discount,
        Deposit: deposit,
        // Khách trả 1 lần = tiền thuê − giảm giá + tiền cọc.
        // COD: trả khi nhận đồ -> giữ chỗ ngay ("Đã cọc" = chờ giao đồ). Chuyển khoản: chờ thanh toán tới hạn.
        PaymentMethod: payMethod,
        PaymentStatus: payMethod === FLOW.PAY.COD ? 'Thu khi nhận đồ' : 'Chưa thanh toán',
        Status: payMethod === FLOW.PAY.COD ? 'Đã cọc' : 'Chờ cọc',
        TermsAcceptedAt: new Date(),
        Note,
      }, { transaction: t });

      await RentalItem.bulkCreate(lines.map(l => ({
        RentalID: r.RentalID, ProductID: l.productId, ProductName: l.product.ProductName,
        Size: l.size || null, Color: l.color || null, Quantity: l.qty,
        PricePerDay: priceOf(l.product), DepositPerUnit: num(l.product.DepositValue),
        LateFeePerDay: num(l.product.LateFeePerDay),
      })), { transaction: t });
      return r;
    });

    req.session.cart = [];
    delete req.session.couponCode;          // mã đã dùng cho đơn này
    // Tài khoản chưa lưu SĐT / CCCD / địa chỉ -> lưu lại để lần sau tự điền (không ghi đè thông tin đã có)
    if (req.session.user) {
      const u = await User.findByPk(req.session.user.id);
      if (u) {
        const fill = {};
        if (!u.phone) fill.phone = CustomerPhone;
        if (!u.idCardNumber) fill.idCardNumber = CustomerIDCard;
        if (!u.address) fill.address = CustomerAddress;
        if (Object.keys(fill).length) await u.update(fill);
      }
    }
    const due = vnd(amountDue(rental));
    const promo = rental.CouponCode ? ` Mã ${rental.CouponCode} đã giảm ${vnd(rental.Discount)} tiền thuê.` : '';
    if (rental.Status === 'Chờ cọc') {
      const deadline = timeVi(paymentDeadline(rental));
      req.flash('success', `Đặt thuê thành công! Vui lòng chuyển khoản ${due} (tiền thuê + tiền cọc) trong ${FLOW.PAY_MINUTES} phút rồi bấm "Tôi đã chuyển khoản" — quá ${FLOW.PAY_MINUTES} phút đơn tự hủy.` + promo);
      await notify(rental, { level: 'warning', title: `Đơn #${rental.RentalID} chờ chuyển khoản`,
        message: `Chuyển khoản ${due} trước ${deadline} và bấm "Tôi đã chuyển khoản" trên trang đơn. Quá hạn đơn tự hủy.` });
    } else {
      const when = isDelivery(rental) ? `shop gửi đồ ngày ${viDate(shipDay(rental))}, bạn nhận ngày ${viDate(rental.StartDate)}` : `nhận đồ tại cửa hàng ngày ${viDate(rental.StartDate)}`;
      req.flash('success', `Đặt thuê thành công ${rental.Quantity} món! Thanh toán ${due} khi nhận đồ (COD) — ${when}.` + promo);
      await notify(rental, { level: 'success', title: `Đặt thuê thành công — đơn #${rental.RentalID}`,
        message: `Đơn đã được giữ chỗ: ${when}. Thanh toán ${due} (tiền thuê + tiền cọc) khi nhận đồ.` });
    }
    res.redirect(`/rentals/${rental.RentalID}?new=1`);   // bước 3: hoàn tất
  } catch (e) {
    return fail(e.userFacing ? e.message : 'Lỗi đặt thuê: ' + e.message);
  }
};

// ===== Xem đơn thuê / hóa đơn =====
exports.show = async (req, res) => {
  await require('../utils/notify').expirePending();   // hết 5 phút giữ chỗ -> hủy ngay khi mở trang đơn
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  if (!canAccess(req, rental)) return denied(req, res);
  rental.alert = alertOf(rental);
  let damageDetails = [];
  try { damageDetails = JSON.parse(rental.DamageDetails || '[]'); } catch (_) { damageDetails = []; }
  // Đổi size: các size × màu khác của từng món, kèm số bộ còn trống trong thời gian thuê của đơn
  const swap = swapRule(req, rental);
  let swapOptions = {};
  if (swap.ok) {
    const products = rental.items.filter(it => it.Product).map(it => it.Product);
    const { start, end } = swapRange(rental);
    const avail = await productAvailability(products, start, end, { shipDays: rental.ShipDays || 0 });
    for (const it of rental.items) {
      if (!it.Product) continue;
      swapOptions[it.ItemID] = avail[it.ProductID].variants
        .filter(v => v.total > 0 && !(v.Size === it.Size && v.Color === it.Color))
        .map(v => ({ Size: v.Size, Color: v.Color, free: v.free }));
    }
  }
  // Khách đã thuê xong: nhắc đánh giá các mẫu chưa đánh giá
  let reviewed = new Set();
  if (rental.Status === 'Hoàn tất' && rental.UserID && rental.UserID === req.session.user.id) {
    const { Review } = require('../models');
    const rows = await Review.findAll({ where: { UserID: rental.UserID }, attributes: ['ProductID'] });
    reviewed = new Set(rows.map(r => r.ProductID));
  }
  res.render('rentals/show', {
    title: `Đơn thuê #${rental.RentalID}`, rental, damageDetails, swap, swapOptions, reviewed, isOwner: rental.UserID === req.session.user.id,
    isStaff: isStaff(req.session.user), SHOP_BANK, DEPOSIT_HOLD_HOURS, deadline: rental.Status === 'Chờ cọc' ? timeVi(paymentDeadline(rental)) : null, today: todayStr(),
    // Mã QR chuyển khoản: nội dung CH<mã đơn> (không đưa SĐT khách ra dịch vụ ngoài)
    qrUrl: rental.Status === 'Chờ cọc' ? vietQrUrl(amountDue(rental), `CH${rental.RentalID}`) : null,
    isNew: req.query.new === '1' && rental.UserID === req.session.user.id,   // vừa đặt xong -> hiện bước 3 Hoàn tất
  });
};

// ===== CHÍNH SÁCH ĐỔI SIZE =====
// - Đơn "Đã cọc" (chưa nhận đồ): khách (chủ đơn) hoặc nhân viên đổi size / màu MIỄN PHÍ, nếu size mới còn trống.
// - Đơn "Đang thuê": chỉ NHÂN VIÊN đổi, trong ngày nhận đồ hoặc ngày hôm sau (khách thử không vừa, mang ra shop đổi).
// - Chỉ đổi sang size × màu khác của CÙNG mẫu (giá thuê, cọc không đổi). Mẫu khác thì hủy món / đặt đơn mới.
const SWAP_DAYS_AFTER_PICKUP = 1;
function swapRule(req, rental) {
  const u = req.session.user, staff = isStaff(u);
  if (rental.Status === 'Đang giao' || rental.Status === 'Đang gửi trả') return { ok: false, reason: 'Đồ đang được vận chuyển, chưa đổi size được.' };
  // Đơn ngoại tỉnh: chỉ đổi size khi đồ CHƯA gửi đi (trước ngày gửi = ngày nhận − số ngày vận chuyển)
  const zone = zoneOf(rental.DeliveryZone);
  if (!zone.swapAfterShip) {
    const shipDay = addDays(rental.StartDate, -(rental.ShipDays || 0));
    if (rental.Status === 'Đang thuê' || todayStr() >= shipDay) {
      return { ok: false, reason: `${zone.label}: không đổi size sau khi đồ đã gửi đi (từ ngày ${viDate(shipDay)}) vì vận chuyển 2 chiều không kịp.` };
    }
  }
  if (rental.Status === 'Chờ cọc' || rental.Status === 'Đã cọc') return { ok: staff || rental.UserID === u.id };
  if (rental.Status === 'Đang thuê') {
    const last = addDays(rental.StartDate, SWAP_DAYS_AFTER_PICKUP);
    if (todayStr() > last) return { ok: false, reason: `Đã quá thời hạn đổi size (đến hết ngày ${viDate(last)}).` };
    return staff ? { ok: true } : { ok: false, reason: `Mang đồ đến cửa hàng trước hết ngày ${viDate(last)} để nhân viên đổi size giúp bạn.` };
  }
  return { ok: false };
}
exports.SWAP_DAYS_AFTER_PICKUP = SWAP_DAYS_AFTER_PICKUP;
// Khoảng ngày cần còn trống cho size mới: từ hôm nay (nếu đã nhận đồ) đến ngày trả
function swapRange(rental) {
  const today = todayStr();
  return { start: rental.StartDate > today ? rental.StartDate : today, end: rental.EndDate < today ? today : rental.EndDate };
}

exports.changeSize = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  if (!canAccess(req, rental)) return denied(req, res);
  const backTo = `/rentals/${rental.RentalID}`;
  const swap = swapRule(req, rental);
  if (!swap.ok) { req.flash('error', swap.reason || 'Đơn ở trạng thái này không đổi size được.'); return res.redirect(backTo); }

  const it = rental.items.find(i => i.ItemID === parseInt(req.body.ItemID));
  if (!it || !it.ProductID) { req.flash('error', 'Không tìm thấy món cần đổi trong đơn.'); return res.redirect(backTo); }
  const [size, color] = String(req.body.Target || '').split('|');
  const n = parseInt(req.body.Qty) || it.Quantity;
  if (!size || !color) { req.flash('error', 'Vui lòng chọn size / màu muốn đổi sang.'); return res.redirect(backTo); }
  if (size === it.Size && color === it.Color) { req.flash('error', 'Size / màu mới trùng với size đang thuê.'); return res.redirect(backTo); }
  if (!(n >= 1 && n <= it.Quantity)) { req.flash('error', `Số bộ đổi phải từ 1 đến ${it.Quantity}.`); return res.redirect(backTo); }

  const from = `${it.Size} · ${it.Color}`;   // ghi lại size cũ trước khi đổi (để ghi chú đơn)
  try {
    await sequelize.transaction(async (t) => {
      const v = await ProductVariant.findOne({ where: { ProductID: it.ProductID, Size: size, Color: color }, transaction: t });
      if (!v || v.Quantity <= 0) throw Object.assign(new Error(`Mẫu này không có size ${size} màu ${color}.`), { userFacing: true });
      const { start, end } = swapRange(rental);
      const a = (await productAvailability([it.Product], start, end, { transaction: t, shipDays: rental.ShipDays || 0 }))[it.ProductID];
      const free = (a.variants.find(x => x.Size === size && x.Color === color) || { free: 0 }).free;
      if (free < n) throw Object.assign(new Error(`Size ${size} – ${color} không đủ số bộ trống từ ${viDate(start)} đến ${viDate(end)} để đổi ${n} bộ.`), { userFacing: true });

      const target = rental.items.find(x => x.ItemID !== it.ItemID && x.ProductID === it.ProductID && x.Size === size && x.Color === color);
      if (n === it.Quantity && !target) {
        await it.update({ Size: size, Color: color }, { transaction: t });
      } else {
        if (target) await target.update({ Quantity: target.Quantity + n }, { transaction: t });
        else await RentalItem.create({ ...it.toJSON(), ItemID: undefined, Size: size, Color: color, Quantity: n }, { transaction: t });
        if (n === it.Quantity) await it.destroy({ transaction: t });
        else await it.update({ Quantity: it.Quantity - n }, { transaction: t });
      }
      const who = isStaff(req.session.user) ? 'nhân viên' : 'khách';
      const line = `[${viDate(todayStr())}] Đổi size (${who}): "${it.ProductName}" ${n} bộ ${from} → ${size} · ${color}.`;
      await rental.update({ Note: [rental.Note, line].filter(Boolean).join('\n') }, { transaction: t });
    });
  } catch (e) {
    req.flash('error', e.userFacing ? e.message : 'Lỗi đổi size: ' + e.message);
    return res.redirect(backTo);
  }
  if (isStaff(req.session.user) && rental.UserID !== req.session.user.id) {
    await notify(rental, { title: `Đơn #${rental.RentalID}: đã đổi size`, message: `Cửa hàng đã đổi "${it.ProductName}" ${n} bộ ${from} sang size ${size} · ${color} theo yêu cầu của bạn.` });
  }
  req.flash('success', `Đã đổi "${it.ProductName}" sang size ${size} – ${color}. Giá thuê và tiền cọc không thay đổi.`);
  res.redirect(backTo);
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
  if (!['Chờ cọc', 'Đã cọc', 'Đã đặt'].includes(rental.Status)) {
    req.flash('error', rental.Status === 'Đang giao' ? 'Đồ đã được gửi đi, không thể hủy đơn.' : 'Đơn này không thể hủy.');
    return res.redirect(`/rentals/${rental.RentalID}`);
  }

  // Phí hủy tính trên tiền cọc theo số ngày trước ngày nhận; chỉ trừ khi khách ĐÃ trả tiền (chuyển khoản).
  // COD chưa thu tiền -> không có gì để trừ.
  const daysToStart = daysBetween(todayStr(), rental.StartDate);
  const paid = isPaid(rental);
  let cancelFee = 0;
  if (!paid) cancelFee = 0;
  else if (daysToStart >= 3) cancelFee = 0;                  // hoàn 100%
  else if (daysToStart >= 1) cancelFee = Math.round(num(rental.Deposit) * 0.5); // giữ 50% tiền cọc
  else cancelFee = num(rental.Deposit);                      // mất tiền cọc

  rental.CancelFee = cancelFee;
  rental.RefundAmount = paid ? amountDue(rental) - cancelFee : 0;
  rental.Status = 'Đã hủy';                                  // hủy => các bộ tự trống lại theo lịch
  await rental.save();
  const byStaff = isStaff(req.session.user) && rental.UserID !== req.session.user.id;
  await notify(rental, { level: 'danger', title: `Đơn #${rental.RentalID} đã hủy${byStaff ? ' bởi cửa hàng' : ''}`,
    message: `Phí hủy ${vnd(cancelFee)} · hoàn lại ${vnd(rental.RefundAmount)}.` });

  req.flash('success', `Đã hủy đơn. Phí hủy: ${cancelFee.toLocaleString('vi-VN')} đ. Hoàn lại: ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect(`/rentals/${rental.RentalID}`);
};

// Cảnh báo theo ngày (danh sách đơn, trang đơn, Việc hôm nay)
function alertOf(r, today = todayStr()) {
  const deli = isDelivery(r), sd = shipDay(r);
  if (r.Status === 'Chờ cọc') {
    if (FLOW.transferClaimed(r)) return { level: 'danger', text: 'Khách báo đã chuyển khoản — kiểm tra tài khoản & xác nhận' };
    const left = Math.max(0, Math.ceil((paymentDeadline(r) - Date.now()) / 60e3));
    return { level: 'warning', text: `Chờ chuyển khoản · còn ${left} phút` };
  }
  if (r.Status === 'Đã cọc') {
    if (deli && sd < today) return { level: 'danger', text: `Quá ngày gửi đồ ${daysBetween(sd, today)} ngày`, overdue: true };
    if (deli && sd === today) return { level: 'info', text: 'Hôm nay đóng đơn, gửi shipper' };
    if (!deli && r.StartDate < today) return { level: 'warning', text: `Quá ngày nhận ${daysBetween(r.StartDate, today)} ngày, chưa lấy đồ`, overdue: true };
    if (!deli && r.StartDate === today) return { level: 'info', text: 'Khách đến lấy hôm nay' };
  }
  if (r.Status === 'Đang giao' && r.StartDate < today) return { level: 'warning', text: 'Quá ngày nhận, chưa xác nhận khách đã nhận đồ', overdue: true };
  if (r.Status === 'Đang thuê' && r.EndDate < today) return { level: 'danger', text: `Quá hạn ${deli ? 'gửi trả' : 'trả'} ${daysBetween(r.EndDate, today)} ngày`, overdue: true };
  if (r.Status === 'Đang thuê' && r.EndDate === today) return { level: 'info', text: deli ? 'Hôm nay khách gửi trả' : 'Hạn trả hôm nay' };
  if (r.Status === 'Đang gửi trả') {
    const back = FLOW.backDay(r);
    if (back < today) return { level: 'warning', text: `Quá ngày dự kiến về shop (${viDate(back)})`, overdue: true };
    return { level: 'info', text: `Dự kiến về shop ${viDate(back)}` };
  }
  return null;
}
exports.alertOf = alertOf;

const STATUS_TABS = FLOW.ORDER;
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

// ===== GIAO — NHẬN ĐỒ =====
const loadOr404 = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); res.redirect('/rentals'); return null; }
  return rental;
};
// COD: tiền thu khi khách nhận đồ -> đánh dấu đã thanh toán
const collectCod = (rental) => { if (rental.PaymentMethod === FLOW.PAY.COD && !isPaid(rental)) { rental.PaymentStatus = 'Đã thanh toán'; rental.DepositPaidAt = new Date(); } };
const SHIP_NOTE = 'gọi đơn vị vận chuyển tới lấy hoặc gửi tại bưu cục';

// Nhân viên: khách TỰ ĐẾN LẤY đồ tại shop (Chờ giao đồ -> Đang thuê)
exports.handover = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  if (rental.Status !== 'Đã cọc') {
    req.flash('error', rental.Status === 'Chờ cọc' ? `Đơn #${rental.RentalID} chưa thanh toán — xác nhận đã nhận tiền rồi mới giao đồ.` : 'Đơn này không ở trạng thái chờ giao đồ.');
    return res.redirect(safeBack(req, '/rentals'));
  }
  if (isDelivery(rental)) { req.flash('error', `Đơn #${rental.RentalID} giao tận nơi — bấm "Đã gửi shipper" và nhập mã vận đơn.`); return res.redirect(`/rentals/${rental.RentalID}`); }
  // Giao sớm hơn ngày nhận sẽ chiếm lịch của những ngày chưa được đặt
  if (rental.StartDate > todayStr()) {
    req.flash('error', `Đơn #${rental.RentalID} chưa đến ngày nhận (${viDate(rental.StartDate)}), chưa thể giao đồ.`);
    return res.redirect(safeBack(req, '/rentals'));
  }
  const cod = rental.PaymentMethod === FLOW.PAY.COD && !isPaid(rental);
  collectCod(rental);
  rental.Status = 'Đang thuê';
  await rental.save();
  await notify(rental, { level: 'success', title: `Đã nhận đồ — đơn #${rental.RentalID}`,
    message: `Bạn đã nhận đồ. Hạn trả: ${viDate(rental.EndDate)}. Không vừa size? Mang đến cửa hàng trong ngày nhận hoặc ngày hôm sau để đổi miễn phí.` });
  req.flash('success', `Đã giao đồ cho đơn #${rental.RentalID}.${cod ? ` Đã thu ${vnd(amountDue(rental))} (COD).` : ''}`);
  res.redirect(safeBack(req, '/rentals'));
};

// Nhân viên: đã đóng đơn, giao cho shipper (Chờ giao đồ -> Đang giao), nhập đơn vị vận chuyển + mã vận đơn
exports.ship = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  const back = safeBack(req, `/rentals/${rental.RentalID}`);
  if (rental.Status !== 'Đã cọc' || !isDelivery(rental)) { req.flash('error', 'Đơn này không ở trạng thái chờ gửi đồ.'); return res.redirect(back); }
  const sd = shipDay(rental);
  // Gửi sớm hơn ngày gửi sẽ chiếm lịch những ngày chưa được giữ cho đơn này
  if (todayStr() < sd) { req.flash('error', `Đơn #${rental.RentalID} gửi đồ từ ngày ${viDate(sd)}.`); return res.redirect(back); }
  const carrier = String(req.body.Carrier || '').trim().slice(0, 50);
  const code = String(req.body.TrackingCode || '').trim().slice(0, 50);
  if (!carrier) { req.flash('error', 'Vui lòng chọn đơn vị vận chuyển.'); return res.redirect(back); }
  if (code.length < 3) { req.flash('error', 'Vui lòng nhập mã vận đơn (hoặc SĐT shipper với giao nội thành).'); return res.redirect(back); }
  Object.assign(rental, { Status: 'Đang giao', Carrier: carrier, TrackingCode: code, ShippedAt: todayStr() });
  await rental.save();
  await notify(rental, { level: 'info', title: `Đơn #${rental.RentalID} đang được giao`,
    message: `Shop đã gửi đồ qua ${carrier} — mã vận đơn ${code}. Bạn nhận đồ ngày ${viDate(rental.StartDate)}${rental.PaymentMethod === FLOW.PAY.COD && !isPaid(rental) ? `, thanh toán ${vnd(amountDue(rental))} cho shipper` : ''}.` });
  req.flash('success', `Đơn #${rental.RentalID} đã giao cho ${carrier} (mã ${code}).`);
  res.redirect(back);
};

// Khách (chủ đơn) hoặc nhân viên: đã nhận được đồ (Đang giao -> Đang thuê)
exports.delivered = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  if (!canAccess(req, rental)) return denied(req, res);
  const back = safeBack(req, `/rentals/${rental.RentalID}`);
  if (rental.Status !== 'Đang giao') { req.flash('error', 'Đơn này không ở trạng thái đang giao.'); return res.redirect(back); }
  collectCod(rental);
  rental.Status = 'Đang thuê';
  await rental.save();
  await notify(rental, { level: 'success', title: `Đã nhận đồ — đơn #${rental.RentalID}`,
    message: `Ngày ${viDate(rental.EndDate)} vui lòng gửi trả đồ (${SHIP_NOTE}) và nhập mã vận đơn trên trang đơn.` });
  req.flash('success', `Đã xác nhận nhận đồ cho đơn #${rental.RentalID}.`);
  res.redirect(back);
};

// Khách (chủ đơn) hoặc nhân viên: đã gửi trả đồ (Đang thuê -> Đang gửi trả), nhập mã vận đơn chiều về
exports.sentBack = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  if (!canAccess(req, rental)) return denied(req, res);
  const back = safeBack(req, `/rentals/${rental.RentalID}`);
  if (rental.Status !== 'Đang thuê' || !isDelivery(rental)) { req.flash('error', 'Đơn này không ở trạng thái gửi trả.'); return res.redirect(back); }
  const code = String(req.body.ReturnTrackingCode || '').trim().slice(0, 50);
  if (code.length < 3) { req.flash('error', 'Vui lòng nhập mã vận đơn gửi trả (hoặc SĐT shipper đến lấy).'); return res.redirect(back); }
  Object.assign(rental, { Status: 'Đang gửi trả', ReturnTrackingCode: code, ReturnSentDate: todayStr() });
  await rental.save();
  await notify(rental, { level: 'info', title: `Đơn #${rental.RentalID}: đã gửi trả`,
    message: `Đã ghi nhận bạn gửi trả ngày ${viDate(rental.ReturnSentDate)} (mã ${code}). Shop nhận lại, kiểm tra xong sẽ hoàn cọc.` });
  req.flash('success', `Đã ghi nhận gửi trả đơn #${rental.RentalID} (mã ${code}).`);
  res.redirect(back);
};

// ===== Khách: "Tôi đã chuyển khoản" (trong thời gian giữ chỗ) -> không tự hủy, chờ nhân viên xác nhận =====
exports.claimTransfer = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  if (!canAccess(req, rental)) return denied(req, res);
  const back = `/rentals/${rental.RentalID}`;
  if (rental.Status !== 'Chờ cọc') { req.flash('error', 'Đơn này không ở trạng thái chờ chuyển khoản.'); return res.redirect(back); }
  if (!rental.TransferClaimedAt) {
    if (paymentDeadline(rental) < Date.now()) { req.flash('error', `Đã quá ${FLOW.PAY_MINUTES} phút giữ chỗ. Nếu bạn đã chuyển tiền, vui lòng gọi hotline 0123 456 789.`); return res.redirect(back); }
    rental.TransferClaimedAt = new Date();
    await rental.save();
  }
  req.flash('success', 'Đã ghi nhận bạn chuyển khoản. Cửa hàng kiểm tra tài khoản và xác nhận trong giờ làm việc — bạn sẽ nhận được thông báo.');
  res.redirect(back);
};

// ===== Nhân viên: Xác nhận đã nhận tiền chuyển khoản (Chờ thanh toán -> Chờ giao đồ) =====
exports.confirmDeposit = async (req, res) => {
  const rental = await loadOr404(req, res); if (!rental) return;
  if (rental.Status !== 'Chờ cọc') {
    req.flash('error', `Đơn #${rental.RentalID} đang "${FLOW.label(rental.Status)}", không cần xác nhận thanh toán.`);
    return res.redirect(safeBack(req, '/rentals'));
  }
  rental.Status = 'Đã cọc';
  rental.PaymentStatus = 'Đã thanh toán';
  rental.DepositPaidAt = new Date();
  await rental.save();
  const when = isDelivery(rental) ? `shop gửi đồ ngày ${viDate(shipDay(rental))}, bạn nhận ngày ${viDate(rental.StartDate)}` : `nhận đồ tại cửa hàng ngày ${viDate(rental.StartDate)}`;
  await notify(rental, { level: 'success', title: `Đã nhận thanh toán — đơn #${rental.RentalID}`,
    message: `Cửa hàng đã nhận ${vnd(amountDue(rental))} (tiền thuê + tiền cọc). Đơn đã được giữ chỗ: ${when}.` });
  req.flash('success', `Đã xác nhận nhận ${vnd(amountDue(rental))} cho đơn #${rental.RentalID}.`);
  res.redirect(safeBack(req, '/rentals'));
};

// Quay lại trang đơn đang xem (danh sách hoặc chi tiết đơn)
function safeBack(req, fallback) {
  const b = String(req.body.back || '');
  return /^\/rentals(\/\d+)?(\?|$)/.test(b) ? b : fallback;
}

// ===== Nhân viên: Form nhận đồ trả =====
exports.returnForm = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  if (!['Đang thuê', 'Đang gửi trả'].includes(rental.Status)) { req.flash('error', 'Đơn chưa ở trạng thái đang thuê / đang gửi trả.'); return res.redirect('/rentals'); }
  // Hạn shop nhận lại đồ = ngày trả + số ngày vận chuyển (đơn giao xa)
  res.render('rentals/return', { title: `Nhận trả đơn #${rental.RentalID}`, rental, today: todayStr(), alert: alertOf(rental), graceEnd: addDays(rental.EndDate, rental.ShipDays || 0) });
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
  if (!['Đang thuê', 'Đang gửi trả'].includes(rental.Status)) { req.flash('error', 'Đơn chưa ở trạng thái đang thuê / đang gửi trả.'); return res.redirect('/rentals'); }

  // Ngày trả thực tế: phải là ngày hợp lệ, KHÔNG trước ngày nhận và KHÔNG sau hôm nay
  const returnDate = String(req.body.ReturnDate || '');
  const backForm = `/rentals/${rental.RentalID}/return`;
  if (!isDateStr(returnDate)) { req.flash('error', 'Vui lòng chọn ngày trả thực tế.'); return res.redirect(backForm); }
  // Sớm nhất: ngày đồ rời shop (đơn giao: ngày gửi shipper; tự lấy: ngày nhận)
  const earliest = rental.ShippedAt && rental.ShippedAt < rental.StartDate ? rental.ShippedAt : rental.StartDate;
  if (returnDate < earliest) { req.flash('error', `Ngày nhận lại đồ không được trước ngày đồ rời shop (${viDate(earliest)}).`); return res.redirect(backForm); }
  if (returnDate > todayStr()) { req.flash('error', 'Ngày trả thực tế không được ở tương lai.'); return res.redirect(backForm); }
  // Phí vệ sinh / hư hỏng: tính theo BẢNG NỘI QUY (utils/fees.js) — nhân viên chỉ chọn số bộ bị ảnh hưởng
  const { details, error } = computeDamage(rental, req.body);
  if (error) { req.flash('error', error); return res.redirect(backForm); }
  const damageFee = details.reduce((s, d) => s + d.amount, 0);

  // Phí trễ = số ngày trễ × tổng (phí trễ/ngày × SL) của các món trong đơn
  // Đơn giao tận nơi: tính trễ theo NGÀY KHÁCH GỬI TRẢ (đã nhập mã vận đơn); chưa nhập thì lấy ngày shop nhận − số ngày vận chuyển
  const lateDays = rental.ReturnSentDate
    ? Math.max(0, daysBetween(rental.EndDate, rental.ReturnSentDate))
    : Math.max(0, daysBetween(addDays(rental.EndDate, rental.ShipDays || 0), returnDate));
  const latePerDay = rental.items.reduce((s, it) => s + num(it.LateFeePerDay) * it.Quantity, 0);
  const lateFee = lateDays * latePerDay;

  rental.ReturnDate = returnDate;
  rental.LateFee = lateFee;
  rental.DamageFee = damageFee;
  rental.DamageDetails = details.length ? JSON.stringify(details) : null;
  rental.RefundAmount = num(rental.Deposit) - lateFee - damageFee; // có thể âm (khách đền thêm)
  rental.Status = 'Hoàn tất';                                      // hoàn tất => các bộ trống lại
  await rental.save();
  await notify(rental, { level: 'success', title: `Đơn #${rental.RentalID} hoàn tất`,
    message: `Cửa hàng đã nhận lại đồ. ${Number(rental.RefundAmount) >= 0 ? `Hoàn cọc ${vnd(rental.RefundAmount)}` : `Bạn cần đền thêm ${vnd(-rental.RefundAmount)}`}` +
      `${lateFee + damageFee ? ` (đã trừ phí ${vnd(lateFee + damageFee)})` : ''}. Cảm ơn bạn — hãy đánh giá mẫu đã thuê nhé!` });

  req.flash('success', `Đã nhận trả đơn #${rental.RentalID}. Phí trễ ${lateFee.toLocaleString('vi-VN')} đ · Hư hỏng ${damageFee.toLocaleString('vi-VN')} đ · Hoàn cọc ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect('/rentals');
};

// ===== Nhân viên: VIỆC HÔM NAY =====
// Gom đơn theo việc cần làm: xác nhận thanh toán, đóng đơn + gửi shipper, khách đến lấy, đang giao,
// thu hồi (đến hạn trả / đang gửi trả về), giặt (vừa nhận lại hôm qua / hôm nay).
exports.today = async (req, res) => {
  const { Op } = require('sequelize');
  const today = todayStr(), tomorrow = addDays(today, 1);
  const rows = await Rental.findAll({
    where: { [Op.or]: [
      { Status: { [Op.in]: ['Chờ cọc', 'Đã cọc', 'Đang giao', 'Đang thuê', 'Đang gửi trả'] } },
      { Status: 'Hoàn tất', ReturnDate: { [Op.between]: [addDays(today, -1), today] } },
    ] },
    ...withItems, order: [['StartDate', 'ASC'], ['RentalID', 'ASC']],
  });
  rows.forEach(r => { r.alert = alertOf(r, today); });
  const deli = isDelivery;
  const groups = [
    { key: 'pay', title: 'Chờ xác nhận thanh toán', icon: 'bi-cash-coin', hint: 'Kiểm tra tài khoản ngân hàng, thấy tiền thì bấm "Đã nhận tiền".',
      list: rows.filter(r => r.Status === 'Chờ cọc') },
    { key: 'pack', title: 'Đóng đơn & gửi shipper', icon: 'bi-box-seam', hint: `Đơn giao tận nơi có ngày gửi hôm nay (hoặc đã quá ngày). Đóng gói buổi sáng, shipper lấy trước ${FLOW.PACK_CUTOFF_HOUR + 5}h.`,
      list: rows.filter(r => r.Status === 'Đã cọc' && deli(r) && shipDay(r) <= today) },
    { key: 'packTmr', title: 'Chuẩn bị cho ngày mai', icon: 'bi-calendar-event', hint: 'Đơn gửi đồ / khách đến lấy vào ngày mai: kiểm tra, ủi sẵn.',
      list: rows.filter(r => r.Status === 'Đã cọc' && (deli(r) ? shipDay(r) : r.StartDate) === tomorrow) },
    { key: 'pickup', title: 'Khách đến lấy tại shop', icon: 'bi-shop', hint: 'Xem CCCD, cho khách thử đồ, thu tiền nếu COD.',
      list: rows.filter(r => r.Status === 'Đã cọc' && !deli(r) && r.StartDate <= today) },
    { key: 'shipping', title: 'Đang giao tới khách', icon: 'bi-truck', hint: 'Theo dõi mã vận đơn; khách nhận rồi thì bấm "Khách đã nhận".',
      list: rows.filter(r => r.Status === 'Đang giao') },
    { key: 'collect', title: 'Thu hồi đồ', icon: 'bi-arrow-return-left', hint: 'Đến hạn trả hôm nay / quá hạn, và đơn khách đã gửi trả đang trên đường về.',
      list: rows.filter(r => (r.Status === 'Đang thuê' && r.EndDate <= today) || r.Status === 'Đang gửi trả') },
    { key: 'wash', title: 'Giặt là', icon: 'bi-droplet', hint: 'Đồ vừa nhận lại hôm qua / hôm nay: giặt là, kiểm tra rồi cất lên kệ.',
      list: rows.filter(r => r.Status === 'Hoàn tất') },
  ];
  res.render('rentals/today', { title: 'Việc hôm nay', groups, today });
};

// ===== Nhân viên: PHIẾU ĐƠN (in ra, bỏ vào túi / hộp hàng) =====
exports.slip = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, withItems);
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  res.render('rentals/slip', { layout: false, rental, SHOP_BANK });
};
