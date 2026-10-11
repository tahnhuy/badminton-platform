# Admin Frontend Consolidation — Task List

Implementation tasks for consolidating admin API transport, the admin list
pagination contract, and the admin route-level layout. This is an internal
refactor with no user-visible behavior change.

- Linked PRD: N/A — no user-visible behavior or business-rule change
- Linked Tech Design: [tech-design.md](tech-design.md)
- Reference: `docs/architecture/frontend.md` §5.1, §10 (items 1, 4, 7)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through
  `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.

**Definition of Done:** the task's acceptance criteria pass and the required
verification steps listed under "Verification" are complete.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| AF-01 | Backend — align admin user list pagination to `meta` | BLOCKED | Tech Design Ready (human) | S |
| AF-02 | Frontend — migrate admin services to shared `httpClient` | BLOCKED | AF-01, Tech Design Ready (human) | M |
| AF-03 | Frontend — add router-level `AdminLayout` route | BLOCKED | Tech Design Ready (human) | M |

Blocker for all tasks: [tech-design.md](tech-design.md) is `Draft` /
`Decision Status: Proposed`; it must be marked `Ready` by the human owner before
implementation (`docs/documentation-guide.md` §6.3).

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | AF-01, AF-03 | Tech Design Ready |
| 2 | AF-02 | AF-01 |

---

## [ ] AF-01: Backend — align admin user list pagination to `meta`

```text
Status: BLOCKED
Size: S
Blocked by: Tech Design Ready (human approval)
```

**Objective:** Make `GET /api/v1/admin/users` return the global pagination shape
`meta: { page, limit, total, totalPages }` instead of `pagination`, matching
`docs/architecture/conventions.md` and the already-updated user-management Tech
Design.

**Scope**

- In scope:
  - Rename the `pagination` key to `meta` in the admin user list response.
  - Update the user-management API tests to assert `meta`.
- Out of scope:
  - Any other admin endpoint or response shape.
  - Frontend changes (AF-02).

**Implementation requirements**

1. Update `backend/src/services/admin/AdminUserService.ts` to return `meta`.
2. Update `backend/src/controllers/admin/AdminUserController.ts` if it reshapes
   the service result.
3. Update `backend/src/__tests__/admin-users.test.ts` to assert `meta` and no
   `pagination`.

**Files/areas affected**

- `backend/src/services/admin/AdminUserService.ts`
- `backend/src/controllers/admin/AdminUserController.ts`
- `backend/src/__tests__/admin-users.test.ts`

**API impact:** `GET /api/v1/admin/users` list response key `pagination` →
`meta`. No other contract change.

**Schema/config impact:** None.

**Verification**

- API-level: list users returns `meta` and no `pagination` key.
- Edge: empty result set still returns `meta` with `totalPages = 0`.

**Acceptance criteria**

- **Given** an `ADMIN` session
  **When** `GET /api/v1/admin/users` is called
  **Then** the response contains `meta: { page, limit, total, totalPages }` and no `pagination` key.

- **Given** a filter with zero matches
  **When** the list is requested
  **Then** `meta.total = 0` and `meta.totalPages = 0`.

---

## [ ] AF-02: Frontend — migrate admin services to shared `httpClient`

```text
Status: BLOCKED
Size: M
Blocked by: AF-01, Tech Design Ready (human approval)
```

**Objective:** Replace the hand-rolled `fetch` + duplicated CSRF/error helpers in
the admin services with the shared `httpClient`, and bind the user list to `meta`.

**Scope**

- In scope:
  - `adminUserService`, `adminFacilityService`, `adminGlobalSearchService` use
    `httpClient<T>()`.
  - Remove local `handleResponse`/`getAuthHeaders` duplication; use `ApiError`.
  - `frontend/src/features/admin/types/user.ts`: replace `pagination` with `meta`.
  - Global search sends `same-origin` credentials via `httpClient`.
- Out of scope:
  - Page/component visual changes.
  - Backend changes (AF-01).

**Implementation requirements**

1. Replace `fetch` calls in the three admin services with `httpClient<T>()`.
2. Delete duplicated helpers; map errors via the shared `ApiError` shape.
3. Update the `UserListResponse` type to `{ data: User[]; meta: {...} }`.
4. Keep service method signatures stable so pages require no signature changes.

**Files/areas affected**

- `frontend/src/features/admin/services/adminUserService.ts`
- `frontend/src/features/admin/services/adminFacilityService.ts`
- `frontend/src/features/admin/services/adminGlobalSearchService.ts`
- `frontend/src/features/admin/types/user.ts`

**API impact:** None beyond the AF-01 `meta` shape consumed by the client.

**Schema/config impact:** None.

**Verification**

- Manual: admin user list pagination, filters, create/status/delete modals,
  reset password, and Excel export work.
- Manual: facility list and global search work; global search includes the
  session cookie.
- Unit/API-level: N/A (transport refactor); rely on backend API tests.

**Acceptance criteria**

- **Given** the admin user list
  **When** it loads
  **Then** it reads `meta` and paginates correctly with no `pagination` reference.

- **Given** an admin mutation (create/status/delete/reset)
  **When** submitted
  **Then** the request goes through `httpClient` with `X-CSRF-Token` and same-origin credentials.

- **Given** a failed admin request
  **When** the server returns `{ error: { code, message } }`
  **Then** a shared `ApiError` is raised and the UI shows mapped feedback.

---

## [ ] AF-03: Frontend — add router-level `AdminLayout` route

```text
Status: BLOCKED
Size: M
Blocked by: Tech Design Ready (human approval)
```

**Objective:** Render the admin sidebar and header once via a router-level
`AdminLayout` and have admin pages render content only through `<Outlet/>`.

**Scope**

- In scope:
  - Create `AdminLayout` composing `AdminSidebar` + `AdminHeader` + `<main><Outlet/></main>`.
  - Convert the `/admin` route to use `AdminLayout` with children.
  - Remove per-page sidebar/header composition from admin pages.
- Out of scope:
  - Visual redesign or navigation changes.
  - Transport changes (AF-02).

**Implementation requirements**

1. Add `frontend/src/features/admin/components/AdminLayout.tsx`.
2. Update `frontend/src/app/router.tsx`: `/admin` element wraps `AdminLayout`;
   children render content only.
3. Update `UserManagementPage`, `CourtManagementPage`, and
   `AdminPlaceholderPage` to drop their own shell composition.

**Files/areas affected**

- `frontend/src/features/admin/components/AdminLayout.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/features/admin/pages/UserManagementPage.tsx`
- `frontend/src/features/admin/pages/CourtManagementPage.tsx`
- `frontend/src/features/admin/pages/AdminPlaceholderPage.tsx`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- Manual: `/admin`, `/admin/users`, `/admin/courts`, `/admin/dashboard`,
  `/admin/tournaments`, `/admin/reports` render the shell once and page content.
- Manual: mobile drawer and sidebar collapse still work.

**Acceptance criteria**

- **Given** an authenticated `ADMIN`
  **When** any `/admin/*` route is opened
  **Then** `AdminSidebar` and `AdminHeader` render once via `AdminLayout` and the page renders in the content area.

- **Given** navigation between admin pages
  **When** routes change
  **Then** the shell is not remounted and no duplicate header/sidebar appears.

---

**Completion checklist**

- [ ] Scope matches the linked Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant API/contract documentation is updated (user-management Tech Design already updated).
- [ ] No `TBD` was silently resolved.
- [ ] No unrelated files or refactors were included.
