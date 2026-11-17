// THÔNG TIN CHI TIẾT SẢN PHẨM (bảng ở trang chi tiết, nhân viên nhập ở form Thêm / Sửa — đều không bắt buộc)
const { normalize } = require('./text');

const DETAIL_FIELDS = [
  { key: 'Material', label: 'Chất liệu', placeholder: 'VD: Lụa tơ tằm, voan, gấm, ren...' },
  { key: 'Style', label: 'Kiểu dáng', placeholder: 'VD: Truyền thống, cách tân, xòe, ôm, trễ vai...' },
  { key: 'Length', label: 'Độ dài', placeholder: 'VD: Qua gối, chạm gót, ngang gối...' },
  { key: 'Occasion', label: 'Phù hợp dịp', placeholder: 'VD: Đám cưới, Tết, kỷ yếu, dạ tiệc, chụp ảnh...' },
  { key: 'CareGuide', label: 'Bảo quản', placeholder: 'VD: Không tự giặt, tránh mỹ phẩm, nước hoa...' },
];

// Gợi ý thông tin chi tiết từ tên / mô tả (dùng cho dữ liệu mẫu và sản phẩm cũ chưa có — nhân viên sửa lại cho đúng)
function guessDetails(p) {
  const t = normalize(`${p.ProductName} ${p.Description}`);
  const has = (...k) => k.some(x => t.includes(x));
  const type = p.ProductType;
  const out = {};
  if (type === 'Phụ kiện') {
    out.Material = has('ngoc trai') ? 'Ngọc trai nhân tạo' : has('tui', 'da ') ? 'Da tổng hợp' : has('pha le') ? 'Pha lê' : has('da quy', 'da xanh', 'dinh da') ? 'Hợp kim mạ, đính đá' : 'Hợp kim mạ';
    out.Style = has('tui') ? (has('deo cheo') ? 'Túi đeo chéo' : 'Túi cầm tay') : has('vong co', 'day chuyen') ? 'Dây chuyền' : has('nhan') ? 'Nhẫn' : has('bong tai') ? 'Bông tai thả' : 'Vòng / lắc tay';
    out.CareGuide = 'Tránh nước, nước hoa và va đập mạnh; cất trong hộp khi không dùng.';
  } else {
    out.Material = has('gam') ? 'Gấm' : has('ren') ? 'Ren' : has('voan') ? 'Voan' : has('lua') ? 'Lụa' : type === 'Áo dài' ? 'Lụa' : 'Voan / chiffon';
    if (type === 'Áo dài') {
      out.Style = has('cach tan') ? 'Áo dài cách tân' : 'Áo dài truyền thống';
      out.Length = has('cach tan') ? 'Tà ngắn, kèm chân váy' : 'Tà dài qua gối, kèm quần';
    } else {
      out.Style = [has('tre vai') && 'Trễ vai', has('xoe') && 'Dáng xòe', has('maxi') && 'Maxi', has('om dang') && 'Ôm dáng', has('xe ta') && 'Xẻ tà'].filter(Boolean).join(', ') || 'Váy dự tiệc';
      out.Length = has('maxi', 'dang dai', 'da hoi') ? 'Dài chạm gót' : has('ngan') ? 'Trên gối' : 'Ngang gối';
    }
    out.CareGuide = 'Không tự giặt, ủi hay sửa — cửa hàng giặt hấp chuyên dụng sau mỗi lượt thuê. Tránh mỹ phẩm, nước hoa dính lên vải.';
  }
  const dip = [
    has('cuoi', 'an hoi', 'co dau') && 'Đám cưới, ăn hỏi',
    has('tet', 'ngay xuan', 'le hoi') && 'Tết, lễ hội',
    has('ky yeu', 'tot nghiep', 'nu sinh') && 'Kỷ yếu, tốt nghiệp',
    has('da tiec', 'gala', 'su kien', 'tiec') && 'Dạ tiệc, sự kiện',
    has('chup anh', 'chup hinh', 'du lich', 'dao pho', 'nghi duong') && 'Chụp ảnh, du lịch',
  ].filter(Boolean);
  out.Occasion = dip.join(' · ') || 'Dự tiệc, chụp ảnh';
  return out;
}

module.exports = { DETAIL_FIELDS, guessDetails };
