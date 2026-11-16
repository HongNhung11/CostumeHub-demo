# 📌 CostumeHub — Tài liệu trạng thái & mô tả dự án

> File này giúp **mở lại dự án là biết ngay đang làm tới đâu, chỉnh tiếp chỗ nào**.
> Cập nhật lần cuối: 2026-11-09. Trạng thái: **đang phát triển — đã chạy được, tạm dừng để lưu**.

---

## 1. Dự án là gì
**CostumeHub** — Website quản lý & cho thuê trang phục (áo dài, vest, đầm dạ hội, cosplay, đồ hóa trang + phụ kiện) có tích hợp AI (phần AI **chưa làm**). Đồ án môn **Ngôn ngữ kịch bản** (nhóm 3).

## 2. Công nghệ
Node.js · Express.js (MVC) · Sequelize ORM · **SQLite** (chạy nhanh) / **PostgreSQL** (Docker) · EJS · Bootstrap 5 · Multer · XLSX · fast-xml-parser · Method-Override · express-session · bcryptjs · Dotenv · Docker Compose.

## 3. Cách chạy lại
```bash
cd CostumeHub
npm install
npm start
```
Mở `http://localhost:3000`. (Hoặc chạy PostgreSQL: `docker compose up --build` — xem README.md.)

- **Reset dữ liệu mẫu:** xóa file `data/costumehub.sqlite` rồi `npm start` → tự nạp lại 100 sản phẩm + tài khoản.
- **Tài khoản test** (hiện sẵn trên trang đăng nhập, có nút điền nhanh):
  | Vai trò | Tài khoản | Mật khẩu |
  |---|---|---|
  | Admin | `admin` | `admin123` |
  | Nhân viên | `nhanvien` | `123456` |
  | Khách | `khachhang` | `123456` |

## 4. Cấu trúc thư mục
```
CostumeHub/
├── server.js               # Khởi động app
├── config/database.js      # Sequelize (postgres/sqlite tự chuyển theo .env)
├── models/                 # Product, User, Rental (+ index.js quan hệ)
├── controllers/            # product, rental, auth, home
├── routes/                 # index, products, rentals
├── middlewares/            # auth (requireLogin/Staff/Admin), upload (Multer)
├── views/                  # EJS: layout, home, products, rentals, auth, 404
├── public/                 # css/style.css, js/app.js, uploads/
├── seed/seed.js            # Sinh 100 sản phẩm + tài khoản mẫu
├── docker-compose.yml, Dockerfile, README.md
└── TRANG_THAI_DU_AN.md     # (file này)
```

## 5. Chức năng ĐÃ LÀM XONG ✅
**Sản phẩm & cửa hàng**
- 100 sản phẩm (76 trang phục + 24 phụ kiện: trang sức/mũ-mấn/khăn/túi/thắt lưng/găng tay — **không có giày**). Có trường **Màu sắc, Size**.
- Cửa hàng `/products`: lưới thẻ (ảnh + giá), **lọc danh mục** có đếm số lượng, **ưu tiên trang phục trước phụ kiện**, **phân trang** (12/trang → ~9 trang), tìm kiếm.
- Chi tiết `/products/:id`: thông tin đầy đủ (màu, size, mô tả, giá, cọc, phí trễ) + nút **Đặt thuê**.

**Module Quản lý (trang `/products/manage`) — đủ 11 chức năng bắt buộc**
- Phân trang · Thêm/Sửa/Xóa · Chi tiết · Xóa nhiều + Sao chép nhiều (checkbox) · Tìm kiếm · Import/Export (Excel/JSON/XML) · Ẩn/hiện cột (localStorage) · Phím tắt `Alt+N/F/S/A/D`.

**Luồng đặt thuê (nghiệp vụ)**
- Khách vãng lai bấm Đặt thuê → **đăng nhập/đăng ký → quay lại đúng trang chi tiết** (returnTo).
- Khách đã đăng nhập → **trang thanh toán `/products/:id/book`**: chọn ngày (tính tiền live), số lượng, thông tin khách, **giao tận nơi / tự đến lấy + địa chỉ**, **số CCCD + ảnh CCCD**, hình thức thanh toán.
- **Đặt = cọc 1 bước** (đơn tạo ra là "Đã cọc" luôn).
- Hóa đơn `/rentals/:id`: chi tiết tiền, giao hàng, ảnh CCCD, in được, nút Hủy.
- Luồng trạng thái: **Đã cọc → Đang thuê → Hoàn tất** (hoặc **Đã hủy**).
- Nhân viên: **Giao đồ** (chỉ khi đã cọc), **Nhận trả** (tự tính phí trễ + hư hỏng → hoàn cọc, có thể âm = khách đền thêm).
- Hủy đơn: ≥3 ngày hoàn 100% · 1–2 ngày giữ 50% · trong ngày mất cọc.

**Tài khoản & phân quyền**
- Đăng ký/đăng nhập (đăng nhập xong **về Trang chủ**).
- **Khách**: chỉ đặt thuê & xem đơn của mình. **Nhân viên**: quản lý SP + giao/nhận đơn (không xóa/import). **Admin**: toàn quyền (xóa, import).

**Giao diện**
- Thiết kế cao cấp (kem + burgundy + gold, font Playfair + Be Vietnam Pro), navbar/top-bar/footer, **hiệu ứng động** (fade-up, hover).
- Trang chủ có: hero, danh mục, SP nổi bật, **mục "Lưu ý & Quy định khi thuê đồ"**, "Vì sao chọn".

## 6. ⚠️ Chưa test hoàn tất / cần kiểm lại
- **Submit trang thanh toán `/book`** tạo đơn kèm *giao tận nơi + ảnh CCCD*: đã dựng code + test tới bước mở trang, **chưa chạy thử submit hoàn chỉnh** → mở lại nên test: đặt 1 đơn "Giao tận nơi" + upload ảnh CCCD, kiểm tra hóa đơn hiển thị đúng.

## 7. 🔜 VIỆC LÀM TIẾP (khi quay lại)
**Phần AI (chưa làm — để đạt điểm Giỏi):**
- OCR CCCD tự điền số khi upload ảnh (Tesseract.js) · Tìm kiếm thông minh (Meilisearch) / Chatbot tư vấn.

**Lỗi/điểm chưa khớp thực tế (ưu tiên):**
1. **Khóa lịch theo ngày (chống trùng lịch)** — hiện chặn theo tồn kho, nên nâng lên khóa theo ngày thuê.
2. Bắt buộc CCCD cho đồ giá trị cao · 3. Thu tiền thuê khi giao đồ (hiện chỉ cọc) · 4. Giới hạn số ngày thuê · 5. Dùng blacklist khách · 6. Đồng bộ trạng thái SP với tồn kho.

**Ý tưởng từ nghiên cứu thị trường (xem báo cáo riêng):**
- Gợi ý size theo số đo + size dự phòng · Review có ảnh khách thật · **Gói thuê theo dịp/combo** (Tết, cưới, kỷ yếu) · Giảm rào cản cọc · Gói bảo vệ hư hỏng · Trọn gói giao–giặt–makeup.

## 8. Ghi chú
- Ảnh sản phẩm dùng chung theo loại (2–3 ảnh/loại từ Unsplash) — cần mạng để hiển thị; link lỗi tự ẩn.
- Dữ liệu trong `data/costumehub.sqlite` là dữ liệu test, xóa đi sẽ tạo lại.
- Tài liệu đề tài tổng quát: `../MoTa_DeTai_CostumeHub.docx`.
