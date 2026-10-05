# Payments & Refunds — Task List

Implementation tasks for the Payments & Refunds platform capability.

- Linked PRD: [prd.md](./prd.md)
- Linked Tech Design: [tech-design.md](./tech-design.md)
- Task status values
  - `BLOCKED`: cannot start; the blocker is named.
  - `Approved`: the governing documents are `Ready`; execution moves through `IN_PROGRESS` and `DONE`.
    Tasks implementing authenticated endpoints stay `BLOCKED` until the Auth module lands.

**Definition of Done:** the task's acceptance criteria pass and the required verification under "Verification" is complete.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| PAY-01 | Payment configuration and VNPAY adapter/signature utility | Approved | — | M |
| PAY-02 | Payment initialization for Booking and registration | BLOCKED | PAY-01, Auth | M |
| PAY-03 | VNPAY webhook and idempotent confirmation | BLOCKED | PAY-02 | L |
| PAY-04 | Refund service, worker, and timeout | BLOCKED | PAY-03 | L |
| PAY-05 | Payment and refund test coverage | BLOCKED | PAY-02, PAY-03, PAY-04 | M |
| PAY-06 | Development-only mock provider adapter | Approved | PAY-01 | S |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | PAY-01 | PRD/Tech Design Ready |
| 1b | PAY-06 | PAY-01 (build this first to unblock other domains) |
| 2 | PAY-02 | PAY-01, PAY-06 |
| 3 | PAY-03 | PAY-02 |
| 4 | PAY-04, PAY-05 | PAY-03 |

---

## [ ] PAY-01: Payment configuration and VNPAY adapter/signature utility

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Provide the confirmed VNPAY configuration boundary and a testable signature utility.

**Scope**

- In scope:
  - Config keys `REFUND_ENABLED`, `REFUND_PROCESSING_TIMEOUT_MINUTES`, and VNPAY credentials/URLs.
  - Provider adapter interface and VNPAY signature building/verification.
- Out of scope:
  - Persistence and endpoints.

**Implementation requirements**

1. Read configuration through the centralized config boundary; fail clearly if required VNPAY values are missing.
2. Implement signature build/verify with a pure, unit-testable function.
3. Keep secrets out of logs and responses.

**Files/areas affected**

- `backend/src/services/payments/` (provider adapter, signature)
- `[Proposed — verify during implementation] centralized config boundary (planned by the Auth tasks)`

**API impact:** None.

**Schema/config impact:** Adds/validates payment configuration keys.

**Verification**

- Unit: signature build and verify, including tampered/duplicate keys.
- Integration: N/A
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: missing config fails safely.
- Manual: N/A

**Acceptance criteria**

- **Given** valid VNPAY configuration
  **When** a callback payload is signed and verified
  **Then** verification succeeds and a tampered payload fails.

---

## [ ] PAY-02: Payment initialization for Booking and registration

```text
Status: BLOCKED
Size: M
Blocked by: PAY-01, Auth module
```

**Objective:** Create/reuse a `PAYMENTS` record and return a VNPAY payment URL for a payable entity.

**Scope**

- In scope:
  - `POST /api/v1/bookings/:booking_id/payment` and `POST /api/v1/registrations/:registration_id/payment`.
  - Exactly-one linkage and amount validation.
- Out of scope:
  - Callback processing and refunds.

**Implementation requirements**

1. Reject entities not in `PENDING_PAYMENT` with `PAYMENT_NOT_PAYABLE`.
2. Persist `amount` equal to the owning entity's snapshotted amount.
3. Return the VNPAY redirect URL; reuse an existing `PENDING` payment when present.

**Files/areas affected**

- `backend/src/services/payments/`
- Booking/Tournament services for the payable-state check

**API impact:** Payment-initialization endpoints.

**Schema/config impact:** Writes `PAYMENTS` rows.

**Verification**

- Unit: payable-state and amount rules.
- Integration: existing pending payment is reused, not duplicated.
- API-level: `404`/`409` for missing/non-payable entities.
- E2E for a critical flow: start payment for a booking and a registration.
- Edge/failure/concurrency: two concurrent creates produce one usable payment.
- Manual: N/A

**Acceptance criteria**

- **Given** a `PENDING_PAYMENT` entity
  **When** payment is requested
  **Then** a `PENDING` payment with the correct amount and redirect URL is returned.
- **Given** a confirmed entity
  **When** payment is requested
  **Then** the API returns `409 PAYMENT_NOT_PAYABLE`.

---

## [ ] PAY-03: VNPAY webhook and idempotent confirmation

```text
Status: BLOCKED
Size: L
Blocked by: PAY-02
```

**Objective:** Validate VNPAY callbacks and confirm the owning entity exactly once.

**Scope**

- In scope:
  - `POST /api/v1/payments/vnpay/webhook`.
  - Signature validation, mapping, idempotent success, late-payment handling.
- Out of scope:
  - Refund execution.

**Implementation requirements**

1. Validate the signature before any state change.
2. In one transaction, transition the payment and confirm the Booking/registration idempotently.
3. Never reopen an expired entity; flag a refund when the provider charged.
4. Return the provider acknowledgement shape.

**Files/areas affected**

- `backend/src/services/payments/`
- Booking/Tournament confirmation contracts

**API impact:** VNPAY webhook.

**Schema/config impact:** Updates `PAYMENTS.status`/`paid_at`.

**Verification**

- Unit: signature/status mapping.
- Integration: duplicate callback has no second effect; late callback does not reopen.
- API-level: invalid signature → `400 PAYMENT_SIGNATURE_INVALID`.
- E2E for a critical flow: pay and see the entity confirmed.
- Edge/failure/concurrency: parallel duplicate callbacks confirm once.
- Manual: N/A

**Acceptance criteria**

- **Given** a valid success callback for a pending payment
  **When** it is processed
  **Then** the payment is `SUCCESS` and the entity is confirmed once.
- **Given** the same callback replayed
  **When** it is processed again
  **Then** no second effect occurs.

---

## [ ] PAY-04: Refund service, worker, and timeout

```text
Status: BLOCKED
Size: L
Blocked by: PAY-03
```

**Objective:** Execute 100% refunds for approved cancellations idempotently and observably.

**Scope**

- In scope:
  - Consume `BookingCancelled`, `OwnerBookingCancelled`, `TournamentCancelled`, `RegistrationWithdrawn`.
  - `SUCCESS → REFUND_PENDING → REFUNDED | REFUND_FAILED`.
  - `REFUND_PROCESSING_TIMEOUT_MINUTES` handling.
- Out of scope:
  - A standalone refund-management module.

**Implementation requirements**

1. Claim the payment via a status transition before calling the provider.
2. Initiate the refund through the VNPAY adapter; persist the outcome.
3. Respect `REFUND_ENABLED`; leave `REFUND_PENDING` observable past the timeout.

**Files/areas affected**

- `backend/src/services/payments/`
- `backend/src/jobs/` or `backend/src/workers/`

**API impact:** None.

**Schema/config impact:** Updates `PAYMENTS.status`.

**Verification**

- Unit: timeout boundary and event mapping.
- Integration: DB claiming prevents double refund.
- API-level: N/A
- E2E for a critical flow: cancelled paid booking/registration is refunded once.
- Edge/failure/concurrency: two workers process one refund exactly once.
- Manual: provider sandbox refund verified.

**Acceptance criteria**

- **Given** an approved paid cancellation
  **When** the refund worker runs
  **Then** the payment reaches `REFUNDED` exactly once.
- **Given** `REFUND_ENABLED = false`
  **When** a cancellation occurs
  **Then** no refund is initiated and the event stays observable.

---

## [ ] PAY-05: Payment and refund test coverage

```text
Status: BLOCKED
Size: M
Blocked by: PAY-02, PAY-03, PAY-04
```

**Objective:** Provide integration/API coverage for the payment and refund lifecycle.

**Scope**

- In scope:
  - Callback idempotency, late payment, refund uniqueness, authorization.
- Out of scope:
  - Provider certification/testing beyond a sandbox or mock.

**Implementation requirements**

1. Mock or sandbox the provider; never call production.
2. Cover success, validation failure, duplicate, and concurrency paths.

**Files/areas affected**

- `backend/src/__tests__/` or feature test folder

**API impact:** None.

**Schema/config impact:** Test database only.

**Verification**

- Unit: covered by PAY-01.
- Integration: callback and refund workflows against PostgreSQL.
- API-level: webhook and initialization contracts.
- E2E for a critical flow: pay → confirm → cancel → refund.
- Edge/failure/concurrency: duplicates and parallel workers.
- Manual: N/A

**Acceptance criteria**

- **Given** the full payment/refund flow
  **When** the test suite runs
  **Then** duplicate and concurrent scenarios produce exactly one effect.

---

## [ ] PAY-06: Development-only mock provider adapter

```text
Status: Approved
Size: S
Blocked by: N/A
```

**Objective:** Provide a `MOCK` `PaymentProvider` adapter so Booking, Matchmaking, and Tournament can be built and demoed before VNPAY sandbox is ready (Tech Design §1, §10; PRD §14).

**Scope**

- In scope:
  - `PaymentProvider` interface and the `MOCK` adapter selected by `PAYMENT_PROVIDER`.
  - Mock confirmation that resolves through the same idempotent confirmation path as a real callback.
- Out of scope:
  - The VNPAY adapter (PAY-01/PAY-03); production enablement of the mock.

**Implementation requirements**

1. `PAYMENT_PROVIDER` (`MOCK` | `VNPAY`, default `VNPAY`) selects the adapter.
2. The mock requires no credentials and returns a confirmation path the frontend can follow in development.
3. The mock must be disabled outside development/test; enabling it in production is rejected at configuration load.
4. Confirmation still transitions the owning entity exactly once.

**Files/areas affected**

- `backend/src/services/payments/`, `backend/src/contracts/PaymentService.ts` `[Proposed — verify during implementation]`
- `backend/src/shared/config/env.ts` (`PAYMENT_PROVIDER`)

**API impact:** None (adapter selection only).

**Schema/config impact:** Adds `PAYMENT_PROVIDER`.

**Verification**

- Unit: adapter selection; mock disabled in production.
- Integration: mock payment confirms Booking/registration idempotently.

**Acceptance criteria**

- **Given** `PAYMENT_PROVIDER = MOCK` in development
  **When** a Booking or registration payment is initiated and the mock confirmation is followed
  **Then** the owning entity is confirmed exactly once.
- **Given** `PAYMENT_PROVIDER = MOCK` in production
  **When** configuration loads
  **Then** startup fails with a clear message.
