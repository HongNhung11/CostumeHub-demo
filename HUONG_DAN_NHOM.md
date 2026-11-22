# Hướng dẫn cho thành viên nhóm

- Chỉ muốn **tải về dùng thử**: làm theo [README](README.md#tải-về-và-dùng-thử).
- Muốn **sửa code**: chạy được theo README trước, rồi làm [phần 1](#1-sửa-code-và-gửi-lên).
- Gặp lỗi: xem [phần 3](#3-lỗi-hay-gặp).

## 1. Sửa code và gửi lên

Cần lấy project bằng `git clone` (bản ZIP không push được).

- Sửa nhỏ, không cần duyệt: làm theo [README](README.md#muốn-sửa-code), push thẳng `main` sau khi test đạt.
- Việc lớn hoặc cần người xem: mỗi việc một nhánh, gửi bằng Pull Request như các bước dưới đây.

### Chuẩn bị (chỉ một lần)

- Chủ repo mời bạn: *Settings → Collaborators → Add people*. Bạn bấm nhận lời mời trong email hoặc thông báo GitHub. Không được mời thì bấm **Fork** và làm trên bản fork.
- Khai tên để commit đứng đúng tên bạn (dùng email của tài khoản GitHub, hoặc email `noreply` của GitHub nếu không muốn lộ email vì repo công khai):

```bash
git config user.name "Tên của bạn"
git config user.email "email-github-cua-ban"
```

### Bước 1: tạo nhánh từ bản mới nhất

```bash
git switch main
git pull
git switch -c ten-viec-ngan-gon
```

Tên nhánh không dấu, không khoảng trắng, ví dụ `sua-trang-lien-he`.

### Bước 2: sửa rồi xem kết quả

```bash
docker compose up -d --build
```

Code được đóng vào image nên **lần nào sửa cũng phải có `--build`**. Dữ liệu vẫn giữ nguyên. Chưa thấy thay đổi thì bấm Ctrl+F5. Có lỗi thì xem:

```bash
docker compose logs --tail 80 web
```

### Bước 3: tự kiểm tra

- [ ] Test tự động đạt (`fail 0`):

  ```bash
  docker compose -p chregress -f docker-compose.test.yml run --build --rm test
  ```

- [ ] Trang vừa sửa chạy được, log không có lỗi.
- [ ] Thử đủ vai trò liên quan (khách, nhân viên, admin).
- [ ] Thu nhỏ còn cỡ điện thoại không bị tràn viền.
- [ ] Đụng tới tiền hoặc lịch thì đặt thử một đơn và kiểm tra số tiền, số ngày.

### Bước 4: commit và đẩy lên

```bash
git status
git add duong-dan/file-da-sua
git commit -m "Sửa gì, để làm gì"
git push -u origin ten-viec-ngan-gon
```

Đọc kỹ `git status` trước khi commit: không được có `.env`, `data/` hay `backups/`.

### Bước 5: mở Pull Request

1. Vào repo trên GitHub, bấm **Compare & pull request**.
2. Ghi note theo mẫu:

   ```text
   Đã sửa:
   -
   Cách thử:
   -
   Mọi người cần làm sau khi pull (biến .env mới, cột mới...):
   - Không
   ```

3. Nhờ một bạn khác xem, rồi bấm **Merge pull request**.
4. Báo cả nhóm chạy `git switch main`, `git pull`, `docker compose up -d --build`.

### Khi `main` có code mới trong lúc bạn đang sửa

Commit phần đang làm, rồi:

```bash
git fetch origin
git merge origin/main
```

Nếu báo **CONFLICT**: mở file được báo, chọn giữ phần nào, xóa các dòng `<<<<<<<`, `=======`, `>>>>>>>`, chạy thử, rồi `git add` file đó và `git commit`. Không chắc thì chạy `git merge --abort` để quay lại và hỏi người viết phần kia. **Không dùng `git push --force`.**

### Thử nhánh của người khác

```bash
git fetch origin
git switch ten-nhanh-cua-ban-ay
docker compose up -d --build
```

Nhánh có đổi cơ sở dữ liệu thì sao lưu trước: `docker compose exec backup sh /scripts/backup.sh once`. Quay về `main` không tự hoàn lại thay đổi trong cơ sở dữ liệu.

## 2. Muốn sửa gì thì mở file nào

| Muốn sửa | File |
|---|---|
| Menu, đầu trang, chân trang | `views/layout.ejs` |
| Màu, khoảng cách, responsive | `public/css/style.css` |
| Trang chủ, trang hỗ trợ | `views/home/` |
| Cửa hàng, chi tiết, form sản phẩm | `views/products/`, `controllers/productController.js` |
| Giỏ, đặt thuê | `views/cart/`, `controllers/cartController.js` |
| Đơn thuê | `views/rentals/`, `controllers/rentalController.js` |
| Lịch chọn ngày | `public/js/range-picker.js` |
| Phí ship theo khu vực, số ngày giao | `utils/shipping.js` |
| Dữ liệu mẫu / thử / thật | `utils/dataKind.js` |
| Nhật ký tiền | `utils/audit.js` |
| Nâng cấp cơ sở dữ liệu | `utils/migrate.js` |
| Lịch trống, ngày giặt | `utils/availability.js` |
| Mức phí nội quy | `utils/fees.js` |
| Combo / nhóm | `utils/bundles.js` |
| Thanh toán | `utils/payments.js`, `utils/sepay.js` |
| Đường dẫn và phân quyền | `routes/`, `middlewares/auth.js` |

Bốn luật dễ làm hỏng:

1. **Tiền:** thao tác của khách không bao giờ được ghi "đã thanh toán" hay chốt ngày tính phí. Mọi thao tác tiền của nhân viên phải ghi `utils/audit.js`.
2. **Lịch:** khóa bằng `utils/locks.js` trước rồi mới kiểm tra còn trống.
3. **Loại dữ liệu:** truy vấn `Rental`, `Payment`, `LedgerEntry` tự ẩn dữ liệu mẫu / thử. Chỉ dùng `.unscoped()` khi phải thấy tất cả (như chặn xóa sản phẩm).
4. **Thêm cột vào bảng có sẵn:** khai ở model và ở `NEW_COLUMNS` trong `server.js`. Thiếu thì máy đã có dữ liệu sẽ lỗi.

Chi tiết nghiệp vụ: [TRANG_THAI_DU_AN.md](TRANG_THAI_DU_AN.md).

## 3. Lỗi hay gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` | Mở Docker Desktop, đợi chạy xong |
| `Thieu DB_PASSWORD` hoặc `.env not found` | Đang dùng bản cũ: tải bản mới, không cần `.env` nữa |
| `env_file` ... `must be a string` | Docker Compose quá cũ (cần 2.24+): cập nhật Docker Desktop |
| `port is already allocated` | Tạo file `.env` có dòng `APP_PORT=3002`, rồi chạy lại |
| `container name "/costumehub_..." is already in use` | Còn container của bản cũ: chạy `CHAY_WEB.cmd` / `sh chay-web.sh`, nó tự chuyển |
| `password authentication failed` | Đang dùng bản cũ: tải bản mới rồi chạy `CHAY_WEB.cmd`, không còn dùng mật khẩu CSDL |
| Sửa code mà web không đổi | Thiếu `--build`, hoặc cần Ctrl+F5 |
| `Permission denied` / `403` khi push | Chưa được mời vào repo, hoặc Git đang đăng nhập tài khoản GitHub khác |
| `rejected (fetch first)` khi push | `git pull` trên nhánh đó, xử lý xung đột nếu có, rồi push lại |
| Đăng nhập báo thử quá nhiều lần | Đợi 15 phút, hoặc `docker compose restart web` trên máy bạn |
