# Product Requirements Document (PRD) - Admin User Management

## Status and Ownership

```text
Status: Ready
Owner: Admin Team
Fulfills: PROJECT-BRIEF.md §4
Scope: Admin User Management
```

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`
- Database Schema: `docs/architecture/database-schema.md`

## Related Documents

- Parent or related PRD: N/A — Core admin feature
- Related: [Court Owner partnership request PRD](../../court-owner/partnership-request/prd.md) — Court Owner accounts created from a request in the "Yêu cầu hợp tác" queue (2026-11-27)
- Tech Design: [docs/features/admin/user-management/tech-design.md](tech-design.md)
- Task or issue: TBD

## 1. Problem

The badminton platform needs a centralized way to oversee and govern its user base, consisting of Players, Court Owners, and other Admins. Without a user management interface, administrators cannot enforce platform policies, handle disputes, manage accounts (e.g., deactivation due to violations), or resolve access issues. This is a critical operational capability required for the MVP to function securely and maintain a healthy community.

## 2. Goals

- Provide Admins with a comprehensive view of all registered users across all roles (`PLAYER`, `COURT_OWNER`, `ADMIN`).
- Enable Admins to manage the lifecycle and access status of user accounts.
- Allow Admins to quickly search and filter users to investigate issues or respond to reports.

## 3. Non-Goals

- User self-service profile editing (this belongs to the Player/Court Owner profile management).
- Advanced Role-Based Access Control (RBAC) configuration or custom role creation (Super Admin and custom roles are out of MVP scope).
- Automated penalty systems for users (penalties are handled manually by admins based on reports).

## 4. Scope

### In Scope

- Viewing a paginated list of all users.
- Filtering and searching users by email, name, role, and status.
- Viewing detailed information of a specific user (profile details, associated facilities for owners, etc.).
- Changing a user's account status (e.g., Active, Suspended/Deactivated).
- Soft-deleting a user account.

### Out of Scope

- Hard deleting user data from the database.
- Modifying user business transactions directly from the user management screen (e.g., cancelling a user's booking from here; that belongs to booking management).
- Managing permissions within a specific role.

## 5. Target Users and Roles

- Player: N/A (Subject of management, does not use this feature).
- Court Owner: N/A (Subject of management, does not use this feature).
- Admin: Primary actor. Uses this feature to monitor and govern the user base.

## 6. User Journey

1. Admin logs into the system and navigates to the "User Management" dashboard.
2. The system displays a list of all users, showing key information like email, role, and status.
3. Admin uses the search bar to find a specific user by email or filters the list by `COURT_OWNER` role.
4. Admin selects a user to view their detailed profile.
5. Admin clicks "Deactivate Account" due to a policy violation.
6. The system updates the user's status, preventing them from logging in, and shows a success confirmation to the Admin.

## 7. Functional Requirements

- The Admin can view a paginated list of all users.
- The Admin can search for users by email or name.
- The Admin can filter the user list by role (`PLAYER`, `COURT_OWNER`, `ADMIN`) and status.
- The Admin can view the detailed profile of a selected user (linking to `PLAYER_PROFILES` or `COURT_OWNER_PROFILES`).
- The Admin can update a user's account status (e.g., from Active to Suspended).
- The Admin can soft-delete a user account (setting `deleted_at`).
- The Admin cannot deactivate or soft-delete another Admin or themselves.

## 8. Business Rules

- Source reference: `PROJECT-BRIEF.md` (Section 4), `docs/architecture/database-schema.md` (Section 3.1)
- Feature rule: There are exactly three roles: `PLAYER`, `COURT_OWNER`, `ADMIN`.
- Feature rule: Soft-deletion must be used (`deleted_at` field) instead of hard deletion to preserve historical transaction integrity (bookings, matches, etc.).
- Feature rule: Account statuses are `ACTIVE`, `SUSPENDED`, and `DEACTIVATED`.
- Feature rule: A suspended, deactivated, or soft-deleted user cannot log into the system.
- Feature rule: An Admin cannot deactivate or soft-delete another Admin or themselves.
- Feature rule: An Admin may set a new password for a user manually.
- Feature rule: Deactivating a user who is a Tournament Organizer does not automatically cancel their tournaments (as per `docs/business-rules-config-matrix.md` Section 4.3).

## 9. UI/UX Behavior

- Entry points: Admin Sidebar Navigation -> "User Management".
- Important states:
  - Loading: Skeleton loaders for the user table.
  - Empty: "No users found" message when search/filter yields no results.
  - Error: Toast notifications for failed actions (e.g., "Failed to update user status").
- User feedback: Confirmation modals before sensitive actions (e.g., "Are you sure you want to deactivate this user?").
- Accessibility or content requirements: Clear visual indicators (badges/colors) for user roles and statuses (e.g., Red for Suspended, Green for Active).

## 10. Success Metrics

- N/A — no product metric is required for this scope (operational admin tool).

## 11. Constraints

- Must rely on the existing `USERS`, `PLAYER_PROFILES`, and `COURT_OWNER_PROFILES` database schema.
- Must not introduce new system roles (Super Admin is out of MVP).

## 12. Risks

- Risk: Accidental deactivation of active Court Owners could disrupt ongoing facility operations.
- Mitigation: Require explicit confirmation (confirmation modal) before applying status changes or deletions.
- Risk: An Admin deactivating another Admin (or themselves) leading to lockout.
- Mitigation: Admin accounts cannot be deactivated or soft-deleted through this feature, including by the account owner.

## 13. Dependencies

- N/A — no product dependency.

## 14. Decision Log

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Exact account statuses available | PM/Business Owner | Use `ACTIVE`, `SUSPENDED`, and `DEACTIVATED`. | 2026-09-13 | RESOLVED |
| Admin deactivation/deletion of Admin accounts | PM/Business Owner | An Admin cannot deactivate or soft-delete another Admin or themselves. | 2026-09-13 | RESOLVED |
| Manual password reset by Admin | PM/Business Owner | Admin may set a new password manually; no forced change on next login to preserve schema. | 2026-09-13 | RESOLVED |

## Output Rules

This PRD complies with the negative constraints:
- No database schema, SQL, migrations, indexes, or database field definitions are created.
- No API endpoints, payloads, or HTTP contracts are defined.
- No framework, infrastructure, or file-structure decisions are made.
- No implementation code is included.

## Ratings oversight integration — approved 2026-10-15

The existing Admin User Detail for Player targets hosts read-only Ratings (given/received) and automatic Skill Adjustments sections, delivered by Ratings RT-08. Reuse the Ratings contracts/client rather than adding duplicate queries or a new moderation feature. Admin can inspect inactive Player history. Display explicit rater/target identities, scores/comment/Match context, and previous/new skill with adjustment average/count/source/time; paginate using shared components.

Technical authority: Ratings Tech Design §9.4 and §23.2 (Admin-only `GET /api/v1/users/:userId/skill-adjustments`). No edit/delete rating/history controls, automatic penalties, or manual skill-level editing are introduced. Existing task completion statuses do not imply this new integration has been implemented.
