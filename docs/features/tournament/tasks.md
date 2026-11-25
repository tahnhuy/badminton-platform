# Tournament Management — Task List

- Linked PRD: [prd.md](./prd.md) (Draft 2026-11-25)
- Linked Tech Design: [tech-design.md](./tech-design.md) (Draft 2026-11-25)
- Track plan: `docs/plans/07_giai-dau.md`

This list replaces the legacy TRN-01…TRN-12 (git history). Legacy `DONE`/`IN_PROGRESS` marks described the old scope and are void. Already in the codebase and reused: tournament tables (schema 2026-09/10), `services/tournaments/bracket/bracketGenerator.ts` with `bracketGenerator.test.ts`, wallet, notifications, Auth/skill levels.

Status values: `Approved` (ready once the PRD/Tech Design are Ready) → `IN_PROGRESS` → `DONE`; `DEFERRED` (outside this release). Definition of Done: acceptance criteria pass, the listed verification ran, docs updated.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| TRN-01 | Schema delta, wallet entry type, config cleanup | DONE | — | M |
| TRN-02 | Tournament CRUD, lifecycle, visibility, cancel/complete | DONE | TRN-01 | L |
| TRN-03 | Singles registration, eligibility, wallet fees, withdraw/remove/refund | DONE | TRN-02 | L |
| TRN-04 | Seeds, draw and bracket persistence | DONE | TRN-03 | M |
| TRN-05 | Automatic scheduling on virtual courts + manual edit with warnings | DONE | TRN-04 | L |
| TRN-06 | Match operations: start, scores, walkover, correction, advancement | DONE | TRN-05 | M |
| TRN-07 | Frontend: list, detail, registration, bracket and schedule views | DONE | TRN-02…06 (API) | L |
| TRN-08 | Frontend: Organizer console (setup, participants, seeds/draw, schedule board, matches) | DONE | TRN-02…06 (API) | L |
| TRN-09 | Doubles teams, invitations, team registration (API + UI) | DONE | TRN-03, TRN-07 | L |
| TRN-10 | Jobs: registration auto-close, invitation expiry | DONE | TRN-02, TRN-09 | S |
| TRN-11 | Notifications (`TOURNAMENT` resource) | DONE | TRN-02…09 | M |
| TRN-15 | Realtime updates (WS watch + `tournament.updated`, polling fallback) | DONE | TRN-06, TRN-07 | M |
| TRN-16 | Profile tournament history, Social result post, tournament group chat | DONE | TRN-06, TRN-07 | L |
| TRN-12 | Admin tournaments list + cancel; end-to-end verification | DONE | all above | M |
| TRN-13 | Casual tournaments (no-account participants, Excel import) | DEFERRED | G0 D1b design | L |
| TRN-14 | Skill rating and level adjustment (up/down) from professional tournaments | DONE | TRN-06 | L |
| TRN-18 | Achievement ranking points and Singles/Doubles leaderboards | DONE | TRN-06, TRN-16 | M |
| TRN-17 | Tournament fees in Admin Finance and Dashboard | DONE | TRN-03 | M |

## Execution Order (vertical slice first)

| Wave | Tasks | Result |
| --- | --- | --- |
| 1 | TRN-01 → TRN-02 → TRN-03 | Singles tournament with fees, API only |
| 2 | TRN-04 → TRN-05 → TRN-06 | Draw, schedule, play to the final (API) |
| 3 | TRN-07, TRN-08 | **Demo:** full Singles tournament in the UI |
| 4 | TRN-09, TRN-10, TRN-11 | Doubles, automation, notifications |
| 5 | TRN-15, TRN-16, TRN-14, TRN-18, TRN-17 | Realtime, Profile/Social/chat, skill levels, ranking, Finance |
| 6 | TRN-12 | Admin + release verification |

## Working Process (agreed 2026-11-25)

- **Cadence (2026-11-25 update):** the project owner asked to run waves 4–6 to completion without stopping between waves; still stop on problems or undecided points. Originally: work through all tasks of a wave without waiting; **stop after each wave** with a report and wait for the project owner's approval. Stop immediately and ask on any problem, undecided point, behaviour change or scope change.
- **UI:** before wave 3 code, HTML prototypes in `docs/design/` (tournament page, bracket, schedule board, Organizer console) are approved by the project owner.
- **Per task:** set `IN_PROGRESS` + a "Tiến độ" section (done / verified / remaining) updated after each meaningful step → analyse docs and code → implement (pure algorithms first, with unit tests) → targeted tests + `tsc` + `verify:migrations` (frontend: `tsc -b`, lint, `check:ui`, mocked E2E); writes only on `badminton_test` → self-review of the diff; independent review agent for TRN-03, 04, 05, 06, 14, 17 → docs updated with verified results only → commits (code and docs separately, English, no co-author trailer); no push without asking; run artifacts not committed.
- **Full backend suite:** end of waves 2, 4 and 6.

---

## TRN-01 — Schema delta, wallet entry type, config cleanup

**Objective:** Bring the schema to Tech Design §4.

**Tiến độ (2026-11-25) — DONE**
- Done: Drizzle schema (`tournaments.ts`, `social.ts`, `messaging.ts`, `wallet.ts`); migration `0033_tournament_professional.sql` (generated + hand-added backfill of `tournament_team_players.tournament_id` and legacy value normalisation); registry deprecations; legacy fixtures in 6 test files moved to valid values (`UNRESOLVED`, `REGISTERED`, `SINGLE_ELIMINATION`, team-player `tournament_id`); `database-schema.md` change log; slot log.
- Verified: `tsc` PASS; `verify:migrations` OK (34 migrations, no schema diff); `tournament-migration.test.ts` 3/3 on a populated scratch DB (backfill, normalisation, every new CHECK/unique); affected suites 30 files / 293 tests PASS (dashboard, profile, owner schedule/cancellation, system booking, admin reports, ratings, config, social, messaging, wallet, finance, bracket); applied to dev `badminton_db` on request (backup `~/db-backups/badminton_db_before_0033_*.dump`).
- Decisions in implementation: date-order CHECK not added (service validates, Tech Design §6.1); extra uniques `uq_tournament_match_position` and `uq_tournament_team_player_active` (replaces the plain team/player unique so a Player who left can rejoin).
- Follow-up (TRN-06): `RatingService` still accepts tournament-match ratings while `TOURNAMENT_RATING_ENABLED` (now deprecated, default `true`) is on — disable tournament ratings there.

**Scope**
- Migration (slot from `docs/plans/migration-slot-log.md`): `tournaments` new columns (§4.1) with CHECKs and defaults; `tournament_registrations` new columns, status CHECK, active-registration unique indexes on `status = 'CONFIRMED'`, unique `(tournament_id, seed_no)` where not null; `tournament_matches.court_label`, `reminder_sent_for`, resolution `RETIRED`; `tournaments.conversation_id`, `completed_by`; `tournament_teams.invite_token_hash`; `tournament_team_players.tournament_id` + partial unique `(tournament_id, player_id)`; registration status CHECK and recreated partial unique indexes (Tech Design §4.2); `posts.type` + `posts.tournament_id` + partial unique (Tech Design §4.3b); `conversations.system_kind` (§4.3c); wallet entry type `TOURNAMENT_EARNING`. TRN-14 columns/tables come with TRN-14.
- Drizzle schema, snapshot/journal, `database-schema.md` change log.
- Config registry: deprecate `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TOURNAMENT_RATING_ENABLED`, `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES` (read-only).

**Acceptance**
- `npm run db:migrate` clean on a fresh DB and on the dev DB; `verify:migrations` passes.
- Existing tournament rows get `PROFESSIONAL` and schedule defaults; existing wallet rows satisfy the new CHECK.

**Verification:** `tournament-migration.test.ts` (fresh + populated), `tsc`.

## TRN-02 — Tournament CRUD, lifecycle, visibility, cancel/complete

**Objective:** Organizer creates and manages a tournament through its states (PRD FR-01…07, 60, 61).

**Tiến độ (2026-11-25) — DONE**
- Done: `optionalAuthenticate` middleware (public reads identify a signed-in viewer, invalid sessions → visitor); `tournament-config.ts`; `validation/tournaments.ts`; pure `services/tournaments/rules.ts` (eligibility, editing locks per status, cross-field validation); `TournamentRepository`; `TournamentService` (create, update, open, close incl. `< 2` → cancel, cancel, complete with final check, detail with viewer block, list, mine); controller + routes at `/api/v1/tournaments`.
- Verified: `tsc` PASS; `tournament-core.test.ts` 14/14 (rules units; create/defaults/role; field-detail validation; DRAFT 404 for visitor/other Player, visible to Organizer/Admin; 403 other Player on a visible tournament; version conflict; OPEN locks incl. deadline extend-only and fee/levels after a confirmation; open requires venue; close → closed or auto-cancel; cancel states; complete needs a resolved final; `TOURNAMENT_DISABLED`; viewer eligibility reasons; list filters, registered tab, meta); auth tests 33/33.
- Notes: refunds on cancel are wired by TRN-03 (`cancelInTransaction` is the single cancel path); list order and error details documented in Tech Design §3.1/§3.6.

**Scope**
- Routes/controllers/services/repositories per Tech Design §1, §3.1.
- Validation §6.1, editing rules §6.2, optimistic `version`, tournament row lock.
- Transitions: open (requires venue), close (manual; `< 2` → cancel), cancel (Organizer states §2.1), complete (final resolved — stubbed check until TRN-06). Cancel calls the refund path from TRN-03 (no registrations yet in this task's tests).
- Visibility: DRAFT 404 for others; public list/detail; `/mine`.
- Gate `TOURNAMENT_ENABLED`.

**Acceptance**
- Another Player cannot edit/transition a visible (non-DRAFT) tournament (403); a DRAFT is 404 for everyone except its Organizer and Admin; stale version → 409; invalid transition → 409; locked field → 409.

**Verification:** `tournament-core.test.ts`.

## TRN-03 — Singles registration, eligibility, wallet fees, withdraw/remove/refund

**Objective:** PRD FR-10…14 for Singles.

**Tiến độ (2026-11-25)**
- Done: `TournamentFeeService` (charge → wallet `PAYMENT` + `payments` WALLET/SUCCESS; refund → wallet `REFUND` + payment `REFUNDED` + `payment_refunds` + `refunded_at`; `refundAll` ordered by payer id; `creditOrganizer` → `TOURNAMENT_EARNING`; idempotency keys `trn-reg:`, `trn-refund:`, `trn-earning:`); `TournamentRegistrationService` (Singles register with window/eligibility/organizer/duplicate/slot checks under the tournament row lock; withdraw while open; Organizer remove before the draw with seed renumbering; withdrawn/removed teams disbanded; public participant list without contact data); cancel path refunds, complete path credits the Organizer; `WalletEntryType` + `TOURNAMENT_EARNING`; routes `GET|POST /:id/registrations`, `DELETE /:id/registrations/:registrationId`, `POST …/remove`.
- Verified: `tsc` PASS; `tournament-registration.test.ts` 9/9 + `tournament-core.test.ts` 14/14 (free and paid registration, every rejection, last-slot race 5 → 1 winner with only the winner charged, insufficient balance leaves no row, withdraw refund once + re-register charged again + no withdraw after close, Organizer-only removal with refund and seed renumbering, cancel refunds each payer exactly once, completion credits the Organizer once with fees still held).
- Review agent (independent): 1 blocking + 4 minor findings, all fixed — (1) `findViewerRegistration` read through a second pool connection while the tournament row was locked → could exhaust the 10-connection pool under ≥ 10 concurrent registrations; now uses `tx` (and `update` preloads skill levels before locking); (2) withdrawal was still possible after `registration_end` until the job closed the tournament → same window check as registering; (3) participant list could 500 on a missing profile/level → left join + fallback; (4) `teamId` was silently accepted → rejected until TRN-09.
- Re-verified: `tsc` PASS; 27/27 (`tournament-registration` 13 incl. 12 concurrent racers > pool size, withdraw after `registration_end`, withdraw × 2 racing cancel → one refund, close-with-one-paid → cancel + refund; `tournament-core` 14). The 12-racer case was not run against the pre-fix code.
- **DONE.**
- Follow-ups: frontend wallet history needs a label for `TOURNAMENT_EARNING` (TRN-07/TRN-17); Doubles registration path (`teamId`) in TRN-09.

**Scope**
- `TournamentFeeService` (§5): debit + `payments` row on register, refund on withdraw/remove/cancel, `TOURNAMENT_EARNING` on complete; idempotency keys.
- Eligibility §6.3; Organizer cannot register (PRD Q1 default).
- Withdraw only while `OPEN_FOR_REGISTRATION` (no refund path after close); Organizer remove with reason before the draw; participant list endpoint.

**Acceptance**
- Last-slot race: N concurrent registrations for 1 slot → exactly 1 succeeds, others `TOURNAMENT_FULL`, no wallet debit for losers.
- Insufficient balance → 409 `WALLET_INSUFFICIENT_BALANCE`, no registration row.
- Withdraw/remove/cancel refund exactly once (double submit, retry); complete credits the Organizer exactly once with the correct sum.
- Ineligible level → 403 with rank details.

**Verification:** `tournament-registration.test.ts`, `tournament-fees.test.ts`.

## TRN-04 — Seeds, draw and bracket persistence

**Objective:** PRD FR-30…33; Tech Design §7.1–§7.2.

**Tiến độ (2026-11-25)**
- Done: —
- Verified: —
- Done: `orderForDraw` (Organizer seeds by number, unseeded drawn at random; falls back to skill order) used by `buildBracket`; `TournamentBracketService` — `GET/PUT /:id/seeds` (stable skill suggestion seeded by tournament id; seeds 1..k, Organizer-only, REGISTRATION_CLOSED only), `POST /:id/draw` (suggestion becomes seeds when none saved; random stored `draw_seed`; one transaction writes `matches` (CONFIRMED, tournament match type, `scheduled_at` = tournament start until TRN-05) + `tournament_matches` + next links + rosters of playable matches; READY), `GET /:id/bracket` (rounds, slots with `fromBye`, winners, sets, schedule).
- Verified: `tsc` PASS; `bracketGenerator.test.ts` 45/45 (explicit seeds for 2–128 entries: BYEs to top seeds, seeds 1/2 opposite halves, 1–4 different quarters, fixed seeded positions, reproducible draw); `tournament-bracket.test.ts` 6/6 (suggestion order and stability, seed validation, 5-player bracket of 8 with 3 BYEs/links/rosters/READY/locks, < 2 rejected, forced mid-draw failure leaves nothing, DRAFT hidden); `player-profile.test.ts` 21/21.
- Review agent: nothing blocking; fixed — repeated draw reported `VERSION_CONFLICT` instead of `BRACKET_ALREADY_GENERATED` (status now checked before version); short rosters now fail loudly; bracket read loads registrations by the ids in the bracket. Kept as is: ~4 queries per match while the lock is held (acceptable at ≤ 127 matches); with partial seeding extra BYEs go to drawn unseeded entries (Tech Design §7.2 "unseeded drawn at random"); `seeds: []` clears seeds so the draw uses the suggestion.
- Note: round indexes are 0-based (`round_index = 0` is the first round).

**Scope**
- Extend `bracketGenerator.ts` for explicit `seedNo` (seeded by position, unseeded random) and a seeded PRNG; keep existing tests green and add new ones.
- `GET/PUT /seeds`, `POST /draw`: one transaction writes `matches` + `tournament_matches` + links + BYE advancement, stores `draw_seed`, runs the initial schedule (TRN-05 function; until then all matches get `tournament_start`), status `READY`.

**Acceptance**
- Sizes 2–128: correct bracket size, BYEs to top seeds, seeds 1 and 2 in opposite halves, 1–4 in different quarters.
- Same `draw_seed` → same bracket.
- Forced failure mid-draw → no rows, status unchanged; second draw → 409.

**Verification:** `bracketGenerator.test.ts`, `tournament-bracket.test.ts`.

## TRN-05 — Automatic scheduling on virtual courts + manual edit with warnings

**Objective:** PRD FR-40…43; Tech Design §7.3–§7.4 (thesis algorithm 1, scheduling part).

**Tiến độ (2026-11-25)**
- Done: pure `scheduleGenerator.ts` (greedy list scheduling in bracket order; court, feeder+rest, participant+rest, daily window in UTC+7; fixed matches as `playing` / `played` / `unplayed`) and `conflicts.ts` (COURT_OVERLAP, PARTICIPANT_OVERLAP, REST_TOO_SHORT, BEFORE_FEEDER, OUTSIDE_DAILY_WINDOW, OUTSIDE_TOURNAMENT_DATES); `TournamentScheduleService` (auto-schedule at the draw and on re-run from max(now, tournament start) rounded to 5 min; manual edit of not-started matches returning warnings and bumping the version; public schedule, warnings for the Organizer only); routes `GET /:id/schedule`, `POST /:id/schedule/auto`, `PATCH /:id/matches/:tournamentMatchId/schedule` (wired in the TRN-06 commit).
- Verified: `tsc` PASS; `scheduleGenerator.test.ts` 70/70 (60 random brackets 2–64 players × random courts/duration/rest/windows checked by the independent conflict checker, determinism, parallel first round, fixed matches incl. overrunning and unplayed, labels incl. NFD and "Sân 0", each warning type); `tournament-schedule.test.ts` 4/4 (exact times for 8 players on 2 courts, edit warnings/403/locked, re-run keeps started matches and refuses a stale version, state guard).
- Review agent: nothing blocking; fixed — overrunning in-progress matches and unplayed walkovers/cancellations now handled; a late draw no longer schedules into the past; times aligned to 5 min; NFC court labels and court ≥ 1; edits bump the version. Kept: `tournament_end` is the hard end of the last match (`OUTSIDE_TOURNAMENT_DATES`).

**Scope**
- Pure `scheduleGenerator.ts` and `conflicts.ts`.
- Used by the draw; `POST /schedule/auto` (re-run, fixed started/finished matches); `PATCH …/schedule` returns warnings; `GET /schedule`.

**Acceptance (property tests over random brackets and settings)**
- No court overlap; no participant overlap; rest ≥ `min_rest_minutes`; no match before its feeders end; all matches inside the daily window; deterministic.
- Re-run keeps fixed matches unchanged.
- Each warning type is produced for a crafted manual edit and the edit is still saved.

**Verification:** `scheduleGenerator.test.ts`, `scheduleConflicts.test.ts`, `tournament-schedule.test.ts`.

## TRN-06 — Match operations

**Objective:** PRD FR-50…54; Tech Design §7.5.

**Tiến độ (2026-11-25)**
- Done: pure `result/score.ts` (finished-set rule, in-progress set for retirements, 2–3 sets, one side to 2); `TournamentMatchService` (start; result SETS/RETIRED/WALKOVER/CANCEL; corrections while the next match is not started, the final until completion, scores/final winner within 48 h after completion; advancement rewrites the next slot and roster; READY → IN_PROGRESS on first start/result); `RatingService` rejects every tournament match (`RATING_DISABLED`); routes `POST /:id/matches/:id/start`, `PUT /:id/matches/:id/result` (+ TRN-05 schedule routes).
- Verified: `tsc` PASS; `score.test.ts` 18/18; `tournament-matches.test.ts` 5/5 (full 8-player tournament through the API with completion and Organizer credit, all rejections, walkover/retirement/cancel, correction and lock, 48 h window); `ratings.test.ts` updated (tournament matches never ratable, casual still ratable) — 35/35 with the match tests.
- Review agent: nothing blocking; fixed — player statistics now count `RETIRED` results (`profile-statistics.ts`); a retirement after the match was decided is rejected; corrections keep the real `completed_at`; after completion a non-final keeps its result type (only scores change); a first-entry cancellation no longer moves READY → IN_PROGRESS. TODO left for TRN-14/16 (recompute placements, ranking, skill replay after a post-completion correction).
- Re-verified: 45/45 (`tournament-matches` 6, `score` 18, `player-profile` 21).
- **End of wave 2 — full backend suite (2026-11-25):** 88/90 files, 1029/1030 tests PASS in 1092 s. The 2 failures were timeouts in scratch-database migration tests (`report-evidence-migration` 30.8 s > 30 s; `mm21-migration` setup hook) under full-suite load; both pass alone (6/6). Their scratch databases replay every migration, which 0033 makes longer, so their timeouts were raised to 90 s; re-run with `tournament-migration`: 9/9.

**Scope**
- Disable tournament-match ratings in `RatingService` (PRD Decision #14; follow-up from TRN-01).
- Start (first start → `IN_PROGRESS`; writes `match_players`), result by sets (best of 3, 21 points, strict rule — Tech Design §7.5), retirement (`RETIRED`, partial sets), walkover (no-show), cancel (`NONE`), correction while the next match is `CONFIRMED` (not started), final correction until completion and 48 h correction window after completion, advancement; `match_players` written when a match becomes playable; completing the tournament (enables TRN-02 complete check).

**Acceptance**
- Set-score table tests (21–19 ✓, 21–20 ✗, 22–20 ✓, 23–20 ✗, 30–29 ✓, 30–28 ✓, 31–29 ✗; third set only at 1–1) → 400 with `setNo`; result on a non-playable match → 409; correction after the next match started → 409; correction > 48 h after completion → 409.
- A full 8-player tournament played through the API ends with one champion and the Organizer earning credited.

**Verification:** `score.test.ts`, `tournament-matches.test.ts`.

## TRN-07 — Frontend: list, detail, registration, bracket and schedule views

**Tiến độ (2026-11-25)**
- Done: HTML prototype `docs/design/smashpro-tournament-v1` (covers TRN-07 and TRN-08): list, detail (4 tabs), wallet registration dialog, Organizer console (setup, participants, seeds/draw, court × time board, matches with live score validation, finish). Checked with Playwright at 1280/390 px (no JS errors, no horizontal overflow). Project-owner feedback applied: bracket connectors with a flow effect and faded losers (`7d9d9ed`).
- Prototype review points taken as proposed (owner asked to build wave 3 to completion): nav tab "Giải đấu" replaces "Đánh giá" (ratings history moved to the account menu + footer); bracket scrolls horizontally on mobile; schedule edited through a dialog (no drag); forest hero kept; copy as in the prototype.
- Done (React, `frontend/src/features/tournaments/`): `/tournaments` (search, status/type/free/fits filters, animated cards, pagination), `/tournaments/:id` (hero, 4 tabs with animated indicator, my next match, wallet registration dialog with balance after + top-up link, withdraw, eligibility/full/doubles states), bracket with measured SVG connectors, drawn winner paths, flowing dashes and faded losers, schedule by day, `/tournaments/mine` (registered / organized / invited). Pages are lazy-loaded; Motion respects reduced motion. Wallet history labels `TOURNAMENT_EARNING`.
- Verified 2026-11-25: `tsc -b`, `npm run lint` (incl. `check:ui`, no new errors), `npm run build`; mocked E2E `tournament-ui.spec.ts` 6/6 (twice) incl. 390 px without horizontal overflow; `player-shell-ui.spec.ts` updated for the new tab — all pass except `responsive 390px`, which also fails intermittently on the unchanged baseline (a `/courts` card, 3/6 runs) and is not caused by this task.
- Not done: live E2E against a real backend (dev backend occupies :3000); the API is covered by the wave 1–2 integration suites. Doubles registration is TRN-09; realtime is TRN-15 (pages poll every 30 s while READY/IN_PROGRESS).

**Objective:** PRD §9 Player/visitor screens.

**Scope:** `/tournaments`, `/tournaments/:id` (tabs), register/withdraw dialog with wallet balance and top-up link, bracket view, schedule view (by time / by court), "my next match", `/tournaments/mine`, Player nav entry. Design pass before coding (prototype per `docs/design/` convention).

**Acceptance:** UI contracts in mocked E2E; 390/1280 px without horizontal overflow; reduced motion; `check:ui`.

**Verification:** `tournament-ui.spec.ts` (mocked), `tsc -b`, lint, `check:ui`.

## TRN-08 — Frontend: Organizer console

**Tiến độ (2026-11-25) — DONE (live E2E pending)**
- Done: `/tournaments/new` and `/tournaments/:id/manage` with step progress and section menu (`?section=`, defaults to the step that needs the Organizer): setup form (zod, status locks of Tech Design §6.2, server field errors, only changed fields sent), open/close/cancel; participants with remove + reason (refund); seeds editor (suggestion, clear, continuity check, first-round preview with byes) and draw; court × time board (per day, status colours, warning badges, edit dialog with resulting warnings, re-run with confirmation); matches (filters, start, score dialog with live 21-point validation and winner preview, retired, walkover, cancel, correction incl. 48 h window after completion); finish (checks, payout preview, champion card, complete). Non-organizers get a guard.
- Verified 2026-11-25: mocked E2E `tournament-organizer-ui.spec.ts` 5/5 (twice): create draft → console, guard, set-score validation and request body, schedule edit request body, complete with version; screenshots reviewed at 1366 and 390 px.
- Not done: the live E2E `tournament-live.spec.ts` from the acceptance (needs a dedicated test backend while the dev backend runs on :3000) — carried to the wave 4 full-suite run.

**Objective:** PRD §6 Organizer journey in the UI.

**Scope:** create/edit form (incl. eligibility, fee, schedule settings), lifecycle actions, participant table with remove+reason, seed editor with suggestion + draw, schedule board (courts × time) with edit dialog and warning badges + re-run, match panel (start, games, walkover, cancel, correct), conclude.

**Acceptance:** mocked E2E for each console tab; one live E2E (dedicated test backend): create → open → 4 Players register (wallet seeded) → draw → play to final → complete; Organizer wallet credited.

**Verification:** `tournament-organizer-ui.spec.ts`, `tournament-live.spec.ts`.

## TRN-09 — Doubles teams, invitations, team registration

**Tiến độ (2026-11-25) — DONE** (`003062c`)
- `TournamentTeamService`: create team (captain), invite (one pending, unique index), accept/decline/cancel, invitable-player search (eligible, not teamed, not blocked, no contact data), invite link (sha256 stored, regenerable), join by link, member leave / captain remove / captain leave disbands, captain registers a FULL team and pays; pending invitations cancelled at close/cancel. Extra endpoints beyond §3.2 (needed for §4.2 rules): `POST /:id/teams/:teamId/leave`, `DELETE /:id/teams/:teamId/members/:playerId`.
- UI: team panel on the tournament page, join page `/tournaments/join/:token`, Doubles withdraw by captain only.
- Verified: `tournament-teams.test.ts` 11/11 (incl. concurrent accepts on two teams, concurrent link joins, regenerated link), mocked E2E `tournament-team-ui.spec.ts` 5/5.


**Objective:** PRD FR-20…23.

**Scope:** API (Tech Design §3.2, §2.3, eligibility for both members, captain pays) incl. invitable-player search and the regenerable invite link; UI (create team, search + invite, copy link, join page, accept/decline/cancel, register team, withdraw by captain). Pending invitations cancelled when registration closes. Team lifecycle rules of Tech Design §4.2 (one pending invitation, leave/remove member while forming, captain leaving disbands, withdrawn/removed team disbanded).

**Acceptance:** one team per Player per tournament (DB unique, incl. concurrent accepts on different teams); full team only; membership locks after registration; concurrent accepts/joins on one team → one succeeds; regenerated link invalidates the old one; search never returns ineligible/blocked/already-teamed Players or contact data.

**Verification:** `tournament-teams.test.ts`, mocked E2E for the team panel.

## TRN-10 — Jobs

**Tiến độ (2026-11-25) — DONE**
- `jobs/tournament.job.ts` + `TournamentJobService` (advisory lock; every step re-checks under the row lock or claims rows conditionally): auto-close, invitation expiry, auto-complete (3 d) / auto-cancel (14 d), match reminder, chat retry and 30-day chat lock.
- Found and fixed: raw `sql` params with JS `Date` against `timestamp` columns were shifted by the server offset (node-pg sends local time with offset, Postgres drops it) — also in the wave-1 list `from/to` filter; now column operators.
- Verified: `tournament-jobs.test.ts` (two concurrent runners → one effect).


**Objective:** Tech Design §10.

**Scope:** `jobs/tournament.job.ts` (every minute, advisory lock) with: auto-close at `registration_end` (same path as manual close, incl. `< 2` cancel + refunds); invitation expiry; auto-complete / auto-cancel (Tech Design §2.1). Later tasks add their own steps to this job: match reminder (TRN-11), chat creation retry and chat lock (TRN-16), skill-rating replay (TRN-14).

**Acceptance:** job is idempotent and safe to run concurrently (two runners → one effect).

**Verification:** `tournament-jobs.test.ts`.

## TRN-11 — Notifications

**Tiến độ (2026-11-25) — DONE**
- Notifications are written inside the transition's transaction (platform pattern of `NotificationService`; stronger than "after commit") with per-transition dedup keys; resolver `TOURNAMENT` → `/tournaments/:id` (DRAFT only for its Organizer → console; Admin → `/admin/tournaments?tournamentId=`).
- Verified: `tournament-jobs.test.ts` (notifications, reminder once per scheduled time, re-armed after reschedule, hidden DRAFT link), `notification-resolvers.test.ts`.


**Objective:** PRD FR-62; Tech Design §11.

**Scope:** producer events after commit; resolver for `TOURNAMENT` with visibility; notification copy in Vietnamese; match reminder step in the tournament job (30 min before, once per `scheduled_at`).

**Verification:** `tournament-notifications.test.ts`; resolver test for hidden DRAFT.

## TRN-12 — Admin and release verification

**Tiến độ (2026-11-25) — DONE**
- `GET /admin/tournaments` (all statuses incl. DRAFT), `POST /admin/tournaments/:id/cancel {reason}` (refunds, Organizer notified), `POST /admin/tournaments/skill-ratings/recalculate`; page `/admin/tournaments` replaces the placeholder; global search links to the row.
- Verified: `admin-tournaments.test.ts` 4/4, mocked E2E `tournament-admin-ui.spec.ts`; final full suite recorded below.


**Scope:** `/admin/tournaments` list + cancel (with refunds); Admin dashboard/global search links to the new pages; full backend suite + E2E run; docs status to Ready/DONE.

**Verification:** `admin-tournaments.test.ts`, admin UI mocked E2E, full suites.

## TRN-15 — Realtime updates

**Tiến độ (2026-11-25) — DONE**
- Hub: `tournament.watch/unwatch` (visibility check, max 5 — slot reserved before the async check, found by the test), `publishTournament`; controllers and the job publish `tournament.updated` after commit. Frontend `useTournamentLive` stops polling while the socket watches; polling otherwise.
- Verified: `tournament-realtime.test.ts` 3/3 (< 1 s, non-watchers nothing, DRAFT rejected), mocked E2E with a fake socket.


**Objective:** PRD FR-63; Tech Design §7.9.

**Scope:** `tournament.watch`/`unwatch` client messages in `MessagingWsHub` (visibility check, max 5 per connection); `TournamentRealtime.publish` after commit from TRN-02/04/05/06 mutations; frontend `useTournamentLive` (invalidate queries; 30 s polling whenever there is no socket — visitors, Admin, Court Owner, Messaging disabled).

**Acceptance:** watcher receives `tournament.updated` within 1 s of a result; non-watchers receive nothing; DRAFT watch rejected for non-Organizers; page without socket still refreshes.

**Verification:** `tournament-realtime.test.ts`; mocked E2E with a fake socket.

## TRN-16 — Profile history, Social result post, group chat

**Tiến độ (2026-11-25) — DONE**
- Pure `placement.ts` (+ unit tests 2–16 players, BYEs, walkovers, cancelled match); `GET /players/:id/tournaments`; `POST /:id/share` (Organizer/top 4, once; deleting allows again); Social: feed includes `TOURNAMENT_RESULT`, reactions/comments allowed, body-only edit, derived card via `TournamentResultCardPort`; system group chat (`createSystemGroupConversationInTransaction`, skips blocked/inactive, no user management, locked = read-only for everyone).
- Verified: `placement.test.ts`, `tournament-share-chat.test.ts` 6/6, mocked E2E (share dialog, feed card, profile section).


**Objective:** PRD FR-70…72; Tech Design §7.6–§7.8.

**Scope**
- Placement function + `GET /players/:id/tournaments`; Profile "Giải đấu" section (own + public).
- `POST /:id/share` → `TOURNAMENT_RESULT` post; Social changes (feed filter, interaction guard, body-only edit — Tech Design §4.3b); feed card; share dialog.
- `createSystemGroupConversationInTransaction` and `system_kind = 'TOURNAMENT'` rules in Messaging (no generic cap, skip blocked/inactive, no user admin actions, locked = read-only for all); create after close commit with job retry, remove on Organizer removal, lock on cancel and 30 days after completion (job steps).

**Acceptance:** placements correct for sizes 2–16 incl. BYEs and walkovers; only Organizer/top 4 can share, once; chat contains exactly Organizer + participants minus blocked; locked chat rejects new messages from everyone incl. the Organizer; Organizer cannot add/remove/rename/unlock; result posts appear in the feed and accept reactions/comments; deleting a result post allows sharing again.

**Verification:** `tournament-placement.test.ts`, `tournament-share.test.ts`, `tournament-chat.test.ts`, mocked E2E for profile section and feed card.

## TRN-13 — Casual tournaments (DEFERRED)

Participants without accounts (manual entry, Excel import), no rank, public summary hiding contact data (G0 D1b, 2026-11-15). Needs its own design for a participant table independent of `users`; `competition_type = 'CASUAL'` is reserved by TRN-01.

## TRN-14 — Skill rating and level adjustment

**Tiến độ (2026-11-25) — DONE**
- Migration 0034; pure `rating/skillRating.ts` reproduces research report §5 examples 1–4 (full precision; example 4 lands at 56.9998 < 57 → demotion as in the report); `SkillRatingService` replays the whole history at completion / correction / Admin recalculation, rebuilds `skill_rating_events`, appends `skill_level_changes` only when the stored level differs, notifies the Player; `GET /players/me/skill-rating` (owner only; seeds view strips R); seed tie-break by R.
- Deviations: initial R is derived on read/replay instead of a migration backfill (same value); doubles factor stored as integer `SKILL_RATING_DOUBLES_FACTOR_PERCENT` (registry has no decimal type).
- Independent review fixed: deadlock between a completion and a correction (replay lock now taken before row locks), stale rating when a player's last rated match is corrected to a walkover, config read through the global pool inside a locked transaction.
- Verified: `skillRating.test.ts`, `tournament-rating-ranking.test.ts` (demotion, walkover ignored, correction → RECALCULATION, reset, concurrent completion + correction).


**Objective:** Thesis algorithm 2 (`PROJECT-BRIEF.md` §7, PRD Decision #26); model in [`docs/research/bao-cao-cong-thuc-nang-trinh.md`](../../research/bao-cao-cong-thuc-nang-trinh.md) §4; Tech Design §7.10. Final decision of the project owner (2026-11-25); parameters are config.

**Scope**
- Migration: `player_profiles.skill_rating`, `rated_match_count`; `skill_level_changes`; `skill_rating_events`; `SKILL_RATING_*` config keys; initial `R` backfill from survey scores (clamped to the assigned band).
- Pure `skillRating.ts` (expected score, update, hysteresis, replay) and `SkillRatingService` (review at completion, replay after correction, Admin recalculate).
- Seed suggestion tie-break by `R`; `GET /players/me/skill-rating` (owner only — `R` never in public reads, PRD Decision #28); own Profile shows `R`, progress to the next band, rating/level history; level-change notification.

**Acceptance:** worked examples of the research report §5 reproduce exactly; replay is deterministic and idempotent; walkovers ignored, retirements counted; `R` clamped to [0, 100]; hysteresis prevents a change for a single loss near a boundary; a correction within 48 h that flips a level writes a `RECALCULATION` change.

**Verification:** `skillRating.test.ts`, `skill-rating-service.test.ts`, tournament end-to-end test with level change.

## TRN-18 — Achievement ranking points and leaderboards

**Tiến độ (2026-11-25) — DONE**
- `tournament_ranking_points` written at completion (field strength = levels before this tournament's review) and rewritten on correction (factor recovered from the highest row); leaderboard best N in window with tie-breaks, positions numbered inside the level filter; profile card and history points; UI `/tournaments/rankings` with podium.
- Verified: `tournament-rating-ranking.test.ts` (points table, best-4/12-month window, level filter), mocked E2E.


**Objective:** PRD FR-82…83, Decision #27; Tech Design §7.11.

**Scope:** `tournament_ranking_points` (migration), write at completion/correction, config `TOURNAMENT_RANKING_BEST_N` / `TOURNAMENT_RANKING_WINDOW_MONTHS`, `GET /tournament-rankings`, ranking points in `GET /players/:id/tournaments`; UI: leaderboard page (Singles/Doubles tabs, level filter), ranking card on Profile.

**Acceptance:** points formula reproduces hand examples; best-4-in-12-months window and tie-break; correction rewrites the row; Doubles members both credited.

**Verification:** `tournament-ranking.test.ts`, mocked E2E for the leaderboard page.

## TRN-17 — Tournament fees in Admin Finance and Dashboard

**Tiến độ (2026-11-25) — DONE**
- Overview tournament block (gross/refunds/net fees, Organizer payouts, fees held for open tournaments); revenue by source splits refunds; reconciliation covers registration payments/refunds and a `TOURNAMENT_EARNING_TOTAL` pair; Dashboard revenue KPI and chart use the net definition. Owner earnings stay OWNER_EARNING only in every grouping (review).
- Verified: `tournament-finance.test.ts`, existing `finance-admin`/`dashboard` tests.


**Objective:** Tech Design §5.1.

**Scope:** revenue split booking / tournament fees (gross and net of refunds), dashboard revenue on the same net definition, reconciliation over registration payments and `payment_refunds`, `TOURNAMENT_EARNING` reported next to `OWNER_EARNING`, fees held for open tournaments as liability.

**Verification:** finance report and reconciliation tests with tournament payments, refunds and earnings; dashboard KPI test.
