# Messaging — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/messaging/prd.md
Scope: Standalone direct and group conversations, real-time WebSocket message/reaction/presence/typing delivery, messages with images/files, reactions, unread, blocking, reported-message access
Decision Status: Approved (human owner, final Phase 2 review, 2026-10-31)
```

Ready. Explicitly approved by the human owner on 2026-10-31 after the final Phase 2 review; not implemented.

## 2. Context

Messaging is a standalone `messaging` capability in the monolith, completely decoupled from Matchmaking. Any Player can create direct or group conversations via REST API; Social/Matchmaking UI may optionally invoke `POST /api/v1/conversations/group` as a convenience action.
Media storage is shared with Social (Social Tech Design §7.4). Real-time delivery uses WebSocket (`ws` on the Node.js HTTP server at `/api/v1/ws/messaging`, authenticated by the existing `sid` `HttpOnly` session cookie on upgrade) paired with REST endpoints for history pagination, multipart uploads, and `afterSeq` gap-recovery on reconnect (approved 2026-11-01).




## 3. Technical Problem

- Message order must be stable when two members send at the same time, and polling
  must never skip a message.
- Unread counts must exclude own messages and advance only to what was shown.
- Retries must never duplicate a message, and a reused id with different content
  must fail.
- Access (including attachments) must end immediately on withdrawal, and presence
  must follow blocks and left chats.
- Presence/typing writes must not overload the database or contend with
  scheduling locks.

## 4. Goals

- Per-conversation gapless sequence; cursor polling by `seq`.
- Idempotent send keyed by `(sender_id, conversation_id, client_message_id)`.
- Permission check on every read, send, download and presence query.
- Near-real-time behavior with bounded write rates.

## 5. Non-Goals

- Voice/video, message edit/delete/recall/hide, search,
  delivery/read receipts per message for other members.

## 6. Upstream References

- PRD: [prd.md](prd.md)
- Rules/config: `docs/business-rules-config-matrix.md` §3.13, §3.14, §8.9
- Schema: `docs/architecture/database-schema.md` §13.1, §13.7, §13.9
- Matchmaking: [Tech Design §24](../matchmaking/matchmaking/tech-design.md) (membership, gates §24.10, lock order §24.7)
- Social: [Tech Design §7.4](../social/tech-design.md) (private media)
- Conventions: `docs/architecture/conventions.md` (pagination exception for message history)

## 7. Proposed Technical Design

### 7.1 Layout

`routes/messaging/`, `controllers/messaging/`, `services/messaging/`,
`repositories/messaging/`, `validation/messaging.ts`; contract `BlockPort` (and in-process WebSocket hub `ws/`). Frontend `frontend/src/features/messaging/`.


### 7.2 Access rules (single module)

| Action | Direct | Group |
| --- | --- | --- |
| Read history, download attachments | Member (either Player) | Member with `state = ACTIVE` only. `LEFT` members can neither read history nor download attachments through the group unless re-added by an `ACTIVE` member |
| Send, react, typing, add members | Both accounts active, no block either way, `MESSAGING_ENABLED` | `ACTIVE` member, `MESSAGING_ENABLED` (group conversations remain active long-term with no 24-hour `read_only_at` lock) |
| Leave / Re-add | — | Any `ACTIVE` member may leave (`state = LEFT`) or add/re-add non-blocked `ACTIVE` Player accounts up to `MESSAGING_GROUP_MAX_MEMBERS` |
| Presence of another user | Share an `ACTIVE` membership in a conversation where neither side is `LEFT`, and no block for direct relationships | same |

`LEFT` is set when a member voluntarily leaves a group conversation (`POST /conversations/:id/leave`); it stops new messages/unread/presence and removes history/attachment access until an `ACTIVE` member re-adds them (`POST /conversations/:id/members`). Messaging is completely decoupled from Matchmaking.




Admin never uses these routes; reported content is served by Report Management.
Unauthorized access returns `404 MESSAGING_CONVERSATION_NOT_FOUND`.

### 7.3 Conversations

- Direct: `POST /conversations/direct { playerId }` finds or creates the pair row
  (unique low/high ids). Rejected for self, non-Player, locked/deleted accounts,
  blocks (`409 MESSAGING_ACTION_NOT_AVAILABLE`, neutral). Opening never counts
  quota. A direct conversation appears in the counterpart's list only after it has
  a message.
- Gate (human-approved 2026-11-01): `POST /conversations/group` returns `409 MESSAGING_DISABLED` when `MESSAGING_ENABLED = false`; no conversation or membership rows are inserted.
- Group: `POST /conversations/group { title, memberIds[] }` creates a standalone `GROUP` conversation (`created_by = actorId`, `title` trimmed `1–120` chars) and inserts `ACTIVE` membership rows for the creator plus `memberIds` (total `2` to `MESSAGING_GROUP_MAX_MEMBERS`, all active `PLAYER` accounts not blocked with the creator). `POST /conversations/:id/members { memberIds[] }` allows any `ACTIVE` member to add or reactivate (`LEFT → ACTIVE`) non-blocked Players up to `MESSAGING_GROUP_MAX_MEMBERS`. `POST /conversations/:id/leave` sets the caller's row to `LEFT` and closes their WebSocket subscription for that group. Group conversations have no `matchmaking_request_id` coupling and never auto-lock after 24 hours.




- Leave / Re-add: `ACTIVE ↔ LEFT`; never touches Matchmaking.


### 7.4 Sending

One transaction:

1. Validate payload: trimmed text ≤ 2,000; text or attachments; either ≤ 4 images
   or exactly 1 file.
2. Lock sender `USERS` row, then the `CONVERSATIONS` row. Check the actor
   still has read permission before looking up/returning any replay. A withdrawn
   or left-chat member cannot recover a message through this endpoint.
3. Re-read `(sender, conversation, client_message_id)` after both locks: same
   hash → return the stored message (`200`, quota unchanged); different hash →
   `409 MESSAGING_CLIENT_ID_CONFLICT`. This recheck handles concurrent retries.
   With no replay, check current send permission and `MESSAGING_MESSAGES_PER_MINUTE` (messages by
   sender in the last 60 s) and, for a direct conversation where the sender's
   `first_sent_at` is NULL, `MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY` (direct
   memberships of the sender with `first_sent_at` ≥ local day start).
   Exceeded → `429 MESSAGING_RATE_LIMITED` + `Retry-After`.
4. Validate attachment authorization and current send conditions (§7.2) while
   holding the conversation lock. No message insert occurs before the replay
   recheck and quota checks.
5. `last_seq = last_seq + 1`, `activity_version + 1`, `last_message_at = now`;
   insert `MESSAGES` with that `seq`; store media (§7.6) and `MESSAGE_ATTACHMENTS`;
   set `first_sent_at` if NULL.
6. Commit. Media files written before the commit follow the lifecycle in
   `database-schema.md` §13.9.

`content_hash` = SHA-256 of normalized text and the ordered attachment SHA-256 list.
Because `seq` is assigned under the conversation row lock and committed with the
row, a reader polling `afterSeq` cannot observe `n+1` before `n`.

### 7.5 Reading, unread and sync

- `GET /conversations/:id/messages?beforeSeq=&limit=` (history, newest first) and
  `GET /conversations/:id/sync?afterSeq=&sinceVersion=&minLoadedSeq=` (polling).
  Each sync uses one read-only REPEATABLE READ transaction so access,
  messages, reaction summaries and versions come from one consistent snapshot.
  Return messages with `seq > afterSeq` (ascending, max 100), `nextAfterSeq`
  equal to the last returned seq (or the input if none), and `hasMore`. Return
  changed reaction summaries in `[minLoadedSeq, nextAfterSeq]` with
  `reaction_version > sinceVersion`, including messages delivered by this page.
  While `hasMore = true`, return `nextSinceVersion = sinceVersion` unchanged;
  when caught up, return the snapshot activity version as `nextSinceVersion`.
  Never advance the seq cursor to `last_seq` when only a page was returned.
  Client adopts only these returned cursors. When loading older history lowers
  `minLoadedSeq`, reset `sinceVersion` to 0 to refresh reactions over the
  enlarged loaded range. Presence/typing are permission-filtered in this snapshot.
- `POST /conversations/:id/read { seq }`: `last_read_seq = GREATEST(last_read_seq,
  LEAST(seq, last_seq))`. The client sends the highest `seq` actually rendered in
  view; opening a conversation does not mark everything read.
- Unread for a member = messages with `seq > last_read_seq` and `sender_id <> me`.
  `GET /conversations` and `GET /conversations/unread-summary` compute it for
  `ACTIVE` memberships only (left chats show no unread).
- Reactions: resolve the conversation ID without locking the message, lock
  `CONVERSATIONS` first, recheck access, then lock/update message/reaction rows.
  Upsert/delete and bump `activity_version`, assigning it to `reaction_version`
  in the same transaction. Read-marker/leave/rejoin/typing also lock the
  conversation before membership/typing rows to serialize access changes.

### 7.6 Attachments and file validation

- Images: same pipeline as Social (sharp re-encode, limits per matrix §3.13).
- PDF: header `%PDF-` and `%%EOF` within the last 1 KB. Basic format check only.
- TXT: valid UTF-8 (strict decoder), no NUL byte. Basic format check only.
- DOCX/XLSX: read the ZIP central directory with the approved dependency `yauzl@3.4.0`
  (§21.2) without extracting content: limit entry count (≤ 2,000) and declared
  uncompressed total (≤ 100 MB); reject encrypted entries and entries named
  `*vbaProject.bin`; require `[Content_Types].xml` and `word/document.xml`
  (DOCX) or `xl/workbook.xml` (XLSX), and read only `[Content_Types].xml` (bounded
  to 256 KB) to confirm the main document content type. Parser errors are caught
  and mapped to `400 MESSAGING_FILE_INVALID`; they never crash the process.
- These checks confirm the declared format; they do not certify a file as safe.
  Files are always served as `Content-Disposition: attachment` with `nosniff`.
- Download: `GET /media/:id` (Social §7.4) with the §7.2 read rule.

### 7.7 Real-time WebSocket delivery, presence and typing (updated 2026-11-01)

| Item | Value (approved with T4) |
| --- | --- |
| WebSocket endpoint | `GET /api/v1/ws/messaging` (`ws` attached to the Node.js HTTP server, authenticated via the `sid` `HttpOnly` session cookie on upgrade; re-verifies active `PLAYER` session) |
| Server → client WebSocket events | `message.created`, `message.reaction_updated`, `conversation.read_updated`, `conversation.member_changed`, `presence.updated`, `typing.updated` (pushed after DB transaction commit only to currently authorized `ACTIVE` members) |
| Reconnect gap recovery | On WebSocket connect/reconnect, the client calls `GET /conversations/:id/sync?afterSeq=&sinceVersion=&minLoadedSeq=` and `GET /conversations/unread-summary` so no message or reaction committed during a disconnect is ever missed |
| Online threshold | `last_seen_at` within 60 s |
| Typing | client sends `POST /conversations/:id/typing` at most every 3 s while the user is typing (debounced; never per keystroke); server sets `expires_at = now + 6 s` |

- All polls and heartbeats pause when the tab is hidden and run immediately when it
  becomes visible.
- Server-side write limits: heartbeat updates `USER_PRESENCE` only if the stored value
  is older than 15 s; typing upserts only if the stored `expires_at < now + 3 s`.
- Presence/typing are returned only to Players allowed by §7.2. With
  `MESSAGING_ENABLED = false`, both endpoints return `409 MESSAGING_DISABLED` and
  `sync` omits presence/typing.
- The UI labels these as near-real-time; expected lag is up to about 3–6 s.
- Expired typing rows are ignored on read and removed by the hourly cleanup.

### 7.8 Blocking

`POST /blocks { playerId }`, `DELETE /blocks/:playerId`, `GET /blocks`.
Block transaction: lock both `USERS` rows ascending → insert `USER_BLOCKS` →
Matchmaking closes pending Apply/Invite between the pair (`close_reason
BLOCKED`) through its contract → commit. No notification to the blocked Player.
Unblock deletes the row and restores nothing. `BlockPort.isBlockedEitherWay(a, b, tx)` is the only block check used by other modules. The closure call is `MatchmakingBlockPort.closePendingBetween(a, b, tx)` (Matchmaking Tech Design §24.2), owned by MM-22 and delivered after MM-21 independently of MM-22 completion. Both calls use the caller transaction; no independent commit (human-approved 2026-11-01).

### 7.9 Reporting

`POST /reports` (Report Management extension) accepts `{ targetType: "MESSAGE",
messageId, attachmentId? }`. The reporter must currently have read access. Evidence
snapshot (text + referenced media) is stored in the same transaction.

## 8. Behavior, State, and Flow

```text
CONVERSATION_MEMBERS: ACTIVE ⇄ LEFT (group leave and re-add)
GROUP conversation: active long-term (no automatic 24-hour read-only lock)

```

## 9. API Design

All under `/api/v1`, Player role, session, CSRF on mutations, global error envelope.

| Method/path | Notes |
| --- | --- |
| `GET /conversations?page&limit` | Ordered by `last_message_at DESC, id DESC`; includes unread, last message preview, counterpart/post info |
| `GET /conversations/unread-summary` | `{ data: { totalUnread } }` |
| `POST /conversations/direct` | `{ playerId }` → `200` existing / `201` created |
| `POST /conversations/group` | `{ title, memberIds[] }` → `201` created (`2` to `MESSAGING_GROUP_MAX_MEMBERS` members including creator) |
| `POST /conversations/:id/members` | `{ memberIds[] }` → add or reactivate (`LEFT → ACTIVE`) non-blocked Players in a group |
| `GET /ws/messaging` (WebSocket upgrade) | Real-time push stream for messages, reactions, read markers, presence, typing |
| `GET /conversations/:id` | Members (display data only), `title`, `type`, state |
| `GET /conversations/:id/messages` | `beforeSeq`, `limit` (≤ 50); response `{ data, meta: { limit, nextBeforeSeq } }` (no `total`) |
| `GET /conversations/:id/sync` | §7.5 |
| `POST /conversations/:id/messages` | `multipart/form-data`: `payload { text?, clientMessageId }`, `images[]` or `file` |
| `POST /conversations/:id/read` | `{ seq }` |
| `POST /conversations/:id/typing` | — |
| `POST /conversations/:id/leave` | Group only (`ACTIVE → LEFT`) |
| `PUT /messages/:id/reaction`, `DELETE /messages/:id/reaction` | Six types |
| `POST /presence/heartbeat` | — |
| `GET /blocks`, `POST /blocks`, `DELETE /blocks/:playerId` | §7.8 |

Error codes: `MESSAGING_DISABLED` (409), `MESSAGING_CONVERSATION_NOT_FOUND` (404),
`MESSAGING_MESSAGE_NOT_FOUND` (404), `MESSAGING_READ_ONLY` (409),
`MESSAGING_ACTION_NOT_AVAILABLE` (409, neutral for block/inactive account),
`MESSAGING_CLIENT_ID_CONFLICT` (409), `MESSAGING_RATE_LIMITED` (429),
`MESSAGING_NOT_GROUP` (409), `MESSAGING_CONTENT_EMPTY`, `MESSAGING_CONTENT_TOO_LONG`,
`MESSAGING_ATTACHMENT_MIXED`, `MESSAGING_ATTACHMENT_LIMIT`, `MESSAGING_IMAGE_INVALID`,
`MESSAGING_FILE_INVALID` (400, field codes inside `VALIDATION_FAILED` when several fail).

## 10. Data Model / Schema Delta

Authoritative: `docs/architecture/database-schema.md` §13.7 (and §13.1, §13.9).
Rationale: `last_seq` gives gapless order (Q9); presence/typing tables avoid `USERS`
contention (Q10); unique `client_message_id` per sender and conversation (T7);
member `state` models leave/rejoin and revocation (B4).

## 11. Security

- Contextual authorization on every request (§7.2), including media downloads.
- No Admin/Court Owner access to conversations.
- Neutral errors for blocks; the blocked Player learns nothing beyond being unable
  to act.
- Deleted/locked counterparts expose only allowed display data (name fallback, no
  email/phone).
- Text rendered as plain text; file names sanitized; files never inline.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Network failure after commit | Client gets no response | Resend with same `clientMessageId` returns stored message | UI shows sent |
| Same id, different content | Hash differs | `409 MESSAGING_CLIENT_ID_CONFLICT` | Client generates a new id |
| Withdrawal while a download is in flight | Permission rechecked per request | Next request `404` | — |
| Poll during connection loss | Fetch fails | UI shows "connection lost"; retries with backoff; resumes from last `seq` | Immediate refresh on visibility/online |
| File parser error | Caught exception | `400 MESSAGING_FILE_INVALID` | Process continues |
| Terminal event during send | Conversation row lock serializes | Send after `read_only_at` → `409 MESSAGING_READ_ONLY` | — |

## 13. Concurrency / Idempotency

- Conversation row lock for `seq`; sender `USERS` lock for quota; order `USERS` →
  `CONVERSATIONS` (Matchmaking §24.7, approved 2026-10-31).
- Messaging is completely decoupled from Matchmaking transactions. WebSocket push runs after the database transaction commits.
- Reactions/blocks/read markers are idempotent upserts/monotonic updates.

## 14. Performance

- Index (`conversation_id`, `seq`) serves history/sync; members index serves lists.
- Real-time events are pushed over a single per-tab WebSocket connection (`/api/v1/ws/messaging`); `sync` is called on connect/reconnect for gapless catch-up.

- Unread computed with a grouped query over `ACTIVE` memberships.

## 15. Events / Notifications

No notification entries for messages (unread only). Group membership changes are standalone within Messaging.


## 16. Testing Considerations

- Concurrent sends in one conversation produce consecutive `seq` with no gap; a
  poller never misses a message.
- Resend after timeout returns the stored message and does not count quota; reused id
  with other content conflicts.
- Unread excludes own messages; `read` never exceeds `last_seq` and never decreases.
- Left group member (`LEFT`) loses history and attachment access immediately until re-added by an `ACTIVE` member; group conversations stay active long-term with no 24-hour read-only lock.



- Block: direct send/start rejected neutrally; pending Apply/Invite closed; group
  membership unchanged; presence hidden for the direct relationship.
- Quota at 30/min and 20 new directs/day boundaries (local midnight).
- `MESSAGING_ENABLED = false`: reads and mark-read work; send/typing/heartbeat
  rejected; group sync still creates conversations.
- File validation: valid DOCX/XLSX/PDF/TXT accepted; renamed ZIP, macro document,
  encrypted entry, oversized central directory, invalid UTF-8 and mixed attachments
  rejected.

## 17. Migration / Rollout

- New tables only (§13.7); no backfill. Legacy group conversations are created on
  demand (Matchmaking §24.11 step 4).
- Frontend polling hooks reuse the existing visibility-aware polling pattern
  (`usePollingResource`).
- Behind `MESSAGING_ENABLED` (default `true`).

## 18. Alternatives Considered

- WebSocket (`ws` on the Node.js HTTP server): approved by the human owner on 2026-11-01 (`tech-stack.md`) for real-time Messaging inside the single-instance monolith, paired with `afterSeq` REST catch-up on reconnect.

- Ordering by `id`/`created_at`: rejected; concurrent commits can be observed out of order.
- Hand-written ZIP parser: rejected by the human owner (Q11).

## 19. Observability / Monitoring

- Log rate-limit rejections, idempotency conflicts, file validation failures (type
  only), media `MISSING`. Never log message text.

## 20. Acceptance / Verification Considerations

- **Given** two members sending simultaneously **When** a third member syncs **Then** both messages arrive with consecutive `seq` in commit order.
- **Given** a member who left the group (`LEFT`) **When** they request history or an attachment **Then** `404`.
- **Given** a Player blocked by the counterpart **When** sending a direct message **Then** `409 MESSAGING_ACTION_NOT_AVAILABLE` and no block is revealed.
- **Given** a standalone group conversation **When** created via `POST /conversations/group` **Then** members can exchange messages in real time over WebSocket long-term without a 24-hour read-only lock.
- **Given** a resend with the same `clientMessageId` and content **Then** one message exists and quota is unchanged.

## 21. Decisions and Open Questions

### 21.1 Approved (human owner, 2026-10-31)

T4 polling with pause/visibility refresh, debounce and permission checks; T5
private storage with lifecycle and cleanup; T6 quotas in-transaction; T7
idempotency key and unread rules; T8 contracts; Q4 gates; Q5 no edit/delete; Q6
images or file; Q7 locked/deleted accounts; Q8 cursor pagination exception; Q9
per-conversation sequence; Q10 presence/typing tables.

### 21.2 Final decisions — approved 2026-10-31

| Question | Proposal | Impact |
| --- | --- | --- |
| `yauzl` version to pin | Human owner approved exact `3.4.0` in the final Phase 2 review, based on §21.3 evidence. Repeat metadata/audit verification on the actual backend lockfile during MSG-05. | `tech-stack.md`, `package.json`; no installation in this documentation phase |
| Global lock order | Approved 2026-10-31; Matchmaking §24.7 / §24.13, including conversation-first reaction mutation | §13 |

Updated 2026-11-01 (human owner): Messaging is decoupled from Matchmaking (standalone group creation/membership, no 24-hour read-only lock) and uses WebSocket (`ws`) for real-time delivery + `afterSeq` reconnect catch-up. `LEFT` members have no history or attachment access until re-added by an `ACTIVE` member (§7.2).



### 21.3 `yauzl` version evidence (2026-10-31)

| Check | Result | Source |
| --- | --- | --- |
| Published versions | 3.0.0 … 3.2.0, 3.2.1 (2026-03-10), 3.3.0, 3.3.1, 3.3.2, 3.4.0 (2026-06-07) | `npm view yauzl versions/time` |
| 3.4.0 runtime dependency tree | `yauzl` 3.4.0 → `pend` 1.2.0; `pend` has no dependencies | Isolated lockfile in a scratch directory outside the repository |
| Licenses | `yauzl` MIT; `pend` MIT | npm metadata |
| Engines | `node >= 12` | npm metadata |
| Audit of the isolated tree | 0 vulnerabilities at any level (`npm audit`, 2026-10-31) | Scratch directory; repository not modified |
| Advisory CVE-2026-31988 | Affects 3.2.0; fixed in 3.2.1 (per the human owner's reading of the advisory) | [GitHub Advisory](https://github.com/advisories/ghsa-gmq8-994r-jv83) |
| Integrity of 3.4.0 | `sha512-jIH9yLR9wqr0wOS0TpBvo/g/2UgZH5qePVbjgRliiF0BYvOZyaBknKsF+x9Iht0O6sqgnB93rCICdOZFecJuDw==` | npm registry |

Final pin approved by the human owner: `yauzl@3.4.0`. The historical
audit result above does not prove the absence of unknown issues. Repeat
the audit on the actual backend lockfile when MSG-05 adds the dependency; failures
unrelated to `yauzl` do not block MSG-05.

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: None — human approval recorded 2026-10-31
Approved decision/reference: §21.1
```
