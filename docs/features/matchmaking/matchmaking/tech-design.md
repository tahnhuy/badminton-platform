# Automatic Matchmaking — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/matchmaking/matchmaking/prd.md
Scope: Automated matchmaking engine — match request lifecycle, compatibility matching, automatic court selection and booking hold, match confirmation, and pre-match leaving
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26)
```

> Ready. All technical decisions were resolved by the human owner on 2026-09-26
> (see §21), and the required authoritative documentation updates
> (`tech-stack.md`, `documentation-guide.md` §15, `database-schema.md`) were
> applied in the same working session. The human readiness gate per
> `docs/documentation-guide.md` §6.3 was explicitly given on 2026-09-26.

## 2. Context

This design implements the Player-facing automatic matchmaking behavior in
`docs/features/matchmaking/matchmaking/prd.md`:

1. A Player creates a Matchmaking Request (`SINGLES` or `DOUBLES`) with a
   preferred date/time window, skill range, location, and maximum distance.
2. A background engine finds compatible requests, prioritizes the oldest first,
   forms a Match with the full required player count, selects a court near the
   group centroid, and creates a booking hold automatically.
3. Every matched Player must confirm within a deadline; when all confirm and the
   booking is confirmed, the Match is `CONFIRMED`.
4. A Player may cancel an `OPEN` request, or leave a Match before it starts.
5. Requests and Matches expire/cancel on their configured deadlines.

The feature crosses these boundaries:

- **MatchmakingModule (new)**: request lifecycle, compatibility engine, Match
  lifecycle, confirmation handling, cancellation/leaving, scheduler jobs.
- **BookingModule (existing design, not yet implemented in code)**: owns booking
  holds, pricing snapshots, slot availability, and the Booking lifecycle. It is
  consumed by Matchmaking through a narrow internal contract; it does not depend
  on Matchmaking.
- **PaymentModule (platform capability)**: owns VNPAY payment/refund execution
  for the match booking; Matchmaking only reconciles against `BOOKINGS.status`.
- **NotificationModule (platform capability)**: persists in-app notifications.
- **Scheduler**: a single in-process interval job (confirmed in
  `tech-stack.md`) drives matching, deadline enforcement, and time-based Match
  transitions.

## 3. Technical Problem

The design must solve:

1. **Compatibility at scale-ish** — finding compatible groups from `OPEN`
   requests without a scoring algorithm, using skill-range intersection, time
   overlap duration, and pairwise geographic distance.
2. **Deterministic priority** — oldest request first (`created_at ASC`), so the
   engine's choice is explainable and testable.
3. **Atomic matching under concurrency** — overlapping engine runs, or a Player
   cancel/expiry racing a match attempt, must never produce duplicate or
   partially formed Matches. One request may produce at most one successful
   Match.
4. **Automatic court selection and booking hold** — find a court near the group
   centroid, create a hold without Player involvement, and handle "no court
   found" and booking-contention failures without corrupting Match state.
5. **Deadline handling with snapshots** — request expiry, court-search timeout,
   and confirmation timeout must be snapshotted at creation so later
   configuration changes do not move an established deadline
   (`docs/business-rules-config-matrix.md` §8.1).
6. **Multi-event confirmation** — all required Players must confirm or the Match
   must cancel; explicit decline and timeout must behave the same way.
7. **Financial reconciliation** — the PRD designates the earliest matched
   request's Player as the booking owner; Match must not become `CONFIRMED`
   while its booking is unpaid/expired.

## 4. Goals

- Provide REST endpoints for request creation/cancel/listing and Match
  retrieval/confirmation/leaving.
- Implement the compatibility and priority rules exactly as defined by
  `docs/business-rules-config-matrix.md` §3.
- Make Match creation atomic and idempotent, guarded by row locks and the
  partial unique index on successful matchmaking results.
- Reuse the Booking module for court availability and hold creation; never
  duplicate booking/pricing logic inside Matchmaking.
- Enforce all Matchmaking deadlines with the confirmed in-process scheduler and
  read-time effective-status filtering.
- Keep MatchmakingModule, BookingModule, PaymentModule, and NotificationModule
  responsibilities separate.

## 5. Non-Goals

- ELO / dynamic MMR or any advanced skill scoring.
- Automatic substitution after a Player leaves (Out of MVP).
- Group chat.
- Split bill / per-player payment of the match booking.
- Tournament matchmaking or bracket logic.
- Match rescheduling after `CONFIRMED`.
- New realtime transport (HTTP polling is confirmed).
- A geospatial extension (PostGIS) or external queue/scheduler.

## 6. Upstream References

- Governing PRD: `docs/features/matchmaking/matchmaking/prd.md`
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §3.1, §5, §6, §7
- Documentation rules: `docs/documentation-guide.md` §6, §9, §10
- Global architecture/technology: `docs/architecture/tech-stack.md`
  (PERN, TypeScript, Zod, HTTP polling 5–10s, in-process scheduler, in-app
  notifications, opaque session cookie)
- Global coding/API conventions: `docs/architecture/conventions.md`
  (`/api/v1/` prefix, offset pagination with `meta`, error shape, route →
  controller → service → repository layering, snake_case DB identifiers)
- Business rules/configuration: `docs/business-rules-config-matrix.md`
  §1.2 (Skill Level Catalog), §3 (Matchmaking Rules), §8.1 (Configuration
  Semantics), §8.3 (Matchmaking Configuration)
- Global database schema: `docs/architecture/database-schema.md`
  §2.3 (Matchmaking), §3.11 `MATCHMAKING_REQUESTS`, §3.12 `MATCHMAKING_MATCHES`,
  §3.13 `MATCHES`, §3.14 `MATCH_PLAYERS`, §3.15 `MATCH_CONFIRMATIONS`,
  §3.8 `BOOKINGS`, §5.4 (matchmaking success integrity), §5.9 (Match/Booking
  relationship), §8 (Lifecycle Summary)
- Booking implementation contract: `docs/features/booking/player-booking/tech-design.md`
- Payments/refunds contract: `docs/features/platform/payments-refunds/tech-design.md`
- Notification strategy: `docs/architecture/tech-stack.md` (in-app `NOTIFICATIONS`)

> Section reference note: the request named `database-schema.md §3.5 (BOOKINGS)`,
> but in the current authoritative schema `BOOKINGS` is §3.8 and §3.5 is
> `FACILITIES`. This design uses §3.8.

### 6.1 Documentation Conflicts (Resolved 2026-09-26)

1. **ORM conflict (resolved).** The repository uses Drizzle ORM
   (`backend/src/db/schema/*`, `drizzle-orm`/`drizzle-kit` in
   `backend/package.json`). Per §21 Q1, Drizzle is confirmed as the ORM and
   `docs/architecture/tech-stack.md` was updated; the conflicting note in
   `docs/documentation-guide.md` §15 was corrected.
2. **`MATCHES.booking_id` documentation gap (resolved).** `MATCHES.booking_id`
   (unique FK → `BOOKINGS.id`) already exists in the Drizzle schema and
   migration and is consistent with `database-schema.md` §5.9. It is now
   documented in §3.13; no migration is required.

## 7. Proposed Technical Design

### 7.1 Module and Layer Boundaries

The feature follows the existing PERN monolith layering
(routes → controller → service → repository):

- **Routes** (`routes/matchmaking/*`): map HTTP to controllers, attach
  `authenticate` + `requireRole('PLAYER')` and `validate` middleware.
- **Controllers** (`controllers/matchmaking/*`): translate HTTP
  input/output, delegate to services, return `{ data, meta? }`.
- **Services** (`services/matchmaking/*`):
  - `MatchmakingRequestService` — request creation, cancellation, listing,
    validation, expiry coordination.
  - `MatchmakingEngineService` — compatibility search and atomic Match creation.
  - `MatchService` — Match retrieval, confirmation/decline, leaving, lifecycle
    transitions, booking reconciliation.
  - `MatchmakingScheduler` — in-process tick that invokes engine and
    transition/expiry jobs.
- **Repositories** (`repositories/matchmaking/*`): all SQL/query access,
  row locking (`FOR UPDATE SKIP LOCKED`), inserts and atomic updates. No
  user-facing policy here.
- **Cross-module contract**: `MatchBookingPort`, implemented by BookingModule,
  exposes `createMatchHold(...)` and `releaseMatchHold(...)`. Matchmaking never
  writes `BOOKINGS` directly.
- **Notification boundary**: Matchmaking calls a `NotificationService` that
  inserts in-app `NOTIFICATIONS` rows.
- **Config boundary**: `MatchmakingConfigService` reads `SYSTEM_CONFIGS` with
  the defaults from `docs/business-rules-config-matrix.md` §8.3 and snapshots
  deadlines at entity creation.

Cross-module interfaces are declared in `backend/src/contracts/`:
`MatchBookingPort.ts`, `NotificationService.ts`, `MatchModule.ts`,
`CourtService.ts`, and `PlayerProfileService.ts`.

### 7.2 Matching Engine

The engine runs in the scheduler (authoritative, periodic) and never depends on
in-memory coordination. It is idempotent and safe to overlap.

**Step A — expire stale requests.**
`OPEN` requests with `expires_at <= now()` are claimed and moved to `EXPIRED`
(§13). Owners are notified.

**Step B — form groups and create Matches.**
For each `match_type` with `OPEN` requests:

1. Load candidate requests ordered by `created_at ASC` (oldest first), bounded
   by a batch size.
2. For the oldest `OPEN` request, treat it as the anchor. A candidate request is
   compatible with the current group when all hold:
   - same `match_type`;
   - same `preferred_date`;
   - skill range intersects the anchor's range **and** the running intersection
     of the group (`max(min_skill_level_id) <= min(max_skill_level_id)`);
   - the intersection of all preferred windows is at least
     `MATCHMAKING_MATCH_DURATION_MINUTES`;
   - every pairwise Player distance is within
     `min(a.max_distance_km, b.max_distance_km, MATCHMAKING_MAX_DISTANCE_KM)`;
   - different `player_id` from every already-selected Player.
3. Greedily select the oldest compatible candidates until the group reaches the
   required size (2 for `SINGLES`, 4 for `DOUBLES`).
4. If a full group exists, create the Match atomically (Step C); otherwise leave
   the anchor `OPEN` for the next tick.

Priority is the oldest anchor first, then oldest compatible candidates. No
score, no ranking.

**Step C — atomic Match creation.**

Within one PostgreSQL transaction:

1. `SELECT ... FROM matchmaking_requests WHERE id = ANY($candidateIds) AND
   status = 'OPEN' AND expires_at > now() FOR UPDATE SKIP LOCKED`.
2. If fewer than the required count are returned, abort (another run consumed
   them, or they expired).
3. Re-verify compatibility on the locked rows (defensive; the lock does not
   guarantee the rows still satisfy every predicate).
4. Compute the common window = intersection of locked requests' windows; set
   `scheduled_at` = intersection start (interpreted in `Asia/Ho_Chi_Minh`).
5. Insert one `MATCHES` row: `match_type`, `scheduled_at`,
   `status = 'WAITING_FOR_COURT'`, `court_search_expires_at = now() +
   MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`.
6. Insert one `MATCH_PLAYERS` row per request (`status = 'ACTIVE'`,
   `joined_at = now()`), with `team_no` assigned (see §7.4).
7. Insert one `MATCHMAKING_MATCHES` row per request with
   `status = 'MATCHED'`, `matched_at = now()`, `match_id` = the new Match.
8. Update the requests to `status = 'MATCHED'`.
9. Commit.

The partial unique index `UNIQUE (matchmaking_request_id) WHERE status =
'MATCHED'` (§5.4) is the final guard: even if two runs pass the lock check, only
one successful result per request can be committed.

After commit, court search runs (§7.4). A court-search failure does not roll
back the Match; the Match waits in `WAITING_FOR_COURT` until its deadline.

### 7.3 Compatibility Computation Details

- **Skill**: compare `SKILL_LEVELS.rank` (1–6). Two ranges are compatible when
  `max(lower ranks) <= min(upper ranks)`.
- **Time**: `time` intersections are combined with `preferred_date`; the common
  interval must be `>= MATCHMAKING_MATCH_DURATION_MINUTES` (default 90).
- **Distance**: Haversine distance in kilometres computed from request
  `latitude`/`longitude`. Pairwise, using the minimum of the two Players'
  limits and the global `MATCHMAKING_MAX_DISTANCE_KM` (default 5 km). No
  PostGIS.
- **Group centroid**: arithmetic mean of the matched requests' latitudes and
  longitudes, used for court ranking.
- **Court radius**: a candidate court is considered only when its distance to
  the centroid is within the group's effective minimum limit (the minimum of
  `MATCHMAKING_MAX_DISTANCE_KM` and every matched request's `max_distance_km`).

### 7.4 Automatic Court Selection and Booking Hold

Court selection priority (PRD / `docs/business-rules-config-matrix.md` §3.5):
nearest to the group centroid → lower price → stable tie-breaker.

1. Compute centroid from `MATCH_PLAYERS`' requests.
2. Load bookable courts: `COURTS.status = 'ACTIVE'`, `FACILITIES.status =
   'ACTIVE'`, neither soft-deleted.
3. Keep courts with a free interval covering `[scheduled_at, scheduled_at +
   MATCHMAKING_MATCH_DURATION_MINUTES)` on the preferred date. Availability is
   delegated to BookingModule so the rules match real-time booking exactly.
4. Order by (distance to centroid ASC, applicable price ASC, `COURTS.id` ASC).
5. For the first candidate, call `MatchBookingPort.createMatchHold(...)`. On a
   recoverable failure — slot contention (`409 BOOKING_SLOT_UNAVAILABLE`) — try
   the next candidate. Deterministic failures (`COURT_NOT_BOOKABLE`,
   `BOOKING_OUTSIDE_ADVANCE_WINDOW`, `BOOKING_ACTIVE_LIMIT_REACHED`,
   `BOOKING_DISABLED`) fail for every candidate; they are logged distinctly and,
   per `docs/business-rules-config-matrix.md` §3.7, the Match remains
   `WAITING_FOR_COURT` and retries until `court_search_expires_at`, then becomes
   `CANCELLED`. A `preferred_date` beyond `BOOKING_ADVANCE_WINDOW_DAYS`
   (default 7) is a deterministic failure that cannot succeed for that request.
6. On success, in one Matchmaking transaction: set `MATCHES.court_id`,
   `MATCHES.booking_id`, `status = 'WAITING_FOR_CONFIRMATION'`,
   `confirmation_expires_at = now() +
   MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`; insert one
   `MATCH_CONFIRMATIONS` row per `MATCH_PLAYERS` row with `status = 'PENDING'`.
   Notify all Players.
7. If no candidate succeeds, leave the Match `WAITING_FOR_COURT`; the next tick
   retries until `court_search_expires_at`.

**Booking owner.** Per PRD Decision (2026-09-26), the Player of the earliest
matched request is recorded as the booking owner and is responsible for paying
the full booking amount through the existing Booking/Payment flow. Matchmaking
exposes the booking id only to that Player in the Match detail response.

**`team_no` assignment.** For `SINGLES`, `team_no` = 1 and 2 (one Player each).
For `DOUBLES`, the four Players are shuffled and assigned `team_no` = 1, 1, 2, 2
(random teams, no partner preference).

### 7.5 Confirmation and Booking Reconciliation

- When confirmation is required (`MATCHMAKING_CONFIRMATION_REQUIRED = true`,
  default), the Match is `WAITING_FOR_CONFIRMATION` and every required Player
  (`MATCH_PLAYERS.status = 'ACTIVE'`) has a `MATCH_CONFIRMATIONS` row.
- A Player confirms or declines once. `MATCH_CONFIRMATIONS.status` ∈
  `{PENDING, CONFIRMED, DECLINED}`.
- All required Players `CONFIRMED` **and** the linked `BOOKINGS.status =
  'CONFIRMED'` → Match `CONFIRMED`.
- Any Player `DECLINED` → Match `CANCELLED` (reason `CONFIRMATION_DECLINED`).
- Confirmation deadline reached with any `PENDING` → Match `CANCELLED` (reason
  `CONFIRMATION_TIMEOUT`).
- When `MATCHMAKING_CONFIRMATION_REQUIRED = false`, no confirmation rows are
  required; the Match moves from `WAITING_FOR_COURT` to `CONFIRMED` as soon as
  the linked booking is `CONFIRMED`, and to `CANCELLED` if the booking fails.
- Booking reconciliation is done by the scheduler: it reads the linked
  `BOOKINGS.status` for Matches in `WAITING_FOR_COURT`/`WAITING_FOR_CONFIRMATION`
  and applies the outcome. No cross-module event bus is introduced.
- If the booking hold expires (`BOOKINGS.status = 'EXPIRED'`) or is cancelled
  before the Match is confirmed → Match `CANCELLED` (reason `BOOKING_FAILED`).
- Cancelling a Match cancels/releases the linked booking through
  `MatchBookingPort.releaseMatchHold(...)`; a paid booking follows the Booking
  refund rules (owned by Booking/Payment, not redefined here).
- **Payment/confirmation deadline overlap.** The booking hold's `expires_at`
  (`BOOKING_PAYMENT_TIMEOUT_MINUTES`) and `confirmation_expires_at`
  (`MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`) start at approximately the same
  moment, so the booking owner must both confirm and complete payment within
  that window; reconciliation applies `BOOKING_FAILED` if the hold expires first
  (Q5). Operational recommendation: configure the booking payment timeout to be
  no shorter than the confirmation timeout so the payer's payment window does
  not close before the confirmation deadline.

### 7.6 Scheduler

A single in-process `setInterval` scheduler (confirmed in `tech-stack.md`; no
queue or external infrastructure), ticking every **60 seconds**, matching the
Booking and Tournament background-job cadence. Each tick is independent and safe
to overlap; correctness never depends on a tick running exactly once.

Per tick:

1. Expire `OPEN` requests past `expires_at`.
2. Run the matching engine (§7.2) and attempt court search for
   `WAITING_FOR_COURT` Matches.
3. Cancel `WAITING_FOR_COURT` Matches past `court_search_expires_at`
   (`COURT_SEARCH_TIMEOUT`), and `WAITING_FOR_CONFIRMATION` Matches past
   `confirmation_expires_at` (`CONFIRMATION_TIMEOUT`).
4. Reconcile linked booking status (§7.5).
5. Advance `CONFIRMED → IN_PROGRESS` when `scheduled_at <= now()`, and
   `IN_PROGRESS → COMPLETED` when `scheduled_at +
   MATCHMAKING_MATCH_DURATION_MINUTES <= now()`.

Each category is claimed with an atomic select-and-update that matches only the
expected source status, using `FOR UPDATE SKIP LOCKED` (see §13). A row already
transitioned by another tick, a Player action, or a booking callback no longer
matches the predicate and is not processed twice. Startup performs one catch-up
sweep so transitions missed during downtime are applied promptly.

### 7.7 Client/Server Boundary and Real-Time Updates

- Players track request and Match state by polling `GET
  /api/v1/matchmaking-requests` and `GET /api/v1/matches/:id` every 5–10 seconds
  (confirmed HTTP polling).
- Server-side state is always authoritative; the client never decides a
  transition. Effective status is computed at read time against `expires_at`,
  `court_search_expires_at`, `confirmation_expires_at`, and `scheduled_at` so no
  stale state is exposed between ticks.
- A read never triggers a persisted transition and never emits notifications.

### 7.8 Timezone

All `date` + `time` combinations and deadline comparisons use the fixed
application timezone `Asia/Ho_Chi_Minh`, consistent with the Booking design.
`scheduled_at`, `expires_at`, `court_search_expires_at`, and
`confirmation_expires_at` are stored as timestamps derived in that zone.

### 7.9 Cross-Cutting Concerns

- **Validation**: Zod schemas at the request boundary via the existing
  `validate` middleware.
- **Errors**: existing `AppError` subclasses and centralized `errorHandler`
  producing `{ error: { code, message, details } }`.
- **Auth**: existing `authenticate` + `requireRole('PLAYER')`. The current
  `authenticate` contains a temporary bypass and the real Auth/CSRF middleware is
  not implemented yet (§11).
- **Config**: `MATCHMAKING_*` values read through `MatchmakingConfigService`;
  deadlines snapshotted at creation.

## 8. Behavior, State, and Flow

### 8.1 Matchmaking Request State Machine

```text
OPEN ──► MATCHED      (a successful Match is created)
  │
  ├──► CANCELLED      (Player cancels while OPEN)
  └──► EXPIRED        (expires_at reached while OPEN)
```

No transition returns a request to `OPEN`. A cancelled or expired request is
removed from matching; the Player creates a new one.

### 8.2 Match State Machine

```text
WAITING_FOR_COURT
  ├──► WAITING_FOR_CONFIRMATION ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
  │          │                          │
  │          ├──► CANCELLED             └──► CANCELLED (leave before start)
  └──► CANCELLED (court-search timeout)

CANCELLED  (decline / confirmation timeout / booking failure / leave)
```

| From | To | Trigger |
| --- | --- | --- |
| `WAITING_FOR_COURT` | `WAITING_FOR_CONFIRMATION` | Court selected and booking hold created (confirmation required) |
| `WAITING_FOR_COURT` | `CONFIRMED` | Booking `CONFIRMED` and confirmation not required |
| `WAITING_FOR_COURT` | `CANCELLED` | `court_search_expires_at` reached |
| `WAITING_FOR_CONFIRMATION` | `CONFIRMED` | All confirmations `CONFIRMED` **and** booking `CONFIRMED` |
| `WAITING_FOR_CONFIRMATION` | `CANCELLED` | Player declined / confirmation timeout / booking failed |
| `CONFIRMED` | `IN_PROGRESS` | `scheduled_at <= now()` |
| `CONFIRMED` | `CANCELLED` | Player leaves before start |
| `IN_PROGRESS` | `COMPLETED` | `scheduled_at + duration <= now()` |

- Preconditions: compatibility satisfied; requests still `OPEN` at Match
  creation; court selected before confirmation; all required Players confirmed
  before the Match is `CONFIRMED`.
- Postconditions: a request has at most one successful Match; no Match starts
  without the full required player count; a cancelled Match releases its booking
  hold.
- `IN_PROGRESS` and later are not leavable through the normal leave flow.

### 8.3 Confirmation State

```text
PENDING ──► CONFIRMED
   └─────► DECLINED
```

One row per `(match_id, player_id)`; a decision is final.

### 8.4 Sequence — Request Creation to Match

```mermaid
sequenceDiagram
    participant P as Player (React)
    participant R as MatchmakingRequestService
    participant DB as PostgreSQL
    participant S as Scheduler/Engine

    P->>R: POST /api/v1/matchmaking-requests
    R->>R: Zod validate + auth (PLAYER)
    R->>DB: check OPEN request limit per match type
    R->>DB: INSERT request (OPEN, expires_at = now + REQUEST_EXPIRATION)
    R-->>P: 201 { request, expiresAt }
    S->>DB: claim oldest OPEN requests (created_at ASC)
    S->>DB: BEGIN; SELECT candidates FOR UPDATE SKIP LOCKED; verify
    S->>DB: INSERT match, match_players, matchmaking_matches; requests MATCHED; COMMIT
    S->>S: court search -> booking hold
```

### 8.5 Sequence — Atomic Match Creation under Two Engine Runs

```mermaid
sequenceDiagram
    participant E1 as Engine run A
    participant E2 as Engine run B
    participant DB as PostgreSQL

    E1->>DB: BEGIN; SELECT request R FOR UPDATE SKIP LOCKED (acquires)
    E2->>DB: BEGIN; SELECT request R FOR UPDATE SKIP LOCKED (skips)
    E1->>DB: compatibility ok -> INSERT match + result; R -> MATCHED; COMMIT
    E2->>DB: group incomplete (R not returned) -> abort
    DB-->>E2: partial unique index blocks any duplicate MATCHED insert
```

### 8.6 Sequence — Confirmation, Payment, Confirmation Result

```mermaid
sequenceDiagram
    participant P as Player
    participant M as MatchService
    participant DB as PostgreSQL
    participant PM as PaymentModule
    participant S as Scheduler

    Note over M: Match WAITING_FOR_CONFIRMATION, booking hold PENDING_PAYMENT
    P->>M: PUT /api/v1/matches/:id/confirmation { decision: CONFIRMED }
    M->>DB: BEGIN; SELECT match FOR UPDATE; validate participant + deadline
    M->>DB: match_confirmations -> CONFIRMED; COMMIT
    M-->>P: 200 { confirmationStatus }
    Note over P: Earliest request owner pays via POST /api/v1/bookings/:id/payment
    PM->>DB: BOOKINGS -> CONFIRMED (idempotent)
    S->>DB: reconcile: all confirmed AND booking CONFIRMED
    S->>DB: MATCHES -> CONFIRMED; notify all
```

### 8.7 Sequence — Leave Before Start

```mermaid
sequenceDiagram
    participant P as Player
    participant M as MatchService
    participant DB as PostgreSQL
    participant B as MatchBookingPort

    P->>M: POST /api/v1/matches/:id/leave
    M->>DB: BEGIN; SELECT match FOR UPDATE
    M->>M: validate participant + now < scheduled_at + status leavable
    M->>DB: match_players -> LEFT
    M->>DB: MATCHES -> CANCELLED (INSUFFICIENT_PLAYERS)
    M->>DB: COMMIT
    M->>B: releaseMatchHold(booking_id)
    M-->>P: 200 { status: CANCELLED }
```

Because a Match requires exactly its full player count, any leave before start
cancels the Match; remaining Players must create new requests.

## 9. API Design

All paths are namespaced under `/api/v1`. Success responses use
`{ data: ... }`; collections add `meta: { page, limit, total, totalPages }`;
errors use `{ error: { code, message, details } }`.

### 9.1 Create Matchmaking Request (Player)

- Method/path: `POST /api/v1/matchmaking-requests`.
- Auth: `authenticate` + `requireRole('PLAYER')`.
- Body:
  - `matchType`: `SINGLES` | `DOUBLES`.
  - `preferredDate`: `YYYY-MM-DD` (today or future).
  - `preferredStartTime`, `preferredEndTime`: `HH:mm`; window length must be
    `>= MATCHMAKING_MATCH_DURATION_MINUTES`.
  - `minSkillLevelId`, `maxSkillLevelId`: valid `SKILL_LEVELS` ids with
    `min.rank <= max.rank`.
  - `latitude`, `longitude`: numbers.
  - `maxDistanceKm`: optional; defaults to `MATCHMAKING_MAX_DISTANCE_KM`; `> 0`.
- Response `201`: request id, status `OPEN`, all submitted fields, `expiresAt`.
- Rules: at most one `OPEN` request per `match_type` per Player; feature gated by
  `MATCHMAKING_ENABLED`.
- Status: `201`; `400` (`VALIDATION_FAILED`, `MATCHMAKING_INVALID_TIME_WINDOW`,
  `MATCHMAKING_INVALID_SKILL_RANGE`, `MATCHMAKING_INVALID_DISTANCE`,
  `MATCHMAKING_INVALID_DATE`); `401`; `403`; `409`
  (`MATCHMAKING_DISABLED`, `MATCHMAKING_ACTIVE_REQUEST_LIMIT`).

### 9.2 List My Requests (Player)

- Method/path: `GET /api/v1/matchmaking-requests`.
- Auth: `authenticate` + `requireRole('PLAYER')`; scoped to the caller.
- Query: `status` (optional), `page`, `limit`.
- Response: paginated requests, newest first, with effective status.

### 9.3 Request Detail (Player)

- Method/path: `GET /api/v1/matchmaking-requests/:id`.
- Auth: owner-only; non-owner or missing id returns `404
  MATCHMAKING_REQUEST_NOT_FOUND`.
- Response: full request detail.

### 9.4 Cancel Request (Player)

- Method/path: `POST /api/v1/matchmaking-requests/:id/cancel`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only.
- Behavior: allowed only while `OPEN`; sets `CANCELLED`.
- Idempotency: cancelling an already `CANCELLED` request returns `200`.
- Status: `200`; `401`; `403`; `404`; `409`
  (`MATCHMAKING_REQUEST_NOT_CANCELLABLE`).

### 9.5 List My Matches (Player)

- Method/path: `GET /api/v1/matches`.
- Auth: `authenticate` + `requireRole('PLAYER')`; scoped to the caller's
  `MATCH_PLAYERS`.
- Query: `status` (optional), `timeScope` (`UPCOMING` | `PAST` | `ALL`),
  `page`, `limit`.
- Response: paginated Match summaries (id, match type, status, scheduled time,
  court/facility summary when assigned), newest first.

### 9.6 Match Detail (Player)

- Method/path: `GET /api/v1/matches/:id`.
- Auth: participant-only; non-participant or missing id returns `404
  MATCH_NOT_FOUND`.
- Response: match type, status, `scheduledAt`, court/facility summary when
  assigned, players (display name, skill level, `teamNo`), the caller's own
  confirmation status, and the confirmation deadline when applicable. The
  booking id is included only for the booking owner.

### 9.7 Confirm or Decline (Player)

- Method/path: `PUT /api/v1/matches/:id/confirmation`.
- Auth: `authenticate` + `requireRole('PLAYER')`; participant-only.
- Body: `{ decision: 'CONFIRMED' | 'DECLINED' }`.
- Behavior: allowed while the Match is `WAITING_FOR_CONFIRMATION` and before
  `confirmation_expires_at`; the decision is final.
- Idempotency: repeating the same decision returns `200`; a conflicting decision
  on an already-decided confirmation is rejected.
- Status: `200`; `400 VALIDATION_FAILED`; `401`; `403`; `404 MATCH_NOT_FOUND`;
  `409` (`MATCH_NOT_CONFIRMABLE`, `MATCH_CONFIRMATION_EXPIRED`,
  `MATCH_CONFIRMATION_ALREADY_DECIDED`).

### 9.8 Leave Match (Player)

- Method/path: `POST /api/v1/matches/:id/leave`.
- Auth: `authenticate` + `requireRole('PLAYER')`; participant-only.
- Behavior: allowed before the Match starts; since a Match requires exactly its
  full player count, leaving cancels the Match and releases the booking hold.
- Idempotency: leaving an already-cancelled Match returns `200`.
- Status: `200`; `401`; `403`; `404 MATCH_NOT_FOUND`; `409`
  (`MATCH_ALREADY_STARTED`, `MATCH_NOT_LEAVABLE`).

### 9.9 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `MATCHMAKING_DISABLED` | 409 | `MATCHMAKING_ENABLED` is false. |
| `MATCHMAKING_ACTIVE_REQUEST_LIMIT` | 409 | An `OPEN` request already exists for the match type. |
| `MATCHMAKING_INVALID_DATE` | 400 | Preferred date is in the past. |
| `MATCHMAKING_INVALID_TIME_WINDOW` | 400 | End <= start or window shorter than the match duration. |
| `MATCHMAKING_INVALID_SKILL_RANGE` | 400 | Invalid skill ids or `min.rank > max.rank`. |
| `MATCHMAKING_INVALID_DISTANCE` | 400 | `maxDistanceKm <= 0` or coordinates invalid. |
| `MATCHMAKING_REQUEST_NOT_FOUND` | 404 | Request id missing or not owned by the caller. |
| `MATCHMAKING_REQUEST_NOT_CANCELLABLE` | 409 | Request is not `OPEN`. |
| `MATCH_NOT_FOUND` | 404 | Match id missing or caller is not a participant. |
| `MATCH_NOT_CONFIRMABLE` | 409 | Match is not `WAITING_FOR_CONFIRMATION`. |
| `MATCH_CONFIRMATION_EXPIRED` | 409 | Confirmation deadline passed. |
| `MATCH_CONFIRMATION_ALREADY_DECIDED` | 409 | A different decision already recorded. |
| `MATCH_NOT_LEAVABLE` | 409 | Match status does not allow leaving. |
| `MATCH_ALREADY_STARTED` | 409 | `scheduled_at` reached or Match `IN_PROGRESS`. |

Global codes remain `VALIDATION_FAILED` (400), `INTERNAL_ERROR` (500), and
`AUTH_*` per `docs/architecture/conventions.md` and the Auth Tech Design.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. Existing objects
used: `MATCHMAKING_REQUESTS` §3.11, `MATCHMAKING_MATCHES` §3.12, `MATCHES`
§3.13, `MATCH_PLAYERS` §3.14, `MATCH_CONFIRMATIONS` §3.15, `BOOKINGS` §3.8,
`COURTS`/`FACILITIES` §3.5–§3.6, `SKILL_LEVELS` §3.2, `SYSTEM_CONFIGS` §3.26,
`NOTIFICATIONS` §3.24.

**No new table is proposed.** Approved deltas (approved by the human owner on
2026-09-26 and applied to the authoritative
`docs/architecture/database-schema.md` in the same working session; the
resulting migration is still required):

1. **Document `MATCHES.booking_id`** — already present in the Drizzle schema and
   migration (`matches_booking_id_unique`, FK → `BOOKINGS.id`) and consistent
   with §5.9, but missing from §3.13. Documentation-only; no migration.
2. **`MATCHES.court_search_expires_at timestamp NULL`** — snapshot of the
   court-search deadline, set at Match creation from
   `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`.
3. **`MATCHES.confirmation_expires_at timestamp NULL`** — snapshot of the
   confirmation deadline, set when entering `WAITING_FOR_CONFIRMATION` from
   `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`.
4. **`MATCHES.cancellation_reason varchar NULL`** — reason code for a cancelled
   Match (for notification and UI), e.g. `COURT_SEARCH_TIMEOUT`,
   `CONFIRMATION_TIMEOUT`, `CONFIRMATION_DECLINED`, `BOOKING_FAILED`,
   `INSUFFICIENT_PLAYERS`.
5. **Indexes** (non-breaking additions):
   - `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'`
     (unique) — at most one open request per Player and match type.
   - `MATCHMAKING_REQUESTS (status, match_type, preferred_date, created_at)` —
     matching scan ordered by oldest request.
   - `MATCHES (status, scheduled_at)` — scheduler time transitions.
   - `MATCHES (status, court_search_expires_at)` — court-search timeout sweep.
   - `MATCHES (status, confirmation_expires_at)` — confirmation timeout sweep.
   - `MATCH_PLAYERS (player_id, match_id)` — "my matches" lookup.
   - `MATCH_CONFIRMATIONS (match_id, status)` — confirmation tally.

**Documented status value vocabularies** (currently `varchar` with no CHECK):
`MATCHMAKING_REQUESTS.status` = `OPEN | MATCHED | CANCELLED | EXPIRED`;
`MATCHES.status` = `WAITING_FOR_COURT | WAITING_FOR_CONFIRMATION | CONFIRMED |
IN_PROGRESS | COMPLETED | CANCELLED`; `MATCH_PLAYERS.status` = `ACTIVE | LEFT`;
`MATCH_CONFIRMATIONS.status` = `PENDING | CONFIRMED | DECLINED`;
`MATCHMAKING_MATCHES.status` = `MATCHED`. Per §21 Q6, status vocabularies are
documented only; no CHECK constraints are added, consistent with the existing
schema style and enforced by application validation.

Migration impact/backfill: new columns are nullable; existing rows are
unaffected; no data backfill is required. `MATCHMAKING_*` config defaults
already exist in §8.3 and must be seeded into `SYSTEM_CONFIGS`.

## 11. Security

- **Authentication boundary**: existing session-cookie middleware; no new
  mechanism. The current `authenticate` contains a temporary Admin bypass and
  the real Auth/CSRF middleware is not yet implemented; Matchmaking endpoints
  must not be exposed to untrusted clients until real authentication and the
  shared CSRF middleware land.
- **Authorization boundary**: all endpoints require `PLAYER`; every request and
  Match operation is scoped to the caller (owner or `MATCH_PLAYERS`
  participant). Non-owner/participant access returns `404` to avoid leaking
  existence.
- **Input/output protection**: Zod at the boundary; parameterized queries only;
  responses never expose SQL, internal ids outside the contract, or other
  Players' private data beyond the PRD-approved profile fields.
- **CSRF**: `POST`/`PUT` requests must carry `X-CSRF-Token` per the confirmed
  double-submit-cookie design once the shared middleware exists
  (`docs/architecture/conventions.md`).
- **Sensitive data**: no payment credentials or provider payloads are handled by
  Matchmaking; booking/payment details stay in the Booking/Payment modules.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Request expires before matching | `expires_at <= now()` | Request → `EXPIRED`; removed from matching | Owner notified; may create a new request |
| Player cancels while matched | Request no longer `OPEN` | `409 MATCHMAKING_REQUEST_NOT_CANCELLABLE` | Player uses Match leave instead |
| No compatible group yet | Anchor has < required compatible | Requests stay `OPEN` | Retried next tick |
| Two engine runs pick the same request | `FOR UPDATE SKIP LOCKED` + status predicate | Only one creates the Match | Partial unique index blocks duplicates |
| No court found | No candidate in radius/availability | Match stays `WAITING_FOR_COURT` | Retried until `court_search_expires_at`, then `CANCELLED` + notified |
| Court contention on hold | Booking returns `BOOKING_SLOT_UNAVAILABLE` | Try next candidate court | Match stays `WAITING_FOR_COURT` if all fail |
| Booking creation error | Booking module error | Match stays `WAITING_FOR_COURT`; error logged | Retried until timeout |
| Deterministic booking failure | `COURT_NOT_BOOKABLE` / `BOOKING_OUTSIDE_ADVANCE_WINDOW` / `BOOKING_ACTIVE_LIMIT_REACHED` / `BOOKING_DISABLED` | No candidate can succeed; Match stays `WAITING_FOR_COURT` until `court_search_expires_at`, then `CANCELLED` | Distinct failure reason logged; Players may need a new request/date |
| Payment/confirmation deadline overlap | Booking `expires_at` reached before all confirmations | Match → `CANCELLED` (`BOOKING_FAILED`); hold released | Payer did not complete payment/confirmation in time |
| Booking hold expires | `BOOKINGS.status = EXPIRED` at reconcile | Match → `CANCELLED` (`BOOKING_FAILED`) | Players notified; new request needed |
| Player declines confirmation | `MATCH_CONFIRMATIONS.status = DECLINED` | Match → `CANCELLED`; hold released | All Players notified |
| Confirmation timeout | `confirmation_expires_at <= now()` and any `PENDING` | Match → `CANCELLED`; hold released | Players notified |
| Duplicate confirm request | Confirmation already decided | Same decision → idempotent `200`; different → `409` | None needed |
| Leave before start | Participant action, `now < scheduled_at` | Player → `LEFT`; Match → `CANCELLED`; hold released | Remaining Players notified; new requests needed |
| Leave after start | `now >= scheduled_at` or `IN_PROGRESS` | `409 MATCH_ALREADY_STARTED` | Not permitted |
| Concurrent leave/confirm | Row lock; status already changed | Idempotent outcome; no double release/refund | Booking module enforces single release |
| Scheduler tick missed (downtime) | Catch-up sweep at startup | Due transitions applied promptly | Effective-status reads hide stale state meanwhile |

## 13. Concurrency / Idempotency

- **Request creation**: the "one `OPEN` request per match type" rule is checked
  inside the creation transaction. A partial unique index on
  `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'` is the
  final guard (§21 Q3).
- **Match creation**: `SELECT ... FOR UPDATE SKIP LOCKED` on candidate requests,
  re-verification of `status = 'OPEN'` and compatibility, and the partial unique
  index `UNIQUE (matchmaking_request_id) WHERE status = 'MATCHED'` (§5.4) make
  Match creation atomic and duplicate-proof. The transaction boundary wraps
  `MATCHES` + `MATCH_PLAYERS` + `MATCHMAKING_MATCHES` inserts and the request
  status updates; any failure rolls back the whole Match.
- **Court selection**: BookingModule owns court-level concurrency (row lock on
  the court plus the booking exclusion constraint). Matchmaking treats a
  contention failure as "try next court" and never assumes a hold.
- **Confirmation**: the Match row is locked; the confirmation row decision is
  final. The tally is computed under the same lock so the Match cannot be
  confirmed twice.
- **Timeout transitions**: each category uses one atomic select-and-update with
  an expected-source-status predicate and `FOR UPDATE SKIP LOCKED`, so an
  already-transitioned row is never processed twice. Illustrative shape:

  ```sql
  UPDATE matches
  SET status = 'CANCELLED', cancellation_reason = 'COURT_SEARCH_TIMEOUT',
      updated_at = now()
  WHERE id IN (
    SELECT id FROM matches
    WHERE status = 'WAITING_FOR_COURT' AND court_search_expires_at <= now()
    ORDER BY court_search_expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT $batch
  )
  RETURNING id;
  ```

- **Booking reconciliation idempotency**: applying "booking `CONFIRMED` →
  Match `CONFIRMED`" only matches `WAITING_FOR_CONFIRMATION` (or
  `WAITING_FOR_COURT` when confirmation is disabled) and is a no-op otherwise.
- **Releasing a booking**: performed through `MatchBookingPort`; the Booking
  module guarantees a single release/refund per booking.
- In-memory state is never the coordination source; the database is.

## 14. Performance

- **Matching scan**: bounded by `match_type`, `preferred_date`, and `OPEN`
  status via the index in §10, ordered by `created_at`; batch-sized per tick.
  Candidate groups are small (2 or 4), so the greedy selection is cheap.
- **Distance**: Haversine computed in application code over the small candidate
  set; no PostGIS and no cross-join over all Players.
- **Court candidates**: one date and the group's radius; availability is
  delegated to Booking and remains a bounded, indexed query.
- **Polling load**: 5–10 second client polling on small payloads; no shared
  cache introduced.
- **Scheduler**: 60-second tick with fixed batch limits per category so tick
  duration stays bounded; remainder work continues next tick.

## 15. Events / Notifications

- **Notifications (in-app, `NOTIFICATIONS`)**, per the PRD:
  - Match found (Match created) — to all matched Players.
  - Confirmation required — to all matched Players when entering
    `WAITING_FOR_CONFIRMATION`.
  - Confirmation success (Match `CONFIRMED`) — to all Players.
  - Match cancelled with reason (`COURT_SEARCH_TIMEOUT`,
    `CONFIRMATION_TIMEOUT`, `CONFIRMATION_DECLINED`, `BOOKING_FAILED`,
    `INSUFFICIENT_PLAYERS`) — to all Players.
  - Request expired — to the request owner.
- **Triggers**: notification rows are written in the same transaction as the
  state change where practical; because transitions are idempotent, retries do
  not duplicate notifications.
- **Delivery/retry**: client polls unread notifications (confirmed strategy);
  no push/email in MVP.
- **Background processing**: the in-process scheduler owns all Matchmaking
  deadline work; no queue or external job runner.

## 16. Testing Considerations

- **Unit**: skill-range intersection; common-window intersection and minimum
  duration; pairwise distance and centroid math; oldest-first group selection;
  timeout predicates; cancellation-reason mapping; Zod schemas.
- **Integration/persistence**: atomic Match creation under concurrent engine
  runs; `FOR UPDATE SKIP LOCKED` behavior; partial unique index enforcement;
  transaction rollback on partial group; scheduler expiry/transition batches;
  booking reconciliation reads.
- **API-level**: `PLAYER`-only auth; owner/participant scoping; validation
  errors; pagination `meta`; feature error codes; idempotent cancel, confirm,
  and leave.
- **Critical E2E**: create request → matched → court found → all confirm +
  booking paid → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`; cancel an `OPEN`
  request; court-search timeout cancellation; confirmation-timeout cancellation;
  leave before start.
- **Concurrency/idempotency**: two engine runs matching the same requests; two
  Players confirming simultaneously; leave racing confirmation; booking hold
  expiring during confirmation; duplicate confirm/leave requests.

## 17. Migration / Rollout

- **Migrations** (only after schema-change approval):
  1. Add nullable `MATCHES.court_search_expires_at`,
     `MATCHES.confirmation_expires_at`, `MATCHES.cancellation_reason`.
  2. Add the indexes in §10, including the "one open request per match type"
     partial unique index.
  3. No status CHECK constraints (documentation-only, per §21 Q6).
- **Seed**: `MATCHMAKING_*` keys (§8.3 defaults) into `SYSTEM_CONFIGS`.
- **Sequencing**: schema/config before enabling the scheduler and endpoints;
  Booking/Payment primitives must exist before automatic holds are enabled.
- **Backward compatibility**: new columns are nullable; no existing row is
  changed; `MATCHES.booking_id` already exists.
- **Rollback**: disable the scheduler, drop the new indexes/columns; Matchmaking
  tables are additive to the existing schema.
- **Feature gating**: `MATCHMAKING_ENABLED` gates request creation and engine
  work.

## 18. Alternatives Considered

- **Per-request async matching (event-driven)**: rejected — the confirmed MVP
  uses an in-process periodic scheduler; a queue is not approved.
- **Weighted scoring / ranking**: rejected — PRD and matrix mandate
  `created_at ASC` with no scoring.
- **PostGIS / geospatial index**: rejected — Haversine over a bounded candidate
  set is sufficient and avoids an unapproved extension.
- **Store matchmaking deadlines in a separate table**: rejected in favor of
  nullable `MATCHES` columns; Match is the lifecycle owner and already carries
  scheduling timestamps.
- **Derive deadlines from `created_at` + live config**: rejected — violates the
  snapshot semantics of §8.1.
- **Cross-module event bus for booking confirmation**: rejected — scheduler
  reconciliation against `BOOKINGS.status` avoids an unapproved pattern.
- **WebSocket/SSE updates**: rejected — HTTP polling is confirmed.

## 19. Observability

- **Logs**: engine tick summary (scanned/formed/created counts), Match creation
  with request and match ids, court-search attempts and outcome, timeout
  cancellations with reason, confirmation decisions and tallies, booking
  reconciliation outcomes. Never log secrets or provider payloads.
- **Metrics**: requests created/expired/cancelled, groups formed, Matches
  created, court-search failure rate, confirmation-timeout rate, leave count,
  average time request→match.
- **Alerts**: rising court-search failures or confirmation timeouts are
  candidate operational signals. Observability tooling remains TBD.

## 20. Acceptance / Verification Considerations

- **Given** enough compatible `OPEN` requests for a match type,
  **When** the engine runs,
  **Then** exactly one Match is created, each involved request becomes
  `MATCHED`, and the Match enters `WAITING_FOR_COURT`.

- **Given** two engine runs process the same requests concurrently,
  **When** both attempt Match creation,
  **Then** only one Match is committed and no request produces two successful
  results.

- **Given** a Match in `WAITING_FOR_COURT` with no available court,
  **When** `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES` elapses,
  **Then** the Match becomes `CANCELLED` with reason `COURT_SEARCH_TIMEOUT` and
  Players are notified.

- **Given** a Match with a court and booking hold,
  **When** every required Player confirms and the booking is `CONFIRMED`,
  **Then** the Match becomes `CONFIRMED`.

- **Given** a Match in `WAITING_FOR_CONFIRMATION`,
  **When** one Player declines or the confirmation deadline passes,
  **Then** the Match becomes `CANCELLED` and the booking hold is released.

- **Given** a Player with an `OPEN` request,
  **When** they create another request for the same match type,
  **Then** the request is rejected with `409 MATCHMAKING_ACTIVE_REQUEST_LIMIT`.

- **Given** a Player who is not a participant,
  **When** they request a Match detail or attempt to confirm/leave,
  **Then** access is denied with `404 MATCH_NOT_FOUND`.

- **Given** a Match before `scheduled_at`,
  **When** a Player leaves,
  **Then** the Match is `CANCELLED`, the booking hold is released, and remaining
  Players must create new requests.

- **Given** a Match after it starts,
  **When** a Player attempts the normal leave flow,
  **Then** the request is rejected with `409 MATCH_ALREADY_STARTED`.

- **Given** a `CONFIRMED` Match,
  **When** `scheduled_at` and then the configured duration elapse,
  **Then** the Match becomes `IN_PROGRESS` and then `COMPLETED` without result
  recording.

Verification: unit/integration/API tests per §16; migration check for the new
columns and indexes; manual concurrency check for the engine.

## 21. Resolved Decisions / Open Questions

All technical decisions were resolved by the human owner on 2026-09-26.

| # | Question | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Q1 | Drizzle ORM versus `tech-stack.md` and `documentation-guide.md` §15. | Keep Drizzle as the confirmed ORM; update `tech-stack.md` and correct the §15 note. | 2026-09-26 | RESOLVED |
| Q2 | `MATCHES` schema deltas and `MATCHES.booking_id` documentation. | Approve all: document `booking_id`; add `court_search_expires_at`, `confirmation_expires_at`, `cancellation_reason`. | 2026-09-26 | RESOLVED |
| Q3 | "One `OPEN` request per `(player_id, match_type)`" partial unique index. | Approve the index as the final guard. | 2026-09-26 | RESOLVED |
| Q4 | Match `CONFIRMED` condition. | Requires both all confirmations `CONFIRMED` and the linked booking `CONFIRMED`. | 2026-09-26 | RESOLVED |
| Q5 | Booking hold expiring/cancelling before Match confirmation. | Match → `CANCELLED` with reason `BOOKING_FAILED`. | 2026-09-26 | RESOLVED |
| Q6 | `CHECK` constraints for status vocabularies. | Documentation-only; no `CHECK` constraints, consistent with existing schema style. | 2026-09-26 | RESOLVED |
| Q7 | Notification wording and confirmation reminder. | Use the events in §15; no confirmation reminder; exact copy follows existing notification style at implementation. | 2026-09-26 | RESOLVED |
| Q8 | Namespace for Match endpoints. | Keep `/api/v1/matches`; tournament matches remain nested under `/api/v1/tournaments`. | 2026-09-26 | RESOLVED |
| Q9 | `requireRole` signature. | Use the existing variadic `requireRole('PLAYER')`; no middleware change. | 2026-09-26 | RESOLVED |

**Required authoritative documentation updates (Q1–Q2), applied on 2026-09-26
under the no-doc-debt rule:**

- `docs/architecture/tech-stack.md` — confirm Drizzle ORM and migrations as the
  data-access technology; add to Confirmed Decisions and the Change Log.
- `docs/documentation-guide.md` §15 — remove Drizzle from "deliberately not
  imported".
- `docs/architecture/database-schema.md` — document `MATCHES.booking_id`; add
  `court_search_expires_at`, `confirmation_expires_at`,
  `cancellation_reason`; record the new indexes and status vocabularies;
  Change Log entry.

The resulting migration (columns, indexes, config seed) remains implementation
work and is not performed by this document.

## 22. Decision Status

```text
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26)
Approved by: Human owner (2026-09-26)
Approved decision/reference: §21 Resolved Decisions, 2026-09-26
```

This document does not create a new approval workflow. It follows the human
readiness gate in `docs/documentation-guide.md` §6.3. All decisions are resolved
and the document was marked `Ready` on 2026-09-26 after the human readiness
gate was explicitly given and the required authoritative documentation updates
were applied.
