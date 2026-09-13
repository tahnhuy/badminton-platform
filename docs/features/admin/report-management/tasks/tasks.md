# Task Breakdown: Admin Report Management

**Feature:** Admin Report Management
**Status:** READY FOR IMPLEMENTATION
**References:**
- PRD: `docs/features/admin/report-management/prd.md`
- Tech Design: `docs/features/admin/report-management/tech-design.md`
- Database Schema: `docs/architecture/database-schema.md` §3.25

---

## TASK-01: Backend - Report Module Setup and List Endpoint

**Status:** Approved

**Objective:**
Establish the `admin/reports` backend module, enforce RBAC authorization, and implement the paginated list endpoint.

**Scope:**
- Create routes, controller, service, and repository structure for the new module.
- Implement the `GET /admin/reports` endpoint.
- Enforce the `ADMIN` role requirement using existing platform authorization mechanisms.

**Implementation Requirements:**
- Implement offset pagination using `page` (default 1) and `limit` (default 20, max 100).
- Support filtering by `target_type` (`PLAYER | FACILITY | TOURNAMENT`) and `status` (`OPEN | RESOLVED`).
- Order results by `created_at DESC`.
- Map the database's nullable target columns (`reported_player_id`, etc.) to the explicit `target_type` in the API response.
- Expose only allowlisted fields in the response.

**Dependencies:**
- Platform authentication and RBAC boundary.

**Files/Areas Affected:**
- `backend/src/modules/admin/reports/reports.routes.ts` [NEW]
- `backend/src/modules/admin/reports/reports.controller.ts` [NEW]
- `backend/src/modules/admin/reports/reports.service.ts` [NEW]
- `backend/src/modules/admin/reports/reports.repository.ts` [NEW]

**API Impact:**
- **NEW:** `GET /admin/reports`

**Schema/Config Impact:**
- **Schema:** None. (Reads from existing `REPORTS` table).
- **Config:** None.

**Testing Requirements:**
- **Unit:** Parse query params (pagination, target mapping), RBAC check logic.
- **Integration:** Repository query tests with filters (empty results, parameterized filtering).
- **API-level:** Validate `401 Unauthorized`, `403 Forbidden` (for non-Admin), `400 Bad Request` (invalid query), and `200 OK` (correct shape and pagination metadata).

**Acceptance Criteria:**
- Only an authenticated `ADMIN` can access the endpoint.
- Returns `200 OK` with paginated report list containing exactly one `target_type` per item.
- Non-Admin users receive `403 Forbidden`.
- Malformed queries return `400 Bad Request`.

---

## TASK-02: Backend - Report Detail and Status Update

**Status:** Approved

**Objective:**
Implement the detail view and status transition logic (`OPEN` → `RESOLVED`) for Admin reports.

**Scope:**
- Implement the `GET /admin/reports/:id` endpoint.
- Implement the `PATCH /admin/reports/:id/status` endpoint.

**Implementation Requirements:**
  - **Detail View:** Return report details with mapped `target_type`. Expose only approved fields (do not leak database rows).
  - **Status Update:**
  - Validate the `ADMIN` role.
  - Transition allowed: only `OPEN` to `RESOLVED`.
  - Ensure `RESOLVED` is a terminal state (cannot transition from `RESOLVED` to anything else).
  - Use database transaction and state-transition guard for mutation.
  - Return `ADMIN_REPORT_NOT_FOUND`, `ADMIN_REPORT_INVALID_STATUS`, or `ADMIN_REPORT_INVALID_TRANSITION` on failure.

**Dependencies:**
- TASK-01 (Module structure).

**Files/Areas Affected:**
- `backend/src/modules/admin/reports/reports.routes.ts`
- `backend/src/modules/admin/reports/reports.controller.ts`
- `backend/src/modules/admin/reports/reports.service.ts`
- `backend/src/modules/admin/reports/reports.repository.ts`

**API Impact:**
- **NEW:** `GET /admin/reports/:id`
- **NEW:** `PATCH /admin/reports/:id/status`

**Schema/Config Impact:**
- **Schema:** None.
- **Config:** None. `REPORT_ENABLED` controls report submission, not Admin review/resolution of existing reports.

**Testing Requirements:**
- **Unit:** Status transition guards, validation of path identifier and request body.
- **Integration:** Target retrieval via `REPORTS` relationships, transaction commit on valid transition, rollback on invalid transition.
- **API-level:** Verify idempotent repeat of `OPEN → RESOLVED`, `400 Bad Request` on invalid state transition (e.g., modifying a terminal state).

**Acceptance Criteria:**
- Detail view returns `200 OK` with the exact single target type.
- Missing report ID returns `404 Not Found`.
- Admin can update a report from `OPEN` to `RESOLVED`.
- Update response includes updated `resolved_at` timestamp.
- Attempting to update a `RESOLVED` report returns `400 Bad Request` with `ADMIN_REPORT_INVALID_TRANSITION`.
- Updating to a status other than `RESOLVED` returns `400 Bad Request` with `ADMIN_REPORT_INVALID_STATUS`.

---

## TASK-03: Frontend - Report List View

**Status:** Approved

**Objective:**
Build the Admin UI screen to view, filter, and paginate reports.

**Scope:**
- Create the React feature boundaries under `frontend/src/features/admin/reports`.
- Build the report table/list component.
- Implement API fetching, filtering (Target Type, Status), and pagination state.

**Implementation Requirements:**
- Keep API transport separate from presentation (use custom hooks or API query boundary).
- Safely handle loading, success, and empty states.
- Safely render text data (descriptions, target names).
- Catch `401` / `403` at the application boundary (redirect to login or unauthorized page).

**Dependencies:**
- TASK-01 (API list endpoint must be ready or mocked).

**Files/Areas Affected:**
- `frontend/src/features/admin/reports/components/ReportList.tsx` [NEW]
- `frontend/src/features/admin/reports/api/reports.api.ts` [NEW]
- `frontend/src/features/admin/reports/hooks/...` [NEW]
- `frontend/src/pages/admin/reports/ReportsPage.tsx` [NEW] (or equivalent routing file)

**API Impact:**
- Consumes `GET /admin/reports`.

**Schema/Config Impact:**
- None.

**Testing Requirements:**
- **E2E/Integration:** Verify Admin can navigate to the report list, filter by target type, and view results. Verify empty states.

**Acceptance Criteria:**
- Admin portal has a navigation entry for "Reports".
- List view displays paginated reports correctly.
- Admin can change filters and see updated results.

---

## TASK-04: Frontend - Report Detail and Resolution UI

**Status:** Approved

**Objective:**
Build the Admin UI detail view to inspect a specific report and apply the `RESOLVED` action.

**Scope:**
- Create the report detail layout component.
- Implement the "Resolve Report" action button and confirmation feedback.

**Implementation Requirements:**
- Fetch report details on mount. Handle loading, not found (`404`), and error states gracefully.
- Display the target, reason, description, and timestamps.
- Action button for "Resolve" should only be available if status is `OPEN`.
- Display an in-product confirmation toast or success message upon successful resolution.
- Display a clear error message (mapping from `ADMIN_REPORT_INVALID_TRANSITION`) if the mutation fails.

**Dependencies:**
- TASK-02, TASK-03.

**Files/Areas Affected:**
- `frontend/src/features/admin/reports/components/ReportDetail.tsx` [NEW]
- `frontend/src/features/admin/reports/api/reports.api.ts`
- `frontend/src/pages/admin/reports/ReportDetailPage.tsx` [NEW] (or equivalent nested view/modal)

**API Impact:**
- Consumes `GET /admin/reports/:id`.
- Consumes `PATCH /admin/reports/:id/status`.

**Schema/Config Impact:**
- None.

**Testing Requirements:**
- **E2E:** Verify an Admin can open a report detail, view the target, click "Resolve", and see the status change to `RESOLVED` with appropriate success feedback.

**Acceptance Criteria:**
- Detail view correctly renders the report's exact target and description safely.
- Admin can successfully mark an `OPEN` report as `RESOLVED`.
- Upon successful resolution, the UI reflects the updated state without needing a manual refresh.
- If the backend returns an error (e.g. invalid transition), the UI displays a readable error to the Admin.
