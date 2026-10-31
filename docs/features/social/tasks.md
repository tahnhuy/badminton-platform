# Social Feed — Task List

Implementation tasks for the Social Feed feature.

- Linked PRD: [prd.md](prd.md) (Ready)
- Linked Tech Design: [tech-design.md](tech-design.md) (Ready)
- Schema: `docs/architecture/database-schema.md` §13 (Ready target delta)
- Cross-module order: [Matchmaking tasks — Social Matchmaking execution order](../matchmaking/matchmaking/tasks.md#social-matchmaking-extension--cross-module-execution-order)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named. Documents were approved Ready on 2026-10-31. Tasks with unfinished implementation dependencies remain BLOCKED; dependency-free foundation tasks are Approved.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete with automated tests that exist and pass.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| SOC-01 | Social and private-media schema migration | Approved | Ready docs | M |
| SOC-02 | Private media storage, cleanup job and authorized download | BLOCKED | SOC-01 | M |
| SOC-03 | Free post create/edit/delete with quotas and idempotency | BLOCKED | SOC-01, SOC-02, SC-12 | M |
| SOC-04 | Match-finding post creation through `RecruitmentPort` | BLOCKED | SOC-03, MM-23 | M |
| SOC-05 | Feed query, post detail and visibility rule | BLOCKED | SOC-01, MM-21 | M |
| SOC-06 | Reactions, comments and comment notification | BLOCKED | SOC-05, NTF-02 | M |
| SOC-07 | Admin hide of posts and comments | BLOCKED | SOC-05 | S |
| SOC-08 | Frontend feed, composer, post detail | BLOCKED | SOC-03…SOC-06 | L |
| SOC-09 | Social end-to-end, concurrency and authorization verification | BLOCKED | SOC-01…SOC-08, RP-08 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | SOC-01 | Ready docs |
| 2 | SOC-02 | SOC-01 |
| 3 | SOC-03, SOC-05 | SOC-02 / MM-21 |
| 4 | SOC-04, SOC-06, SOC-07 | MM-23, NTF-02 |
| 5 | SOC-08 | backend tasks |
| 6 | SOC-09 | all, including RP-08 after SOC-08/MSG-09 |

---

## [ ] SOC-01: Social and private-media schema migration

```text
Status: Approved
Size: M
Blocked by: None — relevant documents/schema targets Ready (human-approved 2026-10-31)
```

**Objective:** Create `MEDIA_FILES`, `POSTS`, `POST_IMAGES`, `POST_REACTIONS`, `POST_COMMENTS` exactly as in `database-schema.md` §13.1–§13.2.

**Scope**

- In scope: Drizzle schema, next ordered migration, CHECKs, partial indexes.
- Out of scope: recruitment columns (MM-21), Messaging tables (MSG-01).

**Implementation requirements**

1. Add tables, CHECKs and indexes; never edit earlier migrations.
2. Record application in `database-schema.md` change log after verification.

**Files/areas affected**

- `backend/src/db/schema/` (new `social.ts`, `media.ts`) `[Proposed — verify during implementation]`
- `backend/src/db/migrations/`

**API impact:** None.

**Schema/config impact:** §13.1, §13.2.

**Verification**

- Integration: CHECKs reject title on FREE, NULL `published_at` on FREE, `hidden_by` without `hidden_at`, body > 2000, comment blank after trim.
- Migration: applies on empty and populated test databases.

**Acceptance criteria**

- **Given** a migrated database **When** inserting a FREE post without `published_at` **Then** the CHECK rejects it.
- **Given** two comments with the same author and `client_request_id` **Then** the second insert fails on the unique index.

---

## [ ] SOC-02: Private media storage, cleanup job and authorized download

```text
Status: BLOCKED
Size: M
Blocked by: SOC-01
```

**Objective:** Shared private media service for Social and Messaging following `database-schema.md` §13.9 and Social Tech Design §7.4.

**Scope**

- In scope: `PRIVATE_UPLOADS_DIR` env validation; tmp → fsync → rename; row insertion API taking the caller's transaction; rollback cleanup; hourly GC; `GET /api/v1/media/:id` with owner resolvers; image pipeline with existing `multer`/`sharp`.
- Out of scope: file (non-image) validation (MSG-05); avatar storage.

**Implementation requirements**

1. `contracts/PrivateMediaService.ts` with `storeImages(files, ownerId, tx)` and `resolveAccess(mediaId, viewer)` delegating to registered resolvers (post image, message attachment, report evidence for Admin).
2. GC deletes only tmp files and row-less final files older than 1 hour; never a file with a row.
3. Missing file on download → mark `MISSING`, log, `404 MEDIA_NOT_FOUND`.

**Files/areas affected**

- `backend/src/shared/storage/private-media.ts`, `backend/src/repositories/media/`, `backend/src/jobs/` `[Proposed — verify during implementation]`
- `backend/src/shared/config/env.ts`, `.env.example`, `.gitignore`

**API impact:** `GET /api/v1/media/:id`.

**Schema/config impact:** New env var `PRIVATE_UPLOADS_DIR`.

**Verification**

- Unit: GC selection rules.
- Integration: rollback deletes the final file; simulated crash leaves an orphan removed after the grace period; file with a row never deleted.
- API: unauthorized, hidden-post and detached-image downloads return 404; headers `nosniff`, `private, no-store`, correct disposition.

**Acceptance criteria**

- **Given** a transaction that fails after the file rename **When** it rolls back **Then** the file is removed and no row exists.
- **Given** a media row referenced by report evidence **When** GC runs **Then** the file remains.
- **Given** the private root **When** requesting `/uploads/...` for a private file **Then** it is not served.

---

## [ ] SOC-03: Free post create/edit/delete with quotas and idempotency

```text
Status: BLOCKED
Size: M
Blocked by: SOC-01, SOC-02, SC-12
```

**Objective:** Implement free posts per Social Tech Design §7.2, §7.5, §8–§9.

**Scope**

- In scope: `POST /posts` (FREE), `PATCH /posts/:id`, `DELETE /posts/:id` (FREE); trim/limits; `SOCIAL_FREE_POSTS_PER_DAY` under the author's `USERS` lock; `clientRequestId` replay/conflict; `SOCIAL_FEED_ENABLED` gate.
- Out of scope: match-finding (SOC-04).

**Implementation requirements**

1. Replay check before quota; quota count includes deleted posts.
2. Edit keeps `published_at`; sets `edited_at`; removed images get `detached_at`.

**Files/areas affected**

- `backend/src/{routes,controllers,services,repositories}/social/`, `backend/src/validation/social.ts` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** Reads `SOCIAL_FREE_POSTS_PER_DAY`, `SOCIAL_FEED_ENABLED`.

**Verification**

- Unit: day boundary in `Asia/Ho_Chi_Minh`.
- Concurrency: parallel creates at the limit produce exactly the limit.
- API: replay returns same post, not counted; conflicting replay 409; Court Owner 403; gate off → 409 for create/edit, delete still allowed.

**Acceptance criteria**

- **Given** 10 free posts today, one deleted **When** creating another **Then** `429 SOCIAL_RATE_LIMITED`.
- **Given** a hidden post **When** its author edits **Then** `409 SOCIAL_POST_NOT_EDITABLE`.

---

## [ ] SOC-04: Match-finding post creation through `RecruitmentPort`

```text
Status: BLOCKED
Size: M
Blocked by: SOC-03, MM-23
```

**Objective:** One canonical flow that creates the post and its recruitment in one transaction, and author deletion through cancellation.

**Scope**

- In scope: `POST /posts` with `type = MATCH_FINDING`; optional `publish`; title; `DELETE /posts/:id?bookingAction=` delegating to `RecruitmentPort.cancelForAuthorDeletion`.
- Out of scope: recruitment validation logic (MM-23).

**Implementation requirements**

1. Any recruitment error rolls back post and media.
2. `bookingAction=CANCEL` returns Matchmaking's `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE` while MM-20 is blocked.

**Files/areas affected**

- `backend/src/services/social/`, `backend/src/contracts/RecruitmentPort.ts` `[Proposed — verify during implementation]`

**API impact:** `POST /posts`, `DELETE /posts/:id`.

**Schema/config impact:** None beyond SOC-01/MM-21.

**Verification**

- Integration: no post without recruitment and no recruitment without post after any failure.
- API: author deletion of an active post cancels the recruitment then hides; terminal post deletion only hides.

**Acceptance criteria**

- **Given** an invalid capacity **When** creating a match-finding post **Then** no `POSTS`, recruitment or media row exists.
- **Given** an active post with members **When** the author deletes it with `KEEP` **Then** the recruitment is `CANCELLED` (`AUTHOR_DELETED`), members are notified and the post is no longer visible.

---

## [ ] SOC-05: Feed query, post detail and visibility rule

```text
Status: BLOCKED
Size: M
Blocked by: SOC-01, MM-21
```

**Objective:** `GET /posts` and `GET /posts/:id` with the single `canView` rule (Tech Design §7.3, §7.6).

**Scope**

- In scope: filters, `asOf`, default exclusion of ended posts, `hasOpenSlots`, card projection batching, 404 masking.
- Out of scope: comments/reactions writes (SOC-06).

**Implementation requirements**

1. Order `published_at DESC, id DESC`; edits never reorder.
2. Unpublished posts visible only to host and Players with a PENDING/ACCEPTED row, with limited fields.

**Files/areas affected**

- `backend/src/repositories/social/`, `backend/src/services/social/` `[Proposed — verify during implementation]`

**API impact:** `GET /posts`, `GET /posts/:id`.

**Schema/config impact:** None.

**Verification**

- Integration: each filter; `asOf` excludes later posts; ended posts excluded by default and reachable by link when not hidden.
- API: hidden/deleted/unpublished return `404` to others; Court Owner 403.

**Acceptance criteria**

- **Given** a post published after `asOf` **When** fetching page 2 **Then** it is not included.
- **Given** an Admin-hidden post **When** a Player opens its link **Then** `404 SOCIAL_POST_NOT_FOUND`.

---

## [ ] SOC-06: Reactions, comments and comment notification

```text
Status: BLOCKED
Size: M
Blocked by: SOC-05, NTF-02
```

**Objective:** Reactions and flat comments with quotas and the author notification.

**Scope**

- In scope: `PUT/DELETE /posts/:id/reaction`; `GET/POST /posts/:id/comments`; `DELETE /comments/:id`; `SOCIAL_COMMENTS_PER_MINUTE`; `SOCIAL_POST_COMMENTED` notification in the same transaction.
- Out of scope: reports (RP-06).

**Implementation requirements**

1. Comment deletion by comment author or post author; soft delete.
2. Ended but visible match-finding posts accept comments and reactions.

**Files/areas affected**

- `backend/src/services/social/` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** Reads `SOCIAL_COMMENTS_PER_MINUTE`.

**Verification**

- Concurrency: concurrent reaction toggles converge to one row; 11 comments within 60 s → last rejected.
- Integration: notification rollback with comment; no notification for self-comment or reactions.

**Acceptance criteria**

- **Given** a comment by another Player **When** committed **Then** exactly one notification for the post author exists even if retried.
- **Given** a hidden post **When** commenting **Then** `404`.

---

## [ ] SOC-07: Admin hide of posts and comments

```text
Status: BLOCKED
Size: S
Blocked by: SOC-05
```

**Objective:** `POST /admin/posts/:id/hide` and `POST /admin/comments/:id/hide` (Admin only, idempotent).

**Scope**

- In scope: set `hidden_at`/`hidden_by`; recruitment, Match and booking untouched.
- Out of scope: report resolution (Report Management).

**Implementation requirements**

1. No call into Matchmaking state changes.

**Files/areas affected**

- `backend/src/routes/admin/` or `routes/social/admin` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** None.

**Verification**

- API: Player 403; repeated hide 200.
- Integration: after hiding a match-finding post, members can still withdraw and the host can still manage recruitment through Matchmaking routes.

**Acceptance criteria**

- **Given** a hidden match-finding post with a CONFIRMED Match **When** the scheduler reaches start **Then** the Match proceeds unchanged.

---

## [ ] SOC-08: Frontend feed, composer, post detail

```text
Status: BLOCKED
Size: L
Blocked by: SOC-03…SOC-06; route approval in frontend.md
```

**Objective:** Player UI per Social PRD §9 under `frontend/src/features/social/`.

**Scope**

- In scope: feed with filters and `asOf` paging with de-duplication; composer with image validation; post detail; reactions; comments; author edit/delete with match-finding cancel confirmation (only `KEEP` while MM-20 is blocked); all states (loading, empty, unavailable, ended, rate-limited, disabled).
- Out of scope: recruitment management screens (MM-29).

**Implementation requirements**

- Figma source mapping and exclusions: `docs/architecture/frontend.md`, "Social and Messaging — Figma alignment review, 2026-10-31". Feed 99:43349, free detail 99:43550; composer/state boards 99:44308; mobile feed/detail 99:45192 / 99:45274; native components 99:44860. Preserve the 1280px desktop three-column layout and 390px one-column reflow.
- Share the Matchmaking creation/detail composition with MM-29; Social owns content/reactions/comments, not a second recruitment form/API. RP-08 adds the shared report dialog; do not implement a duplicate report flow here.
- Add Cộng đồng entry to the existing Player shell when its route is approved. Do not replace `/`, clone a header per screen, fabricate the community-rules destination or copy sample filter results.
- Author-aware action menus, edit indicators, six reaction types, flat comments and unavailable/ended/gate states must come from real data. Gallery menus/states are overlays or variants, not permanently stacked product sections.
- Retain the draft on errors; use truthful loading instead of fabricated upload percentages. Authorized image display is shared with Messaging.

1. Authorized media component in `components/common/`.
2. Plain-text rendering.

**Files/areas affected**

- `frontend/src/features/social/`, `frontend/src/app/router.tsx`, `frontend/src/components/common/` `[Proposed — verify during implementation]`

**API impact:** Consumes SOC APIs.

**Schema/config impact:** None.

**Verification**

- Playwright at desktop 1280px and mobile 390px: filters actually exclude mismatched dates, role-specific menus, compose/edit/delete, image limits, neutral hidden/deleted detail; keyboard close/focus return for overlays.
- Compare implementation to the mapped Figma references; missing prototype links do not replace interaction testing.

- E2E (Playwright): publish free post with image, react, comment, delete; hidden content shows the neutral unavailable state.

**Acceptance criteria**

- **Given** active date/slot filters **When** the feed loads **Then** only matching server results appear, regardless of the sample cards drawn in Figma.
- **Given** the 390px viewport **When** reading and composing **Then** controls reflow without horizontal overflow and no desktop side rail blocks the feed.

- **Given** a failed publish **When** the error is shown **Then** the draft text and selected images remain.

---

## [ ] SOC-09: Social end-to-end, concurrency and authorization verification

```text
Status: BLOCKED
Size: M
Blocked by: SOC-01…SOC-08, RP-08
```

**Objective:** Cross-task regression and E2E after SOC-01…SOC-08. Quota races, replay, media authorization, Admin hide and author deletion are tested in their owning tasks (SOC-02, SOC-03, SOC-04, SOC-06, SOC-07); this task does not replace them.

**Scope**

- In scope: E2E flows; role matrix across all Social routes; gate behavior (Matchmaking §24.10 Social column) end to end.
- Out of scope: Messaging; per-task tests.

**Implementation requirements**

1. Tests under `backend/src/__tests__/` and `frontend/e2e/`.

**Files/areas affected**

- `backend/src/__tests__/social-*.test.ts`, `frontend/e2e/` (desktop/mobile Social and reporting flows) `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- All §20 cases automated.

**Acceptance criteria**

- **Given** the full suite **When** run against the test database **Then** every §20 case passes.

## Final Phase 2 review — approved 2026-10-31

PRD, Tech Design and the relevant schema targets are Ready under explicit human approval. This is documentation approval, not completion of implementation dependencies. Task checkboxes and DONE history are unchanged.

- SOC-01: include immutable creation_hash columns for posts/comments per schema §13.2; allow NULL only for legacy rows.
- SOC-03/SOC-04/SOC-06: hash the complete canonical initial payload (including recruitment and target post for comments); preserve it across edits; recheck replay under locks before quota. Test same key with changed title/time/slots/court and replay after editing.
- SOC-09: cover concurrent retries, authorization before replay and immutable original-payload comparison.
