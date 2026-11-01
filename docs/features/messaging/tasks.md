# Messaging — Task List

Implementation tasks for the Messaging feature.

- Linked PRD: [prd.md](prd.md) (Ready)
- Linked Tech Design: [tech-design.md](tech-design.md) (Ready)
- Schema: `docs/architecture/database-schema.md` §13.7 (Ready target delta)
- Cross-module order: [Matchmaking tasks — Social Matchmaking execution order](../matchmaking/matchmaking/tasks.md#social-matchmaking-extension--cross-module-execution-order)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named. Documents were approved Ready on 2026-10-31. Tasks with unfinished implementation dependencies remain BLOCKED; dependency-free foundation tasks are Approved.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete with automated tests that exist and pass.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| MSG-01 | Messaging schema migration | BLOCKED | Ready docs, SOC-01 | M |
| MSG-02 | Conversation core, access rules, direct and standalone group conversations | BLOCKED | MSG-01 | M |
| MSG-03 | Real-time WebSocket hub (`/api/v1/ws/messaging`) and event push | BLOCKED | MSG-02 | M |
| MSG-04 | Send: sequence, idempotency, quotas, image attachments | BLOCKED | MSG-02, SOC-02, SC-12 | M |
| MSG-05 | File attachments and DOCX/XLSX/PDF/TXT validation | BLOCKED | MSG-04 | M |
| MSG-06 | History, sync, read marker, unread, message reactions | BLOCKED | MSG-04 | M |
| MSG-07 | Real-time presence and typing over WebSocket + REST | BLOCKED | MSG-02, MSG-03 | S |
| MSG-08 | Blocking and `BlockPort` | BLOCKED | Foundation: MSG-02; integration: MM-22 closure operation after MM-21 | M |
| MSG-09 | Frontend conversations, composer, block list | BLOCKED | MSG-02…MSG-08 | L |
| MSG-10 | Messaging concurrency, access-loss and gate verification | BLOCKED | MSG-01…MSG-09, RP-08 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | MSG-01 | SOC-01 |
| 2 | MSG-02 | MSG-01 (Messaging is standalone and proceeds independently of Matchmaking) |
| 3 | MSG-03, MSG-04, MSG-07, MSG-08 | MSG-02, SOC-02 |
| 4 | MSG-05, MSG-06 | MSG-04 |
| 5 | MSG-09 | backend tasks |
| 6 | MSG-10 | all, including RP-08 after SOC-08/MSG-09 |

---

## [ ] MSG-01: Messaging schema migration

```text
Status: BLOCKED
Size: M
Blocked by: SOC-01 (MEDIA_FILES); relevant documents/schema targets are Ready
```

**Objective:** Create the §13.7 tables with all CHECKs and unique indexes.

**Scope**

- In scope: `CONVERSATIONS`, `CONVERSATION_MEMBERS`, `MESSAGES`, `MESSAGE_ATTACHMENTS`, `MESSAGE_REACTIONS`, `USER_BLOCKS`, `USER_PRESENCE`, `CONVERSATION_TYPING`.
- Out of scope: data backfill (none).

**Implementation requirements**

1. Next ordered migration; record application in the schema change log.

**Files/areas affected**

- `backend/src/db/schema/messaging.ts`, `backend/src/db/migrations/` `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** §13.7.

**Verification**

- Integration: unique direct pair (low < high), group title CHECK, unique `(conversation_id, seq)` and `(sender_id, conversation_id, client_message_id)`, no self-block.

**Acceptance criteria**

- **Given** an existing direct conversation for A/B **When** inserting B/A **Then** it is rejected by the low/high unique index.

---

## [ ] MSG-02: Conversation core, access rules, direct and standalone group conversations

```text
Status: BLOCKED
Size: M
Blocked by: MSG-01
```

**Objective:** Access module (Tech Design §7.2), list/detail, direct find-or-create, standalone group creation (`POST /conversations/group`), adding members (`POST /conversations/:id/members`), and leaving a group (`POST /conversations/:id/leave`).

**Scope**

- In scope: `GET /conversations`, `GET /conversations/unread-summary` (shape), `POST /conversations/direct`, `POST /conversations/group`, `POST /conversations/:id/members`, `GET /conversations/:id`, `POST /conversations/:id/leave`; neutral errors; locked/deleted counterpart handling; `MESSAGING_ENABLED` and `MESSAGING_GROUP_MAX_MEMBERS` checks.
- Out of scope: sending (MSG-04).

**Implementation requirements**

1. One access function used by every Messaging route and the media resolver.
2. Group conversations remain active long-term with no 24-hour read-only lock; an `ACTIVE` member can add or reactivate (`LEFT → ACTIVE`) non-blocked Players up to `MESSAGING_GROUP_MAX_MEMBERS`.

**Files/areas affected**

- `backend/src/{routes,controllers,services,repositories}/messaging/` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** Reads `MESSAGING_ENABLED`.

**Verification**

- API: non-member 404; Court Owner/Admin 403; blocked or inactive counterpart → neutral 409; direct conversation without messages hidden from counterpart list.
- Leave / Re-add: `LEFT` member gets 404 for history and attachment downloads; an `ACTIVE` member adding them back restores `ACTIVE` access.

**Acceptance criteria**

- **Given** a `LEFT` member **When** requesting the conversation **Then** `404 MESSAGING_CONVERSATION_NOT_FOUND`.

---

## [ ] MSG-03: Real-time WebSocket hub (`/api/v1/ws/messaging`) and event push

```text
Status: BLOCKED
Size: M
Blocked by: MSG-02
```

**Objective:** Attach `ws` WebSocket server to the Node.js HTTP server at `/api/v1/ws/messaging`, authenticate upgrades via the existing `sid` `HttpOnly` session cookie, and push committed messaging events (`message.created`, `message.reaction_updated`, `conversation.read_updated`, `conversation.member_changed`, `presence.updated`, `typing.updated`) only to authorized `ACTIVE` members.

**Scope**

- In scope: `ws` upgrade handler on `/api/v1/ws/messaging`; session-cookie authentication (`sid` → active `PLAYER`); per-user connection registry; post-commit broadcast of `message.created`, `message.reaction_updated`, `conversation.read_updated`, `conversation.member_changed`, `presence.updated`, `typing.updated`; reject upgrade when `MESSAGING_ENABLED = false`.
- Out of scope: Matchmaking state logic (Messaging is standalone).

**Implementation requirements**

1. Broadcast only after the database transaction commits.
2. Never deliver events to a `LEFT` or blocked user.


**Files/areas affected**

- `backend/src/contracts/`, `backend/src/services/messaging/` `[Proposed — verify during implementation]`

**API impact:** None directly (group chat open on legacy posts uses MSG-02 routes).

**Schema/config impact:** Reads grace config.

**Verification**

- Integration: unauthenticated or non-Player WebSocket upgrade rejected; committed message pushes `message.created` with matching `seq` to connected `ACTIVE` members; rolled-back transaction emits no WebSocket event; `LEFT` member receives no event after leaving.

**Acceptance criteria**

- **Given** two connected `ACTIVE` members **When** one sends a message **Then** the other receives `message.created` over WebSocket after commit with the exact stored `seq`.

---

## [ ] MSG-04: Send — sequence, idempotency, quotas, image attachments

```text
Status: BLOCKED
Size: M
Blocked by: MSG-02, SOC-02, SC-12
```

**Objective:** `POST /conversations/:id/messages` per Tech Design §7.4 with images.

**Scope**

- In scope: trim/limits; images or file exclusivity (file path enabled by MSG-05); replay/conflict by `content_hash`; per-minute and new-direct quotas under the sender `USERS` lock; conversation row lock and `seq`; `first_sent_at`; read-only and block checks.
- Out of scope: file validation (MSG-05).

**Implementation requirements**

1. Replay lookup before quota.
2. Lock order `USERS` → `CONVERSATIONS`.

**Files/areas affected**

- `backend/src/services/messaging/` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** Reads `MESSAGING_MESSAGES_PER_MINUTE`, `MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY`.

**Verification**

- Concurrency: 20 parallel sends by different members produce `seq` 1..20 with no gap.
- API: replay same → one message, not counted; same id different text → 409; 31st message in 60 s → 429; 21st new direct conversation today → 429, reply in existing conversation allowed.

**Acceptance criteria**

- **Given** a `LEFT` group member **When** sending **Then** `404 MESSAGING_CONVERSATION_NOT_FOUND`.

---

## [ ] MSG-05: File attachments and DOCX/XLSX/PDF/TXT validation

```text
Status: BLOCKED
Size: M
Blocked by: MSG-04; exact yauzl@3.4.0 approved 2026-10-31; verify audit at implementation
```

**Objective:** Accept one file per message with the basic format checks in Tech Design §7.6.

**Scope**

- In scope: addition of approved yauzl@3.4.0; central-directory inspection limits; PDF/TXT checks; `attachment` disposition.
- Out of scope: malware scanning.

**Implementation requirements**

1. Parser errors caught and mapped to `400 MESSAGING_FILE_INVALID`.
2. Pin the approved version exactly; record its dependency tree, licenses and the `npm audit` result on the backend lockfile. Unrelated audit findings do not block this task.

**Files/areas affected**

- `backend/package.json`, `backend/src/validation/messaging-files.ts` `[Proposed — verify during implementation]`

**API impact:** File field on send.

**Schema/config impact:** Dependency (tech-stack.md).

**Verification**

- Unit fixtures: valid DOCX/XLSX/PDF/TXT; renamed ZIP; macro-enabled; encrypted entry; too many entries; malformed central directory; invalid UTF-8; NUL byte.

**Acceptance criteria**

- **Given** a malformed ZIP renamed `.docx` **When** uploaded **Then** `400 MESSAGING_FILE_INVALID` and the process keeps serving requests.

---

## [ ] MSG-06: History, sync, read marker, unread, message reactions

```text
Status: BLOCKED
Size: M
Blocked by: MSG-04
```

**Objective:** Tech Design §7.5.

**Scope**

- In scope: `GET /messages?beforeSeq`, `GET /sync`, `POST /read`, unread in list and summary, `PUT/DELETE /messages/:id/reaction` with `activity_version`/`reaction_version`.
- Out of scope: presence (MSG-07).

**Implementation requirements**

1. `read` = `GREATEST(current, LEAST(seq, last_seq))`.
2. Unread excludes own messages; left-chat memberships contribute no unread.

**Files/areas affected**

- `backend/src/services/messaging/`, `backend/src/repositories/messaging/` `[Proposed — verify during implementation]`

**API impact:** As listed; cursor pagination exception (conventions.md).

**Schema/config impact:** None.

**Verification**

- Integration: poller with `afterSeq` never misses concurrent sends; read marker monotonic; reaction change visible through `sinceVersion`.

**Acceptance criteria**

- **Given** a member who has seen up to seq 5 of 8 **When** they post `read { seq: 10 }` **Then** `last_read_seq = 8`, and unread excludes their own messages.

---

## [ ] MSG-07: Presence and typing

```text
Status: BLOCKED
Size: S
Blocked by: MSG-02
```

**Objective:** Heartbeat, typing and visibility-scoped presence (Tech Design §7.7).

**Scope**

- In scope: `POST /presence/heartbeat`, `POST /conversations/:id/typing`, server write throttles, presence/typing in `sync`, cleanup of expired typing rows, disabled gate.
- Out of scope: frontend timers (MSG-09).

**Implementation requirements**

1. Presence only through shared non-left, non-revoked memberships and no direct block.

**Files/areas affected**

- `backend/src/services/messaging/` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** None.

**Verification**

- Integration: blocked pair sees no direct presence; left-chat member neither sees nor exposes presence through that group; heartbeat within 15 s does not write.

**Acceptance criteria**

- **Given** `MESSAGING_ENABLED = false` **When** sending a heartbeat **Then** `409 MESSAGING_DISABLED` and no row changes.

---

## [ ] MSG-08: Blocking and `BlockPort`

```text
Status: BLOCKED
Size: M
Blocked by: foundation: MSG-02; integration: MatchmakingBlockPort closure operation (MM-22, after MM-21)
```

**Approved split (human owner, 2026-11-01):** Foundation provides the real `BlockPort.isBlockedEitherWay(a, b, tx)` independently of Matchmaking acceptance. Integration calls `MatchmakingBlockPort.closePendingBetween(a, b, tx)` inside the block transaction. The closure operation belongs to MM-22 but can ship after MM-21 before MM-22 is DONE; do not wait for the whole MM-22 task. Foundation may unblock MM-22/MM-24; MSG-08 as a whole is DONE only after both parts pass. Do not expose a partially integrated production block mutation that leaves pending rows open.

**Objective:** Block list, block/unblock, and the cross-module check (Tech Design §7.8).

**Scope**

- In scope: `GET/POST/DELETE /blocks`; pending Apply/Invite closure via Matchmaking contract in the same transaction; `BlockPort.isBlockedEitherWay`.
- Out of scope: hiding posts (blocking grants/denies no visibility).

**Implementation requirements**

1. Lock both `USERS` rows ascending first.
2. No notification to the blocked Player.

**Files/areas affected**

- `backend/src/services/messaging/`, `backend/src/contracts/BlockPort.ts` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** None.

**Verification**

- Integration: pending rows closed with `BLOCKED`; group memberships unchanged; unblock restores nothing.

**Acceptance criteria**

- **Given** A blocks B with a pending Apply from B to A's post **When** the block commits **Then** the Apply is `CANCELLED` (`BLOCKED`) and B receives no block notice.

---

## [ ] MSG-09: Frontend conversations, composer, block list

```text
Status: BLOCKED
Size: L
Blocked by: MSG-02…MSG-08; route approval in frontend.md
```

**Objective:** Messaging PRD §9 under `frontend/src/features/messaging/`.

**Scope**

- In scope: list with unread, conversation view, history paging, composer (images or file), sending/failed/resend with the same `clientMessageId`, reactions, typing (debounced), online, leave/rejoin, read-only, blocked, connection-lost, disabled; header badge; block list; entry points from profile/post.
- Out of scope: Admin views.

**Implementation requirements**

- Figma mapping: `docs/architecture/frontend.md`, "Social and Messaging — Figma alignment review, 2026-10-31". List 99:45354; direct 99:45426; group 99:45582; read-only 99:46232; blocks 99:45764; states 99:45821; components 99:46361; mobile list/conversation 99:46712 / 99:46751.
- Desktop is a two-column list/detail workspace; mobile is separate list and detail views with back navigation. Keep history scroll position when prepending older pages and keep the composer usable on small screens.
- Header unread badge belongs to the existing Player shell, separate from Notifications; update only from loaded/rendered seq and server summary, never from opening alone or the sample 3/2/1 counts.
- Shared authorized images may open a lightbox; files use filename/type/size and authorized download only. The PDF-preview example is excluded; no inline document renderer/new dependency.
- Preserve draft, selected attachments and clientMessageId across failed-send retry. Do not simulate 62% upload progress. Message context menu has reactions/report only; no edit/delete/recall/forward or read receipts.
- RP-08 owns the shared report dialog/entry wiring. Reuse PP-09 profile modal entry and shared feature-agnostic media/reaction/dialog primitives.
- Group member count excludes companions, pending and revoked members; read-only/gate/presence/leave/rejoin behavior follows server permissions and deadlines, not the static gallery.

1. WebSocket connection (`/api/v1/ws/messaging`) with automatic reconnect and `afterSeq` REST catch-up on reconnect/focus.
2. Read marker uses the highest rendered `seq` only.

**Files/areas affected**

- `frontend/src/features/messaging/`, `frontend/src/shared/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes MSG APIs.

**Schema/config impact:** None.

**Verification**

- Two-browser Playwright at 1280px plus 390px mobile checks: opening without rendered messages keeps unread; render advances only the visible marker; preload older history without scroll jump; attachment download has no inline PDF viewer.
- Verify direct/group, block/unblock, left-chat/rejoin versus withdrawn, grace/read-only, feature disabled and connection/retry states using the frame mapping.

- E2E: two browsers exchange messages; resend after simulated network failure creates one message; withdrawn member loses the conversation.

**Acceptance criteria**

- **Given** a conversation opened before its unread messages render **Then** the header/list counts do not prematurely clear.
- **Given** a PDF attachment **When** selecting its download action **Then** the authorized download flow is used without an embedded document preview.
- **Given** 6/8 occupied kèo slots including 2 companions and 4 accounts **Then** the group roster shows 4 chat accounts, not 6.

- **Given** a hidden tab **When** 1 minute passes **Then** no sync or heartbeat requests are sent.

---

## [ ] MSG-10: Messaging concurrency, access-loss and gate verification

```text
Status: BLOCKED
Size: M
Blocked by: MSG-01…MSG-09, RP-08
```

**Objective:** Cross-task regression and E2E after MSG-01…MSG-09. Ordering, idempotency, quotas (MSG-04), unread (MSG-06), access loss (MSG-02/MSG-03), presence (MSG-07) and blocks (MSG-08) are tested in their owning tasks; this task does not replace them.

**Scope**

- In scope: two-browser E2E, gate behavior end to end, access loss across Matchmaking withdrawal → conversation → attachment download.
- Out of scope: load testing; per-task tests.

**Implementation requirements**

1. Backend tests under `backend/src/__tests__/`; E2E under `frontend/e2e/`.

**Files/areas affected**

- `backend/src/__tests__/messaging-*.test.ts`, `frontend/e2e/` (two-browser and mobile Messaging/reporting flows) `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- All §20 cases automated.

**Acceptance criteria**

- **Given** a member who left the group (`LEFT`) **When** fetching a previously visible attachment **Then** `404`.

## Final Phase 2 review — approved 2026-10-31

PRD, Tech Design and the relevant schema targets are Ready under explicit human approval. This is documentation approval, not completion of implementation dependencies. Task checkboxes and DONE history are unchanged.

- MSG-04: authorize replay reads before returning content; recheck clientMessageId after sender/conversation locks and before quota; test concurrent identical retries, conflicting payloads, and replay after withdrawal/leave.
- MSG-06: reaction locks conversation before message/reaction; consistent-snapshot sync returns nextAfterSeq/hasMore/nextSinceVersion; preserve the version cursor through backlog pages and refresh when older history expands the loaded range. Test >100 queued messages with concurrent reactions so none are missed.
- MSG-10: verify access-loss/replay and conversation-first lock order with real concurrent transactions.
