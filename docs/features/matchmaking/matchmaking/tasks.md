# Matchmaking (Ghép trận) — Task List

Implementation tasks for the invitation-based Matchmaking feature.

- Feature: Matchmaking (Ghép trận theo lời mời)
- Domain: `features/matchmaking/matchmaking`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions Q1–Q20 and readiness review §21.1)
- Status: Mixed — `Approved` for tasks without unresolved dependencies; `BLOCKED` where a dependency (Booking payment, Notification module) is not yet implemented. See the Summary table.

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **Environment note.** The Auth module has landed: `backend/src/middleware/auth.middleware.ts`
> delegates to the real session-based `shared/auth/authenticate.middleware` and
> enforces `requireRole`. Matchmaking endpoints are therefore not blocked on Auth.
> The Booking module has a Player booking flow, but a **Payment module** (to
> confirm/pay the booking) is not yet implemented; tasks that link a *paid*
> booking are marked `BLOCKED` on it. The **Notification module** is not yet
> implemented; notification tasks are `BLOCKED` on it.
>
> **Scope (2026-10-10).** MVP Matchmaking is invitation-only: no automatic
> matching, no automatic court selection/distance, no separate player
> confirmation. The request owner books a court through the Court Booking flow
> and links it to the Match.
>
> **No new decisions.** These tasks must not resolve any `[TBD]`, change business
> rules, the schema, or the API contract. Documentation Status: Ready — explicitly approved by Human owner on 2026-10-10.
Implementation dependencies remain BLOCKED where noted; Ready does not mean implemented.

Feature behavior is governed by
> `prd.md` and `tech-design.md`; the consolidated schema remains
> `docs/architecture/database-schema.md`.

## Summary

| ID | Task Title | Status | Dependencies | Estimated Size |
| --- | --- | --- | --- | --- |
| MM-01 | Matchmaking schema migration, indexes, and config seed (invitation-only) | DONE | — | M |
| MM-02 | Matchmaking repository and data-access layer | DONE | MM-01 | M |
| MM-03 | Matchmaking configuration reader | DONE | MM-01 | S |
| MM-04 | Candidate browsing and invitation service | DONE | MM-02, MM-03 | M |
| MM-05 | Atomic group formation and Match creation | DONE | MM-18, MM-02, MM-04 | M |
| MM-06 | Invitation timeout and request expiry jobs | DONE | MM-04, MM-05 | M |
| MM-07 | Match booking linkage service | BLOCKED | MM-05, Booking payment | S |
| MM-08 | Match leave and cancellation service | DONE | MM-05 | M |
| MM-09 | Matchmaking background scheduler | DONE | MM-05, MM-06, MM-08 | M |
| MM-10 | Matchmaking in-app notifications | BLOCKED | MM-05, MM-06, Notification module | S |
| MM-11 | Matchmaking request APIs (create/list/detail/cancel) | DONE | MM-03, MM-02 | M |
| MM-12 | Match read APIs (my matches, detail) | DONE | MM-02 | S |
| MM-13 | Invitation, withdrawal and leave command APIs | DONE | MM-04, MM-08 | M |
| MM-19 | Booking-link API | BLOCKED | MM-07, Booking payment | S |
| MM-20 | Booking cancellation/reconciliation | BLOCKED | MM-08, Booking cancellation, Payment | M |
| MM-14 | Frontend request, candidates, and invitation UI | IN_PROGRESS | MM-11, MM-13 (respond) | M |
| MM-15 | Frontend match detail, leave, and booking-link UI | IN_PROGRESS | MM-12, MM-19 (booking) | M |
| MM-16 | Frontend polling and notification integration | IN_PROGRESS | MM-10, MM-14, MM-15 | S |
| MM-17 | End-to-end and concurrency verification | IN_PROGRESS | MM-01 … MM-16, MM-18, MM-19, MM-20 | M |
| MM-18 | Match core (MatchModule) — shared Match/participant writer | DONE | MM-01 | M |

## Recommended Execution Order

| Phase | Tasks | Waits for |
| --- | --- | --- |
| 1 | MM-01 | — |
| 2 | MM-02, MM-03, MM-18 | MM-01 |
| 3 | MM-04 | MM-02, MM-03 |
| 4 | MM-05 | MM-18, MM-02, MM-04 |
| 5 | MM-06, MM-08 | MM-05 |
| 6 | MM-09 | MM-05, MM-06, MM-08 |
| 7 | MM-11, MM-12 | MM-02, MM-03 |
| 8 | MM-13 | MM-04, MM-08 |
| 9a | MM-07, MM-19, MM-20 | Booking payment/cancellation + MM-05/MM-08 |
| 9 | MM-10 | MM-05, MM-06 / Notification module |
| 10a | MM-14 | MM-11, MM-13 |
| 10b | MM-15 | MM-12, MM-19 |
| 11 | MM-16 | MM-10, MM-14, MM-15 |
| 12 | MM-17 | MM-01 … MM-16, MM-18, MM-19, MM-20 |

---

## [x] MM-01: Matchmaking schema migration, indexes, and config seed (invitation-only)

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Progress:** Migration `0007`, its Drizzle snapshot and journal are synchronized. Fresh/populated database verification and seed replay pass; legacy request/Match/result history and configured duration are preserved. No applied migration SQL was rewritten.

Migration `0004` (2026-09-26) applied the earlier auto-matching
delta (`matches.court_search_expires_at`, `matches.confirmation_expires_at`,
the `OPEN`-request index, supporting indexes, and seven `MATCHMAKING_*` keys).
The 2026-10-10 scope reduction requires a follow-up migration that reverses the
auto-matching objects and adds the invitation-timeout config.

**Objective:** Apply the invitation-only Matchmaking schema delta (Tech Design §10) and align the `MATCHMAKING_*` configuration keys, keeping `docs/architecture/database-schema.md` authoritative.

**Scope**

- In scope:
  - Add `MATCHMAKING_REQUESTS.area` (varchar); drop `latitude`, `longitude`, `max_distance_km`.
  - Drop `MATCHES.court_search_expires_at`, `MATCHES.confirmation_expires_at`, and their indexes.
  - Drop `MATCH_CONFIRMATIONS`.
  - Ensure `MATCHMAKING_INVITATIONS` exists with `expires_at` and the partial unique index `(request_id, invitee_id) WHERE status = 'PENDING'`.
  - Keep indexes: `MATCHES (status, scheduled_at)`, `MATCH_PLAYERS (player_id, match_id)`, `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'`.
  - Config seed: keep `MATCHMAKING_ENABLED`, `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `MATCHMAKING_MATCH_DURATION_MINUTES`; add `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` and `MATCHMAKING_MIN_LEAD_TIME_MINUTES`; remove `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`, `MATCHMAKING_CONFIRMATION_REQUIRED`, `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`, `MATCHMAKING_MAX_DISTANCE_KM`.
- Out of scope:
  - Any repository, service, API, or frontend code.
  - Adding `CHECK` constraints (documentation-only per Tech Design §21 Q6).

**Files/areas affected**

- `backend/src/db/schema/matchmaking.ts`
- `backend/src/db/migrations/`
- `docs/architecture/database-schema.md`
- `docs/features/matchmaking/matchmaking/tasks.md` (this file)

**API impact:** None.

**Verification**

- Integration: Migration applies cleanly on a fresh and a populated database; the dropped objects are gone; the new `area` and invitation table/index exist.
- Edge/failure/concurrency: The partial unique index rejects a second `OPEN` request for the same `(player_id, match_type)` while allowing `SINGLES` and `DOUBLES` simultaneously; a second `PENDING` invitation for the same `(request_id, invitee_id)` is rejected.
- Manual: Read each seeded config key and confirm the documented default.

**Acceptance criteria**

- **Given** a fresh database **When** the migration runs **Then** the approved invitation-only schema exists; retained request/Match/history data is preserved, while explicitly removed obsolete columns/table data is intentionally discarded.
- **Given** the seed runs twice **When** the `MATCHMAKING_*` keys are read **Then** each key exists exactly once with the documented default (§8.3).

---

## [x] MM-02: Matchmaking repository and data-access layer

```text
Status: DONE
Size: M
Blocked by: MM-01
```

**Objective:** Provide the persistence primitives for requests, invitations, Matches, and players, keeping SQL and locking out of controllers and services.

**Scope**

- In scope:
  - Request CRUD reads scoped to a Player with pagination (`page`, `limit`, optional `status`).
  - Invitation inserts/reads (pending, responded), the pending-invitation uniqueness, and closing pending invitations for a request.
  - Candidate query excluding the caller, the caller's group, and pending invitees.
  - Match creation inserts for `MATCHES`, `MATCH_PLAYERS`, `MATCHMAKING_MATCHES`, plus request status updates.
  - `SELECT ... FOR UPDATE` helpers for request claiming and Match row locking; atomic claim/update helpers for expiry transitions (expected-source-status predicate, bounded batch).
  - Match reads scoped to a participant, with `status`/`timeScope` filters and pagination.
  - Booking-link update helper (`booking_id`, `court_id`, `scheduled_at`, `status`).
- Out of scope:
  - Business policy (invitation eligibility, required counts) and HTTP concerns.
  - Court availability and booking writes (owned by Booking module).

**Files/areas affected**

- `backend/src/repositories/matchmaking/` `[Proposed — verify during implementation]`

**API impact:** None.

**Verification**

- Unit: Pagination and filter composition; effective-status derivation.
- Integration: `FOR UPDATE` claims are mutually exclusive; a timed-out request/invitation is excluded by the candidate/expiry queries.
- Edge/failure/concurrency: A claim update only matches rows still in the expected status.

**Acceptance criteria**

- **Given** a request with accepted invitees **When** the repository counts the group **Then** it returns the owner plus accepted invitees.
- **Given** a `PENDING` invitation past `expires_at` **When** the expiry query runs **Then** it is returned for transition to `EXPIRED`.

---

## [x] MM-03: Matchmaking configuration reader

```text
Status: DONE
Size: S
Blocked by: MM-01
```

**Objective:** Centralize read access to the `MATCHMAKING_*` configuration with documented defaults.

**Scope**

- In scope:
  - `MatchmakingConfigService` (or `shared/config/matchmaking-config.ts` following the Booking config pattern) for `MATCHMAKING_ENABLED`, `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`, `MATCHMAKING_MIN_LEAD_TIME_MINUTES`, `MATCHMAKING_MATCH_DURATION_MINUTES`.
  - Snapshot helpers to compute `expires_at` at request/invitation creation.
  - Feature-disable gate for `MATCHMAKING_ENABLED`.
- Out of scope:
  - Admin configuration management UI or endpoints.

**Files/areas affected**

- `backend/src/services/matchmaking/MatchmakingConfigService.ts` `[Proposed — verify during implementation]`
- `backend/src/shared/config/matchmaking-config.ts` `[Proposed — verify during implementation]`

**API impact:** None.

**Acceptance criteria**

- **Given** an empty `SYSTEM_CONFIGS` row set **When** the reader resolves `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` **Then** it returns `15` and does not throw.
- **Given** a configured value **When** a deadline snapshot is computed **Then** the snapshot equals creation time plus the configured interval.

---

## [x] MM-04: Candidate browsing and invitation service

```text
Status: DONE
Size: M
Blocked by: MM-02, MM-03
```

**Objective:** Implement candidate browsing and the direct-invitation lifecycle (create, accept, decline, cancel) per Tech Design §7.2.

**Scope**

- In scope:
  - Candidate query: existing non-deleted Players with profiles by name and skill (no online/ACTIVE requirement), excluding the caller, the caller's group, and pending invitees; defaults to the request's skill range but the owner may include out-of-range Players with a skill-mismatch warning; pagination.
  - Create invitation: self/duplicate rejection; `expires_at = min(now + INVITATION_TIMEOUT, request.expires_at)`; `status = 'PENDING'`.
  - Respond: accept/decline once, only while `PENDING` and not expired; acceptance binds the invitee; a transactional Player-lock-protected reservation check rejects an overlapping acceptance (`MATCHMAKING_SCHEDULE_CONFLICT`); notify the sender.
  - Cancel a `PENDING` invitation.
  - Close pending invitations when a request is matched/cancelled/expired.
- Out of scope:
  - Group formation/Match creation (MM-05).
  - Notification persistence details (MM-10).

**Files/areas affected**

- `backend/src/services/matchmaking/MatchInvitationService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/`

**Acceptance criteria**

- **Given** an `OPEN` request **When** the owner invites an eligible Player **Then** a `PENDING` invitation exists with `expires_at` equal to the earlier of the invitation timeout and the request deadline.
- **Given** an invitation past its deadline **When** the invitee responds **Then** it is rejected with `409 MATCHMAKING_INVITATION_EXPIRED`.
- **Given** an invitee accepts **Then** the invitee is bound to the sender's group and the sender is notified.

---

## [x] MM-05: Atomic group formation and Match creation

```text
Status: DONE
Size: M
Blocked by: MM-18, MM-02, MM-04
```

**Objective:** When the owner plus accepted invitees reach the full player count, create one Match atomically (Tech Design §7.4).

**Scope**

- In scope:
  - On acceptance, evaluate the group; when full, lock the request with `FOR UPDATE`, re-verify count and `OPEN` status, and create the Match.
  - Reject with `MATCHMAKING_SCHEDULE_CONFLICT` if any member is already committed to an overlapping Match.
  - Call `MatchModule.createMatchWithPlayers(...)` for `MATCHES` (`status = 'PENDING_COURT'`, `scheduled_at` from the request) and `MATCH_PLAYERS` (`ACTIVE`, `team_no`); insert `MATCHMAKING_MATCHES` (`status = 'MATCHED'`) and set the request to `MATCHED`.
  - `team_no` assignment (SINGLES: 1/2; DOUBLES: random 1,1,2,2).
  - Map a partial-unique-index violation to "already matched" without duplication.
- Out of scope:
  - Invitation lifecycle (MM-04), booking linkage (MM-07), notifications (MM-10), scheduler (MM-09).

**Files/areas affected**

- `backend/src/services/matchmaking/MatchmakingEngineService.ts` → rename to group-formation service `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/`

**Acceptance criteria**

- **Given** a `DOUBLES` group of the owner plus three accepted invitees **When** the last invitee accepts **Then** exactly one Match in `PENDING_COURT` is created, the request becomes `MATCHED`, and four `MATCH_PLAYERS` rows exist.
- **Given** two acceptances racing to fill the group **When** they compete for the last seat **Then** only one succeeds, the surplus invitation is closed, and only one Match exists and the request has one successful matchmaking result.

---

## [x] MM-06: Invitation timeout and request expiry jobs

```text
Status: DONE
Size: M
Blocked by: MM-04, MM-05
```

**Objective:** Expire invitations and requests on their snapshotted deadlines and release accepted invitees (Tech Design §7.3).

**Scope**

- In scope:
  - Expire `PENDING` invitations past `expires_at` (`EXPIRED`); notify the inviter.
  - Expire `OPEN` requests past `expires_at` (`EXPIRED`); close pending invitations; release accepted invitees; notify affected Players.
  - Atomic, bounded, idempotent batch updates.
- Out of scope:
  - Match creation (MM-05), scheduling loop (MM-09), notification persistence (MM-10).

**Files/areas affected**

- `backend/src/services/matchmaking/` `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/`

**Acceptance criteria**

- **Given** an `OPEN` request past `expires_at` with accepted invitees **When** the job runs **Then** the request is `EXPIRED`, pending invitations close, and accepted invitees are released exactly once.

---

## [ ] MM-07: Match booking linkage service

```text
Status: BLOCKED
Size: S
Blocked by: MM-05, Booking payment
```

**Objective:** Let the request owner link a paid booking to the Match, moving it to `CONFIRMED` (Tech Design §7.5).

**Scope**

- In scope:
  - Validate the actor is the request owner, the Match is `PENDING_COURT`, and the booking belongs to the owner, is paid/`CONFIRMED`, and is not already linked.
  - Set `MATCHES.booking_id`, `court_id`, `scheduled_at`, and `status = 'CONFIRMED'` through `MatchModule`; notify group members.
- Out of scope:
  - Creating/paying the booking (Booking/Payment modules).

**Files/areas affected**

- `backend/src/services/matchmaking/MatchService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/`

**Acceptance criteria**

- **Given** a `PENDING_COURT` Match and the owner's paid booking **When** the owner links it **Then** the Match becomes `CONFIRMED` with `court_id`/`booking_id`/`scheduled_at` set.
- **Given** a booking already linked to another Match **Then** it is rejected with `409 MATCH_BOOKING_ALREADY_LINKED`.

---

## [x] MM-08: Match leave and cancellation service

```text
Status: DONE
Size: M
Blocked by: MM-05
```

**Objective:** Let a participant leave before start, cancelling the Match, and reject leaving after start (Tech Design §7.6, §8.6).

**Scope**

- In scope:
  - Mark the participant `MATCH_PLAYERS.status = 'LEFT'` (through `MatchModule`); cancel the Match with reason `INSUFFICIENT_PLAYERS`.
  - Reject leave when the Match has started or is `IN_PROGRESS`/`COMPLETED`.
  - Idempotent leave on an already-cancelled Match.
- Out of scope:
  - Automatic substitution (Out of MVP), notifications (MM-10).

**Files/areas affected**

- `backend/src/services/matchmaking/MatchService.ts`
- `backend/src/repositories/matchmaking/`

**Acceptance criteria**

- **Given** a Match before `scheduled_at` **When** a participant leaves **Then** the participant is `LEFT` and the Match is `CANCELLED` with reason `INSUFFICIENT_PLAYERS`.
- **Given** a Match at/after `scheduled_at` **When** a participant attempts to leave **Then** the operation is rejected with `409 MATCH_ALREADY_STARTED`.

---

## [x] MM-09: Matchmaking background scheduler

```text
Status: DONE
Size: M
Blocked by: MM-05, MM-06, MM-08
```

**Objective:** Drive expiry and time-based Match transitions from one in-process scheduler (Tech Design §7.7).

**Scope**

- In scope:
  - 60-second in-process `setInterval` tick with a startup catch-up sweep.
  - Invoke invitation/request expiry jobs (MM-06).
  - Advance `CONFIRMED → IN_PROGRESS` when `scheduled_at <= now()` and `IN_PROGRESS → COMPLETED` after the duration / booking end.
  - Atomic claim/bounded batch per category.
- Out of scope:
  - Notification copy/delivery (MM-10); no matching tick (invitation-only).

**Files/areas affected**

- `backend/src/jobs/matchmakingScheduler.ts` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a `CONFIRMED` Match whose `scheduled_at` has passed **When** the scheduler ticks **Then** the Match becomes `IN_PROGRESS`, and later `COMPLETED`.
- **Given** overlapping ticks **Then** no row is processed twice.

---

## [ ] MM-10: Matchmaking in-app notifications

```text
Status: BLOCKED
Size: S
Blocked by: MM-05, MM-06, Notification module
```

**Objective:** Persist in-app notifications for invitation, group formation, cancellation, and expiry events (Tech Design §15).

**Scope**

- In scope:
  - `NOTIFICATIONS` rows for: invitation received, invitation response, invitation expired, Match ready, Match cancelled, request expired.
  - Scope recipients to the request owner, inviter, or Match participants.
- Out of scope:
  - Push/email; new notification endpoints.

**Files/areas affected**

- `backend/src/services/matchmaking/`, `backend/src/services/notifications/` (platform) `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a Match entering `PENDING_COURT` **When** notifications persist **Then** every group member receives a Match-ready notification.
- **Given** a request expiring with accepted invitees **Then** each affected Player receives a notification.

---

## [x] MM-11: Matchmaking request APIs (create/list/detail/cancel)

```text
Status: DONE
Size: M
Blocked by: MM-03, MM-02
```

**Objective:** Expose the Player-facing Matchmaking Request endpoints (Tech Design §9.1–§9.4).

**Scope**

- In scope:
  - `POST /api/v1/matchmaking-requests` (validation including `MATCHMAKING_MIN_LEAD_TIME_MINUTES`, `expires_at` snapshot, feature gate, one-`OPEN`-per-match-type).
  - `GET /api/v1/matchmaking-requests` (caller-scoped, paginated).
  - `GET /api/v1/matchmaking-requests/:id` (owner or current accepted invitee; scoped response).
  - `POST /api/v1/matchmaking-requests/:id/cancel` (owner-only, `OPEN` only, idempotent; closes invitations, releases invitees).
- Out of scope:
  - Match endpoints and invitation endpoints.

**Files/areas affected**

- `backend/src/routes/matchmaking/`, `backend/src/controllers/matchmaking/`, `backend/src/validation/matchmaking.ts`, `backend/src/app.ts` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a signed-in Player with no open `SINGLES` request **When** they create a valid request **Then** `201` returns an `OPEN` request with a snapshotted `expiresAt`.
- **Given** an existing `OPEN` `SINGLES` request **When** the Player creates another **Then** `409 MATCHMAKING_ACTIVE_REQUEST_LIMIT`.

---

## [x] MM-12: Match read APIs (my matches, detail)

```text
Status: DONE
Size: S
Blocked by: MM-02
```

**Objective:** Let a Player list their Matches and view a Match detail (Tech Design §9.5–§9.6).

**Scope**

- In scope:
  - `GET /api/v1/matches` caller-scoped with `status`/`timeScope` and pagination.
  - `GET /api/v1/matches/:id` participant-only, with court/facility summary, price/payer when booked, players with `teamNo`, and the request-owner flag.
  - Booking id exposure only to the request owner.
- Out of scope:
  - Creating Matches, leaving, booking link, tournament Match views.

**Files/areas affected**

- `backend/src/controllers/matchmaking/`, `backend/src/repositories/matchmaking/` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a non-participant **When** they request a Match detail **Then** `404 MATCH_NOT_FOUND`.
- **Given** a `PENDING_COURT` Match **Then** the response shows no court; the booking id is absent for non-owners.

---

## [x] MM-13: Matchmaking invitation and leave command APIs

```text
Status: DONE
Size: M
Blocked by: MM-04, MM-08
```

**Objective:** Expose candidate browse, invitation commands, withdrawal and leave endpoints (Tech Design §9.7–§9.13).

**Scope**

- In scope:
  - `GET /api/v1/matchmaking-requests/:id/candidates`.
  - `POST /api/v1/matchmaking-requests/:id/invitations`, `GET /api/v1/matchmaking-invitations`, `PUT /api/v1/matchmaking-invitations/:id`, `POST /api/v1/matchmaking-invitations/:id/cancel`.
  - `POST /api/v1/matches/:id/leave`.
  - `POST /api/v1/matchmaking-invitations/:id/withdraw` (accepted invitee, before formation).
- Out of scope:
  - Request CRUD (MM-11), Match reads (MM-12), booking link (MM-19).

**Files/areas affected**

- `backend/src/routes/matchmaking/`, `backend/src/controllers/matchmaking/`, `backend/src/validation/matchmaking.ts` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** an authenticated owner **When** the candidates/send/list/respond/cancel endpoints are called **Then** the documented status codes and payload shapes are returned.
- **Given** a participant before start **When** they call leave **Then** the Match is `CANCELLED`.
- **Given** an accepted invitee before formation **When** they withdraw **Then** their reservation is released and the owner is notified.

---

## [ ] MM-14: Frontend request, candidates, and invitation UI

```text
Status: IN_PROGRESS
Size: M
Blocked by: MM-11, MM-13 (respond)
```

**Objective:** Let a Player create a request, browse candidates, send invitations, and manage received/sent invitations.

**Scope**

- In scope:
  - Request form: match type, date/time window, skill preference, area (with fast-fill defaults from profile skill and last-used area).
  - My-requests list with status, required/remaining count, and cancel.
  - Candidate browse + send invitation; invitation inbox (received/sent) with accept/decline and a real deadline countdown.
  - Loading/empty/success/error/cancelled/expired states.
- Out of scope:
  - Match detail/leave/booking (MM-15), polling (MM-16).

**Files/areas affected**

- `frontend/src/features/matchmaking/` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a Player with an `OPEN` request **When** they invite a candidate **Then** the pending invitation and its countdown appear.
- **Given** an `OPEN` request **When** the Player cancels it **Then** the list shows `CANCELLED` and the cancel action is gone.

---

## [ ] MM-15: Frontend match detail, leave, and booking-link UI

```text
Status: IN_PROGRESS
Size: M
Blocked by: MM-12, MM-19 (booking)
```

**Objective:** Let a matched Player view details, leave before start, and (as owner) link a court booking.

**Scope**

- In scope:
  - Match list/detail: match type, status, playing time, court/facility, price and payer when booked, players and teams.
  - Leave action before start with a clear consequence message.
  - Owner flow: pick/link an existing booking and show the resulting court/time.
  - States: loading, pending-court, confirmed, cancelled, completed.
- Out of scope:
  - Creating/paying the booking (Booking/Payment UI).

**Files/areas affected**

- `frontend/src/features/matchmaking/` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a Match before start **When** the Player leaves **Then** the UI shows `CANCELLED`.
- **Given** the request owner with a paid booking **When** they link it **Then** the UI shows `CONFIRMED` with court and time.

---

## [ ] MM-16: Frontend polling and notification integration

```text
Status: IN_PROGRESS
Size: S
Blocked by: MM-10, MM-14, MM-15
```

**Objective:** Keep request, invitation, and Match state current through HTTP polling and surface in-app notifications.

**Scope**

- In scope:
  - Poll request/invitation/Match status every 5–10 seconds while a relevant view is open; refresh on focus; stop on unmount.
  - Surface unread Matchmaking notifications through the platform notification view.
- Out of scope:
  - New realtime transport; push/email.

**Files/areas affected**

- `frontend/src/features/matchmaking/` `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a Player viewing a Match **When** the server state changes **Then** the view reflects it within one polling cycle.

---

## [ ] MM-17: End-to-end and concurrency verification

```text
Status: IN_PROGRESS
Size: M
Blocked by: MM-01 … MM-16, MM-18, MM-19, MM-20
```

**Objective:** Verify the critical invitation-based flows and concurrency/idempotency guarantees.

**Scope**

- In scope:
  - E2E: create request → invite → accept to full count → Match `PENDING_COURT` → owner books and links → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`; cancel request; request expiry with a partial group; leave before start.
  - Concurrency: two acceptances racing to fill the group; acceptance racing request expiry/cancel; duplicate respond/leave.
- Out of scope:
  - New product behavior.

**Files/areas affected**

- `backend/src/__tests__/`, `frontend/` E2E harness `[Proposed — verify during implementation]`

**Acceptance criteria**

- **Given** a fresh test database with seeded players **When** the E2E runs **Then** exactly one Match is created per successful group and it reaches `COMPLETED`.
- **Given** request expiry with accepted invitees **Then** invitees are released and notified exactly once.

---

## [x] MM-18: Match core (MatchModule) — shared Match/participant writer

```text
Status: DONE
Size: M
Blocked by: MM-01
```

**Objective:** Implement `MatchModule` as the single writer of `MATCHES` and `MATCH_PLAYERS`, consumed by Matchmaking and Tournament (Tech Design §7.1, Q17).

**Scope**

- In scope:
  - `createMatchWithPlayers({ matchType, scheduledAt, courtId?, bookingId?, players })` inserting `MATCHES` and `MATCH_PLAYERS` transactionally, including `team_no`.
  - Status/participant mutations used by features: link booking (`court_id`/`booking_id`/`scheduled_at`/`status`), transition `status`, mark a `MATCH_PLAYERS` row `LEFT`.
  - Participant/scoped reads used by Matchmaking and Ratings.
- Out of scope:
  - Matchmaking-specific policy (invitations, overlap, required counts) and HTTP concerns.

**Files/areas affected**

- `backend/src/contracts/MatchModule.ts`
- `backend/src/services/match/` `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/` (shared Match/MATCH_PLAYERS access)

**Acceptance criteria**

- **Given** Matchmaking forms a full group **When** it calls `createMatchWithPlayers` **Then** exactly one `MATCHES` row and the correct `MATCH_PLAYERS` rows are created in one transaction.
- **Given** a feature mutates Match status/participants **Then** it does so through `MatchModule`, not by writing `MATCHES`/`MATCH_PLAYERS` directly.

---

## [ ] MM-19: Booking-link API

Status: BLOCKED. Dependencies: MM-07, Booking payment. Documentation: Ready.
Expose POST /api/v1/matches/:id/booking with complete date/window/duration/future,
owner and schedule validation, shared locks, same-booking idempotent replay and
outside-area success. Verify competing linkage/cancel and duplicate retries.

## [ ] MM-20: Booking cancellation and reconciliation

Status: BLOCKED. Dependencies: MM-08, Booking cancellation, Payment.
Documentation: Ready. Persist MATCH_BOOKING_CANCELLATION_JOBS in the cancellation
transaction; bounded worker retries transient errors, exposes policy refusal and
calls Booking idempotently. Booking cancellation cancels linked Match; reconcile
before starting/completing a Match. Verify rollback, crash/retry, duplicate refund
prevention, policy refusal and cancellation-vs-link/time advancement.

## Approved scope refinements (Human owner, 2026-10-10)

These are required acceptance criteria for existing tasks, not optional follow-up:

| Task | Additional approved scope and verification |
| --- | --- |
| MM-01 | Duration snapshot, booking deadline, WITHDRAWN, cancellation reasons, cancellation-job table and expiry/inbox indexes. Area nullable only for legacy rows; new requests require selected area. Use next migration; preserve applied history. |
| MM-02 | Effective-status filter/count pagination; cleanup expired rows before uniqueness checks; shared Player scheduling locks and caller transaction helpers. |
| MM-03 | Include minimum lead time; disabled gates new requests/invitations only. |
| MM-04 | No invitee online/ACTIVE filter; name search/includeOutOfRange, stable order/warning; oversubscription, reinvite history, accepted withdrawal and partial-group reservations. |
| MM-05 | Final accept and formation one transaction; pending invites close atomically; rollback final accept on failure; lock shared Players across different requests. |
| MM-06 | Request deadline capped at preferred start; release accepted reservations without rewriting response history; dedup notifications. |
| MM-07 | Paid future same-day booking wholly in window, exact duration snapshot; outside-area allowed, recheck all schedules, same-link replay. |
| MM-08 | PENDING_COURT leave/deadline handling; persist linked-booking cancellation job; effective cancelled replay. |
| MM-09 | Scope via MATCHMAKING_MATCHES; pending-court expiry/reconcile before time progression; schedule-based started_at/completed_at including catch-up. |
| MM-10 | Notification platform dependency; same-transaction persistence and resource/dedup keys; request cancel/withdraw and booking cancellation events. |
| MM-11 | Create validates owner reservations; accepted-member request detail with scoped fields/group counts/result link. |
| MM-12 | Matchmaking-only joins, authoritative booked interval, owner-only cancellation progress and booking id. |
| MM-14 | Selected city/district, name search and out-of-range toggle; invitation context, partial group and withdrawal; no activity requirement. |
| MM-15 | Out-of-area booking permitted; duration/window validation feedback, pending-court timeout and booking cancellation outcome. |
| MM-17 | All §21.1 review verification cases, including cross-request overlaps, disabled journeys, outside-area booking and invitation without activity filter. |
| MM-18 | Shared caller-owned transaction; contract status/input/mutations/reads update; Tournament participant handoff. |

## Completion Checklist (per task, when implemented)

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `[TBD]` or business rule was silently resolved.
- [ ] No unrelated files or refactors were included.

## Review fixes and outstanding work — 2026-10-10

The twelve review findings were addressed: scheduling writers lock Player rows
before request/invitation rows; group membership is re-read with transaction retry
if the pre-lock member set changed; formation rechecks all reservations. Withdrawal
uses the same transaction/lock ordering and WITHDRAWN replay returns 200. Deadline
validation runs after locks; expired invitation transitions commit before the API
returns its conflict. Expired reservations and invitations do not block scheduling
or reinvitation. Closed partial requests revoke live member access, while formed
Match participants retain their own access. Match reads/filter/count derive the
same effective status. Scheduler reconciles cancelled bookings before advancement;
transition guards require usable booking state. Overdue pending-court leave
persists cancellation. Standalone Match core creation wraps a transaction.
Frontend delegates configured duration/lead-time rules and messages to backend.

Completed in the follow-up implementation:
- MM-01: 0007 snapshot/journal synchronized; fresh/populated isolated-database
  tests, seed replay, retained request/Match/result history and configured duration
  backfill pass. Drizzle produces no further migration from the snapshot.
- MM-14: city/district select reuses the existing public court/facility API,
  deduplicates paginated values and restores last-used area; group detail shows
  members/progress and accepted-member withdrawal only while effectively OPEN.
  Withdrawal navigates away after access is revoked. Invitation history links to
  the resulting Match; direction changes reset pagination.
- MM-15 (partial): paginated Match list/detail, booked time/court/price/payer,
  pending-court deadline and pre-start leave confirmation/cancelled state.
- MM-16 (partial): request/invitation/Match polling every five seconds, refresh on
  focus, pause while hidden, discard obsolete results and stop on unmount.
- MM-17 (partial): concurrency/API suite and seven Chrome UI tests cover area
  selection/restore, partial-group formation via polling, withdrawal navigation
  confirmed leave/cancellation, candidate search/invitation, request cancel and
  invitation acceptance/decline. UI tests mock domain API responses; these
  are not evidence of a complete backend-to-payment E2E journey.

Outstanding:
- MM-14 remains IN_PROGRESS: profile-skill fast-fill cannot be wired yet because
  the current Auth response has no skill and no Player Profile read API exists.
  The form still supports explicit skill selection; candidate/inbox and
  cancellation browser flows are verified.
- MM-07/MM-19 and the remaining MM-15 booking-link UI require paid Booking/Payment.
- MM-20: cancellation-job consumer, retries, policy-refusal outcome and refund
  integration remain blocked. Reconciliation does not consume cancellation jobs.
- MM-10/NTF-01–04 and remaining MM-16 notification integration require the
  Notification module (schema/contract/APIs/persistence/UI).
- MM-17 complete paid-booking/refund/notification E2E awaits those integrations.

Documentation Status remains Ready. DONE/IN_PROGRESS/BLOCKED describe actual
implementation completion, independently of documentation readiness approval.
No commit, deployment or production migration is implied.

Verification: 29 backend tests pass (27 matchmaking + 2 migration scenarios),
backend TypeScript passes, frontend production build passes, and seven Chrome UI
checks pass. The build reports an existing bundle-size warning above 500 kB;
no payment/refund/notification delivery is claimed by these checks.

## Ratings host alignment — approved 2026-10-15

Ratings RT-05 composes the shared rating view into existing casual Match Details/History; Matchmaking retains ownership of those pages and casual-only list/detail endpoints. Ratings owns the component, rules and APIs. Do not move casual pages into `features/ratings/` or widen casual endpoints to serve Tournament Matches. Completed retained participants enable rating; cancelled/expired/withdrawn groups never do. After all targets are rated, retain a read-only viewing entry. Ratings-given history is a separate Player route (`/ratings/given`, RT-07). See Ratings PRD §15 and Tech Design §23 for approved behavior.

### Match Detail frontend refinement — 2026-10-19

User authorized the P23/P47 UI refinement proposal. The implemented slice includes
five Match states, responsive panels/teams, owner-only booking access, existing
Ratings integration, accessible leave confirmation and stale-poll feedback.
Booking flow retains `matchId` navigation context and a return-to-Match link;
it does not link or confirm a booking. No API, schema or business-rule change.

MM-07/MM-19 remain BLOCKED: backend booking-link route/service and paid Booking
flow are absent. MM-20 cancellation/refund consumption remains blocked as already
recorded. The earlier review's suggestion that a booking-link endpoint already
existed was corrected after checking routes/controllers.

Focused browser verification is tracked in `frontend/e2e/match-detail.spec.ts`,
with existing Matchmaking/Ratings suites retained as regressions. This refinement
does not mark the entire MM-15 or MM-17 task complete.

Verification on 2026-10-19: frontend build and lint passed (existing effect warnings
and bundle-size warning remain); 32 Playwright cases passed: 11 focused Match
Detail cases, 7 Matchmaking regressions, 13 mocked Ratings cases and 1 real-session
Ratings case against `badminton_test`. Used temporary Vite/Playwright configs on
ports 5187/3017 to avoid the existing development server. The first temporary
config used a 5-second assertion timeout and raced the 5-second formation poll;
restoring the repository's 10-second assertion timeout passed the same regression.
Desktop/360-pixel screenshots were inspected. Paid-booking linkage was not tested
or claimed because the required service/route and Payment module are absent.

---

# Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

Governing design: [Tech Design §24](tech-design.md) (Ready). Schema:
`docs/architecture/database-schema.md` §13 (Ready). Documentation approval
was granted by the human owner on 2026-10-31; tasks remain BLOCKED where
implementation dependencies are unfinished. Existing MM-01…MM-20 keep their status and history; DONE tasks are not
reopened.

## Extension summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| MM-21 | Recruitment/membership schema migration, preflight and legacy backfill | IN_PROGRESS | SOC-01, SC-12 | L |
| MM-22 | Membership refactor (`player_id`, active-row uniqueness) and shared `acceptMembership` | IN_PROGRESS | MM-21, MSG-08 foundation (BlockPort) | L |
| MM-23 | `RecruitmentPort`: create/validate/edit/publish, open-post limit | IN_PROGRESS | MM-22 | M |
| MM-24 | Apply resource API | BLOCKED | MM-22, MM-23, MSG-08 foundation (BlockPort) | M |
| MM-25 | Withdrawal, GROUP reopen/replacement, early close, host cancel (`KEEP`) | BLOCKED | MM-22 | L |
| MM-26 | Schedule conflict on post intervals and auto-close of overlapping pending rows | IN_PROGRESS | MM-21 | M |
| MM-27 | Scheduler start/end processing for all post types | BLOCKED | MM-25, MM-28 | M |
| MM-28 | External court set and external→booking replacement rules | BLOCKED | MM-23 (booking variant also MM-19, BK-15) | M |
| MM-29 | Frontend recruitment creation/management, applicants, withdrawal | BLOCKED | MM-23…MM-28, SOC-08 | L |
| MM-30 | Concurrency, lock-order and migration verification | BLOCKED | MM-21…MM-29 | M |
| MM-31 | Social Matchmaking notifications | BLOCKED | NTF-02, NTF-05, MM-24, MM-25 | M |

Extension impact on existing, not-DONE tasks (scope notes, status unchanged):

| Task | Note |
| --- | --- |
| MM-07 / MM-19 | Link target becomes `matchmaking_requests.booking_id`; booking must cover the post interval; linking never changes post time; allowed before formation (§24.3). |
| MM-20 | Cancellation jobs keyed by request (`database-schema.md` §13.6); host-chosen `CANCEL` on post cancellation uses the same job. Until MM-20 is DONE the API rejects `CANCEL` (§24.9). |
| MM-10 | Superseded in scope by MM-31 for new events; existing invitation-only events remain. |
| MM-14 / MM-15 / MM-16 | Current UI work continues on the baseline; MM-29 replaces creation and adds management screens. |
| MM-17 | Baseline verification only; extension verification is MM-30. |

## Social Matchmaking extension — cross-module execution order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 0 (existing prerequisites) | NTF-01, NTF-02, NTF-03; RP-01, RP-02 | — |
| 1 | SC-12, SOC-01, AUTH-26, AUTH-28, PP-08, BK-15 | Ready docs (BK-15: §24.7 approved 2026-10-31) |
| 2 | MM-21, SOC-02, MSG-01, RT-09 | SOC-01 / SC-12 |
| 3 | MM-22, MM-26, SOC-03, MSG-02, RT-10 | MM-21 / SOC-02 |
| 4 | MM-23, SOC-05; Messaging: MSG-03 (WebSocket hub), MSG-04, MSG-07, MSG-08 | MM-23 ← MM-22; SOC-05 ← SOC-01, MM-21; Messaging tasks per [Messaging tasks](../../messaging/tasks.md) (MSG-03 ← MSG-02 only; not Matchmaking) |
| 5 | MM-24, MM-25, MM-28, SOC-04 (creation part), SOC-06, SOC-07, MSG-05, MSG-06, NTF-05, RP-05 | MM-24 ← MM-22, MM-23, MSG-08 foundation; MM-25 ← MM-22; SOC-04 creation ← SOC-03, MM-23 |
| 6 | MM-27, MM-31, SOC-04 (active-post deletion part), RP-06, RP-07 | MM-25, MM-28, NTF-05; SOC-04 deletion ← MM-25 (cancellation) and MM-31 (member notification) |
| 7 | MM-29, SOC-08, MSG-09, AUTH-27, PP-09, RT-11 | backend waves |
| 7b | RP-08 (shared Player reporting UI and entry wiring) | RP-06, SOC-08, MSG-09 |
| 8 | MM-30, SOC-09, MSG-10 (cross-module regression/E2E only; every task above carries its own tests and cannot be DONE without them) | all, including RP-08 |
| Blocked outside the waves | Booking-linked parts of MM-28 and host `CANCEL` (MM-19, MM-20 ← BK-06, BK-07, Payment, BK-15, §24.7) | — |

Messaging is standalone (`PROJECT-BRIEF.md`, decision 2026-11-01; Messaging Tech
Design §2). No Matchmaking task creates, syncs, revokes or locks a conversation, and
there is no `GroupConversationPort`. MSG-03 is the WebSocket hub
(`/api/v1/ws/messaging`) and waits only for MSG-02; it does not block any MM task.

Matchmaking consumes MSG-08 in two stages (human-approved 2026-11-01):

- Foundation after MSG-02: real `BlockPort.isBlockedEitherWay(a, b, tx)`. MM-22 acceptance checks and MM-24 may use this before the whole MSG-08 task is DONE.
- Integration: Messaging's block transaction calls `MatchmakingBlockPort.closePendingBetween(a, b, tx)`, owned by MM-22. That operation only needs the MM-21 membership schema and may be delivered before MM-22 as a whole is DONE. MSG-08 integration waits for this operation, not for all of MM-22; no circular task dependency is introduced.
- MM-24 implementation can proceed with MM-22/MM-23 and the foundation provider, but final cross-module verification must cover block closing pending rows atomically. MSG-08 remains open until both stages pass.
- Optional create-group shortcuts are deferred from SOC-08/MM-29; Players explicitly create groups in Messaging.

---

## [ ] MM-21: Recruitment/membership schema migration, preflight and legacy backfill

```text
Status: IN_PROGRESS
Size: L
Blocked by: SOC-01; SC-12
```

**Objective:** Apply `database-schema.md` §13.3, §13.5, §13.6 and backfill legacy rows per §24.11.

**Implementation status (2026-11-01, IN_PROGRESS, not DONE):** migration `0014_recruitment_membership_foundation` with an in-migration preflight that stops on anomalies, read-only script `src/db/preflight/mm21-preflight.ts`, schema in `db/schema/matchmaking.ts`. `mm21-migration.test.ts` 5/5 on fresh and populated scratch DBs (OPEN/MATCHED/CANCELLED/EXPIRED requests, accepted/pending/withdrawn/declined rows, PENDING_COURT and CONFIRMED-with-booking Matches, a cancellation job); both acceptance criteria verified. The legacy `POST /matchmaking-requests` now also creates the unpublished post until MM-23 removes it. Missing before DONE: full regression, schema PR review, and confirmation of the NOT NULL choice for `capacity`/`min_players`.

**Scope**

- In scope: read-only preflight report (stop on anomalies); columns, CHECKs, renamed membership columns, replaced indexes; posts backfill (`published_at` NULL); `start_at`/`duration_minutes` from the confirmed booking when present, otherwise window start + snapshot; `kind = INVITE`; `team_no` nullable; cancellation-job delta.
- Out of scope: conversations (never backfilled); config (SC-12).

**Implementation requirements**

1. One forward migration; history and statuses preserved; terminal rows unchanged.
2. Preflight counts matchmaking Matches with `booking_id`; copies them to recruitment or stops on conflict.

**Files/areas affected**

- `backend/src/db/schema/matchmaking.ts`, `backend/src/db/migrations/`, a preflight script under `backend/src/db/` `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** §13.3, §13.5, §13.6.

**Verification**

- Migration on empty and on a populated copy (OPEN, MATCHED, CANCELLED, EXPIRED requests; accepted/withdrawn invitations; PENDING_COURT and CONFIRMED Matches).
- Invalid legacy window/duration row → migration stops with a report.

**Acceptance criteria**

- **Given** a populated database **When** migrated **Then** every request has exactly one post, statuses and timestamps are unchanged, and no conversation exists.
- **Given** a Player with both a pending and an accepted row for one request **When** inserting **Then** the active-row unique index rejects it.

---

## [ ] MM-22: Membership refactor and shared `acceptMembership`

```text
Status: IN_PROGRESS
Size: L
Blocked by: MM-21; MSG-08 foundation (real BlockPort) for acceptance verification
```

**Objective:** Rewrite membership reads/writes on `player_id`/`status = ACCEPTED` and implement the shared acceptance transaction (§24.5).

**Implementation status (2026-11-01, IN_PROGRESS; integration BLOCKED on the real MSG-08 foundation BlockPort):**

- Membership reads/writes use `player_id`/`created_by`/`kind`; invitation endpoints use INVITE rows only and keep `inviteeId` in responses.
- `services/matchmaking/MembershipService.acceptMembership` implements §24.5 in the §24.7 lock order and retries when the member or overlap set changes. Closures happen before Match creation. No conversation side effect.
- Invite send locks the USERS rows of host and joiner first.
- `MatchmakingBlockPort.closePendingBetween` is implemented (`services/matchmaking/MatchmakingBlockPortService.ts`).
- `contracts/BlockPort.ts` exists with the approved §24.2 signature for Messaging to implement. Without a registered provider, block-checked actions fail closed with 500; there is no production stub. Tests register a test-only double.
- Verification: invitation-only regression 27/27 and `matchmaking-membership.test.ts` 11/11 passed. Covered: last-slot race → `MATCHMAKING_REQUEST_FULL`, active-row uniqueness across kinds, block recheck with the double, fail-closed, rollback, `closePendingBetween` atomicity and concurrency.
- Missing before DONE:
  - Acceptance with the real Messaging BlockPort.
  - The GROUP branch (explicit error until MM-23/MM-25).
  - `23505` → `MATCHMAKING_ALREADY_ACTIVE` mapping for Apply (MM-24); the invitation endpoint keeps `MATCHMAKING_INVITATION_DUPLICATE` for API compatibility.
  - Full regression.

**Scope**

- In scope: every `invitee_id` query (`MatchInvitationService`, `MatchmakingRepository`, `MatchmakingRequestService`, controller, validation, tests); `acceptMembership` with recheck list; overlapping-pending closure hook (MM-26); Match creation or GROUP roster update; API compatibility (`inviteeId` in responses). (Messaging is standalone; no `GroupConversationPort` calls.)
- Out of scope: Apply endpoints (MM-24).

**Implementation requirements**

1. Lock order per §24.7 (approved 2026-10-31); retry when the member set changes.
2. `23505` on the active-row index → `MATCHMAKING_ALREADY_ACTIVE`.
3. Own `MatchmakingBlockPort.closePendingBetween(a, b, tx)` (§24.2): close only PENDING Apply/Invite between the pair with `close_reason = BLOCKED`; no notification, no changes to ACCEPTED rows, Matches or conversation membership. Use caller transaction and global lock order. This operation can be implemented after MM-21 independently of the real BlockPort, so it does not depend on MSG-08 integration.
4. Acceptance rechecks use the real MSG-08 foundation BlockPort. MM-22 is not DONE until these checks pass; tests with doubles alone do not satisfy integration acceptance.

**Files/areas affected**

- `backend/src/services/matchmaking/`, `backend/src/repositories/matchmaking/`, `backend/src/__tests__/matchmaking.test.ts`

**API impact:** Invitation endpoints unchanged in shape.

**Schema/config impact:** None.

**Verification**

- Existing invitation-only tests pass after refactor (behavior preserved for Singles/Doubles).
- Concurrency: last-slot races; Invite + Apply same Player.

**Acceptance criteria**

- **Given** two concurrent acceptances for the last slot **Then** one succeeds, the other gets `MATCHMAKING_REQUEST_FULL`, and exactly one Match exists.

---

## [ ] MM-23: `RecruitmentPort` — create/validate/edit/publish, open-post limit

```text
Status: IN_PROGRESS
Size: M
Blocked by: MM-22
```

**Objective:** Recruitment side of the canonical creation flow and edit/publish rules.

**Implementation status (2026-11-01, Social step 3, IN_PROGRESS, not DONE):**

- `contracts/RecruitmentPort.ts` (full §24.2 interface) and `contracts/PostContentPort.ts`. Provider `services/matchmaking/RecruitmentService.ts` exports `recruitmentPort: RecruitmentCorePort` = every operation except `cancelForAuthorDeletion`, which is absent (not a no-op) until MM-25/SOC-04. Persistence in `repositories/matchmaking/RecruitmentRepository.ts`; Social-owned writes go through `postContentPort` (`services/social/recruitment-post.ts`).
- `createForPost(input, tx)`: caller transaction, re-entrant host USERS lock; Matchmaking gate; type/capacity/minimum/companions (GROUP within `MATCHMAKING_GROUP_MIN/MAX_SLOTS`, minimum 2…capacity, `1 + companions ≤ capacity`; Singles/Doubles fixed, no companions); duration (Singles/Doubles snapshot `MATCHMAKING_MATCH_DURATION_MINUTES`, GROUP 60–180 default 90); lead time; skill range; cost note ≤ 200; open-post limit (§24.14: effective OPEN, or MATCHED with a PENDING_COURT/CONFIRMED/IN_PROGRESS Match); host schedule; `expires_at = start_at`, legacy window columns NULL; optional publish with ≥ 1 open slot via `markPublished`.
- `PATCH /matchmaking-requests/:id`: host only, effective OPEN before start, users(10, host + members snapshot, retry on change) → requests(30); `start_at`, `match_type`, `capacity` → `409 MATCHMAKING_FIELD_LOCKED` after the first acceptance; conflicts rechecked for host and members when the interval changes. `POST /:id/publish`: Matchmaking gate, OPEN, lead time, open slot, idempotent. `GET /:id` adds tiers `HOST`/`MEMBER` (full), `INVITEE` (response context) and `PUBLIC` (published and visible); existing response fields kept.
- Choices to confirm: edit is not gated (no §24.10 row); non-OPEN edit/publish use the existing `MATCHMAKING_REQUEST_NOT_OPEN`; an edit may not make a recruitment with accepted members full (`MATCHMAKING_INVALID_CAPACITY`, because an edit is not a formation trigger); duration is not locked after acceptance (not listed) but member conflicts are rechecked; court fields are not accepted at creation (MM-28; booking MM-19).
- Legacy `POST /matchmaking-requests` is kept (current UI uses it) and still applies its old one-OPEN-per-type rule, not the open-post limit; removed with the frontend cutover (SOC-04/MM-29).
- Tests: `recruitment-port.test.ts` 10/10 (direct provider through a caller transaction; validation codes and atomicity; §24.14 counting; concurrent creates at the limit; host conflict; gate; publish guards; edit locks; detail tiers).
- Step-3 review fix (2026-11-01): `getCardProjection` returns a tiered union (`access`: FULL/PUBLIC/INVITEE/NONE) decided by `recruitmentAccess`, the same rule used by `GET /matchmaking-requests/:id`; a pending invitee of an unpublished post gets response context only (no members, acceptedCount or court). Accepted-member access still requires an OPEN/MATCHED request (existing `matchmaking.test.ts` rule, 27/27).
- Missing before DONE: GROUP formation on acceptance (MembershipService still throws for GROUP; MM-25), canonical `POST /posts` MATCH_FINDING (SOC-04), "Social disabled → match-finding creation blocked" through the canonical endpoint (SOC-04), full regression (skipped at the owner's request).

**Scope**

- In scope: `createForPost` (types, capacity/min/companions, duration ranges, lead time, host conflict, `MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER` under host lock); `PATCH /matchmaking-requests/:id` with locks after first acceptance; `POST /:id/publish` (≥ 1 open slot); removal of `POST /matchmaking-requests` in the release that switches the frontend; detail visibility tiers.
- Out of scope: court (MM-28).

**Implementation requirements**

1. Singles/Doubles duration snapshot; GROUP 60–180.
2. Gate behavior per §24.10.

**Files/areas affected**

- `backend/src/services/matchmaking/`, `backend/src/contracts/RecruitmentPort.ts` `[Proposed — verify during implementation]`

**API impact:** §24.9 rows for create (via `/posts`), edit, publish, detail.

**Schema/config impact:** Reads §8.9 keys.

**Verification**

- API: locked fields after first acceptance; publish with no open slot rejected; 4th open post rejected; Social disabled → match-finding creation blocked.
- Open-post count (§24.14): unpublished, recruiting and MATCHED with active Match count; CANCELLED, EXPIRED and MATCHED with COMPLETED/CANCELLED Match do not; concurrent creates at the limit allow exactly the limit.

**Acceptance criteria**

- **Given** a post with one accepted member **When** the host changes `start_at` **Then** `409 MATCHMAKING_FIELD_LOCKED`.

---

## [ ] MM-24: Apply resource API

```text
Status: BLOCKED
Size: M
Blocked by: MM-22, MM-23, MSG-08 foundation (BlockPort); final block integration verification also needs MSG-08 integration
```

**Objective:** Apply endpoints (§24.9) on the shared membership table.

**Scope**

- In scope: create (published, open, not blocked → neutral code, conflict check, skill mismatch warning only, timeout snapshot capped at start/close), host list, my list, host decision via `acceptMembership`, applicant cancel.
- Out of scope: notifications (MM-31).

**Implementation requirements**

1. Apply rows never handled by invitation endpoints and vice versa.

**Files/areas affected**

- `backend/src/{routes,controllers,services}/matchmaking/` `[Proposed — verify during implementation]`

**API impact:** New Apply routes.

**Schema/config impact:** Reads `MATCHMAKING_APPLICATION_TIMEOUT_MINUTES`.

**Verification**

- API: unpublished → `MATCHMAKING_POST_NOT_PUBLISHED`; duplicate → `MATCHMAKING_ALREADY_ACTIVE`; non-host decision → 404; expired → `MATCHMAKING_APPLICATION_EXPIRED`.

**Acceptance criteria**

- **Given** a pending Invite for P **When** P applies to the same post **Then** `409 MATCHMAKING_ALREADY_ACTIVE`.

---

## [ ] MM-25: Withdrawal, GROUP reopen/replacement, early close, host cancel

```text
Status: BLOCKED
Size: L
Blocked by: MM-22
```

**Objective:** Membership exits and closings from §24.4.

**Scope**

- In scope: `POST /:id/withdraw` (before full; GROUP after full → reopen with Match kept; Singles/Doubles after full → Match cancelled); aliases for old withdraw/leave endpoints; `POST /:id/close`; `POST /:id/cancel` with `KEEP` (and `CANCEL` rejected until MM-20); host leave = cancel; replacement acceptance updating roster.
- Out of scope: scheduler (MM-27).

**Implementation requirements**

1. Replacement who left earlier reactivates their `MATCH_PLAYERS` row.
2. All changes in one transaction. No conversation is created, revoked or locked (Messaging is standalone, 2026-11-01).

**Files/areas affected**

- `backend/src/services/matchmaking/`, `backend/src/services/matchmaking/MatchService.ts`

**API impact:** §24.9.

**Schema/config impact:** None.

**Verification**

- Integration: reopen keeps one Match; replacement rechecks capacity and conflicts; early close below min or with zero accepted registered members rejected; host cancel notifies and keeps booking.

**Acceptance criteria**

- **Given** a full GROUP Match **When** a non-host withdraws **Then** the recruitment is `OPEN`, the Match id is unchanged, and the member is `LEFT`.

---

## [ ] MM-26: Schedule conflict on post intervals and overlapping pending closure

```text
Status: IN_PROGRESS
Size: M
Blocked by: MM-21
```

**Objective:** Rewrite `hasOverlappingCommitment` per §24.6 and close a Player's overlapping pending rows on confirmed participation.

**Implementation status (2026-11-01, IN_PROGRESS, not DONE):** single interval source `[start_at, start_at + duration_minutes)` for host/ACCEPTED membership of non-terminal recruitments and active Matches through their recruitment; pending rows never reserve; acceptance closes the joiner's overlapping PENDING rows of both kinds with `SCHEDULE_CONFLICT` inside the caller transaction; a later acceptance of a closed row reports `MATCHMAKING_SCHEDULE_CONFLICT`. Behavior change for invitation-only users: conflicts use the post interval instead of the whole preferred window. Tests in `matchmaking-membership.test.ts` and existing conflict tests pass. Missing before DONE: notifications for closures (MM-31), checks on court link (MM-19), full regression.

**Scope**

- In scope: single interval source; checks on create, Apply/Invite send, acceptance, court link; closure with `SCHEDULE_CONFLICT`.
- Out of scope: standalone bookings (not commitments, unchanged).

**Implementation requirements**

1. Executed inside the caller's transaction after user locks.

**Files/areas affected**

- `backend/src/repositories/matchmaking/MatchmakingRepository.ts`

**API impact:** None new.

**Schema/config impact:** None.

**Verification**

- Integration: pending rows do not reserve; acceptance closes overlapping pendings of both kinds; legacy backfilled rows participate.

**Acceptance criteria**

- **Given** P has pending Applies to two overlapping posts **When** one is approved **Then** the other is `CANCELLED` with `SCHEDULE_CONFLICT`.

---

## [ ] MM-27: Scheduler start/end processing for all post types

```text
Status: BLOCKED
Size: M
Blocked by: MM-25, MM-28
```

**Objective:** §24.8 order and §24.4 start rows. Adds the missing start/complete lifecycle for posts with an external court: `CONFIRMED → IN_PROGRESS` at the fixed `start_at` and `IN_PROGRESS → COMPLETED` at `start_at + duration_minutes`, independent of any booking. Today a Match without a booking never completes.

**Scope**

- In scope: reconcile → expire pending → start processing (Singles/Doubles full/expire; GROUP continue/form when `count >= min` and `accepted >= 1`, else cancel `INSUFFICIENT_PLAYERS` keeping booking; no court → `COURT_NOT_BOOKED`) → completion for every court kind using the post's fixed time; effective-status reads use the same rules; rewrite claim statements with `FOR UPDATE OF m SKIP LOCKED` (§24.7.3).
- Out of scope: booking cancellation execution (MM-20).

**Implementation requirements**

1. One transaction per recruitment; `FOR UPDATE SKIP LOCKED` claims; idempotent re-runs; per-item lock order per §24.7.
2. `completed_at` = `start_at + duration_minutes` for all post types; a linked booking that is longer than the post never extends the Match.

**Files/areas affected**

- `backend/src/services/matchmaking/MatchmakingExpiryService.ts`, `backend/src/jobs/matchmakingScheduler.ts`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- Integration with fake time: each start row; reopened GROUP below min cancels post and Match; existing GROUP Match continues; external-court Match starts and completes at the fixed times and becomes ratable.
- Booking cancellation reconciled before time advancement cancels post and Match (`BOOKING_CANCELLED`); an Admin-hidden post proceeds unchanged.
- Concurrency: tick running while the host withdraws/cancels; re-run of the same tick is a no-op.

**Acceptance criteria**

- **Given** a GROUP with an existing Match reopened to OPEN and ≥ min at start **When** the tick runs **Then** the same Match becomes `IN_PROGRESS` and no new Match is created.

---

## [ ] MM-28: External court and external→booking replacement

```text
Status: BLOCKED
Size: M
Blocked by: MM-23; booking variant also MM-19, BK-15 (§24.7 approved 2026-10-31)
```

**Objective:** `PUT /matchmaking-requests/:id/court`.

**Scope**

- In scope: set external court while none exists (also after members); `PENDING_COURT → CONFIRMED`; members notified; booking variant returns `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE` until MM-19; replacement rules per §24.15 (only external → booking covering the whole post; side-by-side comparison data; mandatory host same-venue confirmation stored; never labelled as platform verification; no other change).
- Out of scope: booking creation.

**Implementation requirements**

1. Court exclusivity CHECK respected; post time never changed.

**Files/areas affected**

- `backend/src/services/matchmaking/` `[Proposed — verify during implementation]`

**API impact:** §24.9.

**Schema/config impact:** None.

**Verification**

- API: second external court change rejected; booking request rejected with the unavailable code.

**Acceptance criteria**

- **Given** a formed Match without court **When** the host sets an external court **Then** the Match is `CONFIRMED` and members are notified.

---

## [ ] MM-29: Frontend recruitment creation/management, applicants, withdrawal

```text
Status: BLOCKED
Size: L
Blocked by: MM-23…MM-28, SOC-08
```

**Objective:** Replace request creation with the post composer flow and add host/member management.

**Scope**

- In scope: create (type, start, duration, capacity/min/companions for GROUP, skill, area, title, cost note, external court), unpublished management with invitations, publish, applicants with mismatch warning, early close, cancel (only `KEEP` while MM-20 blocked), withdraw, GROUP labels "Giao lưu", stale-endpoint reload message.
- Out of scope: chat UI (MSG-09).

**Implementation requirements**

- Figma mapping: `docs/architecture/frontend.md`, "Social and Messaging — Figma alignment review, 2026-10-31"; create 99:43701, visitor detail 99:43891, unpublished-host detail 99:44007, host management 99:44134 and mobile detail 99:45274. Pending/invited/member/ended/withdrawal states are on 99:44308.
- Compose the Social post body/images/title with recruitment fields once; host-only applicant data never appears to other viewers. Derive viewer actions from current identity/permissions; ignore contradictory sample host/viewer names.
- Invitation before publish does not reserve a slot. Render 1/4 while pending, 2/4 after acceptance; publish preserves counts. Unpublished is visibility, not a new DRAFT recruitment status.
- Show GROUP capacity/minimum/companions and early-close independently of chat accounts. Recruitment actions never create, sync or lock a conversation (Messaging is standalone, 2026-11-01). Respect server field locks once a member is accepted.
- Different withdrawal confirmations for Singles/Doubles, GROUP and host cancellation; handle final-slot races and schedule conflicts without optimistic fake membership. Court/booking source selection follows actual integration readiness.
- Existing members retain recruitment management access when Admin hides Social content; do not make their only entry point an unavailable post page.

1. Hide booking-link and booking-cancel actions while blocked.

**Files/areas affected**

- `frontend/src/features/matchmaking/`

**API impact:** Consumes §24.9.

**Schema/config impact:** None.

**Verification**

- Playwright: all actor variants, invitation pending→accepted→published counts; GROUP early close/reopen; last-slot conflict; 390px role-aware detail and unavailable content while member management still works.

- E2E: prepare → invite → publish → Apply → approve → full; GROUP withdraw → reopen → replacement.

**Acceptance criteria**

- **Given** the signed-in Player is the host **When** opening the visitor-reference layout **Then** host actions are rendered and self-Apply is absent.

- **Given** MM-20 is not DONE **When** the host cancels **Then** the UI offers only keeping the booking.

---

## [ ] MM-30: Concurrency, lock-order and migration verification

```text
Status: BLOCKED
Size: M
Blocked by: MM-21…MM-29
```

**Objective:** Cross-module regression and end-to-end evidence after the owning tasks are done. Each owning task already carries its own tests (MM-21 migration, MM-22 last-slot and Invite/Apply races, MM-23 open-post count, MM-25 reopen/replacement and cancel, MM-26 conflict closure, MM-27 scheduler and booking reconcile, MM-28 court rules, MSG-08 block closure); MM-30 does not replace them.

**Scope**

- In scope: combined flows across Social, Matchmaking and Messaging block checks (create → invite → publish → Apply → approve → full → withdraw → reopen → replacement → start → complete → rate); gate matrix (§24.10) with several gates off; lock-order verification across modules (§24.7), including link vs booking create once MM-19 and BK-15 ship.
- Out of scope: load testing; re-implementing per-task tests.

**Implementation requirements**

1. Tests run against the separate test database with real transactions.

**Files/areas affected**

- `backend/src/__tests__/matchmaking-social-*.test.ts` `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- All §24.12 cases.

**Acceptance criteria**

- **Given** 50 iterations of concurrent final acceptances **Then** every iteration ends with one Match, no conversation created by Matchmaking, and no deadlock error.

---

## [ ] MM-31: Social Matchmaking notifications

```text
Status: BLOCKED
Size: M
Blocked by: NTF-02, NTF-05, MM-24, MM-25
```

**Objective:** Emit the Matchmaking events listed in the Notifications Tech Design extension in the same transactions as the state changes.

**Scope**

- In scope: Apply received/decided, invitations (including unpublished), membership changes, conflict closures, post cancelled/closed, reopened, insufficient players (booking still valid), booking cancelled, court updated.
- Out of scope: messages, reactions.

**Implementation requirements**

1. Dedup keys as specified; rollback removes notifications.

**Files/areas affected**

- `backend/src/services/matchmaking/`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- Integration: each event once under retries; none on rollback.

**Acceptance criteria**

- **Given** a GROUP cancelled below minimum with a booking **When** notifications are read **Then** the host's message states that the booking remains valid.

## Final Phase 2 review — approved 2026-10-31

PRD, Tech Design and the relevant schema targets are Ready under explicit human approval. This is documentation approval, not completion of implementation dependencies. Task checkboxes and DONE history are unchanged.

- MM-22: collect target and all overlapping pending invitation IDs first, lock the complete set ascending; revalidate/retry when the required set changes. Never lock the target first and then lower IDs.
- MM-30: verify the revised membership ordering together with Booking create/link and message reaction ordering; implementation tests are still required, not claimed passed.
- MM-20: cancellation jobs keyed by UNIQUE request_id with nullable match_id is approved; Booking/Payment implementation dependencies remain.
