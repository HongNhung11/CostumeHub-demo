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
| Admin | `admin` | `admin123` | Mọi quyền của nhân viên + **xóa / import** sản phẩm, **Thống kê**, **Mã giảm giá**, **Quản lý tài khoản** |
| Nhân viên | `nhanvien` | `123456` | Quản lý sản phẩm (thêm, sửa, sao chép, export), xem mọi đơn, giao đồ, nhận trả, đổi size, hủy đơn, ẩn / xóa đánh giá |
| Khách | `khachhang` | `123456` | Thêm vào giỏ, dùng mã giảm giá, đặt thuê, xem / hủy / đổi size **đơn của mình**, yêu thích, đánh giá có ảnh, sửa thông tin |

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
| Ngày nhận sớm nhất | Hôm nay | Ngày mai | Hôm nay + 3 |

### 3. Ví dụ: thuê từ ngày 20 đến 23

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
Khách trả **1 lần** = **tiền thuê (đã trừ mã giảm giá) + tiền cọc**. Mã giảm giá chỉ giảm tiền thuê, **không đụng tiền cọc**. Tiền cọc hoàn lại khi trả đồ (trừ phí trễ / hư hỏng nếu có).

| | COD — trả khi nhận đồ | Chuyển khoản |
|---|---|---|
| Áp dụng | Mọi khu vực | Mọi khu vực |
| Giữ chỗ | Ngay khi đặt | **5 phút** |
| Cách trả | Tại shop / cho shipper khi nhận đồ | Quét **mã VietQR** (đã điền số tiền + nội dung `CH<mã đơn>`) hoặc chuyển tay |
| Sau đó | Nhân viên đánh dấu đã thu khi giao đồ | Khách bấm **"Tôi đã chuyển khoản"** trong 5 phút → giữ chỗ, chờ nhân viên kiểm tra tài khoản và bấm **"Đã nhận tiền"**. Không bấm → đơn **tự hủy** (không mất phí) |

> Tài khoản nhận tiền đang là **tài khoản mẫu** (`SHOP_BANK` trong `utils/constants.js`, kèm mã BIN ngân hàng cho VietQR). Web chưa tự biết tiền đã vào tài khoản — nhân viên xác nhận bằng tay.

Hủy đơn (chỉ khi đồ chưa gửi đi): đơn chưa trả tiền → không mất gì · đã chuyển khoản: hủy ≥ 3 ngày trước ngày nhận hoàn 100% · 1–2 ngày giữ 50% tiền cọc · trong ngày mất tiền cọc.

### 6. Trạng thái đơn

```
Tự đến lấy:    Chờ thanh toán → Chờ giao đồ → Đang thuê → Hoàn tất
Giao tận nơi:  Chờ thanh toán → Chờ giao đồ → Đang giao → Đang thuê → Đang gửi trả → Hoàn tất
               (COD bỏ qua "Chờ thanh toán"; bất kỳ lúc nào trước khi gửi đồ đều có thể → Đã hủy)
```

| Bước | Ai bấm | Ghi chú |
|---|---|---|
| Chờ thanh toán → Chờ giao đồ | Nhân viên: **Đã nhận tiền** | Đơn chuyển khoản |
| Chờ giao đồ → Đang thuê | Nhân viên: **Khách đã lấy đồ** | Tự đến lấy, từ ngày nhận; COD thu tiền lúc này |
| Chờ giao đồ → Đang giao | Nhân viên: **Đã gửi shipper** | Chọn đơn vị vận chuyển + nhập **mã vận đơn**; từ ngày gửi |
| Đang giao → Đang thuê | Khách: **Tôi đã nhận được đồ** (hoặc nhân viên) | COD coi như đã thu |
| Đang thuê → Đang gửi trả | Khách: **Tôi đã gửi trả** + mã vận đơn chiều về | Phí trễ tính theo **ngày khách gửi**, không theo ngày đồ về shop |
| → Hoàn tất | Nhân viên: **Nhận lại đồ** | Kiểm tra theo bảng nội quy, tự tính phí → hoàn cọc; đồ bận thêm 1 ngày giặt |

Trang đơn có **thanh tiến trình** các bước. Khách nhận **thông báo** ở mỗi bước (kèm mã vận đơn) và lời nhắc ngày mai / hôm nay nhận đồ, gửi trả.

### 7. Việc của nhân viên — `/rentals/today`
Trang **Việc hôm nay** (menu *Đơn thuê → Việc hôm nay*) gom đơn theo việc, mỗi đơn có nút xử lý nhanh:

| Nhóm | Gồm |
|---|---|
| Chờ xác nhận thanh toán | Đơn chuyển khoản (khách đã bấm "Tôi đã chuyển khoản" được tô đỏ) |
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
- **Yêu thích** `/favorites`: thả tim trên thẻ sản phẩm / trang chi tiết, xem lại danh sách đã lưu.
- **Đánh giá có ảnh**: chỉ khách đã thuê xong (đơn hoàn tất) mới đánh giá, 1 đánh giá / mẫu, 1–5 sao, nhận xét độ vừa (vừa / hơi chật / hơi rộng), tối đa 3 ảnh; tự ghi size đã thuê. Trang chi tiết có điểm trung bình, phân bố sao, lọc "có ảnh"; thẻ cửa hàng hiện số sao. Nhân viên ẩn / xóa đánh giá không phù hợp.
- **Trang hỗ trợ**: `/cach-thue` (5 bước có hình minh họa), `/hoi-dap` (FAQ có ô tìm kiếm không dấu), `/doi-size`, `/noi-quy`.

### Xử lý đơn (nhân viên) — `/rentals`, `/rentals/today`
- Các bước giao — nhận và trang **Việc hôm nay**: xem mục **🔄 Quy trình thuê đồ** ở trên.
- **Nhận lại đồ**: ngày nhận lại thực tế; nhân viên chọn số bộ bị bẩn / hư / mất **theo bảng nội quy** cho từng món, hệ thống tự tính phí trễ + phí vệ sinh/hư hỏng → hoàn cọc (âm = khách đền thêm). Hóa đơn liệt kê từng khoản trừ.
- Mất đồ / hư nặng: đền theo **Giá trị sản phẩm** (ô không bắt buộc khi thêm SP); sản phẩm chưa ghi giá trị thì mất tiền cọc của bộ đó.
- **Cảnh báo**: quá ngày gửi đồ, quá ngày nhận chưa lấy đồ, quá hạn trả / gửi trả, đã gửi trả mà quá ngày dự kiến chưa về shop.
- **Tìm kiếm** theo mã đơn, tên khách, SĐT, tên trang phục; **lọc** theo trạng thái / quá hạn; phân trang 15 đơn/trang.
- **Khách liên hệ** `/admin/contacts` (menu *Liên hệ* của admin / nhân viên): danh sách khách gửi form liên hệ cần tư vấn, lọc *Mới / Đang tư vấn / Đã tư vấn*, ghi chú, số yêu cầu mới hiện trên menu.

### Quản trị (admin)
- **Mã giảm giá** `/admin/coupons`: tạo mã, bật / tắt, xem số lượt đã dùng; mã đã dùng không xóa được (giữ đúng hóa đơn cũ).
- **Thống kê** `/admin/stats`: doanh thu theo tháng (tiền thuê đã trừ mã giảm giá + phí trễ + phí hư hỏng + phí hủy, không tính cọc), đơn theo trạng thái, đơn đang hoạt động & cọc đang giữ, top 10 mẫu thuê nhiều nhất.
- **Tài khoản** `/admin/users`: tạo tài khoản nhân viên / admin, đổi vai trò, khóa / mở khóa (bị đăng xuất ngay), đặt lại mật khẩu. Luôn còn ít nhất 1 admin.

### Mọi người dùng
- **Đăng ký** bắt buộc SĐT + email. **Tài khoản của tôi** `/account`: sửa họ tên, SĐT, email, CCCD, địa chỉ (tự điền khi đặt thuê), đổi mật khẩu.
- **Liên hệ** `/contact`: form để lại họ tên, SĐT, email, nhu cầu tư vấn — lưu lại cho nhân viên gọi tư vấn.

---

## 📁 Cấu trúc (MVC)

```
├── server.js                 # Khởi động, nâng cấp CSDL cũ, xử lý lỗi chung
├── config/database.js        # Sequelize (postgres / sqlite theo .env)
├── models/                   # Product, ProductVariant, ProductImage, User, Rental, RentalItem, Review, Favorite, Coupon, Notification, ContactRequest
├── controllers/              # product, cart, rental, review, favorite, coupon, notification, contact, auth, account, user (admin), stats, home
├── routes/                   # index, products, cart, rentals, admin
├── middlewares/              # auth (requireLogin / Staff / Admin), upload (Multer: ảnh SP + ảnh phụ, ảnh đánh giá, CCCD)
├── utils/                    # rentalFlow (trạng thái, thanh toán), shipping (khu vực, ngày vận chuyển), availability (lịch theo ngày), variants, sizeChart, details, categories, hot, pricing (sale), colors, coupons, notify, reviews, fees, search, text, dates
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
- **Tự động xác nhận chuyển khoản** (SePay / Casso đọc biến động số dư); hiện nhân viên bấm "Đã nhận tiền" bằng tay. Tài khoản nhận tiền đang là tài khoản mẫu.
- **Phí ship** theo khu vực; trang cài đặt số ngày vận chuyển cho admin (hiện sửa ở `utils/shipping.js`).
