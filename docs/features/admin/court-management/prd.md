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
- Task or issue: TBD

## 1. Problem
Admins need oversight over the facilities and courts registered on the platform to ensure quality, enforce compliance, and handle cases where a facility violates platform terms.

## 2. Goals
- Enable Admins to view all registered facilities and courts.
- Enable Admins to moderate facilities/courts (e.g., change status, deactivate).

## 3. Non-Goals
- Court Rating administration (out of MVP).
- Advanced facility analytics.
- Payment settlement administration.
- Approval workflow for new facilities (unless required by future business rules).

## 4. Scope

### In Scope
- View list of facilities and their associated courts.
- Update facility or court status.
- Deactivate facilities or courts.

### Out of Scope
- Independent Refund Management for facility-canceled bookings.
- Court Rating administration.

## 5. Target Users and Roles
- Admin: Manages the facilities.
- Court Owner: Owner of the facilities being managed.

## 6. User Journey
1. Admin navigates to Court Management in the Admin portal.
2. Admin views a list of all facilities.
3. Admin selects a facility to view its details and courts.
4. Admin changes the facility's status to suspended due to a violation.
5. The facility status is updated. A suspended facility and its courts are unavailable for new bookings; existing bookings are not automatically cancelled or changed.

## 7. Functional Requirements
- The system MUST allow an Admin to view a list of all facilities and courts.
- The system MUST allow an Admin to update the status of a facility.
- The system MUST allow an Admin to update the status of a court.
- The system MUST allow an Admin to deactivate a facility or court.

## 8. Business Rules
- Source reference: `PROJECT-BRIEF.md` §4; `docs/business-rules-config-matrix.md` §2.4
- Feature rule: Only the `ADMIN` role can access this capability.
- Feature rule: Facility and Court statuses are `ACTIVE` or `SUSPENDED`.
- Feature rule: Suspending or deactivating a Facility also deactivates its Courts for new availability; existing Bookings are not automatically cancelled or changed.
- Feature rule: Deactivation is not reversible in the MVP Admin flow.

## 9. UI/UX Behavior
- Entry points: Admin portal navigation.
- Important states: Data table, detail view for facility. Confirmation dialogue for destructive actions.
- User feedback: In-product confirmation and error feedback after a state change.

## 10. Success Metrics
- N/A — no product metric is required for this scope.

## 11. Constraints
- Must preserve the real-time Booking flow and the owner-cancellation notification/refund rules.
- Suspending or deactivating a Facility/Court must not mutate existing Bookings; owner-side cancellation and refund rules remain governed by the Booking feature.

## 12. Risks
- Suspending a facility with active bookings.
- Mitigation: Warn Admins that existing Bookings remain unchanged; require explicit confirmation and do not perform automatic cancellation or refund.

## 13. Dependencies
- Admin Authentication.

## 14. Decisions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| What happens to active Bookings when an Admin suspends a Facility? | Product | High | DECIDED: Existing Bookings remain unchanged; no automatic cancellation or refund is initiated. |
| Are there specific facility statuses (e.g., ACTIVE, SUSPENDED) to support? | Product | Medium | DECIDED: `ACTIVE` and `SUSPENDED`. |
| Should deactivating a Facility also deactivate its Courts? | Product | High | DECIDED: Yes, for new availability; existing Bookings remain unchanged. |
| Is deactivation reversible in the MVP Admin flow? | Product | Medium | DECIDED: No restore operation in this MVP flow. |
