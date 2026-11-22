# Social Feed — Task List

## Task completion review — 2026-11-01

Review requested by the owner. The per-task review notes below supersede older implementation-progress blockers only where explicitly stated. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Test-only BlockPort coverage is not production Messaging integration. Shared schema/document PR review before merge is unchanged. No governing business choice is approved by changing task status.

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
| SOC-01 | Social and private-media schema migration | IN_PROGRESS | Ready docs | M |
| SOC-02 | Private media storage, cleanup job and authorized download | IN_PROGRESS | SOC-01 | M |
| SOC-03 | Free post create/edit/delete with quotas and idempotency | DONE | SOC-01, SOC-02, SC-12 | M |
| SOC-04 | Match-finding post creation through `RecruitmentPort` | IN_PROGRESS | SOC-03, MM-23 (creation); MM-25, MM-31 (active-post deletion and member notification) | M |
| SOC-05 | Feed query, post detail and visibility rule | IN_PROGRESS | SOC-01, MM-21 | M |
| SOC-06 | Reactions, comments and comment notification | DONE | SOC-05, NTF-02 | M |
| SOC-07 | Admin hide of posts and comments | DONE | SOC-05 | S |
| SOC-08 | Frontend feed, composer, post detail | IN_PROGRESS | SOC-03…SOC-06; RP-08 report entry remains | L |
| SOC-09 | Social end-to-end, concurrency and authorization verification | BLOCKED | SOC-01…SOC-08, RP-08 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | SOC-01 | Ready docs |
| 2 | SOC-02 | SOC-01 |
| 3 | SOC-03, SOC-05 | SOC-02 / MM-21 |
| 4 | SOC-04, SOC-06, SOC-07 | MM-23, NTF-02; SOC-04 active-post deletion also MM-25, MM-31 |
| 5 | SOC-08 | backend tasks |
| 6 | SOC-09 | all, including RP-08 after SOC-08/MSG-09 |

---

## [ ] SOC-01: Social and private-media schema migration

**Completion review (2026-11-01):** Keep IN_PROGRESS: schema/migration checks are implemented, but the explicitly required teammate review of the creation_hash trigger/schema PR is not evidenced. This agent review does not impersonate the other team member.

```text
Status: IN_PROGRESS
Size: M
Blocked by: None — relevant documents/schema targets Ready (human-approved 2026-10-31)
```

**Objective:** Create `MEDIA_FILES`, `POSTS`, `POST_IMAGES`, `POST_REACTIONS`, `POST_COMMENTS` exactly as in `database-schema.md` §13.1–§13.2.

**Implementation status (2026-11-01, not DONE):** migration `0011_social_media_foundation`, `backend/src/db/schema/media.ts`, `social.ts`; changelog recorded in `database-schema.md`. `social-step1-migrations.test.ts` passed (fresh/populated scratch DBs, every CHECK/unique case in Verification, creation_hash immutability). Missing before DONE: full backend regression run after the change (skipped at the owner's request), teammate review of the creation_hash trigger and schema PR.

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

**Completion review (2026-11-16):** Keep IN_PROGRESS: the post-image resolver exists and denies detached/hidden images; RP-07 now registers the Admin report-evidence resolver. The message-attachment resolver remains with MSG-04, so the shared media task cannot be closed as a whole.

```text
Status: IN_PROGRESS
Size: M
Blocked by: SOC-01
```

**Objective:** Shared private media service for Social and Messaging following `database-schema.md` §13.9 and Social Tech Design §7.4.

**Implementation status (2026-11-01, IN_PROGRESS, not DONE):**

- `PRIVATE_UPLOADS_DIR` is validated at startup (`shared/storage/private-root.ts`): absolute, existing, write/rename/delete probe, realpath outside `uploadsRoot`, no fallback. Tests and the E2E server use temporary roots; `.env.example` and `.gitignore` are updated.
- `contracts/PrivateMediaService.ts` is implemented by `services/media/PrivateMediaService.ts`: `transaction()` cleans staged files on any failure including COMMIT; `storeImages` re-encodes with existing `sharp` (EXIF removed) and writes tmp → fsync → rename before the row. The multer parser is `middleware/private-image-upload.middleware.ts`.
- `GET /api/v1/media/:id` checks access through registered resolvers and fails closed. A missing file is marked MISSING and returns 404. Headers: nosniff, inline/attachment, `private, no-store`.
- GC (`jobs/private-media-cleanup.job.ts`) removes only stale tmp files and row-less final files.
- `private-media.test.ts` passed 16/16.
- Missing before DONE:
  - ~~The post-image resolver denies unpublished-post access for PENDING/ACCEPTED members until SOC-05.~~ Step 3 (2026-11-01): the resolver now uses the shared `canView` (`services/social/post-visibility.ts`).
  - Message-attachment resolver comes with MSG-04; the Admin report-evidence resolver is registered by RP-07.
  - Full regression has not been run.

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

## [x] SOC-03: Free post create/edit/delete with quotas and idempotency

**Completion review (2026-11-01):** DONE for the FREE-post scope: reviewed author authorization, immutable initial-payload replay before quota, Vietnam-day quota including deleted rows, image transaction rollback, edit/detach/reorder, hidden edit rejection, idempotent delete and gate behavior. Evidence: social-posts.test.ts and social-lock-order.test.ts in the verification above. Dependency implementations used by this scope are exercised; open cross-module media resolvers and schema PR review remain with their owning tasks, not waived.

```text
Status: DONE
Size: M
Blocked by: None for this task scope — required provider behavior verified; unfinished provider scope/reviews remain tracked in their own tasks
```

**Objective:** Implement free posts per Social Tech Design §7.2, §7.5, §8–§9.

**Implementation history before completion review (2026-11-01, step 3, IN_PROGRESS, not DONE):**

- `POST /api/v1/posts` (FREE; multipart `payload` + `images[]`, or JSON), `PATCH /api/v1/posts/:id`, `DELETE /api/v1/posts/:id` in `routes/social/socialRoutes.ts`, `controllers/social/SocialController.ts`, `services/social/SocialPostService.ts`, `repositories/social/SocialRepository.ts`, `validation/social.ts`.
- Create: lock author USERS → recheck `(author_id, client_request_id)` → authorize the stored post with `canView` → compare the immutable `creation_hash` (v1 canonical `{type, title, body, publish, recruitment, images: ordered sha256 of uploaded bytes}`) → quota (`SOCIAL_FREE_POSTS_PER_DAY`, local day in Asia/Ho_Chi_Minh, deleted rows counted, `Retry-After` to local midnight) → `storeImages` + post + images in `PrivateMediaService.transaction`. Replay → 200 with the current post; different payload → 409 `SOCIAL_CLIENT_ID_CONFLICT`.
- `type = MATCH_FINDING` is handled by the SOC-04 canonical flow since step 4.
- Edit keeps `published_at`, sets `edited_at` only when something changed; removed or moved images are detached (media rows kept). Image ids in the API are media ids (`keepImageIds`, `images[].id`).
- Delete is idempotent; the author may also delete a hidden post. MATCH_FINDING deletion goes through `cancelForAuthorDeletion` since step 4 (see SOC-04).
- `parsePrivateImages` gained an optional count-limit code so more than 4 images returns `SOCIAL_IMAGE_LIMIT`.
- Tests: `social-posts.test.ts` 14/14 (validation codes, role/session/CSRF, replay/conflict, replay after edit, authorization before replay, quota with deleted posts and day boundary, concurrent creates and retries, media rollback, gate, edit/detach/reorder, authorization, delete).
- Step-3 review fix (2026-11-01): every Social mutation takes all USERS locks first, ascending (actor FOR UPDATE for quota; KEY SHARE for each users FK it will write: media owner, reaction user, deleted_by, hidden_by, comment-notification recipient), then posts(100), then comments/reactions(105). Regression `social-lock-order.test.ts` (2 barrier-ordered interleavings of an image edit and a comment by the same author) passes, and fails with 500 when the edit's pre-lock is removed.
- Missing before DONE: Full backend regression was not run after step 3 (skipped at the owner's request); the step-2 suites `private-media.test.ts` and `matchmaking-membership.test.ts` were last run before the step-3 changes (34/34).

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

**Completion review (2026-11-01):** Keep IN_PROGRESS: creation/deletion core exists, but MM-31 notification/link acceptance is incomplete (NTF-05). The owner accepted the frontend audit handling on 2026-11-01: retain the implemented refusal to delete a started, non-terminal recruitment; terminal deletion does not cancel it again. No production Apply/BlockPort integration is inferred from tests.

```text
Status: IN_PROGRESS
Size: M
Blocked by: SOC-03, MM-23 (creation); MM-25, MM-31 (active-post deletion)
```

**Implementation status (2026-11-01, Social step 4, IN_PROGRESS, not DONE):**

- `POST /api/v1/posts` with `type = MATCH_FINDING` (`SocialPostService.createMatchFinding`): Social gate, title ≤ 120 / body ≤ 2000 trimmed, ≤ 4 images. The recruitment is normalized by `RecruitmentPort.validateDraft(…, { checkLeadTime: false })`. The immutable v1 `creation_hash` covers type, title, body, publish intent, the complete normalized recruitment (including the external court) and ordered image SHA-256s. In one `PrivateMediaService.transaction`: author USERS lock → idempotency recheck → `canView` authorization → hash compare (replay 200 / `409 SOCIAL_CLIENT_ID_CONFLICT`) → images → post (unpublished) → `RecruitmentPort.createForPost` (Matchmaking gate, open-post limit, lead time, schedule, publish guards) → post images. Any failure rolls back post, recruitment, media rows and files.
- `DELETE /api/v1/posts/:id?bookingAction=KEEP|CANCEL` for MATCH_FINDING: `RecruitmentPort.cancelForAuthorDeletion` first (users → requests → invitations → matches; `AUTHOR_DELETED`, members and pending Players notified with `MM_POST_CANCELLED`), then the post lock (rank 100) and `deleted_at`, in one transaction; retried on `TransactionRetryError`. Terminal recruitment → only `deleted_at`. `CANCEL` on an active post → `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE`, nothing changes. A started, non-terminal post → `409 MATCHMAKING_REQUEST_NOT_CANCELLABLE` (choice to confirm). Omitted `bookingAction` = `KEEP`. Allowed while Social is disabled.
- Legacy `POST /matchmaking-requests` is kept until the frontend cutover.
- Tests: `social-match-finding.test.ts` 10/10 (atomic rollback incl. a failure after post/media insert, replay incl. after edit, conflict on publish/title/recruitment change, deleted-post replay 404, concurrent identical retries, concurrent creates at the open-post limit, replay at the limit, gates, author deletion KEEP/CANCEL/terminal/rollback/403/Social-off, deletion racing with acceptance, withdrawal and comment). A mutation that locks the post before cancellation makes the race test fail. Full regression 510/510.
- Missing before DONE: MM-31 is only partial (notification acceptance not closed, NTF-05 resolvers absent); owner review of the started-post deletion choice.

**Objective:** One canonical flow that creates the post and its recruitment in one transaction, and author deletion through cancellation.

**Dependency split (clarified 2026-11-01; no status change):**

- Creation (`POST /posts`, `type = MATCH_FINDING`) needs SOC-03 and MM-23 (`RecruitmentPort.createForPost`).
- Deleting an active post uses `RecruitmentPort.cancelForAuthorDeletion`, which follows host cancel (Matchmaking Tech Design §24.4 "Author deletes the post", §24.7.3 "Withdraw, early close, host cancel, author deletion"); host cancel with `KEEP` is MM-25. The "members are notified" acceptance needs MM-31 (`MM_POST_CANCELLED`). Deleting a terminal post only hides it and needs neither.
- Contracts and creation may be prepared first. SOC-04 is DONE only when both parts pass with real providers, not stubs.

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

**Completion review (2026-11-01):** Keep IN_PROGRESS: feed/detail tests cover pagination, tiers and masking, but area filters currently query only external_court_city/district in RecruitmentRepository.feedFilter; no booking-venue filter path exists. The task also retains unconfirmed filter interpretations. Do not close the full match-finding query scope from FREE/external-court tests alone.

```text
Status: IN_PROGRESS
Size: M
Blocked by: SOC-01, MM-21
```

**Objective:** `GET /posts` and `GET /posts/:id` with the single `canView` rule (Tech Design §7.3, §7.6).

**Implementation status (2026-11-01, step 3, IN_PROGRESS, not DONE):**

- `GET /api/v1/posts` and `GET /api/v1/posts/:id`; shared `canView` in `services/social/post-visibility.ts`, used by feed, detail, comments, reactions and the media resolver.
- Feed: `published_at ≤ asOf` (echoed in `meta.asOf`), `published_at DESC, id DESC`, `limit ≤ 50` (default 20). Recruitment filters come from `RecruitmentPort.feedFilterSql`; when any recruitment filter is set, free posts are excluded. Ended match-finding posts (CANCELLED/EXPIRED, effectively expired, past `start_at`, or MATCHED without an active Match) are excluded unless `includeEnded=true`; detail stays reachable. Card projection is batched per page.
- Interpretations accepted with the frontend audit proposal (human owner, 2026-11-01): `city`/`district` match the recruitment's external court fields (no court before MM-28, booking venue after MM-19); `timeFrom`/`timeTo` bound the local start time inclusively; a PENDING row grants access only while not expired; unpublished-post detail for invitees uses the same card (it has no applicant/management data).
- Tests: `social-feed.test.ts` 9/9 (order, edit not reordering, asOf, pagination, limit, each filter, ended default/includeEnded, batching, roles, unpublished access everywhere, masking).
- Step-3 review fixes (2026-11-01): the recruitment projection is tiered like `GET /matchmaking-requests/:id` (`FULL` host/active accepted member, `PUBLIC` published, `INVITEE` response context without roster or court, `NONE` not returned) and cut to a per-tier allowlist; `date` must be a real calendar date (arithmetic check, 400 `VALIDATION_FAILED` before the repository). `social-feed.test.ts` now 11/11.
- Missing before DONE: Full backend regression was not run after step 3 (skipped at the owner's request); the step-2 suites `private-media.test.ts` and `matchmaking-membership.test.ts` were last run before the step-3 changes (34/34).

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

## [x] SOC-06: Reactions, comments and comment notification

**Completion review (2026-11-01):** DONE: reviewed six reaction types, single-row upsert/idempotent removal, flat comments, quota including deleted rows, author/post-author deletion, replay authorization/hash, and same-transaction notification with rollback/dedup and no self-comment/reaction events. Evidence: social-interactions.test.ts and social-lock-order.test.ts. The earlier reaction-removal gate question is resolved by the authoritative Matchmaking Tech Design §24.10 react row: both reaction mutations are blocked while Social is off. Notification link navigation remains NTF-05, outside this task.

```text
Status: DONE
Size: M
Blocked by: None for this task scope — required provider behavior verified; unfinished provider scope/reviews remain tracked in their own tasks
```

**Objective:** Reactions and flat comments with quotas and the author notification.

**Implementation history before completion review (2026-11-01, step 3, IN_PROGRESS, not DONE):**

- `PUT/DELETE /posts/:id/reaction` (six types, PK upsert, idempotent delete), `GET/POST /posts/:id/comments`, `DELETE /comments/:id` in `services/social/SocialInteractionService.ts`.
- Comment create: lock author USERS → recheck key → authorize → immutable hash `{postId, trimmed body}` → post row FOR SHARE → quota (`SOCIAL_COMMENTS_PER_MINUTE`, 60 s window, deleted counted, `Retry-After`) → insert → `SOCIAL_POST_COMMENTED` (resource POST, dedup `post-comment:<commentId>:<recipientId>`) in the same transaction when the commenter is not the author. Replays add no notification or quota.
- Gate off blocks comment create and both reaction calls (removal treated as a reaction change — to confirm); comment deletion stays allowed.
- Tests: `social-interactions.test.ts` 11/11.
- Missing before DONE: Full backend regression was not run after step 3 (skipped at the owner's request); the step-2 suites `private-media.test.ts` and `matchmaking-membership.test.ts` were last run before the step-3 changes (34/34).

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

## [x] SOC-07: Admin hide of posts and comments

**Completion review (2026-11-01):** DONE: reviewed Admin-only routes, CSRF boundary, idempotent first hidden_at/hidden_by, USERS-before-content lock order, and absence of recruitment/Match mutations. Evidence: social-feed.test.ts and matchmaking-lifecycle.test.ts exercise hidden content/media plus management, withdrawal/court/cancel and scheduler continuation. This completes implementation review; report evidence/UI remains RP-07/08.

```text
Status: DONE
Size: S
Blocked by: None for this task scope — required provider behavior verified; unfinished provider scope/reviews remain tracked in their own tasks
```

**Objective:** `POST /admin/posts/:id/hide` and `POST /admin/comments/:id/hide` (Admin only, idempotent).

**Implementation history before completion review (2026-11-01, step 3, IN_PROGRESS, not DONE):**

- `POST /api/v1/admin/posts/:id/hide`, `POST /api/v1/admin/comments/:id/hide` (ADMIN only, idempotent, first `hidden_at`/`hidden_by` kept; post lock rank 100 or comment rank 105 only; no Matchmaking call).
- Tests in `social-feed.test.ts`: Player 403, repeated hide, recruitment/Match rows unchanged, hidden detail/media 404 for host and member, host and member still read and manage the recruitment through `/matchmaking-requests`.
- Step 4 (2026-11-01): the acceptance case "hidden post, CONFIRMED Match, scheduler reaches start → Match proceeds" and "withdrawal/court/cancel after hide" pass in `matchmaking-lifecycle.test.ts` with the real MM-25/MM-27 code. Remaining before DONE: owner review. Earlier note: full backend regression was not run after step 3 (skipped at the owner's request); the step-2 suites `private-media.test.ts` and `matchmaking-membership.test.ts` were last run before the step-3 changes (34/34).

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
Status: IN_PROGRESS
Size: L
Remaining acceptance gates: SOC-04/SOC-05 provider completion, real end-to-end verification; RP-08 report integration remains separate. Social routes approved 2026-11-01.
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


**Frontend implementation (2026-11-01, not DONE):** Human owner accepted the Figma audit proposal and requested delivery. Feed/filter/asOf paging, FREE/MATCH_FINDING composer, private images/lightbox, edit/delete/KEEP confirmation, reactions, flat comments, neutral unavailable and responsive overlays are implemented against existing routes. Player shell and profile entry are reused. Drafts and idempotency IDs survive failed requests; changed drafts receive a new ID. Report entry is explicitly unavailable until RP-06/08, not a second report implementation. See [frontend-implementation.md](frontend-implementation.md) for verification and limitations. Contract UI tests do not close provider or real end-to-end acceptance gates.

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
