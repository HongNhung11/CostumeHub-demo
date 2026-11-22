# Hướng dẫn cho thành viên nhóm

- Chỉ muốn **dùng thử**: làm [phần 1](#1-dùng-thử).
- Muốn **sửa code**: làm phần 1, rồi [phần 2](#2-sửa-code-và-gửi-lên).
- Gặp lỗi: xem [phần 4](#4-lỗi-hay-gặp).

## 1. Dùng thử

### Cần cài

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), mở lên và đợi báo đang chạy.
- [Git](https://git-scm.com/downloads).

Không cần cài Node hay PostgreSQL.

### Lần đầu

Mở PowerShell (Windows) hoặc Terminal (macOS / Linux):

```bash
git clone https://github.com/HongNhung11/CostumeHub-demo.git
cd CostumeHub-demo
```

Tạo file cấu hình `.env`, chọn **một** lệnh đúng với máy:

```bash
# Windows PowerShell
docker run --rm -v "${PWD}:/app" -w /app node:22-alpine node scripts/setup-env.js

# macOS / Linux
docker run --rm --user "$(id -u):$(id -g)" -v "$(pwd):/app" -w /app node:22-alpine node scripts/setup-env.js

# Máy đã có Node 20.17 trở lên
node scripts/setup-env.js
```

Chạy web (lần đầu mất vài phút):

```bash
docker compose up -d --build
```

Mở **http://localhost:3001**.

> Đã từng chạy bản cũ của project này? Đừng clone mới. Làm theo [Đang có bản cũ trên máy?](README.md#đang-có-bản-cũ-trên-máy) để giữ dữ liệu.

### Tài khoản để thử

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Nhân viên | `nhanvien` | `123456` |
| Khách | `khachhang` | `123456` |

Trang đăng nhập không hiện sẵn các tài khoản này. Muốn hiện thì đặt `SHOW_DEMO_ACCOUNTS=true` trong `.env` rồi chạy `docker compose up -d`.

### Gợi ý thử một vòng

1. **Khách:** chọn mẫu, size, ngày → đặt thuê, trả khi nhận đồ (COD).
2. **Admin:** vào *Quản lý → Combo & thuê nhóm* bật một ưu đãi mẫu. Khách thấy ở *Sản phẩm → Combo & thuê nhóm*.
3. **Nhân viên:** xem *Đơn thuê → Việc hôm nay*, *Lịch tổng*, *Sổ hoàn cọc*.

### Cần biết khi dùng thử

- **Đây là bản thử nghiệm: đừng dùng tiền thật hoặc CCCD, thông tin khách thật.**
- Mỗi máy có dữ liệu riêng, không ai thấy đơn của ai.
- Chưa cấu hình SePay thì chỉ đặt được COD, chưa cấu hình SMTP thì không gửi email. Thử thanh toán không mất tiền: xem phần Test mode trong [HUONG_DAN_THANH_TOAN.md](HUONG_DAN_THANH_TOAN.md).
- Web chỉ mở được trên chính máy đang chạy.

### Những lần sau

| Việc | Lệnh |
|---|---|
| Bật web | `docker compose up -d` |
| Tắt web | `docker compose down` |
| Lấy bản mới nhất | `git switch main`, `git pull`, rồi `docker compose up -d --build` |

**Không chạy `docker compose down -v`**: chữ `-v` xóa toàn bộ dữ liệu.

## 2. Sửa code và gửi lên

Mỗi việc một nhánh, gửi bằng Pull Request, **không push thẳng vào `main`**.

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

## 3. Muốn sửa gì thì mở file nào

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
| Lịch trống, ngày giặt | `utils/availability.js` |
| Mức phí nội quy | `utils/fees.js` |
| Combo / nhóm | `utils/bundles.js` |
| Thanh toán | `utils/payments.js`, `utils/sepay.js` |
| Đường dẫn và phân quyền | `routes/`, `middlewares/auth.js` |

Ba luật dễ làm hỏng:

1. **Tiền:** thao tác của khách không bao giờ được ghi "đã thanh toán".
2. **Lịch:** khóa bằng `utils/locks.js` trước rồi mới kiểm tra còn trống.
3. **Thêm cột vào bảng có sẵn:** khai ở model và ở `NEW_COLUMNS` trong `server.js`. Thiếu thì máy đã có dữ liệu sẽ lỗi.

Chi tiết nghiệp vụ: [TRANG_THAI_DU_AN.md](TRANG_THAI_DU_AN.md).

## 4. Lỗi hay gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` | Mở Docker Desktop, đợi chạy xong |
| `Thieu DB_PASSWORD` hoặc `.env not found` | Chưa tạo `.env`, xem phần 1 |
| `port is already allocated` | Trong `.env` đổi `APP_PORT=3002` và `APP_URL=http://localhost:3002`, rồi `docker compose up -d` |
| `container name "/costumehub_..." is already in use` | Đang chạy một bản khác của project. Vào thư mục bản đó chạy `docker compose down` (không có `-v`) |
| `password authentication failed` | `.env` được tạo lại sau khi đã có dữ liệu. Khôi phục `.env` cũ. Dữ liệu từ bản rất cũ thì tạo bằng `--existing-db` |
| Sửa code mà web không đổi | Thiếu `--build`, hoặc cần Ctrl+F5 |
| `Permission denied` / `403` khi push | Chưa được mời vào repo, hoặc Git đang đăng nhập tài khoản GitHub khác |
| `rejected (fetch first)` khi push | `git pull` trên nhánh đó, xử lý xung đột nếu có, rồi push lại |
| Đăng nhập báo thử quá nhiều lần | Đợi 15 phút, hoặc `docker compose restart web` trên máy bạn |
