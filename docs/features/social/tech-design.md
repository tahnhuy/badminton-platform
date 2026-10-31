# Social Feed — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/social/prd.md
Scope: Posts (free and the content part of match-finding posts), post images, reactions, comments, feed query, author edit/delete, Admin hiding, quotas, private media storage shared with Messaging
Decision Status: Approved (human owner, final Phase 2 review, 2026-10-31)
```

Ready. Explicitly approved by the human owner on 2026-10-31 after the final Phase 2 review; not implemented.

## 2. Context

The Social PRD defines the feed and interactions. Recruitment for match-finding
posts is owned by Matchmaking (Matchmaking Tech Design §24). This design adds a
`social` capability to the monolith and a private media store that Messaging
reuses.

## 3. Technical Problem

- A match-finding post spans two modules but must be created, deleted and read
  consistently without two sources of truth.
- Images must be visible only to signed-in Players who may see the post, and hidden
  content must never be reachable, while the current `/uploads` is public static.
- Per-Player quotas must survive restarts and concurrent requests without in-memory
  state.
- The feed must be stable while new posts are published.

## 4. Goals

- One transaction creates a match-finding post and its recruitment.
- Authorized media download with permission re-checked on every request.
- DB-backed quotas, idempotent create retries.
- Stable feed ordering and pagination with `asOf`.

## 5. Non-Goals

- Real-time push, full-text search, ranking, recommendations.
- Malware scanning; automatic moderation.
- Changing avatar storage (stays public `/uploads`).

## 6. Upstream References

- PRD: [prd.md](prd.md)
- Brief: `PROJECT-BRIEF.md` §3.1, §5, §7
- Rules/config: `docs/business-rules-config-matrix.md` §3.12, §3.14, §7, §8.9
- Schema: `docs/architecture/database-schema.md` §13.1–§13.2, §13.9 (Ready target delta)
- Conventions: `docs/architecture/conventions.md` (API, pagination, errors)
- Tech stack: `docs/architecture/tech-stack.md` (File Storage, Real-Time, Rate limiting)
- Matchmaking: [Tech Design §24](../matchmaking/matchmaking/tech-design.md)

## 7. Proposed Technical Design

### 7.1 Layout

`routes/social/`, `controllers/social/`, `services/social/`,
`repositories/social/`, `validation/social.ts`. Shared private media:
`shared/storage/private-media.ts` (filesystem) and `repositories/media/` (rows),
consumed by Social and Messaging through `contracts/PrivateMediaService.ts`.
Frontend: `frontend/src/features/social/`.

### 7.2 Creating posts

- Free post: validate (§8 limits), lock the author's `USERS` row, check
  `SOCIAL_FREE_POSTS_PER_DAY`, store media (§7.4), insert `POSTS` (`published_at =
  now`) and `POST_IMAGES`, commit.
- Match-finding post: same transaction calls `RecruitmentPort.createForPost`
  (Matchmaking validates recruitment fields, open-post limit, schedule and lead
  time and inserts the recruitment with `post_id`). `published_at` is NULL unless
  the request asks to publish immediately, in which case Matchmaking's publish
  guards run in the same transaction. A post row never commits without its
  recruitment, and the reverse.

### 7.3 Visibility rule (single function)

`canView(post, viewer)`: viewer is an authenticated Player; `deleted_at` and
`hidden_at` are NULL; and either `published_at` is set, or the viewer is the host,
or the viewer has a PENDING/ACCEPTED membership row (invitee context only, as
limited by Matchmaking §24.9). Every read path (feed, detail, comments, reactions,
media) uses this function. Unavailable posts return `404 SOCIAL_POST_NOT_FOUND`
with no hint of the reason. Admin evidence access goes through Report Management
only.

### 7.4 Private media (shared with Messaging)

- Root: `PRIVATE_UPLOADS_DIR` (approved 2026-10-31), required in every environment
  and validated at startup in `shared/config/env.ts`. The server refuses to start
  when it is missing, not absolute, not writable (write/rename/delete probe in
  `tmp/`), or resolves (after `realpath`) inside the public `uploadsRoot` or any
  `express.static` root. There is no fallback to `/uploads`. Tests use a temporary
  directory. `.env.example` documents a value outside the repository's public
  folder, and the local directory is added to `.gitignore`.
- Deployment notes (to be carried into deployment documentation): the process user
  needs read/write/rename permission on the root; capacity must cover
  images (≤ 5 MB × 4 per post/message) and files (≤ 10 MB) with no automatic
  deletion in MVP; the root must be backed up together with the database, because
  rows reference files and report evidence must be retained.
- Upload parsing: existing `multer` memory storage with per-route limits
  (images: 5 MB each, ≤ 4 files; total parts bounded).
- Images: existing `sharp` decode with `failOn: 'warning'` and pixel limit,
  re-encode to the same format (strips EXIF/GPS), MIME/format agreement.
- Lifecycle: `database-schema.md` §13.9 (tmp → fsync → atomic rename → row in the
  content transaction; rollback deletes; GC deletes only row-less files older than
  1 hour; rows never deleted; missing file → `MISSING`).
- Download: `GET /api/v1/media/:id`. The media row is resolved to its owning content
  (post image or message attachment). Access = `canView` of the post (and the
  image not detached) or Messaging read permission. Headers: validated
  `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`
  for images and `attachment` for files, `Cache-Control: private, no-store`.
  Missing or unauthorized: `404 MEDIA_NOT_FOUND`.

### 7.5 Quotas

Inside the write transaction, after locking the author's `USERS` row:

- Free posts: `count(POSTS where author, type FREE, created_at ≥ start of today in Asia/Ho_Chi_Minh)`, deleted rows included.
- Comments: `count(POST_COMMENTS where author, created_at > now() - 60 s)`, deleted included.

Exceeded → `429 SOCIAL_RATE_LIMITED` with `Retry-After` (seconds until the oldest
counted row leaves the window, or until local midnight). Idempotent replays are
resolved before the quota check, so they are never counted.

### 7.6 Feed query

`GET /posts` returns posts visible to the viewer with `published_at ≤ asOf`
ordered by `published_at DESC, id DESC`. Recruitment filters join
`matchmaking_requests`. The default excludes match-finding posts that are terminal
or past `start_at`; `includeEnded=true` disables that. `hasOpenSlots` means status
`OPEN` and `1 + companion_count + accepted < capacity`. Edits never change
`published_at`.

## 8. Behavior, State, and Flow

```text
Post: created → (published) → edited* → deleted | hidden
Comment: created → deleted | hidden
```

- Free post deletion sets `deleted_at`.
- Active match-finding post deletion: `RecruitmentPort.cancelForAuthorDeletion(bookingAction)`
  then `deleted_at`, one transaction. Terminal match-finding posts set `deleted_at` only.
- Admin hide sets `hidden_at`/`hidden_by` only.
- Edit: allowed while not deleted/hidden; replaces text/title; images by
  `keepImageIds` order + new files (removed images get `detached_at`; media kept);
  sets `edited_at`.

## 9. API Design

All under `/api/v1`, `authenticate` + `requireRole('PLAYER')` unless noted; CSRF on
mutations; global error envelope.

| Method/path | Request | Response / notes |
| --- | --- | --- |
| `GET /posts` | `page`, `limit` (≤ 50), `asOf` (ISO, default now; echoed in `meta.asOf`), `type`, `matchType`, `date`, `timeFrom`, `timeTo`, `city`, `district`, `skillLevelId`, `hasOpenSlots`, `includeEnded` | `{ data: PostCard[], meta: { page, limit, total, totalPages, asOf } }`. Clients de-duplicate by id: deletions/hides between pages can still shift results. |
| `POST /posts` | `multipart/form-data`: `payload` JSON `{ type, body?, title?, clientRequestId, publish?, recruitment? }`, `images[]` | `201 { data: Post }`. Same `clientRequestId` + same content → `200` with the stored post; different content → `409 SOCIAL_CLIENT_ID_CONFLICT`. |
| `GET /posts/:id` | — | `{ data: PostDetail }` including recruitment projection from `RecruitmentPort` |
| `PATCH /posts/:id` | multipart: `payload { body?, title?, keepImageIds[] }`, `images[]` | Author only; `409 SOCIAL_POST_NOT_EDITABLE` if deleted/hidden |
| `DELETE /posts/:id` | `bookingAction=KEEP\|CANCEL` (active match-finding only) | `200 { data: { id, deleted: true } }`; idempotent |
| `PUT /posts/:id/reaction` | `{ type }` | Idempotent upsert |
| `DELETE /posts/:id/reaction` | — | Idempotent |
| `GET /posts/:id/comments` | `page`, `limit` | Ascending by `created_at, id` |
| `POST /posts/:id/comments` | `{ body, clientRequestId }` | `201`; replay rules as posts |
| `DELETE /comments/:id` | — | Comment author or post author |
| `GET /media/:id` | — | Binary; §7.4 |
| `POST /admin/posts/:id/hide` | — | `ADMIN`; idempotent |
| `POST /admin/comments/:id/hide` | — | `ADMIN`; idempotent |

Error codes: `SOCIAL_DISABLED` (409), `SOCIAL_POST_NOT_FOUND` (404),
`SOCIAL_COMMENT_NOT_FOUND` (404), `MEDIA_NOT_FOUND` (404), `SOCIAL_FORBIDDEN`
(403, author-only action by another Player on a visible post),
`SOCIAL_POST_NOT_EDITABLE` (409), `SOCIAL_CLIENT_ID_CONFLICT` (409),
`SOCIAL_RATE_LIMITED` (429), `SOCIAL_CONTENT_EMPTY`, `SOCIAL_CONTENT_TOO_LONG`,
`SOCIAL_IMAGE_INVALID`, `SOCIAL_IMAGE_LIMIT`, `SOCIAL_REACTION_INVALID` (400, used
as field codes inside `VALIDATION_FAILED` when several fields fail). Recruitment
errors pass through with their `MATCHMAKING_*` codes.

## 10. Data Model / Schema Delta

Authoritative: `docs/architecture/database-schema.md` §13.1, §13.2, §13.9.
Rationale: separate post/recruitment tables keep one owner per rule (T1);
independent `deleted_at`/`hidden_at` avoid a combined status that would conflate
author deletion and moderation (T3); `client_request_id` supports idempotent
retries (T6); `POST_IMAGES.detached_at` preserves evidence after edits (B6).

## 11. Security

- Player role at the route; contextual author/host checks in the service.
- Court Owner and Admin get `403 AUTH_FORBIDDEN_ROLE` on Player routes; Admin uses
  only the hide routes and Report Management.
- Media: never static; permission per request; `nosniff`; sanitized file names.
- Text rendered as plain text by the frontend (no HTML).
- Identifiers of hidden/deleted content are not echoed in errors.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Recruitment validation fails during match-finding creation | `RecruitmentPort` throws | Whole transaction rolls back, media files deleted | Error returned; draft kept client-side |
| Crash after file rename, before commit | Orphan file without row | GC removes after 1 hour | Log |
| Image decode fails | `sharp` error | `400 SOCIAL_IMAGE_INVALID` | Per-file message |
| Duplicate submit | `client_request_id` unique | Return stored resource | — |
| Post deleted between pages | Feed shift | Possible duplicates/skips | Client de-duplicates; `asOf` limits insertions |
| Comment on hidden post | `canView` false | `404 SOCIAL_POST_NOT_FOUND` | — |
| Author deletes active match-finding post with `CANCEL` while MM-20 blocked | Matchmaking rejects | `409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE`, nothing changes | UI offers only `KEEP` |

## 13. Concurrency / Idempotency

- Quota: author `USERS` row lock, count and insert in one transaction.
- Reactions: PK upsert; concurrent toggles converge.
- Creation replay: unique `(author_id, client_request_id)`; persist an
  immutable SHA-256 `creation_hash` of the canonical initial payload: post type,
  trimmed body/title, publish intent, complete normalized recruitment fields
  (time/duration, type/capacity/minimum/companions, skill range, area, cost,
  external court or booking and confirmation fields), and ordered image hashes.
  Compare against this original hash, never the post after edits. Comments also
  store an immutable creation hash including target post ID and trimmed body.
  Authorize current access before returning replay content. Lock actor USERS
  then the relevant resource in global order and recheck the idempotency key
  after waiting, before quota or insertion; simultaneous identical requests
  return one stored result and count once.
- Lock order: §24.7 of the Matchmaking Tech Design (approved 2026-10-31).

## 14. Performance

- Feed index (§13.2) supports the default order; filters on recruitment use its
  indexes on `start_at`, `match_type`, `status` (added with §13.3).
- `limit` ≤ 50; card projection batched by post ids; counts of reactions/comments
  computed per page with grouped queries.
- Feed polling is not required; the client refreshes on demand and when the page
  becomes visible.

## 15. Events / Notifications

- Comment by another Player → notify post author; type `SOCIAL_POST_COMMENTED`;
  resource `POST`; dedup key `post-comment:<commentId>:<recipientId>`; same
  transaction as the comment (NTF-02). No reaction notifications.

## 16. Testing Considerations

- Unit: limits, trim, reaction mapping, `canView`, quota window boundaries
  (midnight in `Asia/Ho_Chi_Minh`, 60 s).
- Integration: match-finding create atomicity (recruitment failure leaves no post or
  file row); author deletion goes through cancellation; Admin hide keeps recruitment.
- API: every route's role, CSRF, 404 masking, idempotent replay vs conflict.
- Media: unauthorized and hidden-post downloads return 404; detached images remain
  available to report evidence only; GC never deletes a file with a row.
- Concurrency: parallel posts at quota edge produce exactly the limit; replay of a
  successful post is not counted.

## 17. Migration / Rollout

- Migration with §13.1/§13.2 tables (shared with Matchmaking backfill, §24.11).
- `PRIVATE_UPLOADS_DIR` added to `.env.example`; startup fails clearly when absent
  in production.
- Rollout behind `SOCIAL_FEED_ENABLED` (default `true` per matrix §8.9); the frontend
  hides entry points when disabled.

## 18. Alternatives Considered

- Polymorphic reactions/comments on recruitment rows: rejected (T1).
- Public static images with random names: rejected (signed-in and hidden-content rules).
- `express-rate-limit` for quotas: rejected (in-memory, per IP).

## 19. Observability / Monitoring

- Log quota rejections (user id, quota key), media `MISSING` events, GC deletions
  count. No content in logs.

## 20. Acceptance / Verification Considerations

- **Given** a Player at 10 free posts today **When** posting again **Then** `429 SOCIAL_RATE_LIMITED` and no post/media row.
- **Given** a match-finding create whose recruitment is invalid **When** submitted **Then** no `POSTS`, recruitment or `MEDIA_FILES` row exists.
- **Given** an Admin-hidden post **When** a member opens its link or image **Then** `404`; **and** the recruitment and Match states are unchanged.
- **Given** a post edited after being reported **When** Admin views the report **Then** evidence shows the text and images captured at report time.
- **Given** a retried `POST /posts` with the same `clientRequestId` and content **Then** the same post is returned and quota is unchanged; **with** different content **Then** `409 SOCIAL_CLIENT_ID_CONFLICT`.
- **Given** a Court Owner session **When** calling `GET /posts` **Then** `403`.

## 21. Decisions and Open Questions

### 21.1 Approved (human owner, 2026-10-31)

T1 ownership and same-transaction creation; T3 independent visibility fields; T5
private storage, multer/sharp scope extension; T6 DB quotas in the write
transaction, replays not counted; B5–B8 content rules; Q2 title; Q4 gates; Q8 feed
`asOf`; Q15 one creation flow.

### 21.2 Final decisions — approved 2026-10-31

| Question | Proposal | Impact |
| --- | --- | --- |
| Global lock order | Approved 2026-10-31; Matchmaking Tech Design §24.7 / §24.13 item 1 | Concurrency design |
| — | `PRIVATE_UPLOADS_DIR` approved 2026-10-31 (§7.4) | — |

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: None — human approval recorded 2026-10-31
Approved decision/reference: §21.1
```
