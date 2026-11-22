// QUY ĐỊNH LƯU ẢNH CCCD: xóa sau IDCARD_KEEP_DAYS ngày kể từ khi đơn kết thúc.
// Còn khoản hoàn / đền chưa xử lý thì giữ tới khi xong. Số CCCD trên hóa đơn vẫn giữ.
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Rental, LedgerEntry } = require('../models');
const { privateDir, uploadDir } = require('../middlewares/upload');
const { IDCARD_KEEP_DAYS } = require('./env');
const { todayStr, addDays } = require('./dates');

async function purgeIdCards() {
  const list = await Rental.unscoped().findAll({
    where: {
      IDCardImage: { [Op.ne]: null },
      [Op.or]: [
        { Status: 'Hoàn tất', ReturnDate: { [Op.lt]: addDays(todayStr(), -IDCARD_KEEP_DAYS) } },
        { Status: 'Đã hủy', updatedAt: { [Op.lt]: new Date(Date.now() - IDCARD_KEEP_DAYS * 864e5) } },
      ],
    },
  });
  let removed = 0;
  for (const r of list) {
    if (await LedgerEntry.unscoped().count({ where: { RentalID: r.RentalID, Status: 'pending' } })) continue;
    const name = path.basename(r.IDCardImage);
    if (!name || name === '.' || name === '..') continue;
    const file = path.join(r.IDCardImage.startsWith('/uploads/') ? uploadDir : privateDir, name);
    try { await fs.promises.unlink(file); }
    catch (e) {
      if (e.code !== 'ENOENT') { console.error(`Không xóa được ảnh CCCD đơn #${r.RentalID}:`, e.code); continue; }
    }
    // silent: không đổi updatedAt (thống kê dùng nó làm ngày hủy đơn)
    await r.update({ IDCardImage: null, IDCardDeletedAt: new Date() }, { silent: true });
    removed++;
  }
  return removed;
}

module.exports = { purgeIdCards };
