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
|  |  | DONE | Ready docs | M |
|  |  | DONE | MSG-01 | M |
|  |  | DONE | MSG-02 | M |
|  |  | DONE | MSG-02, SC-12 | M |
|  |  | DONE | MSG-04 | M |
|  |  | DONE | MSG-04 | M |
|  |  | DONE | MSG-02, MSG-03 | S |
|  |  | DONE | MSG-02 | M |
|  |  | DONE | MSG-02…MSG-08 | L |
|  |  | DONE | MSG-01…MSG-09 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | MSG-01 | Ready docs |
| 2 | MSG-02 | MSG-01 (Messaging is standalone and proceeds independently of Matchmaking) |
| 3 | MSG-03, MSG-04, MSG-07, MSG-08 | MSG-02, SC-12 |
| 4 | MSG-05, MSG-06 | MSG-04 |
| 5 | MSG-09 | backend tasks |
| 6 | MSG-10 | MSG-01…MSG-09 (report dialog wiring is tracked in RP-08) |

---

## [x]  Messaging schema migration

```text
Status: DONE
Size: M
Blocked by: None; relevant documents/schema targets are Ready
```

**Objective:** Create the §13.7 tables with all CHECKs and unique indexes.

**Scope**

- In scope: `MEDIA_FILES` (§13.1), `CONVERSATIONS`, `CONVERSATION_MEMBERS`, `MESSAGES`, `MESSAGE_ATTACHMENTS`, `MESSAGE_REACTIONS`, `USER_BLOCKS`, `USER_PRESENCE`, `CONVERSATION_TYPING` (§13.7).
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

## [x]  Conversation core, access rules, direct and standalone group conversations

```text
Status: DONE
Size: M
Blocked by: MSG-01
```

**Objective:** Access module (Tech Design §7.2), list/detail, direct find-or-create, standalone group creation (`POST /conversations/group`), adding members (`POST /conversations/:id/members`), and leaving a group (`POST /conversations/:id/leave`).

**Scope**

- In scope: `GET /players/search` (active non-blocked Player search by name for starting direct/group chats), `GET /conversations`, `GET /conversations/unread-summary` (shape), `POST /conversations/direct`, `POST /conversations/group`, `POST /conversations/:id/members`, `GET /conversations/:id`, `POST /conversations/:id/leave`; neutral errors; locked/deleted counterpart handling; `MESSAGING_ENABLED` and `MESSAGING_GROUP_MAX_MEMBERS` checks.
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

## [x]  Real-time WebSocket hub (`/api/v1/ws/messaging`) and event push

```text
Status: DONE
Size: M
Blocked by: MSG-02
```

**Objective:** Attach `ws` WebSocket server to the Node.js HTTP server at `/api/v1/ws/messaging`, authenticate upgrades via the existing `sid` `HttpOnly` session cookie, and push committed messaging events (`message.created`, `message.reaction_updated`, `conversation.read_updated`, `conversation.member_changed`, `presence.updated`, `typing.updated`) only to authorized `ACTIVE` members.

**Scope**

- In scope: `ws` upgrade handler on `/api/v1/ws/messaging`; session-cookie authentication (`sid` → active `PLAYER`); `(userId, sessionId)` connection registry with immediate disconnect on session revocation/account suspension and periodic/push session-expiry re-validation; post-commit broadcast of `message.created`, `message.reaction_updated`, `conversation.read_updated`, `conversation.member_changed`, `presence.updated`, `typing.updated`; reject upgrade when `MESSAGING_ENABLED = false`.
- Out of scope: Matchmaking state logic (Messaging is standalone).

**Implementation requirements**

1. Broadcast only after the database transaction commits.
2. Never deliver conversation events to a `LEFT` member; apply `player_blocks` filtering only to `DIRECT` conversation events and direct-relationship `presence.updated` events, while delivering `GROUP` conversation events to all `ACTIVE` group members (matching REST §7.2).
3. Index open sockets by `(userId, sessionId)`; immediately close sockets (`1008`) when a session is revoked (sign-out, password change/reset, Admin session termination) or the user becomes non-`ACTIVE`, and re-verify session expiry (`idle_expires_at` / `absolute_expires_at`) and `ACTIVE` user status on every 30 s heartbeat, client frame, and outbound event push.


**Files/areas affected**

- `backend/src/contracts/`, `backend/src/services/messaging/` `[Proposed — verify during implementation]`

**API impact:** Adds WebSocket endpoint `GET /api/v1/ws/messaging`.

**Schema/config impact:** Reads `MESSAGING_ENABLED`.

**Verification**

- Integration: unauthenticated or non-Player WebSocket upgrade rejected; committed message pushes `message.created` with matching `seq` to connected `ACTIVE` members; rolled-back transaction emits no WebSocket event; `LEFT` member receives no event after leaving; sign-out, session expiry, or Admin suspension immediately closes the open WebSocket and prevents further event delivery; two Players who blocked each other still receive `GROUP` events over WebSocket while `DIRECT` events and direct `presence.updated` between them are suppressed.

**Acceptance criteria**

- **Given** two connected `ACTIVE` members **When** one sends a message **Then** the other receives `message.created` over WebSocket after commit with the exact stored `seq`.
- **Given** an open WebSocket connection **When** the user signs out, the session expires, or an Admin suspends the user **Then** the socket is closed (`1008`) and receives no subsequent events.
- **Given** two Players with a block between them who are both `ACTIVE` in a `GROUP` conversation **When** a group message is sent **Then** both receive `message.created` over WebSocket (matching REST), whereas `DIRECT` events and direct `presence.updated` between them are not delivered.

---

## [x]  Send — sequence, idempotency, quotas, image attachments

```text
Status: DONE
Size: M
Blocked by: MSG-02, SC-12
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

## [x]  File attachments and DOCX/XLSX/PDF/TXT validation

```text
Status: DONE
Size: M
Blocked by: MSG-04; exact yauzl@3.4.0 approved 2026-10-31; verify audit at implementation
```

**Objective:** Accept one file per message with the basic format checks in Tech Design §7.6.

**Scope**

- In scope: addition of approved yauzl@3.4.0; central-directory inspection limits; PDF/TXT checks; `attachment` disposition.
- Out of scope: malware scanning.

**Implementation requirements**

1. Parser errors caught and mapped to `400 MESSAGING_FILE_INVALID`.
2. Pin the approved version exactly; record its dependency tree, licenses and the `npm audit` result on the backend lockfile. Unrelated audit findings do not block this task. (Verified 2026-11-01 on backend/package-lock.json: yauzl@3.4.0 -> pend@1.2.0, MIT, 0 advisories on yauzl in npm audit).

**Files/areas affected**

- `backend/package.json`, `backend/src/validation/messaging-files.ts` `[Proposed — verify during implementation]`

**API impact:** File field on send.

**Schema/config impact:** Dependency (tech-stack.md).

**Verification**

- Unit fixtures: valid DOCX/XLSX/PDF/TXT; renamed ZIP; macro-enabled; encrypted entry; too many entries; malformed central directory; invalid UTF-8; NUL byte.

**Acceptance criteria**

- **Given** a malformed ZIP renamed `.docx` **When** uploaded **Then** `400 MESSAGING_FILE_INVALID` and the process keeps serving requests.

---

## [x]  History, sync, read marker, unread, message reactions

```text
Status: DONE
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

## [x]  Presence and typing

```text
Status: DONE
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

## [x]  Blocking and `BlockPort`

```text
Status: DONE
Size: M
Blocked by: MSG-02
```

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

## [x]  Frontend conversations, composer, block list

```text
Status: DONE
Size: L
Blocked by: MSG-02…MSG-08 (routes `/messages`, `/messages/:conversationId`, `/settings/blocks` approved in `frontend.md` on 2026-11-01)
```

**Objective:** Messaging PRD §9 under `frontend/src/features/messaging/`.

**Scope**

- In scope: list with unread, conversation view, history paging, composer (images or file), sending/failed/resend with the same `clientMessageId`, reactions, typing (debounced), online, create group, add members, leave group, blocked, connection-lost, disabled; header badge; block list; entry points from profile/post.
- Out of scope: Admin views.

**Implementation requirements**

- Figma mapping: `docs/architecture/frontend.md`, "Social and Messaging — Figma alignment review, 2026-10-31". List 99:45354; direct 99:45426; group 99:45582; read-only 99:46232; blocks 99:45764; states 99:45821; components 99:46361; mobile list/conversation 99:46712 / 99:46751.
- Desktop is a two-column list/detail workspace; mobile is separate list and detail views with back navigation. Keep history scroll position when prepending older pages and keep the composer usable on small screens.
- Header unread badge belongs to the existing Player shell, separate from Notifications; update only from loaded/rendered seq and server summary, never from opening alone or the sample 3/2/1 counts.
- Shared authorized images may open a lightbox; files use filename/type/size and authorized download only. The PDF-preview example is excluded; no inline document renderer/new dependency.
- Preserve draft, selected attachments and clientMessageId across failed-send retry. Do not simulate 62% upload progress. Message context menu has reactions/report only; no edit/delete/recall/forward or read receipts.
- RP-08 owns the shared report dialog/entry wiring. Reuse PP-09 profile modal entry and shared feature-agnostic media/reaction/dialog primitives.
- Group member count reflects `ACTIVE` conversation members; gate/presence/leave/add-member behavior follows server permissions, not the static gallery.

1. WebSocket connection (`/api/v1/ws/messaging`) with automatic reconnect and `afterSeq` REST catch-up on reconnect/focus.
2. Read marker uses the highest rendered `seq` only.

**Files/areas affected**

- `frontend/src/features/messaging/`, `frontend/src/shared/hooks/` `[Proposed — verify during implementation]`

**API impact:** Consumes MSG APIs.

**Schema/config impact:** None.

**Verification**

- Two-browser Playwright at 1280px plus 390px mobile checks: opening without rendered messages keeps unread; render advances only the visible marker; preload older history without scroll jump; attachment download has no inline PDF viewer.
- Verify direct/group, block/unblock, leave group and re-add by an active member, feature disabled and connection/retry states using the frame mapping.

- E2E: two browsers exchange messages over WebSocket; resend after simulated network failure creates one message; member who left a group (`LEFT`) loses the conversation.

**Acceptance criteria**

- **Given** a conversation opened before its unread messages render **Then** the header/list counts do not prematurely clear.
- **Given** a PDF attachment **When** selecting its download action **Then** the authorized download flow is used without an embedded document preview.
- **Given** a group conversation with 4 `ACTIVE` members and 1 `LEFT` member **Then** the group roster shows 4 active members.

- **Given** a hidden tab **When** 1 minute passes **Then** no sync or heartbeat requests are sent.

---

## [x]  Messaging concurrency, access-loss and gate verification

```text
Status: DONE
Size: M
Blocked by: MSG-01…MSG-09 (report dialog wiring is tracked separately in RP-08)
```

**Objective:** Cross-task regression and E2E after MSG-01…MSG-09. Ordering, idempotency, quotas (MSG-04), unread (MSG-06), access loss (MSG-02/MSG-03), presence (MSG-07) and blocks (MSG-08) are tested in their owning tasks; this task does not replace them.

**Scope**

- In scope: two-browser E2E, gate behavior end to end, WebSocket session revocation/expiry, access loss across group leave (`LEFT`) → conversation → attachment download.
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

- MSG-04: authorize replay reads before returning content; recheck clientMessageId after sender/conversation locks and before quota; test concurrent identical retries, conflicting payloads, and replay after leaving a group (`LEFT`).
- MSG-06: reaction locks conversation before message/reaction; consistent-snapshot sync returns nextAfterSeq/hasMore/nextSinceVersion; preserve the version cursor through backlog pages and refresh when older history expands the loaded range. Test >100 queued messages with concurrent reactions so none are missed.
- MSG-10: verify access-loss/replay and conversation-first lock order with real concurrent transactions.
