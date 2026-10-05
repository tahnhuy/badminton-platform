# Court Owner Self-Service — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/court-owner/prd.md
Scope: Court Owner self-service — manage owned facilities/courts (with Admin approval for creation), per-hour court pricing, real-time schedule monitoring, maintenance slot blocks, and owner-side booking cancellation with refund + in-app notification
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-27)
```

> Ready. All decisions in §21 were resolved by the human owner on 2026-09-27
> (see §21 Decision Log), and the human readiness gate per
> `docs/documentation-guide.md` §6.3 was explicitly given on 2026-09-27. This
> design does not override the governing PRD, `PROJECT-BRIEF.md`,
> `docs/business-rules-config-matrix.md`, `docs/architecture/tech-stack.md`,
> `docs/architecture/conventions.md`, or the consolidated schema in
> `docs/architecture/database-schema.md`.

Two items in the provided requirements conflicted with the Ready PRD and were resolved by decision (§21 #1–#2):

1. The requested `PATCH /api/v1/owner/courts/:id/status` (`ACTIVE`/`MAINTENANCE`) was **removed**; maintenance is handled solely through slot blocks, consistent with PRD Decision #7.
2. `requireRole(...)` is restricted to `requireRole('COURT_OWNER')` (variadic, uppercase); Admin is not granted these self-service operations, consistent with PRD §5.

## 2. Context

This design implements `docs/features/court-owner/prd.md` (Ready):

1. A Court Owner manages the facilities and child courts they own (`owner_id`).
2. The Owner may submit new facilities/courts, which require Admin approval before becoming bookable (PRD Decision #2).
3. The Owner configures **per-hour** court pricing; overlapping pricing intervals are rejected; pricing is snapshotted on bookings (PRD Decision #3–#4).
4. The Owner monitors a near-real-time schedule of their courts (PRD §7, HTTP polling).
5. The Owner locks/unlocks **slot-level** maintenance blocks with a mandatory reason; a block cannot overlap an active booking (PRD Decisions #1, #6, #9, #10).
6. The Owner cancels an eligible booking due to a court-side incident: a paid `CONFIRMED` booking gets a full idempotent refund + in-app Player notification; an unpaid `PENDING_PAYMENT` hold is released with no refund (PRD Decision #5).

Feature boundaries:

- **CourtOwnerModule (new)**: owner-scoped facility/court management, pricing, schedule read model, slot blocks, and owner cancellation orchestration.
- **BookingModule (existing design, `docs/features/booking/player-booking/tech-design.md`)**: owns `BOOKINGS`, booking creation, non-overlap, and cancellation. This feature adds a **cross-module change**: booking creation and availability must also account for slot blocks.
- **PaymentModule (platform capability)**: owns the refund lifecycle (VNPAY). Owner cancellation emits a refund through the existing payment lifecycle; it does not execute the provider call inline.
- **NotificationModule (platform capability)**: persists in-app notifications (`NOTIFICATIONS`).
- **Admin Court Management (existing feature)**: owns facility/court approval, suspension, and onboarding moderation. Owner submissions produce a pending state reviewed there.

## 3. Technical Problem

1. **Owner-scoped authorization** — every operation must prove the target facility/court/booking belongs to the caller (`owner_id = req.user.id`) via joins, at a boundary that cannot be bypassed by alternate routes.
2. **Pending-approval onboarding** — `FACILITIES.status` / `COURTS.status` vocabularies are undefined in the schema; Owner submissions need a pending state and an approval transition (Admin-owned).
3. **Slot blocks do not exist** — no schema entity represents a maintenance block; it must occupy a court interval without being a Player booking.
4. **Mutual exclusion between blocks and bookings** — PostgreSQL cannot apply one exclusion constraint across two tables. Booking-vs-booking is already protected by `ex_bookings_court_no_overlap`; booking-vs-block needs an additional, race-safe mechanism (§13).
5. **Availability derivation** — the Player Booking read model currently subtracts only active bookings; it must also subtract active blocks.
6. **Owner cancellation atomicity and idempotency** — booking→`CANCELLED`, the refund intent, and the in-app notification must be atomic; the provider refund must execute once and outside the transaction.
7. **Pricing integrity** — per-hour intervals, overlap rejection, and snapshot preservation for existing bookings.
8. **Requirement conflicts** — the requested court-status endpoint and role list conflict with the PRD (§21).

## 4. Goals

- Provide owner-scoped REST endpoints for facilities, courts, pricing, schedule, slot blocks, and owner cancellation.
- Enforce ownership and pending-approval rules in the service layer and back them with database integrity.
- Guarantee no block overwrites an active booking and no booking is created over an active block, under concurrency.
- Make owner cancellation atomic, idempotent, and refund-safe, reusing the existing refund lifecycle.
- Keep the design within the PERN monolith, TypeScript, Express, Drizzle, and the confirmed polling/in-app-notification decisions.

## 5. Non-Goals

- A dedicated refund portal for Court Owners (PRD §3; `PROJECT-BRIEF.md` §5).
- Any booking approval flow (`Pending → Approved`).
- Court rating/reviews (PRD §3; `PROJECT-BRIEF.md` §5).
- Admin platform moderation itself (suspension, deactivation) — owned by `docs/features/admin/court-management/prd.md`.
- Split Bill, match rescheduling, and other `PROJECT-BRIEF.md` §5 items.
- Cross-midnight pricing/slot semantics (schema §3.7 leaves cross-midnight pricing undefined).
- Financial analytics/settlement/payout.

## 6. Upstream References

- Governing PRD: `docs/features/court-owner/prd.md` (Ready)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §3.2, §4, §5, §7
- Documentation rules: `docs/documentation-guide.md` §5.3, §6, §9, §13
- Global architecture/technology: `docs/architecture/tech-stack.md` (PERN, TypeScript, Drizzle ORM, Zod, opaque session cookie, centralized error handling, `/api/v1/`, offset pagination, VNPAY, in-app notifications, HTTP polling)
- Global coding/API conventions: `docs/architecture/conventions.md` (Backend structure, API conventions, validation, async/concurrency, database conventions)
- Business rules/configuration: `docs/business-rules-config-matrix.md` §2, §8.1, §8.2
- Global database schema: `docs/architecture/database-schema.md` §2.2, §3.4, §3.5, §3.6, §3.7, §3.8, §3.9, §3.10, §3.24, §5.8
- Existing designs referenced: `docs/features/booking/player-booking/tech-design.md` (§7.2 availability, §8.4 cancellation/refund, §10 schema delta), `docs/features/admin/court-management/prd.md`, `docs/features/platform/payments-refunds/tech-design.md`
- Existing contracts: `backend/src/contracts/PaymentService.ts`, `NotificationService.ts`, `CourtService.ts`

## 7. Proposed Technical Design

### 7.1 Module and Layer Boundaries

Following `docs/architecture/conventions.md` (Backend: responsibility layers namespaced by capability):

- `backend/src/routes/owner/` — thin routers (`ownerFacilityRoutes`, `ownerCourtRoutes`, `ownerPricingRoutes`, `ownerScheduleRoutes`, `ownerBookingRoutes`).
- `backend/src/controllers/owner/` — HTTP translation only.
- `backend/src/services/owner/` — `OwnerFacilityService`, `OwnerCourtService`, `OwnerPricingService`, `OwnerScheduleService`, `OwnerSlotBlockService`, `OwnerBookingService`: authorization, business validation, transaction orchestration.
- `backend/src/repositories/owner/` — persistence and locking (`OwnerFacilityRepository`, `OwnerCourtRepository`, `OwnerPricingRepository`, `CourtSlotBlockRepository`, `OwnerBookingRepository`).
- `backend/src/validation/owner.ts` — Zod request-boundary schemas.
- `backend/src/db/schema/` — modified `facilities.ts` / `courts.ts` (status vocab) and new `courtSlotBlocks` table.
- Cross-module contracts in `backend/src/contracts/`: reuse `PaymentService`, `NotificationService`; extend `CourtService` (or add `CourtAvailabilityPort`) to expose slot-block occupancy to the Booking availability read model.

### 7.2 Ownership Enforcement

- `authenticate` runs first, then `requireRole('COURT_OWNER')`. Admin is not granted these self-service operations (PRD §5; Decision Log §21 #2).
- Services resolve ownership by joining the resource to its owning facility: `FACILITIES.owner_id = req.user.id`; `COURTS → FACILITIES.owner_id`; `BOOKINGS → COURTS → FACILITIES.owner_id`.
- A resource that exists but is not owned is reported as `404` or `403` per §9 (choose the non-enumerating option; see §12) — never returned.
- Ownership checks live in the service/repository, not the controller, so alternate call paths cannot bypass them.

### 7.3 Facility/Court Onboarding with Admin Approval

- `POST /api/v1/owner/facilities` inserts a facility with `status = 'PENDING_APPROVAL'` and `owner_id = req.user.id`.
- `POST /api/v1/owner/facilities/:id/courts` inserts a court with `status = 'PENDING_APPROVAL'`.
- Admin approval moves a submission to `ACTIVE`; Admin rejection moves it to `REJECTED`. Those transitions are owned by Admin Court Management (`docs/features/admin/court-management/prd.md`); this design only defines the owner submission state and reads it back. Status vocabulary and the CHECK constraint are in `docs/architecture/database-schema.md` §3.5/§3.6/§5.15.
- Until approved (not `ACTIVE`), the facility/court is not eligible for new bookings; existing availability queries ignore non-`ACTIVE` courts (cross-module note).

### 7.4 Pricing

- `COURT_PRICINGS.price` is per hour (PRD #3; consistent with `docs/features/booking/player-booking/tech-design.md` §7.3).
- Create/update validates: `start_time < end_time`, single-day (no cross-midnight), `valid_from <= valid_to` when `valid_to` is set, and **no overlap** with existing intervals for the same court where validity ranges overlap (PRD #4).
- Overlap detection uses a transactional check plus a database exclusion constraint (see §10) as the final guard.
- Editing pricing never touches existing `BOOKINGS`/`BOOKING_PRICING_DETAILS` rows (snapshot preserved).

### 7.5 Schedule Read Model

`GET /api/v1/owner/facilities/:id/schedule?date=YYYY-MM-DD` composes, per court:

1. Facility opening/closing hours and court eligibility.
2. Applicable pricing intervals for the date (to build the slot grid and show price).
3. Active bookings for the date (`status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS')`, with `PENDING_PAYMENT` only while `expires_at > now()`), returning booking id, status, times, and the booking Player's contact details (PRD #8) restricted to owned facilities.
4. Active slot blocks for the date, returning block id, reason, and times.
5. Slot states: `FREE | BOOKED | BLOCKED` (a slot covered by both a booking and a block is not expected because blocks cannot overlap active bookings, §8/§13).

The schedule is a bounded single-day view (no pagination); it is refreshed by HTTP polling (5–10 s).

### 7.6 Slot Blocks

- `COURT_SLOT_BLOCKS` rows are `ACTIVE` or `RELEASED`.
- Create validates: owned court, `end > start`, single day, within `BOOKING_ADVANCE_WINDOW_DAYS`, mandatory `reason`, and **no overlap with an active booking (including a tournament-match system booking) or another active block** (PRD #6).
- Create/edit takes the court-date advisory lock and re-checks overlap inside the transaction (§13).
- Unblock transitions the matching active block(s) to `RELEASED`.
- The Player Booking availability read model subtracts active blocks in addition to active bookings (cross-module contract). Tournament-match system bookings participate in the same overlap set; they are created by TournamentModule scheduling, not by the Owner.

### 7.7 Owner Booking Cancellation

`POST /api/v1/owner/bookings/:id/cancel`:

1. `authenticate` + `requireRole('COURT_OWNER')`; ownership resolved through booking → court → facility.
2. Preconditions: booking belongs to an owned court; `status IN ('PENDING_PAYMENT','CONFIRMED')`; `now < start_time` (Asia/Ho_Chi_Minh); `OWNER_CAN_CANCEL_BOOKING = true`; deadline per `OWNER_CANCELLATION_DEADLINE_MINUTES` (PRD #5); mandatory `reason`.
3. Inside one database transaction:
   - `SELECT booking FOR UPDATE`; re-validate state.
   - If already `CANCELLED`, return the existing result idempotently (no second refund).
   - Set `status = 'CANCELLED'`.
   - If the booking was paid (a successful payment exists), record the refund intent through the payment lifecycle exactly once (reusing the `BookingCancelled`-style refund mechanism from `docs/features/booking/player-booking/tech-design.md` §8.4 / BK-07). No provider call is made inline.
   - Insert the in-app `NOTIFICATIONS` row for the Player with the cancellation reason.
4. After commit, the existing refund worker executes the VNPAY refund and updates payment/refund status; the API returns `refundStatus` (`NONE` / `PENDING`).

Payment/refund execution is idempotent (`docs/architecture/tech-stack.md`); booking cancellation and the payment/refund lifecycle remain separate concerns (`docs/business-rules-config-matrix.md` §2.4).

## 8. Behavior, State, and Flow

### 8.1 Facility / Court Status

```text
Owner submits            Admin approves            Admin suspends
PENDING_APPROVAL ──────► ACTIVE ───────────────► SUSPENDED
        │                    ▲                       │
        └── Admin rejects    └── Admin reactivates ──┘
            REJECTED
```

- `PENDING_APPROVAL` / `REJECTED` are the owner-submission states (PRD #2); `ACTIVE` / `SUSPENDED` are the Admin moderation states (`docs/features/admin/court-management/prd.md`).
- The Owner cannot set any of these statuses (PRD #7). A court `ACTIVE`/`MAINTENANCE` status is **not** introduced here; maintenance is handled solely through slot blocks (Decision Log §21 #1).

### 8.2 Slot Block Lifecycle

```text
(create, valid range) ──► ACTIVE ──(unblock / superseded)──► RELEASED
```

- A block is `ACTIVE` while it prevents new bookings.
- A block may not overlap an active booking at creation; it may be released at any time.

### 8.3 Owner Cancellation

```text
PENDING_PAYMENT ──(owner cancel: release, no refund)────────► CANCELLED
CONFIRMED       ──(owner cancel: full refund + notify)──────► CANCELLED
```

- Terminal: `CANCELLED`. Repeating the action is an idempotent success.

## 9. API Design

All paths under `/api/v1/`. Success bodies use `{ data: ... }`; collections add `meta: { page, limit, total, totalPages }`; errors use `{ error: { code, message, details } }`. Times use the `Asia/Ho_Chi_Minh` business timezone (`docs/features/booking/player-booking/tech-design.md` §7.5).

### 9.1 Facilities

- `GET /api/v1/owner/facilities` — paginated (`page`, `limit`, optional `status`) facilities owned by the caller.
  - Response `200`: `{ data: [{ id, name, status, city, district, address, courtCount }], meta }`.
- `POST /api/v1/owner/facilities` — create a facility (enters `PENDING_APPROVAL`).
  - Body: `{ name, description?, phone, address, ward?, district, city, latitude, longitude, openingTime, closingTime }`.
  - Response `201`: `{ data: { id, status: "PENDING_APPROVAL", ... } }`.
- `PUT /api/v1/owner/facilities/:id` — update owned facility information (not status).
  - Response `200`: `{ data: ... }`.
- `POST /api/v1/owner/facilities/:id/courts` — add a court to an owned facility (enters `PENDING_APPROVAL`).
  - Body: `{ name, description? }`.
  - Response `201`: `{ data: { id, facilityId, status: "PENDING_APPROVAL" } }`.

Auth: `authenticate` + `requireRole('COURT_OWNER')`; ownership enforced in service.

### 9.2 Court Status — not provided

The requested `PATCH /api/v1/owner/courts/:id/status` with `{ status: "ACTIVE" | "MAINTENANCE" }` was **removed** by decision (Decision Log §21 #1). It conflicted with PRD Decision #7 (the Owner cannot change operational status; maintenance uses slot blocks only) and with the Admin-owned status vocabulary (`ACTIVE`/`SUSPENDED`). Maintenance is implemented through `block-slots` (§9.5).

### 9.3 Pricing

- `GET /api/v1/owner/courts/:id/pricings` — owned court; optional `validOn=YYYY-MM-DD`.
  - Response `200`: `{ data: [{ id, startTime, endTime, pricePerHour, validFrom, validTo }] }` (bounded; no pagination).
- `POST /api/v1/owner/courts/:id/pricings` — create or update (upsert) an interval for an owned court (Decision Log §21 #10). Upsert matching key (e.g., court + `startTime` + `endTime` + `validFrom`) is finalized during implementation in CO-03 (non-blocking).
  - Body: `{ startTime, endTime, pricePerHour, validFrom, validTo? }`.
  - Response `201` (created) / `200` (updated): `{ data: ... }`.
  - Errors: `409 PRICING_INTERVAL_OVERLAP`.

### 9.4 Schedule

- `GET /api/v1/owner/facilities/:id/schedule?date=YYYY-MM-DD` — owned facility schedule matrix for the date.
  - Response `200`: `{ data: { facilityId, date, courts: [{ courtId, courtName, status, slots: [{ startTime, endTime, state: "FREE"|"BOOKED"|"BLOCKED", pricePerHour, bookingId?, player?, blockId?, reason? }] }] } }`.
  - Errors: `400 VALIDATION_FAILED`; `403 OWNER_FORBIDDEN_RESOURCE`; `404 OWNER_FACILITY_NOT_FOUND`.

### 9.5 Slot Blocks

- `POST /api/v1/owner/courts/:id/block-slots` — block one or more slot ranges on an owned court.
  - Body: `{ bookingDate, startTime, endTime, reason }` (single range per request; Decision Log §21 #7).
  - Response `201`: `{ data: { blocks: [{ id, courtId, bookingDate, startTime, endTime, reason, status: "ACTIVE" }] } }`.
  - Errors: `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`, `409 SLOT_BLOCK_OVERLAP_BLOCK`, `400 SLOT_BLOCK_INVALID_RANGE`, `400 SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW`, `409 COURT_NOT_ELIGIBLE`.
- `POST /api/v1/owner/courts/:id/unblock-slots` — release active block(s).
  - Body: `{ blockIds: [...] }` or `{ bookingDate, startTime, endTime }`.
  - Response `200`: `{ data: { released: [...] } }`.
  - Errors: `404 OWNER_SLOT_BLOCK_NOT_FOUND`.

### 9.6 Owner Booking Cancellation

- `POST /api/v1/owner/bookings/:id/cancel` — owner cancels an eligible booking due to a court-side incident.
  - Body: `{ reason }` (mandatory).
  - Response `200`: `{ data: { bookingId, status: "CANCELLED", refundStatus: "NONE"|"PENDING" } }`.
  - Errors: `403 OWNER_FORBIDDEN_RESOURCE`, `404 OWNER_BOOKING_NOT_FOUND`, `409 OWNER_BOOKING_NOT_CANCELLABLE`, `409 OWNER_CANCELLATION_DISABLED`, `409 OWNER_CANCELLATION_DEADLINE_PASSED`.

### 9.7 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Zod failure at the boundary (global code). |
| `AUTH_FORBIDDEN_ROLE` | 403 | Caller is not a `COURT_OWNER`. |
| `OWNER_FORBIDDEN_RESOURCE` | 403 | Resource exists but is not owned by the caller. |
| `OWNER_FACILITY_NOT_FOUND` | 404 | Facility id does not exist or is not visible to the caller. |
| `OWNER_COURT_NOT_FOUND` | 404 | Court id does not exist or is not visible. |
| `OWNER_BOOKING_NOT_FOUND` | 404 | Booking id does not exist or is not visible. |
| `OWNER_SLOT_BLOCK_NOT_FOUND` | 404 | No matching owned block. |
| `PRICING_INTERVAL_OVERLAP` | 409 | Pricing interval overlaps an existing interval for the court. |
| `SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING` | 409 | Block overlaps an active booking. |
| `SLOT_BLOCK_OVERLAP_BLOCK` | 409 | Block overlaps another active block. |
| `SLOT_BLOCK_INVALID_RANGE` | 400 | End <= start or out of opening hours / cross-midnight. |
| `SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW` | 400 | Date outside `BOOKING_ADVANCE_WINDOW_DAYS`. |
| `COURT_NOT_ELIGIBLE` | 409 | Court/facility is not eligible (e.g., pending approval). |
| `OWNER_BOOKING_NOT_CANCELLABLE` | 409 | Booking status does not allow owner cancellation. |
| `OWNER_CANCELLATION_DISABLED` | 409 | `OWNER_CAN_CANCEL_BOOKING` is false. |
| `OWNER_CANCELLATION_DEADLINE_PASSED` | 409 | Cancellation attempted at/after the deadline. |
| `INTERNAL_ERROR` | 500 | Unexpected error (global code). |

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. Only the delta is recorded here; applying it requires a schema decision and a same-session schema-doc update.

### 10.1 Existing Objects Affected

- `FACILITIES` §3.5: `status` vocabulary extended with `PENDING_APPROVAL` and `REJECTED` (documentation-only unless a CHECK is chosen). `owner_id` already exists.
- `COURTS` §3.6: same status vocabulary extension for owner-submitted courts.
- `COURT_PRICINGS` §3.7: no column change; `price` is per hour (semantics), overlap enforced by a new constraint.
- `BOOKINGS` §3.8 / `BOOKING_PRICING_DETAILS` §3.9: unchanged; snapshots preserved.
- `PAYMENTS` §3.10 / `NOTIFICATIONS` §3.24: reused; no new table for refunds (PRD §3).

### 10.2 New Table — `COURT_SLOT_BLOCKS`

| Column | Type | Constraints / Meaning |
| --- | --- | --- |
| `id` | bigint | PK |
| `court_id` | bigint | FK → `COURTS.id` |
| `booking_date` | date | Blocked date |
| `start_time` | time | Block start |
| `end_time` | time | Block end |
| `reason` | text | Mandatory reason |
| `status` | varchar | `ACTIVE \| RELEASED` |
| `created_by` | bigint | FK → `USERS.id` (owner) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

Constraints/indexes:

- `CHECK (end_time > start_time)`.
- Generated `block_range tsrange` from `booking_date + start_time/end_time` in `Asia/Ho_Chi_Minh`, mirroring `BOOKINGS.booking_range`.
- `EXCLUDE USING gist (court_id WITH =, block_range WITH &&) WHERE (status = 'ACTIVE')` — prevents overlapping active blocks on the same court (requires `btree_gist`, already enabled).
- Index on `(court_id, booking_date)`.

New pricing constraint:

- `EXCLUDE USING gist (court_id WITH =, pricing_time_range WITH &&, validity_range WITH &&)` to reject overlapping pricing intervals (approved; Decision Log §21 #6). The exact generated expression is finalized during implementation.

### 10.3 Booking ↔ Block Mutual Exclusion

PostgreSQL cannot enforce one exclusion constraint across `BOOKINGS` and `COURT_SLOT_BLOCKS`. Proposed MVP mechanism:

1. Both the Booking creation path and the Block creation path acquire a **transaction-scoped advisory lock** keyed by `(court_id, booking_date)` (`pg_advisory_xact_lock(hashtext('court:'||court_id||':'||date))`).
2. While holding the lock, each path checks the other table for overlapping active intervals before inserting.
3. Existing booking-vs-booking protection (`ex_bookings_court_no_overlap`) remains in place.

This is a cross-module change to `docs/features/booking/player-booking/tech-design.md` §7.2/§13 and must be recorded there. This approach was approved (Decision Log §21 #5); the DB-trigger alternative is recorded in §18.

### 10.4 Migration Script (illustrative, `0006`)

```sql
CREATE TABLE "court_slot_blocks" (
  "id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  "court_id" bigint NOT NULL REFERENCES "courts"("id"),
  "booking_date" date NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "reason" text NOT NULL,
  "status" varchar NOT NULL,
  "created_by" bigint NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "chk_court_slot_block_range" CHECK ("end_time" > "start_time")
);--> statement-breakpoint
ALTER TABLE "court_slot_blocks" ADD COLUMN "block_range" tsrange
  GENERATED ALWAYS AS (tsrange(("booking_date" + "start_time"), ("booking_date" + "end_time"), '[)')) STORED;--> statement-breakpoint
CREATE INDEX "court_slot_blocks_court_date_idx" ON "court_slot_blocks" ("court_id","booking_date");--> statement-breakpoint
ALTER TABLE "court_slot_blocks" ADD CONSTRAINT "ex_court_slot_blocks_no_overlap"
  EXCLUDE USING gist ("court_id" WITH =, "block_range" WITH &&) WHERE ("status" = 'ACTIVE');
```

The exact timezone expression and the pricing exclusion constraint are finalized during implementation (Decision Log §21 #3, #6), matching the approach already used for `BOOKINGS.booking_range`.

## 11. Security

- **Authentication:** shared `authenticate` middleware (opaque session cookie `sid`; no bearer token).
- **Authorization:** `requireRole('COURT_OWNER')` plus service-layer ownership (`owner_id`). Admin is not granted these self-service operations (Decision Log §21 #2).
- **CSRF:** all `POST`/`PUT`/`PATCH` require `X-CSRF-Token` (double-submit cookie).
- **Input validation:** Zod at the request boundary for every body/param; range/date/time validation server-side.
- **Non-enumeration:** for resources not owned by the caller, respond consistently without leaking existence (see §12).
- **Sensitive data:** the Owner sees full Player contact details only for bookings on their own facilities (PRD #8). This data must not be logged, must not be exposed outside the owner scope, and is returned only by the schedule endpoint.
- **Immutability of snapshots:** pricing edits must never update existing booking snapshots.
- **No internal detail leakage:** centralized error handler; no SQL/stack traces in responses.

Dependency note: the Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware`, so Owner endpoints require a real signed-in `COURT_OWNER` session. In `NODE_ENV=test`, API checks may still use the test-only `X-User-Id` header with a `COURT_OWNER` row.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Non-owned facility/court/booking | Ownership join returns nothing | `404 OWNER_*_NOT_FOUND` (consistent, non-enumerating) | Access denied; no data leaked. |
| Submitting facility/court | Always | Created as `PENDING_APPROVAL`, not bookable | Owner sees pending state. |
| Pricing interval overlaps | Overlap check / exclusion constraint | `409 PRICING_INTERVAL_OVERLAP` | Owner adjusts the interval. |
| Pricing edit on a court with existing bookings | Snapshot rows already exist | Existing bookings unchanged | UI explains snapshot behavior. |
| Block overlaps active booking | Overlap check under advisory lock | `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING` | Owner must cancel the booking first. |
| Block overlaps another block | Exclusion constraint | `409 SLOT_BLOCK_OVERLAP_BLOCK` | Owner adjusts the range. |
| Block outside advance window | Date check | `400 SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW` | Owner picks an allowed date. |
| Concurrent booking vs block on same court/date | Advisory lock serializes paths | One succeeds; the other sees an overlap and is rejected | Retry with a different range. |
| Owner cancels an ineligible booking | State/ownership/deadline check | `409 OWNER_BOOKING_NOT_CANCELLABLE` / `OWNER_CANCELLATION_*` | Owner sees the reason. |
| Cancel repeated | Booking already `CANCELLED` | Idempotent `200`; no second refund | Client treats as success. |
| Refund execution fails after commit | Refund worker result | Payment/refund status becomes `REFUND_FAILED`; booking stays `CANCELLED` | Operator/retry via the payment lifecycle; Player notified of status. |
| Schedule requested for a non-owned facility | Ownership check | `404 OWNER_FACILITY_NOT_FOUND` | Access denied. |

## 13. Concurrency / Idempotency

- **Booking vs block mutual exclusion:** transaction-scoped advisory lock per `(court_id, booking_date)`, taken by both the booking-creation path and the block-creation path, followed by an overlap check against the other table before insert. This is the MVP mechanism given PostgreSQL cannot cross-table exclude (§10.3).
- **Block-vs-block:** the partial `EXCLUDE` constraint on `court_slot_blocks` is the final guard.
- **Booking-vs-booking:** unchanged; the existing `ex_bookings_court_no_overlap` remains authoritative.
- **Owner cancellation:** one transaction with `SELECT ... FOR UPDATE` on the booking; state transition, refund intent, and notification insert are atomic. Re-cancellation is idempotent. The provider refund executes once via the payment lifecycle (idempotent per `docs/architecture/tech-stack.md`).
- **Pricing updates:** overlap checks and inserts/updates run in one transaction; the exclusion constraint is the final guard.
- **Transaction boundaries:** short transactions; no external provider call inside a transaction.

## 14. Performance

- Expected workload is low (per-owner facility/court counts and a single-day schedule).
- Relevant bottleneck: the schedule composition and availability overlap queries. Indexes: `court_slot_blocks (court_id, booking_date)`, existing `BOOKINGS` court/date/range indexes, `COURT_PRICINGS (court_id, valid_from, valid_to)`.
- Design response: single-day bounded reads; avoid loading unrelated historical bookings; aggregate/paginate facility lists.

## 15. Events / Notifications

- Event/notification behavior: owner cancellation inserts an in-app `NOTIFICATIONS` row for the affected Player with the cancellation reason (PRD #5, #9).
- Trigger and recipient: owner booking cancellation → the booking's Player.
- Delivery/retry implications: notification is persisted in the same transaction as the cancellation; delivery is in-app polling only (`docs/architecture/tech-stack.md`).
- Background/scheduled processing: refund execution is handled by the existing refund worker; this feature adds no new scheduler.

## 16. Testing Considerations

- **Unit:** ownership resolution; pending-approval gating; pricing overlap rules; block range validation and advance-window check; cancellation eligibility (status, deadline, config); idempotent re-cancel.
- **Integration/persistence:** `court_slot_blocks` exclusion constraint; advisory-lock mutual exclusion between booking creation and block creation; pricing exclusion constraint; refund intent emitted exactly once.
- **API-level:** every status/error code in §9.7; Zod failures; CSRF; role and ownership denials; pagination `meta`.
- **Critical E2E flow:** Owner submits a facility → Admin approves → Owner configures pricing → Player books a slot → Owner sees it on the schedule → Owner blocks another slot → Owner cancels the booking due to an incident → Player receives notification and refund.
- **Concurrency/idempotency verification:** parallel booking-vs-block on the same interval; parallel duplicate owner cancels produce one transition and one refund.

Tests use Vitest + Supertest against the separate test database (`docs/architecture/conventions.md`).

## 17. Migration / Rollout

- **Migration steps:** add `COURT_SLOT_BLOCKS` (with the generated range, index, and exclusion constraint), the pricing overlap constraint, and the status-vocabulary documentation; run `db:migrate` on dev and test databases. Update `database-schema.md` §3.5–§3.7 and add `COURT_SLOT_BLOCKS` in the same session.
- **Rollout sequencing:** schema first; then the cross-module availability/booking change; then the Owner APIs; then the frontend.
- **Backward compatibility:** blocks default to no rows, so existing booking behavior is unchanged until the Booking path is updated to consider blocks.
- **Rollback/recovery:** drop the new table/constraints and revert the status-vocabulary documentation; existing bookings are unaffected.

## 18. Alternatives Considered

- **A unified `COURT_SLOT_OCCUPANCY` table for bookings and blocks with one exclusion constraint:** rejected as a large refactor of the frozen Booking schema; the advisory-lock approach meets the MVP need.
- **DB triggers on `BOOKINGS` and `COURT_SLOT_BLOCKS` to cross-check overlaps:** viable hardening; not selected (advisory lock + application checks chosen, Decision Log §21 #5) because it adds trigger complexity and locking.
- **Reusing `BOOKINGS` rows with a synthetic status for blocks:** rejected because it pollutes the booking lifecycle, Player ownership semantics, and reporting.
- **Court-level `MAINTENANCE` status instead of slot blocks:** rejected by PRD Decision #7; blocks are slot-level.
- **Executing the VNPAY refund inside the cancellation transaction:** rejected; external calls must not run inside the transaction, and refund execution is owned by the payment lifecycle.

## 19. Observability / Monitoring

- Logs: `info` for owner submissions, block create/release, and owner cancellations (facility/court/booking ids, reason code, refund status); never log Player contact details.
- Metrics: `N/A — no approved metrics infrastructure`.
- Alerts/operational signals: `N/A`; refund failures surface through the existing payment lifecycle.

## 20. Acceptance / Verification Considerations

- **Given** an authenticated `COURT_OWNER`
  **When** they call `GET /api/v1/owner/facilities`
  **Then** only facilities with `owner_id = req.user.id` are returned, paginated with `meta`.

- **Given** a `COURT_OWNER`
  **When** they create a facility or court
  **Then** it is stored as `PENDING_APPROVAL` and is not bookable until Admin approval.

- **Given** a facility owned by another Owner
  **When** the caller requests or edits it
  **Then** the request is rejected without revealing the resource (`404 OWNER_FACILITY_NOT_FOUND`).

- **Given** an owned court with an existing pricing interval
  **When** the Owner submits a new interval that overlaps it
  **Then** the request is rejected with `409 PRICING_INTERVAL_OVERLAP` and no row is written.

- **Given** an owned court with an active booking for a slot
  **When** the Owner blocks a range overlapping that booking
  **Then** the request is rejected with `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`.

- **Given** an owned court with no active booking
  **When** the Owner blocks a valid range with a reason
  **Then** a `COURT_SLOT_BLOCKS` row is created with status `ACTIVE`, and Player availability excludes that range.

- **Given** a valid active block
  **When** the Owner unblocks it
  **Then** the block becomes `RELEASED` and the slot is bookable again.

- **Given** a `CONFIRMED` booking before `start_time` on an owned court and `OWNER_CAN_CANCEL_BOOKING = true`
  **When** the Owner cancels with a reason
  **Then** the booking becomes `CANCELLED`, exactly one refund is initiated (`refundStatus = PENDING`), and one in-app notification is inserted for the Player.

- **Given** an unpaid `PENDING_PAYMENT` hold on an owned court
  **When** the Owner cancels it
  **Then** it becomes `CANCELLED`, the slot is released, and `refundStatus = NONE`.

- **Given** a booking already `CANCELLED`
  **When** the Owner cancels again
  **Then** the response is idempotent `200` and no second refund is initiated.

- **Given** a booking on a court not owned by the caller
  **When** the caller cancels it
  **Then** the request is rejected with `403 OWNER_FORBIDDEN_RESOURCE` or `404 OWNER_BOOKING_NOT_FOUND` (non-enumerating).

- **Given** two concurrent requests — a Player booking and an Owner block on the same court/date/range
  **When** both run
  **Then** exactly one succeeds and the other is rejected with the appropriate overlap error.

## 21. Decision Log

All decisions were resolved by the human owner on 2026-09-27, and the Tech Design was marked `Ready`.

| # | Question or decision | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `PATCH /owner/courts/:id/status` (`ACTIVE`/`MAINTENANCE`) conflicts with PRD Decision #7. | Human owner | Remove the endpoint; maintenance is handled solely through slot blocks (`block-slots`). | 2026-09-27 | RESOLVED |
| 2 | `requireRole(...)` role list and Admin participation. | Human owner | `requireRole('COURT_OWNER')` only, plus ownership. Admin is not granted self-service operations; Admin uses its own moderation endpoints (PRD §5). | 2026-09-27 | RESOLVED |
| 3 | `COURT_SLOT_BLOCKS` entity, columns, generated `block_range`, and partial exclusion constraint. | Human owner + Tech Lead | Approved as designed (§10.2). | 2026-09-27 | RESOLVED |
| 4 | `PENDING_APPROVAL` / `REJECTED` in `FACILITIES`/`COURTS` status vocabularies and the Admin approval transition. | Human owner + Tech Lead | Approved; `PENDING_APPROVAL` and `REJECTED` added; schema-doc update and Admin PRD alignment required with the migration. | 2026-09-27 | RESOLVED |
| 5 | Cross-table booking↔block enforcement. | Tech Lead | Advisory lock per `(court_id, booking_date)` plus application overlap checks in both paths (approved); DB triggers not selected. | 2026-09-27 | RESOLVED |
| 6 | Pricing overlap enforcement form. | Tech Lead | DB exclusion constraint plus service check (approved). | 2026-09-27 | RESOLVED |
| 7 | Block request shape (single vs multiple ranges). | PM + Tech Lead | Single range per request. | 2026-09-27 | RESOLVED |
| 8 | Whether the Owner may delete/remove a court or facility. | Human owner | No delete is added in this feature (add/edit only). | 2026-09-27 | RESOLVED |
| 9 | "Exactly one refund per booking" idempotency representation. | Tech Lead | Reuse the existing payment-lifecycle idempotency/refund-worker guard; no new table. | 2026-09-27 | RESOLVED |
| 10 | `POST /owner/courts/:id/pricings` semantics. | PM + Tech Lead | Upsert (create-or-replace) interval. | 2026-09-27 | RESOLVED |

No open questions remain. The schedule response shape is finalized during implementation within the approved contract (§9.4). The `COURT_SLOT_BLOCKS` and status-vocabulary schema deltas must land with the same-session `database-schema.md` update, and the cross-module booking↔block change must be recorded in `docs/features/booking/player-booking/tech-design.md`.

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27
Approved decision/reference: §21 Decision Log (2026-09-27)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.
