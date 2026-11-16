const fs = require('fs');
const { Rental, Product } = require('../models');
const { splitList, normalizePhone, isValidPhone, isValidCCCD } = require('../utils/text');

const MS = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / MS);
const num = (v) => Number(v) || 0;

// ===== Tạo đơn thuê (khách đặt từ trang chi tiết) =====
exports.create = async (req, res) => {
  try {
    const { ProductID, StartDate, EndDate, Quantity, Note, DeliveryMethod, DeliveryAddress, SelectedSize, SelectedColor } = req.body;
    const CustomerName = (req.body.CustomerName || '').trim();
    const CustomerPhone = normalizePhone(req.body.CustomerPhone);
    const CustomerIDCard = String(req.body.CustomerIDCard || '').replace(/\s/g, '');
    const backUrl = `/products/${ProductID}/book`;
    const product = await Product.findByPk(ProductID);
    if (!product) { req.flash('error', 'Không tìm thấy sản phẩm.'); return res.redirect('/products'); }

    // Báo lỗi + giữ lại dữ liệu khách đã nhập (trừ file ảnh)
    const fail = (msg) => {
      if (req.file) fs.unlink(req.file.path, () => {});
      const { IDCardImage, ...old } = req.body;
      req.session.bookOld = old;
      req.flash('error', msg);
      return res.redirect(backUrl);
    };

    const qty = parseInt(Quantity);
    if (!(qty >= 1)) return fail('Số lượng phải từ 1 trở lên.');

    // Chọn size / màu theo đúng danh sách của sản phẩm
    const sizes = splitList(product.Size), colors = splitList(product.Color);
    if (sizes.length && !sizes.includes(SelectedSize)) return fail('Vui lòng chọn size.');
    if (colors.length && !colors.includes(SelectedColor)) return fail('Vui lòng chọn màu.');

    if (!StartDate || !EndDate) return fail('Vui lòng chọn ngày nhận và ngày trả.');
    const rentDays = daysBetween(StartDate, EndDate);
    if (!(rentDays >= 1)) return fail('Ngày trả phải sau ngày nhận ít nhất 1 ngày.');
    if (daysBetween(todayStr(), StartDate) < 0) return fail('Ngày nhận không được ở quá khứ.');
    if (product.Quantity < qty) return fail(`Chỉ còn ${product.Quantity} ${product.Unit} cho thuê.`);

    // Thông tin khách: họ tên, SĐT di động VN, CCCD 12 số
    if (CustomerName.length < 2) return fail('Vui lòng nhập họ tên.');
    if (!isValidPhone(CustomerPhone)) return fail('Số điện thoại không hợp lệ: phải gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
    if (!isValidCCCD(CustomerIDCard)) return fail('Số CCCD không hợp lệ: phải gồm đúng 12 chữ số (3 số đầu là mã tỉnh 001–096).');

    if (DeliveryMethod === 'Giao tận nơi' && (DeliveryAddress || '').trim().length < 10) {
      return fail('Vui lòng nhập địa chỉ nhận hàng đầy đủ (số nhà, đường, phường/xã, quận/huyện, tỉnh/TP).');
    }

    const price = num(product.Price);
    const deposit = num(product.DepositValue) * qty;
    // Đặt thuê = cọc luôn trong 1 bước
    const rental = await Rental.create({
      ProductID: product.ProductID,
      UserID: req.session.user ? req.session.user.id : null,
      CustomerName, CustomerPhone, CustomerIDCard,
      IDCardImage: req.file ? '/uploads/' + req.file.filename : null,
      DeliveryMethod: DeliveryMethod || 'Tự đến lấy',
      DeliveryAddress: DeliveryMethod === 'Giao tận nơi' ? DeliveryAddress : null,
      StartDate, EndDate, RentDays: rentDays, Quantity: qty,
      SelectedSize: SelectedSize || null, SelectedColor: SelectedColor || null,
      PricePerDay: price,
      RentFee: price * rentDays * qty,
      Deposit: deposit,
      PaymentMethod: req.body.method || 'Tiền mặt',
      PaymentStatus: 'Đã cọc',
      Status: 'Đã cọc',
      Note,
    });

    // Giảm tồn kho; hết hàng thì đổi trạng thái
    product.Quantity -= qty;
    if (product.Quantity <= 0) product.Status = 'Đang cho thuê';
    await product.save();

    req.flash('success', `Đặt thuê thành công! Đã cọc ${deposit.toLocaleString('vi-VN')} đ (${rental.PaymentMethod}). Đơn được giữ chỗ.`);
    res.redirect(`/rentals/${rental.RentalID}`);
  } catch (e) {
    req.flash('error', 'Lỗi đặt thuê: ' + e.message);
    res.redirect('/products');
  }
};

// ===== Xem đơn thuê / hóa đơn =====
exports.show = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, { include: Product });
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  res.render('rentals/show', { title: `Đơn thuê #${rental.RentalID}`, rental });
};

// ===== Thanh toán cọc =====
exports.pay = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id);
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  if (rental.Status !== 'Đã đặt') { req.flash('error', 'Đơn này không ở trạng thái chờ thanh toán.'); return res.redirect(`/rentals/${rental.RentalID}`); }
  rental.PaymentMethod = req.body.method || 'Tiền mặt';
  rental.PaymentStatus = 'Đã cọc';
  rental.Status = 'Đã cọc';
  await rental.save();
  req.flash('success', `Đã thanh toán cọc qua ${rental.PaymentMethod}. Đơn đã được giữ chỗ.`);
  res.redirect(`/rentals/${rental.RentalID}`);
};

// ===== Hủy đơn (tính phí hủy theo mốc ngày) =====
exports.cancel = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, { include: Product });
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
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
  rental.Status = 'Đã hủy';
  await rental.save();

  // Trả hàng về kho
  const product = rental.Product || await Product.findByPk(rental.ProductID);
  if (product) { product.Quantity += rental.Quantity; product.Status = 'Còn trống'; await product.save(); }

  req.flash('success', `Đã hủy đơn. Phí hủy: ${cancelFee.toLocaleString('vi-VN')} đ. Hoàn lại: ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect(`/rentals/${rental.RentalID}`);
};

// ===== Danh sách đơn thuê =====
exports.index = async (req, res) => {
  const u = req.session.user;
  const where = (u.role === 'admin' || u.role === 'nhanvien') ? {} : { UserID: u.id };
  const rentals = await Rental.findAll({ where, include: Product, order: [['RentalID', 'DESC']] });
  res.render('rentals/index', { title: 'Đơn thuê', rentals, isStaff: u.role === 'admin' || u.role === 'nhanvien' });
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
  rental.Status = 'Đang thuê';
  await rental.save();
  req.flash('success', `Đã giao đồ cho đơn #${rental.RentalID}.`);
  res.redirect('/rentals');
};

// ===== Nhân viên: Form nhận đồ trả =====
exports.returnForm = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, { include: Product });
  if (!rental) return res.status(404).render('404', { title: 'Không tìm thấy đơn' });
  res.render('rentals/return', { title: `Nhận trả đơn #${rental.RentalID}`, rental, today: todayStr() });
};

// ===== Nhân viên: Xử lý nhận đồ trả (tính phí trễ + hư hỏng, hoàn cọc) =====
exports.receiveReturn = async (req, res) => {
  const rental = await Rental.findByPk(req.params.id, { include: Product });
  if (!rental) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/rentals'); }
  if (rental.Status !== 'Đang thuê') { req.flash('error', 'Đơn chưa ở trạng thái đang thuê.'); return res.redirect('/rentals'); }

  const returnDate = req.body.ReturnDate || todayStr();
  const damageFee = num(req.body.DamageFee);
  const product = rental.Product || await Product.findByPk(rental.ProductID);

  const lateDays = Math.max(0, daysBetween(rental.EndDate, returnDate));
  const lateFee = lateDays * num(product ? product.LateFeePerDay : 0) * rental.Quantity;

  rental.ReturnDate = returnDate;
  rental.LateFee = lateFee;
  rental.DamageFee = damageFee;
  rental.RefundAmount = num(rental.Deposit) - lateFee - damageFee; // có thể âm (khách đền thêm)
  rental.Status = 'Hoàn tất';
  await rental.save();

  // Trả hàng về kho
  if (product) { product.Quantity += rental.Quantity; product.Status = 'Còn trống'; await product.save(); }

  req.flash('success', `Đã nhận trả đơn #${rental.RentalID}. Phí trễ ${lateFee.toLocaleString('vi-VN')} đ · Hư hỏng ${damageFee.toLocaleString('vi-VN')} đ · Hoàn cọc ${Number(rental.RefundAmount).toLocaleString('vi-VN')} đ.`);
  res.redirect('/rentals');
};
