# Player Profile (Hồ sơ và thông tin cá nhân người chơi) — Task List

Implementation tasks for the Player Profile feature.

- Feature: Player Profile
- Domain: `features/player/profile`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 #1–#12)
- Business rules: `docs/business-rules-config-matrix.md` §1.2, §6
- Schema authority: `docs/architecture/database-schema.md` §3.1, §3.2, §3.3, §3.13, §3.14, §3.16, §3.22, §3.23

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `PARTIAL`: the delivered subset is implemented/verified; remaining acceptance criteria are blocked and listed explicitly. This is not `DONE`.
- `BLOCKED`: remaining implementation cannot proceed; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. Scope is bounded by `prd.md` and `tech-design.md`. The human owner approved the 2026-10-19 clarifications in Tech Design §7.8–§7.9. Follow those decisions and the scoped upload implementation selection in Tech Design §9.6; the user authorized completing the independent PP-03/PP-04/PP-05/PP-06 work.
>
> **Environment note (Auth dependency).** The Auth module has landed. `backend/src/middleware/auth.middleware.ts` now delegates to the real session-based `shared/auth/authenticate.middleware` and enforces `requireRole`; the `[TEMP AUTH BYPASS]` no longer applies in development/production. Profile endpoints require a real signed-in `PLAYER` identity. In `NODE_ENV=test`, API tests may still supply an active `PLAYER` identity via the test-only `X-User-Id` header.
>
> **Cross-module dependency.** Aggregate ratings reuse the Ratings aggregate summary, whose public-profile scope was approved in the Ratings Tech Design §21 #11. That Ratings implementation (`docs/features/matchmaking/ratings/`) is not yet built, so tasks that need live aggregate data are marked `BLOCKED` on it. Matchmaking now has a repository and match/participant flows, including completion handling (`backend/src/repositories/matchmaking/MatchmakingRepository.ts`). Match statistics still require verification of persisted `COMPLETED` rows and Tournament result coverage; the presence of these flows does not prove all statistics dependencies are complete. Recheck Ratings and Tournament readiness when starting PP-01; do not substitute fixture averages for unavailable live data.
>
> **Avatar note.** Per Decision #3, avatars are uploaded to the confirmed local `/uploads` storage (JPEG/PNG/WebP ≤ 2 MB); no cloud storage is added. Multer/Sharp and their versions are recorded in Tech Design §9.6 and the tech-stack addition.

## Figma implementation review — 2026-10-19

The human owner approved these additions on 2026-10-19. Task dependency statuses below reflect remaining implementation prerequisites. These scope rules govern the implementation below; Figma itself remains unchanged.

- All frontend work follows [PRD §9.1](prd.md#91-figma-reference-and-implementation-mapping): use P04/P44/P85 visually, apply approved scope in code, and use P42 only as a navigation reference where appropriate.
- PP-01/PP-02/PP-03: implement nullable catalog description and `resultsAvailable = (wins + losses > 0)` per Tech Design §7.8. Verify current Ratings/Tournament dependencies rather than relying on the old “no writers” note.
- PP-04: adapt P44 to display name/avatar editing only; reuse P04 profile-card styling and P85 empty-data styling. Verify file help text (JPEG/PNG/WebP ≤ 2 MB), current catalog skill level, two independent rating states, zero statistics, and Tournament-only win/loss labels. Exclude the unsupported fields/metrics listed in PRD §9.1.
- PP-04/PP-06: verify avatar-only edits do not send an empty PATCH; a successful upload followed by failed name save remains visibly uploaded; cancel does not imply rollback of a completed upload.
- PP-05: compose the public modal from existing profile/modal patterns without waiting for a dedicated Figma frame. Verify entry points in Matchmaking and Tournament, loading/retry/unavailable states, aggregate-only ratings, and absence of email/contact/edit controls.
- PP-04/PP-05 manual review: compare spacing, typography, colors, cards, and controls with the cited frames. Record intentional content adaptations against PRD §9.1 rather than treating unsupported Figma content as an implementation requirement.

## Approved logic verification — 2026-10-19

- PP-01: verify casual completed-only counts; BYE exclusion; WALKOVER counted once even when the underlying Match is completed; winner/loser credit to both Doubles participants from historical roster sides; cancelled/unresolved non-WALKOVER exclusion; no-result versus read-error distinction. Verify zero results and mixed casual/Tournament data for `resultsAvailable`.
- PP-01/PP-03: map Ratings `totalRatings` into both dimension counts; verify counts 0/2/3, nullable averages below threshold, explicit `notEnoughData`, and nullable catalog description. Do not fabricate live data when a dependency is unavailable.
- PP-02: name update and response composition share the transaction; verify composition failure rolls back the update. Verify refetch/reconciliation after ambiguous network failure; frontend refresh failure must not overwrite mutation success feedback.
- PP-04: separate immediate avatar controls from the name-only save/cancel form; verify header name/avatar updates from shared Profile state without changing Auth contracts. Use “Trận hoàn tất” and Tournament-only win/loss labels.
- PP-06: use the selected bounded Multer/Sharp implementation in Tech Design §9.6. Verify exactly one `avatar` file, actual-content validation, bounded size, FormData boundaries/cookie/CSRF handling, file-write/DB failures, and concurrent pointer replacement/cleanup. Cleanup failure after commit must not masquerade as failed upload.
- Final feature completion requires real Ratings composition and verified Tournament result/roster integration; pure repository/UI work may be developed independently but does not satisfy all PP-01/feature acceptance criteria.

## Delivery status — 2026-10-19

**PP-03, PP-04 and PP-06 are DONE for the approved identity-first contract; PP-05 Matchmaking is DONE, with the Tournament portion still blocked.** Real name/avatar reads and updates persist in DB and are shared with the header. Upload uses bounded multipart + decoded image validation, local random filenames, serialized pointer replacement and stale-file retry cleanup. Candidate, partial-group, invitation and match-roster names/avatars open the real public modal. No sample data is returned. Ratings/statistics remain null under §9.0 until their owning modules are ready; this is the approved phased contract, not an unimplemented frontend state. Root `/` is unchanged.

### Independent task completion — 2026-10-19

- PP-03 DONE: typed name/avatar/public transport, cookie/CSRF/FormData behavior, shared page/header state, independent read/error/retry/cancellation states, and race-safe field-scoped name updates (a delayed name response cannot overwrite a newly uploaded avatar).
- PP-04 DONE: live name/avatar page, immediate-upload feedback, name-only cancel, invalid-name/image validation, server-error reconciliation, persisted images/names after reload, header synchronization and responsive UI. Nullable unavailable ratings/statistics are rendered correctly.
- PP-05 Matchmaking DONE: candidate list, request members, invitation counterparts and match roster open `PlayerProfileModal`; missing/inactive targets, request cancellation, focus trap/return, nullable aggregates and absence of edit/contact fields are verified. Tournament entry points remain blocked until that UI exists. The full original PP-05 remains PARTIAL for this reason.
- PP-06 DONE: one `avatar` multipart file ≤ 2 MiB; JPEG/PNG/WebP signature + MIME + actual full decode validation; pixel bound and metadata-stripping normalization; safe UUID filenames; self-only active Player + CSRF; write/DB rollback handling; concurrent upload correctness; cleanup failures do not undo committed success, and the startup/hourly sweep retries stale unreferenced generated files under the same row lock.
- Remaining full-feature work: real two-dimension Ratings adapter/schema, enabling validated Tournament statistics, and Tournament modal entry points. These do not block live identity/avatar management or Matchmaking public cards.


### Visual completion — 2026-10-19

- Implemented from high-fidelity Figma P44 context and its screenshot, with the approved P04/P85 profile content adaptations: 384/800 two-column layout at 1280px, 32px gutters, white rounded cards, original type scale, identity cover/avatar crop, form fields, name-only save bar, readonly catalog skill card, and separate aggregate-rating panels.
- Added dedicated `/profile` (authenticated PLAYER), a top-right shortcut beside the notification bell, and a profile item in the account dropdown. Existing root/dashboard stays unchanged.
- Downloaded original Figma raster/SVG assets to `frontend/public/images/profile/`; icons keep intrinsic SVG dimensions. Cover is fixed decorative artwork, with no cover-edit field. Sample avatar is preview data; user-uploaded preview images remain dynamic. No ELO, reputation score, contact fields, federation endorsements or extra editable fields were introduced.
- Compared actual desktop (1280px) and mobile (390px) screenshots against the target composition; checked visible images decode and mobile has no horizontal overflow. Existing shared header/footer visual differences are outside this profile layout change.
- The initial UI-only preview has been superseded by real identity/name integration. The design and original assets remain; no sample identity/scores are shown on `/profile`.


| Task | Status | Delivered | Remaining |
| --- | --- | --- | --- |
| PP-01 | PARTIAL | Identity projection/update, statistics query and injected composition are tested. | Real Ratings aggregate and Tournament writer/statistics integration. |
| PP-02 | PARTIAL | Mounted identity/name/public API plus upload authorization are live; real cookie/CSRF sessions verified. | Enabling non-null aggregates after PP-01 dependencies. |
| PP-03 | DONE (current contract) | Name/avatar/public clients, shared state/header sync, nullable sections and error/race handling. | Future module integrations use the same contract; no independent frontend blocker remains. |
| PP-04 | DONE (current contract) | Live Figma-adapted name/avatar page, validation/feedback, reload persistence and header sync. | Ratings/statistics values remain unavailable per approved §9.0. |
| PP-05 | PARTIAL — Matchmaking DONE | Real modal wired into all current Matchmaking player contexts; public fields/accessibility/error behavior verified. | Tournament UI entry points. |
| PP-06 | DONE | Multipart parsing, actual image validation, filesystem/DB coordination, cleanup worker and real end-to-end upload. | None within approved scope. |

### Verification evidence

- Backend: `npm test --prefix backend -- --run src/__tests__/player-avatar.test.ts src/__tests__/player-profile.test.ts` — 37 tests passed on `badminton_test`. Includes real PNG/JPEG/WebP upload/serving/public avatar reads, malformed/spoofed/oversized/pixel-bound inputs, auth/CSRF, extra files/fields, DB/file failures, concurrent replacement and cleanup retry. Full statistics tests use an explicit Ratings test reader; no live aggregate implementation is implied.
- Browser components: `npm exec --prefix frontend -- playwright test --config frontend/playwright.profile.config.ts` — 14 tests passed on review, including delayed name/parallel avatar response ordering, reloads during in-flight mutations, modal Tab/Shift+Tab focus containment/restoration, and server-upload rejection preserving the current avatar.
- Real backend/browser: `npm exec --prefix frontend -- playwright test --config frontend/playwright.profile-live.config.ts` — 2 tests passed with no API interception: real session/CSRF, name/avatar persistence, static serving and header sync after reload/cancel; real Matchmaking candidate → public card shows the uploaded avatar and returns keyboard focus without changing invitations.
- Current Matchmaking regression/profile entry points (D11, 19/11/2026): `npm exec --prefix frontend -- playwright test --config frontend/playwright.sign-in.config.ts matchmaking-detail-ui.spec.ts` — 10 tests passed, covering invitations, applications, candidates, member profile entry points and confirmation guards. The old `matchmaking.spec.ts`/`playwright.matchmaking-profile.config.ts` suite referred to the retired pre-Social flow (9/9 failures on baseline); it was replaced and removed. Leave-match coverage remains with the dedicated match-detail tests and the D12 review. See `docs/architecture/plans/refactor_FE_add_lib/reviews/D11-recruitment-detail.md`.
- DB suites must run sequentially with the live browser suite, which resets `badminton_test`. Test upload storage is process-specific under the OS temp directory, separate from development avatars.
- Backend/frontend builds pass; frontend lint has pre-existing warnings and the production bundle retains its existing size warning. npm audit reports existing toolchain/transitive findings; no Multer/Sharp finding was reported. No unrelated audit fixes were applied.
- EXPLAIN runs with existing indexes on the small statistics fixture; representative production-size performance remains a future check before enabling full statistics.

### Review against main — 2026-10-19

- Fixed late name/avatar mutation responses invalidating a newer profile reload; added both browser regression cases.
- Fixed initial Shift+Tab escaping the public-profile dialog through the shared modal hook; verified focus wrapping and restoration.
- Full backend suite: `npm test --prefix backend` — 256 tests passed across 19 files. Profile browser suite: 14 passed. Matchmaking browser suite: 9 passed. Backend/frontend builds and frontend lint pass, with existing lint and bundle-size warnings.
- Corrected stale notes about upload availability, avatar cleanup scheduling, Ratings mounting requirements, and Auth’s link to Profile ownership.

### Remaining module integration

1. Deliver Ratings two-dimension schema/aggregate in its own feature and a transaction-aware `ProfileRatingsReader` adapter; do not duplicate rating math in Profile.
2. Verify Tournament writers/retained participant sides and result links, then enable statistics with writer-to-Profile tests.
3. Add public-modal entry points when Tournament participant/bracket UI exists.
4. Keep null sections until their real integrations pass; do not substitute fabricated scores/counts. Identity/avatar flows are already live.

## Summary

| ID | Title | Status | Remaining dependency | Size |
| --- | --- | --- | --- | --- |
| PP-01 | Profile repository and data layer | PARTIAL | Ratings/Tournament integration | M |
| PP-02 | Profile API | PARTIAL | Non-null aggregate integration | M |
| PP-03 | Frontend profile service, types, and state | DONE | None for current contract | S |
| PP-04 | Own-profile page | DONE | None for current contract | L |
| PP-05 | Public player modal | PARTIAL — Matchmaking DONE | Tournament UI | M |
| PP-06 | Avatar upload | DONE | None | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | PP-01 identity primitives | Delivered; non-null aggregate integration remains separate |
| 2 | PP-02 identity + PP-06 | Delivered; Auth and scoped multipart/decoder selection satisfied |
| 3 | PP-03 | DONE against current nullable-section contract |
| 4 | PP-04, PP-05 Matchmaking | DONE; PP-05 Tournament portion waits for its UI |

---

## [ ] PP-01: Profile repository and data layer (own + public card, aggregates, match statistics)

```text
Status: PARTIAL
Size: M
Remaining blocked by: Ratings aggregate implementation; Tournament writer integration
```

**Objective:** Provide the persistence primitives for own-profile reads, public player-card reads with an allow-listed projection, aggregate rating composition, and derived match statistics (Tech Design §7.2, §7.5, §7.6, §10).

**Scope**

- In scope:
  - Own-profile read: `USERS` + `PLAYER_PROFILES` + `SKILL_LEVELS` for a given user id.
  - Public player-card read with an explicit allow-list projection (`userId`, `fullName`, `avatarUrl`, skill level, aggregates, statistics); never selects `email`, `password_hash`, or session fields.
  - Aggregate rating composition by reusing the Ratings aggregate query (no duplicated rating logic; viewer-aware public suppression at the Ratings service and display threshold additionally applied by Profile).
  - Match statistics: retained participants plus Tech Design §7.8 domain predicates; include valid WALKOVERs, exclude BYEs; credit Tournament results by roster side; `resultsAvailable = (wins + losses > 0)`.
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
- Integration: own-profile and public-card queries return correct values; the public query never fetches `email`/`password_hash`/session fields; match counts use §7.8 predicates (including WALKOVER, excluding BYE); win/loss counts valid Tournament results only.
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
  **Then** the domain-specific predicates in Tech Design §7.8 determine match counts, and BYEs are excluded, WALKOVER contributes one match and win/loss per participant, and `resultsAvailable` equals `wins + losses > 0`.

- **Given** a Player with fewer than three received ratings in a dimension
  **When** aggregates are composed
  **Then** that dimension returns the not-enough-data state (no average).

- **Given** an update request for a profile
  **When** the update runs
  **Then** only the row for the given `user_id` is modified.

---

## [ ] PP-02: Profile API — controller, routes, Zod validation, auth, output filtering

```text
Status: PARTIAL
Size: M
Remaining blocked by: full aggregate integration; identity API is mounted and real-session tested
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

## [x] PP-03: Frontend profile service, types, and state integration

```text
Status: DONE
Size: S
Remaining blocked by: N/A — completed for the approved current contract
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

## [x] PP-04: Frontend own-profile page (`PlayerProfilePage.tsx`) with view + edit form

```text
Status: DONE
Size: L
Remaining blocked by: N/A — completed for the approved current contract
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
Status: PARTIAL
Size: M
Remaining blocked by: Tournament participant/bracket UI only; Matchmaking scope complete
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
  **When** the card is opened and closed
  **Then** background polling/data remain unaffected, no invitation/group mutation occurs, and focus returns to the trigger (the open modal traps focus as expected).

---

## [x] PP-06: Avatar upload endpoint (local `/uploads`, type/size validation)

```text
Status: DONE
Size: M
Remaining blocked by: N/A — completed for the approved current contract
```

**Objective:** Implement the avatar upload flow that stores a validated image in the confirmed local `/uploads` storage and returns the stored avatar URL for the profile.

**Scope**

- In scope:
  - The upload endpoint per Tech Design §9.5: `POST /api/v1/players/me/avatar` (multipart), restricted to the caller.
  - Validation: JPEG/PNG/WebP; maximum 2 MB (Decision #3; PRD #7).
  - Store the file under the `/uploads` area served by Express static middleware; return `{ data: { avatarUrl } }`.
  - Write `PLAYER_PROFILES.avatar_url` for `req.user.id` as part of the same operation (the only path that sets `avatarUrl`).
- Out of scope:
  - Cloud storage (S3/Firebase) or dependencies beyond the scoped selection in Tech Design §9.6.
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

## Ratings dependency alignment — approved 2026-10-15

Consume Ratings RT-03 viewer-aware aggregate contract, including `notEnoughData`, null averages/distributions below three for another Player, and inactive-target 404. Do not use an unrestricted aggregate query when composing public Profile. Preserve own-profile three-rating display threshold. Add privacy verification at API and composed-profile boundaries when executing the existing profile tasks; task completion statuses are unchanged.

## [x] PP-07: Optional private phone collection/editing for Court Owner contact

Status: DONE. Approved by human owner choice B, 2026-10-23. Depends on existing Auth; independent of aggregate/rating/avatar work.

Implement schema migration + optional registration phone + own-contact GET/PATCH + `/profile/contact` UI, per Tech Design “Optional phone slice”. Verify normalization, validation, NULL clearing, self-only/role/CSRF, no phone in public summaries and registration/Auth regressions. End-to-end acceptance includes editing the number and displaying it only in the owning court operator's booking detail. Do not mark other Profile tasks complete.

PP-07 verification 2026-10-23: optional-contact/Auth regression 23/23; latest focused Owner/Booking/contact regression 79/79; Court Owner browser E2E 2/2 includes registration phone, self-edit, actual scoped Owner detail and NULL clearing. Migration 0010 applied only to test DB. No other Profile tasks are marked complete.

---

# Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

Governing design: Tech Design "Social Matchmaking extension" (Ready). PP-01…PP-07 keep their status.

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| PP-08 | Profile fields (area, play style, bio) and GROUP statistics | Approved | Extension Ready | M |
| PP-09 | Profile UI fields and new entry points | BLOCKED | PP-08, SOC-08, MSG-09 | M |

## [ ] PP-08: Profile fields and GROUP statistics

```text
Status: Approved
Size: M
Blocked by: None — documents Ready, human-approved 2026-10-31
```

**Objective:** Add the three optional fields and count GROUP Matches in statistics.

**Scope**

- In scope: migration; PATCH validation (catalog values, enum, ≤ 300 trimmed, `null` clears); own/public allow-list; `profile-statistics.ts` ACTIVE filter check.
- Out of scope: UI.

**Implementation requirements**

1. Partial update must not overwrite concurrent avatar changes (existing rule).

**Files/areas affected**

- `backend/src/validation/`, `backend/src/services/players/`, `backend/src/repositories/players/`, `backend/src/db/migrations/` `[Proposed — verify during implementation]`

**API impact:** Profile PATCH and GET fields.

**Schema/config impact:** §13.8.

**Verification**

- API: invalid district, invalid play style, 301-char bio rejected; public card omits email/phone.

**Acceptance criteria**

- **Given** a completed GROUP Match **When** a participant views statistics **Then** "Trận hoàn tất" includes it; a LEFT member's count excludes it.

## [ ] PP-09: Profile UI fields and new entry points

```text
Status: BLOCKED
Size: M
Blocked by: PP-08, SOC-08, MSG-09
```

**Objective:** Edit/display fields and open the public profile from feed, applicants, members and conversations.

**Scope**

- In scope: `/profile` form; public modal fields; `PlayerProfileButton` reuse.
- Out of scope: new profile pages.

**Implementation requirements**

- Social 99:43550 / 99:44134 and Messaging 99:45426 show profile/message entry points. Reuse PlayerProfileButton and its focus-return behavior; never reuse Figma sample emails, ranks or self-target controls.

1. Reuse the existing modal; no duplicate component.

**Files/areas affected**

- `frontend/src/features/player/profile/`

**API impact:** None new.

**Schema/config impact:** None.

**Verification**

- E2E: open/close the same public-profile modal from feed author, applicant/member and direct conversation; verify correct target and restored trigger focus.

- E2E: edit and clear fields; open profile from a feed card.

**Acceptance criteria**

- **Given** a profile entry for the current Player **Then** no self-message action is offered; other-Player messaging is gated by current permissions.

- **Given** a cleared bio **When** saved and reloaded **Then** no bio is shown.
