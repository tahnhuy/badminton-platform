# Court Owner Self-Service (Quản lý cơ sở sân, bảng giá và giám sát slot) — Task List

> **Progress 2026-11-17 (plan 06):** CO-05 Owner cancellation API and the CO-08 modal base are implemented (ownership, tournament/start/deadline guards, one refund intent + one notification, idempotent repeat, Match cancellation job). CO-08 remains UI-REDO until the frontend merge. See `docs/plans/06_booking-chu-san-matchmaking.md` §8.
> **Progress 2026-11-23 (CO-09):** Owner notification inbox DONE — producers, `OWNER_*` resolvers, header bell and `/owner/notifications` pages. See [plan 19](../../plans/19_thong-bao-chu-san.md).

Implementation tasks for the Court Owner Self-Service feature.

- Feature: Court Owner Self-Service
- Domain: `features/court-owner`
- Approved Figma alignment: [frontend-figma-review.md](frontend-figma-review.md), F01–F24 all A, human owner 2026-10-23; PRD §8.2/§14.2 and Tech Design §9.8.
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, initial §21 #1–#10 plus §21.1–§21.2 review revisions)
- Business rules: `docs/business-rules-config-matrix.md` §2, §8.1, §8.2
- Schema authority: `docs/architecture/database-schema.md` §2.2, §3.4–§3.10, §3.24, §3.32–§3.33

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. The approved 2026-10-23 review revision is specified in PRD §14.1 and Tech Design §7–§10; implement those contracts rather than choosing new ones. Scope is bounded by `prd.md` and `tech-design.md`.
>
> **Environment note (Auth dependency).** The Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware` and enforces `requireRole`; the `[TEMP AUTH BYPASS]` no longer applies in development/production. Owner endpoints require a real signed-in `COURT_OWNER` identity. In `NODE_ENV=test`, API tests may still supply an active `COURT_OWNER` identity via the test-only `X-User-Id` header.
>
> **Cross-module note.** CO-04 depends on the Player Booking availability/creation change (block awareness and the `(court_id, booking_date)` advisory lock). CO-05 depends on the PaymentModule refund execution. BK-04/BK-05 are DONE in their owning task list; their maintenance-block integration remains CO-04 work. CO-04 waits on CO-01, not on unimplemented base Booking APIs. CO-05 remains blocked on durable Payment refund orchestration (PAY-04) and transaction-aware deduplicated notification persistence (NTF-01/NTF-02); no refund or notification capability is declared complete by this update. NTF-03/NTF-04 are required to accept Player-facing delivery/read visibility end-to-end, not to start unrelated Owner forms.
>
> **Schema/documentation note.** The facility/court status vocabulary (`PENDING_APPROVAL`, `REJECTED`) and its CHECK are already recorded in `database-schema.md` §3.5/§3.6/§5.15. CO-01 must still land its migrations (the next free identifier from the actual migration journal at implementation time) together with the approved `COURT_SLOT_BLOCKS`/review-history/pricing schema changes. The cross-module contract change is already specified in `docs/features/booking/player-booking/tech-design.md` §7.2.1; CO-04 implements it. Coordinate migration identifiers with Notifications and Payment before generating migrations.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| CO-01 | Schema migration/repository layer for facility, court, pricing, and blocked slots | DONE | — | L |
| CO-02 | Owner facility and court management API (with ownership + approval states) | DONE | CO-01 | M |
| CO-03 | Owner court pricing API (per-hour intervals, overlap rejection) | DONE | CO-01 | M |
| CO-04 | Owner schedule/history API and slot block/unblock (with cross-module block awareness) | DONE | CO-01; integrates completed BK-04/BK-05 | L |
| CO-05 | Owner booking cancellation API (transaction + refund + notification) | BLOCKED | CO-01, PAY-04 durable refund boundary, NTF-01/NTF-02 | L |
| CO-06 | Frontend Owner dashboard and facility/court/pricing management | DONE | CO-02, CO-03 | L |
| CO-07 | Frontend schedule matrix, quick slot block, and booking detail | DONE | CO-04 | L |
| CO-08 | Frontend owner cancellation modal (reason + refund confirmation) | BLOCKED | CO-05 | M |
| CO-09 | Owner notification inbox (bell, list/detail, producers, deep links) | DONE | NTF-01…NTF-05, CO-04/CO-07 | M |

## Execution plan — repository audit 2026-10-23

Scope: implement the already-approved PRD/Tech Design plus all F01–F24 A decisions. This plan is a code-based work breakdown, not a new product decision or a claim that dependencies are done. Task status remains in this file; external tasks keep their owning task lists. Implementation progress and verification are recorded below; the baseline audit describes the repository before this work.

### Execution progress — 2026-10-23

CO-01 foundation, Owner management/pricing/schedule APIs, Owner workspace, Admin review integration and optional private Player contact are implemented. Verification passed; CO-01/CO-02/CO-03/CO-04/CO-06/CO-07 are DONE. CO-05/CO-08 remain BLOCKED as instructed.

Approved decisions applied: optional ward remains NULL; PP-07 collects/edits an optional private Player phone (choice B); schedule UNAVAILABLE includes PAST, OUTSIDE_BOOKING_WINDOW and BOOKING_DISABLED (choice A), while BOOKED/BLOCKED retain priority.

**User instruction on cross-module blockers:** skip blocked work and continue independent tasks. CO-05 and CO-08 remain BLOCKED on PAY-04 durable refunds and NTF-01/NTF-02 transaction-aware notification persistence. The proposed PAYMENTS metadata expansion is deferred, not approved or implemented. Cancellation endpoint/modal is not shipped.

Migrations apply only to isolated test databases during verification. Development/production databases are untouched. Shared schema/docs require teammate PR review before merge. No commit, push or deployment performed.

### Actual baseline

| Area | Repository evidence | Consequence for implementation |
| --- | --- | --- |
| Owner frontend/API | `/owner` in `frontend/src/app/router.tsx` renders OwnerHomePage from placeholder-pages; no Owner feature folder or owner routes/services found | Build Owner workspace and backend capability; keep current real session/role guards |
| Shared UI | Existing http-client, RequireAuth, DataTable, FilterToolbar, formatting/modal helpers | Reuse them; no new UI library or copy of shared table/filter |
| Facility/court/pricing | All three Drizzle definitions are in `backend/src/db/schema/facilities.ts` | Extend this actual schema location; a separate courts.ts is not an existing prerequisite |
| Migrations | Journal currently ends at `0008_ratings_two_dimensions`; no maintenance/review tables or status CHECK migration found | Re-read journal at execution; next free ID is currently 0009, never reserve it blindly or reuse 0006 |
| Booking | Availability, hold/pricing snapshot, confirmation, cancellation and worker exist; persistBooking currently starts by locking the court | Add shared facility→court-date coordination and block awareness; preserve existing player limit/row-lock behavior and use consistent lock order across paths |
| Admin review | Existing facility/court moderation and onboarding; Owner approval/reject routes not found | CM-05 is required for usable Owner onboarding/address proposal lifecycle |
| Config | booking-config.ts exposes Player/Booking settings, not Owner cancellation or maintenance settings | Add typed OWNER_CAN_CANCEL_BOOKING, OWNER_CANCELLATION_DEADLINE_MINUTES and MAINTENANCE_ADVANCE_WINDOW_DAYS reads/defaults/registry/seed under approved configuration architecture; no Owner config editor |
| Refund | refundBookingPayment directly changes a successful payment to REFUNDED without provider orchestration; Booking cancellation emits a best-effort event; no durable refund worker is present | Direct status updates, Mock success or event emission do not establish real refund completion; replace/reuse through PAY-04 persisted intent/read/worker boundary |
| Notifications | notifications table and interface exist; transaction-aware persistence/dedup implementation not found | Coordinate NTF-01/NTF-02; Owner cancellation must insert one notification atomically, not rely on the in-memory Booking event bus |
| Tournament | Schema and bracket utilities exist; scheduling/registration service is incomplete | Verify system-booking linkage using schema-backed fixtures; integrate shared Booking primitive and test the real scheduling path when it lands; no production stub or Owner override |

These are source-code/task audits, not fresh runtime, database or test-run results.

### Delivery stages and ordering

| Stage | Work | Deliverable / exit criteria | Dependency |
| --- | --- | --- | --- |
| 0 — Verify contracts and data | Review approved documents against actual migrations, seed/pricing data, Payment/Notification boundaries; record schema/API discrepancies in owning Tech Design before affected code. Prepare two Owners, Admin and Players in isolated test fixtures | Migration plan has no conflicting IDs; no silent cleanup of overlapping prices; transactional Payment/Notification responsibilities are explicit | Existing approved Owner scope; shared-doc/schema PR review before merge |
| 1 — Persistence and permissions | CO-01: schema/status CHECKs, maintenance blocks, review attempts, cancellation metadata, price exclusion, typed Owner/maintenance config, ownership repositories and shared lock helpers | Fresh/populated migration verification, 404 isolation primitives, constraint and concurrency tests pass; no data loss | Stage 0; coordinate NTF-01/Payment migrations |
| 2 — Operational setup | CO-02 + CO-03; CM-05 Admin review; CO-06 workspace/forms/account | Real Owner session creates facility/court→Admin review→reject/resubmit/approve; address proposal retains live address; one-court pricing and end validity work; no excluded Figma controls | CO-01; CM-05 for the complete onboarding loop |
| 3 — Calendar and availability | CO-04 + CO-07; extend Player Booking reads/creation and system creation primitive; history/detail/refund read mapping | Owner blocks a range→Player cannot book; whole-block release; booking-vs-lock and hours-vs-creation races are safe; single-day calendar/history with scoped contact/Tournament states | CO-01; base BK-04/BK-05 already exist; Payment read state can be wired without claiming refund execution done |
| 4 — Incident cancellation | NTF-01/02 and PAY-04 persisted intent/worker integration, then CO-05 + CO-08 | Unpaid cancel has no refund; paid cancel atomically persists CANCELLED+reason/time+one refund intent+one notification; retries/crash recovery preserve correctness; UI shows actual pending/success/failure | Transaction-aware NTF persistence; durable Payment boundary; paid sandbox verification has its own provider prerequisites |
| 5 — Acceptance and release readiness | Focused regression/E2E, content review against F01–F24, migration review and deployment handoff | All applicable release gates below pass; no production capability inferred from Mock/fixtures | Prior stages; NTF-03/04 for Player notification UI; live VNPAY smoke requirements for production payment claims |

Stages 2 and 3 are independently deliverable after Stage 1; frontend preparation may proceed against approved contracts but is not end-to-end accepted until its API exists. Payment/Notification work can proceed alongside setup/calendar work without making their unrelated capabilities prerequisites. This is sequencing flexibility, not an instruction to launch sub-agents.

### Practical implementation slices within existing task IDs

| Task | Small implementation slices | Verification that closes the slice |
| --- | --- | --- |
| CO-01 | 1a schema/config migration; 1b owned reads/review/block repositories; 1c locking/constraints | Apply on fresh and representative populated test DB; inspect constraints; overlapping/touching intervals, pending review uniqueness, required rejection reason and config fallback tests |
| CO-02 | 2a list/detail/create and ownership; 2b court/facility edits and hours conflict; 2c review reads/address proposal/resubmit | API auth/CSRF/cross-owner tests; immutable pending attempt; rejected resubmits same ID; hours-creation race |
| CO-03 | 3a list/create; 3b explicit pricingId update/end validity | Unknown ID never inserts; date/time overlap rejected; both confirmed and unpaid booking snapshots unchanged |
| CO-04 | 4a shared occupancy/lock integration; 4b single-day schedule; 4c scoped history/detail | Booking and block cannot overlap under concurrency; expired holds released; full contact scoped; Tournament linkage; history contains terminal records; refund state reflects persisted Payment state |
| CO-05 | 5a eligibility/row locking; 5b atomic Payment/Notification orchestration; 5c retries/failure/reconciliation | No second refund/notification; rollback on persistence failure; confirm-vs-cancel race; late payment never reopens booking; no external provider call inside transaction |
| CO-06 | 6a Owner shell/session/multi-facility state and O08; 6b onboarding/edit/reviews; 6c one-court pricing | Sign in as real COURT_OWNER; create/review/resubmit flow; address/hours feedback; existing shared components; no stale cross-facility data |
| CO-07 | 7a day grid and unavailable causes; 7b block/release; 7c history/detail/polling | Owner block is reflected on Player availability; form state survives polling; selection switch clears old detail; empty/loading/retry and suspended-resource history |
| CO-08 | 8a confirmation/eligibility copy; 8b unpaid/paid result; 8c refund refresh and separate block follow-up | Mandatory reason/acknowledgement; unpaid NONE; CANCELLED+PENDING never displayed as refunded; disabled/started/Tournament states; failed block does not undo cancellation |

Do not add a second parallel task list or mark all slices DONE when only UI mocks exist. Keep status/dependencies at the parent CO task and annotate partial progress there.

### External work and stop conditions

- **CM-05** (`admin/court-management/tasks.md`): approval/rejection, mandatory reason, address review and retained history. Depends on CO-01 review schema. Do not auto-approve test/demo submissions to bypass this dependency in production.
- **NTF-01/02** (`platform/notifications/tasks.md`): reference/dedup migration and transaction-aware insert. Needed by both paid and unpaid Owner cancellation because both must notify. NTF-03/04 are required for Player to list/read the committed notification in application acceptance.
- **PAY-04** (`platform/payments-refunds/tasks.md`): persisted refund intent and read state, idempotent worker/recovery. `completion-plan.md` still records unresolved Payment persistence/provider contract choices; those must be resolved in Payment's owning design before affected code, not guessed in Owner. Owner eligibility/UI preparation and the unpaid slice may be developed independently once NTF persistence is ready, but CO-05 is not DONE without paid flow.
- **VNPAY sandbox**: merchant configuration, refund permission, a valid paid transaction and reachable configured callbacks are prerequisites for live verification. Do not inspect or print secrets during planning. Mock/offline tests can validate orchestration; they do not establish sandbox/production readiness. Do not block unrelated facility/pricing/calendar work on credentials.
- **Tournament**: integration through shared Booking creation; fixtures verify Owner restrictions now. If real scheduling is still absent at handoff, record that path as unverified rather than declaring full cross-feature acceptance.
- **Existing schema/API mismatches**: reconcile field nullability (for example optional ward in Owner create versus NOT NULL in current Drizzle) with the approved contract in the owning design before writing affected migration/validation. Do not silently add unapproved defaults or change business requirements.

### Verification and release gates

Use existing Vitest/Supertest and Playwright on the isolated test database; test-only fixtures remain in the test harness. No new test framework, broad unrelated refactor or production auth bypass.

1. **Isolation and access:** real Owner session/CSRF; wrong role 403; missing/non-owned resource identical 404; two Owners cannot read/update/contact-reveal/unblock each other's data. Switching facilities cannot show stale data.
2. **Review lifecycle:** pending is not bookable; same-ID rejected resubmit retains history/reason; approved location remains live until proposal approval; address approval does not reactivate suspended facility. Full loop uses CM-05.
3. **Pricing:** per-hour amounts across contiguous intervals; create/update/end validity; concurrent overlap rejects; existing paid and unpaid snapshots unchanged. No price means unavailable.
4. **Occupancy:** effective holds/CONFIRMED/IN_PROGRESS/system reservations and ACTIVE blocks; boundaries and business timezone; today+90 maintenance vs Player window; whole-block release; parallel booking/block and hours/booking writes preserve invariants.
5. **Cancellation:** eligibility/deadline/config/Tournament rules; exactly one persisted refund intent and one notification; notification failure rolls back; provider failure leaves booking CANCELLED with actual refund state; confirm/cancel and late callbacks cannot reopen or duplicate settlement.
6. **UI/content:** F01–F24 A checklist; only approved fields/actions; one day-calendar/history; read-only account; no instant refund promise, excluded widget or sample support identity. Loading/empty/error/retry and suspended/pending views are explicit.
7. **Payment/delivery acceptance:** Player can read the committed cancellation notification via actual Notification capability. Mock evidence and live VNPAY evidence are reported separately; outstanding Tournament path/provider dependencies remain explicit.
8. **Handoff:** focused tests and builds pass, `git diff --check` passes, owning docs/task statuses reflect verified results and shared schema/docs have teammate PR review before merge. No auto-commit/push/deploy.

Suggested verification commands during implementation (run only once relevant code/fixtures exist):

```bash
npm run test --prefix backend -- src/__tests__/owner-management.test.ts src/__tests__/owner-pricing.test.ts src/__tests__/owner-schedule.test.ts src/__tests__/owner-cancellation.test.ts
npm run test --prefix backend -- src/__tests__/booking-availability.test.ts src/__tests__/booking-write.test.ts src/__tests__/booking-confirm-match-facility.test.ts src/__tests__/payment-integration.test.ts
npm run test:e2e --prefix frontend -- e2e/court-owner-flow.spec.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
git diff --check
```

Owner test filenames above are planned, not existing test results. Add review/Notification suites in their owning modules, and run broader checks only for new failures or affected cross-module behavior. Do not use root `npm test` (it is currently a placeholder).

---

## [x] CO-01: Schema migration/repository layer for facility, court, pricing, and blocked slots

```text
Status: DONE
Size: L
Blocked by: N/A
```

**Objective:** Apply the approved schema delta (Tech Design §10) and provide the persistence primitives for owner-scoped facilities, courts, per-hour pricing, and slot blocks, keeping SQL, locking, and constraints inside the repository layer.

**Scope**

- In scope:
  - Extend the `FACILITIES` / `COURTS` `status` vocabularies with `PENDING_APPROVAL` and `REJECTED` (drizzle definitions + documentation).
  - Add the `COURT_SLOT_BLOCKS` table: columns, `CHECK (end_time > start_time)`, generated `block_range` (Asia/Ho_Chi_Minh), index `(court_id, booking_date)`, and the partial `EXCLUDE` constraint for active blocks.
  - Add the pricing overlap constraint on `COURT_PRICINGS`.
  - Add approved COURT_OWNER_REVIEWS and booking cancellation metadata; implement Owner cancellation/maintenance typed config and seeds as specified in the review additions below.
  - A migration using the next free identifier for all of the above; update `docs/architecture/database-schema.md` §3.5–§3.7 and add the new table section in the same session.
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
- `backend/src/db/schema/facilities.ts` also owns existing courts and courtPricings definitions; do not split it solely to match an old proposed path.
- `backend/src/db/schema/courtSlotBlocks.ts` `[Proposed — verify during implementation]`
- `backend/src/db/schema/index.ts`
- `backend/src/db/migrations/<next_free_id>_*.sql`
- `backend/src/db/migrations/meta/`
- `backend/src/repositories/owner/OwnerFacilityRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/OwnerCourtRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/OwnerPricingRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/owner/CourtSlotBlockRepository.ts` `[Proposed — verify during implementation]`
- `docs/architecture/database-schema.md`

**API impact:** None.

**Schema impact:** Adds `COURT_SLOT_BLOCKS`, `COURT_OWNER_REVIEWS`, booking cancellation reason/time, pricing exclusion and facility/court status CHECKs; verify actual journal first. Config adds the approved maintenance seed and typed Owner cancellation reads. Consolidated schema §3.5–§3.7 updated with the migration.

**Verification**

- Unit: N/A.
- Integration: Migration applies cleanly on a fresh and a populated database; overlapping active blocks on the same court are rejected; touching intervals are accepted; the pricing exclusion rejects overlapping intervals; existing booking/pricing rows remain valid.
- API-level: N/A.
- E2E for a critical flow: N/A.
- Edge/failure/concurrency: `CHECK (end_time > start_time)` rejects an invalid block; concurrent identical block inserts produce one active block; `RELEASED` blocks do not participate in the exclusion.
- Manual: Read back the applied table, constraints, index, and the updated status-vocabulary documentation.

**Acceptance criteria**

- **Given** a fresh database
  **When** the new migration runs
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

## [x] CO-02: Owner facility and court management API (with ownership + approval states)

```text
Status: DONE
Size: M
Blocked by: CO-01
```

**Objective:** Implement owner-scoped facility and court management endpoints with Zod validation and ownership enforcement, creating submissions in `PENDING_APPROVAL`.

**Scope**

- In scope:
  - `GET /api/v1/owner/facilities` (paginated, optional `status`), `POST /api/v1/owner/facilities`, `PUT /api/v1/owner/facilities/:id`, `POST /api/v1/owner/facilities/:id/courts`.
  - Zod schemas for all params/query/body; `authenticate` + `requireRole('COURT_OWNER')`; service-layer ownership (`owner_id = req.user.id`).
  - Facility/court creation stored as `PENDING_APPROVAL`; resubmit from `REJECTED` is an explicit transition. Direct metadata edits never change moderation status. Pending submissions are immutable; post-approval location changes use a separate review proposal.
  - Error mapping per Tech Design §9.7 (`OWNER_FACILITY_NOT_FOUND`, `OWNER_COURT_NOT_FOUND`, `VALIDATION_FAILED`).
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

**API impact:** Implements all facility/court detail/edit/resubmit/address-proposal/review-history contracts in Tech Design §9.1.

**Schema impact:** None beyond CO-01; consumes the status vocabulary.

**Verification**

- Unit: ownership resolution, pending-approval creation, status not client-settable, pagination mapping.
- Integration: only owned facilities/courts are returned; non-owned resources are not leaked; created rows have `PENDING_APPROVAL`.
- API-level: each status/error code; Zod failures; CSRF; role denial; `meta` shape.
- E2E for a critical flow: real Owner session creates a facility → sees pending → Admin rejects with reason → Owner edits/resubmits the same resource.
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
  **Then** the request is rejected with `404 OWNER_FACILITY_NOT_FOUND` without revealing the resource.

- **Given** an authenticated `ADMIN`
  **When** they call any owner facility/court endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE`.

- **Given** an invalid body (missing name, invalid coordinates)
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED` with field details.

---

## [x] CO-03: Owner court pricing API (per-hour intervals, overlap rejection)

```text
Status: DONE
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
  **Then** the request is rejected with `404 OWNER_COURT_NOT_FOUND`.

- **Given** an existing booking on a court
  **When** the Owner edits the court's pricing
  **Then** the booking's snapshotted price and pricing details are unchanged.

- **Given** `startTime >= endTime`
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED`.

---

## [x] CO-04: Owner schedule API and slot block/unblock (with cross-module block awareness)

```text
Status: DONE
Size: L
Blocked by: CO-01 (base BK-04/BK-05 are DONE; block integration remains in this task)
```

**Objective:** Implement the owner schedule read model and slot block/unblock operations, and integrate blocks into the Player Booking availability and booking-creation paths with the approved advisory-lock mutual exclusion.

**Scope**

- In scope:
  - `GET /api/v1/owner/facilities/:id/schedule?date=YYYY-MM-DD` composing per-court slot states (`FREE`/`BOOKED`/`BLOCKED`/`UNAVAILABLE`) from opening hours, pricing, active bookings, and active blocks; returns the booking Player's contact details for owned facilities.
  - `POST /api/v1/owner/courts/:id/block-slots` (single range + mandatory reason, within the independent maintenance horizon, default 90 days) and `POST /api/v1/owner/courts/:id/unblock-slots`.
  - Block creation acquires the `(court_id, booking_date)` advisory lock and checks overlap against active bookings and active blocks.
  - Cross-module change: Player Booking availability subtracts active blocks; booking creation acquires the same advisory lock and checks blocks.
  - Record the cross-module contract change in `docs/features/booking/player-booking/tech-design.md`.
- Out of scope:
  - Owner court status changes (removed).
  - A dedicated occupancy table or DB triggers (alternatives not selected).
  - Partial or bulk unlocking; only `{ blockId }` for one complete block is accepted.
  - Recurring/seasonal blocks.

**Implementation requirements**

1. Reuse CO-01 repositories and locking helpers; keep locking out of controllers. Booking creation takes the facility row lock before the court-date lock, shared with hours edits; block creation takes the court-date lock and rechecks occupancy.
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
  **Then** each court’s slots show FREE, BOOKED (Player contact or Tournament context), BLOCKED (reason), or UNAVAILABLE (causes), consistent with occupancy, pricing, hours and parent eligibility.

- **Given** an owned court with an active booking for a slot
  **When** the Owner blocks a range overlapping that booking
  **Then** the request is rejected with `409 SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING`.

- **Given** a free slot within the advance window
  **When** the Owner blocks it with a reason
  **Then** an active block is created and Player availability excludes that range.

- **Given** a block outside `MAINTENANCE_ADVANCE_WINDOW_DAYS` (default 90) or with `endTime <= startTime`
  **When** the request is validated
  **Then** it is rejected with `400 SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW` / `400 SLOT_BLOCK_INVALID_RANGE`.

- **Given** an active block
  **When** the Owner unblocks it
  **Then** it becomes `RELEASED`; the interval is bookable only if all other availability gates pass.

- **Given** a Player booking request and an Owner block request on the same court/date/range issued concurrently
  **When** both run
  **Then** exactly one succeeds and the other is rejected with the appropriate overlap error.

---

## [ ] CO-05: Owner booking cancellation API (transaction + refund + notification)

```text
Status: BLOCKED
Size: L
Blocked by: CO-01, PAY-04 durable refund boundary, NTF-01/NTF-02
```

**Objective:** Implement owner-side booking cancellation with a single atomic transaction (status change, refund intent, in-app notification) and reuse the payment lifecycle for idempotent refund execution.

**Scope**

- In scope:
  - `POST /api/v1/owner/bookings/:id/cancel` with a mandatory `reason`; persist cancellation metadata.
  - Reject tournament system reservations; keep pre-start-only eligibility with support guidance after start. Idempotent repeats return current Payment-owned refund status.
  - Eligibility: booking on an owned court; `status IN ('PENDING_PAYMENT','CONFIRMED')`; `now < start_time` (Asia/Ho_Chi_Minh); `OWNER_CAN_CANCEL_BOOKING = true`; `OWNER_CANCELLATION_DEADLINE_MINUTES` deadline.
  - One transaction: `SELECT booking FOR UPDATE`, set `CANCELLED`, record the refund intent exactly once for a paid booking, insert the `NOTIFICATIONS` row.
  - Idempotent repeat: already `CANCELLED` → `200`, no second refund.
  - Refund execution is delegated to the payment lifecycle; the API returns `refundStatus` (`NONE`/`PENDING`/`REFUNDED`/`FAILED`).
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
  **Then** it is rejected with `404 OWNER_BOOKING_NOT_FOUND` / `409 OWNER_CANCELLATION_DEADLINE_PASSED` / `409 OWNER_CANCELLATION_DISABLED`.

- **Given** two concurrent cancel requests for the same booking
  **When** both run
  **Then** only one transition and one refund intent occur.

---

## [x] CO-06: Frontend Owner dashboard and facility/court/pricing management

```text
Status: DONE
Size: L
Blocked by: CO-02, CO-03
```

**Objective:** Build the Court Owner workspace UI for viewing/editing owned facilities and courts, submitting new facilities/courts (pending approval), and configuring per-hour pricing.

**Scope**

- In scope:
  - Owner dashboard over the facility/court list with status (including `PENDING_APPROVAL`/`REJECTED`).
  - Facility detail/edit form; court add/edit within an owned facility.
  - Pricing screen per court: list intervals, explicit pricingId updates, end validity, show overlap errors.
  - Facility/court rejection reasons and resubmit; separate pending address proposal with approved live address retained; opening-hours conflict feedback.
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

## [x] CO-07: Frontend schedule matrix, quick slot block, and booking detail

```text
Status: DONE
Size: L
Blocked by: CO-04
```

**Objective:** Build the Owner schedule view (slot matrix/calendar) with quick slot blocking/unblocking and booking detail inspection.

**Scope**

- In scope:
  - Schedule view for an owned facility and date; per-court slot states `FREE`/`BOOKED`/`BLOCKED`/`UNAVAILABLE`.
  - Quick block/unblock actions with a mandatory reason; show overlap/advance-window errors.
  - O05/O15 are one calendar workspace; O06 is a detail panel with scoped contact or tournament context. Include paginated history (all states) and current refund status; keep ineligible actions disabled with a reason.
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
- Manual: Walk a day’s schedule for single-court and multi-court facilities; verify occupancy and unavailable causes.

**Acceptance criteria**

- **Given** an owned facility and date
  **When** the schedule opens
  **Then** each court shows slots with `FREE`/`BOOKED`/`BLOCKED`/`UNAVAILABLE` and booking detail is available for booked slots.

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
  - O07 cancellation modal from O06; O16 result panel within the same workspace. Mandatory reason and explicit confirmation state refund + in-app notification consequences.
  - No cancellation for tournament bookings or after start; show Organizer/support guidance respectively.
  - Submit to `POST /api/v1/owner/bookings/:id/cancel`; show `refundStatus` (`NONE`/`PENDING`/`REFUNDED`/`FAILED`).
  - Error surfacing for `OWNER_BOOKING_NOT_CANCELLABLE`, `OWNER_CANCELLATION_DISABLED`, `OWNER_CANCELLATION_DEADLINE_PASSED`.
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

## 2026-10-23 approved review — task acceptance additions

These are part of existing tasks, not newly completed implementation. Shared schema/document edits await teammate PR review before merge.

| Task | Additional scope and verification |
| --- | --- |
| CO-01 | Implement consolidated schema §3.32–§3.33 and cancellation metadata; seed `MAINTENANCE_ADVANCE_WINDOW_DAYS=90`; add positive typed config read. Verify one pending review per resource/kind, mandatory rejection reason, interval exclusion, booking snapshots preserved and safe fresh/populated migration using actual next identifier. |
| CO-02 | Implement §9.1 detail/court edit/resubmit/address proposal/review reads. Test retained approved address on pending/rejected proposal, rejection history across resubmissions, immutable pending submissions, no status/transfer edits, 404 isolation, and opening-hours vs booking-creation concurrency. Coordinate Admin CM-05 review decisions. |
| CO-03 | Upsert with optional pricingId; unknown/non-owned ID returns 404 without insertion. Test changing start/end on the same ID, excluding self in overlap check, ending validity and unchanged existing booking snapshots. |
| CO-04 | Add §9.6.1 history/detail and Payment refund mapping through its read boundary; no provider fields. Test all history statuses, ownership, tournament context, UNAVAILABLE causes and occupied visibility after pricing/status changes. Share facility→court-date lock order with all booking creation paths. Test expired hold vs lock, booking vs lock, and block release by one ID (repeat succeeds; partial/bulk rejected). Validate maintenance today through today+90 independently of 7-day Player booking window. |
| CO-05 | Test tournament cancellation rejection, start-time boundary, current refund state on repeat, persisted reason/time and exactly one refund/notification. Existing cancelled booking remains readable even when facility is suspended. |
| CO-06 | Show review history/reason, resubmit, approved/proposed location, hour-conflict error; pricing explicit edit/end validity. No status toggle or delete. |
| CO-07 | One O05/O15 calendar with O06 panel/history; test missing pricing vs FREE, tournament context, full-block release, current refund states and preservation of form input during polling. |
| CO-08 | O07/O16 modal/result; test no action on tournament/started booking, correct unpaid/paid copy, current refund state and detail/history refresh. |

Acceptance examples: a rejected resource resubmits under the same ID with previous rejection retained; a location proposal leaves the approved address live until Admin approval; an hours change racing with a new booking cannot make an effective booking fall outside opening hours; ending pricing makes new unpriced intervals unavailable but retains booked intervals; no Owner endpoint distinguishes another Owner’s resource from an absent ID.

## Figma alignment — F01–F24 all A approved 2026-10-23

These requirements extend the existing frontend tasks, not their completion status. No Figma canvas or application implementation is claimed complete. Governing behavior is PRD §8.2/§14.2 and Tech Design §9.8; original Figma capabilities outside this scope must not ship.

| Task | Approved additional work | Meaningful verification |
| --- | --- | --- |
| CO-06 | Minimal O01; scoped facility selector and first-facility flow; O02/O09/O10/O03/O11/O12 review/edit states; single-court O04/O13/O14 pricing; read-only O08 from existing AuthUser and links to supported Auth actions. O17 follows existing Auth/resource errors. Remove technical/legal/media/map, drafts, shared pricing/surcharge/version engine, analytics/AI, wallet/payout, eKYC/MFA/role-switch and certification UI. | Verify create→pending→reject→resubmit same ID, approved/proposed address split, opening-hour conflict, explicit pricingId update/end validity, overlap/no-price feedback; account uses only fields from auth/me and no unsupported profile mutation. Missing facility/court/pricing, loading/error/retry and non-owned 404 behave correctly. Check no excluded controls/claims remain. |
| CO-07 | One single-day O05/O15 calendar; O06 detail, all-status paginated history and current refund state; mandatory-reason single-range block and whole-block release. Preserve occupancy vs eligibility distinction. Remove week/month/export, Owner-created/offline/recurring/multi-court booking, QR/check-in, chat, PDF, IoT and live score. | Verify switching facilities clears stale court/detail/cache scope; polling does not overwrite same-scope input. Test FREE vs missing price/closed/inactive, existing occupied visibility, unexpired/expired holds, tournament context/no Owner cancel, full scoped contact/reveal, no contact logging. Booking default 7 vs maintenance default 90 uses effective policy rather than UI constants. |
| CO-08 | O07/O16 confirmation/result panels with real payment/refund state, unpaid no-refund, separate maintenance action, deadline/disabled/started/tournament states. In-app notification copy only; remove instant-receipt promises, bank sample data, SMS/push/voucher/escrow and automatic suspension claims. | Verify CANCELLED+PENDING does not show refunded; successful/failed refund reads show their actual state, unpaid NONE has no refund claim, repeated action stays idempotent and no duplicate notification/refund. Started/tournament actions are unavailable with correct guidance. A failed post-cancellation block leaves the cancellation successful and displays the block error. No fabricated support number/email/SLA when no confirmed contact exists. |

All F01–F24 decisions map to CO-06–CO-08 and existing API tasks; no new backend capability is inferred. Test representative critical flows using existing conventions, plus a focused UI/content check for excluded CTA/claims. Keep current task dependencies (including Payment PAY-04) and verify actual API support before marking a task DONE.

2026-10-23 contact gate RESOLVED: human owner selected B. PP-07 adds optional private PLAYER_PROFILES.phone, registration collection and self-contact editing; Owner schedule/detail reads the actual stored value within owned bookings. No fabricated phone/public disclosure. Continue CO-04 after PP-07 data/API slice; prior gate paragraphs are historical observations, not an unresolved decision.

## Verified completion — 2026-10-23

- [x] CO-01: migrations/config/constraints/ownership repositories; fresh and populated isolated migration coverage.
- [x] CO-02: facility/court submission, edit, resubmit, review history, separate address proposal and safe hours changes.
- [x] CO-03: explicit pricing ID edit/end validity, overlap rejection, unchanged existing booking snapshots.
- [x] CO-04: scoped day schedule/history/detail, actual refund-state reads, maintenance block/release, Player availability and shared booking locking.
- [x] CO-06: real-session Owner workspace/account, multiple facilities, management/pricing and Admin review integration.
- [x] CO-07: calendar/detail/history, maintenance actions, scoped contact, preserved polling input, mobile and loading/retry states.
- [ ] CO-05/CO-08: BLOCKED on PAY-04 and NTF-01/NTF-02; skipped per user instruction. No cancellation endpoint/modal, refund intent/worker or notification orchestration implemented.

Validation: focused backend regression **79/79** across owner-foundation, owner-management, owner-pricing, owner-schedule, player-contact, booking-availability, booking-write and booking-confirm-match-facility. Earlier Auth + optional-contact regression **23/23**. Browser E2E **2/2** covers Owner submission→Admin reject→same-ID resubmit→approval, court approval, pricing snapshot preservation, private Player phone registration/edit/clear, maintenance→Player availability→release, polling input, facility switching, mobile 390px and initial network failure/retry. Both production builds pass; frontend lint exits 0 with existing unrelated warnings. Production build retains the existing bundle-size warning. `git diff --check` passes.

Tournament context uses schema-backed fixtures; the future real Tournament scheduling writer is not claimed verified. Real provider refunds/Player notification delivery remain outside this completed scope. No development/production migrations, commit, push or deployment performed. Shared schema/docs await teammate review before merge.

### Uncommitted-change review against main — 2026-10-23

Compared the working tree with local `main` (`16efe9b`, also the branch HEAD) and the governing Owner, Admin review, Booking and optional Player contact documents. Fixed four implementation defects without changing the approved contracts:

- Compare opening/closing times numerically so a partial `HH:mm` update cannot equal the stored `HH:mm:ss` closing time.
- Revalidate facility/court existence after acquiring the pricing facility lock; reject a resource deleted between the initial ownership read and lock acquisition.
- Acquire the facility lock before the court-date lock for maintenance creation and recheck eligibility afterwards, matching the approved lock order.
- Reject null, boolean and empty coordinates before numeric coercion; retain support for numeric strings in persisted review snapshots.

Added five regression cases covering these defects. Verification: full backend suite **310/310** across **25 files**, then final Owner management/pricing/schedule regression **24/24**; Chrome Owner E2E **2/2**. Backend/frontend builds pass, frontend lint exits 0 with existing warnings, and `git diff --check` passes. CO-05/CO-08 remain BLOCKED; no development/production migrations, commit, push or deployment performed.

## [x] CO-09: Owner notification inbox — DONE (2026-11-23)

Owner receives in-app notifications for confirmed bookings, Player cancellations,
payout status, earning credits/reversals and facility/court review decisions.
`/owner` now wraps `NotificationsProvider`; `/owner/notifications` and
`/owner/notifications/:id` reuse the shared notification pages; the header bell
uses `NotificationsMenu`. Booking deep links open the matching facility/date and
drawer; court links open the matching editor. Catalog, dedup and resolver rules:
[plan 19](../../plans/19_thong-bao-chu-san.md).

**Evidence:** `owner-notifications.test.ts` 10/10 PASS; backend targeted booking/
matchmaking/payout/earning suites PASS; backend/frontend builds PASS; owner
Playwright specs PASS (owner-notifications 5/5, owner shell/schedule/facilities
40/40). Frontend lint remains blocked only by the pre-existing `OwnerWalletPage`
radius warning, unrelated to CO-09.

## [x] CO-10: Owner contact phone (O08) — DONE (2026-11-27)
Human-approved in chat on 2026-11-27 (PRD §14.3). `GET/PATCH /api/v1/owner/profile`
(`OwnerProfileRepository/Service`, `ownerProfileBody` validation); account page shows
the business name (read-only) and a phone form that saves immediately with no Admin
review or OTP.
**Evidence:** `owner-profile.test.ts` 4/4 PASS on `badminton_test`; backend `tsc` PASS;
frontend lint/check:ui PASS; Owner Playwright specs with mocked API PASS (incl. two new
account-phone tests); dev account page read-only check at 1280/390 PASS. The PATCH write
path was not exercised against the dev database.
