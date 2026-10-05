# Tournament Management — Task List

Implementation tasks for the Tournament Management feature.

- Linked PRD: [prd.md](./prd.md)
- Linked Tech Design: [tech-design.md](./tech-design.md)
- Task status values
  - `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
  - `BLOCKED`: cannot start; the blocker is named.
- Definition of Done: the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete.

> Backend tasks marked `BLOCKED` depend on the Auth module (`docs/features/platform/authentication-authorization/`). Do not start them before Auth lands, because the current `authenticate` middleware still contains a temporary Admin fallback (`backend/src/middleware/auth.middleware.ts`). Implement only once identity and contextual authorization are reliable.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| TRN-01 | Database migrations for tournament schema and config | IN_PROGRESS | — | M |
| TRN-02 | Tournament core CRUD and lifecycle API | BLOCKED | TRN-01, Auth | L |
| TRN-03 | Team and Invitation module | BLOCKED | TRN-02, Auth | L |
| TRN-04 | Registration and withdrawal API | BLOCKED | TRN-03, Auth | L |
| TRN-05 | VNPAY payment integration for registrations | BLOCKED | TRN-04, PAY-02/PAY-03 | L |
| TRN-06 | Single-elimination bracket generation with Organizer seed order and draw | IN_PROGRESS | TRN-01 | L |
| TRN-12 | Bracket seed selection API and Organizer draw UI | BLOCKED | TRN-06, TRN-02, Auth | M |
| TRN-07 | Match scheduling (system court booking), start, and game scoring | BLOCKED | TRN-06, Auth, Booking system-booking primitive | M |
| TRN-08 | Match resolution and winner advancement | BLOCKED | TRN-07 | M |
| TRN-09 | Cron pollers and refund processing | BLOCKED | TRN-05, TRN-08 | L |
| TRN-10 | Tournament notifications and client polling | BLOCKED | TRN-02, Auth | M |
| TRN-11 | Frontend tournament portal and bracket view | BLOCKED | TRN-02…TRN-08 | L |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | TRN-01, TRN-06 (algorithm only) | — |
| 2 | TRN-02 | TRN-01, Auth |
| 3 | TRN-03, TRN-04 | TRN-02 |
| 4 | TRN-05, TRN-07 | TRN-04 / TRN-06 |
| 5 | TRN-08, TRN-10 | TRN-07 / TRN-02 |
| 6 | TRN-09, TRN-11 | TRN-05, TRN-08 |

---

## [ ] TRN-01: Database migrations for tournament schema and config

```text
Status: IN_PROGRESS
Size: M
Blocked by: N/A
```

**Progress:** Migration `0002_public_ronan.sql` generated and applied
manually against the local database; the new CHECK constraints and the
seeded config key were verified. The repository's custom runner only
applies forward migrations (no DOWN convention), so the "DOWN" part of
the verification below is not applicable to this repository and remains
open until the team confirms an approach.

**Objective:** Apply the resolved tournament schema deltas and the new configuration key through ordered migrations, and reconcile `database-schema.md`.

**Scope**

- In scope:
  - `PAYMENTS.booking_id` nullable + `PAYMENTS.registration_id` FK + exactly-one CHECK + index.
  - `TOURNAMENTS.entry_fee` (`NOT NULL DEFAULT 0`, `CHECK >= 0`), `facility_id` FK nullable, `venue_note` nullable.
  - `TOURNAMENT_REGISTRATIONS.expires_at` and status values.
  - `MATCHES.court_id` nullable.
  - Seed `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES = 10`.
- Out of scope:
  - Any API or service code.

**Implementation requirements**

1. Add a migration for the `PAYMENTS` delta; preserve existing booking payment rows.
2. Add a migration for the tournament fields and `expires_at`.
3. Alter `MATCHES.court_id` to nullable.
4. Seed the new `SYSTEM_CONFIGS` key idempotently.
5. Verify `database-schema.md` already matches the applied delta; update the migration list if not.

**Files/areas affected**

- `backend/src/db/migrations/`
- `backend/src/db/schema/tournaments.ts`, `backend/src/db/schema/bookings.ts`, `backend/src/db/schema/matchmaking.ts`
- `backend/src/db/seed.ts`
- `docs/architecture/database-schema.md`

**API impact:** None.

**Schema/config impact:** All deltas above.

**Verification**

- Unit: N/A
- Integration: Migration UP/DOWN run cleanly against a fresh and a populated database.
- API-level: N/A
- E2E for a critical flow: N/A
- Edge/failure/concurrency: Existing booking payment rows remain valid after `booking_id` becomes nullable; CHECK rejects both-null and both-set.
- Manual: Seed value is present once after repeated runs.

**Acceptance criteria**

- **Given** an existing database with booking payments
  **When** the migration runs
  **Then** all existing rows still satisfy the new constraints and no data is lost.
- **Given** the migrations are applied
  **When** `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES` is read
  **Then** it resolves to `10` and is not duplicated by re-seeding.

---

## [ ] TRN-02: Tournament core CRUD and lifecycle API

```text
Status: BLOCKED
Size: L
Blocked by: Auth module
```

**Objective:** Provide backend APIs to create, read, update, cancel, and transition tournaments.

**Scope**

- In scope:
  - `POST/GET /api/v1/tournaments`, `GET /api/v1/tournaments/:id`, `PUT /api/v1/tournaments/:id`.
  - `POST /api/v1/tournaments/:id/status` for `OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `COMPLETED`.
  - `POST /api/v1/tournaments/:id/cancel`.
  - List filters `status`, `match_type`, `search`; offset pagination via `page`/`limit`.
  - Optimistic concurrency using `TOURNAMENTS.version`.
- Out of scope:
  - Registration, bracket, payment, notifications.

**Implementation requirements**

1. Implement thin route → controller → service → repository for `TOURNAMENTS`.
2. Enforce lifecycle edit rules and the `entry_fee` lock after a `CONFIRMED` registration.
3. Enforce contextual Organizer authorization plus Admin override; return the feature error codes.
4. Validate payloads with Zod; return `meta` pagination for list.

**Files/areas affected**

- `backend/src/routes/tournaments/`, `backend/src/controllers/tournaments/`, `backend/src/services/tournaments/`, `backend/src/repositories/tournaments/`
- `backend/src/validation/tournaments.ts`

**API impact:** Endpoints in Tech Design §3.1.

**Schema/config impact:** Uses the TRN-01 columns.

**Verification**

- Unit: State machine transitions and fee-lock rule.
- Integration: Optimistic concurrency (`version`) rejects stale updates.
- API-level: List filters/pagination; `400/401/403/404/409` shapes.
- E2E for a critical flow: Organizer creates a draft and opens registration.
- Edge/failure/concurrency: Two concurrent status updates — only one wins.
- Manual: N/A

**Acceptance criteria**

- **Given** a `DRAFT` owned by the requester
  **When** they transition it to `OPEN_FOR_REGISTRATION`
  **Then** the status changes and `version` increments.
- **Given** a non-Organizer, non-Admin user
  **When** they update the tournament
  **Then** the API returns `403 TOURNAMENT_FORBIDDEN_ORGANIZER`.
- **Given** a tournament with a `CONFIRMED` registration
  **When** the Organizer changes `entry_fee`
  **Then** the API returns `409 TOURNAMENT_ENTRY_FEE_LOCKED`.

---

## [ ] TRN-03: Team and Invitation module

```text
Status: BLOCKED
Size: L
Blocked by: Auth module
```

**Objective:** Implement Doubles team creation, membership, and invitation lifecycle.

**Scope**

- In scope:
  - Create a team (creator becomes captain), list/detail a team.
  - Invite a player, accept/decline/cancel an invitation, list my invitations.
  - Enforce exactly 2 members before registration, one Doubles team per player per tournament, and the captain-membership invariant.
  - Snapshot `expires_at` from `TEAM_INVITATION_TIMEOUT_MINUTES`.
- Out of scope:
  - Registration itself (TRN-04) and invitation-expiry cron (TRN-09).

**Implementation requirements**

1. Implement `TOURNAMENT_TEAMS`, `TOURNAMENT_TEAM_PLAYERS`, `TEAM_INVITATIONS` access.
2. Enforce invitee eligibility, inviter authorization, and no-duplicate-team invariants transactionally.
3. Keep invitation `expires_at` immutable after configuration changes.

**Files/areas affected**

- `backend/src/services/tournaments/teams/`
- `backend/src/validation/teams.ts`

**API impact:** Team/invitation endpoints in Tech Design §3.6.

**Schema/config impact:** Uses existing team tables and `TEAM_INVITATION_TIMEOUT_MINUTES`.

**Verification**

- Unit: Membership and eligibility rules.
- Integration: Duplicate-team and second-member race conditions.
- API-level: Accept/decline state transitions and authorization.
- E2E for a critical flow: Two players form a valid Doubles team.
- Edge/failure/concurrency: Two invitations accepted for one player in the same tournament — only one team membership is created.
- Manual: N/A

**Acceptance criteria**

- **Given** a captain with one accepted invitation
  **When** the team is read
  **Then** it has exactly 2 members and is eligible to register.
- **Given** a player already in a Doubles team in the tournament
  **When** they accept another invitation
  **Then** the operation is rejected.

---

## [ ] TRN-04: Registration and withdrawal API

```text
Status: BLOCKED
Size: L
Blocked by: TRN-03, Auth module
```

**Objective:** Let players register for Singles/Doubles and withdraw before close.

**Scope**

- In scope:
  - `POST/GET /api/v1/tournaments/:id/registrations`.
  - `POST /api/v1/tournaments/:id/registrations/:registration_id/cancel`.
  - Enforce period, lifecycle, participant limit, duplicate checks, and team validity.
  - Create `PENDING_PAYMENT` with snapshotted `expires_at` when `entry_fee > 0`, otherwise `CONFIRMED`.
- Out of scope:
  - Payment provider integration (TRN-05) and expiry cron (TRN-09).

**Implementation requirements**

1. Implement registration access and validations from Tech Design §6.
2. For Doubles, verify exactly 2 members, accepted invitation, and captain as requester.
3. On withdrawal, transition to `CANCELLED` and emit a refund event when payment exists.

**Files/areas affected**

- `backend/src/services/tournaments/registrations/`
- `backend/src/validation/registrations.ts`

**API impact:** Tech Design §3.2.

**Schema/config impact:** Uses `expires_at` and `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`.

**Verification**

- Unit: Participant limit and duplicate rules.
- Integration: Registration period boundaries and `PENDING_PAYMENT` expiry snapshot.
- API-level: `409` codes for closed/limit/duplicate/invalid-team.
- E2E for a critical flow: Register for a paid tournament and withdraw before close.
- Edge/failure/concurrency: Concurrent registrations at the limit — the limit is not exceeded.
- Manual: N/A

**Acceptance criteria**

- **Given** a paid open tournament with room
  **When** a player registers
  **Then** a `PENDING_PAYMENT` registration with `expires_at` is created.
- **Given** a paid `CONFIRMED` registration before close
  **When** the owner withdraws
  **Then** it becomes `CANCELLED` and a refund event is emitted.
- **Given** registration is closed
  **When** a player withdraws
  **Then** the API returns `409 TOURNAMENT_REGISTRATION_NOT_CANCELLABLE`.

---

## [ ] TRN-05: VNPAY payment integration for registrations

```text
Status: BLOCKED
Size: L
Blocked by: TRN-04, PaymentModule
```

**Objective:** Process registration entry fees through VNPAY with idempotent callbacks.

**Scope**

- In scope:
  - Create the payment URL for a `PENDING_PAYMENT` registration.
  - Persist a `PAYMENTS` row linked through `registration_id`.
  - Validate the webhook signature and transition `PENDING_PAYMENT → CONFIRMED` idempotently.
- Out of scope:
  - Refund execution (TRN-09) and booking payments.

**Implementation requirements**

1. Implement the PaymentModule VNPAY adapter and webhook handler with the documented contract.
2. Enforce exactly-one linkage and amount equal to the tournament `entry_fee`.
3. Return `200` for already-processed callbacks; never reopen an `EXPIRED` registration.

**Files/areas affected**

- `backend/src/services/payments/` (consumes the platform Payments & Refunds module)
- `docs/features/platform/payments-refunds/` (governing platform documents)

**API impact:** Payment URL endpoint and VNPAY webhook.

**Schema/config impact:** Uses TRN-01 `PAYMENTS` delta and VNPAY configuration.

**Verification**

- Unit: Signature validation and status mapping.
- Integration: Duplicate webhook is a no-op.
- API-level: Invalid signature rejected without leaking provider details.
- E2E for a critical flow: Pay and see the registration become `CONFIRMED`.
- Edge/failure/concurrency: Late payment after `EXPIRED` does not reopen the registration.
- Manual: N/A

**Acceptance criteria**

- **Given** a `PENDING_PAYMENT` registration
  **When** a valid VNPAY callback arrives
  **Then** the registration becomes `CONFIRMED` and the payment is recorded.
- **Given** an already `CONFIRMED` registration
  **When** the same callback is replayed
  **Then** the API returns `200` without a second effect.

---

## [ ] TRN-06: Single-elimination bracket generation

```text
Status: IN_PROGRESS
Size: L
Blocked by: Auth module (endpoint wiring only; the pure algorithm may proceed now)
```

**Progress:** Pure functions and unit tests are implemented in
`backend/src/services/tournaments/bracket/` (20 tests passing). The
persistence/endpoint wiring remains blocked on Auth.

**Objective:** Generate a valid power-of-2 single-elimination tree with BYEs and seeding.

**Scope**

- In scope:
  - Pure functions for bracket size, BYE placement, deterministic seeding, and BYE auto-advance.
  - `POST /api/v1/tournaments/:id/bracket/generate` creating `MATCHES` + `TOURNAMENT_MATCHES` atomically and transitioning to `READY`.
- Out of scope:
  - Scheduling and match resolution.

**Implementation requirements**

1. Implement `BracketService` pure functions with a documented deterministic mapping; randomize ties with a seeded RNG for testability.
2. Validate `N >= 2`; otherwise fail and cancel the tournament.
3. Auto-advance BYE slots into the next match without creating a `MATCHES` row for the BYE.
4. Wrap all inserts in one transaction with full rollback.

**Files/areas affected**

- `backend/src/services/tournaments/bracket/`

**API impact:** `POST /api/v1/tournaments/:id/bracket/generate`, `GET /api/v1/tournaments/:id/bracket`.

**Schema/config impact:** Uses nullable `MATCHES.court_id`.

**Verification**

- Unit: Power-of-2 size, BYE count, seed distribution, BYE auto-advance, deterministic seeding.
- Integration: Transactional generation and rollback on failure.
- API-level: `409 TOURNAMENT_MIN_PARTICIPANTS_NOT_MET` and `TOURNAMENT_BRACKET_ALREADY_GENERATED`.
- E2E for a critical flow: Generate a bracket for 5 registrations.
- Edge/failure/concurrency: A failed insert leaves no partial bracket.
- Manual: N/A

**Acceptance criteria**

- **Given** 5 confirmed registrations
  **When** the bracket is generated
  **Then** the tree has 8 slots, 3 BYEs, and no BYE creates a `MATCHES` row.
- **Given** bracket generation fails midway
  **When** the transaction rolls back
  **Then** no `TOURNAMENT_MATCHES` row remains.

---

## [ ] TRN-07: Match scheduling, start, and game scoring

```text
Status: BLOCKED
Size: M
Blocked by: TRN-06, Auth module, Booking system-booking primitive
```

**Objective:** Let the Organizer assign Court/time (creating a system non-payment booking that reserves the slot), start matches, and record game scores.

**Scope**

- In scope:
  - `PUT /api/v1/tournaments/:id/matches/:match_id/schedule`.
  - `POST /api/v1/tournaments/:id/matches/:match_id/start` (first start → tournament `IN_PROGRESS`).
  - `PUT /api/v1/tournaments/:id/matches/:match_id/games` writing `MATCH_GAMES`.
- Out of scope:
  - Resolution/advancement (TRN-08).

**Implementation requirements**

1. Reject schedule changes after the match starts.
2. Scheduling creates a system-created, non-payment `BOOKINGS` row through the Booking module contract and links it via `MATCHES.booking_id`; the normal overlap/pricing rules apply and `TOURNAMENT_COURT_UNAVAILABLE` is returned on conflict.
3. Require an assigned Court before start; set `MATCHES.started_at`/status.
4. Validate game score shape and store each game.
5. Cancelling the match releases the linked booking.

**Files/areas affected**

- `backend/src/services/tournaments/matches/`

**API impact:** Tech Design §3.3.

**Schema/config impact:** None beyond TRN-01.

**Verification**

- Unit: Transition rules for start and schedule lock.
- Integration: Starting the first match moves the tournament to `IN_PROGRESS`.
- API-level: `409 TOURNAMENT_MATCH_SCHEDULE_LOCKED`, `TOURNAMENT_MATCH_ALREADY_RESOLVED`.
- E2E for a critical flow: Schedule, start, and score one match.
- Edge/failure/concurrency: Starting an unscheduled match is rejected.
- Manual: N/A

**Acceptance criteria**

- **Given** a scheduled match
  **When** the Organizer starts it
  **Then** the match starts and, if first, the tournament becomes `IN_PROGRESS`.
- **Given** a started match
  **When** the Organizer reschedules it
  **Then** the API returns `409 TOURNAMENT_MATCH_SCHEDULE_LOCKED`.
- **Given** recorded games
  **When** the games are read back
  **Then** they are persisted in `MATCH_GAMES` in order.

---

## [ ] TRN-08: Match resolution and winner advancement

```text
Status: BLOCKED
Size: M
Blocked by: TRN-07
```

**Objective:** Resolve matches and advance winners through the bracket.

**Scope**

- In scope:
  - `PUT /api/v1/tournaments/:id/matches/:match_id/result`.
  - Derive `WINNER_DECLARED` from `MATCH_GAMES`; accept `WALKOVER`/`NONE` explicitly.
  - Copy the winner into `next_registration_slot` of `next_match_id`; update `MATCHES.status`.
- Out of scope:
  - Automatic advancement for cancelled (`NONE`) matches.

**Implementation requirements**

1. Validate that the winner is one of the participants and is consistent with the games.
2. Do not advance on `NONE`.
3. Make resolution idempotent and guard against resolving twice.

**Files/areas affected**

- `backend/src/services/tournaments/matches/`

**API impact:** `PUT /api/v1/tournaments/:id/matches/:match_id/result`.

**Schema/config impact:** None.

**Verification**

- Unit: Winner derivation and validation.
- Integration: Advancement into the correct next slot.
- API-level: `409 TOURNAMENT_MATCH_RESULT_INVALID`, `TOURNAMENT_MATCH_ALREADY_RESOLVED`.
- E2E for a critical flow: Resolve two matches and see the winner in the next round.
- Edge/failure/concurrency: Concurrent resolution attempts — only one succeeds.
- Manual: N/A

**Acceptance criteria**

- **Given** a resolved `WINNER_DECLARED` match
  **When** the next-round match is read
  **Then** the winner appears in the correct registration slot.
- **Given** a match set to `NONE`
  **When** the next round is read
  **Then** no participant was advanced automatically.

---

## [ ] TRN-09: Cron pollers and refund processing

```text
Status: BLOCKED
Size: L
Blocked by: TRN-05, TRN-08
```

**Objective:** Handle registration/invitation timeouts and tournament refunds.

**Scope**

- In scope:
  - Expire `PENDING_PAYMENT` registrations past `expires_at`.
  - Expire team invitations past `expires_at`.
  - Process `TournamentCancelled` and `RegistrationWithdrawn` refunds idempotently.
- Out of scope:
  - A standalone refund-management module.

**Implementation requirements**

1. Use the in-process scheduler with database claiming/locking.
2. Respect `REFUND_PROCESSING_TIMEOUT_MINUTES = 1440` for refund timeouts and observability.
3. Ensure repeated runs do not double-process.

**Files/areas affected**

- `backend/src/jobs/` or `backend/src/workers/`

**API impact:** None.

**Schema/config impact:** Uses tournament config keys.

**Verification**

- Unit: Timeout boundary calculations.
- Integration: DB claiming prevents concurrent processing.
- API-level: N/A
- E2E for a critical flow: An expired registration and a cancelled paid tournament both complete their workflows.
- Edge/failure/concurrency: Two workers cannot process the same row.
- Manual: N/A

**Acceptance criteria**

- **Given** a `PENDING_PAYMENT` registration past `expires_at`
  **When** the poller runs
  **Then** it becomes `EXPIRED`.
- **Given** a cancelled paid tournament
  **When** the refund worker runs twice
  **Then** each registration is refunded exactly once.

---

## [ ] TRN-10: Tournament notifications and client polling

```text
Status: BLOCKED
Size: M
Blocked by: TRN-02, Auth module
```

**Objective:** Persist and expose tournament notifications.

**Scope**

- In scope:
  - Persist notifications on cancellation and relevant tournament updates.
  - `GET /api/v1/notifications/unread`.
- Out of scope:
  - Push/email delivery.

**Implementation requirements**

1. Limit recipients to affected participants and Organizer/Admin where applicable.
2. Return `{ data: [...] }` using the global error contract.

**Files/areas affected**

- `backend/src/services/notifications/`

**API impact:** `GET /api/v1/notifications/unread`.

**Schema/config impact:** Uses `NOTIFICATIONS`.

**Verification**

- Unit: Notification creation on event.
- Integration: Recipients are scoped correctly.
- API-level: Unread list contract.
- E2E for a critical flow: Cancelled tournament notifies participants.
- Edge/failure/concurrency: N/A
- Manual: 30-second client polling shows new notifications.

**Acceptance criteria**

- **Given** a tournament cancellation
  **When** a participant polls unread notifications
  **Then** the cancellation notification is returned.

---

## [ ] TRN-11: Frontend tournament portal and bracket view

```text
Status: BLOCKED
Size: L
Blocked by: TRN-02…TRN-08
```

**Objective:** Build the tournament UI for listing, managing, registering, and viewing brackets.

**Scope**

- In scope:
  - Tournament list/detail, organizer create/edit forms (entry fee, venue, schedule).
  - Singles/Doubles registration and withdrawal flows, VNPAY redirect.
  - Bracket visualization and organizer result/score entry.
- Out of scope:
  - Any server-side business rule.

**Implementation requirements**

1. Reuse the shared table/filter components from `frontend/src/components/common/`.
2. Keep API transport in `frontend/src/services/`.
3. Handle loading, success, error, and empty states for every async flow.

**Files/areas affected**

- `frontend/src/features/tournament/pages/`
- `frontend/src/features/tournament/components/`
- `frontend/src/features/tournament/services/tournamentService.ts`

**API impact:** Consumes Tournament APIs.

**Schema/config impact:** None.

**Verification**

- Unit: Component behavior for bracket rendering and form validation.
- Integration: Registration → payment → bracket flow.
- API-level: N/A
- E2E for a critical flow: View → Register → Pay → View Bracket.
- Edge/failure/concurrency: Failed payment returns the player to a recoverable state.
- Manual: N/A

**Acceptance criteria**

- **Given** an open tournament
  **When** a player registers and pays
  **Then** they appear in the participant list and bracket.
- **Given** an Organizer
  **When** they submit a match result
  **Then** the bracket updates to show the advanced winner.

---

## [ ] TRN-12: Bracket seed selection API and Organizer draw UI

```text
Status: BLOCKED
Size: M
Blocked by: TRN-06, TRN-02, Auth module
```

**Objective:** Let the Organizer view/adjust the seed order and trigger the draw, per PRD §6/§7 and Tech Design §3.3/§6.

**Scope**

- In scope:
  - `GET /api/v1/tournaments/:id/bracket/seeds` returning confirmed registrations with the skill-based suggestion.
  - `PUT /api/v1/tournaments/:id/bracket/seeds` persisting the Organizer's seed order.
  - Frontend seed editor and a "Draw" action that calls bracket generation.
- Out of scope:
  - Bracket generation itself (TRN-06) and match scheduling (TRN-07).

**Implementation requirements**

1. Validate ownership (Organizer/Admin) and lifecycle (`REGISTRATION_CLOSED`/`READY`, pre-draw).
2. Reject duplicate seed numbers, non-confirmed registrations, and out-of-range seeds with `TOURNAMENT_SEED_INVALID`.
3. Persist seed order; generation in TRN-06 consumes it and randomizes unseeded registrations.
4. After generation, reject seed updates with `TOURNAMENT_BRACKET_ALREADY_GENERATED`.

**Files/areas affected**

- `backend/src/routes/tournament/`, `backend/src/controllers/tournament/`, `backend/src/services/tournament/` `[Proposed — verify during implementation]`
- `frontend/src/features/tournament/` `[Proposed — verify during implementation]`

**API impact:** Adds the two `/bracket/seeds` endpoints.

**Schema/config impact:** None beyond the seed order already used by TRN-06.

**Verification**

- API-level: seed get/set success and all documented error codes.
- Integration: draw uses the Organizer seed order; unseeded registrations are randomized; BYEs go to high seeds.

**Acceptance criteria**

- **Given** a closed registration with confirmed participants
  **When** the Organizer sets a seed order and draws
  **Then** the bracket reflects the seed order, unseeded entries are randomized, and BYEs prioritize high seeds.
- **Given** a generated bracket
  **When** the Organizer attempts to change seeds
  **Then** the change is rejected.
