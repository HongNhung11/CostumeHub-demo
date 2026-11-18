// THÔNG BÁO CHO KHÁCH + TỰ HỦY ĐƠN CHỜ CỌC QUÁ HẠN
// - notify(): ghi 1 thông báo khi đơn đổi trạng thái (đặt, xác nhận cọc, giao đồ, hoàn tất, hủy, đổi size)
// - remindersFor(): tạo lời nhắc theo ngày (mai nhận đồ, hôm nay nhận, mai hạn trả, hôm nay trả, quá hạn) — mỗi lời nhắc chỉ 1 lần
// - expirePending(): đơn "Chờ cọc" quá PAY_MINUTES phút mà khách chưa báo chuyển khoản -> tự hủy, trả lại lịch cho khách khác
const { Op } = require('sequelize');
const { Notification, Rental, RentalItem } = require('../models');
const { todayStr, addDays, daysBetween, viDate } = require('./dates');
const { DEPOSIT_HOLD_HOURS } = require('./constants');

const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

async function notify(rental, { title, message, level = 'info', key = null }) {
  if (!rental || !rental.UserID) return;   // đơn không gắn tài khoản thì bỏ qua
  if (key && await Notification.findOne({ where: { UserID: rental.UserID, Key: key } })) return;
  try {
    await Notification.create({ UserID: rental.UserID, RentalID: rental.RentalID, Title: title, Message: message, Level: level, Link: `/rentals/${rental.RentalID}`, Key: key });
  } catch (e) {
    if (e.name !== 'SequelizeUniqueConstraintError') throw e;   // 2 request cùng lúc tạo cùng lời nhắc -> bỏ qua
  }
}

// Hạn chuyển khoản của đơn "Chờ cọc": PAY_MINUTES phút (utils/rentalFlow.js)
const { paymentDeadline: depositDeadline, isDelivery, PAY_MINUTES } = require('./rentalFlow');

// Lời nhắc theo ngày cho 1 khách (gọi khi khách mở web, có giới hạn tần suất ở server.js)
async function remindersFor(userId) {
  const today = todayStr(), tomorrow = addDays(today, 1);
  const rentals = await Rental.findAll({ where: { UserID: userId, Status: { [Op.in]: ['Chờ cọc', 'Đã cọc', 'Đang giao', 'Đang thuê'] } }, include: [{ model: RentalItem, as: 'items' }] });
  for (const r of rentals) {
    const id = r.RentalID;
    if (r.Status === 'Chờ cọc') {
      // (giữ chỗ chỉ vài phút, trang đơn đã có đồng hồ đếm ngược -> không cần lời nhắc)
    } else if (r.Status === 'Đã cọc' || r.Status === 'Đang giao') {
      const deli = isDelivery(r);
      if (r.StartDate === tomorrow) await notify(r, { key: `pickup-tmr-${id}`, title: `Ngày mai nhận đồ — đơn #${id}`,
        message: `Ngày mai (${viDate(r.StartDate)}) là ngày nhận đồ${deli ? ', shipper giao tới địa chỉ của bạn' : ' tại cửa hàng (8:00 – 21:00). Nhớ mang CCCD'}.` });
      if (r.StartDate === today) await notify(r, { key: `pickup-today-${id}`, level: 'warning', title: `Hôm nay nhận đồ — đơn #${id}`,
        message: `Hôm nay là ngày nhận đồ. Thử đồ ngay khi nhận${deli ? ' và quay video lúc mở gói hàng' : ' — không vừa thì được đổi size miễn phí'}.` });
    } else if (r.Status === 'Đang thuê') {
      const deli = isDelivery(r);
      if (r.EndDate === tomorrow) await notify(r, { key: `return-tmr-${id}`, title: `Ngày mai hạn trả — đơn #${id}`,
        message: deli ? `Ngày mai (${viDate(r.EndDate)}) vui lòng gửi trả đồ và nhập mã vận đơn trên trang đơn.` : `Hạn trả đồ là ngày mai (${viDate(r.EndDate)}). Trả đúng hạn để được hoàn đủ cọc.` });
      if (r.EndDate === today) await notify(r, { key: `return-today-${id}`, level: 'warning', title: `Hôm nay hạn trả — đơn #${id}`,
        message: deli ? 'Hôm nay là ngày gửi trả đồ. Gửi xong nhớ nhập mã vận đơn để không bị tính trễ.' : 'Hôm nay là hạn trả đồ. Trả trễ sẽ tính phí trễ theo ngày (trừ vào tiền cọc).' });
      if (r.EndDate < today) {
        const late = r.items.reduce((s, it) => s + Number(it.LateFeePerDay) * it.Quantity, 0);
        await notify(r, { key: `overdue-${id}-${today}`, level: 'danger', title: `Quá hạn trả ${daysBetween(r.EndDate, today)} ngày — đơn #${id}`,
          message: `Đơn đã quá hạn trả từ ${viDate(r.EndDate)}. Phí trễ ${vnd(late)}/ngày đang được tính. Vui lòng trả đồ sớm.` });
      }
    }
  }
}

// Tự hủy đơn chờ thanh toán quá hạn (chưa thu tiền nên không có phí hủy)
async function expirePending() {
  const now = Date.now();
  // Chỉ hủy đơn chưa báo "đã chuyển khoản"; đơn đã báo thì chờ nhân viên kiểm tra
  const list = (await Rental.findAll({ where: { Status: 'Chờ cọc', TransferClaimedAt: null } })).filter(r => depositDeadline(r) <= now);
  for (const r of list) {
    const line = `[${viDate(todayStr())}] Tự hủy: quá ${PAY_MINUTES} phút chưa chuyển khoản.`;
    await r.update({ Status: 'Đã hủy', CancelFee: 0, RefundAmount: 0, Note: [r.Note, line].filter(Boolean).join('\n') });
    await notify(r, { level: 'danger', title: `Đơn #${r.RentalID} đã tự hủy`, message: `Quá ${PAY_MINUTES} phút chưa chuyển khoản nên đơn đã tự hủy. Bạn có thể đặt lại nếu mẫu còn trống.` });
  }
  return list.length;
}

module.exports = { notify, remindersFor, expirePending, depositDeadline };
