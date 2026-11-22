# 📌 CostumeHub — Tài liệu trạng thái dự án

> File này giúp **mở lại dự án là biết ngay đang làm tới đâu, chỉnh tiếp chỗ nào**.
> Cập nhật lần cuối: 2026-11-23. Trạng thái: **đủ luồng thuê, thanh toán tự động (cần cấu hình SePay), Docker; còn AI**.
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
| `2724376` | Thống kê cho admin, trang Tài khoản của tôi, volume Docker cho ảnh upload, cập nhật tài liệu |
| `62bc558` → `ed1e5a3` | Nội quy & phí, size × màu, quy trình giao nhận, lịch chọn ngày, sale, form liên hệ (chi tiết: `git log`) |
| 23/11/2026 | Sửa 11 lỗi (tiền, lịch, bảo mật), nhật ký tiền, tách dữ liệu thử, test tự động (chi tiết: README) |
| 22/11/2026 | Sửa giao diện, bảo mật, SePay, combo, lịch tổng, sổ hoàn cọc, sửa COD (chi tiết: *Nhật ký cập nhật* trong README) |

---

## 2. Những điểm nghiệp vụ quan trọng (đọc trước khi sửa code)

- **`Product.Quantity` = TỔNG số bộ cửa hàng có**, không trừ khi đặt. Số bộ còn trống tính theo ngày ở `utils/availability.js`.
  - Một đơn giữ đồ từ **ngày nhận đến hết ngày trả**; đơn "Đang thuê" quá hạn vẫn tính đang giữ tới hôm nay.
  - Đơn đang giữ chỗ: danh sách `ACTIVE` trong `utils/availability.js`.
  - Mọi chỗ ghi lịch / kho phải khóa theo `utils/locks.js` **trước** khi kiểm tra còn trống, đúng thứ tự người dùng → sản phẩm → mã giảm giá.
- **Tiền**:
  - Chỉ `utils/payments.js` (SePay) và nhân viên được ghi "Đã thanh toán"; thao tác của khách **không bao giờ** được ghi đã thu.
  - Khoản phải hoàn / phải thu ghi qua `utils/ledger.js` (khóa duy nhất, gọi lại không trùng).
  - `Rentals.Discount` đã gồm `BundleDiscount`, đừng trừ 2 lần.
- **Thêm cột vào bảng đã có**: khai ở model **và** ở `NEW_COLUMNS` trong `server.js` (`sync()` không tự thêm cột).
- **Tình trạng sản phẩm** chỉ có `Còn trống` / `Ngừng cho thuê`. "Ngừng cho thuê" bị ẩn khỏi cửa hàng.
- **Một đơn nhiều món**: bảng `Rentals` (thông tin khách, ngày, tiền tổng, trạng thái) + `RentalItems` (từng món: size, màu, SL, giá lúc đặt). `Rentals.ProductID` = món đầu tiên, giữ để tương thích dữ liệu cũ.
- **Không xóa sản phẩm đã có đơn**: khóa ngoại `Rentals.ProductID` đặt `ON DELETE CASCADE` → xóa SP sẽ xóa luôn hóa đơn cũ.
- **Nâng cấp CSDL tự động** khi khởi động (`server.js`): thêm cột `Users.isActive`, đổi trạng thái SP cũ, chuyển đơn cũ sang `RentalItems` (chỉ chạy 1 lần).
- **Doanh thu** (trang Thống kê): đơn Hoàn tất = tiền thuê + phí trễ + phí hư hỏng (tính theo tháng trả đồ); đơn Đã hủy = phí hủy. Tiền cọc không phải doanh thu.
- Mỗi request đọc lại tài khoản trong CSDL → tài khoản bị khóa bị đăng xuất ngay, đổi vai trò có hiệu lực ngay.

---

## 3. 🔜 Việc còn lại

**Theo góp ý của thầy/cô:**
1. ~~Form liên hệ~~ (xong).
2. **Ảnh danh sách sản phẩm nhỏ lại** (mục 5): cần xem lại đã đạt chưa.
3. ~~Thanh toán bằng mã QR~~ (xong, tự xác nhận qua SePay).
4. **AI** chỉ dựa trên dữ liệu của cửa hàng: gợi ý trang phục theo dịp / tìm kiếm thông minh; OCR CCCD.

**Cần làm trước khi nộp / chạy thật:**
- Trang chủ và chân trang đang ghi "Tích hợp AI", "xác minh CCCD bằng AI" → làm AI hoặc sửa câu chữ trước khi nộp.
- Đổi mật khẩu mẫu, điền SePay và SMTP trong `.env`, chuyển thử một khoản thật.

**Kỹ thuật:**
- Đã chạy thử trên PostgreSQL / Docker (22/11/2026). Chưa thử với tài khoản SePay và SMTP thật.
- Bộ đếm giới hạn đăng nhập nằm trong RAM: chạy nhiều bản web song song thì cần chuyển sang kho chung.
- Đã có kiểm thử tự động (`test/`, chưa có CI); `public/css/style.css` và 2 controller lớn (product, rental) nên tách nhỏ.

---

## 4. Ghi chú
- Dữ liệu trong `data/costumehub.sqlite` (khi chạy không Docker) là dữ liệu test, xóa đi sẽ tạo lại 80 sản phẩm mẫu + 20 đơn + 3 tài khoản.
- Ảnh sản phẩm mẫu nằm trong `public/img/` (đã có sẵn, không cần mạng).
- Tài liệu đề tài tổng quát: `../MoTa_DeTai_CostumeHub.docx`.
