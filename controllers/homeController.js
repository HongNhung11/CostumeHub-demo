const { Product } = require('../models');
const { availableMap } = require('../utils/availability');
const { todayStr } = require('../utils/dates');
const { ratingMap } = require('../utils/reviews');

exports.home = async (req, res) => {
  // Không tính / không hiện sản phẩm "Ngừng cho thuê"
  const onSale = { Status: 'Còn trống' };
  const all = await Product.findAll({ where: onSale, attributes: ['ProductID', 'Quantity'] });
  const total = all.length;
  // Số mẫu còn ít nhất 1 bộ trống HÔM NAY (tính theo lịch thuê)
  const today = todayStr();
  const avail = await availableMap(all, today, today);
  const available = all.filter(p => avail[p.ProductID] > 0).length;
  // "Mới về": sản phẩm tạo gần nhất lên đầu (theo thời gian tạo)
  const featured = await Product.findAll({ where: onSale, limit: 6, order: [['CreateDate', 'DESC'], ['ProductID', 'DESC']] });
  // "Được đánh giá cao": điểm trung bình cao nhất (bằng điểm thì mẫu nhiều đánh giá hơn lên trước)
  const ratings = await ratingMap(all.map(p => p.ProductID));
  const topIds = Object.entries(ratings)
    .sort(([, a], [, b]) => b.avg - a.avg || b.count - a.count)
    .slice(0, 6).map(([id]) => Number(id));
  const topRated = topIds.length ? (await Product.findAll({ where: { ...onSale, ProductID: topIds } }))
    .sort((a, b) => topIds.indexOf(a.ProductID) - topIds.indexOf(b.ProductID)) : [];
  res.render('home/index', { title: 'Trang chủ - CostumeHub', total, available, featured, topRated, ratings });
};

// Trang liên hệ: xem controllers/contactController.js
