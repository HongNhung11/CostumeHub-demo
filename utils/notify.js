// THÔNG BÁO CHO KHÁCH + TỰ HỦY ĐƠN CHỜ CỌC QUÁ HẠN
// - notify(): ghi 1 thông báo khi đơn đổi trạng thái (đặt, xác nhận cọc, giao đồ, hoàn tất, hủy, đổi size)
// - remindersFor(): tạo lời nhắc theo ngày (mai nhận đồ, hôm nay nhận, mai hạn trả, hôm nay trả, quá hạn) — mỗi lời nhắc chỉ 1 lần
// - expirePending(): đơn "Chờ cọc" quá DEPOSIT_HOLD_HOURS giờ mà chưa cọc -> tự hủy, trả lại lịch cho khách khác
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

// Hạn cọc của đơn "Chờ cọc"
const depositDeadline = (r) => new Date(new Date(r.createdAt).getTime() + DEPOSIT_HOLD_HOURS * 3600e3);

// Lời nhắc theo ngày cho 1 khách (gọi khi khách mở web, có giới hạn tần suất ở server.js)
async function remindersFor(userId) {
  const today = todayStr(), tomorrow = addDays(today, 1);
  const rentals = await Rental.findAll({ where: { UserID: userId, Status: { [Op.in]: ['Chờ cọc', 'Đã cọc', 'Đang thuê'] } }, include: [{ model: RentalItem, as: 'items' }] });
  for (const r of rentals) {
    const id = r.RentalID;
    if (r.Status === 'Chờ cọc') {
      const left = (depositDeadline(r) - Date.now()) / 3600e3;
      if (left > 0 && left <= 6) await notify(r, { key: `deposit-soon-${id}`, level: 'warning', title: `Đơn #${id} sắp hết hạn cọc`,
        message: `Còn khoảng ${Math.max(1, Math.round(left))} giờ để cọc ${vnd(r.Deposit)}. Quá hạn đơn sẽ tự hủy để nhường lịch cho khách khác.` });
    } else if (r.Status === 'Đã cọc') {
      if (r.StartDate === tomorrow) await notify(r, { key: `pickup-tmr-${id}`, title: `Ngày mai nhận đồ — đơn #${id}`,
        message: `Ngày mai (${viDate(r.StartDate)}) là ngày nhận đồ${r.DeliveryMethod === 'Giao tận nơi' ? ', cửa hàng sẽ giao tới địa chỉ của bạn' : ' tại cửa hàng (8:00 – 21:00)'}. Nhớ mang CCCD.` });
      if (r.StartDate === today) await notify(r, { key: `pickup-today-${id}`, level: 'warning', title: `Hôm nay nhận đồ — đơn #${id}`,
        message: 'Hôm nay là ngày nhận đồ. Thử đồ ngay khi nhận — không vừa thì được đổi size miễn phí.' });
    } else if (r.Status === 'Đang thuê') {
      if (r.EndDate === tomorrow) await notify(r, { key: `return-tmr-${id}`, title: `Ngày mai hạn trả — đơn #${id}`,
        message: `Hạn trả đồ là ngày mai (${viDate(r.EndDate)}). Trả đúng hạn để được hoàn đủ cọc.` });
      if (r.EndDate === today) await notify(r, { key: `return-today-${id}`, level: 'warning', title: `Hôm nay hạn trả — đơn #${id}`,
        message: 'Hôm nay là hạn trả đồ. Trả trễ sẽ tính phí trễ theo ngày (trừ vào tiền cọc).' });
      if (r.EndDate < today) {
        const late = r.items.reduce((s, it) => s + Number(it.LateFeePerDay) * it.Quantity, 0);
        await notify(r, { key: `overdue-${id}-${today}`, level: 'danger', title: `Quá hạn trả ${daysBetween(r.EndDate, today)} ngày — đơn #${id}`,
          message: `Đơn đã quá hạn trả từ ${viDate(r.EndDate)}. Phí trễ ${vnd(late)}/ngày đang được tính. Vui lòng trả đồ sớm.` });
      }
    }
  }
}

// Tự hủy đơn chờ cọc quá hạn (chưa thu tiền nên không có phí hủy)
async function expirePending() {
  const limit = new Date(Date.now() - DEPOSIT_HOLD_HOURS * 3600e3);
  const list = await Rental.findAll({ where: { Status: 'Chờ cọc', createdAt: { [Op.lt]: limit } } });
  for (const r of list) {
    const line = `[${viDate(todayStr())}] Tự hủy: quá ${DEPOSIT_HOLD_HOURS} giờ chưa cọc.`;
    await r.update({ Status: 'Đã hủy', CancelFee: 0, RefundAmount: 0, Note: [r.Note, line].filter(Boolean).join('\n') });
    await notify(r, { level: 'danger', title: `Đơn #${r.RentalID} đã tự hủy`, message: `Quá ${DEPOSIT_HOLD_HOURS} giờ chưa nhận được tiền cọc nên đơn đã tự hủy. Bạn có thể đặt lại nếu mẫu còn trống.` });
  }
  return list.length;
}

module.exports = { notify, remindersFor, expirePending, depositDeadline };
