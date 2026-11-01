# Matchmaking (Invitation-based) — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/matchmaking/matchmaking/prd.md
Scope: Invitation-based matchmaking — match request lifecycle, player browsing and direct invitations, invitation timeout, group formation, owner-driven court booking linkage, and pre-match leaving
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26; direct-invitation decisions 2026-10-04; invitation-only scope reduction 2026-10-10)
```

> Extension: §24 (Social Matchmaking, Phase 2) is **Ready / Decision Status
> Approved** by the human owner on 2026-10-31. It does not change the Ready status of §1–§23, which describe the
> implemented invitation-only baseline.
>
> Ready. Original technical decisions were resolved by the human owner on
> 2026-09-26 (see §21), the direct-invitation path was added on 2026-10-04, and
> on 2026-10-10 the human owner reduced the MVP scope to invitation-only: no
> automatic matching, no automatic court selection, no separate confirmation
> step, manual court booking by the request owner, and a per-invitation
> timeout. The human readiness gate per `docs/documentation-guide.md` §6.3 was
> explicitly given on 2026-09-26.

## 2. Context

This design implements the Player-facing invitation-based matchmaking behavior
in `docs/features/matchmaking/matchmaking/prd.md`:

1. A Player creates a Matchmaking Request (`SINGLES` or `DOUBLES`) with a
   preferred date/time window, a skill preference, and an area.
2. The Player browses suitable Players and sends direct invitations to specific
   Players. Each invitation has its own deadline.
3. An invited Player accepts or declines. Acceptance binds the Player to the
   sender's group.
4. When the group reaches the full required player count, a Match is formed
   (without a court) and the request becomes `MATCHED`.
5. The request owner chooses a court and creates the booking through the
   existing Booking flow; the Match is linked to that booking and becomes
   `CONFIRMED`.
6. A Player may leave a Match before it starts; requests and invitations
   expire/cancel on their configured deadlines.

The feature crosses these boundaries:

- **MatchmakingModule (new)**: request lifecycle, candidate browsing,
  invitation lifecycle and timeout, group formation, Match lifecycle and leave,
  booking linkage, scheduler jobs.
- **BookingModule (existing design, partially implemented in code)**: owns
  availability, pricing, holds, and the Booking lifecycle. In MVP the request
  owner creates a booking through the normal Player booking flow; Matchmaking
  only links the resulting booking to the Match. Matchmaking does **not** create
  bookings or holds automatically.
- **PaymentModule (platform capability)**: owns payment/refund execution for the
  booking; Matchmaking does not handle payment.
- **NotificationModule (platform capability)**: persists in-app notifications.
- **Scheduler**: a single in-process interval job (confirmed in
  `tech-stack.md`) drives request expiry, invitation expiry, and time-based Match
  transitions.

## 3. Technical Problem

The design must solve:

1. **Candidate discovery without automatic matching** — let a request owner
   browse Players by name/skill; request time, type and area are invitation context.
   There is no compatibility-matching engine and no distance computation; candidate filtering is by name/skill only, without invitee activity requirements.
2. **Invitation lifecycle under concurrency** — invitations are created, accepted,
   declined, cancelled, and expired; only pending invitations may be responded
   to; the request owner may invite several specific Players.
3. **Deterministic group formation** — when the owner plus accepted invitees reach
   the full player count, exactly one Match is formed and the request becomes
   `MATCHED`; a request may produce at most one successful Match.
4. **Snapshot deadlines** — request and invitation deadlines are snapshotted at
   creation so later configuration changes do not move an established deadline
   (`docs/business-rules-config-matrix.md` §8.1).
5. **Request expiry with a partial group** — expiring a request closes pending
   invitations and releases accepted invitees with a notification; no automatic
   replacement group is created.
6. **Booking linkage without auto-booking** — the request owner books a court via
   the normal Booking flow; Matchmaking links the booking to the Match. No
   centroid/distance logic and no automatic hold.
7. **Pre-match leaving** — a Match requires exactly its full player count, so any
   leave before start cancels the Match.

## 4. Goals

- Provide REST endpoints for request creation/cancel/listing, candidate browsing,
  invitation create/list/respond/cancel, Match retrieval/leave, and booking
  linkage.
- Implement invitation lifecycle, timeout, and group formation exactly as defined
  by `docs/business-rules-config-matrix.md` §3.
- Make group formation atomic and idempotent, guarded by row locks and the
  partial unique index on successful matchmaking results.
- Never create bookings, holds, or court selections inside Matchmaking; reuse the
  Booking module through the Player-facing flow.
- Enforce all Matchmaking deadlines with the confirmed in-process scheduler and
  read-time effective-status filtering.
- Keep MatchmakingModule, BookingModule, PaymentModule, and NotificationModule
  responsibilities separate.

## 5. Non-Goals

- Automatic compatibility matching of Players.
- ELO / dynamic MMR or any advanced skill scoring.
- Automatic court finding, distance/centroid-based court selection, and
  automatic booking creation.
- Automatic substitution after a Player leaves (Out of MVP).
- Group chat.
- Split bill / per-player payment of the match booking.
- Tournament matchmaking or bracket logic.
- Match rescheduling after `CONFIRMED`.
- A separate player confirmation step: accepting an invitation is the commitment.
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
  §3.13 `MATCHES`, §3.14 `MATCH_PLAYERS`, §3.8 `BOOKINGS`, §5.4 (matchmaking
  success integrity), §5.9 (Match/Booking relationship), §3.29
  `MATCHMAKING_INVITATIONS`, §8 (Lifecycle Summary)
- Booking implementation contract: `docs/features/booking/player-booking/tech-design.md`
- Payments/refunds contract: `docs/features/platform/payments-refunds/tech-design.md`
- Notification contract: `docs/features/platform/notifications/tech-design.md` (Ready),
  following `docs/architecture/tech-stack.md` (in-app NOTIFICATIONS).

> Section reference note: the request named `database-schema.md §3.5 (BOOKINGS)`,
> but in the current authoritative schema `BOOKINGS` is §3.8. This design uses
> §3.8.

### 6.1 Documentation Conflicts (Resolved 2026-09-26)

1. **ORM conflict (resolved).** The repository uses Drizzle ORM
   (`backend/src/db/schema/*`, `drizzle-orm`/`drizzle-kit` in
   `backend/package.json`). Per §21 Q1, Drizzle is confirmed as the ORM and
   `docs/architecture/tech-stack.md` was updated.
2. **`MATCHES.booking_id` documentation gap (resolved).** `MATCHES.booking_id`
   (unique FK → `BOOKINGS.id`) already exists in the Drizzle schema and
   migration and is consistent with `database-schema.md` §5.9. It is now
   documented in §3.13.

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
  - `MatchInvitationService` — candidate browsing, invitation creation,
    acceptance/decline/cancel, and group-formation handoff.
  - `MatchService` — Match retrieval, booking linkage, leaving, lifecycle
    transitions, and time-based advancement.
  - `MatchmakingScheduler` — in-process tick that invokes expiry and
    transition jobs.
- **Repositories** (`repositories/matchmaking/*`): all SQL/query access,
  row locking (`FOR UPDATE SKIP LOCKED`), inserts and atomic updates. No
  user-facing policy here.
- **Booking boundary**: the request owner creates a booking through the
  **Player-facing Booking flow**; Matchmaking never creates a booking or hold and
  does not write `BOOKINGS`. Matchmaking only stores the resulting
  `MATCHES.booking_id`/`court_id` when the owner links it (§7.4). There is no
  `MatchBookingPort` `createMatchHold`/`releaseMatchHold` in MVP.
- **Notification boundary**: Matchmaking calls a `NotificationService` that
  inserts in-app `NOTIFICATIONS` rows.
- **Config boundary**: `MatchmakingConfigService` reads `SYSTEM_CONFIGS` with
  the defaults from `docs/business-rules-config-matrix.md` §8.3 and snapshots
  deadlines at entity creation.

Cross-module interfaces are declared in `backend/src/contracts/`:
`NotificationService.ts`, `CourtService.ts`, `PlayerProfileService.ts`, and
`MatchModule.ts`. `MatchBookingPort.ts` is not used in MVP and is removed or left
unused until auto-booking is considered.

**Single Match core (Q17, resolved 2026-10-10).** `MatchModule` is the single
place that writes `MATCHES` and `MATCH_PLAYERS`. Matchmaking and Tournament both
create Matches through `MatchModule.createMatchWithPlayers(...)` and only write
their own link table (`MATCHMAKING_MATCHES` / `TOURNAMENT_MATCHES`). This keeps
`team_no`, the status vocabulary, and participant rows consistent across both
features.

### 7.2 Candidate Browsing and Invitations

Candidate browsing is manual; there is no automatic matching.

**Candidate query.** For an `OPEN` request owned by the caller:

- Return Players (via their `PLAYER_PROFILES`) who are eligible to be invited to
  the request: exclude the caller, Players already in the caller's group (owner
  plus accepted invitees), and Players with a pending invitation to the request.
- Search existing non-deleted Players with profiles by name; do not filter by
  online presence or ACTIVE status, match type, area, or unstored availability.
  The list defaults to Players
  whose skill level is within the request's `[min, max]` range, but the owner may
  include Players outside the range; an out-of-range candidate/invitee is shown
  with a skill-mismatch warning. Skill is not hard-enforced.
- Offset pagination (`page`, `limit`) with `meta`.

**Create invitation.** While the request is `OPEN`:

1. Validate the invitee exists, is not the caller, and is not already invited /
   in the group.
2. Compute `expires_at = min(now + MATCHMAKING_INVITATION_TIMEOUT_MINUTES,
   request.expires_at)`.
3. Insert a `MATCHMAKING_INVITATIONS` row with `status = 'PENDING'`. The partial
   unique index `(request_id, invitee_id) WHERE status = 'PENDING'` prevents
   duplicates.

**Respond.** While the invitation is `PENDING` and not past `expires_at`, the
invitee may `ACCEPT` or `DECLINE`. A decision is final and idempotent for the
same decision. Acceptance binds the Player to the sender's group.

**Cancel.** The inviter may cancel a `PENDING` invitation at any time.

### 7.3 Invitation Timeout and Request Expiry

- Invitations are claimed and expired by the scheduler: `PENDING` rows with
  `expires_at <= now()` become `EXPIRED`; the inviter is notified.
- Requests are claimed and expired by the scheduler: `OPEN` requests with
  `expires_at <= now()` become `EXPIRED`.
- **Request expiry with a partial group.** When an `OPEN` request is expired or
  cancelled, its pending invitations are closed (`EXPIRED` for expiry,
  `CANCELLED` for cancellation) and every accepted invitee is released with a
  notification. No Match or replacement group is created. Because the group is
  not yet a Match, released invitees are simply no longer bound; they must create
  or reuse another request.
- Expiry is atomic and idempotent: a row already transitioned by another tick, a
  Player action, or an acceptance no longer matches the predicate.

### 7.4 Group Formation and Atomic Match Creation

When an invitation is accepted, the service evaluates whether the group is
complete.

**Step A — determine the group.**
The group is the request owner plus the requests' acceptances. The required
count is 2 for `SINGLES` and 4 for `DOUBLES`.

**Step B — atomic acceptance and Match creation.**
Use one caller-owned transaction across invitation response and MatchModule.
Lock affected USERS scheduling rows by ascending id, then request, invitations,
Match and Booking as applicable. Re-read membership after locking; if membership
changed outside the locked set, retry with the complete sorted Player set.
Revalidate OPEN/effective expiry, pending invitation and schedule reservations.
Persist acceptance. If the group is not full, commit that acceptance only; if
full, create MATCHES/MATCH_PLAYERS through MatchModule, insert the one
MATCHMAKING_MATCHES link, mark the request MATCHED, and close surplus pending
invitations in the same transaction. Any formation failure rolls back the final
acceptance. A request's partial unique successful-result index is the duplicate
formation guard, not the cross-request Player scheduling guard.
Initial scheduled_at is preferred start; duration comes from the request snapshot.
PENDING_COURT reserves the full preferred window until paid booking linkage.

**`team_no` assignment.** For `SINGLES`, `team_no` = 1 and 2 (one Player each).
For `DOUBLES`, the four Players are shuffled and assigned `team_no` = 1, 1, 2, 2
(random teams, no partner preference).

### 7.5 Court Booking by the Request Owner

Matchmaking does not select a court and does not create a booking or hold.

1. Once the Match is `PENDING_COURT`, the request owner opens the Player Booking
   flow, searches courts by area/date/time, selects an available slot, and
   creates the booking (`PENDING_PAYMENT` hold, then payment), following all
   Booking rules (`docs/features/booking/player-booking/tech-design.md`).
2. When the owner has a booking for the Match, the owner links it:
   `POST /api/v1/matches/:id/booking` with the `bookingId`. The service validates
   that the actor is the request owner, the Match is `PENDING_COURT`, and the
   booking belongs to the owner and is not already linked to another Match.
3. In one Matchmaking transaction (through `MatchModule`): set
   `MATCHES.booking_id`, derive `MATCHES.court_id` from the booking, set
   `MATCHES.scheduled_at` from the booking's `booking_date` + `start_time`, and
   set `status = 'CONFIRMED'`.
4. Notify all Players that the court is booked.

If the booking is not paid and expires, the Booking flow releases the slot; the
Match remains `PENDING_COURT` and the owner may book again. Matchmaking does not
manage booking payment; the Booking module does.

**Booking owner.** The request owner is the booking owner and is responsible for
paying the full booking amount. Split Bill is out of MVP; the other Players do
not pay separately. Matchmaking exposes the booking id only to the request owner
in the Match detail response.

### 7.6 Match Lifecycle after Booking

- PENDING_COURT → CONFIRMED when owner links a validated paid booking.
- PENDING_COURT → CANCELLED at booking_deadline_at (COURT_NOT_BOOKED).
- PENDING_COURT → CANCELLED on leave before deadline (INSUFFICIENT_PLAYERS).
- CONFIRMED → CANCELLED on leave before booked start or linked-booking cancel.
- CONFIRMED → IN_PROGRESS at booked start; set started_at to scheduled start.
- IN_PROGRESS → COMPLETED at booked end; set completed_at to booked end.
- Reconcile cancelled/unusable bookings before time advancement. Jobs only
  process Matchmaking-linked Matches. No result is recorded for casual Matches.

### 7.7 Scheduler

A single in-process `setInterval` scheduler (confirmed in `tech-stack.md`; no
queue or external infrastructure), ticking every **60 seconds**, matching the
Booking background-job cadence. Each tick is independent and safe to overlap;
correctness never depends on a tick running exactly once.

Per tick (only Matchmaking-linked Matches):

1. Expire `OPEN` requests past `expires_at` and close their pending invitations;
   release accepted invitees with a notification.
2. Expire `PENDING` invitations past their own `expires_at`.
3. Cancel overdue PENDING_COURT Matches; reconcile linked-booking cancellations
   and process durable cancellation jobs.
4. Advance only Matchmaking CONFIRMED/IN_PROGRESS Matches with valid bookings
   at booked start/end; set scheduled lifecycle timestamps, including catch-up.

Each category is claimed with an atomic select-and-update that matches only the
expected source status, using `FOR UPDATE SKIP LOCKED` (see §13). A row already
transitioned by another tick or a Player action no longer matches the predicate
and is not processed twice. Startup performs one catch-up sweep so transitions
missed during downtime are applied promptly.

### 7.8 Client/Server Boundary and Real-Time Updates

- Players track request, invitation, and Match state by polling `GET
  /api/v1/matchmaking-requests`, `GET /api/v1/matchmaking-invitations`, and
  `GET /api/v1/matches/:id` every 5–10 seconds (confirmed HTTP polling).
- Server-side state is always authoritative; the client never decides a
  transition. Effective status is computed at read time against request/invitation deadlines, booking_deadline_at,
  booked start/end and linked-booking state so no stale state is exposed between ticks.
- A read never triggers a persisted transition and never emits notifications.

### 7.9 Timezone

All `date` + `time` combinations and deadline comparisons use the fixed
application timezone `Asia/Ho_Chi_Minh`, consistent with the Booking design.
`expires_at` and `scheduled_at` are stored as timestamps derived in that zone.

### 7.10 Cross-Cutting Concerns

- **Validation**: Zod schemas at the request boundary via the existing
  `validate` middleware.
- **Errors**: existing `AppError` subclasses and centralized `errorHandler`
  producing `{ error: { code, message, details } }`.
- **Auth**: `authenticate` + `requireRole('PLAYER')`, session-based
  `shared/auth/authenticate.middleware`; the shared CSRF middleware
  (`csrfProtection`) is active for `/api/v1`.
- **Config**: `MATCHMAKING_*` values read through `MatchmakingConfigService`;
  deadlines snapshotted at creation.

## 8. Behavior, State, and Flow

### 8.1 Matchmaking Request State Machine

```text
OPEN ──► MATCHED      (the group reaches full count)
  │
  ├──► CANCELLED      (owner cancels while OPEN)
  └──► EXPIRED        (expires_at reached while OPEN)
```

No transition returns a request to `OPEN`. A cancelled or expired request is
removed from matching; the Player creates a new one. Cancelling/expiring a
request closes its pending invitations and releases accepted invitees.

### 8.2 Match State Machine

```text
PENDING_COURT ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
      │                 │
      └──► CANCELLED    └──► CANCELLED (leave before start)
```

| From | To | Trigger |
| --- | --- | --- |
| `PENDING_COURT` | `CONFIRMED` | Request owner links a paid booking |
| `PENDING_COURT` | `CANCELLED` | Player leaves before start |
| `CONFIRMED` | `IN_PROGRESS` | `scheduled_at <= now()` |
| `CONFIRMED` | `CANCELLED` | Player leaves before start |
| `IN_PROGRESS` | `COMPLETED` | Match end reached |

- Preconditions: group full at Match creation; a booking linked before
  `CONFIRMED`.
- Postconditions: a request has at most one successful Match; no Match starts
  without the full required player count.
- `IN_PROGRESS` and later are not leavable through the normal leave flow.

### 8.3 Invitation State

```text
PENDING ──► ACCEPTED ──► WITHDRAWN (before formation only)
   ├─────► DECLINED
   ├─────► CANCELLED   (inviter cancels, or the request is cancelled)
   └─────► EXPIRED      (invitation timeout, or the request expires)
```

One row per `(request_id, invitee_id)` while pending; a decision is final.

### 8.4 Sequence — Request Creation to Match

```mermaid
sequenceDiagram
    participant P as Player (React)
    participant R as MatchmakingRequestService
    participant I as MatchInvitationService
    participant DB as PostgreSQL
    participant M as MatchService

    P->>R: POST /api/v1/matchmaking-requests
    R->>DB: INSERT request (OPEN, expires_at = now + REQUEST_EXPIRATION)
    R-->>P: 201 { request }
    P->>I: POST /api/v1/matchmaking-requests/:id/invitations { inviteeId }
    I->>DB: INSERT invitation (PENDING, expires_at = min(now+INVITE_TIMEOUT, request.expires_at))
    P->>I: invitation accepted by invitees...
    I->>DB: BEGIN; lock request; verify full count; INSERT match, match_players, matchmaking_matches; request -> MATCHED; COMMIT
    P->>M: POST /api/v1/matches/:id/booking { bookingId }
    M->>DB: set booking_id/court_id/scheduled_at; status -> CONFIRMED
```

### 8.5 Sequence — Two Invitations Accepted Concurrently

```mermaid
sequenceDiagram
    participant A as Accept (invitee X)
    participant B as Accept (invitee Y)
    participant DB as PostgreSQL

    A->>DB: BEGIN; SELECT request FOR UPDATE (acquires)
    B->>DB: BEGIN; SELECT request FOR UPDATE (waits)
    A->>DB: group not full -> commit acceptance only
    B->>DB: lock acquired; group now full -> INSERT match + result; request -> MATCHED; COMMIT
    DB-->>A: partial unique index blocks any duplicate MATCHED insert
```

### 8.6 Sequence — Leave Before Start

```mermaid
sequenceDiagram
    participant P as Player
    participant M as MatchService
    participant DB as PostgreSQL

    P->>M: POST /api/v1/matches/:id/leave
    M->>DB: BEGIN; SELECT match FOR UPDATE
    M->>M: validate participant + effective deadline/booked start + status leavable
    M->>DB: match_players -> LEFT
    M->>DB: MATCHES -> CANCELLED
    M->>DB: COMMIT
    M-->>P: 200 { status: CANCELLED }
```

Because a Match requires exactly its full player count, any leave before start
cancels the Match; remaining Players must create new requests. The booking, if
already created by the owner, is handled by the Booking cancellation/refund rules
(owned by Booking/Payment).

## 9. API Design

All paths are namespaced under `/api/v1`. Success responses use
`{ data: ... }`; collections add `meta: { page, limit, total, totalPages }`;
errors use `{ error: { code, message, details } }`.

### 9.1 Create Matchmaking Request (Player)

- Method/path: `POST /api/v1/matchmaking-requests`.
- Auth: `authenticate` + `requireRole('PLAYER')`.
- Body:
  - `matchType`: `SINGLES` | `DOUBLES`.
  - `preferredDate`: `YYYY-MM-DD`.
  - `preferredStartTime`, `preferredEndTime`: `HH:mm`; window length must be
    `>= MATCHMAKING_MATCH_DURATION_MINUTES`.
  - `minSkillLevelId`, `maxSkillLevelId`: valid `SKILL_LEVELS` ids with
    `min.rank <= max.rank`.
  - `area`: selected city/district text from shared facility-address values; context only.
  Snapshot `matchDurationMinutes` from config on creation (not caller-controlled).
- Response `201`: request id, status `OPEN`, all submitted fields, `expiresAt`.
- Rules: at most one `OPEN` request per `match_type` per Player; the preferred
  start (`preferredDate` + `preferredStartTime`) must be at least
  `MATCHMAKING_MIN_LEAD_TIME_MINUTES` in the future; feature gated by
  `MATCHMAKING_ENABLED`.
- Status: `201`; `400` (`VALIDATION_FAILED`, `MATCHMAKING_INVALID_TIME_WINDOW`,
  `MATCHMAKING_INVALID_SKILL_RANGE`, `MATCHMAKING_START_TOO_SOON`); `401`; `403`;
  `409` (`MATCHMAKING_DISABLED`, `MATCHMAKING_ACTIVE_REQUEST_LIMIT`,
  `MATCHMAKING_SCHEDULE_CONFLICT`).

### 9.2 List My Requests (Player)

- Method/path: `GET /api/v1/matchmaking-requests`.
- Auth: `authenticate` + `requireRole('PLAYER')`; scoped to the caller.
- Query: `status` (optional), `page`, `limit`.
- Response: paginated requests, newest first, with effective status.

### 9.3 Request Detail (Player)

- Method/path: `GET /api/v1/matchmaking-requests/:id`.
- Auth: owner or currently accepted invitee; non-member or missing id returns `404
  MATCHMAKING_REQUEST_NOT_FOUND`.
- Response: request context, accepted member summaries, required/current/remaining
  counts, expiresAt and matchId when formed. Detail includes `invitationId` for
  the caller's accepted membership (null otherwise), allowing scoped withdrawal.
  Invitation list includes nullable `matchId` for navigation after formation.
  Owner additionally sees management
  data. Pending invitees receive context through their own invitation, not this endpoint.

### 9.4 Cancel Request (Player)

- Method/path: `POST /api/v1/matchmaking-requests/:id/cancel`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only.
- Behavior: allowed only while `OPEN`; closes pending invitations, releases
  accepted invitees, and sets `CANCELLED`.
- Idempotency: cancelling an already `CANCELLED` request returns `200`.
- Status: `200`; `401`; `403`; `404`; `409`
  (`MATCHMAKING_REQUEST_NOT_CANCELLABLE`).

### 9.5 List My Matches (Player)

- Method/path: `GET /api/v1/matches`.
- Auth: `authenticate` + `requireRole('PLAYER')`; scoped to the caller's
  `MATCH_PLAYERS` and an existing `MATCHMAKING_MATCHES` link (never Tournament).
- Query: `status` (optional), `timeScope` (`UPCOMING` | `PAST` | `ALL`),
  `page`, `limit`.
- Response: paginated Match summaries (id, match type, status, scheduled time,
  court/facility summary when assigned), newest first.

### 9.6 Match Detail (Player)

- Method/path: `GET /api/v1/matches/:id`.
- Auth: participant-only; non-participant or missing id returns `404
  MATCH_NOT_FOUND`.
- Response: match type, status, `scheduledAt`, court/facility summary when
  assigned, price and payer (request owner) when a booking is linked, players
  (display name, skill level, `teamNo`), the group's required/current count, and
  the request owner flag. Detail includes nullable `scheduledEndAt`, numeric
  `price` and `cancellationReason`; the booked end/price are visible to participants,
  while the booking id is included only for the request owner.

### 9.7 Leave Match (Player)

- Method/path: `POST /api/v1/matches/:id/leave`.
- Auth: `authenticate` + `requireRole('PLAYER')`; participant-only.
- Behavior: PENDING_COURT is leavable before booking_deadline_at, CONFIRMED
  before booked start. Overdue pending-court returns effective cancelled state.
  Leaving cancels the Match and persists booking cancellation work if linked.
- Idempotency: leaving an already-cancelled Match returns `200`.
- Status: `200`; `401`; `403`; `404 MATCH_NOT_FOUND`; `409`
  (`MATCH_ALREADY_STARTED`, `MATCH_NOT_LEAVABLE`).

### 9.8 Link Booking to Match (Player)

- Method/path: `POST /api/v1/matches/:id/booking`.
- Auth: `authenticate` + `requireRole('PLAYER')`; request owner only.
- Body: `{ bookingId }`.
- Behavior: allowed while the Match is `PENDING_COURT`; validates the booking
  belongs to the owner, is paid/`CONFIRMED`, and is not linked to another Match;
  sets `court_id`, `booking_id`, `scheduled_at`, and `status = 'CONFIRMED'`.
- Status: `200`; `400 VALIDATION_FAILED`; `401`; `403`; `404 MATCH_NOT_FOUND`;
  `409` (`MATCH_NOT_PENDING_COURT`, `MATCH_BOOKING_INVALID`,
  `MATCH_BOOKING_ALREADY_LINKED`).

### 9.9 Browse Invite Candidates (Player)

- Method/path: `GET /api/v1/matchmaking-requests/:id/candidates`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only.
- Behavior: returns Players eligible to be invited by name and skill, without an activity-status filter, excluding the caller, Players already in the caller's group, and
  Players with a pending invitation. The list defaults to the request's skill
  range; the owner may include Players outside it, shown with a skill-mismatch
  warning.
- Query: `search` (name), `includeOutOfRange` (boolean, default false), `page`, `limit`.
  Order by normalized display name then player id.
- Response: paginated candidate summaries (player id, display name, skill level,
  skillMismatch).
- Status: `200`; `401`; `403`; `404 MATCHMAKING_REQUEST_NOT_FOUND`; `409
  MATCHMAKING_REQUEST_NOT_OPEN`.

### 9.10 Send Direct Invitation (Player)

- Method/path: `POST /api/v1/matchmaking-requests/:id/invitations`.
- Auth: `authenticate` + `requireRole('PLAYER')`; owner-only.
- Body: `{ inviteeId }`.
- Behavior: allowed while the request is `OPEN`; creates a `PENDING` invitation
  whose `expires_at` is the earlier of
  `now + MATCHMAKING_INVITATION_TIMEOUT_MINUTES` and the request's `expires_at`.
- Status: `201`; `400 VALIDATION_FAILED`; `401`; `403`; `404`
  (`MATCHMAKING_REQUEST_NOT_FOUND`, `MATCHMAKING_INVITEE_NOT_FOUND`); `409`
  (`MATCHMAKING_REQUEST_NOT_OPEN`, `MATCHMAKING_INVITATION_SELF`,
  `MATCHMAKING_INVITATION_DUPLICATE`).

### 9.11 List My Invitations (Player)

- Method/path: `GET /api/v1/matchmaking-invitations`.
- Auth: `authenticate` + `requireRole('PLAYER')`; scoped to the caller.
- Query: `direction` (`RECEIVED` | `SENT`, default `RECEIVED`), `status`
  (optional), `page`, `limit`.
- Response: paginated invitations with the counterpart Player, the request
  context, and `expiresAt`.

### 9.12 Respond to Invitation (Player)

- Method/path: `PUT /api/v1/matchmaking-invitations/:id`.
- Auth: `authenticate` + `requireRole('PLAYER')`; invitee-only.
- Body: `{ decision: 'ACCEPTED' | 'DECLINED' }`.
- Behavior: allowed only while `PENDING` and before `expires_at`; acceptance
  binds the invitee to the sender's group and, once the full player count is
  reached, the group forms a Match; declining notifies the sender.
- Idempotency: repeating the same decision returns `200`; a different decision
  on an already-responded invitation is rejected.
- Status: `200`; `400 VALIDATION_FAILED`; `401`; `403`; `404
  MATCHMAKING_INVITATION_NOT_FOUND`; `409` (`MATCHMAKING_INVITATION_NOT_PENDING`,
  `MATCHMAKING_INVITATION_EXPIRED`, `MATCHMAKING_SCHEDULE_CONFLICT`).

### 9.13 Cancel Direct Invitation (Player)

- Method/path: `POST /api/v1/matchmaking-invitations/:id/cancel`.
- Auth: `authenticate` + `requireRole('PLAYER')`; inviter-only.
- Behavior: allowed only while `PENDING`; sets `CANCELLED`.
- Idempotency: cancelling an already `CANCELLED` invitation returns `200`.
- Status: `200`; `401`; `403`; `404 MATCHMAKING_INVITATION_NOT_FOUND`; `409
  MATCHMAKING_INVITATION_NOT_PENDING`.

### 9.14 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `MATCHMAKING_DISABLED` | 409 | New request/invitation creation while disabled; existing journeys continue. |
| `MATCHMAKING_ACTIVE_REQUEST_LIMIT` | 409 | An `OPEN` request already exists for the match type. |
| `MATCHMAKING_INVALID_TIME_WINDOW` | 400 | End <= start or window shorter than the match duration. |
| `MATCHMAKING_INVALID_SKILL_RANGE` | 400 | Invalid skill ids or `min.rank > max.rank`. |
| `MATCHMAKING_START_TOO_SOON` | 400 | Preferred start is within the minimum lead time. |
| `MATCHMAKING_REQUEST_NOT_FOUND` | 404 | Request missing or caller has no owner/current accepted-member access. |
| `MATCHMAKING_REQUEST_NOT_CANCELLABLE` | 409 | Request is not `OPEN`. |
| `MATCHMAKING_REQUEST_NOT_OPEN` | 409 | Invitations require an `OPEN` request. |
| `MATCHMAKING_INVITATION_NOT_FOUND` | 404 | Invitation id missing or not visible to the caller. |
| `MATCHMAKING_INVITATION_NOT_WITHDRAWABLE` | 409 | Invitation is not accepted in an OPEN partial group. |
| `MATCHMAKING_INVITATION_NOT_PENDING` | 409 | Invitation already responded to or closed. |
| `MATCHMAKING_INVITATION_EXPIRED` | 409 | Invitation deadline passed. |
| `MATCHMAKING_INVITATION_SELF` | 409 | A Player cannot invite themselves. |
| `MATCHMAKING_INVITATION_DUPLICATE` | 409 | A pending invitation already exists for the invitee. |
| `MATCHMAKING_SCHEDULE_CONFLICT` | 409 | The Player is already committed to an overlapping Match. |
| `MATCHMAKING_INVITEE_NOT_FOUND` | 404 | Invitee id does not exist. |
| `MATCH_NOT_FOUND` | 404 | Match id missing or caller is not a participant. |
| `MATCH_NOT_PENDING_COURT` | 409 | Match is not `PENDING_COURT`; booking cannot be linked. |
| `MATCH_BOOKING_INVALID` | 409 | Booking does not belong to the owner or is not paid. |
| `MATCH_BOOKING_ALREADY_LINKED` | 409 | Booking is already linked to a Match. |
| `MATCH_NOT_LEAVABLE` | 409 | Match status does not allow leaving. |
| `MATCH_ALREADY_STARTED` | 409 | `scheduled_at` reached or Match `IN_PROGRESS`. |

Global codes remain `VALIDATION_FAILED` (400), `INTERNAL_ERROR` (500), and
`AUTH_*` per `docs/architecture/conventions.md` and the Auth Tech Design.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. Existing objects
used: `MATCHMAKING_REQUESTS` §3.11, `MATCHMAKING_MATCHES` §3.12, `MATCHES`
§3.13, `MATCH_PLAYERS` §3.14, `BOOKINGS` §3.8, `COURTS`/`FACILITIES`,
`SKILL_LEVELS` §3.2, `SYSTEM_CONFIGS` §3.26, `NOTIFICATIONS` §3.24,
`MATCHMAKING_INVITATIONS` §3.29.

Deltas required (to be reflected in the consolidated schema and migrations):

0. Add request match_duration_minutes, Match booking_deadline_at, WITHDRAWN
   vocabulary, cancellation jobs and notification dedup/reference columns as
   defined in database-schema §3.11/§3.13/§3.24/§3.29/§3.31. Add §5.13 indexes.

1. **Remove `MATCHMAKING_REQUESTS.latitude`, `.longitude`,
   `.max_distance_km`** — no distance logic; add `area` (varchar) for
   city/district.
2. **`MATCHMAKING_REQUESTS`** keeps `expires_at` (request snapshot); the
   oldest-first matching index is no longer needed. The partial unique index
   "(one `OPEN` request per `(player_id, match_type)`)" is kept.
3. **`MATCHES`**: remove `court_search_expires_at` and `confirmation_expires_at`.
   `matches_status_scheduled_idx` is kept; the court-search index is removed.
   Status vocabulary becomes `PENDING_COURT | CONFIRMED | IN_PROGRESS |
   COMPLETED | CANCELLED`.
4. **Remove `MATCH_CONFIRMATIONS`** — there is no separate player confirmation
   step.
5. **`MATCHMAKING_INVITATIONS`** (already documented §3.29): `expires_at` is the
   earlier of the invitation timeout and the request's `expires_at`. The partial
   unique index `(request_id, invitee_id) WHERE status = 'PENDING'` is kept.
6. **Indexes** removed: `MATCHES (status, court_search_expires_at)`,
   `MATCHES (status, confirmation_expires_at)`,
   `MATCHMAKING_REQUESTS (status, match_type, preferred_date, created_at)`.
   Indexes kept: `MATCHES (status, scheduled_at)`, `MATCH_PLAYERS (player_id,
   match_id)`, `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status
   = 'OPEN'`, `MATCHMAKING_INVITATIONS (request_id, invitee_id) WHERE status
   = 'PENDING'`.

**Documented status value vocabularies** (currently `varchar` with no CHECK):
`MATCHMAKING_REQUESTS.status` = `OPEN | MATCHED | CANCELLED | EXPIRED`;
`MATCHMAKING_INVITATIONS.status` = `PENDING | ACCEPTED | DECLINED | CANCELLED |
EXPIRED | WITHDRAWN`; `MATCHES.status` = `PENDING_COURT | CONFIRMED | IN_PROGRESS |
COMPLETED | CANCELLED`; `MATCH_PLAYERS.status` = `ACTIVE | LEFT`;
`MATCHMAKING_MATCHES.status` = `MATCHED`. Per §21 Q6, status vocabularies are
documented only; no CHECK constraints are added.

Migration impact/backfill: use the next unapplied migration; never rewrite
0004 or other applied migrations. New area is nullable for legacy rows only;
all new requests require a selected area. Existing rows without area are shown
as unspecified, without fabricating a location. Snapshot legacy duration from
the current configured value once during migration, then make it NOT NULL. `MATCHMAKING_*` config defaults
are seeded/updated per §8.3.

## 11. Security

- **Authentication boundary**: session-cookie middleware from the Auth module; no
  new mechanism. Matchmaking endpoints are exposed only to authenticated clients
  with a valid session (and CSRF token on mutating requests).
- **Authorization boundary**: all endpoints require `PLAYER`; every request,
  invitation, and Match operation is scoped to the caller (owner or
  `MATCH_PLAYERS` participant). Non-owner/participant access returns `404` to
  avoid leaking existence.
- **Input/output protection**: Zod at the boundary; parameterized queries only;
  responses never expose SQL, internal ids outside the contract, or other
  Players' private data beyond the PRD-approved profile fields.
- **CSRF**: `POST`/`PUT` requests must carry `X-CSRF-Token`.
- **Sensitive data**: no payment credentials or provider payloads are handled by
  Matchmaking; booking/payment details stay in the Booking/Payment modules.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Request expires with pending invitations | `expires_at <= now()` | Request → `EXPIRED`; pending invitations → `EXPIRED` | Inviter notified; may create a new request |
| Request expires with accepted invitees | `expires_at <= now()` and partial group | Accepted invitees released | All affected Players notified; new request needed |
| Invitation unanswered | invitation `expires_at <= now()` | Invitation → `EXPIRED`; request stays `OPEN` | Inviter notified; may invite another |
| Player cancels while matched | Request no longer `OPEN` | `409 MATCHMAKING_REQUEST_NOT_CANCELLABLE` | Player uses Match leave instead |
| Invitee already in group / invited | Duplicate pending | `409 MATCHMAKING_INVITATION_DUPLICATE` | Choose another Player |
| Invitee declines | Response `DECLINED` | Invitation → `DECLINED`; request stays `OPEN` | Inviter notified; may invite another |
| Two invites accepted concurrently and group fills | Row lock on the request | Only one Match created | Partial unique index blocks duplicates |
| Booking not paid / hold expires | Booking status `EXPIRED` | Match stays `PENDING_COURT`; slot released | Owner may book again |
| Link booking when not `PENDING_COURT` | Status check | `409 MATCH_NOT_PENDING_COURT` | None needed |
| Booking already linked | Unique FK / check | `409 MATCH_BOOKING_ALREADY_LINKED` | None needed |
| Leave before start | Participant action, `now < scheduled_at` | Player → `LEFT`; Match → `CANCELLED` | Remaining Players notified; new requests needed |
| Leave after start | `now >= scheduled_at` or `IN_PROGRESS` | `409 MATCH_ALREADY_STARTED` | Not permitted |
| Scheduler tick missed (downtime) | Catch-up sweep at startup | Due transitions applied promptly | Effective-status reads hide stale state meanwhile |

## 13. Concurrency / Idempotency

- **Request creation**: the "one `OPEN` request per match type" rule is checked
  inside the creation transaction; the partial unique index on
  `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'` is the
  final guard.
- **Invitation creation**: the partial unique index
  `(request_id, invitee_id) WHERE status = 'PENDING'` prevents duplicate pending
  invitations under concurrency.
- **Invitation response**: the invitation row is locked; a decision is final and
  idempotent for the same decision; a conflicting decision is rejected.
- **Group formation / Match creation**: the request row is locked with
  `FOR UPDATE`, the accepted-invitation count is re-verified under the lock, and
  the partial unique index `UNIQUE (matchmaking_request_id) WHERE status =
  'MATCHED'` makes Match creation atomic and duplicate-proof. The transaction
  boundary wraps `MATCHES` + `MATCH_PLAYERS` + `MATCHMAKING_MATCHES` inserts and
  the request status update; any failure rolls back the whole Match.
- **Booking linkage**: the Match row is locked; the booking unique FK
  (`matches.booking_id`) prevents linking one booking to two Matches.
- **Expiry transitions**: each category uses one atomic select-and-update with an
  expected-source-status predicate and `FOR UPDATE SKIP LOCKED`. Illustrative
  shape:

  ```sql
  UPDATE matchmaking_requests
  SET status = 'EXPIRED', updated_at = now()
  WHERE id IN (
    SELECT id FROM matchmaking_requests
    WHERE status = 'OPEN' AND expires_at <= now()
    ORDER BY expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT $batch
  )
  RETURNING id;
  ```

- In-memory state is never the coordination source; the database is.

## 14. Performance

- **Candidate query**: bounded by name/skill and the exclusion of the
  caller's group and pending invitees; indexed reads.
- **Invitation and request scans**: bounded by status + deadline indexes; batch
  sized per tick.
- **Match reads**: scoped by `MATCH_PLAYERS (player_id, match_id)`.
- **Polling load**: 5–10 second client polling on small payloads; no shared
  cache introduced.
- **Scheduler**: 60-second tick with fixed batch limits per category so tick
  duration stays bounded; remainder work continues next tick.

## 15. Events / Notifications

- **Notifications (in-app, `NOTIFICATIONS`)**, per the PRD:
  - Invitation received — to the invitee.
  - Invitation response (accepted/declined) — to the inviter.
  - Invitation expired — to the inviter.
  - Match ready (group full / booking linked) — to all group members.
  - Match cancelled (Player leaving) — to all participants.
  - Request expired — to the request owner and accepted invitees.
- **Triggers**: notification rows are written in the same transaction as the
  state change where practical; because transitions are idempotent, retries do
  not duplicate notifications.
- **Delivery/retry**: client polls unread notifications; no push/email in MVP.
- **Background processing**: the in-process scheduler owns request/invitation
  expiry and time transitions; no queue.

## 16. Testing Considerations

- **Unit**: invitation `expires_at` computation (`min` of invite timeout and
  request expiry); candidate exclusion (self, group, pending invitee); team
  assignment; request/match effective-status derivation; cancellation-reason
  mapping; Zod schemas.
- **Integration/persistence**: atomic Match creation under concurrent
  acceptances; `FOR UPDATE SKIP LOCKED` behavior; partial unique index
  enforcement; request expiry releasing accepted invitees; scheduler
  expiry/transition batches.
- **API-level**: `PLAYER`-only auth; owner/participant scoping; validation
  errors; pagination `meta`; feature error codes; idempotent cancel, respond, and
  leave.
- **Critical E2E**: create request → invite → accept to full count → Match
  `PENDING_COURT` → owner books and links → `CONFIRMED` → `IN_PROGRESS` →
  `COMPLETED`; cancel an `OPEN` request; request expiry with a partial group;
  leave before start.
- **Concurrency/idempotency**: two acceptances racing to fill the group;
  acceptance racing request cancellation/expiry; duplicate respond/leave
  requests; duplicate pending invitation.

## 17. Migration / Rollout

- **Migrations** (only after schema-change approval):
  1. Add `MATCHMAKING_REQUESTS.area`; drop `latitude`, `longitude`,
     `max_distance_km`.
  2. Drop `MATCHES.court_search_expires_at`, `MATCHES.confirmation_expires_at`
     and their indexes; drop `MATCH_CONFIRMATIONS`.
  3. Add the `MATCHMAKING_INVITATIONS` table and its partial unique index (if
     not already present).
  4. Remove unused `MATCHMAKING_*` config keys; add
     `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`.
- **Seed**: `MATCHMAKING_ENABLED`, `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`,
  `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`, `MATCHMAKING_MIN_LEAD_TIME_MINUTES`,
  `MATCHMAKING_MATCH_DURATION_MINUTES` (§8.3 defaults) in `SYSTEM_CONFIGS`.
- **Sequencing**: schema/config before enabling the scheduler and endpoints.
- **Backward compatibility**: migrations are destructive only for unused
  columns/tables; the feature is not yet implemented in code.
- **Feature gating**: `MATCHMAKING_ENABLED` gates new request/invitation creation only; existing
  responses, formation, linkage and cleanup continue.

## 18. Alternatives Considered

- **Automatic matching engine** (the original MVP design): rejected on
  2026-10-10 in favor of invitation-only to keep the MVP simple.
- **Automatic court finding by centroid/distance**: rejected; the request owner
  books manually through the Booking flow.
- **A separate player confirmation step**: rejected; acceptance is the
  commitment.
- **No invitation timeout**: rejected; a dedicated per-invitation timeout lets
  the owner re-invite quickly.
- **PostGIS / geospatial index**: rejected — no distance logic remains.
- **Cross-module event bus**: rejected — the scheduler and DB state suffice.
- **WebSocket/SSE updates**: rejected — HTTP polling is confirmed.

## 19. Observability

- **Logs**: request created/cancelled/expired, invitations created/responded/
  expired, groups formed, Matches created, booking linked, cancellations with
  reason, leave count. Never log secrets or provider payloads.
- **Metrics**: requests created/expired/cancelled, invitations sent/accepted/
  declined/expired, groups formed, Matches created, invitation-response rate,
  time request→match.
- **Alerts**: rising invitation-expiry and request-expiry rates are candidate
  operational signals. Observability tooling remains TBD.

## 20. Acceptance / Verification Considerations

- **Given** a Player with an `OPEN` request, **When** they invite a specific
  eligible Player, **Then** a `PENDING` invitation exists with `expires_at` equal
  to the earlier of the invitation timeout and the request deadline.
- **Given** a full group (owner + accepted invitees), **When** the last invitee
  accepts, **Then** exactly one Match in `PENDING_COURT` is created and the
  request becomes `MATCHED`.
- **Given** an `OPEN` request past `expires_at`, **When** the scheduler ticks,
  **Then** the request becomes `EXPIRED`, pending invitations close, and accepted
  invitees are released with a notification.
- **Given** a `PENDING` invitation past its own deadline, **When** the scheduler
  ticks, **Then** the invitation becomes `EXPIRED` and the request stays `OPEN`.
- **Given** a `PENDING_COURT` Match, **When** the owner links a paid booking,
  **Then** `court_id`/`booking_id`/`scheduled_at` are set and the Match becomes
  `CONFIRMED`.
- **Given** a Match before `scheduled_at`, **When** a Player leaves, **Then** the
  Match is `CANCELLED` and remaining Players must create new requests.
- **Given** a Match after it starts, **When** a Player attempts the normal leave
  flow, **Then** the request is rejected with `409 MATCH_ALREADY_STARTED`.
- **Given** a `CONFIRMED` Match, **When** `scheduled_at` and then the configured
  duration elapse, **Then** the Match becomes `IN_PROGRESS` and then `COMPLETED`
  without result recording.

Verification: unit/integration/API tests per §16; migration check for the new
columns and dropped objects; manual concurrency check for group formation.

## 21. Resolved Decisions / Open Questions

Original technical decisions were resolved by the human owner on 2026-09-26.
Direct invitations were added on 2026-10-04. The invitation-only scope reduction
and the full readiness review (§21.1) were approved on 2026-10-10.

| # | Question | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Q1 | Drizzle ORM versus `tech-stack.md` and `documentation-guide.md` §15. | Keep Drizzle as the confirmed ORM; update `tech-stack.md` and correct the §15 note. | 2026-09-26 | RESOLVED |
| Q2 | `MATCHES` schema deltas and `MATCHES.booking_id` documentation. | Document `booking_id`; the court-search/confirmation columns added on 2026-09-26 were removed on 2026-10-10. | 2026-09-26 | SUPERSEDED (2026-10-10) |
| Q3 | "One `OPEN` request per `(player_id, match_type)`" partial unique index. | Approve the index as the final guard. | 2026-09-26 | RESOLVED |
| Q4 | Match `CONFIRMED` condition. | Superseded: the Match becomes `CONFIRMED` when the owner links a paid booking. | 2026-09-26 | SUPERSEDED (2026-10-10) |
| Q5 | Booking hold expiring/cancelling before Match confirmation. | Superseded: booking payment/expiry is owned by the Booking module; the Match stays `PENDING_COURT` until a paid booking is linked. | 2026-09-26 | SUPERSEDED (2026-10-10) |
| Q6 | `CHECK` constraints for status vocabularies. | Documentation-only; no `CHECK` constraints. | 2026-09-26 | RESOLVED |
| Q7 | Notification wording and confirmation reminder. | Use the events in §15; exact copy follows existing notification style. | 2026-09-26 | RESOLVED |
| Q8 | Namespace for Match endpoints. | Keep `/api/v1/matches`; tournament matches remain nested under `/api/v1/tournaments`. | 2026-09-26 | RESOLVED |
| Q9 | `requireRole` signature. | Use the existing variadic `requireRole('PLAYER')`. | 2026-09-26 | RESOLVED |
| Q10 | Does Matchmaking support direct invitations? | Yes: `MATCHMAKING_INVITATIONS` and the invitation endpoints; acceptance binds the invitee and forms a Match at full count. | 2026-10-04 | RESOLVED |
| Q11 | Invitation timeout and lifecycle. | Superseded: invitations have a dedicated timeout (`MATCHMAKING_INVITATION_TIMEOUT_MINUTES`). | 2026-10-04 | SUPERSEDED (2026-10-10) |
| Q12 | MVP scope: automatic matching or invitation-only? | Invitation-only; the automatic matching engine is removed. | 2026-10-10 | RESOLVED |
| Q13 | Court selection and booking. | The request owner books through the Court Booking flow; Matchmaking links the booking and does not select a court or use distance. | 2026-10-10 | RESOLVED |
| Q14 | Separate player confirmation step. | Removed; acceptance is the commitment. `MATCH_CONFIRMATIONS` is dropped. | 2026-10-10 | RESOLVED |
| Q15 | Invitation timeout. | `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` (default 15), capped by the request's snapshotted `expires_at`. | 2026-10-10 | RESOLVED |
| Q16 | Request expiry with a partial group. | Request → `EXPIRED`; pending invitations close; accepted invitees are released with a notification. | 2026-10-10 | RESOLVED |
| Q17 | Match/participant write ownership across Matchmaking and `MatchModule` (Tournament). | Resolved: `MatchModule` is the single writer of `MATCHES`/`MATCH_PLAYERS`; Matchmaking and Tournament call `MatchModule.createMatchWithPlayers(...)` and write only their link tables. | 2026-10-10 | RESOLVED |
| Q18 | Skill enforcement when inviting. | Resolved: skill is a default candidate filter with a skill-mismatch warning; not hard-enforced. | 2026-10-10 | RESOLVED |
| Q19 | Overlapping Matches. | Resolved: a Player cannot be committed to two Matches whose playing intervals overlap; an overlapping acceptance/group formation is rejected (`MATCHMAKING_SCHEDULE_CONFLICT`). | 2026-10-10 | RESOLVED |
| Q20 | Minimum lead time for a request. | Resolved: a request's preferred start must be at least `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) in the future; otherwise `MATCHMAKING_START_TOO_SOON`. | 2026-10-10 | RESOLVED |

**Required authoritative documentation updates (Q1–Q2), applied on 2026-09-26
under the no-doc-debt rule, and the 2026-10-10 scope reduction recorded in
`PROJECT-BRIEF.md` §7 and `business-rules-config-matrix.md` §3/§8.3:**

- `docs/architecture/database-schema.md` — reflect the 2026-10-10 delta: remove
  `latitude`/`longitude`/`max_distance_km`, add `area`; remove
  `court_search_expires_at`/`confirmation_expires_at`; remove
  `MATCH_CONFIRMATIONS`; update the `MATCHES` status vocabulary; record the new
  indexes and status vocabularies; Change Log entry.
- `docs/features/booking/player-booking/tech-design.md` — mark `MatchBookingPort`
  `createMatchHold`/`releaseMatchHold` as not used in MVP.

The resulting migration (columns, indexes, dropped objects, config seed) remains
implementation work and is not performed by this document.

## 21.1 Implementation readiness review — approved 2026-10-10

The human owner approved all 21 review recommendations except court-area rule
12B, and removed invitee activity requirements. This section refines earlier
wording; business-rules §3 remains authoritative. Status: Ready.

Status: Ready. Approved by: Human owner, explicitly approving the review choices
and readiness in this session. These decisions refine the invitation-only scope.

- Discovery uses existing, non-deleted Player accounts with a valid profile; no
  online-presence or `USERS.status = ACTIVE` requirement applies to browsing or
  sending an invitation. Invitees need no OPEN request or stored availability.
  Responding still requires the existing authenticated, authorized Player flow;
  this approval does not bypass authentication/account-access restrictions.
- Browse by name and skill, defaulting to the request's skill range; allow viewing
  out-of-range Players with a mismatch warning. Time and area are invitation
  context, not candidate filters inferred from profiles.
- Select city/district from the shared facility-address values. Area is a
  preference only: the owner may book outside it without another confirmation.
- Sending more invitations than remaining seats is allowed. The first valid
  acceptances fill the seats; formation atomically closes other pending invites.
  Declined, expired, cancelled or withdrawn invitees can receive a new invitation
  while the request remains OPEN; historical invitations are never reopened.
- An OPEN request reserves its owner's preferred playing window; ACCEPTED
  invitations to that request reserve the same window for invitees. These
  reservations and PENDING_COURT/CONFIRMED/IN_PROGRESS Matches may not overlap.
  Reserve the whole preferred window before booking because the owner may book
  any duration-sized interval inside it. A Player cannot create an overlapping
  owner request or accept an overlapping invitation. Exclude the same group's
  own reservation when it is converted to a Match or linked to a booking.
- Before formation, an accepted invitee may withdraw; the invitation becomes
  WITHDRAWN, the owner is notified and the invitee's reservation is released.
  This does not cancel the request. No withdrawal or replacement after formation;
  participants then use Match leave.
- Pending invitees see invitation context. Accepted invitees additionally see
  the owner, accepted members, remaining seats, request deadline and resulting
  Match link. Membership access ends on withdrawal/request closure, except their
  own invitation history and participant access to a formed Match.
- The final acceptance and full group formation commit together; any failure
  rolls back the final acceptance. Never persist a full group without a Match.
- Snapshot match duration when the request is created. A linked booking must
  belong to the owner, be paid/CONFIRMED, start in the future, be on the preferred
  date, fit wholly inside the preferred window, have exactly the snapshotted
  duration, and not be linked elsewhere. Recheck every participant's schedule.
  Before booking, reserve the preferred window; after booking use its actual
  start/end as the official interval. Config changes do not change old intervals.
- PENDING_COURT expires at the original preferred start if no booking is linked:
  cancel with COURT_NOT_BOOKED, release reservations and notify the group. Any
  member (including the owner) may leave before that deadline; after it, return
  the effective cancelled state rather than claiming the Match has started.
- Leaving a CONFIRMED Match before its booked start cancels the Match. Request
  cancellation of its linked booking through Booking policy automatically;
  Payment owns refunds. Persist retryable cancellation work with the Match
  transition. A policy refusal is visible to the owner; the Match remains
  CANCELLED and the booking is not silently reported as cancelled/refunded.
- Cancellation of a linked booking cancels the Match with BOOKING_CANCELLED;
  do not return it to PENDING_COURT. Reconciliation precedes time advancement.
- Linking the same booking to the same Match again returns current state (200);
  a different booking after linkage is a conflict. Match/booking state must be
  revalidated atomically with the linkage.
- Player scheduling is serialized by database Player-row locks in ascending id
  order, followed by request, invitation, Match and Booking locks. All scheduling
  writers recheck reservations inside the transaction; no in-memory lock is used.
- Matchmaking reads/commands/jobs are scoped by MATCHMAKING_MATCHES. Tournament
  lifecycle remains explicit and is never advanced by Matchmaking jobs.
- When MATCHMAKING_ENABLED is false, reject new requests and invitations only.
  Existing invitation responses, formation, booking linkage, reads, withdrawal,
  leave, cancellation and cleanup continue.

### API and transaction contract additions

- POST request also validates owner reservations, returning 409
  MATCHMAKING_SCHEDULE_CONFLICT. Accepted invitees may withdraw using
  POST /api/v1/matchmaking-invitations/:id/withdraw; invitee-only, accepted and
  request OPEN only. Replay WITHDRAWN returns 200; other invalid states return
  409 MATCHMAKING_INVITATION_NOT_WITHDRAWABLE. Withdrawal returns invitation,
  releases the reservation and notifies owner in the same transaction.
- Invitation response returns invitation plus requestId and matchId (nullable).
  Invitation lists include request context and group progress for accepted
  recipients; retain historical context without granting former members live
  membership access. Request detail supports current accepted members.
- Schedule conflicts return 409 MATCHMAKING_SCHEDULE_CONFLICT on booking link.
  Out-of-window/date/duration, unpaid, elapsed or wrong-owner bookings use
  MATCH_BOOKING_INVALID. Same-Match same-booking replay is 200 before source
  status validation; a different booking remains a conflict.
- Before each mutation use one captured operation time, derive effective expiry,
  reconcile expired OPEN/PENDING rows in its transaction before uniqueness checks,
  and revalidate deadlines after lock waits. Read filters and pagination totals
  use identical effective-status expressions; reads never persist transitions.
- Request deadline is min(now + request-expiration, preferred start); invitation
  deadline remains min(now + invitation-timeout, request expiry). PENDING_COURT
  booking_deadline_at equals original preferred start and is never moved by config.
- Jobs/queries join MATCHMAKING_MATCHES. Process booking-cancellation reconciliation
  and pending-court expiry before time advancement; never start a Match with a
  cancelled/unusable booking. Set started_at to booked scheduled start and
  completed_at to booked end, including catch-up; updated_at is actual write time.
- Shared MatchModule adds createMatchWithPlayers, status/participant mutations,
  booking linkage and participant reads, all accepting a caller-owned transaction.
  Its implementation must not commit independently. Update the existing TypeScript
  contract during MM-18; this documentation change does not implement it.
- Automatic booking cancellation uses the same Booking policy as owner cancel,
  authorized internally through the request owner and linked Match, not arbitrary
  participant impersonation. Persist MATCH_BOOKING_CANCELLATION_JOBS with Match
  cancellation; process in bounded batches. Booking owns atomic cancellation and
  refund work persistence. Transient errors retry; policy refusal becomes FAILED
  with owner-visible reason. A cancelled Match stays cancelled even if cancellation
  fails. Already-cancelled booking is idempotent success. Expiry with no booking
  creates no cancellation job. Job/API reads expose booking cancellation progress
  to owner without exposing another player's payment details.
- Linking locks/revalidates booking through Booking's shared transaction boundary.
  Booking cancellation consults linked Match in the same lock order. Scheduler
  reconciliation is the recovery path for missed effects, not the only safeguard.
- Indexes and additive schema are owned by database-schema §3.11/§3.13/§3.29/§3.31
  and §5.13. No new infrastructure or dependencies are introduced.

### Verification additions

Verify cross-request accepts/creation with a common Player, overlapping singles
and doubles, withdrawal/reinvite, oversubscribed groups, accept-vs-expiry/cancel,
rollback of final acceptance, idempotent linkage, link-vs-booking cancellation,
wrong-date/duration/window/past booking, outside-area success, config changes not
moving old intervals, PENDING_COURT deadline and leave, automatic cancellation
retry/refusal, disabled feature with existing journeys, effective pagination and
uniqueness before scheduler ticks, and Tournament exclusion. Include offline or
non-ACTIVE invitation discovery/send without bypassing response authentication.

## 22. Decision Status

```text
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-26; direct-invitation decisions added 2026-10-04; invitation-only scope reduction added 2026-10-10)
Approved by: Human owner (2026-09-26, extended 2026-10-04 and 2026-10-10)
Approved decision/reference: §21 Resolved Decisions, 2026-09-26, 2026-10-04, and 2026-10-10
```

This document does not create a new approval workflow. It follows the human
readiness gate in `docs/documentation-guide.md` §6.3. All decisions are resolved
and the document was marked `Ready` on 2026-09-26, with the invitation-only scope
reduction applied on 2026-10-10.

## 23. Review implementation notes — 2026-10-10

- Existing schema is unchanged by the review fixes. Sorted Player locks precede
  request/invitation locks; retry the transaction when membership discovery is
  stale. Recheck every member's overlap before final formation and validate time
  after acquiring locks. Expected expiry errors are returned after committing the
  expiry transition, rather than throwing inside the transaction and rolling it back.
- Expired OPEN requests/partial invitations and overdue PENDING_COURT Matches no
  longer reserve time. Match list/detail/filter/count share effective state;
  persisted jobs reconcile cancelled bookings before advancement. Guard each
  time transition against invalid booking state even when a batch remains.
- MatchModule uses a caller-owned transaction when provided; otherwise opens its
  own transaction around Match and participant inserts. No independent commit
  occurs inside the caller's transaction.
- Frontend validates shape/date/order/skill/area locally. Config-dependent duration
  and minimum lead-time validation remains server-authoritative; preserve the
  server's configured lead-time error rather than displaying a fixed 60 minutes.
  No additional configuration API is introduced by this implementation choice.
- Verification and remaining integration gaps are recorded in tasks.md under
  Review fixes and outstanding work. Booking-link, cancellation-job processing,
  notifications and frontend group/Match routes remain unfinished dependencies.

### Implementation progress — 2026-10-10

Area selection currently reuses the existing paginated public Court API's
facility city/district values; no separate geography API is introduced. Last-used
area is restored only if still in the returned choices. Profile-skill fast-fill
awaits the Player Profile read API and is not claimed complete.

Request, invitation and Match views poll every five seconds after the previous
request finishes, refresh on focus, pause hidden tabs and stop on unmount. Match
list/detail and leave are implemented; paid-booking linkage, durable cancellation
job consumption/refunds and notification delivery remain dependency-blocked.

## Ratings host alignment — approved 2026-10-15

Ratings RT-05 composes the shared rating view into existing casual Match Details/History; Matchmaking retains ownership of those pages and casual-only list/detail endpoints. Ratings owns the component, rules and APIs. Do not move casual pages into `features/ratings/` or widen casual endpoints to serve Tournament Matches. Completed retained participants enable rating; cancelled/expired/withdrawn groups never do. After all targets are rated, retain a read-only viewing entry. Ratings-given history is a separate Player route (`/ratings/given`, RT-07). See Ratings PRD §15 and Tech Design §23 for approved behavior.

## Match Detail frontend refinement — 2026-10-19

User authorized the scoped P23/P47 frontend proposal in `match-detail-figma-review.md`.
The participant Match Detail now composes a status hero, schedule/venue, teams,
cost/owner-only booking link and state-specific actions. Casual Matches still
have no score/result or ELO. Existing Ratings UI remains the completed-Match host.
The leave confirmation traps/restores focus, locks duplicate commands/dismissal
while sending, maps stable error codes and refreshes authoritative status on
failure. A failed background poll preserves last-known data with a stale warning
and disables leaving until a successful reload.

Booking navigation propagates optional positive-safe-integer `matchId` through
court search, facility, court/date selection, summary, pending and booking detail
URLs. This is navigation context only; a return link does not grant access or
write a Match/Booking relation. Booking creation bodies are unchanged. Server
participant/owner checks remain the authority. No route or API contract changed.

MM-07/MM-19 remain blocked on paid Booking/Payment; the documented booking-link
endpoint is not yet registered in backend Match routes. The Match core writer
is not a substitute for the missing validated linking service. MM-20 remains a
separate dependency. Do not expose a fake link/confirmation action or claim the
payment-to-confirmed-Match path is complete.

## 24. Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

```text
Status: Ready
Decision Status: Approved (human owner, final Phase 2 review, 2026-10-31)
PRD: prd.md §15 (Ready, business scope); Social PRD; Messaging PRD
Schema authority: docs/architecture/database-schema.md §13 (Ready target delta)
```

This section is the target design. §1–§23 remain the description of the code
that exists today. Where this section conflicts with §1–§23, this section is the
target under the human approval dated 2026-10-31. Implementation still follows the task dependencies.

### 24.1 Approved inputs (human owner, 2026-10-31)

- Every post has a concrete `start_at` and `duration_minutes`. Without a booking:
  Singles/Doubles snapshot `MATCHMAKING_MATCH_DURATION_MINUTES`; casual groups
  enter 60–180. Linking a booking to an existing post never changes its time; a
  post created from a booking defaults to the booking interval. A linked booking
  must cover the whole post interval (batch 1, B1).
- Casual group at start with at least the minimum (`1 + companion_count + accepted >= min_players`), at least 1 accepted registered member (`accepted >= 1`), and a court: form the Match if
  none exists, otherwise continue the existing Match (B2, T3).
- No host removal of members (B3).
- Social owns posts; Matchmaking owns recruitment; a match-finding post and its
  recruitment are created in the same transaction (T1).
- One membership table for Apply and Invite with an explicit joining Player and
  decider; one shared acceptance transaction (T2).
- Publication (`POSTS.published_at`) is separate from the recruitment state;
  unpublished posts still accept Invites and can form a Match (T3).
- The recruitment row is the single court/booking source for Matchmaking, subject
  to the consumer review in §24.3 (batch 2, Q1).
- Optional title (Social). Feature-gate behavior (Q4, §24.10). Booking-linked
  features ship BLOCKED behind MM-19/MM-20; external court ships first (Q14).
- One canonical creation flow; Apply is its own resource (Q15).

### 24.2 Module boundaries and contracts

New `backend/src/contracts/` interfaces (type-only):

| Contract | Provider | Consumers | Operations (all accept the caller's transaction) |
| --- | --- | --- | --- |
| `RecruitmentPort` | Matchmaking | Social | `createForPost`, `validateDraft`, `cancelForAuthorDeletion(bookingAction)`, `getCardProjection(postIds, viewerId)`, `feedFilterSql` inputs |
| `PostContentPort` | Social | Matchmaking | `markPublished(postId, at)`, `isVisible(postId, viewerId)` |
| `BlockPort` | Messaging | Matchmaking | `isBlockedEitherWay(a, b, tx): Promise<boolean>`; foundation of MSG-08, used by MM-22/MM-24. Social visibility is not changed by blocking. |
| `MatchmakingBlockPort` | Matchmaking (MM-22) | Messaging (MSG-08 integration) | `closePendingBetween(a, b, tx): Promise<void>`; caller supplies the same transaction as block insertion and holds both USERS locks ascending; close only PENDING Apply/Invite between the pair with BLOCKED reason, then requests(30) and invitations(40) in global order. No internal commit, notification or conversation mutation. |

| `NotificationService` | Notifications | all | existing contract with dedup key and caller transaction (NTF-02) |

No module imports another module's repository.

Contract clarification approved by the human owner on 2026-11-01: the block-closure operation is owned by MM-22 and can be delivered against MM-21 before the acceptance refactor is complete. MSG-08 foundation does not wait for that operation; MSG-08 integration does. Type-only contracts use the established caller-transaction type when implemented, without creating another transaction boundary.

### 24.3 Court/booking source and consumer review (Q1 condition)

Recruitment holds the external court fields or `booking_id` (schema §13.3).
Matchmaking stops writing `MATCHES.booking_id`/`court_id` for posts. Consumers
found in the code audit (2026-10-31) and the required change:

| Consumer | Location | Change |
| --- | --- | --- |
| Effective Match status | `MatchmakingRepository.effectiveMatchStatusSql` | Read booking through `matchmaking_matches → matchmaking_requests.booking_id`; external court uses `start_at`/`duration_minutes` |
| Schedule conflict | `hasOverlappingCommitment` | Rewrite on post intervals (§24.6) |
| Match list/detail DTOs | `MatchmakingRepository` L552–622, `MatchService` | Court from recruitment; booking visible to host only (unchanged rule) |
| Scheduler | `cancelOverduePendingCourtMatches`, `reconcileCancelledBookings`, `advance*` | Use recruitment court; completion at `start_at + duration` for all posts |
| Duplicate-link check | `findBookingsLinkedToOtherMatch` | Replaced by UNIQUE `matchmaking_requests.booking_id` plus a check that no `MATCHES.booking_id` references it |
| Cancellation jobs | `insertCancellationJob` | Keyed by request (§13.6), MM-20 |
| Owner schedule | `OwnerBookingReadRepository` L15–24 | Join recruitment `booking_id` in addition to `MATCHES.booking_id` |
| Ratings | `RatingRepository.findMatchById` | No booking use; unaffected |
| Profile statistics | `profile-statistics.ts` | No booking use; unaffected |
| Tournament | shares `MATCHES`; no code writes `booking_id` today | Semantics of `MATCHES.booking_id`/`court_id` for Tournament are not changed |
| Frontend | no `bookingId` read in `features/matchmaking` | None |

Migration preflight: count matchmaking Matches with non-null `booking_id`. MM-07/
MM-19 never shipped, so zero is expected; any non-zero row is copied to its
recruitment and the migration stops for review if a request already has a
different booking.

### 24.4 State machines

**Publication (Social):** `published_at IS NULL` → set once by `publish`. Never
unset. `deleted_at`/`hidden_at` are independent and never change recruitment.

**Recruitment (`MATCHMAKING_REQUESTS.status`):**

| From → To | Trigger | Guards (inside the transaction) | Effects |
| --- | --- | --- | --- |
| (new) → `OPEN` | Create post | Gate, open-post limit, lead time, capacity/min/duration ranges, host schedule | Post row + recruitment row together |
| `OPEN → MATCHED` | Acceptance fills capacity | Capacity, conflicts of all members | Create Match (or update roster of the existing GROUP Match); close pending rows (`RECRUITMENT_CLOSED`) |
| `OPEN → MATCHED` | GROUP early close | Host; count ≥ min and accepted ≥ 1; before start | Same as above; `closed_early_at` |
| `OPEN → MATCHED` | GROUP at start with count ≥ min, accepted ≥ 1, and a court | Scheduler | Form Match if none; continue existing Match otherwise |
| `MATCHED → OPEN` | GROUP non-host withdrawal before start | Withdrawer is a current member | Membership `WITHDRAWN`, `MATCH_PLAYERS` LEFT, notify "recruitment reopened"; Match kept |
| `OPEN → EXPIRED` | Singles/Doubles at start not full | Scheduler | Close pending rows (`POST_STARTED`) |
| `OPEN/MATCHED → CANCELLED` | Host cancels or leaves | Host; before start | Reason `HOST_CANCELLED`/`HOST_LEFT`; Match CANCELLED; booking per host choice |
| `OPEN/MATCHED → CANCELLED` | No court at start | Scheduler | `COURT_NOT_BOOKED`; Match CANCELLED |
| `OPEN/MATCHED → CANCELLED` | GROUP below min (or with `accepted = 0`) at start (including a reopened GROUP) | Scheduler | `INSUFFICIENT_PLAYERS`; Match CANCELLED; booking kept; host told it is still valid |
| `MATCHED → CANCELLED` | Singles/Doubles member leaves after full | Before start | `PLAYER_LEFT`; Match CANCELLED; booking per existing Match-leave rule |
| any active → `CANCELLED` | Linked booking cancelled | Reconcile | `BOOKING_CANCELLED` |
| active → `CANCELLED` | Author deletes the post | Same as host cancel | `AUTHOR_DELETED`, then Social sets `deleted_at` in the same transaction |

Terminal: `CANCELLED`, `EXPIRED`, and `MATCHED` once its Match is terminal.

**Match (`MATCHES.status`):**

| State | Meaning |
| --- | --- |
| `PENDING_COURT` | Match formed, recruitment has no court |
| `CONFIRMED` | Recruitment has an external court or a CONFIRMED linked booking |
| `IN_PROGRESS` | Reached `start_at` while `CONFIRMED` and the roster condition holds (Singles/Doubles: full; GROUP: count ≥ min and accepted ≥ 1) |
| `COMPLETED` | Reached `start_at + duration_minutes`; `completed_at` set to that instant |
| `CANCELLED` | Any cancellation above |

Transitions: `PENDING_COURT → CONFIRMED` when a court is set (external or
booking); `PENDING_COURT → CANCELLED` at start (`COURT_NOT_BOOKED`);
`CONFIRMED → IN_PROGRESS` at start when the roster condition holds, otherwise
`CONFIRMED → CANCELLED` (`INSUFFICIENT_PLAYERS`); `IN_PROGRESS → COMPLETED` at end;
`CONFIRMED/IN_PROGRESS → CANCELLED` on booking cancellation (reconciled first).
A GROUP Match is never duplicated: `uq_matchmaking_matches_success` keeps one
link per request and reopen/replacement only updates `MATCH_PLAYERS`.

Effective status on read keeps the current lazy evaluation pattern so a late
scheduler tick never shows a stale state.

### 24.5 Membership model and the shared acceptance transaction

Schema: §13.5. Roles:

| Kind | Created by | Decides | Cancel pending |
| --- | --- | --- | --- |
| `INVITE` | Host | Invitee (`player_id`) | Host |
| `APPLY` | Applicant (`player_id`) | Host | Applicant |

Current membership is host + `ACCEPTED` rows. Membership is a present state; a
historical `ACCEPTED` row of a terminal request means "member at the terminal
event", not an active commitment. Messaging access does not read these rows
(conversation membership only, Messaging Tech Design §7.2).

Shared `acceptMembership(rowId, actorId)` (used by Invite response and Apply
approval):

1. Snapshot host, joiner and current members outside the transaction (existing
   `withInvitationGroup` pattern, renamed).
2. Transaction: lock `USERS` rows ascending → recruitment row → all affected membership rows in ascending ID order (the
   target plus every overlapping pending row to close); retry if the member set
   or required lock set changed. Do not lock the target row first.
3. Recheck: actor is the decider; row `PENDING` and not expired; recruitment
   `OPEN` and before `start_at`; for `APPLY`, post published; not blocked either
   way (`BlockPort`); capacity `1 + companion_count + accepted < capacity`;
   joiner has no overlapping commitment.
4. Row → `ACCEPTED`, `decided_by`, `responded_at`.
5. Close the joiner's other `PENDING` rows whose interval overlaps (`CANCELLED`,
   `SCHEDULE_CONFLICT`) and queue their notifications.
6. If now full: close the remaining pending rows of this request (rank 40), then
   create the Match or keep the existing GROUP Match, `OPEN → MATCHED`. If a GROUP
   Match exists without becoming full (reopened recruitment): reactivate/insert
   `MATCH_PLAYERS`. (Rank 50, after every rank-40 change.)
7. Notifications through `NotificationService` with dedup keys (inserts only). (Messaging is decoupled from Matchmaking; no conversation rows are created or locked inside `acceptMembership`.)



Any failure rolls back everything, including the Match.

Duplicate protection: the partial UNIQUE on active rows (§13.5) rejects a second
active row for the same Player and request regardless of kind (`23505 →
MATCHMAKING_ALREADY_ACTIVE`). Send/Apply also check inside the transaction.

Code impact: `invitee_id` appears in `MatchInvitationService.ts` (18),
`MatchmakingRepository.ts` (12), `db/schema/matchmaking.ts` (5),
`MatchmakingRequestService.ts` (3), the invitation controller and validation (1
each), `__tests__/matchmaking.test.ts` (45) and the frontend
`matchmakingService.ts` (2). Every query that derives membership from
`invitee_id` must be rewritten to `player_id` with `status = 'ACCEPTED'`. The
API keeps `inviteeId` in invitation responses for compatibility (§24.9).

### 24.6 Schedule conflicts

`hasOverlappingCommitment(player, start, end, excludeRequestId)` becomes one
interval source: `[start_at, start_at + duration_minutes)` of every non-terminal
recruitment where the Player is host or a current `ACCEPTED` member, plus
non-terminal Matches through their recruitment. Pending Apply/Invite never
reserve. Checked on Apply/Invite creation, on acceptance (all members on
formation) and on court linking. Legacy rows use their backfilled `start_at`.


### 24.7 Locking — target order for new and affected existing transactions

Status: Approved by the human owner on 2026-10-31 after the Phase 2 review.
Applies to new and affected existing transactions, including the BK-15 reorder;
booking integration must not ship before BK-15 and its checks are complete. Concurrency tests (MM-30
and each task's own tests) are verification evidence; they do not replace this
analysis.

#### 24.7.1 Rules

1. **One global rank.** A transaction may take a lock only on a resource whose
   rank is greater than or equal to every rank it already holds (table below).
   Conditional `UPDATE … WHERE status = …` statements count as locks at the rank
   of their table.
2. **Same table, several rows:** lock in ascending primary-key order (existing
   `lockUsersAscending`, `lockPlayerProfilesAscending`). Several advisory
   court-date keys: ascending `(court_id, date)`.
3. **Unknown row sets** (for example the members of a recruitment): snapshot
   outside the transaction, lock the snapshot in order, re-read, and retry when the
   set changed (existing `withInvitationGroup` pattern). Never lock an extra
   lower-rank row after a higher-rank one.
4. **Background claims** use `FOR UPDATE [OF <table>] SKIP LOCKED` in a short
   statement that never waits; per-item work then runs in its own transaction that
   follows rule 1. Joined tables in a claim must be excluded from locking with
   `OF <table>`.
5. **Inserts** take implicit FK/unique-index locks even when no explicit row
   lock is requested. Include these waits in the implementation review; creation
   must not introduce reverse-order dependencies. Same-operation unique conflicts
   use the documented idempotency behavior.

#### 24.7.2 Global rank

| Rank | Resource |
| --- | --- |
| 10 | `users` (ascending id) |
| 15 | `auth_sessions`, `auth_login_lockouts` |
| 20 | `player_profiles` (ascending user id) |
| 30 | `matchmaking_requests` (ascending id) |
| 40 | `matchmaking_invitations` (ascending id) |
| 50 | `matches` / `match_players` |
| 55 | `match_booking_cancellation_jobs` |
| 60 | `facilities` |
| 62 | `court_owner_reviews` |
| 65 | advisory lock `court:<courtId>:<date>` |
| 70 | `courts`, `court_slot_blocks`, `court_pricings` |
| 80 | `bookings` (ascending id) |
| 85 | `payments` |
| 90 | `conversations` (ascending id) |
| 95 | `conversation_members`, `messages`, `message_reactions`, presence/typing |
| 100 | `posts` |
| 105 | `post_comments`, `post_reactions` |

#### 24.7.3 Inventory of transactions that can intersect

Existing code (audit 2026-10-31):

| Transaction | Observed order | Conforms? | Action |
| --- | --- | --- | --- |
| Booking create (`persistBookingTransaction`), LIMITED mode | facilities(60) → advisory(65) → courts(70) → stale bookings UPDATE(80) → **users(10)** | **No** | BK-15: lock the player's `users` row first, before `facilities`; the active-booking count stays inside the transaction |
| Booking create, NONE mode (`createMatchHold`) | 60 → 65 → 70 → 80 | Yes | — |
| Player cancel, release hold, confirm booking | bookings(80) | Yes | — |
| Payment create / mock confirm | bookings(80) → payments(85) → bookings (re-entrant) | Yes | — |
| Refund (`refundBookingPayment`) | no transaction | n/a | Unchanged (Payment scope) |
| Booking state worker | bookings SKIP LOCKED, autocommit | Yes | — |
| Owner slot block create | facilities(60) → advisory(65) → courts(70) → stale bookings(80) | Yes | — |
| Owner/Admin facility and court edits, facility review | facilities(60) → reviews(62)/courts(70) | Yes | — |
| Admin user status change | `AdminUserService.updateUserStatus` calls standalone `UserRepository.updateStatus`: users(10); no session/lockout transaction in this path (source reviewed 2026-10-31) | Yes for this path | BK-15 rechecks the inventory; no unrelated Auth change |
| Matchmaking request create | users(10) → requests(30) → invitations(40) | Yes | Replaced by MM-23 with the same order |
| Request cancel | requests(30) → invitations(40) | Yes | Replaced by MM-25 (adds users first) |
| Invitation send | requests(30) → invitations(40) | Yes | MM-22 |
| Invitation respond/cancel/withdraw | users(10) → requests(30) → invitation(40) → insert matches/match_players(50) → update request (already held) → **close other pending invitations(40)** | **No** (rank 40 after 50; currently shielded because every other writer of those rows first waits on the request row) | MM-22: close pending rows before creating the Match (§24.5 step 6) |
| Match leave | matches(50) → jobs(55) | Yes | MM-25 alias locks users(10) → requests(30) first |
| Matchmaking scheduler steps 4–6 | matches with joined `matchmaking_matches` and `bookings` locked (no `OF m`) | Yes by rank, but locks bookings needlessly | MM-27: use `FOR UPDATE OF m SKIP LOCKED` |
| Ratings submit + adjustment | player_profiles(20) ascending | Yes | RT-10 keeps it |
| Avatar upload / profile name | player_profiles(20) | Yes | — |

New transactions (this extension):

| Transaction | Order |
| --- | --- |
| Create match-finding post | users(10, host) → posts(100 insert, new uncommitted parent row) → requests(30 insert with `post_id` FK, new row) (existing-row locks always follow `requests(30) → posts(100)`) |
| Edit recruitment / publish | users(10, host + members snapshot) → requests(30) → posts(100, publish only) |
| `acceptMembership` (Invite response, Apply decision) | users(10) → requests(30) → invitations(40, complete affected set including target, ascending id) → matches(50) |
| Apply / Invite send | users(10, host + joiner) → requests(30) → invitations(40) |
| Withdraw, early close, host cancel, author deletion | users(10) → requests(30) → invitations(40) → matches(50) → jobs(55) → posts(100, author deletion) |
| Court set (external) | users(10, host + members) → requests(30) → matches(50) |
| Court link (booking; MM-19) | users(10, host + members) → requests(30) → matches(50) → bookings(80, the linked booking) |
| Scheduler per recruitment | claim requests SKIP LOCKED; then users(10, snapshot) → requests(30) → invitations(40) → matches(50) |
| Booking cancellation reconcile | claim requests/matches SKIP LOCKED without locking bookings; per item as above |
| MM-20 worker | claim jobs(55) SKIP LOCKED → bookings(80) → payments(85) |
| Block | users(10, both ascending) → requests(30, affected ascending) → invitations(40) |
| Message send | users(10, sender) → conversations(90) → messages(95) |
| Message reaction | conversations(90) → message and reaction rows(95); authorize under the conversation lock before mutation |
| Read / leave / rejoin / typing | conversations(90) → conversation_members/typing(95); authorize under the conversation lock |
| Heartbeat | user_presence(95) only |
| Post create/edit/delete (free), comment, reaction | users(10, quota where needed) → posts(100) → comments/reactions(105) |
| Admin hide | posts(100) or comments(105) only |
| Report creation | inserts only |

The "overlapping pending rows" closed in `acceptMembership` belong to other
requests. Their `matchmaking_requests` rows are not locked; the conditional
`UPDATE … WHERE status = 'PENDING'` at rank 40 is enough, because closing a
pending row changes no recruitment invariant. A concurrent acceptance of one of
those rows conflicts only at rank 40 and loses the conditional update.

#### 24.7.4 Result

The approved target requires BK-15 and all affected writers to follow this rank.
Explicit-lock analysis is not a proof that implicit FK/unique-index waits cannot
produce a deadlock; implementation must review those waits and verify concurrent
paths before release. The only cross-module pair that previously ran in
opposite directions (Booking create `bookings → users` versus booking linking
`users → bookings`) becomes `users → … → bookings` on both sides. The rule set is
recorded in `docs/architecture/conventions.md` by this approval. No claim of implemented lock-order verification is made. MM-30 and the
concurrency cases in MM-22, MM-25, MM-27, MM-28, MSG-04, MSG-08 and BK-15 verify
it during implementation.

### 24.8 Scheduler

The existing in-process tick (60 s) runs, in order: reconcile cancelled bookings →
expire pending Apply/Invite → start-time processing per due recruitment (one
transaction each, using the §24.7 order, `FOR UPDATE SKIP LOCKED` claim) →
`IN_PROGRESS → COMPLETED` at `start_at + duration`. Start-time processing implements the start rows of §24.4. Pending rows expire at `min(created_at + timeout, start_at)` and are closed at recruitment close.




### 24.9 API (all under `/api/v1`, session + CSRF, Player role)

| Method/path | Purpose | Notes |
| --- | --- | --- |
| `POST /posts` (Social) | Canonical creation of a match-finding post | Recruitment payload validated by `RecruitmentPort` in the same transaction |
| `GET /matchmaking-requests/:id` | Recruitment detail | Host: full; current member: members, court, deadlines; pending invitee: response context; other Players: public card fields when published and the post is visible |
| `PATCH /matchmaking-requests/:id` | Edit recruitment fields | `start_at`, `match_type`, `capacity` locked once any member is accepted (`MATCHMAKING_FIELD_LOCKED`) |
| `POST /matchmaking-requests/:id/publish` | Publish | Host; `OPEN`; at least one open slot; lead time |
| `POST /matchmaking-requests/:id/close` | GROUP early close | Host; count ≥ min and accepted ≥ 1 |
| `POST /matchmaking-requests/:id/cancel` | Host cancel/leave | Body `{ bookingAction: "KEEP" \| "CANCEL" }`; `CANCEL` returns `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE` until MM-20 |
| `PUT /matchmaking-requests/:id/court` | Set external court, or link booking | `{ kind: "EXTERNAL", ... }` allowed; `{ kind: "BOOKING", bookingId, sameVenueConfirmed }` returns `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE` until MM-19. When replacing an external court, `sameVenueConfirmed: true` is required (§24.15), otherwise `400 MATCHMAKING_SAME_VENUE_CONFIRMATION_REQUIRED` |
| `POST /matchmaking-requests/:id/withdraw` | Member withdraws | Before full → slot freed; GROUP after full → reopen; Singles/Doubles after full → Match cancelled |
| `POST /matchmaking-requests/:id/applications` | Apply | Published, open, not blocked, schedule check |
| `GET /matchmaking-requests/:id/applications` | Host's applicant list | Host only |
| `GET /matchmaking-applications` | My applications | Paginated |
| `PUT /matchmaking-applications/:id` | Host decision `{ decision: "ACCEPTED" \| "DECLINED" }` | Uses `acceptMembership` |
| `POST /matchmaking-applications/:id/cancel` | Applicant cancels pending | Idempotent |
| Existing invitation endpoints | Unchanged paths | Operate on `kind = INVITE` rows only; responses keep `inviteeId` |
| `POST /matchmaking-invitations/:id/withdraw`, `POST /matches/:id/leave` | Kept as aliases of `withdraw` during the transition | Removed only after the frontend stops using them |

Compatibility of the old creation endpoint: `POST /matchmaking-requests` is
removed in the same release in which the frontend switches to `POST /posts`. The
frontend is the only consumer. A stale tab calling it receives `404`; the frontend
shows a "please reload" message on that path.

New error codes (409 unless stated): `MATCHMAKING_ALREADY_ACTIVE`,
`MATCHMAKING_REQUEST_FULL`, `MATCHMAKING_POST_NOT_PUBLISHED`,
`MATCHMAKING_OPEN_POST_LIMIT` (replaces `MATCHMAKING_ACTIVE_REQUEST_LIMIT`),
`MATCHMAKING_FIELD_LOCKED`, `MATCHMAKING_EARLY_CLOSE_NOT_ALLOWED`,
`MATCHMAKING_COURT_CHANGE_NOT_ALLOWED`, `MATCHMAKING_BOOKING_ACTION_UNAVAILABLE`,
`MATCHMAKING_ACTION_NOT_AVAILABLE` (neutral code used when a block prevents the
action, so the block is not revealed), `MATCHMAKING_APPLICATION_NOT_FOUND` (404),
`MATCHMAKING_APPLICATION_NOT_PENDING`, `MATCHMAKING_APPLICATION_EXPIRED`;
`400`: `MATCHMAKING_INVALID_CAPACITY`, `MATCHMAKING_INVALID_DURATION`,
`MATCHMAKING_INVALID_COURT`.

#### 24.9.1 Apply resource representation (MM-24 implementation, 2026-11-01)

The existing five approved Apply paths above use the standard `{ data }` / `{ data, meta }` envelope. Create accepts an empty/omitted JSON object only (no application message field); success is 201. Active Invite or Apply duplicates return 409 `MATCHMAKING_ALREADY_ACTIVE`, rather than creating another row. No `clientRequestId` or schema change is introduced for this resource.

Host list and my list accept `page` (default 1), `limit` (default 20, maximum 50) and optional `status` (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`, `WITHDRAWN`). My list additionally accepts optional `requestId` to read the caller's application state in a post; it never widens caller scope. Order is `created_at DESC, id DESC`. Lists show effective expiry/closure even before a scheduler tick. Host list requires request ownership and returns neutral 404 otherwise; authorized host management survives Admin hiding a post.

Create/list Application DTO: `id`, `requestId`, `playerId`, `status`, `expiresAt`, `respondedAt`, `closeReason`, `createdAt`; `applicant { playerId, displayName, skill: { id, name, rank } | null, skillMismatch }`; `request { id, postId, hostId, matchType, startAt, durationMinutes, status }`. This is an explicit allowlist: no post text/media, court, roster, or unrelated applicant records. A BLOCKED closure reason is returned as null so the block is not disclosed. The skill warning is informative; the host may still approve.

Decision/cancel success: `{ data: { id, requestId, status, matchId } }`. Approval uses `acceptMembership` and returns the linked Match id when formed. Repeating an authorized accepted/declined/cancelled operation replays its result without another notification. Expired decisions persist the expired closure and then return `MATCHMAKING_APPLICATION_EXPIRED`; terminal non-pending rows return `MATCHMAKING_APPLICATION_NOT_PENDING`. Invite ids are rejected by Apply routes and Apply ids by Invite routes. Request detail exposes `invitationId` for `kind=INVITE` only.

Received/accepted/declined producers are MM-31 scope, delivered alongside these mutations in the same transaction with the Notifications Tech Design keys. Any notification write failure rolls back the membership/Match transition. No event or optimistic membership is fabricated while BlockPort is absent. Real-provider acceptance remains blocked on MSG-08 foundation/integration; production has no test double or permissive fallback.

### 24.10 Feature gates — single combined table

This table is authoritative for Social, Matchmaking and Messaging.

| Action | Social off | Matchmaking off | Messaging off |
| --- | --- | --- | --- |
| Create free post, edit, comment, react | Blocked | Allowed | Allowed |
| Create match-finding post | Blocked | Blocked | Allowed |
| Publish, new Apply, new Invite | Allowed (if Matchmaking on) | Blocked | Allowed |
| Respond to Invite, decide Apply, form Match, withdraw, cancel, court changes, author deletion via cancellation, scheduler | Allowed | Allowed | Allowed |
| Read feed/posts/recruitment | Allowed | Allowed | Allowed |
| Create group conversation (`POST /conversations/group`) or add group members | Allowed | Allowed | Blocked |
| Send message, react, start conversation, presence/typing | Allowed | Allowed | Blocked (no presence/typing recorded) |
| Read history, mark read, download readable attachments, leave group | Allowed | Allowed | Allowed |

The former "group conversation creation/membership sync" row is removed: since
2026-11-01 Matchmaking never creates or syncs conversations (`PROJECT-BRIEF.md`;
Messaging Tech Design §2). Gate behavior of Messaging's own group endpoints
(`POST /conversations/group`, `POST /conversations/:id/members`) is owned by the
Messaging Tech Design.

Any combination is the union of the blocked cells. Gate errors: `SOCIAL_DISABLED`,
`MATCHMAKING_DISABLED`, `MESSAGING_DISABLED` (409).

### 24.11 Migration and backfill

1. Preflight report (no writes): rows per status; non-null `matches.booking_id`
   on matchmaking Matches; requests with window shorter than their duration;
   config values outside the new ranges. Stop for review on any anomaly.
2. Schema (§13): add Social tables and recruitment/membership columns; rename
   membership columns; replace indexes in the same migration.
3. Backfill each legacy request: a `POSTS` row (`MATCH_FINDING`, author = host,
   `published_at` NULL, created at the request time); `start_at`: the linked
   booking's actual confirmed interval when one exists, otherwise
   `preferred_date + preferred_start_time` in `Asia/Ho_Chi_Minh`;
   `duration_minutes`: booking duration when booked, otherwise the snapshot
   `match_duration_minutes` (validated > 0 and fitting the old window; failing
   rows block the migration); `capacity = min_players = 2/4`; `kind = INVITE`.
   Statuses, timestamps and history are preserved; terminal rows stay terminal.
4. Conversations are not backfilled, and Matchmaking never creates them on demand
   for legacy or new recruitments (Messaging is standalone, 2026-11-01). Players
   create group conversations explicitly through Messaging (`POST /conversations/group`).
5. Config (System Config extension): seed new keys with `ON CONFLICT DO NOTHING`;
   never overwrite an existing value, including `MATCHMAKING_INVITATION_TIMEOUT_MINUTES = 15`;
   new defaults apply only when the key is absent.
   `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` stops being read after cutover and is
   retired later.
6. Release: backend and frontend together; aliases (§24.9) kept for one release.

### 24.12 Verification (priority cases)

- Concurrent decisions for the last slot (host approving an Apply while another
  invitee accepts): exactly one succeeds; the other gets
  `MATCHMAKING_REQUEST_FULL`; one Match.
- Invite and Apply for the same Player and request: only one active row.
- Concurrent final acceptances never create two Matches.
- GROUP: withdrawal after full reopens; replacement rechecks conflict and capacity,
  updates the roster in one transaction; at start ≥ min continues the same
  Match; reopened and below min at start cancels post and Match, keeps booking.
- Singles/Doubles withdrawal after full cancels the Match.
- Host cancel with `KEEP`; `CANCEL` rejected while MM-20 is blocked.
- Admin hide leaves recruitment, Match and member access unchanged; author deletion
  of an active post cancels first.
- Confirmed participation closes the Player's overlapping pending rows.
- Block closes pending rows between the pair and returns the neutral code.
- Gate table (§24.10) for each gate and for all gates off.
- Migration on a copy of populated data: preflight, backfill, no conversation
  created, history unchanged.

### 24.13 Final decisions — approved 2026-10-31

| # | Decision | Status |
| --- | --- | --- |
| 1 | Global lock order covering new and affected existing transactions (§24.7, including BK-15 reorder of Booking create) | Approved 2026-10-31; includes globally sorted membership locks and conversation-first reactions |
| 2 | Open-post limit counting | Approved 2026-10-31 — §24.14 |
| 3 | Replacing an external court by a booking | Approved with conditions 2026-10-31 — §24.15 |
| 4 | Cancellation-job keying by request (§13.6) | Approved 2026-10-31; UNIQUE request_id, nullable match_id; implementation remains dependent on MM-20 |

### 24.14 Open match-finding posts (approved 2026-10-31)

`MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER` counts recruitments hosted by the Player
that have not ended:

- `status = OPEN` (unpublished or published, recruiting), or
- `status = MATCHED` whose Match is `PENDING_COURT`, `CONFIRMED` or `IN_PROGRESS`.

Not counted: `CANCELLED`, `EXPIRED`, and `MATCHED` whose Match is `COMPLETED` or
`CANCELLED`. The count joins the Match status; it never relies on
`matchmaking_requests.status` alone. Counted under the host's `users` row lock
(rank 10) when creating a post.

### 24.15 External court → booking replacement (approved with conditions 2026-10-31)

- Allowed only while the post has an external court and no booking, when the
  host's CONFIRMED booking covers the whole post interval (`start_at` to
  `start_at + duration_minutes`).
- The request shows the host both sides for comparison: the declared external court
  (name, address, city/district) and the booking's facility (name, address,
  city/district, court). City/district equality is a supporting check only; it
  does not prove the same venue, and a mismatch shows a warning instead of a hard
  block.
- The host must confirm "đây là cùng sân" explicitly. The request stores
  `court_same_venue_confirmed_at`/`court_same_venue_confirmed_by` and keeps the
  declared external court fields as history (schema §13.3).
- The UI and API never present this as a platform verification. The court is shown
  as the linked booking, with the note "Chủ kèo xác nhận cùng địa điểm với sân đã
  khai báo".
- Members are notified (`MM_COURT_UPDATED`). Any other court change, or replacing a
  linked booking, stays rejected (`MATCHMAKING_COURT_CHANGE_NOT_ALLOWED`).
- Ships with MM-19 (BLOCKED).


### MM-24 dependency-unavailable response — 2026-11-01

A missing BlockPort provider still denies new Apply/Invite and acceptance, but is an expected unavailable condition: return the existing neutral `409 MATCHMAKING_ACTION_NOT_AVAILABLE` with safe user-facing text, rather than `500 INTERNAL_ERROR`. This does not assert a block exists, reveal provider internals, add an error code or allow the mutation. Registration of the real MSG-08 provider remains required.
