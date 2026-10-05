# Player Ratings — Technical Design

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
- **MatchmakingModule (existing schema, not yet implemented in code)**: owns `MATCHES` and `MATCH_PLAYERS`; Rating reads `status` and participant rows, but does not mutate them.
- **TournamentModule (existing schema, not yet implemented in code)**: owns `TOURNAMENT_MATCHES`; Rating reads it only to decide whether a Match is a Tournament Match.
- **System configuration (existing `SYSTEM_CONFIGS` table)**: stores `TOURNAMENT_RATING_ENABLED`.
- **AuthModule (not yet implemented in code)**: provides the authenticated `PLAYER` identity; Rating relies on it.

## 3. Technical Problem

1. **Identity and participation** — the rater is the authenticated session user. The system must prove, per request, that the rater and every rated player are participants of the same Match, without trusting client-supplied identity.
2. **Two rating dimensions on a single-value column** — the consolidated schema currently models `PLAYER_RATINGS.rating` as one integer; the PRD requires both skill and attitude. A frozen-schema delta is required.
3. **Duplicate suppression under concurrency** — double-click, retries, and concurrent submissions must never create more than one row per `(rater_id, rated_player_id, match_id)`. The existing UNIQUE constraint is the concurrency boundary, but the application must behave idempotently.
4. **State gating** — ratings are only valid for `COMPLETED` Matches. The schema defines `MATCHES.status` as `WAITING_FOR_COURT | WAITING_FOR_CONFIRMATION | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED`; there is no `FINISHED` state.
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

Shared authentication middleware is reused; no new shared contract is required because Rating only consumes existing tables and middleware (no cross-module interface is introduced).

### 7.2 Data Flow — submit ratings (POST)

1. `authenticate` → `requireRole('PLAYER')` → CSRF check → Zod `validate({ params, body })`.
2. `RatingController.createRatings` extracts `raterId` from `req.user.id`, `matchId` from params, and the payload, and calls `RatingService`.
3. `RatingService.createRatings(raterId, matchId, payload)`:
   - Load the Match; `404 MATCH_NOT_FOUND` if absent.
   - Require `status = 'COMPLETED'`; else `409 MATCH_NOT_COMPLETED`.
   - Resolve the tournament gate; if the Match is a Tournament Match and `TOURNAMENT_RATING_ENABLED = false`, `409 RATING_DISABLED`.
   - Verify the rater is in `MATCH_PLAYERS` for the Match; else `403 RATING_NOT_PARTICIPANT`.
   - Verify every `ratedPlayerId` is in `MATCH_PLAYERS` and none equals `raterId`; else `409 RATING_TARGET_NOT_PARTICIPANT` / `409 RATING_SELF_FORBIDDEN`.
   - Perform one multi-row insert with `ON CONFLICT ("rater_id","rated_player_id","match_id") DO NOTHING RETURNING ...`.
   - Derive `alreadyRated` = requested IDs − created IDs.
4. Controller returns `201` when at least one row was created, otherwise `200` (idempotent replay).

### 7.3 Data Flow — pending participants (GET)

1. `authenticate` → `requireRole('PLAYER')`.
2. `RatingService.getPendingPlayers(raterId, matchId)` applies the same Match/gate/rater-participation checks, then returns Match participants excluding the rater and excluding any already rated by the rater for that Match, joined to `PLAYER_PROFILES.full_name` for display.

### 7.4 Data Flow — summary (GET)

1. `authenticate` → `requireRole('PLAYER', 'ADMIN')`.
2. Contextual rule: an authenticated `PLAYER` may request their own summary, and may also request another Player's **aggregate summary** for display on a public profile (Decision Log §21 #11; `docs/features/player/profile/prd.md` §14 #3). An `ADMIN` may request any user. The summary always returns aggregates only (no rater identity, no individual rows).
3. `RatingService.getSummary(userId)` returns aggregate values only (no rater identity, no individual rows).

### 7.5 Configuration Read Boundary

`TOURNAMENT_RATING_ENABLED` is read from `SYSTEM_CONFIGS` via the Rating repository. Per `docs/business-rules-config-matrix.md` §8.1, the value is evaluated at submission time and applies to new submissions only; no value is snapshotted on a Match. If the key is missing, the default is `true` (matching `docs/business-rules-config-matrix.md` §8.4).

`PLAYER_SKILL_ADJUSTMENT_ENABLED`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`, `PLAYER_SKILL_ADJUSTMENT_THRESHOLD`, and `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` are read from `SYSTEM_CONFIGS` for adjustment; missing keys fall back to the `docs/business-rules-config-matrix.md` §8.8 defaults.

### 7.6 Client/Server Boundary

The React feature calls the REST endpoints through a feature API client and renders loading/success/error/empty/already-rated states per the PRD §9. No rating business rule is duplicated in the client.

### 7.7 Automatic Skill Adjustment

Triggered after skill ratings are inserted for a Match; runs in the same
service flow (or an in-process follow-up) and is idempotent per rating batch.

1. If `PLAYER_SKILL_ADJUSTMENT_ENABLED` is `false`, do nothing.
2. For each rated Player, load the most recent
   `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` received `skill_rating` values.
3. If fewer than the minimum are available, do nothing.
4. Compute the average and map it to a target level using the table in
   `docs/business-rules-config-matrix.md` §6.
5. Skip if the last automatic adjustment for the Player is within
   `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`.
6. Skip if `abs(targetRank - currentRank) < PLAYER_SKILL_ADJUSTMENT_THRESHOLD`.
7. Otherwise move the Player exactly one level toward the target, update
   `PLAYER_PROFILES.skill_level_id`, and append a `PLAYER_SKILL_ADJUSTMENTS`
   row in one transaction (row lock on the profile).

Only the skill dimension is used. Attitude ratings never affect the level.

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
    "pendingPlayers": [
      { "playerId": 3, "fullName": "Nguyễn Văn A" },
      { "playerId": 4, "fullName": "Trần Thị B" }
    ]
  }
}
```

- Errors: `400 VALIDATION_FAILED`, `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `403 RATING_NOT_PARTICIPANT`, `404 MATCH_NOT_FOUND`, `409 MATCH_NOT_COMPLETED`, `409 RATING_DISABLED`.
- No pagination: the result is bounded by the Match player count (max 3).

### 9.3 GET `/api/v1/users/:userId/ratings/summary`

- Operation: aggregate rating summary for a Player.
- Auth: `authenticate`, `requireRole('PLAYER', 'ADMIN')`.
- Authorization: an authenticated `PLAYER` may query their own `userId` or another Player's aggregate summary (for public-profile display); `ADMIN` may query any.
- Response `200`:

```json
{
  "data": {
    "userId": 5,
    "totalRatings": 12,
    "averageSkillRating": 3.75,
    "averageAttitudeRating": 4.5,
    "skillDistribution": { "1": 0, "2": 1, "3": 4, "4": 5, "5": 2 },
    "attitudeDistribution": { "1": 0, "2": 0, "3": 2, "4": 6, "5": 4 }
  }
}
```

- Semantics: averages are rounded to two decimals; when `totalRatings = 0`, averages are `null` and all distribution counts are `0`. No rater identity or individual row is returned.
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
    { "id": 501, "matchId": 10, "ratedPlayerId": 3, "skillRating": 4, "attitudeRating": 5, "comment": "...", "createdAt": "2026-09-27T10:00:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

- Note: this design follows the `conventions.md` `meta` shape. The existing Admin module returns `pagination` instead (`backend/src/services/admin/AdminUserService.ts` §`UserListResult`). The human owner approved correcting that deviation (Decision Log §21 #5); the correction is out of scope for the Rating feature implementation and must be tracked as a separate task.
- Errors: `400 VALIDATION_FAILED` (params/query), `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`, `404 USER_NOT_FOUND` (the path user does not exist).

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains the schema authority. This design records only the delta. Applying it requires an explicit schema decision and an update to `database-schema.md` §2.6 and §3.23 in the same session (currently those sections note the two-dimension representation as a pending delta).

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
8. Seed `SYSTEM_CONFIGS` key `TOURNAMENT_RATING_ENABLED = 'true'` (currently unseeded in migrations `0000`–`0004`).
9. Add an immutability trigger `trg_player_ratings_immutable` rejecting `UPDATE`/`DELETE` on `PLAYER_RATINGS` (approved; Decision Log §21 #4).
10. Seed `SYSTEM_CONFIGS` keys `PLAYER_SKILL_ADJUSTMENT_ENABLED = 'true'`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS = '5'`, `PLAYER_SKILL_ADJUSTMENT_THRESHOLD = '1'`, `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS = '14'` (`docs/business-rules-config-matrix.md` §8.8).
11. Add table `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30): append-only adjustment history.
12. Add index `player_skill_adjustments_player_created_idx` on `(player_id, created_at)` for history and cooldown lookups.

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

### 10.4 Migration Script (`0007`)

> Migration number note (2026-10-04): earlier drafts of this design numbered the
> ratings migration `0005`. That number is already used by
> `0005_auth_tables.sql`; the ratings delta is therefore migration `0007`,
> after `0006_booking_code.sql`.

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
INSERT INTO "system_configs" ("config_key","config_value","description") VALUES
  ('PLAYER_SKILL_ADJUSTMENT_ENABLED','true','Enable automatic skill adjustment from ratings'),
  ('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS','5','Minimum recent skill ratings before an adjustment'),
  ('PLAYER_SKILL_ADJUSTMENT_THRESHOLD','1','Minimum gap in skill levels that triggers an adjustment'),
  ('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS','14','Minimum days between automatic adjustments')
ON CONFLICT ("config_key") DO NOTHING;
```

The `database-schema.md` §2.6 and §3.23 update is made in the same session in which this migration is implemented and applied (§17), so the consolidated schema and the applied schema stay in sync. The Drizzle schema change and this migration must land together.

### 10.5 Migration/Backfill Impact

- `PLAYER_RATINGS` has no writer in the current codebase and is expected to be empty; the backfill `UPDATE` is a safety net for the (unlikely) case of existing rows. It is not intended to preserve a real attitude value, only to keep a placeholder dimension until real data exists.
- The rename preserves the existing `uq_player_rating`, the FKs, and the composite participant FKs.
- The immutability trigger (10.2 item 9) is added as raw SQL in the same migration.

## 11. Security

- **Authentication boundary:** reuse the shared `authenticate` middleware (opaque session cookie `sid`; no bearer token). The rater identity is always `req.user.id`; the client cannot submit a rater id.
- **Authorization boundary:** RBAC via `requireRole('PLAYER')` for submission and pending lookup; `requireRole('PLAYER','ADMIN')` for the summary endpoint (own or another Player's aggregate for public-profile display) and the paginated list (self-only `given` for Players, Admin oversight otherwise). Participation is a service-layer contextual rule checked against `MATCH_PLAYERS`.
- **CSRF:** `POST` requires the `X-CSRF-Token` header (double-submit cookie), per conventions.
- **Input/output protection:** Zod validates params/body at the boundary; responses expose only contract fields (no raw DB records, no internal identifiers beyond `matchId`/`userId`/`playerId`/rating values).
- **Privacy:** received ratings expose aggregates only; rater identity is never returned to a rated Player. The aggregate summary may be requested by another authenticated Player for public-profile display; individual received-rating detail (`direction=received`) remains Admin-only.
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
| Rater not a participant | No `MATCH_PLAYERS(matchId, raterId)` | `403 RATING_NOT_PARTICIPANT` | Access denied. |
| Rated player not a participant | No `MATCH_PLAYERS(matchId, ratedPlayerId)` | `409 RATING_TARGET_NOT_PARTICIPANT` | Whole request rejected atomically. |
| Self-rating | `ratedPlayerId === raterId` | `409 RATING_SELF_FORBIDDEN` | Whole request rejected; client blocks self entry. |
| Duplicate submission (retry/double-click) | UNIQUE conflict, `ON CONFLICT DO NOTHING` | Created rows only for new pairs; existing pairs reported in `alreadyRated`; `200` if none created | Idempotent; client treats as success. |
| Invalid rating range | Zod (`1–5`) | `400 VALIDATION_FAILED` | Client shows field error. |
| Duplicate target within one request | Zod `superRefine` | `400 VALIDATION_FAILED` | Client error. |
| Too many items (>3) | Zod `max(3)` | `400 VALIDATION_FAILED` | Client error. |
| Summary for another Player (aggregate) | Contextual check | Allowed for an authenticated `PLAYER` (aggregate only, no rater identity); `ADMIN` may query any | Public-profile display |
| Received-rating detail for another Player | Contextual check | `403 RATING_SUMMARY_FORBIDDEN` (Admin-only) | Access denied |
| Attempt to edit/delete a rating | No route | `404`/`405` | Immutable by construction. |

## 13. Concurrency / Idempotency

- **Concurrency-sensitive operation:** creating a rating row for `(rater_id, rated_player_id, match_id)`.
- **Protection:** the existing UNIQUE constraint `uq_player_rating` is the atomic concurrency boundary. The insert uses `ON CONFLICT ("rater_id","rated_player_id","match_id") DO NOTHING RETURNING ...`, so simultaneous identical submissions create exactly one row.
- **Idempotency:** a repeated POST is a safe no-op for already-stored pairs; the response distinguishes `created` from `alreadyRated`. No request identifier/key is required because the natural key `(rater, rated player, match)` already defines uniqueness.
- **Transaction boundary:** the read validations and the single multi-row insert execute in one `db.transaction`. Because the insert is one statement, it is atomic; the transaction keeps validation and write consistent and gives a clean rollback on unexpected failure.
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

- **Migration steps:** generate `0005` via `drizzle-kit`, ensure it performs a rename (not drop/add), then apply the CHECK constraints, indexes, config seed, and the immutability trigger; run `db:migrate` on dev and test databases.
- **Rollout sequencing:** apply migration before deploying the Rating module code, because the code expects `skill_rating`/`attitude_rating`.
- **Backward compatibility:** no current writer/reader of `PLAYER_RATINGS` exists; the rename is internal to this feature. Apply the `database-schema.md` §2.6/§3.23 update in the same session as the migration (§10.4).
- **Rollback/recovery:** reverse migration renames `skill_rating` back to `rating`, drops the added columns/constraints/indexes/trigger, and leaves the seeded config key (safe to keep).

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
  **Then** the response contains aggregate counts/averages only (no rater identity or individual rows), and the request is allowed for an authenticated Player.

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
| 13 | Adjustment table, config keys, and migration number. | Human owner | Add `PLAYER_SKILL_ADJUSTMENTS` (`database-schema.md` §3.30), seed `PLAYER_SKILL_ADJUSTMENT_*` (§8.8), and number the ratings migration `0007` (not `0005`). | 2026-10-04 | RESOLVED |

No open questions remain. Implementation must be tracked as tasks; the schema migration and the `database-schema.md` update must land together (§17).

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27; automatic skill adjustment added 2026-10-04
Approved decision/reference: §21 Decision Log (2026-09-27, extended 2026-10-04)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.
