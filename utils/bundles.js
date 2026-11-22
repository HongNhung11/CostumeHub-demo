// TÍNH ƯU ĐÃI COMBO / NHÓM cho các món đang đặt. Luôn tính ở máy chủ theo giá hiện tại.
// Mỗi bộ chỉ hưởng 1 ưu đãi: mỗi vòng chọn ưu đãi lợi nhất cho khách rồi trừ các bộ đã hưởng.
const { Bundle } = require('../models');
const { priceOf } = require('./pricing');

function calculate(bundles, lines) {
  const left = new Map();    // productId -> { qty, price }
  for (const l of lines) {
    const e = left.get(l.productId) || { qty: 0, price: priceOf(l.product) };
    e.qty += l.qty;
    left.set(l.productId, e);
  }
  const applied = [];
  let pool = bundles.filter(b => b.isActive);
  while (pool.length) {
    let best = null;
    for (const b of pool) {
      const ids = [...new Set(b.productIds())];
      const qtyOf = (id) => left.get(id)?.qty || 0;
      let take = [];
      if (b.Kind === 'combo' && ids.length >= 2) {
        const sets = Math.min(...ids.map(qtyOf));
        if (sets > 0) take = ids.map(id => [id, sets]);
      } else if (b.Kind === 'group' && ids.length) {
        if (ids.reduce((s, id) => s + qtyOf(id), 0) >= b.MinQty) take = ids.filter(qtyOf).map(id => [id, qtyOf(id)]);
      }
      const save = take.reduce((s, [id, n]) => s + left.get(id).price * n, 0) * b.Percent / 100;
      if (save > 0 && (!best || save > best.save)) best = { b, take, save };
    }
    if (!best) break;
    for (const [id, n] of best.take) left.get(id).qty -= n;
    applied.push({ id: best.b.BundleID, name: best.b.Name, percent: best.b.Percent, perDay: best.save });
    pool = pool.filter(b => b !== best.b);
  }
  return { applied, perDay: applied.reduce((s, a) => s + a.perDay, 0), names: applied.map(a => a.name).join(' + ') };
}

async function bundleFor(lines, { transaction } = {}) {
  const bundles = await Bundle.findAll({ where: { isActive: true }, order: [['BundleID', 'ASC']], transaction });
  return calculate(bundles, lines);
}

// Tiền giảm của cả kỳ thuê, làm tròn xuống nghìn đồng (checkout.ejs dùng cùng công thức)
const totalOff = (perDay, days) => Math.floor(Math.round(perDay * days) / 1000) * 1000;

module.exports = { calculate, bundleFor, totalOff };
