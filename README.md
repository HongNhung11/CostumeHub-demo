# 🧥 CostumeHub — Website Quản lý & Cho thuê Trang phục tích hợp AI

Đồ án môn **Ngôn ngữ kịch bản** — Nhóm 3.
Công nghệ: **Node.js · Express · Sequelize · PostgreSQL · EJS · Bootstrap 5 · Docker**.

---

## 🚀 Cách chạy

Có **2 cách**. Cách A để chạy nhanh xem thử, cách B để chạy đúng với PostgreSQL (nộp bài).

### ✅ Cách A — Chạy nhanh bằng SQLite (không cần cài DB)

> Dùng để xem thử ngay. File `.env` đã đặt sẵn `DB_DIALECT=sqlite`.

```bash
npm install
npm start
```

Mở trình duyệt: **http://localhost:3000**

### 🐳 Cách B — Chạy bằng Docker + PostgreSQL (khuyên dùng khi nộp)

> Cần cài sẵn **Docker Desktop**. Không cần cài Node hay Postgres.

```bash
docker compose up --build
```

Mở trình duyệt: **http://localhost:3000**
Dừng: `docker compose down` (thêm `-v` để xóa cả dữ liệu).

### 🐘 Cách C — Chạy Node thủ công với PostgreSQL có sẵn

1. Tạo database tên `costumehub` trong PostgreSQL.
2. Sửa file `.env`: đổi `DB_DIALECT=postgres` và điền `DB_USER`, `DB_PASSWORD`...
3. Chạy:
```bash
npm install
npm start
```

---

## 👤 Tài khoản demo (tạo sẵn)

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Nhân viên | `nhanvien` | `123456` |

Dữ liệu trang phục mẫu được **tự động nạp** lần chạy đầu.

---

## 🧩 11 chức năng của module Quản lý Trang phục

1. **Phân trang** 10 item/trang.
2. **Thêm mới** (có upload ảnh).
3. **Cập nhật**.
4. **Xem chi tiết**.
5. **Xóa 1 / Xóa nhiều** (checkbox).
6. **Tìm kiếm** theo Tên / Mô tả / Loại / Mã.
7–8. **Sao chép 1 / nhiều** bản ghi.
9. **Import / Export** (Excel, JSON, XML).
10. **Ẩn/hiện cột** (lưu localStorage).
11. **Phím tắt**: `Alt+N` Thêm · `Alt+F` Tìm · `Alt+S` Lưu · `Alt+A` Chọn tất cả · `Alt+D` Xóa mục chọn.

---

## 📁 Cấu trúc (MVC)

```
CostumeHub/
├── server.js              # Điểm khởi động
├── config/database.js     # Cấu hình Sequelize (postgres / sqlite)
├── models/                # Model: Product, User
├── controllers/           # Logic nghiệp vụ
├── routes/                # Định tuyến
├── middlewares/           # upload (Multer), auth (phân quyền)
├── views/                 # Giao diện EJS + Bootstrap
├── public/                # CSS, JS client, ảnh upload
├── seed/seed.js           # Dữ liệu mẫu
├── docker-compose.yml     # Docker: web + PostgreSQL
└── Dockerfile
```

---

## 🤖 Hướng mở rộng AI (đang để sẵn chỗ)

- **OCR CCCD** (Tesseract.js): xác minh danh tính khi thuê.
- **Tìm kiếm thông minh** (Meilisearch) / **Chatbot** tư vấn chọn trang phục.

Bảng `Users` đã có sẵn các cột `idCardNumber`, `idCardImage`, `isVerified` cho tính năng này.
