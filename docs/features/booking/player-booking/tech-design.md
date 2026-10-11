# Court Booking — Player Flow — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/booking/player-booking/prd.md
Scope: Court Booking — Player Flow
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26)
```

> Ready: reviewed and approved by the human owner on 2026-09-26. All open
> technical decisions were resolved in §21, and the required authoritative
> documentation updates were applied in the same working session.

## 2. Context

This design implements the Player-facing Court Booking flow defined in
`docs/features/booking/player-booking/prd.md`: search courts, inspect real-time
slot availability, create a `PENDING_PAYMENT` hold, pay the full booking amount
online, receive immediate real-time confirmation, view booking history, and
cancel an eligible booking before start time with a refund where applicable.

The flow crosses three modules:

- **BookingModule** (new): owns the Booking lifecycle, availability computation,
  pricing snapshot, hold expiry, and cancellation.
- **PaymentModule** (existing platform capability): owns VNPAY payment creation,
  callback validation, idempotent confirmation, and refund execution
  (`docs/features/platform/payments-refunds/tech-design.md`).
- **NotificationModule** (platform capability): owns in-app notifications for
  booking confirmation, hold expiry, cancellation, and refund status.

Court, facility, and pricing data are owned by other features; BookingModule
only reads them.

## 3. Technical Problem

The design must solve:

1. **Slot contention** — multiple Players may attempt to book the same court and
   time concurrently. A double booking must be impossible.
2. **Temporary hold** — a selected slot must be held while payment is pending,
   with a snapshotted deadline, then released automatically on timeout.
3. **Real-time availability** — clients need a consistent view of free slots that
   does not block on (or trust) stale client data.
4. **Idempotent payment** — a VNPAY callback may be delivered more than once, or
   arrive after the hold has expired. It must never double-confirm or reopen an
   expired booking.
5. **Pricing snapshot** — the price used at booking creation must be persisted so
   later pricing changes do not alter the booking.
6. **Cancellation and refund** — cancellation must be validated against status,
   ownership, and time; a paid cancellation must trigger a full refund exactly
   once.

## 4. Goals

- Provide resource-oriented REST endpoints for court search, availability,
  booking creation, booking history/detail, and cancellation.
- Guarantee non-overlapping active bookings per court at the database level.
- Make payment confirmation and cancellation idempotent.
- Compute availability and price from the existing `COURTS`, `COURT_PRICINGS`,
  `FACILITIES`, and `BOOKINGS` schema without adding a slot table.
- Expire unpaid holds and advance time-based booking states via the confirmed
  in-process scheduler, with read-time effective-status filtering.
- Keep BookingModule, PaymentModule, and NotificationModule responsibilities
  separate.

## 5. Non-Goals

- Court Owner court/slot/price management endpoints (separate feature).
- A standalone refund-management module or Owner refund console.
- Split bill, partial payment, or partial refund.
- Recurring/seasonal booking.
- Matchmaking/Tournament automatic booking creation internals (they consume the
  same BookingModule primitives but are designed in their own documents).
- New realtime transport; availability uses HTTP polling as confirmed.
- Cross-midnight booking (PRD non-goal).

## 6. Upstream References

- Governing PRD: `docs/features/booking/player-booking/prd.md`
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §3.2, §5, §6, §7
- Documentation rules: `docs/documentation-guide.md` §6, §9
- Global architecture/technology: `docs/architecture/tech-stack.md`
  (PERN, Zod, HTTP polling 5–10s, VNPAY, in-process scheduler, in-app notifications)
- Global coding/API conventions: `docs/architecture/conventions.md`
  (`/api/v1/` prefix, offset pagination, error shape, 3-tier validation)
- Business rules/configuration: `docs/business-rules-config-matrix.md` §2, §8.1, §8.2
- Global database schema: `docs/architecture/database-schema.md`
  §2.2 Booking, §3.5 `FACILITIES`, §3.6 `COURTS`, §3.7 `COURT_PRICINGS`,
  §3.8 `BOOKINGS`, §3.9 `BOOKING_PRICING_DETAILS`, §3.10 `PAYMENTS`, §5.8, §8
- Payment/refund contract: `docs/features/platform/payments-refunds/tech-design.md`
- Facility/court status behavior: `docs/features/admin/court-management/prd.md`

**Schema gap resolved (Q2):** `BOOKINGS` (§3.8) has no `expires_at` column, while
`§2.2` and `§8.1` state that a pending booking keeps an established
`expires_at` snapshot. The approved design adds `BOOKINGS.expires_at`, mirroring
`TOURNAMENT_REGISTRATIONS.expires_at`.

## 7. Proposed Technical Design

### 7.1 Module and Layer Boundaries

The feature follows the existing PERN monolith layering (routes → controller →
service → repository) matching the Tournament implementation.

- **Application/service boundary (`BookingService`)**: authorization checks,
  availability/pricing computation, booking creation, cancellation, state
  transitions, transaction orchestration, event emission.
- **Persistence boundary (`BookingRepository`, `CourtRepository`)**: all SQL,
  row locking, overlap checks, and snapshot inserts. No policy decisions here.
- **Payment boundary**: the existing `PaymentModule` owns
  `POST /api/v1/bookings/:booking_id/payment` and the VNPAY IPN endpoint; it
  calls a narrow `confirmBooking(bookingId, paymentId)` contract on
  `BookingService`.
- **Notification boundary**: BookingModule emits domain events; NotificationModule
  persists in-app notifications.
- **Scheduler boundary**: an in-process interval (confirmed in `tech-stack.md`)
  runs booking expiry and time-based state advancement, using database claiming
  so overlapping runs are safe.
- **Matchmaking integration (not used in MVP)**: the `MatchBookingPort`
  `createMatchHold`/`releaseMatchHold` primitives are **not used in the MVP**.
  After the 2026-10-10 scope reduction, Matchmaking is invitation-only: the
  request owner creates the match booking through the normal Player-facing
  `POST /api/v1/bookings` flow and links it to the Match from the Matchmaking
  feature. BookingModule does not provide system-initiated holds for Matchmaking
  in MVP. The contract may be reintroduced if automatic booking is approved
  later (`docs/features/matchmaking/matchmaking/tech-design.md` §7.5, §21).
- **Tournament court reservation**: scheduling a tournament match creates a
  system-created, **non-payment** booking that holds the court under the same
  eligibility, non-overlap, and pricing-snapshot rules as a Player booking. It
  is not Player-owned, is never paid or refunded, and is released when the
  tournament match is cancelled. TournamentModule calls this through an internal
  contract (the existing `CourtService`/`BookingService` boundary), not the
  Player-facing endpoint.

The cross-module interfaces are declared in `backend/src/contracts/`:
`BookingService.ts` (`confirmBooking`), `PaymentService.ts`, and
`CourtService.ts`. `MatchBookingPort.ts` is retained but unused in MVP. The
tournament court reservation primitive is added to the
`CourtService`/`BookingService` boundary when the Tournament scheduling task
(TRN-07) is implemented.

### 7.2 Read Model for Availability

Slots are **derived**, not stored:

1. Resolve the court's facility, opening/closing hours, and eligibility.
2. Load `COURT_PRICINGS` rows valid for the requested date.
3. Build candidate intervals across opening→closing covered by pricing rows.
4. Subtract intervals occupied by active bookings for that court/date.
5. Return merged free intervals with per-segment prices.

An interval is considered occupied when
`status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS')` **and** for
`PENDING_PAYMENT`, `expires_at > now()`. This prevents an already-timed-out hold
from blocking a slot between scheduler sweeps.

Because a PostgreSQL partial exclusion constraint cannot reference the
non-immutable `now()`, the read model and the database guard are kept consistent
by having booking creation first mark elapsed (or deadline-less)
`PENDING_PAYMENT` holds for the target court/date as `EXPIRED` inside the same
transaction, before the overlap re-check and insert. The scheduler remains the
authoritative periodic sweep; this transactional release only removes holds
whose deadline has already passed.

### 7.3 Pricing Snapshot

`COURT_PRICINGS.price` is the **price per hour** (Q3). At booking creation, the
requested `[start_time, end_time]` is split at pricing boundaries. For each
overlapping segment:

```text
amount = price × (overlap_minutes / 60)
```

A row is inserted into `BOOKING_PRICING_DETAILS` with the snapshotted price and
computed amount; `BOOKINGS.total_amount` is the exact sum. `BOOKINGS.unit_price`
snapshots the applicable hourly rate for a single-segment booking; for a
multi-segment booking it stores the effective hourly rate
`round(total_amount / duration_hours, 2)`, with `total_amount` authoritative.
Snapshot rows are immutable after confirmation.

### 7.4 Client/Server Boundary

- Availability is exposed as a read endpoint the client polls every 5–10 seconds
  while the slot picker is open (confirmed HTTP polling).
- Availability is **always re-validated server-side** inside the booking-creation
  transaction; the client view is advisory only.
- The client countdown to `expires_at` is advisory; expiry is authoritative
  server-side.

### 7.5 Timezone

All date/time combination and opening-hours comparison use the fixed application
timezone `Asia/Ho_Chi_Minh` (Q7). `booking_date + start_time`/`end_time` are
interpreted in that zone when computing instants, `expires_at`, auto-transitions,
and the overlap range.

### 7.6 Cross-Cutting Concerns

- **Validation**: Zod schemas at the request boundary for `params`, `query`, and
  `body`, using the existing `validate` middleware.
- **Errors**: existing centralized `errorHandler` and the global JSON error shape.
- **Auth**: existing `authenticate` + `requireRole('PLAYER')` middleware.
- **Config**: booking configuration read through the centralized config boundary;
  timeouts snapshotted at creation (`docs/business-rules-config-matrix.md` §8.1).

## 8. Behavior, State, and Flow

### 8.1 Booking State Machine

Governed by `BOOKINGS.status`.

```text
PENDING_PAYMENT ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
        │               │
        ├──► EXPIRED    └──► CANCELLED
        └──► CANCELLED (Player cancels an unpaid hold)
```

Transitions:

| From | To | Trigger |
| --- | --- | --- |
| `PENDING_PAYMENT` | `CONFIRMED` | Successful, valid payment callback before `expires_at` |
| `PENDING_PAYMENT` | `EXPIRED` | Payment timeout (`expires_at` elapsed) |
| `PENDING_PAYMENT` | `CANCELLED` | Player cancels the unpaid hold before `start_time` |
| `CONFIRMED` | `IN_PROGRESS` | `start_time` reached (`Asia/Ho_Chi_Minh`) |
| `IN_PROGRESS` | `COMPLETED` | `end_time` reached (`Asia/Ho_Chi_Minh`) |
| `CONFIRMED` | `CANCELLED` | Player cancellation before `start_time` |
| `IN_PROGRESS` | — | Not cancellable by the Player |

- Preconditions: court/facility eligible; start time in the future; slot within
  advance window and operating hours; duration within min/max; active-booking
  limit not exceeded.
- Postconditions: exactly one active booking per court interval; pricing
  snapshot immutable; cancellation/refund at most once.
- `IN_PROGRESS` is terminal for cancellation (no Player cancel after start).

> **Frozen-lifecycle extension (Q12):** `PENDING_PAYMENT → CANCELLED` extends the
> documented lifecycle. This requires the authoritative updates listed in §21
> (business rules and schema) in the same working session as implementation.

### 8.2 Sequence — Booking Creation and Payment

```mermaid
sequenceDiagram
    participant P as Player (React)
    participant B as BookingService
    participant DB as PostgreSQL
    participant PM as PaymentModule
    participant V as VNPAY

    P->>B: POST /api/v1/bookings { courtId, bookingDate, startTime, durationMinutes }
    B->>B: Zod validate + auth (PLAYER)
    B->>DB: BEGIN
    B->>DB: SELECT court ... FOR UPDATE
    B->>DB: check court/facility eligibility, active limit
    B->>DB: check overlap + compute pricing
    B->>DB: INSERT booking (PENDING_PAYMENT, expires_at, total_amount)
    B->>DB: INSERT booking_pricing_details
    B->>DB: COMMIT
    B-->>P: 201 { booking, expiresAt, totalAmount }

    P->>PM: POST /api/v1/bookings/:id/payment
    PM->>DB: create/reuse PAYMENT (PENDING)
    PM-->>P: { paymentUrl }
    P->>V: pay on VNPAY
    V->>PM: IPN POST /api/v1/payments/vnpay/webhook
    PM->>PM: validate vnp_SecureHash
    PM->>DB: BEGIN; claim PAYMENT
    PM->>B: confirmBooking(bookingId, paymentId) in same transaction
    B->>DB: PENDING_PAYMENT -> CONFIRMED (or refund-only if expired)
    PM->>DB: PAYMENT -> SUCCESS; COMMIT
    PM-->>V: provider acknowledgement
    P->>B: GET /api/v1/bookings/my-bookings
    B-->>P: booking status CONFIRMED
```

### 8.3 Sequence — Concurrent Slot Contention

```mermaid
sequenceDiagram
    participant A as Player A
    participant B as Player B
    participant S as BookingService
    participant DB as PostgreSQL

    A->>S: POST /bookings (court 1, 18:00)
    B->>S: POST /bookings (court 1, 18:00)
    S->>DB: BEGIN; SELECT court 1 FOR UPDATE  (A acquires)
    S->>DB: B: BEGIN; SELECT court 1 FOR UPDATE (blocks)
    S->>DB: A: overlap check (none) -> INSERT hold -> COMMIT
    DB-->>S: B unblocked; sees A's committed hold
    S->>DB: B: overlap check -> conflict
    S-->>B: 409 BOOKING_SLOT_UNAVAILABLE
```

The exclusion constraint (§10/§13) is the final integrity guard if the
application check is bypassed.

### 8.4 Sequence — Cancellation and Refund

```mermaid
sequenceDiagram
    participant P as Player
    participant B as BookingService
    participant DB as PostgreSQL
    participant RW as Refund Worker
    participant V as VNPAY

    P->>B: POST /api/v1/bookings/:id/cancel
    B->>DB: BEGIN; SELECT booking FOR UPDATE
    B->>B: validate owner, status, now < start_time, policy enabled
    B->>DB: booking -> CANCELLED
    B->>DB: emit BookingCancelled; COMMIT
    B-->>P: 200 { status: CANCELLED, refundStatus: PENDING }
    RW->>DB: claim PAYMENT SUCCESS -> REFUND_PENDING
    RW->>V: refund request
    V-->>RW: result
    RW->>DB: REFUNDED / REFUND_FAILED
```

## 9. API Design

All paths are namespaced under `/api/v1`. Successful responses use
`{ data: ... }`; collections add `meta: { page, limit, total, totalPages }`;
errors use `{ error: { code, message, details? } }`.

### 9.1 Court Search (public)

- Resource: court discovery (Q6).
- Method/path: `GET /api/v1/courts`.
- Query: `city`, `district`, `date`, `startTime`, `endTime`, `page`, `limit`.
  When `date`+`startTime`+`endTime` are supplied, results are filtered to courts
  with a free interval covering the requested time.
- Response: paginated court summaries (id, name, facility name, address,
  city/district, price-from, availability indicator), `meta`.
- Auth: public (Q5).
- Status: `200`, `400 VALIDATION_FAILED`.
- App codes: `VALIDATION_FAILED`.

### 9.2 Court Availability (public)

- Resource: derived availability for one court and date.
- Method/path: `GET /api/v1/courts/:id/availability`.
- Query: `date` (required), optional `durationMinutes`.
- Response: court/facility summary, opening/closing hours, and a list of merged
  free intervals; each interval reports the applicable per-segment prices and a
  computed price for `durationMinutes` when supplied (Q8). For the current date,
  intervals that have already ended are omitted and a partially elapsed interval
  starts at the next `BOOKING_SLOT_STEP_MINUTES` (5-minute) boundary, so an
  offered start is always in the future and stable within the step window; past
  dates return no intervals. A requested start-time is validated strictly (no
  start in the past), which the rounding guarantees in normal use.
- Auth: public (Q5).
- Status: `200`; `400 VALIDATION_FAILED`; `404 COURT_NOT_FOUND`.
- App codes: `COURT_NOT_FOUND`, `COURT_NOT_BOOKABLE`, `VALIDATION_FAILED`.

### 9.2.1 Facility Detail (public)

- Resource: a facility with its court list, supporting the facility-detail view.
- Method/path: `GET /api/v1/facilities/:id`.
- Query: optional `date` (pricing reference date; defaults to today in
  `Asia/Ho_Chi_Minh`).
- Response: facility summary plus its non-deleted courts, each with `priceFrom`
  for the reference date.
- Auth: public.
- Status: `200`; `400 VALIDATION_FAILED`; `404 FACILITY_NOT_FOUND`.
- App codes: `FACILITY_NOT_FOUND`, `VALIDATION_FAILED`.

### 9.3 Create Booking (Player)

- Resource: booking hold.
- Method/path: `POST /api/v1/bookings`.
- Auth: `authenticate` + `requireRole('PLAYER')`.
- Body: `courtId`, `bookingDate`, `startTime`, `durationMinutes`.
- Response `201`: booking id, `bookingCode`, status `PENDING_PAYMENT`,
  `bookingDate`, `startTime`, `endTime`, `totalAmount`, `expiresAt`, pricing
  breakdown.
- Side effects: creates a `PENDING_PAYMENT` hold; does **not** create the
  payment. Payment is created via the existing
  `POST /api/v1/bookings/:booking_id/payment` (two-step, Q4).
- Status: `201`; `400` (`VALIDATION_FAILED`, `BOOKING_INVALID_TIME_RANGE`,
  `BOOKING_DURATION_OUT_OF_RANGE`, `BOOKING_OUTSIDE_ADVANCE_WINDOW`); `401`;
  `403`; `404 COURT_NOT_FOUND`; `409` (`BOOKING_SLOT_UNAVAILABLE`,
  `COURT_NOT_BOOKABLE`, `BOOKING_DISABLED`, `BOOKING_ACTIVE_LIMIT_REACHED`).
- Idempotency: a duplicate request producing the same active interval for the
  same Player returns `409`; no second hold is created (Q9).

### 9.4 List My Bookings (Player)

- Method/path: `GET /api/v1/bookings/my-bookings`.
- Auth: `authenticate` + `requireRole('PLAYER')`.
- Query: `status`, `timeScope` (`UPCOMING` | `PAST` | `ALL`), `page`, `limit`.
- Response: paginated bookings, newest first, including `CANCELLED` and
  `EXPIRED`, each with current status and refund status when applicable.
- Status: `200`; `400 VALIDATION_FAILED`; `401`; `403`.

### 9.5 Booking Detail (Player)

- Method/path: `GET /api/v1/bookings/:id`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only
  (`booking.player_id == req.user.id`).
- Response: full booking detail, pricing breakdown, payment/refund status.
- Status: `200`; `401`; `403`; `404 BOOKING_NOT_FOUND`.

### 9.6 Cancel Booking (Player)

- Method/path: `POST /api/v1/bookings/:id/cancel`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only.
- Body: none (or optional `reason`).
- Behavior: allowed for `CONFIRMED` before `start_time` (triggers a full refund
  for paid bookings) and for `PENDING_PAYMENT` before `start_time` (releases the
  slot, no refund) (Q12).
- Response `200`: booking id, status, `refundStatus` (`NONE` / `PENDING`).
- Status: `200`; `401`; `403`; `404 BOOKING_NOT_FOUND`; `409`
  `BOOKING_NOT_CANCELLABLE`, `BOOKING_CANCELLATION_DISABLED`,
  `BOOKING_CANCELLATION_DEADLINE_PASSED`.
- Idempotency: repeating cancel on an already `CANCELLED` booking returns `200`
  with no second refund.

### 9.7 Payment/Refund Endpoints (owned by PaymentModule, referenced)

- `POST /api/v1/bookings/:booking_id/payment` — create/reuse the VNPAY URL for a
  `PENDING_PAYMENT` booking.
- `POST /api/v1/payments/vnpay/webhook` — VNPAY IPN.
- `GET /api/v1/payments/:payment_id` — payment/refund status.

These are defined in `docs/features/platform/payments-refunds/tech-design.md`
§3 and are not redefined here.

### 9.8 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `COURT_NOT_FOUND` | 404 | Court id does not exist or is not visible. |
| `COURT_NOT_BOOKABLE` | 409 | Court/facility is not eligible for new bookings. |
| `BOOKING_NOT_FOUND` | 404 | Booking id does not exist or is not visible. |
| `BOOKING_SLOT_UNAVAILABLE` | 409 | Requested interval overlaps an active booking/hold. |
| `BOOKING_INVALID_TIME_RANGE` | 400 | End <= start, out of opening hours, cross-midnight, or start time already passed. |
| `BOOKING_DURATION_OUT_OF_RANGE` | 400 | Duration outside `BOOKING_MIN/MAX_DURATION_MINUTES`. |
| `BOOKING_OUTSIDE_ADVANCE_WINDOW` | 400 | Date outside `BOOKING_ADVANCE_WINDOW_DAYS`. |
| `BOOKING_DISABLED` | 409 | `BOOKING_ENABLED` is false. |
| `BOOKING_ACTIVE_LIMIT_REACHED` | 409 | Active-booking limit reached. |
| `BOOKING_FORBIDDEN_OWNER` | 403 | Caller is not the booking owner. |
| `BOOKING_NOT_CANCELLABLE` | 409 | Status does not allow cancellation. |
| `BOOKING_CANCELLATION_DISABLED` | 409 | `PLAYER_CAN_CANCEL_BOOKING` is false. |
| `BOOKING_CANCELLATION_DEADLINE_PASSED` | 409 | Cancellation attempted at/after the deadline. |

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. Existing objects
used: `FACILITIES` §3.5, `COURTS` §3.6, `COURT_PRICINGS` §3.7, `BOOKINGS` §3.8,
`BOOKING_PRICING_DETAILS` §3.9, `PAYMENTS` §3.10.

Approved deltas (Q1, Q2) — recorded in the authoritative
`docs/architecture/database-schema.md` on 2026-09-26 and to be applied by
migration per schema §11:

1. **`BOOKINGS.expires_at timestamp NULL`** — snapshot of the payment deadline
   for `PENDING_PAYMENT` bookings, mirroring
   `TOURNAMENT_REGISTRATIONS.expires_at`.
2. **Court-interval overlap guard** — enable `btree_gist`, add a
   `booking_range tstzrange` generated column derived from
   `booking_date + start_time`/`end_time` in `Asia/Ho_Chi_Minh`, and:
   ```sql
   ALTER TABLE bookings
     ADD CONSTRAINT ex_bookings_court_no_overlap
     EXCLUDE USING gist (court_id WITH =, booking_range WITH &&)
     WHERE (status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS'));
   ```
3. **Indexes** — `BOOKINGS (court_id, booking_date, start_time)`,
   `BOOKINGS (player_id, status)`, and `COURT_PRICINGS (court_id, valid_from,
   valid_to)`. Non-breaking additions.
4. **`BOOKINGS.booking_code varchar NOT NULL UNIQUE`** — human-readable,
   Player-facing booking reference generated at creation (BK-05 implementation
   delta; reflected in `database-schema.md` §3.8).

No new table is proposed. Migration impact and backfill: existing `BOOKINGS`
rows get `expires_at = NULL`; a consistency check for pre-existing active
overlaps must pass before the exclusion constraint is added.

## 11. Security

- **Authentication boundary**: existing session middleware; no new mechanism.
- **Authorization boundary**: court search and availability are public (Q5); all
  booking mutations are `PLAYER`-only and owner-scoped. Booking detail/cancel
  check `booking.player_id == req.user.id`; unauthorized access returns `403`
  `BOOKING_FORBIDDEN_OWNER` (or `404` for non-existent ids).
- **Input/output protection**: Zod at the boundary; parameterized SQL only;
  responses never expose SQL, provider payloads, secrets, or internal ids
  outside the contract.
- **CSRF**: all state-changing requests must carry the `X-CSRF-Token` header per the confirmed double-submit-cookie CSRF design (`tech-stack.md`, `conventions.md`). The shared CSRF middleware lands with the Auth module; it is not present in `backend/src` yet. Booking endpoints must not be enabled without it.
- **Sensitive data**: payment/refund fields are summarized; provider signatures
  and secrets are never returned or logged.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Slot already taken | Overlap check / exclusion violation | `409 BOOKING_SLOT_UNAVAILABLE`; no booking created | Client re-fetches availability and picks another slot |
| Duplicate submit / retry | Same active interval for same Player | `409`; no second hold (Q9) | Client refreshes its bookings |
| Payment callback duplicated | Payment already `SUCCESS`/finalized | No second transition; idempotent ack | None needed |
| Payment after hold expired | Booking `EXPIRED` at callback time | Never reopen; mark payment `SUCCESS` → `REFUND_PENDING` (refund only) | Player sees refund status; notified |
| Payment after hold cancelled | Booking `CANCELLED` at callback time (e.g. Matchmaking release) | Never reopen; mark payment `SUCCESS` → `REFUND_PENDING` (refund only) | Player sees refund status; notified |
| Hold timeout | Scheduler sweep / read-time filter | Booking → `EXPIRED`; slot released | Player can rebook; notified |
| Cancel after start | `now >= start_time` | `409 BOOKING_CANCELLATION_DEADLINE_PASSED` | Booking remains active |
| Cancel invalid status | Status not cancellable | `409 BOOKING_NOT_CANCELLABLE` | Booking unchanged |
| Concurrent cancel | Row locked; status already `CANCELLED` | Idempotent `200`; no second refund | Refund status unchanged |
| Court/facility suspended | Eligibility check | `409 COURT_NOT_BOOKABLE` | Client hides court |
| Booking disabled | `BOOKING_ENABLED=false` | `409 BOOKING_DISABLED` | Client hides booking action |
| Active limit reached | Count query in transaction | `409 BOOKING_ACTIVE_LIMIT_REACHED` | Client prompted to cancel another |
| Refund failure | Provider response | Payment `REFUND_FAILED`, observable within `REFUND_PROCESSING_TIMEOUT_MINUTES` | Manual/retry via payment lifecycle |

## 13. Concurrency / Idempotency

- **Concurrency-sensitive operation**: booking creation for a court interval.
- **Protection (Q1)**:
  1. `SELECT ... FROM courts WHERE id = $1 FOR UPDATE` at the start of the
     booking-creation transaction, serializing per-court booking attempts.
  2. An overlap query over active statuses, with `PENDING_PAYMENT` filtered by
     `expires_at > now()`.
  3. Elapsed (or deadline-less) `PENDING_PAYMENT` holds for the court/date are
     marked `EXPIRED` in the same transaction before the overlap re-check, so
     the partial exclusion constraint does not keep blocking an already-released
     slot.
  4. The `ex_bookings_court_no_overlap` exclusion constraint as the final
     integrity guard.
- **Transaction boundary**: one transaction wraps eligibility, active-limit
  check, overlap check, pricing snapshot, and booking + pricing-detail inserts.
  Any failure rolls back the entire booking.
- **Payment confirmation idempotency**: `confirmBooking` locks the booking row,
  then: `CONFIRMED/IN_PROGRESS/COMPLETED` → no-op success; `PENDING_PAYMENT` and
  not expired → `CONFIRMED`; `PENDING_PAYMENT` and expired → `EXPIRED` + refund
  signal; already `EXPIRED` → refund signal, never reopen; already `CANCELLED`
  → refund signal if charged, never reopen. The `CANCELLED` case covers a valid
  payment callback that races a system-initiated hold release (for example a
  Matchmaking cancellation), so a released hold is never reopened. The payment
  status guard ensures the effect happens once.
- **Cancellation idempotency**: row lock + status check; repeated requests see
  `CANCELLED` and do not emit a second refund.
- **Refund claiming**: `SUCCESS → REFUND_PENDING` claim prevents double refunds
  (PaymentModule).
- In-memory state is never the coordination source; the database is.

## 14. Performance

- **Availability query**: bounded to one court and one date; uses
  `BOOKINGS (court_id, booking_date, start_time)` and
  `COURT_PRICINGS (court_id, valid_from, valid_to)`. Low cardinality per day.
- **Polling load**: clients poll availability every 5–10 seconds; responses are
  small and cached per request only (no shared cache introduced).
- **Search**: filtered by city/district/date; simple indexed predicates. No
  geospatial or full-text infrastructure is introduced in MVP.
- **Scheduler sweep**: interval-based batch over due rows using
  `expires_at`/time columns with database claiming.

## 15. Events / Notifications

- **Events emitted**: `BookingConfirmed`, `BookingCancelled`, `BookingExpired`.
  These align with the events consumed by the payment/refund worker
  (`BookingCancelled` already referenced in the payments Tech Design §9).
- **Notifications (in-app)**: booking confirmation, hold expiring/expired,
  cancellation, and refund status, per the PRD and confirmed notification
  strategy.
- **Background processing (Q10)**: see §15.1.
- **Delivery/retry**: notification persistence is best-effort within the same
  transaction as the state change where practical; delivery is by client polling.

### 15.1 Booking timeout and state-transition worker

**Scheduler.** A single in-process `setInterval` scheduler (confirmed in
`tech-stack.md`; no queue or external infrastructure). The worker ticks every
**60 seconds**, matching the Tournament background-job cadence
(`docs/features/tournament/tech-design.md` §10). Each tick is independent and
safe to overlap; correctness does not depend on a tick running exactly once.

**Due transitions per tick** (all date/time comparisons interpreted in
`Asia/Ho_Chi_Minh`, per §7.5):

| Transition | Due predicate |
| --- | --- |
| `PENDING_PAYMENT → EXPIRED` | `expires_at IS NULL OR expires_at <= now()` |
| `CONFIRMED → IN_PROGRESS` | booking date + `start_time` `<= now()` |
| `IN_PROGRESS → COMPLETED` | booking date + `end_time` `<= now()` |

**Claiming and idempotency.** Each category is claimed with a single atomic
select-and-update that only matches rows still in the expected source status.
Illustrative shape (exact SQL verified during implementation):

```sql
UPDATE bookings
SET status = 'EXPIRED', version = version + 1, updated_at = now()
WHERE id IN (
  SELECT id FROM bookings
  WHERE status = 'PENDING_PAYMENT'
    AND (expires_at IS NULL OR expires_at <= now())
  ORDER BY expires_at
  FOR UPDATE SKIP LOCKED
  LIMIT $batch
)
RETURNING id;
```

A row already transitioned by another tick, a payment callback, or a
cancellation no longer matches the source-status predicate, so it is never
processed twice. `SKIP LOCKED` keeps concurrent ticks from blocking each other.

**Batch size.** Each transition processes up to a fixed batch per tick
(implementation default: 200 rows per category; may be tuned) and the next tick
continues any remainder. This bounds tick duration without dropping work.

**Failure and retry policy.** A failure for one booking rolls back only that
booking's transaction and is logged with the booking id and transition. The row
still matches the due predicate, so it is retried on the next tick; there is no
in-tick retry loop or backoff. Persistent failures and a growing backlog are
observable (§19) and do not block other rows. A booking concurrently
confirmed/cancelled is a no-op, not an error.

**Interaction with read-time filtering (Q10).** The worker is the authoritative
persistence path for these transitions. Reads additionally compute effective
status against `expires_at`/`start_time`/`end_time` so no stale state is exposed
between ticks; a read never triggers a persisted transition and never emits
notifications.

**Startup behavior.** The scheduler starts with the application and performs one
catch-up sweep shortly after boot so transitions missed during downtime are
applied promptly.

**Notifications.** State-change notifications are persisted in the same
transaction as the transition where practical; because the transition is
idempotent, a notification is not duplicated on retry.

**Out of scope of the worker.** Refund execution (owned by the PaymentModule
refund worker, `docs/features/platform/payments-refunds/tech-design.md` §9) and
provider callbacks.

## 16. Testing Considerations

- **Unit**: pricing split across pricing intervals; availability subtraction;
  duration/advance-window validation; cancellation policy evaluation.
- **Integration/persistence**: transactional booking creation under concurrent
  requests (no double booking); exclusion-constraint behavior; pricing snapshot
  immutability; scheduler expiry.
- **API-level**: auth/RBAC and ownership; validation errors; pagination `meta`;
  error codes; search/availability contracts.
- **Critical E2E**: search → availability → create hold → pay → confirmed →
  appears in history; paid cancel → refund status.
- **Concurrency/idempotency**: duplicate VNPAY callback; late callback after
  expiry (no reopen + refund); concurrent cancel (single refund).

## 17. Migration / Rollout

- **Migrations**:
  1. `CREATE EXTENSION IF NOT EXISTS btree_gist;`
  2. `ALTER TABLE bookings ADD COLUMN expires_at timestamp;`
  3. Add the `booking_range` generated column and
     `ex_bookings_court_no_overlap` exclusion constraint after a pre-check for
     existing active overlaps.
  4. Add the indexes in §10.
- **Sequencing**: schema migration before Booking endpoints are enabled.
- **Backward compatibility**: new columns are nullable; existing booking rows are
  unaffected; payment schema already supports nullable `booking_id`.
- **Rollback**: drop the constraint/index; the nullable column is additive.
- **Config**: `BOOKING_*` keys already exist in the config matrix; no new keys
  are introduced.

## 18. Alternatives Considered

- **Fixed slot table** (materialize slots/availability): rejected — adds a table
  and synchronization burden without MVP benefit; slots derive cleanly from
  pricing + bookings.
- **Row lock only**: rejected in favor of row lock **plus** the exclusion
  constraint for defense-in-depth (Q1).
- **Advisory lock only**: rejected as the sole mechanism — weaker than a
  DB-level exclusion constraint.
- **Optimistic `version` check only**: rejected for creation — `BOOKINGS.version`
  is useful for state updates, but creation concurrency is better handled by
  locking/constraint.
- **WebSocket/SSE availability**: rejected — `tech-stack.md` confirms HTTP
  polling for MVP.

## 19. Observability

- **Logs**: booking create/confirm/expire/cancel with ids, court, interval, and
  outcome; never log provider secrets or signatures.
- **Metrics**: booking creation success/conflict counts, expiry sweep counts,
  refund/failed-refund counts, callback idempotency hits.
- **Alerts**: rising `BOOKING_SLOT_UNAVAILABLE` rate or refund failures are
  candidate operational signals. Observability tooling remains TBD.

## 20. Acceptance / Verification Considerations

- **Given** a Player and an eligible court with a free slot,
  **When** the Player creates a booking and completes payment,
  **Then** the booking is `CONFIRMED` immediately without any owner approval.

- **Given** two Players attempt to book the same court interval concurrently,
  **When** both requests are processed,
  **Then** exactly one booking is created and the other receives
  `409 BOOKING_SLOT_UNAVAILABLE`.

- **Given** a `PENDING_PAYMENT` booking,
  **When** `BOOKING_PAYMENT_TIMEOUT_MINUTES` elapses without payment,
  **Then** the booking becomes `EXPIRED`, the slot is released, and the Player
  is notified.

- **Given** an expired booking,
  **When** a valid VNPAY success callback arrives late,
  **Then** the booking is never reopened and the payment enters the refund flow.

- **Given** a `CONFIRMED` paid booking before `start_time`,
  **When** the owner Player cancels it,
  **Then** the booking becomes `CANCELLED` and a full refund is triggered once.

- **Given** an unpaid `PENDING_PAYMENT` booking before `start_time`,
  **When** the owner Player cancels it,
  **Then** the booking becomes `CANCELLED`, the slot is released immediately,
  and no refund is triggered.

- **Given** a booking after `start_time`,
  **When** the Player attempts to cancel,
  **Then** the request is rejected with `409 BOOKING_CANCELLATION_DEADLINE_PASSED`.

- **Given** a Player not owning a booking,
  **When** they request its detail or cancel it,
  **Then** the request is denied (`403`/`404`) without leaking existence.

- **Given** a court with no `COURT_PRICINGS` covering part of opening hours,
  **When** availability is requested,
  **Then** only priced intervals are offered.

Verification: unit/integration/API tests per §16; migration check for the
exclusion constraint; manual concurrency check.

## 21. Resolved Decisions / Open Questions

All 12 technical questions were resolved by the human owner on 2026-09-26.

| # | Question | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Q1 | Overlap protection mechanism | Row lock (`SELECT ... FOR UPDATE` on the court) **plus** a `btree_gist` exclusion constraint as the final integrity guard. | 2026-09-26 | RESOLVED |
| Q2 | `BOOKINGS.expires_at` | Add `BOOKINGS.expires_at timestamp NULL`, snapshotted from `BOOKING_PAYMENT_TIMEOUT_MINUTES`. | 2026-09-26 | RESOLVED |
| Q3 | Pricing-unit semantics | `COURT_PRICINGS.price` is per hour; amount prorated by minutes (`price × overlap_minutes / 60`). | 2026-09-26 | RESOLVED |
| Q4 | Booking + payment flow | Two-step: `POST /bookings` creates the hold; `POST /bookings/:id/payment` creates the VNPAY payment. | 2026-09-26 | RESOLVED |
| Q5 | Search/availability auth | Public (no authentication); booking/cancel require `PLAYER`. | 2026-09-26 | RESOLVED |
| Q6 | Search endpoint style | `GET /api/v1/courts` with query filters. | 2026-09-26 | RESOLVED |
| Q7 | Timezone | Fixed `Asia/Ho_Chi_Minh` for all date/time combination and comparisons. | 2026-09-26 | RESOLVED |
| Q8 | Availability response shape | Merged free intervals with per-segment prices. | 2026-09-26 | RESOLVED |
| Q9 | `POST /bookings` idempotency | Overlap-based: duplicate active interval for the same Player returns `409`; no idempotency key. | 2026-09-26 | RESOLVED |
| Q10 | Expiry/time-transition mechanism | In-process scheduler sweep **plus** read-time effective-status filtering. | 2026-09-26 | RESOLVED |
| Q11 | Bookable statuses | `court.status = ACTIVE` AND `facility.status = ACTIVE` AND neither soft-deleted. | 2026-09-26 | RESOLVED |
| Q12 | Unpaid-hold cancellation status | `PENDING_PAYMENT → CANCELLED` (extends the frozen lifecycle). | 2026-09-26 | RESOLVED |

**Required authoritative documentation updates (approved by Q1, Q2, Q12),
applied on 2026-09-26 under the no-doc-debt rule:**

- `docs/business-rules-config-matrix.md` §2.5 — add
  `PENDING_PAYMENT → CANCELLED` (Player cancels an unpaid hold).
- `docs/architecture/database-schema.md` §2.2 and §8 — reflect the
  `PENDING_PAYMENT → CANCELLED` transition; §3.8 — add `BOOKINGS.expires_at`;
  §5.8/§11 — record the exclusion constraint.
- `docs/features/booking/player-booking/prd.md` §8 — include
  `PENDING_PAYMENT → CANCELLED` in the lifecycle.

No unresolved `[TBD]` item remains in this Tech Design.

## 22. Decision Status

```text
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26)
Approved by: Human owner (2026-09-26, document marked Ready on the same date)
Approved decision/reference: §21 Resolved Decisions, 2026-09-26
```

## Matchmaking readiness integration — approved 2026-10-10

Status: Ready (Human owner). See Matchmaking Tech Design §21.1. Matchmaking still
never creates holds. Owner links a paid future booking on the preferred date,
inside the window with the request's duration snapshot; outside-area is allowed.
Provide transaction-aware booking lookup/link validation and internal owner-policy
cancellation. Scheduling locks follow ascending USERS ids then request/invitation,
Match and Booking; standalone linked-booking cancellation follows the same order.
When a linked booking is cancelled, cancel its casual Match with BOOKING_CANCELLED
in the same transaction through MatchModule. Match leave persists cancellation
work; Booking applies its existing policy and persists refund work atomically.
Policy refusal is surfaced, not bypassed. Cancellation replay must not duplicate
refund. Reconciliation recovers missed effects before Match time advancement.
Verification: link-vs-cancel, leave-vs-cancel, crash/retry and duplicate refund.
