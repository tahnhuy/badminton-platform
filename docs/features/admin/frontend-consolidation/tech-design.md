# Feature Tech Design: Admin Frontend Consolidation

## 1. Metadata

```text
Status: Draft
Owner: Frontend / Admin
PRD: N/A — internal refactor; no user-visible behavior or business-rule change
Scope: Admin API transport consolidation, admin list pagination contract alignment, admin route-level layout
Decision Status: Proposed
```

This design is a technical refactor within the approved architecture. It does not
change project scope, roles, business rules, or global technology decisions. It
records and resolves the frontend divergences captured in
`docs/architecture/frontend.md` §10 (items 1, 4, 7).

## 2. Context

Three documented divergences affect the Admin portal:

1. **Pagination contract drift (frontend.md §10 item 7).**
   `GET /api/v1/admin/users` returns `{ data, pagination }` while the global
   convention and the facility endpoint use `meta`
   (`docs/architecture/conventions.md` pagination convention;
   `docs/features/admin/user-management/tech-design.md`; the user-management
   Tech Design has already been updated to `meta`).
2. **Two transport styles (frontend.md §10 item 1).**
   `adminUserService`, `adminFacilityService`, and `adminGlobalSearchService`
   use hand-rolled `fetch` with duplicated CSRF/error helpers instead of the
   shared `httpClient` (`frontend/src/shared/api/http-client.ts`).
   `adminGlobalSearchService` also omits `credentials`, so the session cookie is
   not guaranteed on its request.
3. **Admin shell composition (frontend.md §10 item 4).**
   Each admin page re-composes `AdminSidebar` + `AdminHeader` instead of a
   router-level layout route, duplicating shell logic.

## 3. Technical Problem

- The user list contract deviates from the global pagination shape, so admin
  list UI binds to a non-conventional field and the backend/frontend/test shape
  must be reconciled.
- Duplicated transport helpers are a maintenance and security risk (CSRF header
  handling can drift; `credentials` can be omitted).
- Duplicated shell composition makes follow-up admin work error-prone and
  inconsistent with the frontend-composition boundary.

## 4. Goals

- Align the admin user list response to the global `meta` pagination shape.
- Make the shared `httpClient` the single transport boundary for admin services.
- Provide one router-level admin layout so admin pages render content only.

## 5. Non-Goals

- No new admin features, screens, or API endpoints.
- No visual redesign; the rendered UI is unchanged.
- No new dependencies.
- No change to authentication/session/CSRF mechanisms (session cookie + `X-CSRF-Token`).
- No change to business rules, scope, roles, or the database schema.

## 6. Upstream References

- Frontend architecture divergences: `docs/architecture/frontend.md` §5.1, §10.
- Global API/pagination conventions: `docs/architecture/conventions.md`.
- Session/CSRF/auth: `docs/architecture/tech-stack.md`; `docs/features/platform/authentication-authorization/tech-design.md`.
- Admin API contracts: `docs/features/admin/user-management/tech-design.md`,
  `docs/features/admin/court-management/tech-design.md`,
  `docs/features/admin/dashboard/tech-design.md`,
  `docs/features/admin/report-management/tech-design.md`.
- Project scope/roles: `PROJECT-BRIEF.md` §2, §4.

## 7. Proposed Technical Design

### 7.1 Contract alignment (user list)

- Backend `AdminUserService.listUsers` returns `meta: { page, limit, total, totalPages }`
  instead of `pagination`.
- `GET /api/v1/admin/users` response becomes
  `{ data: [UserObject], meta: { page, limit, total, totalPages } }`.
- The facility endpoint already uses `meta`; no change there.

### 7.2 Transport consolidation

- Replace `fetch` in `adminUserService`, `adminFacilityService`, and
  `adminGlobalSearchService` with the shared `httpClient<T>()` from
  `frontend/src/shared/api/http-client.ts`.
- Remove the local `handleResponse` and `getAuthHeaders` helpers; error handling
  uses the shared `ApiError` (`{ error: { code, message, details } }`).
- `httpClient` provides `credentials: 'same-origin'` and the `X-CSRF-Token`
  header for state-changing requests, fixing the global-search omission.
- Keep service method signatures stable so page components are unaffected
  (only the pagination field name in the user list type changes).

### 7.3 Admin layout route

- Add `frontend/src/features/admin/components/AdminLayout.tsx` rendering
  `AdminSidebar` + `AdminHeader` + `<main><Outlet/></main>`.
- In `frontend/src/app/router.tsx`, the `/admin` route element becomes
  `<RequireAuth allowedRoles={['ADMIN']}><AdminLayout/></RequireAuth>`, with
  children rendering content only.
- Update `UserManagementPage`, `CourtManagementPage`, and
  `AdminPlaceholderPage` to drop their own sidebar/header composition.

- Client/server boundary: REST JSON under `/api/v1/`, single origin.
- Cross-cutting concerns: the shared `httpClient` handles CSRF, credentials, and
  error parsing; route guard remains `RequireAuth`.

## 8. Behavior, State, and Flow

```text
/admin → AdminLayout (sidebar + header) → <Outlet/> → admin page content
```

- Preconditions: an authenticated `ADMIN` session.
- No state machine: layout and transport are structural; no status transitions.
- Postconditions: admin pages render identically; services call the shared client.

## 9. API Design

- Resource/operation: List users.
- HTTP method/path: `GET /api/v1/admin/users` (unchanged).
- Request contract: unchanged (`page`, `limit`, `search`, `role`, `status`, `sort`).
- Response contract: `{ data: [UserObject], meta: { page, limit, total, totalPages } }`.
- Authentication/authorization boundary: `authenticate` + `requireRole('ADMIN')`.
- HTTP status behavior: unchanged.
- Application error codes: unchanged.

No other endpoint contract changes.

## 10. Data Model / Schema Delta

- Existing schema objects affected: `N/A`.
- Schema delta: `N/A — no schema change`.
- Migration/data backfill impact: `N/A`.

## 11. Security

- Authentication boundary: approved opaque session cookie (`sid`); no JWT.
- Authorization boundary: `requireRole('ADMIN')` (unchanged).
- Input and output protection: unchanged.
- CSRF/XSS considerations: all state-changing admin requests go through
  `httpClient`, which sends `X-CSRF-Token`; `credentials: 'same-origin'` is now
  applied to global search as well.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Admin API returns `{ error }` | `httpClient` non-OK | Throws shared `ApiError` with stable `code` | Feature maps code to Vietnamese copy |
| Session invalid / expired | `401 AUTH_SESSION_INVALID\|AUTH_SESSION_EXPIRED` | Global auth handler redirects to sign-in | App boundary |
| CSRF token invalid | `403 AUTH_CSRF_TOKEN_INVALID` | `httpClient` refreshes cookie once and retries | Automatic |
| Global search request | Always | Sends credentials (cookie) | Fixed by using `httpClient` |

## 13. Concurrency / Idempotency

- `N/A — no concurrency-sensitive mutation introduced`.
- Transaction boundary: unchanged (no backend mutation added).

## 14. Performance

- `N/A — not applicable` (no change to query or payload size).

## 15. Events / Notifications

- `N/A — no event or notification behavior`.

## 16. Testing Considerations

- API-level: `GET /api/v1/admin/users` returns `meta` (not `pagination`);
  existing `backend/src/__tests__/admin-users.test.ts` updated accordingly.
- Unit/manual: admin pages render identically under `AdminLayout`.
- Manual: admin list, filters, pagination, create/status/delete modals, Excel
  export, global search still work; global search sends the session cookie.
- E2E: admin sign-in and reach `/admin/users` (Playwright, if covered).

## 17. Migration / Rollout

- Migration steps: `N/A — no DB migration`.
- Rollout sequencing: fast-forward compatible (schema unchanged; API field
  rename is internal and landed atomically with the frontend binding update).
- Backward compatibility: the `pagination` key is removed; any consumer must be
  updated in the same change (frontend `types/user.ts` and `adminUserService`).
- Rollback/recovery: revert the commit.

## 18. Alternatives Considered

- **Keep `pagination` and document a deviation.** Rejected: `AGENTS.md` §7
  requires the global `page`/`limit` + `meta` shape; aligning is lower long-term cost.
- **Adopt an external query/HTTP library.** Rejected: not an approved dependency.

## 19. Observability / Monitoring

- Logs: `N/A` (reuses existing centralized error handling).
- Metrics/alerts: `N/A`.

## 20. Acceptance / Verification Considerations

- **Given** an `ADMIN` session
  **When** `GET /api/v1/admin/users` is called
  **Then** the response contains `meta: { page, limit, total, totalPages }` and no `pagination` key.

- **Given** the admin portal
  **When** any admin page is opened
  **Then** the sidebar and header render once via `AdminLayout` and page content renders inside `<Outlet/>`.

- **Given** an admin action that mutates data
  **When** it is submitted
  **Then** it is sent through `httpClient` with the `X-CSRF-Token` header and `same-origin` credentials.

- **Given** the global search is used
  **When** the request is sent
  **Then** it includes the session cookie (credentials) and returns grouped results.

## 21. Open Questions / TBD

| Question or decision | Authority/owner | Implementation impact | Status |
| --- | --- | --- | --- |
| None blocking | — | — | Resolved |

## 22. Decision Status

```text
Decision Status: Proposed
Approval needed from: Human owner
Approved decision/reference: N/A
```
