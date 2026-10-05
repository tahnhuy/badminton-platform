# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Ready
Owner: Platform Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin Court Management
```

## Authoritative References
- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`
- Database Schema reference: `docs/architecture/database-schema.md` §3.5, §3.6

## Related Documents
- Tech Design: `docs/features/admin/court-management/tech-design.md`
- Tasks: `docs/features/admin/court-management/tasks/`
- Design Reference: Figma Screen A04 (`Badminton SmashPro` / `Facility / Court Management List`)

## 1. Problem
Platform administrators need comprehensive oversight and operational control over all registered badminton facilities and courts across the ecosystem. This ensures facilities meet safety and BWF standards, helps track platform growth, and allows enforcement of platform policies through suspension or deactivation when violations occur.

## 2. Goals
- Enable Admins to view all registered facilities and courts with rich metadata (court scale and owner contact).
- Provide high-level operational KPI summary cards backed by stored data (Total facilities, Total courts, Active facilities, Suspended facilities).
- Provide multi-dimensional search and filtering (keyword, city/region, operational status, and sorting).
- Enable Admins to export facility lists to Excel for auditing and reporting.
- Enable Admins to moderate facility and court operational statuses (`ACTIVE` vs. `SUSPENDED`) and re-evaluate / reactivate eligible facilities.
- Enable Admins to deactivate facilities or courts (with atomic cascade to child courts).

## 3. Non-Goals
- Dedicated business intelligence (BI) or complex financial analytics suite (summary KPI cards provide snapshot statistics only).
- Independent refund management for facility cancellations (handled by the Booking feature).
- Direct court rating administration.
- A general facility/court operational status state machine beyond the Owner-submission approval review (operational status transitions remain strictly `ACTIVE ↔ SUSPENDED`; a Court Owner may submit new facilities/courts for Admin approval — see §4 and §14).

## 4. Scope

### In Scope
- **Operational KPI Cards**: Total facilities count (with distinct city coverage), total courts count, active facilities count, and suspended facilities count. No fabricated or estimated metrics (no floor/surface breakdown, no growth estimate, no selling-rate estimate).
- **Search & Filters Toolbar**: Quick search by club name, owner name, address, or facility code (`#FAC-...`), city/region dropdown, operational status dropdown, and court-count sorting.
- **Data Table View**: Facility rows including thumbnail, facility code, owner contact, court scale, and operational status.
- **Facility Moderation Actions**:
  - Suspend facility (`SUSPENDED`) due to safety or policy violation.
  - Re-evaluate / Reactivate facility (`ACTIVE`) upon compliance verification.
  - Deactivate facility (soft-delete with cascade to courts).
- **Facility Onboarding**: Create a new facility with owner contact and initial court scale.
- **Owner Submission Review**: Review and approve or reject facilities/courts submitted by a Court Owner; an approved submission becomes active/bookable, a rejected submission does not.
- **Compliance Policy Banner**: Visual SLA guidelines highlighting the implications of suspension on Player booking availability.
- **Excel Export**: Download current or filtered facility dataset to Excel.

### Out of Scope
- Mutating or auto-cancelling active booking transactions when an Admin suspends a facility.
- Modifying payment gateway settlements.

## 5. Target Users and Roles
- **Admin**: System administrator responsible for ecosystem compliance and facility moderation.
- **Court Owner**: Registered owner of the facility; may submit new facilities/courts for Admin approval (read-only target otherwise).

## 6. User Journey
1. Admin navigates to **Quản lý cơ sở & sân** (`/admin/courts`) in the Admin portal.
2. Admin reviews top KPI cards for system-wide capacity and compliance metrics.
3. Admin filters facilities by region (e.g., TP. Hồ Chí Minh) and status (e.g., Suspended).
4. Admin reviews facility row details (court scale, operational status, owner contact info).
5. For a facility violating rules (e.g., PCCC expired or dispute), Admin suspends the facility (`SUSPENDED`).
6. For a suspended facility that has resolved its violation, Admin clicks **Thẩm định lại** (Re-evaluate) to reactivate it (`ACTIVE`).
7. Admin exports the filtered facility report to Excel.

## 7. Functional Requirements
- The system MUST allow an Admin to view a paginated list of all facilities with operational metrics.
- The system MUST return snapshot summary metrics (total facilities, total courts, active facilities, suspended facilities) with the list response.
- The system MUST support search by keyword (name, owner, address, facility code) and filtering by city, status, and court count sort.
- The system MUST allow an Admin to update facility status between `ACTIVE` and `SUSPENDED`.
- The system MUST allow an Admin to create a new facility with its owner contact and initial courts.
- The system MUST allow an Admin to approve or reject a facility/court submitted by a Court Owner. Approval moves the submission to `ACTIVE` and makes it bookable; rejection moves it to `REJECTED` and it stays non-bookable.
- The system MUST allow an Admin to update individual court status between `ACTIVE` and `SUSPENDED`.
- The system MUST allow an Admin to deactivate a facility and all its associated courts atomically.
- The system MUST allow exporting facility data to Excel.

## 8. Business Rules
- Source reference: `PROJECT-BRIEF.md` §4; `docs/business-rules-config-matrix.md` §2.4
- **Role Authorization**: Only users with the `ADMIN` role can access Admin facility endpoints and UI.
- **Status Vocabulary**: Facility and Court status values are `ACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`, and `REJECTED`. Only `ACTIVE` is bookable. A Court Owner submission is created as `PENDING_APPROVAL`; Admin approval moves it to `ACTIVE` and rejection moves it to `REJECTED`. `ACTIVE ↔ SUSPENDED` is the operational transition; `PENDING_APPROVAL`/`REJECTED` are onboarding-only states.
- **Suspension SLA Policy**:
  - Setting a facility to `SUSPENDED` prevents new booking slot creation/sales on player apps (`P06/P07`).
  - Existing confirmed bookings are NOT automatically cancelled or refunded; they remain held unless an incident is approved.
  - Suspending a facility preserves individual court statuses; child courts inherit ineligibility for new bookings during facility suspension.
- **Reactivation / Re-evaluation**:
  - Reactivating a facility (`ACTIVE`) restores booking availability for all its non-suspended child courts.
- **Deactivation**:
  - Deactivation (`deleted_at`) is atomic across a facility and all its child courts.
  - Deactivation is irreversible in the MVP flow.
  - Deactivated records remain visible to Admins with clear deactivation markers.
- **Owner-submitted onboarding**:
  - A facility/court created by a Court Owner is created as `PENDING_APPROVAL` and is not active/bookable until an Admin approves it.
  - The Admin may approve (`ACTIVE`) or reject (`REJECTED`) a submission; a rejected facility/court does not become bookable.
  - Deactivation (`deleted_at`) and operational suspension remain distinct from the onboarding states.
  - The Owner-submission approval review is separate from owner-side maintenance slot locking, which is owned by `docs/features/court-owner/prd.md`.

## 9. UI/UX Behavior
- **Layout & Structure**: Follows Figma Screen A04 standard layout (Sidebar, Admin Header with live status, Page Header with CTAs, 4 Bento Metric Cards, Filters Toolbar, 7-Column Data Table, Pagination, and Compliance Note Banner).
- **Confirmation Modals**:
  - Suspending a facility requires selecting/verifying reason and explicit confirmation.
  - Reactivating / Re-evaluating requires confirmation.
  - Deactivation requires a high-friction confirmation dialog.
- **Feedback**: Immediate toast notifications upon status change, deactivation, or export completion.

## 10. Success Metrics
- N/A — no product metric is required for this internal admin scope.

## 11. Constraints
- Must preserve real-time booking rules and frozen database schema invariants.
- No direct mutation of existing booking records during admin status changes.

## 12. Risks & Mitigations
- **Risk**: Suspending a facility with active customer bookings causing dispute.
- **Mitigation**: Warn Admins explicitly in the confirmation modal that active bookings remain unchanged according to platform SLA policy.

## 13. Dependencies
- Platform Admin Authentication & Authorization.

## 14. Decisions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| What happens to active Bookings when an Admin suspends a Facility? | Product | High | DECIDED: Existing Bookings remain unchanged; no automatic cancellation or refund is initiated. |
| Are there specific facility statuses to support? | Product | Medium | DECIDED: `ACTIVE` and `SUSPENDED`. |
| Should deactivating a Facility also deactivate its Courts? | Product | High | DECIDED: Yes, for new availability; existing Bookings remain unchanged. |
| Is deactivation reversible in the MVP Admin flow? | Product | Medium | DECIDED: No restore operation in this MVP flow. |
| How are facilities/courts created by Court Owners handled? | Product | Medium | DECIDED: A Court Owner may submit facilities/courts, but they require Admin approval before becoming active/bookable (source: `docs/features/court-owner/prd.md` §14 #2, 2026-09-27). |
| Are KPI cards and filters included in Admin Court Management? | Product / Design | Medium | DECIDED: Yes, matching Figma Screen A04 specifications. |

