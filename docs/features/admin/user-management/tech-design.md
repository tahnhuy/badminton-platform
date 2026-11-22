# Feature Tech Design: Admin User Management

## 1. Metadata

```text
Status: Ready
Owner: Admin Team
PRD: docs/features/admin/user-management/prd.md
Scope: Admin User Management API and State Flow
Decision Status: Approved
```

## 2. Context

This feature implements the Admin User Management capabilities defined in the PRD. It allows platform administrators to view, search, filter, update statuses, and soft-delete user accounts (Players, Court Owners, and Admins). The feature relies heavily on the `USERS`, `PLAYER_PROFILES`, and `COURT_OWNER_PROFILES` tables in the database schema.

## 3. Technical Problem

- Providing a paginated, filterable, and searchable list of users requires efficient querying across the `USERS` table and its associated profile tables (`PLAYER_PROFILES`, `COURT_OWNER_PROFILES`), likely requiring `JOIN` operations.
- Enforcing soft-deletion (`deleted_at`) ensures historical transactions (bookings, matches, tournaments) remain intact, but requires ensuring that all authentication and active-user queries correctly filter out soft-deleted or deactivated users.
- Restricting access so that only `ADMIN` roles can hit these endpoints.

## 4. Goals

- Implement secure REST APIs for fetching user lists and details.
- Implement secure REST APIs for mutating user status and soft-deleting users.
- Ensure all endpoints are strictly authorized for the `ADMIN` role only.
- Implement robust pagination and search/filtering logic at the database level.

## 5. Non-Goals

- Implementing custom RBAC within the `ADMIN` role (Super Admin vs. regular Admin is out of scope).
- Handling hard deletes or data anonymization/GDPR workflows.

## 6. Upstream References

- Governing PRD: [docs/features/admin/user-management/prd.md](file:///d:/Code/badminton-platform/docs/features/admin/user-management/prd.md)
- Project scope/roles/MVP: `PROJECT-BRIEF.md`
- Global database schema: `docs/architecture/database-schema.md`
- Business rules/configuration: `docs/business-rules-config-matrix.md`

## 7. Proposed Technical Design

The feature will be implemented in the PERN monolith using standard layered architecture:

- **Application/service boundary**:
  - `UserController` / `AdminUserController`: Handles HTTP request/response parsing and basic validation.
  - `UserService` / `AdminUserService`: Contains the business logic for state transitions, soft deletion rules, and cross-checking permissions.
  - `UserRepository`: Handles database queries using parameterized SQL (e.g., via `pg` or an approved query builder/ORM).
- **Persistence boundary**:
  - Queries against `USERS`, joined with `PLAYER_PROFILES` or `COURT_OWNER_PROFILES` based on the user's `role`.
- **Client/server boundary**:
  - REST API exposing JSON endpoints for the frontend Admin dashboard.
- **Cross-cutting concerns**:
  - Authorization middleware will enforce `role === 'ADMIN'`.

## 8. Behavior, State, and Flow

```text
ACTIVE → SUSPENDED
SUSPENDED → ACTIVE
ACTIVE / SUSPENDED / DEACTIVATED → SOFT_DELETED (deleted_at IS NOT NULL)
```

- Preconditions: Request must come from an authenticated user with `role = ADMIN`.
- State transitions:
  - Deactivation: Updates the user's status to `SUSPENDED` or `DEACTIVATED` according to the requested operation.
  - Soft Delete: Sets `deleted_at = NOW()`. Note that `status` could also reflect this, but `deleted_at` is the authoritative marker for deletion in the schema.
  - Admin accounts and the authenticated Admin cannot be deactivated or soft-deleted.
- Postconditions:
  - If deactivated or soft-deleted, the user's subsequent authentication attempts or active session validations must fail.

## 9. API Design

Following the approved REST conventions:

- **List Users**:
  - HTTP method/path: `GET /api/v1/admin/users`
  - Request contract: Query params `?page=1&limit=20&search=email&role=PLAYER&status=ACTIVE`
  - Response contract: `{ data: [UserObject], meta: { page, limit, total, totalPages } }`, sorted stably by `id ASC` (global pagination convention, `docs/architecture/conventions.md`).
  - Authentication/authorization boundary: opaque session cookie (`sid`) enforced by `authenticate` + `requireRole('ADMIN')`, with `X-CSRF-Token` on state-changing requests. No Bearer token (`docs/architecture/tech-stack.md`, Auth Tech Design Decision #2).
  - Follow-up (tracked): the backend `AdminUserService` and the frontend `adminUserService`/`types/user.ts` currently use the `pagination` key; they must be updated to `meta`. Tracked by `docs/features/admin/frontend-consolidation/tasks.md` AF-01.
  - HTTP status behavior: `200 OK`, `401 Unauthorized`, `403 Forbidden`.

- **Get User Details**:
  - HTTP method/path: `GET /api/v1/admin/users/:id`
  - Response contract: `{ data: UserObject }` including joined profile data.
  - HTTP status behavior: `200 OK`, `404 Not Found`.

- **Update User Status**:
  - HTTP method/path: `PATCH /api/v1/admin/users/:id/status`
  - Request contract: `{ status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" }`.
  - Response contract: `{ data: UserObject }`.
  - HTTP status behavior: `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`, `409 Conflict`.

- **Soft Delete User**:
  - HTTP method/path: `DELETE /api/v1/admin/users/:id`
  - Response contract: `204 No Content`.
  - HTTP status behavior: `204 No Content`, `403 Forbidden`, `404 Not Found`, `409 Conflict`.

- **Set New Password**:
  - HTTP method/path: `POST /api/v1/admin/users/:id/password`
  - Request contract: `{ new_password: string }`.
  - Response contract: `{ data: UserObject }`; the password is never returned.
  - HTTP status behavior: `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

- All successful responses use `{ data: ... }` except `DELETE`, which returns `204`.
- Errors use `{ error: { code, message, details } }` and never expose `password_hash` or temporary passwords.

### Display Identifier (`#UID`)

- The API returns the raw numeric `id`. The Admin UI derives a presentation-only display identifier formatted as `#UID-{id + 10000}` (e.g. `id = 1` → `#UID-10001`).
- This identifier is deterministic, display-only, and not persisted. It is not a database column and must not be used as a lookup key by the API; `id` remains the authoritative identifier for all requests.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` is the global schema authority.

- Existing schema objects affected: `USERS`, `PLAYER_PROFILES`, `COURT_OWNER_PROFILES` (Read-only, except `USERS.status` and `USERS.deleted_at` which are mutated).
- Schema delta: `N/A — no schema change`. Existing `status` and `deleted_at` fields in `USERS` are sufficient.
- Constraints/indexes affected: Add indexes on `USERS (role, status, id)` and `USERS (email)` for filtering, stable pagination, and email search.
- Migration/data backfill impact: Add the indexes in an ordered migration; no data backfill is required.
- Rationale and compatibility: Fully compatible with the frozen schema.

## 11. Security

- Authentication boundary: Requires a valid opaque session cookie (`sid`) enforced by the platform `authenticate` middleware and `requireRole('ADMIN')`; JWT is not used (`docs/architecture/tech-stack.md`).
- Authorization boundary: Middleware strictly verifying the authenticated user's `role` is `ADMIN`.
- Input and output protection: All query parameters, request bodies, and route parameters are validated with Zod and parameterized repository queries are used to prevent SQL injection.
- Sensitive data handling: `password_hash` must **never** be returned in the API responses.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Admin tries to delete themselves or another Admin | Application Logic | Return `403 Forbidden` | Admin sees an error message. |
| Admin tries to modify a non-existent user | `id` not found in DB | Return `404 Not Found` | Admin sees an error message. |
| Invalid pagination/filter parameters | Request validation layer | Return `400 Bad Request` | Frontend shows validation error. |

## 13. Concurrency / Idempotency

- Concurrency-sensitive operation: Multiple admins updating the same user simultaneously.
  - Protection: Can use standard "last write wins" for status updates since it's a simple scalar mutation. The schema does not define a `version` column on `USERS` for optimistic locking, which is acceptable for MVP admin operations.
- Idempotency requirement: `DELETE /api/v1/admin/users/:id` should be idempotent (soft-deleting an already soft-deleted user returns `204` without error).
- Transaction boundary: Updating a user's status is a single-table operation on `USERS`, so explicit multi-statement transaction management is minimal unless cascading application-level logic is later added.

## 14. Performance

- Expected workload or latency consideration: Admin dashboard traffic is low compared to player traffic.
- Relevant bottleneck: Pagination with complex `ILIKE` searches on `email` or `full_name` (joined) might be slow if the user base grows large.
- Design response: Use basic B-tree indexes. If search becomes a bottleneck, consider trigram indexes (`pg_trgm`) for text search in the future.

## 15. Events / Notifications

- No email/push notifications are added.
- Admin security alerts (implemented 2026-11-18): creating an `ADMIN` account or resetting an Admin password emits `ADMIN_SECURITY_EVENT` to other active Admins (`ADMIN_USER` resource, deep link `/admin/users?userId=<id>`). The actor is excluded and the alert is best-effort so it never fails the create/reset action. This is in addition to the existing audit log for sensitive admin actions.

## 16. Testing Considerations

- Unit behavior: Test `UserService` logic for updating status, ensuring `password_hash` is stripped from returned data.
- Integration/persistence behavior: Test repository queries with JOINs to ensure `PLAYER_PROFILES` and `COURT_OWNER_PROFILES` are correctly fetched depending on the role. Test soft-delete updates `deleted_at`.
- API-level behavior: Ensure `GET`, `PATCH`, `DELETE` endpoints return correct HTTP status codes.
- Security verification: Ensure endpoints return `401/403` when called by `PLAYER` or `COURT_OWNER` tokens.

## 17. Migration / Rollout

- Migration steps: Add the user-list indexes; no data backfill is required.
- Rollout sequencing: Admin endpoints can be deployed safely alongside frontend Admin Dashboard updates.
- Backward compatibility: `N/A`

## 18. Alternatives Considered

- `N/A — no meaningful alternative for this scope` (Standard REST API for a CRUD-like admin capability).

## 19. Observability / Monitoring

- Logs: Log sensitive admin actions (e.g., `Admin [id] deactivated User [id]`) for audit purposes.
- Metrics: `N/A`
- Alerts/operational signals: `N/A`

## 20. Acceptance / Verification Considerations

- **Given:** An authenticated Admin user
   **When:** They request `GET /api/v1/admin/users`
  **Then:** A paginated list of users is returned without `password_hash`.

- **Given:** An authenticated Admin user
   **When:** They send `DELETE /api/v1/admin/users/123`
  **Then:** User 123's `deleted_at` field is populated in the database.

- **Given:** An authenticated Player user
   **When:** They attempt to call `GET /api/v1/admin/users`
  **Then:** A `403 Forbidden` error is returned.

## 21. Decisions

- Account statuses are `ACTIVE`, `SUSPENDED`, and `DEACTIVATED`.
- Admin cannot deactivate or soft-delete another Admin or themselves.
- Admin may set a new password manually. Per the Authentication & Authorization Tech Design (Decision #17) and PRD Decision #26, this updates `password_hash`, sets `must_change_password = true`, revokes every `AUTH_SESSIONS` row of that user, and clears `AUTH_LOGIN_LOCKOUTS` (`failed_attempts = 0`, `locked_until = NULL`) in one transaction, via `authService.adminSetPassword`. The user must change the password on next sign-in. This supersedes the prior "no forced change" decision.
- No background domain event is emitted when a user is suspended, deactivated, or soft-deleted. Authentication and active-session validation must check the current user status.
- API namespace, pagination (`meta`), response envelopes, and validation library follow `docs/architecture/conventions.md`; feature-specific data is described in this document.
- Schema migration adds the approved user-list indexes.

All decisions were approved by the Tech Lead on 2026-09-13. Rationale: align the technical design with the Ready PRD, preserve existing schema compatibility, enforce the Admin safety rule, and keep the MVP implementation within the existing monolith.

## 22. Decision Status

```text
Decision Status: Approved
Approved by: Technical Lead
Approved on: 2026-09-13
```

## Ratings oversight integration — approved 2026-10-15

The existing Admin User Detail for Player targets hosts read-only Ratings (given/received) and automatic Skill Adjustments sections, delivered by Ratings RT-08. Reuse the Ratings contracts/client rather than adding duplicate queries or a new moderation feature. Admin can inspect inactive Player history. Display explicit rater/target identities, scores/comment/Match context, and previous/new skill with adjustment average/count/source/time; paginate using shared components.

Technical authority: Ratings Tech Design §9.4 and §23.2 (Admin-only `GET /api/v1/users/:userId/skill-adjustments`). No edit/delete rating/history controls, automatic penalties, or manual skill-level editing are introduced. Existing task completion statuses do not imply this new integration has been implemented.
