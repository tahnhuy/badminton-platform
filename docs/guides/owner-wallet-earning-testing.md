# Hướng dẫn test Ví & thu nhập chủ sân trên giao diện

Tài liệu hướng dẫn test luồng:

1. Admin bật/tắt tự động cộng ví Owner.
2. Booking thanh toán thành công được cộng ví Owner tự động hoặc vào hàng chờ duyệt.
3. Admin duyệt Owner earning.
4. Owner xem ví và tạo yêu cầu rút tiền.
5. Admin duyệt payout và đánh dấu đã chuyển khoản.

Liên quan:

- Kế hoạch: [15_bat-tat-cong-vi-owner-tu-dong.md](../plans/15_bat-tat-cong-vi-owner-tu-dong.md)
- Admin Finance: `docs/features/admin/finance/`
- Cấu hình: `docs/business-rules-config-matrix.md` §8.10

## 1. Chuẩn bị môi trường

Từ thư mục gốc repository:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Mở frontend tại địa chỉ Vite in ra (thường `http://localhost:5173`).

Tài khoản seed (mật khẩu chung `Password@123`):

| Vai trò | Email | Dùng để |
| --- | --- | --- |
| Admin | `admin@smashpro.vn` | Bật/tắt cấu hình, duyệt earning, duyệt payout |
| Court Owner | `quocbao.tran@phucthinhbadminton.vn` | Xem ví, tạo yêu cầu rút |
| Player | `nam.nguyen@example.com` | Tạo booking và thanh toán |

Nếu seed chưa có dữ liệu sân/booking, tạo booking mới bằng tài khoản Player trước.

## 2. Kiểm tra công tắc cấu hình

1. Đăng nhập Admin.
2. Mở `/admin/configs`.
3. Lọc domain **Tài chính**.
4. Tìm key **Tự động cộng ví chủ sân** (`OWNER_EARNING_AUTO_CREDIT_ENABLED`).
5. Kiểm tra mặc định đang là **Tự động cộng ví**.

Lưu ý: cấu hình có cache tối đa 60 giây. Sau khi đổi, chờ khoảng 1 phút trước khi test
sweep tiếp theo.

## 3. Test chế độ TỰ ĐỘNG cộng ví

### 3.1 Tạo booking đã thanh toán

1. Đăng nhập Player.
2. Nếu ví Player chưa có tiền, dùng Admin cộng ví thủ công:
   - Admin mở `/admin/finance/wallets`.
   - Nhập User ID Player, bấm **Cộng ví**, nhập số tiền và lý do.
3. Player đặt sân và thanh toán bằng ví.
4. Xác nhận booking đã ở trạng thái đã thanh toán/đã xác nhận.

### 3.2 Xác nhận payment thành công

Với luồng hiện tại, Owner được cộng ví **ngay khi payment SUCCESS**, không cần chờ
hết giờ đặt sân. Kiểm tra:

```sql
SELECT b.id, b.booking_code, b.status, p.status AS payment_status, p.amount
FROM bookings b
JOIN payments p ON p.booking_id = b.id
WHERE b.booking_code = 'BK-XXXXXX';
```

Kỳ vọng: `payment_status='SUCCESS'`, booking `CONFIRMED` (hoặc `IN_PROGRESS`/`COMPLETED`).

### 3.3 Sweep dự phòng

- Payment success đã kích hoạt cộng ví ngay trong transaction thanh toán.
- Sweep (worker 5 phút hoặc nút **Chạy sweep**) chỉ là lưới an toàn cho booking đã
  thanh toán nhưng chưa có settlement/ledger.
- Trong điều kiện bình thường, chạy sweep ngay sau khi thanh toán sẽ trả `scanned 0`.
- Có thể bấm **Dry-run sweep** trước để xem số lượng.

### 3.4 Kết quả mong đợi

1. Owner đăng nhập, mở **Ví & thu nhập** ở `/owner/wallet`.
2. Số dư khả dụng tăng đúng bằng `BOOKING.total_amount`.
3. Admin mở `/admin/finance/owner-earnings`, tab **Đã cộng**, thấy ledger
   `OWNER_EARNING`.
4. Database:

```sql
SELECT id, booking_id, owner_id, amount, status, mode, ledger_entry_id
FROM owner_earning_settlements
ORDER BY id DESC
LIMIT 5;
```

Kỳ vọng: settlement `status='CREDITED'`, `mode='AUTO'`, có `ledger_entry_id`.

```sql
SELECT entry_type, amount, reference_type, reference_id, idempotency_key
FROM wallet_ledger_entries
WHERE entry_type = 'OWNER_EARNING'
ORDER BY id DESC
LIMIT 5;
```

Kỳ vọng: đúng một entry/booking, idempotency `owner-earning:<bookingId>`.

5. Chạy lại **Chạy sweep**: số dư Owner không tăng thêm (idempotent).

## 4. Test chế độ CHỜ ADMIN DUYỆT

### 4.1 Tắt tự động

1. Admin mở `/admin/configs`, domain **Tài chính**.
2. Đổi **Tự động cộng ví chủ sân** sang **Chờ Admin duyệt** và lưu.
3. Chờ tối đa 60 giây để cache hết hạn.
4. Tạo booking mới và thanh toán thành công như mục 3. Settlement `PENDING` được
   tạo ngay sau payment, không cần chờ hết giờ.

### 4.2 Kết quả trước khi duyệt

1. Owner mở `/owner/wallet`: số dư **không tăng**.
2. Admin mở `/admin/finance/owner-earnings`, tab **Chờ duyệt**: có settlement mới.
3. Admin nhận thông báo **Owner earning chờ duyệt** trên chuông thông báo.
4. Database:

```sql
SELECT id, booking_id, status, mode, ledger_entry_id
FROM owner_earning_settlements
ORDER BY id DESC
LIMIT 5;
```

Kỳ vọng: `status='PENDING'`, `mode='MANUAL'`, `ledger_entry_id` null.

5. Xác nhận chưa có ledger:

```sql
SELECT COUNT(*) FROM wallet_ledger_entries
WHERE entry_type = 'OWNER_EARNING'
  AND reference_type = 'BOOKING'
  AND reference_id = <booking_id>;
```

Kỳ vọng: `0`.

### 4.3 Admin duyệt

1. Tại tab **Chờ duyệt**, bấm **Duyệt & cộng ví**.
2. Nhập ghi chú nếu cần, xác nhận.
3. Kỳ vọng:
   - Settlement chuyển `CREDITED`.
   - Số dư Owner tăng đúng một lần.
   - Audit có action `OWNER_EARNING_APPROVE`.
   - Bấm duyệt lại không cộng thêm.

Kiểm tra audit:

```sql
SELECT action, entity_type, entity_id, metadata, created_at
FROM finance_audit_events
WHERE action IN ('OWNER_EARNING_APPROVE', 'OWNER_EARNING_REJECT')
ORDER BY id DESC
LIMIT 5;
```

### 4.4 Test từ chối

1. Tạo thêm một booking đã thanh toán thành công trong chế độ tắt tự động.
2. Tại tab **Chờ duyệt**, bấm **Từ chối**.
3. Bắt buộc nhập lý do.
4. Kỳ vọng:
   - Settlement `REJECTED`.
   - Không có ledger, số dư Owner không đổi.
   - Không thể approve lại settlement đã từ chối.
   - Audit có `OWNER_EARNING_REJECT`.

## 5. Test Owner rút tiền

1. Owner mở `/owner/wallet`.
2. Trong **Tài khoản nhận tiền**, thêm tài khoản:
   - Ngân hàng: ví dụ `MBBank`.
   - Số tài khoản, tên chủ tài khoản.
3. Trong **Rút doanh thu**, nhập số tiền không vượt số dư khả dụng.
4. Chọn tài khoản nhận tiền, bấm **Gửi yêu cầu rút tiền**.
5. Kỳ vọng:
   - Số dư khả dụng giảm, phần **Đang giữ** tăng tương ứng.
   - Yêu cầu xuất hiện trong **Lịch sử yêu cầu rút**.
6. Admin mở `/admin/finance/payouts`.
7. Nếu request `PENDING`, bấm **Duyệt**.
8. Sau khi chuyển khoản thật (hoặc giả lập sandbox), bấm **Đã chi** và nhập mã giao dịch.
9. Owner tải lại `/owner/wallet`: trạng thái chuyển **Đã chuyển khoản**, phần
   **Đang giữ** giảm về 0.

> Lưu ý: key cấu hình **Tự động duyệt yêu cầu rút ví**
> (`WALLET_AUTO_APPROVE_PAYOUTS`) mặc định `true`. Khi đó yêu cầu rút tự động
> `APPROVED`; Admin vẫn phải bấm **Đã chi** với mã giao dịch. Muốn test chờ duyệt,
> tắt key này tại `/admin/configs` domain **Tài chính** và chờ tối đa 60 giây.

## 6. Test đối soát

1. Admin mở `/admin/finance/reconciliation`.
2. Bấm **Chạy đối soát**.
3. Kỳ vọng:
   - Không có discrepancy `OWNER_EARNING_MISSING`.
   - Settlement `PENDING` không bị báo lệch.
   - Booking đã cộng ví có ledger tương ứng.

## 7. Checklist nhanh

- [ ] Cấu hình mặc định là **Tự động cộng ví**.
- [ ] Payment `SUCCESS` → ví Owner tăng đúng một lần ngay lập tức.
- [ ] Chạy sweep lặp không cộng trùng.
- [ ] Booking bị hủy/hoàn tiền → có ledger `OWNER_EARNING_REVERSAL` (nếu ví đủ).
- [ ] Tắt cấu hình → settlement `PENDING`, ví Owner chưa đổi.
- [ ] Admin nhận thông báo chờ duyệt.
- [ ] Admin duyệt → ví Owner tăng đúng một lần, audit đủ.
- [ ] Admin từ chối → không cộng ví, có lý do + audit.
- [ ] Owner thêm tài khoản nhận tiền và tạo yêu cầu rút.
- [ ] Admin duyệt payout + đánh dấu đã chi.
- [ ] UI hiển thị/copy được nội dung `PAYOUT-<id>`.
- [ ] Webhook `transferType=out` đúng chữ ký đưa request sang `PAID`.
- [ ] Đối soát không báo lệch giả.

## 7.1 Test webhook SePay cho yêu cầu rút

Sau khi tạo yêu cầu rút, màn `/owner/wallet` hiển thị **Nội dung chuyển khoản**
dạng `PAYOUT-<id>` trong lịch sử. Dùng đúng mã này khi chuyển khoản thật hoặc khi
giả lập webhook.

Điều kiện để webhook chuyển request sang `PAID`:

1. Request đang `APPROVED` (bật `WALLET_AUTO_APPROVE_PAYOUTS` hoặc Admin duyệt tay).
2. Payload webhook có `transferType: "out"`.
3. `content` chứa `PAYOUT-<id>`.
4. `transferAmount` khớp đúng số tiền request.

Ví dụ script Node.js (đọc secret từ `backend/.env`, không commit secret):

```js
const crypto = require('node:crypto');

const secret = process.env.SEPAY_WEBHOOK_SECRET;
const payoutId = 12; // lấy từ nội dung PAYOUT-<id> trên UI
const body = JSON.stringify({
  transferType: 'out',
  content: `PAYOUT-${payoutId}`,
  transferAmount: 50000,
  referenceCode: `WEBHOOK-TEST-${Date.now()}`,
  id: `WEBHOOK-TEST-${Date.now()}`,
});
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

fetch('http://localhost:3000/api/v1/payments/sepay/bank-webhook', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-sepay-signature': signature,
    'x-sepay-timestamp': timestamp,
  },
  body,
}).then(async response => {
  console.log(response.status, await response.text());
});
```

Kỳ vọng:

- Webhook trả `200 {"success":true}`.
- Request chuyển `PAID`, có `transferReference`.
- Hold bị capture, ledger có `PAYOUT`.
- Owner tải lại `/owner/wallet`: trạng thái **Đã chuyển khoản**, phần **Đang giữ** giảm.

Lưu ý:

- Signature sai/hết hạn (>5 phút) → 401.
- Sai amount → 400 `PAYMENT_AMOUNT_MISMATCH`.
- Request chưa `APPROVED` → 409 `WALLET_PAYOUT_NOT_APPROVED`.
- Webhook chỉ mô phỏng chi tiền; hệ thống chưa tự gửi lệnh chi qua SePay Bank Hub.

## 8. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Owner chưa thấy tiền | Payment chưa `SUCCESS` hoặc booking đã hủy | Kiểm tra payment; thanh toán lại/booking mới |
| Đổi cấu hình chưa có tác dụng | Cache cấu hình 60 giây | Chờ 1 phút rồi sweep lại |
| Booking không vào hàng chờ | Payment không `SUCCESS` hoặc booking đã hủy | Kiểm tra SQL booking/payment |
| Duyệt báo không hợp lệ | Booking/payment đã bị huỷ/hoàn | Kiểm tra trạng thái trước khi duyệt |
| Không tạo được yêu cầu rút | Chưa có tài khoản nhận tiền hoặc vượt số dư khả dụng | Thêm tài khoản, giảm số tiền |
| Không thấy menu Ví | Đang đăng nhập sai role | Đăng nhập tài khoản `COURT_OWNER`; route `/owner/wallet` |
| Notification chờ duyệt không có | Chưa tạo settlement `PENDING` hoặc dedup đã tồn tại | Kiểm tra bảng `notifications` type `ADMIN_OWNER_EARNING_PENDING` |

## 9. Truy vấn kiểm tra nhanh

```sql
-- Ví Owner
SELECT u.email, w.balance, w.updated_at
FROM wallet_accounts w
JOIN users u ON u.id = w.user_id
WHERE u.email = 'quocbao.tran@phucthinhbadminton.vn';

-- Settlement gần nhất
SELECT id, booking_id, owner_id, amount, status, mode, ledger_entry_id
FROM owner_earning_settlements
ORDER BY id DESC
LIMIT 10;

-- Ledger Owner earning
SELECT id, user_id, entry_type, amount, reference_type, reference_id, idempotency_key
FROM wallet_ledger_entries
WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
ORDER BY id DESC
LIMIT 10;

-- Payout của Owner
SELECT id, user_id, request_type, amount, status, admin_note, transfer_reference
FROM wallet_payout_requests
WHERE request_type = 'OWNER_PAYOUT'
ORDER BY id DESC
LIMIT 10;
```
