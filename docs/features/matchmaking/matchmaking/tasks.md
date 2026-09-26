# Automatic Matchmaking (Ghép trận) — Task List

Implementation tasks for the Automatic Matchmaking feature.

- Feature: Matchmaking (Ghép trận tự động)
- Domain: `features/matchmaking/matchmaking`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions Q1–Q9)
- Status: Mixed — `Approved` for tasks without unresolved dependencies; `BLOCKED` where a dependency (Auth module, Booking module BK-05, Notification module) is not yet implemented. See the Summary table.

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **Environment blockers.** The current `authenticate` middleware still contains a temporary Admin fallback and the Auth module (`docs/features/platform/authentication-authorization/`) is not implemented. The Booking module primitives (`docs/features/booking/player-booking/`, BK-05) and the Notification module are not implemented. Tasks requiring a real `PLAYER` identity, automatic booking holds, or notification persistence are marked `BLOCKED` on those dependencies. Schema, repository, pure-engine, configuration, and atomic Match-creation tasks are not blocked.
>
> **No new decisions.** These tasks must not resolve any `[TBD]`, change business rules, the schema, or the API contract. Feature behavior is governed by `prd.md` and `tech-design.md`; the consolidated schema remains `docs/architecture/database-schema.md`.

## Summary

| ID | Task Title | Status | Dependencies | Estimated Size |
| --- | --- | --- | --- | --- |
| MM-01 | Matchmaking schema migration, indexes, and config seed | Approved | — | M |
| MM-02 | Matchmaking repository and data-access layer | Approved | MM-01 | M |
| MM-03 | Matchmaking configuration reader | Approved | MM-01 | S |
| MM-04 | Compatibility and group-selection engine (pure logic) | Approved | MM-03 | M |
| MM-05 | Atomic Match creation service (transaction + locks) | Approved | MM-02, MM-04 | M |
| MM-06 | Automatic court selection and booking hold integration | BLOCKED | MM-05, Booking module (BK-05) | M |
| MM-07 | Match confirmation, decline, and booking reconciliation | BLOCKED | MM-06 | M |
| MM-08 | Match leave and cancellation service | BLOCKED | MM-06 | M |
| MM-09 | Matchmaking background scheduler (matching, expiry, transitions) | BLOCKED | MM-05, MM-06, MM-07, MM-08 | M |
| MM-10 | Matchmaking in-app notifications | BLOCKED | MM-06, Notification module | S |
| MM-11 | Matchmaking request APIs (create/list/detail/cancel) | BLOCKED | MM-03, Auth module | M |
| MM-12 | Match read APIs (my matches, detail, effective status) | BLOCKED | MM-02, Auth module | S |
| MM-13 | Match confirmation and leave command APIs | BLOCKED | MM-07, MM-08, Auth module | M |
| MM-14 | Frontend request creation and my-requests UI | BLOCKED | MM-11 | M |
| MM-15 | Frontend match detail, confirmation, and leave UI | BLOCKED | MM-12, MM-13 | M |
| MM-16 | Frontend polling and notification integration | BLOCKED | MM-10, MM-14, MM-15 | S |
| MM-17 | End-to-end and concurrency verification | BLOCKED | MM-01 … MM-16 | M |

## Recommended Execution Order

| Phase | Track | Tasks | Waits for |
| --- | --- | --- | --- |
| 1 | Schema & Core Engine | MM-01 | — |
| 2 | Schema & Core Engine | MM-02, MM-03 | MM-01 |
| 3 | Schema & Core Engine | MM-04 | MM-03 |
| 4 | Schema & Core Engine | MM-05 | MM-02, MM-04 |
| 5 | Schema & Core Engine | MM-06, MM-08 | MM-05 / Booking module |
| 6 | Schema & Core Engine | MM-07, MM-10 | MM-06 / Notification module |
| 7 | Schema & Core Engine | MM-09 | MM-05, MM-06, MM-07, MM-08 |
| 8 | API Layer | MM-11, MM-12 | MM-03 / MM-02 / Auth module |
| 9 | API Layer | MM-13 | MM-07, MM-08 / Auth module |
| 10 | Frontend UI | MM-14 | MM-11 |
| 11 | Frontend UI | MM-15 | MM-12, MM-13 |
| 12 | Polling & Integration | MM-16 | MM-10, MM-14, MM-15 |
| 13 | Polling & Integration | MM-17 | MM-01 … MM-16 |

---

## [ ] MM-01: Matchmaking schema migration, indexes, and config seed

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Apply the approved Matchmaking schema deltas (Tech Design §10) and seed the `MATCHMAKING_*` configuration keys, keeping `docs/architecture/database-schema.md` authoritative.

**Scope**

- In scope:
  - Add `MATCHES.court_search_expires_at`, `MATCHES.confirmation_expires_at`, and `MATCHES.cancellation_reason` (nullable).
  - Verify `MATCHES.booking_id` (unique FK → `BOOKINGS.id`) already exists; document-only, no migration for it.
  - Add the partial unique index `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'`.
  - Add indexes: `MATCHMAKING_REQUESTS (status, match_type, preferred_date, created_at)`, `MATCHES (status, scheduled_at)`, `MATCHES (status, court_search_expires_at)`, `MATCHES (status, confirmation_expires_at)`, `MATCH_PLAYERS (player_id, match_id)`, `MATCH_CONFIRMATIONS (match_id, status)`.
  - Seed `MATCHMAKING_ENABLED`, `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`, `MATCHMAKING_CONFIRMATION_REQUIRED`, `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`, `MATCHMAKING_MATCH_DURATION_MINUTES`, `MATCHMAKING_MAX_DISTANCE_KM` idempotently.
- Out of scope:
  - Any repository, service, API, or frontend code.
  - Adding `CHECK` constraints (documentation-only per Tech Design §21 Q6).

**Implementation requirements**

1. Add an ordered migration for the new nullable columns and indexes; no backfill is required.
2. Confirm the partial unique index predicate and that no existing rows violate it.
3. Seed the `MATCHMAKING_*` keys idempotently, matching `docs/business-rules-config-matrix.md` §8.3 defaults.
4. Confirm `docs/architecture/database-schema.md` §3.13/§5.13 already matches the applied delta.

**Files/areas affected**

- `backend/src/db/schema/matchmaking.ts`
- `backend/src/db/migrations/`
- `backend/src/db/seed.ts`
- `docs/architecture/database-schema.md`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema impact:** Adds three `MATCHES` columns and matchmaking indexes; documents `MATCHES.booking_id`; seeds seven `MATCHMAKING_*` keys.

**Verification**

- Unit: N/A
- Integration: Migration applies cleanly on a fresh and a populated database; existing Match/request rows remain valid; seeded keys exist once after repeated runs.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: The partial unique index rejects a second `OPEN` request for the same `(player_id, match_type)` while allowing `SINGLES` and `DOUBLES` simultaneously.
- Manual: Read each seeded config key and confirm the documented default.

**Acceptance criteria**

- **Given** a fresh database
  **When** the migration runs
  **Then** the three `MATCHES` columns and all listed indexes exist and no data is lost.
- **Given** a Player with an `OPEN` `SINGLES` request
  **When** a second `OPEN` `SINGLES` request is inserted
  **Then** the database rejects it, while an `OPEN` `DOUBLES` request succeeds.
- **Given** the seed is executed twice
  **When** the `MATCHMAKING_*` keys are read
  **Then** each key exists exactly once with the documented default.

---

## [ ] MM-02: Matchmaking repository and data-access layer

```text
Status: Approved
Size: M
Blocked by: MM-01
```

**Objective:** Provide the persistence primitives for requests, Matches, players, confirmations, and matchmaking results, keeping SQL and locking out of controllers and services.

**Scope**

- In scope:
  - Request CRUD reads scoped to a player with pagination (`page`, `limit`, optional `status`).
  - Candidate query: `OPEN`, non-expired requests of a match type ordered by `created_at ASC`.
  - Match creation inserts for `MATCHES`, `MATCH_PLAYERS`, `MATCHMAKING_MATCHES`, plus request status updates.
  - `SELECT ... FOR UPDATE SKIP LOCKED` helpers for candidate request claiming and Match row locking.
  - Atomic claim/update helpers for expiry and timeout transitions (expected-source-status predicate, bounded batch).
  - Match reads scoped to a participant, with `status`/`timeScope` filters and pagination.
  - Confirmation read/upsert helpers and a confirmation tally.
- Out of scope:
  - Business policy (compatibility, priority, limits) and HTTP concerns.
  - Court availability and booking writes (owned by Booking module).

**Implementation requirements**

1. Use the existing persistence layer (`backend/src/db`) with parameterized queries and explicit column selection.
2. Allow explicit transaction context so callers can wrap multi-step operations.
3. Return repository-level results; do not throw HTTP errors.
4. Implement effective-status derivation against `expires_at`, `court_search_expires_at`, and `confirmation_expires_at`.

**Files/areas affected**

- `backend/src/repositories/MatchmakingRequestRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/db/schema/matchmaking.ts`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema impact:** Reads/writes `MATCHMAKING_REQUESTS`, `MATCHMAKING_MATCHES`, `MATCHES`, `MATCH_PLAYERS`, `MATCH_CONFIRMATIONS`; no schema change.

**Verification**

- Unit: Pagination and filter composition; effective-status derivation.
- Integration: `FOR UPDATE SKIP LOCKED` lets two concurrent claim transactions each take disjoint request rows.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A claim update only matches rows still in the expected status; a timed-out request is excluded by the candidate query.
- Manual: N/A

**Acceptance criteria**

- **Given** two `OPEN` requests and two concurrent claim transactions
  **When** both claim the same match type
  **Then** each request is claimed at most once and no row is returned twice.
- **Given** an `OPEN` request whose `expires_at` has elapsed
  **When** the candidate query runs
  **Then** the request is not returned.

---

## [ ] MM-03: Matchmaking configuration reader

```text
Status: Approved
Size: S
Blocked by: MM-01
```

**Objective:** Centralize read access to the `MATCHMAKING_*` configuration with documented defaults, so services do not touch `SYSTEM_CONFIGS` directly.

**Scope**

- In scope:
  - Typed accessor for the seven `MATCHMAKING_*` keys with defaults from `docs/business-rules-config-matrix.md` §8.3.
  - Snapshot helper used to compute `expires_at`, `court_search_expires_at`, and `confirmation_expires_at` at entity creation.
  - Feature-disable gate for `MATCHMAKING_ENABLED`.
- Out of scope:
  - Admin configuration management UI or endpoints.
  - Reading booking/payment/notification configuration.

**Implementation requirements**

1. Read through the centralized configuration boundary; do not access environment variables or `SYSTEM_CONFIGS` throughout the codebase.
2. Return documented defaults when a key is absent.
3. Snapshots are computed once at entity creation; never re-read to move an established deadline (Tech Design §7.1, §7.6).

**Files/areas affected**

- `backend/src/services/matchmaking/MatchmakingConfigService.ts` `[Proposed — verify during implementation]`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema impact:** Reads `SYSTEM_CONFIGS`; no schema change.

**Verification**

- Unit: Default fallback per key; snapshot arithmetic in `Asia/Ho_Chi_Minh`.
- Integration: A seeded value overrides the default.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A missing key yields the documented default and does not throw.
- Manual: Set `MATCHMAKING_ENABLED=false` and confirm the gate returns disabled.

**Acceptance criteria**

- **Given** an empty `SYSTEM_CONFIGS` row set
  **When** the reader resolves `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`
  **Then** it returns `10` and does not throw.
- **Given** a configured value
  **When** a deadline snapshot is computed
  **Then** the snapshot equals creation time plus the configured interval.

---

## [ ] MM-04: Compatibility and group-selection engine (pure logic)

```text
Status: Approved
Size: M
Blocked by: MM-03
```

**Objective:** Implement the compatibility rules and deterministic oldest-first group selection as pure, unit-testable logic (Tech Design §7.2, §7.3).

**Scope**

- In scope:
  - Skill-range intersection using `SKILL_LEVELS.rank` (`max(lower) <= min(upper)`).
  - Common time-window intersection over `preferred_date`, requiring `>= MATCHMAKING_MATCH_DURATION_MINUTES`.
  - Haversine distance and pairwise validation against `min(a.max_distance_km, b.max_distance_km, MATCHMAKING_MAX_DISTANCE_KM)`.
  - Group centroid computation.
  - Greedy oldest-first selection of the required group size (2 for `SINGLES`, 4 for `DOUBLES`).
- Out of scope:
  - Database access, transactions, court selection, and HTTP concerns.
  - Any scoring/ranking algorithm (explicitly excluded).

**Implementation requirements**

1. Keep functions pure and testable with fixed fixtures; no I/O.
2. Preserve priority as `created_at ASC`; no score.
3. Represent compatibility and selection results explicitly (selected ids, common window, centroid) for the Match-creation task.

**Files/areas affected**

- `backend/src/modules/matchmaking/engine/compatibility.ts` `[Proposed — verify during implementation]`
- `backend/src/modules/matchmaking/engine/groupSelection.ts` `[Proposed — verify during implementation]`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema impact:** None.

**Verification**

- Unit: Skill overlap boundaries; window intersection shorter than the duration; pairwise distance limits; centroid math; oldest-first selection.
- Integration: N/A
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Incompatible candidate is skipped and the oldest compatible one is selected; fewer than the required count yields no group.
- Manual: N/A

**Acceptance criteria**

- **Given** two `SINGLES` requests with overlapping skill ranges, a 100-minute common window, and points 3 km apart
  **When** compatibility is evaluated
  **Then** they are compatible and the common window starts at the later preferred start.
- **Given** a candidate group whose common window is 80 minutes with a 90-minute duration
  **When** selection runs
  **Then** no Match is formed.
- **Given** more compatible candidates than the required size
  **When** selection runs
  **Then** the oldest by `created_at` are chosen.

---

## [ ] MM-05: Atomic Match creation service (transaction + locks)

```text
Status: Approved
Size: M
Blocked by: MM-02, MM-04
```

**Objective:** Create a Match, its players, and its matchmaking results atomically, guaranteeing one successful result per request (Tech Design §7.2 step C, §13).

**Scope**

- In scope:
  - Claim candidate requests with `FOR UPDATE SKIP LOCKED`, re-verify `OPEN` and compatibility, then commit.
  - Insert `MATCHES` (`status = 'WAITING_FOR_COURT'`, `scheduled_at`, `court_search_expires_at`), `MATCH_PLAYERS` (`status = 'ACTIVE'`, `team_no`), `MATCHMAKING_MATCHES` (`status = 'MATCHED'`), and set requests to `MATCHED`.
  - `team_no` assignment (SINGLES: 1/2; DOUBLES: random 1,1,2,2).
  - Map a partial-unique-index violation to "already matched" without duplication.
- Out of scope:
  - Court selection/booking hold (MM-06) and notifications (MM-10).
  - The scheduler loop that calls this service (MM-09).

**Implementation requirements**

1. Wrap all inserts and request updates in one transaction; roll back the entire Match on any failure.
2. Abort when fewer than the required count of candidate requests are locked or still compatible.
3. After commit, hand off to court search; a court-search failure must not roll back the Match.
4. Rely on the partial unique index `UNIQUE (matchmaking_request_id) WHERE status = 'MATCHED'` as the final guard.

**Files/areas affected**

- `backend/src/services/matchmaking/MatchmakingEngineService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchmakingRequestRepository.ts`, `backend/src/repositories/MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** None (internal service; no public path).

**Schema impact:** Writes `MATCHES`, `MATCH_PLAYERS`, `MATCHMAKING_MATCHES`, and `MATCHMAKING_REQUESTS.status`; no schema change.

**Verification**

- Unit: Team assignment; `scheduled_at`/`court_search_expires_at` derivation.
- Integration: Two concurrent engine runs form at most one Match for the same requests; a partial transaction rolls back fully.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A request consumed by another run causes an abort with no orphan Match; the partial unique index blocks a duplicate `MATCHED` row.
- Manual: N/A

**Acceptance criteria**

- **Given** a compatible `DOUBLES` group of four `OPEN` requests
  **When** the service runs
  **Then** exactly one Match in `WAITING_FOR_COURT` is created, the four requests become `MATCHED`, and four `MATCH_PLAYERS` rows exist.
- **Given** two service runs processing the same requests concurrently
  **When** both commit
  **Then** only one Match exists and no request has two successful matchmaking results.
- **Given** a failure during `MATCH_PLAYERS` insert
  **When** the transaction aborts
  **Then** no Match, result row, or request status change remains.

---

## [ ] MM-06: Automatic court selection and booking hold integration

```text
Status: BLOCKED
Size: M
Blocked by: MM-05, Booking module (BK-05)
```

**Objective:** Select a court near the group centroid, create a booking hold through the Booking module, and move the Match to `WAITING_FOR_CONFIRMATION` (Tech Design §7.4).

**Scope**

- In scope:
  - Centroid-based court candidate ranking: distance ASC → price ASC → `COURTS.id` ASC, restricted to bookable courts and the group's effective radius.
  - `MatchBookingPort.createMatchHold(...)` contract consumed by Matchmaking; the earliest matched request's Player is the booking owner.
  - On hold success: set `court_id`, `booking_id`, `status = 'WAITING_FOR_CONFIRMATION'`, `confirmation_expires_at`, and insert `MATCH_CONFIRMATIONS` (`PENDING`) per player.
  - On contention/recoverable failure: try the next candidate; leave `WAITING_FOR_COURT` if all fail.
- Out of scope:
  - Defining booking availability, pricing, or slot locking (owned by Booking module).
  - Confirmation decisions (MM-07) and notification delivery (MM-10).

**Implementation requirements**

1. Delegate all availability and hold creation to Booking module primitives; never write `BOOKINGS` directly.
2. Use the `MATCHMAKING_MATCH_DURATION_MINUTES` window for the hold interval.
3. Compute `confirmation_expires_at` from the snapshotted configuration at transition time.
4. Wrap the state update and confirmation-row inserts in one transaction.

**Files/areas affected**

- `backend/src/services/matchmaking/courtSelection.service.ts` `[Proposed — verify during implementation]`
- `backend/src/services/matchmaking/MatchBookingPort.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** None (internal); consumes a Booking-module internal contract.

**Schema impact:** Writes `MATCHES.court_id`, `MATCHES.booking_id`, `MATCHES.status`, `MATCHES.confirmation_expires_at`, `MATCH_CONFIRMATIONS`; reads `COURTS`/`FACILITIES` and Booking availability.

**Verification**

- Unit: Candidate ranking and radius filtering; tie-break stability.
- Integration: A contention failure on the first court falls back to the next; successful hold sets `WAITING_FOR_CONFIRMATION` and creates one confirmation per player.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: No bookable court leaves the Match in `WAITING_FOR_COURT` with no booking; a concurrent booking on the same slot is surfaced as a recoverable failure.
- Manual: Inspect the created booking's owner and interval.

**Acceptance criteria**

- **Given** a `WAITING_FOR_COURT` Match and two bookable courts
  **When** court search runs
  **Then** the nearer/cheaper court is selected, a hold is created, and the Match becomes `WAITING_FOR_CONFIRMATION`.
- **Given** the first candidate court returns a slot conflict
  **When** court search continues
  **Then** the next candidate is attempted and, if successful, the Match proceeds to `WAITING_FOR_CONFIRMATION`.
- **Given** no bookable court
  **When** court search runs
  **Then** the Match remains `WAITING_FOR_COURT` with no booking and no confirmation rows.

---

## [ ] MM-07: Match confirmation, decline, and booking reconciliation

```text
Status: BLOCKED
Size: M
Blocked by: MM-06
```

**Objective:** Handle player confirmation/decline and reconcile the Match with the linked booking, applying the `CONFIRMED` and `CANCELLED` outcomes (Tech Design §7.5, §8.2).

**Scope**

- In scope:
  - Record a final confirmation decision per `(match_id, player_id)`; reject missing participant, wrong status, or passed deadline.
  - `CONFIRMED` when all required players `CONFIRMED` **and** the linked booking is `CONFIRMED`.
  - `CANCELLED` on explicit decline, confirmation timeout, or booking failure.
  - Booking reconciliation read (`BOOKINGS.status`) that advances or cancels the Match.
- Out of scope:
  - Payment execution (Booking/Payment modules) and notification delivery (MM-10).
  - The scheduler loop that invokes reconciliation (MM-09).

**Implementation requirements**

1. Lock the Match row and tally confirmations inside one transaction so the Match cannot be confirmed twice.
2. Keep a decision final; repeated same decision is idempotent.
3. Do not transition to `CONFIRMED` while the linked booking is not `CONFIRMED`.
4. On cancellation, request booking release through `MatchBookingPort`.

**Files/areas affected**

- `backend/src/services/matchmaking/MatchConfirmationService.ts` `[Proposed — verify during implementation]`
- `backend/src/services/matchmaking/MatchService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** None (internal); exposed later by MM-13.

**Schema impact:** Writes `MATCH_CONFIRMATIONS`, `MATCHES.status`, `MATCHES.cancellation_reason`; reads `BOOKINGS.status`; no schema change.

**Verification**

- Unit: Confirmation decision matrix (all confirm + paid, declined, timeout, booking not paid).
- Integration: Concurrent confirmations by two players produce exactly one `CONFIRMED` transition; reconciliation is idempotent.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A decline cancels even if others confirmed; a repeated decision does not change state.
- Manual: N/A

**Acceptance criteria**

- **Given** a `WAITING_FOR_CONFIRMATION` Match with a `CONFIRMED` booking
  **When** the last pending player confirms
  **Then** the Match becomes `CONFIRMED`.
- **Given** a `WAITING_FOR_CONFIRMATION` Match
  **When** one player declines
  **Then** the Match becomes `CANCELLED` with reason `CONFIRMATION_DECLINED` and the hold is released.
- **Given** all players confirmed but the booking is not `CONFIRMED`
  **When** reconciliation runs
  **Then** the Match does not become `CONFIRMED`.

---

## [ ] MM-08: Match leave and cancellation service

```text
Status: BLOCKED
Size: M
Blocked by: MM-06
```

**Objective:** Let a participant leave before start, cancelling the Match and releasing the booking hold, and reject leaving after start (Tech Design §7.5, §8.7).

**Scope**

- In scope:
  - Mark the participant `MATCH_PLAYERS.status = 'LEFT'`; since a Match requires exactly its full count, cancel the Match with reason `INSUFFICIENT_PLAYERS`.
  - Release the booking hold through `MatchBookingPort`.
  - Reject leave when the Match has started or is `IN_PROGRESS`/`COMPLETED`.
  - Idempotent leave on an already-cancelled Match.
- Out of scope:
  - Automatic substitution or backfill (Out of MVP).
  - Notification delivery (MM-10).

**Implementation requirements**

1. Lock the Match row; validate participant, status, and `now < scheduled_at` in `Asia/Ho_Chi_Minh`.
2. Mark `LEFT`, set `CANCELLED` with reason, and release the hold in one transaction.
3. Do not create replacement Matches or requests.

**Files/areas affected**

- `backend/src/services/matchmaking/MatchService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** None (internal); exposed later by MM-13.

**Schema impact:** Writes `MATCH_PLAYERS.status`, `MATCHES.status`, `MATCHES.cancellation_reason`; no schema change.

**Verification**

- Unit: Leave eligibility by status/time.
- Integration: Leave releases the hold exactly once; concurrent leave/confirm does not double-release.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A Player leaving at/after `scheduled_at` is rejected; repeated leave is idempotent.
- Manual: N/A

**Acceptance criteria**

- **Given** a Match before `scheduled_at`
  **When** a participant leaves
  **Then** the participant is `LEFT`, the Match is `CANCELLED` with reason `INSUFFICIENT_PLAYERS`, and the hold is released.
- **Given** a Match at/after `scheduled_at`
  **When** a participant attempts to leave
  **Then** the operation is rejected and the Match is unchanged.

---

## [ ] MM-09: Matchmaking background scheduler (matching, expiry, transitions)

```text
Status: BLOCKED
Size: M
Blocked by: MM-05, MM-06, MM-07, MM-08
```

**Objective:** Drive the matching engine, deadline enforcement, booking reconciliation, and time-based Match transitions from one independently verifiable in-process scheduler (Tech Design §7.6).

**Scope**

- In scope:
  - 60-second in-process `setInterval` tick with a startup catch-up sweep.
  - Expire `OPEN` requests past `expires_at`.
  - Run the matching engine (MM-04/MM-05) and retry court search for `WAITING_FOR_COURT` matches (MM-06).
  - Cancel via `court_search_expires_at` and `confirmation_expires_at` deadlines.
  - Reconcile linked booking status (MM-07).
  - Advance `CONFIRMED → IN_PROGRESS` and `IN_PROGRESS → COMPLETED`.
  - Atomic claim/bounded batch per category (`FOR UPDATE SKIP LOCKED`).
- Out of scope:
  - Notification copy/delivery (MM-10) and new infrastructure (no queue).

**Implementation requirements**

1. Each category is claimed with an atomic conditional update matching only the expected source status; transitions are idempotent and safe to overlap.
2. Use fixed `Asia/Ho_Chi_Minh` comparisons and snapshotted deadlines; never extend or shorten an established deadline.
3. Bound each category per tick to keep tick duration bounded; continue any remainder next tick.
4. Log per-transition failures and retry on the next tick.

**Files/areas affected**

- `backend/src/jobs/matchmakingScheduler.ts` `[Proposed — verify during implementation]`
- `backend/src/services/matchmaking/MatchmakingEngineService.ts`, `MatchService.ts`
- `backend/src/repositories/MatchmakingRequestRepository.ts`, `MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema impact:** Updates Matchmaking status/deadline columns; no schema change.

**Verification**

- Unit: Timeout boundary evaluations per category.
- Integration: Two overlapping ticks cannot process the same row; each category advances only due rows.
- API-level: N/A
- E2E for a critical flow: Requests expire, a group is matched, timeouts cancel, and time transitions occur without manual action.
- Edge/failure/concurrency: A tick failure does not affect other rows and is retried; `SKIP LOCKED` prevents blocking between ticks.
- Manual: Observe state changes after advancing fixtures past the deadlines.

**Acceptance criteria**

- **Given** an `OPEN` request past `expires_at`
  **When** the scheduler ticks
  **Then** the request becomes `EXPIRED` exactly once.
- **Given** a `WAITING_FOR_COURT` Match past `court_search_expires_at`
  **When** the scheduler ticks
  **Then** the Match becomes `CANCELLED` with reason `COURT_SEARCH_TIMEOUT`.
- **Given** a `CONFIRMED` Match whose `scheduled_at` has passed
  **When** the scheduler ticks
  **Then** the Match becomes `IN_PROGRESS`, and later `COMPLETED` after the configured duration.

---

## [ ] MM-10: Matchmaking in-app notifications

```text
Status: BLOCKED
Size: S
Blocked by: MM-06, Notification module
```

**Objective:** Persist in-app notifications for the Matchmaking events defined in the PRD and Tech Design §15.

**Scope**

- In scope:
  - Persist `NOTIFICATIONS` rows for: match found, confirmation required, confirmation success, Match cancelled (with reason), and request expired.
  - Scope recipients to the request owner or Match participants.
- Out of scope:
  - Push/email delivery; separate confirmation reminders; new notification endpoints.

**Implementation requirements**

1. Write notifications within (or immediately after) the transaction that changes state where practical; idempotent transitions must not duplicate notifications.
2. Reuse the platform notification boundary and unread-notifications read contract.
3. Do not corrupt the primary state transition on notification failure; record failures for observability.

**Files/areas affected**

- `backend/src/services/matchmaking/` `[Proposed — verify during implementation]`
- `backend/src/modules/notifications/` (platform module) `[Proposed — verify during implementation]`
- `[Proposed — verify during implementation]`

**API impact:** Consumes the platform `GET /api/v1/notifications/unread`; adds no new path.

**Schema impact:** Uses `NOTIFICATIONS`; no schema change.

**Verification**

- Unit: Notification creation per event type and recipient set.
- Integration: Each Matchmaking event persists the expected notification; a retried idempotent transition does not duplicate one.
- API-level: Unread notifications include Matchmaking notifications.
- E2E for a critical flow: A matched Player sees the confirmation-required notification.
- Edge/failure/concurrency: N/A
- Manual: Client polling surfaces the notification.

**Acceptance criteria**

- **Given** a Match entering `WAITING_FOR_CONFIRMATION`
  **When** notifications are persisted
  **Then** every matched Player receives a confirmation-required notification.
- **Given** a Match cancelled with reason `CONFIRMATION_TIMEOUT`
  **When** the cancellation commits
  **Then** every participant receives a cancellation notification carrying that reason.

---

## [ ] MM-11: Matchmaking request APIs (create/list/detail/cancel)

```text
Status: BLOCKED
Size: M
Blocked by: MM-03, Auth module
```

**Objective:** Expose the Player-facing Matchmaking Request endpoints with validation, ownership scoping, and pagination (Tech Design §9.1–§9.4).

**Scope**

- In scope:
  - `POST /api/v1/matchmaking-requests` with body validation, `expires_at` snapshot, feature gate, and one-`OPEN`-per-match-type rule.
  - `GET /api/v1/matchmaking-requests` (caller-scoped, paginated, optional `status`).
  - `GET /api/v1/matchmaking-requests/:id` (owner-only).
  - `POST /api/v1/matchmaking-requests/:id/cancel` (owner-only, `OPEN` only, idempotent).
  - Feature error codes from Tech Design §9.9.
- Out of scope:
  - Match endpoints (MM-12/MM-13) and any Admin/Owner views.

**Implementation requirements**

1. Require `authenticate` + `requireRole('PLAYER')`; scope every request to the authenticated player.
2. Use Zod at the request boundary; return `{ data }` and pagination `meta`.
3. Compute `expires_at` from the snapshotted `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`.
4. Return `404` for a request not owned by the caller.

**Files/areas affected**

- `backend/src/modules/matchmaking/routes/` `[Proposed — verify during implementation]`
- `backend/src/modules/matchmaking/controllers/` `[Proposed — verify during implementation]`
- `backend/src/services/matchmaking/MatchmakingRequestService.ts` `[Proposed — verify during implementation]`
- `backend/src/validation/matchmaking.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** `POST/GET /api/v1/matchmaking-requests`, `GET /api/v1/matchmaking-requests/:id`, `POST /api/v1/matchmaking-requests/:id/cancel`.

**Schema/config impact:** Writes `MATCHMAKING_REQUESTS`; reads `MATCHMAKING_*` configuration; no schema change.

**Verification**

- Unit: Zod schemas (window length, skill range, distance, date); ownership and cancellable-state rules.
- Integration: The one-`OPEN`-per-match-type rule is enforced; cancel releases the request from matching.
- API-level: `201`/`200`; `400`, `401`, `403`, `404`, `409` per error table; pagination `meta`.
- E2E for a critical flow: A Player creates a request and it appears `OPEN` in their list.
- Edge/failure/concurrency: Concurrent create requests for the same match type result in one `OPEN` request; repeated cancel is idempotent.
- Manual: N/A

**Acceptance criteria**

- **Given** a signed-in Player with no open `SINGLES` request
  **When** they create a valid `SINGLES` request
  **Then** `201` returns an `OPEN` request with a snapshotted `expiresAt`.
- **Given** an existing `OPEN` `SINGLES` request
  **When** the Player creates another `SINGLES` request
  **Then** the API returns `409 MATCHMAKING_ACTIVE_REQUEST_LIMIT`.
- **Given** another Player's request id
  **When** the caller requests or cancels it
  **Then** the API returns `404 MATCHMAKING_REQUEST_NOT_FOUND`.

---

## [ ] MM-12: Match read APIs (my matches, detail, effective status)

```text
Status: BLOCKED
Size: S
Blocked by: MM-02, Auth module
```

**Objective:** Let a Player list their Matches and view a Match detail with participant and confirmation information (Tech Design §9.5–§9.6).

**Scope**

- In scope:
  - `GET /api/v1/matches` caller-scoped with `status`/`timeScope` filters and pagination.
  - `GET /api/v1/matches/:id` participant-only, with court/facility summary, players with `teamNo`, and the caller's own confirmation status.
  - Booking id exposure only to the booking owner.
  - Effective-status computation against deadlines and `scheduled_at`.
- Out of scope:
  - Creating Matches, confirmation/leave actions, and tournament Match views.

**Implementation requirements**

1. Require `authenticate` + `requireRole('PLAYER')`; derive scope from `MATCH_PLAYERS`.
2. Return `404 MATCH_NOT_FOUND` for a non-participant or missing id.
3. Do not expose other players' private data beyond the approved profile fields.

**Files/areas affected**

- `backend/src/modules/matchmaking/controllers/` `[Proposed — verify during implementation]`
- `backend/src/repositories/MatchRepository.ts`
- `[Proposed — verify during implementation]`

**API impact:** `GET /api/v1/matches`, `GET /api/v1/matches/:id`.

**Schema/config impact:** Reads `MATCHES`, `MATCH_PLAYERS`, `MATCH_CONFIRMATIONS`, `COURTS`, `FACILITIES`; no schema change.

**Verification**

- Unit: Effective-status derivation and `timeScope` classification.
- Integration: A Player sees only Matches they participate in.
- API-level: `200` with `meta`; `401`; `403`; `404 MATCH_NOT_FOUND`.
- E2E for a critical flow: A matched Player sees the Match detail with the selected court.
- Edge/failure/concurrency: A `WAITING_FOR_COURT` Match shows no court; the booking id is absent for non-owners.
- Manual: N/A

**Acceptance criteria**

- **Given** a Player in one upcoming Match and one past Match
  **When** they request `timeScope=UPCOMING`
  **Then** only the upcoming Match is returned with correct pagination `meta`.
- **Given** a non-participant
  **When** they request a Match detail
  **Then** the API returns `404 MATCH_NOT_FOUND`.

---

## [ ] MM-13: Match confirmation and leave command APIs

```text
Status: BLOCKED
Size: M
Blocked by: MM-07, MM-08, Auth module
```

**Objective:** Expose participant confirmation/decline and pre-match leave commands (Tech Design §9.7–§9.8).

**Scope**

- In scope:
  - `PUT /api/v1/matches/:id/confirmation` with `{ decision: 'CONFIRMED' | 'DECLINED' }`, participant-only, deadline-bounded, idempotent for the same decision.
  - `POST /api/v1/matches/:id/leave`, participant-only, before start, idempotent.
  - Feature error codes from Tech Design §9.9.
- Out of scope:
  - Admin/Owner actions and automatic replacement after leave.

**Implementation requirements**

1. Require `authenticate` + `requireRole('PLAYER')`; participant-only; return `404 MATCH_NOT_FOUND` for non-participants.
2. Reject out-of-state and past-deadline actions with the documented `409` codes.
3. Do not weaken authorization or expose other participants' decisions beyond the contract.

**Files/areas affected**

- `backend/src/modules/matchmaking/routes/` `[Proposed — verify during implementation]`
- `backend/src/modules/matchmaking/controllers/` `[Proposed — verify during implementation]`
- `backend/src/services/matchmaking/MatchConfirmationService.ts`, `MatchService.ts`
- `backend/src/validation/matchmaking.ts` `[Proposed — verify during implementation]`

**API impact:** `PUT /api/v1/matches/:id/confirmation`, `POST /api/v1/matches/:id/leave`.

**Schema/config impact:** Writes `MATCH_CONFIRMATIONS`, `MATCHES.status`, `MATCH_PLAYERS.status`; no schema change.

**Verification**

- Unit: Request-schema validation; status/deadline/participant rules.
- Integration: Confirming the last required player transitions the Match per MM-07; leaving cancels per MM-08.
- API-level: `200`; `400 VALIDATION_FAILED`; `401`; `403`; `404`; `409` per error table.
- E2E for a critical flow: All players confirm and the Match becomes `CONFIRMED`; a leave before start cancels it.
- Edge/failure/concurrency: Concurrent player confirmations are handled atomically; repeated same decision is idempotent; a conflicting decision is rejected.
- Manual: N/A

**Acceptance criteria**

- **Given** a participant in a `WAITING_FOR_CONFIRMATION` Match before the deadline
  **When** they submit `CONFIRMED`
  **Then** their confirmation is recorded and, once all confirm and the booking is confirmed, the Match becomes `CONFIRMED`.
- **Given** a Match not in `WAITING_FOR_CONFIRMATION`
  **When** a participant submits a confirmation
  **Then** the API returns `409 MATCH_NOT_CONFIRMABLE`.
- **Given** a Match after it has started
  **When** a participant calls leave
  **Then** the API returns `409 MATCH_ALREADY_STARTED`.

---

## [ ] MM-14: Frontend request creation and my-requests UI

```text
Status: BLOCKED
Size: M
Blocked by: MM-11
```

**Objective:** Let a Player create a Matchmaking Request and track their requests from the web client.

**Scope**

- In scope:
  - Request form: match type, preferred date/time window, skill range, location, maximum distance.
  - My-requests list with status, required/remaining player count, and a cancel action for `OPEN` requests.
  - Loading, empty, success, error, cancelled, and expired states.
- Out of scope:
  - Match detail/confirmation (MM-15), polling setup (MM-16), and any server-side rule.
  - New state-management or networking dependencies.

**Implementation requirements**

1. Keep API transport in a feature service; keep components presentational where possible.
2. Compose the shared table/filter components; do not fork them.
3. Surface server conflicts (active-request limit, validation) with recoverable messages.
4. Do not duplicate business rules in the client; the client only reflects server state.

**Files/areas affected**

- `frontend/src/pages/matchmaking/` `[Proposed — verify during implementation]`
- `frontend/src/components/matchmaking/` `[Proposed — verify during implementation]`
- `frontend/src/services/matchmakingService.ts` `[Proposed — verify during implementation]`
- `frontend/src/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes `POST/GET /api/v1/matchmaking-requests` and `POST /api/v1/matchmaking-requests/:id/cancel`.

**Schema/config impact:** None.

**Verification**

- Unit: Form validation and status rendering.
- Integration: Create → list → cancel.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Creating a duplicate open match type shows the limit error; cancelling updates the list.
- Manual: Confirm loading/empty states and the request window fields.

**Acceptance criteria**

- **Given** a Player on the Matchmaking page
  **When** they submit a valid request
  **Then** the request appears as `OPEN` in their list with its expiration deadline.
- **Given** an `OPEN` request
  **When** the Player cancels it
  **Then** the list shows `CANCELLED` and the cancel action is no longer offered.

---

## [ ] MM-15: Frontend match detail, confirmation, and leave UI

```text
Status: BLOCKED
Size: M
Blocked by: MM-12, MM-13
```

**Objective:** Let a matched Player view Match details, confirm or decline participation, and leave before start.

**Scope**

- In scope:
  - Match list and detail view: match type, status, playing time, court/facility, players and teams, and the caller's confirmation status.
  - Confirmation deadline/countdown and confirm/decline actions while `WAITING_FOR_CONFIRMATION`.
  - Leave action before start with a clear consequence message.
  - States: loading, waiting-for-court, waiting-for-confirmation, confirmed, cancelled (with reason), completed.
- Out of scope:
  - Payment for the booking (owned by Booking/Payment UI) and any admin/owner view.

**Implementation requirements**

1. Keep API transport in the feature service; render all status variants explicitly.
2. Show the degradation reason for a cancelled Match (`court-search timeout`, `confirmation timeout`, `declined`, `booking failed`, `insufficient players`).
3. Do not infer authorization from hidden controls; rely on server responses.

**Files/areas affected**

- `frontend/src/pages/matchmaking/` `[Proposed — verify during implementation]`
- `frontend/src/components/matchmaking/` `[Proposed — verify during implementation]`
- `frontend/src/services/matchmakingService.ts` `[Proposed — verify during implementation]`

**API impact:** Consumes `GET /api/v1/matches`, `GET /api/v1/matches/:id`, `PUT /api/v1/matches/:id/confirmation`, `POST /api/v1/matches/:id/leave`.

**Schema/config impact:** None.

**Verification**

- Unit: Status-specific rendering and action gating.
- Integration: Detail → confirm/decline → status update; leave → cancelled.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: A deadline passing while the view is open surfaces the cancelled state; a failed action shows a recoverable error.
- Manual: Verify each Match status renders correctly.

**Acceptance criteria**

- **Given** a Player in a `WAITING_FOR_CONFIRMATION` Match
  **When** they confirm
  **Then** the UI reflects their confirmation and the deadline state.
- **Given** a Match before start
  **When** the Player leaves
  **Then** the UI shows the Match as `CANCELLED` with the reason.
- **Given** a Match that started
  **When** the Player views it
  **Then** the leave action is not offered.

---

## [ ] MM-16: Frontend polling and notification integration

```text
Status: BLOCKED
Size: S
Blocked by: MM-10, MM-14, MM-15
```

**Objective:** Keep request and Match status current through HTTP polling and surface in-app notifications.

**Scope**

- In scope:
  - Poll request and Match status every 5–10 seconds while a relevant view is open (confirmed HTTP polling).
  - Refresh on focus/return and stop polling when no relevant view is open.
  - Surface unread Matchmaking notifications through the platform notification view.
- Out of scope:
  - New realtime transport (SSE/WebSocket) and push/email.

**Implementation requirements**

1. Treat polling responses as authoritative; never advance state client-side.
2. Cancel/clean up polling intervals on unmount to avoid duplicate requests.
3. Reuse the platform notification polling contract; do not create a new endpoint.

**Files/areas affected**

- `frontend/src/hooks/` `[Proposed — verify during implementation]`
- `frontend/src/pages/matchmaking/` `[Proposed — verify during implementation]`
- `frontend/src/services/` `[Proposed — verify during implementation]`

**API impact:** Reuses `GET /api/v1/matchmaking-requests`, `GET /api/v1/matches`, and `GET /api/v1/notifications/unread`.

**Schema/config impact:** None.

**Verification**

- Unit: Polling lifecycle (start/stop/cleanup) and status reconciliation.
- Integration: A server-side status change appears within one polling cycle.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Overlapping requests are avoided; a transient poll error keeps the last known state without crashing.
- Manual: Confirm the interval stops when navigating away.

**Acceptance criteria**

- **Given** a Player viewing a `WAITING_FOR_COURT` Match
  **When** the Match becomes `WAITING_FOR_CONFIRMATION` on the server
  **Then** the view reflects it within one polling cycle without a manual refresh.
- **Given** a Matchmaking notification is created
  **When** the client polls unread notifications
  **Then** the notification is surfaced to the Player.

---

## [ ] MM-17: End-to-end and concurrency verification

```text
Status: BLOCKED
Size: M
Blocked by: MM-01 … MM-16
```

**Objective:** Verify the critical Matchmaking flows and the concurrency/idempotency guarantees of the feature.

**Scope**

- In scope:
  - E2E: create request → matched → court found → all confirm + booking paid → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`.
  - E2E: cancel an `OPEN` request; court-search timeout cancellation; confirmation-timeout cancellation; leave before start.
  - Concurrency: two engine runs matching the same requests; concurrent confirmations; leave racing confirmation; booking hold expiring during confirmation.
- Out of scope:
  - New product behavior; only verification of approved behavior.

**Implementation requirements**

1. Use the approved test tools (Vitest + Supertest; Playwright for the main flow) against the separate test database.
2. Seed explicit fixtures for players, skill levels, courts, pricing, and requests.
3. Assert on observable state and API contracts, not internal implementation.
4. Do not weaken validation or authorization to make a test pass.

**Files/areas affected**

- `backend/src/__tests__/` `[Proposed — verify during implementation]`
- `frontend/` E2E harness `[Proposed — verify during implementation]`

**API impact:** Exercises all Matchmaking endpoints; no new path.

**Schema/config impact:** None.

**Verification**

- Unit: N/A (covered by earlier tasks)
- Integration: All critical flows against the test database, including scheduler transitions.
- API-level: Contract and status-code assertions for success and failure paths.
- E2E for a critical flow: Request → match → confirm/pay → confirmed → completed; cancel and timeout paths.
- Edge/failure/concurrency: Exactly one Match per request under contention; no Match confirmed without all confirmations and a confirmed booking; no double release of a booking.
- Manual: N/A

**Acceptance criteria**

- **Given** a fresh test database with seeded players and courts
  **When** the full matchmaking E2E runs
  **Then** exactly one Match is created per successful group, requests become `MATCHED`, and the Match reaches `COMPLETED`.
- **Given** two engine runs processing the same compatible requests
  **When** both run
  **Then** only one Match exists and no request has two successful matchmaking results.
- **Given** a Match in `WAITING_FOR_CONFIRMATION`
  **When** a participant declines or the deadline passes
  **Then** the Match is `CANCELLED` and the booking hold is released exactly once.

---

## Completion Checklist (per task, when implemented)

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `[TBD]` or business rule was silently resolved.
- [ ] No unrelated files or refactors were included.
