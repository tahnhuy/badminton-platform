# Messaging — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/messaging/prd.md
Scope: Direct and post-group conversations, messages with images/files, reactions, unread, near-real-time sync, presence and typing, blocking, group membership sync, grace period, reported-message access
Decision Status: Approved (human owner, final Phase 2 review, 2026-10-31)
```

Ready. Explicitly approved by the human owner on 2026-10-31 after the final Phase 2 review; not implemented.

## 2. Context

Messaging is a new `messaging` capability in the monolith. Group membership is
driven by Matchmaking (Matchmaking Tech Design §24.5) through
`GroupConversationPort`. Media storage is shared with Social (Social Tech Design
§7.4). Delivery is HTTP polling (approved T4); no WebSocket, SSE or new
infrastructure.

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

- Push/WebSocket/SSE, voice/video, message edit/delete/recall/hide, search,
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
`repositories/messaging/`, `validation/messaging.ts`; contracts
`GroupConversationPort`, `BlockPort`. Frontend `frontend/src/features/messaging/`.

### 7.2 Access rules (single module)

| Action | Direct | Group |
| --- | --- | --- |
| Read history, download attachments | Member (either Player) | Member with `state = ACTIVE` only. `LEFT_CHAT` and `REVOKED` members can neither read history nor download attachments through the group (approved 2026-10-31) |
| Send, react, typing | Both accounts active, no block either way, `MESSAGING_ENABLED` | `ACTIVE` member, `now < read_only_at` (or not yet terminal), `MESSAGING_ENABLED` |
| Rejoin | — | `LEFT_CHAT` member who is still a current member of the post (or was a member at its terminal event), never `REVOKED`. Rejoin restores read access only; it never creates a conversation, never extends `read_only_at`, and does not enable sending/typing/presence while `MESSAGING_ENABLED = false` |
| Presence of another user | Share an `ACTIVE` membership in a conversation where neither side is `LEFT_CHAT`/`REVOKED`, and no block for direct relationships | same |

`REVOKED` is set when Matchmaking reports a withdrawal; it removes all access,
including history and attachments. After the terminal event, membership states are
frozen except leave/rejoin: only Players `ACTIVE` or `LEFT_CHAT` at that moment
keep read access (a `LEFT_CHAT` member reads only after a valid rejoin). A Player
who withdrew from the post is `REVOKED` and is never restored automatically.
Admin never uses these routes; reported content is served by Report Management.
Unauthorized access returns `404 MESSAGING_CONVERSATION_NOT_FOUND`.

### 7.3 Conversations

- Direct: `POST /conversations/direct { playerId }` finds or creates the pair row
  (unique low/high ids). Rejected for self, non-Player, locked/deleted accounts,
  blocks (`409 MESSAGING_ACTION_NOT_AVAILABLE`, neutral). Opening never counts
  quota. A direct conversation appears in the counterpart's list only after it has
  a message.
- Group: created by `GroupConversationPort.ensureGroup(requestId)` inside the
  Matchmaking transaction (unique per request). `addMember` inserts or reactivates
  `ACTIVE`; `revokeMember` sets `REVOKED`; `markTerminal(requestId, at)` sets
  `closed_at = at` and `read_only_at = at + MESSAGING_GROUP_GRACE_PERIOD_MINUTES`
  (value snapshotted at that moment, matrix §8.1). Repeated calls are idempotent.
- Leave/rejoin: `ACTIVE ↔ LEFT_CHAT`; never touches `closed_at`/`read_only_at` and
  never touches Matchmaking.

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

### 7.7 Presence and typing

| Item | Value (approved with T4) |
| --- | --- |
| Open conversation `sync` poll | 3 s |
| Conversation list / unread summary poll | 15 s |
| Presence heartbeat | `POST /presence/heartbeat` every 20 s while the tab is visible |
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
Unblock deletes the row and restores nothing. `BlockPort.isBlockedEitherWay` is the
only check used by other modules.

### 7.9 Reporting

`POST /reports` (Report Management extension) accepts `{ targetType: "MESSAGE",
messageId, attachmentId? }`. The reporter must currently have read access. Evidence
snapshot (text + referenced media) is stored in the same transaction.

## 8. Behavior, State, and Flow

```text
CONVERSATION_MEMBERS: ACTIVE ⇄ LEFT_CHAT ; ACTIVE|LEFT_CHAT → REVOKED (withdrawal)
GROUP conversation: open → closed_at set (terminal) → read-only at read_only_at
```

## 9. API Design

All under `/api/v1`, Player role, session, CSRF on mutations, global error envelope.

| Method/path | Notes |
| --- | --- |
| `GET /conversations?page&limit` | Ordered by `last_message_at DESC, id DESC`; includes unread, last message preview, counterpart/post info |
| `GET /conversations/unread-summary` | `{ data: { totalUnread } }` |
| `POST /conversations/direct` | `{ playerId }` → `200` existing / `201` created |
| `GET /conversations/:id` | Members (display data only), state, `readOnlyAt` |
| `GET /conversations/:id/messages` | `beforeSeq`, `limit` (≤ 50); response `{ data, meta: { limit, nextBeforeSeq } }` (no `total`) |
| `GET /conversations/:id/sync` | §7.5 |
| `POST /conversations/:id/messages` | `multipart/form-data`: `payload { text?, clientMessageId }`, `images[]` or `file` |
| `POST /conversations/:id/read` | `{ seq }` |
| `POST /conversations/:id/typing` | — |
| `POST /conversations/:id/leave`, `POST /conversations/:id/rejoin` | Group only |
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
- Group sync runs inside the Matchmaking transaction after its locks.
- Reactions/blocks/read markers are idempotent upserts/monotonic updates.

## 14. Performance

- Index (`conversation_id`, `seq`) serves history/sync; members index serves lists.
- Poll budget per open tab: ≈ 20 sync + 4 list requests per minute; heartbeat 3 per
  minute; all paused when hidden.
- Unread computed with a grouped query over `ACTIVE` memberships.

## 15. Events / Notifications

No notification entries for messages (unread only). Group lifecycle events come
from Matchmaking.

## 16. Testing Considerations

- Concurrent sends in one conversation produce consecutive `seq` with no gap; a
  poller never misses a message.
- Resend after timeout returns the stored message and does not count quota; reused id
  with other content conflicts.
- Unread excludes own messages; `read` never exceeds `last_seq` and never decreases.
- Withdrawn member loses history and attachment access immediately; left-chat
  member gets no unread/presence and can rejoin while entitled; rejoin does not
  change `read_only_at`.
- Grace period: snapshot at terminal event; sending after it is `409`.
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

- SSE/WebSocket: not approved; would require `tech-stack.md` change and in-memory
  coordination.
- Ordering by `id`/`created_at`: rejected; concurrent commits can be observed out of order.
- Hand-written ZIP parser: rejected by the human owner (Q11).

## 19. Observability / Monitoring

- Log rate-limit rejections, idempotency conflicts, file validation failures (type
  only), media `MISSING`. Never log message text.

## 20. Acceptance / Verification Considerations

- **Given** two members sending simultaneously **When** a third member syncs **Then** both messages arrive with consecutive `seq` in commit order.
- **Given** a member who withdrew **When** they request history or an attachment **Then** `404`.
- **Given** a Player blocked by the counterpart **When** sending a direct message **Then** `409 MESSAGING_ACTION_NOT_AVAILABLE` and no block is revealed.
- **Given** a group past `read_only_at` **When** a member sends **Then** `409 MESSAGING_READ_ONLY`; history stays readable for members at the terminal event.
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

Resolved 2026-10-31: `LEFT_CHAT` members have no history or attachment access
until a valid rejoin (§7.2); leave/rejoin while Messaging is disabled keeps
membership and deadline checks and enables nothing else.

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
