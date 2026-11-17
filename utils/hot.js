// NHÃN "HOT": mẫu được khách quan tâm nhiều nhất
// Điểm = số bộ đã được thuê (đơn không bị hủy) × 2 + số lần được thêm vào giỏ (Product.CartAdds).
// Lấy tối đa HOT_LIMIT mẫu có điểm cao nhất, và phải đạt tối thiểu HOT_MIN_SCORE điểm.
const { Op, fn, col } = require('sequelize');
const { Product, Rental, RentalItem } = require('../models');

const HOT_LIMIT = 6;
const HOT_MIN_SCORE = 3;

async function hotScores() {
  const rented = await RentalItem.findAll({
    attributes: ['ProductID', [fn('SUM', col('RentalItem.Quantity')), 'n']],   // ghi rõ bảng: Rentals cũng có cột Quantity
    include: [{ model: Rental, attributes: [], where: { Status: { [Op.ne]: 'Đã hủy' } } }],
    where: { ProductID: { [Op.ne]: null } },
    group: ['RentalItem.ProductID'], raw: true,
  });
  const products = await Product.findAll({ attributes: ['ProductID', 'CartAdds'], where: { Status: { [Op.ne]: 'Ngừng cho thuê' } }, raw: true });
  const score = Object.fromEntries(products.map(p => [p.ProductID, Number(p.CartAdds) || 0]));
  for (const r of rented) if (r.ProductID in score) score[r.ProductID] += Number(r.n) * 2;
  return score;
}

// Tập ProductID đang "HOT"
async function hotSet() {
  const score = await hotScores();
  const ids = Object.entries(score).filter(([, s]) => s >= HOT_MIN_SCORE)
    .sort((a, b) => b[1] - a[1]).slice(0, HOT_LIMIT).map(([id]) => Number(id));
  return new Set(ids);
}

module.exports = { hotScores, hotSet, HOT_LIMIT, HOT_MIN_SCORE };
