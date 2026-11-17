# In-app Notifications — Technical Design

Status: Ready. Owner: Tech Lead. Approved by: Human owner, 2026-10-10.
PRD: prd.md. Schema authority: docs/architecture/database-schema.md §3.24.

Use route/controller/service/repository layering, existing authentication, CSRF,
error envelope and page/limit/meta pagination. API paths below have /api/v1 prefix:
- GET /notifications: caller-scoped, newest created_at/id first; optional isRead,
  page/limit; returns id/type/title/content/resourceType/resourceId/isRead/readAt.
- GET /notifications/unread: caller-scoped unreadCount and paginated unread items.
- GET /notifications/:id: caller-only; 404 NOTIFICATION_NOT_FOUND otherwise.
- POST /notifications/:id/read: caller-only, CSRF; idempotent 200, set is_read and
  read_at once. GET never changes read state. No bulk-read endpoint in MVP.

Mutation errors use existing auth/validation codes; non-owned/missing ids share
404 NOTIFICATION_NOT_FOUND. Recipients and type/resource metadata are trusted
server inputs, never caller-controlled. Resource lookup reuses owning-domain
access checks, so a notification never authorizes a linked resource.

Extend NotificationService.notify with caller transaction, resource reference
and a stable dedup key identifying event/entity transition/recipient. Notification
rows commit in the same transaction as domain state. UNIQUE(user_id,dedup_key)
prevents duplicate events under retry. If insertion fails, rollback the state
transition; never silently drop a notification. No queue or event bus is added.
Use §3.24 notification indexes and 30-second frontend notification polling,
refresh on focus and stop on unmount. Test scoping, read replay, transactional
rollback, duplicate state-transition notification and revoked resource access.

## Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

Status: Ready, Decision Status Approved. Uses the Ready contract above unchanged
(caller transaction, resource reference, dedup key, 30-second polling).

New `resource_type` values: `POST`, `MATCHMAKING_REQUEST`, `CONVERSATION`. Human-approved scope clarification (2026-11-01): no current notification producer targets CONVERSATION, so its resolver/navigation is deferred and is not required to complete NTF-05 or Social; retain the resource value without adding a producer.
New types (producer → recipients; dedup key pattern):

| Type | Producer | Recipients | Dedup key |
| --- | --- | --- | --- |
| `MM_APPLICATION_RECEIVED` | Matchmaking | Host | `mm-app-received:<rowId>` |
| `MM_APPLICATION_ACCEPTED` / `_DECLINED` | Matchmaking | Applicant | `mm-app-decided:<rowId>` |
| `MM_INVITATION_RECEIVED` (incl. unpublished) | Matchmaking | Invitee | `mm-inv-received:<rowId>` |
| `MM_MEMBERSHIP_CHANGED` (joined, withdrew) | Matchmaking | Host and current members | `mm-member:<rowId>:<status>:<recipientId>` |
| `MM_PENDING_CLOSED_CONFLICT` | Matchmaking | Affected Player (and host for Apply) | `mm-conflict-close:<rowId>:<recipientId>` |
| `MM_POST_CANCELLED` / `MM_POST_CLOSED` | Matchmaking | Members and pending Players | `mm-post:<requestId>:<status>:<recipientId>` |
| `MM_RECRUITMENT_REOPENED` | Matchmaking | Host and members | `mm-reopen:<requestId>:<withdrawRowId>:<recipientId>` |
| `MM_CLOSED_INSUFFICIENT_PLAYERS` | Matchmaking | Host (states the kept booking is still valid) and members | `mm-insufficient:<requestId>:<recipientId>` |
| `MM_BOOKING_CANCELLED` | Matchmaking | Host and members | `mm-booking-cancelled:<requestId>:<recipientId>` |
| `MM_COURT_UPDATED` | Matchmaking | Members | `mm-court:<requestId>:<bookingId>:<recipientId>` |
| `SOCIAL_POST_COMMENTED` | Social | Post author (not self) | `post-comment:<commentId>:<recipientId>` |

No notification for reactions or messages. Opening a link re-checks access in the
owning module. Depends on NTF-01..03.


### Final Phase 2 approval — 2026-10-31

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.

## Resource resolver allowlist — implemented 2026-11-16 (NTF-05 / D5)

`GET /notifications/:id` returns `resourcePath` resolved at open time from this allowlist.
A missing, hidden, deleted or unreadable resource returns `resourcePath: null`; the
notification content is still returned. Unknown resource types never produce a link.

| resourceType | Path | Owning-module check |
| --- | --- | --- |
| `POST` | `/posts/:postId` | Social `canView` (`postVisibility`); PLAYER only |
| `COMMENT` | `/posts/:postId#comment-:commentId` | comment not deleted/hidden + Social `canView` of its post |
| `MATCHMAKING_REQUEST` | `/matchmaking/requests/:requestId` | Matchmaking `getRequestDetail` (owner/member/public tier) |
| `MATCH` | `/matchmaking/matches/:matchId` | Matchmaking `getMatchDetail` (participant only) |
| `CONVERSATION` | `/messages/:conversationId` | Messaging `getConversationAccess` (ACTIVE member); no producer yet |
| `BOOKING` | `/bookings/:bookingId` | Booking `getBookingDetail` (booking owner only); producer belongs to BK-10 |

`TOURNAMENT` is intentionally not in the allowlist: the Player portal has no real
tournament detail route yet. Add it with TRN-10 together with its producer. List and unread
responses do not resolve links (no per-row access checks); only the detail response does.
