# Product Requirements Document (PRD) - Authentication & Authorization

## Status and Ownership

```text
Status: Draft
Owner: PM
Fulfills: PROJECT-BRIEF.md §2; supporting capability for §3.1, §3.2, §3.3, and §4 (see docs/documentation-guide.md §2.2)
Scope: Platform account registration, sign-in, sign-out, session continuity, system-role assignment, and business-level access by role
```

This PRD is Draft. All business decisions raised in the original Draft have been resolved by the Business Owner on 2026-09-16 (see §14 Decision Log) **except one**: the skill-level catalog (§14.1) remains unresolved and blocks Ready per `docs/documentation-guide.md` §6.3 ("A document containing unresolved `[TBD]` items cannot become Ready if those items affect its dependent implementation"). Two technical inconsistencies noted during review do not block Ready and are recorded in "Handoff to Tech Design" instead.

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §3, §4, §5
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.1, §2.2, §6.3, §11
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md` §1.1 (System Roles, Tournament Organizer), §4.3 (Organizer deactivation). The matrix defines no authentication rules or configuration keys today; §14 proposes candidate keys for future approval.
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §3.1 (`USERS`: email as login identifier, single role, account status, soft delete, `must_change_password` column)
- Global technology direction: `docs/architecture/tech-stack.md` "Authentication and Authorization Approach" — mechanism is RECOMMENDED, not confirmed; this PRD does not select one.
- Related feature references:
  - [Admin User Management PRD](../../admin/user-management/prd.md) (Ready) — account statuses, blocked sign-in, Admin-set password. Several decisions below require follow-up changes to this document (see "Follow-ups for Other Documents"); this PRD does not edit it.
  - [Admin User Management Tech Design](../../admin/user-management/tech-design.md) (Ready) — current-status check on active sessions
  - [Admin Tournament Management Tech Design](../../admin/tournament-management/tech-design.md) (Ready) — tournament list and details are public

## Related Documents

- Parent or related PRD: [Admin User Management PRD](../../admin/user-management/prd.md)
- Tech Design: TBD
- Task or issue: TBD

## 1. Problem

- **Who is affected:** Every Player, Court Owner, and Admin. All MVP flows — Matchmaking, Court Booking, Tournament, and Admin management — act on behalf of an identified user holding a system role.
- **What is unavailable today:** There is no product definition of how an account comes into existence, how a user proves identity, how long access lasts, how access ends, or which business areas each role may use.
- **Why it matters within MVP:** Ready Admin documents already depend on this capability without defining it: Court Management PRD §13 and Report Management PRD list "Admin Authentication" as a dependency, and their Tech Designs consume "the platform authentication boundary". Admin User Management requires that suspended, deactivated, and soft-deleted users cannot sign in, but no document defines the sign-in experience that enforces it. Without this capability, none of the three core domains can operate (`docs/documentation-guide.md` §2.2).

## 2. Goals

- A person can obtain an account through an approved path and sign in with it.
- Every account holds exactly one system role, and that role determines which business areas the user may use.
- A signed-in user stays signed in for an approved period without re-entering credentials on every action, and can sign out at any time.
- An account that is not in good standing (suspended, deactivated, or soft-deleted) cannot gain or keep access.
- Tournament Organizer remains a contextual permission of a Player, never a role obtained at registration or sign-in.
- Success Metrics: `N/A — no product metric is required for this scope` (Decision, §14).

## 3. Non-Goals

- Forgot-password / self-service password reset via the system itself. Resolved (§14): recovery is handled through an external support contact plus the existing Admin "set new password" capability, not a self-service email-reset flow.
- Email address verification.
- OAuth or social sign-in.
- Multi-factor authentication (MFA).
- Super Admin or any Admin hierarchy (`PROJECT-BRIEF.md` §5). In-product Admin-creates-Admin is explicitly excluded (§14).
- Admin search, filtering, status changes, soft deletion — owned by [Admin User Management PRD](../../admin/user-management/prd.md). Admin-set password and its effects are extended by this PRD (§7.6, §14) and require a follow-up update to that document (not made here).
- Role change after account creation (§14).
- Court Owner and Admin business-area access beyond their own role (§14; see §7.7).

## 4. Scope

### In Scope

- Public self-registration for the **Player** role only (§14).
- Assignment of exactly one system role to every account when it is created.
- The business rule that Court Owner accounts are created by an Admin, and Admin accounts are created outside the product (§14) — the administrative creation workflow itself is owned by Admin User Management (see "Follow-ups for Other Documents").
- Sign-in with email address and password.
- Sign-out.
- Session continuity while signed in, including role-based session duration (§14).
- Refusal of sign-in, and loss of existing access, for accounts that are not in good standing.
- Account lockout after repeated failed sign-in attempts (§14).
- Self-service password change for a signed-in user, including the mandatory password change required after an Admin sets a password (§14).
- Business-level access by role, including the contextual Organizer permission and what an unauthenticated visitor may reach.

### Out of Scope

- Everything listed in §3 Non-Goals.
- The Admin-facing UI/workflow for creating a Court Owner account — owned by Admin User Management (follow-up required; not yet in that document's scope).
- Any in-product Admin-creates-Admin workflow — decided against for MVP (§14).
- Self-service password change UI location if it is later folded into a general profile-management feature; for MVP it is defined by this PRD (§14).

## 5. Target Users and Roles

- **Unauthenticated visitor** (not a system role; a person with no active session): may register as a Player, sign in, and view public content and court/facility/tournament information (§7.7).
- **Player:** self-registers, signs in, and uses Player business areas.
- **Court Owner:** account is created by an Admin with an initial/temporary password; the Court Owner signs in and must change that password before doing anything else, then uses Court Owner business areas (§14).
- **Admin:** account is created outside the product (for example, by whoever provisions the environment), never through any in-product flow, including by another Admin. Signs in and uses Admin business areas. Admin does not take part in badminton-playing business (`PROJECT-BRIEF.md` §4).
- **Contextual permission — Tournament Organizer:** a Player who created a given tournament holds Organizer permission for that tournament only. It requires no separate account, role, or sign-in, and is never granted at registration (`PROJECT-BRIEF.md` §2; `docs/business-rules-config-matrix.md` §1.1).

## 6. User Journey

### 6.1 Player registration

1. A visitor opens the registration page from a public page.
2. The visitor enters an email address, a password, their full name, and an initial skill level chosen from the approved skill-level catalog.
3. The system checks that the email is not already used by any account (including soft-deleted accounts — the email remains permanently reserved, §14) and that the password satisfies the password policy (§8).
4. The system creates a Player account with status `ACTIVE` and informs the visitor.
5. The visitor is signed in automatically.

Alternative: the email is already in use, the password does not meet policy, or the skill level is not a valid catalog value → no account is created; the visitor sees what must be corrected.

> The selectable skill-level values are not yet defined — see §14.1 (blocks Ready).

### 6.2 Court Owner account creation (by Admin)

1. An Admin creates a Court Owner account, supplying at least a business name and contact phone, per the existing `COURT_OWNER_PROFILES` schema.
2. The system generates or accepts an initial password and marks the account so that the next sign-in requires a password change.
3. The Admin communicates the email and initial password to the Court Owner outside the system.
4. The Court Owner signs in with the initial password, is immediately required to set a new password meeting the password policy (§8) before reaching any other page or action, and is then signed in normally.

This journey's Admin-facing steps (1–3) are executed through Admin User Management; this PRD owns only the resulting account state and the forced-change sign-in behavior (step 4). See "Follow-ups for Other Documents".

### 6.3 Sign-in

1. A visitor opens the sign-in page and enters an email address and password.
2. If the credentials are correct and the account is in good standing (not locked, not `SUSPENDED`/`DEACTIVATED`/soft-deleted), the user is signed in and taken to the starting area for their role.
3. If the account has `must_change_password` set (from an Admin-set password, §6.2 or §7.6), the user is taken directly to the mandatory password-change step (§7.5) and cannot reach any other page or action until it is completed.

Alternatives:

- Incorrect email or password → sign-in fails with a generic message; the user stays on the sign-in page (§7.4).
- Account `SUSPENDED` or `DEACTIVATED` → sign-in is refused with a message stating the account is restricted, shown only because the password was correct (§7.4).
- Soft-deleted account → sign-in fails with the same generic message as incorrect credentials (§7.4).
- 5 consecutive failed attempts against the same account → the account is temporarily locked for 15 minutes; further attempts (even with the correct password) are refused until the lock expires (§7.3).

### 6.4 Staying signed in

1. The signed-in user navigates, reloads pages, and returns to the platform.
2. While the session has not exceeded its idle or absolute limit for the account's role (§7.4), the user is not asked for credentials again.
3. When the session ends, the user is asked to sign in again before any restricted action.

### 6.5 Sign-out

1. A signed-in user chooses Sign Out.
2. The session on that device ends; restricted areas require signing in again on that device. Other devices where the same account is signed in are unaffected — there is no "sign out of all devices" action in MVP (§7.5).

### 6.6 Visitor reaches a restricted area

1. A visitor opens an area or attempts an action that requires sign-in.
2. Restricted content is not shown; the visitor is asked to sign in.

### 6.7 Account restricted while signed in

1. An Admin suspends, deactivates, or soft-deletes an account that currently has an active session.
2. The very next action that user attempts is refused; the platform re-checks account status on each authenticated action rather than trusting a previously issued session (§7.6).

### 6.8 Admin sets a new password for a user

1. An Admin sets a new password for a user (existing Admin User Management capability).
2. All of that user's existing sessions end immediately; the account is marked so the next sign-in requires a password change (§6.3 step 3, §7.5).
3. The user signs in with the new password and is immediately taken to the mandatory password-change step.

### 6.9 Self-service password change

1. A signed-in user opens "Change Password" and enters their current password and a new password meeting the password policy.
2. If the current password is correct and the new password meets policy, the password is updated and the user continues signed in.
3. This same step satisfies the mandatory password-change requirement from §6.3 step 3 and §6.8 step 3.

### 6.10 Forgotten password

1. A user who cannot sign in because they forgot their password uses the support contact shown on the sign-in page.
2. Support verifies the user's identity outside the system and asks an Admin to set a new password (§6.8), which forces a password change at next sign-in.

## 7. Functional Requirements

### 7.1 Registration

- A visitor can create a **Player** account through self-registration. Public self-registration produces only `PLAYER` accounts; it can never produce a `COURT_OWNER` or `ADMIN` account, including through manipulated input (Decision, §14).
- Registration requires an email address, a password, a full name, and an initial skill level selected from the approved skill-level catalog. **The catalog itself is not yet defined — §14.1 blocks Ready.**
- Registration is refused when the email address is already used by any existing account, including a soft-deleted one (Decision, §14); the email comparison is case-insensitive (Decision, §14).
- Registration is refused when the password does not satisfy the password policy (§8).
- A self-registered account receives role `PLAYER` and status `ACTIVE`.
- Registration never grants Tournament Organizer permission.

### 7.2 Role assignment

- Every account holds exactly one system role: `PLAYER`, `COURT_OWNER`, or `ADMIN` (`PROJECT-BRIEF.md` §2; `docs/architecture/database-schema.md` §3.1).
- The role is assigned when the account is created and never changes afterward in MVP; a person needing a different role must use a separate account with a different email (Decision, §14).
- Tournament Organizer is never assigned as a role; it is determined per tournament by who created it (`docs/business-rules-config-matrix.md` §1.1).
- A person who is both a Court Owner and a Player uses two separate accounts with different email addresses. A Court Owner account cannot use Player-only business areas — see §7.7 (Decision, §14).

### 7.3 Sign-in

- A user whose account is `ACTIVE`, not locked, and not soft-deleted can sign in with their email address and password.
- Sign-in fails, and no session is created, when the email does not belong to an account or the password is incorrect.
- Sign-in is refused, and no session is created, for an account that is `SUSPENDED`, `DEACTIVATED`, or soft-deleted, even when the password is correct (Admin User Management PRD §8).
- After 5 consecutive failed sign-in attempts against one account, the account is locked for 15 minutes; sign-in — even with the correct password — is refused until the lock expires. A successful sign-in resets the failure counter to zero. This lockout is tracked independently of the `ACTIVE`/`SUSPENDED`/`DEACTIVATED` status values (Decision, §14).
- After an Admin sets a new password for an account (§6.8), only the new password signs in to that account, and the sign-in immediately requires a password change before anything else.
- An account returned from `SUSPENDED` to `ACTIVE` by an Admin can sign in again with its current password.
- Email address is the sign-in identifier (`docs/architecture/database-schema.md` §3.1), matched case-insensitively (Decision, §14). Sign-in by phone number is not supported by this PRD.

### 7.4 Session continuity

- After signing in, the user remains signed in across navigation, page reloads, and return visits until the session ends.
- Session duration is role-based (Decision, §14):
  - `PLAYER` and `COURT_OWNER`: ends after 7 days of inactivity, or 30 days absolute maximum, whichever comes first.
  - `ADMIN`: ends after 1 hour of inactivity, or 8 hours absolute maximum, whichever comes first.
- There is no "remember me" option; the durations above apply regardless of device or browser-close behavior (Decision, §14).
- A session also ends when the user signs out, or when the account is no longer in good standing (§7.6).
- An account may have any number of concurrent sessions across devices; there is no session limit and no cross-device "sign out of all devices" action in MVP (Decision, §14).

### 7.5 Sign-out

- A signed-in user can sign out from any signed-in page.
- Sign-out ends only the current device's session; other devices where the same account is signed in are unaffected (Decision, §14).

### 7.6 Accounts not in good standing

- Sign-in is refused for `SUSPENDED`, `DEACTIVATED`, and soft-deleted accounts, and for locked accounts during their lockout window (§7.3).
- An active session of an account that becomes `SUSPENDED`, `DEACTIVATED`, or soft-deleted stops granting access immediately: the platform re-checks the account's current status on every authenticated action, so the very next action after the status change is refused (Decision, §14).
- A `SUSPENDED` or `DEACTIVATED` account shown a message stating access is restricted appears **only after the correct password is supplied**; no reason is disclosed. A soft-deleted account instead receives the same generic message as an incorrect email/password (Decision, §14; see §7.4 error wording).
- When an Admin sets a new password for a user, all of that user's existing sessions end immediately (Decision, §14; §6.8).

### 7.7 Business-level access by role

The table states which role may use each business area. Detailed rules inside each area are owned by the corresponding domain PRD.

| Business area | Visitor | Player | Court Owner | Admin | Source |
| --- | --- | --- | --- | --- | --- |
| Register | Yes (Player only) | — | No (Admin-created, §7.1) | No (created outside product, §7.1) | §7.1, Decision §14 |
| Sign in / sign out | Sign in | Yes | Yes | Yes | This PRD |
| View tournament list and details | Yes | Yes | Yes | Yes | Admin Tournament Management Tech Design (public) |
| Browse facilities, courts, prices, available slots | Yes (§14 — provisional, no Booking PRD exists yet to reconcile against) | Yes | Yes | Yes (management view) | Decision, §14 |
| Matchmaking (requests, invitations, groups, post-match rating) | No | Yes | No | No | `PROJECT-BRIEF.md` §3.1, §4; Decision §14 |
| Book, pay for, and cancel a court booking as the booker | No | Yes | No | No | `PROJECT-BRIEF.md` §3.2, §4; Decision §14 |
| Operate own facilities: monitor bookings, lock slots, owner-side cancellation | No | No | Yes, own facilities only | No | `PROJECT-BRIEF.md` §3.2 |
| Register for and follow tournaments as a participant | No | Yes | No | No | `PROJECT-BRIEF.md` §3.3, §4; Decision §14 |
| Create a tournament | No | Yes (becomes its Organizer) | No | No | `docs/business-rules-config-matrix.md` §1.1; Decision §14 |
| Manage a tournament (Organizer actions) | No | Only for tournaments they created | No | All tournaments | `docs/business-rules-config-matrix.md` §1.1 |
| Platform administration: users, Court Owners, facilities, tournaments, reports, dashboard | No | No | No | Yes | `PROJECT-BRIEF.md` §4 |

- A visitor who reaches an area requiring sign-in is asked to sign in (§6.6).
- A signed-in user who attempts an area not permitted for their role is refused and shown that access is not permitted, not asked to sign in again.
- Access is enforced by the platform for every action; hiding a menu or button is not sufficient (`docs/architecture/conventions.md` "Security Coding Practices").

## 8. Business Rules

- Source reference: `PROJECT-BRIEF.md` §2, §4, §5; `docs/business-rules-config-matrix.md` §1.1, §4.3; [Admin User Management PRD](../../admin/user-management/prd.md) §8; Decisions in §14 of this document (decided by the Business Owner on 2026-09-16).
- `[CONFIRMED]` The only system roles are `PLAYER`, `COURT_OWNER`, and `ADMIN`. Tournament Organizer is a contextual Player permission.
- `[CONFIRMED]` Admin does not take part in badminton-playing business.
- `[CONFIRMED]` Super Admin is out of MVP; no Admin hierarchy is introduced by any account-creation path.
- `[CONFIRMED]` Account statuses are `ACTIVE`, `SUSPENDED`, and `DEACTIVATED`; soft deletion is separate.
- `[CONFIRMED]` Suspended, deactivated, and soft-deleted users cannot sign in.
- `[CONFIRMED]` An Admin may set a new password for a user.
- `[CONFIRMED]` Deactivating an Organizer's account does not cancel their tournaments; Admin may intervene (`docs/business-rules-config-matrix.md` §4.3).
- `[CONFIRMED]` Email address is the sign-in identifier (`docs/architecture/database-schema.md` §3.1).
- `[DECIDED — Business Owner, 2026-09-16]` Players self-register directly to `PLAYER`/`ACTIVE`; Court Owner accounts are Admin-created; Admin accounts are created outside the product.
- `[DECIDED — Business Owner, 2026-09-16]` Password policy, lockout, session duration, and related values below (§14).
- `[TBD — blocks Ready]` The skill-level catalog offered at registration (§14.1).
- Any configuration value referenced in §14 (lockout threshold/duration, session durations) is **proposed only**. It must be explicitly approved and added to `docs/business-rules-config-matrix.md` (FROZEN, §11 change policy) before implementation may treat it as authoritative; this PRD does not add it.

## 9. UI/UX Behavior

- **Entry points:** Sign In and Register are reachable from public pages. Sign Out is reachable from every signed-in page. A visitor reaching a restricted area is sent to sign in (§6.6). Change Password is reachable from a signed-in area at all times, and is shown as a forced, non-dismissible step immediately after sign-in when `must_change_password` is set (§6.3, §6.8).
- **Important states:**
  - Submitting: the form shows that processing is in progress and cannot be submitted twice.
  - Field validation error: shown next to the field (missing/malformed email, password not meeting policy, skill level not a valid catalog value once §14.1 is resolved).
  - Sign-in failed (unknown email or wrong password): generic message, identical wording in both cases — "Email hoặc mật khẩu không đúng" (Decision, §14).
  - Account restricted (`SUSPENDED`/`DEACTIVATED`, shown only after a correct password): distinct message stating the account is restricted and to contact support; no reason is disclosed (Decision, §14).
  - Account locked: shown only after 5 consecutive failed attempts; states that the account is temporarily locked and approximately when it will unlock (Decision, §14).
  - Session ended: the user is told they must sign in again.
  - Access not permitted for role: the user is told the area is not available to their account.
- **User feedback:** Registration success is confirmed. Password requirements are shown on the registration, forced-change, and self-service change forms. Passwords are masked while typed and are never displayed back. The sign-in page shows an external support contact for users who cannot sign in (Decision, §14).
- **Accessibility or content requirements:** Error messages are conveyed as text, not by color alone. Messages must not reveal more than approved above (generic sign-in failure; restricted-account message only after correct password).

## 10. Success Metrics

- `N/A — no product metric is required for this scope` (Decision, §14; consistent with other platform/admin capability PRDs).

## 11. Constraints

- Three system roles only; Organizer is contextual (`PROJECT-BRIEF.md` §2).
- Admin does not take part in playing business (`PROJECT-BRIEF.md` §4).
- Super Admin is out of MVP (`PROJECT-BRIEF.md` §5).
- Email address is the sign-in identifier; supporting phone-number sign-in would require a schema change (`docs/architecture/database-schema.md` §3.1, FROZEN).
- Account statuses and the base Admin-set-password capability are owned by [Admin User Management PRD](../../admin/user-management/prd.md); this PRD extends that capability's effects (forced change, session termination) and requires a follow-up update there rather than redefining it here.
- The authentication mechanism (tokens, cookie storage, password hashing, CSRF protection) is not decided by this PRD; it belongs to the Tech Design within `docs/architecture/tech-stack.md`.
- No configuration value in §14 is authoritative until approved and added to `docs/business-rules-config-matrix.md`.

## 12. Risks

- **Email already in use reveals account existence.** Because email verification is a non-goal, registration must tell the visitor when an email cannot be used, which reveals that an account exists regardless of sign-in message wording.
  - Decision (§14): accepted for MVP. Checked against booking/payment requirements and `tech-stack.md`'s notification strategy — no requirement forces email verification into scope; the notification delivery mechanism remains separately TBD and out of this PRD's concern.
- **Registration with someone else's email.** Without email verification, a person can register using an email they do not own. Combined with the decision that a soft-deleted account's email is never released (§14), if this happens the real owner can never register with that email.
  - Decision (§14): accepted for MVP. Recovery path is the support-contact + Admin-set-password flow (§6.10), not an in-product remedy.
- **Password guessing.**
  - Mitigated by the account lockout (§7.3) plus the recommended technical-level rate limiting noted in "Handoff to Tech Design".
- **Lockout abuse:** anyone can deliberately lock a legitimate user out by repeatedly failing sign-in on their email.
  - Accepted for MVP: the lockout window is short (15 minutes) and self-clears; no manual unlock is required.
- **Delayed revocation:** resolved — access is re-checked on every action, so revocation is effectively immediate (§7.6).
- **Dual-role friction:** a Court Owner who also plays needs a second account and email, and cannot use Player features from the Court Owner account.
  - Accepted for MVP (§14; §7.2, §7.7).

## 13. Dependencies

- [Admin User Management PRD](../../admin/user-management/prd.md) (Ready): account statuses, blocked sign-in, and the Admin-set-password capability this PRD extends. Requires a follow-up update — see "Follow-ups for Other Documents".
- A decision on where the skill-level catalog is authoritatively defined (§14.1) — recommended home is `docs/business-rules-config-matrix.md`, pending Business Owner confirmation.
- Player profile documentation (not yet written), which will own full name/skill level display and editing after registration.
- Booking, Court Owner, and Tournament PRDs (not yet written; currently `.gitkeep` placeholders) — §7.7's guest-browsing row is provisional until reconciled against them.

## 14. Decision Log

All decisions below were made by the **Business Owner (PM)** on **2026-09-16**, resolving the Draft's original open questions.

| # | Question | Decision | Decided by | Date |
| --- | --- | --- | --- | --- |
| 1 | Player self-registration | Confirmed: visitors self-register as `PLAYER`, status `ACTIVE`. | Business Owner (PM) | 2026-09-16 |
| 2 | Court Owner account creation | Admin creates the account with an initial/temporary password; forced password change at first sign-in (see #17). Requires a follow-up capability in Admin User Management (not built yet). | Business Owner (PM) | 2026-09-16 |
| 3 | Admin account creation | No in-product flow; Admin accounts are provisioned outside the product. No Admin-creates-Admin capability in MVP. | Business Owner (PM) | 2026-09-16 |
| 4 | Registration information | Email, password, full name, and a self-declared initial skill level chosen from the approved catalog. | Business Owner (PM) | 2026-09-16 |
| 4.1 | Skill-level catalog — source of definition | **Unresolved — blocks Ready.** No document defines the actual skill-level values (only the `SKILL_LEVELS` table shape exists). Proposed home: `docs/business-rules-config-matrix.md`. Awaiting Business Owner confirmation of both the home and the values. | — | — |
| 5 | After registration | User is signed in automatically. | Business Owner (PM) | 2026-09-16 |
| 6 | Email case sensitivity | Not case-sensitive; comparison is case-insensitive. | Business Owner (PM) | 2026-09-16 |
| 7 | Soft-deleted email reuse | Not reusable; email stays reserved permanently. | Business Owner (PM) | 2026-09-16 |
| 8 | Password policy | Length 8–64 characters; no mandatory character-type mix; must not equal the account's email. Applies uniformly to self-registration, self-service change, and Admin-set/temporary passwords. | Business Owner (PM) | 2026-09-16 |
| 9 | Failed sign-in lockout | 5 consecutive failures locks the account for 15 minutes, auto-unlocks, resets on success; tracked separately from account status. Proposed config keys below need matrix approval. | Business Owner (PM) | 2026-09-16 |
| 10 | Session duration | Role-based: Player/Court Owner — 7-day idle / 30-day absolute. Admin — 1-hour idle / 8-hour absolute. Proposed config keys below need matrix approval. | Business Owner (PM) | 2026-09-16 |
| 11 | Remember me | Not offered; durations in #10 always apply. | Business Owner (PM) | 2026-09-16 |
| 12 | Multiple devices | Unlimited concurrent sessions; sign-out affects only the current device; no "sign out of all devices" in MVP. | Business Owner (PM) | 2026-09-16 |
| 13 | Access revocation timing | Immediate — status is checked on every authenticated action. | Business Owner (PM) | 2026-09-16 |
| 14 | Sessions after Admin-set password | All existing sessions of that user end immediately. Requires a follow-up note in Admin User Management Tech Design. | Business Owner (PM) | 2026-09-16 |
| 15 | Sign-in error wording | One generic message for both unknown email and wrong password. | Business Owner (PM) | 2026-09-16 |
| 16 | Restricted-account message | Shown only after the correct password, for `SUSPENDED`/`DEACTIVATED` only, no reason disclosed; soft-deleted accounts get the generic message from #15. | Business Owner (PM) | 2026-09-16 |
| 17 | Forced password change (`must_change_password`) | **Business decision only:** any Admin-set password (including initial Court Owner passwords) forces a password change at next sign-in before any other action. Reverses Admin User Management's prior decision — requires a follow-up update there. The schema/migration gap for `must_change_password` is a **Tech Design Decision Gate** item, not resolved here. | Business Owner (PM) | 2026-09-16 |
| 18 | Self-service password change | In scope of this PRD: current password + new password meeting policy; also satisfies the forced-change requirement from #17. | Business Owner (PM) | 2026-09-16 |
| 19 | Role change after creation | Not supported in MVP; a different role requires a separate account. | Business Owner (PM) | 2026-09-16 |
| 20 | Dual-role person | Two separate accounts/emails required; a Court Owner account cannot use Player-only business areas. | Business Owner (PM) | 2026-09-16 |
| 21 | Visitor browsing | Visitors can browse facilities, courts, prices, and available slots. **Provisional:** no Booking or Court Owner PRD exists yet (`docs/features/booking/.gitkeep`, `docs/features/court-owner/.gitkeep`) to cross-check against; re-confirm when those PRDs are authored. | Business Owner (PM) | 2026-09-16 |
| 22 | Email-verification risks (§12) | Accepted for MVP; email verification stays a non-goal. Checked against booking/payment and notification-strategy documents first — no requirement was found that mandates email as a delivery channel, so this does not conflict with any Ready or FROZEN document. | Business Owner (PM) | 2026-09-16 |
| 23 | Forgotten-password support channel | Sign-in page shows an external support contact; Admin verifies identity out-of-band and sets a new password (triggers #17). Exact contact copy is an operational detail and does not block Ready. | Business Owner (PM) | 2026-09-16 |
| 24 | Success Metrics | `N/A`. | Business Owner (PM) | 2026-09-16 |
| 25 | PRD Owner | PM. | Business Owner (PM) | 2026-09-16 |

### 14.1 Remaining Open Item — Blocks Ready

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| **Skill-level catalog:** What are the actual selectable skill-level values (names/ranks/descriptions) offered at Player registration, and which document owns their definition? Recommended home: `docs/business-rules-config-matrix.md`. | Business Owner (PM) | High — blocks §7.1 registration behavior and §15.1 acceptance criteria | NEEDS DECISION |

This PRD cannot move to Ready until item 4.1 is resolved (`docs/documentation-guide.md` §6.3).

## 15. Business Acceptance Criteria

These criteria describe business-observable behavior only. Per `docs/documentation-guide.md` §4.1, the Tech Design owns the technical acceptance criteria and must stay consistent with these.

### 15.1 Registration

- **Given** no account (active or soft-deleted) uses email E, in any letter case
  **When** a visitor registers as a Player with email E, a password satisfying the password policy, a full name, and a valid skill-level value
  **Then** a new account is created with role `PLAYER` and status `ACTIVE`, and signing in with E (in any letter case) and that password succeeds.

- **Given** an account, active or soft-deleted, already uses an email that differs from E only by letter case
  **When** a visitor attempts to register with E
  **Then** registration is refused and no additional account is created.

- **Given** a visitor on the registration page
  **When** they submit a password shorter than 8 characters, longer than 64 characters, or equal to the submitted email
  **Then** no account is created and the visitor sees that the password does not meet the policy.

- **Given** a visitor on the registration page
  **When** they submit a missing or malformed email address
  **Then** no account is created and a validation message is shown for the email field.

- **Given** the public registration flow
  **When** a visitor submits registration input that requests role `COURT_OWNER` or `ADMIN` by any means, including manipulated input
  **Then** no account with that role is created; at most a `PLAYER` account may be created from the remaining valid fields, or the request is refused entirely.

- *(Blocked by §14.1)* An AC verifying that only catalog-approved skill-level values are accepted cannot be written until the catalog is defined.

### 15.2 Court Owner account creation

- **Given** an Admin creates a Court Owner account with an initial password
  **When** the Court Owner signs in with that initial password for the first time
  **Then** they are required to set a new password before reaching any other page or action, and cannot bypass this step.

- **Given** a Court Owner who has completed the forced password change
  **When** they sign in again with the new password
  **Then** sign-in succeeds without a forced-change step.

### 15.3 Sign-in

- **Given** an `ACTIVE`, non-locked, non-soft-deleted account with email E and password P
  **When** the user signs in with E (in any letter case) and P
  **Then** sign-in succeeds and the user can use the business areas permitted for the account's role (§7.7).

- **Given** an `ACTIVE` account with email E
  **When** someone signs in with E and a password that is not the account's password
  **Then** sign-in fails with the message "Email hoặc mật khẩu không đúng", no session is created, and restricted areas remain inaccessible.

- **Given** no account uses email E
  **When** someone signs in with E and any password
  **Then** sign-in fails with the identical message "Email hoặc mật khẩu không đúng", no session is created, and restricted areas remain inaccessible.

- **Given** an account with status `SUSPENDED` or `DEACTIVATED`
  **When** the user signs in with the correct email and password
  **Then** sign-in is refused, no session is created, and a distinct "account restricted, contact support" message is shown (no reason disclosed).

- **Given** a soft-deleted account
  **When** the user signs in with the correct email and password
  **Then** sign-in is refused with the same generic message as incorrect credentials, no session is created.

- **Given** an account with 5 consecutive failed sign-in attempts within the lockout window
  **When** a 6th sign-in attempt is made, even with the correct password
  **Then** sign-in is refused and the user is told the account is temporarily locked.

- **Given** a locked account
  **When** 15 minutes elapse and the user signs in with the correct password
  **Then** sign-in succeeds.

- **Given** an account with one failed sign-in attempt
  **When** the user then signs in successfully
  **Then** a subsequent single failed attempt does not lock the account (the failure counter reset to zero on success).

- **Given** an `ACTIVE` account whose password was P1 and for which an Admin then set a new password P2
  **When** the user signs in with P1, and separately with P2
  **Then** sign-in with P1 fails and sign-in with P2 succeeds, immediately requiring a password change (§15.2 pattern).

- **Given** an account that an Admin changed from `SUSPENDED` back to `ACTIVE`
  **When** the user signs in with the correct email and current password
  **Then** sign-in succeeds.

### 15.4 Session, sign-out, and revocation

- **Given** a signed-in Player or Court Owner whose session is within 7 days of idle time and 30 days of absolute duration
  **When** they reload the page or navigate to another area permitted for their role
  **Then** they are not asked to enter credentials again.

- **Given** a signed-in Admin whose session has been idle for more than 1 hour, or open for more than 8 hours
  **When** they attempt any authenticated action
  **Then** they are asked to sign in again.

- **Given** a signed-in user
  **When** they sign out and then attempt a restricted action on the same device
  **Then** the action is not performed and they are asked to sign in.

- **Given** the same account signed in on two devices
  **When** the user signs out on one device
  **Then** the session on the other device remains active.

- **Given** a signed-in user with an active session
  **When** an Admin changes that account's status to `SUSPENDED`, `DEACTIVATED`, or soft-deletes it
  **Then** the very next authenticated action by that user is refused.

- **Given** a signed-in user with one or more active sessions
  **When** an Admin sets a new password for that user's account
  **Then** every existing session for that account ends immediately, and the next sign-in requires the new password and a forced password change.

### 15.5 Self-service password change

- **Given** a signed-in user
  **When** they submit their correct current password and a new password meeting the policy
  **Then** the password is updated and subsequent sign-ins require the new password.

- **Given** a signed-in user
  **When** they submit an incorrect current password
  **Then** the password is not changed.

### 15.6 Role and business-level access

- **Given** an existing account
  **When** any actor attempts to change its system role
  **Then** the role is unchanged; no capability exists to perform this change in MVP.

- **Given** a person who registered a Player account and was separately given a Court Owner account by an Admin, using two different emails
  **When** they sign in to the Court Owner account
  **Then** they cannot access Player-only business areas (matchmaking, booking as a booker, tournament participation or creation) from that account.

- **Given** an unauthenticated visitor
  **When** they attempt an action that requires sign-in, such as creating a court booking
  **Then** the action is not performed, restricted content is not shown, and they are asked to sign in.

- **Given** an unauthenticated visitor
  **When** they open the tournament list, a tournament's details, or browse facilities/courts/prices/available slots
  **Then** the content is shown without requiring sign-in. *(Provisional — see Decision #21.)*

- **Given** a signed-in `PLAYER` or `COURT_OWNER`
  **When** they attempt to open or use any Admin platform-administration area
  **Then** access is refused, no administration data is shown, and they are told the area is not available to their account.

- **Given** a signed-in `ADMIN`
  **When** they attempt to create a court booking, create a matchmaking request, or register for a tournament
  **Then** the action is refused.

- **Given** Player A created tournament T and Player B did not
  **When** Player B attempts an Organizer action on T
  **Then** the action is refused.

- **Given** Player A created tournament T
  **When** Player A attempts an Organizer action on T that the tournament rules allow in its current state
  **Then** the action is permitted.

- **Given** a signed-in `ADMIN` and a tournament T created by any Player
  **When** the Admin attempts a tournament-management action on T that the tournament rules allow
  **Then** the action is permitted.

## Handoff to Tech Design

The following are known technical inconsistencies or technical-level recommendations surfaced while resolving this PRD. They do **not** block this PRD's Ready status; they must be addressed when the Tech Design is authored.

1. **`must_change_password` schema gap:** `docs/architecture/database-schema.md` §3.1 (FROZEN) documents this column, but it is absent from migration `0000_black_cassandra_nova.sql` and from `backend/src/db/schema/users.ts`. Decision #17 now makes this column's behavior a real business requirement (forced password change). The Tech Design must resolve this at its Decision Gate: add the migration, and confirm no other consumer assumed the column's absence (the Admin User Management task explicitly excluded it — see Follow-ups below).
2. **Bearer token vs. HTTPOnly cookie:** [Admin User Management Tech Design](../../admin/user-management/tech-design.md) §9 states "Bearer Token" for its authorization boundary, while `docs/architecture/tech-stack.md` recommends HTTPOnly/Secure/SameSite cookie storage. The Tech Design for this feature must pick one mechanism and reconcile the Admin User Management Tech Design's wording with it (or flag that document for a wording-only update).
3. **Rate limiting is additive, not a substitute:** Decision #9's account-level lockout (5 failures / 15 minutes) is a business rule enforced per account. The Business Owner also asked that the Tech Design add technical-level rate limiting per IP/source (for example, to slow distributed guessing across many accounts) as defense-in-depth. This technical control does not replace or change the account-level lockout behavior in §7.3/§15.3.
4. Session mechanism, password hashing algorithm, and CSRF protection remain to be selected in the Tech Design per `docs/architecture/tech-stack.md`.

## Follow-ups for Other Documents

Not made by this PRD; listed for the Business Owner/Tech Lead to action separately.

1. **Admin User Management PRD/Tech Design/Tasks (Ready):** add the capability for an Admin to create a Court Owner account with an initial/temporary password (Decision #2).
2. **Admin User Management PRD/Tech Design/Tasks (Ready):** reverse the existing decision "Admin may set a new password manually; no forced change on next login" — Decision #17 now requires a forced change. Update that document's Decision Log, behavior section, and task, and add the same forced-change note to Decision #2's Court Owner creation.
3. **Admin User Management Tech Design §21 (Ready):** document that setting a new password also terminates all of that user's existing sessions (Decision #14).
4. **`docs/architecture/database-schema.md` (FROZEN):** no content change needed (the column is already documented) — but its migration gap must be closed; tracked at the Tech Design Decision Gate (Handoff item 1), not here.
5. **`docs/business-rules-config-matrix.md` (FROZEN):** the following configuration keys are **proposed only** and require explicit Business Owner approval before being added, per the matrix's §11 change policy:
   - `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD` = `5`
   - `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` = `15`
   - `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` = `10080` (7 days)
   - `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER` = `43200` (30 days)
   - `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER` = `10080` (7 days)
   - `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER` = `43200` (30 days)
   - `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN` = `60` (1 hour)
   - `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN` = `480` (8 hours)

   **This PRD does not add these values to the matrix.** Please confirm before I (or the Tech Design author) do so.
6. **Skill-level catalog (§14.1):** needs a Business Owner decision on both the home document (proposed: `docs/business-rules-config-matrix.md`) and the actual catalog values. Blocks this PRD's Ready status.
7. **Future Booking / Court Owner PRDs:** once authored, reconcile Decision #21 (guest browsing of facilities/courts/prices/slots) against their content; currently both feature folders contain only `.gitkeep`.
8. **Future Player Profile PRD:** should own post-registration display/editing of full name and skill level; registration itself (this PRD) only captures them at account-creation time.

## Output Rules

This PRD complies with the negative constraints:

- No database schema, SQL, migrations, indexes, or database field definitions are created; existing frozen schema facts are referenced only.
- No API endpoints, payloads, status-code contracts, or API versioning are defined.
- No framework, library, provider, token, cookie, hashing, infrastructure, or file-structure decisions are made.
- No implementation code is included.
