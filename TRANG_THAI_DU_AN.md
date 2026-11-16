# 📌 CostumeHub — Tài liệu trạng thái dự án

> File này giúp **mở lại dự án là biết ngay đang làm tới đâu, chỉnh tiếp chỗ nào**.
> Cập nhật lần cuối: 2026-11-16. Trạng thái: **đã chạy được đầy đủ luồng thuê; còn AI, QR thanh toán, form liên hệ**.
> Cách chạy, tài khoản demo, danh sách chức năng: xem **README.md**.

---

## 1. Lịch sử thay đổi (theo commit trên GitHub)

| Commit | Nội dung |
|---|---|
| `d7b9cc5` | Upload bài tập ban đầu |
| `87b4f4a` | Sửa theo góp ý mục 1–3: thêm trang phục (bắt buộc trường, giá ≥ 1.000 đ, SP mới lên đầu), đặt thuê (chọn size/màu, quy định SĐT, CCCD), tìm kiếm (không dấu, nút quay lại) |
| `5a144c4` | Giỏ thuê nhiều món + chống trùng lịch theo ngày |
| `d295456` | Bảo mật & dữ liệu: chỉ chủ đơn/nhân viên xem–hủy đơn, upload chỉ nhận ảnh, ảnh CCCD riêng tư, kiểm tra đăng ký, xử lý lỗi chung, chặn giảm số bộ / xóa SP có đơn |
| `a03a877` | Quản lý tài khoản (admin), cảnh báo đơn quá hạn, tìm/lọc/phân trang đơn, import có kiểm tra, gộp trạng thái SP, dọn ảnh cũ |
| *(commit này)* | Thống kê cho admin, trang Tài khoản của tôi, volume Docker cho ảnh upload, cập nhật tài liệu |

---

## 2. Những điểm nghiệp vụ quan trọng (đọc trước khi sửa code)

- **`Product.Quantity` = TỔNG số bộ cửa hàng có**, không trừ khi đặt. Số bộ còn trống tính theo ngày ở `utils/availability.js`.
  - Một đơn giữ đồ từ **ngày nhận đến hết ngày trả**; đơn "Đang thuê" quá hạn vẫn tính đang giữ tới hôm nay.
  - Đơn đang giữ chỗ: `Đã đặt`, `Đã cọc`, `Đang thuê`.
- **Tình trạng sản phẩm** chỉ có `Còn trống` / `Ngừng cho thuê`. "Ngừng cho thuê" bị ẩn khỏi cửa hàng.
- **Một đơn nhiều món**: bảng `Rentals` (thông tin khách, ngày, tiền tổng, trạng thái) + `RentalItems` (từng món: size, màu, SL, giá lúc đặt). `Rentals.ProductID` = món đầu tiên, giữ để tương thích dữ liệu cũ.
- **Không xóa sản phẩm đã có đơn**: khóa ngoại `Rentals.ProductID` đặt `ON DELETE CASCADE` → xóa SP sẽ xóa luôn hóa đơn cũ.
- **Nâng cấp CSDL tự động** khi khởi động (`server.js`): thêm cột `Users.isActive`, đổi trạng thái SP cũ, chuyển đơn cũ sang `RentalItems` (chỉ chạy 1 lần).
- **Doanh thu** (trang Thống kê): đơn Hoàn tất = tiền thuê + phí trễ + phí hư hỏng (tính theo tháng trả đồ); đơn Đã hủy = phí hủy. Tiền cọc không phải doanh thu.
- Mỗi request đọc lại tài khoản trong CSDL → tài khoản bị khóa bị đăng xuất ngay, đổi vai trò có hiệu lực ngay.

---

## 3. 🔜 Việc còn lại

**Theo góp ý của thầy/cô:**
1. **Form liên hệ** (mục 4): lưu nội dung khách gửi + trang cho nhân viên xem.
2. **Ảnh danh sách sản phẩm nhỏ lại** (mục 5).
3. **Thanh toán bằng mã QR** (VietQR) + trạng thái "Chờ thanh toán" và nhân viên xác nhận đã nhận tiền.
4. **AI** chỉ dựa trên dữ liệu của cửa hàng: gợi ý trang phục theo dịp / tìm kiếm thông minh; OCR CCCD.

**Nghiệp vụ còn thiếu:**
- **Tiền thuê chưa được ghi nhận là đã thu**: lúc đặt chỉ ghi "Đã cọc"; lúc trả đồ hoàn cọc = cọc − phí trễ − phí hư hỏng. Cần thêm bước thu tiền thuê (khi đặt hoặc khi giao đồ) và hiển thị trên hóa đơn.
- Trang chủ và chân trang đang ghi "Tích hợp AI", "xác minh CCCD bằng AI" → làm AI hoặc sửa câu chữ trước khi nộp.
- Form đăng nhập đang điền sẵn `admin / admin123` (tiện demo, nhưng nên bỏ khi nộp).

**Kỹ thuật:**
- **Chưa chạy thử trên PostgreSQL / Docker** sau các thay đổi CSDL → bật Docker Desktop và chạy `docker compose up --build` để kiểm tra.
- Session lưu trong RAM (khởi động lại là đăng xuất hết); chưa có chống CSRF, giới hạn đăng nhập sai.

---

## 4. Ghi chú
- Dữ liệu trong `data/costumehub.sqlite` là dữ liệu test, xóa đi sẽ tạo lại 26 sản phẩm mẫu + 3 tài khoản.
- Ảnh sản phẩm mẫu nằm trong `public/img/` (đã có sẵn, không cần mạng).
- Tài liệu đề tài tổng quát: `../MoTa_DeTai_CostumeHub.docx`.
