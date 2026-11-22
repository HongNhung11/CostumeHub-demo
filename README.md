# 🧥 CostumeHub — Website Quản lý & Cho thuê Trang phục

Đồ án môn **Ngôn ngữ kịch bản** — Nhóm 3.
Công nghệ: **Node.js · Express · Sequelize · PostgreSQL / SQLite · EJS · Bootstrap 5 · Docker**.

Cửa hàng cho thuê trang phục nữ (áo dài, váy tiệc – đầm dạ hội, phụ kiện): khách chọn đồ vào giỏ, đặt thuê theo ngày, đặt cọc; nhân viên giao đồ – nhận trả – tính phí; admin quản lý tài khoản và xem thống kê.

**Điểm chính**
- Chuyển khoản **VietQR động**, **tự xác nhận** qua SePay, khách được báo ngay trên trang.
- **Chống trùng lịch** theo size × màu × ngày, kể cả khi nhiều khách đặt cùng lúc.
- **Combo / thuê nhóm** (kỷ yếu, bê tráp) và **gợi ý size** theo số đo.
- **Lịch tổng**, **sổ hoàn cọc**, ảnh tình trạng đồ lúc giao và lúc nhận lại.
- Chạy bằng **Docker**, tự sao lưu mỗi ngày.

**Mục lục:** [Cách chạy](#-cách-chạy) · [Cấu hình](#cấu-hình-env) · [Tài khoản demo](#-tài-khoản-demo) · [Quy trình thuê](#-quy-trình-thuê-đồ) · [Chức năng](#-chức-năng) · [Bảo mật](#bảo-mật-và-dữ-liệu) · [Cấu trúc](#-cấu-trúc-mvc) · [Nhật ký cập nhật](#nhật-ký-cập-nhật) · [Chưa làm](#-chưa-làm)

---

## 🚀 Cách chạy

### 🐳 Docker + PostgreSQL (khuyên dùng)

Cần **Docker Desktop** (đang bật) và **Node.js 20.17+** (chỉ để tạo file `.env`):

```bash
git clone https://github.com/HongNhung11/CostumeHub-demo.git
cd CostumeHub-demo
node scripts/setup-env.js      # lần đầu: tạo .env với mật khẩu ngẫu nhiên
docker compose up -d --build
```

Mở **http://localhost:3001** (đổi bằng `APP_PORT` và `APP_URL` trong `.env`).

| Việc | Lệnh |
|---|---|
| Xem log | `docker compose logs -f web` |
| Sửa `.env` xong | `docker compose up -d` |
| Sửa code / vừa `git pull` | `docker compose up -d --build` |
| Dừng | `docker compose down` (**không** thêm `-v`: sẽ xóa toàn bộ dữ liệu) |

### Đang có bản cũ trên máy?

Bản này **bắt buộc có `.env` mới** và đổi cổng mặc định từ 3000 sang **3001**. Sau khi `git pull`:

1. Có `.env` cũ thì đổi tên thành `.env.cu` (script không ghi đè file đã có).
2. Chạy `node scripts/setup-env.js --existing-db` nếu máy đã có dữ liệu Postgres của bản cũ (giữ mật khẩu DB cũ), chưa có thì bỏ `--existing-db`.
3. Chạy `docker compose up -d --build` **trong đúng thư mục cũ**: tên volume dữ liệu đặt theo tên thư mục.

Bảng và cột mới được tự thêm khi khởi động, dữ liệu cũ giữ nguyên.

### Chạy không Docker (SQLite, cần Node 20.17 trở lên)

```bash
npm ci
node scripts/setup-env.js      # rồi sửa DB_DIALECT=sqlite trong .env
npm start
```

Chạy cách này thì web ở cổng `PORT` (mặc định 3000), nhớ sửa `APP_URL` cho khớp.

### Cấu hình (.env)

`.env` chứa bí mật, đã nằm trong `.gitignore`, **không commit**. Mẫu: `.env.example`.

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `APP_PORT`, `APP_BIND` | Cổng và địa chỉ mở web (`0.0.0.0` = máy khác trong mạng vào được) | `3001`, `127.0.0.1` |
| `APP_URL` | Địa chỉ dùng trong liên kết email | `http://localhost:3001` |
| `TRUST_PROXY` | Đặt `1` khi chạy sau Nginx / Cloudflare Tunnel | `0` |
| `SESSION_SECRET`, `DB_PASSWORD` | Bí mật, script tự sinh | ngẫu nhiên |
| `SHOW_DEMO_ACCOUNTS` | Hiện tài khoản mẫu ở trang đăng nhập | `false` |
| `SEPAY_MODE` | `off` / `sandbox` (thử) / `live` (tiền thật) | `off` |
| `SEPAY_BANK`, `SEPAY_ACCOUNT`, `SEPAY_ACCOUNT_NAME`, `SEPAY_VA` | Tài khoản nhận tiền | trống |
| `SEPAY_API_TOKEN` | Đối soát 10 giây / lần, chạy được ở localhost | trống |
| `SEPAY_WEBHOOK_SECRET` | Khóa webhook HMAC (cần HTTPS công khai) | trống |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gửi email | trống |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `SQLITE_STORAGE` | Chỉ dùng khi chạy không Docker | xem `.env.example` |
| `IDCARD_KEEP_DAYS` | Số ngày lưu ảnh CCCD sau khi đơn kết thúc | `30` |
| `BACKUP_KEEP_DAYS` | Số ngày giữ bản sao lưu | `14` |

Hướng dẫn từng bước cho SePay, email, sao lưu và khôi phục: [HUONG_DAN_THANH_TOAN.md](HUONG_DAN_THANH_TOAN.md).

---

## 👤 Tài khoản demo

| Vai trò | Tài khoản | Mật khẩu | Làm được gì |
|---|---|---|---|
| Admin | `admin` | `admin123` | Mọi quyền của nhân viên + **xóa / import** sản phẩm, **Thống kê**, **Mã giảm giá**, **Combo & thuê nhóm**, **Quản lý tài khoản** |
| Nhân viên | `nhanvien` | `123456` | Quản lý sản phẩm (thêm, sửa, sao chép, export), xem mọi đơn, giao đồ, nhận trả, **xác nhận thu COD**, **lịch tổng**, **sổ hoàn cọc**, chụp ảnh tình trạng đồ, đổi size, hủy đơn, ẩn / xóa đánh giá |
| Khách | `khachhang` | `123456` | Thêm vào giỏ, dùng mã giảm giá, đặt thuê, xem / hủy / đổi size **đơn của mình**, yêu thích, đánh giá có ảnh, sửa thông tin |

> Đây là mật khẩu công khai, chỉ để thử. **Phải đổi trước khi đưa web lên mạng.** Còn mật khẩu mẫu ở tài khoản admin / nhân viên thì web không bật chuyển khoản tiền thật.

Khách tự đăng ký trên web luôn là **Khách**. Tài khoản nhân viên / admin do admin tạo ở trang **Tài khoản**.

---

## 🔄 Quy trình thuê đồ

Cửa hàng ở **Hà Nội**. Quy tắc nằm ở 3 file: `utils/shipping.js` (khu vực, số ngày vận chuyển), `utils/rentalFlow.js` (trạng thái, thanh toán), `utils/availability.js` (lịch trống).

### 1. Khách chọn ngày nào?
Khách chỉ chọn **2 ngày** trên lịch (bấm ngày nhận rồi ngày trả, không phải chọn 2 ô riêng):
- **Ngày nhận** = ngày **đồ đến tay khách**.
- **Ngày trả** = ngày khách **trả đồ đi** (mang tới shop / đưa shipper / gửi bưu cục).

Ngày vận chuyển và ngày giặt **hệ thống tự cộng**, khách không phải tính.

### 2. Nơi nhận đồ

| | Tự đến lấy | Nội thành Hà Nội | Ngoại tỉnh |
|---|---|---|---|
| Vận chuyển mỗi chiều | 0 ngày | 1 ngày | 3 ngày |
| Thuê tối thiểu | 1 ngày | 1 ngày | **3 ngày** |
| Đổi size | Tại shop, ngày nhận / hôm sau | Shipper đổi trong ngày nhận / hôm sau | **Chỉ trước khi shop gửi đồ** |
| Ngày nhận sớm nhất | Ngày mai | Ngày mai | Hôm nay + 3 |

Số ngày thuê **tính cả ngày nhận và ngày trả**: 18 → 20 là 3 ngày, 18 → 21 là 4 ngày.

### 3. Ví dụ: thuê từ ngày 20 đến 23 (4 ngày)

| | Tự đến lấy | Nội thành (1 ngày) | Ngoại tỉnh (3 ngày) |
|---|---|---|---|
| Nhân viên đóng đơn, giao shipper | — | **19** | **17** |
| Đồ đến tay khách | 20 | 20 | 20 |
| Khách trả / gửi đồ | 23 | 23 | 23 |
| Đồ về shop | 23 | 24 | 26 |
| Giặt là | 24 | 25 | 27 |
| **Cho thuê tiếp** | **25** | **26** | **28** |

→ Bộ đồ bị giữ từ *(ngày nhận − số ngày vận chuyển)* đến *(ngày trả + số ngày vận chuyển + 1 ngày giặt)*. Khách khác đặt trùng khoảng đó sẽ báo **"Đã kín lịch"**; trên trang chi tiết, size hết lịch bị **mờ + dấu ×**.

### 4. Đặt thuê 3 bước
1. **Giỏ thuê** `/cart` — xem lại món, size, màu, số lượng. Khách **chưa đăng nhập vẫn thêm / xem giỏ** được.
2. **Đặt thuê & giao nhận** `/cart/checkout` *(cần đăng nhập)* — chọn ngày trên lịch, nơi nhận đồ (+ địa chỉ giao), thông tin người thuê (SĐT, CCCD, địa chỉ — tự điền từ *Tài khoản của tôi*), mã giảm giá, cách thanh toán.
3. **Hoàn tất** — trang đơn vừa đặt (chuyển khoản thì hiện mã QR ở đây).

Bấm **Thuê ngay** ở trang chi tiết → vào thẳng bước 2 (chưa đăng nhập thì sang trang đăng nhập, xong quay lại bước 2). **Thêm vào giỏ** không tải lại trang, hiện khung *"Đã thêm sản phẩm vào giỏ"*.

### 5. Thanh toán
Khách trả **1 lần** = **tiền thuê (đã trừ combo / nhóm và mã giảm giá) + tiền cọc**. Combo / nhóm trừ trước, mã tính trên phần còn lại. Cả hai chỉ giảm tiền thuê, **không đụng tiền cọc**. Tiền cọc hoàn lại khi trả đồ (trừ phí trễ / hư hỏng nếu có).

| | COD — trả khi nhận đồ | Chuyển khoản |
|---|---|---|
| Áp dụng | Mọi khu vực | Mọi khu vực |
| Giữ chỗ | Ngay khi đặt | **5 phút** |
| Cách trả | Tại shop / cho shipper khi nhận đồ | Quét **mã VietQR động** (đã điền số tiền + nội dung `CH` và 8 số) hoặc chuyển tay |
| Sau đó | **Chỉ nhân viên** xác nhận đã thu. Chưa thu thì không hoàn cọc | SePay báo tiền về → đơn **tự xác nhận**, trang khách tự báo thành công. Quá hạn → đơn **tự hủy**; tiền về muộn → vào **Sổ hoàn cọc** |

Các trường hợp chuyển khoản:

| Trường hợp | Web xử lý |
|---|---|
| Đúng tài khoản, đúng mã, đúng số tiền | Tự xác nhận, báo khách |
| Sai số tiền / không có mã đơn | Không xác nhận, vào *Sổ hoàn cọc → Giao dịch cần xử lý* |
| Tiền về khi đơn đã hủy, hoặc chuyển 2 lần | Ghi khoản cần hoàn |
| Một giao dịch được báo nhiều lần | Chỉ ghi 1 lần |

Đồng hồ giữ chỗ là 5 phút, máy chủ chờ thêm 2 phút cho ngân hàng báo chậm rồi mới hủy. Web **không tự chuyển tiền hoàn**: nhân viên chuyển rồi ghi mã giao dịch vào sổ.

> Tài khoản nhận tiền khai trong `.env` (`SEPAY_*`). Chưa khai thì web không cho chọn chuyển khoản và không hiện QR.

Hủy đơn (chỉ khi đồ chưa gửi đi): đơn chưa trả tiền → không mất gì · đã chuyển khoản: hủy ≥ 3 ngày trước ngày nhận hoàn 100% · 1–2 ngày giữ 50% tiền cọc · trong ngày mất tiền cọc.

### 6. Trạng thái đơn

```
Tự đến lấy:    Chờ thanh toán → Chờ giao đồ → Đang thuê → Hoàn tất
Giao tận nơi:  Chờ thanh toán → Chờ giao đồ → Đang giao → Đang thuê → Đang gửi trả → Hoàn tất
               (COD bỏ qua "Chờ thanh toán"; bất kỳ lúc nào trước khi gửi đồ đều có thể → Đã hủy)
```

| Bước | Ai bấm | Ghi chú |
|---|---|---|
| Chờ thanh toán → Chờ giao đồ | **Tự động** khi SePay báo tiền về | Nhân viên chỉ *Xác nhận tay* khi SePay gặp sự cố |
| Chờ giao đồ → Đang thuê | Nhân viên: **Khách đã lấy đồ** | Tự đến lấy, từ ngày nhận; COD thu tiền lúc này |
| Chờ giao đồ → Đang giao | Nhân viên: **Đã gửi shipper** | Chọn đơn vị vận chuyển + nhập **mã vận đơn**; từ ngày gửi |
| Đang giao → Đang thuê | Khách: **Tôi đã nhận được đồ** (hoặc nhân viên) | **Không** ghi đã thu: nhân viên bấm **Đã thu COD** khi nhận được tiền |
| (không đổi trạng thái) | Nhân viên: **Đã thu COD** | Đơn COD giao tận nơi, khi đã nhận tiền từ khách / shipper |
| Đang thuê → Đang gửi trả | Khách: **Tôi đã gửi trả** + mã vận đơn chiều về | Phí trễ tính theo **ngày khách gửi**, không theo ngày đồ về shop |
| → Hoàn tất | Nhân viên: **Nhận lại đồ** | Kiểm tra theo bảng nội quy, tự tính phí → hoàn cọc; đồ bận thêm 1 ngày giặt |

Trang đơn có **thanh tiến trình** các bước. Khách nhận **thông báo** ở mỗi bước (kèm mã vận đơn) và lời nhắc ngày mai / hôm nay nhận đồ, gửi trả.

### 7. Việc của nhân viên — `/rentals/today`
Trang **Việc hôm nay** (menu *Đơn thuê → Việc hôm nay*) gom đơn theo việc, mỗi đơn có nút xử lý nhanh:

| Nhóm | Gồm |
|---|---|
| Chờ xác nhận thanh toán | Đơn chuyển khoản (chỉ xử lý tay khi SePay gặp sự cố) |
| Xác nhận đã thu COD | Đơn COD đã gửi đi mà chưa xác nhận nhận được tiền |
| Đóng đơn & gửi shipper | Đơn giao tận nơi có ngày gửi là hôm nay hoặc đã quá |
| Chuẩn bị cho ngày mai | Đơn gửi / khách lấy vào ngày mai — kiểm tra, ủi sẵn |
| Khách đến lấy tại shop | Đơn tự đến lấy, nhận hôm nay |
| Đang giao tới khách | Theo dõi mã vận đơn |
| Thu hồi đồ | Đến hạn trả / quá hạn, và đơn khách đã gửi trả đang về |
| Giặt là | Đồ vừa nhận lại hôm qua / hôm nay |

**Phiếu đơn in** (`/rentals/:id/slip`) để bỏ vào túi / hộp hàng: người nhận, danh sách món (ô ☐ đã kiểm), dòng **THU HỘ COD** nếu có, hướng dẫn gửi trả, chỗ ký người đóng gói.

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
- Giao diện tham khảo tinastore: nền kem, điểm nhấn hồng đất; phông **Cormorant Garamond** (tiêu đề) + **DM Sans** (chữ thường); khung trang tối đa 1760px. Mọi trạng thái "đang chọn" dùng chung 1 kiểu màu; nút lên đầu trang; menu xổ khi rê chuột. Màu sắc sản phẩm hiện bằng chấm màu thật (`utils/colors.js`).
- **Cửa hàng** `/products`: cột lọc bên trái (Danh mục, Ngày thuê, Kích thước, Màu sắc, Giá thuê — Phụ kiện / Kích thước / Màu sắc thu gọn, bấm mới xổ), thanh **tìm kiếm + sắp xếp** cùng 1 hàng (Mới nhất, Cũ nhất, Giá tăng / giảm dần, Nổi bật, Đánh giá cao). Size xếp đúng thứ tự XS → S → M → L → XL.
- Menu **Sản phẩm** xổ xuống có mục con (Trang phục › Áo dài, Váy tiệc · Phụ kiện › Dây chuyền, Bông tai, Nhẫn, Vòng tay, Túi xách) — cấu hình ở `utils/categories.js`.
- Thẻ sản phẩm ghi **Giá thuê / Giá cọc**; nhãn **HOT** cho tối đa 6 mẫu được thuê / thêm vào giỏ nhiều nhất (`utils/hot.js`); bấm vào thẻ để vào trang chi tiết.
- **Không hiện số lượng cho khách** (số mẫu, số bộ tồn kho) — chỉ báo còn trống / hết lịch. Nhân viên vẫn thấy số bộ.
- **Trang chi tiết**: ảnh nhỏ dọc + ảnh lớn (chia sẻ / yêu thích dưới ảnh); Giá thuê, Tiền cọc, Phí trả trễ, Giá trị sản phẩm; chọn Màu sắc, Size (*Bảng số đo* mở cửa sổ lớn), Số lượng; ô **Chọn lịch thuê** (lịch 1 lần + nơi nhận đồ) ngay dưới Số lượng; khối *Thuê thế nào?* 4 bước; dải **chính sách thuê** dưới ảnh; Mô tả sản phẩm + **Thông tin chi tiết** (chất liệu, kiểu dáng, độ dài, dịp, bảo quản); **Đánh giá**; **Câu hỏi thường gặp** riêng theo mẫu; Sản phẩm tương tự; Sản phẩm đã xem.

### Thuê đồ (khách)
- Quy trình đặt thuê, giao nhận, thanh toán: xem mục **🔄 Quy trình thuê đồ** ở trên.
- **Xem lịch trống theo ngày khách chọn**: xem bình thường thì không hiện mẫu nào đã có người thuê; khách chọn ngày (ở cửa hàng hoặc trang chi tiết) thì mới báo còn trống / **"Đã kín lịch"**, có tùy chọn *chỉ hiện mẫu còn trống*. Ngày đã chọn được nhớ và tự điền ở bước đặt thuê.
- **Số lượng theo size × màu**: mỗi mẫu tự khai size / kích thước riêng (1 size cũng được; phụ kiện ghi "Ni 6", "40cm"...) và nhập số bộ cho từng size × màu. Khách thuê size S không ảnh hưởng size M. Tối đa 30 ngày / đơn.
- Quy định: **SĐT** 10 số đầu 03/05/07/08/09, **CCCD** 12 số (mã tỉnh 001–096), **địa chỉ** bắt buộc; ảnh CCCD (chỉ chủ đơn và nhân viên xem được).
- **Thông báo** (chuông trên menu, `/notifications`, trang Tài khoản): báo khi đơn đổi trạng thái và nhắc ngày nhận / ngày trả, quá hạn.
- **Nội quy & bảng trừ phí** `/noi-quy` (mức phí sửa ở `utils/fees.js`): khách phải tick **"đồng ý nội quy"** mới đặt được; hóa đơn ghi lại thời điểm đồng ý.

- **Nhiều ảnh / sản phẩm**: ảnh chính + tối đa 6 ảnh phụ (mặt sau, chi tiết, ảnh mặc thật); trang chi tiết có thư viện ảnh bấm chuyển.
- **Bảng số đo theo size** (vòng ngực, eo, mông, chiều cao gợi ý): nhân viên nhập theo từng size (không bắt buộc, có nút điền số đo tham khảo S–XL); khách xem ở trang chi tiết kèm hướng dẫn cách đo.
- **Sale của cửa hàng** (khác voucher): mỗi mẫu có *Giá khuyến mãi / ngày* + *Khuyến mãi đến ngày* (form Thêm / Sửa, không bắt buộc). Thẻ và trang chi tiết hiện giá gốc gạch ngang + nhãn giảm %; giỏ thuê và đơn tính theo giá sale; hết hạn tự về giá gốc. Cửa hàng có lọc *Đang giảm giá* và sắp xếp *Giảm giá nhiều nhất* (`utils/pricing.js`).
- **Mã giảm giá**: nhập ở bước đặt thuê (hoặc bấm chọn mã đang có), chỉ giảm **tiền thuê** (không giảm cọc). Mã theo % (có mức giảm tối đa) hoặc số tiền; điều kiện tiền thuê tối thiểu, ngày áp dụng, tổng lượt dùng, chỉ đơn đầu tiên. Mỗi khách dùng mỗi mã 1 lần; hủy đơn thì trả lại lượt. Dữ liệu mẫu: `CHAOBANMOI`, `THUE3NGAY`, `MUACUOI<năm>`.
- **Đổi size khi không vừa** `/doi-size`: đơn *Chờ giao đồ* → khách tự đổi size / màu (cùng mẫu) ngay trên trang đơn; đơn *Đang thuê* → nhân viên đổi giúp trong ngày nhận hoặc ngày hôm sau. Đồ đang vận chuyển không đổi được; đơn ngoại tỉnh chỉ đổi trước ngày shop gửi đồ. Đổi được một phần số bộ, size mới phải còn trống; giá và cọc giữ nguyên; mỗi lần đổi ghi vào ghi chú đơn.
- **Combo & thuê nhóm** `/combo` (menu *Sản phẩm*): nhập số bộ cho nhiều size cùng lúc rồi đưa vào giỏ. *Combo*: thuê đủ các mẫu thì giảm %. *Nhóm*: đủ số bộ tối thiểu thì giảm %. Mỗi bộ chỉ hưởng 1 ưu đãi, hệ thống chọn mức lợi hơn cho khách.
- **Gợi ý size** (nút *Gợi ý size · bảng số đo* cạnh ô Size): nhập chiều cao / 3 vòng → chọn size nhỏ nhất mặc vừa theo bảng số đo của chính mẫu đó, báo nếu rộng hoặc tà dài / ngắn.
- **Quên mật khẩu** `/quen-mat-khau` và **email** báo thanh toán, nhắc ngày nhận / hạn trả (cần khai SMTP).
- **Yêu thích** `/favorites`: thả tim trên thẻ sản phẩm / trang chi tiết, xem lại danh sách đã lưu.
- **Đánh giá có ảnh**: chỉ khách đã thuê xong (đơn hoàn tất) mới đánh giá, 1 đánh giá / mẫu, 1–5 sao, nhận xét độ vừa (vừa / hơi chật / hơi rộng), tối đa 3 ảnh; tự ghi size đã thuê. Trang chi tiết có điểm trung bình, phân bố sao, lọc "có ảnh"; thẻ cửa hàng hiện số sao. Nhân viên ẩn / xóa đánh giá không phù hợp.
- **Trang hỗ trợ**: `/cach-thue` (5 bước có hình minh họa), `/hoi-dap` (FAQ có ô tìm kiếm không dấu), `/doi-size`, `/noi-quy`.

### Xử lý đơn (nhân viên) — `/rentals`, `/rentals/today`
- Các bước giao — nhận và trang **Việc hôm nay**: xem mục **🔄 Quy trình thuê đồ** ở trên.
- **Nhận lại đồ**: ngày nhận lại thực tế; nhân viên chọn số bộ bị bẩn / hư / mất **theo bảng nội quy** cho từng món, hệ thống tự tính phí trễ + phí vệ sinh/hư hỏng → hoàn cọc (âm = khách đền thêm). Hóa đơn liệt kê từng khoản trừ.
- Mất đồ / hư nặng: đền theo **Giá trị sản phẩm** (ô không bắt buộc khi thêm SP); sản phẩm chưa ghi giá trị thì mất tiền cọc của bộ đó.
- **Lịch tổng** `/rentals/calendar` (menu *Đơn thuê*): mỗi ngày có bao nhiêu việc gửi / giao / thu hồi / đồ về, và bao nhiêu bộ đang bận.
- **Sổ hoàn cọc** `/admin/money` (menu *Đơn thuê*): khoản phải hoàn, khoản khách phải trả thêm, giao dịch chuyển khoản cần xử lý, tình trạng kết nối SePay.
- **Ảnh tình trạng đồ** (trong trang đơn): chụp lúc giao và lúc nhận lại, tối đa 10 ảnh mỗi lần, không xóa được để làm bằng chứng khi trừ cọc.
- **Cảnh báo**: quá ngày gửi đồ, quá ngày nhận chưa lấy đồ, quá hạn trả / gửi trả, đã gửi trả mà quá ngày dự kiến chưa về shop.
- **Tìm kiếm** theo mã đơn, tên khách, SĐT, tên trang phục; **lọc** theo trạng thái / quá hạn; phân trang 15 đơn/trang.
- **Khách liên hệ** `/admin/contacts` (menu *Liên hệ* của admin / nhân viên): danh sách khách gửi form liên hệ cần tư vấn, lọc *Mới / Đang tư vấn / Đã tư vấn*, ghi chú, số yêu cầu mới hiện trên menu.

### Quản trị (admin)
- **Mã giảm giá** `/admin/coupons`: tạo mã, bật / tắt, xem số lượt đã dùng; mã đã dùng không xóa được (giữ đúng hóa đơn cũ).
- **Combo & thuê nhóm** `/admin/bundles`: tạo, bật / tắt, xóa. Dữ liệu mẫu có 2 ưu đãi đang **tắt**; cơ sở dữ liệu cũ cũng được thêm 2 ưu đãi này ở trạng thái tắt.
- **Thống kê** `/admin/stats`: doanh thu theo tháng (tiền thuê đã trừ mã giảm giá + phí trễ + phí hư hỏng + phí hủy, không tính cọc), đơn theo trạng thái, đơn đang hoạt động & cọc đang giữ, top 10 mẫu thuê nhiều nhất.
- **Tài khoản** `/admin/users`: tạo tài khoản nhân viên / admin, đổi vai trò, khóa / mở khóa (bị đăng xuất ngay), đặt lại mật khẩu. Luôn còn ít nhất 1 admin.

### Mọi người dùng
- **Đăng ký** bắt buộc SĐT + email. **Tài khoản của tôi** `/account`: sửa họ tên, SĐT, email, CCCD, địa chỉ (tự điền khi đặt thuê), đổi mật khẩu.
- **Liên hệ** `/contact`: form để lại họ tên, SĐT, email, nhu cầu tư vấn — lưu lại cho nhân viên gọi tư vấn.

---

## Bảo mật và dữ liệu

| Hạng mục | Cách làm |
|---|---|
| Đăng nhập | Khóa 15 phút sau 5 lần sai (theo IP + tài khoản); đổi session id khi đăng nhập; đổi mật khẩu thì các thiết bị khác bị đăng xuất |
| CSRF | Kiểm tra Fetch Metadata / Origin cho mọi POST, cookie `SameSite=Lax` |
| Session, giỏ thuê | Lưu trong CSDL (chỉ lưu hash của session id), khởi động lại không mất |
| Trùng lịch | Khóa dòng `SELECT … FOR UPDATE` khi đặt, đổi size, sửa kho |
| Sửa đơn cùng lúc | Khóa lạc quan theo cột `version` |
| Webhook | Chữ ký HMAC-SHA256, từ chối gói tin lệch quá 5 phút |
| Ảnh CCCD | Riêng tư, tự xóa sau 30 ngày kể từ khi đơn kết thúc, không đưa vào bản sao lưu |
| Sao lưu | Mỗi ngày vào `backups/` (CSDL + ảnh), giữ 14 ngày |
| Múi giờ | `Asia/Ho_Chi_Minh` cho cả web và CSDL |

---

## 📁 Cấu trúc (MVC)

```
├── server.js                 # Khởi động, nâng cấp CSDL cũ, xử lý lỗi chung
├── config/                   # database, sessionStore, banks.json (mã BIN ngân hàng)
├── models/                   # Product, ProductVariant, ProductImage, User, Rental, RentalItem, Review, Favorite, Coupon,
│                             #   Notification, ContactRequest, Payment, LedgerEntry, Bundle, HandoverPhoto, Session
├── controllers/              # product, cart, rental, review, favorite, coupon, notification, contact, auth, password,
│                             #   account, user (admin), stats, home, bundle, calendar, money, photo
├── routes/                   # index, products, cart, rentals, admin, webhooks (SePay)
├── middlewares/              # auth (phân quyền), security (CSRF, header, giới hạn), upload (Multer)
├── utils/
│   ├── rentalFlow, shipping, availability, locks     # quy trình, lịch trống, chống trùng
│   ├── sepay, payments, vietqr, ledger               # chuyển khoản tự động, sổ hoàn tiền
│   ├── bundles, coupons, pricing, fees               # giá, ưu đãi, phí
│   ├── jobs, notify, mailer, retention               # việc nền, thông báo, email, xóa CCCD
│   └── env, account, passwordVersion, dates, text, variants, sizeChart, search, ...
├── views/                    # EJS + Bootstrap
├── public/                   # CSS, JS (lịch, gợi ý size), ảnh mẫu, uploads/
├── private_uploads/          # ảnh CCCD, ảnh tình trạng đồ (không công khai, tạo khi chạy)
├── scripts/                  # setup-env, backup, restore
├── seed/seed.js              # Dữ liệu mẫu
├── docker-compose.yml        # web + PostgreSQL + backup
└── Dockerfile
```

---

## Nhật ký cập nhật

### 22/11/2026

**Thêm**
- Chuyển khoản VietQR động, tự xác nhận qua SePay (webhook + API đối soát), sổ hoàn cọc.
- Combo / thuê nhóm, gợi ý size, lịch tổng, ảnh tình trạng đồ.
- Quên mật khẩu và nhắc hạn qua email; sao lưu hằng ngày; tự xóa ảnh CCCD.

**Sửa**
- Đặt trùng bộ cuối cùng và dùng quá lượt mã giảm giá khi nhiều khách đặt cùng lúc trên Postgres.
- Múi giờ Docker làm lệch hạn trả và phí trễ.
- COD giao tận nơi: khách bấm "đã nhận đồ" không còn được tính là đã trả tiền.
- Tràn viền khi thu nhỏ / phóng to, biểu đồ thống kê, menu xổ và lịch bị che.
- Ô tiền tách hàng nghìn ngay khi gõ; SĐT đặt thuê tối đa 10 số.

**Bảo mật**
- Chống CSRF, giới hạn đăng nhập, đổi session khi đăng nhập, không điền sẵn mật khẩu admin.
- Postgres không mở cổng ra ngoài; nâng cấp các thư viện có lỗ hổng (xlsx, multer, sqlite3, fast-xml-parser).

**Thay đổi cần lưu ý khi cập nhật**
- Bắt buộc có `.env` (xem [Đang có bản cũ trên máy?](#đang-có-bản-cũ-trên-máy)); cổng Docker mặc định là 3001; cần Node 20.17+.
- Bỏ nút "Tôi đã chuyển khoản". Chưa cấu hình SePay thì khách chỉ chọn được COD.

**Đã kiểm thử**
- Trên PostgreSQL thật: đặt đồng thời, thanh toán, COD, email (máy chủ thư giả), khởi động lại, sao lưu và khôi phục, nâng cấp từ bản cũ.
- Giao diện trên Chrome ở 35 độ rộng màn hình, từ 320 đến 3072 px.
- **Chưa thử** với tài khoản SePay / SMTP thật, Safari và Firefox. Kịch bản kiểm thử chưa nằm trong repo.

---

## 🔜 Chưa làm

- **AI**: OCR CCCD tự điền số (Tesseract.js), gợi ý trang phục / tìm kiếm thông minh. (Gợi ý size hiện tại tính theo quy tắc, không dùng AI.)
- **Nhắc qua Zalo** (cần Official Account và mẫu tin được duyệt).
- **Hoàn tiền tự động**, kiểm thử tự động (CI).
- **Phí ship** theo khu vực; trang cài đặt số ngày vận chuyển cho admin (hiện sửa ở `utils/shipping.js`).
