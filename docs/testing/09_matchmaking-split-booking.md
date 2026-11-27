# Hướng dẫn test thủ công — Đặt sân sau chốt kèo, chia tiền và liên kết booking

> **Lưu ý (2026-11-27):** lệnh `npm run db:seed:split` và các tài khoản riêng của nó đã bị gỡ khi gộp mọi seed thành một bộ seed demo (`npm run db:reset -- --yes`, xem [`docs/plans/demo-seed-plan.md`](../plans/demo-seed-plan.md)). Dữ liệu tương đương trong seed mới: tài khoản `chatok111111@gmail.com` làm chủ một kèo đôi đã đặt sân chia tiền 4 người (đã thanh toán). Chưa có kèo ở trạng thái "Chờ sân" và thành viên thiếu ví như bộ cũ. Các bước dưới đây mô tả bộ dữ liệu cũ và cần viết lại theo dữ liệu mới.


Tài liệu này hướng dẫn **thao tác trực tiếp trên giao diện** để kiểm tra luồng:

- Chủ kèo bấm **Tiến hành đặt sân** sau khi kèo đã đủ người và đã chốt.
- Ngày/giờ/thời lượng lấy cố định từ kèo.
- Tiền sân được chia đều và trừ ví tất cả thành viên trong một lần xác nhận.
- Thành viên thiếu ví được liệt kê cụ thể; chủ kèo có thể gửi nhắc nạp ví.
- Chủ kèo vẫn có thể **liên kết booking đã thanh toán** thay vì đặt sân mới.
- Hủy kèo sau chia tiền sẽ hủy booking và hoàn tiền từng người.

Tài liệu liên quan: [`docs/plans/06_booking-chu-san-matchmaking.md`](../plans/06_booking-chu-san-matchmaking.md).

---

## 1. Chuẩn bị môi trường

### 1.1. Khởi động DB + migration + seed

Từ thư mục gốc dự án:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:seed:split
npm run dev
```

Mở http://localhost:5173.

`npm run db:seed:split` tạo dữ liệu demo riêng cho bài test này, gồm:

- Cơ sở **Split Booking Demo Arena**, sân **Sân Demo 1**, giá **120.000đ/giờ**.
- 3 kèo đã chốt, đang **Chờ sân**:
  - Kèo A: chia tiền thành công (2 người đều đủ ví).
  - Kèo B: một thành viên thiếu ví.
  - Kèo C: đã có sẵn booking thanh toán để test liên kết.
- Ví ban đầu:
  - Host: **880.000đ** (đã trừ 120.000đ cho booking của kèo C).
  - Thành viên A: **500.000đ**.
  - Thành viên B: **0đ**.

> Script in ra URL cụ thể cho từng kèo. Dùng đúng URL/ID trong output lần seed gần nhất.
> Nếu đã qua ngày chơi của dữ liệu cũ, reset DB rồi seed lại (xem §6).

### 1.2. Tài khoản seed

Mật khẩu chung: `Password@123`

| Vai trò | Email | Dùng để |
| --- | --- | --- |
| Host | `split.demo.host@example.com` | Đặt sân, gửi nhắc nạp ví, liên kết booking, hủy kèo |
| Thành viên A | `split.demo.member.a@example.com` | Đủ ví, nhận chia tiền/hoàn tiền |
| Thành viên B | `split.demo.member.b@example.com` | Thiếu ví, nhận nhắc nạp ví |
| Chủ sân | `split.demo.owner@example.com` | Chỉ cần khi kiểm tra phía chủ sân (không bắt buộc) |

Nên dùng **2 cửa sổ ẩn danh** để đăng nhập host và thành viên song song.

### 1.3. Dữ liệu seed mẫu

Output của `db:seed:split` có dạng:

```json
{
  "matches": {
    "splitSuccess": { "matchId": 3, "requestId": 9, "startAt": "..." },
    "insufficientWallet": { "matchId": 4, "requestId": 10, "startAt": "..." },
    "linkExistingBooking": { "matchId": 5, "requestId": 11, "bookingId": 9, "startAt": "..." }
  },
  "urls": {
    "splitSuccess": "http://localhost:5173/matchmaking/matches/3",
    "insufficientWallet": "http://localhost:5173/matchmaking/matches/4",
    "linkExistingBooking": "http://localhost:5173/matchmaking/matches/5",
    "existingBooking": "http://localhost:5173/bookings/9"
  }
}
```

ID thực tế có thể khác; luôn dùng output mới nhất.

| Kèo | Trạng thái ban đầu | Mục đích test |
| --- | --- | --- |
| A — chia tiền | `PENDING_COURT`, 18:00–19:00, 60 phút | Đặt sân mới, trừ ví đều 2 người |
| B — thiếu ví | `PENDING_COURT`, 18:00–19:00, 60 phút | Danh sách thiếu ví + nhắc nạp ví |
| C — liên kết booking | `PENDING_COURT` + 1 booking `CONFIRMED` | Chọn booking đã thanh toán để liên kết |

---

## 2. Test 1 — Đặt sân sau chốt kèo và chia đều tiền

### 2.1. Mở kèo A

1. Đăng nhập host `split.demo.host@example.com`.
2. Mở URL `splitSuccess` trong output seed, ví dụ:
   `http://localhost:5173/matchmaking/matches/3`.
3. **Kỳ vọng:**
   - Trạng thái **Chờ sân** (`PENDING_COURT`).
   - Có nút **Tiến hành đặt sân**.
   - Có nút/link **Liên kết booking đã có** bên dưới.
   - Khung giờ hiển thị đúng ngày seed, 18:00–19:00.

### 2.2. Chọn sân

1. Bấm **Tiến hành đặt sân**.
2. **Kỳ vọng trang đặt sân:**
   - Tiêu đề **Đặt sân cho trận #…**.
   - Ngày/giờ/thời lượng hiển thị cố định, **không có ô chỉnh ngày/giờ/thời lượng**.
   - Tìm thấy **Split Booking Demo Arena · Sân Demo 1**.
3. Bấm **Chọn sân này**.

### 2.3. Kiểm tra preview chia tiền

**Kỳ vọng trong modal xác nhận:**

- Tổng tiền: **120.000đ**.
- Số người: **2**.
- Mỗi người: **60.000đ**.
- Danh sách:
  - Chủ kèo: đủ số dư.
  - Thành viên A: đủ số dư.
- Nút **Xác nhận đặt sân** đang bật.

### 2.4. Xác nhận đặt sân

1. Bấm **Xác nhận đặt sân**.
2. **Kỳ vọng:**
   - Quay lại trang chi tiết trận.
   - Trận chuyển **Đã xác nhận** (`CONFIRMED`).
   - Hiển thị đúng sân, địa chỉ, ngày/giờ.
   - Mục **Chi phí & booking**:
     - Tổng tiền sân **120.000đ**.
     - **Chia đều cho 2 người · khoảng 60.000đ/người**.
     - Cả hai dòng đều **Đã trả**.
   - Nút **Tiến hành đặt sân** biến mất.
   - Host có link **Xem booking sân**.

### 2.5. Kiểm tra ví và thông báo

1. Đăng nhập host → mở `/wallet`.
   - **Kỳ vọng:** số dư giảm **60.000đ** (từ 880.000đ còn 820.000đ nếu chưa thao tác gì khác).
   - Lịch sử có giao dịch thanh toán tiền sân kèo.
2. Đăng nhập thành viên A → mở `/wallet`.
   - **Kỳ vọng:** số dư giảm **60.000đ** (từ 500.000đ còn 440.000đ).
3. Kiểm tra chuông thông báo của cả hai:
   - Có thông báo **Đã chia tiền sân cho kèo** với số tiền 60.000đ.
   - Thành viên A cũng có thông báo kèo đã có sân.

### 2.6. Kiểm tra phía thành viên

1. Đăng nhập thành viên A, mở cùng URL trận.
2. **Kỳ vọng:**
   - Không có nút **Tiến hành đặt sân**.
   - Thấy trạng thái **Đã xác nhận** và phần chi phí chia đều.
   - Không thấy link booking (chỉ chủ kèo thấy).

---

## 3. Test 2 — Thiếu ví, danh sách cụ thể và nhắc nạp ví

### 3.1. Mở kèo B

1. Đăng nhập host.
2. Mở URL `insufficientWallet` trong output seed (ví dụ `/matchmaking/matches/4`).
3. Bấm **Tiến hành đặt sân** → chọn **Sân Demo 1**.

### 3.2. Kiểm tra cảnh báo thiếu ví

**Kỳ vọng:**

- Modal hiển thị cảnh báo:
  **“Chưa thể đặt sân — 1 thành viên chưa đủ số dư ví”**.
- Danh sách ghi rõ:
  - **Thành viên B: cần nạp thêm 60.000đ**.
- Nút **Xác nhận đặt sân** bị khóa.
- Có nút **Nhắc nạp ví** cạnh thành viên B và nút **Nhắc tất cả nạp ví**.
- Nếu host tự thiếu ví, cạnh tên host có link **Nạp ví ngay**.

### 3.3. Gửi nhắc nạp ví

1. Bấm **Nhắc nạp ví** ở dòng thành viên B.
2. **Kỳ vọng:** toast **Đã gửi nhắc nạp ví cho 1 thành viên**.
3. Bấm lại ngay.
   - **Kỳ vọng:** báo **Các thành viên này đã được nhắc nạp ví hôm nay** (chống spam trong ngày).
4. Đăng nhập thành viên B → mở chuông thông báo.
   - **Kỳ vọng:** có thông báo **Cần nạp thêm tiền để chia sân kèo**, nội dung ghi 60.000đ.

### 3.4. Tuỳ chọn — nạp ví rồi đặt lại

1. Thành viên B vào `/wallet`, nạp ít nhất **60.000đ** (dev dùng Mock, bấm xác nhận thanh toán thử).
2. Host quay lại modal kèo B → bấm **Kiểm tra lại**.
   - **Kỳ vọng:** thành viên B chuyển **Đủ số dư**, nút xác nhận bật.
3. Bấm **Xác nhận đặt sân**.
   - **Kỳ vọng:** trận B chuyển **Đã xác nhận**, ví host và thành viên B mỗi người bị trừ 60.000đ.

> Nếu chỉ muốn test cảnh báo, bỏ qua bước 3.4. Kèo B vẫn ở **Chờ sân**, không ai bị trừ tiền.

---

## 4. Test 3 — Liên kết booking đã thanh toán

Kèo C đã có sẵn một booking `CONFIRMED` đúng khung giờ, do host sở hữu.

1. Đăng nhập host.
2. Mở URL `linkExistingBooking` (ví dụ `/matchmaking/matches/5`).
3. **Kỳ vọng:**
   - Trạng thái **Chờ sân**.
   - Có nút **Tiến hành đặt sân** và mục **Chọn booking đã thanh toán**.
4. Trong danh sách booking:
   - Booking đúng ngày/giờ/thời lượng có nút **Liên kết** bật.
   - Booking sai khung giờ (nếu có) bị khóa kèm lý do.
5. Bấm **Liên kết** ở booking đúng.
6. **Kỳ vọng:**
   - Trận chuyển **Đã xác nhận**.
   - Hiển thị sân, giờ, tổng tiền **120.000đ**.
   - Mục chi phí ghi **Người đặt sân** là host.
   - Vì đây là booking liên kết thủ công, hệ thống **không tạo share mới**; ghi chú vẫn là chủ kèo thanh toán booking.
   - Thành viên A nhận thông báo kèo đã có sân.
7. Bấm lại cùng booking (nếu UI còn hiển thị): không tạo hiệu lực thứ hai.

### 4.1. Trường hợp sai cần kiểm tra

- Đăng nhập thành viên A, mở kèo C trước khi liên kết:
  - **Kỳ vọng:** không thấy mục chọn booking.
- Booking chưa thanh toán: không xuất hiện hoặc bị khóa với lý do **chưa thanh toán**.
- Booking sai ngày/giờ/thời lượng: bị khóa với lý do **không đúng khung giờ kèo**.

---

## 5. Test 4 — Hủy kèo sau chia tiền và hoàn tiền

Thực hiện sau **Test 1** để kèo A đã được chia tiền.

1. Đăng nhập host.
2. Mở trang chi tiết yêu cầu của kèo A. Dùng `requestId` trong output seed:
   `http://localhost:5173/matchmaking/requests/<requestId>`.
3. Bấm **Hủy kèo**.
4. **Kỳ vọng hộp thoại:** nêu rõ nếu kèo đã chia tiền, booking sẽ bị hủy và hoàn tiền cho tất cả thành viên.
5. Bấm **Xác nhận**.
6. **Kỳ vọng ngay:**
   - Yêu cầu/kèo chuyển **Đã hủy**.
   - Trận chuyển **Đã hủy**.
   - Thành viên nhận thông báo kèo bị hủy.
7. Chờ tối đa khoảng **1 phút** (worker/scheduler chạy mỗi 60 giây), sau đó:
   - Mở lại chi tiết trận A.
   - Booking của kèo bị **Đã hủy**.
   - Phần chi phí hiển thị từng người **Đã hoàn**.
   - Ví host được hoàn **60.000đ**; ví thành viên A được hoàn **60.000đ**.
   - Có thông báo **Hoàn tiền booking thành công** cho cả hai.
8. Tải lại thêm vài lần:
   - Không có khoản hoàn tiền thứ hai.
   - Không có thông báo trùng.

> Nếu chỉ muốn test đặt sân/liên kết, bỏ qua mục 5.

---

## 6. Reset dữ liệu demo

Nếu dữ liệu demo đã cũ (ngày chơi đã qua) hoặc muốn chạy lại từ đầu:

```bash
cd /home/nhathuy/Code/badminton-platform
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:seed:split
npm run dev
```

> `docker compose down -v` **xóa toàn bộ DB dev**. Chỉ dùng khi chấp nhận mất dữ liệu local.

Sau reset, dùng URL/ID mới trong output `db:seed:split`.

---

## 7. Checklist kết quả mong đợi

- [ ] Kèo đã chốt hiển thị nút **Tiến hành đặt sân** cho host.
- [ ] Trang đặt sân khóa ngày/giờ/thời lượng theo kèo.
- [ ] Preview hiển thị tổng tiền, số người, số tiền mỗi người.
- [ ] Tất cả đủ ví → trừ đúng share từng người, trận `CONFIRMED`.
- [ ] Match Detail hiển thị chi phí chia đều và trạng thái từng người.
- [ ] Một người thiếu ví → không đặt được, không ai bị trừ tiền.
- [ ] Danh sách thiếu ví có tên + số tiền cần nạp thêm.
- [ ] Gửi nhắc nạp ví thành công, không spam trong ngày.
- [ ] Liên kết booking đã thanh toán vẫn hoạt động.
- [ ] Hủy kèo sau chia tiền → booking bị hủy, hoàn đúng share từng người, không hoàn hai lần.

---

## 8. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Không thấy sân Demo | Chưa chạy `db:seed:split` | Chạy lại `npm run db:seed:split` |
| Ngày chơi đã qua | Seed được tạo từ nhiều ngày trước | Reset DB và seed lại (§6) |
| Kèo B không còn thiếu ví | Thành viên B đã được nạp tiền thủ công | Reset DB hoặc dùng tài khoản demo mới sau reset |
| Không thấy nút đặt sân | Không phải host, kèo đã có sân, hoặc quá giờ | Kiểm tra đăng nhập/trạng thái kèo |
| Liên kết báo sai khung giờ | Booking không đúng ngày/giờ/thời lượng kèo | Dùng booking seed của kèo C đúng URL output |
| Hoàn tiền chưa về ngay | Worker chạy mỗi 60 giây | Chờ ~1 phút rồi tải lại |
