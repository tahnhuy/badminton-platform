# Player Profile (Hồ sơ và thông tin cá nhân người chơi) — Task List

Implementation tasks for the Player Profile feature.

- Feature: Player Profile
- Domain: `features/player/profile`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 #1–#7)
- Business rules: `docs/business-rules-config-matrix.md` §1.2, §6
- Schema authority: `docs/architecture/database-schema.md` §3.1, §3.2, §3.3, §3.13, §3.14, §3.16, §3.22, §3.23

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. The Tech Design has no remaining open questions. Scope is bounded by `prd.md` and `tech-design.md`.
>
> **Environment note (Auth dependency).** The Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware` and enforces `requireRole`; the `[TEMP AUTH BYPASS]` no longer applies in development/production. Profile endpoints require a real signed-in `PLAYER` identity. In `NODE_ENV=test`, API tests may still supply an active `PLAYER` identity via the test-only `X-User-Id` header.
>
> **Cross-module dependency.** Aggregate ratings reuse the Ratings aggregate summary, whose public-profile scope was approved in the Ratings Tech Design §21 #11. That Ratings implementation (`docs/features/matchmaking/ratings/`) is not yet built, so tasks that need live aggregate data are marked `BLOCKED` on it. Match statistics depend on `MATCHES`/`MATCH_PLAYERS`/`TOURNAMENT_MATCHES` data, which also has no writer yet (Matchmaking/Tournament modules).
>
> **Avatar note.** Per Decision #3, avatars are uploaded to the confirmed local `/uploads` storage (JPEG/PNG/WebP ≤ 2 MB); no cloud storage or new dependency is added.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| PP-01 | Profile repository and data layer (own + public card, aggregates, match statistics) | Approved | — | M |
| PP-02 | Profile API — controller, routes, Zod validation, auth, output filtering | BLOCKED | PP-01, Auth module | M |
| PP-03 | Frontend profile service, types, and state integration | BLOCKED | PP-02 | S |
| PP-04 | Frontend own-profile page (`PlayerProfilePage.tsx`) with view + edit form | BLOCKED | PP-03 | L |
| PP-05 | Frontend public player card/modal (`PlayerProfileModal.tsx`) for Matchmaking/Tournament | BLOCKED | PP-03 | M |
| PP-06 | Avatar upload endpoint (local `/uploads`, type/size validation) | BLOCKED | PP-01, Auth module | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | PP-01 | — |
| 2 | PP-02, PP-06 | PP-01 / Auth module |
| 3 | PP-03 | PP-02, PP-06 |
| 4 | PP-04, PP-05 | PP-03 |

---

## [ ] PP-01: Profile repository and data layer (own + public card, aggregates, match statistics)

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Provide the persistence primitives for own-profile reads, public player-card reads with an allow-listed projection, aggregate rating composition, and derived match statistics (Tech Design §7.2, §7.5, §7.6, §10).

**Scope**

- In scope:
  - Own-profile read: `USERS` + `PLAYER_PROFILES` + `SKILL_LEVELS` for a given user id.
  - Public player-card read with an explicit allow-list projection (`userId`, `fullName`, `avatarUrl`, skill level, aggregates, statistics); never selects `email`, `password_hash`, or session fields.
  - Aggregate rating composition by reusing the Ratings aggregate query (no duplicated rating logic; threshold applied at the profile layer).
  - Match statistics: `matchesPlayed` from `MATCH_PLAYERS` join `MATCHES.status = 'COMPLETED'`; win/loss from Tournament results (`TOURNAMENT_MATCHES.winner_registration_id`); `resultsAvailable` flag.
  - Own-profile update for `full_name` / `avatar_url` (single-row update scoped by user id).
  - Repository must not throw HTTP errors.
- Out of scope:
  - HTTP controllers/routes/Zod (PP-02).
  - Avatar upload/file handling (PP-06).
  - Frontend (PP-03, PP-04, PP-05).
  - Any schema change (no new index per Decision #7).

**Implementation requirements**

1. Use Drizzle ORM (`backend/src/db`) with parameterized queries and explicit column selection; keep transaction context explicit where relevant.
2. Enforce the allow-list projection in SQL (`select`), not only in the mapping layer, so sensitive columns are never fetched.
3. Reuse the Ratings repository/service aggregate query rather than re-implementing rating math; apply the ≥ 3 threshold for display state.
4. Compute statistics with aggregate `COUNT`/`SUM`; do not load raw match rows. Use existing indexes (`MATCH_PLAYERS (player_id, match_id)`, `MATCHES (status, scheduled_at)`); verify with `EXPLAIN`.
5. Restrict the update to the caller's own row (`WHERE user_id = :userId`); no API for editing another user's profile.
6. Return repository-level results; do not throw HTTP errors.

**Files/areas affected**

- `backend/src/repositories/players/PlayerProfileRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/services/players/PlayerProfileService.ts` (read/compose helpers) `[Proposed — verify during implementation]`
- `backend/src/repositories/matchmaking/*` or shared match stats query `[Proposed — verify during implementation]`
- `docs/architecture/database-schema.md` (only if an index is added; not expected per Decision #7)

**API impact:** None.

**Schema impact:** None expected; the editable columns (`full_name`, `avatar_url`) already exist. No new index by decision; any later additive index requires a schema decision and a same-session schema-doc update.

**Verification**

- Unit: allow-list field mapping; threshold state (`notEnoughData`); statistics composition; win/loss partial-data behavior.
- Integration: own-profile and public-card queries return correct values; the public query never fetches `email`/`password_hash`/session fields; matches-played counts `COMPLETED` matches only; win/loss counts Tournament results only.
- API-level: N/A.
- E2E for a critical flow: N/A.
- Edge/failure/concurrency: player with no ratings/matches returns zeroed/empty states; inactive/soft-deleted target is detectable for the service to reject.
- Manual: `EXPLAIN` the stats query to confirm existing index usage.

**Acceptance criteria**

- **Given** a Player with a profile and skill level
  **When** the repository reads their own profile
  **Then** the result contains `fullName`, `avatarUrl`, skill level, aggregates, and statistics, and no email.

- **Given** a public card read
  **When** the query is inspected
  **Then** only allow-listed columns are selected and no `email`/`password_hash`/session column is fetched.

- **Given** a Player with completed casual and Tournament matches
  **When** statistics are computed
  **Then** `matchesPlayed` counts all `COMPLETED` matches and win/loss counts Tournament results only, with `resultsAvailable` reflecting partial data.

- **Given** a Player with fewer than three received ratings in a dimension
  **When** aggregates are composed
  **Then** that dimension returns the not-enough-data state (no average).

- **Given** an update request for a profile
  **When** the update runs
  **Then** only the row for the given `user_id` is modified.

---

## [ ] PP-02: Profile API — controller, routes, Zod validation, auth, output filtering

```text
Status: BLOCKED
Size: M
Blocked by: PP-01, Auth module
```

**Objective:** Expose `GET /api/v1/players/me`, `PATCH /api/v1/players/me`, and `GET /api/v1/players/:id` with Zod validation, `PLAYER`-only auth, and privacy-safe output.

**Scope**

- In scope:
  - The three JSON endpoints per Tech Design §9.1–§9.3.
  - Zod schemas: `:id` param (positive integer); PATCH body (`fullName` trimmed 2–50, required) — `avatarUrl` is **not** accepted on PATCH (it is written only by the PP-06 upload endpoint, Tech Design §9.5).
  - `authenticate` + `requireRole('PLAYER')` (variadic, uppercase) on the whole router.
  - Self-only mutation using `req.user.id`; the body cannot carry a target id or `avatarUrl`.
  - Public card returns `404 PLAYER_NOT_FOUND` for non-existent, inactive, soft-deleted, or non-`PLAYER` targets.
  - Error shape `{ error: { code, message, details } }`.
  - Mount the router in `app.ts`.
- Out of scope:
  - Repository/queries (PP-01).
  - Avatar file upload endpoint (PP-06, Tech Design §9.5).
  - Admin access (only `PLAYER`).
  - Frontend (PP-03, PP-04, PP-05).

**Implementation requirements**

1. Keep routes/controllers thin; delegate to `PlayerProfileService`.
2. Enforce the self-only rule in the service; never trust a client-supplied user id.
3. Apply the allow-list projection for the public card; the own profile must not return email (Decision #5).
4. Enforce `requireRole('PLAYER')` (Admin and other roles are denied).
5. Map errors per Tech Design §9.4; route unexpected failures through the centralized handler.

**Files/areas affected**

- `backend/src/validation/players.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/players/PlayerProfileController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/players/profileRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** Adds the three profile endpoints per Tech Design §9.1–§9.4.

**Schema impact:** None beyond PP-01.

**Verification**

- Unit: self-only enforcement; param/body validation; error-code mapping.
- Integration: controller returns the service result and never includes sensitive fields.
- API-level: `200` shapes for the three JSON endpoints; `400`/`401`/`403`/`404` per §9.4; CSRF on PATCH; no PII in the public payload.
- E2E for a critical flow: a Player updates their display name, then a second Player opens the public card (may use the test identity header until Auth lands).
- Edge/failure/concurrency: a PATCH with `avatarUrl`, an unknown field, or a missing `fullName` is rejected; the public card for an inactive target returns `404`.
- Manual: N/A.

**Acceptance criteria**

- **Given** an authenticated `PLAYER`
  **When** they call `GET /api/v1/players/me`
  **Then** the response returns their profile payload without email and never another user's data.

- **Given** an authenticated `PLAYER`
  **When** they call `PATCH /api/v1/players/me` with a valid `fullName`
  **Then** only their own profile is updated and the updated payload is returned.

- **Given** an authenticated `PLAYER` and an `ACTIVE` Player with id X
  **When** they call `GET /api/v1/players/X`
  **Then** the response is an allow-listed public card with no email/password/session data.

- **Given** a non-`PLAYER` authenticated user
  **When** they call any profile endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE`.

- **Given** an inactive/soft-deleted/non-Player target id
  **When** the public card is requested
  **Then** the response is `404 PLAYER_NOT_FOUND`.

- **Given** a `PATCH` body with `fullName` of length 1 or 51, `avatarUrl` included, or `fullName` missing
  **When** the request is validated
  **Then** the response is `400 VALIDATION_FAILED`.

---

## [ ] PP-03: Frontend profile service, types, and state integration

```text
Status: BLOCKED
Size: S
Blocked by: PP-02
```

**Objective:** Add the frontend API client, TypeScript types, and state/hooks for the profile endpoints so UI components consume a stable contract.

**Scope**

- In scope:
  - Feature API client for `GET /players/me`, `PATCH /players/me`, `GET /players/:id`.
  - TypeScript types for the own-profile and public-card payloads (skill level, aggregates with threshold state, statistics with `resultsAvailable`).
  - Feature hooks for loading/updating the own profile and fetching a public card.
  - Error-code mapping to user-facing messages.
- Out of scope:
  - UI rendering (PP-04, PP-05).
  - Backend changes.
  - Avatar upload client (covered with PP-06/PP-04 as applicable).

**Implementation requirements**

1. Keep transport in the feature API client, separate from presentational components.
2. Define explicit types matching the Tech Design §9 payloads; model the `notEnoughData` and `resultsAvailable` states.
3. Map backend error codes to clear messages; do not expose internals.
4. Provide hooks that expose loading/error/data and a mutation for PATCH with refetch-on-success.

**Files/areas affected**

- `frontend/src/features/player/profile/` `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/services/` `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/types/` `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes the PP-02 endpoints; no new contract.

**Schema impact:** None.

**Verification**

- Unit: type mapping; error-code message mapping; hook state transitions.
- Integration: API client maps request/response correctly and surfaces errors.
- API-level: N/A (client-side).
- E2E for a critical flow: N/A at this task.
- Edge/failure/concurrency: `notEnoughData` and empty statistics render states are represented; failed requests surface errors.
- Manual: N/A.

**Acceptance criteria**

- **Given** the profile API is available
  **When** a hook loads the own profile
  **Then** it returns typed data with loading/error state and no component-side ad hoc requests.

- **Given** the API returns `notEnoughData` or `resultsAvailable`
  **When** the hook resolves
  **Then** the typed payload preserves those flags for the UI.

- **Given** an API error code
  **When** a hook or client surfaces it
  **Then** a clear message is produced without exposing internals.

---

## [ ] PP-04: Frontend own-profile page (`PlayerProfilePage.tsx`) with view + edit form

```text
Status: BLOCKED
Size: L
Blocked by: PP-03
```

**Objective:** Build the own-profile page showing identity, skill level, aggregate ratings, and match statistics, with a form to edit display name and avatar.

**Scope**

- In scope:
  - `PlayerProfilePage.tsx` with view + edit modes.
  - Display: display name, avatar (or placeholder), skill level name/description, aggregate ratings (or not-enough-data state), matches played + win/loss with the partial-data note.
  - Edit form: display name (2–50 chars) and avatar (via the PP-06 upload flow); save calls PATCH.
  - Loading/empty/error/success states; field-level validation messages.
- Out of scope:
  - Public card/modal (PP-05).
  - Backend/upload endpoint implementation (PP-01/PP-02/PP-06).
  - Editing skill level, email, password, or status.

**Implementation requirements**

1. Keep API calls behind hooks; components receive explicit props.
2. Represent the not-enough-data and partial-results states clearly; never show averages below the threshold.
3. Enforce the 2–50 char display-name rule in the UI and rely on the server as the source of truth.
4. Wire the avatar control to the PP-06 upload flow and update `avatar_url` on success.
5. Apply loading/empty/error/success states; do not show empty while loading.

**Files/areas affected**

- `frontend/src/features/player/profile/` `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/pages/` (e.g., `PlayerProfilePage.tsx`) `[Proposed — verify during implementation]`
- `frontend/src/app/router.tsx` (route registration, if required) `[Proposed — verify during implementation]`

**API impact:** Consumes `GET/PATCH /api/v1/players/me` and the PP-06 avatar upload.

**Schema impact:** None.

**Verification**

- Unit: form validation (display name length, required field), rating/stat formatting, not-enough-data rendering.
- Integration: page loads and saves via hooks; avatar upload updates the preview.
- API-level: N/A.
- E2E for a critical flow: a Player edits their display name/avatar and sees the updated profile.
- Edge/failure/concurrency: invalid input shows a field error; a save failure keeps the form editable.
- Manual: Verify first-time (no avatar/ratings) and populated states.

**Acceptance criteria**

- **Given** an authenticated Player
  **When** the profile page loads
  **Then** it shows display name, avatar, skill level, aggregate ratings (or not-enough-data), and statistics.

- **Given** a valid display name
  **When** the Player saves
  **Then** PATCH is called, the profile refreshes, and a success confirmation is shown.

- **Given** a display name shorter than 2 or longer than 50 characters
  **When** the Player attempts to save
  **Then** submission is blocked with a field-level message.

- **Given** a Player with fewer than three ratings in a dimension
  **When** the page renders
  **Then** that dimension shows the not-enough-data state, not a number.

- **Given** a Player with completed casual and Tournament matches
  **When** statistics render
  **Then** matches played and win/loss are shown with a note that win/loss is partial.

---

## [ ] PP-05: Frontend public player card/modal (`PlayerProfileModal.tsx`) for Matchmaking/Tournament

```text
Status: BLOCKED
Size: M
Blocked by: PP-03
```

**Objective:** Build a reusable public player card/modal to view another Player's non-sensitive profile from Matchmaking results and Tournament participant/bracket contexts.

**Scope**

- In scope:
  - `PlayerProfileModal.tsx` consuming `GET /players/:id`.
  - Fields: display name, avatar (or placeholder), skill level, aggregate ratings (or not-enough-data), matches played + win/loss.
  - Entry points: clickable name/avatar in Matchmaking results and Tournament participant/bracket views.
  - Loading/empty/error/unavailable states.
- Out of scope:
  - Own-profile editing (PP-04).
  - Backend changes.
  - Unauthenticated access (requires a signed-in Player).

**Implementation requirements**

1. Keep the modal presentational and driven by props/data hooks; no duplicated business rules.
2. Render only non-sensitive fields; never attempt to display email or contact data.
3. Handle `404 PLAYER_NOT_FOUND` (inactive/missing) as an unavailable state.
4. Apply loading/empty/error states; opening the modal must not block the underlying screen.

**Files/areas affected**

- `frontend/src/features/player/profile/` `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/components/` `[Proposed — verify during implementation]`
- Matchmaking / Tournament feature entry points `[Proposed — verify during implementation]`

**API impact:** Consumes `GET /api/v1/players/:id`; no new contract.

**Schema impact:** None.

**Verification**

- Unit: modal rendering of public fields; not-enough-data and unavailable states.
- Integration: opening from Matchmaking/Tournament passes the correct player id and renders the card.
- API-level: N/A.
- E2E for a critical flow: a Player clicks a teammate's name in a Matchmaking result and views their public card.
- Edge/failure/concurrency: `404` shows an unavailable state; a slow request shows loading without blocking.
- Manual: Verify the modal from both Matchmaking and Tournament contexts.

**Acceptance criteria**

- **Given** an authenticated Player on a Matchmaking result or Tournament participant list
  **When** they click another Player's name/avatar
  **Then** the public card opens showing only non-sensitive fields.

- **Given** the target Player has no ratings or no completed matches
  **When** the card renders
  **Then** the not-enough-data and zero-stat states are shown correctly.

- **Given** the target is inactive or missing
  **When** the card is requested
  **Then** an unavailable state is shown (from the `404` response).

- **Given** the card is open
  **When** the underlying screen is used
  **Then** the modal does not block or mutate the underlying data.

---

## [ ] PP-06: Avatar upload endpoint (local `/uploads`, type/size validation)

```text
Status: BLOCKED
Size: M
Blocked by: PP-01, Auth module
```

**Objective:** Implement the avatar upload flow that stores a validated image in the confirmed local `/uploads` storage and returns the stored avatar URL for the profile.

**Scope**

- In scope:
  - The upload endpoint per Tech Design §9.5: `POST /api/v1/players/me/avatar` (multipart), restricted to the caller.
  - Validation: JPEG/PNG/WebP; maximum 2 MB (Decision #3; PRD #7).
  - Store the file under the `/uploads` area served by Express static middleware; return `{ data: { avatarUrl } }`.
  - Write `PLAYER_PROFILES.avatar_url` for `req.user.id` as part of the same operation (the only path that sets `avatarUrl`).
- Out of scope:
  - Cloud storage (S3/Firebase) or any new dependency.
  - Image editing/cropping or galleries.
  - Uploading avatars for other users.

**Implementation requirements**

1. Use the confirmed local filesystem `/uploads` storage and Express static serving; add no dependency beyond what is approved.
2. Validate content type and size at the boundary; reject unsupported types and oversized files.
3. Scope the write to `req.user.id`; the resulting `avatarUrl` updates only the caller's `PLAYER_PROFILES.avatar_url`.
4. Generate a safe, non-guessable stored filename; do not trust the client filename.
5. Map failures to the standard error shape; never expose filesystem paths or internals.

**Files/areas affected**

- `backend/src/routes/players/` (upload route) `[Proposed — verify during implementation]`
- `backend/src/controllers/players/` `[Proposed — verify during implementation]`
- `backend/src/services/players/` (file handling) `[Proposed — verify during implementation]`
- `backend/src/middleware/` (upload handling/limits) `[Proposed — verify during implementation]`
- `backend/src/app.ts` (static `/uploads` serving) `[Proposed — verify during implementation]`
- `frontend/src/features/player/profile/` (upload client, used by PP-04) `[Proposed — verify during implementation]`

**API impact:** Adds an avatar upload endpoint for the authenticated Player; response returns the stored `avatarUrl`.

**Schema impact:** Writes `PLAYER_PROFILES.avatar_url`; no schema change.

**Verification**

- Unit: content-type and size validation; filename sanitization; self-only scoping.
- Integration: a valid upload stores the file under `/uploads` and updates `avatar_url`; the file is served statically.
- API-level: success returns the stored URL; unsupported type/oversize returns `400 VALIDATION_FAILED`; non-`PLAYER` returns `403`.
- E2E for a critical flow: a Player uploads an avatar, sees it on their profile, and it appears on their public card.
- Edge/failure/concurrency: a rejected upload changes nothing; concurrent uploads leave a single current avatar.
- Manual: Verify the file is readable via the static path and the DB value points to it.

**Acceptance criteria**

- **Given** an authenticated `PLAYER`
  **When** they upload a JPEG/PNG/WebP image up to 2 MB
  **Then** the file is stored under `/uploads`, `PLAYER_PROFILES.avatar_url` is updated for their account only, and the stored URL is returned.

- **Given** an unsupported file type or a file larger than 2 MB
  **When** the upload is attempted
  **Then** the request is rejected with `400 VALIDATION_FAILED` and nothing is stored.

- **Given** a non-`PLAYER` authenticated user
  **When** they call the upload endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE`.

- **Given** a successful upload
  **When** the profile and public card are viewed
  **Then** the new avatar URL is reflected in both.

- **Given** the avatar is stored
  **When** it is requested via the static path
  **Then** the file is served and the response exposes no filesystem internals.
