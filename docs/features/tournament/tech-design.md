# Tournament Management — Technical Design

## Status and Ownership

```text
Status: Ready (rewritten 2026-11-25; decided by the project owner)
Owner: Tech Lead
Implements: docs/features/tournament/prd.md (Draft 2026-11-25)
Scope: Professional tournaments incl. skill rating (TRN-14); Casual (TRN-13) deferred
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
    TournamentPlacementService.ts     placements from the bracket; profile history
    TournamentShareService.ts         Social result post
    TournamentChatService.ts          tournament group chat (create at close, sync members, lock)
    TournamentRealtime.ts             publishes `tournament.updated` through the WS hub
    bracket/bracketGenerator.ts       pure (exists) — extended for explicit seed numbers
    schedule/scheduleGenerator.ts     pure (new) — virtual-court scheduler
    schedule/conflicts.ts             pure (new) — conflict detection for manual edits
  repositories/tournaments/           Drizzle queries, row locks
  jobs/tournament.job.ts              registration auto-close, invitation expiry
```

Dependencies: `WalletService` (debit/credit, idempotency keys), `NotificationService` (producer), `skill_levels` / `player_profiles` (eligibility, seed suggestion), shared Match core (`matches`, `match_games`, `match_players`), `MessagingService` + `MessagingWsHub` (group chat, realtime), Social posts, Player profile read model. No dependency on Booking, Facility, Court, Ratings.

## 2. State Flow

### 2.1 Tournament

```text
DRAFT ──open──▶ OPEN_FOR_REGISTRATION ──close (manual | job at registration_end)──▶ REGISTRATION_CLOSED
                                                                    │ < 2 confirmed → CANCELLED (auto, refunds)
REGISTRATION_CLOSED ──draw (bracket + schedule)──▶ READY ──first match start──▶ IN_PROGRESS ──conclude──▶ COMPLETED
CANCELLED ◀── Organizer: DRAFT | OPEN | CLOSED | READY      Admin: any non-terminal state
```

- `COMPLETED` requires the final match resolved with a winner (`WINNER_DECLARED`, `RETIRED` or `WALKOVER`); it triggers the Organizer earning credit and the skill-rating evaluation (§7.10).
- **Auto-complete / auto-cancel (PRD Decision #23):** the tournament job completes an `IN_PROGRESS` tournament whose final is resolved and whose `tournament_end` is ≥ 3 days ago (same code path as the Organizer action, `completed_by = NULL`); it cancels (with refunds) a tournament still not `COMPLETED` 14 days after `tournament_end`.
- **Correction window (PRD Decision #24):** results stay correctable for 48 hours after `completed_at` (§7.5); money is not touched by a correction.
- Every transition is a conditional update on `(id, status, version)`; mismatch → `409 TOURNAMENT_VERSION_CONFLICT` or `409 TOURNAMENT_INVALID_STATE`.

### 2.2 Registration

```text
CONFIRMED ──withdraw (player/captain, only while OPEN_FOR_REGISTRATION)──▶ CANCELLED
CONFIRMED ──remove (organizer, before draw)──────────▶ REMOVED
```

Created directly as `CONFIRMED` (free, or wallet debited in the same transaction). An Organizer removal while `REGISTRATION_CLOSED` clears that registration's `seed_no` and renumbers the remaining seeds 1..k in order; if fewer than 2 registrations remain, the draw is rejected (`TOURNAMENT_NOT_ENOUGH_PARTICIPANTS`) and the Organizer must cancel (refunds). Tournament cancellation keeps the status `CONFIRMED` but refunds the fee (refund state lives in the ledger/payment row, §5.3). Legacy values `PENDING_PAYMENT` and `EXPIRED` are no longer produced.

### 2.3 Team and invitation

Unchanged from the legacy design and `business-rules-config-matrix.md` §4.7–§4.8: team `FORMING → FULL → REGISTERED`; invitation `PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`.

### 2.4 Tournament match

`MATCHES.status` reuses the shared `MatchStatus` values (`contracts/MatchModule.ts`): `CONFIRMED` (= scheduled, not started) → `IN_PROGRESS` → `COMPLETED`, or `CANCELLED`. No new status value is added.
`TOURNAMENT_MATCHES.resolution`: `UNRESOLVED` (initial) → `WINNER_DECLARED | RETIRED | WALKOVER | NONE` (`RETIRED` added by TRN-01, PRD Decision #25).
A match is *playable* when both registration slots are filled; at that moment `match_players` rows (team 1/2, both members for Doubles) are written, so every resolved match — including walkovers — has a roster for profile statistics and TRN-14.
`matches.match_type` is set to the tournament's `match_type` at the draw (`profile-statistics.ts` rejects mismatches).

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
| POST | `/:id/registrations` | Player | Singles: `{}`; Doubles: `{ teamId }` (captain). Debits fee. Double submits are safe through the tournament row lock + duplicate check + wallet idempotency key |
| DELETE | `/:id/registrations/:registrationId` | Player owner / captain | Withdraw while `OPEN_FOR_REGISTRATION` only; refund |
| POST | `/:id/registrations/:registrationId/remove` | Organizer | `{ reason }` (1–300 chars); before draw; refund |
| POST | `/:id/teams` | Player | `{ name }` → captain |
| GET | `/:id/teams/mine` | Player | Own team + invitations |
| POST | `/:id/teams/:teamId/invitations` | Captain | `{ inviteeId }` |
| POST | `/invitations/:invitationId/accept` · `/decline` · `/cancel` | Invitee / Captain | |
| GET | `/:id/invitable-players?q=` | Captain | Name search (≥ 2 chars, ≤ 20 results): PLAYER, ACTIVE, eligible, not Organizer, not in a team of this tournament, not blocked with the captain |
| POST | `/:id/teams/:teamId/invite-link` | Captain | Creates/regenerates the link → `{ url }`; stores only `sha256(token)` in `tournament_teams.invite_token_hash` |
| GET · POST | `/teams/join/:token` | Player | GET previews team + eligibility; POST joins (same checks as accept, team row lock) |

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
| PUT | `/:id/matches/:tournamentMatchId/result` | Organizer | `{ type: 'SETS', sets: [{ team1Score, team2Score }] }` (2–3 complete sets) · `{ type: 'RETIRED', retiredSlot: 1|2, sets: [...] }` (sets played so far, last one may be incomplete) · `{ type: 'WALKOVER', winnerSlot: 1|2, reason? }` · `{ type: 'CANCEL', reason }`; also used for correction (§7.5) |

Path ids for matches are `TOURNAMENT_MATCHES.id`.

### 3.4b Profile, Social, chat

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/players/:id/tournaments` | public (same visibility as the public profile) | Completed tournaments with `placement` (`CHAMPION`, `RUNNER_UP`, `SEMI_FINAL`, `QUARTER_FINAL`, `ROUND_OF_n`) and `rankingPoints`, paginated |
| GET | `/api/v1/tournament-rankings?matchType=SINGLES|DOUBLES&level=&page=` | public | Leaderboard (§7.11): position, player (name, avatar, level), total points, tournaments counted |
| GET | `/api/v1/players/me/skill-rating` | Player (owner only) | `R`, level, tentative flag, progress to next band, rating events and level changes (§7.10); `R` never appears in public player reads |
| POST | `/:id/share` | Organizer or top-4 Player, tournament `COMPLETED` | `{ body? }` (≤ 2000) → creates Social post type `TOURNAMENT_RESULT`; one per user per tournament |
| GET | `/:id` (detail) | — | adds `conversationId` for chat members only, `viewer.canShare`, `viewer.sharedPostId` |

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
| `TOURNAMENT_TEAM_*` | 409 | Existing legacy team/invitation codes kept (except `TOURNAMENT_TEAM_INVITE_INVALID`, 404) |
| `TOURNAMENT_SEED_INVALID` | 400 | Duplicate/out-of-range seed or non-confirmed registration |
| `TOURNAMENT_BRACKET_ALREADY_GENERATED` | 409 | Seeds/draw after the draw |
| `TOURNAMENT_MATCH_NOT_PLAYABLE` | 409 | Start/result without both participants |
| `TOURNAMENT_MATCH_LOCKED` | 409 | Correction after the next match started; schedule change semantics §7.3 |
| `TOURNAMENT_RESULT_INVALID` | 400 | A set score breaks the 21-point rule, or the sets do not give one side exactly 2 set wins; `details: [{ setNo, reason }]` |
| `TOURNAMENT_SHARE_NOT_ALLOWED` | 403 | Not Organizer/top 4, or tournament not `COMPLETED` |
| `TOURNAMENT_CORRECTION_WINDOW_CLOSED` | 409 | Result correction more than 48 h after `completed_at` |
| `TOURNAMENT_NOT_ENOUGH_PARTICIPANTS` | 409 | Draw with fewer than 2 confirmed registrations (e.g. after removals) |
| `TOURNAMENT_TEAM_INVITE_INVALID` | 404 | Unknown or regenerated invite token, team full, or registration closed |
| `TOURNAMENT_ALREADY_SHARED` | 409 | The user already has a result post for this tournament |
| `TOURNAMENT_NOT_FINISHED` | 409 | Complete with unresolved final |

## 4. Data and Schema

Migration `00xx_tournament_professional.sql` (number from `docs/plans/migration-slot-log.md`), additive except the wallet CHECK.

### 4.1 `tournaments` (add)

| Column | Type | Rule |
| --- | --- | --- |
| `competition_type` | varchar not null default `'PROFESSIONAL'` | CHECK in (`PROFESSIONAL`,`CASUAL`); API accepts `PROFESSIONAL` only |
| `min_skill_level_id`, `max_skill_level_id` | bigint null FK `skill_levels` | min rank ≤ max rank (service check) |
| `court_count` | int not null default 2 | CHECK 1–20 |
| `match_duration_minutes` | int not null default 45 | CHECK 10–180 (best of 3 × 21 points ≈ 45 min) |
| `min_rest_minutes` | int not null default 15 | CHECK 0–240 |
| `daily_start_time`, `daily_end_time` | time not null default `08:00` / `21:00` | start < end; ≥ one match fits |
| `cancel_reason`, `cancelled_by`, `cancelled_at`, `completed_at` | | audit |
| `draw_seed` | bigint null | RNG seed used by the draw (reproducible bracket) |
| `conversation_id` | bigint null FK `conversations` | tournament group chat (§7.8) |

`facility_id` is no longer used by the API (column kept, nullable). `venue_note` becomes the venue (required for `open`).

### 4.2 `tournament_registrations` (add)

`tournament_teams.invite_token_hash` char(64) null unique; `tournament_matches.reminder_sent_for` timestamp null (the `scheduled_at` a reminder was sent for); `tournaments.completed_by` bigint null (NULL = auto-complete).

`seed_no` int null (unique per tournament where not null), `paid_amount` numeric(14,2) not null default 0, `payer_id` bigint FK users (player or captain), `removed_reason`, `removed_by`, `cancelled_at`, `refunded_at`. Add a status CHECK (`CONFIRMED`,`CANCELLED`,`REMOVED`, legacy `PENDING_PAYMENT`,`EXPIRED`) — none exists today. The existing unique indexes `uq_tournament_singles_player` / `uq_tournament_doubles_team` are partial on `registration_type` only; they are recreated with `AND status = 'CONFIRMED'` so a withdrawn Player can register again.

**Teams.** `tournament_team_players` gets `tournament_id` (backfilled from the team) and a partial unique index `(tournament_id, player_id)` over active memberships, so one Player cannot be in two teams of the same tournament even under concurrent accepts. Team status: `FORMING` (1 member) → `FULL` (2) → `REGISTERED`; `DISBANDED` (terminal). Rules: the captain may have **one** pending invitation at a time; a member who joins by link cancels any pending invitation of that team; while `FORMING`/`FULL` the non-captain member may leave and the captain may remove them (team back to `FORMING`); the captain leaving disbands the team; withdrawal or Organizer removal of a team registration sets the team `DISBANDED` (members become free); `DISBANDED` membership rows are inactive for the unique index.

### 4.3 `tournament_matches` (add)

`court_label` varchar(40) null; `scheduled_at` comes from `matches.scheduled_at`; `matches.court_id`/`booking_id` stay null for tournament matches. BYEs create no row (legacy rule kept): the BYE registration is written directly into the next match slot.

### 4.3b Social posts

`posts.type` CHECK adds `TOURNAMENT_RESULT`; new column `posts.tournament_id` bigint null FK `tournaments`, CHECK `(type = 'TOURNAMENT_RESULT') = (tournament_id IS NOT NULL)`; unique `(author_id, tournament_id)` where `type = 'TOURNAMENT_RESULT' AND deleted_at IS NULL` (deleting the post allows sharing again). Published immediately; no title, no background (existing CHECKs already allow this).

Social code that must change (today it only knows `FREE`/`MATCH_FINDING`): the feed type filter (`SocialRepository.findFeedPage`) includes `TOURNAMENT_RESULT`; the interaction guard (`SocialInteractionService.assertInteractive`) allows reactions/comments on it; editing changes only `body` (the card is derived); reports and Admin hide work as for `FREE`.

### 4.3c Conversations

`conversations.system_kind` varchar null (CHECK in (`TOURNAMENT`)) — a system-managed group. For such a conversation Messaging rejects member add/remove, rename, lock/unlock and leave-by-dissolve from users (including the creator); membership is changed only by `TournamentChatService`. When locked by the system, **no one** can send (the existing "creator may still send in a locked group" rule does not apply).

### 4.4 Wallet

Add ledger entry type `TOURNAMENT_EARNING` (CHECK update). Fee debit uses existing `PAYMENT`, refund `REFUND`, with `reference_type = 'TOURNAMENT_REGISTRATION'`, `reference_id = registration.id`. A `payments` row (`provider = 'WALLET'`, `registration_id`) records each fee so Admin Finance reconciliation sees it.

### 4.5 Configuration

- Keep: `TOURNAMENT_ENABLED`, `TEAM_INVITATION_TIMEOUT_MINUTES`, `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT`.
- Deprecate (registry `deprecated: true, editable: false`): `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TOURNAMENT_RATING_ENABLED`, `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES`.

## 5. Fees (TournamentFeeService)

All inside the caller's transaction, after locking the tournament row (`FOR UPDATE`).

1. **Register:** check state/window/slots/eligibility/duplicate → if `entry_fee > 0`: `walletService.debit({ userId: payer, amount: fee, entryType: 'PAYMENT', referenceType: 'TOURNAMENT_REGISTRATION', referenceId, idempotencyKey: 'trn-reg:' + registrationId })` → insert `payments` (`WALLET`, `SUCCESS`). Insufficient balance throws and rolls back the registration.
2. **Refund (withdraw/remove/cancel):** `walletService.credit({ entryType: 'REFUND', idempotencyKey: 'trn-refund:' + registrationId })`; set `refunded_at`; payment `REFUNDED`. The idempotency key makes retries and double clicks safe.
3. **Cancel tournament:** refunds every `CONFIRMED` registration with `paid_amount > 0` and `refunded_at IS NULL` in the same transaction (≤ 128 registrations). Notification fan-out happens after commit.
4. **Refund record:** every refund also inserts `payment_refunds` (`status = 'REFUNDED'`, `completed_at = now`, `reason`) for the fee's `payments` row and sets the payment `REFUNDED`, so Finance sees it like a booking refund.
5. **Complete:** credit the Organizer `sum(paid_amount)` of `CONFIRMED` and not refunded registrations, `entryType: 'TOURNAMENT_EARNING'`, `idempotencyKey: 'trn-earning:' + tournamentId`. Zero sum → no entry.

### 5.1 Admin Finance and Dashboard (TRN-17)

Today Finance/Dashboard assume booking money (reconciliation filters `booking_id IS NOT NULL`, earnings count only `OWNER_EARNING`, gross revenue counts every paid `payments` row). Required changes:
- Revenue reports split **booking** and **tournament fee** (`registration_id IS NOT NULL`) and show both gross and net of refunds; the dashboard revenue KPI uses the same net definition.
- Reconciliation includes registration payments (wallet `PAYMENT` ledger ↔ `payments` ↔ `payment_refunds`).
- Organizer payouts (`TOURNAMENT_EARNING`) are reported next to `OWNER_EARNING`; platform liability = fees held for tournaments not yet `COMPLETED`/`CANCELLED`.

## 6. Validation Rules

### 6.1 Create/update
Name 3–120; description ≤ 5000; `matchType` SINGLES|DOUBLES; `participantLimit` 2–128; `entryFee` 0–10,000,000 VND, integer; `registrationStart < registrationEnd ≤ tournamentStart < tournamentEnd`; `venueNote` 1–300 (required to open); schedule settings per §4.1.

### 6.2 Editing (matrix §4.4)
- `DRAFT`: all fields.
- `OPEN_FOR_REGISTRATION`: not `matchType`, `format`, `competitionType`, `registrationStart`; `registrationEnd` may only move later (and stay ≤ `tournamentStart`); `participantLimit` ≥ confirmed count; `entryFee` and eligibility range locked once any registration is `CONFIRMED` (matrix §4.4).
- `REGISTRATION_CLOSED`/`READY`/`IN_PROGRESS`: only description, venue, schedule settings (schedule settings take effect on the next auto-schedule run).
- Terminal: read-only.

### 6.3 Eligibility
`eligible(player) = (min == null || rank(player) ≥ rank(min)) && (max == null || rank(player) ≤ rank(max))`, using `player_profiles.skill_level_id` at the time of the action. Doubles: captain at team creation, invitee at acceptance, both again at team registration.

## 7. Algorithms

### 7.1 Seed suggestion
Singles: rank of the Player's skill level. Doubles: sum of both members' ranks. Sort descending; ties broken by skill rating (TRN-14: Singles `R`, Doubles average `R`), then randomised with the request RNG. Until TRN-14 ships, ties are only randomised. Returned as `suggestedSeedNo`; nothing is stored until the Organizer saves seeds.

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

Re-run (`/schedule/auto`) passes started/completed matches as fixed and recomputes the rest from `max(now rounded up to 5 min, tournament start)`; it **overwrites manual edits** of matches not yet started (the UI confirms this).

Time handling: DB timestamps are stored as UTC (`timestamp without time zone`, project convention); `daily_start_time`/`daily_end_time` and day boundaries are interpreted in `Asia/Ho_Chi_Minh`. Day 1 starts at `max(tournament_start, daily_start_time of that date)`. Matches that overflow past `tournament_end` are still scheduled (on the following days) and flagged with the warning `OUTSIDE_TOURNAMENT_DATES`; the Organizer decides (add courts, shorten duration, or accept).

### 7.4 Manual edits and conflicts (`conflicts.ts`, pure)
After saving `{ courtLabel, scheduledAt }` the service recomputes warnings for the whole tournament: `COURT_OVERLAP` (same label, overlapping `[start, start+D)`), `PARTICIPANT_OVERLAP` / `REST_TOO_SHORT` (known participants), `BEFORE_FEEDER` (starts before a feeder's estimated end), `OUTSIDE_DAILY_WINDOW`, `OUTSIDE_TOURNAMENT_DATES`. Only matches not started can be edited (PRD FR-41). Warnings are returned, never block the save. Court labels are compared case-insensitively after trimming.

### 7.5 Result and advancement
- Sets (`match_games`, `game_no` 1–3): each set must satisfy, with w = winner's points and l = loser's points: `(w = 21 ∧ 0 ≤ l ≤ 19) ∨ (22 ≤ w ≤ 30 ∧ l = w − 2) ∨ (w = 30 ∧ l = 29)`. Two sets if one side wins both; a third set only after 1–1; exactly one side reaches 2 set wins. Pure function `validateSetScores()` in `services/tournaments/result/score.ts`, shared with the frontend form through the same rule table.
- On result: replace `match_games`, set `matches.status = COMPLETED`, `resolution`, `winner_registration_id`, then write the winner into `next_match_id`'s slot.
- **Retired (PRD Decision #25):** `RETIRED` stores the sets played (complete sets validated by the rule; the last set may be incomplete, scores < the rule's end), the opponent of `retiredSlot` wins and advances. Counted by skill rating as a normal result; `WALKOVER` is not.
- **Correction:** allowed while the next match is `CONFIRMED` (not started) — its slot is overwritten with the new winner; if the next match has started → `TOURNAMENT_MATCH_LOCKED`. The **final** has no next match: correctable until `COMPLETED`, and every match is correctable during the **48 h after `completed_at`** provided no later match depends on a changed winner (in practice: scores of any match, or the final's winner). Corrections after completion recompute placements and re-run skill-rating replay (§7.10); entry fees and the Organizer credit are not changed.
- `CANCEL`: `matches.status = CANCELLED`, `resolution = NONE`, no advancement; the Organizer may later record a result on it.
- Walkover: no `match_games`; `resolution = WALKOVER`; used for no-shows (PRD Decision #18 — no refund). Retirements use `RETIRED`.
- Final resolved → the tournament can be completed.

### 7.6 Placement (`TournamentPlacementService`, pure core)

From the resolved bracket of a `COMPLETED` tournament: final winner `CHAMPION`, final loser `RUNNER_UP`, semi-final losers `SEMI_FINAL`, quarter-final losers `QUARTER_FINAL`, losers of earlier rounds `ROUND_OF_n` where n = number of bracket slots in that round (`bracket_size / 2^(round_index-1)`, BYEs included). Walkover/retired losers count as losing in that round. Computed on read (no table) for the profile history; Doubles placements are listed for both team members. TRN-14 will reuse this function.

### 7.7 Social result post

`POST /:id/share` → allowed for the Organizer and Players with placement in the top 4 (Doubles: both members). Inserts a `posts` row (`TOURNAMENT_RESULT`, `tournament_id`) through the Social service so feed ranking, reactions, comments, reports and moderation work unchanged. The feed card is rendered from the tournament (name, end date, champion, runner-up, link, and the author's placement — or "Ban tổ chức" when the author is the Organizer), never from user-supplied text. A cancelled tournament cannot be shared; an already shared post stays if an Admin later cancels (not possible after `COMPLETED`).

### 7.8 Tournament group chat (`TournamentChatService`)

- Created **after** the close transaction commits (a messaging failure never blocks closing): the close marks the tournament as needing a chat; `TournamentChatService.ensureChat` runs right after commit and is retried by the tournament job while `conversation_id IS NULL` and status is `REGISTRATION_CLOSED`…`COMPLETED`. Skipped when Messaging is disabled (retried when re-enabled).
- `GROUP` conversation, `system_kind = 'TOURNAMENT'` (§4.3c), titled with the tournament name, creator = Organizer, members = Organizer + all participants (Doubles: both members). Uses a dedicated entry point (`createSystemGroupConversationInTransaction`) that is **not** capped by `MESSAGING_GROUP_MAX_MEMBERS` (≤ 257 members), takes member locks in ascending user id, and **skips** (does not fail on) members blocked by/blocking the Organizer or inactive.
- Organizer removal before the draw removes the participant from the chat.
- Locked (`is_locked = true`, read-only for everyone per §4.3c) when the tournament is cancelled, and by the tournament job 30 days after `COMPLETED`.

### 7.9 Realtime

- `MessagingWsHub` accepts two client messages: `{ type: 'tournament.watch', tournamentId }` and `{ type: 'tournament.unwatch', tournamentId }`; the hub checks visibility (§8) and keeps a per-connection watch set (max 5).
- After commit of any change to bracket, schedule, match status/score or tournament status, `TournamentRealtime.publish(tournamentId, scope)` sends `{ type: 'tournament.updated', data: { tournamentId, scope: 'STATUS'|'BRACKET'|'SCHEDULE'|'MATCH', tournamentMatchId?, version } }` to watching connections. Payload carries no private data; clients invalidate the related React Query keys and refetch.
- The WS hub accepts only `PLAYER` sessions and only while Messaging is enabled. Any client **without a socket** (visitors, Admin, Court Owner, Messaging disabled, connection lost) polls every 30 s while `READY`/`IN_PROGRESS`; clients refetch on reconnect.

### 7.10 Skill rating and level adjustment (TRN-14)

Model: `docs/research/bao-cao-cong-thuc-nang-trinh.md` §4 (Hướng B, PRD Decision #26).
- `player_profiles.skill_rating` numeric(6,2) (cache of `R`, clamped to [0, 100]) and `rated_match_count`; initial `R` = survey `final_score` clamped into the band of the assigned level (no survey: band midpoint).
- Per rated match (professional tournament, resolution `WINNER_DECLARED` or `RETIRED`): `E = 1/(1+10^((R_o−R)/D))`, `ΔR = K·(S−E)`, Doubles uses team averages and factor 0.8; `K` is chosen per match from `rated_match_count` at that match (6 for the first 6, then 3). `WALKOVER`, `NONE` never count.
- Levels are reviewed only when a tournament becomes `COMPLETED` (and after a correction within 48 h): hysteresis ±3 around band boundaries, both directions, one band per crossing; `is_skill_tentative` becomes `false` at the first review after 6 rated matches. Level changes do not affect registrations already made (eligibility checked at action time).
- **Replay:** `R` and levels are recomputed by replaying rated matches in order of tournament `completed_at`, then match order. Triggers: completion, correction, Admin "recalculate". The job replays the affected players and everyone who played them later.
- Storage: new `skill_level_changes` (player, from/to level, `R`, tournament, reason `TOURNAMENT_RESULT|RECALCULATION`, created_at) — append-only; `skill_rating_events` (per match × player: R before/after, E, K) is a rebuildable cache. The legacy `player_skill_adjustments` (Ratings-based, NOT NULL rating columns) is left untouched and no longer written.
- Config keys `SKILL_RATING_*` per the research report §4.7.
- Visibility (PRD Decision #28): `skill_rating`, events and progress are returned only by `/players/me/skill-rating`; public profile, participant lists and search expose only the level. Level changes produce a notification to the Player.

### 7.11 Achievement ranking (TRN-18)

- At completion (and correction within 48 h) write one row per participant (Doubles: per member) into `tournament_ranking_points` (player_id, tournament_id, match_type, placement, points numeric(8,2), completed_at; unique (player_id, tournament_id)). `points = base(placement) × (mean level rank of the field at the draw ÷ 4) × min(1, N/8)`; base: CHAMPION 100, RUNNER_UP 70, SEMI_FINAL 50, QUARTER_FINAL 30, other 10.
- Leaderboard total per player and match type = sum of the best `TOURNAMENT_RANKING_BEST_N` (4) rows with `completed_at` in the last `TOURNAMENT_RANKING_WINDOW_MONTHS` (12); ties by best single result, then earliest reach. Computed by query (small data); position on the profile uses the same query.
- Filter `level` = the player's current level. Inactive/deleted users are excluded.

## 8. Security and Authorization

- Organizer = `tournaments.creator_id = session user` and role `PLAYER`; Admin uses admin routes only and can only list/cancel (PRD Decision #21).
- Invite tokens: 32 random bytes, base64url, only the hash stored; a join attempt with an unknown/stale token → `404 TOURNAMENT_TEAM_INVITE_INVALID`.
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
2a. Auto-complete / auto-cancel (§2.1).
2b. Tournament chat creation retry (§7.8).
3. Chat lock: tournaments `COMPLETED` for ≥ 30 days with an unlocked conversation → lock.
4. Match reminder: playable matches with status `CONFIRMED` (not started) with `scheduled_at` in `(now, now + 30 min]` and `reminder_sent_for IS DISTINCT FROM scheduled_at` → notify both sides, set `reminder_sent_for = scheduled_at` (a later reschedule re-arms it).

No payment-expiry job (no `PENDING_PAYMENT`).

## 11. Notifications

Resource type `TOURNAMENT` (route `/tournaments/:id`), resolver checks visibility (§8). Notifications are separate from realtime: realtime refreshes open pages, notifications reach users who are not watching. Events: `TOURNAMENT_MATCH_REMINDER`, `TOURNAMENT_TEAM_JOINED_BY_LINK`, `TOURNAMENT_TEAM_INVITED`, `_INVITATION_ACCEPTED|DECLINED|EXPIRED`, `TOURNAMENT_REGISTRATION_CONFIRMED`, `_REMOVED`, `_REFUNDED`, `TOURNAMENT_REGISTRATION_CLOSED`, `TOURNAMENT_BRACKET_PUBLISHED`, `TOURNAMENT_MATCH_RESCHEDULED` (own match, only after `READY`), `TOURNAMENT_CANCELLED`, `TOURNAMENT_COMPLETED`. Emitted after commit.

## 12. Frontend

`frontend/src/features/tournaments/` — React Query + RHF/Zod + shadcn primitives, routes:

| Route | Who | Content |
| --- | --- | --- |
| `/tournaments` | public | List + filters |
| `/tournaments/:id` | public | Tabs: Thông tin · Người tham gia · Nhánh đấu · Lịch thi đấu; register/withdraw/team panel |
| `/tournaments/new`, `/tournaments/:id/manage` | Organizer | Setup form; console tabs: Người tham gia · Hạt giống & bốc thăm · Lịch (board courts × time, edit dialog, warnings) · Trận đấu (start, score entry, walkover, correct) · Kết thúc |
| `/tournaments/mine` | Player | Organized / registered / invitations |
| `/admin/tournaments` | Admin | List + cancel |
| Profile (`/profile`, public player modal/page) | public | "Giải đấu" section with placement badges |
| Feed | Player | `TOURNAMENT_RESULT` card; share dialog on the tournament page after completion |

Realtime hook `useTournamentLive(tournamentId)` sends watch/unwatch over the existing messaging socket and invalidates queries on `tournament.updated`; falls back to 30 s `refetchInterval` without a socket.

## 13. Testing Strategy

- Pure unit tests: bracket (sizes 2–128, BYE placement, seed separation, reproducibility), scheduler (property tests: no court/participant overlap, rest, feeder order, daily window, determinism, fixed matches), conflicts, set-score validation (21–19 ✓, 21–20 ✗, 22–20 ✓, 23–20 ✗, 30–29 ✓, 30–28 ✓, 31–29 ✗, third set only at 1–1), placement, skill-rating replay (determinism, clamp, hysteresis).
- Realtime: watch rejected for hidden DRAFT; publish reaches watchers only; chat creation skips blocked members and exceeds the generic group cap.
- API integration (real Postgres test DB): lifecycle and authorization matrix; registration race on the last slot; wallet debit/refund/earning exactly once (double submit, retries); remove/withdraw/cancel refunds; draw atomicity (forced failure → no partial bracket); advancement and correction; auto-close job.
- E2E (mocked API for UI contracts, one live flow): Organizer creates → opens → 4 Players register → draw → schedule board → play to the final → complete; Player sees own match.

## 14. Migration of Legacy Data

Existing tournament rows (dev/test only) get `competition_type = 'PROFESSIONAL'` and schedule defaults. Legacy `PENDING_PAYMENT`/`EXPIRED` registrations are left untouched and ignored by counts.
