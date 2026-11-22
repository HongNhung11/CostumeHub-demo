// LỊCH TỔNG CHO NHÂN VIÊN: mỗi ngày phải gửi / giao / thu / nhận đồ về, và bao nhiêu bộ đang bận
const { Op } = require('sequelize');
const { Rental, RentalItem } = require('../models');
const { todayStr, addDays, daysBetween, isDateStr } = require('../utils/dates');
const { MAX_SHIP_DAYS } = require('../utils/shipping');
const { CLEAN_DAYS, ACTIVE } = require('../utils/availability');
const FLOW = require('../utils/rentalFlow');

const KINDS = {
  ship: { label: 'Gửi shipper', icon: 'bi-truck' },
  pickup: { label: 'Khách đến lấy', icon: 'bi-shop' },
  receive: { label: 'Khách nhận hàng', icon: 'bi-house-check' },
  due: { label: 'Hạn trả', icon: 'bi-arrow-return-left' },
  back: { label: 'Đồ về shop', icon: 'bi-box-arrow-in-down' },
};

exports.index = async (req, res) => {
  const today = todayStr();
  const month = /^20\d\d-(0[1-9]|1[0-2])$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
  const kind = KINDS[req.query.kind] ? req.query.kind : '';
  const first = `${month}-01`;
  const next = addDays(first, 32).slice(0, 7), prev = addDays(first, -1).slice(0, 7);
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;   // tuần bắt đầu thứ 2
  const from = addDays(first, -offset);
  const cells = Math.ceil((offset + daysBetween(first, `${next}-01`)) / 7) * 7;
  const to = addDays(from, cells - 1);

  const margin = MAX_SHIP_DAYS + CLEAN_DAYS;
  const rentals = await Rental.findAll({
    where: {
      Status: { [Op.in]: [...ACTIVE, 'Hoàn tất'] },
      StartDate: { [Op.lte]: addDays(to, margin) },
      // đơn quá hạn chưa trả vẫn giữ đồ, dù hạn trả đã qua từ lâu
      [Op.or]: [{ EndDate: { [Op.gte]: addDays(from, -margin) } }, { Status: { [Op.in]: ['Đang thuê', 'Đang gửi trả'] } }],
    },
    include: [{ model: RentalItem, as: 'items' }],
    order: [['RentalID', 'ASC']],
  });

  const days = {};
  for (let i = 0; i < cells; i++) {
    const date = addDays(from, i);
    days[date] = { date, inMonth: date.startsWith(month), busy: 0, events: [] };
  }
  for (const r of rentals) {
    const deli = FLOW.isDelivery(r), ship = Number(r.ShipDays) || 0, done = r.Status === 'Hoàn tất';
    const qty = r.items.reduce((s, it) => s + it.Quantity, 0);
    const put = (date, type, finished) => {
      if (days[date] && (!kind || kind === type)) days[date].events.push({ type, rental: r, qty, finished });
    };
    const left = ['Đang giao', 'Đang thuê', 'Đang gửi trả', 'Hoàn tất'].includes(r.Status);
    const received = ['Đang thuê', 'Đang gửi trả', 'Hoàn tất'].includes(r.Status);
    if (deli) {
      put(r.ShippedAt || FLOW.shipDay(r), 'ship', left);
      put(r.StartDate, 'receive', received);
    } else put(r.StartDate, 'pickup', received);
    put(r.EndDate, 'due', r.Status === 'Đang gửi trả' || done);
    if (deli) put(done && r.ReturnDate ? r.ReturnDate : FLOW.backDay(r), 'back', done);

    // Số bộ bận: cùng quy tắc với kiểm tra trùng lịch
    let end = addDays(r.EndDate, ship);
    if (done && r.ReturnDate) end = r.ReturnDate;
    else if (['Đang thuê', 'Đang gửi trả'].includes(r.Status) && end < today) end = today;
    end = addDays(end, CLEAN_DAYS);
    let d = addDays(r.StartDate, -ship);
    if (d < from) d = from;
    for (; d <= end && d <= to; d = addDays(d, 1)) days[d].busy += qty;
  }

  const selected = isDateStr(req.query.day) && days[req.query.day] ? req.query.day : days[today]?.inMonth ? today : first;
  res.render('rentals/calendar', { title: 'Lịch tổng', month, prev, next, kind, KINDS, today, selected, days: Object.values(days) });
};
