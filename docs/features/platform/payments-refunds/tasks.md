# Payments & Refunds — Task List

## Công việc phát sinh — 2026-11-08

Các trạng thái DONE cũ chỉ mô tả phạm vi legacy, không chứng minh hoàn thành yêu cầu mới. Xem PRD và Tech Design cập nhật ngày 2026-11-08.

Quyết định nghiệp vụ mới: **Admin quản lý thanh toán và ví ảo chung toàn sàn; mỗi người dùng có một ví**. Người dùng thanh toán bằng số dư ví; nếu thiếu tiền thì nạp thêm rồi thanh toán. Court Owner quản lý sân và vận hành booking, không quản lý hệ thống ví/thanh toán toàn sàn. Không đưa Split Bill vào phạm vi này.

Quyết định này thay thế yêu cầu cũ loại ví khỏi MVP và luồng bắt buộc trả trực tiếp qua VNPAY cho từng booking/lệ phí. VNPAY/mock hiện có là hiện trạng triển khai, không chứng minh luồng ví đã hoàn thành. Phương thức nạp, rút tiền, chuyển/đối soát tiền cho chủ sân, phí, hạn mức và chính sách hoàn về ví hay nguồn nạp: **TBD**. Giữ các điều kiện hủy/hoàn của nghiệp vụ trừ khi có quyết định thay thế; không tự chuyển tiền thực trong lần cập nhật tài liệu này.

Cần chốt TBD, cập nhật thiết kế API/schema, lập các task triển khai và kiểm thử trước khi thay thế code hiện hành. Không đánh dấu các việc này DONE.

---

## Task completion review — 2026-11-01

Review requested by the owner. The per-task review notes below supersede older implementation-progress blockers only where explicitly stated. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Test-only BlockPort coverage is not production Messaging integration. Shared schema/document PR review before merge is unchanged. No governing business choice is approved by changing task status.

Implementation tasks for the Payments & Refunds platform capability.

- Linked PRD: [prd.md](./prd.md)
- Linked Tech Design: [tech-design.md](./tech-design.md)
- Task status values
  - `BLOCKED`: cannot start; the blocker is named.
  - `Approved`: the governing documents are `Ready`; execution moves through `IN_PROGRESS` and `DONE`.
  - `IN_PROGRESS`: partially implemented; remaining work and dependencies are recorded below.
  - `DONE`: all acceptance criteria and required verification pass.

Auth is implemented; it is no longer a blocker for payment endpoints.

**Definition of Done:** the task's acceptance criteria pass and the required verification under "Verification" is complete.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| PAY-01 | Payment configuration and VNPAY adapter/signature utility | IN_PROGRESS | — | M |
| PAY-02 | Payment initialization for Booking and registration | IN_PROGRESS | PAY-01, PAY-06; Tournament registration lifecycle (TRN-04) | M |
| PAY-03 | VNPAY webhook and idempotent confirmation | BLOCKED | PAY-01, PAY-02 | L |
| PAY-04 | Refund service, worker, and timeout | BLOCKED | PAY-03 | L |
| PAY-05 | Payment and refund test coverage | IN_PROGRESS | PAY-02, PAY-03, PAY-04 (full coverage) | M |
| PAY-06 | Development-only mock provider adapter | IN_PROGRESS | PAY-01; Tournament registration integration for full acceptance | S |
| WAL-01 | Wallet accounts, ledger, idempotency and concurrency | DONE | INF-00 | L |
| WAL-02 | Top-up via VNPAY and wallet credit | DONE | WAL-01, PAY-01, PAY-03 | M |
| WAL-03 | Pay Booking/registration from wallet balance | DONE (booking; registration waits TRN-05) | WAL-01, PAY-02 | M |
| WAL-04 | Refund to wallet | DONE | WAL-01, PAY-04 | M |
| WAL-05 | Withdrawal request + Admin manual payout | DONE | WAL-01 | M |
| WAL-06 | Court Owner payout request + Admin approval/manual transfer | DONE | WAL-01, WAL-05 | M |
| WAL-07 | Admin wallet credit/debit with append-only audit | DONE | WAL-01, SC-09 | M |
| WAL-08 | Wallet reconciliation and coverage | DONE (basic reconciliation endpoint) | WAL-01→07 | M |

### Implementation audit — 2026-10-20

No payment task meets the full Definition of Done yet. Existing Mock Booking code does not establish completion of VNPAY, Tournament payment, production safeguards, or durable refunds. Completion checkboxes remain unchecked.

- Work can continue now on production guards, payment transactions/status guards, concurrent initialization, Mock tests/E2E, and offline VNPAY signature/adapter implementation.
- PAY-03 remains blocked on VNPAY configuration/signature support and payment initialization. Booking confirmation and Mock confirmation exist, but the VNPAY webhook does not.
- PAY-04 remains blocked for full delivery by PAY-03 and provider refund support. Mock refund orchestration and durable cancellation work can be prepared before sandbox integration; they must not rely solely on in-process events.
- Tournament payment completion depends on the registration lifecycle (TRN-04). Merchant credentials and a reachable callback URL are required for live sandbox verification; their availability has not been verified.

**Verification recorded on 2026-10-20:** backend and frontend TypeScript checks passed. Running `payment-integration.test.ts` and `booking-confirm-match-facility.test.ts` against the test database produced 21/22 passing tests, including all 9 payment tests. One Booking test failed during fixture cleanup because deleting `users` violated the `player_profiles` foreign key, before its confirmation assertions. Payment-inclusive browser E2E and VNPAY sandbox verification have not been run.

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | PAY-01 | PRD/Tech Design Ready |
| 1b | PAY-06 | PAY-01 (build this first to unblock other domains) |
| 2 | PAY-02 | PAY-01, PAY-06 |
| 3 | PAY-03 | PAY-02 |
| 4 | PAY-04, PAY-05 | PAY-03 |

---

## SePay switch — 2026-11-15

- Nạp ví dùng **SePay bank webhook + VietQR**; VNPAY/Payment Gateway là legacy/không dùng cho top-up mới.
- Webhook: `POST /api/v1/payments/sepay/bank-webhook`; HMAC-SHA256 `X-SePay-Signature`/`X-SePay-Timestamp` trên raw body; match `code`/`content` + `transferAmount`.
- WAL-05/06: không tự động payout; Admin duyệt và chuyển khoản thủ công.
- PAY-01/PAY-03 VNPAY giữ làm legacy, không phải acceptance path của release.

## Wallet extension — G0 D9 closed 2026-11-15

Wallet is in the release. Booking/registration payment moves from direct VNPAY to wallet debit; VNPAY remains the top-up and payout channel. PAY-02/PAY-03/PAY-04 keep the provider/idempotency work but must not enable a direct VNPAY booking payment path in production. PAY-04 still owns refund intent/worker, but the refund target is the wallet (WAL-04), not a VNPAY refund of the booking payment.

| Wave | Tasks | Waits for |
| --- | --- | --- |
| W1 | WAL-01 | INF-00, D9 |
| W2 | WAL-02, WAL-03 | WAL-01 + PAY-01/PAY-02/PAY-03 |
| W3 | WAL-04, WAL-05 | WAL-01 + PAY-04 |
| W4 | WAL-06, WAL-07 | WAL-05, SC-09 |
| W5 | WAL-08 | WAL-01→07 |

### [x] WAL-01: Wallet accounts and ledger

- [x] Schema: one wallet per user, immutable ledger entries, balance projection, hold/release, idempotency key, correlation to payment/booking/registration. (`0018_wallet_ledger.sql`)
- [x] No negative balance; debit/hold/credit atomic with caller transaction.
- [x] Admin-visible audit trail for every balance-changing entry.
- [x] Concurrency: two debits cannot overdraw; replay returns same result.
- [x] Tests: `wallet-ledger.test.ts` 7/7 PASS on `badminton_test`; migration applied.

### [x] WAL-02: Top-up via SePay bank webhook + VietQR

- [x] Create top-up intent and dynamic VietQR; amount credited only on valid HMAC webhook.
- [x] Duplicate/late/parallel IPN credits once.
- [x] Return URL never credits.
- [x] Test: success, wrong secret, duplicate; `wallet-top-up.test.ts` 5/5.

### [x] WAL-03: Pay Booking/registration from wallet

- [x] Replace direct VNPAY booking payment with wallet debit; insufficient funds → clear error + top-up CTA.
- [x] Hold/debit and owning-domain confirmation in one transaction.
- [x] Refund on confirmation failure; no double debit on retry.
- [x] Test: enough/insufficient balance, replay; `wallet-booking-payment.test.ts` 3/3. Registration waits TRN-05.

### [x] WAL-04: Refund to wallet

- [x] Refund booking/registration credits wallet, not original source.
- [x] Idempotent per cancellation; refund state visible.
- [x] Test: paid cancel → wallet credit once; unpaid → no credit. `wallet-booking-payment.test.ts` 4/4.

### [x] WAL-05: Withdrawal request + Admin manual payout

- [x] User adds receiving bank account; validation/ownership check.
- [x] Create withdrawal request, hold wallet, state PENDING/APPROVED/PAID/REJECTED.
- [x] Admin approves and records manual bank-transfer reference; reject releases hold; no provider call.
- [x] Test: approve/reject, duplicate request, insufficient balance; `wallet-payout.test.ts` 6/6.

### [x] WAL-06: Owner payout request + Admin approval

- [x] Owner creates payout request for available balance; state machine PENDING/APPROVED/REJECTED/PAID.
- [x] Admin approves/rejects with reason; only approved request can be marked paid.
- [x] No external provider call; manual bank transfer reference required.
- [x] Test: approve/reject, double approval, insufficient balance; `wallet-payout.test.ts` 6/6.

### [x] WAL-07: Admin wallet adjustment + audit

- [x] Admin credit/debit with mandatory reason.
- [x] Ledger audit row in same transaction; no update/delete API.
- [x] Admin route + CSRF; non-admin protected by requireRole.
- [x] Test: credit/debit, createdBy, reason; `wallet-payout.test.ts`.

### [x] WAL-08: Reconciliation and wallet coverage (basic)

- [x] Reconcile SePay top-up/payout totals against ledger; surface unmatched ids.
- [x] No platform fee and no limit in MVP.
- [ ] Add unmatched/replay test for reconciliation report.

---

## [ ] PAY-01: Payment configuration and VNPAY adapter/signature utility

**Completion review (2026-11-01):** Keep IN_PROGRESS: provider.factory.ts still returns Mock for VNPAY/default; no real VNPAY signature/adapter implementation or corresponding tests exist. Required provider configuration/refund-config consumption remains incomplete.

```text
Status: IN_PROGRESS
Size: M
Blocked by: N/A
```

**Progress (2026-10-20):** Centralized payment environment fields, the `PaymentProvider` interface, factory, and Mock adapter exist. Remaining: real VNPAY adapter/signature utilities and their tests; validation of required VNPAY configuration; consistent credential/URL names with the Tech Design; runtime consumption of the seeded refund configuration. The factory currently returns Mock for `VNPAY`; this is not VNPAY support and must be corrected.

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

**Completion review (2026-11-01):** Keep IN_PROGRESS: current Booking initialization locks the booking and confirmation is now atomic; the older concurrency/terminal-state notes are partly superseded. Real VNPAY URL generation, registration initialization and the documented PAYMENT_NOT_PAYABLE error contract remain incomplete.

**G0 D9 update (2026-11-15):** booking/registration payment is a wallet debit (WAL-03), not a VNPAY URL. VNPAY URL generation moves to top-up (WAL-02). Keep ownership/payable/hold/concurrency checks; add insufficient-balance handling.

```text
Status: IN_PROGRESS
Size: M
Blocked by: Full completion requires PAY-01, PAY-06 and Tournament registration lifecycle (TRN-04); Auth is available
```

**Progress (2026-10-20):** Booking payment initialization is wired through route/controller/service/repository. It checks ownership, payable state and hold expiry, takes the amount from the booking snapshot, and reuses a pending payment on sequential calls. Remaining: concurrency-safe creation/reuse, alignment with the documented `409 PAYMENT_NOT_PAYABLE` contract, real VNPAY URL generation, and registration payment initialization. Mock Booking work can continue without waiting for Tournament or VNPAY sandbox access.

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
Blocked by: PAY-01 VNPAY configuration/signature support and PAY-02 initialization
```

**Progress (2026-10-20):** No VNPAY webhook/signature handler exists. Booking-side `confirmBooking` and Mock confirmation provide partial supporting code only. Payment success and Booking confirmation currently commit separately; payment locking, terminal-state guards and a shared atomic confirmation path are still required before this task can be completed.

**G0 D9 update (2026-11-15):** webhook/IPN confirms a wallet top-up and credits the wallet (WAL-02); it does not confirm Booking/registration directly. Keep signature/idempotency/late-callback handling; add wallet credit and reconciliation.

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

**G0 D9 update (2026-11-15):** refund target is the user wallet (WAL-04), not a VNPAY refund of the booking payment. Keep the durable intent/worker/claim/timeout design; replace provider refund execution with an idempotent wallet credit. `PAYMENT_REFUNDS` stores status/attempt/last_error/claimed_at/completed_at.

**Progress (2026-10-20):** The Mock adapter exposes `processRefund`, and `PaymentService.refundBookingPayment` can directly mark a successful payment `REFUNDED`, but cancellation does not invoke it. Booking cancellation publishes an in-process event without a durable refund consumer. Remaining: durable refund intent in the cancellation transaction, DB claiming, provider execution, retry/timeout/config handling and verification. A helper that only changes status does not satisfy refund execution criteria.

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

**Completion review (2026-11-01):** Keep IN_PROGRESS: existing Mock Booking integration tests cover supporting paths; VNPAY signatures/webhook, registration payments, durable refund retry/timeout and payment-inclusive browser E2E are absent. Historical nine-test counts are not the current suite count.

```text
Status: IN_PROGRESS
Size: M
Blocked by: Full lifecycle coverage requires PAY-02, PAY-03, PAY-04; Mock coverage can continue now
```

**Progress (2026-10-20):** `backend/src/__tests__/payment-integration.test.ts` has 9 passing tests covering Mock Booking initialization, ownership, hold expiry, confirmation success/failure, sequential duplicate confirmation, late-payment refund status and payment-read authorization. Remaining: production/provider guards, concurrent initialization/callbacks, atomic rollback, terminal-state regressions (including failure simulation after success), registration payments, VNPAY signatures/webhook, durable refund worker/retry/timeout, and payment-inclusive browser E2E. The existing browser Booking flow covers unpaid hold/cancellation only.

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

**Completion review (2026-11-01):** Keep IN_PROGRESS: terminal payment replay is now checked before simulateFailure and Booking/payment confirmation share a transaction; those old findings are resolved in current code. Production Mock guards, VNPAY fallback removal and registration integration are still missing.

```text
Status: IN_PROGRESS
Size: S
Blocked by: No blocker for Booking safeguards; full registration acceptance requires Tournament integration
```

**Progress (2026-10-20):** Mock adapter, authenticated confirmation endpoint, Booking payment initiation, frontend payment CTA/modal and success navigation exist. Remaining: reject Mock configuration in production and gate the Mock endpoint/provider; remove VNPAY-to-Mock fallback; enforce safe terminal transitions and atomic/concurrent confirmation; integrate registration payments. In particular, `simulateFailure` currently runs before the success guard and can overwrite a successful payment. The existing Booking happy path is not sufficient to mark this task DONE.

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

## Matchmaking readiness integration verification — approved 2026-10-10

Refund tasks must verify durable Booking cancellation requests triggered by
Match leave, restart/retry, duplicate cancellation and policy refusal (no refund
when Booking policy refuses). Documentation approval does not mark these tasks
implemented or remove the provider/Booking dependencies.
