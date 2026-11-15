# 03 — Thanh toán và hoàn tiền

- Ưu tiên: 03
- Track/Phase: Track A / Phase 1
- Prerequisite: 01 G0 (D3, D4, D9), 02 INF-00. **A0 chạy trước A1; A1/A2 có thể song song sau INF-00.**
- **D9 đã đóng:** ví ảo thuộc release. VNPAY dùng cho nạp/rút; booking/giải trả bằng số dư ví; refund về ví.
- Exit gate: ví/ledger + VNPAY top-up/payout + webhook + refund-to-wallet có test; Mock bị chặn ngoài dev/test
- Mở khóa: BK-06/07/10/12/14, CO-05/08, MM-07/19/20, TRN-05/09

## 1. Mục đích

Thay luồng Mock hiện tại bằng payment provider thật có thể kiểm thử offline, xác nhận thanh toán idempotent và hoàn tiền durable. Đây là nút thắt lớn nhất của toàn bộ kế hoạch.

## 2. Điểm cần chốt

- [ ] **PAY-D1 (D3):** schema refund durable đã được duyệt.
- [ ] **PAY-D2:** tên config thống nhất: `VNPAY_PAYMENT_URL` (không dùng lẫn `VNPAY_PAY_URL`).
- [ ] **PAY-D3:** webhook giữ cả `GET` (VNPAY IPN) và `POST` tương thích.
- [ ] **PAY-D4:** Return URL chỉ redirect, không xác nhận thanh toán.
- [ ] **PAY-D5:** `MOCK` chỉ được phép khi `NODE_ENV in (development,test)`.
- [ ] **PAY-D6:** không gọi provider bên trong transaction DB.
- [ ] **PAY-D8 (D9):** ví ảo thuộc release; nạp VNPAY, rút tự động VNPAY payout, refund về ví, Owner payout request + Admin duyệt, không phí/hạn mức, Admin credit/debit có audit.

## 3. Danh sách task chi tiết

### [ ] A0 — WAL-01→08: Ví ảo và ledger

**Mục đích:** thêm ví trước khi đổi payment path; tránh xây VNPAY trực tiếp rồi phải bỏ.

**Việc làm:**

- [ ] WAL-01: schema/ledger ví, hold/release, idempotency, chống overdraft.
- [ ] WAL-02: nạp VNPAY; chỉ credit khi IPN hợp lệ, replay một lần.
- [ ] WAL-03: booking/registration trả bằng ví; thiếu tiền → CTA nạp.
- [ ] WAL-04: refund credit ví, không hoàn nguồn.
- [ ] WAL-05: user thêm tài khoản nhận; rút tự động VNPAY payout; xử lý ngay.
- [ ] WAL-06: Owner payout request + Admin duyệt.
- [ ] WAL-07: Admin credit/debit có lý do + audit append-only.
- [ ] WAL-08: reconciliation top-up/payout với ledger.
- [ ] Test: concurrency, replay, rollback, insufficient funds, provider timeout.
- [ ] Cập nhật `03`/`PAY-*` để không còn luồng VNPAY trực tiếp cho booking.

**Acceptance:**

- [ ] Không thể chi vượt số dư.
- [ ] Top-up/payout/refund idempotent.
- [ ] Mọi thay đổi số dư có audit.

### [ ] A1 — PAY-01: Config, signature, VNPAY adapter

**Mục đích:** có provider thật và hàm ký/verify thuần, test được không cần mạng.

**File dự kiến:**

- `backend/src/shared/config/env.ts`
- `backend/src/services/payments/provider.factory.ts`
- `backend/src/services/payments/provider.interface.ts`
- `backend/src/services/payments/adapters/vnpay.adapter.ts` (mới)
- `backend/src/services/payments/vnpay-signature.ts` (mới)
- `backend/.env.example`

**Việc làm:**

- [ ] Khai báo/chuẩn hóa env: `PAYMENT_PROVIDER`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`, `REFUND_ENABLED`, `REFUND_PROCESSING_TIMEOUT_MINUTES`.
- [ ] Fail-fast nếu `PAYMENT_PROVIDER=VNPAY` mà thiếu config.
- [ ] Xóa fallback `VNPAY → MOCK`.
- [ ] Implement `buildPaymentUrl()`: amount ×100, GMT+7, orderInfo, locale, expiry, vnp_Version, vnp_Command.
- [ ] Implement `verifySignature()`: sort key, bỏ key rỗng, encode đúng, HMAC-SHA512.
- [ ] Implement `buildQueryRequest()` / `buildRefundRequest()` và parse response.
- [ ] Không log secret/signature.
- [ ] Unit test: payload hợp lệ, payload bị sửa, thiếu key, key trùng, encoding tiếng Việt.
- [ ] Cập nhật `.env.example` không chứa giá trị thật.

**Acceptance:**

- [ ] Ký rồi verify thành công.
- [ ] Sửa 1 ký tự → verify fail.
- [ ] Thiếu config → lỗi rõ ràng, không fallback Mock.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/vnpay-signature.test.ts
npm run build --prefix backend
```

### [ ] A2 — PAY-06: Mock an toàn

**Mục đích:** Mock phục vụ dev/test nhưng không thể lọt production.

**Việc làm:**

- [ ] `provider.factory.ts` chặn `MOCK` ngoài `development/test`.
- [ ] Endpoint mock-confirm chặn theo cùng điều kiện.
- [ ] Client không thể override provider qua body/query/header.
- [ ] Sửa `simulateFailure` để không ghi đè giao dịch terminal.
- [ ] Confirm của Mock dùng chung transaction/idempotency với Booking.
- [ ] Test: production + Mock → 403/khởi tạo lỗi; replay terminal không đổi; 2 confirm song song → 1 hiệu lực.

**Acceptance:**

- [ ] Mock không khả dụng ngoài dev/test.
- [ ] Không có nhánh nào tự chuyển VNPAY sang Mock.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-integration.test.ts
```

### [ ] A3 — PAY-02: Khởi tạo thanh toán bằng ví

**Mục đích:** debit ví để thanh toán booking/registration; VNPAY chỉ dùng cho top-up.

**Việc làm:**

- [ ] `POST /api/v1/bookings/:id/payment`: owner-only, booking `PENDING_PAYMENT`, chưa hết hạn.
- [ ] Lock booking + wallet; amount lấy từ booking snapshot, không lấy từ request.
- [ ] Debit/hold ví idempotent; thiếu số dư → `WALLET_INSUFFICIENT_BALANCE` + CTA nạp.
- [ ] Không tạo URL VNPAY trực tiếp cho booking.
- [ ] Concurrent 2 request → 1 debit; replay không trừ lần 2.
- [ ] Chuẩn hóa lỗi `409 PAYMENT_NOT_PAYABLE`.
- [ ] Tạo interface generic cho registration; chưa nối Tournament (sẽ làm ở TRN-05).
- [ ] Test: 404/409; ownership; expired hold; concurrent; insufficient; amount mismatch.

**Acceptance:**

- [ ] Booking payable được debit ví đúng một lần.
- [ ] Booking terminal nhận `PAYMENT_NOT_PAYABLE`.
- [ ] Không tạo 2 debit PENDING.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-integration.test.ts
```

### [ ] A4 — PAY-03: Webhook/IPN nạp ví idempotent

**Mục đích:** xác nhận top-up VNPAY đúng một lần; booking không đi qua webhook này.

**Việc làm:**

- [ ] `GET /api/v1/payments/vnpay/webhook` và `POST` tương thích cho top-up.
- [ ] Verify signature trước mọi thay đổi.
- [ ] Map `RspCode`/`Message` đúng contract VNPAY; trả response provider.
- [ ] Một transaction: payment top-up `SUCCESS` + credit ví (WAL-02).
- [ ] Duplicate callback: không credit lần 2.
- [ ] Late callback: không mở lại intent; ghi nhận để đối soát nếu cần.
- [ ] Return handler chỉ redirect; không credit.
- [ ] Test: invalid signature; duplicate; parallel; late; amount mismatch.

**Acceptance:**

- [ ] Callback hợp lệ → ví được credit đúng một lần.
- [ ] Replay → không credit thêm.
- [ ] Booking/registration không được confirm bởi webhook top-up.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-webhook.test.ts
```

### [ ] A5 — PAY-04: Refund durable

**Mục đích:** hoàn tiền vào ví đúng một lần, sống sót crash/retry, quan sát được trạng thái.

**Prerequisite:** PAY-D1 (D3), WAL-04.

**Việc làm:**

- [ ] Migration `PAYMENT_REFUNDS` (status/attempt/claimed_at/last_error/completed_at) theo D3.
- [ ] Consumer cho `BookingCancelled`, `OwnerBookingCancelled`, `TournamentCancelled`, `RegistrationWithdrawn`.
- [ ] Persist refund intent trong cùng transaction hủy.
- [ ] Worker claim bằng UPDATE có điều kiện; credit ví qua ledger WAL-04, không gọi provider.
- [ ] Retry có giới hạn; timeout theo `REFUND_PROCESSING_TIMEOUT_MINUTES`.
- [ ] `REFUND_ENABLED=false`: không credit, intent vẫn observable.
- [ ] Không dùng VNPAY refund cho booking; VNPAY chỉ dùng payout khi user rút.
- [ ] Test: 2 worker song song → 1 credit; crash trước khi ghi kết quả → retry an toàn; timeout; failed.
- [ ] Không log secret.

**Acceptance:**

- [ ] Hủy booking đã trả tiền → ví được credit đúng một lần.
- [ ] Retry không tạo credit thứ hai.
- [ ] Trạng thái `REFUND_PENDING`/`REFUNDED`/`REFUND_FAILED` đọc được từ API.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-refund.test.ts
npm test --prefix backend -- --run src/__tests__/payment-refund-concurrency.test.ts
```

### [ ] A6 — PAY-05: Test coverage

**Mục đích:** khóa hành vi bằng test đủ các nhánh.

**Việc làm:**

- [ ] Test signature/webhook VNPAY offline.
- [ ] Test concurrent initialization.
- [ ] Test duplicate callback và late payment.
- [ ] Test refund claim/retry/timeout/uniqueness.
- [ ] Test registration payment sau khi TRN-05 có (đánh dấu phụ thuộc chéo).
- [ ] Playwright Mock E2E: pay → confirm → cancel → refund.
- [ ] Ghi rõ test nào là contract test, test nào là real E2E.

**Acceptance:**

- [ ] Các nhánh success/validation/duplicate/concurrency đều có test.
- [ ] Không có test nào gọi production.

## 4. Test đầu ra toàn track

```bash
npm test --prefix backend
npm run build --prefix backend
cd frontend && npx playwright test --config playwright.booking-payment.config.ts
```

- [ ] Full backend test PASS.
- [ ] Backend build PASS.
- [ ] Payment E2E (Mock) PASS.
- [ ] VNPAY sandbox smoke: chỉ tick khi D4 có credentials; nếu chưa, ghi rõ “chưa nghiệm thu sandbox”.

## 5. Checklist hoàn thành file

- [ ] A1→A6 xong.
- [ ] Không còn fallback VNPAY → MOCK.
- [ ] Mock bị chặn ngoài dev/test.
- [ ] Webhook idempotent có test concurrency.
- [ ] Refund worker có test crash/retry/timeout.
- [ ] `.env.example` cập nhật.
- [ ] `docs/features/platform/payments-refunds/tasks.md` cập nhật đúng trạng thái.
- [ ] `03` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Gọi provider trong transaction gây lock lâu | Claim DB → commit → gọi provider → ghi kết quả bằng transaction mới |
| Callback đến trước khi client return | Không confirm ở Return; UI đọc trạng thái từ API |
| Refund lặp do timeout | Query/reconcile trước khi gửi lại; dùng request identity ổn định |
| Sandbox không có quyền refund | Chỉ chặn smoke test; code/test offline vẫn hoàn tất |
