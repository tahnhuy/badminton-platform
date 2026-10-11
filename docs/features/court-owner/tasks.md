# Court Owner Self-Service (Quản lý cơ sở sân, bảng giá và giám sát slot) — Task List

Implementation tasks for the Court Owner Self-Service feature.

- Feature: Court Owner Self-Service
- Domain: `features/court-owner`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 #1–#10)
- Business rules: `docs/business-rules-config-matrix.md` §2, §8.1, §8.2
- Schema authority: `docs/architecture/database-schema.md` §2.2, §3.4–§3.10, §3.24

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. The Tech Design has no remaining open questions. Scope is bounded by `prd.md` and `tech-design.md`.
>
> **Environment note (Auth dependency).** The Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware` and enforces `requireRole`; the `[TEMP AUTH BYPASS]` no longer applies in development/production. Owner endpoints require a real signed-in `COURT_OWNER` identity. In `NODE_ENV=test`, API tests may still supply an active `COURT_OWNER` identity via the test-only `X-User-Id` header.
>
> **Cross-module note.** CO-04 depends on the Player Booking availability/creation change (block awareness and the `(court_id, booking_date)` advisory lock). CO-05 depends on the PaymentModule refund execution. Those modules are not yet implemented (`docs/features/booking/player-booking/tasks.md` BK-04/BK-05, `docs/features/platform/payments-refunds/` PAY-04), so CO-04/CO-05 and their dependent frontend tasks are marked `BLOCKED`.
>
> **Schema/documentation note.** The facility/court status vocabulary (`PENDING_APPROVAL`, `REJECTED`) and its CHECK are already recorded in `database-schema.md` §3.5/§3.6/§5.15. CO-01 must still land its migration (the next free number after the Ratings `0007` and Matchmaking-invitation migrations) together with the remaining `COURT_SLOT_BLOCKS`/pricing section updates. The cross-module contract change in CO-04 must also be recorded in `docs/features/booking/player-booking/tech-design.md`.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| CO-01 | Schema migration/repository layer for facility, court, pricing, and blocked slots | Approved | — | L |
| CO-02 | Owner facility and court management API (with ownership + approval states) | Approved | CO-01 | M |
| CO-03 | Owner court pricing API (per-hour intervals, overlap rejection) | Approved | CO-01 | M |
| CO-04 | Owner schedule API and slot block/unblock (with cross-module block awareness) | BLOCKED | CO-01, Player Booking (BK-04/BK-05) | L |
| CO-05 | Owner booking cancellation API (transaction + refund + notification) | BLOCKED | CO-01, PaymentModule refund (PAY-04) | L |
| CO-06 | Frontend Owner dashboard and facility/court/pricing management | Approved | CO-02, CO-03 | L |
| CO-07 | Frontend schedule matrix, quick slot block, and booking detail | BLOCKED | CO-04 | L |
| CO-08 | Frontend owner cancellation modal (reason + refund confirmation) | BLOCKED | CO-05 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | CO-01 | — |
| 2 | CO-02, CO-03 | CO-01 |
| 3 | CO-04, CO-05 | CO-01 / Player Booking (BK-04, BK-05) / PaymentModule (PAY-04) |
| 4 | CO-06 | CO-02, CO-03 |
| 5 | CO-07, CO-08 | CO-04, CO-05 |

---

## [ ] CO-01: Schema migration/repository layer for facility, court, pricing, and blocked slots

```text
Status: Approved
Size: L
Blocked by: N/A
```

**Objective:** Apply the approved schema delta (Tech Design §10) and provide the persistence primitives for owner-scoped facilities, courts, per-hour pricing, and slot blocks, keeping SQL, locking, and constraints inside the repository layer.

**Scope**

- In scope:
  - Extend the `FACILITIES` / `COURTS` `status` vocabularies with `PENDING_APPROVAL` and `REJECTED` (drizzle definitions + documentation).
  - Add the `COURT_SLOT_BLOCKS` table: columns, `CHECK (end_time > start_time)`, generated `block_range` (Asia/Ho_Chi_Minh), index `(court_id, booking_date)`, and the partial `EXCLUDE` constraint for active blocks.
  - Add the pricing overlap constraint on `COURT_PRICINGS`.
  - Migration `0006` for all of the above; update `docs/architecture/database-schema.md` §3.5–§3.7 and add the new table section in the same session.
  - Repositories: owner facility/court reads (scoped by `owner_id`), pricing reads/writes with overlap check, slot-block reads/writes, active-booking overlap reads, and a court-date advisory-lock helper.
  - Repository must not throw HTTP errors.
- Out of scope:
  - Services, controllers, and HTTP contracts (CO-02 … CO-05).
  - The Player Booking availability/booking-creation change (cross-module, CO-04).
  - Admin approval endpoints (owned by `docs/features/admin/court-management/prd.md`).

**Implementation requirements**

1. Use Drizzle ORM (`backend/src/db`) with parameterized queries and explicit column selection; keep transaction context explicit.
2. Mirror the existing `BOOKINGS.booking_range` pattern for `COURT_SLOT_BLOCKS.block_range` and reuse the already-enabled `btree_gist` extension.
3. Implement the pricing exclusion expression over court + time range + validity range; expose a helper the service can use for a pre-check.
4. Provide an advisory-lock helper `pg_advisory_xact_lock(hashtext('court:'||court_id||':'||date))` for use by block creation and (cross-module) booking creation.
5. Return repository-level results; do not throw HTTP errors.

**Files/areas affected**

- `backend/src/db/schema/facilities.ts`
- `backend/src/db/schema/courts.ts` `[Proposed — verify during implementation]`
- `backend/src/db/schema/courtSlotBlocks.ts` `[Proposed — verify during implementation]`
- `backend/src/db/schema/index.ts`
- `backend/src/db/migrations/0006_*.sql`
- `backend/src/db/migrations/meta/`
- `backend/src/repositories/owner/OwnerFacilityRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/OwnerCourtRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/OwnerPricingRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/CourtSlotBlockRepository.ts` `[Proposed — verify during implementation]`
- `docs/architecture/database-schema.md`

**API impact:** None.

**Schema impact:** Adds `COURT_SLOT_BLOCKS` (columns, generated range, partial exclusion), a pricing overlap exclusion constraint, and the `PENDING_APPROVAL`/`REJECTED` status vocabulary. Consolidated schema §3.5–§3.7 updated with the migration.

**Verification**

- Unit: N/A.
- Integration: Migration applies cleanly on a fresh and a populated database; overlapping active blocks on the same court are rejected; touching intervals are accepted; the pricing exclusion rejects overlapping intervals; existing booking/pricing rows remain valid.
- API-level: N/A.
- E2E for a critical flow: N/A.
- Edge/failure/concurrency: `CHECK (end_time > start_time)` rejects an invalid block; concurrent identical block inserts produce one active block; `RELEASED` blocks do not participate in the exclusion.
- Manual: Read back the applied table, constraints, index, and the updated status-vocabulary documentation.

**Acceptance criteria**

- **Given** a fresh database
  **When** migration `0006` runs
  **Then** `COURT_SLOT_BLOCKS` exists with `block_range`, the `(court_id, booking_date)` index, the partial exclusion constraint, and the pricing exclusion constraint, with no data loss.

- **Given** an active block on a court/time range
  **When** a second active block overlapping that range is inserted
  **Then** the database rejects it, while a boundary-touching block is accepted.

- **Given** two existing pricing intervals for a court with overlapping validity
  **When** a third overlapping interval is inserted
  **Then** the database rejects it via the pricing exclusion constraint.

- **Given** a `RELEASED` block
  **When** a new active block overlaps the released block's range
  **Then** the insert is accepted (released blocks are excluded from the constraint).

- **Given** a block insert with `end_time <= start_time`
  **When** the insert is attempted
  **Then** the database rejects it via `chk_court_slot_block_range`.

---

## [ ] CO-02: Owner facility and court management API (with ownership + approval states)

```text
Status: Approved
Size: M
Blocked by: CO-01
```

**Objective:** Implement owner-scoped facility and court management endpoints with Zod validation and ownership enforcement, creating submissions in `PENDING_APPROVAL`.

**Scope**

- In scope:
  - `GET /api/v1/owner/facilities` (paginated, optional `status`), `POST /api/v1/owner/facilities`, `PUT /api/v1/owner/facilities/:id`, `POST /api/v1/owner/facilities/:id/courts`.
  - Zod schemas for all params/query/body; `authenticate` + `requireRole('COURT_OWNER')`; service-layer ownership (`owner_id = req.user.id`).
  - Facility/court creation stored as `PENDING_APPROVAL`; updates never change moderation status.
  - Error mapping per Tech Design §9.7 (`OWNER_FORBIDDEN_RESOURCE`, `OWNER_FACILITY_NOT_FOUND`, `OWNER_COURT_NOT_FOUND`, `VALIDATION_FAILED`).
- Out of scope:
  - Court status changes (removed by decision; not provided).
  - Admin approval endpoints (Admin Court Management).
  - Pricing (CO-03), schedule/blocks (CO-04), cancellation (CO-05).
  - Delete/remove of courts or facilities (not in scope).

**Implementation requirements**

1. Follow route → controller → service → repository layering; thin routes/controllers.
2. Enforce ownership in the service by joining the resource to its owning facility; respond consistently without leaking existence.
3. Paginate facility lists with the standard `meta` shape; keep query parameter names consistent.
4. Create facilities/courts as `PENDING_APPROVAL`; never accept a client-supplied status.
5. Reject any attempt to update moderation status through the update endpoint.

**Files/areas affected**

- `backend/src/validation/owner.ts` `[Proposed — verify during implementation]`
- `backend/src/services/owner/OwnerFacilityService.ts` `[Proposed — verify during implementation]`
- `backend/src/services/owner/OwnerCourtService.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerFacilityController.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerCourtController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerFacilityRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerCourtRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** Adds the four facility/court endpoints per Tech Design §9.1.

**Schema impact:** None beyond CO-01; consumes the status vocabulary.

**Verification**

- Unit: ownership resolution, pending-approval creation, status not client-settable, pagination mapping.
- Integration: only owned facilities/courts are returned; non-owned resources are not leaked; created rows have `PENDING_APPROVAL`.
- API-level: each status/error code; Zod failures; CSRF; role denial; `meta` shape.
- E2E for a critical flow: an Owner creates a facility → reviews it as pending (may use the test identity header until Auth lands).
- Edge/failure/concurrency: update of a non-owned facility is rejected; pagination bounds are enforced.
- Manual: N/A.

**Acceptance criteria**

- **Given** an authenticated `COURT_OWNER`
  **When** they call `GET /api/v1/owner/facilities`
  **Then** only facilities with `owner_id = req.user.id` are returned, paginated with `meta`.

- **Given** a `COURT_OWNER`
  **When** they create a facility or add a court
  **Then** the record is stored as `PENDING_APPROVAL` and no client-supplied status is honored.

- **Given** a facility owned by another Owner
  **When** the caller requests or updates it
  **Then** the request is rejected with `404 OWNER_FACILITY_NOT_FOUND` / `403 OWNER_FORBIDDEN_RESOURCE` without revealing the resource.

- **Given** an authenticated `ADMIN`
  **When** they call any owner facility/court endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE`.

- **Given** an invalid body (missing name, invalid coordinates)
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED` with field details.

---

## [ ] CO-03: Owner court pricing API (per-hour intervals, overlap rejection)

```text
Status: Approved
Size: M
Blocked by: CO-01
```

**Objective:** Implement the per-hour court pricing read/upsert endpoints with overlap rejection and snapshot preservation.

**Scope**

- In scope:
  - `GET /api/v1/owner/courts/:id/pricings` (optional `validOn`) and `POST /api/v1/owner/courts/:id/pricings` (upsert per Tech Design §21 #10).
  - Zod validation: `startTime < endTime`, single-day (no cross-midnight), `validFrom <= validTo` when present, positive `pricePerHour`.
  - Ownership enforcement; `409 PRICING_INTERVAL_OVERLAP` via the CO-01 constraint plus a service pre-check.
  - Edits never touch existing `BOOKINGS` / `BOOKING_PRICING_DETAILS` snapshots.
- Out of scope:
  - Changing an existing booking's price.
  - Cross-midnight pricing.
  - Pricing history/versioning UI.

**Implementation requirements**

1. Validate at the boundary with Zod; apply business rules in the service.
2. Detect overlap using the repository helper and rely on the exclusion constraint as the final guard; map the constraint violation to `409 PRICING_INTERVAL_OVERLAP`.
3. Run the overlap check + write in one transaction.
4. Return `201` on create and `200` on update; keep the response shape stable.

**Files/areas affected**

- `backend/src/validation/owner.ts` `[Proposed — verify during implementation]`
- `backend/src/services/owner/OwnerPricingService.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerPricingController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerPricingRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** Adds the pricing read/upsert endpoints per Tech Design §9.3.

**Schema impact:** None beyond CO-01; consumes the pricing exclusion constraint.

**Verification**

- Unit: interval validation; overlap detection; upsert create-vs-update decision.
- Integration: exclusion constraint rejects an overlapping interval; snapshot rows are untouched by a pricing edit.
- API-level: `201`/`200`; `409 PRICING_INTERVAL_OVERLAP`; `404 OWNER_COURT_NOT_FOUND`; Zod failures.
- E2E for a critical flow: an Owner configures pricing for a court; a later edit does not change an existing booking.
- Edge/failure/concurrency: parallel overlapping inserts produce one row plus one rejection.
- Manual: N/A.

**Acceptance criteria**

- **Given** an owned court with no pricing
  **When** the Owner submits a valid per-hour interval
  **Then** the interval is created and returned (`201`).

- **Given** an owned court with an existing interval
  **When** the Owner submits a new interval overlapping it
  **Then** the request is rejected with `409 PRICING_INTERVAL_OVERLAP` and no row is written.

- **Given** a court owned by another Owner
  **When** the caller reads or writes its pricing
  **Then** the request is rejected with `404 OWNER_COURT_NOT_FOUND` / `403 OWNER_FORBIDDEN_RESOURCE`.

- **Given** an existing booking on a court
  **When** the Owner edits the court's pricing
  **Then** the booking's snapshotted price and pricing details are unchanged.

- **Given** `startTime >= endTime`
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED`.

---

## [ ] CO-04: Owner schedule API and slot block/unblock (with cross-module block awareness)

```text
Status: BLOCKED
Size: L
Blocked by: CO-01, Player Booking availability/creation (BK-04, BK-05)
```

**Objective:** Implement the owner schedule read model and slot block/unblock operations, and integrate blocks into the Player Booking availability and booking-creation paths with the approved advisory-lock mutual exclusion.

**Scope**

- In scope:
  - `GET /api/v1/owner/facilities/:id/schedule?date=YYYY-MM-DD` composing per-court slot states (`FREE`/`BOOKED`/`BLOCKED`) from opening hours, pricing, active bookings, and active blocks; returns the booking Player's contact details for owned facilities.
  - `POST /api/v1/owner/courts/:id/block-slots` (single range + mandatory reason, within `BOOKING_ADVANCE_WINDOW_DAYS`) and `POST /api/v1/owner/courts/:id/unblock-slots`.
  - Block creation acquires the `(court_id, booking_date)` advisory lock and checks overlap against active bookings and active blocks.
  - Cross-module change: Player Booking availability subtracts active blocks; booking creation acquires the same advisory lock and checks blocks.
  - Record the cross-module contract change in `docs/features/booking/player-booking/tech-design.md`.
- Out of scope:
  - Owner court status changes (removed).
  - A dedicated occupancy table or DB triggers (alternatives not selected).
  - Recurring/seasonal blocks.

**Implementation requirements**

1. Reuse the CO-01 repositories and advisory-lock helper; keep locking out of controllers.
2. Compose the schedule as a bounded single-day read; apply the player-booking active-booking predicate (`PENDING_PAYMENT` only while `expires_at > now()`).
3. Enforce ownership and block constraints in the service; map errors per Tech Design §9.7.
4. Expose a narrow contract (extend `CourtService` or add a `CourtAvailabilityPort`) so the Booking module can read active blocks without importing owner internals.
5. Keep transactions short; no external calls.

**Files/areas affected**

- `backend/src/services/owner/OwnerScheduleService.ts` `[Proposed — verify during implementation]`
- `backend/src/services/owner/OwnerSlotBlockService.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerScheduleController.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerSlotBlockController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerScheduleRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerSlotBlockRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/contracts/CourtService.ts` or `backend/src/contracts/CourtAvailabilityPort.ts` `[Proposed — verify during implementation]`
- `backend/src/services/booking/*` (availability + creation block awareness) `[Proposed — verify during implementation]`
- `docs/features/booking/player-booking/tech-design.md`
- `backend/src/app.ts`

**API impact:** Adds the schedule and block/unblock endpoints per Tech Design §9.4–§9.5.

**Schema impact:** None beyond CO-01; consumes `COURT_SLOT_BLOCKS`.

**Verification**

- Unit: schedule composition; block range/advance-window validation; overlap detection; ownership checks.
- Integration: advisory lock serializes booking vs block on the same court/date; block-vs-block exclusion; availability excludes blocked intervals.
- API-level: status/error codes per §9.5; `meta` N/A (bounded day view); role/ownership denials.
- E2E for a critical flow: Owner views the schedule, blocks a free slot, a Player can no longer book it.
- Edge/failure/concurrency: parallel booking + block on the same interval → exactly one succeeds; block overlapping an active booking → `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`.
- Manual: N/A.

**Acceptance criteria**

- **Given** an owned facility and date
  **When** the Owner requests the schedule
  **Then** each court's slots show `FREE`, `BOOKED` (with booking id and player contact), or `BLOCKED` (with reason), consistent with active bookings and blocks.

- **Given** an owned court with an active booking for a slot
  **When** the Owner blocks a range overlapping that booking
  **Then** the request is rejected with `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`.

- **Given** a free slot within the advance window
  **When** the Owner blocks it with a reason
  **Then** an active block is created and Player availability excludes that range.

- **Given** a block outside `BOOKING_ADVANCE_WINDOW_DAYS` or with `endTime <= startTime`
  **When** the request is validated
  **Then** it is rejected with `400 SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW` / `400 SLOT_BLOCK_INVALID_RANGE`.

- **Given** an active block
  **When** the Owner unblocks it
  **Then** it becomes `RELEASED` and the slot is bookable again.

- **Given** a Player booking request and an Owner block request on the same court/date/range issued concurrently
  **When** both run
  **Then** exactly one succeeds and the other is rejected with the appropriate overlap error.

---

## [ ] CO-05: Owner booking cancellation API (transaction + refund + notification)

```text
Status: BLOCKED
Size: L
Blocked by: CO-01, PaymentModule refund (PAY-04)
```

**Objective:** Implement owner-side booking cancellation with a single atomic transaction (status change, refund intent, in-app notification) and reuse the payment lifecycle for idempotent refund execution.

**Scope**

- In scope:
  - `POST /api/v1/owner/bookings/:id/cancel` with a mandatory `reason`.
  - Eligibility: booking on an owned court; `status IN ('PENDING_PAYMENT','CONFIRMED')`; `now < start_time` (Asia/Ho_Chi_Minh); `OWNER_CAN_CANCEL_BOOKING = true`; `OWNER_CANCELLATION_DEADLINE_MINUTES` deadline.
  - One transaction: `SELECT booking FOR UPDATE`, set `CANCELLED`, record the refund intent exactly once for a paid booking, insert the `NOTIFICATIONS` row.
  - Idempotent repeat: already `CANCELLED` → `200`, no second refund.
  - Refund execution is delegated to the payment lifecycle; the API returns `refundStatus` (`NONE`/`PENDING`).
- Out of scope:
  - A dedicated refund portal or settlement module.
  - Inline VNPAY calls inside the transaction.
  - Player-initiated cancellation (owned by Player Booking BK-07).

**Implementation requirements**

1. Acquire ownership through booking → court → facility; use `authenticate` + `requireRole('COURT_OWNER')`.
2. Lock the booking row and re-validate state inside the transaction; map errors per Tech Design §9.7.
3. Reuse the existing `BookingCancelled`-style refund mechanism and `PaymentService`/refund worker; never call the provider inline.
4. Insert the Player notification in the same transaction as the cancellation.
5. Ensure exactly one refund per booking under concurrency (payment-lifecycle idempotency guard, Decision Log §21 #9).

**Files/areas affected**

- `backend/src/validation/owner.ts` `[Proposed — verify during implementation]`
- `backend/src/services/owner/OwnerBookingService.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/owner/OwnerBookingController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/owner/ownerBookingRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/contracts/PaymentService.ts` (reuse) / `backend/src/contracts/NotificationService.ts` (reuse)
- `backend/src/app.ts`

**API impact:** Adds `POST /api/v1/owner/bookings/:id/cancel` per Tech Design §9.6.

**Schema impact:** None beyond CO-01; reuses `BOOKINGS`, `PAYMENTS`, `NOTIFICATIONS`.

**Verification**

- Unit: eligibility (status, deadline, ownership, config); refund-status decision; idempotent repeat.
- Integration: one transaction updates the booking, records one refund intent, and inserts one notification; provider call is outside the transaction.
- API-level: status/error codes per §9.6; Zod failures; CSRF; role/ownership denials.
- E2E for a critical flow: Owner cancels a paid booking → booking `CANCELLED`, refund `PENDING`, Player receives an in-app notification.
- Edge/failure/concurrency: parallel duplicate cancels produce one transition and one refund; refund worker failure leaves the booking `CANCELLED` and sets `REFUND_FAILED`.
- Manual: N/A.

**Acceptance criteria**

- **Given** a `CONFIRMED` booking before `start_time` on an owned court and `OWNER_CAN_CANCEL_BOOKING = true`
  **When** the Owner cancels with a reason
  **Then** the booking becomes `CANCELLED`, exactly one refund is initiated (`refundStatus = PENDING`), and one in-app notification is inserted for the Player.

- **Given** an unpaid `PENDING_PAYMENT` hold on an owned court
  **When** the Owner cancels it
  **Then** it becomes `CANCELLED`, the slot is released, and `refundStatus = NONE`.

- **Given** a booking already `CANCELLED`
  **When** the Owner cancels again
  **Then** the response is idempotent `200` and no second refund is initiated.

- **Given** a booking on a court not owned by the caller, or after the deadline, or with `OWNER_CAN_CANCEL_BOOKING = false`
  **When** the Owner cancels it
  **Then** it is rejected with `403 OWNER_FORBIDDEN_RESOURCE` / `404 OWNER_BOOKING_NOT_FOUND` / `409 OWNER_CANCELLATION_DEADLINE_PASSED` / `409 OWNER_CANCELLATION_DISABLED`.

- **Given** two concurrent cancel requests for the same booking
  **When** both run
  **Then** only one transition and one refund intent occur.

---

## [ ] CO-06: Frontend Owner dashboard and facility/court/pricing management

```text
Status: Approved
Size: L
Blocked by: CO-02, CO-03
```

**Objective:** Build the Court Owner workspace UI for viewing/editing owned facilities and courts, submitting new facilities/courts (pending approval), and configuring per-hour pricing.

**Scope**

- In scope:
  - Owner dashboard over the facility/court list with status (including `PENDING_APPROVAL`/`REJECTED`).
  - Facility detail/edit form; court add/edit within an owned facility.
  - Pricing screen per court: list intervals, create/update per-hour interval, show overlap errors.
  - Feature API client and hooks for facility/court/pricing endpoints; transport separate from presentational components.
  - Loading/empty/error/success/pending-approval states.
- Out of scope:
  - Schedule matrix and slot block UI (CO-07).
  - Owner cancellation modal (CO-08).
  - Admin moderation UI.

**Implementation requirements**

1. Keep feature API clients/hooks out of presentational components; define explicit props.
2. Use the shared table/filter components per conventions; do not fork them.
3. Reflect `PENDING_APPROVAL`/`REJECTED` clearly and prevent editing moderation status.
4. Show the per-hour unit and currency on pricing; surface `PRICING_INTERVAL_OVERLAP` as a field error.
5. Apply loading/empty/error/success states; never show empty while loading.

**Files/areas affected**

- `frontend/src/features/court-owner/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/services/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/hooks/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/types/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/pages/` `[Proposed — verify during implementation]`

**API impact:** Consumes CO-02 and CO-03 endpoints; no new contract.

**Schema impact:** None.

**Verification**

- Unit: pricing form validation (range, overlap message), facility/court form validation, status rendering.
- Integration: API client maps requests/responses and error codes correctly.
- API-level: N/A (client-side).
- E2E for a critical flow: N/A at this task (covered by manual + later schedule task).
- Edge/failure/concurrency: double-submit guarded; overlap error renders without losing input.
- Manual: Create a facility, add a court, configure pricing, see pending-approval and overlap states.

**Acceptance criteria**

- **Given** an authenticated Court Owner with owned facilities
  **When** the dashboard loads
  **Then** facilities/courts are listed with their status, including pending-approval markers.

- **Given** a valid facility/court form
  **When** the Owner submits
  **Then** the client calls the documented endpoint and shows a success/pending state.

- **Given** a pricing interval overlapping an existing one
  **When** the Owner submits
  **Then** the UI shows the `PRICING_INTERVAL_OVERLAP` message and keeps the form editable.

- **Given** the API fails or the Owner is unauthorized
  **When** the screen loads or submits
  **Then** a clear error state is shown and the page remains usable.

---

## [ ] CO-07: Frontend schedule matrix, quick slot block, and booking detail

```text
Status: BLOCKED
Size: L
Blocked by: CO-04
```

**Objective:** Build the Owner schedule view (slot matrix/calendar) with quick slot blocking/unblocking and booking detail inspection.

**Scope**

- In scope:
  - Schedule view for an owned facility and date; per-court slot states `FREE`/`BOOKED`/`BLOCKED`.
  - Quick block/unblock actions with a mandatory reason; show overlap/advance-window errors.
  - Booking detail panel (times, status, player contact for owned facilities).
  - Polling refresh (5–10 s) while the schedule is open.
- Out of scope:
  - Owner cancellation action (CO-08; the detail panel links to it).
  - Non-schedule views.
  - New backend endpoints.

**Implementation requirements**

1. Keep schedule data fetching behind a feature API/hook; separate from presentational components.
2. Use the polling convention (5–10 s) and avoid stale-state flicker; reconcile refresh with local actions.
3. Show locked slots and reasons clearly; keep block/unblock optimistic-with-reconcile or refetch-on-success.
4. Surface backend error codes (`SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`, `SLOT_BLOCK_OVERLAP_BLOCK`, `SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW`, `SLOT_BLOCK_INVALID_RANGE`, `COURT_NOT_ELIGIBLE`).
5. Render loading/empty/error states; never show empty while loading.

**Files/areas affected**

- `frontend/src/features/court-owner/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/hooks/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/pages/` `[Proposed — verify during implementation]`

**API impact:** Consumes CO-04 schedule and block/unblock endpoints.

**Schema impact:** None.

**Verification**

- Unit: slot-state rendering, block form validation, polling hook behavior.
- Integration: schedule loads and refreshes; block/unblock updates the matrix.
- API-level: N/A.
- E2E for a critical flow: Owner opens the schedule, blocks a free slot, the slot shows `BLOCKED`, and the Player-facing availability excludes it.
- Edge/failure/concurrency: block overlapping an active booking shows the correct error; polling does not clobber an in-progress form.
- Manual: Walk a day's schedule for `SINGLES`/multi-court facilities; verify book/block states.

**Acceptance criteria**

- **Given** an owned facility and date
  **When** the schedule opens
  **Then** each court shows slots with `FREE`/`BOOKED`/`BLOCKED` and booking detail is available for booked slots.

- **Given** a free slot
  **When** the Owner blocks it with a reason
  **Then** the slot updates to `BLOCKED` and the reason is shown.

- **Given** a block overlapping an active booking
  **When** the Owner attempts it
  **Then** the UI shows `SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING` and the schedule is unchanged.

- **Given** the schedule is open
  **When** the polling interval elapses
  **Then** the schedule refreshes without losing the Owner's in-progress input.

---

## [ ] CO-08: Frontend owner cancellation modal (reason + refund confirmation)

```text
Status: BLOCKED
Size: M
Blocked by: CO-05
```

**Objective:** Build the Owner cancellation modal with a mandatory reason and an explicit refund/notification confirmation, showing the resulting refund status.

**Scope**

- In scope:
  - Modal triggered from a booked slot/booking detail; mandatory reason; high-friction confirmation stating refund + in-app notification consequences.
  - Submit to `POST /api/v1/owner/bookings/:id/cancel`; show `refundStatus` (`NONE`/`PENDING`).
  - Error surfacing for `OWNER_BOOKING_NOT_CANCELLABLE`, `OWNER_CANCELLATION_DISABLED`, `OWNER_CANCELLATION_DEADLINE_PASSED`, `OWNER_FORBIDDEN_RESOURCE`.
- Out of scope:
  - Player-facing cancellation UI.
  - Refund execution/portal.
  - Editing an existing cancellation.

**Implementation requirements**

1. Require a non-empty reason before enabling submit; disable double-submit.
2. Present an explicit confirmation step describing the refund and the Player notification.
3. On success, refresh the schedule/booking state and show the refund status.
4. Map backend error codes to clear messages without exposing internals.

**Files/areas affected**

- `frontend/src/features/court-owner/` `[Proposed — verify during implementation]`
- `frontend/src/features/court-owner/components/` `[Proposed — verify during implementation]`

**API impact:** Consumes `POST /api/v1/owner/bookings/:id/cancel`.

**Schema impact:** None.

**Verification**

- Unit: reason-required validation, confirmation gating, error-code messaging.
- Integration: modal submits and reflects the returned status.
- API-level: N/A.
- E2E for a critical flow: Owner cancels a paid booking → modal confirms, refund status shown, Player notified.
- Edge/failure/concurrency: double-submit prevented; an ineligible booking shows the correct error.
- Manual: Cancel a paid and an unpaid booking and confirm the different outcomes.

**Acceptance criteria**

- **Given** an eligible booking
  **When** the Owner opens the cancel modal
  **Then** the reason is mandatory and the submit stays disabled until a reason is entered and the refund/notification confirmation is acknowledged.

- **Given** a valid submission
  **When** the Owner confirms
  **Then** the client calls the endpoint, shows `CANCELLED` with `refundStatus`, and the schedule/booking state refreshes.

- **Given** an ineligible booking or a disabled/expired cancellation window
  **When** the Owner attempts it
  **Then** the modal shows the accurate error and does not report success.

- **Given** the Owner double-clicks submit
  **When** the request is in flight
  **Then** only one request is sent.
