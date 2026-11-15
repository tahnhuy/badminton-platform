# Player Profile — Technical Design

## Ảnh hưởng từ giải đấu và trình độ — 2026-11-08

Theo [PROJECT-BRIEF.md](../../../../PROJECT-BRIEF.md), quyết định ngày 2026-11-08: chỉ giải chuyên nghiệp là cơ sở nâng trình; giải phong trào không tính rank và người tham gia không cần tài khoản. Thành tích giải chuyên nghiệp phải được lưu/hiển thị trên Social và trang cá nhân. Hình thức hiển thị, quyền công khai và xử lý kết quả sửa/hủy còn TBD; chưa có API/schema mới được duyệt. Các yêu cầu dùng rating để tự nâng trình được thay thế; lịch sử dữ liệu không bị xóa trong lần cập nhật tài liệu này.

---

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/player/profile/prd.md
Scope: Player personal profile and public profile — own profile read/update, public player card with skill level, aggregate ratings, and summary match statistics
Decision Status: Approved (human owner: 2026-09-27; clarification approved 2026-10-19)
```

> Ready. All decisions in §21 were resolved by the human owner on 2026-09-27
> (see §21 Decision Log), and the human readiness gate per
> `docs/documentation-guide.md` §6.3 was explicitly given on 2026-09-27. This
> design does not override the governing PRD, `PROJECT-BRIEF.md`,
> `docs/business-rules-config-matrix.md`, `docs/architecture/tech-stack.md`,
> `docs/architecture/conventions.md`, or the consolidated schema in
> `docs/architecture/database-schema.md`.

Items in the provided requirements that conflicted with, or were not covered by, the authoritative documents were resolved by decision (§21 Decision Log):

1. `requireRole(['player','admin'])` → `requireRole('PLAYER')` only for the profile endpoints (Admin uses User Management).
2. `MATCH_PARTICIPANTS` → `MATCH_PLAYERS` (§3.14).
3. Avatar "URL-only / no local upload" → local `/uploads` storage with JPEG/PNG/WebP ≤ 2 MB, consistent with the PRD and `tech-stack.md`.
4. Win/loss is Tournament-only with a `resultsAvailable` flag; casual Matches contribute to `matchesPlayed` only.

### 1.1 Implementation snapshot — 2026-10-19

Identity-first live delivery; see [Tasks delivery status](tasks.md#delivery-status--2026-10-19). `backend/src/app.ts` mounts the Profile router for real identity reads and transactional name updates. Ratings is not configured and statistics are explicitly disabled until their remaining integrations are ready; both return null (§9.0). `/profile` uses the live provider shared with the header through `PlayerProfileLayout`, keyed by authenticated account id. Root `/` stays a placeholder. Avatar upload is live with Multer/Sharp and filesystem/DB consistency (§9.6); Matchmaking profile entry points are wired. Only Tournament entry points and non-null aggregate integration remain pending. No preview provider or sample-data fallback is mounted. The old preview component was removed after the identity-first authorization.

## 2. Context

This design implements `docs/features/player/profile/prd.md` (Ready):

1. A Player views their own profile: display name, avatar, skill level, aggregate ratings, and matches played + win/loss.
2. A Player updates their own display name and avatar.
3. A Player views another Player's public profile (non-sensitive fields only): display name, avatar, skill level, aggregate ratings, matches played + win/loss.
4. Public profiles are available only to authenticated Players and only for active Players.
5. Ratings are aggregate-only with a minimum-ratings threshold; skill level is not self-editable.

Boundaries:

- **PlayerProfileModule (new)**: own-profile read/update and public player card, with the aggregate/stats read models.
- **AuthModule (existing PRD/Tech Design)**: registration already writes `USERS` + `PLAYER_PROFILES`; this feature owns post-registration display/editing (per the Auth PRD handoff).
- **RatingsModule (existing PRD/Tech Design)**: owns `PLAYER_RATINGS` and the aggregate summary; profile consumes the aggregate summary scope approved in `docs/features/matchmaking/ratings/prd.md` §14 #3 and Tech Design §21 #11.
- **MatchmakingModule / TournamentModule (existing schemas)**: own `MATCHES`/`MATCH_PLAYERS` and Tournament results; profile reads them for statistics.
- **File storage (confirmed)**: local filesystem `/uploads` via Express static middleware.

## 3. Technical Problem

1. **Self-only mutation** — only the authenticated user may edit their own profile; the request body must never accept a target user id.
2. **Privacy-safe public output** — the public endpoint must project an allow-list of fields and never return `email`, `password_hash`, session data, or contact information.
3. **Aggregate ratings with threshold** — averages must be computed without loading rows, and hidden below the minimum-ratings threshold; the Ratings module owns the aggregate query.
4. **Cross-module query for profile/skill display** — the profile card composes `USERS` + `PLAYER_PROFILES` + `SKILL_LEVELS` and must not duplicate those definitions.
5. **Match statistics without a stats table** — match counts use retained participants and the domain predicates in §7.8 (completed casual matches and valid Tournament results including WALKOVER, excluding BYE); win/loss is Tournament-only.
6. **Avatar handling** — avatars use the confirmed local filesystem `/uploads` storage with JPEG/PNG/WebP ≤ 2 MB (PRD Decision #7; `tech-stack.md`); cloud storage is not approved. The upload endpoint is part of this feature (see §21 #3 for the exact upload-vs-URL split).
7. **Rating visibility scope** — the Ratings module's summary endpoint now allows an authenticated Player to read another Player's aggregate; the profile must reuse that rather than define a second rating source.

## 4. Goals

- Provide four endpoints: own-profile read, own-profile update, public player card, and avatar upload.
- Enforce self-only mutation and output allow-listing in the service/repository.
- Reuse the Ratings aggregate summary (public-access suppression enforced there, display threshold also applied by Profile) instead of redefining rating rules.
- Derive matches played (and win/loss where available) from existing match data with aggregate/`COUNT` queries.
- Keep the design inside the PERN monolith, TypeScript, Express, Drizzle, and Zod.

## 5. Non-Goals

- Avatar upload to cloud storage (S3/Firebase) or any new infrastructure (PRD; `tech-stack.md` non-goals).
- Social features (chat, friends, feeds).
- Skill level editing by the Player (PRD Decision #2).
- Editing email, password, or account status from the profile (owned by Auth / Admin User Management).
- Duplicating aggregate calculation or visibility rules. Ratings enforces public-access suppression; this feature additionally applies its display threshold to own Profile.
- Court Owner profile behavior.

## 6. Upstream References

- Governing PRD: `docs/features/player/profile/prd.md` (Ready, Decision Log §14 #1–#10)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §3.1, §4, §5, §6
- Documentation rules: `docs/documentation-guide.md` §5.3, §6, §9, §13
- Global architecture/technology: `docs/architecture/tech-stack.md` (PERN, TypeScript, Drizzle ORM, Zod, opaque session cookie, centralized error handling, `/api/v1/`, local filesystem `/uploads` storage, no cloud storage)
- Global coding/API conventions: `docs/architecture/conventions.md` (Backend layering, API conventions, validation, security coding practices)
- Business rules/config: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §6 (Rating Rules)
- Global database schema: §3.1 `USERS`, §3.2 `SKILL_LEVELS`, §3.3 `PLAYER_PROFILES`, §3.13 `MATCHES`, §3.14 `MATCH_PLAYERS`, §3.16 `MATCH_GAMES`, §3.23 `PLAYER_RATINGS`, §3.22 `TOURNAMENT_MATCHES`
- Related feature docs: `docs/features/matchmaking/ratings/tech-design.md` (§7.4, §9.3 — aggregate summary with public-profile scope), `docs/features/platform/authentication-authorization/tech-design.md`, `docs/features/admin/user-management/prd.md`

## 7. Technical Design

### 7.1 Module and Layer Boundaries

Following `docs/architecture/conventions.md`:

- `backend/src/routes/players/profileRoutes.ts` — thin router.
- `backend/src/controllers/players/PlayerProfileController.ts` — HTTP translation.
- `backend/src/services/players/PlayerProfileService.ts` — authorization (self-only), validation orchestration, composition of profile + aggregates + statistics.
- `backend/src/repositories/players/PlayerProfileRepository.ts` — persistence/aggregate queries only.
- `backend/src/validation/players.ts` — Zod request-boundary schemas.
- Cross-module reads: reuse viewer-aware `RatingService` aggregate summary (no direct repository-policy bypass or duplicated rating logic); read `MATCHES`/`MATCH_PLAYERS`/`TOURNAMENT_MATCHES`.
- Frontend components under `frontend/src/features/player/profile/`.

### 7.2 Own Profile Read (`GET /players/me`)

1. `authenticate` → `requireRole('PLAYER')`.
2. Load `USERS` + `PLAYER_PROFILES` + `SKILL_LEVELS` for `req.user.id`.
3. Compose aggregate ratings (from the Ratings aggregate query) and match statistics.
4. Return the own-profile payload; `email` is **not** returned (Decision Log §21 #5), so the field set stays non-sensitive and consistent with the public card.

### 7.3 Own Profile Update (`PATCH /players/me`)

1. `authenticate` → `requireRole('PLAYER')` → CSRF.
2. Zod validates the required request field `fullName` (trimmed, 2–50 chars, mapped to `full_name`); `avatar_url` is set only by the avatar upload flow and must reference a file stored under the confirmed local `/uploads` path (Decision Log §21 #3).
3. The service uses `req.user.id` as the only target; the request body cannot contain a target id or an `avatarUrl`.
4. Update `PLAYER_PROFILES.full_name`; the Avatar upload endpoint (§9.5) is the only path that writes `avatar_url`.
5. Skill level, email, password, and status are not editable here.

### 7.4 Public Player Card (`GET /players/:id`)

1. `authenticate` → `requireRole('PLAYER')` (authenticated-only per PRD Decision #6).
2. Load the target player; if the user is not `ACTIVE`, is soft-deleted, or is not a `PLAYER`, respond as unavailable (`404 PLAYER_NOT_FOUND`) per PRD Decision #10.
3. Return an **allow-listed** projection only: `userId`, `fullName`, `avatarUrl`, `skillLevel` (`{ code, name, rank, description }`), aggregate ratings (or the not-enough-data state), and `matchesPlayed` + win/loss.
4. Never select/return `email`, `password_hash`, sessions, or contact fields.

### 7.5 Match Statistics Query

- `matchesPlayed`: count distinct qualifying matches for retained active participants using the domain predicates in §7.8 #3–#4. The UI label is “Trận hoàn tất”; this includes WALKOVER, excludes BYE, and does not assert physical attendance.
- Win/loss: derived from a recorded result.
- **Tournament Matches**: a result exists via `TOURNAMENT_MATCHES.winner_registration_id` (and `MATCH_GAMES`). Win/loss is computable there.
  - **Casual Matches**: no result is recorded in MVP (`docs/features/matchmaking/matchmaking/prd.md` §4/§8; `PROJECT_BRIEF.md` §3.1) → win/loss is unavailable for casual Matches.
  - By decision (Decision Log §21 #4), win/loss counts Tournament results only; the approved 2026-10-19 extension in §7.8 includes WALKOVER and excludes BYE. Casual Matches contribute to `matchesPlayed` only. `resultsAvailable` is true exactly when `wins + losses > 0`.
- Use aggregate `COUNT`/`SUM` queries; no raw-row loading.

### 7.6 Aggregate Ratings Composition

- Reuse the viewer-aware Ratings aggregate summary (`docs/features/matchmaking/ratings/tech-design.md` §9.3 and §23), including active-target restrictions and backend suppression of averages/distributions below three for another-Player views. Pass viewer identity/role through internal composition; never bypass policy with a raw public query.
- Apply the PRD minimum-ratings threshold (≥ 3 per dimension) for display; below it, return a `notEnoughData` state.
- No individual rater identity is ever returned.

### 7.7 Client/Server Boundary

- `PlayerProfilePage.tsx`: own profile view/edit form (display name, avatar), skill level, aggregate ratings, and statistics.
- `PlayerProfileModal.tsx`: reusable public player card for Matchmaking results and Tournament participant/bracket contexts.
- Transport stays in a feature API client; presentational components receive explicit props.
- Loading/empty/error/not-enough-data states per the PRD §9.

### 7.8 Figma-based implementation clarification (approved 2026-10-19)

Follow the screen adaptation matrix in [PRD §9.1](prd.md#91-figma-reference-and-implementation-mapping). Figma is a read-only visual reference for this work; no Figma modification is required before implementation. Keep the own-profile page/form and reusable public modal within the existing frontend feature boundary. Compose missing states from the platform UI patterns rather than copying unsupported Figma fields or inventing new data sources.

- Skill and attitude ratings render independently, with counts and the minimum-three threshold. Never substitute a FairPlay/community score.
- Show matches played and Tournament-only wins/losses, with a persistent scope note. Do not use `resultsAvailable` to imply complete casual-match results or calculate an overall win rate.
- Name updates use PATCH; avatar changes use the separate upload endpoint. An avatar-only change must not issue an empty PATCH. Present success/failure per operation: a failed name update does not roll back an avatar already persisted by upload. Do not promise atomic saving across the two endpoints.
- Update the displayed profile after each successful operation; preserve editable name input on a failed name save. Cancel does not undo an already successful avatar upload.
- Required UI variants and forbidden content are listed in PRD §9.1 and verified by PP-04/PP-05.

Approved by the human owner on 2026-10-19:

1. Return `skillLevel.description: string | null` from `SKILL_LEVELS.description` on both own/public reads. Null omits description text in the UI; do not hardcode a second catalog.
2. Set `resultsAvailable = (wins + losses > 0)`. It means at least one valid Tournament result, including WALKOVER, and never means all match outcomes are recorded.
3. Exclude BYEs; include resolved WALKOVERs in both `matchesPlayed` and win/loss, even if the underlying Match did not reach `COMPLETED`. Ordinary Tournament results require `COMPLETED`, `WINNER_DECLARED`, both registrations, and a winner equal to one of them. A WALKOVER requires both registrations and a winner equal to one of them. `NONE`, `UNRESOLVED`, and one-sided/BYE advancement do not create wins/losses. Casual matches count only in `COMPLETED`. Count each qualifying match once per actual participant; never add a WALKOVER twice if its Match is also completed.
4. Singles: map the winner to its registration player. Doubles: map `registration1_id`/`registration2_id` to participant `team_no` 1/2 in the retained `MATCH_PLAYERS` roster; credit each actual member once. Do not join only on registration `player_id` or use current mutable team membership to rewrite history. Exclude `LEFT` participants. Invalid winner/side mappings are data-integrity errors, not inferred losses. These are Profile projection rules; Tournament owns result/lifecycle writes.
5. Avatar controls explicitly state immediate persistence and show upload feedback; use “Lưu tên”/“Hủy” for the name form only. A saved avatar is not undone by cancel or a later name failure.

### 7.8.1 Historical frontend preview — superseded by §9.0

The user initially authorized hardcoded data for visual completion. That temporary `/profile` preview was replaced, with explicit authorization, by the identity-first live delivery in §9.0. There is no current sample provider, data persistence emulation or automatic sample fallback in the application.

The high-fidelity Figma P44 context supplies layout, typography and assets. Fixed cover artwork is decorative, not a new editable field; original SVGs/raster files are stored locally under `frontend/public/images/profile/`. The authorized scope adaptations in PRD §9.1 still govern fields and metrics.

### 7.9 Composition, mutation failures, and shared UI

- Ratings summary `totalRatings` maps to both dimension counts because each submitted rating contains both dimensions. For each dimension below three, return `average: null`, `notEnoughData: true`; otherwise return the average rounded to two decimals and `notEnoughData: false`. A failed summary query fails the profile read; do not fabricate zero/empty ratings. Do not forward distributions or individual rows.
- PATCH retains its existing full-profile response. Perform the name update and required DB-backed response composition within the same transaction, passing that transaction to repository reads; a composition failure before commit rolls back the name update. This supersedes §13's former single-statement/no-transaction assumption. Build the payload before committing. Network failure after commit is ambiguous: refetch to reconcile and do not claim rollback. A failed subsequent frontend refresh must not turn a successful mutation into a “save failed” message.
- Player header/name/avatar consume the same own-profile state as the profile page; refresh it after mutations. Do not infer the player's display name from email or expand Auth payload for this purpose. Profile-loading failures use a neutral fallback and error handling.
- Mutation responses only merge into the profile revision that initiated them. A late name/avatar response must not invalidate a newer reload or replace its data; the reload remains authoritative for reconciliation.
- Upload uses multipart field `avatar`, exactly one JPEG/PNG/WebP file ≤ 2 MB; validate actual file content as well as supplied metadata. Missing/multiple/invalid files use `400 VALIDATION_FAILED`. File and DB writes are not one transaction: write a unique new file, serialize pointer replacement on the caller's profile row in a DB transaction, and remove that new file if pointer update fails. After commit, return the committed URL; only clean the superseded file after verifying it is no longer current. Cleanup failure is logged for retry and must not report the committed upload as failed. Never delete another concurrent upload's current file.
- The shared HTTP client preserves browser-generated multipart boundaries for FormData while retaining cookies/CSRF and the JSON default for other bodies.
- Multipart parsing/actual image validation use the scoped Multer/Sharp selection in §9.6, replacing the earlier PP-06 tooling blocker. No unrestricted hand-rolled parser is used.

## 8. Behavior, State, and Flow

```text
GET /players/me         → own profile (editable fields + skill + aggregates + stats)
PATCH /players/me       → update full_name → updated profile (avatar only via §9.5 upload)
GET /players/:id        → if ACTIVE PLAYER: public card; else PLAYER_NOT_FOUND
```

- Preconditions: authenticated `PLAYER`.
- No state machine: profile update is a direct field update; there are no status transitions.
- Postconditions: the public card exposes only allow-listed fields; the own profile reflects saved values immediately.

## 9. API Design

### 9.0 Identity-first live delivery — approved 2026-10-19

The human owner approved connecting real profile identity/name edits before Ratings and upload are ready. This supersedes the earlier requirement to block all Profile API mounting on aggregate dependencies. Existing GET `/players/me`, GET `/players/:id`, and PATCH `/players/me` keep their paths/envelopes and identity allow-list, but `ratings` and `stats` are now nullable sections: null means the capability is not enabled/available in this delivery, not zero ratings, zero matches, or a successful empty query. No fabricated numbers are returned. Non-null sections keep their approved contracts. An enabled reader that fails still raises an error rather than silently returning null.

Production mounts the router with no Ratings reader and statistics disabled pending Tournament writer integration; both sections return null. Reads/name updates query real USERS/PLAYER_PROFILES/SKILL_LEVELS, and PATCH returns the actual updated identity with null sections. Transactional name update + response composition and self-only authorization still apply. Existing avatars are read from DB and served from the approved backend `/uploads` directory; the subsequent PP-06 completion (§9.6) adds validated upload writes. Vite proxies `/uploads` alongside `/api`.

`/profile` switches from the sample provider to the live provider shared with the Player header, scoped by authenticated user id. Header displays the real profile name/avatar/skill or a neutral loading/error fallback, never a fabricated rank or name derived from email. The frontend explicitly displays “Đánh giá chưa khả dụng” / “Thống kê chưa khả dụng” for null sections, separately from empty ratings/results. Avatar upload controls are enabled after PP-06 completion (§9.6) and update shared avatar state independently of name saves. No sample fallback is permitted on API failure. The prior preview authorization remains historical; it is no longer the `/profile` route behavior.


All paths under `/api/v1/`. Success `{ data: ... }`; errors `{ error: { code, message, details } }`.

### 9.1 GET `/api/v1/players/me`

- Auth: `authenticate` + `requireRole('PLAYER')`.
- Response `200`:

```json
{
  "data": {
    "userId": 5,
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "/uploads/avatars/5.png",
    "skillLevel": { "code": "AVERAGE", "name": "Trung bình", "rank": 4, "description": null },
    "ratings": { "skill": { "average": 3.75, "count": 12, "notEnoughData": false }, "attitude": { "average": 4.50, "count": 12, "notEnoughData": false } },
    "stats": { "matchesPlayed": 20, "wins": 6, "losses": 3, "resultsAvailable": true }
  }
}
```

- `ratings` returns `notEnoughData: true` when the count is below the threshold.

### 9.2 PATCH `/api/v1/players/me`

- Auth: `authenticate` + `requireRole('PLAYER')` + CSRF.
- Body: `{ fullName: string (2–50 after trim) }` — the **only** editable field through this endpoint. `avatarUrl` is **not** accepted here; it is written exclusively by the avatar upload flow (§9.5, Decision Log §21 #3).
- Response `200`: updated own-profile payload (same shape as §9.1).
- Errors: `400 VALIDATION_FAILED`; `401 AUTH_SESSION_INVALID`; `403 AUTH_FORBIDDEN_ROLE`.

### 9.3 GET `/api/v1/players/:id`

- Auth: `authenticate` + `requireRole('PLAYER')` (authenticated-only).
- Response `200`: allow-listed public card:

```json
{
  "data": {
    "userId": 9,
    "fullName": "Trần Thị B",
    "avatarUrl": null,
    "skillLevel": { "code": "GOOD", "name": "Khá / Giỏi", "rank": 6, "description": null },
    "ratings": { "skill": { "average": 4.20, "count": 8, "notEnoughData": false }, "attitude": { "average": null, "notEnoughData": true, "count": 2 } },
    "stats": { "matchesPlayed": 31, "wins": 10, "losses": 4, "resultsAvailable": true }
  }
}
```

- Errors: `400 VALIDATION_FAILED`; `401 AUTH_SESSION_INVALID`; `403 AUTH_FORBIDDEN_ROLE`; `404 PLAYER_NOT_FOUND`.

### 9.5 POST `/api/v1/players/me/avatar` (avatar upload)

- Operation: upload the authenticated Player's avatar and update only their `PLAYER_PROFILES.avatar_url`.
- Auth: `authenticate` + `requireRole('PLAYER')` + CSRF.
- Request: `multipart/form-data` with exactly one image file in field `avatar`; the target user is `req.user.id` (never from the form).
- Validation (Decision Log §21 #3): accepted types JPEG/PNG/WebP; maximum 2 MB; a safe, non-guessable stored filename is generated (the client filename is never trusted).
- Response `201`: `{ data: { avatarUrl: "/uploads/.../stored.png" } }`; the upload also writes `PLAYER_PROFILES.avatar_url`.
- Errors: `400 VALIDATION_FAILED` (unsupported type / oversize); `401 AUTH_SESSION_INVALID`; `403 AUTH_FORBIDDEN_ROLE`; `500 INTERNAL_ERROR`. The response exposes no filesystem paths or provider internals.
- Storage uses the confirmed local filesystem `/uploads` served by Express static middleware; scoped parser/decoder dependencies are listed in §9.6.

### 9.4 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Global Zod/validation failure at the boundary (body, params, avatar type/size). |
| `AUTH_SESSION_INVALID` | 401 | Missing/invalid session. |
| `AUTH_FORBIDDEN_ROLE` | 403 | Caller is not a `PLAYER`. |
| `PLAYER_NOT_FOUND` | 404 | Target player does not exist, or is not an active player (inactive/soft-deleted/non-player). |
| `INTERNAL_ERROR` | 500 | Unexpected error (global). |

### 9.6 Avatar implementation selection — 2026-10-19

Under the user's instruction to complete PP-03/PP-04/PP-05/PP-06, the implementation selects Multer 2.4.0 for bounded in-memory multipart parsing, Sharp 0.35.5 for actual image decode/normalization, and @types/multer 2.3.0 for development. This supersedes the earlier no-new-dependency/multipart-selection blocker for this feature; no cloud storage is added. Implementation references: [Multer](https://github.com/expressjs/multer), [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/). Exactly one `avatar` file is accepted; other fields/files are rejected. Inputs must be nonempty JPEG/PNG/WebP ≤ 2 MiB with matching declared/decoded format; Sharp fully decodes and normalizes the first image frame in the same format, strips metadata and limits decoded images to 16 million pixels as a technical resource bound. No user crop/resize feature is added.

Normalized bytes are written under `backend/uploads/avatars/` with a caller-id + random UUID filename; the DB pointer swap is serialized by locking that caller's profile row. New file writes occur inside the lock/transaction; failure rolls back the DB pointer and removes an unreferenced staged file. Commit success is reported independently of best-effort old-file cleanup. A periodic/startup sweep retries old unreferenced files (minimum age one hour), taking the same per-player row lock and rechecking all profile references before removal. It only handles generated avatar filenames. Test uploads use a process-specific temporary root, never development uploads. Filesystem/DB cannot form one atomic commit; the sweep also reclaims files left by a process crash. No in-memory coordination is used for pointer ownership.

PP-05 is delivered for current Matchmaking candidate, request-member, invitation and match-roster entry points; Tournament links remain pending in their owning module. Missing/inactive public profiles show unavailable; modal focus is trapped/restored and profile requests are cancelled on close/player change. Ratings/statistics remain explicitly null until their modules are ready.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. No new tables and no changes to `PLAYER_PROFILES` integrity.

- Existing objects used: §3.1 `USERS`, §3.2 `SKILL_LEVELS`, §3.3 `PLAYER_PROFILES`, §3.13 `MATCHES`, §3.14 `MATCH_PLAYERS`, §3.16 `MATCH_GAMES`, §3.22 `TOURNAMENT_MATCHES`, §3.23 `PLAYER_RATINGS`.
- Proposed projection uses no new indexes (Decision Log §21 #7):
  - `MATCH_PLAYERS (player_id, match_id)` already exists (§5.13) — sufficient for "matches played".
  - `MATCHES (status, scheduled_at)` already exists — supports the completed-match predicate.
- No schema change is required to read `PLAYER_PROFILES`; the editable columns (`full_name`, `avatar_url`) already exist.
- No new statistics index is added for MVP (Decision Log §21 #7); existing indexes are verified by `EXPLAIN` during implementation. If `EXPLAIN` shows the aggregates need more support, **stop and request a schema decision** (additive index + same-session `database-schema.md` update) instead of silently adding one.

## 11. Security

- **Authentication:** shared `authenticate` middleware (opaque session cookie `sid`).
- **Authorization:** `requireRole('PLAYER')`; own-profile mutation is restricted to `req.user.id` in the service; the body cannot carry a target id.
- **Output allow-listing:** the public card selects only `userId`, `fullName`, `avatar_url`, skill level, aggregates, and statistics. It never selects `email`, `password_hash`, `auth_sessions`, `court_owner_profiles`, or contact fields.
- **Inactive players:** non-`ACTIVE`/soft-deleted/non-player targets return `404 PLAYER_NOT_FOUND` (no enumeration of existence beyond that).
- **CSRF:** `PATCH` requires `X-CSRF-Token`.
- **Validation:** Zod at the boundary for body and params.
- **Sensitive data:** avatars are public files served from `/uploads`; avatars are uploaded through the approved local-storage flow (JPEG/PNG/WebP ≤ 2 MB) and validated at the boundary. Do not log PII; do not expose raw DB rows.
- **No internal leakage:** centralized error handler.

Dependency note: the Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware`, so Profile endpoints require a real signed-in `PLAYER` session. In `NODE_ENV=test`, API tests may still use the test-only `X-User-Id` header with a `PLAYER` row.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Target player does not exist | No row | `404 PLAYER_NOT_FOUND` | Not found. |
| Target is inactive / soft-deleted / not a Player | Status/role check | `404 PLAYER_NOT_FOUND` | Unavailable. |
| Invalid `fullName` (empty/length) | Zod | `400 VALIDATION_FAILED` | Field error. |
| PATCH body contains `avatarUrl` or an unknown field | Zod strict refine | `400 VALIDATION_FAILED` | `avatarUrl` is set only by the upload flow (§9.5). |
| Avatar upload with an unsupported type / oversize | Boundary validation | `400 VALIDATION_FAILED` | Nothing stored; no profile change. |
| PATCH with an empty body / missing `fullName` | Zod | `400 VALIDATION_FAILED` | Field error. |
| No ratings / below threshold | Aggregate count | `notEnoughData: true` | "Not enough data" state. |
| No completed matches | Aggregate count 0 | `matchesPlayed: 0`, win/loss 0 | Empty state. |
| Casual matches with no result | Result lookup | Counted in `matchesPlayed`; not in win/loss; `resultsAvailable` remains false unless at least one qualifying Tournament result exists | UI explains win/loss is partial. |

## 13. Concurrency / Idempotency

- **Own profile update:** last-write-wins on the caller's own name field, scoped to `req.user.id`; transaction rules follow §7.9. Avatar pointer replacement is serialized on that same row (§7.9).
- **Idempotency:** PATCH with the same values is naturally idempotent (no side effects).
- **Transaction boundary:** PATCH updates and DB-backed response composition share one transaction (§7.9); upload file/DB coordination and pointer serialization follow §7.9. Standalone profile GETs do not mutate data.
- No external callbacks and no payment/refund logic.

## 14. Performance

- Profile reads join a small number of tables by primary key.
- Match statistics use aggregate `COUNT`/`SUM` with existing indexes (`MATCH_PLAYERS (player_id, match_id)`; `MATCHES (status, scheduled_at)`).
- Aggregate ratings are computed by the Ratings aggregate query, which is already index-backed.
- No raw-row loading; responses are small.

## 15. Events / Notifications

- Event/notification behavior: `N/A — profile changes produce no notification`.
- Trigger and recipient: `N/A`.
- Delivery/retry: `N/A`.
- Background/scheduled processing: startup and hourly cleanup of stale unreferenced generated avatars, per §9.6.

### 15.1 Delivered file boundaries

- Shared profile read/transaction/Ratings port types: `backend/src/contracts/PlayerProfileRead.ts` (separate from the existing Matchmaking `PlayerProfileService` contract).
- SQL statistics: `backend/src/repositories/players/profile-statistics.ts`; identity/update primitives: `PlayerProfileRepository.ts` in the same folder.
- Router factory: `backend/src/routes/players/profileRoutes.ts`; production mounts identity/name/avatar independently with null aggregates. Supply a real transaction-aware Ratings adapter before enabling ratings, per §9.0.
- Frontend transport/types/hook/provider/page/card/modal/avatar form/styles: `frontend/src/features/player/profile/`; shared FormData transport handling: `frontend/src/shared/api/http-client.ts`.
- Tests: `backend/src/__tests__/player-profile.test.ts` and the isolated browser harness under `frontend/e2e/profile/`. Test doubles do not establish live Ratings/Tournament integration.

## 16. Testing Considerations

- **Unit:** self-only mutation; display-name validation; avatar upload validation (type/size); threshold logic (`notEnoughData`); statistics composition; win/loss partial-data behavior.
- **Integration/persistence:** allow-listed projection excludes `email`/`password_hash`/session fields; inactive/soft-deleted targets return `404`; aggregate counts correct.
- **API-level:** `200`/`201` shapes for all four endpoints; `400`/`401`/`403`/`404` per §9.4; CSRF on PATCH and upload; no PII in the public payload.
- **Critical E2E flow:** a Player updates their display name/avatar, then another Player opens their public card from Matchmaking and sees only non-sensitive fields with aggregate ratings/statistics.
- **Concurrency/idempotency:** repeated identical PATCH requests are stable and produce the same result.
- Framework: Vitest + Supertest against the separate test database (`docs/architecture/conventions.md`).

## 17. Migration / Rollout

- **Migration steps:** none required. No schema change and no new index for MVP (Decision Log §21 #7); if the `EXPLAIN` verification shows a need, stop and request a schema decision before adding any index.
- **Rollout sequencing:** endpoints/service first, then the frontend pages/components.
- **Backward compatibility:** additive feature; no change to registration or existing tables.
- **Rollback/recovery:** revert endpoints/routes; no data impact.

## 18. Alternatives Considered

- **A dedicated player-statistics table:** rejected for MVP (derivable from existing match data; adds a second source of truth).
- **Uploading avatars to cloud storage (S3/Firebase):** rejected; not approved in `tech-stack.md`, and the PRD confirms local filesystem storage.
- **Duplicating the aggregate-rating query inside the profile module:** rejected; the Ratings module owns the aggregate query and the public-aggregate scope.
- **Returning `email` on one's own profile:** rejected (Decision Log §21 #5); the field set stays non-sensitive.
- **Unauthenticated public profiles:** rejected by PRD Decision #6.

## 19. Observability / Monitoring

- Logs: `info` for profile updates (user id, fields changed) without logging values; never log PII.
- Metrics: `N/A — no approved metrics infrastructure`.
- Alerts/operational signals: `N/A`.

## 20. Acceptance / Verification Considerations

- **Given** an authenticated `PLAYER`
  **When** they call `GET /api/v1/players/me`
  **Then** the response contains their display name, avatar, skill level, aggregate ratings (with threshold state, rounded to 2 decimals), and match statistics, and does not contain `email`.

- **Given** an authenticated `PLAYER`
  **When** they call `PATCH /api/v1/players/me` with a valid `fullName`
  **Then** their own profile is updated and returned; no other user's profile is affected.

- **Given** an authenticated `PLAYER`
  **When** they call `PATCH /api/v1/players/me` with `fullName` of length 1 or 51 characters
  **Then** the request is rejected with `400 VALIDATION_FAILED`.

- **Given** an authenticated `PLAYER` and an existing `ACTIVE` Player with id X
  **When** they call `GET /api/v1/players/X`
  **Then** the response is an allow-listed public card containing no `email`, `password_hash`, or session data.

- **Given** a suspended/deactivated/soft-deleted Player or a non-Player user id
  **When** an authenticated Player requests that public card
  **Then** the response is `404 PLAYER_NOT_FOUND`.

- **Given** a Player with fewer than three received ratings in a dimension
  **When** their profile is viewed
  **Then** that dimension shows the not-enough-data state instead of an average.

- **Given** a Player with completed casual and Tournament matches
  **When** their statistics are shown
  **Then** the §7.8 qualification rules count completed casual matches and valid Tournament results including WALKOVER, exclude BYEs, credit each Doubles participant once, and set `resultsAvailable = (wins + losses > 0)`.

- **Given** a non-`PLAYER` authenticated user
  **When** they call any profile endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE`.

## 21. Decision Log

The original decisions were approved on 2026-09-27; the human owner approved the additions below on 2026-10-19. Status remains `Ready` for the approved design. PP-06 tooling readiness is tracked separately in §7.9 and Tasks.

| # | Question or decision | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `requireRole` casing/signature and Admin access to profile endpoints. | Human owner | `requireRole('PLAYER')` only for `/players/me` and `/players/:id`; Admin uses User Management and does not use these endpoints. | 2026-09-27 | RESOLVED |
| 2 | Cited `MATCH_PARTICIPANTS` does not exist. | Authoritative schema | Use `MATCH_PLAYERS` (§3.14). | 2026-09-27 | RESOLVED |
| 3 | Avatar handling (URL-only vs local upload). | Human owner + Tech Lead | Local `/uploads` storage (per PRD Decision #7 and `tech-stack.md`); avatars are uploaded through the feature's upload flow, validated as JPEG/PNG/WebP ≤ 2 MB; `avatar_url` references the stored file. No cloud storage. | 2026-09-27 | RESOLVED |
| 4 | Win/loss for casual Matches. | Human owner | Win/loss counts Tournament Matches only (recorded result); casual Matches contribute to `matchesPlayed` only; response includes `resultsAvailable`. | 2026-09-27 | RESOLVED |
| 5 | Whether `/players/me` returns the caller's own `email`. | Human owner | No; `email` is excluded from both own profile and public card. | 2026-09-27 | RESOLVED |
| 6 | Rating average rounding. | Tech Lead | Round to 2 decimals (consistent with the Ratings Tech Design §9.3). | 2026-09-27 | RESOLVED |
| 7 | Statistics index addition. | Tech Lead | No new index for MVP; use existing `MATCH_PLAYERS (player_id, match_id)` and `MATCHES (status, scheduled_at)`, verified by `EXPLAIN` during implementation. | 2026-09-27 | RESOLVED |
| 8 | Profile statistics and availability. | Human owner | PRD §14 #11–#12 and Tech Design §7.8 #2–#4: exclude BYE, include WALKOVER consistently, credit Doubles participants, boolean equals wins + losses > 0. | 2026-10-19 | RESOLVED |
| 9 | Skill description contract. | Human owner | Return nullable catalog description on both profile reads. | 2026-10-19 | RESOLVED |
| 10 | Avatar persistence and supporting logic. | Human owner | Immediate independent avatar save; name-only save/cancel; composition, upload consistency, and header rules in §7.9. No new dependency approval is implied. | 2026-10-19 | RESOLVED |
| 11 | Identity-first live integration. | Human owner | Mount real identity/name endpoints independently; nullable disabled aggregates, live shared header/provider and existing-avatar static reads per §9.0. Upload was initially disabled; decision #12 enables it. | 2026-10-19 | RESOLVED |
| 12 | Complete independent Profile tasks and select upload tooling. | User instruction + implementation selection | Complete PP-03/PP-04/PP-06 and Matchmaking portion of PP-05 using Multer/Sharp per §9.6; local storage stays unchanged, Tournament/Ratings integration remains separate. | 2026-10-19 | RESOLVED |

Product/contract clarifications and upload tooling are resolved. Upload is implemented per §9.5–§9.6; no additional infrastructure or schema change was introduced.

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27
Approved decision/reference: §21 Decision Log (2026-09-27, extended 2026-10-19)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.

## Ratings privacy alignment — approved 2026-10-15

Status remains Ready. Ratings Tech Design §9.3 is authoritative for viewer-aware aggregate access: own/Admin full aggregates, other-active-Player threshold suppression, inactive target 404. Profile maps null/masked aggregates to `{ average: null, count, notEnoughData: true }` per dimension and never reconstructs hidden distributions. Own Profile still applies its ≥3 display threshold. Cover direct summary calls and Profile composition in privacy tests; no second aggregate implementation is permitted.

## Optional phone slice — approved 2026-10-23 (PP-07)

- PLAYER_PROFILES.phone is nullable varchar(20), migration 0010 (verify next free journal entry). No backfill, unique constraint, verification state or phone login.
- Optional registration field `phone` is normalized/validated server-side and written in Auth's registration transaction. Omitted/blank/NULL persists NULL. Allow a leading +, 7–15 digits after removing spaces, parentheses and hyphens (raw input ≤40 characters); reject other characters. This is a technical input guard, not country/carrier validation.
- Add `GET /api/v1/players/me/contact` → `200 { data: { phone: string|null } }` and `PATCH /api/v1/players/me/contact` with strict body `{ phone: string|null }`, same response. Authenticated PLAYER only, self from session, CSRF on PATCH; no userId/email/name/avatar/role/status mutation. Missing profile → 404 PLAYER_NOT_FOUND; invalid phone → 400 VALIDATION_FAILED.
- Add `/profile/contact` in PlayerLayout for viewing/editing/clearing the private phone; link from existing player navigation. Optional input at registration. Existing public `GET /players/:id` and general own-profile contracts remain separate; these new contact endpoints do not claim PP-01–PP-06 completion or expose private phone on public cards.
- Owner schedule/detail join the stored current Player profile phone and existing fullName/email within ownership authorization. NULL is represented explicitly, never fabricated, logged or exposed in history summaries/public DTOs.
- Test omitted/format/invalid/clear, exact self targeting, wrong-role/CSRF and public-output exclusion; browser registration/contact edit then Owner detail verifies real data.

## Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

```text
Status: Ready
Decision Status: Approved
PRD: prd.md §15 (Ready, business scope)
Schema authority: docs/architecture/database-schema.md §13.8 (PLAYER_PROFILES columns)
```

- Fields: `activity_city`/`activity_district` (values from the shared facility address catalog, validated against it), `play_style` (`ATTACK | DEFENSE | ALL_ROUND | NET_CONTROL`, labels Tấn công / Phòng thủ / Toàn diện / Kiểm soát lưới), `bio` (trimmed, ≤ 300). All optional; `null` clears.
- API: the existing own-profile `PATCH` accepts the three fields (partial update; name-only merge behavior unchanged); own and public profile responses add them to the fixed allow-list. Email/phone stay private.
- Skill level remains read-only; no survey retake from the profile.
- Statistics: completed `GROUP` Matches count in "Trận hoàn tất" for `ACTIVE` participants at completion; verify `profile-statistics.ts` filters `MATCH_PLAYERS.status = 'ACTIVE'`.
- Entry points: the existing `PlayerProfileButton`/modal is reused from feed cards, applicant lists, member lists and conversations.
- Verification: field validation and clearing; public allow-list excludes email/phone; GROUP statistics; concurrency with avatar update keeps both changes.


### Final Phase 2 approval — 2026-10-31

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.
