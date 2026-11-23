# Hướng dẫn test thủ công — Booking, Chủ sân và Matchmaking (Plan 06)

Tài liệu này hướng dẫn **thao tác trực tiếp trên giao diện** để kiểm tra các phần
đã làm trong [`docs/plans/06_booking-chu-san-matchmaking.md`](../plans/06_booking-chu-san-matchmaking.md):
đặt sân + thanh toán ví, hủy/hoàn tiền, thông báo, Owner hủy booking, liên kết
booking vào kèo và hủy kèo/booking.

> **UI-REDO:** B5 (thanh toán), B7 (Owner hủy), B11 (booking picker) mới có base
> UI. Sau khi merge frontend cần kiểm tra lại giao diện; backend/API đã hoàn tất.

---

## 1. Chuẩn bị môi trường

### 1.1 Cấu hình để test được cả nạp ví và trả bằng ví

Mở `backend/.env` và đặt:

```env
PAYMENT_PROVIDER=WALLET
SEPAY_BANK_ACCOUNT=
SEPAY_BANK_CODE=
REFUND_ENABLED=true
```

- `PAYMENT_PROVIDER=WALLET`: booking được trả bằng số dư ví.
- `SEPAY_BANK_ACCOUNT`/`SEPAY_BANK_CODE` để trống: nút nạp ví trong UI dùng
  **Mock** (chỉ dev/test), nên bấm được “xác nhận thanh toán thử” mà không cần
  ngân hàng sandbox.
- `REFUND_ENABLED=true`: worker hoàn tiền hoạt động.

Khởi động lại backend sau khi sửa `.env`.

### 1.2 Khởi động DB + seed + ứng dụng

```bash
cd /home/nhathuy/Code/badminton-platform
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Mở http://localhost:5173.

`db:seed` tạo sẵn cơ sở ACTIVE, sân và bảng giá (06:00–17:00 / 17:00–22:00),
nên không cần tạo cơ sở/duyệt Admin cho luồng booking cơ bản.

### 1.3 Tài khoản seed

Mật khẩu chung: `Password@123`

| Vai trò | Email |
| --- | --- |
| Admin | `admin@smashpro.vn` |
| Owner | `quocbao.tran@phucthinhbadminton.vn` |
| Owner | `bach.hoang@badmintonpro.vn` |
| Owner | `khanh.le@hoangthanhcourt.vn` |
| Player | `nam.nguyen@example.com` |
| Player | `tuan.do@example.com` |
| Player | `huong.mai@example.com` |
| Player | `duc.tran@example.com` |

> Dùng 2 Player khác nhau cho luồng kèo (ví dụ `nam.nguyen@example.com` là host,
> `tuan.do@example.com` là member). Có thể mở 2 cửa sổ ẩn danh để đăng nhập song song.

---

## 2. Test 1 — Player đặt sân và thanh toán bằng ví

### 2.1 Nạp ví

1. Đăng nhập Player `nam.nguyen@example.com`.
2. Vào **Ví** (`/wallet`).
3. Nhập số tiền, ví dụ `300000`.
4. Bấm tạo nạp ví.
5. Vì môi trường dev dùng Mock, bấm nút xác nhận thanh toán thử.
6. **Kỳ vọng:** số dư ví tăng đúng số tiền; lịch sử có giao dịch nạp ví.

### 2.2 Đặt sân

1. Vào **Sân cầu lông** (`/courts`).
2. Chọn một cơ sở seed (ví dụ CLB Cầu Lông Phúc Thịnh Quận 7).
3. Chọn ngày trong 1–6 ngày tới.
4. Chọn khung giờ còn trống (ví dụ 18:00, 60 phút).
5. Bấm **Tiếp tục đặt sân**.
6. Kiểm tra thông tin sân/ngày/giờ/giá, tick xác nhận điều khoản.
7. Bấm tạo giữ chỗ.

### 2.3 Thanh toán

1. Ở trang **Chờ thanh toán**, kiểm tra countdown lấy từ server.
2. Bấm **Thanh toán ngay**.
3. **Kỳ vọng:**
   - Chuyển về trang chi tiết booking với trạng thái **Đã xác nhận**.
   - Ví bị trừ đúng tổng tiền.
   - Mục thanh toán ghi đã thanh toán.
   - Chuông thông báo có `BOOKING_CONFIRMED`.
4. Vào `/bookings` thấy booking đã xác nhận.
5. Nếu bấm thanh toán lại (khi UI còn cho phép), ví **không** bị trừ lần hai.

### 2.4 Trường hợp ví không đủ

1. Đăng nhập một Player chưa nạp ví (hoặc nạp ít).
2. Tạo một booking mới và bấm thanh toán.
3. **Kỳ vọng:** báo **Số dư ví không đủ**, có link **Nạp tiền vào ví**, booking vẫn
   ở trạng thái **Chờ thanh toán**.

---

## 3. Test 2 — Player hủy và hoàn tiền

### 3.1 Hủy booking đã thanh toán

1. Mở booking vừa thanh toán ở `/bookings/:id`.
2. Bấm **Yêu cầu hủy đặt sân**.
3. Xác nhận hủy.
4. **Kỳ vọng ngay:**
   - Booking chuyển **Đã hủy**.
   - Trạng thái hoàn tiền là **Đang hoàn tiền** (chưa phải Đã hoàn tiền).
   - Có thông báo `BOOKING_CANCELLED`.
5. Chờ tối đa khoảng 1 phút (worker chạy mỗi 60 giây trong dev), bấm tải lại trang.
6. **Kỳ vọng sau worker:**
   - Ví được cộng lại đúng số tiền.
   - Trạng thái hoàn tiền **Đã hoàn tiền**.
   - Có thông báo `BOOKING_REFUNDED`.
7. Tải lại thêm vài lần: số dư không tăng thêm, không có thông báo trùng.

### 3.2 Hủy booking chưa thanh toán

1. Tạo một booking mới nhưng **không** thanh toán.
2. Ở trang chờ thanh toán, bấm **Hủy đơn đặt sân** → xác nhận.
3. **Kỳ vọng:**
   - Booking **Đã hủy**.
   - Hoàn tiền **Không có hoàn tiền**.
   - Ví không thay đổi; không có thông báo hoàn tiền.

---

## 4. Test 3 — Owner hủy booking

1. Đăng nhập Owner `quocbao.tran@phucthinhbadminton.vn`.
2. Vào **Lịch đặt & Giám sát** (`/owner/schedule`).
3. Chọn đúng cơ sở và ngày có booking Player vừa tạo.
4. Bấm mã booking trong bảng lịch sử/schedule để mở panel chi tiết.
5. Thử bấm **Xác nhận hủy booking** khi chưa nhập lý do → nút phải bị disable.
6. Nhập **Lý do hủy**, ví dụ “Sân gặp sự cố điện”.
7. Bấm **Xác nhận hủy booking**.
8. **Kỳ vọng:**
   - Booking **Đã hủy**, lưu lý do.
   - Booking đã thanh toán: hoàn tiền **Đang hoàn tiền**; sau ~1 phút thành **Đã hoàn tiền**.
   - Booking chưa thanh toán: hoàn tiền **Không có hoàn tiền**.
   - Player nhận thông báo hủy.
   - Bấm hủy lại cùng booking: không tạo hoàn tiền/thông báo thứ hai.

### 4.1 Trường hợp bị chặn

- Booking đã bắt đầu: mở panel sẽ thấy thông báo không thể hủy.
- Booking của giải đấu: panel hiển thị “Chủ sân không thể hủy trực tiếp”. Muốn tạo
  booking giải đấu cần module Tournament (chưa có UI), trường hợp này được kiểm
  tra tự động ở backend.
- Owner khác không thấy booking của cơ sở không thuộc quyền.

---

## 5. Test 4 — Liên kết booking vào kèo

Cần 2 Player: **host** và **member**.

### 5.1 Tạo kèo PENDING_COURT

1. Đăng nhập host (`nam.nguyen@example.com`).
2. Vào **Ghép trận** (`/matchmaking`).
3. Bấm **+ Tạo yêu cầu**.
4. Chọn loại kèo (ví dụ Đấu đơn), ngày +2 ngày, giờ bắt đầu (ví dụ 18:00),
   khung giờ kết thúc đủ dài, khu vực, trình độ.
5. Tạo yêu cầu.
6. Mở chi tiết yêu cầu → mời member `tuan.do@example.com` từ danh sách gợi ý.
7. Đăng nhập member ở cửa sổ ẩn danh thứ hai → **Lời mời** (`/matchmaking/invitations`)
   → **Chấp nhận**.
8. Quay lại host, mở chi tiết yêu cầu → bấm **Chốt kèo**.
9. **Kỳ vọng:** trận được tạo ở trạng thái **Chờ sân** (`PENDING_COURT`).

> Thời lượng kèo lấy theo cấu hình, mặc định **90 phút**. Hãy ghi lại đúng ngày,
> giờ bắt đầu và thời lượng hiển thị trên kèo để đặt sân cho khớp.

### 5.2 Đặt và thanh toán booking đúng khung giờ

1. Vẫn là host, vào `/courts`.
2. Đặt sân **đúng ngày, đúng giờ bắt đầu, đúng thời lượng** của kèo.
   Ví dụ kèo 18:00–19:30 thì booking phải 18:00, 90 phút.
3. Thanh toán bằng ví đến trạng thái **Đã xác nhận**.

### 5.3 Liên kết

1. Host mở **Các trận của tôi** (`/matchmaking/matches`) → mở trận vừa tạo.
2. Trong mục **Chọn booking đã thanh toán**:
   - Booking đúng khung giờ: nút **Liên kết** bật.
   - Booking sai giờ/thời lượng: bị disable kèm lý do.
   - Booking đã gắn trận khác: bị disable kèm lý do.
3. Bấm **Liên kết**.
4. **Kỳ vọng:**
   - Trận chuyển **Đã xác nhận**.
   - Hiển thị sân, giờ, giá, người thanh toán.
   - Member nhận thông báo kèo đã có sân.
   - Bấm lại cùng booking: vẫn 200, không tạo hiệu lực thứ hai.

### 5.4 Trường hợp sai

- Booking chưa thanh toán: không xuất hiện trong danh sách (chỉ booking đã
  `CONFIRMED` mới được chọn).
- Booking sai ngày/giờ/thời lượng: hiện nhưng bị disable kèm lý do.
- Member (không phải host) mở trận: không thấy mục chọn booking.
- Booking đã gắn trận khác: bị disable kèm lý do.

---

## 6. Test 5 — Hủy kèo làm hủy booking/hoàn tiền

### 6.1 Member rời trận đã xác nhận

1. Sau khi liên kết booking thành công, đăng nhập **member**.
2. Mở trận đã xác nhận → bấm **Rời trận** → xác nhận.
3. **Kỳ vọng ngay:**
   - Trận **Đã hủy**.
   - Booking liên kết chuyển **Đã hủy**.
   - Có yêu cầu hủy booking được ghi nhận (job xử lý nền).
4. Chờ tối đa khoảng 1–2 phút (worker matchmaking + refund chạy mỗi 60 giây),
   mở lại booking/Player để kiểm tra.
5. **Kỳ vọng sau worker:**
   - Booking **Đã hủy**, hoàn tiền **Đã hoàn tiền**.
   - Ví Player được cộng lại.
   - Không có trận **Đã xác nhận** nào trỏ booking đã hủy.
   - Không có hoàn tiền/thông báo thứ hai.

### 6.2 Hủy booking trước, kèo tự hủy

1. Làm lại luồng liên kết booking vào kèo.
2. Hủy booking (Player hoặc Owner).
3. **Kỳ vọng:** trận liên kết chuyển **Đã hủy** ngay; member nhận thông báo
   booking của kèo đã hủy.

> Giao diện hủy kèo hiện gửi lựa chọn **giữ booking** (KEEP). Nhánh hủy booking
> kèm theo (CANCEL) được kiểm tra tự động ở backend; với thao tác UI, dùng cách
> member rời trận đã xác nhận ở mục 6.1 để thấy booking bị hủy + hoàn tiền.

---

## 7. Test 6 — Thông báo

1. Đăng nhập Player vừa thực hiện giao dịch.
2. Bấm chuông thông báo hoặc vào `/notifications`.

**Kỳ vọng các loại thông báo:**

| Sự kiện trên UI | Thông báo |
| --- | --- |
| Thanh toán booking thành công | Booking đã được xác nhận |
| Hủy booking | Lịch đặt sân đã bị hủy |
| Hoàn tiền xong | Hoàn tiền booking thành công |
| Kèo được gắn sân | Kèo đã có sân |
| Booking của kèo bị hủy | Lịch đặt sân của kèo đã bị hủy |

- Bấm vào thông báo booking phải mở đúng chi tiết booking của chính mình.
- Bấm vào thông báo kèo phải mở đúng chi tiết trận mà mình tham gia.
- Mỗi sự kiện chỉ có **một** thông báo; refresh nhiều lần không nhân đôi.

---

## 8. Checklist thao tác nhanh

- [ ] Nạp ví thành công, số dư tăng đúng.
- [ ] Đặt sân → chờ thanh toán → thanh toán ví → **Đã xác nhận**.
- [ ] Thanh toán lặp không trừ ví lần hai.
- [ ] Ví thiếu → báo đúng, có nút nạp ví.
- [ ] Hủy booking chưa thanh toán → không hoàn tiền.
- [ ] Hủy booking đã thanh toán → Đang hoàn tiền → Đã hoàn tiền, ví cộng đúng một lần.
- [ ] Owner hủy: bắt buộc lý do, hiển thị đúng trạng thái hoàn tiền.
- [ ] Owner không hủy được booking đã bắt đầu/giải đấu.
- [ ] Tạo kèo → mời → member chấp nhận → chốt kèo → **Chờ sân**.
- [ ] Booking đúng khung giờ → liên kết → trận **Đã xác nhận**.
- [ ] Booking sai khung giờ/đã liên kết → bị disable kèm lý do.
- [ ] Member rời trận → trận + booking hủy → hoàn tiền sau worker.
- [ ] Thông báo đúng người, đúng loại, không nhân đôi.
- [ ] Không còn trận **Đã xác nhận** trỏ booking **Đã hủy**.

---

## 9. Lỗi thường gặp trên UI

| Hiện tượng | Cách xử lý |
| --- | --- |
| Nạp ví không hiện nút xác nhận thử | Kiểm tra `PAYMENT_PROVIDER=WALLET` và `SEPAY_BANK_ACCOUNT`/`SEPAY_BANK_CODE` đang trống; khởi động lại backend. |
| Thanh toán báo “Số dư ví không đủ” | Nạp thêm ví rồi thử lại; booking vẫn còn hạn. |
| Booking hết hạn trước khi thanh toán | Tạo booking mới; countdown lấy từ server. |
| Owner không thấy nút hủy | Booking đã bắt đầu, là booking giải đấu, hoặc chưa `CONFIRMED`/`PENDING_PAYMENT`. |
| Danh sách booking trong trận trống | Chưa có booking `CONFIRMED` đúng ngày/giờ/thời lượng của kèo (kèo mặc định 90 phút). |
| Booking hiện nhưng nút Liên kết bị disable | Sai khung giờ/thời lượng, booking đã gắn trận khác, hoặc đã ở quá khứ. |
| Hoàn tiền mãi “Đang hoàn tiền” | Worker chạy mỗi 60 giây; chờ và tải lại. Kiểm tra `REFUND_ENABLED=true` và backend đang chạy. |
| Dữ liệu cũ/lỗi migration | `docker compose down -v && docker compose up -d`, sau đó `npm run db:migrate && npm run db:seed`. |

---

## 10. Ghi chú phạm vi

- Release này dùng **ví-first** cho booking; không có màn hình VNPAY cho booking.
- Booking giải đấu (system booking) và nhánh hủy kèo kèm hủy booking (CANCEL) chưa
  có thao tác UI đầy đủ; các nhánh này đã được kiểm tra tự động ở backend.
- B5/B7/B11 vẫn là **UI-REDO** sau khi frontend merge; hướng dẫn này dùng giao
  diện hiện có để kiểm tra luồng nghiệp vụ.
