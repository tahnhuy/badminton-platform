# Product Requirements Document (PRD) - Admin Dashboard (Trang tổng quan thống kê và điều hành nền tảng)

## Status and Ownership

```text
Status: Ready
Owner: PM / Platform Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin Operations Overview Dashboard — read-only KPI cards, growth trend charts, a recent platform activity feed, and quick navigation shortcuts to Admin management areas
```

This PRD was approved as `Ready` by the human owner on 2026-09-27 after all Open Questions in §14 were resolved (see §14 Decision Log). It defines product behavior and business rules only. It does not define API contracts, database schema, queries, or implementation structure.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md` §4 (Admin), §5 (Out of MVP), §6 (MVP Focus)
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.1 (System Roles), §2.2 (MVP Domains), §5.2 (PRD ownership)
- Applicable business rules/config: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §2 (Court Booking), §4 (Tournament), §7 (Reports), §8.2 (Booking Configuration), §8.4 (Tournament Configuration), §8.5 (Team Configuration), §8.6 (Report Configuration)
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §3.1 `USERS`, §3.3 `PLAYER_PROFILES`, §3.4 `COURT_OWNER_PROFILES`, §3.5 `FACILITIES`, §3.6 `COURTS`, §3.8 `BOOKINGS`, §3.10 `PAYMENTS`, §3.17 `TOURNAMENTS`, §3.21 `TOURNAMENT_REGISTRATIONS`, §3.25 `REPORTS`
- Related Admin feature PRDs: `docs/features/admin/user-management/prd.md`, `docs/features/admin/court-management/prd.md`, `docs/features/admin/report-management/prd.md`

## Related Documents

- Parent or related PRD:
  - [User Management PRD](../user-management/prd.md) — user/platform KPI source and navigation target
  - [Court Management PRD](../court-management/prd.md) — facility/court KPI source and navigation target
  - [Report Management PRD](../report-management/prd.md) — unresolved-report KPI source and navigation target
  - [Player Booking PRD](../../booking/player-booking/prd.md) — booking KPI source
  - [Tournament PRD](../../tournament/prd.md) — tournament KPI source
  - [Payments & Refunds PRD](../../platform/payments-refunds/prd.md) — estimated transaction value source
- Tech Design: `TBD — required before implementation`
- Task or issue: `TBD`

## 1. Problem

- **Who is affected:** Admins responsible for platform operations and compliance.
- **What is difficult or unavailable today:** There is no single operational view of the ecosystem. Admins must open each management area (users, facilities, reports, tournaments) separately to understand platform health, and there is no consolidated indication of growth, booking activity, or pending work. This slows operational decisions and makes it easy to miss items needing intervention (for example, unresolved reports).
- **Why it matters within MVP:** Admin manages users, Court Owners, facilities, tournaments, reports/violations, and a high-level statistics dashboard (`PROJECT-BRIEF.md` §4). A consolidated overview is the entry point that makes those management capabilities usable as a coherent operations console within the MVP.

## 2. Goals

- An Admin can see the current operational state of the platform in one screen, across users, facilities/courts, bookings/revenue, tournaments, and reports.
- An Admin can view metrics over a selected time range (Today, last 7 days, last 30 days, this month).
- An Admin can view growth trends and a recent platform activity feed.
- An Admin can navigate quickly from the overview to the relevant Admin management area.
- The dashboard is read-only: it presents statistics and navigation and does not mutate business data.

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- A dedicated Business Intelligence / OLAP / data-warehouse analytics platform, ad-hoc querying, or custom report building (`PROJECT-BRIEF.md` §5; this is a fixed overview, not a BI suite).
- Editing or acting on business data directly from a dashboard widget (the dashboard is display + navigation only; actions happen in the owning management area).
- Multi-tier Admin / advanced RBAC / Super Admin (`PROJECT-BRIEF.md` §5).
- Any new system role (`PROJECT-BRIEF.md` §2).
- Financial settlement, payout, or accounting-grade revenue reporting; the dashboard shows an **estimated** transaction value only.
- Real-time streaming analytics; refresh follows the platform's confirmed polling approach (`docs/architecture/tech-stack.md`).
- Drill-down analytics beyond the defined KPI cards, trend charts, and activity feed.

## 4. Scope

### In Scope

- KPI cards for:
  - **Users:** total players, new users in the selected period, active-user rate.
  - **Facilities & Courts:** total facilities/courts, active (`ACTIVE`) versus suspended (`SUSPENDED`) facilities.
  - **Bookings & Revenue:** total bookings, slot fill rate, estimated transaction value.
  - **Tournaments:** tournaments currently in progress, participant count.
  - **Reports:** unresolved violation reports.
- A time-range filter: Today, last 7 days, last 30 days, this month.
- Growth trend chart(s) over the selected period.
- A recent platform activity feed (new booking, newly created tournament, newly submitted report, newly registered facility).
- Quick navigation shortcuts from the overview to Admin management areas.
- Read-only behavior with loading, empty, error, and no-data states.

### Out of Scope

- All items in §3 Non-Goals.
- Configurable dashboards, user-defined widgets, saved views, or scheduled exports.
- Mutating data (approve/suspend/cancel/resolve) from the dashboard.
- Per-entity drill-down pages beyond navigating to the existing management areas.
- Analytics for operational areas not listed above.

## 5. Target Users and Roles

- **Admin:** the only actor. Uses the dashboard to monitor the ecosystem, watch alerts, and decide where to act, then navigates to the relevant management area.
- **Player:** `N/A` — no access to the dashboard.
- **Court Owner:** `N/A` — no access to the dashboard.
- **Contextual permission:** `N/A — the dashboard is restricted to the ADMIN system role; it does not involve Tournament Organizer or any contextual permission.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

1. An Admin signs in and lands on (or navigates to) the platform overview dashboard.
2. The system shows the KPI cards, trend chart(s), recent activity feed, and navigation shortcuts for the default period.
3. The Admin changes the time-range filter (Today, 7 days, 30 days, this month); the cards and charts update to that period.
4. The Admin reviews KPIs and identifies an area needing attention (for example, unresolved reports).
5. The Admin uses a quick navigation shortcut to open the relevant management area (Reports, Users, Courts, Tournaments) to act.
6. The Admin returns to the dashboard; the overview reflects the latest data on the next refresh.

## 7. Functional Requirements

- The system can let only an authenticated `ADMIN` access the overview dashboard; all other roles are denied.
- The system can display a **Users** KPI group: total players, new users within the selected period, and active-user rate.
- The system can display a **Facilities & Courts** KPI group: total facilities, total courts, and the count of facilities by operational status (`ACTIVE` versus `SUSPENDED`).
- The system can display a **Pending Approvals** KPI: the number of owner-submitted facilities/courts awaiting Admin approval (`PENDING_APPROVAL`).
- The system can display a **Bookings & Revenue** KPI group: total bookings within the period, slot fill rate, and estimated transaction value.
- The system can display a **Tournaments** KPI group: tournaments currently in progress and participant count.
- The system can display a **Reports** KPI: the number of unresolved violation reports (status `OPEN`).
- The system can provide a time-range filter (Today, last 7 days, last 30 days, this month) that applies to the period-scoped KPIs and charts.
- The system can display growth trend chart(s) for the selected period.
- The system can display a recent platform activity feed containing notable events: new booking, newly created tournament, newly submitted report, and newly registered facility, ordered newest first.
- The system can provide quick navigation shortcuts from the dashboard to the relevant Admin management areas.
- The system is read-only: no dashboard interaction creates, updates, or deletes business data.
- The system shows clear loading, empty, error, and no-data states and does not display stale values as if current.
- Values that are estimates are labeled as estimates.
- All metric and period definitions are fixed by the §14 Decision Log (active-user rate, total bookings, slot fill rate, estimated transaction value, participant count, activity feed, chart series, and refresh cadence).

## 8. Business Rules

- Source reference: `PROJECT-BRIEF.md` §4; `docs/business-rules-config-matrix.md` §7, §8.2, §8.4, §8.6; `docs/architecture/database-schema.md` §3.1, §3.5, §3.8, §3.10, §3.17, §3.21, §3.25.
- **Access restriction.** Only accounts with the `ADMIN` system role may access the dashboard; Player and Court Owner roles are denied (`PROJECT-BRIEF.md` §2, §4).
- **Read-only.** The dashboard displays statistics and navigation only; it does not mutate business data. Any action is performed in the owning management area.
- **Admin does not play.** The dashboard is an operations view for Admin and does not involve Player/Court Owner business actions (`PROJECT-BRIEF.md` §4).
- **Report KPI uses the documented report lifecycle.** The Report Management feature defines the report lifecycle as `OPEN → RESOLVED` (terminal), where `OPEN` means unresolved (`docs/features/admin/report-management/prd.md`). The dashboard counts **unresolved** reports using the documented `OPEN` status; the request's use of `PENDING` is treated as a synonym and the dashboard label reads "Unresolved/Open" (Decision Log §14 #1).
- **User KPI scope.** Total players and new users count only non-soft-deleted `PLAYER` accounts; new users are those created within the selected period (Decision Log §14 #11). The active-user rate is the share of users with `status = ACTIVE` over total non-soft-deleted users at view time (Decision Log §14 #2).
- **Facility status vocabulary and pending approvals.** Facility operational statuses in the Admin Court Management feature are `ACTIVE` and `SUSPENDED` (`docs/features/admin/court-management/prd.md`). Owner-submitted facilities/courts use `PENDING_APPROVAL`/`REJECTED` (`docs/features/court-owner/prd.md`); the dashboard surfaces `PENDING_APPROVAL` as a separate "Pending Approvals" KPI and keeps `ACTIVE`/`SUSPENDED` counts unchanged (Decision Log §14 #8).
- **Booking KPIs.** "Total bookings" counts all bookings created within the selected period regardless of status. "Slot fill rate" is booked slot-hours ÷ available slot-hours for `ACTIVE` courts in the period, counting only `CONFIRMED`, `IN_PROGRESS`, and `COMPLETED` bookings (Decision Log §14 #3, #4).
- **Tournament participant count.** Participant count is the number of distinct players in `CONFIRMED` tournament registrations (in Doubles, both team members are counted) (Decision Log §14 #9).
- **Estimated transaction value is an estimate, not settlement.** It is the gross sum of successful payments (booking and tournament registration) within the period, before refunds, and is labeled as an estimate; it is not an accounting or payout figure (`docs/business-rules-config-matrix.md` §2.8) (Decision Log §14 #5).
- **Period semantics are business-timezone based.** Period boundaries use the platform business timezone (`Asia/Ho_Chi_Minh`). "Today" is the calendar day and "This month" is the calendar month; "last 7 days" and "last 30 days" are rolling windows ending at the current time (Decision Log §14 #6).
- **Data freshness.** The dashboard loads on open and refreshes by an explicit manual refresh action; it does not auto-poll and does not present cached values as real time. There is no real-time streaming analytics in scope (`docs/architecture/tech-stack.md`) (Decision Log §14 #12).
- **No configuration dependency required.** The dashboard is read-only and does not change configuration; it may read existing `SYSTEM_CONFIGS` where a metric depends on a gate.
- **No new roles or permissions.** Multi-tier RBAC/Super Admin is out of scope (`PROJECT-BRIEF.md` §5).

## 9. UI/UX Behavior

- Entry points: the Admin portal navigation, with the overview dashboard as the landing/overview screen.
- Layout: KPI "bento" cards grouped by domain (Users, Facilities & Courts, Bookings & Revenue, Tournaments, Reports), a time-range filter, trend chart(s), a recent activity feed, and quick navigation shortcuts.
- Important states:
  - Loading (initial load and on filter change): show loading/placeholder states, not stale values.
  - Empty / no-data (no events or no data in the selected period).
  - Error (a KPI group or the feed fails to load; other groups remain usable).
  - Partial (some metrics unavailable; indicate which).
  - Success (all data loaded for the selected period).
- User feedback:
  - Clear indication of the active time-range filter.
  - Estimates labeled as estimates.
  - Activity feed ordered newest first with a human-readable event description.
  - Navigation shortcuts clearly labeled and leading to the relevant management area.
  - No exposure of implementation errors or sensitive details.
- Content requirements: KPI value + label + (where applicable) the period and estimate marker; activity events with type, target summary, and time; shortcuts with the destination area name.
- Accessibility or content requirements: `N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.`

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP):
  - Dashboard usage by Admins.
  - Time from sign-in to reaching a management area via the dashboard.
  - Share of unresolved reports reviewed after appearing on the dashboard.
- Numeric targets are `TBD — product metric target needs decision`; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve the three system roles and restrict access to `ADMIN` only; no new role is introduced (`PROJECT-BRIEF.md` §2; `docs/documentation-guide.md` §2.1).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including a dedicated BI/analytics platform and multi-tier RBAC/Super Admin.
- Must be read-only and must not duplicate or move business logic out of the owning management areas.
- Must derive statistics from existing platform data; it must not create a parallel source of truth for operational entities.
- Notifications/refresh follow confirmed platform mechanisms; no real-time streaming analytics (`docs/architecture/tech-stack.md`).
- Must not define API contracts, database fields, queries, or implementation structure in this PRD.
- Metric definitions that affect displayed numbers must be decided before dependent implementation (§14).

## 12. Risks

- Risk: Ambiguous metric definitions (active-user rate, fill rate, estimated revenue) lead to inconsistent or misleading numbers.
  Mitigation: resolve the definitions in §14 before implementation and label estimates.
- Risk: Aggregate queries over many tables degrade dashboard performance.
  Mitigation: a Tech Design concern; scope reads to the selected period and avoid loading raw records where an aggregate suffices.
- Risk: Admins treat estimated transaction value as accounting-grade revenue.
  Mitigation: label values as estimates and avoid settlement/payout claims.
- Risk: The recent activity feed is derived from multiple tables with no dedicated event log, producing duplicate or inconsistent events.
  Mitigation: use the approved derived-union composition (newest-first, top 10) from `BOOKINGS`, `TOURNAMENTS`, `REPORTS`, and `FACILITIES` created timestamps (Decision Log §14 #10).
- Risk: The report KPI is misnamed (`PENDING` vs `OPEN`) and counts the wrong state.
  Mitigation: count the documented `OPEN` status with an "Unresolved/Open" label (Decision Log §14 #1).
- Risk: Data appears real-time but is stale, leading to wrong operational decisions.
  Mitigation: show the last refresh/label data freshness and avoid presenting cached values as current.
- Risk: Excessive Player/Court Owner personal data appears in the activity feed or KPIs.
  Mitigation: show only the minimum needed for an operational summary; the feed shows event summaries, not sensitive PII.

## 13. Dependencies

- Admin authentication and the `ADMIN` role (`docs/features/platform/authentication-authorization/prd.md`).
- Admin User Management, for user KPIs and navigation (`docs/features/admin/user-management/prd.md`).
- Admin Court Management, for facility/court KPIs and navigation (`docs/features/admin/court-management/prd.md`).
- Admin Report Management, for the unresolved-report KPI and navigation (`docs/features/admin/report-management/prd.md`).
- Player Booking flow and `BOOKINGS` data, for booking KPIs (`docs/features/booking/player-booking/prd.md`).
- Payments and refunds capability, for estimated transaction value (`docs/features/platform/payments-refunds/prd.md`).
- Tournament flow and `TOURNAMENTS`/`TOURNAMENT_REGISTRATIONS` data (`docs/features/tournament/prd.md`).
- System configuration values where a metric depends on a gate (`docs/business-rules-config-matrix.md` §8.2, §8.4, §8.6).

## 14. Decision Log

All Open Questions were resolved by the human owner on 2026-09-27, and the PRD was marked `Ready`.

| # | Question or unresolved behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Report KPI naming (`PENDING` vs documented `OPEN`). | Human owner | Count unresolved reports using the documented `OPEN` status; label the KPI "Unresolved/Open". No change to Report Management. | 2026-09-27 | RESOLVED |
| 2 | Definition of active-user rate. | Human owner | Share of users with `status = ACTIVE` over total non-soft-deleted users at view time. | 2026-09-27 | RESOLVED |
| 3 | Definition of total bookings for the period. | Human owner | All bookings created within the period, regardless of status. | 2026-09-27 | RESOLVED |
| 4 | Definition of slot fill rate. | Human owner | Booked slot-hours ÷ available slot-hours for `ACTIVE` courts, counting only `CONFIRMED`/`IN_PROGRESS`/`COMPLETED` bookings. | 2026-09-27 | RESOLVED |
| 5 | Definition of estimated transaction value. | Human owner | Gross sum of successful payments (booking + tournament registration) in the period, before refunds; labeled as an estimate. | 2026-09-27 | RESOLVED |
| 6 | Time-range boundary semantics and timezone. | Human owner | `Asia/Ho_Chi_Minh`; "Today" = calendar day and "This month" = calendar month; 7/30 days = rolling windows ending now. | 2026-09-27 | RESOLVED |
| 7 | Growth trend chart series and granularity. | Human owner | One daily trend chart with new users and new bookings over the selected period. | 2026-09-27 | RESOLVED |
| 8 | Display of owner-submitted `PENDING_APPROVAL` facilities/courts. | Human owner | Surface a separate "Pending Approvals" KPI; keep `ACTIVE`/`SUSPENDED` counts unchanged. | 2026-09-27 | RESOLVED |
| 9 | Tournament participant count definition. | Human owner | Distinct players in `CONFIRMED` registrations (both Doubles members counted). | 2026-09-27 | RESOLVED |
| 10 | Recent activity feed composition and data source. | Human owner | Derived union of newest-first events (top 10) from `BOOKINGS`, `TOURNAMENTS`, `REPORTS`, and `FACILITIES` created timestamps; no dedicated event table. | 2026-09-27 | RESOLVED |
| 11 | User KPI scope regarding soft-deleted/suspended users. | Human owner | Total players and new users count only non-soft-deleted `PLAYER` accounts; new users are those created within the period. | 2026-09-27 | RESOLVED |
| 12 | Dashboard refresh cadence. | Human owner | Refresh on open plus a manual refresh action; no automatic polling. | 2026-09-27 | RESOLVED |

No Open Questions remain. The KPI aggregation queries, activity-feed composition details (event ordering within a timestamp, item rendering), and the client contract are Tech Design items, not product Open Questions.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.
