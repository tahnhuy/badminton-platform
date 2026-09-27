# Payments & Refunds — Technical Design

## Status and Ownership

```text
Status: Ready
Owner: Tech Lead
Related PRD: docs/features/platform/payments-refunds/prd.md
```

> Ready: reviewed and approved by the human owner on 2026-09-25 (Phase 1 review).

## 1. Architecture & Module Boundaries

`PaymentModule` is a platform capability consumed by Booking and Tournament. It owns the `PAYMENTS` table, the VNPAY provider adapter, callback handling, and refund execution. It does not own Booking or Tournament lifecycle state; it confirms the owning domain through an explicit callback contract.

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

VNPAY credentials/URLs (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`) are environment configuration, never source code.

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

- Unit: signature verification, status mapping, amount validation.
- Integration: transactional callback idempotency; refund claiming under concurrency.
- API-level: callback contract, error codes, no leakage.
- Edge: duplicate callbacks, late payment after expiry, refund timeout boundary.
