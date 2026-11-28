# Hướng dẫn demo các luồng chính theo vai trò

Kịch bản demo trọn vẹn trên giao diện, đi qua đủ **Khách, Player, Organizer (quyền ngữ cảnh của Player), Court Owner và Admin**. Mỗi cảnh ghi rõ ai thao tác, bấm gì, và kết quả cần thấy.

> **Trạng thái tài liệu:** nhãn nút, route và số liệu được đối chiếu với mã nguồn ngày 2026-11-27. Chưa chạy trọn kịch bản trên máy thật. Các điểm chưa chắc được gom ở §16; hãy chạy thử một lượt trước khi demo.

Tài liệu chi tiết từng mảng (dùng khi cần đào sâu):

- [`manual-ui-test-key-flows.md`](manual-ui-test-key-flows.md): booking, finance, duyệt, báo cáo, cấu hình, dashboard.
- [`09_matchmaking-split-booking.md`](09_matchmaking-split-booking.md): Split Bill với dữ liệu seed sẵn.
- [`../features/tournament/manual-test-guide.md`](../features/tournament/manual-test-guide.md): Giải đấu.
- [`../guides/owner-wallet-earning-testing.md`](../guides/owner-wallet-earning-testing.md): ví và thu nhập chủ sân.

---

## 1. Bản đồ vai trò và cảnh demo

| Cảnh | Nội dung | Khách | Player | Organizer | Court Owner | Admin |
| --- | --- | :-: | :-: | :-: | :-: | :-: |
| 1 | Đăng ký, khảo sát 16 câu, OTP, kết quả trình độ | ✔ | ✔ | | | |
| 2 | Admin tạo tài khoản Court Owner | | | | | ✔ |
| 3 | Owner đổi mật khẩu bắt buộc, gửi cơ sở, sân, bảng giá | | | | ✔ | |
| 4 | Admin duyệt cơ sở và sân | | | | ✔ | ✔ |
| 5 | Ví sàn: thiếu tiền, Admin cộng ví, xem lịch sử | | ✔ | | | ✔ |
| 6 | Booking: tìm sân, giữ slot, trả ví, khóa bảo trì, hủy do sự cố, doanh thu owner | | ✔ | | ✔ | |
| 7 | Matchmaking: đăng kèo, Apply, Invite, chốt, nhóm chat, Split Bill, khóa rút | | ✔ | | | ✔ |
| 8 | Rút kèo trước khi trả sân và bị gỡ khỏi nhóm chat | | ✔ | | | |
| 9 | Messaging: 1-1, nhóm, ảnh/file, reaction, typing, chặn | | ✔ | | | |
| 10 | Social, báo cáo vi phạm và Admin kiểm duyệt | | ✔ | | | ✔ |
| 11 | Giải đấu: Player, Organizer, Admin | ✔ | ✔ | ✔ | | ✔ |
| 12 | Admin tổng kết: dashboard, tài chính, cấu hình, người dùng | | | | | ✔ |

**Bản rút gọn 20 phút:** cảnh 1 (chỉ xem wizard), 4, 5, 6 (đặt và hủy do sự cố), 7, 11 (Organizer nhập tỉ số), 12.

---

## 2. Chuẩn bị môi trường (làm trước giờ demo ít nhất 15 phút)

### 2.1. Khởi động

Từ thư mục gốc repo. Container `badminton_postgres` thường đã chạy sẵn; kiểm tra bằng `docker ps`.

```bash
docker compose up -d
npm run db:migrate
npm run db:seed              # Admin, 3 Owner, Player cơ bản, cơ sở + sân + bảng giá
npm run db:seed:social       # 4 Player social.demo.* + 12 bài Social + 6 kèo mẫu
npm run db:seed:tournaments  # Organizer, 12 Player có ví 1.000.000đ, 14 giải mẫu
npm run dev                  # Frontend :5173, backend :3000
```

Nếu vừa seed lâu hơn 1–2 ngày, các kèo mẫu của `db:seed:social` có thể đã quá giờ bắt đầu. Khi đó reset DB (xem §17.1).

### 2.2. Trình duyệt: 4 phiên đăng nhập song song

Session lưu bằng cookie nên mỗi vai trò cần một phiên riêng. Dùng 4 profile trình duyệt hoặc cửa sổ ẩn danh:

| Cửa sổ | Dùng cho |
| --- | --- |
| A | Admin (mở suốt buổi demo) |
| B | Court Owner |
| C | Player chính |
| D | Player thứ hai (cho Apply, chat realtime, chặn) |

### 2.3. Tài khoản (mật khẩu chung `Password@123`)

| Vai trò | Email | Ghi chú |
| --- | --- | --- |
| Admin | `admin@smashpro.vn` | |
| Court Owner (tạo ở cảnh 2) | `demo.owner@example.com` | Mật khẩu đặt ở cảnh 2, đổi ở cảnh 3 |
| Court Owner (seed, dự phòng) | `quocbao.tran@phucthinhbadminton.vn` | Đã có cơ sở ACTIVE và bảng giá |
| Player mới (tạo ở cảnh 1) | `demo.player@example.com` | Ví 0đ |
| Player seed cơ bản | `nam.nguyen@example.com` | Ví 0đ |
| Player có ví 1.000.000đ | `tournament.p01` … `tournament.p12@example.com` | Trình độ khác nhau, xem bảng dưới |
| Player ví 0đ | `tournament.broke@example.com` | Mới chơi, dùng cho cảnh "thiếu ví" |
| Organizer | `tournament.organizer@example.com` | Chủ của 14 giải `[DEMO]` |
| Player social | `social.demo.nam`, `.an`, `.ha`, `.duc@example.com` | Chủ/thành viên các kèo mẫu |

Trình độ của các Player dùng nhiều nhất: p01 Giỏi, p02 Khá, p03 Trung bình khá, p04 Trung bình, p05 Trung bình yếu, `broke` Mới chơi.

### 2.4. Ba điều cần biết về cấu hình hiện tại

1. **OTP đăng ký gửi email thật.** `backend/.env` đang có `RESEND_API_KEY`, nên mã OTP đi qua Resend tới hộp thư bạn nhập. Dùng một email bạn đọc được. Nếu không nhận được thư, xem cách đọc OTP từ DB ở cảnh 1.
2. **Nạp ví là VietQR thật, không có nút mock.** `SEPAY_BANK_ACCOUNT` đã đặt, nên `/wallet` tạo mã QR chờ chuyển khoản thật. Khi demo, chỉ cần tạo mã nạp để cho thấy QR, rồi dùng **Admin cộng ví** để có số dư (cảnh 5). Nút "Xác nhận thanh toán thử" chỉ xuất hiện khi SePay chưa cấu hình.
3. **Thanh toán booking dùng ví** (`PAYMENT_PROVIDER=WALLET`). Trang tóm tắt booking vẫn còn dòng chữ "Cổng thanh toán điện tử trực tuyến (VNPAY)". Đó là chữ cũ trên UI, thanh toán thực tế trừ ví.

---

## 3. Cảnh 1 · Đăng ký, khảo sát và OTP (Khách → Player)

**Cửa sổ C, chưa đăng nhập.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Mở `http://localhost:5173/`. Bấm **Khám phá trình độ – 3 phút** | Vào `/register` bước 1. Trang chủ cho khách là landing page |
| 2 | Bước 1 **Tiểu sử & thói quen** (4 câu), bấm **Tiếp tục** | Chip "Bước 01 / 05". Bỏ sót câu thì báo "Còn N câu chưa trả lời" |
| 3 | Bước 2 **Kỹ thuật** (9 kỹ năng, thang 0–3), bước 3 **Thực chiến & thể lực** (2 câu), bước 4 **Thành tích thi đấu** (1 câu) | Tổng 16 câu. Chọn xong kỹ năng cuối có toast "Đã xong 9 kỹ năng" |
| 4 | Bước 5 **Tạo tài khoản SmashPro**: email `demo.player@example.com` (hoặc email thật của bạn), mật khẩu `Password@123`, họ tên `Demo Người Chơi`, **Mã PIN rút tiền** 6 số (ví dụ `123456`) và nhập lại | Có phần xem lại câu trả lời, mỗi mục có nút "Sửa bước N" |
| 5 | Bấm **Tạo tài khoản** | Sang `/register/verify`, tiêu đề **Nhập mã xác minh**, email bị che một phần, mã hiệu lực 5 phút |
| 6 | Nhập OTP 6 số, bấm **Xác minh và tạo tài khoản** | Sang `/register/result` |
| 7 | Xem kết quả | Chip **Tài khoản đã sẵn sàng**, bậc trình độ (1 trong 7 bậc), nhãn **Trình độ tạm thời**, radar **Hồ sơ 6 tiêu chí**, thẻ **Điểm mạnh** và **Cùng cải thiện**. Màn này không hiện điểm số |
| 8 | Bấm **Đăng nhập để bắt đầu**, đăng nhập | Vào trang chủ Player. Đăng ký không tự đăng nhập |

Điểm nên nói: trình độ chỉ lấy từ khảo sát một lần, là mức tạm thời. Sau này chỉ giải chuyên nghiệp mới làm trình độ lên hoặc xuống.

**Thử nhanh ở bước 6:** bấm **Gửi lại mã**. Phải chờ 60 giây, sau khi gửi lại thì mã cũ hết hiệu lực.

**Nếu không có OTP.** Chỉ làm được khi chạy backend với adapter email giả (để trống `RESEND_API_KEY` và `EMAIL_FROM` trong `backend/.env`, khởi động lại backend). Khi đó thư không rời máy, OTP nằm trong bảng `email_outbox`:

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select payload->>'otp' as otp, status, created_at from email_outbox
   where template='REGISTER_OTP' and to_email=lower('demo.player@example.com')
   order by id desc limit 1;"
```

Với Resend thật, hệ thống xóa OTP khỏi DB sau khi gửi nên không đọc lại được. Nếu bí, bỏ qua cảnh 1 và dùng `nam.nguyen@example.com`.

---

## 4. Cảnh 2 · Admin tạo tài khoản Court Owner (Admin)

**Cửa sổ A, đăng nhập `admin@smashpro.vn`.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Vào **Quản lý người dùng** (`/admin/users`) | Tiêu đề "Quản lý người dùng hệ thống", có nút **Thêm người dùng** |
| 2 | Bấm **Thêm người dùng**. Vai trò **Chủ sân (Owner)** (mặc định). Email `demo.owner@example.com`. Mật khẩu khởi tạo `Demo1234` (tối thiểu 6 ký tự). Tên Sân/CLB `Demo Arena`. Số điện thoại `0901112233`. Trạng thái **Hoạt động (ACTIVE)** | Hộp thoại "Thêm người dùng mới" |
| 3 | Bấm **+ Tạo người dùng** | Toast "Đã tạo tài khoản demo.owner@example.com thành công!" |

Điểm nên nói: Player tự đăng ký, Court Owner do Admin cấp, Admin không tạo được từ giao diện. Trong hộp thoại, Player không nằm trong danh sách vai trò.

---

## 5. Cảnh 3 · Court Owner gửi cơ sở, sân và bảng giá (Court Owner)

**Cửa sổ B, đăng nhập `demo.owner@example.com` / `Demo1234`.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Đăng nhập | Bị chuyển thẳng tới `/change-password`, không vào được trang nào khác (đổi mật khẩu bắt buộc) |
| 2 | Nhập mật khẩu hiện tại `Demo1234`, mật khẩu mới `Owner2026a` (8–64 ký tự, có cả chữ và số, khác email), nhập lại | Đổi thành công, hệ thống yêu cầu đăng nhập lại. Đổi bắt buộc không cần OTP |
| 3 | Đăng nhập lại bằng mật khẩu mới | Vào `/owner`: "Bảng điều khiển Chủ sân", báo "Bạn chưa có cơ sở" |
| 4 | Vào **Quản lý cơ sở** (`/owner/facilities`). Bấm **Thêm cơ sở** | Biểu mẫu "Gửi cơ sở mới để duyệt" |
| 5 | Điền: Tên cơ sở `Demo Arena Quận 3`, Điện thoại `0901112233`, Giờ mở cửa `06:00`, Giờ đóng cửa `22:00`, Địa chỉ `12 Nguyễn Thị Minh Khai`, Quận/huyện `Quận 3`, Tỉnh/thành phố `Hồ Chí Minh`. Bấm **Gửi cơ sở để duyệt** | Cơ sở có nhãn trạng thái **Chờ duyệt**, biểu mẫu bị khóa. Dòng chú thích: cơ sở và sân chỉ nhận đặt sau khi Admin duyệt và có giá |
| 6 | Tab **Sân** → **Thêm sân**. Tên sân `Sân 1`. Bấm **Gửi sân để duyệt** | Sân hiện trong bảng, cột "Trạng thái duyệt" là **Chờ duyệt** |

Bảng giá được cấu hình ở cảnh 4 sau khi Admin duyệt.

---

## 6. Cảnh 4 · Admin duyệt cơ sở và sân (Admin → Court Owner)

**Cửa sổ A.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Nhìn sidebar | Mục **Duyệt cơ sở & sân** có badge số hồ sơ chờ |
| 2 | Vào `/admin/approvals`. Gõ `Demo Arena` ở ô tìm | Thấy 2 hồ sơ: "Hồ sơ cơ sở" và "Hồ sơ sân", trạng thái **Chờ duyệt** |
| 3 | Bấm **Chi tiết** ở hồ sơ cơ sở | Hàng mở rộng, hiện các trường đã gửi |
| 4 | Gõ lý do vào ô "Lý do từ chối". Quan sát nút **Từ chối** | Nút Từ chối chỉ bật khi có lý do. Đây là quy tắc "từ chối phải kèm lý do". Xóa lý do đi, **không** từ chối |
| 5 | Bấm **Duyệt hồ sơ** ở cơ sở, rồi ở hồ sơ sân | Toast "Đã duyệt …". Badge sidebar giảm |

**Quay lại cửa sổ B (Owner):**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 6 | Làm mới `/owner/facilities` (**Làm mới cơ sở**) | Cơ sở và sân chuyển **Đang hoạt động** |
| 7 | Vào **Bảng giá sân** (`/owner/pricing`). Chọn `Sân 1`. Điền Giờ bắt đầu `06:00`, Giờ kết thúc `22:00`, Giá mỗi giờ `120000`, Ngày bắt đầu hiệu lực = hôm nay. Bấm **Lưu khung giá** | Dòng giá hiện trong bảng "Khung giá hiện có" |

Dự phòng cho nhánh từ chối: tạo thêm một sân `Sân 2` ở cảnh 3, Admin **Từ chối** kèm lý do, Owner thấy trạng thái **Bị từ chối** ở tab "Lịch sử duyệt" và nút **Gửi lại sân**.

---

## 7. Cảnh 5 · Ví sàn (Player, Admin)

**Cửa sổ C (Player `demo.player@example.com`).**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Menu tài khoản → **Ví của tôi** (`/wallet`) | Trang "Ví của tôi", số dư 0đ, các tab **Nạp tiền**, lịch sử, **Rút tiền**, **Tài khoản nhận** |
| 2 | Nhập số tiền, bấm **Tạo mã nạp tiền** | Hiện mã VietQR, ngân hàng, nội dung chuyển khoản riêng. Không chuyển tiền thật, chỉ để cho thấy cơ chế |
| 3 | Mở `/courts`, tìm sân `Demo Arena`, vào sân, chọn ngày mai, giờ `08:00`, thời lượng 1 giờ, **Tiếp tục đặt sân** → **Tiến hành thanh toán** → **Thanh toán ngay** | Báo **"Số dư ví không đủ. Vui lòng nạp thêm tiền vào ví rồi thử lại."** kèm link **Nạp tiền vào ví**. Booking vẫn chờ thanh toán, bộ đếm giữ sân chạy. Bấm **Hủy đơn đặt sân** để giải phóng slot |

**Cửa sổ A (Admin) cộng ví:**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 4 | Vào **Quản lý tài chính** → tab **Ví** (`/admin/finance/wallets`). Tìm `demo.player@example.com` ở ô "Tìm người dùng" | Hiện ví của người dùng |
| 5 | Bấm **Cộng ví**. Số tiền `500000`, Lý do `Demo nạp ví`. Xác nhận | Toast "Đã cộng ví." |

**Cửa sổ C:** tải lại `/wallet`. Số dư **500.000đ**, lịch sử có một giao dịch cộng ví.

---

## 8. Cảnh 6 · Booking, giám sát của Owner và hoàn tiền (Player, Court Owner)

Dùng sân `Demo Arena Quận 3 · Sân 1`, giá 120.000đ/giờ, ngày mai. Số dư Player bắt đầu từ 500.000đ.

### 8.1. Player đặt hai booking

**Cửa sổ C.** Lặp lại hai lần (booking A lúc `08:00`–`09:00`, booking B lúc `09:00`–`10:00`):

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | `/courts` → chọn sân → trang chi tiết sân | Khu "Khoảng sân trống" liệt kê khoảng còn trống, panel "Lựa chọn của bạn" hiện giờ kết thúc và giá tạm tính 120.000đ |
| 2 | **Tiếp tục đặt sân** → tích đồng ý quy định → **Tiến hành thanh toán (120.000đ)** | Sang trang "Hoàn tất đặt sân", badge **CHỜ THANH TOÁN**, đếm ngược giữ sân (mặc định 10 phút) |
| 3 | **Thanh toán ngay** | Chuyển tới chi tiết booking, trạng thái đã thanh toán. Ví giảm 120.000đ (500.000 → 380.000 → 260.000 sau hai booking) |

Kiểm tra chéo: ở cửa sổ D, Player khác chọn đúng khung giờ vừa đặt sẽ thấy khung đó không còn trống hoặc báo "Khung giờ vừa được người khác đặt".

### 8.2. Owner giám sát, khóa bảo trì và hủy do sự cố

**Cửa sổ B (Owner).**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | **Lịch đặt & Giám sát** (`/owner/schedule`), chọn ngày mai | Tab **Lưới sân** hiện hai booking. Owner không có bước duyệt booking, vì booking xác nhận tự động khi trả ví |
| 2 | Bấm **Khóa bảo trì**. Chọn sân, ngày mai, `12:00`–`13:00`, lý do `Bảo trì lưới`. Bấm **Khóa khoảng giờ** | Khung giờ chuyển **Khóa bảo trì**. Player không còn đặt được khung này |
| 3 | Mở booking A (**Xem booking**). Ở khối **Hủy booking do sự cố từ phía sân**, nhập lý do `Mất điện sân`, bấm **Xác nhận hủy booking** | Thông báo "Đã hủy…" kèm trạng thái hoàn tiền |
| 4 | Đợi tối đa khoảng 1 phút (worker chạy mỗi 60 giây) rồi làm mới | Hoàn tiền thành công |

**Cửa sổ C (Player):**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 5 | Chuông thông báo, rồi `/bookings` → booking A | Có thông báo hủy. Chi tiết booking có mục **Tiến trình hoàn tiền**: "Đã hủy booking" → "Đã hoàn tiền vào ví" |
| 6 | `/wallet` | Số dư tăng 120.000đ (260.000 → 380.000). Lịch sử có giao dịch **Hoàn tiền** |

**Tùy chọn, hủy phía Player:** ở booking B bấm **Yêu cầu hủy đặt sân**, nhập lý do, **Xác nhận hủy**. Booking đã thanh toán, hủy trước giờ chơi được hoàn 100% vào ví.

### 8.3. Doanh thu Court Owner

**Cửa sổ B:** vào **Ví & thu nhập** (`/owner/wallet`).

- **Số dư khả dụng** là doanh thu từ booking còn hiệu lực, tính theo chế độ tự động cộng ví (mặc định bật). Với kịch bản trên, giá trị mong đợi là 120.000đ (booking B), vì khoản của booking A bị thu hồi khi hủy. Nếu thấy 240.000đ, khoản thu hồi chưa chạy; đối chiếu với [`owner-wallet-earning-testing.md`](../guides/owner-wallet-earning-testing.md).
- Rút tiền (nâng cao, cuối §14) cần thiết lập mã PIN rút tiền qua OTP email, nên không nằm trong luồng chính.

---

## 9. Cảnh 7 · Matchmaking trọn vẹn với Split Bill (Player, Admin)

Dùng các Player có ví sẵn từ seed giải đấu. Kèo **Đôi** diễn ra **18:00 ngày mai** tại `Demo Arena Quận 3 · Sân 1`.

| Vai | Tài khoản | Cửa sổ |
| --- | --- | --- |
| Chủ kèo | `tournament.p03@example.com` (Trung bình khá) | C |
| Xin tham gia | `tournament.p04@example.com` (Trung bình) | D |
| Xin tham gia, thiếu ví | `tournament.broke@example.com` (Mới chơi, ví 0đ) | D (đăng xuất rồi đăng nhập) |
| Được mời | `tournament.p02@example.com` (Khá) | D |

### 9.1. Chủ kèo đăng kèo

**Cửa sổ C, p03.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Vào **Tìm đối thủ** (`/matchmaking`) → **Đăng kèo** | Hộp thoại "Tạo bài tìm kèo" |
| 2 | Chọn **Đôi · Tổng 4**. Ngày chơi = ngày mai, Giờ bắt đầu `18:00`. Từ trình độ **Trung bình**, Đến trình độ **Khá**. Ghi chú chi phí `Chia đều tiền sân`. **Không** tích "Khai báo sân chơi". Bấm **Đăng lên bảng tin** | Sang `/posts/:id` của kèo. Bản xem trước ghi "Chưa có sân" |
| 3 | Mở `/feed` | **Kèo không xuất hiện** ở bảng tin Social (Social chỉ có bài tự do) |

Quy tắc kiểm tra thêm: giờ bắt đầu phải cách hiện tại ít nhất 60 phút, mỗi người tối đa 3 kèo đang mở.

### 9.2. Apply và duyệt

**Cửa sổ D, p04.** Mở `/matchmaking`, lọc theo "Quận / huyện" hoặc để mặc định "Chỉ kèo còn chỗ" rồi bấm **Xem kèo** ở kèo vừa đăng.

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Ở panel **Tham gia kèo** bấm **Xin tham gia** | Thông báo "Đã gửi yêu cầu. Bạn chưa giữ chỗ cho đến khi chủ kèo duyệt." Hàng yêu cầu hiện **Chờ duyệt** và nút **Hủy yêu cầu tham gia** |

**Cửa sổ C, p03.** Từ `/matchmaking/activity` → "Kèo đã tạo" → **Quản lý kèo** (`/matchmaking/requests/:id`).

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 2 | Tab **Yêu cầu tham gia** → **Duyệt yêu cầu** → **Xác nhận** | Toast "Đã duyệt người chơi." Tab **Đã xác nhận · 2**. Duyệt chỉ giữ chỗ |
| 3 | Làm lại bước 1 và 2 với `tournament.broke` (đăng nhập ở cửa sổ D) | Vì trình độ Mới chơi ngoài khoảng, host thấy cảnh báo "Ngoài khoảng trình độ…" và nút đổi thành **Vẫn duyệt**. Trình độ lệch không chặn Apply |

### 9.3. Invite hai chiều

**Cửa sổ C, p03.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Bấm **Mời người chơi** | Ngăn bên phải "Mời người chơi" |
| 2 | Tìm `Hải Đăng` (tên p02), bấm **Gửi lời mời** | Nút đổi **Đã gửi lời mời**. Tab **Lời mời đã gửi** có một dòng với nút **Hủy lời mời** |

**Cửa sổ D, p02.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 3 | Vào `/matchmaking/activity` → "Kèo tham gia" → mục lời mời | Thẻ lời mời có đếm ngược, nút **Chấp nhận** và **Từ chối** |
| 4 | Bấm **Chấp nhận** | Lời mời được chấp nhận, kèo đủ 4/4. Chủ kèo thấy "Đã đủ người chơi, đang chờ chủ kèo chốt danh sách." Kèo **không tự chốt** |

### 9.4. Chốt kèo và nhóm chat

**Cửa sổ C, p03.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Bấm **Chốt kèo** → **Xác nhận** | Trạng thái **Đã chốt kèo**. Xuất hiện **Xem trận đấu** |
| 2 | Bấm **Tạo nhóm chat** | Mở `/messages/:id` với nhóm `Nhóm kèo #<mã>` gồm chủ kèo và 3 thành viên |
| 3 | Bấm **Xem trận đấu** | Trận ở trạng thái **Chờ đặt sân** (`PENDING_COURT`), có đếm ngược "Hạn đặt sân" bằng giờ bắt đầu kèo |

Điều kiện chốt: Đơn cần 2 người, Đôi cần 4. Giao lưu (GROUP) cần đạt mức tối thiểu và có ít nhất một thành viên có tài khoản ngoài chủ kèo. Chưa đủ thì nút **Chốt kèo** bị khóa kèm lý do.

### 9.5. Đặt sân Split Bill: thiếu ví rồi đủ ví

**Cửa sổ C, p03**, trang trận.

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | **Tiến hành đặt sân** | Trang "Đặt sân cho trận #…", ngày/giờ/thời lượng **cố định** theo kèo, không sửa được |
| 2 | Lọc **Quận / huyện** `Quận 3`, tìm `Demo Arena Quận 3`. Bấm **Chọn sân này** | Hộp thoại **ĐẶT SÂN & CHIA TIỀN** |
| 3 | Đọc preview | **Tổng tiền**, **Mỗi người**, danh sách 4 thành viên. Với giá 120.000đ/giờ và thời lượng mặc định 90 phút, tổng là 180.000đ và mỗi người 45.000đ (tính theo số thực tế trong hộp thoại) |
| 4 | Quan sát phần thiếu ví | `tournament.broke` bị đánh dấu **Thiếu 45.000đ**. Cảnh báo "Chưa thể đặt sân — 1 thành viên chưa đủ số dư ví". Nút **Xác nhận đặt sân** bị khóa. Có **Nhắc nạp ví** và **Nhắc tất cả nạp ví** |
| 5 | Bấm **Nhắc nạp ví** ở dòng `broke`, bấm lại lần nữa | Lần 1 toast đã gửi nhắc. Lần 2 báo đã nhắc trong hôm nay (chống spam) |

Kiểm tra chéo ở cửa sổ D (`broke`): chuông có thông báo "Cần nạp thêm tiền để chia sân kèo". Ví của 3 người còn lại **không đổi**: không ai bị trừ khi có người thiếu.

**Cửa sổ A (Admin)** cộng ví cho `tournament.broke@example.com`: 100.000đ, lý do `Demo nạp ví` (như cảnh 5).

**Cửa sổ C:**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 6 | Bấm **Kiểm tra lại** | `broke` chuyển **Đủ số dư**, nút xác nhận bật |
| 7 | Bấm **Xác nhận đặt sân** | Trận chuyển **Đã xác nhận**. Mục **Chi phí & booking** ghi chia đều, cả 4 dòng **Đã trả**. Host có link **Xem booking sân** |
| 8 | Kiểm tra ví từng người | Mỗi người bị trừ đúng phần chia (ví dụ p03: 1.000.000 → 955.000). Tất cả trong **một** giao dịch |

Chuông thông báo của các thành viên có "Đã chia tiền sân cho kèo".

### 9.6. Khóa quyền rút sau khi trả sân

**Cửa sổ D, p04**, trang trận (`/matchmaking/matches/:id`).

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Bấm **Rời trận** → **Xác nhận rời trận** | **Bị từ chối**: "Booking của kèo đã thanh toán thành công, không thể rút hoặc loại thành viên" |

Chủ kèo cũng không **Loại khỏi kèo** được thành viên nào sau khi đã trả sân. Quy tắc này bảo vệ chi phí sân của cả nhóm.

**Nếu cần demo nhanh hơn** (không dựng kèo mới), dùng dữ liệu `npm run db:seed:split` và làm theo [`09_matchmaking-split-booking.md`](09_matchmaking-split-booking.md) (kèo chia tiền, kèo thiếu ví, kèo liên kết booking đã trả).

---

## 10. Cảnh 8 · Rút kèo trước khi trả sân và bị gỡ khỏi nhóm chat (Player)

Dùng kèo giao lưu `Giao lưu cuối tuần · Quận 7` của `db:seed:social`. Chủ kèo `social.demo.ha`, thành viên đã xác nhận `social.demo.nam` và `social.demo.duc`, 5/8 chỗ, tối thiểu 4.

**Cửa sổ C, `social.demo.ha`:**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | `/matchmaking/activity` → "Kèo đã tạo" → **Quản lý kèo** của kèo giao lưu | Panel **Quản lý kèo**, nút **Chốt kèo sớm** (vì chưa đủ 8 chỗ) |
| 2 | **Chốt kèo sớm** → **Xác nhận**, rồi **Tạo nhóm chat** | Nhóm `Nhóm kèo #<mã>` gồm Hà, Nam, Đức. Người đi cùng không có tài khoản không vào nhóm |

**Cửa sổ D, `social.demo.nam`:**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 3 | `/messages` | Thấy nhóm `Nhóm kèo #<mã>`. Gửi một tin `Mình đến đúng giờ nhé` |
| 4 | Mở kèo (`/matchmaking/requests/:id`), bấm **Rút khỏi kèo** → **Xác nhận** | Rút được (booking chưa thanh toán, chưa đến giờ). Kèo giao lưu **mở tuyển lại**, trận được giữ |
| 5 | Quay lại `/messages` | Nam **không còn là thành viên** nhóm chat của kèo (bị gỡ tự động). Các nhóm chat tự tạo khác của Nam không bị ảnh hưởng |

**Cửa sổ C:** Hà mở lại nhóm chat. Tin cũ của Nam **vẫn còn**, danh sách thành viên không còn Nam, và Hà nhận thông báo kèo mở tuyển lại.

Giải thích thêm khi demo:

- Kèo Đơn hoặc Đôi đã chốt mà một người rút thì **trận bị hủy**; chỉ kèo Giao lưu giữ trận và mở tuyển lại.
- Đến giờ bắt đầu mà kèo chưa có sân thì hệ thống hủy kèo ("Kèo đã hủy vì chưa có sân khi đến giờ chơi"). Không thể chờ giờ thật trong buổi demo, nên chỉ trình bày bằng lời.

---

## 11. Cảnh 9 · Messaging (Player)

Dùng hai cửa sổ để thấy realtime: C là p03, D là p04, cùng trong nhóm `Nhóm kèo #<mã>` của cảnh 7.

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Cả hai mở `/messages`. Cửa sổ C gõ chữ trong ô **Nội dung tin nhắn** (chưa gửi) | Cửa sổ D hiện "… đang nhập tin nhắn..." |
| 2 | C bấm **Gửi** | D nhận tin **không cần tải lại**. Nếu D đang ở trang khác, thẻ **Tin nhắn** trên thanh điều hướng hiện badge chưa đọc |
| 3 | C bấm **Đính kèm ảnh**, chọn 1–4 ảnh (JPEG/PNG/WebP ≤ 5MB), gửi | D thấy ảnh, bấm vào xem được ảnh lớn |
| 4 | C bấm **Đính kèm tệp**, chọn 1 file PDF/DOCX/XLSX/TXT ≤ 10MB, gửi | D thấy tệp có nút tải về |
| 5 | D rê chuột vào một tin, bấm **Bày tỏ cảm xúc**, chọn ❤️ | C thấy reaction ngay. Có 6 loại: Thích, Tim, Haha, Wow, Buồn, Phẫn nộ |
| 6 | D mở nhóm, đọc tin | Badge chưa đọc của D về 0 |
| 7 | Bấm **Trả lời tin nhắn**, **Chỉnh sửa**, **Thu hồi** ở menu **Tùy chọn tin nhắn** | Các thao tác áp dụng trên tin của chính mình |
| 8 | Chat 1-1: ở cửa sổ C bấm **Chat 1-1**, tìm `Phạm Thu Trang` hoặc mở hồ sơ người chơi qua tên và bấm **Nhắn tin** | Mở hội thoại 1-1. Chấm xanh/"Đang hoạt động" khi đối phương online |
| 9 | Chặn: trong hội thoại 1-1 bấm **Chặn người chơi này** | Hai bên không nhắn được cho nhau (chặn hai chiều) |
| 10 | Vào `/settings/blocks` (menu → **Danh sách chặn**), bấm **Bỏ chặn** | Nhắn lại bình thường |

Nhóm chat độc lập: **Tạo nhóm** → đặt tên, chọn thành viên. Khác với nhóm của kèo, nhóm này không bị ảnh hưởng khi ai đó rút kèo.

---

## 12. Cảnh 10 · Social, báo cáo vi phạm và kiểm duyệt (Player, Admin)

### 12.1. Social

**Cửa sổ C, `social.demo.nam`; cửa sổ D, `social.demo.an`.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | C: `/feed`, bấm ô "Nam muốn chia sẻ điều gì hôm nay?" | Hộp thoại **Tạo bài viết** |
| 2 | Nhập nội dung, **Ảnh** thêm 1 ảnh (tối đa 4), bấm **Đăng** | Bài hiện đầu bảng tin. Thử **Bài viết có nền** cho bài chỉ có chữ |
| 3 | D: `/feed`, thả reaction, đổi sang loại khác, rồi gỡ. Bấm **Bình luận**, nhập vào **Viết bình luận**, **Gửi bình luận** | Reaction đổi/gỡ được. Bình luận hiện dưới bài, bộ đếm `n/500` |
| 4 | C: menu **Thao tác bài viết** → **Chỉnh sửa bài viết** → **Lưu thay đổi** | Nội dung cập nhật |
| 5 | D: mở menu **Thao tác bài viết** của bài do Nam đăng | Chỉ có **Báo cáo bài viết**, **không có** Chỉnh sửa/Xóa (không sửa được bài người khác) |
| 6 | D bấm tên một người chơi | Hộp thoại **Hồ sơ người chơi** (không có trang hồ sơ công khai) kèm nút **Nhắn tin** |

### 12.2. Báo cáo và Admin xử lý

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | D: ở bài của Nam bấm **Báo cáo bài viết**, chọn lý do `Spam/quảng cáo không phù hợp`, gửi | Màn "Đã gửi báo cáo" |
| 2 | A (Admin): **Quản lý báo cáo** (`/admin/reports`), lọc **Chờ xử lý**, mở báo cáo vừa gửi | Có **Bằng chứng tại thời điểm gửi**, người báo cáo, đối tượng |
| 3 | Bấm **Ẩn bài viết**, rồi **Đánh dấu đã xử lý** | Trạng thái **Đã xử lý**, badge sidebar giảm |
| 4 | C và D: làm mới `/feed` | Bài bị ẩn **không còn hiển thị công khai** |

Báo cáo **bình luận** có **Ẩn bình luận**. Báo cáo **tin nhắn** (menu tin nhắn → **Báo cáo tin nhắn**) chỉ cho Admin xem bằng chứng, không có thao tác ẩn theo phạm vi MVP.

---

## 13. Cảnh 11 · Giải đấu (Khách, Player, Organizer, Admin)

Dùng dữ liệu `db:seed:tournaments`. ID bên dưới đúng với DB trống; nếu khác, tìm theo tên `[DEMO] …` trong `/tournaments`.

### 13.1. Khách xem công khai

**Cửa sổ chưa đăng nhập.**

- `/tournaments`: danh sách, tìm theo tên, lọc trạng thái, lọc **Miễn phí**. Giải nháp "Bản nháp" **không** hiện.
- `/tournaments/9` (`Đã hoàn thành`): xem được người tham gia, nhánh đấu, lịch, vô địch. Không có nút đăng ký, hệ thống mời đăng nhập.
- `/tournaments/rankings`: bảng xếp hạng thành tích tab Đơn/Đôi.

### 13.2. Player đăng ký và thanh toán lệ phí bằng ví

| Tài khoản | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| `tournament.p05` | `/tournaments/3` (`Đơn mở — có lệ phí`) → **Đăng ký** | Hộp thoại ghi số dư ví, lệ phí 50.000đ, hạn hoàn tiền. Xác nhận: ví giảm 50.000đ, giao dịch `PAYMENT` trong `/wallet` |
| `tournament.p05` | **Rút đăng ký** | Hoàn 100% vào ví, giao dịch `REFUND` |
| `tournament.broke` | `/tournaments/3` → **Đăng ký** | Báo "Ví chưa đủ tiền" kèm nút **Nạp ví**, không tạo đăng ký |
| `tournament.p07` (Mới chơi) | `/tournaments/4` (`Đơn giới hạn trình độ`) | Bị chặn vì ngoài hạng 3–5, nút đăng ký khóa |
| `tournament.p02` | `/tournaments/mine?role=invited`, mở giải 11 (`Đôi — mở đăng ký`), **Chấp nhận** lời mời của p01 | Đội `Đôi Sấm Sét` đủ 2 người, mỗi người chỉ ở một đội |

### 13.3. Organizer vận hành giải

**Đăng nhập `tournament.organizer@example.com`**, mở `/tournaments/mine?role=organized`, chọn giải → **Quản lý**. Organizer không phải vai trò riêng: đây là quyền theo ngữ cảnh của Player với chính giải mình tạo.

| # | Giải | Thao tác | Kết quả cần thấy |
| --- | --- | --- | --- |
| 1 | 1 (nháp) | Sửa thông tin, bấm **Mở đăng ký** | Trạng thái chuyển `OPEN_FOR_REGISTRATION` |
| 2 | 6 (đã đóng đăng ký) | Xem gợi ý hạt giống, **Lưu hạt giống**, bấm **Bốc thăm & xếp lịch** | Có nhánh đấu, BYE cho hạt giống cao, lịch sân × giờ trên sân ảo. Giải sang `READY` |
| 3 | 8 (đang thi đấu) | Với trận `IN_PROGRESS` bấm **Nhập tỉ số**. Thử `21–20` | Báo lỗi (tỉ số không hợp lệ) |
| 4 | 8 | Nhập `21–19`, `22–20` (hoặc 3 set theo trận) | Lưu được, người thắng đi tiếp vòng sau |
| 5 | 8 | Đánh hết các trận, **Kết thúc giải** | Giải `COMPLETED`, có vô địch và điểm xếp hạng |
| 6 | 3 | Ở **Người tham gia**, **Loại** một người kèm lý do | Người đó được hoàn 50.000đ và nhận thông báo |

Mỗi trận 3 set × 21 điểm. Mở cùng một giải ở hai cửa sổ để thấy người xem cập nhật trong khoảng 1 giây (hoặc tối đa 30 giây nếu WebSocket tắt).

### 13.4. Thành tích, hồ sơ và Social

**Đăng nhập `tournament.p02`.**

| # | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | `/tournaments/9` → **Chia sẻ kết quả** | Bài `TOURNAMENT_RESULT` xuất hiện ở `/feed` |
| 2 | `/profile` | Mục **Giải đấu** có lịch sử và thứ hạng. Thẻ **Điểm phong độ** (hiển thị `Chỉ bạn nhìn thấy điểm này`), tiến độ lên bậc. Trình độ **lên hoặc xuống** theo kết quả giải chuyên nghiệp |
| 3 | Giải 9 → **Nhóm chat giải** | Có Organizer và người tham gia |

### 13.5. Admin

**Cửa sổ A.** `/admin/tournaments`:

- Thấy mọi trạng thái, kể cả nháp.
- Với giải 14 (`Admin huỷ và hoàn phí`) bấm **Huỷ giải**, nhập lý do (bắt buộc), xác nhận **Huỷ giải và hoàn tiền**. Hai người đăng ký nhận lại 50.000đ, Organizer nhận thông báo.
- **Tính lại phong độ** chạy lại toàn bộ lịch sử điểm phong độ.

---

## 14. Cảnh 12 · Admin tổng kết (Admin)

**Cửa sổ A.**

| # | Mục | Thao tác | Kết quả cần thấy |
| --- | --- | --- | --- |
| 1 | **Bảng điều khiển** (`/admin/dashboard`) | Đổi bộ lọc thời gian, bấm **Làm mới dữ liệu dashboard** | Thẻ KPI: Người chơi, Chờ phê duyệt, Đặt sân & doanh thu ước tính, Giải đấu, Cơ sở & sân, Báo cáo chưa xử lý. Có **Điều hướng nhanh** |
| 2 | **Quản lý người dùng** | Ở một Player, menu "…" → **Đổi trạng thái** → `SUSPENDED` → **Lưu thay đổi**. Thử đăng nhập tài khoản đó | Tài khoản bị khóa không đăng nhập được. Trả về `ACTIVE` sau khi demo. Không thể đình chỉ tài khoản Admin |
| 3 | **Quản lý tài chính** (`/admin/finance/overview`) | Duyệt các tab **Giao dịch**, **Ví**, **Thu nhập chủ sân**, **Hoàn tiền**, **Đối soát** | Thấy dòng tiền booking, hoàn tiền cảnh 6, khoản cộng ví cảnh 5 và 7. Bấm **Chạy đối soát** không báo lệch giả |
| 4 | **Cấu hình hệ thống** (`/admin/configs`) | Mở nhóm **Tài chính**, xem **Tự động cộng ví chủ sân**; hoặc nhóm booking, xem **Thời gian giữ sân chờ thanh toán** (10 phút) | Giá trị hiển thị kèm "Mặc định". Sửa giá trị rồi bấm **Lưu** có hiệu lực sau tối đa 60 giây (cache). **Hoàn tác** bỏ thay đổi chưa lưu |
| 5 | **Thông báo** (chuông, `/admin/notifications`) | Mở danh sách | Có thông báo vận hành (duyệt, tài chính) |
| 6 | **Duyệt tiêu chuẩn mặt sân** (`/admin/standards`) | Mở nếu Owner đã gửi tiêu chuẩn | Duyệt/Từ chối (từ chối bắt buộc lý do) |

Cấu hình **tắt tính năng** (ví dụ **Bật tìm kèo** hoặc **Bật giải đấu**) chặn thao tác tương ứng ngay trên giao diện Player. Nếu demo, nhớ **bật lại** ngay sau đó.

**Nâng cao, rút tiền của Owner.** `/owner/wallet` có **Tài khoản ngân hàng** và **Tạo yêu cầu rút tiền**, nhưng cần thiết lập **Mã PIN rút tiền** qua OTP email. Sau khi Owner gửi yêu cầu, Admin vào `/admin/finance/payouts` để **Duyệt**, rồi **Đã chi** kèm mã giao dịch. Chi tiết trong [`owner-wallet-earning-testing.md`](../guides/owner-wallet-earning-testing.md) §5.

---

## 15. Kiểm tra theo vai trò sau buổi demo

- [ ] **Khách:** xem landing, giải đấu công khai, bảng xếp hạng, không có nút thao tác.
- [ ] **Player:** đăng ký + khảo sát + OTP, ví, đặt sân, kèo, chat, Social, đăng ký giải, hồ sơ.
- [ ] **Organizer:** tạo/mở giải, bốc thăm, nhập tỉ số, kết thúc giải, chỉ trên giải của mình.
- [ ] **Court Owner:** đổi mật khẩu bắt buộc, gửi cơ sở/sân, bảng giá, giám sát lịch, khóa bảo trì, hủy do sự cố, ví doanh thu.
- [ ] **Admin:** tạo Owner, duyệt hồ sơ, cộng ví, xử lý báo cáo, hủy giải, dashboard, tài chính, cấu hình.
- [ ] **Xuyên suốt:** thông báo xuất hiện ở các bước hoàn tiền, nhắc nạp ví, chia tiền, duyệt hồ sơ, hủy giải.

---

## 16. Điểm cần xác nhận khi chạy thử

Các chi tiết dưới đây chưa kiểm chứng trên giao diện chạy thật:

1. Cơ sở và sân mới có đúng trạng thái **Chờ duyệt** ngay sau khi gửi không (UI cho thấy như vậy, chưa thấy mã backend đặt trạng thái đầu).
2. Owner có nhận thông báo sau khi Admin duyệt/từ chối hay không.
3. Khung giờ bảo trì `12:00`–`13:00` có hiển thị đúng ở tìm sân của Player.
4. Cách hiển thị nhóm chat với người đã bị gỡ (biến mất khỏi danh sách hay chỉ mất quyền gửi).
5. Thời lượng mặc định của kèo Đơn/Đôi (90 phút theo cấu hình) và tổng tiền Split Bill đúng như §9.5.
6. Giá trị cuối của ví Owner sau khi booking A bị hủy (§8.3).
7. Thông báo lỗi chính xác khi đăng nhập tài khoản `SUSPENDED`.
8. Nút đánh dấu "đã đọc tất cả" trong thông báo: chưa tìm thấy trong mã nguồn, không đưa vào kịch bản.

---

## 17. Reset và xử lý sự cố

### 17.1. Reset dữ liệu demo

`docker compose down -v` **xóa toàn bộ DB local**, kể cả tài khoản bạn tự tạo. Chỉ chạy khi chấp nhận mất dữ liệu.

```bash
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:seed:social
npm run db:seed:tournaments
npm run dev
```

### 17.2. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Không nhận được OTP | Resend chưa gửi tới hộp thư | Kiểm tra thư rác, bấm **Gửi lại mã** sau 60 giây, hoặc dùng adapter giả (§3) |
| Không thấy sân `Demo Arena` ở `/courts` | Cơ sở/sân chưa được duyệt hoặc chưa có giá | Làm lại cảnh 4, kiểm tra trạng thái **Đang hoạt động** và bảng giá |
| Chọn sân cho kèo báo "Không tìm thấy sân trống đúng khung giờ" | Sân chưa có giá hoặc không phủ khung 18:00–19:30 | Đặt khung giá `06:00`–`22:00`, đổi bộ lọc quận |
| Kèo mẫu của `db:seed:social` đã quá giờ | Seed từ nhiều ngày trước | Reset (§17.1) |
| Hoàn tiền chưa về ngay | Worker chạy mỗi 60 giây | Chờ khoảng 1 phút rồi tải lại |
| Đổi cấu hình chưa có tác dụng | Cache cấu hình 60 giây | Chờ 1 phút |
| `409 TOURNAMENT_DISABLED` | `TOURNAMENT_ENABLED` đang tắt | Bật lại ở `/admin/configs` |
| `409 WALLET_INSUFFICIENT_BALANCE` | Ví không đủ | Admin **Cộng ví**, hoặc dùng Player có ví 1.000.000đ |
| Backend không khởi động, Vite báo `ECONNREFUSED` | `PRIVATE_UPLOADS_DIR` trong `backend/.env` trỏ sai | Đặt đường dẫn tuyệt đối tới thư mục `private-uploads` hiện có |
