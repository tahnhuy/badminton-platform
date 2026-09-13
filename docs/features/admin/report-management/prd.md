# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Draft
Owner: Platform Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin Report Management
```

## Authoritative References
- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md` §7
- Database Schema reference: `docs/architecture/database-schema.md` §3.25

## Related Documents
- Tech Design: TBD
- Task or issue: TBD

## 1. Problem
Users can report Players, Facilities, and Tournaments for violations, but there is no interface for Admins to review and manage these reports, leaving issues unaddressed.

## 2. Goals
- Provide an interface for Admins to view all user-submitted reports.
- Enable Admins to review reports and apply the report-management behavior approved by Product.

## 3. Non-Goals
- Automated report resolution (e.g., auto-banning based on report thresholds).
- Implementing a separate system for user appeals within the MVP.

## 4. Scope

### In Scope
- View list of reports.
- Filter reports by target type (Player, Facility, Tournament) and by status when defined by the approved report policy.
- Review the report's current state and target.
- Update report state only according to the approved report-resolution policy.

### Out of Scope
- Automated moderation workflows.
- Granular moderation tracking beyond the report's status.

## 5. Target Users and Roles
- Admin: Reviews reports and applies approved report-management actions.
- Player: Submits reports or is the target.
- Court Owner: Owner of reported facilities.

## 6. User Journey
1. Admin navigates to Report Management.
2. Admin selects a report requiring review.
3. Admin views the details, reason code, and the reported target.
4. Admin reviews the report and, where applicable, uses the relevant moderation capability.
5. Admin applies the approved report-resolution action, if one exists.

## 7. Functional Requirements
- The system MUST allow an Admin to view a list of reports.
- The system MUST display the target of the report (Player, Facility, or Tournament).
- The system MUST present the report's current state.
- Report state transitions and any required resolution information are TBD until the report-resolution policy is approved.

## 8. Business Rules
- Source reference: `docs/business-rules-config-matrix.md` §7
- Feature rule: A report targets exactly one of: Player, Facility, Tournament.
- Feature rule: A report cannot have zero targets or multiple targets.
- Feature rule: Multiple targets require separate Reports.
- Feature rule: A Player cannot report themselves.
- Feature rule: `REPORT_ENABLED` is configurable.

## 9. UI/UX Behavior
- Entry points: Admin portal navigation.
- Important states: List view with filters for target types and, when defined, statuses.
- User feedback: In-product confirmation and error feedback after a supported action.

## 10. Success Metrics
- TBD — product metric needs decision.

## 11. Constraints
- Each report must have exactly one target: Player, Facility, or Tournament.
- Reporting is available only when `REPORT_ENABLED` is enabled.

## 12. Risks
- Large volume of reports becoming unmanageable.
- Mitigation: Provide filtering suitable for the approved report workflow.

## 13. Dependencies
- Admin Authentication.

## 14. Open Questions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| What specific report statuses are required beyond "Open" and "Resolved"? | Product | Low | TBD / NEEDS DECISION |
| Does resolving a report require the Admin to input a resolution note/comment? | Product | Low | TBD / NEEDS DECISION |
| What actions and state transitions constitute report resolution? | Product | High | TBD / NEEDS DECISION |
| Must moderation actions taken outside Report Management be recorded or linked to a report? | Product | Medium | TBD / NEEDS DECISION |
