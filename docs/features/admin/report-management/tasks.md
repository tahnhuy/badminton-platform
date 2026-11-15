# Task Breakdown: Admin Report Management

## Task completion review — 2026-11-01

Review requested by the owner. The per-task review notes below supersede older implementation-progress blockers only where explicitly stated. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Test-only BlockPort coverage is not production Messaging integration. Shared schema/document PR review before merge is unchanged. No governing business choice is approved by changing task status.

**Feature:** Admin Report Management
**Status:** READY FOR IMPLEMENTATION
**References:**
- PRD: `docs/features/admin/report-management/prd.md`
- Tech Design: `docs/features/admin/report-management/tech-design.md`
- Database Schema: `docs/architecture/database-schema.md` §3.25

---

## Summary

| ID    | Title                                           | Status   | Dependencies  | Size |
|-------|-------------------------------------------------|----------|---------------|------|
| RP-01 | Backend - Report Module Setup and List Endpoint | IN_PROGRESS | Platform Auth | M    |
| RP-02 | Backend - Report Detail and Status Update       | IN_PROGRESS | RP-01         | M    |
| RP-03 | Frontend - Report List View                     | Approved | RP-01         | M    |
| RP-04 | Frontend - Report Detail and Resolution UI      | Approved | RP-02, RP-03  | S    |

---

## [ ] RP-01: Backend - Report Module Setup and List Endpoint

**Completion review (2026-11-01):** Keep IN_PROGRESS: list/RBAC/filter/pagination/allowlist implementation matches the feature Tech Design snake_case example, but the recorded contract review is unresolved against conventions.md camelCase object-property naming rule. No API casing change or implied contract approval is made in a status review.

**Status:** IN_PROGRESS

**Implementation status (2026-11-01, not DONE):**

- Implemented `routes/admin/reportRoutes.ts`, `controllers/admin/AdminReportController.ts`, `services/admin/AdminReportService.ts` and schemas in `validation/admin.ts`.
- The repository lives at `repositories/reports/ReportRepository.ts` (layer-first convention; RP-06 uses the same folder), not the root path listed below.
- The response follows the Tech Design §2.1 example: snake_case fields, string ids, only the matching target column. Ordering is `created_at DESC, id DESC`.
- `admin-reports.test.ts` passed.
- Missing before DONE: full regression (skipped at the owner's request) and review of the snake_case contract against other camelCase Admin APIs.

**Objective:**
Establish the `admin/reports` backend module, enforce RBAC authorization, and implement the paginated list endpoint.

**Scope:**
- Create routes, controller, service, and repository structure for the new module.
- Implement the `GET /api/v1/admin/reports` endpoint.
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
- `backend/src/routes/admin/reportRoutes.ts` [NEW]
- `backend/src/controllers/admin/AdminReportController.ts` [NEW]
- `backend/src/services/admin/AdminReportService.ts` [NEW]
- `backend/src/repositories/ReportRepository.ts` [NEW]

**API Impact:**
- **NEW:** `GET /api/v1/admin/reports`

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

## [ ] RP-02: Backend - Report Detail and Status Update

**Completion review (2026-11-01):** Keep IN_PROGRESS: code and tests return 400 ADMIN_REPORT_INVALID_TRANSITION for repeated resolve, matching task acceptance and Tech Design §13; Tech Design §7/§10 still require an idempotent repeat. This is a governing-document contradiction requiring a product/contract decision, not a missing regression test.

**Status:** IN_PROGRESS

**Implementation status (2026-11-01, not DONE):**

- Detail and `PATCH /:id/status` are implemented. The update runs in one transaction: row lock, `OPEN` guard, conditional update. Admin is checked at both the route and the service.
- A repeated or concurrent second resolve returns `400 ADMIN_REPORT_INVALID_TRANSITION` and keeps the first `resolved_at`. This follows the Acceptance Criteria; Tech Design §7/§10 call the repeat "idempotent", a wording conflict that needs confirmation.
- Covered by `admin-reports.test.ts`, which passed.
- Missing before DONE: full regression (skipped at the owner's request).

**Objective:**
Implement the detail view and status transition logic (`OPEN` → `RESOLVED`) for Admin reports.

**Scope:**
- Implement the `GET /api/v1/admin/reports/:id` endpoint.
- Implement the `PATCH /api/v1/admin/reports/:id/status` endpoint.

**Implementation Requirements:**
  - **Detail View:** Return report details with mapped `target_type`. Expose only approved fields (do not leak database rows).
  - **Status Update:**
  - Validate the `ADMIN` role.
  - Transition allowed: only `OPEN` to `RESOLVED`.
  - Ensure `RESOLVED` is a terminal state (cannot transition from `RESOLVED` to anything else).
  - Use database transaction and state-transition guard for mutation.
  - Return `ADMIN_REPORT_NOT_FOUND`, `ADMIN_REPORT_INVALID_STATUS`, or `ADMIN_REPORT_INVALID_TRANSITION` on failure.

**Dependencies:**
- RP-01 (Module structure).

**Files/Areas Affected:**
- `backend/src/routes/admin/reportRoutes.ts`
- `backend/src/controllers/admin/AdminReportController.ts`
- `backend/src/services/admin/AdminReportService.ts`
- `backend/src/repositories/ReportRepository.ts`

**API Impact:**
- **NEW:** `GET /api/v1/admin/reports/:id`
- **NEW:** `PATCH /api/v1/admin/reports/:id/status`

**Schema/Config Impact:**
- **Schema:** None.
- **Config:** None. `REPORT_ENABLED` controls report submission, not Admin review/resolution of existing reports.

**Testing Requirements:**
- **Unit:** Status transition guards, validation of path identifier and request body.
- **Integration:** Target retrieval via `REPORTS` relationships, transaction commit on valid transition, rollback on invalid transition.
- **API-level:** Verify `400 Bad Request` with `ADMIN_REPORT_INVALID_TRANSITION` for every status update attempted after the report reaches terminal state `RESOLVED`.

**Acceptance Criteria:**
- Detail view returns `200 OK` with the exact single target type.
- Missing report ID returns `404 Not Found`.
- Admin can update a report from `OPEN` to `RESOLVED`.
- Update response includes updated `resolved_at` timestamp.
- Attempting to update a `RESOLVED` report returns `400 Bad Request` with `ADMIN_REPORT_INVALID_TRANSITION`.
- Updating to a status other than `RESOLVED` returns `400 Bad Request` with `ADMIN_REPORT_INVALID_STATUS`.

---

## [ ] RP-03: Frontend - Report List View

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
- RP-01 (API list endpoint must be ready or mocked).

**Files/Areas Affected:**
- `frontend/src/features/admin/reports/components/ReportList.tsx` [NEW]
- `frontend/src/features/admin/reports/api/reports.api.ts` [NEW]
- `frontend/src/features/admin/reports/hooks/...` [NEW]
- `frontend/src/features/admin/reports/ReportsPage.tsx` [NEW] (or equivalent routing file)

**API Impact:**
- Consumes `GET /api/v1/admin/reports`.

**Schema/Config Impact:**
- None.

**Testing Requirements:**
- **E2E/Integration:** Verify Admin can navigate to the report list, filter by target type, and view results. Verify empty states.

**Acceptance Criteria:**
- Admin portal has a navigation entry for "Reports".
- List view displays paginated reports correctly.
- Admin can change filters and see updated results.

---

## [ ] RP-04: Frontend - Report Detail and Resolution UI

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
- RP-02, RP-03.

**Files/Areas Affected:**
- `frontend/src/features/admin/reports/components/ReportDetail.tsx` [NEW]
- `frontend/src/features/admin/reports/api/reports.api.ts`
- `frontend/src/features/admin/reports/ReportDetailPage.tsx` [NEW] (or equivalent nested view/modal)

**API Impact:**
- Consumes `GET /api/v1/admin/reports/:id`.
- Consumes `PATCH /api/v1/admin/reports/:id/status`.

**Schema/Config Impact:**
- None.

**Testing Requirements:**
- **E2E:** Verify an Admin can open a report detail, view the target, click "Resolve", and see the status change to `RESOLVED` with appropriate success feedback.

**Acceptance Criteria:**
- Detail view correctly renders the report's exact target and description safely.
- Admin can successfully mark an `OPEN` report as `RESOLVED`.
- Upon successful resolution, the UI reflects the updated state without needing a manual refresh.
- If the backend returns an error (e.g. invalid transition), the UI displays a readable error to the Admin.

---

# Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

Governing design: Tech Design §16 (Ready). RP-01…RP-04 keep their status.

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| RP-05 | Report targets and evidence schema | BLOCKED | §16 Ready, SOC-01, MSG-01 | S |
| RP-06 | Player report creation API with evidence snapshot | BLOCKED | RP-05, SOC-05, MSG-02 | M |
| RP-07 | Admin evidence view, evidence media download and hide links | BLOCKED | RP-02, RP-06, SOC-07 | M |
| RP-08 | Shared Player report dialog and Social/Messaging entry points | BLOCKED | RP-06, SOC-08, MSG-09 | M |

## [ ] RP-05: Report targets and evidence schema

```text
Status: BLOCKED
Size: S
Blocked by: SOC-01, MSG-01 (schema targets Ready)
```

**Objective:** Add the three target columns, the attachment column and evidence tables; replace `chk_report_target`.

**Scope**

- In scope: migration; Drizzle schema.
- Out of scope: API.

**Implementation requirements**

1. Existing reports remain valid under the new CHECK.

**Files/areas affected**

- `backend/src/db/schema/reports.ts`, `backend/src/db/migrations/`

**API impact:** None.

**Schema/config impact:** §13.8.

**Verification**

- Integration: two targets rejected; attachment without message rejected; existing seed reports pass.

**Acceptance criteria**

- **Given** existing reports **When** migrated **Then** all rows satisfy the new CHECK.

## [ ] RP-06: Player report creation API with evidence snapshot

```text
Status: BLOCKED
Size: M
Blocked by: RP-05, SOC-05, MSG-02
```

**Objective:** `POST /api/v1/reports` for post/comment/message targets (§16).

**Scope**

- In scope: access checks via Social/Messaging, self-report rejection, `REPORT_ENABLED`, reason codes per matrix §7 (`OTHER` requires a description), attachment-belongs-to-message check, evidence snapshot in the same transaction.
- Out of scope: Player/Facility/Tournament creation flows (not designed).

**Implementation requirements**

1. No-access targets return `404 REPORT_TARGET_NOT_FOUND`.

**Files/areas affected**

- `backend/src/{routes,controllers,services,repositories}/reports/` `[Proposed — verify during implementation]`

**API impact:** New endpoint.

**Schema/config impact:** None.

**Verification**

- API: evidence unchanged after author edit; message report by non-member 404; unknown reason `400 REPORT_INVALID_REASON`; `OTHER` with blank description `400 REPORT_DESCRIPTION_REQUIRED`; existing Player/Facility/Tournament codes still accepted for their targets.

**Acceptance criteria**

- **Given** a reported post later edited **When** Admin reads the report **Then** the evidence shows the original text and images.

## [ ] RP-07: Admin evidence view, evidence media download and hide links

```text
Status: BLOCKED
Size: M
Blocked by: RP-02, RP-06, SOC-07
```

**Objective:** Show evidence in report detail; download only evidence media; link to Social hide actions.

**Scope**

- In scope: `GET /admin/reports/:id` evidence; `GET /admin/reports/:id/evidence/media/:mediaId`; Admin UI.
- Out of scope: message hiding (not in MVP).

**Implementation requirements**

- Evidence visual reference: Social 99:44643 under `docs/architecture/frontend.md`, "Social and Messaging — Figma alignment review, 2026-10-31". Use only the evidence panel inside the role-protected Admin Report detail; the source board itself says it is not a complete Admin screen.
- Show only the captured message and selected evidence media; no link to an unrestricted chat. Hide controls apply only to posts/comments. Use authorized evidence download, not the inline file-preview sample.

1. Media outside the report's evidence → 404.

**Files/areas affected**

- `backend/src/services/reports/`, `frontend/src/features/admin/` `[Proposed — verify during implementation]`

**API impact:** As listed.

**Schema/config impact:** None.

**Verification**

- E2E: Admin report detail displays only selected evidence; Player cannot open Admin evidence; hiding a reported kèo post does not cancel the recruitment/booking.

- API: Admin cannot read other messages of the conversation; non-Admin 403.

**Acceptance criteria**

- **Given** a message report **Then** no hide-message control or unrestricted conversation entry exists in Admin evidence.

- **Given** a message report with one attachment **When** Admin opens it **Then** only that message and attachment are visible.


## [ ] RP-08: Shared Player report dialog and Social/Messaging entry points

```text
Status: BLOCKED
Size: M
Blocked by: RP-06, SOC-08, MSG-09
```

**Objective:** Implement the existing Ready report behavior as one reusable Player dialog, using Figma Social 99:44643 and Messaging 99:45821 / 99:47451. This closes a frontend ownership gap, not a new reporting capability.

**Scope**

- In scope: report entry on others' posts/comments/messages or one message attachment; selected-content preview; the six approved reason labels; OTHER description validation; pending/success/error states preserving input; integration into Social and Messaging context menus.
- Out of scope: Admin report review (RP-07), new API/schema, reporting own content, unrestricted conversation evidence, message hiding, inline document rendering.

**Implementation requirements**

1. Share the feature-agnostic dialog shell under `components/common/`; keep report transport/state under the owning existing reporting capability, following frontend conventions. Social/Messaging pass target context, not their own duplicated report forms.
2. Call RP-06 with the exact selected target/optional attachment. Recheck error/permission outcomes; access loss closes/removes unavailable content rather than retaining a readable unauthorized preview.
3. Report metadata and file preview use only authorized content; document files are downloads. A UI design is not a bypass of contextual authorization.
4. Match the Social/Messaging Figma review in `docs/architecture/frontend.md`; retain existing routes and task completion history.

**Files/areas affected**

- `frontend/src/components/common/`, `frontend/src/features/admin/` (existing report API boundary if applicable), `frontend/src/features/social/`, `frontend/src/features/messaging/` — confirm the narrow owning client location during implementation; no new backend contract.

**API impact:** Consumes `POST /api/v1/reports` (RP-06) only.

**Schema/config impact:** None; existing REPORT_ENABLED behavior.

**Verification**

- Playwright: report another Player's post/comment/message and selected attachment; six reason values; OTHER requires description; failure preserves selection/input; success closes/acknowledges; own content has no report entry; access revoked before submit produces the neutral unavailable state.
- Test keyboard dismissal/focus return, mobile 390px and no full conversation leakage.

**Acceptance criteria**

- **Given** a selected attachment **When** the Player submits a report **Then** only that message/attachment target is sent, never the conversation.
- **Given** OTHER with empty description **Then** submission is rejected with a field message.
- **Given** Admin hides the reported kèo post **Then** the report UI does not cancel its recruitment or booking.
