# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Draft
Owner: Platform Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin Tournament Management
```

## Authoritative References
- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md` §4

## Related Documents
- Tech Design: TBD
- Task or issue: TBD

## 1. Problem
Admins need to monitor tournaments created by Players (Organizers) across the platform and intervene when necessary, such as cancelling tournaments that violate terms or are abandoned by deactivated Organizers.

## 2. Goals
- Allow Admins to view all tournaments on the platform.
- Allow Admins to cancel any tournament in any state.
- Allow Admins to intervene in a tournament if the Organizer is deactivated, within the approved Admin capabilities.

## 3. Non-Goals
- Automatic Organizer replacement.
- Editing tournament brackets or match results as a general Admin capability.
- Creating tournaments on behalf of users.

## 4. Scope

### In Scope
- View all tournaments and their current lifecycle states.
- Cancel a tournament.
- Intervene in a tournament when Organizer is deactivated, within the approved Admin capabilities.

### Out of Scope
- Automatic replacement of deactivated Organizers.
- Advanced tournament analytics.

## 5. Target Users and Roles
- Admin: Monitors and intervenes in tournaments.
- Player (Organizer context): Owner of the tournament.

## 6. User Journey
1. Admin navigates to the Tournaments section in the Admin portal.
2. Admin views a tournament and its current lifecycle state.
3. Admin reviews the available intervention action for that tournament.
4. Admin confirms cancellation when cancellation is appropriate.
5. The tournament state is updated to `CANCELLED`.

## 7. Functional Requirements
- The system MUST allow an Admin to view a list of all tournaments.
- The system MUST display tournament details and status.
- The system MUST allow an Admin to cancel any tournament, regardless of its current state.
- The system MUST allow an Admin to intervene in a tournament if the Organizer is deactivated, with the exact intervention actions defined by approved product policy.
- The system MUST not automatically replace a deactivated Organizer.
- If a Tournament Match is cancelled, the system must not automatically advance a participant; Organizer/Admin resolution follows the approved tournament rules.

## 8. Business Rules
- Source reference: `docs/business-rules-config-matrix.md` §4.2–§5.5
- Feature rule: Admin can cancel any Tournament (even `IN_PROGRESS`).
- Feature rule: Organizer deactivation does not automatically cancel a Tournament; Admin may intervene and manage it.
- Feature rule: There is no automatic Organizer replacement.
- Feature rule: A cancelled Tournament Match does not automatically advance a participant.

## 9. UI/UX Behavior
- Entry points: Admin portal navigation.
- Important states: List view of tournaments with status indicators.
- User feedback: Clear warnings before cancelling a tournament.

## 10. Success Metrics
- TBD — product metric needs decision.

## 11. Constraints
- Must respect the existing Tournament lifecycle definitions.

## 12. Risks
- Cancelling an `IN_PROGRESS` tournament disrupts players.
- Mitigation: Strict confirmation dialogue for cancellation.

## 13. Dependencies
- Admin Authentication.

## 14. Open Questions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| What specific actions does "manage a tournament if Organizer is deactivated" entail beyond Cancellation? | Product | High | TBD / NEEDS DECISION |
| Should participants be automatically notified when an Admin cancels a tournament? | Product | Medium | TBD / NEEDS DECISION |
| Does “Admin can cancel any Tournament” include already `COMPLETED` or `CANCELLED` tournaments, given that those states are read-only? | Product | High | TBD / NEEDS DECISION |
