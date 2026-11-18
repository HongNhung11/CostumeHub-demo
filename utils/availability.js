// CHỐNG TRÙNG LỊCH THUÊ — tính theo từng SIZE × MÀU
// Mỗi tổ hợp size × màu của một mẫu có số bộ riêng (bảng ProductVariants).
// Số bộ còn trống của 1 tổ hợp trong [start, end] = số bộ shop có − số bộ bị các đơn khác giữ
// vào NGÀY ĐÔNG NHẤT trong khoảng đó.
// - Một đơn giữ đồ từ ngày nhận đến hết ngày trả, CỘNG THÊM CLEAN_DAYS ngày để giặt sấy.
//   VD thuê 1–3 => đồ bận tới hết ngày 4 (giặt sấy) => khách sau nhận sớm nhất ngày 5.
//   Ngược lại, đơn mới cũng phải trả trước ngày nhận của đơn sau ít nhất CLEAN_DAYS ngày.
// - Đơn giao tận nơi (ShipDays = số ngày vận chuyển mỗi chiều, xem utils/shipping.js): bận thêm ShipDays ngày
//   TRƯỚC ngày nhận (đồ đang đi tới khách) và ShipDays ngày SAU ngày trả (đồ đang về shop).
// - Đơn "Đang thuê" mà quá hạn chưa trả vẫn tính là đang giữ đồ tới hôm nay.
// => Khách A thuê size S, khách B thuê size M cùng ngày: không ảnh hưởng nhau;
//    hai khách cùng thuê size S thì phải còn đủ bộ size S.
const { Op } = require('sequelize');
const { Rental, RentalItem, ProductVariant } = require('../models');
const { todayStr, addDays, daysBetween } = require('./dates');
const { keyOf } = require('./variants');
const { MAX_SHIP_DAYS } = require('./shipping');

// Đơn đang giữ lịch: "Chờ cọc" cũng giữ chỗ (chuyển khoản: tối đa vài phút, quá hạn tự hủy — utils/rentalFlow.js)
const ACTIVE = ['Đã đặt', 'Chờ cọc', 'Đã cọc', 'Đang giao', 'Đang thuê', 'Đang gửi trả'];
const MAX_RENT_DAYS = 30;
const CLEAN_DAYS = 1;   // số ngày giặt sấy giữa 2 lượt thuê cùng 1 bộ

// Lấy các dòng đơn đang giữ đồ của các sản phẩm, có chồng lên [start, end]
async function activeHolds(productIds, start, end, { transaction, excludeRentalId } = {}) {
  const today = todayStr();
  const items = await RentalItem.findAll({
    where: { ProductID: { [Op.in]: productIds } },
    include: [{
      model: Rental,
      attributes: ['RentalID', 'StartDate', 'EndDate', 'Status', 'ShipDays', 'ReturnDate', 'ReturnSentDate'],
      where: {
        // Đơn đang giữ đồ + đơn vừa hoàn tất (đồ còn đang giặt sau ngày shop nhận lại)
        [Op.or]: [
          { Status: { [Op.in]: ACTIVE } },
          { Status: 'Hoàn tất', ReturnDate: { [Op.gte]: addDays(start, -CLEAN_DAYS) } },
        ],
        StartDate: { [Op.lte]: addDays(end, MAX_SHIP_DAYS) },   // đơn giao xa bận cả mấy ngày trước ngày nhận
        ...(excludeRentalId ? { RentalID: { [Op.ne]: excludeRentalId } } : {}),
      },
    }],
    transaction,
  });
  return items
    .map(it => {
      const r = it.Rental;
      const key = keyOf(it.ProductID, it.Size, it.Color);
      // Shop đã nhận lại đồ: chỉ còn bận ngày nhận lại + ngày giặt
      if (r.Status === 'Hoàn tất') return { key, qty: it.Quantity, from: r.ReturnDate, to: addDays(r.ReturnDate, CLEAN_DAYS) };
      let holdEnd = r.EndDate;
      if (r.Status === 'Đang gửi trả' && r.ReturnSentDate && r.ReturnSentDate > holdEnd) holdEnd = r.ReturnSentDate;   // gửi trả muộn
      const ship = Number(r.ShipDays) || 0;
      if (r.Status === 'Đang thuê' && holdEnd < today) holdEnd = today;   // quá hạn chưa trả / chưa gửi trả
      // Đã gửi trả nhưng quá ngày dự kiến mà chưa về shop -> coi như còn đang trên đường
      if (r.Status === 'Đang gửi trả' && addDays(holdEnd, ship) < today) holdEnd = addDays(today, -ship);
      // − ngày vận chuyển đi · + ngày vận chuyển về + ngày giặt sấy
      return { key, qty: it.Quantity, from: addDays(r.StartDate, -ship), to: addDays(holdEnd, ship + CLEAN_DAYS) };
    })
    .filter(h => h.to >= start && h.from <= end);
}

// Số bộ bị giữ cùng lúc nhiều nhất trong [start, end], theo từng tổ hợp: { key: peak }
function peakByKey(holds, start, end) {
  const usage = {};
  for (const h of holds) {
    const from = h.from > start ? h.from : start;
    const to = h.to < end ? h.to : end;
    const u = (usage[h.key] ||= {});
    for (let d = from; d <= to; d = addDays(d, 1)) u[d] = (u[d] || 0) + h.qty;
  }
  const peak = {};
  for (const [k, days] of Object.entries(usage)) peak[k] = Math.max(0, ...Object.values(days));
  return peak;
}

// Chỗ trống theo size × màu của các SP trong [start, end]:
// { productId: { free: tổng bộ còn trống, freeSizes: [size còn ít nhất 1 bộ],
//                variants: [{ Size, Color, total, free }] } }
async function productAvailability(products, start, end, opts = {}) {
  const ids = products.map(p => p.ProductID);
  if (!ids.length) return {};
  // Đơn đang xét: thêm ngày vận chuyển 2 đầu (opts.shipDays, giao tận nơi) + CLEAN_DAYS ngày giặt sấy sau khi về shop
  const ship = Number(opts.shipDays) || 0;
  start = addDays(start, -ship);
  end = addDays(end, ship + CLEAN_DAYS);
  const [variants, holds] = await Promise.all([
    ProductVariant.findAll({ where: { ProductID: { [Op.in]: ids } }, transaction: opts.transaction }),
    activeHolds(ids, start, end, opts),
  ]);
  const peak = peakByKey(holds, start, end);
  const out = Object.fromEntries(ids.map(id => [id, { free: 0, freeSizes: [], variants: [] }]));
  for (const v of variants) {
    const free = Math.max(0, v.Quantity - (peak[keyOf(v.ProductID, v.Size, v.Color)] || 0));
    const o = out[v.ProductID];
    o.variants.push({ Size: v.Size, Color: v.Color, total: v.Quantity, free });
    o.free += free;
    if (free > 0 && !o.freeSizes.includes(v.Size)) o.freeSizes.push(v.Size);
  }
  return out;
}

// { productId: tổng số bộ còn trống (mọi size × màu) trong [start, end] }
async function availableMap(products, start, end, opts) {
  const a = await productAvailability(products, start, end, opts);
  return Object.fromEntries(Object.entries(a).map(([id, v]) => [id, v.free]));
}

// { "Size|Color": số bộ còn trống } của 1 SP — dùng khi đặt thuê / thêm vào giỏ
async function freeByVariant(product, start, end, opts) {
  const a = (await productAvailability([product], start, end, opts))[product.ProductID];
  return Object.fromEntries(a.variants.map(v => [`${v.Size}|${v.Color}`, v.free]));
}

// Số bộ bị giữ cùng lúc nhiều nhất từ hôm nay trở đi, theo từng "Size|Color" (dùng khi sửa số lượng SP)
async function peakFutureUsage(productId) {
  const start = todayStr();
  const holds = await activeHolds([productId], start, '9990-12-31');   // (không dùng 9999: + ngày vận chuyển sẽ tràn sang năm 10000)
  if (!holds.length) return {};
  const end = holds.reduce((m, h) => (h.to > m ? h.to : m), start);
  const out = {};
  for (const [k, v] of Object.entries(peakByKey(holds, start, end))) out[k.split('|').slice(1).join('|')] = v;
  return out;
}

// Các ProductID đã từng nằm trong đơn thuê: { active: đơn chưa xong, history: chỉ còn đơn đã xong/hủy }
// (CSDL đặt Rentals.ProductID ... ON DELETE CASCADE => xóa SP sẽ xóa luôn hóa đơn cũ, nên phải chặn)
async function productsInRentals(productIds) {
  const items = await RentalItem.findAll({
    attributes: ['ProductID'],
    where: { ProductID: { [Op.in]: productIds } },
    include: [{ model: Rental, attributes: ['Status'] }],
  });
  const active = new Set(), history = new Set();
  for (const i of items) (ACTIVE.includes(i.Rental.Status) ? active : history).add(i.ProductID);
  for (const id of active) history.delete(id);
  return { active, history };
}

// Kiểm tra khoảng ngày thuê hợp lệ; trả về chuỗi lỗi hoặc null
function checkDates(start, end) {
  const { isDateStr } = require('./dates');
  if (!isDateStr(start) || !isDateStr(end)) return 'Vui lòng chọn ngày nhận và ngày trả.';
  if (start < todayStr()) return 'Ngày nhận không được ở quá khứ.';
  const n = daysBetween(start, end);
  if (n < 1) return 'Ngày trả phải sau ngày nhận ít nhất 1 ngày.';
  if (n > MAX_RENT_DAYS) return `Mỗi đơn thuê tối đa ${MAX_RENT_DAYS} ngày.`;
  return null;
}

// Khoảng ngày thuê khách đang chọn để xem lịch trống (nhớ trong phiên làm việc).
// - ?start=...&end=...  -> kiểm tra hợp lệ rồi ghi nhớ
// - ?clear=1            -> bỏ chọn ngày
// - không có gì         -> dùng ngày đã nhớ (nếu ngày nhận chưa qua)
// Không chọn ngày thì KHÔNG hiện gì về việc đã có người thuê.
function rentDatesFrom(req) {
  if (req.query.clear) { delete req.session.rentDates; return { dates: null, error: null }; }
  const { start, end } = req.query;
  if (start || end) {
    const error = checkDates(start, end);
    if (error) return { dates: null, error };
    req.session.rentDates = { start, end };
    return { dates: req.session.rentDates, error: null };
  }
  const saved = req.session.rentDates;
  if (saved && !checkDates(saved.start, saved.end)) return { dates: saved, error: null };
  delete req.session.rentDates;
  return { dates: null, error: null };
}

module.exports = {
  ACTIVE, MAX_RENT_DAYS, CLEAN_DAYS, productAvailability, availableMap, freeByVariant,
  checkDates, peakFutureUsage, productsInRentals, rentDatesFrom,
};
