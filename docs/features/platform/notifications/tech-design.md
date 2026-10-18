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
