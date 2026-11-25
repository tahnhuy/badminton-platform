# Tournament Management — Technical Design

## Status and Ownership

```text
Status: Draft (rewritten 2026-11-25; awaiting teammate review before Ready)
Owner: Tech Lead
Implements: docs/features/tournament/prd.md (Draft 2026-11-25)
Scope: Professional tournaments; Casual (TRN-13) and rank promotion (TRN-14) deferred
```

This document replaces the legacy Tech Design (see git history). Removed from the legacy design: system Court bookings for matches and the Court Owner integration, gateway payment with `PENDING_PAYMENT`/`EXPIRED` and its cron, the Ratings integration (`TOURNAMENT_RATING_ENABLED`). Kept: lifecycle, team/invitation rules, bracket model on `TOURNAMENT_MATCHES` + shared `MATCHES`/`MATCH_GAMES`, seeding rules.

## 1. Architecture and Module Boundaries

Layer-first, like the rest of the backend:

```text
backend/src/
  routes/tournaments/                 tournamentRoutes.ts (public + player + organizer), mounted at /api/v1/tournaments
  routes/admin/                       admin tournament list + cancel (existing admin router)
  controllers/tournaments/            thin HTTP adapters
  services/tournaments/
    TournamentService.ts              CRUD, lifecycle, visibility, cancel, complete
    TournamentRegistrationService.ts  singles/doubles registration, withdraw, remove, eligibility, fees
    TournamentTeamService.ts          teams, invitations
    TournamentBracketService.ts       seeds, draw (persists bracket + initial schedule)
    TournamentScheduleService.ts      auto-schedule, manual edit, conflict report
    TournamentMatchService.ts         start, scores, result, walkover, correction, advancement
    TournamentFeeService.ts           wallet debit/refund/organizer earning (wraps WalletService)
    bracket/bracketGenerator.ts       pure (exists) — extended for explicit seed numbers
    schedule/scheduleGenerator.ts     pure (new) — virtual-court scheduler
    schedule/conflicts.ts             pure (new) — conflict detection for manual edits
  repositories/tournaments/           Drizzle queries, row locks
  jobs/tournament.job.ts              registration auto-close, invitation expiry
```

Dependencies: `WalletService` (debit/credit, idempotency keys), `NotificationService` (producer), `skill_levels` / `player_profiles` (eligibility, seed suggestion), shared Match core (`matches`, `match_games`, `match_players`). No dependency on Booking, Facility, Court, Ratings.

## 2. State Flow

### 2.1 Tournament

```text
DRAFT ──open──▶ OPEN_FOR_REGISTRATION ──close (manual | job at registration_end)──▶ REGISTRATION_CLOSED
                                                                    │ < 2 confirmed → CANCELLED (auto, refunds)
REGISTRATION_CLOSED ──draw (bracket + schedule)──▶ READY ──first match start──▶ IN_PROGRESS ──conclude──▶ COMPLETED
CANCELLED ◀── Organizer: DRAFT | OPEN | CLOSED | READY      Admin: any non-terminal state
```

- `COMPLETED` requires the final match resolved with a winner (`WINNER_DECLARED` or `WALKOVER`); it triggers the Organizer earning credit.
- Every transition is a conditional update on `(id, status, version)`; mismatch → `409 TOURNAMENT_VERSION_CONFLICT` or `409 TOURNAMENT_INVALID_STATE`.

### 2.2 Registration

```text
CONFIRMED ──withdraw (player/captain, before close)──▶ CANCELLED
CONFIRMED ──remove (organizer, before draw)──────────▶ REMOVED
```

Created directly as `CONFIRMED` (free, or wallet debited in the same transaction). Tournament cancellation keeps the status `CONFIRMED` but refunds the fee (refund state lives in the ledger/payment row, §5.3). Legacy values `PENDING_PAYMENT` and `EXPIRED` are no longer produced.

### 2.3 Team and invitation

Unchanged from the legacy design and `business-rules-config-matrix.md` §4.7–§4.8: team `FORMING → FULL → REGISTERED`; invitation `PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`.

### 2.4 Tournament match

`MATCHES.status`: `SCHEDULED → IN_PROGRESS → COMPLETED`, or `CANCELLED`.
`TOURNAMENT_MATCHES.resolution`: `UNRESOLVED` (initial) → `WINNER_DECLARED | WALKOVER | NONE`.
A match is *playable* when both registration slots are filled.

## 3. API Design

All under `/api/v1/tournaments`. JSON `camelCase`; list responses `{ data, meta: { page, limit, total } }`; errors use the platform error envelope. Mutations need a session + CSRF.

### 3.1 Tournaments

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/` | public | Filters: `status`, `matchType`, `free`, `eligibleForMe` (session), `from`, `to`, `q`; excludes `DRAFT` unless `mine=organized` |
| GET | `/mine` | Player | `role=organized|registered|invited` |
| GET | `/:id` | public (DRAFT: Organizer/Admin) | Detail + `slotsLeft`, `viewer` block (`isOrganizer`, `registration`, `eligible`, `ineligibleReason`) |
| POST | `/` | Player | Create `DRAFT` |
| PATCH | `/:id` | Organizer | Body includes `version`; editing rules §6.2 |
| POST | `/:id/open` · `/:id/close` · `/:id/cancel` · `/:id/complete` | Organizer (cancel also Admin via admin route) | Body `{ version, reason? }` |

### 3.2 Registration and teams

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/:id/registrations` | public (not DRAFT) | Confirmed participants (names, avatar, level, seed after draw) |
| POST | `/:id/registrations` | Player | Singles: `{}`; Doubles: `{ teamId }` (captain). Debits fee. Header `Idempotency-Key` optional |
| DELETE | `/:id/registrations/:registrationId` | Player owner / captain | Withdraw before close; refund |
| POST | `/:id/registrations/:registrationId/remove` | Organizer | `{ reason }` (1–300 chars); before draw; refund |
| POST | `/:id/teams` | Player | `{ name }` → captain |
| GET | `/:id/teams/mine` | Player | Own team + invitations |
| POST | `/:id/teams/:teamId/invitations` | Captain | `{ inviteeId }` |
| POST | `/invitations/:invitationId/accept` · `/decline` · `/cancel` | Invitee / Captain | |

### 3.3 Seeds, draw, bracket

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/:id/seeds` | Organizer | Confirmed registrations + `suggestedSeedNo` + current `seedNo` |
| PUT | `/:id/seeds` | Organizer | `{ seeds: [{ registrationId, seedNo }] }`; `REGISTRATION_CLOSED` only |
| POST | `/:id/draw` | Organizer | `{ version }` → bracket + initial schedule, `READY` |
| GET | `/:id/bracket` | public (not DRAFT) | Rounds, matches, slots, BYEs, winners, scores |

### 3.4 Schedule and matches

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/:id/schedule` | public (not DRAFT) | Matches with `courtLabel`, `scheduledAt`, `estimatedEndAt`, status; `conflicts` only for Organizer |
| POST | `/:id/schedule/auto` | Organizer | Re-run for matches not started (`READY`/`IN_PROGRESS`) |
| PATCH | `/:id/matches/:tournamentMatchId/schedule` | Organizer | `{ courtLabel, scheduledAt }`; returns saved match + `warnings[]` |
| POST | `/:id/matches/:tournamentMatchId/start` | Organizer | Both slots filled |
| PUT | `/:id/matches/:tournamentMatchId/result` | Organizer | `{ type: 'GAMES', games: [{ team1Score, team2Score }] }` or `{ type: 'WALKOVER', winnerSlot: 1|2 }` or `{ type: 'CANCEL', reason }`; also used for correction |

Path ids for matches are `TOURNAMENT_MATCHES.id`.

### 3.5 Admin

`GET /api/v1/admin/tournaments` (all statuses, filters) and `POST /api/v1/admin/tournaments/:id/cancel` `{ reason }`.

### 3.6 Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `TOURNAMENT_NOT_FOUND` | 404 | Missing, deleted, or a DRAFT the viewer may not see |
| `TOURNAMENT_FORBIDDEN` | 403 | Not Organizer / Admin / owner of the resource |
| `TOURNAMENT_INVALID_STATE` | 409 | Action not allowed in the current status |
| `TOURNAMENT_VERSION_CONFLICT` | 409 | Stale `version` |
| `TOURNAMENT_FIELD_LOCKED` | 409 | Edit of a locked field (§6.2) |
| `TOURNAMENT_REGISTRATION_CLOSED` | 409 | Outside the registration window/state |
| `TOURNAMENT_FULL` | 409 | No slots left |
| `TOURNAMENT_NOT_ELIGIBLE` | 403 | Skill level outside the range (details: `minRank`, `maxRank`, `playerRank`) |
| `TOURNAMENT_ORGANIZER_CANNOT_PLAY` | 409 | Organizer registers/joins own tournament (PRD Q1) |
| `TOURNAMENT_ALREADY_REGISTERED` | 409 | Duplicate active registration |
| `WALLET_INSUFFICIENT_BALANCE` | 409 | Existing wallet code (`WalletService`); the tournament service adds details `required`, `balance` |
| `TOURNAMENT_TEAM_*` | 409 | Existing legacy team/invitation codes kept |
| `TOURNAMENT_SEED_INVALID` | 400 | Duplicate/out-of-range seed or non-confirmed registration |
| `TOURNAMENT_BRACKET_ALREADY_GENERATED` | 409 | Seeds/draw after the draw |
| `TOURNAMENT_MATCH_NOT_PLAYABLE` | 409 | Start/result without both participants |
| `TOURNAMENT_MATCH_LOCKED` | 409 | Correction after the next match started; schedule change semantics §7.3 |
| `TOURNAMENT_RESULT_INVALID` | 400 | Games do not give one side 2 wins, or scores negative |
| `TOURNAMENT_NOT_FINISHED` | 409 | Complete with unresolved final |

## 4. Data and Schema

Migration `00xx_tournament_professional.sql` (number from `docs/plans/migration-slot-log.md`), additive except the wallet CHECK.

### 4.1 `tournaments` (add)

| Column | Type | Rule |
| --- | --- | --- |
| `competition_type` | varchar not null default `'PROFESSIONAL'` | CHECK in (`PROFESSIONAL`,`CASUAL`); API accepts `PROFESSIONAL` only |
| `min_skill_level_id`, `max_skill_level_id` | bigint null FK `skill_levels` | min rank ≤ max rank (service check) |
| `court_count` | int not null default 2 | CHECK 1–20 |
| `match_duration_minutes` | int not null default 30 | CHECK 10–180 |
| `min_rest_minutes` | int not null default 15 | CHECK 0–240 |
| `daily_start_time`, `daily_end_time` | time not null default `08:00` / `21:00` | start < end; ≥ one match fits |
| `cancel_reason`, `cancelled_by`, `cancelled_at`, `completed_at` | | audit |
| `draw_seed` | bigint null | RNG seed used by the draw (reproducible bracket) |

`facility_id` is no longer used by the API (column kept, nullable). `venue_note` becomes the venue (required for `open`).

### 4.2 `tournament_registrations` (add)

`seed_no` int null (unique per tournament where not null), `paid_amount` numeric(14,2) not null default 0, `payer_id` bigint FK users (player or captain), `removed_reason`, `removed_by`, `cancelled_at`, `refunded_at`. Status CHECK becomes (`CONFIRMED`,`CANCELLED`,`REMOVED`) plus legacy (`PENDING_PAYMENT`,`EXPIRED`) for old rows. Partial unique indexes on active registration are rewritten to `status = 'CONFIRMED'` so a withdrawn Player can register again.

### 4.3 `tournament_matches` (add)

`court_label` varchar(40) null; `scheduled_at` comes from `matches.scheduled_at`; `matches.court_id`/`booking_id` stay null for tournament matches. Add `bye` boolean not needed — BYEs create no row (legacy rule kept): the BYE registration is written directly into the next match slot.

### 4.4 Wallet

Add ledger entry type `TOURNAMENT_EARNING` (CHECK update). Fee debit uses existing `PAYMENT`, refund `REFUND`, with `reference_type = 'TOURNAMENT_REGISTRATION'`, `reference_id = registration.id`. A `payments` row (`provider = 'WALLET'`, `registration_id`) records each fee so Admin Finance reconciliation sees it.

### 4.5 Configuration

- Keep: `TOURNAMENT_ENABLED`, `TEAM_INVITATION_TIMEOUT_MINUTES`, `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT`.
- Deprecate (registry `deprecated: true, editable: false`): `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TOURNAMENT_RATING_ENABLED`, `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES`.

## 5. Fees (TournamentFeeService)

All inside the caller's transaction, after locking the tournament row (`FOR UPDATE`).

1. **Register:** check state/window/slots/eligibility/duplicate → if `entry_fee > 0`: `walletService.debit({ userId: payer, amount: fee, entryType: 'PAYMENT', referenceType: 'TOURNAMENT_REGISTRATION', referenceId, idempotencyKey: 'trn-reg:' + registrationId })` → insert `payments` (`WALLET`, `SUCCESS`). Insufficient balance throws and rolls back the registration.
2. **Refund (withdraw/remove/cancel):** `walletService.credit({ entryType: 'REFUND', idempotencyKey: 'trn-refund:' + registrationId })`; set `refunded_at`; payment `REFUNDED`. The idempotency key makes retries and double clicks safe.
3. **Cancel tournament:** refunds every `CONFIRMED` registration with `paid_amount > 0` and `refunded_at IS NULL` in the same transaction (tournaments are small; ≤ 256 registrations). Notification fan-out happens after commit.
4. **Complete:** credit the Organizer `sum(paid_amount)` of `CONFIRMED` and not refunded registrations, `entryType: 'TOURNAMENT_EARNING'`, `idempotencyKey: 'trn-earning:' + tournamentId`. Zero sum → no entry.

## 6. Validation Rules

### 6.1 Create/update
Name 3–120; description ≤ 5000; `matchType` SINGLES|DOUBLES; `participantLimit` 2–128; `entryFee` 0–10,000,000 VND, integer; `registrationStart < registrationEnd ≤ tournamentStart < tournamentEnd`; `venueNote` 1–300 (required to open); schedule settings per §4.1.

### 6.2 Editing (matrix §4.4)
- `DRAFT`: all fields.
- `OPEN_FOR_REGISTRATION`: not `matchType`, `format`, `competitionType`, `registrationStart`; `participantLimit` ≥ confirmed count; `entryFee` and eligibility range locked once any registration is `CONFIRMED`.
- `REGISTRATION_CLOSED`/`READY`/`IN_PROGRESS`: only description, venue, schedule settings (schedule settings take effect on the next auto-schedule run).
- Terminal: read-only.

### 6.3 Eligibility
`eligible(player) = (min == null || rank(player) ≥ rank(min)) && (max == null || rank(player) ≤ rank(max))`, using `player_profiles.skill_level_id` at the time of the action. Doubles: captain at team creation, invitee at acceptance, both again at team registration.

## 7. Algorithms

### 7.1 Seed suggestion
Singles: rank of the Player's skill level. Doubles: sum of both members' ranks. Sort descending; ties randomised with the request RNG. Returned as `suggestedSeedNo`; nothing is stored until the Organizer saves seeds.

### 7.2 Draw (extend `bracketGenerator.ts`)
Input `SeedEntry { registrationId, seedNo | null }`. If the Organizer saved no seeds at all, the suggestion is applied as seeds. Seeded entries take `seedPositions(bracketSize)` in seed order; BYEs are assigned to the opponents of seeds 1..byeCount; unseeded entries fill the remaining positions in a random order. RNG = seeded PRNG from `draw_seed` (stored) so a bracket can be reproduced in tests and in the thesis. Persistence in one transaction: `matches` + `tournament_matches` per real match, `next_match_id`/`next_registration_slot` links, BYE winners written into round-2 slots, then §7.3 scheduling, status `READY`.

### 7.3 Automatic scheduling (`scheduleGenerator.ts`, pure)

Input: matches with `(id, round, index, feederIds[], participantKeys[] known or unknown)`, `courtCount`, `duration D`, `rest R`, `dayStart`, `dayEnd`, `startDate`, fixed matches (started/finished: court + time locked).

```text
courtFree[c] = first slot of startDate at dayStart for every court c (or end of fixed matches on c)
ready(m)     = max( end(f) + R for f in feeders(m) )            // winners of feeders need rest
               max( lastEnd(p) + R for known participants p )   // BYE / already known players
order        = matches sorted by (round, index)                 // earlier rounds first, bracket order inside a round
for m in order (skip fixed):
    pick court c minimising start = max(courtFree[c], ready(m)); tie → lowest court number
    if start + D > dayEnd of that day → start = next day dayStart (then re-pick court)
    assign (c, start); courtFree[c] = start + D; record end(m) = start + D
```

Properties (tested): no two matches overlap on a court; a participant never has overlapping matches and always gets ≥ R rest (feeder rule covers future rounds because winners are unknown until played); a match never starts before its feeders end; matches stay in the daily window; deterministic for the same input. Complexity O(M·k).

Re-run (`/schedule/auto`) passes started/completed matches as fixed and recomputes the rest from `max(now rounded up to 5 min, tournament start)`.

### 7.4 Manual edits and conflicts (`conflicts.ts`, pure)
After saving `{ courtLabel, scheduledAt }` the service recomputes warnings for the whole tournament: `COURT_OVERLAP` (same label, overlapping `[start, start+D)`), `PARTICIPANT_OVERLAP` / `REST_TOO_SHORT` (known participants), `BEFORE_FEEDER` (starts before a feeder's estimated end), `OUTSIDE_DAILY_WINDOW`. Warnings are returned, never block the save. Court labels are compared case-insensitively after trimming.

### 7.5 Result and advancement
- Games: 2–3 games; each game scores ≥ 0 and not equal; the side with 2 game wins is the winner; a 3rd game only if 1–1. Rally-point 21/30 rules are not validated (PRD Q2).
- On result: replace `match_games`, set `matches.status = COMPLETED`, `resolution`, `winner_registration_id`, then write the winner into `next_match_id`'s slot. Correction: allowed while the next match is `SCHEDULED`; overwrite its slot with the new winner. If the next match is already started → `TOURNAMENT_MATCH_LOCKED`.
- `CANCEL`: `matches.status = CANCELLED`, `resolution = NONE`, no advancement; the Organizer may later record a result on it.
- Final resolved → the tournament can be completed; `match_players` rows (team 1/2) are written at start so future TRN-14 promotion and profile statistics can read history.

## 8. Security and Authorization

- Organizer = `tournaments.creator_id = session user` and role `PLAYER`; Admin uses admin routes only (Admin does not organise).
- `DRAFT` hidden from everyone else (404, not 403).
- Participant lists show display name, avatar, skill level; never email/phone.
- Removal reason visible only to the Organizer, Admin and the removed participant.

## 9. Concurrency and Idempotency

- Tournament row lock (`SELECT … FOR UPDATE`) for register/withdraw/remove/close/draw/cancel/complete, so the slot count and fee operations are serialised.
- Optimistic `version` on organizer-edited fields and transitions.
- Team rows locked for invitation accept/registration.
- Match row lock for start/result; advancement locks the next match row.
- Wallet idempotency keys (§5) make every money movement at-most-once.

## 10. Background Jobs (`jobs/tournament.job.ts`, every minute, advisory lock)

1. Auto-close: `OPEN_FOR_REGISTRATION` with `registration_end ≤ now` → close (same code path as manual; `< 2` → cancel + refunds).
2. Invitation expiry: `PENDING` with `expires_at ≤ now` → `EXPIRED`.

No payment-expiry job (no `PENDING_PAYMENT`).

## 11. Notifications

Resource type `TOURNAMENT` (route `/tournaments/:id`), resolver checks visibility (§8). Events: `TOURNAMENT_TEAM_INVITED`, `_INVITATION_ACCEPTED|DECLINED|EXPIRED`, `TOURNAMENT_REGISTRATION_CONFIRMED`, `_REMOVED`, `_REFUNDED`, `TOURNAMENT_REGISTRATION_CLOSED`, `TOURNAMENT_BRACKET_PUBLISHED`, `TOURNAMENT_MATCH_RESCHEDULED` (own match, only after `READY`), `TOURNAMENT_CANCELLED`, `TOURNAMENT_COMPLETED`. Emitted after commit.

## 12. Frontend

`frontend/src/features/tournaments/` — React Query + RHF/Zod + shadcn primitives, routes:

| Route | Who | Content |
| --- | --- | --- |
| `/tournaments` | public | List + filters |
| `/tournaments/:id` | public | Tabs: Thông tin · Người tham gia · Nhánh đấu · Lịch thi đấu; register/withdraw/team panel |
| `/tournaments/new`, `/tournaments/:id/manage` | Organizer | Setup form; console tabs: Người tham gia · Hạt giống & bốc thăm · Lịch (board courts × time, edit dialog, warnings) · Trận đấu (start, score entry, walkover, correct) · Kết thúc |
| `/tournaments/mine` | Player | Organized / registered / invitations |
| `/admin/tournaments` | Admin | List + cancel |

## 13. Testing Strategy

- Pure unit tests: bracket (sizes 2–128, BYE placement, seed separation, reproducibility), scheduler (property tests: no court/participant overlap, rest, feeder order, daily window, determinism, fixed matches), conflicts, game-result validation.
- API integration (real Postgres test DB): lifecycle and authorization matrix; registration race on the last slot; wallet debit/refund/earning exactly once (double submit, retries); remove/withdraw/cancel refunds; draw atomicity (forced failure → no partial bracket); advancement and correction; auto-close job.
- E2E (mocked API for UI contracts, one live flow): Organizer creates → opens → 4 Players register → draw → schedule board → play to the final → complete; Player sees own match.

## 14. Migration of Legacy Data

Existing tournament rows (dev/test only) get `competition_type = 'PROFESSIONAL'` and schedule defaults. Legacy `PENDING_PAYMENT`/`EXPIRED` registrations are left untouched and ignored by counts.
