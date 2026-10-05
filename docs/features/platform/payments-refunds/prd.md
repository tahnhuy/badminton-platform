# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Ready
Owner: PM/Business Owner + Tech Lead
Fulfills: PROJECT-BRIEF.md §3.2, §3.3, §5; docs/architecture/tech-stack.md (Payment Integration Strategy)
Scope: Payments and Refunds (platform capability)
```

> Ready: reviewed and approved by the human owner on 2026-09-25 (Phase 1 review).

## Authoritative References

- Project scope and confirmed decisions: `PROJECT-BRIEF.md`
- Global technology decisions: `docs/architecture/tech-stack.md`
- Global schema: `docs/architecture/database-schema.md` §3.10 `PAYMENTS`, §7
- Business rules and configuration: `docs/business-rules-config-matrix.md` §2.6–§2.8, §8.2

## Related Documents

- Parent or related PRD: Booking PRD (not yet authored), Tournament PRD (`docs/features/tournament/prd.md`)
- Tech Design: `docs/features/platform/payments-refunds/tech-design.md`
- Task or issue: `docs/features/platform/payments-refunds/tasks.md`

## 1. Problem

Booking and Tournament entry fees both require a single, consistent online payment and refund capability. Without a shared capability, each domain would implement provider handling, idempotency, and refund logic differently, risking duplicate charges, inconsistent refunds, and leaked provider details.

## 2. Goals

- Process online payments for Court Bookings and Tournament registrations through VNPAY.
- Provide a development-only mock provider so Booking, Matchmaking, and Tournament can be built and demoed before VNPAY sandbox is ready.
- Confirm the owning domain (Booking/registration) exactly once per successful payment.
- Execute full refunds when a paid Booking or Tournament registration is cancelled under the approved rules.
- Handle provider callbacks idempotently and safely against duplicate delivery.

## 3. Non-Goals

- Split Bill.
- A standalone refund-management module or Owner-facing refund console.
- Wallet, stored balance, or multiple concurrent payment providers.
- Provider-specific fee accounting beyond the amount actually charged.

## 4. Scope

### In Scope

- Payment creation and VNPAY redirect for Booking and Tournament registration.
- A `PAYMENTS` record referencing exactly one of `booking_id`/`registration_id`.
- VNPAY callback/IPN validation and idempotent payment success handling.
- Full (100%) refunds for approved cancellations, integrated into the payment lifecycle.
- Refund processing timeout and observability for manual operations.
- A development-only **mock provider** adapter that resolves payment immediately, selected by configuration, used for local development and demos. Build order: mock first, then VNPAY sandbox.

### Out of Scope

- Partial refunds or configurable refund amounts.
- Managing refunds as a separate domain object.
- Real payment methods other than VNPAY for MVP. The mock provider is a development/test adapter only and is never enabled in production.

## 5. Target Users and Roles

- Player: pays a Booking or a Tournament entry fee; receives refunds when eligible.
- Tournament Organizer (contextual Player): configuring a paid Tournament does not involve direct payment handling.
- Admin: may trigger refunds through the established cancellation flows.
- System: PaymentModule owns provider interaction and reconciliation.

## 6. User Journey

**Booking payment**
1. Player selects a Court slot; the system creates a `PENDING_PAYMENT` Booking hold.
2. Player is redirected to VNPAY and pays.
3. A valid callback confirms the Booking; a late callback after expiry never reopens it.

**Tournament entry-fee payment**
1. Player registers; a `PENDING_PAYMENT` registration with a snapshotted `expires_at` is created.
2. Player is redirected to VNPAY and pays the full fee.
3. A valid callback transitions the registration to `CONFIRMED`.

**Refund**
1. A paid Booking/registration is cancelled under the approved rules.
2. The owning domain emits a cancellation/withdrawal event.
3. The refund worker initiates a 100% refund through VNPAY, idempotently.

## 7. Functional Requirements

- The system can create a payment and a VNPAY redirect URL for a payable Booking or registration.
- The system can resolve a payment immediately through the development-only mock provider when it is selected by configuration.
- The system can validate a VNPAY callback and map it to the local payment.
- The system can confirm the owning domain exactly once per successful payment.
- The system can initiate a 100% refund for an approved cancellation.
- The system can time out refund processing for manual operational handling.
- The system never exposes provider responses, secrets, or signatures in API responses.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §2.6–§2.8.
- Payment provider is VNPAY (`docs/architecture/tech-stack.md`). A development-only mock provider is an additional adapter selected by configuration; it is not a production payment method.
- The mock provider follows the same idempotent confirmation path as a real provider callback.
- Payment handling is idempotent; a replayed callback has no second effect.
- Successful payment and Booking/registration confirmation are idempotent.
- A late payment must never reopen an expired Booking or registration; if the provider charged the Player, a refund is required.
- Refunds are always full (100%) for approved cancellations.
- Refund processing times out after `REFUND_PROCESSING_TIMEOUT_MINUTES` (`1440`).

## 9. UI/UX Behavior

- Players are redirected to the VNPAY payment page and returned to the originating flow.
- Payment status is reflected in the Booking/registration view after return and on refresh.
- Failures return the Player to a recoverable state; no raw provider error is shown.

## 10. Success Metrics

- Payment success is confirmed exactly once per successful provider transaction.
- No duplicate refunds for a single cancellation.

## 11. Constraints

- Must not introduce a new production provider for MVP; the mock adapter is development/test only.
- Must use the existing `PAYMENTS` table and the exactly-one `booking_id`/`registration_id` invariant.
- Must preserve Booking and Tournament lifecycle ownership; PaymentModule does not own those states.

## 12. Risks

- Risk: Duplicate callbacks cause double confirmation.
  Mitigation: Idempotent handling keyed by transaction/payment identity.
- Risk: Late payment after expiry.
  Mitigation: Expired entities are never reopened; a refund is triggered when the provider charged.

## 13. Dependencies

- `PAYMENTS` and the exactly-one CHECK (`database-schema.md` §3.10).
- Booking and Tournament domains emitting cancellation/withdrawal events.
- VNPAY merchant configuration (credentials as configuration, never source code).

## 14. Decision Log

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Payment provider | Tech Lead | VNPAY, per `tech-stack.md` and the Tournament Tech Design §12 (decided 2026-09-13). | 2026-09-13 | RESOLVED |
| Refund processing timeout | Tech Lead | `REFUND_PROCESSING_TIMEOUT_MINUTES = 1440`. | 2026-09-13 | RESOLVED |
| Refund amount | PM/Business Owner | Full (100%) for approved cancellations. | 2026-09-13 | RESOLVED |
| Payment status lifecycle values | Tech Lead | `PENDING → SUCCESS \| FAILED \| EXPIRED`; `SUCCESS → REFUND_PENDING → REFUNDED \| REFUND_FAILED` (Tech Design §2). | 2026-09-25 | RESOLVED |
| Feature-specific HTTP mapping for provider errors | Human owner | `PAYMENT_PROVIDER_ERROR` uses HTTP `502 Bad Gateway` (Tech Design §11). | 2026-09-25 | RESOLVED |
| Build order and development adapter. | Human owner | Implement a development-only mock provider first (week 3) to unblock Booking/Matchmaking/Tournament, then VNPAY sandbox (week 4); VNPAY remains the only production provider. | 2026-10-04 | RESOLVED |
