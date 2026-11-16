const { Product } = require('../models');
const { availableMap } = require('../utils/availability');
const { todayStr } = require('../utils/dates');

exports.home = async (req, res) => {
  // Không tính / không hiện sản phẩm "Ngừng cho thuê"
  const onSale = { Status: 'Còn trống' };
  const all = await Product.findAll({ where: onSale, attributes: ['ProductID', 'Quantity'] });
  const total = all.length;
  // Số mẫu còn ít nhất 1 bộ trống HÔM NAY (tính theo lịch thuê)
  const today = todayStr();
  const avail = await availableMap(all, today, today);
  const available = all.filter(p => avail[p.ProductID] > 0).length;
  const featured = await Product.findAll({ where: onSale, limit: 6, order: [['ProductID', 'ASC']] });
  res.render('home/index', { title: 'Trang chủ - CostumeHub', total, available, featured });
};

exports.contact = (req, res) => res.render('home/contact', { title: 'Liên hệ' });

exports.contactSubmit = (req, res) => {
  req.flash('success', 'Cảm ơn bạn! Chúng tôi sẽ liên hệ lại sớm.');
  res.redirect('/contact');
};
