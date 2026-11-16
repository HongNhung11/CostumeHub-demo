const { Product, User } = require('../models');

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
  { img: 'p6',  name: 'Áo dài đỏ duyên dáng',         color: 'Đỏ',         price: 195000, status: 'Đang cho thuê', size: 'M, L, XL',
    desc: 'Áo dài đỏ duyên dáng, màu sắc nổi bật, đường may tỉ mỉ. Rất hợp cho lễ ăn hỏi, chụp ảnh cưới và các dịp trọng đại.' },
  { img: 'p7',  name: 'Áo dài gấm đỏ đô',             color: 'Đỏ đô',      price: 210000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài gấm màu đỏ đô sang trọng, chất gấm dày dặn ánh nhẹ, thêu hoa tinh xảo. Đẳng cấp cho mẹ cô dâu, sự kiện cao cấp.' },
  { img: 'p9',  name: 'Áo dài trắng nữ sinh',         color: 'Trắng',      price: 150000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Áo dài trắng nữ sinh thanh thuần, dáng truyền thống thướt tha. Gợi nhớ tà áo sân trường, hợp chụp bộ ảnh nhẹ nhàng.' },
  { img: 'p10', name: 'Áo dài đỏ gấm ngày Tết',       color: 'Đỏ',         price: 205000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Áo dài đỏ gấm rực rỡ cho ngày Tết, họa tiết truyền thống bên khung cảnh đèn lồng. Mang không khí xuân sum vầy, may mắn.' },
];

// Váy tiệc / Đầm dạ hội — ảnh Unsplash, lưu /public/img/vaytiec
const VAY_TIEC = [
  { img: 'v1', name: 'Váy maxi xanh ngọc',          color: 'Xanh ngọc',  price: 210000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy maxi xanh ngọc dáng dài bay bổng, chất voan mềm rũ. Tôn làn da, lý tưởng cho tiệc ngoài trời và chụp ảnh dã ngoại.' },
  { img: 'v2', name: 'Váy maxi cam san hô',         color: 'Cam san hô', price: 220000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy maxi màu cam san hô tươi tắn kèm nón rộng vành, phong cách nghỉ dưỡng. Nổi bật cho tiệc biển và du lịch.' },
  { img: 'v3', name: 'Đầm dạ hội tím trễ vai',      color: 'Tím',        price: 320000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm dạ hội tím trễ vai ôm dáng, tôn vòng eo và bờ vai gợi cảm. Sang trọng cho gala, tiệc cưới và sự kiện tối.' },
  { img: 'v4', name: 'Váy xòe đỏ họa tiết',         color: 'Đỏ',         price: 240000, status: 'Chờ xử lý',     size: 'M, L, XL',
    desc: 'Váy xòe đỏ họa tiết thắt eo bản to, phom cổ điển thanh lịch. Rực rỡ, trẻ trung cho tiệc tùng và chụp hình.' },
  { img: 'v5', name: 'Đầm dạ hội đỏ dáng dài',      color: 'Đỏ',         price: 360000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm dạ hội đỏ dáng dài thướt tha, đuôi váy xòe quyến rũ. Lộng lẫy, cuốn hút cho thảm đỏ và dạ tiệc.' },
  { img: 'v6', name: 'Váy trắng trễ vai',           color: 'Trắng',      price: 230000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Váy trắng trễ vai ngắn xinh, bèo nhún nhẹ nhàng, tinh khôi. Phù hợp tiệc nhẹ, dạo phố và chụp ảnh mùa hè.' },
  { img: 'v7', name: 'Đầm xanh pastel bay bổng',    color: 'Xanh pastel', price: 250000, status: 'Còn trống',    size: 'S, M, L',
    desc: 'Đầm xanh pastel xẻ tà bay bổng, chất liệu nhẹ mềm. Dịu dàng, lãng mạn cho tiệc biển và bộ ảnh ngoại cảnh.' },
  { img: 'v8', name: 'Váy đỏ chấm bi cổ điển',      color: 'Đỏ chấm bi', price: 215000, status: 'Còn trống',     size: 'M, L, XL',
    desc: 'Váy đỏ chấm bi phong cách vintage, dáng xòe nữ tính. Đáng yêu, nổi bật cho buổi hẹn và tiệc chủ đề cổ điển.' },
  { img: 'v9', name: 'Đầm ren xanh navy',           color: 'Xanh navy',  price: 300000, status: 'Còn trống',     size: 'S, M, L',
    desc: 'Đầm ren xanh navy cắt xẻ tinh tế, chất ren cao cấp. Huyền bí, sang trọng cho dạ tiệc và sự kiện cuối năm.' },
];

// Phụ kiện — ảnh Unsplash, lưu /public/img/phukien
const PHU_KIEN = [
  { img: 'k1', name: 'Vòng cổ ngọc trai',        color: 'Trắng ngọc', price: 60000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Vòng cổ ngọc trai thanh lịch, ánh sáng dịu nhẹ. Tôn nét cổ điển, hợp với áo dài và đầm dạ hội.' },
  { img: 'k2', name: 'Nhẫn đá quý lấp lánh',     color: 'Bạc',        price: 45000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Nhẫn đính đá quý lấp lánh, thiết kế tinh xảo. Điểm nhấn sang trọng cho bàn tay trong ngày trọng đại.' },
  { img: 'k3', name: 'Bông tai đá xanh sang trọng', color: 'Xanh',    price: 50000,  unit: 'đôi',   status: 'Còn trống',   size: 'Free size',
    desc: 'Bông tai đính đá xanh lấp lánh, dáng thả nhẹ nhàng. Làm bừng sáng khuôn mặt khi dự tiệc.' },
  { img: 'k4', name: 'Túi xách tay màu đỏ',      color: 'Đỏ',         price: 90000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Túi xách tay da màu đỏ nổi bật, kiểu dáng thanh lịch. Điểm nhấn cuốn hút cho mọi bộ trang phục.' },
  { img: 'k5', name: 'Túi đeo chéo đen cao cấp', color: 'Đen',        price: 110000, unit: 'chiếc', status: 'Đang cho thuê', size: 'Free size',
    desc: 'Túi đeo chéo đen cao cấp, chần trám sang trọng, khóa kim loại. Phối được với cả váy tiệc lẫn trang phục dạo phố.' },
  { img: 'k6', name: 'Lắc tay pha lê lấp lánh',  color: 'Bạc',        price: 55000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Lắc tay pha lê lấp lánh trên nền đen huyền bí, lung linh dưới ánh đèn. Hoàn thiện vẻ quý phái khi dự tiệc.' },
  { img: 'k7', name: 'Vòng tay vàng đính đá',    color: 'Vàng gold',  price: 65000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Vòng tay ánh vàng gold đính đá tinh tế, sang chảnh. Tôn làn da, hợp dạ tiệc và sự kiện cao cấp.' },
  { img: 'k8', name: 'Dây chuyền mặt đá xanh',   color: 'Xanh',       price: 70000,  unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Dây chuyền layer với mặt đá xanh và mặt trăng khuyết, cá tính. Điểm nhấn thời thượng cho outfit dự tiệc.' },
  { img: 'k9', name: 'Túi xách hồng pastel',     color: 'Hồng pastel', price: 85000, unit: 'chiếc', status: 'Còn trống',   size: 'Free size',
    desc: 'Túi xách hồng pastel ngọt ngào, dáng nhỏ xinh cầm tay. Dễ thương, hợp các buổi tiệc nhẹ và hẹn hò.' },
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
      Status: o.status,
      Description: o.desc,
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
  if (countUser === 0) {
    await User.create({ username: 'admin', password: 'admin123', fullName: 'Quản trị viên', role: 'admin', isVerified: true });
    await User.create({ username: 'nhanvien', password: '123456', fullName: 'Nhân viên A', role: 'nhanvien', isVerified: true });
    await User.create({ username: 'khachhang', password: '123456', fullName: 'Khách Hàng', role: 'khach', isVerified: true });
    console.log('👤 Đã tạo tài khoản: admin/admin123, nhanvien/123456, khachhang/123456');
  }

  const count = await Product.count();
  if (count === 0) {
    const list = buildProducts();
    await Product.bulkCreate(list);
    console.log(`🧥 Đã nạp ${list.length} sản phẩm nữ (áo dài + váy tiệc + phụ kiện).`);
  }
}

module.exports = seed;

if (require.main === module) {
  const { sequelize } = require('../models');
  (async () => { await sequelize.sync(); await seed(); process.exit(0); })();
}
