const { Product, sequelize } = require('../models');

exports.home = async (req, res) => {
  const total = await Product.count();
  const available = await Product.count({ where: { Status: 'Còn trống' } });
  const featured = await Product.findAll({ limit: 6, order: [['ProductID', 'ASC']] });
  res.render('home/index', { title: 'Trang chủ - CostumeHub', total, available, featured });
};

exports.contact = (req, res) => res.render('home/contact', { title: 'Liên hệ' });

exports.contactSubmit = (req, res) => {
  req.flash('success', 'Cảm ơn bạn! Chúng tôi sẽ liên hệ lại sớm.');
  res.redirect('/contact');
};
