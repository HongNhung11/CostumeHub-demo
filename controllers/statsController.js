// ===== THỐNG KÊ (chỉ ADMIN) =====
// Doanh thu ghi nhận:
//   - Đơn "Hoàn tất": tiền thuê + phí trễ + phí hư hỏng, tính vào THÁNG TRẢ ĐỒ (ReturnDate)
//   - Đơn "Đã hủy": phí hủy (phần cọc giữ lại), tính vào tháng hủy
// Tiền cọc KHÔNG phải doanh thu (hoàn lại cho khách) -> chỉ thống kê số cọc đang giữ.
const { Rental, RentalItem, User } = require('../models');
const { ACTIVE } = require('../utils/availability');
const { alertOf } = require('./rentalController');
const { todayStr } = require('../utils/dates');

const num = (v) => Number(v) || 0;
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => { const t = new Date(d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const STATUSES = require('../utils/rentalFlow').ORDER;

exports.index = async (req, res) => {
  const rentals = await Rental.findAll({ include: [{ model: RentalItem, as: 'items' }] });
  const today = todayStr();
  const thisYear = Number(today.slice(0, 4));

  // Các năm có dữ liệu (để chọn)
  const years = new Set([thisYear]);
  const revenueDate = (r) => (r.Status === 'Hoàn tất' ? r.ReturnDate : r.Status === 'Đã hủy' ? localDate(r.updatedAt) : null);
  rentals.forEach(r => { const d = revenueDate(r); if (d) years.add(Number(d.slice(0, 4))); });
  const yearList = [...years].sort((a, b) => b - a);
  const year = yearList.includes(Number(req.query.year)) ? Number(req.query.year) : thisYear;

  // Doanh thu từng tháng của năm đã chọn
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rent: 0, discount: 0, late: 0, damage: 0, cancel: 0, orders: 0, total: 0 }));
  for (const r of rentals) {
    const d = revenueDate(r);
    if (!d || Number(d.slice(0, 4)) !== year) continue;
    const m = months[Number(d.slice(5, 7)) - 1];
    if (r.Status === 'Hoàn tất') {
      m.rent += num(r.RentFee) - num(r.Discount); m.discount += num(r.Discount);   // tiền thuê thực thu (đã trừ mã giảm giá)
      m.late += num(r.LateFee); m.damage += num(r.DamageFee); m.orders++;
    } else {
      m.cancel += num(r.CancelFee);
    }
  }
  months.forEach(m => { m.total = m.rent + m.late + m.damage + m.cancel; });
  const yearTotal = months.reduce((s, m) => s + m.total, 0);
  const yearOrders = months.reduce((s, m) => s + m.orders, 0);
  const curMonth = year === thisYear ? months[Number(today.slice(5, 7)) - 1] : null;

  // Số đơn theo trạng thái + đơn đang hoạt động
  const statusCounts = Object.fromEntries(STATUSES.map(s => [s, rentals.filter(r => r.Status === s).length]));
  const active = rentals.filter(r => ACTIVE.includes(r.Status));
  // Cọc đang giữ: chỉ tính đơn đã thực nhận tiền (đơn "Chờ cọc" chưa thu)
  const depositHeld = active.filter(r => require('../utils/rentalFlow').isPaid(r)).reduce((s, r) => s + num(r.Deposit), 0);
  const overdue = active.filter(r => { const a = alertOf(r, today); return a && a.overdue; }).length;

  // Mẫu được thuê nhiều nhất (tính theo số bộ, bỏ đơn đã hủy)
  const byProduct = new Map();
  for (const r of rentals) {
    if (r.Status === 'Đã hủy') continue;
    for (const it of r.items) {
      const key = it.ProductID ?? `x:${it.ProductName}`;
      const e = byProduct.get(key) || { id: it.ProductID, name: it.ProductName, qty: 0, orders: 0, rent: 0 };
      e.qty += it.Quantity;
      e.orders += 1;
      e.rent += num(it.PricePerDay) * it.Quantity * (r.RentDays || 0);
      byProduct.set(key, e);
    }
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.qty - a.qty || b.rent - a.rent).slice(0, 10);

  const customers = await User.count({ where: { role: 'khach' } });

  res.render('admin/stats', {
    title: 'Thống kê', year, yearList, months, yearTotal, yearOrders, curMonth,
    statusCounts, STATUSES, activeCount: active.length, depositHeld, overdue,
    topProducts, customers, totalOrders: rentals.length,
  });
};
