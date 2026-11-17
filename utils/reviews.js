// Tổng hợp đánh giá: điểm trung bình, số lượt, phân bố 1–5 sao
const { Op, fn, col } = require('sequelize');
const { Review } = require('../models');

// { productId: { avg, count } } cho thẻ sản phẩm ở cửa hàng (không tính đánh giá bị ẩn)
async function ratingMap(ids) {
  if (!ids.length) return {};
  const rows = await Review.findAll({
    attributes: ['ProductID', [fn('AVG', col('Rating')), 'avg'], [fn('COUNT', col('ReviewID')), 'cnt']],
    where: { ProductID: { [Op.in]: ids }, isHidden: false },
    group: ['ProductID'], raw: true,
  });
  return Object.fromEntries(rows.map(r => [r.ProductID, { avg: Math.round(Number(r.avg) * 10) / 10, count: Number(r.cnt) }]));
}

function reviewSummary(reviews) {
  const dist = [0, 0, 0, 0, 0, 0];
  reviews.forEach(r => { dist[r.Rating]++; });
  const count = reviews.length;
  const avg = count ? Math.round(reviews.reduce((s, r) => s + r.Rating, 0) / count * 10) / 10 : 0;
  const photos = reviews.filter(r => r.imageList().length).length;
  const fit = { 'Vừa': 0, 'Hơi chật': 0, 'Hơi rộng': 0 };
  reviews.forEach(r => { if (r.FitNote in fit) fit[r.FitNote]++; });
  return { count, avg, dist, photos, fit };
}

const FIT_NOTES = ['Vừa', 'Hơi chật', 'Hơi rộng'];

module.exports = { ratingMap, reviewSummary, FIT_NOTES };
