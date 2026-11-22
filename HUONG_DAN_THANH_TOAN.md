# Hướng dẫn thanh toán tự động, email và sao lưu

Mọi cấu hình nằm trong file `.env` (chưa có thì chép từ `.env.example`). Sửa xong chạy:

```bash
docker compose up -d
```

Không gửi file `.env`, API token hay khóa webhook cho người khác.

## 1. Tiền đi đâu?

Khách quét QR, tiền vào **thẳng tài khoản ngân hàng của cửa hàng**. SePay không giữ tiền, chỉ đọc giao dịch rồi báo cho web.

Khi tiền về:

1. Đơn chuyển từ "Chờ thanh toán" sang "Chờ giao đồ".
2. Trang của khách tự hiện "Thanh toán thành công".
3. Chuông thông báo có tin mới, kèm email nếu đã bật SMTP.

## 2. Thử trước bằng Test mode (không mất tiền)

1. Đăng ký tại https://my.sepay.vn và bật **Test mode**.
2. Trong Test mode, tạo tài khoản ngân hàng thử và một **API Access** token.
3. Ở **Cấu hình Công ty → Cấu hình chung → Cấu trúc mã thanh toán**: tiền tố `CH`, hậu tố tối thiểu 8, tối đa 8, loại "Số nguyên". Test mode có cấu hình riêng.
4. Điền `.env`:

   ```
   SEPAY_MODE=sandbox
   SEPAY_BANK=MB
   SEPAY_ACCOUNT=số tài khoản thử
   SEPAY_ACCOUNT_NAME=TEN CHU TAI KHOAN
   SEPAY_API_TOKEN=token của Test mode
   ```

5. Đặt một đơn chuyển khoản. Vào SePay → **Mô phỏng giao dịch**, nhập đúng số tiền và nội dung hiện trên trang đơn. Web hỏi SePay 10 giây một lần nên đơn tự xác nhận sau vài giây.

Đơn tạo trong Test mode được gắn nhãn thử: không vào doanh thu, và ẩn khi chuyển sang `live`.

Test mode cố ý không hiện QR để không ai chuyển nhầm tiền thật.

## 3. Nhận tiền thật

1. **Đổi mật khẩu `admin` và `nhanvien`**. Còn mật khẩu mẫu thì web không bật tiền thật.
2. Liên kết tài khoản ngân hàng ở SePay (chế độ Live), tạo API token Live và khai cấu trúc mã `CH` + 8 số như trên.
3. Điền `.env`:

   ```
   SEPAY_MODE=live
   SEPAY_BANK=MB
   SEPAY_ACCOUNT=số tài khoản thật
   SEPAY_ACCOUNT_NAME=TEN CHU TAI KHOAN
   SEPAY_API_TOKEN=token Live
   ```

   Nếu SePay yêu cầu ngân hàng của bạn nhận qua tài khoản ảo thì điền thêm `SEPAY_VA`.

4. Chạy `docker compose up -d`, vào **Đơn thuê → Sổ hoàn cọc** kiểm tra đúng ngân hàng, số tài khoản và dòng "Đối soát: chạy tốt".
5. Tự đặt một đơn và chuyển thử bằng tiền của mình trước khi cho khách dùng.

Mã ngân hàng (`SEPAY_BANK`) xem trong `config/banks.json`.

### Webhook (không bắt buộc)

Có API token là đủ chạy ở localhost. Muốn báo tức thì thì cần địa chỉ HTTPS công khai (tên miền hoặc Cloudflare Tunnel):

- URL: `https://ten-mien/webhooks/sepay`
- Xác thực: **HMAC-SHA256**, kiểu dữ liệu JSON
- Bật "Tự động gửi lại khi server trả lỗi"
- Điền khóa vào `SEPAY_WEBHOOK_SECRET`, đặt `APP_URL=https://ten-mien` và `TRUST_PROXY=1`

Trước khi đưa web ra Internet phải đổi **mọi** mật khẩu mẫu, kể cả `khachhang`.

### Các trường hợp đặc biệt

| Trường hợp | Web xử lý |
|---|---|
| Đúng mã, đúng tiền | Tự xác nhận |
| Chuyển thiếu | Giữ đơn, chuyển bù đủ thì tự xác nhận |
| Chuyển thừa | Giữ đơn, nhân viên bấm "Nhận vào đơn", phần dư vào sổ hoàn |
| Đúng giờ nhưng báo muộn | Khôi phục đơn nếu đồ còn trống |
| Không có mã đơn | Vào "Giao dịch cần xử lý" |
| Chuyển sau hạn, đơn đã hủy | Ghi khoản cần hoàn |
| Chuyển hai lần | Ghi khoản cần hoàn cho lần sau |

Web **không tự chuyển tiền hoàn**. Nhân viên chuyển bằng app ngân hàng rồi ghi mã giao dịch vào Sổ hoàn cọc.

Nên dùng một tài khoản riêng cho cửa hàng: mọi khoản tiền vào tài khoản này đều hiện trong sổ cho nhân viên xem.

## 4. Email (quên mật khẩu, báo thanh toán, nhắc hạn trả)

Với Gmail: bật xác minh 2 bước, tạo **Mật khẩu ứng dụng**, rồi điền:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email-cua-shop@gmail.com
SMTP_PASS=mật khẩu ứng dụng 16 ký tự
```

Tài khoản phải có email **đã xác minh** mới nhận được thư (mở liên kết trong thư xác minh khi đang đăng nhập). Ba tài khoản mẫu chưa có email.

## 5. Sao lưu và khôi phục

Tự sao lưu khi khởi động và mỗi 24 giờ vào volume `backups` của Docker (xóa thư mục project không mất), giữ 14 ngày. Lấy ra máy: `docker compose cp backup:/backups ./backups`. Chỉ chạy khi máy và Docker đang bật. Nên chép định kỳ sang ổ khác.

```bash
# sao lưu ngay
docker compose exec backup sh /scripts/backup.sh once

# khôi phục (GHI ĐÈ dữ liệu hiện tại)
docker compose stop web
docker compose exec backup sh /scripts/restore.sh 20261122-230000 --yes
docker compose start web
```

Trên Git Bash thêm `MSYS_NO_PATHCONV=1` trước lệnh `docker compose exec`.

Ảnh CCCD không được sao lưu và tự xóa sau `IDCARD_KEEP_DAYS` ngày kể từ khi đơn kết thúc.

## 6. Combo và thuê nhóm

Vào **Quản lý → Combo & thuê nhóm**. Hai ưu đãi mẫu đang **tắt**: xem lại mức giảm rồi bấm Bật. Khách thấy ở **Sản phẩm → Combo & thuê nhóm**.
