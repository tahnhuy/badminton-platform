# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Draft
Owner: Platform Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin User Management
```

## Authoritative References
- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`
- Database Schema reference: `docs/architecture/database-schema.md` §3.1

## Related Documents
- Tech Design: TBD
- Task or issue: TBD

## 1. Problem
The platform requires a centralized way for Admins to oversee and manage the system's user accounts (Players, Court Owners, and Admins). Without this, there is no way to enforce community guidelines, manage account lifecycles (suspension, deactivation), or handle abusive users.

## 2. Goals
- Provide Admins with the ability to view all user accounts in the system.
- Enable Admins to moderate user accounts by updating their status or deactivating them.

## 3. Non-Goals
- Super Admin role with granular Role-Based Access Control (RBAC).
- Identity verification workflows (KYC).
- Advanced user analytics or behavioral tracking.
- Admin creation of user accounts on their behalf.

## 4. Scope

### In Scope
- View list of users and their details.
- Filter and search users by role and status.
- Update user account status (e.g., suspend, activate).

### Out of Scope
- Granular permission management (Super Admin).
- Undocumented moderation features (e.g., shadowbanning).

## 5. Target Users and Roles
- Admin: Performs user management actions.
- Player: Target of management actions.
- Court Owner: Target of management actions.

## 6. User Journey
1. Admin logs into the system and navigates to User Management.
2. Admin views a list of all users.
3. Admin selects a specific user to view details.
4. Admin changes the user's status (e.g., to suspended) and confirms the action.
5. The user's status is updated. The effect of that status on platform access follows the approved account-status policy.

## 7. Functional Requirements
- The system MUST allow an Admin to view a list of all users.
- The system MUST display user details, role, and current status.
- The system MUST allow an Admin to update a user's status.
- The system MUST allow an Admin to deactivate a user account.

## 8. Business Rules
- Source reference: `PROJECT-BRIEF.md` §4; `docs/business-rules-config-matrix.md` §1.1
- Feature rule: Only the `ADMIN` role can access user management functionalities.
- Feature rule: A user can be a `PLAYER`, `COURT_OWNER`, or `ADMIN`.
- Feature rule: If an Organizer (a Player) is deactivated, their tournaments are not automatically cancelled.

## 9. UI/UX Behavior
- Entry points: Admin portal sidebar/navigation.
- Important states: Data table with loading, empty, and error states. Confirmation modals for destructive actions (e.g., suspension).
- User feedback: Success/error toast notifications when a status update is performed.

## 10. Success Metrics
- TBD — product metric needs decision.

## 11. Constraints
- Must preserve the three system roles defined in `PROJECT-BRIEF.md`.
- Action authorization must enforce the `ADMIN` role.

## 12. Risks
- Accidental suspension or deactivation of valid users.
- Mitigation: Require explicit confirmation for status changes.

## 13. Dependencies
- Admin Authentication and Authorization.

## 14. Open Questions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| What specific user statuses (e.g., ACTIVE, SUSPENDED) should be supported? | Product | High | TBD / NEEDS DECISION |
| Should users be notified when their status is changed? | Product | Medium | TBD / NEEDS DECISION |
