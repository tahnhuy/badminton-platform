# Admin Court Management — Task List

Implementation tasks for the Admin Court & Facility Management feature.

- Linked PRD: [prd.md](prd.md)
- Linked Tech Design: [tech-design.md](tech-design.md)
- Design Reference: Figma Screen A04 (`Badminton SmashPro / Facility & Court Management List`, `node-id=13-150025`)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE` (see `docs/templates/task-template.md`).
- `BLOCKED`: cannot start; the blocker is named.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| CM-01 | Admin Facility Query API (List & Detail with Summary Stats) | DONE | — | M |
| CM-02 | Admin Facility Mutation API (Status & Deactivation) | DONE | CM-01 (recommended) | M |
| CM-03 | Admin Court Mutation API (Status & Deactivation) | DONE | — | S |
| CM-04 | Admin Court & Facility Management UI (Screen A04) | DONE | CM-01, CM-02 | L |
| CM-05 | Owner-submission approval/rejection API and UI | Approved | CM-01, CM-02, CM-03 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | CM-01, CM-03 | — |
| 2 | CM-02 | CM-01 (recommended, not strictly blocking) |
| 3 | CM-04 | CM-01, CM-02 |

---

## [x] CM-01: Admin Facility Query API (List & Detail with Summary Stats)

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Provide Admins the ability to view all registered facilities and courts with rich metadata (court scale), KPI summary stats (total facilities, total courts, active/suspended counts), and multi-dimensional filters matching Figma Screen A04. Metrics must be backed by stored data only.

**Scope**

- In scope:
  - API endpoint `GET /admin/facilities` supporting:
    - Offset-based pagination (`page`, `limit`).
    - Search across facility name, owner name, address, or facility code (`search`).
    - Filters by operational status (`status`: `ACTIVE` | `SUSPENDED`) and city/region (`city`).
    - Sorting (`sort`: `courtCount_desc` | `courtCount_asc` | `newest` | `oldest`).
    - Returning operational summary `stats` object for top KPI cards.
    - Formatted DTO items (facility code `#FAC-...`, owner contact, and court scale).
  - API endpoint `GET /admin/facilities/:id` returning complete facility details and associated courts.
  - Platform authentication boundary and `ADMIN` role authorization for these endpoints.
  - Returning active and deactivated facilities for Admin views, with deactivated state indicated.
- Out of scope:
  - Modifying (PATCH/DELETE) facilities or courts (handled in CM-02 and CM-03).
  - Complex external BI analytics.
  - UI implementation (CM-04).

**Implementation requirements**

1. **Routing & Middleware**: Create the `/admin/facilities` route namespace. Apply global authentication and authorization middleware enforcing `role === 'ADMIN'`.
2. **Controller Layer**: Create a controller to parse query parameters (`page`, `limit`, `search`, `status`, `city`, `sort`) and resource IDs.
3. **Service Layer**:
   - Implement Admin facility list queries aggregating data-backed stats (`totalFacilities`, `provincesCovered`, `totalCourts`, `activeFacilities`, `suspendedFacilities`). Do not compute fabricated values (no surface split, growth estimate, or selling-rate estimate).
   - Format response DTO with `#FAC-{CITY}-{ID}` code, owner info, and court specs.
4. **Data Access (Repository)**: Use SQL joins on `FACILITIES`, `COURTS`, and `USERS`. Do not filter out `deleted_at IS NOT NULL` records for Admin queries.
5. **Error Handling**: Return `400` for invalid parameters, `403` for non-admins, and `404` (`ADMIN_FACILITY_NOT_FOUND`) for non-existent facilities.

**Files/areas affected**

- `backend/src/routes/admin/adminFacilityRoutes.ts`
- `backend/src/controllers/admin/adminFacilityController.ts`
- `backend/src/services/admin/adminFacilityService.ts`
- `backend/src/repositories/admin/adminFacilityRepository.ts`

**API impact:** Adds `GET /admin/facilities` and `GET /admin/facilities/:id`.

**Schema/config impact:** None (Frozen schema).

**Verification**

- Unit: query parameter parsing, SQL filter construction, DTO mapping, and stats aggregation.
- Integration: query database against test data containing active and deactivated facilities with courts.
- API-level: verify 401/403 authorization, 200 response shape with `items`, `stats`, and `meta`.

**Acceptance criteria**

- **Given** an authenticated user with the `ADMIN` role
  **When** they request `GET /admin/facilities?page=1&limit=10&city=TP.+Hồ+Chí+Minh`
  **Then** the system returns `200 OK` with `{ "data": { "items": [...], "stats": { ... }, "meta": { "page": 1, "limit": 10, "total": ..., "totalPages": ... } } }`.
- **Given** an authenticated user with the `PLAYER` or `COURT_OWNER` role
  **When** they request `GET /admin/facilities`
  **Then** the system returns `403 Forbidden`.
- **Given** an authenticated `ADMIN` user
  **When** they request `GET /admin/facilities/9999` (non-existent ID)
  **Then** the system returns `404 Not Found` with error code `ADMIN_FACILITY_NOT_FOUND`.

---

## [x] CM-02: Admin Facility Mutation API (Status & Deactivation)

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Provide Admins the ability to update facility status (`ACTIVE`, `SUSPENDED`) and deactivate facilities (which inherently deactivates its courts for new availability).

**Scope**

- In scope:
  - API endpoint `PATCH /admin/facilities/:id` to update status.
  - API endpoint `DELETE /admin/facilities/:id` to deactivate a facility and all its courts via atomic transaction.
  - Request payload validation (enforcing only `ACTIVE` or `SUSPENDED`).
  - Transaction row locking for concurrent mutations.
  - Logging the administrative action through the existing logging boundary.
- Out of scope:
  - Mutating existing Bookings.
  - Court-level specific mutations (CM-03).
  - Auto-cancellation or refunding logic.

**Implementation requirements**

1. **Routing & Validation**: Add `PATCH` and `DELETE` routes under `/admin/facilities/:id`. Validate `{"status": "ACTIVE" | "SUSPENDED"}` at the request boundary without adding a validation-library dependency.
2. **Controller Layer**: Parse the payload and delegate to the service layer.
3. **Service Layer (PATCH)**: Check that the Facility exists and is not deactivated. Validate the requested allowed value, lock the Facility row, update its status, and log the action.
4. **Service Layer (DELETE)**: Open a DB transaction. Lock the Facility row and all child Court rows. If already deactivated, return the idempotent `204 No Content` result. Otherwise set the Facility and all child Court `deleted_at` values atomically, commit, and log the action.
5. **Data Access (Repository)**: Implement transaction and row-lock support for the cascade deactivation.

**Files/areas affected**

- `[Proposed — verify during implementation]` Admin facility routes/controller/service/data-access modules.

**API impact:** Adds `PATCH /admin/facilities/:id` and `DELETE /admin/facilities/:id`.

**Schema/config impact:** None. Uses existing `status` and `deleted_at`.

**Verification**

- Unit: service enforces allowed statuses, deactivation idempotency, Booking immutability, and authorization boundary.
- Integration: verify atomic Facility/Court deactivation and rollback if any mutation fails.
- API-level: verify 400 validation, 401/403 authorization, 404 not found, 204 deactivation, 200 status update, and safe conflict handling.
- Edge/concurrency: ensure concurrent mutations are serialized and do not silently overwrite data; verify repeated DELETE is idempotent.
- Manual: verify Facility/Court state and unchanged Booking records through approved inspection procedures.

**Acceptance criteria**

- **Given** an authenticated `ADMIN` and an eligible Facility
  **When** they send `DELETE /admin/facilities/:id`
  **Then** the facility AND its courts have `deleted_at` populated, returns `204 No Content`, and existing bookings are untouched.
- **Given** an authenticated `ADMIN`
  **When** they send `PATCH /admin/facilities/:id` with `{"status": "INVALID_STATUS"}`
  **Then** the API returns `400 Bad Request` with validation errors.
- **Given** an authenticated `ADMIN` and an active Facility
  **When** they send `PATCH /admin/facilities/:id` with `{"status": "SUSPENDED"}`
  **Then** the Facility becomes unavailable for new Bookings while existing Bookings remain unchanged, and the API returns `200 OK`.
- **Given** two concurrent `ADMIN` requests to update the same facility
  **When** both requests are processed
  **Then** both operations are serialized by the transaction/row-lock strategy and no update is silently lost.
- **Given** an authenticated `ADMIN`
  **When** they send `DELETE` to an already deactivated facility
  **Then** the API treats it as idempotent and returns `204 No Content` without failing.

---

## [x] CM-03: Admin Court Mutation API (Status & Deactivation)

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide Admins the ability to suspend or deactivate a specific Court within a Facility without affecting the entire Facility.

**Scope**

- In scope:
  - API endpoint `PATCH /admin/facilities/:facilityId/courts/:courtId` to update a court's status (`ACTIVE`, `SUSPENDED`).
  - API endpoint `DELETE /admin/facilities/:facilityId/courts/:courtId` to deactivate a specific court.
  - Parent-child relationship validation (Court must belong to the requested Facility).
  - Transaction row locking for concurrent mutations.
  - Logging the administrative action through the existing logging boundary.
- Out of scope:
  - Facility-level mutations (CM-02).
  - Mutating existing Bookings.

**Implementation requirements**

1. **Routing & Validation**: Add routes under `/admin/facilities/:facilityId/courts/:courtId`. Validate payload `{"status": "ACTIVE" | "SUSPENDED"}` at the request boundary without adding a validation-library dependency.
2. **Service Layer**: Retrieve Court and assert it belongs to `facilityId` (throw `ADMIN_FACILITY_COURT_MISMATCH` / 404 if not).
3. **Mutation (PATCH)**: Lock the Court row, verify it is not deactivated, update its allowed status, and log the action.
4. **Mutation (DELETE)**: Lock the Court row. If already deactivated, return idempotent `204 No Content`; otherwise set `deleted_at = NOW()` and log the action.

**Files/areas affected**

- `[Proposed — verify during implementation]` Admin facility/court routes/controller/service/data-access modules.

**API impact:** Adds `PATCH /admin/facilities/:facilityId/courts/:courtId` and `DELETE /admin/facilities/:facilityId/courts/:courtId`.

**Schema/config impact:** None.

**Verification**

- Unit: parent-child validation logic; enforce allowed status enums.
- Integration: verify single-row updates in `COURTS` table.
- API-level: verify 404 mismatch errors, 400 validation, and 401/403 authorization.
- Edge/concurrency: concurrent mutations are serialized and do not silently overwrite data; database conflicts use the approved safe error contract.
- Manual: check database to ensure only target court is modified.

**Acceptance criteria**

- **Given** an authenticated `ADMIN`
  **When** they request `DELETE` for a Court using a `facilityId` that does NOT own the court
  **Then** the system does not mutate the court and returns `404 Not Found` (or approved safe mismatch error).
- **Given** an authenticated `ADMIN` and an eligible Court
  **When** they request `PATCH` with `{"status": "SUSPENDED"}`
  **Then** the court status changes to `SUSPENDED` and returns `200 OK`.
- **Given** an authenticated `ADMIN` and an eligible Court
  **When** they request Court deactivation
  **Then** only that Court is deactivated, existing Bookings remain unchanged, and the API returns `204 No Content`.
- **Given** an authenticated `ADMIN`
  **When** they send `DELETE` to an already deactivated court
  **Then** the API treats it as idempotent and returns `204 No Content` without failing.

---

## [x] CM-04: Admin Court & Facility Management UI (Screen A04)

```text
Status: DONE
Size: L
Blocked by: N/A
```

**Objective:** Provide platform administrators with a modern, rich UI to monitor facilities, review operational metrics, filter by city/standards, moderate facilities (`ACTIVE ↔ SUSPENDED`), re-evaluate compliance, and export reports matching Figma Screen A04.

**Scope**

- In scope:
  - Replace the placeholder page at `/admin/courts` with `CourtManagementPage.tsx`.
  - **Reuse Existing Layout Components**: Reuse existing `AdminSidebar` and `AdminHeader` as-is (do **NOT** modify or duplicate). Reuse existing `TablePagination` and `Toast` components.
  - **Feature-Specific Content Components**:
    - `FacilityMetricCards.tsx`: 4 Bento-style KPI cards (Total Facilities, Total Courts, Active Facilities, Suspended Facilities) using only data-backed values.
    - `FacilityFiltersToolbar.tsx`: Search input, City/Region dropdown, Status dropdown, Sort dropdown, and Reset button.
    - `FacilityTable.tsx`: Data table rendering facility thumbnails, facility code (`#FAC-...`), owner contact info, court scale, operational status badge, and contextual row actions.
    - `FacilityStatusModal.tsx`: Modal for confirming suspension or re-evaluation/reactivation.
    - `CreateFacilityModal.tsx`: Modal for onboarding a new facility with owner contact and initial courts.
    - `FacilityComplianceBanner.tsx`: Bottom SLA policy container explaining suspension implications on booking availability.
  - Client-side Excel export via utility function (`exportFacilitiesToExcel`).
  - Responsive layouts, toast feedback notifications, and debounced search handling.
- Out of scope:
  - Modifying existing global components: `AdminSidebar.tsx`, `AdminHeader.tsx`, `GlobalSearchResults.tsx`.
  - Modifying User Management pages or components.
  - Screen A16 (Incident / Dispute resolution workflow).

**Implementation requirements**

1. **Service Layer**: Create `frontend/src/features/admin/services/adminFacilityService.ts` to call `/admin/facilities` endpoints (`fetchFacilities`, `updateFacilityStatus`, `deleteFacility`).
2. **Types**: Create `frontend/src/features/admin/types/facility.ts` declaring types for `Facility`, `FacilityStats`, `FacilityFilters`, and pagination.
3. **Components**:
   - `frontend/src/features/admin/components/facility/FacilityMetricCards.tsx`
   - `frontend/src/features/admin/components/facility/FacilityFiltersToolbar.tsx`
   - `frontend/src/features/admin/components/facility/FacilityTable.tsx`
   - `frontend/src/features/admin/components/facility/FacilityStatusModal.tsx`
   - `frontend/src/features/admin/components/facility/CreateFacilityModal.tsx`
   - `frontend/src/features/admin/components/facility/FacilityComplianceBanner.tsx`
4. **Excel Export Utility**: Create `frontend/src/features/admin/utils/facilityExcelExport.ts` matching the existing user export pattern.
5. **Page Assembly**: Construct `frontend/src/features/admin/pages/CourtManagementPage.tsx` using `AdminSidebar` and `AdminHeader` wrappers, integrating breadcrumbs, action buttons, KPI cards, filter toolbar, data table, `TablePagination`, modals, and toasts.
6. **App Routing**: Update `frontend/src/App.tsx` route `/admin/courts` to render `CourtManagementPage`.

**Files/areas affected**

- `frontend/src/features/admin/services/adminFacilityService.ts`
- `frontend/src/features/admin/types/facility.ts`
- `frontend/src/features/admin/components/facility/FacilityMetricCards.tsx`
- `frontend/src/features/admin/components/facility/FacilityFiltersToolbar.tsx`
- `frontend/src/features/admin/components/facility/FacilityTable.tsx`
- `frontend/src/features/admin/components/facility/FacilityStatusModal.tsx`
- `frontend/src/features/admin/components/facility/CreateFacilityModal.tsx`
- `frontend/src/features/admin/components/facility/FacilityComplianceBanner.tsx`
- `frontend/src/features/admin/utils/facilityExcelExport.ts`
- `frontend/src/features/admin/pages/CourtManagementPage.tsx`
- `frontend/src/App.tsx`

**API impact:** Consumes `GET /admin/facilities`, `PATCH /admin/facilities/:id`, `DELETE /admin/facilities/:id` (provided by CM-01 and CM-02).

**Schema/config impact:** None.

**Verification**

- Component verification: KPI cards, filter toolbar, and data table render correctly against mock API data.
- Integration: filter/sort/search parameters are forwarded to the API endpoint and the table updates correctly.
- Debounced search: confirm API is not called on every keystroke.
- Sidebar/header isolation: confirm existing global layout components are not modified or broken.
- Excel export: confirm an `.xlsx` file is generated and downloaded with the current facility data.

**Acceptance criteria**

- **Given** an admin accesses `/admin/courts`
  **When** the page loads
  **Then** the existing sidebar and header remain intact, 4 Bento KPI cards display aggregate stats, the filter toolbar is interactive, and the facility table renders with facility, owner, court-scale, status, and action columns matching Figma A04 styling.
- **Given** an admin searches for a keyword or selects a city filter
  **When** input changes
  **Then** an API request is sent with debounced parameters and the table updates accordingly.
- **Given** an admin clicks "Thẩm định lại" on a suspended facility
  **When** the admin confirms reactivation in the modal
  **Then** status is updated to `ACTIVE`, table reflects the change, and a success toast appears.
- **Given** an admin clicks "Xuất báo cáo (Excel)"
  **When** clicked
  **Then** an Excel file with current facility data is generated and downloaded.
- **Given** any UI state change or navigation
  **When** tested across desktop and mobile drawer states
  **Then** existing sidebar/header navigation remains completely functional and unaffected.

---

---

## [ ] CM-05: Owner-submission approval/rejection API and UI

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Let an Admin approve or reject facilities/courts submitted by a Court Owner, per PRD §7/§8 and `database-schema.md` §3.5/§3.6/§5.15.

**Scope**

- In scope:
  - Accept `PENDING_APPROVAL` and `REJECTED` in validation for status queries and transitions.
  - `POST /api/v1/admin/facilities/:id/approve`, `POST /api/v1/admin/facilities/:id/reject`, and the court equivalents, moving `PENDING_APPROVAL → ACTIVE` / `PENDING_APPROVAL → REJECTED`.
  - UI to review pending submissions and approve/reject with an optional reason.
- Out of scope:
  - Owner submission creation (CO-02) and operational `ACTIVE ↔ SUSPENDED` (CM-02/CM-03).

**Implementation requirements**

1. Only `ADMIN` may approve/reject.
2. Transitions are only valid from `PENDING_APPROVAL`; other states return a conflict.
3. Approval sets `ACTIVE`; rejection sets `REJECTED`. Both are recorded with the acting Admin and timestamp where the schema supports it.
4. A rejected facility/court is never bookable.

**Files/areas affected**

- `backend/src/controllers/admin/`, `backend/src/services/admin/`, `backend/src/validation/admin.ts` `[Proposed — verify during implementation]`
- `frontend/src/features/admin/components/facility/`, `frontend/src/features/admin/pages/CourtManagementPage.tsx` `[Proposed — verify during implementation]`

**API impact:** Adds approve/reject endpoints; broadens allowed status values.

**Schema/config impact:** Uses the `PENDING_APPROVAL`/`REJECTED` statuses and the facility/court status CHECK.

**Verification**

- API-level: approve/reject success and invalid-state conflicts.
- Integration: approved facility/court becomes bookable; rejected stays non-bookable.

**Acceptance criteria**

- **Given** a facility in `PENDING_APPROVAL`
  **When** an Admin approves it
  **Then** it becomes `ACTIVE` and bookable.
- **Given** a facility in `PENDING_APPROVAL`
  **When** an Admin rejects it
  **Then** it becomes `REJECTED` and remains non-bookable.
