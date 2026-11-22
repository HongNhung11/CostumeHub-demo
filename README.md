# 🧥 CostumeHub — Website Quản lý & Cho thuê Trang phục

Đồ án môn **Ngôn ngữ kịch bản** — Nhóm 3.
Công nghệ: **Node.js · Express · Sequelize · PostgreSQL / SQLite · EJS · Bootstrap 5 · Docker**.

Khách chọn đồ, đặt thuê theo ngày và đặt cọc. Nhân viên giao đồ, nhận trả, tính phí. Admin quản lý tài khoản và xem thống kê.

## Chạy lần đầu

1. Cài và mở [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. [**Tải file ZIP**](https://github.com/HongNhung11/CostumeHub-demo/archive/refs/heads/main.zip) rồi **giải nén**.
3. Windows: bấm đúp **`CHAY_WEB.cmd`**. macOS / Linux: mở Terminal trong thư mục, gõ `sh chay-web.sh`.
4. Mở **http://localhost:3001**. Lần đầu mất vài phút.

Không cần cài Node hay PostgreSQL. File `.env` được tự tạo.

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Khách | `khachhang` | `123456` |
| Nhân viên | `nhanvien` | `123456` |
| Admin | `admin` | `admin123` |

Đây là tài khoản thử: **đổi mật khẩu trước khi đưa lên mạng** và đừng nhập CCCD thật.

## Đã có bản cũ: xóa đi, tải bản mới

1. **Chỉ xóa thư mục project cũ.** Không chạy `docker compose down` ở bản cũ, không xóa container hay volume: bản mới cần chúng để tìm dữ liệu.
   - Trước khi xóa, chép ra ngoài `.env` (nếu đã tự điền) và thư mục `backups/` (nếu có).
   - Windows không cho xóa thì làm bước 2–4 trước, xóa sau.
2. [**Tải bản mới**](https://github.com/HongNhung11/CostumeHub-demo/archive/refs/heads/main.zip) rồi giải nén. Có `.env` đã chép ra thì bỏ vào thư mục mới.
3. Mở Docker Desktop, bấm đúp **`CHAY_WEB.cmd`** (macOS / Linux: `sh chay-web.sh`). Lần đầu lên bản mới **không gõ thẳng `docker compose up`**, vì lệnh đó không chuyển dữ liệu cũ.
4. Mở **http://localhost:3001** (bản cũ có thể dùng cổng 3000, bản mới là 3001).

Lưu ý:

- **Không chạy `docker compose down -v`**: lệnh này xóa dữ liệu của mọi bản CostumeHub trên máy.
- Lỡ xóa container cũ và mở lên không thấy dữ liệu: **đừng xóa volume**, dữ liệu thường vẫn ở volume `<tên-thư-mục-cũ>_pgdata` (xem bằng `docker volume ls`).
- Bản cũ chạy **không dùng Docker** thì dữ liệu nằm trong thư mục: chép `data/`, `public/uploads/`, `private_uploads/`, `.env` sang bản mới **trước khi xóa**, rồi chạy theo mục [Không dùng Docker](#không-dùng-docker).

## Lệnh cần dùng

| Việc | Lệnh |
|---|---|
| Tắt web | `docker compose down` |
| Bật lại, hoặc vừa sửa code | `docker compose up -d --build` |
| Vừa sửa `.env` | `docker compose up -d` |
| Xem lỗi | `docker compose logs --tail 80 web` |

Chạy test trên CSDL riêng, đạt khi cuối màn hình có `fail 0`:

```bash
docker compose -p chregress -f docker-compose.test.yml run --build --rm test
docker compose -p chregress -f docker-compose.test.yml down
```

### Không dùng Docker

Cần Node 20.17 trở lên:

```bash
npm ci
node scripts/setup-env.js
# mở .env, đặt DB_DIALECT=sqlite và APP_URL=http://localhost:3000
npm start
```

Mở http://localhost:3000.

## Chức năng

### Quản lý trang phục (11 chức năng bắt buộc) — `/products/manage`

1. Phân trang 10 dòng, sản phẩm mới nằm đầu.
2. Thêm mới có ảnh, kiểm tra đủ trường, giá thuê từ 1.000 đ và tròn nghìn.
3. Cập nhật, không cho giảm số bộ dưới số đang được đặt.
4. Xem chi tiết.
5. Xóa 1 / xóa nhiều, chặn xóa sản phẩm đã có đơn.
6. Tìm kiếm không phân biệt dấu, hoa thường.
7. Sao chép 1 bản ghi.
8. Sao chép nhiều bản ghi.
9. Import / Export Excel, JSON, XML.
10. Ẩn / hiện cột.
11. Phím tắt: `Alt+N` thêm · `Alt+F` tìm · `Alt+S` lưu · `Alt+A` chọn tất cả · `Alt+D` xóa mục chọn.

### Theo vai trò

| Vai trò | Chức năng |
|---|---|
| Khách | Lọc và tìm đồ, gợi ý size, giỏ thuê, combo / thuê nhóm, mã giảm giá, đặt thuê, theo dõi / hủy / đổi size, yêu thích, đánh giá có ảnh |
| Nhân viên | Việc hôm nay, lịch tổng, giao và nhận đồ, xác nhận COD, sổ hoàn cọc, ảnh tình trạng đồ, liên hệ của khách |
| Admin | Quyền nhân viên và thống kê, nhật ký tiền, tài khoản, mã giảm giá, combo, import / xóa sản phẩm |

## Quy trình thuê

1. Khách chọn size, màu, số lượng, ngày nhận và ngày trả. Số ngày thuê tính cả hai ngày này.
2. Đặt thuê, trả tiền thuê và tiền cọc:
   - **COD:** chỉ nhân viên xác nhận đã thu.
   - **Chuyển khoản:** quét VietQR, SePay tự xác nhận (cần cấu hình).
3. Nhân viên giao đồ. Khách trả đồ, nhân viên chốt ngày trả và kiểm tra.
4. Hệ thống tính phí trễ / hư hỏng và số cọc phải hoàn. Nhân viên chuyển hoàn rồi ghi sổ.

| | Tự đến lấy | Nội thành Hà Nội | Ngoại tỉnh |
|---|---|---|---|
| Vận chuyển mỗi chiều | 0 ngày | 1 ngày | 3 ngày |
| Thuê tối thiểu | 1 ngày | 1 ngày | 3 ngày |

Lịch tự cộng ngày vận chuyển và 1 ngày giặt, chống đặt trùng theo size và màu.

Hủy khi đồ chưa gửi: chưa trả tiền thì không mất gì. Đã chuyển khoản: trước từ 3 ngày hoàn 100%, trước 1–2 ngày giữ 50% cọc, trong ngày mất cọc.

## Tài liệu khác

- [Lỗi hay gặp](HUONG_DAN_NHOM.md#3-lỗi-hay-gặp)
- [Cấu hình SePay, email, sao lưu](HUONG_DAN_THANH_TOAN.md)
- [Các biến cấu hình](.env.example): chỉ nộp `.env.example`, không nộp `.env`
- [Ghi chú nghiệp vụ và việc còn lại](TRANG_THAI_DU_AN.md)

## Chưa làm

- AI (OCR CCCD, gợi ý trang phục). Gợi ý size hiện tính theo quy tắc.
- Nhắc qua Zalo, hoàn tiền tự động, phí ship theo khu vực.
- Chưa thử với tài khoản SePay / SMTP thật, Safari và Firefox.
