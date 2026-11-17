# Court Booking — Player Flow — Task List

> **Progress 2026-11-17 (plan 06):** BK-06 (wallet-first), BK-07 durable refund, BK-10 notifications, BK-14 real E2E and BK-15 lock order are implemented and tested; see `docs/plans/06_booking-chu-san-matchmaking.md` §8. BK-12 UI has a base and remains UI-REDO. VNPAY booking/return is intentionally not in this release (D9/PAY-D4).

## Task completion review — 2026-11-01

Review requested by the owner. The per-task review notes below supersede older implementation-progress blockers only where explicitly stated. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Test-only BlockPort coverage is not production Messaging integration. Shared schema/document PR review before merge is unchanged. No governing business choice is approved by changing task status.

Implementation tasks for the Court Booking — Player Flow feature.

- Linked PRD: [prd.md](prd.md) (Ready)
- Linked Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions Q1–Q12)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **Authentication blocker (RESOLVED).** The Auth module (`backend/src/modules/auth/`, `backend/src/shared/auth/`) is now implemented with real session-based authentication, RBAC (`requireRole`), and CSRF protection; the `authenticate` middleware (`backend/src/middleware/auth.middleware.ts`) delegates to the shared session middleware and only uses header identity under an explicit `NODE_ENV=test` + `ALLOW_TEST_AUTH=true` guard. Booking tasks are therefore no longer blocked on the Auth module; the remaining blockers are the PaymentModule tasks (`PAY-*`) named per task.
>
> **No new decisions.** These tasks must not resolve any `[TBD]`, change business rules, the schema, or the API contract. Feature behavior is governed by `prd.md` and `tech-design.md`; the consolidated schema remains `docs/architecture/database-schema.md`.
>
> **Internal Matchmaking contract.** BookingModule must also expose the system-initiated `MatchBookingPort` primitives (`createMatchHold`, `releaseMatchHold`) defined in `tech-design.md` §7.1 and consumed by `docs/features/matchmaking/matchmaking/tech-design.md` §7.1/§7.4. This is bookkeeping with the Matchmaking feature, not a Player-facing path, and is implemented with BK-05/BK-07. Matchmaking tasks MM-06/MM-08 depend on it and remain `BLOCKED` until it exists.

## Summary

| ID | Task Title | Status | Dependencies | Estimated Size |
| --- | --- | --- | --- | --- |
| BK-01 | Booking schema migration, exclusion constraint, and config seed | DONE | — | M |
| BK-02 | Booking repository and data-access layer | DONE | BK-01 | M |
| BK-03 | Court search API (public) | DONE | BK-02 | S |
| BK-04 | Availability and pricing computation service + availability API (public) | DONE | BK-02 | M |
| BK-05 | Booking creation API and service (hold + concurrency control) | DONE | BK-04, Auth module | M |
| BK-06 | Booking payment integration (two-step + idempotent VNPAY confirmation) | BLOCKED | BK-05, PAY-02, PAY-03 | M |
| BK-07 | Booking cancellation API and refund event emission | IN_PROGRESS | BK-05, PAY-04 | M |
| BK-08 | My-bookings list and booking detail APIs | DONE | BK-05 | S |
| BK-09 | Booking expiry and state-transition worker | DONE | BK-05 | M |
| BK-10 | Booking in-app notifications | BLOCKED | BK-06, BK-07 | S |
| BK-11 | Frontend court search and availability UI (polling) | DONE | BK-03, BK-04 | M |
| BK-12 | Frontend booking creation and VNPAY payment UI | BLOCKED | BK-06 | M |
| BK-13 | Frontend my-bookings and cancellation UI | DONE | BK-07, BK-08 | M |
| BK-14 | End-to-end and concurrency verification | BLOCKED | BK-01 … BK-13 | M |

## Execution Order

| Wave | Stage | Tasks | Waits for |
| --- | --- | --- | --- |
| 1 | Migration / persistence | BK-01 | — |
| 2 | Repository + read-heavy backend | BK-02, BK-03, BK-04 | BK-01 |
| 3 | Transaction/concurrency backend (booking, payment, cancel, history) | BK-05, BK-06, BK-07, BK-08 | BK-04 / Auth / PaymentModule |
| 4 | Background worker + notifications | BK-09, BK-10 | BK-05 / BK-06, BK-07 |
| 5 | Frontend components | BK-11, BK-12, BK-13 | BK-03/BK-04, BK-06, BK-07/BK-08 |
| 6 | E2E / integration | BK-14 | BK-01 … BK-13 |

---

## [x] BK-01: Booking schema migration, exclusion constraint, and config seed

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Progress:** Migration applied (drizzle `0003`): `bookings.expires_at`, generated `booking_range` (`Asia/Ho_Chi_Minh`), `ex_bookings_court_no_overlap`, and the three indexes; `BOOKING_*`, `OWNER_*`, and `REFUND_*` config keys seeded idempotently. Verified in PostgreSQL: touching intervals accepted, overlapping intervals rejected. Note: the overlap pre-check is effectively performed by the constraint-add step; an explicit `RAISE EXCEPTION` pre-check was not added, and `OWNER_*`/`REFUND_*` keys were seeded beyond the keys listed in Scope (consistent with `business-rules-config-matrix.md` §8.2).

**Objective:** Apply the approved booking schema deltas from the Tech Design (§10) and seed the `BOOKING_*` configuration keys, keeping `docs/architecture/database-schema.md` authoritative.

**Scope**

- In scope:
  - Add `BOOKINGS.expires_at timestamp NULL`.
  - Enable `btree_gist`; add the `booking_range` generated column and the `ex_bookings_court_no_overlap` exclusion constraint over `(court_id, booking_range)` with the active-status predicate.
  - Add indexes `BOOKINGS (court_id, booking_date, start_time)`, `BOOKINGS (player_id, status)`, and `COURT_PRICINGS (court_id, valid_from, valid_to)`.
  - Seed `BOOKING_ENABLED`, `BOOKING_MIN_DURATION_MINUTES`, `BOOKING_MAX_DURATION_MINUTES`, `BOOKING_ADVANCE_WINDOW_DAYS`, `BOOKING_ACTIVE_LIMIT_MODE`, `BOOKING_MAX_ACTIVE_PER_PLAYER`, `PLAYER_CAN_CANCEL_BOOKING`, `PLAYER_CANCELLATION_DEADLINE_MINUTES`, `BOOKING_PAYMENT_TIMEOUT_MINUTES` idempotently.
  - Consistency pre-check for pre-existing overlapping active bookings before adding the constraint.
- Out of scope:
  - Any repository, service, API, or frontend code.
  - Changing `COURT_PRICINGS` semantics or other frozen tables.

**Implementation requirements**

1. Add an ordered migration for the `BOOKINGS.expires_at` column and the indexes.
2. Add the `btree_gist` extension and the `booking_range`/exclusion constraint; verify the generated expression and the `Asia/Ho_Chi_Minh` combination against the Tech Design §10 and §7.5.
3. Run the overlap pre-check; fail the migration with a clear message if pre-existing active overlaps exist.
4. Seed the `BOOKING_*` keys idempotently, matching `docs/business-rules-config-matrix.md` §8.2 defaults.
5. Verify `docs/architecture/database-schema.md` §3.8/§5.8 already matches the applied delta.

**Files/areas affected**

- `backend/src/db/schema/bookings.ts`
- `backend/src/db/migrations/`
- `backend/src/db/seed.ts`
- `docs/architecture/database-schema.md`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** Adds `BOOKINGS.expires_at`, the exclusion constraint, and three indexes; seeds the `BOOKING_*` configuration keys.

**Verification**

- Unit: N/A
- Integration: Migration applies cleanly on a fresh and a populated database; existing booking rows remain valid; seeded keys are present once after repeated runs.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Two overlapping `PENDING_PAYMENT`/`CONFIRMED` intervals for the same court are rejected by the constraint; boundary-touching intervals are accepted; a soft-deleted/suspended court is unaffected by the constraint.
- Manual: Read each seeded config key and confirm the default value.

**Acceptance criteria**

- **Given** a fresh database
  **When** the migration runs
  **Then** `BOOKINGS.expires_at` and `ex_bookings_court_no_overlap` exist and no data is lost.
- **Given** a court with an active booking from 18:00–19:00
  **When** a second active booking 18:30–19:30 is inserted
  **Then** the database rejects it, while a 19:00–20:00 boundary-touching insert succeeds.
- **Given** the seed is executed twice
  **When** the `BOOKING_*` keys are read
  **Then** each key exists exactly once with the documented default.

---

## [x] BK-02: Booking repository and data-access layer

```text
Status: DONE
Size: M
Blocked by: BK-01
```

**Progress:** Read-path delivered: `CourtRepository` (court/facility eligibility, pricing-for-date, bookable-court search) and `BookingRepository.findActiveIntervals` (active-status read with the elapsed `expires_at` filter). Write-path helpers delivered: `lockCourt` (`SELECT ... FOR UPDATE`), `insertBooking`, `insertPricingDetails`, `countActiveForPlayer`, `lockBookingById`, `updateBookingStatus`, and booking-scoped reads (`findBookingsForPlayer` with `status`/`timeScope` and `meta` pagination, `findBookingById` with pricing details and payment status). Covered by `booking-availability.test.ts` and `booking-write.test.ts`.

**Objective:** Provide the persistence primitives for booking, availability, and pricing snapshots, keeping SQL and locking out of controllers and services.

**Scope**

- In scope:
  - Court/facility eligibility reads (active status, opening/closing hours, soft-delete).
  - Valid `COURT_PRICINGS` reads for a court and date.
  - Active-booking interval reads for a court and date, treating `PENDING_PAYMENT` with elapsed `expires_at` as inactive.
  - `SELECT ... FROM courts WHERE id = $1 FOR UPDATE` helper used by booking creation.
  - Insert helpers for `BOOKINGS` (with `expires_at`, `total_amount`, `unit_price`, `version`) and `BOOKING_PRICING_DETAILS`.
  - Booking reads scoped to a player, with pagination (`page`, `limit`) and status/`timeScope` filters.
  - Booking row lock/read helper for state transitions.
- Out of scope:
  - Business policy (limits, windows, cancellation rules) and HTTP concerns.
  - Creating a second configuration reader.

**Implementation requirements**

1. Use parameterized SQL via the existing persistence layer; select explicit columns.
2. Keep transaction context explicit so the creation transaction can pass it through.
3. Implement the availability interval query with the `expires_at` filter from Tech Design §7.2.
4. Return repository-level results; no thrown HTTP errors.

**Files/areas affected**

- `backend/src/repositories/BookingRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/CourtRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/services/booking/` `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** Reads/writes `BOOKINGS`, `BOOKING_PRICING_DETAILS`, `COURTS`, `FACILITIES`, `COURT_PRICINGS`; no schema change.

**Verification**

- Unit: Interval subtraction and `expires_at` filtering with fixed fixtures.
- Integration: `FOR UPDATE` serializes two concurrent creation transactions on the same court; pricing-detail inserts persist the snapshot.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A `PENDING_PAYMENT` row with `expires_at < now()` is excluded from active intervals.
- Manual: N/A

**Acceptance criteria**

- **Given** a court with a `PENDING_PAYMENT` hold whose `expires_at` has elapsed
  **When** active intervals for that date are read
  **Then** the hold is not returned and the interval is free.
- **Given** a booking with pricing segments
  **When** it is persisted
  **Then** `BOOKING_PRICING_DETAILS` rows and `BOOKINGS.total_amount` reflect the exact computed sum.

---

## [x] BK-03: Court search API (public)

```text
Status: DONE
Size: S
Blocked by: BK-02
```

**Progress:** `GET /api/v1/courts` implemented (`validation/booking.ts`, `controllers/booking/CourtController.ts`, `routes/booking/courtRoutes.ts`) with offset pagination `meta`, active/non-deleted gating, `priceFrom`, ILIKE city/district filters, ordered by price, and optional free-window filtering. Covered by `backend/src/__tests__/booking-availability.test.ts`.

**Objective:** Expose read-only court discovery by area/date/time with offset pagination.

**Scope**

- In scope:
  - `GET /api/v1/courts` with `city`, `district`, `date`, `startTime`, `endTime`, `page`, `limit`.
  - Zod query validation at the request boundary.
  - Result summaries (court, facility, address, city/district, price-from, availability indicator) and `meta: { page, limit, total, totalPages }`.
  - When a time window is supplied, filter to courts with a free covering interval.
- Out of scope:
  - Booking creation or hold logic.
  - Geospatial/radius search, price-range filters, and admin court management.

**Implementation requirements**

1. Implement thin route → controller → service reading through `BookingRepository`/`CourtRepository`.
2. Reuse the shared table/filter conventions on the client side; server returns a stable list contract.
3. Do not require authentication.

**Files/areas affected**

- `backend/src/routes/booking/` `[Proposed — verify during implementation]`
- `backend/src/services/booking/` `[Proposed — verify during implementation]`
- `backend/src/validation/booking.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** `GET /api/v1/courts`.

**Schema/config impact:** None.

**Verification**

- Unit: Query-schema validation and filter composition.
- Integration: Only active, non-deleted courts/facilities are returned.
- API-level: `200` with `meta`; `400 VALIDATION_FAILED` on bad `date`/`startTime`/`endTime`.
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Missing optional filters return a paginated unfiltered list; out-of-range `page` returns an empty list with correct `meta`.
- Manual: Search a known city/district and confirm expected courts.

**Acceptance criteria**

- **Given** active courts in two districts
  **When** a Player searches with `district=<one>` and a valid time window
  **Then** only eligible courts with a free covering interval are returned with pagination `meta`.
- **Given** an invalid `startTime` format
  **When** the search is requested
  **Then** the API returns `400 VALIDATION_FAILED`.

---

## [x] BK-04: Availability and pricing computation service + availability API (public)

```text
Status: DONE
Size: M
Blocked by: BK-02
```

**Progress:** `services/booking/availability.service.ts` implements the pure computation (pricing-segment build clipped to opening hours, occupied subtraction, contiguous merge with per-segment prices, duration pricing `price × overlap_minutes / 60`, fixed `Asia/Ho_Chi_Minh` date helper). `GET /api/v1/courts/:id/availability` returns merged free intervals with `COURT_NOT_FOUND` (404) and `COURT_NOT_BOOKABLE` (409). Covered by `backend/src/__tests__/booking-availability.test.ts`.

**Objective:** Compute derived free intervals and per-segment prices for a court/date, and expose them without authentication.

**Scope**

- In scope:
  - Availability computation: opening→closing range, valid pricing intervals, subtraction of active booking intervals, merged free intervals.
  - Pricing split across contiguous pricing intervals with `amount = price × overlap_minutes / 60`.
  - `GET /api/v1/courts/:id/availability` with `date` (required) and optional `durationMinutes`.
  - Zod query/param validation; `404 COURT_NOT_FOUND`, `409 COURT_NOT_BOOKABLE`.
- Out of scope:
  - Advance-window, active-limit, and `BOOKING_ENABLED` gating (enforced at creation in BK-05).
  - Booking creation and holds.
  - Cross-midnight behavior.

**Implementation requirements**

1. Implement the computation as pure, unit-testable functions in a shared service used by BK-05.
2. Keep the fixed `Asia/Ho_Chi_Minh` interpretation for date/time comparisons (Tech Design §7.5).
3. Only priced intervals are offered; gaps in `COURT_PRICINGS` are not bookable.
4. Do not require authentication.

**Files/areas affected**

- `backend/src/services/booking/availability.service.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/BookingRepository.ts`, `backend/src/repositories/CourtRepository.ts`
- `backend/src/validation/booking.ts` `[Proposed — verify during implementation]`

**API impact:** `GET /api/v1/courts/:id/availability`.

**Schema/config impact:** None; reads `COURT_PRICINGS` and active `BOOKINGS`.

**Verification**

- Unit: Merged free intervals, boundary-touching bookings, pricing split across segments, and duration pricing.
- Integration: Active holds block intervals; expired holds do not.
- API-level: `200` shape; `400 VALIDATION_FAILED`; `404 COURT_NOT_FOUND`; `409 COURT_NOT_BOOKABLE`.
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A gap with no pricing is excluded; requested `durationMinutes` longer than a free interval returns no offer for that interval.
- Manual: Compare returned intervals against seeded bookings and pricing.

**Acceptance criteria**

- **Given** a court open 06:00–22:00 with pricing intervals and one confirmed booking 18:00–19:00
  **When** availability for that date is requested
  **Then** the free intervals exclude 18:00–19:00 and include boundary-touching 19:00 onward.
- **Given** a requested `durationMinutes`
  **When** a free interval is long enough
  **Then** the response includes the computed total from the applicable per-segment prices.

---

## [x] BK-05: Booking creation API and service (hold + concurrency control)

```text
Status: DONE
Size: M
Blocked by: BK-04
```

**Progress:** `POST /api/v1/bookings` implemented (`PLAYER`-only). One transaction wraps court `FOR UPDATE`, overlap re-check (active statuses with elapsed-`expires_at` filter), `expires_at` snapshot from `BOOKING_PAYMENT_TIMEOUT_MINUTES`, pricing snapshot via `computeWindowPricing`, and booking + pricing-detail inserts; the `ex_bookings_court_no_overlap` violation maps to `409 BOOKING_SLOT_UNAVAILABLE`. Gates: `BOOKING_ENABLED`, duration min/max, advance window, opening-hours/pricing coverage, active-limit mode. `booking_code` is generated at creation (unique, migration `0006`). Booking config is read through `shared/config/booking-config.ts`. Covered by `booking-write.test.ts`.

**Objective:** Create a `PENDING_PAYMENT` hold transactionally, guaranteeing no double booking and a snapshotted deadline/price.

**Scope**

- In scope:
  - `POST /api/v1/bookings` with `courtId`, `bookingDate`, `startTime`, `durationMinutes`; body Zod validation.
  - Eligibility (court/facility `ACTIVE`, not deleted), advance window, duration min/max, booking enabled, and active-booking limit (active = `PENDING_PAYMENT`/`CONFIRMED`/`IN_PROGRESS`).
  - Court row `FOR UPDATE`, overlap check, `expires_at` snapshot, pricing snapshot rows, and `total_amount`/`unit_price`.
  - (Not used in MVP) The internal `MatchBookingPort.createMatchHold` primitive is retained only as a future integration point; Matchmaking is invitation-only and the request owner books through the Player-facing `POST /api/v1/bookings` flow (Tech Design §7.1).
  - Feature error codes from Tech Design §9.8.
- Out of scope:
  - Payment URL creation (BK-06) and cancellation (BK-07).
  - `MatchBookingPort.releaseMatchHold` (not used in MVP; Matchmaking does not hold or auto-cancel bookings).
  - Any owner-side management endpoint.

**Implementation requirements**

1. One transaction wraps eligibility, limit check, overlap check, pricing snapshot, and inserts; full rollback on failure.
2. Enforce all gates read through the centralized system-configuration reader.
3. Set `expires_at = now + BOOKING_PAYMENT_TIMEOUT_MINUTES` snapshotted at creation.
4. Rely on the exclusion constraint as the final guard; map a constraint violation to `409 BOOKING_SLOT_UNAVAILABLE`.
5. Do not create the payment in this endpoint (two-step flow).

**Files/areas affected**

- `backend/src/routes/booking/`, `backend/src/controllers/booking/`, `backend/src/services/booking/`, `backend/src/repositories/BookingRepository.ts`, `backend/src/repositories/CourtRepository.ts`, `backend/src/validation/booking.ts`
- `backend/src/repositories/BookingRepository.ts`, `backend/src/repositories/CourtRepository.ts`
- `backend/src/app.ts`

**API impact:** `POST /api/v1/bookings`.

**Schema/config impact:** Writes `BOOKINGS.expires_at`; reads `BOOKING_*` configuration keys.

**Verification**

- Unit: Duration/advance-window/limit rules; `expires_at` and price computation.
- Integration: Concurrent same-slot requests produce exactly one hold; pricing snapshot is immutable.
- API-level: `201`; `400`, `401`, `403`, `404 COURT_NOT_FOUND`, `409` conflict codes.
- E2E for a critical flow: Player creates a hold and sees `PENDING_PAYMENT` with `expiresAt`.
- Edge/failure/concurrency: Two simultaneous requests for the same interval — one `201`, one `409`.
- Manual: N/A

**Acceptance criteria**

- **Given** an eligible court with a free slot and a Player under the active limit
  **When** the Player creates a booking
  **Then** a `PENDING_PAYMENT` booking with a snapshotted `expires_at` and pricing details is returned.
- **Given** two Players concurrently booking the same interval
  **When** both requests are processed
  **Then** exactly one succeeds and the other returns `409 BOOKING_SLOT_UNAVAILABLE`.
- **Given** an interval overlapping an existing active hold
  **When** a new booking is attempted
  **Then** the API returns `409 BOOKING_SLOT_UNAVAILABLE`.

---

## [ ] BK-06: Booking payment integration (two-step + idempotent VNPAY confirmation)

```text
Status: BLOCKED
Size: M
Blocked by: BK-05, PAY-02, PAY-03
```

**Progress:** Booking-side contract implemented: `BookingService.confirmBooking({bookingId, paymentId})` in `services/booking/booking.service.ts` locks the booking and applies the idempotent matrix (`CONFIRMED`/`IN_PROGRESS`/`COMPLETED` → no-op; `PENDING_PAYMENT` live → `CONFIRMED`; `PENDING_PAYMENT` overdue → `EXPIRED` + refund signal; `EXPIRED`/`CANCELLED` → never reopen + refund signal). Domain events `BookingConfirmed`/`BookingExpired` emitted. Covered by `booking-confirm-match-facility.test.ts`. Remaining for DONE: the PaymentModule-owned `POST /bookings/:id/payment` + VNPAY IPN that calls `confirmBooking`.

**Deferred (review #4):** `confirmBooking` currently does not validate that `paymentId` belongs to the booking, nor enforce a payment-status guard; idempotency relies on the booking status alone. The payment-ownership check and the terminal "at most once" guard land with PaymentModule (`PAY-02/03`).

**Objective:** Wire the Booking lifecycle to the existing PaymentModule so a valid VNPAY callback confirms the booking exactly once, and a late payment never reopens an expired booking.

**Scope**

- In scope:
  - Consume PaymentModule's `POST /api/v1/bookings/:booking_id/payment` for `PENDING_PAYMENT` bookings.
  - Implement the narrow `confirmBooking(bookingId, paymentId)` contract called by the VNPAY webhook handler.
  - Idempotent confirmation: `CONFIRMED`/`IN_PROGRESS`/`COMPLETED` → no-op success; `PENDING_PAYMENT` (not expired) → `CONFIRMED`; `PENDING_PAYMENT` (expired) → `EXPIRED` + refund signal; already `EXPIRED` → refund signal only.
- Out of scope:
  - Redefining the PaymentModule endpoints or the VNPAY webhook (owned by `docs/features/platform/payments-refunds/tech-design.md`).
  - Provider-specific refund execution (PAY-04).

**Implementation requirements**

1. Keep `confirmBooking` in the Booking service, locking the booking row and validating state inside the payment transaction.
2. Never reopen an expired booking; return a refund signal for charged late payments.
3. Do not expose provider responses, signatures, or secrets.
4. Follow the PaymentModule callback contract; do not invent the provider acknowledgement shape.

**Files/areas affected**

- `backend/src/services/booking/booking.service.ts` `[Proposed — verify during implementation]`
- `backend/src/services/payments/` (existing platform module)
- `backend/src/repositories/BookingRepository.ts`

**API impact:** Consumes `POST /api/v1/bookings/:booking_id/payment` and `POST /api/v1/payments/vnpay/webhook`; adds no new public path.

**Schema/config impact:** Uses `PAYMENTS` exactly-one linkage and `BOOKING_PAYMENT_TIMEOUT_MINUTES`; no schema change.

**Verification**

- Unit: `confirmBooking` state matrix including expired and already-finalized cases.
- Integration: Duplicate webhook is a no-op; confirmation and payment `SUCCESS` are atomic.
- API-level: Invalid signature rejected without leakage; already-processed callback returns success.
- E2E for a critical flow: Pay → booking becomes `CONFIRMED`.
- Edge/failure/concurrency: Late callback after expiry never reopens the booking and signals a refund.
- Manual: N/A

**Acceptance criteria**

- **Given** a `PENDING_PAYMENT` booking within its window
  **When** a valid VNPAY success callback arrives
  **Then** the booking becomes `CONFIRMED` and the payment is recorded once.
- **Given** an `EXPIRED` booking
  **When** a valid success callback arrives late
  **Then** the booking stays `EXPIRED` and a refund is signaled via the payment lifecycle.
- **Given** the same callback delivered twice
  **When** it is replayed
  **Then** there is no second transition or duplicate effect.

---

## [ ] BK-07: Booking cancellation API and refund event emission

**Completion review (2026-11-01):** Keep IN_PROGRESS: cancellation/release/event emission exist, but no durable refund intent consumer/worker is wired (PAY-04). In-process BookingCancelled emission does not prove paid refunds execute exactly once.

```text
Status: IN_PROGRESS
Size: M
Blocked by: BK-05, PAY-04
```

**Progress:** `POST /api/v1/bookings/:id/cancel` implemented: owner-only row lock, idempotent repeat, `PENDING_PAYMENT` (unpaid) cancellation releases the slot with `refundStatus: NONE`, and `CONFIRMED` cancellation before `start_time` transitions to `CANCELLED` with `refundStatus: PENDING`; policy gates `PLAYER_CAN_CANCEL_BOOKING` and `PLAYER_CANCELLATION_DEADLINE_MINUTES` enforced. The `BookingCancelled` domain event is now emitted via `services/booking/booking-events.ts` on both player cancel and system release. The system-initiated `MatchBookingPort.releaseMatchHold` (`CONFIRMED → CANCELLED` / `PENDING_PAYMENT → CANCELLED`) is implemented. Remaining for DONE: a durable consumer of the refund event, which requires the PaymentModule refund worker (`PAY-04`). Covered by `booking-write.test.ts` (unpaid path) and `booking-confirm-match-facility.test.ts` (release + event).

**Objective:** Let the owning Player cancel an eligible booking before start time, releasing the slot and triggering a full refund for paid bookings exactly once.

**Scope**

- In scope:
  - `POST /api/v1/bookings/:id/cancel` by the owning Player.
  - `PENDING_PAYMENT` (unpaid) cancellation → `CANCELLED`, slot released, no refund.
  - `CONFIRMED` cancellation before `start_time` under policy (`PLAYER_CAN_CANCEL_BOOKING`, `PLAYER_CANCELLATION_DEADLINE_MINUTES`) → `CANCELLED` + `BookingCancelled` event.
  - Idempotent repeated cancel; feature error codes from Tech Design §9.8.
- Out of scope:
  - Refund execution (PAY-04) and Owner-side cancellation.

**Implementation requirements**

1. Lock the booking row; validate ownership, status, and deadline against `Asia/Ho_Chi_Minh`.
2. For a paid booking, transition to `CANCELLED` and emit `BookingCancelled` in the same transaction.
3. Reject cancellation for `IN_PROGRESS`/`COMPLETED` and after the deadline.
4. Repeated cancel on an already `CANCELLED` booking returns `200` with no second event.

**Files/areas affected**

- `backend/src/services/booking/booking.service.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/booking/` `[Proposed — verify during implementation]`
- `backend/src/repositories/BookingRepository.ts`

**API impact:** `POST /api/v1/bookings/:id/cancel`.

**Schema/config impact:** Reads `PLAYER_CAN_CANCEL_BOOKING` and `PLAYER_CANCELLATION_DEADLINE_MINUTES`; writes only booking status.

**Verification**

- Unit: Cancellation policy matrix (unpaid/paid, before/after start, disabled).
- Integration: Paid cancellation emits exactly one refund event; unpaid cancellation triggers no refund.
- API-level: `200`; `401`; `403 BOOKING_FORBIDDEN_OWNER`; `404 BOOKING_NOT_FOUND`; `409` cancellation codes.
- E2E for a critical flow: Paid cancel → `CANCELLED` and refund status `PENDING`.
- Edge/failure/concurrency: Concurrent cancels produce one transition and one refund event.
- Manual: N/A

**Acceptance criteria**

- **Given** a `CONFIRMED` paid booking before `start_time`
  **When** the owner cancels it
  **Then** it becomes `CANCELLED` and one full-refund event is emitted.
- **Given** an unpaid `PENDING_PAYMENT` booking before `start_time`
  **When** the owner cancels it
  **Then** it becomes `CANCELLED`, the slot is released, and no refund event is emitted.
- **Given** a booking at/after `start_time`
  **When** the owner attempts to cancel
  **Then** the API returns `409 BOOKING_CANCELLATION_DEADLINE_PASSED`.

---

## [x] BK-08: My-bookings list and booking detail APIs

```text
Status: DONE
Size: S
Blocked by: BK-05
```

**Progress:** `GET /api/v1/bookings/my-bookings` (optional `status`, `timeScope` `UPCOMING`/`PAST`/`ALL`, `meta` pagination, newest-first) and `GET /api/v1/bookings/:id` (owner-scoped, `403 BOOKING_FORBIDDEN_OWNER`, pricing breakdown, payment/refund status) implemented with read-time effective-status computation (`PENDING_PAYMENT`→`EXPIRED`, `CONFIRMED`→`IN_PROGRESS`, `IN_PROGRESS`→`COMPLETED`). Covered by `booking-write.test.ts`.

**Objective:** Let a Player view their booking history and a single booking detail, including refund status.

**Scope**

- In scope:
  - `GET /api/v1/bookings/my-bookings` with `status`, `timeScope` (`UPCOMING`/`PAST`/`ALL`), `page`, `limit`; newest first; includes `CANCELLED`/`EXPIRED`.
  - `GET /api/v1/bookings/:id` owner-scoped, with pricing breakdown and payment/refund status.
  - Effective-status computation against `expires_at`/`start_time`/`end_time` (Tech Design §15).
- Out of scope:
  - Admin/Owner views and exports.

**Implementation requirements**

1. Require `authenticate` + `requireRole('PLAYER')` and scope every read to the authenticated `player_id`.
2. Return the global pagination `meta` and `{ data: ... }` shape.
3. Do not leak the existence of other players' bookings.

**Files/areas affected**

- `backend/src/controllers/booking/` `[Proposed — verify during implementation]`
- `backend/src/repositories/BookingRepository.ts`

**API impact:** `GET /api/v1/bookings/my-bookings`, `GET /api/v1/bookings/:id`.

**Schema/config impact:** None.

**Verification**

- Unit: `timeScope` classification and effective status derivation.
- Integration: A Player sees only their own bookings.
- API-level: `200` with `meta`; `401`; `403`; `404 BOOKING_NOT_FOUND`.
- E2E for a critical flow: A confirmed booking appears in upcoming bookings.
- Edge/failure/concurrency: A timed-out hold appears as `EXPIRED` even before the worker runs.
- Manual: N/A

**Acceptance criteria**

- **Given** a Player with one upcoming and one past booking
  **When** they request `timeScope=UPCOMING`
  **Then** only the upcoming booking is returned with correct pagination `meta`.
- **Given** another Player's booking id
  **When** the requester asks for its detail
  **Then** the API denies access without leaking the booking.

---

## [x] BK-09: Booking expiry and state-transition worker

```text
Status: DONE
Size: M
Blocked by: BK-05
```

**Progress:** In-process `setInterval` scheduler (`jobs/booking-state.job.ts`, 60s tick + startup catch-up, `unref`ed) started from `index.ts`; sweep logic in `services/booking/booking-state.service.ts`. Atomic claiming in `BookingRepository` with `FOR UPDATE SKIP LOCKED` and a bounded batch (200): `PENDING_PAYMENT → EXPIRED` (`expires_at <= now()`), `CONFIRMED → IN_PROGRESS` and `IN_PROGRESS → COMPLETED` using `(booking_date + time) <= now() AT TIME ZONE 'Asia/Ho_Chi_Minh'`. Each transition is idempotent (source-status predicate). Covered by `booking-state-worker.test.ts` (sweep + second-sweep idempotency).

**Objective:** Automatically expire unpaid holds and advance time-based booking states using the confirmed in-process scheduler.

**Scope**

- In scope:
  - Sweep `PENDING_PAYMENT` bookings past `expires_at` → `EXPIRED` and release the slot.
  - Advance `CONFIRMED` → `IN_PROGRESS` at `start_time` and `IN_PROGRESS` → `COMPLETED` at `end_time`.
  - Database claiming/locking so overlapping ticks do not double-process.
- Out of scope:
  - Refund execution (PAY-04) and notification delivery (BK-10).

**Implementation requirements**

1. Use the confirmed in-process `setInterval` scheduler with a 60-second tick (no new infrastructure), per Tech Design §15.1.
2. Claim each due transition with one atomic conditional update (`FOR UPDATE SKIP LOCKED`, bounded batch per tick); make each transition idempotent and skip rows already transitioned.
3. Use the fixed `Asia/Ho_Chi_Minh` timezone for time comparisons.
4. Respect the snapshotted `expires_at`; do not extend or shorten existing deadlines.

**Files/areas affected**

- `backend/src/jobs/` or `backend/src/workers/` `[Proposed — verify during implementation]`
- `backend/src/services/booking/booking-state.service.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/BookingRepository.ts`

**API impact:** None.

**Schema/config impact:** Uses `BOOKINGS.expires_at` and `BOOKING_PAYMENT_TIMEOUT_MINUTES`; no schema change.

**Verification**

- Unit: Timeout boundary and transition timing.
- Integration: DB claiming prevents concurrent processing of the same row.
- API-level: N/A
- E2E for a critical flow: An unpaid hold becomes `EXPIRED` and its slot becomes bookable.
- Edge/failure/concurrency: Two scheduler ticks cannot process the same booking; a restart does not reprocess completed transitions.
- Manual: Observe the slot released after the configured timeout.

**Acceptance criteria**

- **Given** a `PENDING_PAYMENT` booking past `expires_at`
  **When** the worker runs
  **Then** it becomes `EXPIRED` and the slot is released.
- **Given** a `CONFIRMED` booking whose `start_time` has passed
  **When** the worker runs
  **Then** it becomes `IN_PROGRESS`, and later `COMPLETED` at `end_time`.

---

## [ ] BK-10: Booking in-app notifications

```text
Status: BLOCKED
Size: S
Blocked by: BK-06, BK-07
```

**Objective:** Persist in-app notifications for booking confirmation, hold expiry, cancellation, and refund status.

**Scope**

- In scope:
  - Persist a `NOTIFICATIONS` row for the owning Player on booking confirmation, hold expiry, cancellation, and refund status changes.
  - Reuse the platform unread-notifications read endpoint contract.
- Out of scope:
  - Push/email delivery and a new notification endpoint.

**Implementation requirements**

1. Create notifications within (or immediately after) the transaction that changes the booking/payment state where practical.
2. Scope recipients to the owning Player.
3. Do not block the primary booking transition on notification failure in a way that corrupts state; record failures for observability.

**Files/areas affected**

- `backend/src/services/notifications/` `[Proposed — verify during implementation]`
- `backend/src/services/booking/` `[Proposed — verify during implementation]`

**API impact:** Consumes the platform `GET /api/v1/notifications/unread`; adds no new path.

**Schema/config impact:** Uses `NOTIFICATIONS`; no schema change.

**Verification**

- Unit: Notification creation per event type and recipient.
- Integration: Confirmation/expiry/cancellation/refund each persist the expected notification.
- API-level: Unread notifications include booking notifications.
- E2E for a critical flow: Confirm a booking and see the notification.
- Edge/failure/concurrency: N/A
- Manual: Client polling surfaces the notification.

**Acceptance criteria**

- **Given** a booking confirmation
  **When** the owning Player polls unread notifications
  **Then** the confirmation notification is returned.
- **Given** a booking cancellation with a refund
  **When** the refund status changes
  **Then** the Player receives a refund-status notification.

---

## [x] BK-11: Frontend court search and availability UI (polling)

```text
Status: DONE
Size: M
Blocked by: BK-03, BK-04
```

**Progress:** Search page (`pages/booking/CourtSearchPage.tsx`) with area/date/time filters (`components/booking/CourtSearchFilters.tsx`), court cards, loading/empty/error states, price-from sorting and pagination; court detail page (`pages/booking/CourtDetailPage.tsx`) with the availability grid + start-time/duration slot picker and per-segment/estimated pricing (`components/booking/AvailabilityGrid.tsx`). Near-real-time polling via `hooks/useCourtAvailability.ts` (8s) with a fixed `Asia/Ho_Chi_Minh` date helper (`utils/booking.ts`); API transport stays in `services/bookingService.ts`. Routes `/courts` and `/courts/:courtId` registered in `app/router.tsx`. Verification: `tsc -b`, `oxlint`, and `vite build` pass; live smoke against the dev API for search and availability. The slot picker intentionally stops before booking creation/payment (BK-12). Automated browser coverage lands with BK-14.

**Objective:** Build the public court discovery and slot-availability experience with near-real-time polling.

**Scope**

- In scope:
  - Search page (area, date, time) composing the shared table/filter components.
  - Court detail view with the availability grid and slot picker (start time + duration).
  - HTTP polling every 5–10 seconds while the slot picker is open.
  - Loading, empty, success, error, and unavailable states.
- Out of scope:
  - Booking creation/payment (BK-12) and any server-side rule.
  - New polling library or state-management dependency.

**Implementation requirements**

1. Keep API transport in a feature service; keep components presentational where possible.
2. Compose the shared table/filter components; do not fork them.
3. Treat the client availability as advisory; surface the server conflict on submission.
4. Handle auth-free access for search/availability.

**Files/areas affected**

- `frontend/src/features/booking/pages/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/components/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/services/bookingService.ts` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes `GET /api/v1/courts` and `GET /api/v1/courts/:id/availability`.

**Schema/config impact:** None.

**Verification**

- Unit: Filter form validation; availability interval rendering.
- Integration: Search → availability → select slot.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A slot becoming unavailable during polling updates the grid.
- Manual: Confirm polling refresh and empty/loading states.

**Acceptance criteria**

- **Given** a Player searching by area and date
  **When** results load
  **Then** matching courts and their availability are shown with loading/empty states handled.
- **Given** the slot picker is open
  **When** another booking removes a slot
  **Then** the grid reflects the change within one polling cycle.

---

## [ ] BK-12: Frontend booking creation and VNPAY payment UI

```text
Status: BLOCKED
Size: M
Blocked by: BK-06
```

**Progress:** The non-payment half is delivered: `BookingSummaryPage` (P11 — player info, court/time, price breakdown from the selected availability interval, terms, create-hold CTA) and `BookingPendingPage` (P12 — hold countdown to `expiresAt`, cancel order, disabled VNPAY CTA). The court-detail slot picker now continues into this flow. Remaining for DONE: the VNPAY redirect and post-return confirmation, which require BK-06.

**Objective:** Let a Player create a hold, complete VNPAY payment, and see immediate confirmation.

**Scope**

- In scope:
  - Booking form (start time + duration) and hold countdown to `expiresAt`.
  - Two-step flow: create hold, then request the payment URL and redirect to VNPAY.
  - Post-return status refresh and confirmed-booking feedback.
  - Handles `409 BOOKING_SLOT_UNAVAILABLE` by prompting a new slot.
- Out of scope:
  - Server-side pricing/eligibility logic and refund handling.

**Implementation requirements**

1. Keep API transport in the feature service; no business logic in components.
2. Show the full price breakdown and cancellation policy before confirming.
3. Handle redirect return, failure, and expired-hold states recoverably.
4. Do not copy VNPAY secrets or provider payloads into the client contract.

**Files/areas affected**

- `frontend/src/features/booking/pages/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/components/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes `POST /api/v1/bookings` and `POST /api/v1/bookings/:booking_id/payment`.

**Schema/config impact:** None.

**Verification**

- Unit: Hold countdown and error-state rendering.
- Integration: Create hold → payment redirect → confirmation.
- API-level: N/A
- E2E for a critical flow: Search → book → pay → confirmed booking visible.
- Edge/failure/concurrency: Lost slot returns the Player to a recoverable slot picker.
- Manual: Complete a sandbox VNPAY payment.

**Acceptance criteria**

- **Given** a selected free slot
  **When** the Player submits the booking form
  **Then** a `PENDING_PAYMENT` hold is created and the payment redirect starts.
- **Given** a successful payment return
  **When** the UI refreshes
  **Then** the booking is shown as `CONFIRMED`.
- **Given** a slot taken before submission
  **When** the server responds `409`
  **Then** the UI shows an unavailable message and offers another slot.

---

## [x] BK-13: Frontend my-bookings and cancellation UI

```text
Status: DONE
Size: M
Blocked by: BK-07, BK-08
```

**Progress:** `pages/booking/MyBookingsPage.tsx` (status/timeScope tabs, pagination, loading/empty/error states) and `pages/booking/BookingDetailPage.tsx` (facility/court, pricing breakdown from `BOOKING_PRICING_DETAILS`, payment/refund status, cancel action). `components/booking/BookingListCard.tsx`, `BookingStatusBadge.tsx`, `CancelBookingModal.tsx` (accessible via `useModalA11y`, shows the 100% refund / no-refund policy). Service methods `getMyBookings`/`getBookingDetail`/`cancelBooking` added; routes `/bookings` and `/bookings/:bookingId` registered and linked from the Player account menu. Verification: `tsc -b`, `oxlint`, `vite build` pass.

**Progress (follow-up):** Feature code lives under `frontend/src/features/booking/`. `BookingStatusNotice` adds the P15 (completed), P16 (cancelled), P17 (expired) and P18/P10 (refund status incl. "no refund" for unpaid cancellation) views within the booking detail. `SelectDatePage` (P09) and `FacilityDetailPage` (P07) were added; the court detail links to its facility. Verification: `tsc -b`, `oxlint`, `vite build` pass.

**Objective:** Let a Player view upcoming/past bookings and cancel eligible bookings with clear refund feedback.

**Scope**

- In scope:
  - My-bookings list (upcoming/past, status filters) using the shared table components.
  - Booking detail with pricing breakdown, payment/refund status.
  - Cancellation confirmation with refund implications; result feedback.
- Out of scope:
  - Owner/Admin booking management.

**Implementation requirements**

1. Keep API transport in the feature service; render loading/empty/error states.
2. Show the cancellation policy and refund status (`REFUND_PENDING`/`REFUNDED`/`REFUND_FAILED`) where applicable.
3. Disable cancellation for ineligible statuses/time with a clear reason.

**Files/areas affected**

- `frontend/src/features/booking/pages/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/components/` `[Proposed — verify during implementation]`
- `frontend/src/features/booking/services/bookingService.ts` `[Proposed — verify during implementation]`

**API impact:** Consumes `GET /api/v1/bookings/my-bookings`, `GET /api/v1/bookings/:id`, `POST /api/v1/bookings/:id/cancel`.

**Schema/config impact:** None.

**Verification**

- Unit: Status/timeScope rendering and cancel-eligibility display.
- Integration: List → detail → cancel → status update.
- API-level: N/A
- E2E for a critical flow: Cancel a paid booking and see `CANCELLED` with refund status.
- Edge/failure/concurrency: Cancelling an expired hold shows `CANCELLED` without refund.
- Manual: Confirm state after reload.

**Acceptance criteria**

- **Given** a Player with bookings in multiple statuses
  **When** they open my-bookings
  **Then** each booking shows the correct status and refund state.
- **Given** an eligible paid booking
  **When** the Player confirms cancellation
  **Then** the booking shows `CANCELLED` and refund status `PENDING`.

---

## [ ] BK-14: End-to-end and concurrency verification

```text
Status: BLOCKED
Size: M
Blocked by: BK-01 … BK-13
```

**Progress:** The unpaid-flow browser spec `frontend/e2e/booking-flow.spec.ts` was added (login → `/courts` → court detail → select slot → P11 summary → create hold → P12 pending → cancel → detail). It uses a new test-only fixture endpoint `POST /api/v1/test/seed-court` in the e2e runner. Remaining for DONE: the payment-inclusive E2E and the concurrency/idempotency assertions, which require BK-06.

**Objective:** Verify the critical end-to-end flows and the concurrency/idempotency guarantees of the feature.

**Scope**

- In scope:
  - E2E: search → availability → create hold → pay → `CONFIRMED` → appears in history.
  - E2E: paid cancel → `CANCELLED` → refund status; unpaid cancel → released slot.
  - Expiry: unpaid hold → `EXPIRED` → slot bookable.
  - Concurrency: simultaneous booking of one interval; duplicate VNPAY callback; late callback after expiry; concurrent cancel.
- Out of scope:
  - New product behavior; only verification of approved behavior.

**Implementation requirements**

1. Use the approved test tools (Vitest + Supertest; Playwright for the main flow) against the separate test database.
2. Seed explicit fixtures for courts, pricing, and bookings.
3. Assert on observable state and API contracts, not internal implementation.
4. Do not weaken validation or authorization to make a test pass.

**Files/areas affected**

- `backend/src/__tests__/` `[Proposed — verify during implementation]`
- `frontend/` E2E harness `[Proposed — verify during implementation]`

**API impact:** Exercises all feature endpoints; no new path.

**Schema/config impact:** None.

**Verification**

- Unit: N/A (covered by earlier tasks)
- Integration: All critical flows against the test database.
- API-level: Contract and status-code assertions for success and failure paths.
- E2E for a critical flow: Search → book → pay → confirmed; cancel → refund.
- Edge/failure/concurrency: One winner under contention; callback idempotency; no reopening on late payment.
- Manual: N/A

**Acceptance criteria**

- **Given** a fresh test database with seeded courts and pricing
  **When** the full booking-and-payment E2E runs
  **Then** a confirmed booking exists exactly once and appears in the Player's history.
- **Given** a valid webhook replayed after the booking expired
  **When** the webhook is processed
  **Then** the booking is not reopened and a refund is signaled.
- **Given** concurrent booking requests for the same interval
  **When** they run
  **Then** exactly one succeeds and the database contains no overlapping active bookings.

---

## Completion Checklist (per task, when implemented)

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `[TBD]` or business rule was silently resolved.
- [ ] No unrelated files or refactors were included.

## Matchmaking readiness integration tasks — approved 2026-10-10

Add to cancellation/link-boundary implementation: caller-owned transactions,
shared Player/Match/Booking lock order, linked Match cancellation on Booking
cancel, durable refund requests, policy-refusal outcome and idempotent replay.
Coordinate with Matchmaking MM-07/MM-20; verification includes link-vs-cancel,
retry after crash and no second refund. Existing implementation statuses remain.

2026-10-23 Court Owner integration follow-up: BK-04/BK-05 remain DONE for their original scope. CO-04 adds maintenance occupancy checks to availability and creation, shared facility→court-date lock order and opening-hour edit concurrency verification (Tech Design §7.2.1). This work is not implicitly complete under the existing checkmarks.

---

## Social Matchmaking extension — impact note (Approved design, Phase 2, 2026-10-31)

The Booking lifecycle is unchanged (Tech Design "Social Matchmaking
integration"). One Booking task is added for the global lock order (BK-15).
Dependencies created by the extension:

- BK-06 (payment) and BK-07 (cancellation) gate MM-19 and MM-20, which gate
  linking a booking to a post and the host's "cancel booking" choice. Until they
  are DONE, the extension ships with external courts only (approved Q14).
- Owner schedule read changes (recruitment-linked bookings) are delivered in MM-21/MM-27
  scope, not as Booking tasks.
- BK-14 verification is unchanged; extension cases live in MM-30.

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| BK-15 | Align Booking create with the global lock order | Approved | Matchmaking Tech Design §24.7 approved | S |

## [ ] BK-15: Align Booking create with the global lock order

```text
Status: Approved
Size: S
Blocked by: None — global lock order approved 2026-10-31
```

**Objective:** Remove the only observed rank inversion (`bookings` before `users`) so Booking create and Matchmaking booking linking take locks in the same direction (Matchmaking Tech Design §24.7.3).

**Scope**

- In scope: in `persistBookingTransaction`, LIMITED mode, lock the player's `users` row before `facilities`/advisory/`courts`/stale-hold update; keep the active-booking count inside the same transaction; verify the audited Admin status update (a standalone USERS update, no session/lockout transaction) still matches §24.7.3; do not add an unrelated Auth behavior change.
- Out of scope: any change to Booking business rules, hold timeout, exclusion constraint or NONE mode.

**Implementation requirements**

1. Behavior and error codes unchanged (`BOOKING_ACTIVE_LIMIT_REACHED`, `BOOKING_SLOT_UNAVAILABLE`).
2. BK-05 stays DONE; this is a new change with its own tests.

**Files/areas affected**

- `backend/src/services/booking/booking.service.ts`, `backend/src/repositories/booking/BookingRepository.ts`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- Integration: existing Booking create tests pass unchanged.
- Concurrency: concurrent creates by the same player at the active limit still allow exactly the limit; a create running concurrently with a transaction that holds the same `users` row then locks a `bookings` row completes without deadlock (repeated runs).

**Acceptance criteria**

- **Given** LIMITED mode **When** a booking is created **Then** the player's `users` row is the first lock taken in the transaction.
- **Given** two concurrent creates by one player with one remaining slot **Then** one succeeds and the other returns `409 BOOKING_ACTIVE_LIMIT_REACHED`.
