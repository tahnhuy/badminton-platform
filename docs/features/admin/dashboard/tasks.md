# Admin Dashboard (Trang tổng quan thống kê và điều hành nền tảng) — Task List

Implementation tasks for the Admin Dashboard feature.

- Feature: Admin Dashboard
- Domain: `features/admin/dashboard`
- Governing PRD: [prd.md](prd.md) (Ready)
- Governing Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions §21 #1–#9)
- Business rules: `docs/business-rules-config-matrix.md` §2.8, §7, §8.2, §8.4, §8.6
- Schema authority: `docs/architecture/database-schema.md` §3.1, §3.5, §3.6, §3.8, §3.10, §3.17, §3.21, §3.25, §5.14

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and the required verification is complete.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps listed under "Verification" are complete. A task cannot move to `DONE` until its automated tests exist and pass.

> **No new decisions.** These tasks must not resolve a `[TBD]`, change business rules, the schema, the API contract, or any confirmed decision. The Tech Design has no remaining open questions. Scope is bounded by `prd.md` and `tech-design.md`; all KPI and period definitions follow the PRD Decision Log.
>
> **Environment note (Auth dependency).** The current `authenticate` middleware still contains a `[TEMP AUTH BYPASS]` that injects an Admin identity when no session is present (`backend/src/middleware/auth.middleware.ts`), and the Auth module is not yet implemented. The dashboard requires a real `ADMIN` identity. API-level implementation and verification can proceed using the middleware's existing test identity header (`X-User-Id`) with an active `ADMIN` row; full E2E with a real signed-in Admin waits for Auth.
>
> **Schema/documentation note.** AD-01 adds the nine approved indexes. `docs/architecture/database-schema.md` §5.14 already records them; the migration task must record its application in the schema Change Log. The migration is additive (indexes only; no column/table/constraint change).
>
> **Chart dependency note.** Charts use native SVG/CSS; no external charting library may be added (`tech-stack.md`; Decision Log §21 #4).

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| AD-01 | Dashboard schema indexes, aggregate repository, and KPI service | Approved | — | L |
| AD-02 | Dashboard API — controller, routes, Zod validation, and Admin middleware | Approved | AD-01 | M |
| AD-03 | Frontend KPI bento cards, time-range filter, and growth chart | Approved | AD-02 | L |
| AD-04 | Frontend recent-activities feed and full Admin dashboard page integration | Approved | AD-03 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | AD-01 | — |
| 2 | AD-02 | AD-01 |
| 3 | AD-03 | AD-02 |
| 4 | AD-04 | AD-03 |

---

## [ ] AD-01: Dashboard schema indexes, aggregate repository, and KPI service

```text
Status: Approved
Size: L
Blocked by: N/A
```

**Objective:** Add the approved dashboard indexes and implement the aggregate repository and KPI/chart/activity service so all statistics are computed in SQL (no raw-row loading), per Tech Design §7.2, §7.3, §7.4, and §10.

**Scope**

- In scope:
  - Add the nine approved indexes (Tech Design §10; `database-schema.md` §5.14) via a new Drizzle migration.
  - `DashboardRepository`: the KPI CTE statement, the daily chart query with `generate_series` zero-fill, and the activity-feed `UNION ALL` query.
  - `DashboardService`: range resolution (`today`/`7d`/`30d`/`this_month`) in `Asia/Ho_Chi_Minh`, mapping results to the PRD KPI definitions, and assembling responses.
  - Slot fill rate computation using play date (`booking_date`) and opening hours × `ACTIVE` courts.
- Out of scope:
  - HTTP controllers/routes and Zod validation (AD-02).
  - Any frontend work (AD-03, AD-04).
  - Writes/mutations (the dashboard is read-only).

**Implementation requirements**

1. Add indexes to the Drizzle table definitions and generate migration `0007` (or the next free number); ensure it is additive and safe on populated tables.
2. Use Drizzle/pg aggregate queries only (`COUNT`, `SUM`, `FILTER`, `GROUP BY`, `date_trunc`, `generate_series`); never load raw rows into Node memory.
3. Run the KPI computation as a single CTE statement for a consistent snapshot; run charts and activities as one query each.
4. Resolve period bounds in `Asia/Ho_Chi_Minh` with half-open intervals `[start, end)`; "today" and "this month" are calendar-based, "7d"/"30d" are rolling.
5. Apply the exact PRD definitions (active-user rate, total bookings, fill rate, gross estimated revenue via `paid_at IS NOT NULL`, distinct confirmed participants, `OPEN` reports, `PENDING_APPROVAL` facilities).
6. Record the migration application in `database-schema.md`'s Change Log in the same session.

**Files/areas affected**

- `backend/src/db/schema/users.ts`
- `backend/src/db/schema/facilities.ts`
- `backend/src/db/schema/bookings.ts`
- `backend/src/db/schema/reports.ts`
- `backend/src/db/schema/tournaments.ts`
- `backend/src/db/migrations/0007_*.sql`
- `backend/src/db/migrations/meta/`
- `backend/src/repositories/admin/DashboardRepository.ts` `[Proposed — verify during implementation]`
- `backend/src/services/admin/DashboardService.ts` `[Proposed — verify during implementation]`
- `docs/architecture/database-schema.md`

**API impact:** None.

**Schema impact:** Adds the nine supporting indexes (no column/table/constraint changes); `database-schema.md` §5.14 already records them and the Change Log records the migration.

**Verification**

- Unit: range resolution boundaries in `Asia/Ho_Chi_Minh`; KPI mapping; fill-rate math; activity ordering/tie-break.
- Integration: aggregates over zero/one/many rows; `generate_series` zero-fill; union ordering; `EXPLAIN` shows index usage on the aggregate predicates where expected.
- API-level: N/A.
- E2E for a critical flow: N/A.
- Edge/failure/concurrency: no data in range yields zeros and an empty feed, not errors; large-table queries use the new indexes.
- Manual: apply the migration to a fresh and a populated database; record the application.

**Acceptance criteria**

- **Given** a fresh or populated database
  **When** migration `0007` runs
  **Then** all nine indexes exist, no data is lost, and existing behavior is unchanged.

- **Given** data across several days in `Asia/Ho_Chi_Minh`
  **When** the service computes KPIs for `range=30d`
  **Then** period-scoped values match the PRD definitions and snapshot values describe the current instant.

- **Given** no data in the selected range
  **When** KPIs and charts are computed
  **Then** counts are zero and chart days are zero-filled (no error).

- **Given** bookings on different play dates
  **When** slot fill rate is computed
  **Then** booked slot-hours are counted by `booking_date` and the denominator is opening hours × `ACTIVE` courts × days.

---

## [ ] AD-02: Dashboard API — controller, routes, Zod validation, and Admin middleware

```text
Status: Approved
Size: M
Blocked by: AD-01
```

**Objective:** Expose the three read-only dashboard endpoints under `/api/v1/admin/dashboard/` with Zod-validated query params, the `ADMIN` role middleware, the standard error shape, and HTTP caching headers.

**Scope**

- In scope:
  - `GET /api/v1/admin/dashboard/kpis`, `.../charts`, `.../recent-activities`.
  - Zod schemas: `range` enum (`today` | `7d` | `30d` | `this_month`, default `30d`) and `limit` (10–20, default 10).
  - Router-level `authenticate` + `requireRole('ADMIN')`.
  - Response shaping `{ data: ... }`; error shape `{ error: { code, message, details } }`.
  - `Cache-Control: private, max-age=30, must-revalidate` on all three endpoints.
  - Mount the router in `app.ts`.
- Out of scope:
  - Aggregation logic (AD-01).
  - Frontend (AD-03, AD-04).
  - Pagination (the feed is a bounded `limit` window).

**Implementation requirements**

1. Keep routes/controllers thin; delegate to `DashboardService`.
2. Validate `range`/`limit` with Zod via the shared `validate` middleware; map an invalid `range` to `ADMIN_DASHBOARD_INVALID_RANGE` and an invalid `limit` to the global `VALIDATION_FAILED`.
3. Apply `authenticate` + `requireRole('ADMIN')` (variadic, uppercase) to the whole router.
4. Set the cache headers exactly as specified; do not add a server-side cache.
5. Return no PII and no raw records; errors go through the centralized handler.

**Files/areas affected**

- `backend/src/validation/dashboard.ts` `[Proposed — verify during implementation]`
- `backend/src/controllers/admin/DashboardController.ts` `[Proposed — verify during implementation]`
- `backend/src/routes/admin/dashboardRoutes.ts` `[Proposed — verify during implementation]`
- `backend/src/app.ts`

**API impact:** Adds the three endpoints per Tech Design §9.1–§9.4.

**Schema impact:** None beyond AD-01.

**Verification**

- Unit: query-param validation and error-code mapping.
- Integration: controller returns the service result unchanged and sets cache headers.
- API-level: `200` shapes for all three endpoints; `400` for invalid `range`/`limit`; `401`/`403`; `Cache-Control` present; no PII.
- E2E for a critical flow: an authenticated Admin fetches all three endpoints (may use the test identity header until Auth lands).
- Edge/failure/concurrency: repeated requests are stable; invalid `range` never reaches the service.
- Manual: N/A.

**Acceptance criteria**

- **Given** an authenticated `ADMIN`
  **When** they call the three dashboard endpoints
  **Then** each returns `200` with `{ data: ... }` and `Cache-Control: private, max-age=30, must-revalidate`.

- **Given** a non-`ADMIN` user or an unauthenticated caller
  **When** they call any dashboard endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE` or `401 AUTH_SESSION_INVALID`.

- **Given** `range=all_time` or `limit=100`
  **When** the request is validated
  **Then** the response is `400` with `ADMIN_DASHBOARD_INVALID_RANGE` or `VALIDATION_FAILED` and the service is not called.

- **Given** a valid request
  **When** the response is produced
  **Then** it contains aggregate values/event summaries only and no Player/Court Owner PII.

---

## [ ] AD-03: Frontend KPI bento cards, time-range filter, and growth chart

```text
Status: Approved
Size: L
Blocked by: AD-02
```

**Objective:** Build the dashboard layout shell, the time-range selector, the KPI bento cards, and the native-SVG/CSS growth chart widget.

**Scope**

- In scope:
  - `DashboardLayout` shell with the Admin route guard and a shared `TimeRangeSelector` that drives all widgets.
  - `MetricCard` (presentational) composed into a Bento grid grouped by domain (Users, Facilities & Courts, Pending Approvals, Bookings & Revenue, Tournaments, Reports).
  - `GrowthChartWidget` rendering new-users/new-bookings as native SVG/CSS (no chart library).
  - Feature API client/hooks for the KPIs and charts endpoints.
  - Loading/empty/error/partial states per widget; estimate labeling for revenue.
- Out of scope:
  - Recent-activities table and full-page integration (AD-04).
  - Backend changes.
  - Any external charting dependency.

**Implementation requirements**

1. Keep API transport/hooks out of presentational components; use explicit props.
2. Represent KPI values exactly as returned; label the revenue value as an estimate.
3. Implement the chart with SVG/CSS; handle zero-filled days and empty series without layout breakage.
4. Changing the range refetches all widgets; do not show stale values as current while loading.
5. Apply loading/empty/error states per widget; a failing widget must not break the others.

**Files/areas affected**

- `frontend/src/features/admin/dashboard/` `[Proposed — verify during implementation]`
- `frontend/src/services/` `[Proposed — verify during implementation]`
- `frontend/src/hooks/` `[Proposed — verify during implementation]`
- `frontend/src/types/` `[Proposed — verify during implementation]`
- `frontend/src/pages/` `[Proposed — verify during implementation]`

**API impact:** Consumes the KPIs and charts endpoints; no new contract.

**Schema impact:** None.

**Verification**

- Unit: range selector behavior; MetricCard formatting (percent, currency, estimate marker); chart series mapping.
- Integration: API client maps responses and error codes; range change refetches.
- API-level: N/A.
- E2E for a critical flow: N/A at this task (covered by AD-04).
- Edge/failure/concurrency: empty/zero series renders; one widget error does not break the grid.
- Manual: Switch ranges and confirm all cards/chart update; verify no external chart dependency is present.

**Acceptance criteria**

- **Given** an authenticated Admin on the dashboard
  **When** the page loads
  **Then** the KPI bento cards and the growth chart render for the default range.

- **Given** the Admin changes the range
  **When** the selection changes
  **Then** every KPI card and the chart refetch and display the new period.

- **Given** a range with no data
  **When** widgets render
  **Then** counts show zero and the chart shows zero-filled days with an empty-friendly state.

- **Given** the KPIs response
  **When** revenue is displayed
  **Then** it is shown with an estimate marker and the configured currency.

- **Given** a widget request fails
  **When** the page renders
  **Then** only that widget shows an error state and the rest remain usable.

---

## [ ] AD-04: Frontend recent-activities feed and full Admin dashboard page integration

```text
Status: Approved
Size: M
Blocked by: AD-03
```

**Objective:** Build the Recent Platform Activity feed using the shared table component, add quick navigation links, and integrate all widgets into the complete `AdminDashboardPage`.

**Scope**

- In scope:
  - `RecentActivityTable` composed from the shared table component (newest-first; type, summary, time; no PII).
  - `QuickActionLinks` navigation to User/Court/Report/Tournament management areas (no mutation).
  - `AdminDashboardPage` integrating layout, selector, cards, chart, feed, and links.
  - Manual refresh action; no auto-polling.
  - Scope clarification: the activity feed is a fixed bounded window (limit 10–20) and does **not** vary by the time-range filter, which applies to the period-scoped KPIs and the chart only (Tech Design §7.4, §9.3).
- Out of scope:
  - Backend changes.
  - Data mutation from the dashboard.
  - Drill-down analytics beyond navigation.

**Implementation requirements**

1. Use the shared table component per conventions; supply feature columns/rows; do not fork it.
2. Order the feed newest-first exactly as returned; render human-readable summaries.
3. Quick links use the router and perform no mutation.
4. Manual refresh refetches all widgets; do not auto-poll.
5. Apply loading/empty/error states; the page remains usable if the feed is empty or fails.

**Files/areas affected**

- `frontend/src/features/admin/dashboard/` `[Proposed — verify during implementation]`
- `frontend/src/pages/` (e.g., `AdminDashboardPage.tsx`) `[Proposed — verify during implementation]`
- `frontend/src/App.tsx` (route registration, if required) `[Proposed — verify during implementation]`

**API impact:** Consumes the recent-activities endpoint (and the AD-02 endpoints via AD-03); no new contract.

**Schema impact:** None.

**Verification**

- Unit: feed row rendering and ordering; quick-link targets; manual refresh wiring.
- Integration: page composes all widgets; refresh refetches; router navigation works.
- API-level: N/A.
- E2E for a critical flow: an Admin opens the dashboard, reviews KPIs/chart/feed, refreshes, and navigates to Report Management via a quick link.
- Edge/failure/concurrency: empty feed shows an empty state; feed failure does not break KPI/chart widgets.
- Manual: Verify the full page on the default and each range.

**Acceptance criteria**

- **Given** recent platform events exist
  **When** the dashboard loads
  **Then** the Recent Activity feed shows up to 10 events newest-first across booking/tournament/report/facility, with no PII.

- **Given** an Admin clicks a quick navigation shortcut
  **When** the link is used
  **Then** the Admin is routed to the corresponding management area and no data is mutated.

- **Given** the Admin uses the manual refresh
  **When** the action completes
  **Then** all widgets refetch and display the latest data for the selected range.

- **Given** there is no recent activity
  **When** the dashboard renders
  **Then** the feed shows an empty state and the other widgets remain usable.

- **Given** the full dashboard page
  **When** rendered
  **Then** the KPI cards and chart reflect the selected range while the activity feed remains the independent newest-first window; all widgets are present on one page with the quick links.
