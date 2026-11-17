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
| Admin | `admin` | `admin123` | Mọi quyền của nhân viên + **xóa / import** sản phẩm, **Thống kê**, **Quản lý tài khoản** |
| Nhân viên | `nhanvien` | `123456` | Quản lý sản phẩm (thêm, sửa, sao chép, export), xem mọi đơn, giao đồ, nhận trả, hủy đơn |
| Khách | `khachhang` | `123456` | Thêm vào giỏ, đặt thuê, xem / hủy **đơn của mình**, sửa thông tin, đổi mật khẩu |

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

### Thuê đồ (khách)
- Trang chi tiết: chọn **size, màu, số lượng** → **Thêm vào giỏ** / **Thuê ngay**.
- **Xem lịch trống theo ngày khách chọn**: xem bình thường thì không hiện mẫu nào đã có người thuê; khách chọn *ngày nhận – ngày trả* (ở cửa hàng hoặc trang chi tiết) thì mới hiện **"Còn N bộ"** / **"Đã kín lịch"**, có tùy chọn *chỉ hiện mẫu còn trống*. Ngày đã chọn được nhớ và tự điền vào giỏ thuê.
- **Giỏ thuê** nhiều món, đặt 1 lần thành 1 đơn. Khách chưa đăng nhập vẫn thêm vào giỏ được, đăng nhập khi đặt.
- **Chống trùng lịch**: số lượng sản phẩm là tổng số bộ; số bộ còn trống tính theo ngày thuê. Đơn giữ đồ từ ngày nhận đến hết ngày trả. Tối đa 30 ngày / đơn.
- Quy định: **SĐT** 10 số đầu 03/05/07/08/09, **CCCD** 12 số (mã tỉnh 001–096), ảnh CCCD (chỉ chủ đơn và nhân viên xem được).
- Hủy đơn: ≥ 3 ngày trước ngày nhận hoàn 100% cọc · 1–2 ngày giữ 50% · trong ngày mất cọc.
- **Nội quy & bảng trừ phí** `/noi-quy` (mức phí sửa ở `utils/fees.js`): khách phải tick **"đồng ý nội quy"** mới đặt được; hóa đơn ghi lại thời điểm đồng ý.

### Xử lý đơn (nhân viên) — `/rentals`
- Trạng thái: **Đã cọc → Đang thuê → Hoàn tất** (hoặc **Đã hủy**).
- **Giao đồ** (từ ngày nhận trở đi), **Nhận trả**: ngày trả thực tế từ ngày nhận đến hôm nay; nhân viên chọn số bộ bị bẩn / hư / mất **theo bảng nội quy** cho từng món, hệ thống tự tính phí trễ + phí vệ sinh/hư hỏng → hoàn cọc (âm = khách đền thêm). Hóa đơn liệt kê từng khoản trừ.
- Mất đồ / hư nặng: đền theo **Giá trị sản phẩm** (ô không bắt buộc khi thêm SP); sản phẩm chưa ghi giá trị thì mất tiền cọc của bộ đó.
- **Cảnh báo**: quá hạn trả, quá ngày nhận chưa lấy đồ, hôm nay giao / hôm nay trả.
- **Tìm kiếm** theo mã đơn, tên khách, SĐT, tên trang phục; **lọc** theo trạng thái / quá hạn; phân trang 15 đơn/trang.

### Quản trị (admin)
- **Thống kê** `/admin/stats`: doanh thu theo tháng (tiền thuê + phí trễ + phí hư hỏng + phí hủy, không tính cọc), đơn theo trạng thái, đơn đang hoạt động & cọc đang giữ, top 10 mẫu thuê nhiều nhất.
- **Tài khoản** `/admin/users`: tạo tài khoản nhân viên / admin, đổi vai trò, khóa / mở khóa (bị đăng xuất ngay), đặt lại mật khẩu. Luôn còn ít nhất 1 admin.

### Mọi người dùng
- **Tài khoản của tôi** `/account`: sửa họ tên, đổi mật khẩu.

---

## 📁 Cấu trúc (MVC)

```
├── server.js                 # Khởi động, nâng cấp CSDL cũ, xử lý lỗi chung
├── config/database.js        # Sequelize (postgres / sqlite theo .env)
├── models/                   # Product, User, Rental (đơn), RentalItem (món trong đơn)
├── controllers/              # product, cart, rental, auth, account, user (admin), stats, home
├── routes/                   # index, products, cart, rentals, admin
├── middlewares/              # auth (requireLogin / Staff / Admin), upload (Multer: chỉ nhận ảnh)
├── utils/                    # availability (lịch theo ngày), search, text, dates, account, constants
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
