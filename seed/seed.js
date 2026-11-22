const { Product, User, Coupon, Rental, RentalItem, Bundle } = require('../models');
const { standardChart } = require('../utils/sizeChart');
const { guessDetails } = require('../utils/details');
const { DEMO_DATA } = require('../utils/dataKind');

/* ============================================================
   DỮ LIỆU MẪU — Shop trang phục NỮ: Áo dài · Váy tiệc · Phụ kiện
   Mỗi sản phẩm: ẢNH ↔ TÊN ↔ MÔ TẢ ↔ MÀU khớp nhau (ảnh host local).
   ============================================================ */

const round5 = (n) => Math.round(n / 5000) * 5000;

// Áo dài — ảnh thật tải từ Pixabay (miễn phí thương mại), lưu /public/img/aodai
const AO_DAI = [
  { img: 'p1',  name: 'Áo dài truyền thống tím',     color: 'Tím',        price: 185000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài truyền thống màu tím trang nhã, tà áo thướt tha đi kèm quần trắng và nón lá. Tôn dáng, thanh lịch cho lễ cưới, chụp kỷ yếu, sự kiện.' },
  { img: 'p2',  name: 'Áo dài hồng pastel họa tiết',  color: 'Hồng pastel', price: 165000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Áo dài sắc hồng pastel nhẹ nhàng, họa tiết tinh tế, chất liệu mềm mại. Phù hợp chụp ảnh, dạo phố ngày xuân.' },
  { img: 'p3',  name: 'Áo dài cách tân cam đất',      color: 'Cam đất',    price: 175000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài cách tân màu cam đất kết hợp chân váy xếp ly hiện đại, trẻ trung mà vẫn giữ nét truyền thống. Dễ mặc, dễ phối.' },
  { img: 'p4',  name: 'Áo dài trắng tinh khôi',       color: 'Trắng',      price: 160000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng tinh khôi, dáng dài cổ điển, toát lên sự dịu dàng, trong trẻo. Lý tưởng cho lễ tốt nghiệp và chụp hình ngoại cảnh.' },
  { img: 'p6',  name: 'Áo dài đỏ duyên dáng',         color: 'Đỏ',         price: 195000, status: 'Còn trống'    , size: 'M, L, XL',
    desc: 'Áo dài đỏ duyên dáng, màu sắc nổi bật, đường may tỉ mỉ. Rất hợp cho lễ ăn hỏi, chụp ảnh cưới và các dịp trọng đại.' },
  { img: 'p7',  name: 'Áo dài gấm đỏ đô',             color: 'Đỏ đô',      price: 210000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài gấm màu đỏ đô sang trọng, chất gấm dày dặn ánh nhẹ, thêu hoa tinh xảo. Đẳng cấp cho mẹ cô dâu, sự kiện cao cấp.' },
  { img: 'p9',  name: 'Áo dài trắng nữ sinh',         color: 'Trắng',      price: 150000, status: 'Còn trống',     size: 'M',
    desc: 'Áo dài trắng nữ sinh thanh thuần, dáng truyền thống thướt tha. Gợi nhớ tà áo sân trường, hợp chụp bộ ảnh nhẹ nhàng.' },
  { img: 'p10', name: 'Áo dài đỏ gấm ngày Tết',       color: 'Đỏ',         price: 205000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài đỏ gấm rực rỡ cho ngày Tết, họa tiết truyền thống bên khung cảnh đèn lồng. Mang không khí xuân sum vầy, may mắn.' },

  // --- Bổ sung thêm mẫu áo dài (tham khảo các shop cho thuê áo dài: truyền thống, cách tân, cưới hỏi, bê tráp, nhung, gấm, kỷ yếu) ---
  { img: 'p1',  name: 'Áo dài lụa tím cổ truyền',      color: 'Tím',        price: 180000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài lụa tơ tằm màu tím cổ truyền, tà dài thướt tha, cổ cao kín đáo. Lên dáng chuẩn, hợp lễ cưới hỏi và chụp ảnh ngoại cảnh ở phố cổ, cung đình.' },
  { img: 'p1',  name: 'Áo dài tím Huế thêu hoa sen',   color: 'Tím Huế',    price: 190000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài lụa tím Huế thêu hoa sen tinh tế ở tà và ngực áo, đậm chất thơ. Lý tưởng cho bộ ảnh kỷ yếu, tốt nghiệp và sự kiện văn hóa.' },
  { img: 'p2',  name: 'Áo dài hồng phấn đính ngọc',    color: 'Hồng phấn',  price: 185000, status: 'Còn trống',     size: 'S, M',
    desc: 'Áo dài voan hồng phấn đính hạt ngọc lấp lánh quanh cổ và tà, ngọt ngào nữ tính. Rất hợp đội hình bưng quả, bê tráp và chụp ảnh ăn hỏi.',
    occasion: 'Đám cưới, ăn hỏi, bê tráp · Chụp ảnh' },
  { img: 'p2',  name: 'Áo dài cưới cô dâu hồng pastel', color: 'Hồng pastel', price: 265000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Áo dài cưới dành cho cô dâu, sắc hồng pastel phủ ren đính kết nhẹ nhàng, kèm khăn đóng. Dịu dàng mà sang trọng cho lễ ăn hỏi, lễ cưới.',
    material: 'Lụa phối ren đính kết', occasion: 'Đám cưới, ăn hỏi, cô dâu' },
  { img: 'p3',  name: 'Áo dài cách tân cam gạch xếp ly', color: 'Cam gạch', price: 170000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài cách tân màu cam gạch kèm chân váy xếp ly, trẻ trung năng động mà vẫn duyên dáng. Dễ mặc cho dạo phố, du xuân và chụp ảnh đường phố.' },
  { img: 'p3',  name: 'Áo dài cam đất tay loa',        color: 'Cam đất',    price: 168000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài cam đất phối tay loa điệu đà, tông màu trầm ấm hợp tiết thu. Nổi bật, cá tính cho buổi chụp hình nghệ thuật và sự kiện ngoài trời.' },
  { img: 'p4',  name: 'Áo dài lụa trắng ngà',          color: 'Trắng ngà',  price: 165000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài lụa trắng ngà trơn thanh lịch, dáng truyền thống chuẩn mực. Tôn sự dịu dàng, trong trẻo cho lễ tốt nghiệp và chụp ảnh sân trường.' },
  { img: 'p4',  name: 'Áo dài trắng lễ tốt nghiệp',    color: 'Trắng',      price: 160000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng tinh khôi may dáng ôm nhẹ, kèm quần trắng, phù hợp lễ tốt nghiệp. Thuê theo nhóm, số lượng nhiều cho cả lớp chụp kỷ yếu.' },
  { img: 'p9',  name: 'Áo dài trắng kỷ yếu nhóm',      color: 'Trắng',      price: 155000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng nữ sinh dáng thướt tha, có sẵn nhiều size cho cả nhóm chụp kỷ yếu, tốt nghiệp. Nhẹ nhàng, trong sáng cho tà áo sân trường.' },
  { img: 'p6',  name: 'Áo dài đỏ lông vũ dự tiệc',     color: 'Đỏ',         price: 230000, status: 'Còn trống',     size: 'M, L',
    desc: 'Áo dài đỏ phối viền lông vũ ở tay áo sang chảnh, điểm đính kết lấp lánh. Cuốn hút, nổi bật cho dạ tiệc cuối năm, chụp ảnh Tết và sự kiện.' },
  { img: 'p6',  name: 'Áo dài nhung đỏ mẹ cô dâu',     color: 'Đỏ',         price: 250000, status: 'Còn trống',     size: 'L, XL, XXL',
    desc: 'Áo dài nhung đỏ dáng rộng rãi, chất nhung dày dặn ấm áp, thêu hoa trang nhã. Đứng tuổi mà quý phái, dành cho mẹ cô dâu trong lễ cưới, ăn hỏi.',
    material: 'Nhung', occasion: 'Đám cưới, ăn hỏi, mẹ cô dâu' },
  { img: 'p7',  name: 'Áo dài gấm đỏ đô thêu phượng',  color: 'Đỏ đô',      price: 240000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài gấm đỏ đô thêu phượng hoàng cầu kỳ, chất gấm ánh nhẹ sang trọng. Đẳng cấp cho lễ cưới, mẹ cô dâu và các sự kiện truyền thống cao cấp.' },
  { img: 'p7',  name: 'Áo dài đỏ đô đội bê tráp',      color: 'Đỏ đô',      price: 175000, status: 'Còn trống',     size: 'S, M, L, XL',
    desc: 'Áo dài đỏ đô gấm nhẹ, đồng bộ nhiều size cho đội hình bưng quả, bê tráp trong lễ ăn hỏi. Chỉn chu, đều đẹp cho cả nhóm nam thanh nữ tú.',
    occasion: 'Đám cưới, ăn hỏi, bê tráp' },
  { img: 'p10', name: 'Áo dài gấm đỏ cô dâu',          color: 'Đỏ',         price: 270000, status: 'Còn trống',     size: 'M, L',
    desc: 'Áo dài gấm đỏ cô dâu rực rỡ, đính kết thủ công, kèm khăn đóng truyền thống. Lộng lẫy, may mắn cho lễ cưới, lễ ăn hỏi và dịp trọng đại.',
    salePrice: 245000, saleEnd: '2026-12-31', occasion: 'Đám cưới, ăn hỏi, cô dâu' },

  // --- Đợt 2: mở rộng thêm mẫu áo dài cho đủ nhiều trang ---
  { img: 'p1',  name: 'Áo dài tím cách tân tay phồng', color: 'Tím',        price: 172000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài cách tân màu tím phối tay phồng điệu đà, trẻ trung mà vẫn duyên. Dễ phối, hợp dạo phố, du xuân và chụp ảnh đường phố.' },
  { img: 'p1',  name: 'Áo dài tím đính hoa nổi',       color: 'Tím',        price: 188000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài lụa tím đính hoa nổi 3D ở tà và vai, nữ tính sang trọng. Lên hình đẹp cho kỷ yếu, sự kiện và chụp ảnh ngoại cảnh.' },
  { img: 'p2',  name: 'Áo dài hồng pastel vẽ hoa',     color: 'Hồng pastel', price: 170000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Áo dài hồng pastel vẽ tay họa tiết hoa mềm mại, dịu dàng tươi tắn. Hợp dạo phố ngày xuân, chụp ảnh và các buổi tiệc nhẹ.' },
  { img: 'p2',  name: 'Áo dài hồng ruốc bưng quả',     color: 'Hồng',       price: 176000, status: 'Còn trống',     size: 'S, M, L, XL',
    desc: 'Áo dài hồng ruốc đồng bộ nhiều size cho đội hình bưng quả, bê tráp. Tươi tắn, chỉn chu cho lễ ăn hỏi, đám hỏi.',
    occasion: 'Đám cưới, ăn hỏi, bê tráp' },
  { img: 'p3',  name: 'Áo dài cam đất công sở',        color: 'Cam đất',    price: 158000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài cam đất dáng suông thanh lịch, kín đáo nhã nhặn cho môi trường công sở, lễ tân, sự kiện cơ quan.' },
  { img: 'p3',  name: 'Áo dài cam cách tân phối nơ',   color: 'Cam gạch',   price: 166000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài cách tân cam gạch phối nơ eo xinh xắn, chân váy xếp ly. Trẻ trung, dễ thương cho du xuân và chụp ảnh.' },
  { img: 'p4',  name: 'Áo dài trắng vẽ sen',           color: 'Trắng',      price: 178000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng vẽ tay hoa sen thanh thoát, đậm nét Á Đông. Tinh khôi, nổi bật cho bộ ảnh nghệ thuật và sự kiện văn hóa.' },
  { img: 'p4',  name: 'Áo dài trắng đính pha lê',      color: 'Trắng',      price: 182000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng đính pha lê lấp lánh dọc tà, sang trọng tinh tế. Lý tưởng cho lễ tốt nghiệp, kỷ yếu và chụp ảnh cưới.' },
  { img: 'p6',  name: 'Áo dài đỏ cô dâu đính kết',     color: 'Đỏ',         price: 275000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài đỏ cô dâu đính kết thủ công cầu kỳ, kèm khăn đóng. Rực rỡ, may mắn cho lễ cưới, lễ ăn hỏi và dịp trọng đại.',
    occasion: 'Đám cưới, ăn hỏi, cô dâu' },
  { img: 'p6',  name: 'Áo dài đỏ tươi chụp Tết',       color: 'Đỏ',         price: 198000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài đỏ tươi dáng truyền thống rạng rỡ, hợp không khí ngày xuân. Mang may mắn, sum vầy cho bộ ảnh Tết của cả nhà.' },
  { img: 'p7',  name: 'Áo dài gấm đỏ đô trung niên',   color: 'Đỏ đô',      price: 220000, status: 'Còn trống',     size: 'L, XL, XXL',
    desc: 'Áo dài gấm đỏ đô dáng rộng, chất gấm dày sang trọng, thêu hoa nhã. Quý phái, đứng tuổi cho mẹ cô dâu và sự kiện gia đình.' },
  { img: 'p7',  name: 'Áo dài đỏ đô vương miện cô dâu', color: 'Đỏ đô',     price: 268000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài gấm đỏ đô cô dâu kèm mấn vương miện đính đá, lộng lẫy. Sang trọng, nổi bật cho lễ cưới và lễ ăn hỏi.',
    occasion: 'Đám cưới, ăn hỏi, cô dâu' },
  { img: 'p9',  name: 'Áo dài trắng nhóm bạn thân',    color: 'Trắng',      price: 150000, status: 'Còn trống',     size: 'S, M, L, XL',
    desc: 'Áo dài trắng truyền thống, sẵn nhiều size cho cả nhóm bạn chụp kỷ yếu, tốt nghiệp. Trong sáng, đồng đều, lên hình ăn ý.' },
  { img: 'p9',  name: 'Áo dài trắng cổ thuyền tối giản', color: 'Trắng',    price: 158000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng cổ thuyền tối giản, phom hiện đại thanh lịch. Nhẹ nhàng, tinh tế cho chụp ảnh và sự kiện ban ngày.' },
  { img: 'p10', name: 'Áo dài gấm đỏ họa tiết trống đồng', color: 'Đỏ',     price: 212000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài gấm đỏ họa tiết trống đồng đậm bản sắc Việt, đường may tỉ mỉ. Hợp sự kiện văn hóa, lễ Tết và chụp ảnh truyền thống.' },
  { img: 'p10', name: 'Áo dài đỏ gấm du xuân',         color: 'Đỏ',         price: 200000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài đỏ gấm rực rỡ bên khung cảnh đèn lồng, ngập không khí xuân. May mắn, sum vầy cho bộ ảnh Tết và du xuân đầu năm.' },
];

// Váy tiệc / Đầm dạ hội — ảnh Unsplash, lưu /public/img/vaytiec
const VAY_TIEC = [
  { img: 'v1', name: 'Váy maxi xanh ngọc',          color: 'Xanh ngọc',  price: 210000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy maxi xanh ngọc dáng dài bay bổng, chất voan mềm rũ. Tôn làn da, lý tưởng cho tiệc ngoài trời và chụp ảnh dã ngoại.' },
  { img: 'v2', name: 'Váy maxi cam san hô',         color: 'Cam san hô', price: 220000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy maxi màu cam san hô tươi tắn kèm nón rộng vành, phong cách nghỉ dưỡng. Nổi bật cho tiệc biển và du lịch.' },
  { img: 'v3', name: 'Đầm dạ hội tím trễ vai',      color: 'Tím',        price: 320000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm dạ hội tím trễ vai ôm dáng, tôn vòng eo và bờ vai gợi cảm. Sang trọng cho gala, tiệc cưới và sự kiện tối.' },
  { img: 'v4', name: 'Váy xòe đỏ họa tiết',         color: 'Đỏ',         price: 240000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy xòe đỏ họa tiết thắt eo bản to, phom cổ điển thanh lịch. Rực rỡ, trẻ trung cho tiệc tùng và chụp hình.' },
  { img: 'v5', name: 'Đầm dạ hội đỏ dáng dài',      color: 'Đỏ',         price: 360000, status: 'Còn trống',     size: 'S, M',
    desc: 'Đầm dạ hội đỏ dáng dài thướt tha, đuôi váy xòe quyến rũ. Lộng lẫy, cuốn hút cho thảm đỏ và dạ tiệc.' },
  { img: 'v6', name: 'Váy trắng trễ vai',           color: 'Trắng',      price: 230000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy trắng trễ vai ngắn xinh, bèo nhún nhẹ nhàng, tinh khôi. Phù hợp tiệc nhẹ, dạo phố và chụp ảnh mùa hè.' },
  { img: 'v7', name: 'Đầm xanh pastel bay bổng',    color: 'Xanh pastel', price: 250000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Đầm xanh pastel xẻ tà bay bổng, chất liệu nhẹ mềm. Dịu dàng, lãng mạn cho tiệc biển và bộ ảnh ngoại cảnh.' },
  { img: 'v8', name: 'Váy đỏ chấm bi cổ điển',      color: 'Đỏ chấm bi', price: 215000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy đỏ chấm bi phong cách vintage, dáng xòe nữ tính. Đáng yêu, nổi bật cho buổi hẹn và tiệc chủ đề cổ điển.' },
  { img: 'v9', name: 'Đầm ren xanh navy',           color: 'Xanh navy',  price: 300000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm ren xanh navy cắt xẻ tinh tế, chất ren cao cấp. Huyền bí, sang trọng cho dạ tiệc và sự kiện cuối năm.' },

  // --- Bổ sung thêm váy tiệc / đầm dạ hội ---
  { img: 'v3', name: 'Đầm dạ hội tím trễ vai ánh kim', color: 'Tím',      price: 330000, status: 'Còn trống',     size: 'S, M',
    desc: 'Đầm dạ hội tím trễ vai ôm sát tôn dáng, chất liệu ánh kim lấp lánh dưới đèn. Quyến rũ, sang trọng cho gala, tiệc cưới và sự kiện buổi tối.',
    salePrice: 290000, saleEnd: '2026-12-31' },
  { img: 'v5', name: 'Đầm dạ hội đỏ xẻ tà thảm đỏ',  color: 'Đỏ',         price: 375000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm dạ hội đỏ dáng dài xẻ tà cao, đuôi váy xòe thướt tha. Lộng lẫy, cuốn hút cho thảm đỏ, dạ tiệc và chụp ảnh sự kiện.' },
  { img: 'v9', name: 'Đầm ren navy cắt eo dự tiệc',  color: 'Xanh navy',  price: 315000, status: 'Còn trống',     size: 'M, L',
    desc: 'Đầm ren xanh navy tay dài, khéo cắt xẻ eo tinh tế, ren hoa cao cấp. Thanh lịch, bí ẩn cho tiệc tối và sự kiện cuối năm.' },
  { img: 'v7', name: 'Đầm xanh baby xẻ tà đi biển', color: 'Xanh pastel', price: 240000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Đầm maxi xanh baby hai dây xẻ tà, chất voan mềm bay trong gió biển. Lãng mạn, nhẹ nhàng cho tiệc biển, du lịch và chụp ảnh nghỉ dưỡng.' },
  { img: 'v1', name: 'Váy voan xanh ngọc xoay nhẹ', color: 'Xanh ngọc',  price: 215000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy voan xanh ngọc tay loa, chân váy xoay bồng bềnh khi di chuyển. Tôn làn da, hợp tiệc ngoài trời và bộ ảnh dã ngoại trong trẻo.' },

  // --- Đợt 2: mở rộng thêm váy tiệc / đầm dạ hội cho đủ nhiều trang ---
  { img: 'v1', name: 'Đầm xanh ngọc cổ yếm',        color: 'Xanh ngọc',  price: 218000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm xanh ngọc cổ yếm khoe vai gáy, chất voan rũ mềm. Dịu dàng, nữ tính cho tiệc ngoài trời và chụp ảnh dã ngoại.' },
  { img: 'v2', name: 'Váy maxi cam san hô tiệc biển', color: 'Cam san hô', price: 225000, status: 'Còn trống',   size: 'M, L, XL',
    desc: 'Váy maxi cam san hô tươi tắn, dáng dài bay bổng kèm nón rộng vành. Nổi bật cho tiệc biển, du lịch và nghỉ dưỡng.' },
  { img: 'v3', name: 'Đầm tím ôm body dạ hội',      color: 'Tím',        price: 335000, status: 'Còn trống',     size: 'S, M',
    desc: 'Đầm dạ hội tím ôm body tôn đường cong, chất gấm ánh nhẹ. Quyến rũ, sang trọng cho gala, dạ tiệc và sự kiện tối.' },
  { img: 'v3', name: 'Váy tím pastel tiểu thư',     color: 'Tím pastel', price: 240000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy tím pastel phong cách tiểu thư, phối tùng xòe nhẹ nhàng. Ngọt ngào, thanh lịch cho tiệc trà, sinh nhật và chụp ảnh.' },
  { img: 'v4', name: 'Váy xòe đỏ hoa nhí vintage',  color: 'Đỏ',         price: 228000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy xòe đỏ hoa nhí phong cách vintage, thắt eo bản to cổ điển. Đáng yêu, nổi bật cho buổi hẹn và tiệc chủ đề retro.' },
  { img: 'v5', name: 'Đầm đỏ đuôi cá dạ hội',       color: 'Đỏ',         price: 365000, status: 'Còn trống',     size: 'S, M',
    desc: 'Đầm đỏ đuôi cá ôm dáng, đuôi váy xòe quyến rũ thướt tha. Lộng lẫy, cuốn hút cho thảm đỏ, gala và dạ tiệc cao cấp.' },
  { img: 'v6', name: 'Đầm trắng bồng tiệc cưới',    color: 'Trắng',      price: 250000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm trắng tùng bồng bềnh nhẹ nhàng, tinh khôi như cô dâu nhỏ. Hợp tiệc cưới, lễ đính hôn và chụp ảnh đôi.' },
  { img: 'v6', name: 'Váy trắng trễ vai tiểu thư',  color: 'Trắng',      price: 232000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy trắng trễ vai bèo nhún nhẹ nhàng, trong trẻo nữ tính. Phù hợp tiệc nhẹ, dạo phố và chụp ảnh mùa hè.' },
  { img: 'v7', name: 'Đầm xanh pastel hai dây',     color: 'Xanh pastel', price: 238000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Đầm xanh pastel hai dây xẻ tà, chất voan mềm bay trong gió. Lãng mạn, mát mẻ cho tiệc biển và chụp ảnh nghỉ dưỡng.' },
  { img: 'v8', name: 'Váy đỏ chấm bi retro',        color: 'Đỏ chấm bi', price: 212000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy đỏ chấm bi dáng xòe phong cách retro, nữ tính vui tươi. Nổi bật, dễ thương cho buổi hẹn và tiệc chủ đề cổ điển.' },
  { img: 'v9', name: 'Đầm ren navy tay dài quý cô', color: 'Xanh navy',  price: 318000, status: 'Còn trống',     size: 'M, L',
    desc: 'Đầm ren xanh navy tay dài, cắt xẻ tinh tế, chất ren cao cấp. Sang trọng, kín đáo cho dạ tiệc và sự kiện cuối năm.' },
  { img: 'v6', name: 'Đầm trắng công chúa dự tiệc', color: 'Trắng',      price: 255000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm trắng dáng công chúa tùng xòe, đính nơ eo tinh tế. Lộng lẫy, đáng yêu cho tiệc sinh nhật và sự kiện trang trọng.' },
  { img: 'v1', name: 'Váy xanh ngọc chiffon xoay',  color: 'Xanh ngọc',  price: 216000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy xanh ngọc chất chiffon mỏng nhẹ, chân váy xoay đẹp khi chụp. Tươi mát, bay bổng cho tiệc ngoài trời và dã ngoại.' },
  { img: 'v3', name: 'Đầm tím than dạ hội ánh nhũ', color: 'Tím than',   price: 330000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm dạ hội tím than phủ ánh nhũ lấp lánh, ôm nhẹ tôn dáng. Huyền bí, sang trọng cho gala và sự kiện buổi tối.' },
];

// Phụ kiện — ảnh Unsplash, lưu /public/img/phukien
const PHU_KIEN = [
  { img: 'k1', name: 'Vòng cổ ngọc trai',        color: 'Trắng ngọc', price: 60000,  unit: 'chiếc', status: 'Còn trống',   size: 'Dài 40cm, Dài 45cm',
    desc: 'Vòng cổ ngọc trai thanh lịch, ánh sáng dịu nhẹ. Tôn nét cổ điển, hợp với áo dài và đầm dạ hội.' },
  { img: 'k2', name: 'Nhẫn đá quý lấp lánh',     color: 'Bạc',        price: 45000,  unit: 'chiếc', status: 'Còn trống',   size: 'Ni 6, Ni 7, Ni 8',
    desc: 'Nhẫn đính đá quý lấp lánh, thiết kế tinh xảo. Điểm nhấn sang trọng cho bàn tay trong ngày trọng đại.' },
  { img: 'k3', name: 'Bông tai đá xanh sang trọng', color: 'Xanh',    price: 50000,  unit: 'đôi',   status: 'Còn trống',   size: 'Free size',
    desc: 'Bông tai đính đá xanh lấp lánh, dáng thả nhẹ nhàng. Làm bừng sáng khuôn mặt khi dự tiệc.' },
  { img: 'k4', name: 'Túi xách tay màu đỏ',      color: 'Đỏ',         price: 90000,  unit: 'chiếc', status: 'Còn trống',   size: 'Nhỏ, Lớn',
    desc: 'Túi xách tay da màu đỏ nổi bật, kiểu dáng thanh lịch. Điểm nhấn cuốn hút cho mọi bộ trang phục.' },
  { img: 'k5', name: 'Túi đeo chéo đen cao cấp', color: 'Đen',        price: 110000, unit: 'chiếc', status: 'Còn trống'    , size: 'Free size',
    desc: 'Túi đeo chéo đen cao cấp, chần trám sang trọng, khóa kim loại. Phối được với cả váy tiệc lẫn trang phục dạo phố.' },
  { img: 'k6', name: 'Lắc tay pha lê lấp lánh',  color: 'Bạc',        price: 55000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Lắc tay pha lê lấp lánh trên nền đen huyền bí, lung linh dưới ánh đèn. Hoàn thiện vẻ quý phái khi dự tiệc.' },
  { img: 'k7', name: 'Vòng tay vàng đính đá',    color: 'Vàng gold',  price: 65000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Vòng tay ánh vàng gold đính đá tinh tế, sang chảnh. Tôn làn da, hợp dạ tiệc và sự kiện cao cấp.' },
  { img: 'k8', name: 'Dây chuyền mặt đá xanh',   color: 'Xanh',       price: 70000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Dây chuyền layer với mặt đá xanh và mặt trăng khuyết, cá tính. Điểm nhấn thời thượng cho outfit dự tiệc.' },
  { img: 'k9', name: 'Túi xách hồng pastel',     color: 'Hồng pastel', price: 85000, unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Túi xách hồng pastel ngọt ngào, dáng nhỏ xinh cầm tay. Dễ thương, hợp các buổi tiệc nhẹ và hẹn hò.' },

  // --- Bổ sung thêm phụ kiện đi kèm áo dài / váy tiệc ---
  { img: 'k1', name: 'Vòng cổ ngọc trai hai tầng', color: 'Trắng ngọc', price: 65000, unit: 'chiếc', status: 'Còn trống', size: 'Dài 40cm, Dài 45cm',
    desc: 'Vòng cổ ngọc trai xếp hai tầng thanh lịch, ánh sáng dịu nhẹ sang trọng. Tôn nét cổ điển, rất hợp khi mặc áo dài cưới và đầm dạ hội.' },
  { img: 'k4', name: 'Túi cầm tay đỏ dự tiệc',   color: 'Đỏ',         price: 95000,  unit: 'chiếc', status: 'Còn trống',   size: 'Nhỏ, Vừa',
    desc: 'Túi cầm tay da màu đỏ nổi bật, khóa kim loại sang trọng, dáng gọn. Điểm nhấn cuốn hút khi phối cùng áo dài đỏ và đầm dạ tiệc.' },
  { img: 'k3', name: 'Bông tai đá xanh dáng dài', color: 'Xanh',      price: 52000,  unit: 'đôi',   status: 'Còn trống',   size: 'Free size',
    desc: 'Bông tai đính đá xanh thả dài lấp lánh, nhẹ tai dễ đeo. Làm bừng sáng khuôn mặt, tôn vẻ sang trọng khi dự tiệc và chụp ảnh.' },
  { img: 'k7', name: 'Vòng tay vàng bản nhỏ đính đá', color: 'Vàng gold', price: 60000, unit: 'chiếc', status: 'Còn trống', size: 'Free size',
    desc: 'Vòng tay ánh vàng gold bản nhỏ đính đá tinh tế, nhẹ nhàng không phô trương. Hợp cả áo dài lẫn đầm dự tiệc, tôn làn da tay.' },
  { img: 'k9', name: 'Túi đeo hồng pastel dây xích', color: 'Hồng pastel', price: 88000, unit: 'chiếc', status: 'Còn trống', size: 'Free size',
    desc: 'Túi hồng pastel dáng hộp nhỏ xinh, dây xích tháo rời cầm tay hoặc đeo chéo. Ngọt ngào, trẻ trung cho tiệc nhẹ, sinh nhật và hẹn hò.' },
];

function buildProducts() {
  const items = [];

  const push = (o) => {
    const price = round5(o.price);
    items.push({
      ProductName: o.name,
      ProductType: o.type,
      PathImage: o.path,
      Quantity: o.qty,
      Unit: o.unit,
      Price: price,
      Color: o.color,
      Size: o.size,
      DepositValue: round5(price * 2),
      LateFeePerDay: round5(price / 2),
      ProductValue: Math.round(price * 12 / 50000) * 50000,   // giá trị đền bù khi mất / hư nặng
      Status: o.status,
      Description: o.desc,
      SizeChart: o.type === 'Phụ kiện' ? null : standardChart(o.size),   // số đo tham khảo theo size
      // Thông tin chi tiết nhập tay (nếu có) — sẽ ưu tiên hơn phần tự gợi ý ở guessDetails
      Material: o.material,
      Style: o.style,
      Length: o.length,
      Occasion: o.occasion,
      CareGuide: o.care,
      // Khuyến mãi của cửa hàng (nếu có): giá thuê sale + ngày kết thúc
      SalePrice: o.salePrice != null ? round5(o.salePrice) : null,
      SaleEnd: o.saleEnd || null,
    });
  };

  AO_DAI.forEach((p, i) => push({
    ...p, type: 'Áo dài', unit: 'bộ', qty: 3 + (i % 6),
    path: `/img/aodai/${p.img}.jpg`,
  }));
  VAY_TIEC.forEach((p, i) => push({
    ...p, type: 'Váy tiệc', unit: 'bộ', qty: 2 + (i % 5),
    path: `/img/vaytiec/${p.img}.jpg`,
  }));
  PHU_KIEN.forEach((p, i) => push({
    ...p, type: 'Phụ kiện', unit: p.unit || 'chiếc', qty: 5 + (i % 8),
    path: `/img/phukien/${p.img}.jpg`,
  }));

  return items;
}

async function seed() {
  const countUser = await User.count();
  if (!DEMO_DATA) {
    // Chạy thật: chỉ tạo đúng 1 admin cho CSDL trống
    if (countUser === 0) {
      const password = String(process.env.ADMIN_PASSWORD || '');
      if (password.length < 10) throw new Error('DEMO_DATA=false trên CSDL trống: cần ADMIN_PASSWORD (ít nhất 10 ký tự) trong .env');
      await User.create({ username: 'admin', password, fullName: 'Quản trị viên', role: 'admin', isVerified: true });
      console.log('👤 Đã tạo tài khoản admin (mật khẩu: ADMIN_PASSWORD trong .env). Không nạp dữ liệu mẫu.');
    }
    return;
  }
  if (countUser === 0) {
    await User.create({ username: 'admin', password: 'admin123', fullName: 'Quản trị viên', role: 'admin', isVerified: true });
    await User.create({ username: 'nhanvien', password: '123456', fullName: 'Nhân viên A', role: 'nhanvien', isVerified: true });
    await User.create({ username: 'khachhang', password: '123456', fullName: 'Khách Hàng', role: 'khach', isVerified: true });
    console.log('👤 Đã tạo tài khoản: admin/admin123, nhanvien/123456, khachhang/123456');
  }

  const count = await Product.count();
  if (count === 0) {
    // + thông tin chi tiết: ưu tiên giá trị nhập tay; phần nào bỏ trống thì lấy gợi ý từ guessDetails
    const list = buildProducts().map(p => {
      const merged = { ...p, ...guessDetails(p) };
      for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null) merged[k] = v;
      return merged;
    });
    await Product.bulkCreate(list);
    console.log(`🧥 Đã nạp ${list.length} sản phẩm nữ (áo dài + váy tiệc + phụ kiện).`);
  }

  // Đơn thuê mẫu ở nhiều trạng thái (để nhân viên test) — chỉ tạo khi chưa có đơn nào
  await seedRentals();

  // Combo / nhóm mẫu: để TẮT, mức giảm do chủ shop quyết định rồi bật ở Quản lý -> Combo & thuê nhóm
  if (await Bundle.count() === 0) {
    const dresses = await Product.findAll({ where: { ProductType: 'Áo dài' }, order: [['ProductID', 'ASC']], limit: 4 });
    const extra = await Product.findOne({ where: { ProductType: 'Phụ kiện' }, order: [['ProductID', 'ASC']] });
    if (dresses.length && extra) {
      await Bundle.bulkCreate([
        { Name: 'Combo áo dài và phụ kiện', Kind: 'combo', Percent: 10, MinQty: 1, ProductIDs: JSON.stringify([dresses[0].ProductID, extra.ProductID]) },
        { Name: 'Áo dài kỷ yếu, bê tráp', Kind: 'group', Percent: 10, MinQty: 5, ProductIDs: JSON.stringify(dresses.map(p => p.ProductID)) },
      ]);
    }
  }

  // Mã giảm giá mẫu (chỉ tạo khi chưa có mã nào)
  if (await Coupon.count() === 0) {
    const y = new Date().getFullYear();
    await Coupon.bulkCreate([
      { Code: 'CHAOBANMOI', Description: 'Giảm 10% tiền thuê cho đơn đầu tiên', DiscountType: 'percent', Value: 10, MaxDiscount: 100000, FirstOrderOnly: true },
      { Code: 'THUE3NGAY', Description: 'Giảm 50.000 đ cho đơn có tiền thuê từ 500.000 đ', DiscountType: 'amount', Value: 50000, MinOrder: 500000 },
      { Code: 'MUACUOI' + y, Description: `Mùa cưới ${y}: giảm 15% (tối đa 150.000 đ)`, DiscountType: 'percent', Value: 15, MaxDiscount: 150000, MinOrder: 300000, EndDate: `${y}-12-31`, UsageLimit: 50 },
    ]);
    console.log('🏷️  Đã tạo 3 mã giảm giá mẫu: CHAOBANMOI, THUE3NGAY, MUACUOI' + y + '.');
  }
}

/* ============================================================
   ĐƠN THUÊ MẪU — trải đều các trạng thái để nhân viên test
   (Chờ thanh toán · Chờ giao đồ · Đang giao · Đang thuê ·
    Đang gửi trả · Hoàn tất · Đã hủy) — gồm cả vài đơn quá hạn.
   ============================================================ */
const _pad2 = (n) => String(n).padStart(2, '0');
const _ymd = (d) => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
const _addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const _firstSize = (s) => String(s || 'Free size').split(/[,;]/)[0].trim() || 'Free size';
const _firstColor = (c) => String(c || 'Một màu').split(/[,;]/)[0].trim() || 'Một màu';

async function seedRentals() {
  if (await Rental.unscoped().count() > 0) return;

  const khach = await User.findOne({ where: { username: 'khachhang' } });
  const pick = async (type) => (await Product.findAll({ where: { ProductType: type }, order: [['ProductID', 'ASC']] }));
  const aodai = await pick('Áo dài');
  const vay = await pick('Váy tiệc');
  const phukien = await pick('Phụ kiện');
  if (!aodai.length || !vay.length) return;

  const today = new Date();
  let pi = 0;                                  // con trỏ xoay vòng qua sản phẩm
  const poolPick = (arr, k = 1) => { const out = []; for (let i = 0; i < k; i++) { out.push(arr[pi % arr.length]); pi += 3; } return out; };

  // Một "đơn hàng mẫu": chọn vài món, tính tiền, đặt trạng thái + mốc ngày hợp lý
  const makeRow = (opts, idx) => {
    const { status, delivery = false, zone = delivery ? 'local' : 'pickup', startOffset, rentDays = 2, paid, cod = false,
            customer, overdue = false } = opts;
    const shipDays = zone === 'province' ? 3 : zone === 'local' ? 1 : 0;
    const start = _addDays(today, startOffset);
    const end = _addDays(start, rentDays - 1);

    // Chọn món: xen kẽ áo dài / váy, thỉnh thoảng kèm 1 phụ kiện
    const pool = idx % 2 === 0 ? aodai : vay;
    const prods = poolPick(pool, 1);
    if (idx % 3 === 0 && phukien.length) prods.push(phukien[(idx * 2) % phukien.length]);

    const items = prods.map(p => {
      const qty = 1;
      return {
        ProductID: p.ProductID,
        ProductName: p.ProductName,
        Size: _firstSize(p.Size),
        Color: _firstColor(p.Color),
        Quantity: qty,
        PricePerDay: Number(p.Price) || 0,
        DepositPerUnit: Number(p.DepositValue) || 0,
        LateFeePerDay: Number(p.LateFeePerDay) || 0,
      };
    });
    const pricePerDay = items.reduce((s, it) => s + it.PricePerDay * it.Quantity, 0);
    const deposit = items.reduce((s, it) => s + it.DepositPerUnit * it.Quantity, 0);
    const lateFeePerDay = items.reduce((s, it) => s + it.LateFeePerDay * it.Quantity, 0);
    const rentFee = pricePerDay * rentDays;
    const qtyTotal = items.reduce((s, it) => s + it.Quantity, 0);

    // Phí trễ cho đơn quá hạn (đang thuê quá ngày trả)
    const lateDays = overdue ? Math.max(1, (_addDays(today, 0) - end) / 86400000 | 0) : 0;
    const lateFee = overdue ? lateFeePerDay * lateDays : 0;

    // Ngày tạo đơn: trước ngày nhận 2 ngày, nhưng không vượt quá hôm nay
    const createdAt = new Date(Math.min(_addDays(start, -2).getTime(), today.getTime()));
    const row = {
      ProductID: items[0].ProductID,
      UserID: customer ? (khach ? khach.id : null) : null,
      CustomerName: customer && khach ? khach.fullName : opts.name,
      CustomerPhone: opts.phone || '0912345678',
      CustomerIDCard: opts.cccd || '0010' + String(1000 + idx).slice(-8).padStart(8, '0'),
      CustomerAddress: opts.addr || 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
      DeliveryMethod: delivery ? 'Giao tận nơi' : 'Tự đến lấy',
      DeliveryZone: zone,
      ShipDays: shipDays,
      DeliveryAddress: delivery ? (opts.addr || 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội') : null,
      StartDate: _ymd(start),
      EndDate: _ymd(end),
      RentDays: rentDays,
      Quantity: qtyTotal,
      PricePerDay: pricePerDay,
      RentFee: rentFee,
      Deposit: deposit,
      LateFee: lateFee,
      PaymentMethod: cod ? 'COD' : 'Chuyển khoản',
      PaymentStatus: paid ? 'Đã thanh toán' : (cod ? 'Thu khi nhận đồ' : 'Chưa thanh toán'),
      DepositPaidAt: paid ? createdAt : null,
      Status: status,
      DataKind: 'demo',
      Note: opts.note || null,
      createdAt,
      updatedAt: today,
      items,
    };

    // Mốc giao – nhận cho đơn giao tận nơi ở các bước vận chuyển
    if (delivery && ['Đang giao', 'Đang thuê', 'Đang gửi trả', 'Hoàn tất'].includes(status)) {
      row.Carrier = 'GHN';
      row.TrackingCode = 'GHN' + (100000 + idx);
      row.ShippedAt = _ymd(_addDays(start, -shipDays));
    }
    if (['Đang gửi trả', 'Hoàn tất'].includes(status) && delivery) {
      row.ReturnTrackingCode = 'GHN' + (900000 + idx);
      if (status === 'Hoàn tất') row.ReturnSentDate = _ymd(end);
      else row.ReturnClaimedDate = _ymd(end);   // khách báo, chờ nhân viên đối chiếu
    }
    if (status === 'Hoàn tất') row.ReturnDate = _ymd(delivery ? _addDays(end, shipDays) : end);
    if (status === 'Đã hủy') { row.CancelFee = 0; row.RefundAmount = deposit; row.Note = row.Note || 'Khách báo bận, hủy trước ngày nhận.'; }
    return row;
  };

  // Danh sách đơn mẫu (nhiều một chút, trải đều trạng thái)
  const specs = [
    // Chờ thanh toán (mới đặt, chuyển khoản chưa xác nhận)
    { status: 'Chờ cọc', startOffset: 3, customer: true, note: 'Khách vừa đặt, chờ chuyển khoản.' },
    { status: 'Chờ cọc', startOffset: 5, name: 'Nguyễn Thu Hà', phone: '0905112233' },
    { status: 'Chờ cọc', startOffset: 4, delivery: true, zone: 'province', rentDays: 3, name: 'Trần Mỹ Linh', phone: '0938221144' },
    // Chờ giao đồ (đã cọc / COD giữ chỗ)
    { status: 'Đã cọc', startOffset: 2, paid: true, customer: true },
    { status: 'Đã cọc', startOffset: 1, cod: true, delivery: true, zone: 'local', name: 'Phạm Khánh Vy', phone: '0977004455' },
    { status: 'Đã cọc', startOffset: 3, paid: true, name: 'Lê Hoàng Anh', phone: '0911556677' },
    // Đang giao (shipper đang mang đồ tới)
    { status: 'Đang giao', startOffset: 0, paid: true, delivery: true, zone: 'local', customer: true },
    { status: 'Đang giao', startOffset: 1, paid: true, delivery: true, zone: 'province', rentDays: 3, name: 'Đỗ Quỳnh Chi', phone: '0966778899' },
    // Đang thuê (khách đang giữ đồ)
    { status: 'Đang thuê', startOffset: -1, rentDays: 3, paid: true, customer: true },
    { status: 'Đang thuê', startOffset: -2, rentDays: 4, paid: true, name: 'Vũ Thảo My', phone: '0901234567' },
    { status: 'Đang thuê', startOffset: -3, rentDays: 5, paid: true, delivery: true, zone: 'local', name: 'Bùi Ngọc Ánh', phone: '0944332211' },
    { status: 'Đang thuê', startOffset: -6, rentDays: 2, paid: true, overdue: true, customer: true, note: 'Quá hạn trả — cần nhắc khách.' },
    // Đang gửi trả (đơn giao xa, khách đã gửi đồ về)
    { status: 'Đang gửi trả', startOffset: -5, rentDays: 3, paid: true, delivery: true, zone: 'province', name: 'Hoàng Diệu Linh', phone: '0922114477' },
    { status: 'Đang gửi trả', startOffset: -4, rentDays: 2, paid: true, delivery: true, zone: 'local', customer: true },
    // Hoàn tất (đã trả, xong đơn)
    { status: 'Hoàn tất', startOffset: -10, rentDays: 2, paid: true, customer: true },
    { status: 'Hoàn tất', startOffset: -14, rentDays: 3, paid: true, name: 'Nguyễn Bảo Trâm', phone: '0933557799' },
    { status: 'Hoàn tất', startOffset: -20, rentDays: 2, paid: true, delivery: true, zone: 'province', rentDays2: 3, name: 'Đặng Phương Thảo', phone: '0988112200' },
    { status: 'Hoàn tất', startOffset: -8, rentDays: 2, paid: true, cod: true, name: 'Lý Gia Hân', phone: '0909887766' },
    // Đã hủy
    { status: 'Đã hủy', startOffset: 6, name: 'Trịnh Khánh Huyền', phone: '0917223344' },
    { status: 'Đã hủy', startOffset: 2, customer: true },
  ];

  let n = 0;
  for (let i = 0; i < specs.length; i++) {
    const row = makeRow(specs[i], i);
    const items = row.items; delete row.items;
    const rental = await Rental.create(row, { silent: true });   // silent: giữ nguyên createdAt đã đặt
    for (const it of items) await RentalItem.create({ ...it, RentalID: rental.RentalID });
    n++;
  }
  console.log(`🧾 Đã tạo ${n} đơn thuê mẫu ở nhiều trạng thái để test.`);
}

module.exports = seed;

if (require.main === module) {
  const { sequelize } = require('../models');
  (async () => { await sequelize.sync(); await seed(); process.exit(0); })();
}
