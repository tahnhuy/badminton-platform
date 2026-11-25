# Tournament Management — Task List

- Linked PRD: [prd.md](./prd.md) (Draft 2026-11-25)
- Linked Tech Design: [tech-design.md](./tech-design.md) (Draft 2026-11-25)
- Track plan: `docs/plans/07_giai-dau.md`

This list replaces the legacy TRN-01…TRN-12 (git history). Legacy `DONE`/`IN_PROGRESS` marks described the old scope and are void. Already in the codebase and reused: tournament tables (schema 2026-09/10), `services/tournaments/bracket/bracketGenerator.ts` with `bracketGenerator.test.ts`, wallet, notifications, Auth/skill levels.

Status values: `Approved` (ready once the PRD/Tech Design are Ready) → `IN_PROGRESS` → `DONE`; `DEFERRED` (outside this release). Definition of Done: acceptance criteria pass, the listed verification ran, docs updated.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| TRN-01 | Schema delta, wallet entry type, config cleanup | Approved | — | M |
| TRN-02 | Tournament CRUD, lifecycle, visibility, cancel/complete | Approved | TRN-01 | L |
| TRN-03 | Singles registration, eligibility, wallet fees, withdraw/remove/refund | Approved | TRN-02 | L |
| TRN-04 | Seeds, draw and bracket persistence | Approved | TRN-03 | M |
| TRN-05 | Automatic scheduling on virtual courts + manual edit with warnings | Approved | TRN-04 | L |
| TRN-06 | Match operations: start, scores, walkover, correction, advancement | Approved | TRN-05 | M |
| TRN-07 | Frontend: list, detail, registration, bracket and schedule views | Approved | TRN-02…06 (API) | L |
| TRN-08 | Frontend: Organizer console (setup, participants, seeds/draw, schedule board, matches) | Approved | TRN-02…06 (API) | L |
| TRN-09 | Doubles teams, invitations, team registration (API + UI) | Approved | TRN-03, TRN-07 | L |
| TRN-10 | Jobs: registration auto-close, invitation expiry | Approved | TRN-02, TRN-09 | S |
| TRN-11 | Notifications (`TOURNAMENT` resource) | Approved | TRN-02…09 | M |
| TRN-15 | Realtime updates (WS watch + `tournament.updated`, polling fallback) | Approved | TRN-06, TRN-07 | M |
| TRN-16 | Profile tournament history, Social result post, tournament group chat | Approved | TRN-06, TRN-07 | L |
| TRN-12 | Admin tournaments list + cancel; end-to-end verification | Approved | all above | M |
| TRN-13 | Casual tournaments (no-account participants, Excel import) | DEFERRED | G0 D1b design | L |
| TRN-14 | Rank promotion and achievements from professional tournaments | DEFERRED (formula TBD) | G0 D1c | L |

## Execution Order (vertical slice first)

| Wave | Tasks | Result |
| --- | --- | --- |
| 1 | TRN-01 → TRN-02 → TRN-03 | Singles tournament with fees, API only |
| 2 | TRN-04 → TRN-05 → TRN-06 | Draw, schedule, play to the final (API) |
| 3 | TRN-07, TRN-08 | **Demo:** full Singles tournament in the UI |
| 4 | TRN-09, TRN-10, TRN-11 | Doubles, automation, notifications |
| 5 | TRN-15, TRN-16 | Realtime, Profile/Social/chat |
| 6 | TRN-12 | Admin + release verification |

---

## TRN-01 — Schema delta, wallet entry type, config cleanup

**Objective:** Bring the schema to Tech Design §4.

**Scope**
- Migration (slot from `docs/plans/migration-slot-log.md`): `tournaments` new columns (§4.1) with CHECKs and defaults; `tournament_registrations` new columns, status CHECK, active-registration unique indexes on `status = 'CONFIRMED'`, unique `(tournament_id, seed_no)` where not null; `tournament_matches.court_label`; `tournaments.conversation_id`; `posts.type` + `posts.tournament_id` (Tech Design §4.3b); wallet entry type `TOURNAMENT_EARNING`.
- Drizzle schema, snapshot/journal, `database-schema.md` change log.
- Config registry: deprecate `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TOURNAMENT_RATING_ENABLED`, `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES` (read-only).

**Acceptance**
- `npm run db:migrate` clean on a fresh DB and on the dev DB; `verify:migrations` passes.
- Existing tournament rows get `PROFESSIONAL` and schedule defaults; existing wallet rows satisfy the new CHECK.

**Verification:** `tournament-migration.test.ts` (fresh + populated), `tsc`.

## TRN-02 — Tournament CRUD, lifecycle, visibility, cancel/complete

**Objective:** Organizer creates and manages a tournament through its states (PRD FR-01…07, 60, 61).

**Scope**
- Routes/controllers/services/repositories per Tech Design §1, §3.1.
- Validation §6.1, editing rules §6.2, optimistic `version`, tournament row lock.
- Transitions: open (requires venue), close (manual; `< 2` → cancel), cancel (Organizer states §2.1), complete (final resolved — stubbed check until TRN-06). Cancel calls the refund path from TRN-03 (no registrations yet in this task's tests).
- Visibility: DRAFT 404 for others; public list/detail; `/mine`.
- Gate `TOURNAMENT_ENABLED`.

**Acceptance**
- Another Player cannot edit/transition (403); stale version → 409; invalid transition → 409; locked field → 409.
- DRAFT invisible to visitors and other Players.

**Verification:** `tournament-core.test.ts`.

## TRN-03 — Singles registration, eligibility, wallet fees, withdraw/remove/refund

**Objective:** PRD FR-10…14 for Singles.

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

**Scope**
- Start (first start → `IN_PROGRESS`; writes `match_players`), result by sets (best of 3, 21 points, strict rule — Tech Design §7.5), walkover (no-show/retirement), cancel (`NONE`), correction while the next match is `SCHEDULED`, advancement; completing the tournament (enables TRN-02 complete check).

**Acceptance**
- Set-score table tests (21–19 ✗, 21–20 ✗, 22–20 ✓, 30–29 ✓, 30–28 ✓, 31–29 ✗; third set only at 1–1) → 400 with `setNo`; result on a non-playable match → 409; correction after the next match started → 409.
- A full 8-player tournament played through the API ends with one champion and the Organizer earning credited.

**Verification:** `score.test.ts`, `tournament-matches.test.ts`.

## TRN-07 — Frontend: list, detail, registration, bracket and schedule views

**Objective:** PRD §9 Player/visitor screens.

**Scope:** `/tournaments`, `/tournaments/:id` (tabs), register/withdraw dialog with wallet balance and top-up link, bracket view, schedule view (by time / by court), "my next match", `/tournaments/mine`, Player nav entry. Design pass before coding (prototype per `docs/design/` convention).

**Acceptance:** UI contracts in mocked E2E; 390/1280 px without horizontal overflow; reduced motion; `check:ui`.

**Verification:** `tournament-ui.spec.ts` (mocked), `tsc -b`, lint, `check:ui`.

## TRN-08 — Frontend: Organizer console

**Objective:** PRD §6 Organizer journey in the UI.

**Scope:** create/edit form (incl. eligibility, fee, schedule settings), lifecycle actions, participant table with remove+reason, seed editor with suggestion + draw, schedule board (courts × time) with edit dialog and warning badges + re-run, match panel (start, games, walkover, cancel, correct), conclude.

**Acceptance:** mocked E2E for each console tab; one live E2E (dedicated test backend): create → open → 4 Players register (wallet seeded) → draw → play to final → complete; Organizer wallet credited.

**Verification:** `tournament-organizer-ui.spec.ts`, `tournament-live.spec.ts`.

## TRN-09 — Doubles teams, invitations, team registration

**Objective:** PRD FR-20…23.

**Scope:** API (Tech Design §3.2, §2.3, eligibility for both members, captain pays) incl. invitable-player search and the regenerable invite link; UI (create team, search + invite, copy link, join page, accept/decline/cancel, register team, withdraw by captain). Pending invitations cancelled when registration closes.

**Acceptance:** one team per Player per tournament; full team only; membership locks after registration; concurrent accepts/joins on one team → one succeeds; regenerated link invalidates the old one; search never returns ineligible/blocked/already-teamed Players or contact data.

**Verification:** `tournament-teams.test.ts`, mocked E2E for the team panel.

## TRN-10 — Jobs

**Objective:** Tech Design §10.

**Scope:** `jobs/tournament.job.ts` (every minute, advisory lock): auto-close at `registration_end` (same path as manual close, incl. `< 2` cancel + refunds); invitation expiry; match reminder 30 min before (once per `scheduled_at`); chat lock 30 days after completion.

**Acceptance:** job is idempotent and safe to run concurrently (two runners → one effect).

**Verification:** `tournament-jobs.test.ts`.

## TRN-11 — Notifications

**Objective:** PRD FR-62; Tech Design §11.

**Scope:** producer events after commit; resolver for `TOURNAMENT` with visibility; notification copy in Vietnamese.

**Verification:** `tournament-notifications.test.ts`; resolver test for hidden DRAFT.

## TRN-12 — Admin and release verification

**Scope:** `/admin/tournaments` list + cancel (with refunds); Admin dashboard/global search links to the new pages; full backend suite + E2E run; docs status to Ready/DONE.

**Verification:** `admin-tournaments.test.ts`, admin UI mocked E2E, full suites.

## TRN-15 — Realtime updates

**Objective:** PRD FR-63; Tech Design §7.9.

**Scope:** `tournament.watch`/`unwatch` client messages in `MessagingWsHub` (visibility check, max 5 per connection); `TournamentRealtime.publish` after commit from TRN-02/04/05/06 mutations; frontend `useTournamentLive` (invalidate queries; 30 s polling for visitors/no socket).

**Acceptance:** watcher receives `tournament.updated` within 1 s of a result; non-watchers receive nothing; DRAFT watch rejected for non-Organizers; page without socket still refreshes.

**Verification:** `tournament-realtime.test.ts`; mocked E2E with a fake socket.

## TRN-16 — Profile history, Social result post, group chat

**Objective:** PRD FR-70…72; Tech Design §7.6–§7.8.

**Scope**
- Placement function + `GET /players/:id/tournaments`; Profile "Giải đấu" section (own + public).
- `POST /:id/share` → `TOURNAMENT_RESULT` post; feed card; share dialog.
- `createSystemGroupConversationInTransaction` in Messaging (no generic cap, skip blocked/inactive); create at close, remove on Organizer removal, lock on cancel and 30 days after completion (job in TRN-10).

**Acceptance:** placements correct for sizes 2–16 incl. BYEs and walkovers; only Organizer/top 4 can share, once; chat contains exactly Organizer + participants minus blocked; locked chat rejects new messages.

**Verification:** `tournament-placement.test.ts`, `tournament-share.test.ts`, `tournament-chat.test.ts`, mocked E2E for profile section and feed card.

## TRN-13 — Casual tournaments (DEFERRED)

Participants without accounts (manual entry, Excel import), no rank, public summary hiding contact data (G0 D1b, 2026-11-15). Needs its own design for a participant table independent of `users`; `competition_type = 'CASUAL'` is reserved by TRN-01.

## TRN-14 — Rank promotion and achievements (DEFERRED, formula TBD)

Thesis algorithm 2 (`PROJECT-BRIEF.md` §7). Inputs available after this release: per-match results, rounds reached, opponents' levels (`match_players`, `tournament_matches`). Formula, thresholds, who confirms achievements, display on Profile/Social, automatic revert on result correction/cancellation: to be decided (G0 D1c).
