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
| TRN-14 | Skill rating and level adjustment (up/down) from professional tournaments | Approved | TRN-06 | L |
| TRN-18 | Achievement ranking points and Singles/Doubles leaderboards | Approved | TRN-06, TRN-16 | M |
| TRN-17 | Tournament fees in Admin Finance and Dashboard | Approved | TRN-03 | M |

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

- **Cadence:** work through all tasks of a wave without waiting; **stop after each wave** with a report and wait for the project owner's approval. Stop immediately and ask on any problem, undecided point, behaviour change or scope change.
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
- Disable tournament-match ratings in `RatingService` (PRD Decision #14; follow-up from TRN-01).
- Start (first start → `IN_PROGRESS`; writes `match_players`), result by sets (best of 3, 21 points, strict rule — Tech Design §7.5), retirement (`RETIRED`, partial sets), walkover (no-show), cancel (`NONE`), correction while the next match is `CONFIRMED` (not started), final correction until completion and 48 h correction window after completion, advancement; `match_players` written when a match becomes playable; completing the tournament (enables TRN-02 complete check).

**Acceptance**
- Set-score table tests (21–19 ✓, 21–20 ✗, 22–20 ✓, 23–20 ✗, 30–29 ✓, 30–28 ✓, 31–29 ✗; third set only at 1–1) → 400 with `setNo`; result on a non-playable match → 409; correction after the next match started → 409; correction > 48 h after completion → 409.
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

**Scope:** API (Tech Design §3.2, §2.3, eligibility for both members, captain pays) incl. invitable-player search and the regenerable invite link; UI (create team, search + invite, copy link, join page, accept/decline/cancel, register team, withdraw by captain). Pending invitations cancelled when registration closes. Team lifecycle rules of Tech Design §4.2 (one pending invitation, leave/remove member while forming, captain leaving disbands, withdrawn/removed team disbanded).

**Acceptance:** one team per Player per tournament (DB unique, incl. concurrent accepts on different teams); full team only; membership locks after registration; concurrent accepts/joins on one team → one succeeds; regenerated link invalidates the old one; search never returns ineligible/blocked/already-teamed Players or contact data.

**Verification:** `tournament-teams.test.ts`, mocked E2E for the team panel.

## TRN-10 — Jobs

**Objective:** Tech Design §10.

**Scope:** `jobs/tournament.job.ts` (every minute, advisory lock) with: auto-close at `registration_end` (same path as manual close, incl. `< 2` cancel + refunds); invitation expiry; auto-complete / auto-cancel (Tech Design §2.1). Later tasks add their own steps to this job: match reminder (TRN-11), chat creation retry and chat lock (TRN-16), skill-rating replay (TRN-14).

**Acceptance:** job is idempotent and safe to run concurrently (two runners → one effect).

**Verification:** `tournament-jobs.test.ts`.

## TRN-11 — Notifications

**Objective:** PRD FR-62; Tech Design §11.

**Scope:** producer events after commit; resolver for `TOURNAMENT` with visibility; notification copy in Vietnamese; match reminder step in the tournament job (30 min before, once per `scheduled_at`).

**Verification:** `tournament-notifications.test.ts`; resolver test for hidden DRAFT.

## TRN-12 — Admin and release verification

**Scope:** `/admin/tournaments` list + cancel (with refunds); Admin dashboard/global search links to the new pages; full backend suite + E2E run; docs status to Ready/DONE.

**Verification:** `admin-tournaments.test.ts`, admin UI mocked E2E, full suites.

## TRN-15 — Realtime updates

**Objective:** PRD FR-63; Tech Design §7.9.

**Scope:** `tournament.watch`/`unwatch` client messages in `MessagingWsHub` (visibility check, max 5 per connection); `TournamentRealtime.publish` after commit from TRN-02/04/05/06 mutations; frontend `useTournamentLive` (invalidate queries; 30 s polling whenever there is no socket — visitors, Admin, Court Owner, Messaging disabled).

**Acceptance:** watcher receives `tournament.updated` within 1 s of a result; non-watchers receive nothing; DRAFT watch rejected for non-Organizers; page without socket still refreshes.

**Verification:** `tournament-realtime.test.ts`; mocked E2E with a fake socket.

## TRN-16 — Profile history, Social result post, group chat

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

**Objective:** Thesis algorithm 2 (`PROJECT-BRIEF.md` §7, PRD Decision #26); model in [`docs/research/bao-cao-cong-thuc-nang-trinh.md`](../../research/bao-cao-cong-thuc-nang-trinh.md) §4; Tech Design §7.10. Final decision of the project owner (2026-11-25); parameters are config.

**Scope**
- Migration: `player_profiles.skill_rating`, `rated_match_count`; `skill_level_changes`; `skill_rating_events`; `SKILL_RATING_*` config keys; initial `R` backfill from survey scores (clamped to the assigned band).
- Pure `skillRating.ts` (expected score, update, hysteresis, replay) and `SkillRatingService` (review at completion, replay after correction, Admin recalculate).
- Seed suggestion tie-break by `R`; `GET /players/me/skill-rating` (owner only — `R` never in public reads, PRD Decision #28); own Profile shows `R`, progress to the next band, rating/level history; level-change notification.

**Acceptance:** worked examples of the research report §5 reproduce exactly; replay is deterministic and idempotent; walkovers ignored, retirements counted; `R` clamped to [0, 100]; hysteresis prevents a change for a single loss near a boundary; a correction within 48 h that flips a level writes a `RECALCULATION` change.

**Verification:** `skillRating.test.ts`, `skill-rating-service.test.ts`, tournament end-to-end test with level change.

## TRN-18 — Achievement ranking points and leaderboards

**Objective:** PRD FR-82…83, Decision #27; Tech Design §7.11.

**Scope:** `tournament_ranking_points` (migration), write at completion/correction, config `TOURNAMENT_RANKING_BEST_N` / `TOURNAMENT_RANKING_WINDOW_MONTHS`, `GET /tournament-rankings`, ranking points in `GET /players/:id/tournaments`; UI: leaderboard page (Singles/Doubles tabs, level filter), ranking card on Profile.

**Acceptance:** points formula reproduces hand examples; best-4-in-12-months window and tie-break; correction rewrites the row; Doubles members both credited.

**Verification:** `tournament-ranking.test.ts`, mocked E2E for the leaderboard page.

## TRN-17 — Tournament fees in Admin Finance and Dashboard

**Objective:** Tech Design §5.1.

**Scope:** revenue split booking / tournament fees (gross and net of refunds), dashboard revenue on the same net definition, reconciliation over registration payments and `payment_refunds`, `TOURNAMENT_EARNING` reported next to `OWNER_EARNING`, fees held for open tournaments as liability.

**Verification:** finance report and reconciliation tests with tournament payments, refunds and earnings; dashboard KPI test.
