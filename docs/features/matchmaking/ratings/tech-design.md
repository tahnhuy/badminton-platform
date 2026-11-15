# Player Ratings — Technical Design

## Phạm vi thay thế và trạng thái thiết kế — 2026-11-08

Quyết định nghiệp vụ mới: **không dùng rating để nâng trình; chỉ việc tham gia giải chuyên nghiệp mới là cơ sở nâng trình**. Trận giao lưu, kèo đơn/đôi thông thường và giải phong trào không nâng trình. Khảo sát ban đầu vẫn là tự đánh giá ban đầu, không phải nâng trình hay chứng nhận.

Các quy tắc tự hiệu chỉnh từ điểm rating, cửa sổ trận, ngưỡng điểm và cooldown trong tài liệu cũ được thay thế. Điều kiện tham gia hợp lệ, xác nhận kết quả/thành tích, công thức/ngưỡng nâng trình và xử lý sửa/hủy kết quả: **TBD**; không mặc định cứ đăng ký/tham gia một giải là tăng một bậc. Giữ đánh giá kỹ năng và thái độ sau trận để tham khảo/hiển thị; cả hai loại điểm đều không được dùng để nâng trình.

Nội dung cũ trái với mục này là thiết kế legacy. Quyết định nghiệp vụ do người dùng xác nhận ngày 2026-11-08; thiết kế API/schema mới và các TBD chưa được duyệt Ready. Chưa triển khai thay đổi trong lần sửa tài liệu này.

---

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/matchmaking/ratings/prd.md
Scope: Post-Match player ratings — submit skill/attitude ratings for fellow Match participants, list pending participants, view an aggregate rating summary, and apply bounded automatic skill adjustment
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-27; automatic skill adjustment added 2026-10-04)
```

> Ready. All technical decisions in §21 were resolved by the human owner on
> 2026-09-27 (see §21 Decision Log), including the approved frozen-schema delta.
> The human readiness gate per `docs/documentation-guide.md` §6.3 was explicitly
> given on 2026-09-27. This design does not override the governing PRD,
> `PROJECT-BRIEF.md`, `docs/business-rules-config-matrix.md`,
> `docs/architecture/tech-stack.md`, `docs/architecture/conventions.md`, or the
> consolidated schema in `docs/architecture/database-schema.md`. The schema
> document update accompanies the migration during implementation (§10.4, §17).

## 2. Context

This design implements the Ready PRD `docs/features/matchmaking/ratings/prd.md`:

1. After a Match reaches `COMPLETED`, a participant may rate other participants on **skill** and **attitude** (1–5 integer each), with an optional comment.
2. A rater may rate each other participant at most once per Match; the same pair can rate each other again in a different Match.
3. Self-rating and rating non-participants are forbidden.
4. Ratings apply to completed casual (matchmaking) and Tournament Matches; the latter is gated by `TOURNAMENT_RATING_ENABLED`.
5. Received ratings are shown in aggregate only (rater identity is not disclosed); submitted ratings are immutable.
6. Admin has read-only oversight.

The feature crosses these boundaries:

- **RatingModule (new)**: rating submission, pending-rating lookup, aggregate summary, and read-only rating listing.
- **MatchModule (implemented shared core)**: owns writes to `MATCHES` and `MATCH_PLAYERS`; Ratings reads retained completed-match participants and never mutates them. Matchmaking owns casual links and screens only.
- **TournamentModule (existing schema, not yet implemented in code)**: owns `TOURNAMENT_MATCHES`; Ratings reads the link and resolution to enforce the Tournament gate and played-result eligibility.
- **System configuration (existing `SYSTEM_CONFIGS` table)**: stores `TOURNAMENT_RATING_ENABLED`.
- **AuthModule (implemented)**: provides the authenticated `PLAYER` identity; Rating relies on it.

## 3. Technical Problem

1. **Identity and participation** — the rater is the authenticated session user. The system must prove, per request, that the rater and every rated player are participants of the same Match, without trusting client-supplied identity.
2. **Two rating dimensions on a single-value column** — the legacy schema stored one `PLAYER_RATINGS.rating` integer; migration `0008` and the implemented Drizzle schema now store both required dimensions.
3. **Duplicate suppression under concurrency** — double-click, retries, and concurrent submissions must never create more than one row per `(rater_id, rated_player_id, match_id)`. The existing UNIQUE constraint is the concurrency boundary, but the application must behave idempotently.
4. **State gating** — ratings are only valid for `COMPLETED` Matches. The schema defines `MATCHES.status` as `PENDING_COURT | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED`; there is no `FINISHED` state.
5. **Tournament gating** — a Match that is a `TOURNAMENT_MATCHES` row is subject to `TOURNAMENT_RATING_ENABLED`; casual Matches are always ratable.
6. **Privacy-preserving aggregation** — received ratings are exposed only as aggregate values; individual rater identity must never leak to the rated Player.
7. **Immutability** — no edit/delete path may exist for a submitted rating, for any role.

## 4. Goals

- Provide REST endpoints for rating submission, pending-participant lookup, aggregate summary, and the paginated read of ratings given, using the approved layering.
- Enforce all PRD/business rules in the service layer and reinforce participant/self/range integrity with database constraints.
- Guarantee at-most-once insertion per `(rater_id, rated_player_id, match_id)` and make retries idempotent.
- Preserve the aggregate-only privacy model.
- Apply bounded automatic skill adjustment from received skill ratings and record it as history (§7.7).
- Keep the design within the PERN monolith, TypeScript, Zod, Express, and Drizzle ORM.

## 5. Non-Goals

- Court / Facility rating (Out of MVP, `PROJECT-BRIEF.md` §5).
- Any automated ELO/MMR computation. Skill adjustment is limited to the simple bounded rule in §7.7; it does not affect tournament seeding directly.
- Realtime/WebSocket rating updates (the PRD confirms no rating notification/realtime event; HTTP request/response only).
- Editing, deleting, or moderating submitted ratings.
- Rating notifications (no rating notification event is confirmed in MVP).

## 6. Upstream References

- Governing PRD: `docs/features/matchmaking/ratings/prd.md` (Ready)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §3.1, §3.3, §4, §5, §6
- Documentation rules: `docs/documentation-guide.md` §5.3, §6.1, §6.3, §9, §13
- Global architecture/technology: `docs/architecture/tech-stack.md` (PERN, TypeScript, Drizzle ORM, Zod, opaque session cookie, centralized error handling, `/api/v1/`, offset pagination, 1–5 rating scale)
- Global coding/API conventions: `docs/architecture/conventions.md` (General Principles, Naming, Backend structure, API Conventions, Validation Conventions, Async & Concurrency, Testing Conventions)
- Business rules/configuration: `docs/business-rules-config-matrix.md` §6 (Rating Rules), §8.1 (Configuration Semantics), §8.4 (Tournament Configuration)
- Global database schema: `docs/architecture/database-schema.md` §2.6 (Rating), §3.13 `MATCHES`, §3.14 `MATCH_PLAYERS`, §3.23 `PLAYER_RATINGS`, §5.1 (Match Player Integrity), §5.3 (Rating integrity), §9 item 6 (rating scale, resolved)
- Existing implementation: `backend/src/db/schema/ratings.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/validate.middleware.ts`, `backend/src/errors/AppError.ts`, `backend/src/middleware/error.middleware.ts`, `backend/src/controllers/admin/AdminUserController.ts`

## 7. Proposed Technical Design

### 7.1 Responsibility Boundaries

Following `docs/architecture/conventions.md` (Backend):

- `backend/src/routes/ratings/` — thin Express routers only.
- `backend/src/controllers/ratings/RatingController.ts` — HTTP translation (params/query/body → service, service result → response).
- `backend/src/services/ratings/RatingService.ts` — use-case orchestration, authorization decisions, business validation, transaction boundary, idempotent duplicate handling.
- `backend/src/services/ratings/SkillAdjustmentService.ts` — computes the recent skill average, applies the §7.7 bounded rule, and writes the adjustment history.
- `backend/src/repositories/ratings/RatingRepository.ts` — Drizzle persistence: match/participant/config reads, multi-row insert, aggregate queries, paginated list.
- `backend/src/repositories/ratings/SkillAdjustmentRepository.ts` — adjustment-history reads/writes and the cooldown lookup.
- `backend/src/validation/ratings.ts` — Zod request-boundary schemas.
- `backend/src/db/schema/ratings.ts` — modified Drizzle table definition (schema delta, §10).
- `frontend/src/features/ratings/` — feature UI, feature API client, feature hooks (skill/attitude form, pending list, summary). Transport stays out of presentational components.

Shared authentication middleware is reused. Profile consumes the same viewer-aware aggregate service/projection; shared type-only interfaces, if needed across capabilities, belong in `backend/src/contracts/`. No duplicated aggregate query or authorization logic is permitted.

### 7.2 Data Flow — submit ratings (POST)

1. `authenticate` → `requireRole('PLAYER')` → CSRF check → Zod `validate({ params, body })`.
2. `RatingController.createRatings` extracts `raterId` from `req.user.id`, `matchId` from params, and the payload, and calls `RatingService`.
3. `RatingService.createRatings(raterId, matchId, payload)`:
   - Load the Match; `404 MATCH_NOT_FOUND` if absent.
   - Require `status = 'COMPLETED'`; else `409 MATCH_NOT_COMPLETED`.
   - Resolve the tournament gate; if the Match is a Tournament Match and `TOURNAMENT_RATING_ENABLED = false`, `409 RATING_DISABLED`.
   - For a Tournament Match require `resolution = WINNER_DECLARED`, else `409 RATING_MATCH_NOT_PLAYED` (§23.1).
   - Verify the rater is in `MATCH_PLAYERS` for the Match; else `403 RATING_NOT_PARTICIPANT`.
   - Verify every `ratedPlayerId` is in `MATCH_PLAYERS` and none equals `raterId`; else `409 RATING_TARGET_NOT_PARTICIPANT` / `409 RATING_SELF_FORBIDDEN`.
   - Perform one multi-row insert with `ON CONFLICT ("rater_id","rated_player_id","match_id") DO NOTHING RETURNING ...`.
   - Derive `alreadyRated` = requested IDs − created IDs.
   - Execute the locking/adjustment orchestration in §7.7 in this same transaction; the response is sent only after commit.
4. Controller returns `201` when at least one row was created, otherwise `200` (idempotent replay).

### 7.3 Data Flow — pending participants (GET)

1. `authenticate` → `requireRole('PLAYER')`.
2. `RatingService.getPendingPlayers(raterId, matchId)` applies the same Match/gate/rater-participation checks, then returns Match participants excluding the rater and excluding any already rated by the rater for that Match, joined to `PLAYER_PROFILES.full_name` for display. It also returns the caller’s submitted ratings for the same Match as read-only `ratedPlayers`; these never include other raters’ rows.

### 7.4 Data Flow — summary (GET)

1. `authenticate` → `requireRole('PLAYER', 'ADMIN')`.
2. Contextual rule: an authenticated `PLAYER` may request their own summary, and may also request another Player's **aggregate summary** for display on a public profile (Decision Log §21 #11; `docs/features/player/profile/prd.md` §14 #3). An `ADMIN` may request any Player, including inactive targets. Apply §9.3 target/threshold policy. The summary always returns aggregates only (no rater identity, no individual rows).
3. `RatingService.getSummary(viewer, userId)` enforces viewer-aware visibility in §9.3 and returns only the permitted aggregate projection. Internal Profile composition reuses this policy, not a raw unrestricted public query.

### 7.5 Configuration Read Boundary

Feature code reads configuration exclusively through typed readers in `backend/src/shared/config/`, backed by the shared registry/validated loader. Rating repositories must not query `SYSTEM_CONFIGS`. Integrate with the existing implementation; if registry consolidation is not implemented yet, deliver the minimal shared loader/reader integration required for these five keys, without creating a competing registry or rebuilding unrelated config UI.

Read the tournament gate plus four `PLAYER_SKILL_ADJUSTMENT_*` keys once per request/evaluation. Defaults follow matrix §8.4/§8.8; missing values log WARN and use defaults, invalid values log ERROR and use defaults. Boolean values are strict trimmed true/false (case-insensitive). Confirmed integer bounds: minimum ratings 1–100, threshold 1–6, cooldown days 0–365. Use the shared cache window (at most 60 seconds) and write invalidation. No Match snapshot and no retroactive reevaluation on config writes.

### 7.6 Client/Server Boundary

The React feature calls the REST endpoints through a feature API client and renders loading/success/error/empty/already-rated states per the PRD §9. No rating business rule is duplicated in the client.

### 7.7 Automatic Skill Adjustment

Adjustment is synchronous and participates in the caller-owned rating transaction; no detached in-process follow-up is permitted.

1. Validate the complete batch and read a consistent config bundle. Reject invalid targets atomically.
2. Lock target `PLAYER_PROFILES` rows in ascending player ID order before the insert/evaluation. Every rating writer follows this lock order; hold locks until commit. Do not lock only after computing current level, cooldown or the rating window.
3. Insert ratings with `ON CONFLICT DO NOTHING RETURNING`. Evaluate only distinct target IDs in the newly created rows, once per target/request. All-duplicate replays perform no evaluation or history write, regardless of changed payload, elapsed cooldown or cooldown zero.
4. If enabled, load exactly the most recent N received skill ratings ordered by `created_at DESC, id DESC`, within the same transaction and after the lock/insert. Fewer than N means no adjustment. N is `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`, not a requirement for N distinct raters or N new ratings since the last adjustment.
5. Compute the unrounded average; compare using continuous bounds from matrix §6. `GOOD` requires exactly 5. Use stable arithmetic for boundaries; display rounding must not alter the decision.
6. Read current skill rank and last automatic adjustment under the held profile lock. Skip when elapsed time is less than cooldown × 24 hours, or rank gap is below threshold. At exactly the cooldown boundary evaluation is allowed. Cooldown zero allows distinct new submissions to evaluate successively, never duplicate replay.
7. Move exactly one catalog rank toward target and append history atomically with the rating insert. A failure for any target rolls back all ratings, profile updates and history in this request. No detached retry mechanism is needed; the caller can retry the POST.

Only skill drives adjustment. Concurrent distinct submissions serialize per target; an overlapping recent window may be reused after cooldown when a new rating arrives. No timer/config change triggers evaluation by itself. Tests must cover rollback, crossed target orders, concurrent distinct ratings, replay after cooldown and cooldown zero.

## 8. Behavior, State, and Flow

```text
Match.status = COMPLETED
        │
        ├── (casual) ────────────────► ratable
        └── (tournament) ─ TOURNAMENT_RATING_ENABLED ─┬─ true ──► ratable
                                                       └─ false ─► RATING_DISABLED

Rating submission (rater, ratedPlayer, matchId):
  absent ──insert──► stored (immutable)
  present ─on-conflict do nothing──► already stored (idempotent no-op)
```

- Preconditions: authenticated `PLAYER`; Match exists and is `COMPLETED`; rater is a Match participant; each rated player is a distinct Match participant other than the rater; tournament gate passes.
- State transitions: a rating row is created once and never mutated. There is no update/delete transition.
- Postconditions: exactly one `PLAYER_RATINGS` row per `(rater_id, rated_player_id, match_id)`; summary aggregates reflect stored rows.
- Feature business rules remain authoritative in `docs/business-rules-config-matrix.md` §6 and the PRD.

## 9. API Design

All paths are under the confirmed `/api/v1/` prefix. JSON success bodies use a `data` object for this feature; list responses additionally include `meta`. Errors use the global shape `{ "error": { "code", "message", "details" } }` (`docs/architecture/conventions.md`, Error Handling).

### 9.1 POST `/api/v1/matches/:matchId/ratings`

- Operation: submit one or more ratings for the given Match.
- Auth: `authenticate`, `requireRole('PLAYER')`, CSRF `X-CSRF-Token` required.
- Request body:

```json
{
  "ratings": [
    { "ratedPlayerId": 3, "skillRating": 4, "attitudeRating": 5, "comment": "Chơi tốt, thái độ tích cực" },
    { "ratedPlayerId": 4, "skillRating": 3, "attitudeRating": 4 }
  ]
}
```

- Request semantics: `ratings` is required, 1–3 items (maximum other participants in `DOUBLES`); each `ratedPlayerId` is unique within the request; `skillRating` and `attitudeRating` are integers 1–5; `comment` is optional, trimmed, max 500 characters.
- Response `201` (at least one created) / `200` (all idempotent replays):

```json
{
  "data": {
    "matchId": 10,
    "created": [
      { "id": 501, "ratedPlayerId": 3, "skillRating": 4, "attitudeRating": 5, "comment": "Chơi tốt, thái độ tích cực", "createdAt": "2026-09-27T10:00:00.000Z" }
    ],
    "alreadyRated": [ { "ratedPlayerId": 4 } ]
  }
}
```

- Status/error codes:

| HTTP | Code | Condition |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body/params fail Zod validation (shape, range, empty/too many items, duplicate target in request). |
| 401 | `AUTH_SESSION_INVALID` | Missing/invalid session. |
| 403 | `AUTH_FORBIDDEN_ROLE` | Authenticated user is not a `PLAYER`. |
| 403 | `RATING_NOT_PARTICIPANT` | Rater is not in `MATCH_PLAYERS` for the Match. |
| 404 | `MATCH_NOT_FOUND` | Match does not exist. |
| 409 | `MATCH_NOT_COMPLETED` | Match is not `COMPLETED`. |
| 409 | `RATING_DISABLED` | Tournament Match and `TOURNAMENT_RATING_ENABLED = false`. |
| 409 | `RATING_MATCH_NOT_PLAYED` | Tournament Match lacks a valid played standard result (`WINNER_DECLARED`). |
| 409 | `RATING_SELF_FORBIDDEN` | A `ratedPlayerId` equals the rater. |
| 409 | `RATING_TARGET_NOT_PARTICIPANT` | A `ratedPlayerId` is not in `MATCH_PLAYERS` for the Match. |

### 9.2 GET `/api/v1/matches/:matchId/ratings/pending`

- Operation: list participants the rater still has to rate.
- Auth: `authenticate`, `requireRole('PLAYER')`.
- Request: no body; `matchId` path param.
- Response `200`:

```json
{
  "data": {
    "matchId": 10,
    "matchType": "DOUBLES",
    "ratedPlayers": [
      { "playerId": 6, "fullName": "Lê Văn C", "rating": { "id": 500, "skillRating": 4, "attitudeRating": 5, "comment": null, "createdAt": "2026-10-15T10:00:00.000Z" } }
    ],
    "pendingPlayers": [
      { "playerId": 3, "fullName": "Nguyễn Văn A" },
      { "playerId": 4, "fullName": "Trần Thị B" }
    ]
  }
}
```

- Errors: `400 VALIDATION_FAILED`, `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `403 RATING_NOT_PARTICIPANT`, `404 MATCH_NOT_FOUND`, `409 MATCH_NOT_COMPLETED`, `409 RATING_DISABLED`, `409 RATING_MATCH_NOT_PLAYED`.
- No pagination: pending plus rated players partition the other participants (max 3). A fully rated Match returns `pendingPlayers: []` and retains `ratedPlayers`. Requesting this view uses the same eligibility guards as POST.

### 9.3 GET `/api/v1/users/:userId/ratings/summary`

- Operation: aggregate rating summary for a Player.
- Auth: `authenticate`, `requireRole('PLAYER', 'ADMIN')`.
- Authorization: an authenticated `PLAYER` may query self or another active, non-deleted Player with the suppression rules below; `ADMIN` may query any Player, including inactive targets. A missing/non-Player target returns `404 USER_NOT_FOUND`.
- Response `200`:

```json
{
  "data": {
    "userId": 5,
    "totalRatings": 12,
    "notEnoughData": false,
    "averageSkillRating": 3.75,
    "averageAttitudeRating": 4.5,
    "skillDistribution": { "1": 0, "2": 1, "3": 4, "4": 5, "5": 2 },
    "attitudeDistribution": { "1": 0, "2": 0, "3": 2, "4": 6, "5": 4 }
  }
}
```

- Semantics: full aggregates (self/Admin, or another active Player with at least 3 ratings) contain counts, averages rounded to two decimals and distributions. Zero-rating self/Admin responses have null averages and zero distributions. No rater identity or individual rows are returned.
- For a Player viewing another Player, require target role PLAYER, status ACTIVE and `deleted_at IS NULL`; otherwise return `404 USER_NOT_FOUND` (same response as absent target). Admin can inspect inactive targets; self access remains governed by Auth.
- For another active Player with fewer than 3 ratings return `{ userId, totalRatings, notEnoughData: true, averageSkillRating: null, averageAttitudeRating: null, skillDistribution: null, attitudeDistribution: null }`. Both dimensions have the same count because both are required. Never return hidden aggregates through an alternate Profile composition path.
- Every successful summary response includes boolean `notEnoughData` (`totalRatings < 3`); this flag is informational for self/Admin and does not suppress their full aggregate values. Profile applies its display threshold to self as well.
- Errors: `400 VALIDATION_FAILED`, `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `404 USER_NOT_FOUND`.

### 9.4 GET `/api/v1/users/:userId/ratings`

This endpoint satisfies the PRD §7 "view the ratings they gave" and "Admin oversight" requirements with the standard pagination convention. It was approved by the human owner on 2026-09-27 (Decision Log §21 #2).

- Operation: paginated read of ratings associated with a user.
- Auth: `authenticate`, `requireRole('PLAYER', 'ADMIN')`.
- Query: `direction` = `given` | `received` (default `given`), `page` (≥1, default 1), `limit` (1–100, default 20).
- Authorization: a `PLAYER` may only read their own `userId` with `direction=given`; `direction=received` and any other `userId` are `403 RATING_SUMMARY_FORBIDDEN` for a `PLAYER`. An `ADMIN` may read any user and either direction.
- Response `200`:

```json
{
  "data": [
    { "id": 501, "matchId": 10, "raterId": 5, "raterFullName": "Nguyễn Văn B", "ratedPlayerId": 3, "ratedPlayerFullName": "Nguyễn Văn A", "skillRating": 4, "attitudeRating": 5, "comment": "...", "createdAt": "2026-09-27T10:00:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

- Note: this design follows the `conventions.md` `meta` shape. The existing Admin module returns `pagination` instead (`backend/src/services/admin/AdminUserService.ts` §`UserListResult`). The human owner approved correcting that deviation (Decision Log §21 #5); the correction is out of scope for the Rating feature implementation and must be tracked as a separate task.
- The same explicit row projection applies to both directions. Player access is own `given` only; no received rows or other users’ given rows. Include both participant identities for Admin oversight and names for Player history. Do not expose emails or contact data.
- Errors: `403 RATING_SUMMARY_FORBIDDEN` (list contextual denial), `400 VALIDATION_FAILED` (params/query), `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `404 USER_NOT_FOUND` (the path user does not exist).

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains the schema authority. This design records only the delta. The human owner approved the target schema, already recorded in `database-schema.md` §2.6/§3.23/§3.30. Code/migration are still pending; reconcile these sections and record actual migration application in the implementation session.

### 10.1 Existing Objects Affected

- `PLAYER_RATINGS` (`database-schema.md` §3.23): already has the required `UNIQUE (rater_id, rated_player_id, match_id)` (`uq_player_rating`), FKs to `USERS` and `MATCHES`, and the composite FKs to `MATCH_PLAYERS(match_id, player_id)` for both `(match_id, rater_id)` and `(match_id, rated_player_id)` (confirmed in `backend/src/db/schema/ratings.ts` and migration `0000`). Those are unchanged.
- Current single column `rating integer NOT NULL` is insufficient for the two PRD dimensions.

### 10.2 Schema Delta

1. Rename `PLAYER_RATINGS.rating` → `skill_rating integer NOT NULL`.
2. Add `PLAYER_RATINGS.attitude_rating integer NOT NULL`.
3. Add CHECK `chk_player_rating_skill_range`: `skill_rating BETWEEN 1 AND 5`.
4. Add CHECK `chk_player_rating_attitude_range`: `attitude_rating BETWEEN 1 AND 5`.
5. Add CHECK `chk_player_rating_no_self`: `rater_id <> rated_player_id`.
6. Add index `player_ratings_match_rater_idx` on `(match_id, rater_id)` for pending lookups.
7. Add index `player_ratings_rated_player_idx` on `(rated_player_id)` for received-summary aggregation.
8. Seed `SYSTEM_CONFIGS` key `TOURNAMENT_RATING_ENABLED = 'true'` (inspect existing seeds through the current journal; insert idempotently).
9. Add an immutability trigger `trg_player_ratings_immutable` rejecting `UPDATE`/`DELETE` on `PLAYER_RATINGS` (approved; Decision Log §21 #4).
10. Seed `SYSTEM_CONFIGS` keys `PLAYER_SKILL_ADJUSTMENT_ENABLED = 'true'`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS = '5'`, `PLAYER_SKILL_ADJUSTMENT_THRESHOLD = '1'`, `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS = '14'` (`docs/business-rules-config-matrix.md` §8.8).
11. Add table `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30): append-only adjustment history.
12. Add index `player_skill_adjustments_player_created_idx` on `(player_id, created_at)` for history and cooldown lookups.
13. Add `trg_player_skill_adjustments_immutable` rejecting UPDATE/DELETE on append-only adjustment history, with a dedicated trigger function.

### 10.3 Drizzle Definition Changes (illustrative)

In `backend/src/db/schema/ratings.ts`:

```ts
import { pgTable, bigint, timestamp, text, integer, check, unique, foreignKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const playerRatings = pgTable('player_ratings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  raterId: bigint('rater_id', { mode: 'number' }).notNull().references(() => users.id),
  ratedPlayerId: bigint('rated_player_id', { mode: 'number' }).notNull().references(() => users.id),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  skillRating: integer('skill_rating').notNull(),
  attitudeRating: integer('attitude_rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqPlayerRating: unique('uq_player_rating').on(t.raterId, t.ratedPlayerId, t.matchId),
  chkSkillRange: check('chk_player_rating_skill_range', sql`${t.skillRating} BETWEEN 1 AND 5`),
  chkAttitudeRange: check('chk_player_rating_attitude_range', sql`${t.attitudeRating} BETWEEN 1 AND 5`),
  chkNoSelf: check('chk_player_rating_no_self', sql`${t.raterId} <> ${t.ratedPlayerId}`),
  matchRaterIdx: index('player_ratings_match_rater_idx').on(t.matchId, t.raterId),
  ratedPlayerIdx: index('player_ratings_rated_player_idx').on(t.ratedPlayerId),
  fkRaterMatch: foreignKey({
    columns: [t.matchId, t.raterId],
    foreignColumns: [matchPlayers.matchId, matchPlayers.playerId],
    name: 'player_ratings_match_id_rater_id_fkey',
  }),
  fkRatedMatch: foreignKey({
    columns: [t.matchId, t.ratedPlayerId],
    foreignColumns: [matchPlayers.matchId, matchPlayers.playerId],
    name: 'player_ratings_match_id_rated_player_id_fkey',
  }),
}));
```

Note: the Drizzle column name change may be generated by `drizzle-kit` as a drop/add unless a rename is confirmed. The migration below performs an explicit rename to avoid data loss.

### 10.4 Migration Script (`0008`)

> Migration number note (updated 2026-10-15): earlier drafts of this design numbered the
> ratings migration `0005`. That number is already used by
> `0005_auth_tables.sql`; the ratings delta now uses the next unused migration number, currently `0008`,
> after `0007_matchmaking_invitation_only.sql`. Never rename/rewrite applied migrations; recheck the journal before generating a new migration.

```sql
ALTER TABLE "player_ratings" RENAME COLUMN "rating" TO "skill_rating";--> statement-breakpoint
ALTER TABLE "player_ratings" ADD COLUMN "attitude_rating" integer;--> statement-breakpoint
UPDATE "player_ratings" SET "attitude_rating" = "skill_rating" WHERE "attitude_rating" IS NULL;--> statement-breakpoint
ALTER TABLE "player_ratings" ALTER COLUMN "attitude_rating" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "chk_player_rating_skill_range" CHECK ("skill_rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "chk_player_rating_attitude_range" CHECK ("attitude_rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "chk_player_rating_no_self" CHECK ("rater_id" <> "rated_player_id");--> statement-breakpoint
CREATE INDEX "player_ratings_match_rater_idx" ON "player_ratings" ("match_id","rater_id");--> statement-breakpoint
CREATE INDEX "player_ratings_rated_player_idx" ON "player_ratings" ("rated_player_id");--> statement-breakpoint
INSERT INTO "system_configs" ("config_key","config_value","description")
VALUES ('TOURNAMENT_RATING_ENABLED','true','Enable tournament-related rating')
ON CONFLICT ("config_key") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_player_rating_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'player_ratings is immutable';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_player_ratings_immutable"
BEFORE UPDATE OR DELETE ON "player_ratings"
FOR EACH ROW EXECUTE FUNCTION "prevent_player_rating_mutation"();--> statement-breakpoint
CREATE TABLE "player_skill_adjustments" (
  "id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  "player_id" bigint NOT NULL,
  "previous_skill_level_id" bigint NOT NULL,
  "new_skill_level_id" bigint NOT NULL,
  "average_skill_rating" numeric NOT NULL,
  "ratings_considered" integer NOT NULL,
  "source" varchar NOT NULL DEFAULT 'AUTO_RATING',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_player_skill_adjustment_ratings_considered" CHECK ("ratings_considered" > 0)
);--> statement-breakpoint
ALTER TABLE "player_skill_adjustments"
  ADD CONSTRAINT "player_skill_adjustments_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "player_skill_adjustments"
  ADD CONSTRAINT "player_skill_adjustments_previous_level_fk" FOREIGN KEY ("previous_skill_level_id") REFERENCES "skill_levels"("id");--> statement-breakpoint
ALTER TABLE "player_skill_adjustments"
  ADD CONSTRAINT "player_skill_adjustments_new_level_fk" FOREIGN KEY ("new_skill_level_id") REFERENCES "skill_levels"("id");--> statement-breakpoint
CREATE INDEX "player_skill_adjustments_player_created_idx" ON "player_skill_adjustments" ("player_id","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_player_skill_adjustment_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'player_skill_adjustments is immutable';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_player_skill_adjustments_immutable"
BEFORE UPDATE OR DELETE ON "player_skill_adjustments"
FOR EACH ROW EXECUTE FUNCTION "prevent_player_skill_adjustment_mutation"();--> statement-breakpoint
INSERT INTO "system_configs" ("config_key","config_value","description") VALUES
  ('PLAYER_SKILL_ADJUSTMENT_ENABLED','true','Enable automatic skill adjustment from ratings'), -- set to 'false' by the 2026-11-15 survey migration (Auth Tech Design, "Skill levels and survey data")
  ('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS','5','Minimum recent skill ratings before an adjustment'),
  ('PLAYER_SKILL_ADJUSTMENT_THRESHOLD','1','Minimum gap in skill levels that triggers an adjustment'),
  ('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS','14','Minimum days between automatic adjustments')
ON CONFLICT ("config_key") DO NOTHING;
```

The `database-schema.md` §2.6 and §3.23 update is made in the same session in which this migration is implemented and applied (§17), so the consolidated schema and the applied schema stay in sync. The Drizzle schema change and this migration must land together.

### 10.5 Migration/Backfill Impact

- Before Ratings implementation, `PLAYER_RATINGS` had no writer and was expected to be empty; the backfill `UPDATE` is a safety net for the (unlikely) case of existing rows. It is not intended to preserve a real attitude value, only to keep a placeholder dimension until real data exists.
- The rename preserves the existing `uq_player_rating`, the FKs, and the composite participant FKs.
- The immutability trigger (10.2 item 9) is added as raw SQL in the same migration.

## 11. Security

- **Authentication boundary:** reuse the shared `authenticate` middleware (opaque session cookie `sid`; no bearer token). The rater identity is always `req.user.id`; the client cannot submit a rater id.
- **Authorization boundary:** RBAC via `requireRole('PLAYER')` for submission and pending lookup; `requireRole('PLAYER','ADMIN')` for the summary endpoint (own or another Player's aggregate for public-profile display) and the paginated list (self-only `given` for Players, Admin oversight otherwise). Participation is a service-layer contextual rule checked against `MATCH_PLAYERS`.
- **CSRF:** `POST` requires the `X-CSRF-Token` header (double-submit cookie), per conventions.
- **Input/output protection:** Zod validates params/body at the boundary; responses expose only contract fields (no raw DB records, no internal identifiers beyond `matchId`/`userId`/`playerId`/rating values).
- **Privacy:** received ratings expose aggregates only; rater identity is never returned to a rated Player. Another authenticated Player can request only an active target’s aggregate; below 3 mask averages and distributions (§9.3). Individual received-rating detail (`direction=received`) remains Admin-only.
- **Immutability:** no mutation route exists; the required `trg_player_ratings_immutable` DB trigger provides defense in depth (Decision Log §21 #4).
- **Sensitive data:** comments are user-generated text; they are returned only through permitted contracts and must be rendered safely (output-context encoding) to reduce XSS risk.

Dependency note: the Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware`, so a `PLAYER` rater is identified from the session and `requireRole('PLAYER')` is enforced. The legacy `[TEMP AUTH BYPASS]` no longer applies in development/production.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Match does not exist | No `MATCHES` row | `404 MATCH_NOT_FOUND` | Client shows not-found. |
| Match not `COMPLETED` | `MATCHES.status != 'COMPLETED'` | `409 MATCH_NOT_COMPLETED` | Client hides/disables rating until completion. |
| Match is `CANCELLED` | `status = 'CANCELLED'` | `409 MATCH_NOT_COMPLETED` (same guard) | No rating allowed. |
| Tournament Match, gate off | `TOURNAMENT_MATCHES` row + `TOURNAMENT_RATING_ENABLED=false` | `409 RATING_DISABLED` | Client shows rating unavailable. |
| Tournament Match not played | Resolution is not WINNER_DECLARED | `409 RATING_MATCH_NOT_PLAYED` | No rating action; explain why |
| Rater not a participant | No `MATCH_PLAYERS(matchId, raterId)` | `403 RATING_NOT_PARTICIPANT` | Access denied. |
| Rated player not a participant | No `MATCH_PLAYERS(matchId, ratedPlayerId)` | `409 RATING_TARGET_NOT_PARTICIPANT` | Whole request rejected atomically. |
| Self-rating | `ratedPlayerId === raterId` | `409 RATING_SELF_FORBIDDEN` | Whole request rejected; client blocks self entry. |
| Duplicate submission (retry/double-click) | UNIQUE conflict, `ON CONFLICT DO NOTHING` | Created rows only for new pairs; existing pairs reported in `alreadyRated`; `200` if none created | Idempotent; client treats as success. |
| Invalid rating range | Zod (`1–5`) | `400 VALIDATION_FAILED` | Client shows field error. |
| Duplicate target within one request | Zod `superRefine` | `400 VALIDATION_FAILED` | Client error. |
| Too many items (>3) | Zod `max(3)` | `400 VALIDATION_FAILED` | Client error. |
| Summary for another Player (aggregate) | Viewer-aware target and count checks | Player target must be active/not deleted; below 3 mask averages and distributions (§9.3). Admin may inspect inactive Players | Public-profile display |
| Received-rating detail for another Player | Contextual check | `403 RATING_SUMMARY_FORBIDDEN` (Admin-only) | Access denied |
| Attempt to edit/delete a rating | No route | `404`/`405` | Immutable by construction. |

## 13. Concurrency / Idempotency

- **Concurrency-sensitive operation:** creating a rating row for `(rater_id, rated_player_id, match_id)`.
- **Protection:** the existing UNIQUE constraint `uq_player_rating` is the atomic concurrency boundary. The insert uses `ON CONFLICT ("rater_id","rated_player_id","match_id") DO NOTHING RETURNING ...`, so simultaneous identical submissions create exactly one row.
- **Idempotency:** a repeated POST is a safe no-op for already-stored pairs; the response distinguishes `created` from `alreadyRated`. No request identifier/key is required because the natural key `(rater, rated player, match)` already defines uniqueness.
- **Transaction boundary:** validations, ascending target-profile locks, multi-row insert and all adjustment/history writes execute in the same caller-owned `db.transaction` (§7.7). Any failure rolls back the whole batch.
- **Race with state/config changes:** `COMPLETED` is a terminal Match state, so a status flip cannot invalidate an in-flight submission. `TOURNAMENT_RATING_ENABLED` is read at submission time and does not need snapshotting (`docs/business-rules-config-matrix.md` §8.1).
- **Ordering within a batch:** the service normalizes/deduplicates targets before insert; a duplicate target within one request is rejected at the boundary (§12).

## 14. Performance

- Expected workload is low: at most 3 ratings per submission and at most a few submissions per Match.
- Relevant bottleneck: the received-rating aggregate for a user. `player_ratings_rated_player_idx` supports `WHERE rated_player_id = ?`.
- Design response: aggregate in a single grouped query (count, average, per-value counts) rather than loading rows; paginated list queries use `page`/`limit` with deterministic ordering by `created_at DESC, id DESC`.

## 15. Events / Notifications

- Event or notification behavior: `N/A — no rating notification event is confirmed in MVP` (PRD §4).
- Trigger and recipient: `N/A`.
- Delivery/retry implications: `N/A`.
- Background/scheduled processing: `N/A — rating has no time-based transition` (no rating deadline in MVP).

## 16. Testing Considerations

- **Unit behavior:** self-rating rejection; target-not-participant rejection; rater-not-participant rejection; `MATCH_NOT_COMPLETED`; tournament gate on/off; created-vs-already computation; summary math (average rounding, empty-set `null`); pagination mapping.
- **Integration/persistence behavior:** UNIQUE conflict handling via `ON CONFLICT DO NOTHING`; CHECK constraints for range and no-self; composite participant FKs reject non-participants; rename migration preserves the constraint set.
- **API-level behavior:** status codes and error shape for each row in §12; Zod failures produce `VALIDATION_FAILED` with `details`; `requireRole` denials; CSRF requirement on POST.
- **Critical E2E flow:** a Player completes a Match, opens it, rates teammates/opponents (focus out), sees pending shrink, and later views an aggregate summary.
- **Concurrency/idempotency verification:** fire two identical POSTs in parallel; assert a single row and a non-error idempotent response.

Tests use Vitest + Supertest against the separate test database, per `docs/architecture/conventions.md`.

## 17. Migration / Rollout

- **Migration steps:** generate `0008` via `drizzle-kit`, ensure it performs a rename (not drop/add), then apply the CHECK constraints, indexes, config seed, and the immutability trigger; run `db:migrate` on dev and test databases.
- **Rollout sequencing:** apply migration before deploying the Rating module code, because the code expects `skill_rating`/`attitude_rating`.
- **Backward compatibility:** before this feature landed there was no rating writer/reader; subsequent deployments must preserve the now-live two-dimension contract. Apply the `database-schema.md` §2.6/§3.23 update in the same session as the migration (§10.4).
- **Rollback/recovery:** reversal would discard the new attitude/history data; never run it automatically. Any approved rollback must account for both tables/triggers/functions, preserve/export history as required, and follow repository destructive-operation rules. Prefer a forward fix; seeded config keys may safely remain.

## 18. Alternatives Considered

- **Keep a single `rating` column and reuse it for skill, adding only `attitude_rating`:** rejected because the PRD and `database-schema.md` §2.6 name both dimensions explicitly; a generic column name obscures intent.
- **Two rows per rated player (one per dimension):** rejected because it contradicts the `UNIQUE (rater_id, rated_player_id, match_id)` constraint and the "one rating per pair per Match" business rule.
- **Application-only duplicate handling without the UNIQUE constraint:** rejected; the database constraint is the concurrency boundary required by `.agents/AGENTS.md` and the PRD.
- **Returning `409 RATING_ALREADY_EXISTS` on any duplicate:** rejected in favor of idempotent `ON CONFLICT DO NOTHING`, which is retry-safe and consistent with the platform's idempotency principles. The UI's pending list already prevents normal duplicates; the constraint covers races.
- **Storing a snapshot of `TOURNAMENT_RATING_ENABLED` on the Match:** rejected; §8.1 configuration semantics govern new submissions and no snapshot is needed.

## 19. Observability / Monitoring

- Logs: at `warn` for rejected submissions with a stable reason (`RATING_SELF_FORBIDDEN`, `RATING_TARGET_NOT_PARTICIPANT`, `RATING_DISABLED`), and at `info` for successfully created ratings (rater, match, count). Do not log comment text.
- Metrics: `N/A — no approved metrics infrastructure`; the PRD §10 directional metrics are product measurements, not runtime metrics.
- Alerts/operational signals: `N/A` (no time-based or external integration).

## 20. Acceptance / Verification Considerations

- **Given** a `COMPLETED` `DOUBLES` Match and an authenticated participant
  **When** the participant submits skill+attitude ratings for teammates and opponents
  **Then** one `PLAYER_RATINGS` row is stored per target and the response is `201` with those rows in `data.created`.

- **Given** a `COMPLETED` `SINGLES` Match and an authenticated participant
  **When** the participant submits a rating that targets more than the single opponent
  **Then** the non-participant target is rejected with `409 RATING_TARGET_NOT_PARTICIPANT` and no rows are created.

- **Given** a rater who has already rated target P in Match M
  **When** the rater resubmits a rating for P in M (retry/double-click)
  **Then** no second row is created, P appears in `data.alreadyRated`, and the response is `200` or `201` depending on whether any new rows were created.

- **Given** a `COMPLETED` Match and a rater
  **When** the rater includes their own `playerId` in the request
  **Then** the request is rejected with `409 RATING_SELF_FORBIDDEN` and no rows are created.

- **Given** a `COMPLETED` Match and a rater
  **When** the rater includes a `playerId` that is not in `MATCH_PLAYERS` for that Match
  **Then** the request is rejected with `409 RATING_TARGET_NOT_PARTICIPANT` and no rows are created.

- **Given** a Match that is not `COMPLETED`
  **When** a participant attempts to submit a rating
  **Then** the request is rejected with `409 MATCH_NOT_COMPLETED`.

- **Given** a non-participant authenticated as `PLAYER`
  **When** they attempt to submit a rating for the Match
  **Then** the request is rejected with `403 RATING_NOT_PARTICIPANT`.

- **Given** a Tournament Match and `TOURNAMENT_RATING_ENABLED = false`
  **When** a participant attempts to submit a rating
  **Then** the request is rejected with `409 RATING_DISABLED`; **and Given** the flag is `true`, the same submission succeeds.

- **Given** an authenticated `PLAYER`
  **When** they call `GET /api/v1/matches/:matchId/ratings/pending` for a ratable Match
  **Then** the response lists exactly the other participants they have not yet rated.

- **Given** a Player with stored received ratings
  **When** they call `GET /api/v1/users/:userId/ratings/summary` for their own id
  **Then** the response contains aggregate counts/averages only and no rater identity.

- **Given** a `PLAYER`
  **When** they call the summary endpoint for their own id or another Player's id
  **Then** self gets full aggregates; another active Player gets full aggregates only with at least 3 ratings, otherwise null averages/distributions plus count/notEnoughData. Inactive other targets return 404. No rater identity or individual rows are returned.

- **Given** a `PLAYER`
  **When** they request received-rating detail (`direction=received`) for another user
  **Then** the request is rejected with `403 RATING_SUMMARY_FORBIDDEN` (Admin-only).

- **Given** an `ADMIN`
  **When** they call the summary endpoint for any user, or the paginated list for oversight
  **Then** the request succeeds and returns records without exposing them to other Players.

- **Given** a stored rating
  **When** any client attempts to update or delete it
  **Then** no such route exists (`404`/`405`), and a direct `UPDATE`/`DELETE` is rejected by the `trg_player_ratings_immutable` trigger.

- **Given** a request with `skillRating = 6` or a missing dimension
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED` with field details.

- **Given** the paginated list endpoint
  **When** the client requests `page=1&limit=20`
  **Then** the response includes `meta: { page, limit, total, totalPages }` and at most 20 rows.

Verification must include the migration applied to the test database, unit/integration/API tests per §16, and the `database-schema.md` §2.6/§3.23 update made together with the migration (§17).

## 21. Decision Log

All decisions were resolved by the human owner on 2026-09-27, and the Tech Design was marked `Ready`. Automatic skill adjustment was added on 2026-10-04.

| # | Question or decision | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Who may submit ratings, given the provided `requireRole(['player','admin'])` conflicts with the PRD. | Human owner | `PLAYER` only. Submission and pending lookup require `PLAYER`; Admin remains read-only (`PLAYER`/`ADMIN` for summary and list). No business-rule change. | 2026-09-27 | RESOLVED |
| 2 | Whether to add the "ratings given"/Admin-oversight listing endpoint. | Human owner | Add `GET /api/v1/users/:userId/ratings` (paginated, `given`/`received`, §9.4). | 2026-09-27 | RESOLVED |
| 3 | Frozen-schema delta replacing `PLAYER_RATINGS.rating` with `skill_rating` + `attitude_rating` plus CHECK constraints/indexes. | Human owner | Approved as designed (§10). The `database-schema.md` §2.6/§3.23 update is made together with the migration at implementation time (§10.4, §17). | 2026-09-27 | RESOLVED |
| 4 | Immutability enforcement. | Human owner | Database trigger `trg_player_ratings_immutable` rejecting `UPDATE`/`DELETE`, plus no mutation routes. | 2026-09-27 | RESOLVED |
| 5 | Pagination metadata `meta` vs the existing `AdminUserService` `pagination` deviation. | Human owner | This feature uses `meta` per `conventions.md`; also correct the existing `AdminUserService` deviation in a separate change (out of scope for this feature's implementation). | 2026-09-27 | RESOLVED |
| 6 | Comment maximum length. | Human owner | Optional trimmed comment, maximum 500 characters. | 2026-09-27 | RESOLVED |
| 7 | Naming corrections applied by this design (informational): the provided §3.18/§3.19 and `MATCH_PARTICIPANTS` do not exist; the authoritative objects are `MATCHES` (§3.13) and `MATCH_PLAYERS` (§3.14). Match status `FINISHED` does not exist; the terminal state is `COMPLETED`. Roles are uppercase and `requireRole` is variadic (`requireRole('PLAYER', 'ADMIN')`). | Authoritative schema/conventions | Applied by using authoritative names. | 2026-09-27 | RESOLVED |
| 11 | Public-profile aggregate display: a Player needs to see another Player's aggregate rating summary. | Human owner + Tech Lead | Allow an authenticated `PLAYER` to request another Player's aggregate summary (aggregates only, no rater identity); received-rating detail stays Admin-only. Sourced from `docs/features/player/profile/prd.md` §14 #3. | 2026-09-27 | RESOLVED |
| 12 | Automatic skill adjustment from ratings (`PROJECT-BRIEF.md` §3.1). | Human owner | Add `SkillAdjustmentService` + `PLAYER_SKILL_ADJUSTMENTS` history; only the skill dimension; simple bounded rule (§7.7). No ELO/MMR. | 2026-10-04 | RESOLVED |
| 13 | Adjustment table, config keys, and migration number. | Human owner | Add `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30), seed `PLAYER_SKILL_ADJUSTMENT_*` (§8.8), and originally number the ratings migration `0007` (not `0005`); superseded by §23 decision 15 on 2026-10-15 (next unused, currently `0008`). | 2026-10-04 | RESOLVED |

No open questions remain. Implementation must be tracked as tasks; the schema migration and the `database-schema.md` update must land together (§17).

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27; automatic skill adjustment added 2026-10-04
Approved decision/reference: §21 Decision Log (2026-09-27, extended 2026-10-04)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.

## Shared participant readiness alignment — approved 2026-10-10

Status remains Ready. Ratings consumes retained MATCH_PLAYERS of COMPLETED
Matches across both domains. MatchModule owns participant writes; Tournament
populates known/advanced participants before play. Matchmaking cancellation,
expiry or withdrawal must never produce a COMPLETED Match or rating eligibility.
Casual completed_at is booked end even for delayed catch-up, not scheduler time.

## 23. Implementation review — approved 2026-10-15

The human owner approved all twelve recommendations. Status remains Ready; these amendments supersede conflicting older wording and extend §21.

| Decision | Approved resolution |
| --- | --- |
| 14 / review 1 | Public aggregate access remains allowed; RT-03 must follow viewer-aware §9.3. |
| 15 / review 2 | Next unused ordered migration, currently 0008. Consolidated schema is the approved target, not evidence that migration has run. |
| 16 / review 3 | Typed shared config readers/registry, confirmed Ratings bounds, fallback/logging and ≤60 s propagation (§7.5). |
| 17 / review 4–5 | Same transaction for ratings and adjustment; ascending profile locks; only inserted targets trigger; no replay adjustment (§7.7). |
| 18 / review 6–7 | Submission-time deterministic window; unrounded continuous mapping (§7.7 and matrix §6). |
| 19 / review 8–9 | Duplicate success; pending response includes caller-only read-only ratedPlayers (§9.1–9.2). |
| 20 / review 10 | Player given-history and Admin rating/adjustment views are required (RT-07/08). |
| 21 / review 11 | Separate casual/Tournament host integrations; Tournament requires COMPLETED plus WINNER_DECLARED. |
| 22 / review 12 | Active target and backend three-rating suppression for other-Player aggregate (§9.3); Profile retains its display rule. |

### 23.1 Tournament eligibility and error contract

For POST and the match rating view, after Match completion and tournament feature-gate checks, a linked Tournament Match must have `resolution = WINNER_DECLARED` (the Tournament domain validates the actual played result against Match Games). `WALKOVER`, `UNRESOLVED`, `NONE`, or missing/invalid resolution reject with `409 RATING_MATCH_NOT_PLAYED`. Non-completed Matches still return `409 MATCH_NOT_COMPLETED`; disabled tournament rating still returns `409 RATING_DISABLED`. The UI explains that no played, valid result is available. Test both casual and Tournament guards; never infer a played result solely from populated participants.

### 23.2 GET `/api/v1/users/:userId/skill-adjustments`

Admin-only read endpoint: `authenticate`, `requireRole('ADMIN')`. Query `page` (default 1), `limit` (default 20, max 100), standard offset `meta`. Return `{ data: [{ id, playerId, previousSkillLevel: { id, code, name, rank }, newSkillLevel: { id, code, name, rank }, averageSkillRating, ratingsConsidered, source, createdAt }], meta: { page, limit, total, totalPages } }`. Average is a JSON number rounded to two decimals for display. Sort `created_at DESC, id DESC`. Existing Player with no history returns an empty list. Absent/non-Player target returns `404 USER_NOT_FOUND`. Other errors: `400 VALIDATION_FAILED`, `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`. No write route is introduced. History is append-only; migration must reject UPDATE/DELETE on `PLAYER_SKILL_ADJUSTMENTS`, like rating immutability.

### 23.3 Frontend integration and acceptance additions

- Keep reusable UI/hooks/transport in `features/ratings/`; casual host pages stay in `features/matchmaking/`, Tournament hosts in `features/tournament/`. Register routes only in app router. Preserve Matchmaking casual-only endpoint scope.
- Modal shows pending inputs and caller's submitted read-only scores/comment. Allow selecting any subset of pending targets; never default missing scores. On duplicate success reload the view, show “Đánh giá đã được ghi nhận”, and preserve stored values. Completed “all rated” state retains a read-only viewing entry, without offering another submission.
- Add Player ratings-given history at `/ratings/given` with the existing Player layout/navigation, pagination, match link/context and both dimensions/comment. Match links must resolve by domain: use the corresponding domain host when available, otherwise show Match ID as text; do not route Tournament IDs to casual detail.
- Add read-only Ratings and Skill Adjustments sections to the existing Admin User Detail for Player targets. Reuse shared table/pagination primitives; render comments as text. No new manual skill editing capability is authorized.
- Tournament host integration requires a real participant-facing Tournament Match Detail. Do not build the whole Tournament capability under Ratings. Complete independent tasks and record RT-05 as BLOCKED with its precise external dependency if that host is unavailable; do not claim full Ratings completion until both hosts are integrated and verified.
- Acceptance/tests: below-threshold public summary exposes no distribution/average; inactive other-Player summary returns 404; self/Admin full aggregates remain available. Test modal pending/rated partition, partial batch submit, all-rated view, duplicate success, walkover exclusion, Player history and Admin-only adjustment endpoint/UI.


## 24. Implementation audit — 2026-10-15

RT-01/02/03/04/06/07/08 implementation and fixes are verified; RT-05 remains blocked on the Tournament host. See tasks.md “Implementation audit and fixes” for test evidence, task ticks and the test-runner incident. No business decision changed during the audit.

Implementation details clarifying existing contracts: body scores and target IDs are JSON numbers (no coercion); the shared Ratings registry/loader lives in `shared/config/config-registry.ts` and the typed facade in `ratings-config.ts`; feature repositories never query config. Record rating timestamps at actual insertion (`clock_timestamp()`) and adjustment timestamps at evaluation, rather than transaction start, to preserve the approved submission-order window and elapsed cooldown after lock waits. The schema defaults remain compatible for other approved writers.

The E2E runner must import `__tests__/e2e-env.ts` before any database/application imports. Startup, cleanup and Ratings fixture require `current_database() = 'badminton_test'`; cleanup failures are fatal to tests. This implements the existing separate-test-database requirement.

## 25. Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

```text
Status: Ready
Decision Status: Approved
PRD: prd.md §16 (Ready, business scope)
Schema authority: docs/architecture/database-schema.md §13.8 (Ready target delta)
```

§1–§24 describe the implemented behavior (window of the latest N individual
ratings). This section is the target and is Ready under the human approval dated 2026-10-31; implementation is pending.

### 25.1 Eligibility

- `GROUP` Matches are ratable like Singles/Doubles once `COMPLETED`.
- Rater and target must be `MATCH_PLAYERS.status = 'ACTIVE'` at completion.
  Current code (`RatingService.createRatings`) accepts any `MATCH_PLAYERS` row,
  including `LEFT`; this must be tightened because a GROUP Match can complete with
  members who left and were replaced. Companions are never `MATCH_PLAYERS`.
- Casual Matches without a booking now reach `COMPLETED` at `start_at + duration`
  (Matchmaking §24.8); `completed_at` is that instant.

### 25.2 Match entries and window

Inside the existing transaction, after locking the target's `player_profiles` row:

```text
entries = per match_id for target P:
          average(skill_rating) unrounded, count, first_rated_at = min(created_at)
          joined to MATCHES (status COMPLETED) for completed_at
window  = entries ORDER BY completed_at DESC, match_id DESC LIMIT PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES
```

Equal `completed_at` values are ordered by Match id. The window average weights
each entry equally. Fewer than N entries → no evaluation.

### 25.3 "New entry" rule (no reuse of the previous basis)

Let `prev` be the latest adjustment of P.

- If `prev` has rows in `PLAYER_SKILL_ADJUSTMENT_MATCHES`, an entry is new when its
  `match_id` is not in that basis.
- If `prev` is a legacy row (no basis rows), an entry is new when its
  `first_rated_at > prev.created_at`.
- Adjust only if the window contains at least one new entry, the cooldown has
  elapsed (unchanged rule) and the threshold is met (unchanged). A late rating for a
  Match already in the basis changes that entry's average but never counts as new.
  A new entry outside the window never triggers adjustment.
- On adjustment, insert the parent row (`match_entries_considered = N`,
  `ratings_considered` = total ratings in the window, `average_skill_rating` = window
  average) and one `PLAYER_SKILL_ADJUSTMENT_MATCHES` row per window entry.

### 25.4 Concurrency

Ratings for the same target from different raters serialize on the target's
`player_profiles` row (existing ascending lock). Each transaction reads entries only
after acquiring the lock, so the second evaluation sees the first one's ratings and
its adjustment basis; it cannot adjust twice on the same entries. Evaluation still
runs only for targets with a newly inserted rating (existing rule).

### 25.5 Configuration

`PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` (1–100, default 5) is added to the registry.
Migration copies the stored `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` value into the new
key only when the new key does not exist. The reader switches to the new key when
this section ships; `MIN_RATINGS` remains stored until the cutover is verified, then
is retired by a separate task.

### 25.6 Display

`matchType = GROUP` is labelled "Giao lưu" in rating views and history.

### 25.7 Verification

- Same rater set across two Matches yields two entries; one Match with many raters
  yields one entry.
- Late rating for an in-basis Match does not trigger a new adjustment after cooldown.
- Late rating creating an entry for an older Match outside the window does not trigger.
- Two concurrent submissions for one target produce at most one adjustment.
- Legacy adjustment rows are handled by the timestamp rule.
- `LEFT` participants of a completed GROUP Match can neither rate nor be rated.


### Final Phase 2 approval — 2026-10-31

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.
