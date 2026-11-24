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
| `SOCIAL_POST_REACTED` | Social | Post author (not self) | `post-reaction:<postId>:<reactorId>` |

No notification for messages. `SOCIAL_POST_REACTED` was added on 2026-11-23: one
notification per post per reactor, created in the reaction transaction; changing
the type, removing and re-adding the reaction does not notify again. Opening a
link re-checks access in the owning module (blocked posts resolve to null).
Depends on NTF-01..03.


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
| `PROFILE` | `/profile` | Owning active `PLAYER` only; resource id must equal the viewer id (rating extension 2026-11-23) |
| `ADMIN_REPORT` | `/admin/reports?reportId=:reportId` | `ADMIN` only + report exists |
| `ADMIN_FACILITY` | `/admin/courts?status=PENDING_APPROVAL` | `ADMIN` only + facility exists and is not deleted |
| `ADMIN_PAYOUT` | `/admin/wallet/payouts?payoutId=:id` | `ADMIN` only + payout exists |
| `ADMIN_REFUND` | `/admin/wallet/refunds?paymentId=:id` | `ADMIN` only + refund intent exists |
| `ADMIN_PAYMENT` | `/admin/wallet/reconciliation` | `ADMIN` only |
| `ADMIN_CONFIG_AUDIT` | `/admin/configs?key=:configKey` | `ADMIN` only + audit row exists |
| `ADMIN_USER` | `/admin/users?userId=:id` | `ADMIN` only + user exists and is not deleted |

### Rating received extension — implemented 2026-11-23

| Type | Producer | Recipients | Resource / deep link | Dedup key |
| --- | --- | --- | --- | --- |
| `RATING_RECEIVED` | New rating row in `RatingService.createRatings`, same transaction (rollback removes it) | Rated Player only | `PROFILE` → `/profile` (own active Player only) | `rating-received:<ratingId>` |

The notification never includes the rater identity or submitted scores. A duplicate
rating replay inserts no row and therefore no notification. No queue, WebSocket or push
transport is added; existing 30-second polling delivers it.

### Admin operations extension — implemented 2026-11-18

All types reuse the caller-transaction contract except webhook and security alerts,
which use `notifyAdminsBestEffort` in a separate transaction so an alert failure never
changes the domain response. Recipients are active, non-deleted Admins; security events
exclude the acting Admin.

| Type | Producer | Recipients | Dedup key |
| --- | --- | --- | --- |
| `ADMIN_PAYOUT_PENDING` | Payout created and left `PENDING` (no auto-approve) | Every active Admin | `admin-payout:<payoutId>` |
| `ADMIN_REFUND_FAILED` | Refund worker marks a refund `FAILED` | Every active Admin | `admin-refund:<paymentId>` |
| `ADMIN_PAYOUT_FAILED` | Outgoing payout webhook/payment error | Every active Admin | `admin-payout-failed:<payoutId>:<code>` |
| `ADMIN_PAYMENT_MISMATCH` | Top-up/payment webhook signature, order-ref, amount or state failure | Every active Admin | `admin-payment-mismatch:<provider>:<orderRef>:<code>:<minute>` |
| `ADMIN_CONFIG_CHANGED` | Successful system config update | Active Admins except actor | `admin-config:<auditId>` |
| `ADMIN_OWNER_EARNING_PENDING` | Owner earning settlement created with `PENDING` while auto-credit is off | Every active Admin | `admin-owner-earning:<bookingId>` |
| `ADMIN_OWNER_EARNING_REVERSAL_FAILED` | Payment refunded but Owner wallet cannot cover the automatic earning reversal | Every active Admin | `admin-owner-earning-reversal:<bookingId>` |
| `ADMIN_HIGH_RISK_REPORT` | Distinct reporters on one target reach `REPORT_HIGH_RISK_THRESHOLD` in `REPORT_HIGH_RISK_WINDOW_HOURS` | Every active Admin | `admin-report-risk:<targetType>:<targetId>:<windowStart>` |
| `ADMIN_SECURITY_EVENT` | Admin account created or Admin password reset | Active Admins except actor | `admin-security:<event>:<userId>` (account) / timestamp bucket (password) |

### Admin inbox producers — implemented 2026-11-18

Admin recipients are resolved inside the caller's transaction (role `ADMIN`, status
`ACTIVE`, not deleted). The notification commits or rolls back with the domain event.

| Type | Producer | Recipients | Dedup key |
| --- | --- | --- | --- |
| `ADMIN_REPORT_CREATED` | Report submission (Player report) | Every active Admin | `admin-report:<reportId>` |
| `ADMIN_FACILITY_SUBMITTED` | Owner facility/court onboarding or resubmission; facility address change | Every active Admin | `admin-facility:<facilityId>:<reviewId>` / `admin-court:<courtId>:<reviewId>` |

`TOURNAMENT` is intentionally not in the allowlist: the Player portal has no real
tournament detail route yet. Add it with TRN-10 together with its producer. List and unread
responses do not resolve links (no per-row access checks); only the detail response does.

### Court Owner inbox extension — implemented 2026-11-23

Recipients are resolved inside the caller transaction from the owning booking,
payout, settlement, facility or court. Dead or deleted users are skipped; role is
checked by the resolver, not by the notification row. The producer adds the FK
`USERS` locks required by its existing transaction (`USERS(player+owner) → BOOKING`;
payout/earning/review paths lock the Owner before wallet/resource work).

| Type | Producer | Recipients | Dedup key |
| --- | --- | --- | --- |
| `OWNER_BOOKING_CREATED` | Booking confirmation (`CONFIRMED`, not `EXPIRED`) | Facility Owner | `owner-booking-created:<bookingId>` |
| `OWNER_BOOKING_CANCELLED` | Player cancellation (`mode = PLAYER`) | Facility Owner | `owner-booking-cancelled:<bookingId>` |
| `OWNER_PAYOUT_APPROVED` / `_REJECTED` / `_PAID` | Payout approve (including auto-approve), reject, mark paid; `OWNER_PAYOUT` only | Payout owner | `owner-payout:<payoutId>:<status>` |
| `OWNER_EARNING_CREDITED` | Owner earning auto credit and Admin approval | Settlement Owner | `owner-earning:<settlementId>` |
| `OWNER_EARNING_REVERSED` | Automatic refund reversal and manual reversal after a successful debit | Settlement Owner | `owner-earning-reversal:<bookingId>` |
| `OWNER_FACILITY_REVIEW_APPROVED` / `_REJECTED` | Facility onboarding/address review decision | Facility Owner | `owner-facility-review:<reviewId>` |
| `OWNER_COURT_REVIEW_APPROVED` / `_REJECTED` | Court onboarding review decision | Facility Owner | `owner-court-review:<reviewId>` |

| resourceType | Path | Owning-module check |
| --- | --- | --- |
| `OWNER_BOOKING` | `/owner/schedule?facilityId=:facilityId&bookingId=:id&date=:date` | `COURT_OWNER`; Owner booking detail and the facility still belong to the viewer |
| `OWNER_PAYOUT` | `/owner/wallet` | `COURT_OWNER`; `requestType = OWNER_PAYOUT` and payout belongs to the viewer |
| `OWNER_EARNING` | `/owner/wallet` | `COURT_OWNER`; settlement belongs to the viewer |
| `OWNER_FACILITY` | `/owner/facilities?facilityId=:id` | `COURT_OWNER`; facility is owned and not deleted |
| `OWNER_COURT` | `/owner/facilities?facilityId=:facilityId&courtId=:id` | `COURT_OWNER`; court and facility are owned and not deleted |

Owner payout notifications never include `adminNote`; free-text reasons are
truncated and stripped of email/phone patterns before persistence.
