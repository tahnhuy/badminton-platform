# Player Ratings (Đánh giá người chơi sau trận) — Task List

## Công việc phát sinh — 2026-11-08

Các trạng thái DONE cũ chỉ mô tả phạm vi legacy, không chứng minh hoàn thành yêu cầu mới. Xem PRD và Tech Design cập nhật ngày 2026-11-08.

Quyết định nghiệp vụ mới: **không dùng rating để nâng trình; chỉ việc tham gia giải chuyên nghiệp mới là cơ sở nâng trình**. Trận giao lưu, kèo đơn/đôi thông thường và giải phong trào không nâng trình. Khảo sát ban đầu vẫn là tự đánh giá ban đầu, không phải nâng trình hay chứng nhận.

Các quy tắc tự hiệu chỉnh từ điểm rating, cửa sổ trận, ngưỡng điểm và cooldown trong tài liệu cũ được thay thế. Điều kiện tham gia hợp lệ, xác nhận kết quả/thành tích, công thức/ngưỡng nâng trình và xử lý sửa/hủy kết quả: **TBD**; không mặc định cứ đăng ký/tham gia một giải là tăng một bậc. Giữ đánh giá kỹ năng và thái độ sau trận để tham khảo/hiển thị; cả hai loại điểm đều không được dùng để nâng trình.

Cần chốt TBD, cập nhật thiết kế API/schema, lập các task triển khai và kiểm thử trước khi thay thế code hiện hành. Không đánh dấu các việc này DONE.

---

Implementation tasks for the Player Ratings feature.

- Feature: Player Ratings — post-Match player ratings (skill + attitude)
- Domain: `features/matchmaking/ratings`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 and §23 (human-approved 2026-10-15))
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
| RT-01 | Database migration, constraints, and Rating repository layer | DONE | — | M |
| RT-02 | Rating submission API — service, controller, and request validation | DONE | RT-01 | M |
| RT-03 | Rating query APIs — pending participants, summary, and paginated list | DONE | RT-01 | M |
| RT-04 | Frontend post-Match rating modal/component | DONE | RT-02, RT-03 | M |
| RT-05 | Casual and Tournament host integration | BLOCKED | RT-04, real Tournament participant detail host | M |
| RT-06 | Automatic skill adjustment service, history, and config | DONE | RT-01; co-deliver with RT-02 | M |
| RT-07 | Player ratings-given history | DONE | RT-03, RT-04 | M |
| RT-08 | Admin rating oversight and skill-adjustment history API/UI | DONE | RT-03, RT-06 | M |
| RT-12 | Received-rating notification and Profile aggregate (2026-11-23) | DONE | RT-02, RT-03, NTF-02 | M |

> **Implementation status — 2026-10-15 (RT-01–RT-08).** Migration `0008_ratings_two_dimensions` applied to the local development database and the separate test database (through the test harness). Backend: two-dimension ratings, append-only adjustment history, shared typed config reader, submission (with in-transaction skill adjustment), pending/summary/list, and Admin adjustment-history endpoints; initially verified by 20 Vitest/Supertest tests; the review below supersedes the initial test evidence. Frontend: reusable modal/hooks/client in `features/ratings/`, casual Match Detail/History hosts, Player given-history at `/ratings/given`, and read-only Admin User Detail panels; initially verified by 4 mocked Playwright tests; the review below adds real-session/database E2E and expanded regression coverage.
>
> **RT-05 status — BLOCKED (Tournament host only).** The casual host integration is complete and verified. A real participant-facing Tournament Match Detail does not exist in the repository (`frontend/src/features/tournament/` is absent; the Player "Giải đấu" route is a placeholder), so the Tournament side of RT-05 cannot be integrated or verified. RT-05 remains BLOCKED on that external dependency; full Ratings completion must not be claimed until it lands. No Matchmaking endpoint was widened to serve Tournament Matches.

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | RT-01 | — |
| 2 | RT-02 + RT-06 (atomic submission flow), RT-03 | RT-01 |
| 3 | RT-04, RT-08 | RT-02/03/06 as applicable |
| 4 | RT-05, RT-07 | RT-04; Tournament host required for RT-05 completion |

---

## [x] RT-01: Database migration, constraints, and Rating repository layer

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Approved review requirements (2026-10-15):** Migration number is next unused (currently `0008`; `0007` belongs to Matchmaking). Include the adjustment table/index and append-only enforcement for its UPDATE/DELETE in the same migration. Seed all five config keys idempotently. Implement/integrate the shared typed config reader/registry for these keys with the confirmed ranges; no direct config reads in Rating repositories. Consolidated schema is already the approved target; reconcile implementation status rather than claiming migration has run. Verify missing/invalid config fallback, logging, cache invalidation/TTL and both tables' immutability. If legacy rows exist, inspect range/self/participant validity before adding constraints and fail/report invalid data rather than silently deleting it. Preserve the approved attitude backfill policy from Tech Design §10.5.

**Objective:** Apply the approved `PLAYER_RATINGS` schema delta (Tech Design §10) and provide the persistence primitives the Rating service needs, keeping all SQL and constraint handling inside the repository layer.

**Scope**

- In scope:
  - Modify the Drizzle table definition for `PLAYER_RATINGS`: rename `rating` → `skill_rating`, add `attitude_rating`, add CHECK constraints `chk_player_rating_skill_range`, `chk_player_rating_attitude_range`, `chk_player_rating_no_self`, and add indexes `player_ratings_match_rater_idx` and `player_ratings_rated_player_idx`.
  - Add migration `0008` that performs the column rename (not drop/add), adds the column, backfills, sets `NOT NULL`, adds the CHECK constraints and indexes, seeds `TOURNAMENT_RATING_ENABLED = 'true'` idempotently, and adds the `trg_player_ratings_immutable` trigger rejecting `UPDATE`/`DELETE`.
  - Update `docs/architecture/database-schema.md` §2.6 and §3.23 plus its Change Log in the same session as the migration.
  - Repository methods: read Match (including `status`), detect Tournament Match via `TOURNAMENT_MATCHES`, read Match participant ids, insert ratings idempotently (`ON CONFLICT (rater_id, rated_player_id, match_id) DO NOTHING RETURNING`), compute pending participants (excluding the rater and already-rated), aggregate a user's summary (count, averages, per-value distributions), and a paginated list of ratings given/received.
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
- `backend/src/db/migrations/0008_*.sql`
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
  **When** migration `0008` runs
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

## [x] RT-02: Rating submission API — service, controller, and request validation

```text
Status: DONE
Size: M
Blocked by: RT-01
```

**Approved review requirements (2026-10-15):** Require Tournament `WINNER_DECLARED` in addition to completion and gate; otherwise `409 RATING_MATCH_NOT_PLAYED`. Acquire target profile locks in ascending ID order, insert and invoke RT-06 in the same transaction; only newly created target IDs trigger evaluation. Verify whole-batch rollback on adjustment failure and concurrent crossed target orders. Duplicate replay (even with different scores, after cooldown, or cooldown=0) is successful and never mutates stored values or triggers adjustment.

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
4. Use the RT-01 repository for Match, participant and idempotent insert operations; configuration comes exclusively from shared typed readers (§7.5). Integrate RT-06 in this same transaction before treating RT-02 as complete.
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
- E2E for a critical flow: a participant rates teammates and opponents after a Match completes (use real signed-in sessions for browser E2E; the test-only identity header is for API tests).
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

## [x] RT-03: Rating query APIs — pending participants, summary, and paginated list

```text
Status: DONE
Size: M
Blocked by: RT-01
```

**Approved review requirements (2026-10-15):** Pending response includes caller-only `ratedPlayers` with names and stored read-only rating data, partitioning the other participants with `pendingPlayers`. Both GET view and POST use the Tournament played-result guard. Summary is viewer-aware, including active target and three-rating suppression for other-Player access (§9.3). List response in both directions includes explicit rater/target IDs and full names (§9.4). Never leak received rows to Players. Profile must reuse the same aggregate logic/policy; cover a direct API call as well as profile composition where implemented.

**Objective:** Implement the read endpoints: pending participants for a Match, an aggregate rating summary for a user, and the paginated list of ratings given/received for the rater and Admin oversight.

**Scope**

- In scope:
  - `GET /api/v1/matches/:matchId/ratings/pending` — `PLAYER` participant only; lists Match participants the rater has not yet rated, with `fullName` from `PLAYER_PROFILES`; same Match/status/gate/participation guards as submission.
  - `GET /api/v1/users/:userId/ratings/summary` — `requireRole('PLAYER','ADMIN')`; a `PLAYER` may query self or another active Player; apply the backend three-rating suppression for other-Player views per Tech Design §9.3. Admin may query any Player, including inactive targets; aggregate only, no rater identity.
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
4. Enforce viewer-aware summary rules (§9.3), own-given-only list access (§9.4), and Admin oversight in the service layer.
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

- Unit: pending filtering (exclude self and already-rated); summary math including empty-set `null` averages; pagination mapping; other-active-Player threshold masking, self/Admin full aggregates and own-given-only list access.
- Integration: aggregate query correctness against stored rows; pagination totals.
- API-level: status/error codes; `meta` shape; other-active-Player aggregate access, masked values/distributions below 3, inactive-target 404, and `PLAYER` denial for `direction=received` or another user's list.
- E2E for a critical flow: after submitting ratings, the pending list shrinks and the summary reflects the new rows (use real signed-in sessions for browser E2E).
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
  **When** they request another active Player's summary
  **Then** the request succeeds; below 3 ratings only count/notEnoughData are usable (averages and distributions are null), while at least 3 exposes full aggregates. Inactive targets return `404 USER_NOT_FOUND`. Requesting `direction=received` or another user's list still returns `403 RATING_SUMMARY_FORBIDDEN`.

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

## [x] RT-04: Frontend post-Match rating modal/component

```text
Status: DONE
Size: M
Blocked by: RT-02, RT-03
```

**Approved review requirements (2026-10-15):** Render `ratedPlayers` read-only beside pending inputs. Allow any selected non-empty subset (each selected target requires both dimensions); preserve unsubmitted drafts on recoverable errors. Duplicate acknowledgements are success, followed by refresh of persisted state. Modal follows shared focus trap/Escape/accessibility behavior and Vietnamese error mapping; no new dependency.

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
4. Surface backend errors with clear messages, including `RATING_MATCH_NOT_PLAYED`. Treat `200/201` with `alreadyRated` as success, show “Đánh giá đã được ghi nhận”, and reload the caller’s stored values; never show a duplicate error.
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
- Edge/failure/concurrency: double-submit is guarded in the UI and remains idempotent server-side; already-rated participants remain visible with read-only stored dimensions/comment from `ratedPlayers`.
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
Status: BLOCKED
Size: M
Blocked by: RT-04; real Tournament participant Match Detail host for full integration
```

**Approved review requirements (2026-10-15):** Reuse the component in existing casual hosts and the separate Tournament participant Match Detail. Never broaden casual-only Matchmaking endpoints. Hide submission for walkover/unresolved/no-result and map `RATING_MATCH_NOT_PLAYED`. Retain a read-only viewing entry after all ratings are submitted. Tournament host is an explicit external dependency: if unavailable, finish casual integration and mark this task BLOCKED with the missing host, without claiming full feature completion or implementing the entire Tournament domain. Verify real domain integrations for both Singles/Doubles before DONE.

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

- Casual host pages under `frontend/src/features/matchmaking/pages/` and Tournament Match Detail under `frontend/src/features/tournament/` `[Proposed — verify during implementation]`
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
  **Then** the pending list is refreshed and no further submission is offered; a read-only “Xem đánh giá đã gửi” entry remains available.

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

## [x] RT-06: Automatic skill adjustment service, history, and config

```text
Status: DONE
Size: M
Blocked by: RT-01, RT-02 (implement RT-02/RT-06 together before submission API completion)
```

**Approved review requirements (2026-10-15):** Follow Tech Design §7.7 exactly: caller-owned transaction, ascending profile locks before reads/insert, created targets only, `created_at DESC, id DESC` window, unrounded continuous mapping, cooldown under lock, exactly one step/history row per eligible target. Test no timer/config-triggered adjustment, overlapping windows, boundary averages, exact cooldown boundary, zero cooldown, disabled gate, duplicate replay after cooldown, concurrent new submissions and full rollback. RT-02 cannot be completed before this integration passes.

**Objective:** Apply the approved automatic skill adjustment from received skill ratings (Tech Design §7.7, §10.2 items 10–12) and record each change as history.

**Scope**

- In scope:
  - Add `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30) and its index via the RT-01 migration (`0008`).
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
- `backend/src/db/schema/ratings.ts`, migration `0008`

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

## [x] RT-07: Player ratings-given history

```text
Status: DONE
Size: M
Blocked by: RT-03, RT-04
```

**Objective:** Deliver the approved Player view of their own immutable submitted ratings.

**Scope:** Register `/ratings/given` inside the existing Player layout and add a navigation entry. Reuse the Ratings client and shared pagination. Show target, Match context/ID, skill, attitude, comment and submitted time. Link to the correct casual/Tournament host when available; otherwise render Match ID as text. No received individual rows, editing, deletion or new aggregate calculation.

**Implementation requirements:** Follow Tech Design §9.4 and §23 as applicable, existing authentication/authorization, route → controller → service → repository layering, safe text rendering and global shared UI. Keep transport separate from presentation.

**Files/areas affected:** `frontend/src/features/ratings/pages/`, ratings services/types/hooks, Player navigation and `frontend/src/app/router.tsx`.

**API impact / Schema/config impact:** Consumes `GET /api/v1/users/:userId/ratings?direction=given&page=...&limit=...`. No schema/config changes.

**Verification:** Component/integration tests for loading/error/empty/populated states, pagination, safe comment rendering and domain-safe links; signed-in browser E2E from a submitted rating to history.

**Acceptance criteria:** A Player can open their own given-history, page through immutable ratings and see newly submitted rows after refresh; no other-user or received-detail access is offered.

## [x] RT-08: Admin rating oversight and automatic skill-adjustment history

```text
Status: DONE
Size: M
Blocked by: RT-03, RT-06
```

**Objective:** Complete read-only oversight inside the existing Admin User Detail for Player targets.

**Scope:** Implement adjustment-history repository/service/controller/validation and the Admin-only endpoint (§23.2). Add Ratings given/received and Skill Adjustments sections to existing Admin User Detail using shared table/pagination. Display both identities for rating oversight and previous/new level, average, count, source and timestamp for adjustments. Preserve inactive Player oversight. No manual level edit, moderation, deletion or automatic penalties.

**Implementation requirements:** Follow Tech Design §9.4 and §23 as applicable, existing authentication/authorization, route → controller → service → repository layering, safe text rendering and global shared UI. Keep transport separate from presentation.

**Files/areas affected:** Backend ratings layers and user routes; `frontend/src/features/admin/` User Detail integration; reusable ratings transport/types/components in `frontend/src/features/ratings/`.

**API impact / Schema/config impact:** Adds `GET /api/v1/users/:userId/skill-adjustments` with Admin auth and standard pagination. Consumes rating list/summary. No schema/config beyond RT-01.

**Verification:** API auth/role/target validation, empty and paginated deterministic history; Player/Court Owner denied; UI loading/error/empty/data and pagination tests; Admin browser E2E inspecting immutable ratings and adjustment history, including an inactive Player.

**Acceptance criteria:** Admin can inspect Player given/received ratings and automatic adjustments through the existing detail view. Non-Admin endpoint calls are denied and no mutation action exists.


## [x] RT-12: Received-rating notification and Profile aggregate (2026-11-23)

```text
Status: DONE
Size: M
Blocked by: RT-02, RT-03, NTF-02
```

**Objective:** Complete the requested received-rating flow: notify the rated Player and show the aggregate ratings from other Players on their profile.

**Scope:** Add the `RATING_RECEIVED` notification producer in the rating transaction (recipient = rated Player, resource `PROFILE`, dedup `rating-received:<ratingId>`), the self-only `/profile` resolver, and the production Profile `ProfileRatingsReader` wiring. No rating rule, score, eligibility, immutability or promotion behavior changes.

**Implementation requirements:** Insert the notification in the caller transaction after newly created rows; duplicate replays emit nothing. Lock `USERS` rows ascending before `PLAYER_PROFILES` to preserve the global lock order. The notification never includes the rater identity or scores. Profile composition reuses Ratings aggregates; averages remain hidden below three ratings.

**Files/areas affected:** `backend/src/services/ratings/{RatingService,rating-notifications,profile-ratings-reader}.ts`, `backend/src/repositories/ratings/RatingRepository.ts`, `backend/src/services/notifications/NotificationResourceResolver.ts`, `backend/src/app.ts`, `frontend/src/features/notifications/utils.ts`, match list display fields.

**API impact:** Adds no endpoint. `GET /players/me` and `GET /players/:id` now include the existing `ratings` object; the notification detail resolves `PROFILE` to `/profile` for its owner.

**Verification:** `ratings.test.ts` (90-test targeted run with Matchmaking/Profile/Notification suites) covers one notification per new rating, no replay notification, and no rater/comment leakage; `notification-resolvers.test.ts` covers self-only `/profile`; `player-profile.test.ts` covers the production reader; `matchmaking.test.ts` covers the list display fields. Backend and frontend builds pass.


## Implementation audit and fixes — 2026-10-15

The user explicitly requested completion ticks after reviewing/fixing the implementation. RT-01/02/03/04/06/07/08 are checked following the verification below. RT-05 remains unchecked and BLOCKED solely on the absent real Tournament participant Match Detail. The feature as a whole remains partially integrated; existing Ready statuses are not changed to Implemented.

### Fixes verified

- JSON body rating dimensions/target IDs require actual numbers; booleans, numeric strings and null cannot be coerced to valid ratings.
- Summary/list/adjustment-history targets must be Players, including when requested by Admin. Public masking and inactive-target handling remain viewer-aware.
- Ratings config definitions/defaults/ranges now have one shared registry/validated loader, with strict decimal integer parsing, WARN/ERROR fallback, TTL, invalidation protection against an in-flight stale load, and defensive facade results.
- Rating creation time uses actual insertion time (`clock_timestamp()`), rather than PostgreSQL transaction-start `now()`, so waiting for profile locks cannot backdate recent-window entries. Adjustment history uses the evaluation time used by the cooldown check. No existing migration or schema default was rewritten.
- Modal sessions are keyed by Match/open state, ignore superseded responses, guard double submission, preserve pending drafts on refresh and retain persisted read-only scores after duplicate success. Host queries clear stale results, expose retryable errors and label fully rated Matches as read-only views.
- Player history ignores stale requests. Admin panels remount on Player changes and compose the shared DataTable instead of duplicating tables; both rater/target identities are explicit.
- Tests reset Ratings config defaults between cases and use TRUNCATE for immutable test data. The E2E runner imports a test-env bootstrap before application dependencies and refuses any database other than `badminton_test`; cleanup and Ratings fixture have independent fail-closed checks.

### Verification evidence

| Tasks | Evidence |
| --- | --- |
| RT-01 | Actual migration executed in transaction-isolated empty and populated legacy schemas; row/backfill/FK/config preservation; live test constraints, both immutability triggers and duplicate-insert integrity. |
| RT-02 / RT-06 | API validation/guards, real session/CSRF, full-batch rollback after an earlier target changed skill, crossed multi-target concurrency, replay and cooldown, exact cooldown boundary, continuous unrounded bands, recent-window ordering, disabled/minimum/threshold/config cases. |
| RT-03 | Caller-only pending/rated partition, own-given restrictions, self/Admin full aggregate, public threshold masking for both dimensions/distributions, inactive/deleted/non-Player target rejection and pagination. |
| RT-04 / casual part of RT-05 | Browser validation, failed-submit draft retention, duplicate success, immutable/all-rated view, delayed-response reopen race, load failure/retry, plus real signed-in submit → persisted history → automatic adjustment. |
| RT-07 | Browser populated/error/retry/empty states, pagination, safe comment text, domain-safe Match IDs and persistence after reload with a real session. |
| RT-08 | Admin-only API access, non-Player rejection, immutable/paginated inactive Player history; browser panel pagination/error/empty states; actual Admin session inspects a suspended Player's ratings and automatic level adjustment. |

Commands run successfully:

- Backend: `npm test -- ratings.test.ts rating-adjustment.test.ts matchmaking.test.ts` — **66 tests passed, 3 files** (39 Ratings/adjustment tests plus 27 Matchmaking regressions).
- Frontend: `npm run test:e2e -- ratings.spec.ts ratings-real.spec.ts` — **12 passed**, including one actual session/API/database scenario without mocked routes.
- `npm run build` in backend and frontend — passed.
- Frontend `npm run lint` — passed with existing-style React effect warnings, including Ratings effects; no lint errors. Frontend build retains the large-bundle warning.
- `git diff --check` — passed.

Only the dedicated test database was used after the runner isolation fix. No new migration was applied to development in this review, and no commit/push/merge was performed. Shared-doc/schema changes still require the existing teammate PR review before merge.

### Test-runner incident

The initial browser review reused the pre-existing E2E runner before its environment-ordering problem was detected. Its reset endpoint ran against the development connection (`badminton_db`) instead of the intended test connection. A subsequent read-only inspection found 0 users and 0 matches in that database. There is no before-run snapshot in this review, so the prior row counts and any lost development data cannot be determined or restored here. Do not interpret the passing tests as confirmation that development data was preserved. The bootstrap and database-name guards described above prevent recurrence; no automatic reseed or attempted reconstruction was performed.

---

# Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

Governing design: [Tech Design §25](tech-design.md) (Ready). Order: Matchmaking
tasks "Social Matchmaking extension — cross-module execution order". RT-01…RT-08
keep their status.

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| RT-09 | Eligibility: ACTIVE participants only; GROUP Matches | BLOCKED | §25 Ready, MM-21 | S |
| RT-10 | Match-entry window, adjustment basis and `MIN_MATCHES` cutover | BLOCKED | RT-09, SC-12 | M |
| RT-11 | "Giao lưu" label in rating views | BLOCKED | RT-09 | S |

## [ ] RT-09: Eligibility — ACTIVE participants only; GROUP Matches

```text
Status: BLOCKED
Size: S
Blocked by: MM-21
```

**Objective:** Only valid participants who took part in the completed Match may rate or be rated: `MATCH_PLAYERS.status = 'ACTIVE'` when the Match is `COMPLETED`. A `LEFT` participant can neither rate nor be a rating target. Accept `GROUP` Matches (§25.1). This closes a gap in current code, which accepts any `MATCH_PLAYERS` row.

**Scope**

- In scope: `createRatings`, `getPendingPlayers`, participant queries.
- Out of scope: window logic (RT-10).

**Implementation requirements**

1. Filter participants by `ACTIVE` in both submission and pending views.

**Files/areas affected**

- `backend/src/services/ratings/RatingService.ts`, `backend/src/repositories/ratings/RatingRepository.ts`

**API impact:** Same endpoints; `LEFT` participants receive `RATING_NOT_PARTICIPANT`/`RATING_TARGET_NOT_PARTICIPANT`.

**Schema/config impact:** None.

**Verification**

- API: completed GROUP Match with a LEFT member: member cannot rate or be rated; all ACTIVE pairs can rate each other.

**Acceptance criteria**

- **Given** a LEFT participant **When** they submit a rating **Then** `403 RATING_NOT_PARTICIPANT`.

## [ ] RT-10: Match-entry window, adjustment basis and `MIN_MATCHES` cutover

```text
Status: BLOCKED
Size: M
Blocked by: RT-09, SC-12
```

**Objective:** Implement §25.2–§25.5.

**Scope**

- In scope: `PLAYER_SKILL_ADJUSTMENTS.match_entries_considered`, `PLAYER_SKILL_ADJUSTMENT_MATCHES` migration (append-only trigger); entry query; new-entry rule with legacy fallback; reader switch to `MIN_MATCHES`.
- Out of scope: retiring `MIN_RATINGS` (later task after verification).

**Implementation requirements**

1. Entries read after the target `player_profiles` lock.
2. Deterministic ordering `completed_at DESC, match_id DESC`.

**Files/areas affected**

- `backend/src/services/ratings/SkillAdjustmentService.ts`, `backend/src/repositories/ratings/SkillAdjustmentRepository.ts`, `backend/src/db/migrations/`

**API impact:** Admin adjustment history adds `matchEntriesConsidered` and basis Match ids.

**Schema/config impact:** §13.8; `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES`.

**Verification**

- §25.7 cases, including concurrent submissions for one target and legacy rows.

**Acceptance criteria**

- **Given** an adjustment whose basis contains Match M **When** a late rating for M arrives after the cooldown **Then** no new adjustment is recorded.

## [ ] RT-11: "Giao lưu" label in rating views

```text
Status: BLOCKED
Size: S
Blocked by: RT-09
```

**Objective:** Display `GROUP` as "Giao lưu" in the rating modal, pending view and ratings-given history.

**Scope**

- In scope: frontend label mapping in `features/ratings/`.
- Out of scope: Match Detail host page (MM-29).

**Implementation requirements**

1. One shared label map; no duplicated strings.

**Files/areas affected**

- `frontend/src/features/ratings/`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- UI test: GROUP entries show "Giao lưu".

**Acceptance criteria**

- **Given** a GROUP Match in ratings-given history **When** rendered **Then** the type reads "Giao lưu".
