# Player Ratings (Đánh giá người chơi sau trận) — Task List

Implementation tasks for the Player Ratings feature.

- Feature: Player Ratings — post-Match player ratings (skill + attitude)
- Domain: `features/matchmaking/ratings`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 #1–#13)
- Business rules: `docs/business-rules-config-matrix.md` §6, §8.1, §8.4, §8.8
- Schema authority: `docs/architecture/database-schema.md` §2.6, §3.13, §3.14, §3.23, §3.30

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. The Tech Design has no remaining open questions. Scope is bounded by `prd.md` and `tech-design.md`.
>
> **Environment note (Auth dependency).** The Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware` and enforces `requireRole`; the `[TEMP AUTH BYPASS]` no longer applies in development/production. Signed-in `PLAYER` sessions are therefore available for E2E. In `NODE_ENV=test`, API tests may still supply an active `PLAYER` identity via the test-only `X-User-Id` header.
>
> **Schema/documentation note.** RT-01 must land the migration and the `database-schema.md` §2.6/§3.23 update together (Tech Design §10.4, §17, Decision Log §21 #3), so code, migration, and the consolidated schema stay in sync.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| RT-01 | Database migration, constraints, and Rating repository layer | Approved | — | M |
| RT-02 | Rating submission API — service, controller, and request validation | Approved | RT-01 | M |
| RT-03 | Rating query APIs — pending participants, summary, and paginated list | Approved | RT-01 | M |
| RT-04 | Frontend post-Match rating modal/component | Approved | RT-02, RT-03 | M |
| RT-05 | Frontend integration into Match Details / Match History | Approved | RT-04 | M |
| RT-06 | Automatic skill adjustment service, history, and config | Approved | RT-01, RT-02 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | RT-01 | — |
| 2 | RT-02, RT-03 | RT-01 |
| 2b | RT-06 | RT-01, RT-02 |
| 3 | RT-04 | RT-02, RT-03 |
| 4 | RT-05 | RT-04 |

---

## [ ] RT-01: Database migration, constraints, and Rating repository layer

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Apply the approved `PLAYER_RATINGS` schema delta (Tech Design §10) and provide the persistence primitives the Rating service needs, keeping all SQL and constraint handling inside the repository layer.

**Scope**

- In scope:
  - Modify the Drizzle table definition for `PLAYER_RATINGS`: rename `rating` → `skill_rating`, add `attitude_rating`, add CHECK constraints `chk_player_rating_skill_range`, `chk_player_rating_attitude_range`, `chk_player_rating_no_self`, and add indexes `player_ratings_match_rater_idx` and `player_ratings_rated_player_idx`.
  - Add migration `0007` that performs the column rename (not drop/add), adds the column, backfills, sets `NOT NULL`, adds the CHECK constraints and indexes, seeds `TOURNAMENT_RATING_ENABLED = 'true'` idempotently, and adds the `trg_player_ratings_immutable` trigger rejecting `UPDATE`/`DELETE`.
  - Update `docs/architecture/database-schema.md` §2.6 and §3.23 plus its Change Log in the same session as the migration.
  - Repository methods: read Match (including `status`), detect Tournament Match via `TOURNAMENT_MATCHES`, read `TOURNAMENT_RATING_ENABLED` from `SYSTEM_CONFIGS` (default `true`), read Match participant ids, insert ratings idempotently (`ON CONFLICT (rater_id, rated_player_id, match_id) DO NOTHING RETURNING`), compute pending participants (excluding the rater and already-rated), aggregate a user's summary (count, averages, per-value distributions), and a paginated list of ratings given/received.
  - Repository must expose no update/delete path for ratings.
- Out of scope:
  - Service/controller logic, HTTP concerns, and business rules (RT-02, RT-03).
  - Any frontend work (RT-04, RT-05).
  - Rating of Tournament Matches beyond reading the gate and `TOURNAMENT_MATCHES`.

**Implementation requirements**

1. Use Drizzle ORM (`backend/src/db`) with parameterized queries and explicit column selection; keep the transaction context explicit for callers.
2. Ensure the generated migration renames the existing column to preserve the `uq_player_rating`, the `USERS`/`MATCHES` FKs, and the composite participant FKs to `MATCH_PLAYERS(match_id, player_id)`.
3. Implement idempotent insert with `onConflictDoNothing` on `(rater_id, rated_player_id, match_id)` and return only created rows.
4. Aggregate summaries with a single grouped query; order paginated lists deterministically (`created_at DESC, id DESC`).
5. Return repository-level results; do not throw HTTP errors.
6. Confirm `docs/architecture/database-schema.md` is updated in the same session as the migration.

**Files/areas affected**

- `backend/src/db/schema/ratings.ts`
- `backend/src/db/migrations/0007_*.sql`
- `backend/src/db/migrations/meta/`
- `backend/src/repositories/ratings/RatingRepository.ts`
- `docs/architecture/database-schema.md`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** Replaces `PLAYER_RATINGS.rating` with `skill_rating` + `attitude_rating`; adds range/no-self CHECK constraints, the immutability trigger, and two indexes; seeds `TOURNAMENT_RATING_ENABLED`. Consolidated schema (§2.6, §3.23) is updated with the migration.

**Verification**

- Unit: N/A.
- Integration: Migration applies cleanly on a fresh and a populated database; the rename preserves existing rows and constraints; the trigger rejects `UPDATE` and `DELETE`; `ON CONFLICT DO NOTHING` yields exactly one row for a repeated insert.
- API-level: N/A.
- E2E for a critical flow: N/A.
- Edge/failure/concurrency: CHECK constraints reject out-of-range values and `rater_id = rated_player_id`; the composite FKs reject a rater or rated player who is not in `MATCH_PLAYERS`; concurrent identical inserts produce one row; repeated seed runs leave one config key.
- Manual: Read back the applied constraints/indexes/trigger and the seeded config key.

**Acceptance criteria**

- **Given** a fresh database
  **When** migration `0007` runs
  **Then** `PLAYER_RATINGS` has `skill_rating` and `attitude_rating` (both `NOT NULL`), the three CHECK constraints, the two new indexes, the immutability trigger, and a single `TOURNAMENT_RATING_ENABLED = 'true'` config row, with no data loss.

- **Given** an existing `PLAYER_RATINGS` row
  **When** the migration renames `rating` to `skill_rating`
  **Then** the row's value and the existing unique/FK constraints are preserved.

- **Given** a `PLAYER_RATINGS` row
  **When** any `UPDATE` or `DELETE` is attempted
  **Then** the `trg_player_ratings_immutable` trigger rejects the operation.

- **Given** a valid Match and participant
  **When** a rating is inserted twice for the same `(rater_id, rated_player_id, match_id)` with `ON CONFLICT DO NOTHING`
  **Then** exactly one row exists.

- **Given** an insert with `skill_rating = 6`, or with `rater_id = rated_player_id`, or with a player not in `MATCH_PLAYERS`
  **When** the insert is attempted
  **Then** the database rejects it via the matching CHECK/constraint.

---

## [ ] RT-02: Rating submission API — service, controller, and request validation

```text
Status: Approved
Size: M
Blocked by: RT-01
```

**Objective:** Implement `POST /api/v1/matches/:matchId/ratings` with Zod request validation and all PRD/Tech Design business rules, returning idempotent create results.

**Scope**

- In scope:
  - Zod schemas: `matchIdParamSchema` (positive integer) and `createRatingsBodySchema` (1–3 items; unique `ratedPlayerId` per request; `skillRating` and `attitudeRating` integers 1–5; optional trimmed `comment` max 500 characters).
  - `RatingService.createRatings(raterId, matchId, payload)`: Match existence, `COMPLETED` status, Tournament gate (`TOURNAMENT_RATING_ENABLED`), rater participation, per-target participation, self-rating rejection, idempotent insert, and `created`/`alreadyRated` derivation, inside one transaction.
  - `RatingController` + `matchRatingRoutes` + mount at `/api/v1/matches`.
  - Error mapping and codes per Tech Design §9.1.
- Out of scope:
  - Query endpoints `pending`, `summary`, and the paginated list (RT-03).
  - Frontend work (RT-04, RT-05).
  - Any rating edit/delete route (immutability).

**Implementation requirements**

1. Follow route → controller → service → repository layering and use the shared `authenticate` and `requireRole('PLAYER')` middleware plus CSRF for `POST`.
2. Validate params/body with Zod via the shared `validate` middleware; surface failures as `400 VALIDATION_FAILED`.
3. Enforce business rules in the service, not the controller; the rater is always `req.user.id`.
4. Use the RT-01 repository for Match, participant, config, and idempotent insert operations.
5. Return `201` when at least one row is created and `200` when all targets were already rated; never create a second row for the same `(rater, rated player, Match)`.
6. Map errors: `403 AUTH_FORBIDDEN_ROLE`, `403 RATING_NOT_PARTICIPANT`, `404 MATCH_NOT_FOUND`, `409 MATCH_NOT_COMPLETED`, `409 RATING_DISABLED`, `409 RATING_SELF_FORBIDDEN`, `409 RATING_TARGET_NOT_PARTICIPANT`.

**Files/areas affected**

- `backend/src/validation/ratings.ts`
- `backend/src/services/ratings/RatingService.ts`
- `backend/src/controllers/ratings/RatingController.ts`
- `backend/src/routes/ratings/matchRatingRoutes.ts`
- `backend/src/app.ts`
- `[Proposed — verify during implementation]`

**API impact:** Adds `POST /api/v1/matches/:matchId/ratings` (request/response and error codes per Tech Design §9.1).

**Schema/config impact:** None beyond RT-01; consumes `TOURNAMENT_RATING_ENABLED` and `PLAYER_RATINGS`.

**Verification**

- Unit: `COMPLETED` gating, tournament gate on/off, rater-participation, target-participation, self-rating, created-vs-already computation, and batch duplicate-target rejection.
- Integration: idempotent insert against the real constraint; participant composite FKs.
- API-level: each status/error code in Tech Design §9.1; Zod failure details; CSRF required; `requireRole('PLAYER')` denial for non-Players.
- E2E for a critical flow: a participant rates teammates and opponents after a Match completes (verification may use the middleware test identity header until Auth lands).
- Edge/failure/concurrency: two identical POSTs in parallel produce one row and an idempotent response; one invalid target rejects the entire batch atomically.
- Manual: N/A.

**Acceptance criteria**

- **Given** a `COMPLETED` Match and an authenticated participant
  **When** the participant submits valid skill+attitude ratings for other participants
  **Then** one `PLAYER_RATINGS` row per target is stored and the response is `201` with those rows in `data.created`.

- **Given** a `COMPLETED` Match and a rater who already rated a target
  **When** the rater resubmits that target
  **Then** no second row is created, the target appears in `data.alreadyRated`, and the response is `200` (or `201` if other new targets were created).

- **Given** a rater who includes their own `playerId`, a non-participant `playerId`, or a rating outside 1–5
  **When** the request is processed
  **Then** it is rejected with `409 RATING_SELF_FORBIDDEN`, `409 RATING_TARGET_NOT_PARTICIPANT`, or `400 VALIDATION_FAILED` respectively, and no rows are created.

- **Given** a Match that is not `COMPLETED`, or a Tournament Match with `TOURNAMENT_RATING_ENABLED = false`
  **When** a participant submits a rating
  **Then** it is rejected with `409 MATCH_NOT_COMPLETED` or `409 RATING_DISABLED`.

- **Given** an authenticated `ADMIN`
  **When** they call the submission endpoint
  **Then** it is rejected with `403 AUTH_FORBIDDEN_ROLE` (Admin is read-only for ratings).

- **Given** a non-participant authenticated as `PLAYER`
  **When** they submit a rating for the Match
  **Then** it is rejected with `403 RATING_NOT_PARTICIPANT`.

---

## [ ] RT-03: Rating query APIs — pending participants, summary, and paginated list

```text
Status: Approved
Size: M
Blocked by: RT-01
```

**Objective:** Implement the read endpoints: pending participants for a Match, an aggregate rating summary for a user, and the paginated list of ratings given/received for the rater and Admin oversight.

**Scope**

- In scope:
  - `GET /api/v1/matches/:matchId/ratings/pending` — `PLAYER` participant only; lists Match participants the rater has not yet rated, with `fullName` from `PLAYER_PROFILES`; same Match/status/gate/participation guards as submission.
  - `GET /api/v1/users/:userId/ratings/summary` — `requireRole('PLAYER','ADMIN')`; a `PLAYER` may query only their own id (`403 RATING_SUMMARY_FORBIDDEN` otherwise), Admin may query any; aggregate only (count, averages, per-value distributions; `null` averages when empty; no rater identity).
  - `GET /api/v1/users/:userId/ratings` — paginated (`direction` = `given` | `received`, `page`, `limit`), with `meta: { page, limit, total, totalPages }`; a `PLAYER` may read only their own id with `direction=given`, Admin may read any user and direction.
  - Zod schemas for params/query; service methods; controller methods; `matchRatingRoutes` (pending) and `userRatingRoutes` (summary/list); mount at `/api/v1/matches` and `/api/v1/users`.
- Out of scope:
  - Rating submission (RT-02).
  - Frontend work (RT-04, RT-05).
  - Exposing individual received ratings or rater identity to a `PLAYER`.

**Implementation requirements**

1. Reuse the RT-02 service guards for pending (Match exists, `COMPLETED`, tournament gate, rater participation).
2. Aggregate summaries in a single grouped query; return no individual rows and no rater identity.
3. Apply the standard offset pagination convention with `meta`; validate `page`/`limit`/`direction` with Zod.
4. Enforce the self-only/Admin contextual rules in the service layer.
5. Map errors consistently: `400 VALIDATION_FAILED`, `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `403 RATING_NOT_PARTICIPANT`, `403 RATING_SUMMARY_FORBIDDEN`, `404 MATCH_NOT_FOUND`, `404 USER_NOT_FOUND`, `409 MATCH_NOT_COMPLETED`, `409 RATING_DISABLED`.

**Files/areas affected**

- `backend/src/validation/ratings.ts`
- `backend/src/services/ratings/RatingService.ts`
- `backend/src/controllers/ratings/RatingController.ts`
- `backend/src/routes/ratings/matchRatingRoutes.ts`
- `backend/src/routes/ratings/userRatingRoutes.ts`
- `backend/src/app.ts`
- `[Proposed — verify during implementation]`

**API impact:** Adds `GET /api/v1/matches/:matchId/ratings/pending`, `GET /api/v1/users/:userId/ratings/summary`, and `GET /api/v1/users/:userId/ratings` per Tech Design §9.2–§9.4.

**Schema/config impact:** None beyond RT-01; uses `player_ratings_rated_player_idx` and `player_ratings_match_rater_idx`.

**Verification**

- Unit: pending filtering (exclude self and already-rated); summary math including empty-set `null` averages; pagination mapping; self-only/Admin contextual rules.
- Integration: aggregate query correctness against stored rows; pagination totals.
- API-level: status/error codes; `meta` shape; `PLAYER` denial for another user's summary and for `direction=received`.
- E2E for a critical flow: after submitting ratings, the pending list shrinks and the summary reflects the new rows (may use the test identity header until Auth lands).
- Edge/failure/concurrency: non-participant pending call returns `403`; Match not `COMPLETED` returns `409`; zero-rating summary returns `null` averages and zeroed distributions.
- Manual: N/A.

**Acceptance criteria**

- **Given** an authenticated participant of a ratable Match
  **When** they call the pending endpoint
  **Then** the response lists exactly the other participants they have not yet rated, and excludes themselves and already-rated participants.

- **Given** a Player with stored received ratings
  **When** they request their own summary
  **Then** the response contains only aggregate counts, rounded averages, and distributions, with no rater identity or individual rows.

- **Given** a `PLAYER`
  **When** they request another user's summary, or request `direction=received`
  **Then** the request is rejected with `403 RATING_SUMMARY_FORBIDDEN`.

- **Given** an `ADMIN`
  **When** they request any user's summary or the paginated list in either direction
  **Then** the request succeeds.

- **Given** a client requesting `page=1&limit=20`
  **When** the list endpoint responds
  **Then** it returns at most 20 rows and `meta: { page, limit, total, totalPages }`.

- **Given** a user with no ratings
  **When** their summary is requested
  **Then** `totalRatings` is `0`, averages are `null`, and all distribution counts are `0`.

---

## [ ] RT-04: Frontend post-Match rating modal/component

```text
Status: Approved
Size: M
Blocked by: RT-02, RT-03
```

**Objective:** Build the frontend rating UI: a modal/component allowing a Player to rate fellow Match participants on skill and attitude, add an optional comment, and submit.

**Scope**

- In scope:
  - Feature API client for the Rating endpoints (transport separated from UI components).
  - Feature hook(s) to load pending participants and submit ratings.
   - Rating modal/component with per-participant integer skill and attitude inputs (1–5 star/score, no decimals), optional comment (max 500 characters, with counter), submit action, and loading/success/error/already-rated states.
  - Display of the aggregate summary (where the flow needs it) without exposing individual received ratings.
- Out of scope:
  - Integrating the modal into a specific page/route (RT-05).
  - Backend changes.
  - Editing/deleting ratings (immutability).

**Implementation requirements**

1. Keep API transport and hooks out of presentational components; define explicit props for the modal.
2. Render `loading`, `success`, `error`, `empty` (nothing to rate), and `already-rated` states; never show an empty state while loading.
3. Use an integer 1–5 control for both skill and attitude, required together; enforce the 500-character comment limit in the UI.
4. Surface backend error codes with clear messages (self-rating, target not a participant, not a participant, Match not completed, rating disabled, already rated).
5. Follow the global shared-UI conventions; do not reimplement shared table/filter components.

**Files/areas affected**

- `frontend/src/features/ratings/` `[Proposed — verify during implementation]`
- `frontend/src/features/ratings/services/` `[Proposed — verify during implementation]`
- `frontend/src/features/ratings/components/` `[Proposed — verify during implementation]`
- `frontend/src/features/ratings/hooks/` `[Proposed — verify during implementation]`
- `frontend/src/features/ratings/types/` `[Proposed — verify during implementation]`

**API impact:** Consumes `POST /api/v1/matches/:matchId/ratings` and `GET /api/v1/matches/:matchId/ratings/pending` (and, where shown, the summary endpoint).

**Schema/config impact:** None.

**Verification**

- Unit: input validation behavior (both dimensions required, comment limit), state rendering for loading/empty/error/success/already-rated.
- Integration: API client maps request/response and error codes correctly.
- API-level: N/A (client-side).
- E2E for a critical flow: N/A at this task (covered by RT-05).
- Edge/failure/concurrency: double-submit is guarded in the UI and remains idempotent server-side; already-rated participants are disabled or hidden.
- Manual: Visual check of the modal states and error messages.

**Acceptance criteria**

- **Given** a Player with pending participants
  **When** the rating modal opens
  **Then** it shows each pending participant with required skill and attitude inputs and an optional comment field.

- **Given** a valid form
  **When** the Player submits
  **Then** the client sends the documented request, shows a success state, and removes/refreshes the rated participants.

- **Given** a missing dimension or a comment longer than 500 characters
  **When** the Player attempts to submit
  **Then** the UI blocks submission and shows a field-level message.

- **Given** the API returns `409 RATING_SELF_FORBIDDEN`, `409 RATING_DISABLED`, `403 RATING_NOT_PARTICIPANT`, `409 RATING_TARGET_NOT_PARTICIPANT`, or `409 MATCH_NOT_COMPLETED`
  **When** the response is received
  **Then** the modal shows a clear, accurate error message and does not report success.

- **Given** a participant already rated in this Match
  **When** the modal renders
  **Then** that participant is shown as already rated and cannot be submitted again.

---

## [ ] RT-05: Frontend integration into Match Details / Match History

```text
Status: Approved
Size: M
Blocked by: RT-04
```

**Objective:** Integrate the rating modal into the Match Details / Match History experience so a Player can start rating from a completed Match and see the outcome.

**Scope**

- In scope:
  - Add a rating entry point on completed Matches (casual and Tournament, gated by `TOURNAMENT_RATING_ENABLED` as reflected by the API) in Match Details / Match History.
  - Open the RT-04 modal, pass the Match context, and refresh pending state after submission.
  - Show a "rated"/"nothing pending" state appropriately; surface the aggregate summary where the page already presents player info.
  - Handle unauthenticated/unauthorized and API error states at the feature boundary.
- Out of scope:
  - New endpoints or backend changes.
  - Non-Match entry points, court/facility rating, or rating notifications.
  - Editing/deleting ratings.

**Implementation requirements**

1. Gate the entry point by Match status `COMPLETED` and by the pending API result; do not infer availability only from hidden controls.
2. Keep route/page composition at the application boundary; feature code stays in the ratings feature area.
3. Refresh pending participants after a successful submit and reflect "all rated" when the pending list is empty.
4. Preserve existing Match Details / History behavior when rating is unavailable.
5. Follow existing loading/empty/error patterns and do not duplicate server truth in client state without a refresh strategy.

**Files/areas affected**

- Match Details / Match History page(s) under `frontend/src/features/ratings/pages/` `[Proposed — verify during implementation]`
- `frontend/src/features/ratings/` `[Proposed — verify during implementation]`
- `frontend/src/app/router.tsx` (route registration, only if a new route is required) `[Proposed — verify during implementation]`

**API impact:** Consumes the Rating endpoints from RT-02/RT-03; no new contract.

**Schema/config impact:** None.

**Verification**

- Unit: entry-point visibility logic for completed vs non-completed Matches.
- Integration: page loads pending state and opens the modal with the correct Match context.
- API-level: N/A.
- E2E for a critical flow: a Player opens a completed Match, rates participants, and sees the pending list clear / summary update (verification may use the test identity header until Auth lands).
- Edge/failure/concurrency: unavailable rating hides/disables the entry point with an explanation; a submit error keeps the modal open with the error.
- Manual: Walk a completed Match from History and Details on both `SINGLES` and `DOUBLES`.

**Acceptance criteria**

- **Given** a `COMPLETED` Match with pending participants
  **When** the Player views Match Details or Match History
  **Then** a rating entry point is available and opens the RT-04 modal for that Match.

- **Given** the Player submits ratings for all pending participants
  **When** the submission succeeds
  **Then** the pending list is refreshed and no further rating entry is offered for that Match.

- **Given** a Match that is not `COMPLETED`, or a Tournament Match with rating disabled
  **When** the Player views the Match
  **Then** no rating action is offered and the page behaves as before.

- **Given** an API error while loading or submitting
  **When** the page or modal receives it
  **Then** a clear error state is shown and existing page functionality remains intact.

- **Given** the Player is not a participant of the Match
  **When** the Match is viewed
  **Then** rating is not available.

---

## [ ] RT-06: Automatic skill adjustment service, history, and config

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Apply the approved automatic skill adjustment from received skill ratings (Tech Design §7.7, §10.2 items 10–12) and record each change as history.

**Scope**

- In scope:
  - Add `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30) and its index via the RT-01 migration (`0007`).
  - Seed `PLAYER_SKILL_ADJUSTMENT_ENABLED`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`, `PLAYER_SKILL_ADJUSTMENT_THRESHOLD`, `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` (`docs/business-rules-config-matrix.md` §8.8).
  - `SkillAdjustmentService` implementing the bounded rule, and `SkillAdjustmentRepository` for history/cooldown queries.
  - Trigger the evaluation after skill ratings are inserted.
- Out of scope:
  - ELO/MMR, attitude-driven adjustment, tournament seeding changes, and manual level editing (separate Admin capability).

**Implementation requirements**

1. Read the four `PLAYER_SKILL_ADJUSTMENT_*` config values with the §8.8 defaults.
2. Compute the sliding-window skill average and map it to a target level per `docs/business-rules-config-matrix.md` §6.
3. Apply the cooldown and threshold; move exactly one level toward the target.
4. Update `PLAYER_PROFILES.skill_level_id` and insert the history row in one transaction with a profile row lock.
5. Be idempotent for a repeated rating batch.

**Files/areas affected**

- `backend/src/services/ratings/SkillAdjustmentService.ts` `[Proposed — verify during implementation]`
- `backend/src/repositories/ratings/SkillAdjustmentRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/db/schema/ratings.ts`, migration `0007`

**API impact:** None (internal; reflected through the Player profile skill level).

**Schema/config impact:** `PLAYER_SKILL_ADJUSTMENTS` table and the four config keys.

**Verification**

- Unit: mapping bands, threshold, cooldown, window, enabled gate.
- Integration: adjustment writes exactly one history row and updates the profile atomically; no adjustment before the minimum count.

**Acceptance criteria**

- **Given** a Player with at least the minimum recent skill ratings whose average maps at least one level away from the current level and no recent adjustment
  **When** a new skill rating is recorded
  **Then** the Player moves exactly one level toward the target and one history row is appended.
- **Given** `PLAYER_SKILL_ADJUSTMENT_ENABLED = false`
  **When** skill ratings are recorded
  **Then** no level change and no history row is produced.
