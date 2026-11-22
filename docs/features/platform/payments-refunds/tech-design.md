# Payments & Refunds — Technical Design

## Phạm vi thay thế và trạng thái thiết kế — 2026-11-08

Quyết định nghiệp vụ mới: **Admin quản lý thanh toán và ví ảo chung toàn sàn; mỗi người dùng có một ví**. Người dùng thanh toán bằng số dư ví; nếu thiếu tiền thì nạp thêm rồi thanh toán. Court Owner quản lý sân và vận hành booking, không quản lý hệ thống ví/thanh toán toàn sàn. Không đưa Split Bill vào phạm vi này.

Quyết định này thay thế yêu cầu cũ loại ví khỏi MVP và luồng bắt buộc trả trực tiếp qua VNPAY cho từng booking/lệ phí. VNPAY/mock hiện có là hiện trạng triển khai, không chứng minh luồng ví đã hoàn thành. Phương thức nạp, rút tiền, chuyển/đối soát tiền cho chủ sân, phí, hạn mức và chính sách hoàn về ví hay nguồn nạp: **TBD**. Giữ các điều kiện hủy/hoàn của nghiệp vụ trừ khi có quyết định thay thế; không tự chuyển tiền thực trong lần cập nhật tài liệu này.

Nội dung cũ trái với mục này là thiết kế legacy. Quyết định nghiệp vụ do người dùng xác nhận ngày 2026-11-08; thiết kế API/schema mới và các TBD chưa được duyệt Ready. Chưa triển khai thay đổi trong lần sửa tài liệu này.

## G0 decisions — 2026-11-15

- **D3 refund persistence:** use a new `PAYMENT_REFUNDS` table (one payment may have multiple attempts) with status, attempt count, last error, claimed_at and completed_at. PAY-04 owns the detailed columns, indexes, migration and `database-schema.md` Change Log.
- **D4 SePay sandbox:** VNPAY sandbox is superseded. SePay Payment Gateway is the nạp ví provider; code/test offline + Mock E2E, SePay sandbox checkout/IPN is a release gate only.
- **D9 virtual wallet (SePay):** wallet is in the release. Users pay bookings/registrations from wallet balance; **SePay Payment Gateway** is used only for top-up. Withdrawal/payout is Admin-approved manual bank transfer, not automatic. Refunds go to the wallet. No platform fee and no limit in MVP. Admin may credit/debit a wallet only with a reason and an append-only audit row.

---

## Khóa thay đổi thành viên kèo sau thanh toán — 2026-11-08

Theo yêu cầu sửa lỗi của người dùng và [Matchmaking Tech Design](../../matchmaking/matchmaking/tech-design.md), Payments cung cấp `BookingPaymentGuard` nhận transaction của caller. Guard khóa booking theo id tăng dần (rank 80), cùng khóa mà `processMockPaymentConfirm` lấy trước khi ghi payment. Sau đó kiểm tra mọi payment attempt của các booking liên quan: `paid_at` đã có hoặc trạng thái SUCCESS/REFUND_PENDING/REFUNDED/REFUND_FAILED đều khóa rút/loại. Hoàn tiền không xóa mốc khóa; payment mới đang PENDING không che lịch sử cũ. Matchmaking gọi guard sau các ghi roster/Match/job và trước thu hồi chat; nếu bị khóa, toàn bộ transaction rollback. Callback thanh toán bổ sung trong tương lai phải tuân thủ cùng khóa booking trước ghi payment. Không thay đổi luồng ví hoặc cơ chế thanh toán trong phạm vi này.

## Status and Ownership

```text
Status: Ready
Owner: Tech Lead
Related PRD: docs/features/platform/payments-refunds/prd.md
```

> Ready: reviewed and approved by the human owner on 2026-09-25 (Phase 1 review). On 2026-10-04 the human owner approved a development-only mock provider built before the VNPAY sandbox.

## SePay integration — 2026-11-15

SePay bank webhook + VietQR is the top-up provider; VNPAY/Payment Gateway is legacy.

- Top-up: create `wallet_top_ups` row with unique `txn_ref` and return dynamic VietQR (`vietqr.app/img` or `SEPAY_QR_BASE_URL`) plus bank code/account/name/amount/content.
- Webhook: `POST /api/v1/payments/sepay/bank-webhook`, raw JSON body. Verify `X-SePay-Signature: sha256={HMAC_SHA256(secret, `${X-SePay-Timestamp}.${rawBody}`)}`, reject timestamp older than 5 minutes.
- Payload: `id`, `gateway`, `accountNumber`, `code`, `content`, `transferType=in`, `transferAmount`, `referenceCode`. Match `code` or `TOPUP-*` in content, then amount; credit wallet once with ledger idempotency `wallet-topup:<id>`.
- Return HTTP 200 `{ "success": true }`; invalid HMAC 401; unknown/mismatched top-up 400/404.
- Env: `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_NAME`, `SEPAY_QR_BASE_URL`.
- Payout: no automated provider payout; Owner payout request + Admin manual transfer.

## 1. Architecture & Module Boundaries

`PaymentModule` is a platform capability consumed by Booking and Tournament. It owns the `PAYMENTS` table, the provider adapter, callback handling, and refund execution. It does not own Booking or Tournament lifecycle state; it confirms the owning domain through an explicit callback contract.

The provider interaction is behind a `PaymentProvider` interface with two adapters: `VNPAY` (production) and `MOCK` (development/test only, selected by configuration and never enabled in production). Both adapters funnel through the same idempotent confirmation path, so switching adapters does not change owning-domain behavior.

- **BookingModule**: creates a `PENDING_PAYMENT` Booking hold and confirms it on successful payment.
- **TournamentModule**: creates a `PENDING_PAYMENT` registration and confirms it on successful payment.
- **PaymentModule**: payment creation, provider interaction, callback validation, refunds.
- **NotificationModule**: notifies Players of payment/refund outcomes where required by the owning domain.

The cross-module interfaces are declared in `backend/src/contracts/PaymentService.ts` (consumed by Booking and Tournament) and `backend/src/contracts/BookingService.ts` (`confirmBooking`, implemented by Booking and invoked on successful payment).

## 2. Payment Lifecycle

Governed by `PAYMENTS.status`.

```text
PENDING
  ├── SUCCESS
  │     └── REFUND_PENDING
  │           ├── REFUNDED
  │           └── REFUND_FAILED
  ├── FAILED
  └── EXPIRED
```

- `EXPIRED` is reached when the owning entity's payment window elapses before a successful callback.
- A late valid callback for an `EXPIRED` payment must not change the owning entity; if the provider charged, an `EXPIRED → SUCCESS → REFUND_PENDING → REFUNDED` path is used only for refunding, never to reopen the entity.

## 3. API Design

Namespaced under `/api/v1`.

### 3.1 Payment Creation
- `POST /api/v1/bookings/:booking_id/payment` - Create/reuse the VNPAY URL for a `PENDING_PAYMENT` Booking (Auth: booking owner).
- `POST /api/v1/registrations/:registration_id/payment` - Create/reuse the VNPAY URL for a `PENDING_PAYMENT` registration (Auth: owning Player or Team captain). This endpoint is also listed in the Tournament Tech Design §3.2; this platform document owns the shared payment contract.
- `GET /api/v1/payments/:payment_id` - Payment status (Auth: owner/participant or Admin).

### 3.2 Provider Callback
- `POST /api/v1/payments/vnpay/webhook` - VNPAY IPN endpoint.

Callback contract:
- Reads the `vnp_*` parameters from the request.
- Validates `vnp_SecureHash` using `VNPAY_HASH_SECRET`; on failure responds `400 PAYMENT_SIGNATURE_INVALID` without processing.
- Maps the payment by the local reference carried in `vnp_TxnRef`.
- On a valid, not-yet-processed success callback: transition the payment to `SUCCESS`, then confirm the owning entity idempotently.
- On an already-processed callback: return success without a second effect.
- Returns the provider acknowledgement shape expected by VNPAY (`RspCode`/`Message`); the exact contract is confirmed during implementation and must not leak internal details.

### 3.3 API Contract
- Successful responses use `{ data: ... }`; errors use `{ error: { code, message, details } }`.
- Creation returns `201`/`200` as appropriate; commands return `200`.
- Provider responses, signatures, SQL, and secrets are never returned to clients.

## 4. Data / Schema Impact

- Uses `PAYMENTS` (`database-schema.md` §3.10): `booking_id` nullable, `registration_id` nullable, exactly-one CHECK, `transaction_id` unique when present, `status`, `paid_at`.
- `amount` is the full payable amount for the owning entity and is immutable after `SUCCESS`.
- `paid_at` records when funds were collected. A later refund changes `status` but does not rewrite `paid_at`, so the collection time remains available for reporting and reconciliation.
- No new table is required for MVP.

## 5. Security & Authorization

- Authentication follows `docs/architecture/tech-stack.md` and the Auth Tech Design; payment callbacks are authenticated by provider signature, not by session.
- Only the owning Player/captain or an Admin may read a payment.
- Payment creation is rejected unless the owning entity is in a payable state (`PENDING_PAYMENT`).
- Provider credentials are configuration only.

## 6. Validation Rules

- A payment references exactly one of `booking_id`/`registration_id` (database CHECK).
- `amount > 0` and equals the owning entity's snapshotted payable amount.
- Payment creation is rejected for entities not in `PENDING_PAYMENT`.
- A refund is only allowed from `SUCCESS`.

## 7. Concurrency & Idempotency

- Callback processing is idempotent: the transition to `SUCCESS` and the owning-entity confirmation happen in one transaction guarded by the payment status.
- Refund initiation claims the payment with a status transition (`SUCCESS → REFUND_PENDING`) so concurrent workers cannot double-refund.
- Database row locking/claiming is used; in-memory state is never the coordination source.

## 8. Failure Handling & Edge Cases

- **Invalid signature**: reject, log securely, no state change.
- **Provider timeout/unavailable**: the payment stays `PENDING`; the owning entity expires on its own timeout.
- **Late payment after expiry**: never reopen; refund if charged.
- **Duplicate callback**: no second effect.
- **Refund failure**: `REFUND_PENDING → REFUND_FAILED`, observable for retry/manual handling within `REFUND_PROCESSING_TIMEOUT_MINUTES`.

## 9. Events & Background Jobs

- Consumers emit domain events: `BookingCancelled`, `OwnerBookingCancelled`, `TournamentCancelled`, `RegistrationWithdrawn`.
- A refund worker (in-process scheduler, database claiming) processes events, initiates VNPAY refunds idempotently, and respects the refund timeout.
- Refund status changes are persisted for observability.

## 10. Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `REFUND_ENABLED` | `true` | Enable the refund flow |
| `REFUND_PROCESSING_TIMEOUT_MINUTES` | `1440` | Refund processing timeout |
| `PAYMENT_PROVIDER` | `VNPAY` | Active provider adapter: `VNPAY` (production) or `MOCK` (development/test only). |

VNPAY credentials/URLs (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`) are environment configuration, never source code. The `MOCK` adapter requires no credentials.

Implementation order (approved 2026-10-04): build the `MOCK` adapter first to unblock Booking/Matchmaking/Tournament, then the VNPAY sandbox adapter. Payment initialization returns a mock confirmation URL under `MOCK`; the mock resolves through the same idempotent confirmation path as a real callback.

## 11. Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `PAYMENT_NOT_FOUND` | 404 | Payment id does not exist or is not visible. |
| `PAYMENT_NOT_PAYABLE` | 409 | The owning entity is not in a payable state. |
| `PAYMENT_ALREADY_PROCESSED` | 409 | The payment was already finalized. |
| `PAYMENT_SIGNATURE_INVALID` | 400 | Provider callback signature is invalid. |
| `PAYMENT_PROVIDER_ERROR` | 502 | The provider could not be reached or returned an error. |
| `REFUND_NOT_ALLOWED` | 409 | Refund requested from a non-`SUCCESS` payment. |
| `REFUND_ALREADY_PROCESSED` | 409 | Refund already initiated for the payment. |

## 12. Testing Strategy

- Unit: signature verification, status mapping, amount validation; mock adapter resolves through the shared confirmation path.
- Integration: transactional callback idempotency; refund claiming under concurrency; `MOCK` provider enabled for end-to-end tests.
- API-level: callback contract, error codes, no leakage.
- Edge: duplicate callbacks, late payment after expiry, refund timeout boundary.

## Matchmaking cancellation integration — approved 2026-10-10

Status: Ready (Human owner). Matchmaking cancellation work invokes Booking, not
Payment directly. Booking cancellation durably requests refund using the existing
Payment lifecycle and policy. Persist refund work in the same cancellation
transaction, claim in DB and retry idempotently; no in-memory event is the sole
source of recovery. Duplicate Match/Booking cancellations never issue a second
refund. Owner can see pending/failed cancellation/refund outcomes. Matchmaking
must never refund a booking merely because its Match status changed if Booking
policy rejected cancellation.
