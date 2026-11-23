# Admin User Management - Task List

This document contains the implementation tasks for the Admin User Management feature.

---

## Task 1: Database Migration for User Management Indexes

### 1. Task Metadata

```text
Task Title: Database Migration for User Management Indexes
Status: Approved
Owner/Assignee: TBD
Complexity/Size: Small
```

### 2. Context and Links

- Why this task is needed: The Tech Design requires new indexes on the `USERS` table to optimize filtering, stable pagination, and email search for the Admin User Management dashboard.
- Linked PRD: [prd.md](prd.md)
- Linked Tech Design: [tech-design.md](tech-design.md)
- Relevant architecture/schema/convention reference: `docs/architecture/database-schema.md`

### 3. Scope

#### In Scope
- Create a new migration file to add indexes on `USERS (role, status, id)` and `USERS (email)`.

#### Out of Scope
- Modifying any existing data or adding new columns (e.g., no `must_change_password` field, as decided in Tech Design).
- Application-level API development.

### 4. Dependencies and Blockers
- Prerequisite task or decision: N/A
- External/product dependency: N/A
- Blocking TBD: N/A

### 5. Implementation Details
1. Generate a new database migration file (e.g., `YYYYMMDDHHMMSS_add_admin_user_management_indexes.sql`).
2. Add `CREATE INDEX` statements for `(role, status, id)` and `(email)` on the `users` table (or exactly as named in the physical schema).
3. Add `DROP INDEX` statements in the down migration.

#### Affected Files / Modules
- `[Proposed — verify during implementation]` backend/db/migrations/

### 6. Acceptance Criteria
- **Given:** A fresh or existing database instance
  **When:** The migration is executed
  **Then:** The new indexes are successfully created on the `USERS` table without errors.

### 7. Verification / Test Cases
- Integration verification: Run the migration up and down to ensure it applies and reverts cleanly.

### 8. Impact Checklist
- Schema impact: Adds indexes to `USERS`. No structural column changes.
- API impact: None
- Configuration impact: None
- Security/authorization impact: None
- Documentation impact: N/A

### 9. Completion Checklist
- [x] Scope matches the linked PRD and Tech Design.
- [x] Acceptance criteria are satisfied.
- [x] Required verification is complete.
- [x] Relevant schema/API/configuration documentation is updated.
- [x] No `TBD` was silently resolved.
- [x] No unrelated files or refactors were included.

### 10. Status
```text
Status: Completed
Blocked by: N/A
Verification completed: Migration applied cleanly to PostgreSQL database; indexes `users_role_status_id_idx` and `users_email_idx` confirmed via `pg_indexes`.
```

---

## Task 2: Admin User Management API - List and Details

### 1. Task Metadata

```text
Task Title: Admin User Management API - List and Details
Status: Approved
Owner/Assignee: TBD
Complexity/Size: Medium
```

### 2. Context and Links

- Why this task is needed: Provide the `ADMIN` role with the ability to query the user base, view paginated lists with filters, and fetch detailed profiles.
- Linked PRD: [prd.md](prd.md)
- Linked Tech Design: [tech-design.md](tech-design.md)

### 3. Scope

#### In Scope
- Create `GET /api/v1/admin/users` API endpoint with pagination, `role`, `status`, and `search` (email/name) filters.
- Create `GET /api/v1/admin/users/:id` API endpoint to view user details.
- Implement strictly authorized middleware ensuring only the `ADMIN` role can access these endpoints.
- Ensure `password_hash` is stripped from all responses.

#### Out of Scope
- Mutating user status or deleting users.

### 4. Dependencies and Blockers
- Prerequisite task or decision: Task 1 (Migration) is recommended for performance but not strictly blocking.
- External/product dependency: N/A
- Blocking TBD: N/A

### 5. Implementation Details
1. Implement or reuse Admin authorization middleware.
2. Create `AdminUserController` and `AdminUserService`.
3. Implement `UserRepository` methods with JOINs to `PLAYER_PROFILES` and `COURT_OWNER_PROFILES`.
4. Validate incoming query parameters (page, limit, role, status, search).

#### Affected Files / Modules
- `[Proposed — verify during implementation]` backend/src/controllers/admin/AdminUserController.ts
- `[Proposed — verify during implementation]` backend/src/services/admin/AdminUserService.ts
- `[Proposed — verify during implementation]` backend/src/repositories/UserRepository.ts

### 6. Acceptance Criteria
- **Given:** An authenticated Admin user
  **When:** They request `GET /api/v1/admin/users`
  **Then:** A paginated list of users is returned without `password_hash`.
- **Given:** An authenticated Player or Court Owner user
  **When:** They request `GET /api/v1/admin/users`
  **Then:** A `403 Forbidden` error is returned.

### 7. Verification / Test Cases
- Unit verification: `AdminUserService` correctly structures the paginated response and omits `password_hash`.
- API-level verification: Verify status code `200` for Admin, `403` for non-Admin. Verify filtering by role and status works correctly.

### 8. Impact Checklist
- Schema impact: None
- API impact: Exposes new endpoints `GET /api/v1/admin/users` and `GET /api/v1/admin/users/:id`.
- Configuration impact: None
- Security/authorization impact: Strictly protected by `ADMIN` role. Ensures no password hashes leak.
- Documentation impact: N/A

### 9. Completion Checklist
- [x] Scope matches the linked PRD and Tech Design.
- [x] Acceptance criteria are satisfied.
- [x] Required verification is complete.
- [x] Relevant schema/API/configuration documentation is updated.
- [x] No `TBD` was silently resolved.
- [x] No unrelated files or refactors were included.

### 10. Status
```text
Status: Completed
Blocked by: N/A
Verification completed: Verified via 15 unit and API integration tests in backend/src/__tests__/admin-users.test.ts. Tested pagination, role/status filtering, search, profile joins, 401/403/404/400 errors, and password hash exclusion.
```

---

## Task 3: Admin User Status Mutation APIs

### 1. Task Metadata

```text
Task Title: Admin User Status Mutation APIs
Status: Approved
Owner/Assignee: TBD
Complexity/Size: Medium
```

### 2. Context and Links

- Why this task is needed: Provide the `ADMIN` role with the ability to deactivate (`SUSPENDED`/`DEACTIVATED`), soft-delete, and manually reset user passwords.
- Linked PRD: [prd.md](prd.md)
- Linked Tech Design: [tech-design.md](tech-design.md)

### 3. Scope

#### In Scope
- Create `PATCH /api/v1/admin/users/:id/status` API endpoint.
- Create `DELETE /api/v1/admin/users/:id` API endpoint (Soft Delete).
- Create `POST /api/v1/admin/users/:id/password` API endpoint (Set New Password).
- Enforce the rule: Admins cannot deactivate or soft-delete another Admin account or themselves. Other valid status updates remain allowed.

#### Out of Scope
- Hard deletion.
- Background events for canceling bookings (as explicitly designed as N/A in Tech Design).

### 4. Dependencies and Blockers
- Prerequisite task or decision: Task 2 (Admin API structure/middleware setup).
- External/product dependency: N/A
- Blocking TBD: N/A

### 5. Implementation Details
1. Add mutation routes to `AdminUserController`.
2. Add mutation logic to `AdminUserService`, ensuring the target is not an Admin for deactivation/soft deletion and is not the authenticated Admin for either operation.
3. Validate request bodies with the approved status enums `ACTIVE`, `SUSPENDED`, `DEACTIVATED`.
4. Implement `POST /api/v1/admin/users/:id/password` with `{ new_password: string }`, update `password_hash`, and never return the password.
5. Update `UserRepository` to execute the mutations (`status` update, `deleted_at = NOW()`, `password_hash` update).

#### Affected Files / Modules
- `[Proposed — verify during implementation]` backend/src/controllers/admin/AdminUserController.ts
- `[Proposed — verify during implementation]` backend/src/services/admin/AdminUserService.ts
- `[Proposed — verify during implementation]` backend/src/repositories/UserRepository.ts

### 6. Acceptance Criteria
- **Given:** An authenticated Admin user
  **When:** They send `DELETE /api/v1/admin/users/:id` for a Player
  **Then:** User's `deleted_at` field is populated, returning `204 No Content`.
- **Given:** An authenticated Admin user
  **When:** They send `DELETE /api/v1/admin/users/:admin_id` for another Admin
  **Then:** A `403 Forbidden` error is returned.
- **Given:** An authenticated Admin user
  **When:** They attempt to deactivate or soft-delete themselves
  **Then:** A `403 Forbidden` error is returned.
- **Given:** An authenticated Admin user
  **When:** They send `PATCH /api/v1/admin/users/:id/status` with a valid status
  **Then:** The target user's status is updated according to the approved status rules.
- **Given:** An authenticated Admin user
  **When:** They send `POST /api/v1/admin/users/:id/password` with `{ new_password: string }`
  **Then:** The user's password hash is updated and the password is not included in the response.

### 7. Verification / Test Cases
- Unit verification: `AdminUserService` properly rejects operations targeting an Admin role.
- API-level verification: Ensure idempotency of `DELETE` endpoint (repeated calls return `204`). Verify status mutation logic.

### 8. Impact Checklist
- Schema impact: None (Relies on existing `status` and `deleted_at`).
- API impact: Exposes new mutation endpoints.
- Configuration impact: None
- Security/authorization impact: Strictly protected by `ADMIN` role. Validates target user's role to prevent Admin-lockout.
- Documentation impact: N/A

### 9. Completion Checklist
- [x] Scope matches the linked PRD and Tech Design.
- [x] Acceptance criteria are satisfied.
- [x] Required verification is complete.
- [x] Relevant schema/API/configuration documentation is updated.
- [x] No `TBD` was silently resolved.
- [x] No unrelated files or refactors were included.

### 10. Status
```text
Status: Completed
Blocked by: N/A
Verification completed: Verified via 30 unit and API integration tests in backend/src/__tests__/admin-users.test.ts covering status updates (ACTIVE, SUSPENDED, DEACTIVATED), admin lockout protection (403 when modifying other admins or self), soft deletion (204 and idempotency), and manual password reset with bcrypt and HMAC-SHA-256 pepper.
```

## Ratings oversight integration — approved 2026-10-15

The existing Admin User Detail for Player targets hosts read-only Ratings (given/received) and automatic Skill Adjustments sections, delivered by Ratings RT-08. Reuse the Ratings contracts/client rather than adding duplicate queries or a new moderation feature. Admin can inspect inactive Player history. Display explicit rater/target identities, scores/comment/Match context, and previous/new skill with adjustment average/count/source/time; paginate using shared components.

Technical authority: Ratings Tech Design §9.4 and §23.2 (Admin-only `GET /api/v1/users/:userId/skill-adjustments`). No edit/delete rating/history controls, automatic penalties, or manual skill-level editing are introduced. Existing task completion statuses do not imply this new integration has been implemented.


## [x] UM-ADMIN-ALERT: Admin security event notifications — DONE (2026-11-18)

**Objective:** other Admins know when an Admin account is created or its password is reset.

**Implementation**

- `AdminUserService.createUser` emits `ADMIN_SECURITY_EVENT` when `role === 'ADMIN'`; `setUserPassword` emits it when the target is an Admin.
- Recipients are active Admins excluding the acting Admin; resource `ADMIN_USER` resolves only for Admin viewers to `/admin/users?userId=<id>`.
- Alerts use `notifyAdminsBestEffort` (separate transaction, logged on failure) so they never fail account creation or password reset.
- `UserManagementPage` reads `?userId=` and opens the matching user detail.

**Verification:** `admin-notifications.test.ts` covers Admin-only recipients, actor exclusion, deep link and password reset alert; frontend build/lint PASS.
