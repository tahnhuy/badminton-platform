# Court Owner Self-Service — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/court-owner/prd.md
Scope: Court Owner self-service — manage owned facilities/courts (with Admin approval for creation), per-hour court pricing, real-time schedule monitoring, maintenance slot blocks, and owner-side booking cancellation with refund + in-app notification
Decision Status: Approved (initial 2026-09-27; review recommendations 1–14 and F01–F24 (all A) approved 2026-10-23)
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
2. **Pending-approval onboarding** — `FACILITIES.status` / `COURTS.status` already include pending/rejected states; implement their submission, resubmission and Admin-owned review transitions with retained history.
3. **Slot block implementation** — approved COURT_SLOT_BLOCKS is documented in the consolidated schema; its migration and booking integration remain implementation work.
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
- Missing and non-owned resources both return the same typed `404 OWNER_*_NOT_FOUND`. Wrong-role calls return `403 AUTH_FORBIDDEN_ROLE`; never reveal another Owner’s resource existence.
- Ownership checks live in the service/repository, not the controller, so alternate call paths cannot bypass them.

### 7.3 Facility/Court Onboarding with Admin Approval

- `POST /api/v1/owner/facilities` inserts a facility with `status = 'PENDING_APPROVAL'` and `owner_id = req.user.id`.
- `POST /api/v1/owner/facilities/:id/courts` inserts a court with `status = 'PENDING_APPROVAL'`.
- Admin approval moves a submission to `ACTIVE`; Admin rejection moves it to `REJECTED`. Those transitions are owned by Admin Court Management (`docs/features/admin/court-management/prd.md`); this design only defines the owner submission state and reads it back. Status vocabulary and the CHECK constraint are in `docs/architecture/database-schema.md` §3.5/§3.6/§5.15.
- Until approved (not `ACTIVE`), the facility/court is not eligible for new bookings; both facility and court must be `ACTIVE` and not deactivated. Existing bookings remain readable/actionable subject to their own eligibility, including when their facility is suspended.

### 7.3.1 Edits, reviews and opening hours (2026-10-23)

- Initial facility/court creation also inserts a pending `COURT_OWNER_REVIEWS` onboarding attempt. Snapshot the submitted metadata; pending attempts are immutable. Rejected resources can be edited and explicitly resubmitted on the same resource ID; resubmission appends an attempt and sets onboarding status to `PENDING_APPROVAL` atomically.
- Name/description/phone updates after approval apply directly. For an already approved facility, address/ward/district/city/latitude/longitude changes use a separate `ADDRESS_CHANGE` review with the proposed location snapshot. Do not overwrite the effective facility address or moderation status until Admin approves. Rejection retains the old effective address. A rejected address proposal can be revised and submitted as a new attempt.
- Admin approval/rejection records reviewer, time and mandatory rejection reason in the same transaction as any resource update. Admin endpoints are specified by Admin Court Management. Owner reads review history; no reviewer authority is granted to Owner.
- Facility hours update rejects with `409 OPENING_HOURS_CONFLICT` if it excludes an effective future or in-progress booking. Serialize hours writes, booking creation (including Tournament), and eligibility validation through the same facility row lock, then court-date advisory lock where needed; always use this lock order. Expire stale unpaid holds under the established Booking rules before checking. Re-check effective hours inside booking-creation transactions.
- Court update accepts only name/description. Reject status/facilityId fields. No transfer or delete operation is added.

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
5. Slot states: `FREE | BOOKED | BLOCKED | UNAVAILABLE` (a slot covered by both a booking and a block is not expected because blocks cannot overlap active bookings, §8/§13).

The schedule is a bounded single-day view (no pagination); it is refreshed by HTTP polling (5–10 s). Occupied intervals remain visible even without current pricing or active moderation status. For unoccupied intervals, return `UNAVAILABLE` plus all applicable causes for closed hours, absent pricing or inactive parent/court; only `FREE` is bookable. Keep the grid independent of pricing coverage; use the existing Booking time-grid convention. Tournament occupancy includes match/tournament identifiers instead of fabricated Player/payment data.

### 7.5.1 Booking history/detail

- Owner history reads all booking statuses, paginated and newest first, through booking → court → facility ownership. Details include cancellation reason/time where recorded and current Payment-owned refund state.
- Refund mapping: no refund intent → `NONE`; `REFUND_PENDING` → `PENDING`; `REFUNDED` → `REFUNDED`; `REFUND_FAILED` → `FAILED`. Do not label a successful payment as a pending refund. Raw provider fields are not exposed.
- These are read operations, available for existing bookings even if a facility/court is suspended. Tournament details show system reservation context and no Player refund action.

### 7.6 Slot Blocks

- `COURT_SLOT_BLOCKS` rows are `ACTIVE` or `RELEASED`.
- Create validates: owned court, `end > start`, single day, within `MAINTENANCE_ADVANCE_WINDOW_DAYS` (default 90, independent of booking advance window), mandatory `reason`, and **no overlap with an active booking (including a tournament-match system booking) or another active block** (PRD #6).
- Create/edit takes the court-date advisory lock and re-checks overlap inside the transaction (§13).
- Unblock identifies exactly one owned block by `blockId`, releases the whole interval and returns its state; repeat release is idempotent. Range-based, partial and bulk release are not offered.
- The Player Booking availability read model subtracts active blocks in addition to active bookings (cross-module contract). Tournament-match system bookings participate in the same overlap set; they are created by TournamentModule scheduling, not by the Owner.

### 7.7 Owner Booking Cancellation

`POST /api/v1/owner/bookings/:id/cancel`:

1. `authenticate` + `requireRole('COURT_OWNER')`; ownership resolved through booking → court → facility.
2. Preconditions: booking belongs to an owned court; reject a tournament system booking (identified by its `MATCHES.booking_id` linkage and tournament context) with `409 OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE`; `status IN ('PENDING_PAYMENT','CONFIRMED')`; `now < start_time` (Asia/Ho_Chi_Minh); `OWNER_CAN_CANCEL_BOOKING = true`; deadline per `OWNER_CANCELLATION_DEADLINE_MINUTES` (PRD #5); mandatory `reason`.
3. Inside one database transaction:
   - `SELECT booking FOR UPDATE`; re-validate state.
   - If already `CANCELLED`, return the existing result idempotently (no second refund).
   - Set `status = 'CANCELLED'`, `cancellation_reason = reason` and `cancelled_at = now()` atomically.
   - If the booking was paid (a successful payment exists), record the refund intent through the payment lifecycle exactly once (reusing the `BookingCancelled`-style refund mechanism from `docs/features/booking/player-booking/tech-design.md` §8.4 / BK-07). No provider call is made inline.
   - Insert the in-app `NOTIFICATIONS` row for the Player with the cancellation reason.
4. After commit, the existing refund worker executes the VNPAY refund and updates payment/refund status; the API returns `refundStatus` (`NONE` / `PENDING` / `REFUNDED` / `FAILED`).

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
- The Owner cannot directly assign moderation statuses (PRD #7); the explicit resubmit operation transitions rejected onboarding to PENDING_APPROVAL. A court `ACTIVE`/`MAINTENANCE` status is **not** introduced here; maintenance is handled solely through slot blocks (Decision Log §21 #1).

### 8.2 Slot Block Lifecycle

```text
(create, valid range) ──► ACTIVE ──(unblock by blockId)──► RELEASED
```

- A block is `ACTIVE` while it prevents new bookings.
- A block may not overlap an active booking at creation; it may be released at any time.

### 8.3 Owner Cancellation

```text
PENDING_PAYMENT ──(owner cancel: release, no refund)────────► CANCELLED
CONFIRMED       ──(owner cancel: full refund + notify)──────► CANCELLED
```

- Terminal: `CANCELLED`. Repeating the action is an idempotent success for an owned eligible Player booking; read the current refund status instead of fabricating a new pending refund. The repeat path runs after ownership/type checks and before fresh-cancellation eligibility checks.

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

Additional §9.1 contracts (all owned-resource checks return 404 on missing/non-owned):

- `GET /owner/facilities/:id` — `200 { data: { ...facility, courts, latestOnboardingReview, pendingAddressReview } }` for the edit/detail view; never return another Owner’s records.
- `PUT /owner/courts/:id` — body `{ name, description? }`; `200 { data: ...court }`; no status/facility reassignment.
- `POST /owner/facilities/:id/resubmit` and `POST /owner/courts/:id/resubmit` — empty body; allowed only from `REJECTED`, append an onboarding attempt and return `200 { data: { id, status: "PENDING_APPROVAL", reviewId } }`.
- `POST /owner/facilities/:id/address-change-requests` — body `{ address, ward?, district, city, latitude, longitude }`; `201 { data: { reviewId, status: "PENDING", proposedValues } }`; pending duplicate → `409 REVIEW_ALREADY_PENDING`.
- `GET /owner/facilities/:id/reviews` and `GET /owner/courts/:id/reviews` — paginated review history with attempt ID, kind, submitted snapshot, status, rejectionReason, submittedAt, reviewedAt. Owner cannot edit reviewer results.
- Facility `PUT` accepts direct metadata/hours changes on approved resources, and location edits only before onboarding approval (`REJECTED` editable; `PENDING_APPROVAL` locked). Post-approval location changes must use the proposal endpoint, otherwise `409 ADDRESS_CHANGE_REQUIRES_REVIEW`. Pending-onboarding edit → `409 REVIEW_ALREADY_PENDING`; invalid resubmit state → `409 REVIEW_NOT_RESUBMITTABLE`. Deleted resources cannot be resubmitted or newly booked.

### 9.2 Court Status — not provided

The requested `PATCH /api/v1/owner/courts/:id/status` with `{ status: "ACTIVE" | "MAINTENANCE" }` was **removed** by decision (Decision Log §21 #1). It conflicted with PRD Decision #7 (the Owner cannot change operational status; maintenance uses slot blocks only) and with the Admin-owned status vocabulary (`ACTIVE`/`SUSPENDED`). Maintenance is implemented through `block-slots` (§9.5).

### 9.3 Pricing

- `GET /api/v1/owner/courts/:id/pricings` — owned court; optional `validOn=YYYY-MM-DD`.
  - Response `200`: `{ data: [{ id, startTime, endTime, pricePerHour, validFrom, validTo }] }` (bounded; no pagination).
- `POST /api/v1/owner/courts/:id/pricings` — upsert: omit `pricingId` to create; provide an existing owned `pricingId` to update that row, including changes to its times. An unknown/non-owned ID returns `404 OWNER_PRICING_NOT_FOUND`; never fall back to insert. Ending validity uses the same upsert with `validTo` and a valid inclusive date range; no hard delete.
  - Body: `{ pricingId?, startTime, endTime, pricePerHour, validFrom, validTo? }`.
  - Response `201` (created) / `200` (updated): `{ data: ... }`.
  - Errors: `409 PRICING_INTERVAL_OVERLAP`.

### 9.4 Schedule

- `GET /api/v1/owner/facilities/:id/schedule?date=YYYY-MM-DD` — owned facility schedule matrix for the date.
  - Response `200`: `{ data: { facilityId, date, courts: [{ courtId, courtName, status, slots: [{ startTime, endTime, state: "FREE"|"BOOKED"|"BLOCKED"|"UNAVAILABLE", unavailableReasons?: ["CLOSED"|"NO_PRICING"|"FACILITY_INACTIVE"|"COURT_INACTIVE"|"PAST"|"OUTSIDE_BOOKING_WINDOW"|"BOOKING_DISABLED"], pricePerHour?, bookingId?, bookingStatus?, bookingKind?: "PLAYER"|"TOURNAMENT", tournamentId?, matchId?, player?, blockId?, reason? }] }] } }`.
  - Errors: `400 VALIDATION_FAILED`; `404 OWNER_FACILITY_NOT_FOUND`.

### 9.5 Slot Blocks

- `POST /api/v1/owner/courts/:id/block-slots` — block exactly one interval on an owned court.
  - Body: `{ bookingDate, startTime, endTime, reason }` (single range per request; Decision Log §21 #7).
  - Response `201`: `{ data: { blocks: [{ id, courtId, bookingDate, startTime, endTime, reason, status: "ACTIVE" }] } }`.
  - Errors: `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`, `409 SLOT_BLOCK_OVERLAP_BLOCK`, `400 SLOT_BLOCK_INVALID_RANGE`, `400 SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW`, `409 COURT_NOT_ELIGIBLE`.
- `POST /api/v1/owner/courts/:id/unblock-slots` — release one whole owned block, idempotently.
  - Body: `{ blockId }`.
  - Response `200`: `{ data: { id, courtId, status: "RELEASED" } }`.
  - Errors: `404 OWNER_SLOT_BLOCK_NOT_FOUND`.

### 9.6 Owner Booking Cancellation

- `POST /api/v1/owner/bookings/:id/cancel` — owner cancels an eligible booking due to a court-side incident.
  - Body: `{ reason }` (mandatory).
  - Response `200`: `{ data: { bookingId, status: "CANCELLED", refundStatus: "NONE"|"PENDING"|"REFUNDED"|"FAILED" } }`.
  - Errors: `404 OWNER_BOOKING_NOT_FOUND`, `409 OWNER_BOOKING_NOT_CANCELLABLE`, `409 OWNER_CANCELLATION_DISABLED`, `409 OWNER_CANCELLATION_DEADLINE_PASSED`.

### 9.6.1 Owner history/detail

- `GET /owner/facilities/:id/bookings?page=&limit=&status=&dateFrom=&dateTo=` — `200 { data: [{ id, courtId, bookingDate, startTime, endTime, status, bookingKind, refundStatus }], meta }`; optional filters, newest booking date/time first, ID tie-breaker.
- `GET /owner/bookings/:id` — `200 { data: { ...bookingSummary, player?, tournamentId?, matchId?, cancellationReason, cancelledAt, refundStatus } }`. Player contact is returned only within the owning scope. Cancellation metadata uses BOOKING cancellation fields; see schema delta §10.1. History/detail, not the active-only grid, retains cancelled records.
- Owner cancel error `409 OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE` instructs Organizer handling. At/after start, use the existing deadline error with support guidance; do not offer an override.

### 9.7 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Zod failure at the boundary (global code). |
| `AUTH_FORBIDDEN_ROLE` | 403 | Caller is not a `COURT_OWNER`. |
| `OWNER_FACILITY_NOT_FOUND` | 404 | Facility id does not exist or is not visible to the caller. |
| `OWNER_COURT_NOT_FOUND` | 404 | Court id does not exist or is not visible. |
| `OWNER_BOOKING_NOT_FOUND` | 404 | Booking id does not exist or is not visible. |
| `OWNER_SLOT_BLOCK_NOT_FOUND` | 404 | No matching owned block. |
| `PRICING_INTERVAL_OVERLAP` | 409 | Pricing interval overlaps an existing interval for the court. |
| `SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING` | 409 | Block overlaps an active booking. |
| `SLOT_BLOCK_OVERLAP_BLOCK` | 409 | Block overlaps another active block. |
| `SLOT_BLOCK_INVALID_RANGE` | 400 | End <= start or out of opening hours / cross-midnight. |
| `SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW` | 400 | Date outside `MAINTENANCE_ADVANCE_WINDOW_DAYS`. |
| `COURT_NOT_ELIGIBLE` | 409 | Court/facility is not eligible (e.g., pending approval). |
| `OWNER_BOOKING_NOT_CANCELLABLE` | 409 | Booking status does not allow owner cancellation. |
| `OWNER_CANCELLATION_DISABLED` | 409 | `OWNER_CAN_CANCEL_BOOKING` is false. |
| `OWNER_CANCELLATION_DEADLINE_PASSED` | 409 | Cancellation attempted at/after the deadline. |
| `OWNER_PRICING_NOT_FOUND` | 404 | Unknown/non-owned pricingId; no implicit creation. |
| `OPENING_HOURS_CONFLICT` | 409 | Proposed hours exclude an effective booking. |
| `ADDRESS_CHANGE_REQUIRES_REVIEW` | 409 | Approved location must use the proposal flow. |
| `REVIEW_ALREADY_PENDING` | 409 | Pending onboarding edit or duplicate pending review. |
| `REVIEW_NOT_RESUBMITTABLE` | 409 | Onboarding is not rejected. |
| `OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE` | 409 | Tournament system reservation requires Organizer handling. |
| `INTERNAL_ERROR` | 500 | Unexpected error (global code). |

### 9.8 Approved Owner UI contract (F01–F24, all A; 2026-10-23)

Use [PRD §8.2/§14.2](prd.md) and the [Figma review](frontend-figma-review.md) together with the APIs in §9.1–§9.6.1. No new business API, schema column or provider is introduced by this UI alignment decision. Do not implement extra capabilities merely because a canvas contains them.

| Screen(s) | Approved composition and data boundary | Review |
| --- | --- | --- |
| O01 | Minimal navigation/workspace using owned facility/court reads. Show links to setup, pricing and calendar; no analytics/revenue/occupancy projections, AI, IoT, ranking or synthetic KPI. | F01, F19, F21–F22 |
| O02/O09/O10 | Facility selector plus approved §9.1 forms. Direct metadata save, separate address proposal, approved/proposed comparison, review history and resubmit; field feedback for OPENING_HOURS_CONFLICT. Pending onboarding immutable; no publish-now or operational-status toggle. No media/map/legal/equipment integrations or persisted draft/autosave. | F04–F09, F13, F22 |
| O03/O11/O12 | Owned court list and name/description create/edit. Submit new court for review; show parent/court status and pricing readiness separately. Slot-maintenance shortcut opens interval form, never a moderation toggle. No structured technical fields, court transfers, image upload, revenue cards or immediate activation. | F04, F07–F09, F19, F21 |
| O04/O13/O14 | Select one owned court and list/upsert intervals per §9.3. Existing edits send pricingId; end validity through validTo. Show price/hour, dates and overlap errors; no multi-court templates, tiers, calendar surcharge, versions, drafts, AI or financial projections. Copy states price locks when booking/hold is created. | F10–F13, F19 |
| O05/O15 | One single-day calendar workspace with filters/selector and paginated history from §9.6.1, polling 5–10s. BOOKED uses the underlying booking status, BLOCKED uses block identity/reason, UNAVAILABLE lists reasons; no invented lifecycle. Occupancy remains visible after eligibility/pricing changes. No week/month/export, Owner booking creation, recurring sessions or check-in. | F07, F14–F18, F22 |
| O06 | Detail panel consuming §9.6.1 with snapshotted amount/segments where supplied, current refund state, reason/time and full scoped contact. Optionally reveal masked contact locally without another data source. Tournament context replaces Player/payment assumptions. No bank/payout data, chat, PDF/check-in/live score. | F01–F02, F12, F16, F18, F23 |
| O07/O16 | Cancel confirmation and result within the calendar. Mandatory reason, explicit acknowledgement and duplicate-submit guard; rely on §9.6 eligibility/errors. Unpaid result NONE; paid result is current Payment-owned PENDING/REFUNDED/FAILED. Do not infer refund receipt from CANCELLED. Refresh detail/history; separate follow-up maintenance request can conflict and does not roll back cancellation. No SMS/push/voucher or auto-lock. | F01–F03, F07, F14, F16 |
| O08 | Read current identity via existing GET /api/v1/auth/me (id, email, role, requiresPasswordChange); link to existing password-change and sign-out actions. Do not invent Owner name/avatar/profile-edit endpoint or expose fields absent from AuthUser. No eKYC, bank account, role switch, MFA or legal document UI. | F20–F21 |
| O17 | Render existing 401 sign-in/expired-session flow, 403 wrong role/other Auth-specific errors, typed 404 without existence leaks and feature business errors with accurate recovery. No OWNER_RESTRICTED_ACTION tier, eKYC gate or sample support identity. | F24 |

Additional UI rules:

- Facility changes must isolate query/cache keys and selected court/booking by facility; close stale detail, clear incompatible selection and avoid showing the previous facility’s data while the new scope loads. Preserve in-progress forms during same-scope polling, per CO-07.
- Use backend availability, validation and existing configuration contracts for eligibility/policy copy. Do not hard-code 14 days, two hours, a five-minute hold, or allow Owner writes to global config. Defaults (booking 7 days, maintenance 90 days, cancellation deadline 0) are explanatory defaults, never substitutes for effective server policy. This revision does not add a config-editor/read endpoint to Owner.
- Missing facilities/courts/pricing/bookings each have actionable empty states; loading is not empty. Pending/rejected/suspended are distinct from network failures. Offer retry for retryable read failures; ownership failure never exposes data.
- Form field allowlists remain §9.1/§9.3/§9.5. Description may contain voluntary details; do not parse those into structured equipment ratings or imply platform verification. No server draft/autosave lifecycle.
- Support details must come from a confirmed existing operational source. When unavailable, omit contact/SLA/technician claims and display the eligibility restriction alone. Do not invent a support endpoint or placeholder number/email.
- Full contact is only exposed in owned-resource DTOs per §11; masking is display only, not a substitute for service authorization. No contact in client telemetry/logs.
- Before implementation is DONE, validate critical states against these rules; raw Figma text contradicting them must not ship. Canvas alignment and application implementation are separate deliverables.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. Only the delta is recorded here; applying it requires a schema decision and a same-session schema-doc update.

### 10.1 Existing Objects Affected

- `FACILITIES` §3.5: the four-value status vocabulary and CHECK are already approved in §5.15. Reuse them; verify applied migrations before adding any duplicate constraint. `owner_id` already exists.
- `COURTS` §3.6: reuse the existing four-value status vocabulary and CHECK for owner-submitted courts.
- `COURT_PRICINGS` §3.7: no column change; `price` is per hour (semantics), overlap enforced by a new constraint.
- `BOOKINGS` §3.8: persist nullable `cancellation_reason` and `cancelled_at` for owner cancellation/detail; add them if not already represented in the actual migration history. `BOOKING_PRICING_DETAILS` stays unchanged; pricing snapshots remain immutable.
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

### 10.2.1 Submission and address review history

Use `COURT_OWNER_REVIEWS` in consolidated schema §3.33: exactly one facility/court target, `ONBOARDING` or `ADDRESS_CHANGE`, submitted metadata snapshot, `PENDING | APPROVED | REJECTED`, submitting Owner, reviewing Admin, timestamps, and required rejection reason. One pending attempt per target/kind. Address reviews target facilities only. This supports retained rejection reasons and resubmission without duplicating facilities/courts or replacing the live approved address. It is review data, not a second facility operational status.

### 10.3 Booking ↔ Block Mutual Exclusion

PostgreSQL cannot enforce one exclusion constraint across `BOOKINGS` and `COURT_SLOT_BLOCKS`. Proposed MVP mechanism:

1. Both the Booking creation path and the Block creation path acquire a **transaction-scoped advisory lock** keyed by `(court_id, booking_date)` (`pg_advisory_xact_lock(hashtext('court:'||court_id||':'||date))`).
2. While holding the lock, each path checks the other table for overlapping active intervals before inserting.
3. Existing booking-vs-booking protection (`ex_bookings_court_no_overlap`) remains in place.

This is a cross-module change to `docs/features/booking/player-booking/tech-design.md` §7.2/§13 and must be recorded there. This approach was approved (Decision Log §21 #5); the DB-trigger alternative is recorded in §18.

### 10.4 Migration Script (illustrative; use the next free migration identifier)

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
- **Sensitive data:** the Owner sees full Player contact details only for bookings on their own facilities (PRD #8). This data must not be logged, must not be exposed outside the owner scope, and is returned only by owner-scoped schedule and booking-detail endpoints.
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
| Block overlaps active booking | Overlap check under advisory lock | `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING` | Owner resolves an eligible Player booking by cancellation first; Tournament requires Organizer handling, and started bookings cannot be self-service cancelled. |
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

### 13.1 Implementation readiness audit — 2026-10-23

The approved transaction/refund/notification behavior above is the target. Current `services/booking/booking-events.ts` is an in-process best-effort event seam; `PaymentService.refundBookingPayment` currently marks a successful payment REFUNDED directly without provider execution. These do not supply the durable refund intent/worker or transaction-aware notification persistence required by §7.7. CO-05 must consume PAY-04's persisted refund/read/worker boundary and NTF-01/NTF-02's transaction-aware deduplicated NotificationService; do not implement Owner cancellation using only post-commit events. NTF-03/NTF-04 are needed to accept Player-visible notification reads. Their pending implementation is recorded in [tasks.md](tasks.md), Execution plan.

Current schema definitions for facility, court and pricing share `backend/src/db/schema/facilities.ts`; Owner cancellation and maintenance config reads are not exposed by the current booking-config reader. The latest journal entry is currently 0008, but migrations must use the actual next free ID at execution. Actual Booking creation locks the court first; CO-04 adds the approved facility→court-date order across paths while preserving existing Player-limit locking. Ward mismatch resolved by explicit human choice A on 2026-10-23: optional input persists NULL; migration drops NOT NULL, existing non-empty ward values remain. Dependent DTOs accept null and address rendering skips absent components.

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
  **Then** the block becomes `RELEASED`; bookability still requires all other availability gates.

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
  **Then** the request is rejected with `404 OWNER_BOOKING_NOT_FOUND` (non-enumerating).

- **Given** two concurrent requests — a Player booking and an Owner block on the same court/date/range
  **When** both run
  **Then** exactly one succeeds and the other is rejected with the appropriate overlap error.

## 21. Decision Log

Initial decisions were resolved on 2026-09-27. The human owner approved review recommendations 1–14 on 2026-10-23 (PRD §14.1); this revision specifies their contracts and schema deltas. Shared-document/schema changes await teammate PR review before merge.

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

No open questions remain. The schedule response and unavailable-reason contract are recorded in §9.4; do not silently change them during implementation. The `COURT_SLOT_BLOCKS` and status-vocabulary schema deltas must land with the same-session `database-schema.md` update, and the cross-module booking↔block change must be recorded in `docs/features/booking/player-booking/tech-design.md`.

### 21.1 Review revision — 2026-10-23

The fourteen approved choices are recorded once in PRD §14.1. Their technical effects are §7.3.1 (review/history/hours), §9.1 (court edit/resubmit/proposals), §9.3 (pricingId upsert), §9.4 (unavailable reasons), §9.5 (90-day maintenance and single-block release), §9.6.1 (history/refund and Tournament exclusion), and §9.7 (uniform 404). Decision #10 remains upsert, clarified by explicit ID; the old interval-key guess is superseded. Schema deltas are consolidated in `database-schema.md` §3.32–§3.33 and §3.8. O05/O15 share one calendar; O06/O07/O16 compose detail/cancellation/result panels. This does not declare implementation complete.

### 21.2 Figma review — approved 2026-10-23

Human owner approved F01–F24 as A. Product decision table: PRD §14.2. Target UI/data boundaries: §9.8. Original observations and rejected B alternatives remain in frontend-figma-review.md for traceability. This approval introduces no wallet, surcharge engine, profile CRUD, draft lifecycle, check-in, hardware, new provider or new schema delta; it restricts UI to existing/approved contracts and adds their missing states. Figma canvas/code tasks are not marked complete.

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27; review revision approved 2026-10-23
Approved decision/reference: §21 Decision Log (2026-09-27), §21.1–§21.2 (2026-10-23)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.

CO-01 persistence detail, 2026-10-23: pricing overlap uses generated int4range of seconds since midnight and inclusive daterange validity; manual SQL GiST exclusions are in migration 0009 because Drizzle has no exclusion builder. No production migration was applied.

Implementation decision gate, 2026-10-23: F23 phone visibility cannot be implemented from current Player data (no phone in USERS/PLAYER_PROFILES/registration). Await human choice before Owner schedule/detail contact DTO implementation; no new phone schema or borrowed contact has been introduced. See tasks.md verified progress.

2026-10-23 contact gate RESOLVED: human owner selected B. PP-07 adds optional private PLAYER_PROFILES.phone, registration collection and self-contact editing; Owner schedule/detail reads the actual stored value within owned bookings. No fabricated phone/public disclosure. Continue CO-04 after PP-07 data/API slice; prior gate paragraphs are historical observations, not an unresolved decision.

2026-10-23 human owner selected A for schedule eligibility: UNAVAILABLE reasons additionally include PAST, OUTSIDE_BOOKING_WINDOW and BOOKING_DISABLED. Occupied booking/block display keeps priority; maintenance still uses its independent 90-day horizon. FREE is not returned for elapsed time or disabled/out-of-window Player sales.

## SH02 frontend shell — 2026-11-19

Owner shell presentation now uses the common brand, semantic tokens and NativeSelect, with the same five route destinations and facilityId query behavior. Facility pagination, abort, fallback selection and context remount are unchanged. No owner endpoint, permission, workflow or mutation changed. Inner page modernization remains D14–D17.

## D14 frontend facilities — 2026-11-19

Facility/court/review views and the reused creation form now use shared token-based controls/tables. FormData serialization, pending/rejected/active/suspended conditions, initial values/keys, commands, API payloads, polling and history pagination are preserved. Creating a facility remains an explicit Owner submission for Admin review, not immediate publishing. Changes to legacy wrappers only isolate CSS; Dashboard/Pricing/Schedule/Account behavior is unchanged.
