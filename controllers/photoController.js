// ẢNH TÌNH TRẠNG ĐỒ lúc giao / lúc nhận lại: lưu riêng tư, chỉ chủ đơn và nhân viên xem
const fs = require('fs');
const path = require('path');
const { sequelize, Rental, HandoverPhoto } = require('../models');
const { handoverDir } = require('../middlewares/upload');

const STAGES = {
  out: { label: 'Lúc giao', statuses: ['Đã cọc', 'Đang giao', 'Đang thuê'] },
  in: { label: 'Lúc nhận lại', statuses: ['Đang thuê', 'Đang gửi trả', 'Hoàn tất'] },
};
const MAX_PER_STAGE = 10;
exports.STAGES = STAGES;

// Không tin mimetype trình duyệt gửi: đọc vài byte đầu của file
async function isImage(file) {
  const h = await fs.promises.open(file, 'r');
  try {
    const b = Buffer.alloc(12);
    await h.read(b, 0, 12, 0);
    return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)          // JPEG
      || b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))   // PNG
      || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
      || b.toString('ascii', 0, 4) === 'GIF8';
  } finally { await h.close(); }
}

exports.upload = async (req, res) => {
  const files = req.files || [], id = parseInt(req.params.id) || 0;
  const stage = Object.hasOwn(STAGES, req.body.Stage) ? req.body.Stage : null;
  const finish = async (error) => {
    if (error) await Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
    req.flash(error ? 'error' : 'success', error || `Đã lưu ${files.length} ảnh ${STAGES[stage].label.toLowerCase()}.`);
    res.redirect(`/rentals/${id}`);
  };
  if (!stage || !files.length) return finish('Hãy chọn ảnh.');
  for (const f of files) if (!(await isImage(f.path))) return finish('Có file không phải ảnh JPG, PNG, WEBP hoặc GIF.');

  const error = await sequelize.transaction(async (t) => {
    const r = await Rental.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!r) return 'Không tìm thấy đơn.';
    if (!STAGES[stage].statuses.includes(r.Status)) return `Đơn đang "${r.Status}", không thêm ảnh "${STAGES[stage].label}" được.`;
    if (await HandoverPhoto.count({ where: { RentalID: id, Stage: stage }, transaction: t }) + files.length > MAX_PER_STAGE) return `Mỗi lần giao / nhận tối đa ${MAX_PER_STAGE} ảnh.`;
    await HandoverPhoto.bulkCreate(files.map(f => ({
      RentalID: id, Stage: stage, File: f.filename,
      Note: String(req.body.Note || '').trim().slice(0, 200),
      TakenBy: String(req.session.user.fullName || req.session.user.username).slice(0, 100),
    })), { transaction: t });
    return null;
  });
  return finish(error);
};

exports.view = async (req, res) => {
  const p = await HandoverPhoto.findByPk(parseInt(req.params.pid) || 0);
  const r = p && String(p.RentalID) === req.params.id ? await Rental.findByPk(p.RentalID) : null;
  const u = req.session.user;
  if (!r || !(u.role === 'admin' || u.role === 'nhanvien' || r.UserID === u.id)) return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(path.join(handoverDir, path.basename(p.File)), (err) => { if (err && !res.headersSent) res.sendStatus(404); });
};
