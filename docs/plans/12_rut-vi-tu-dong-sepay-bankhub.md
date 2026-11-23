# 12 — Rút ví tự động qua SePay Bank Hub (dev/demo)

- Ngày: 2026-11-18
- Trạng thái: Draft
- Track/Phase: Track A / Phase 1 (dev/demo)
- Hướng dẫn setup: [SePay Bank Hub sandbox setup](../guides/sepay-bankhub-sandbox-setup.md)

## 0. Quyết định đã chốt

1. Dùng **B1 — SePay Bank Hub Mock Transaction API**.
2. **Bỏ hẳn bước Admin duyệt**; không dùng `WALLET_AUTO_APPROVE_PAYOUTS`.
3. Chỉ tập trung **dev/demo**; production chưa tối ưu.
4. Chấp nhận giao dịch **giả lập**, nhưng luồng demo **phải chứng minh được giao dịch** bằng dữ liệu lưu vết.
5. Auto-settle chỉ áp dụng cho `WITHDRAWAL` (PLAYER). `OWNER_PAYOUT` vẫn `PENDING → Admin mark paid`.

## 1. Mục tiêu

1. Người chơi tạo yêu cầu rút ví → hệ thống tự động chuyển sang `PAID`, trừ ví đúng một lần, không cần Admin duyệt.
2. Luồng demo tạo ra **bằng chứng giao dịch**:
   - Yêu cầu rút + tài khoản đích đã lưu.
   - Hold đã `CAPTURED`.
   - Bút toán ledger `WITHDRAWAL` với `balance_after`.
   - Bản ghi IPN từ SePay Bank Hub: `transaction_id`, `reference_code`, amount, content, thời gian.
   - Response Bank Hub khi gửi lệnh (`transaction_id`, `reference_number`).
   - API `proof` trả đủ chuỗi chứng cứ; UI hiển thị "Chứng từ".
3. Demo chạy lại được, có script/checklist rõ ràng.

## 2. Không nằm trong phạm vi

- Chuyển tiền thật ra ngân hàng.
- Tích hợp provider payout/chi hộ cho production.
- Thay đổi luồng nạp ví, refund, booking payment (trừ việc tái dùng pattern).
- Chống gian lận, hạn mức, KYC, phí rút.
- Tối ưu vận hành production, HA, queue hạ tầng ngoài DB.

## 3. Hiện trạng

- `WalletPayoutService.createRequest` tạo request `PENDING` + hold (`backend/src/services/payments/WalletPayoutService.ts:25-58`).
- Admin duyệt qua `POST /api/v1/admin/wallet/payouts/:id/approve` (`backend/src/routes/admin/adminWalletRoutes.ts:19`).
- Admin mark paid hoặc webhook SePay outgoing mới chuyển `PAID` (`WalletPayoutService.ts:91`, `WalletTopUpService.ts:286-316`).
- Chưa có Bank Hub client, chưa có IPN route cho Bank Hub, chưa có bảng lưu event/chứng cứ.
- Frontend đang hiển thị `PENDING = "Chờ Admin duyệt"`, `APPROVED = "Đã duyệt - chờ chuyển khoản"` (`frontend/src/features/wallet/pages/WalletPage.tsx:17-23`).

## 4. Luồng đích (dev/demo)

```text
User ──POST /wallet/withdrawals──► API
                                   │ transaction:
                                   │  - tạo payout PENDING
                                   │  - hold ví
                                   │  - enqueue settlement job
                                   ▼
                              Worker (outbox)
                                   │ lấy Bank Hub access token (/v1/token)
                                   │ POST /v1/transaction/create
                                   │ transfer_type=debit
                                   │ transaction_content=PAYOUT-<id>
                                   ▼
                             SePay Bank Hub sandbox
                                   │ IPN (Authorization: Apikey ...)
                                   ▼
                    POST /api/v1/payments/sepay-bankhub/ipn
                                   │ verify auth + dedupe transaction_id
                                   │ capture hold + update PAID
                                   │ lưu settlement event (chứng cứ)
                                   ▼
User ──GET /wallet/payouts/:id/proof──► request + bank + hold + ledger + event
```

Production (chưa trọng tâm): request `PENDING` + hold → Admin chuyển khoản tay → mark paid. Không còn bước duyệt.

## 5. Điều kiện tiên quyết

- Tài khoản **SePay Bank Hub sandbox** (khác SePay Payment Gateway đang dùng cho top-up).
- `client_id` + `client_secret` sandbox do SePay cấp.
- Company sandbox (`company_xid`) và bank account sandbox đã liên kết (`bank_account_xid`).
- IPN URL public (ngrok/cloudflared khi dev local).
- Bank Hub IPN API key (`Authorization: Apikey {API_KEY}`) do SePay cung cấp khi cấu hình IPN.
- Quota Test Mode: tối đa 500 giao dịch mô phỏng/ngày/công ty.

Chi tiết từng bước xem [hướng dẫn setup](../guides/sepay-bankhub-sandbox-setup.md).

Nếu chưa có Bank Hub sandbox, B1 bị chặn; fallback tạm thời là B2 (SePay CLI) — không nằm trong kế hoạch này.

## 6. Thay đổi dữ liệu

### 6.1 Bỏ trạng thái `APPROVED`

State machine mới:

```text
PENDING → PAID | REJECTED | FAILED
```

- `backend/src/db/schema/wallet.ts:137-140`: constraint chỉ còn `PENDING, REJECTED, PAID, FAILED`.
- Migration mới:
  ```sql
  UPDATE "wallet_payout_requests" SET "status" = 'PENDING' WHERE "status" = 'APPROVED';
  ALTER TABLE "wallet_payout_requests" DROP CONSTRAINT "chk_wallet_payout_status";
  ALTER TABLE "wallet_payout_requests"
    ADD CONSTRAINT "chk_wallet_payout_status"
    CHECK ("status" IN ('PENDING', 'REJECTED', 'PAID', 'FAILED'));
  ```
- Giữ cột `reviewed_at` (dùng cho `REJECTED`), `admin_id`, `admin_note`, `transfer_reference`.

### 6.2 Bảng `wallet_payout_settlement_jobs` (outbox)

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | bigserial PK | |
| payout_id | bigint UNIQUE NOT NULL | FK `wallet_payout_requests(id)` |
| provider | varchar(30) NOT NULL | `SEPAY_BANKHUB` |
| status | varchar(20) NOT NULL | `PENDING`, `SENT`, `FAILED` |
| attempts | int NOT NULL DEFAULT 0 | |
| last_error | varchar(500) | |
| provider_transaction_id | varchar(120) | transaction id từ response |
| sent_at | timestamp | |
| created_at, updated_at | timestamp NOT NULL | |

Index: `(status, updated_at)`.

### 6.3 Bảng `wallet_payout_settlement_events` (chứng cứ IPN)

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | bigserial PK | |
| payout_id | bigint NOT NULL | FK payout |
| provider | varchar(30) NOT NULL | `SEPAY_BANKHUB` |
| provider_transaction_id | varchar(120) NOT NULL | dedupe |
| reference_code | varchar(120) | |
| transfer_type | varchar(10) NOT NULL | `debit` |
| amount | numeric(14,2) NOT NULL | |
| content | varchar(200) NOT NULL | |
| raw_payload | jsonb NOT NULL | payload IPN gốc |
| received_at | timestamp NOT NULL DEFAULT now() | |

Unique: `(provider, provider_transaction_id)`.

### 6.4 Migration

- Chạy `npm run db:generate --prefix backend` sau khi sửa schema.
- Chèn `UPDATE ... APPROVED → PENDING` vào đầu file SQL sinh ra.
- `npm run verify:migrations --prefix backend` phải PASS.

## 7. Backend

### 7.1 Env

Thêm vào `backend/src/shared/config/env.ts`:

```env
SEPAY_BANKHUB_ENABLED=false
SEPAY_BANKHUB_API_URL="https://bankhub-api-sandbox.sepay.vn"
SEPAY_BANKHUB_CLIENT_ID=""
SEPAY_BANKHUB_CLIENT_SECRET=""
SEPAY_BANKHUB_COMPANY_XID=""
SEPAY_BANKHUB_BANK_ACCOUNT_XID=""
SEPAY_BANKHUB_IPN_API_KEY=""
```

Quy tắc:
- Nếu `SEPAY_BANKHUB_ENABLED=true`:
  - bắt buộc có `CLIENT_ID`, `CLIENT_SECRET`, `BANK_ACCOUNT_XID`, `IPN_API_KEY`.
  - nếu `NODE_ENV=production` → fail-fast khi khởi động.
- Xóa `WALLET_AUTO_APPROVE_PAYOUTS` khỏi `env.ts`, `.env`, `.env.example`, `vitest.config.ts`.

### 7.2 Bank Hub token + client

File mới: `backend/src/services/payments/sepayBankHub.client.ts`

Token:
- `POST {SEPAY_BANKHUB_API_URL}/v1/token`
- Header: `Authorization: Basic base64(client_id:client_secret)`
- Response: `{ access_token, ttl }`
- Cache token trong memory; refresh trước khi hết hạn (ví dụ còn < 60s) hoặc khi gặp 401.
- Không log `client_secret`, token.

Simulate debit:
- `POST {SEPAY_BANKHUB_API_URL}/v1/transaction/create`
- Header: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- Body:
  ```json
  {
    "bank_account_xid": "<SEPAY_BANKHUB_BANK_ACCOUNT_XID>",
    "transfer_type": "debit",
    "amount": 60000,
    "transaction_content": "PAYOUT-123"
  }
  ```
- Response data: `transaction_id`, `reference_number`, `amount`, `transfer_type`.
- Timeout 10s, map lỗi sang `AppError` (`SEPAY_BANKHUB_REQUEST_FAILED`).

### 7.3 Settlement job + worker

File mới: `backend/src/jobs/payout-settlement.job.ts`

- Interval 2s (dev/demo), `timer.unref()`.
- Mỗi tick:
  1. Claim job `PENDING`/`FAILED` còn lượt bằng `FOR UPDATE SKIP LOCKED`.
  2. Đọc payout; nếu đã `PAID` → job `SENT`, bỏ qua.
  3. Gọi Bank Hub client **ngoài DB transaction**.
  4. Thành công → job `SENT` + lưu `provider_transaction_id`.
  5. Lỗi → `attempts++`, `last_error`, status `FAILED`; payout vẫn `PENDING`.
- Retry tối đa 5 lần, backoff tuyến tính.
- Chỉ enqueue cho `requestType === 'WITHDRAWAL'`.

Đăng ký trong `backend/src/index.ts`:
```ts
startPayoutSettlementWorker();
```

Test không chạy timer: export `processPendingPayoutSettlements(limit)` để gọi trực tiếp.

### 7.4 IPN webhook

Route mới: `POST /api/v1/payments/sepay-bankhub/ipn`

- Thêm vào `backend/src/routes/payments/paymentRoutes.ts` **trước** `router.use(authenticate)`.
- `backend/src/app.ts`: thêm path vào CSRF skip trong `csrf.middleware.ts`:
  `path.endsWith('/payments/sepay-bankhub/ipn')`.
- Body JSON (global `express.json` đã đủ); lưu `raw_payload = req.body`.

Xử lý:
1. Verify `Authorization === 'Apikey ' + SEPAY_BANKHUB_IPN_API_KEY` bằng so sánh constant-time; sai → 401.
2. Parse payload Bank Hub (snake_case):
   - `content`
   - `transfer_type` (`debit`)
   - `amount`
   - `reference_code`
   - `transaction_id`
3. Tìm payout theo `content` khớp `PAYOUT-(\d+)`.
4. Nếu không tìm thấy → 404 (SePay không retry non-2xx; log để đối soát).
5. Insert event với unique `(provider, transaction_id)`; nếu trùng → trả `{ success: true }`, không xử lý tiếp.
6. Transaction:
   - Lock payout.
   - Nếu `PAID` → trả success.
   - Nếu `PENDING`:
     - So amount khớp; lệch → 400 `PAYMENT_AMOUNT_MISMATCH`.
     - `walletService.captureHold(holdId, { entryType: 'WITHDRAWAL', idempotencyKey: 'payout-capture:<id>' })`.
     - `updatePayoutStatus(id, 'PAID', { transferReference: reference_code ?? transaction_id, adminNote: 'Auto-settled via SePay Bank Hub sandbox' })`.
   - Nếu `REJECTED/FAILED`: ghi event, trả success, log warning (không đổi trạng thái).
7. Response: `200 { "success": true }`.

Lưu ý: payload IPN Bank Hub dùng `snake_case`, khác payload SePay Payment Gateway hiện tại dùng `camelCase`. Không tái dùng nguyên `handleSepayBankWebhook`; viết adapter map rồi gọi hàm settle dùng chung.

### 7.5 Payout service

`backend/src/services/payments/WalletPayoutService.ts`
- Bỏ import `env`, bỏ nhánh `WALLET_AUTO_APPROVE_PAYOUTS`.
- `createRequest`:
  - Trong transaction: tạo payout `PENDING`, hold, `setPayoutHold`, insert job nếu `requestType === 'WITHDRAWAL'`.
  - Trả record `PENDING`.
- Xóa `approve()`.
- `markPaid`: cho phép `PENDING` hoặc `PAID`; `REJECTED/FAILED` → `WALLET_PAYOUT_NOT_PAYABLE`.
- `reject`: giữ nguyên; `PAID` → `WALLET_PAYOUT_ALREADY_PAID`.
- Đổi mã lỗi `WALLET_PAYOUT_NOT_APPROVED` → `WALLET_PAYOUT_NOT_PAYABLE`.

`backend/src/services/payments/WalletTopUpService.ts:286-316`
- `handleSepayOutgoingPayout`: cho phép `PENDING`; bỏ điều kiện `APPROVED`.
- Có thể refactor phần settle thành hàm dùng chung cho webhook Payment Gateway và Bank Hub.

### 7.6 Repository

`backend/src/repositories/wallet/WalletRepository.ts`
- `WalletPayoutStatus` bỏ `APPROVED`.
- `updatePayoutStatus`: `reviewedAt` chỉ set khi `REJECTED`.
- Thêm:
  - `createSettlementJob`, `findSettlementJobByPayout`, `claimSettlementJobs`, `updateSettlementJob`.
  - `insertSettlementEvent` (on conflict do nothing), `listSettlementEvents(payoutId)`.
  - `findPayoutProof(payoutId, userId?)` hoặc compose từ các hàm sẵn có.

### 7.7 Proof API

- `GET /api/v1/wallet/payouts/:id/proof` (owner hoặc admin):
  ```json
  {
    "payout": { "id": 123, "status": "PAID", "amount": "60000.00", "transferReference": "FT...", "paidAt": "..." },
    "bankAccount": { "bankCode": "MBBank", "accountNumber": "0123456789", "accountName": "NGUYEN VAN A" },
    "hold": { "id": 9, "status": "CAPTURED", "capturedAt": "..." },
    "ledgerEntry": { "entryType": "WITHDRAWAL", "amount": "-60000.00", "balanceAfter": "40000.00", "createdAt": "..." },
    "settlementEvents": [
      {
        "provider": "SEPAY_BANKHUB",
        "providerTransactionId": "a41c9e02-...",
        "referenceCode": "FT...",
        "transferType": "debit",
        "amount": "60000.00",
        "content": "PAYOUT-123",
        "receivedAt": "..."
      }
    ]
  }
  ```
- `GET /api/v1/wallet/ledger?limit=50` (owner) để hiển thị lịch sử ví.
- Dev-only retry: `POST /api/v1/wallet/payouts/:id/settle` (owner, non-production) để enqueue lại job khi demo lỗi.

### 7.8 Admin API

- Xóa `POST /admin/wallet/payouts/:id/approve` (`adminWalletRoutes.ts:19`, `AdminWalletController.approve`).
- Bỏ `APPROVED` khỏi `adminPayoutListQuerySchema` và type query.
- Giữ `paid`/`reject`.
- (Tuỳ chọn) `GET /admin/wallet/payouts/:id/proof` dùng chung service.

## 8. Frontend

`frontend/src/features/wallet/`
- `types.ts`:
  - `PayoutStatus` bỏ `APPROVED`.
  - Thêm type `PayoutProof`, `WalletLedgerEntry`.
- `WalletPage.tsx`:
  - `PAYOUT_LABELS`: `PENDING = "Đang chuyển khoản"`, `PAID = "Đã chuyển khoản"`, `REJECTED`, `FAILED`.
  - Bỏ nhánh notice `APPROVED` (`:156-158`).
  - Sau khi tạo withdrawal, poll `GET /wallet/payouts/:id/proof` mỗi 1-2s đến khi `PAID/FAILED` (giống poll top-up `:82-102`).
  - Danh sách payout hiển thị tài khoản đích (map `bankAccountId` với `bankAccounts`) và nút **"Xem chứng từ"**.
  - Modal chứng từ: mã yêu cầu, số tiền, tài khoản đích, trạng thái, mã giao dịch Bank Hub, mã tham chiếu, thời gian, bút toán ví.
  - Thêm tab **"Lịch sử ví"** gọi `/wallet/ledger`.
  - Copy `:310` đổi thành: "Tiền được giữ và tự động chuyển khoản đến tài khoản đã chọn."
- `wallet-api.ts`: thêm `getPayoutProof(id)`, `getLedger()`, `retryPayout(id)` (dev).

## 9. Chứng minh giao dịch (demo evidence)

Chuỗi chứng cứ bắt buộc trong demo:

| Bằng chứng | Nguồn | Kỳ vọng |
| --- | --- | --- |
| Yêu cầu rút | `wallet_payout_requests` | `status=PAID`, `amount`, `bank_account_id`, `paid_at` |
| Tài khoản đích | `wallet_bank_accounts` | đúng bank/account/name user chọn |
| Hold | `wallet_holds` | `status=CAPTURED`, `captured_at` |
| Bút toán ví | `wallet_ledger_entries` | `entry_type=WITHDRAWAL`, `amount=-X`, `reference_id=payout.id`, `balance_after` |
| Giao dịch Bank Hub | `wallet_payout_settlement_events` | `transaction_id`, `reference_code`, `amount`, `content=PAYOUT-<id>` |
| Gửi lệnh | `wallet_payout_settlement_jobs` | `status=SENT`, `provider_transaction_id` |
| Đối soát | `GET /api/v1/admin/wallet/reconciliation` | `paid_count/paid_amount` khớp ledger |
| API proof | `GET /api/v1/wallet/payouts/:id/proof` | trả đủ các mục trên |

Ngoài ra, chụp màn hình **SePay Bank Hub sandbox → Transactions** với `transaction_id` khớp event.

## 10. Tests

### Unit
- `sepayBankHub.client.test.ts`: token Basic auth đúng; cache/refresh; body debit đúng; timeout; lỗi map mã.
- Worker: claim job, gọi client, `SENT`; lỗi → `FAILED`, payout vẫn `PENDING`.

### Integration
- `wallet-payout.test.ts` cập nhật:
  - Bỏ mọi `approve`; `markPaid` từ `PENDING`.
  - Xóa test auto-approve.
  - Webhook Payment Gateway: `PENDING → PAID`.
  - Bank Hub IPN: auth đúng/sai; dedupe `transaction_id`; amount mismatch; `PAID` idempotent.
  - Full flow: tạo withdrawal → job → mock client → fake IPN → `PAID`, ví trừ một lần, hold captured, ledger + event đúng.
- API:
  - `/approve` trả 404.
  - `/proof` chỉ owner/admin; trả đủ dữ liệu.
  - `/ledger` trả entries.
- Production guard: `NODE_ENV=production` + `SEPAY_BANKHUB_ENABLED=true` → fail-fast.
- Chạy:
  ```bash
  npm test --prefix backend -- --run src/__tests__/wallet-payout.test.ts
  npm test --prefix backend
  npm run build --prefix backend
  ```

## 11. Demo script

Tạo `docs/demo/withdrawal-sepay-bankhub.md` gồm:

1. Chuẩn bị:
   - `.env` dev theo [hướng dẫn setup](../guides/sepay-bankhub-sandbox-setup.md).
   - Chạy `cloudflared tunnel` hoặc `ngrok`; cấu hình IPN URL Bank Hub trỏ về `/api/v1/payments/sepay-bankhub/ipn`.
2. Nạp ví demo (mock top-up hoặc admin credit).
3. Thêm tài khoản nhận.
4. Tạo withdrawal.
5. Quan sát worker log gửi Bank Hub; lấy `transaction_id`.
6. Quan sát IPN log; kiểm tra job `SENT`.
7. Gọi `GET /wallet/payouts/:id/proof` và đối chiếu bảng chứng cứ.
8. Chụp màn hình SePay Bank Hub transaction + proof API/UI.
9. Kỳ vọng: `status=PAID`, số dư giảm đúng, ledger `WITHDRAWAL`, event khớp `transaction_id`.

## 12. Verification

```bash
npm run db:generate --prefix backend
npm run verify:migrations --prefix backend
npm test --prefix backend -- --run src/__tests__/wallet-payout.test.ts
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

Checklist thủ công:
- [ ] Tạo withdrawal không còn gọi `/approve`.
- [ ] Không còn `APPROVED` trong DB/API/UI.
- [ ] Job được enqueue và gửi Bank Hub.
- [ ] IPN xác thực `Apikey`, dedupe `transaction_id`.
- [ ] Ví trừ đúng một lần; hold `CAPTURED`.
- [ ] Proof API/UI hiển thị đủ chứng cứ.
- [ ] `OWNER_PAYOUT` vẫn không auto-settle.

## 13. Rủi ro & cách giảm

| Rủi ro | Cách giảm |
| --- | --- |
| Chưa có Bank Hub sandbox | Kiểm tra trước; fallback B2 CLI (ngoài kế hoạch này) |
| IPN không tới do localhost | Dùng ngrok/cloudflared; log + retry job |
| Gửi simulate trùng | Job unique theo payout; payout `PAID` idempotent; event dedupe |
| Crash sau khi gọi Bank Hub nhưng trước khi update job | Worker kiểm tra payout `PAID` trước khi gửi; retry an toàn |
| Lộ token/secret | Chỉ server-side; không log header; so sánh constant-time |
| Quota 500/ngày | Dùng tài khoản test riêng, dọn giao dịch |
| Hiểu nhầm là tiền thật | UI ghi rõ "SePay Bank Hub sandbox (giả lập)"; tài khoản đích là ghi nhận nội bộ |
| Production vô tình bật | Fail-fast nếu `NODE_ENV=production` |

## 14. Câu hỏi mở

1. Đã có tài khoản **SePay Bank Hub sandbox** (`client_id`/`client_secret` + `bank_account_xid` + IPN API key) chưa?
2. Có sẵn tunnel public (ngrok/cloudflared) cho IPN trong lúc demo không?
3. Xác nhận `OWNER_PAYOUT` vẫn để Admin mark paid, chỉ auto `WITHDRAWAL`?
4. Có cần thêm "Lịch sử ví" tab trong demo, hay chỉ modal chứng từ là đủ?


## Admin alerts note — 2026-11-18

- Auto-settle to `PAID` does not emit `ADMIN_PAYOUT_PENDING`.
- `ADMIN_PAYOUT_PENDING` only fires when the request is left `PENDING` (e.g. `OWNER_PAYOUT`, or auto-approve disabled).
- Outgoing-webhook amount/state failures emit `ADMIN_PAYOUT_FAILED` best-effort and then keep the existing error response.
