# Admin Dashboard — Technical Design

## 1. Metadata

```text
Status: Ready
Owner: Tech Lead
PRD: docs/features/admin/dashboard/prd.md
Scope: Admin Operations Overview Dashboard — read-only KPIs, growth charts, recent platform activity feed, and quick navigation, exposed under /api/v1/admin/dashboard/
Decision Status: Approved (decisions confirmed by the human owner on 2026-09-27)
```

> Ready. All decisions in §21 were resolved by the human owner on 2026-09-27
> (see §21 Decision Log), and the human readiness gate per
> `docs/documentation-guide.md` §6.3 was explicitly given on 2026-09-27. This
> design does not override the governing PRD, `PROJECT-BRIEF.md`,
> `docs/business-rules-config-matrix.md`, `docs/architecture/tech-stack.md`,
> `docs/architecture/conventions.md`, or the consolidated schema in
> `docs/architecture/database-schema.md`. The index delta in §10 lands with a
> same-session `database-schema.md` update.

Several items in the provided requirements conflicted with, or were not covered by, the authoritative documents; they were resolved by decision (§21 Decision Log) rather than silently applied:

1. `requireRole(['admin'])` → `requireRole('ADMIN')` (variadic, uppercase).
2. Cited schema sections corrected: `TOURNAMENTS` §3.17, `REPORTS` §3.25.
3. The "existing `created_at`/`status` indexes" assumption was incorrect; the §10 index delta is approved.
4. No charting library is approved; charts use native SVG/CSS.
5. Slot fill rate is measured by play date (`booking_date`).

## 2. Context

This design implements `docs/features/admin/dashboard/prd.md` (Ready):

1. An Admin sees read-only KPI cards for Users, Facilities & Courts, Pending Approvals, Bookings & Revenue, Tournaments, and Reports, over a selected time range.
2. Growth chart: daily new users and new bookings over the range.
3. Recent platform activity feed: newest-first union of notable events (booking, tournament, report, facility).
4. Quick navigation shortcuts to Admin management areas.

Boundaries:

- **DashboardModule (new, Admin capability)**: read-only aggregation endpoints and their query layer.
- **Existing modules (read-only consumption)**: User Management, Court Management, Report Management, Player Booking, Tournament, Payments/Refunds. The dashboard never mutates them.
- **AuthModule**: supplies the `ADMIN` identity via `authenticate` + `requireRole('ADMIN')`.
- **Frontend (React)**: Admin dashboard layout and widgets.

## 3. Technical Problem

1. **Authorization** — only `ADMIN` may access the dashboard; the role check must use the real middleware contract.
2. **Aggregation at the database** — KPIs must be computed with `COUNT`/`SUM`/`GROUP BY` aggregates, not by loading raw rows into server memory.
3. **Missing indexes** — the cited indexes do not exist for `created_at`/`status` on `FACILITIES`, `COURTS`, `REPORTS`, `TOURNAMENTS`, `PAYMENTS`; `BOOKINGS` lacks a `status`/`created_at` index. Aggregate performance depends on new indexes (schema delta, §10).
4. **Snapshot consistency** — the KPIs are a mix of period-scoped values and point-in-time snapshots; they must be assembled consistently (ideally one statement) so the numbers describe the same instant.
5. **Slot fill rate semantics** — available slot-hours depend on `ACTIVE` courts and facility opening hours; booked slot-hours are measured on the play date (`booking_date`) (Decision Log §21 #5, #7).
6. **Activity feed without an event table** — no dedicated event log exists; the feed is derived from `created_at` across four tables (PRD #10).
7. **Metric fidelity** — active-user rate, estimated revenue, and participant count must follow the PRD Decision Log exactly.
8. **Caching without new infrastructure** — `tech-stack.md` avoids Redis; HTTP/browser caching only is used (Decision Log §21 #6).

## 4. Goals

- Provide the three read-only endpoints under `/api/v1/admin/dashboard/` with Zod-validated `range` and cached responses.
- Compute KPIs with indexed aggregate SQL only; no raw record loading.
- Assemble period-scoped and snapshot KPIs consistently.
- Derive the recent activity feed from existing tables.
- Keep the design inside the PERN monolith, TypeScript, Express, Drizzle, and the confirmed polling/no-WebSocket decision.

## 5. Non-Goals

- Realtime WebSocket streaming for charts (PRD §3; `tech-stack.md` HTTP polling is the confirmed transport).
- A BI/OLAP/warehouse system or ad-hoc querying.
- Mutating business data from the dashboard.
- Multi-tier RBAC / Super Admin.
- New external dependencies (including a charting library) without an explicit decision.
- Historical retention/archival of dashboard data.

## 6. Upstream References

- Governing PRD: `docs/features/admin/dashboard/prd.md` (Ready, Decision Log §14 #1–#12)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §4, §5, §6
- Documentation rules: `docs/documentation-guide.md` §5.3, §6, §9, §13
- Global architecture/technology: `docs/architecture/tech-stack.md` (PERN, TypeScript, Drizzle ORM, Zod, opaque session cookie, centralized error handling, `/api/v1/`, offset pagination where applicable, no Redis)
- Global coding/API conventions: `docs/architecture/conventions.md` (Backend layering, API conventions, validation, performance, database conventions)
- Business rules/config: `docs/business-rules-config-matrix.md` §2.8, §7, §8.2, §8.4, §8.6
- Global database schema (authoritative sections): §3.1 `USERS`, §3.4 `COURT_OWNER_PROFILES`, §3.5 `FACILITIES`, §3.6 `COURTS`, §3.8 `BOOKINGS`, §3.10 `PAYMENTS`, §3.17 `TOURNAMENTS`, §3.21 `TOURNAMENT_REGISTRATIONS`, §3.25 `REPORTS`
- Related feature docs: `docs/features/admin/report-management/prd.md` (`OPEN`/`RESOLVED`), `docs/features/admin/court-management/prd.md` (`ACTIVE`/`SUSPENDED`), `docs/features/court-owner/prd.md` (`PENDING_APPROVAL`/`REJECTED`), `docs/features/platform/payments-refunds/tech-design.md` (payment status vocabulary)

## 7. Proposed Technical Design

### 7.1 Module and Layer Boundaries

Following `docs/architecture/conventions.md`:

- `backend/src/routes/admin/dashboardRoutes.ts` — thin router; `authenticate` + `requireRole('ADMIN')` applied to the whole router.
- `backend/src/controllers/admin/DashboardController.ts` — HTTP translation only.
- `backend/src/services/admin/DashboardService.ts` — orchestration, range resolution, cache-header decisions, response shaping.
- `backend/src/repositories/admin/DashboardRepository.ts` — the aggregate SQL only (no policy).
- `backend/src/validation/dashboard.ts` — Zod schemas for `range`/`limit` query params.
- Frontend components under `frontend/src/features/admin/dashboard/` (§7.5).

The dashboard is read-only; it has no transaction boundaries and emits no domain events.

### 7.2 KPI Definition Mapping (per PRD Decision Log)

| KPI | Scope | Definition (PRD) |
| --- | --- | --- |
| `users.totalPlayers` | snapshot | Non-soft-deleted `PLAYER` accounts |
| `users.newUsers` | period | `PLAYER` accounts created in range, non-soft-deleted |
| `users.activeUserRate` | snapshot | users with `status = 'ACTIVE'` ÷ total non-soft-deleted users |
| `facilities.totalFacilities` / `totalCourts` | snapshot | non-soft-deleted rows |
| `facilities.active` / `suspended` | snapshot | `status` = `ACTIVE` / `SUSPENDED` |
| `facilities.pendingApproval` | snapshot | `status = 'PENDING_APPROVAL'` (court-owner submissions) |
| `bookings.totalBookings` | period | bookings created in range, all statuses |
| `bookings.slotFillRate` | period | booked slot-hours ÷ available slot-hours for `ACTIVE` courts; booked counts `CONFIRMED`/`IN_PROGRESS`/`COMPLETED` |
| `revenue.estimatedValue` | period | gross `SUM(PAYMENTS.amount)` where `paid_at` is not null, booking + registration payments |
| `tournaments.inProgress` | snapshot | tournaments with `status = 'IN_PROGRESS'`, non-deleted |
| `tournaments.participants` | period | distinct players in `CONFIRMED` registrations (`registered_at` in range); Doubles counts both members |
| `reports.unresolved` | snapshot | reports with `status = 'OPEN'` |

Period-scoped values use the selected range; snapshot values describe the current instant. The KPI endpoint assembles both consistently (§7.3).

### 7.3 Query Strategy and Caching

**One statement for KPIs.** The KPI endpoint runs a single SQL statement with CTEs so all values are read at one consistent snapshot, minimizing round-trips:

```sql
WITH bounds AS (
  SELECT :start_ts AS start_ts, :end_ts AS end_ts
),
user_kpis AS (
  SELECT
    COUNT(*) FILTER (WHERE u.role = 'PLAYER') AS total_players,
    COUNT(*) FILTER (WHERE u.role = 'PLAYER' AND u.created_at >= b.start_ts AND u.created_at < b.end_ts) AS new_users,
    COUNT(*) FILTER (WHERE u.status = 'ACTIVE') AS active_users,
    COUNT(*) AS total_users
  FROM users u, bounds b
  WHERE u.deleted_at IS NULL
),
facility_kpis AS (
  SELECT
    COUNT(*) FILTER (WHERE f.status = 'ACTIVE')     AS active,
    COUNT(*) FILTER (WHERE f.status = 'SUSPENDED')  AS suspended,
    COUNT(*) FILTER (WHERE f.status = 'PENDING_APPROVAL') AS pending
  FROM facilities f
  WHERE f.deleted_at IS NULL
),
-- courts, bookings, revenue, tournaments, reports CTEs follow the same pattern
SELECT * FROM user_kpis, facility_kpis, ...;
```

- Range resolution (`start_ts`, `end_ts`) is computed in the service using `Asia/Ho_Chi_Minh`: "today" = calendar day; "this_month" = calendar month; "7d"/"30d" = rolling windows ending now (PRD #6).
- All period predicates use half-open intervals `[start, end)`.
- Aggregate queries only; no raw rows are returned to the service. See §10 for the required indexes.

**Charts.** A single grouped query with day buckets and `generate_series` to zero-fill:

```sql
SELECT gs.day,
       COALESCE(users.new_users, 0) AS new_users,
       COALESCE(bookings.new_bookings, 0) AS new_bookings
FROM generate_series(:start_day, :end_day, interval '1 day') AS gs(day)
LEFT JOIN (
  SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, COUNT(*) AS new_users
  FROM users
  WHERE role = 'PLAYER' AND deleted_at IS NULL
    AND created_at >= :start_ts AND created_at < :end_ts
  GROUP BY 1
) users ON users.day = gs.day
LEFT JOIN (
  SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, COUNT(*) AS new_bookings
  FROM bookings
  WHERE created_at >= :start_ts AND created_at < :end_ts
  GROUP BY 1
) bookings ON bookings.day = gs.day
ORDER BY gs.day;
```

**Activity feed.** A `UNION ALL` of the four sources, ordered newest-first, limited (default 10, max 20, per PRD #10):

```sql
SELECT 'BOOKING' AS type, id, created_at, ... FROM bookings
UNION ALL SELECT 'TOURNAMENT', id, created_at, ... FROM tournaments WHERE deleted_at IS NULL
UNION ALL SELECT 'REPORT', id, created_at, ... FROM reports
UNION ALL SELECT 'FACILITY', id, created_at, ... FROM facilities WHERE deleted_at IS NULL
ORDER BY created_at DESC, type, id
LIMIT :limit;
```

Each source selects only the minimal summary fields needed for display (no sensitive PII; PRD §12).

**Caching.** No server-side cache layer (no Redis; `tech-stack.md`). Response headers:

- `kpis` and `charts`: `Cache-Control: private, max-age=30, must-revalidate` — the browser may reuse a 30-second response; values remain explicitly refreshable.
- `recent-activities`: `Cache-Control: private, max-age=30, must-revalidate` (or `no-store` if the Admin prefers always-fresh activity).

This uses only HTTP caching and adds no infrastructure; the in-process TTL memo was not selected (Decision Log §21 #6).

### 7.4 Activity Feed Composition

- Sources and event labels: new booking (`BOOKING`), newly created tournament (`TOURNAMENT`), newly submitted report (`REPORT`), newly registered facility (`FACILITY`).
- Ordering: `created_at DESC`; deterministic tie-break by `(type, id)` (PRD #10).
- Bounded window: default 10, max 20; not offset-paginated (fixed feed).
- Items return a human-readable summary (e.g., "New booking on court #12 for 2026-10-01 18:00") and `occurredAt`; no Player contact details.

### 7.5 Frontend Architecture

- `DashboardLayout` — page shell (header, time-range selector, grid, footer), Admin route guard.
- `TimeRangeSelector` — emits `range` (`today` | `7d` | `30d` | `this_month`); drives all widgets.
- `MetricCard` — presentational KPI card (label, value, optional estimate marker), composed into a Bento grid grouped by domain.
- `GrowthChartWidget` — renders the daily new-users/new-bookings chart; fetches the charts endpoint.
- `RecentActivityTable` — composes the **shared** table component per `conventions.md` (do not fork); supplies feature columns/rows.
- `QuickActionLinks` — navigation shortcuts to User/Court/Report/Tournament management areas (uses the router; no data mutation).
- Feature data access stays behind a feature API client/hook; loading/empty/error/no-data states per widget.
- Chart rendering uses **native SVG/CSS**; no external charting dependency is added (Decision Log §21 #4; `tech-stack.md`).

## 8. Behavior, State, and Flow

```text
Admin opens dashboard
  → default range (e.g., 30d)
  → parallel fetch: KPIs, charts, recent activities
  → Admin changes range → all widgets refetch with the new range
  → Admin refreshes → refetch (manual; no auto-poll)
```

- Preconditions: authenticated `ADMIN`.
- No state transitions: the dashboard is read-only and stateless server-side.
- Postconditions: widgets show data for the selected range; estimates labeled; activity feed newest-first.

## 9. API Design

All paths under `/api/v1/admin/dashboard/`. Auth: `authenticate` + `requireRole('ADMIN')` on the entire router. Success `{ data: ... }`; errors `{ error: { code, message, details } }`. Timezone `Asia/Ho_Chi_Minh`.

### 9.1 GET `/api/v1/admin/dashboard/kpis`

- Query: `range` = `today` | `7d` | `30d` | `this_month` (default `30d`).
- Response `200`:

```json
{
  "data": {
    "range": "30d",
    "users": { "totalPlayers": 1240, "newUsers": 88, "activeUserRate": 0.93 },
    "facilities": { "totalFacilities": 42, "totalCourts": 190, "active": 38, "suspended": 3, "pendingApproval": 1 },
    "bookings": { "totalBookings": 530, "slotFillRate": 0.61 },
    "revenue": { "estimatedValue": "152300000.00", "currency": "VND", "isEstimate": true },
    "tournaments": { "inProgress": 4, "participants": 96 },
    "reports": { "unresolved": 7 }
  }
}
```

- Errors: `400 VALIDATION_FAILED` / `ADMIN_DASHBOARD_INVALID_RANGE`; `401 AUTH_SESSION_INVALID`; `403 AUTH_FORBIDDEN_ROLE`; `500 INTERNAL_ERROR`.

### 9.2 GET `/api/v1/admin/dashboard/charts`

- Query: `range` (same enum/default).
- Response `200`: `{ data: { range, series: { newUsers: [{ date, count }], newBookings: [{ date, count }] } } }`.
- Zero-filled days across the range; dates as `YYYY-MM-DD` in `Asia/Ho_Chi_Minh`.
- Errors: same as §9.1.

### 9.3 GET `/api/v1/admin/dashboard/recent-activities`

- Query: `limit` (integer 10–20, default 10).
- Response `200`:

```json
{
  "data": {
    "items": [
      { "type": "BOOKING", "occurredAt": "2026-09-27T10:15:00.000Z", "summary": "New booking on court #12", "targetId": 12 }
    ]
  }
}
```

- Errors: `400 VALIDATION_FAILED`; `401`; `403`; `500`.
- No offset pagination: fixed bounded feed (documented deviation per `conventions.md` pagination policy).

### 9.4 Feature Error Codes

| Code | HTTP | Use |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Global Zod failure at the boundary. |
| `ADMIN_DASHBOARD_INVALID_RANGE` | 400 | `range` value is not one of the allowed values. |
| `AUTH_SESSION_INVALID` | 401 | Missing/invalid session. |
| `AUTH_FORBIDDEN_ROLE` | 403 | Authenticated user is not `ADMIN`. |
| `INTERNAL_ERROR` | 500 | Unexpected error (global). |

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` remains authoritative. No new tables. The delta is **indexes** to make the aggregate queries efficient; the approved indexes are recorded in `database-schema.md` §5.14, and the migration that creates them must record its application in the schema Change Log.

Proposed indexes (all partial/among existing columns; no column changes):

| Index | Table / columns | Purpose |
| --- | --- | --- |
| `idx_users_role_status_created` | `USERS (role, status, created_at)` | user KPIs (replaces reliance on `(role, status, id)`) |
| `idx_facilities_status_created` | `FACILITIES (status, created_at)` | facility KPIs + feed |
| `idx_courts_facility_status` | `COURTS (facility_id, status)` | court counts (FK is not auto-indexed) |
| `idx_bookings_created` | `BOOKINGS (created_at)` | total bookings + charts |
| `idx_bookings_status_date` | `BOOKINGS (status, booking_date)` | slot fill rate |
| `idx_reports_status_created` | `REPORTS (status, created_at)` | unresolved KPI + feed |
| `idx_tournaments_status_created` | `TOURNAMENTS (status, created_at)` | in-progress + feed |
| `idx_registrations_status_registered` | `TOURNAMENT_REGISTRATIONS (status, registered_at)` | participant count |
| `idx_payments_paid_at` | `PAYMENTS (paid_at)` | estimated revenue |

Notes:

- `deleted_at IS NULL` predicates are used; optional partial indexes `WHERE deleted_at IS NULL` may be chosen in implementation.
- Index creation must not introduce a parallel schema definition; updates land in `database-schema.md` with the migration.
- Existing irrelevant indexes remain unchanged.

## 11. Security

- **Authentication:** shared `authenticate` middleware (opaque session cookie `sid`).
- **Authorization:** `requireRole('ADMIN')` on the entire dashboard router (correct variant/uppercase). Player/Court Owner are denied.
- **CSRF:** all dashboard endpoints are `GET`; no CSRF token required for reads (state-changing methods would require it).
- **Input validation:** Zod validates `range` and `limit` at the boundary.
- **Output minimization:** responses contain aggregate values and event summaries only; no Player/Court Owner PII, no raw records, no internal identifiers beyond the displayed target id.
- **Non-enumeration / no leakage:** centralized error handler; no SQL/stack traces.
- **Caching:** `Cache-Control: private` prevents shared-proxy caching of Admin-only data.

Dependency note: the `authenticate` middleware still contains a `[TEMP AUTH BYPASS]` (`backend/src/middleware/auth.middleware.ts`) and the Auth module is not implemented. Dashboard access requires a real `ADMIN` identity; API tests can use the middleware's test identity header with an `ADMIN` row.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Invalid/unknown `range` | Zod enum | `400 ADMIN_DASHBOARD_INVALID_RANGE` | Widgets keep previous data; show error. |
| `limit` outside 10–20 | Zod range | `400 VALIDATION_FAILED` | Client clamps/states the range. |
| No data in range | Aggregate returns 0 / empty series | Zeroed KPIs and zero-filled chart | "No data" state, not an error. |
| Activity feed empty | Union returns no rows | Empty-feel state | "No recent activity". |
| One widget's query fails | Error per-request | Other widgets still render | Per-widget error state. |
| Very large tables | Query planner | Indexed aggregates (§10) | Manual refresh; HTTP caching (§7.3). |
| Not authenticated / not Admin | Middleware | `401` / `403` | Redirect/denied. |

## 13. Concurrency / Idempotency

- The dashboard is **read-only**: no writes, no transactions, no idempotency key required.
- **Snapshot consistency:** the KPI statement reads all aggregate CTEs within a single statement, so values describe one consistent snapshot (default PostgreSQL `READ COMMITTED` per-statement snapshot). No cross-request coordination or in-memory state is used.
- Concurrent Admin requests are independent aggregates; caching (§7.3) reduces load without changing results materially.

## 14. Performance

- All KPI computations are database aggregates (`COUNT`/`SUM`/`FILTER`/`GROUP BY`) with **no raw-row loading**.
- Indexes in §10 support the predicates and groupings; `generate_series` zero-fills the chart without extra round-trips.
- The KPI endpoint performs one round-trip with CTEs; charts and activities perform one each.
- HTTP caching (§7.3) absorbs repeated refreshes; no new infrastructure.
- These are read-only analytics queries with bounded periods; no scaling infrastructure is introduced.

## 15. Events / Notifications

- Event/notification behavior: `N/A — the dashboard emits no events and adds no notifications`.
- Trigger and recipient: `N/A`.
- Delivery/retry implications: `N/A`.
- Background/scheduled processing: `N/A — no scheduler; refresh is on open/manual (PRD #12).`

## 16. Testing Considerations

- **Unit:** range resolution (today/7d/30d/this_month boundaries in `Asia/Ho_Chi_Minh`), KPI mapping to PRD definitions, fill-rate math, activity ordering/tie-break.
- **Integration/persistence:** aggregate queries against seeded data (zero/one/many rows); index usage sanity via `EXPLAIN`; zero-filled chart series; union dedup/order.
- **API-level:** `200` shapes; `400` for invalid `range`/`limit`; `401`/`403`; Cache-Control header presence; no PII in payloads.
- **Critical E2E flow:** an Admin logs in, sees KPIs, changes the range, opens recent activities, and navigates to Report Management.
- **Concurrency/idempotency:** N/A (read-only); repeated requests are stable.
- Framework: Vitest + Supertest against the separate test database (`docs/architecture/conventions.md`).

## 17. Migration / Rollout

- **Migration steps:** add the §10 indexes in a new Drizzle migration (`0007` or the next free number); run `db:migrate` on dev and test databases. The indexes are already recorded in `database-schema.md` §5.14; record the migration application in the schema Change Log in the same session.
- **Rollout sequencing:** indexes first; then the repository/service/endpoints; then the frontend.
- **Backward compatibility:** additive indexes only; no column/table changes; existing behavior unaffected.
- **Rollback/recovery:** drop the added indexes; no data impact.

## 18. Alternatives Considered

- **Materialized views / pre-aggregation:** rejected for MVP (adds refresh/scheduling complexity and a second source of truth) while data volumes allow indexed aggregates.
- **Loading raw rows and aggregating in Node:** rejected per the requirement and `conventions.md`; aggregates belong in SQL.
- **Redis / external cache:** rejected; not approved in `tech-stack.md`. HTTP caching used instead.
- **A dedicated platform event table for the activity feed:** rejected for MVP (PRD #10 chose a derived union).
- **Adding a charting library immediately:** rejected; charts use native SVG/CSS and no external dependency is added (Decision Log §21 #4).

## 19. Observability / Monitoring

- Logs: `info` for dashboard requests at a coarse level (range, latency); never log PII. Log slow aggregate queries at `warn`.
- Metrics: `N/A — no approved metrics infrastructure`.
- Alerts/operational signals: `N/A`.

## 20. Acceptance / Verification Considerations

- **Given** an authenticated `ADMIN`
  **When** they request `GET /api/v1/admin/dashboard/kpis?range=30d`
  **Then** the response contains all KPI groups with values matching the PRD definitions and `Asia/Ho_Chi_Minh` period boundaries.

- **Given** a non-`ADMIN` authenticated user or an unauthenticated caller
  **When** they call any dashboard endpoint
  **Then** the request is rejected with `403 AUTH_FORBIDDEN_ROLE` or `401 AUTH_SESSION_INVALID`.

- **Given** `range=all_time` (invalid)
  **When** the KPIs endpoint is called
  **Then** the response is `400 ADMIN_DASHBOARD_INVALID_RANGE`.

- **Given** data exists across several days
  **When** the charts endpoint is called for `7d`
  **Then** the series covers exactly the 7 day buckets in `Asia/Ho_Chi_Minh`, with zero-filled days and accurate counts.

- **Given** bookings, tournaments, reports, and facilities exist
  **When** the recent-activities endpoint is called with `limit=10`
  **Then** up to 10 items are returned newest-first across the four types, with no PII.

- **Given** the KPI table has many rows
  **When** the endpoint is queried
  **Then** no raw records are loaded by the service (aggregate-only) and the response includes `Cache-Control: private, max-age=30`.

- **Given** a signed-in Admin
  **When** they use a quick navigation shortcut
  **Then** they are routed to the corresponding management area without any data mutation on the dashboard.

## 21. Decision Log

All decisions were resolved by the human owner on 2026-09-27, and the Tech Design was marked `Ready`.

| # | Question or decision | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `requireRole(['admin'])` casing/signature. | Tech Lead | Use `requireRole('ADMIN')` (variadic, uppercase). | 2026-09-27 | RESOLVED |
| 2 | Cited schema sections were incorrect. | Authoritative schema | Use `TOURNAMENTS` §3.17 and `REPORTS` §3.25. | 2026-09-27 | RESOLVED |
| 3 | Existing `created_at`/`status` index assumption was incorrect. | Human owner + Tech Lead | Approve the nine §10 indexes; update `database-schema.md` with the migration. | 2026-09-27 | RESOLVED |
| 4 | Charting approach (no approved library). | Human owner + Tech Lead | Render charts with native SVG/CSS; add no external dependency. | 2026-09-27 | RESOLVED |
| 5 | Slot fill rate period basis. | Human owner | Measure booked slot-hours by play date (`booking_date`). | 2026-09-27 | RESOLVED |
| 6 | Server-side cache. | Human owner | HTTP `Cache-Control` only; no in-process TTL memo. | 2026-09-27 | RESOLVED |
| 7 | Available-hours denominator for fill rate. | Human owner | Opening hours × `ACTIVE` courts × days in range. | 2026-09-27 | RESOLVED |
| 8 | `tournaments.participants` scope. | Human owner | Period-scoped: distinct players in `CONFIRMED` registrations with `registered_at` in range. | 2026-09-27 | RESOLVED |
| 9 | Recent-activities caching. | Human owner | Cache like the other endpoints (`private, max-age=30, must-revalidate`). | 2026-09-27 | RESOLVED |

No open questions remain. The index delta (§10) is recorded in `database-schema.md` §5.14; the migration that creates the indexes must record its application in the schema Change Log.

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the human owner on 2026-09-27
Approved decision/reference: §21 Decision Log (2026-09-27)
```

This template does not create a new approval workflow. It follows the human readiness gate in `docs/documentation-guide.md`.
