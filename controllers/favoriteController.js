// DANH SÁCH YÊU THÍCH: khách thả tim mẫu thích để xem / thuê sau
const { Favorite, Product } = require('../models');
const { ratingMap } = require('../utils/reviews');

// Quay lại đúng trang khách đang đứng (chỉ nhận đường dẫn nội bộ)
function backUrl(req, fallback) {
  const b = String(req.body.back || '');
  return /^\/(products|favorites)(\/|\?|$)/.test(b) ? b : fallback;
}

exports.toggle = async (req, res) => {
  const productId = parseInt(req.params.id);
  const product = await Product.findByPk(productId);
  if (!product) { req.flash('error', 'Không tìm thấy sản phẩm.'); return res.redirect('/products'); }
  const where = { UserID: req.session.user.id, ProductID: productId };
  const had = await Favorite.findOne({ where });
  if (had) await had.destroy();
  else await Favorite.create(where);
  if (req.get('Accept') === 'application/json') return res.json({ ok: true, fav: !had });
  req.flash('success', had ? `Đã bỏ "${product.ProductName}" khỏi danh sách yêu thích.` : `Đã thêm "${product.ProductName}" vào danh sách yêu thích.`);
  res.redirect(backUrl(req, `/products/${productId}`));
};

exports.index = async (req, res) => {
  const favs = await Favorite.findAll({
    where: { UserID: req.session.user.id },
    include: [{ model: Product }],
    order: [['createdAt', 'DESC']],
  });
  const list = favs.filter(f => f.Product);
  const ratings = await ratingMap(list.map(f => f.ProductID));
  res.render('favorites/index', { title: 'Yêu thích', favs: list, ratings });
};
