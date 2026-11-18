# 🧥 CostumeHub — Website Quản lý & Cho thuê Trang phục

Đồ án môn **Ngôn ngữ kịch bản** — Nhóm 3.
Công nghệ: **Node.js · Express · Sequelize · PostgreSQL / SQLite · EJS · Bootstrap 5 · Docker**.

Cửa hàng cho thuê trang phục nữ (áo dài, váy tiệc – đầm dạ hội, phụ kiện): khách chọn đồ vào giỏ, đặt thuê theo ngày, đặt cọc; nhân viên giao đồ – nhận trả – tính phí; admin quản lý tài khoản và xem thống kê.

---

## 🚀 Cách chạy

> Lần đầu, hoặc sau mỗi lần `git pull` có thêm thư viện mới: chạy `npm install` trước.

### ✅ Cách A — Chạy nhanh bằng SQLite (không cần cài DB)

File `.env` đặt `DB_DIALECT=sqlite`, rồi:

```bash
npm install
npm start
```

Mở **http://localhost:3000**. Muốn làm lại dữ liệu mẫu: xóa file `data/costumehub.sqlite` rồi chạy lại.

### 🐳 Cách B — Docker + PostgreSQL (khuyên dùng khi nộp)

Cần cài và **bật** Docker Desktop:

```bash
docker compose up --build
```

Mở **http://localhost:3000**. Dừng: `docker compose down` (thêm `-v` để xóa cả dữ liệu, ảnh upload).
Dữ liệu PostgreSQL, ảnh trang phục và ảnh CCCD được giữ trong các volume `pgdata`, `uploads`, `private_uploads`.

### 🐘 Cách C — Node thủ công với PostgreSQL có sẵn

1. Tạo database `costumehub`.
2. Trong `.env`: `DB_DIALECT=postgres` và điền `DB_HOST`, `DB_USER`, `DB_PASSWORD`...
3. `npm install` rồi `npm start`.

Lần chạy đầu tiên tự tạo bảng và nạp dữ liệu mẫu. CSDL cũ được tự nâng cấp khi khởi động (thêm bảng/cột mới, chuyển dữ liệu đơn thuê cũ) — không mất dữ liệu.

---

## 👤 Tài khoản demo

| Vai trò | Tài khoản | Mật khẩu | Làm được gì |
|---|---|---|---|
| Admin | `admin` | `admin123` | Mọi quyền của nhân viên + **xóa / import** sản phẩm, **Thống kê**, **Mã giảm giá**, **Quản lý tài khoản** |
| Nhân viên | `nhanvien` | `123456` | Quản lý sản phẩm (thêm, sửa, sao chép, export), xem mọi đơn, giao đồ, nhận trả, đổi size, hủy đơn, ẩn / xóa đánh giá |
| Khách | `khachhang` | `123456` | Thêm vào giỏ, dùng mã giảm giá, đặt thuê, xem / hủy / đổi size **đơn của mình**, yêu thích, đánh giá có ảnh, sửa thông tin |

Khách tự đăng ký trên web luôn là **Khách**. Tài khoản nhân viên / admin do admin tạo ở trang **Tài khoản**.

---

## 🧩 Chức năng

### Module Quản lý Trang phục (11 chức năng bắt buộc) — `/products/manage`
1. **Phân trang** 10 dòng/trang, sản phẩm **mới tạo nằm đầu**.
2. **Thêm mới** có upload ảnh — **bắt buộc đủ trường**, giá thuê **≥ 1.000 đ, tròn nghìn**.
3. **Cập nhật** — không cho giảm số bộ xuống dưới số bộ khách đang đặt.
4. **Xem chi tiết**.
5. **Xóa 1 / xóa nhiều** (checkbox) — chặn xóa sản phẩm đã có đơn thuê (để không mất hóa đơn cũ), thay bằng "Ngừng cho thuê".
6. **Tìm kiếm** không phân biệt dấu / hoa thường ("ao dai" = "Áo dài"), ưu tiên khớp Tên / Loại / Màu, có nút quay lại danh sách.
7–8. **Sao chép 1 / nhiều** bản ghi.
9. **Import / Export** Excel, JSON, XML — import kiểm tra từng dòng như thêm tay, báo dòng sai và lý do.
10. **Ẩn / hiện cột** (lưu trong trình duyệt).
11. **Phím tắt**: `Alt+N` Thêm · `Alt+F` Tìm · `Alt+S` Lưu · `Alt+A` Chọn tất cả · `Alt+D` Xóa mục chọn.

### Cửa hàng & trang chi tiết (khách)
- Giao diện tham khảo tinastore: nền kem, điểm nhấn hồng đất; phông **Prata** (tiêu đề) + **Montserrat** (chữ thường); khung trang tối đa 1760px. Màu sắc sản phẩm hiện bằng chấm màu thật (`utils/colors.js`).
- **Cửa hàng** `/products`: cột lọc bên trái (Danh mục, Ngày thuê, Kích thước, Màu sắc, Giá thuê — Phụ kiện / Kích thước / Màu sắc thu gọn, bấm mới xổ), thanh **tìm kiếm + sắp xếp** cùng 1 hàng (Mới nhất, Cũ nhất, Giá tăng / giảm dần, Nổi bật, Đánh giá cao). Size xếp đúng thứ tự XS → S → M → L → XL.
- Menu **Danh mục** xổ xuống có mục con (Trang phục › Áo dài, Váy tiệc · Phụ kiện › Dây chuyền, Bông tai, Nhẫn, Vòng tay, Túi xách) — cấu hình ở `utils/categories.js`.
- Thẻ sản phẩm ghi **Giá thuê / Giá cọc**; nhãn **HOT** cho tối đa 6 mẫu được thuê / thêm vào giỏ nhiều nhất (`utils/hot.js`); bấm vào thẻ để vào trang chi tiết.
- **Không hiện số lượng cho khách** (số mẫu, số bộ tồn kho) — chỉ báo còn trống / hết lịch. Nhân viên vẫn thấy số bộ.
- **Trang chi tiết**: ảnh nhỏ dọc + ảnh lớn; Giá thuê / cọc / phí trễ; chọn Kích thước (nút *Bảng số đo* mở cửa sổ nhỏ), Màu sắc, Số lượng, **Mã giảm giá** (chọn ở đây thì giỏ thuê tự điền); kiểm tra lịch trống; Mô tả sản phẩm + **Thông tin chi tiết** (chất liệu, kiểu dáng, độ dài, dịp, bảo quản); **Đánh giá**; **Câu hỏi thường gặp** riêng theo mẫu; Sản phẩm tương tự; Sản phẩm đã xem.

### Thuê đồ (khách)
- Trang chi tiết: chọn **size, màu, số lượng** → **Thêm vào giỏ** / **Thuê ngay**.
- **Xem lịch trống theo ngày khách chọn**: xem bình thường thì không hiện mẫu nào đã có người thuê; khách chọn *ngày nhận – ngày trả* (ở cửa hàng hoặc trang chi tiết) thì mới hiện **"Còn N bộ"** / **"Đã kín lịch"**, có tùy chọn *chỉ hiện mẫu còn trống*. Ngày đã chọn được nhớ và tự điền vào giỏ thuê.
- **Giỏ thuê** nhiều món, đặt 1 lần thành 1 đơn. Khách chưa đăng nhập vẫn thêm vào giỏ được, đăng nhập khi đặt.
- **Số lượng theo size × màu**: mỗi mẫu tự khai size / kích thước riêng (1 size cũng được; phụ kiện ghi "Ni 6", "40cm"...) và nhập số bộ cho từng size × màu. Khách thuê size S không ảnh hưởng size M.
- **Chống trùng lịch theo từng size × màu**: số bộ còn trống tính theo ngày thuê. Đơn giữ đồ từ ngày nhận đến hết ngày trả. Tối đa 30 ngày / đơn.
- **Lọc ở cửa hàng** (ngày + size): mẫu 1 size hết bộ → "Đã kín lịch"; mẫu nhiều size chỉ gắn "Đã kín lịch" khi hết mọi size; lọc size M thì mẫu hết size M → "Đã thuê size M". Trang chi tiết làm mờ size đã hết lịch.
- Quy định: **SĐT** 10 số đầu 03/05/07/08/09, **CCCD** 12 số (mã tỉnh 001–096), ảnh CCCD (chỉ chủ đơn và nhân viên xem được).
- **Chờ cọc**: đặt xong đơn giữ chỗ **24 giờ** để khách cọc (chuyển khoản theo thông tin trên trang đơn, ví, hoặc tiền mặt tại shop). Nhân viên bấm *Nhận cọc* → **Đã cọc**. Quá 24 giờ chưa cọc → đơn **tự hủy**, không mất phí. Số tài khoản demo ở `SHOP_BANK` (`utils/constants.js`).
- Hủy đơn: chưa cọc → không phí · ≥ 3 ngày trước ngày nhận hoàn 100% cọc · 1–2 ngày giữ 50% · trong ngày mất cọc.
- **Thông báo** (chuông trên menu, `/notifications`, trang Tài khoản): báo khi đơn đổi trạng thái (đặt, nhận cọc, giao đồ, hoàn tất, hủy, đổi size) và **nhắc** hạn cọc, ngày mai / hôm nay nhận đồ, ngày mai / hôm nay trả đồ, quá hạn trả.
- **Nội quy & bảng trừ phí** `/noi-quy` (mức phí sửa ở `utils/fees.js`): khách phải tick **"đồng ý nội quy"** mới đặt được; hóa đơn ghi lại thời điểm đồng ý.

- **Nhiều ảnh / sản phẩm**: ảnh chính + tối đa 6 ảnh phụ (mặt sau, chi tiết, ảnh mặc thật); trang chi tiết có thư viện ảnh bấm chuyển.
- **Bảng số đo theo size** (vòng ngực, eo, mông, chiều cao gợi ý): nhân viên nhập theo từng size (không bắt buộc, có nút điền số đo tham khảo S–XL); khách xem ở trang chi tiết kèm hướng dẫn cách đo.
- **Sale của cửa hàng** (khác voucher): mỗi mẫu có *Giá khuyến mãi / ngày* + *Khuyến mãi đến ngày* (form Thêm / Sửa, không bắt buộc). Thẻ và trang chi tiết hiện giá gốc gạch ngang + nhãn giảm %; giỏ thuê và đơn tính theo giá sale; hết hạn tự về giá gốc. Cửa hàng có lọc *Đang giảm giá* và sắp xếp *Giảm giá nhiều nhất* (`utils/pricing.js`).
- **Mã giảm giá**: nhập ở giỏ thuê (hoặc bấm chọn mã đang có), chỉ giảm **tiền thuê** (không giảm cọc). Mã theo % (có mức giảm tối đa) hoặc số tiền; điều kiện tiền thuê tối thiểu, ngày áp dụng, tổng lượt dùng, chỉ đơn đầu tiên. Mỗi khách dùng mỗi mã 1 lần; hủy đơn thì trả lại lượt. Dữ liệu mẫu: `CHAOBANMOI`, `THUE3NGAY`, `MUACUOI<năm>`.
- **Đổi size khi không vừa** `/doi-size`: đơn *Đã cọc* → khách tự đổi size / màu (cùng mẫu) ngay trên trang đơn; đơn *Đang thuê* → nhân viên đổi giúp trong ngày nhận hoặc ngày hôm sau. Đổi được một phần số bộ, size mới phải còn trống; giá và cọc giữ nguyên; mỗi lần đổi ghi vào ghi chú đơn.
- **Yêu thích** `/favorites`: thả tim trên thẻ sản phẩm / trang chi tiết, xem lại danh sách đã lưu.
- **Đánh giá có ảnh**: chỉ khách đã thuê xong (đơn hoàn tất) mới đánh giá, 1 đánh giá / mẫu, 1–5 sao, nhận xét độ vừa (vừa / hơi chật / hơi rộng), tối đa 3 ảnh; tự ghi size đã thuê. Trang chi tiết có điểm trung bình, phân bố sao, lọc "có ảnh"; thẻ cửa hàng hiện số sao. Nhân viên ẩn / xóa đánh giá không phù hợp.
- **Trang hỗ trợ**: `/cach-thue` (5 bước có hình minh họa), `/hoi-dap` (FAQ có ô tìm kiếm không dấu), `/doi-size`, `/noi-quy`.

### Xử lý đơn (nhân viên) — `/rentals`
- Trạng thái: **Chờ cọc → Đã cọc → Đang thuê → Hoàn tất** (hoặc **Đã hủy**). Nút **Nhận cọc** ở danh sách đơn / trang đơn.
- **Giao đồ** (từ ngày nhận trở đi), **Nhận trả**: ngày trả thực tế từ ngày nhận đến hôm nay; nhân viên chọn số bộ bị bẩn / hư / mất **theo bảng nội quy** cho từng món, hệ thống tự tính phí trễ + phí vệ sinh/hư hỏng → hoàn cọc (âm = khách đền thêm). Hóa đơn liệt kê từng khoản trừ.
- Mất đồ / hư nặng: đền theo **Giá trị sản phẩm** (ô không bắt buộc khi thêm SP); sản phẩm chưa ghi giá trị thì mất tiền cọc của bộ đó.
- **Cảnh báo**: quá hạn trả, quá ngày nhận chưa lấy đồ, hôm nay giao / hôm nay trả.
- **Tìm kiếm** theo mã đơn, tên khách, SĐT, tên trang phục; **lọc** theo trạng thái / quá hạn; phân trang 15 đơn/trang.

### Quản trị (admin)
- **Mã giảm giá** `/admin/coupons`: tạo mã, bật / tắt, xem số lượt đã dùng; mã đã dùng không xóa được (giữ đúng hóa đơn cũ).
- **Thống kê** `/admin/stats`: doanh thu theo tháng (tiền thuê đã trừ mã giảm giá + phí trễ + phí hư hỏng + phí hủy, không tính cọc), đơn theo trạng thái, đơn đang hoạt động & cọc đang giữ, top 10 mẫu thuê nhiều nhất.
- **Tài khoản** `/admin/users`: tạo tài khoản nhân viên / admin, đổi vai trò, khóa / mở khóa (bị đăng xuất ngay), đặt lại mật khẩu. Luôn còn ít nhất 1 admin.

### Mọi người dùng
- **Tài khoản của tôi** `/account`: sửa họ tên, đổi mật khẩu.

---

## 📁 Cấu trúc (MVC)

```
├── server.js                 # Khởi động, nâng cấp CSDL cũ, xử lý lỗi chung
├── config/database.js        # Sequelize (postgres / sqlite theo .env)
├── models/                   # Product, ProductVariant, ProductImage, User, Rental, RentalItem, Review, Favorite, Coupon, Notification
├── controllers/              # product, cart, rental, review, favorite, coupon, notification, auth, account, user (admin), stats, home
├── routes/                   # index, products, cart, rentals, admin
├── middlewares/              # auth (requireLogin / Staff / Admin), upload (Multer: ảnh SP + ảnh phụ, ảnh đánh giá, CCCD)
├── utils/                    # availability (lịch theo ngày), variants, sizeChart, details, categories, hot, pricing (sale), colors, coupons, notify, reviews, fees, search, text, dates
├── views/                    # EJS + Bootstrap
├── public/                   # CSS, JS, ảnh mẫu, uploads/ (ảnh trang phục)
├── private_uploads/          # ảnh CCCD (không công khai, tạo khi chạy)
├── seed/seed.js              # Dữ liệu mẫu
├── docker-compose.yml        # web + PostgreSQL + volume
└── Dockerfile
```

---

## 🔜 Chưa làm

- **AI**: OCR CCCD tự điền số (Tesseract.js), gợi ý trang phục / tìm kiếm thông minh.
- **Thanh toán**: mã QR chuyển khoản; hiện chọn "Chuyển khoản" vẫn ghi nhận "Đã cọc" ngay.
- **Form liên hệ**: chưa lưu nội dung khách gửi.
