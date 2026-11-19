# 03 — Thanh toán và hoàn tiền

- Ưu tiên: 03
- Track/Phase: Track A / Phase 1
- Prerequisite: 01 G0 (D3, D4, D9), 02 INF-00. **A0 chạy trước A1; A1/A2 có thể song song sau INF-00.**
- **D9 + D4 đã đóng:** ví ảo thuộc release. **SePay bank webhook + VietQR** dùng cho nạp ví; booking/giải trả bằng số dư ví; refund về ví; rút/payout do Admin duyệt thủ công.
- Exit gate: ví/ledger + SePay top-up + IPN + refund-to-wallet có test; Mock bị chặn ngoài dev/test
- Mở khóa: BK-06/07/10/12/14, CO-05/08, MM-07/19/20, TRN-05/09

## 1. Mục đích

Thay luồng Mock hiện tại bằng payment provider thật có thể kiểm thử offline, xác nhận thanh toán idempotent và hoàn tiền durable. Đây là nút thắt lớn nhất của toàn bộ kế hoạch.

## 2. Điểm cần chốt

- [ ] **PAY-D1 (D3):** schema refund durable đã được duyệt.
- [x] **PAY-D2 (SePay):** dùng `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_NAME`, `SEPAY_QR_BASE_URL`.
- [ ] **PAY-D3:** webhook provider dùng `POST`; VNPAY cũ giữ legacy nếu cần.
- [x] **PAY-D4:** webhook HMAC mới credit ví; không dùng Return URL để credit.
- [ ] **PAY-D5:** `MOCK` chỉ được phép khi `NODE_ENV in (development,test)`.
- [ ] **PAY-D6:** không gọi provider bên trong transaction DB.
- [x] **PAY-D8 (D9):** ví ảo thuộc release; nạp bằng VietQR + SePay bank webhook, payout Admin thủ công, refund về ví, không phí/hạn mức, Admin credit/debit có audit.

## 3. Danh sách task chi tiết

### [x] A0 — WAL-01→08: Ví ảo và ledger

**Mục đích:** thêm ví trước khi đổi payment path; tránh xây VNPAY trực tiếp rồi phải bỏ.

**Việc làm:**

- [x] WAL-01: schema/ledger ví, hold/release, idempotency, chống overdraft. **DONE 2026-11-15:** migration `0018_wallet_ledger.sql`, schema/repo/service, `wallet-ledger.test.ts` 7/7 PASS, test DB apply PASS.
- [x] WAL-02: nạp **SePay bank webhook/VietQR**; chỉ credit khi HMAC hợp lệ, replay một lần. **DONE:** `wallet-top-up.test.ts` 6/6, QR + HMAC webhook + replay + mock confirm.
- [x] WAL-03: booking/registration trả bằng ví; thiếu tiền → CTA nạp. **DONE cho booking:** `wallet-booking-payment.test.ts` 3/3; registration nối TRN-05.
- [x] WAL-04: refund credit ví, không hoàn nguồn. **DONE:** `payment_refunds` migration 0020, refund worker, `wallet-booking-payment.test.ts` 4/4.
- [x] WAL-05: user thêm tài khoản nhận; **Admin duyệt và chuyển khoản thủ công**; không dùng VNPAY payout. **DONE:** `wallet_bank_accounts`, withdrawal request, hold/release/capture; `WALLET_AUTO_APPROVE_PAYOUTS=true` auto-approves sandbox requests; SePay outgoing webhook `PAYOUT-<id>` auto-mark paid; `wallet-payout.test.ts` 6/6.
- [x] WAL-06: Owner payout request + Admin duyệt. **DONE:** cùng payout service, requestType OWNER_PAYOUT; auto-approve sandbox + outgoing webhook `PAYOUT-<id>`.
- [x] WAL-07: Admin credit/debit có lý do + audit append-only. **DONE:** service + `/api/v1/admin/wallet/users/:userId/credit|debit`; ledger audit.
- [x] WAL-08: reconciliation top-up/payout với ledger. **DONE:** `GET /api/v1/admin/wallet/reconciliation` (basic totals/unmatched).
- [ ] Test: concurrency, replay, rollback, insufficient funds, provider timeout. **WAL-01 đã có** concurrency/replay/insufficient; provider timeout thuộc WAL-02/05.
- [ ] Cập nhật `03`/`PAY-*` để không còn luồng VNPAY trực tiếp cho booking.

**Acceptance:**

- [x] Không thể chi vượt số dư.
- [x] Top-up/payout/refund idempotent (trong phạm vi đã test).
- [x] Mọi thay đổi số dư có audit.

### [x] A1 — PAY-01: Config, HMAC, SePay bank webhook adapter

**Mục đích:** có luồng tạo QR + xác thực webhook ngân hàng SePay, test offline được.

**Việc làm:**

- [x] Env: `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_NAME`, `SEPAY_QR_BASE_URL`; VNPAY/Payment Gateway giữ legacy optional.
- [x] Build QR VietQR động theo `txnRef`, amount, bank account.
- [x] Verify HMAC-SHA256 `sha256=` trên `${timestamp}.${rawBody}`, chống replay 5 phút.
- [x] Route webhook dùng raw body; không parse JSON trước khi verify.
- [x] Fail-fast nếu thiếu bank account/webhook secret; không fallback Mock.
- [x] Không log secret/signature.
- [x] Unit/API test: QR, HMAC đúng/sai, replay, amount mismatch, raw-body route.

**Acceptance:**

- [x] HMAC đúng → credit ví; sửa body/sai secret → 401.
- [x] Replay → không credit thêm.
- [x] Thiếu config → lỗi rõ ràng, không fallback Mock.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/wallet-top-up.test.ts
npm run build --prefix backend
```

### [x] A2 — PAY-06: Mock an toàn

**Mục đích:** Mock phục vụ dev/test nhưng không thể lọt production.

**Việc làm:**

- [x] `provider.factory.ts` chặn `MOCK` ngoài `development/test`.
- [x] Endpoint mock-confirm chặn theo cùng điều kiện.
- [x] Client không thể override provider ngoài `NODE_ENV=test`.
- [x] `simulateFailure` không ghi đè giao dịch terminal (payment-integration tests).
- [x] Confirm của Mock dùng chung transaction/idempotency với Booking.
- [x] Test factory production Mock + replay; `payment-integration.test.ts` 17/17.

**Acceptance:**

- [x] Mock không khả dụng ngoài dev/test.
- [x] Không có nhánh nào tự chuyển SePay/VNPAY sang Mock.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-integration.test.ts
```

### [x] A3 — PAY-02: Khởi tạo thanh toán bằng ví

**Mục đích:** debit ví để thanh toán booking/registration; SePay chỉ dùng cho top-up.

**Việc làm:**

- [x] `POST /api/v1/bookings/:id/payment`: owner-only, booking `PENDING_PAYMENT`, chưa hết hạn.
- [x] Lock booking + wallet; amount lấy từ booking snapshot, không lấy từ request.
- [x] Debit/hold ví idempotent; thiếu số dư → `WALLET_INSUFFICIENT_BALANCE` + CTA nạp.
- [x] Không tạo URL provider trực tiếp cho booking.
- [x] Replay không trừ lần 2 (concurrency debit test ở WAL-01).
- [x] Chuẩn hóa lỗi `409 PAYMENT_NOT_PAYABLE`.
- [x] Interface generic cho registration đã có; nối Tournament ở TRN-05.
- [x] Test: 404/409; ownership; expired; replay; insufficient; `wallet-booking-payment.test.ts` 4/4.

**Acceptance:**

- [x] Booking payable được debit ví đúng một lần.
- [x] Booking terminal nhận `PAYMENT_NOT_PAYABLE`.
- [x] Không tạo 2 debit PENDING.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-integration.test.ts
```

### [x] A4 — PAY-03: SePay IPN nạp ví idempotent

**Mục đích:** xác nhận top-up SePay đúng một lần; booking không đi qua webhook này.

**Việc làm:**

- [x] `POST /api/v1/payments/sepay/bank-webhook` + `X-SePay-Signature`/`X-SePay-Timestamp` (HMAC raw body).
- [x] Verify HMAC-SHA256 và timestamp trước mọi thay đổi.
- [x] Map `transferType=in` + `transferAmount` + `code`/`content`; trả `{ success: true }`.
- [x] Một transaction: top-up `SUCCESS` + credit ví (WAL-02).
- [x] Duplicate callback: không credit lần 2.
- [x] Late callback: không mở lại intent; ghi nhận để đối soát.
- [x] Không dùng redirect URL để credit.
- [x] Test: HMAC sai; duplicate; amount mismatch; route raw body; `wallet-top-up.test.ts` 6/6.

**Acceptance:**

- [x] Callback hợp lệ → ví được credit đúng một lần.
- [x] Replay → không credit thêm.
- [x] Booking/registration không được confirm bởi webhook top-up.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/wallet-top-up.test.ts
```

### [x] A5 — PAY-04: Refund durable

**Mục đích:** hoàn tiền vào ví đúng một lần, sống sót crash/retry, quan sát được trạng thái.

**Prerequisite:** PAY-D1 (D3), WAL-04.

**Việc làm:**

- [x] Migration `PAYMENT_REFUNDS` (status/attempt/claimed_at/last_error/completed_at) theo D3.
- [x] Consumer booking cancellation; Owner/Tournament/Registration producers chờ module tương ứng.
- [x] Persist refund intent trong cùng transaction hủy booking.
- [x] Worker claim + credit ví qua ledger WAL-04, không gọi provider.
- [x] Retry giới hạn attempts; reclaim PROCESSING quá timeout.
- [x] `REFUND_ENABLED=false`: worker không credit, intent vẫn observable.
- [x] Refund booking credit ví; không gọi provider refund/payout.
- [ ] Test 2 worker song song/crash/timeout đầy đủ (hiện có test booking refund cơ bản).
- [ ] Không log secret.

**Acceptance:**

- [x] Hủy booking đã trả tiền → ví được credit đúng một lần (`wallet-booking-payment.test.ts`).
- [x] Retry không tạo credit thứ hai.
- [x] Payment/refund status đọc được từ Booking detail.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/payment-refund.test.ts
npm test --prefix backend -- --run src/__tests__/payment-refund-concurrency.test.ts
```

### [ ] A6 — PAY-05: Test coverage

**Mục đích:** khóa hành vi bằng test đủ các nhánh.

**Việc làm:**

- [x] Test HMAC/QR/route SePay offline.
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
- [ ] SePay sandbox smoke: chỉ tick khi D4 có bank account + webhook secret; nếu chưa, ghi rõ “chưa nghiệm thu sandbox”.

## 5. Checklist hoàn thành file

- [ ] A1→A6 xong.
- [x] Không còn fallback SePay/VNPAY → MOCK.
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


## Admin financial alerts — implemented 2026-11-18

- Payout created and left `PENDING` emits `ADMIN_PAYOUT_PENDING` (`ADMIN_PAYOUT` → `/admin/wallet/payouts?payoutId=<id>`). Auto-approved sandbox payouts emit nothing.
- Refund worker `FAILED` emits `ADMIN_REFUND_FAILED` (`ADMIN_REFUND` → `/admin/wallet/refunds?paymentId=<id>`) in the same transaction as `markFailed`.
- Webhook signature/order-ref/amount/state failures emit `ADMIN_PAYMENT_MISMATCH` or `ADMIN_PAYOUT_FAILED` best-effort; the webhook response is unchanged.
- Added Admin-only `GET /api/v1/admin/wallet/refunds?status=&page=&limit=` and Admin wallet pages for payouts, refunds and reconciliation. Money/ledger behavior is unchanged.
