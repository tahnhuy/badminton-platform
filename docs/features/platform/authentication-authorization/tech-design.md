# Feature Tech Design: Authentication & Authorization

## 1. Metadata

```text
Status: Ready
Owner: Tài + Huy
PRD: docs/features/platform/authentication-authorization/prd.md (Ready)
Scope: Auth backend module, reusable authentication/authorization/CSRF middleware, frontend auth state and route guard
Decision Status: Approved
```

The Tech Lead approved technical decisions #1–#16 on 2026-09-16. The Decision Gate on the same day added #17–#19 and confirmed the schema additions under #8 (§21.1). No technical TBD remains, and the design is consistent with the Ready PRD, so the Status stays `Ready`. Decisions #20–#25 were added on 2026-09-16 after task review, approved by Tài (Tech Lead).

Parts of the implementation also depend on [Admin User Management](../../admin/user-management/) changes that have not been made yet. Per Decision #12, that dependency does not block `Ready`; the blocked scope is listed in "Dependencies and Blocked Scope".

## 2. Context

The Auth PRD (Ready) defines registration, sign-in, sign-out, session continuity, password change, lockout, role assignment, and business-level access by role.

Current repository state (at the time this design was written; since superseded):

- `backend/src` contained only a health-check route, the Drizzle schema, and one migration. `index.ts` enabled `cors()` for every origin and parsed URL-encoded bodies.
- `frontend/src` was the unmodified Vite starter, with no router and no auth state.

This is the first backend feature module. Several Ready Admin Tech Designs ([User Management](../../admin/user-management/tech-design.md), [Court Management](../../admin/court-management/tech-design.md), [Report Management](../../admin/report-management/tech-design.md)) already assume a platform authentication boundary and an `ADMIN` role check. This design provides both.

## 3. Technical Problem

- Verify email and password, and keep a session across requests that can be revoked immediately. Account status must be re-checked on every authenticated request (PRD Decision #13). An Admin-set password must end all of that user's sessions (PRD Decision #14).
- Apply role-based idle and absolute session timeouts (PRD Decision #10). Timeouts already given to an existing session must not change when configuration changes (`docs/business-rules-config-matrix.md` §8.1, §8.7).
- Count failed sign-ins and lock accounts in persistent storage, not in memory (PRD Decision #9). Add a per-IP rate limit on top of the lockout, not instead of it (PRD Handoff item 3).
- Block every action except password change and sign-out while `must_change_password` is set (PRD §7.5). The column is documented in `database-schema.md` but missing from the migration and the Drizzle schema.
- Provide role guards that other modules can reuse, without putting contextual rules (for example, Tournament Organizer) inside the auth module.
- Give the frontend a way to know who is signed in and to guard routes.

## 4. Goals

- Define the backend auth module and the reusable `authenticate`, `requireRole`, and CSRF middleware.
- Define the API contract, including validation and the stable error-code catalog.
- Define the session, cookie, lockout, and forced-password-change state flows.
- Define the frontend auth state, HTTP client behavior, and route guard.
- Define the schema delta, seed data, and migration order.
- Map every PRD §15 acceptance criterion to a test.

## 5. Non-Goals

- Contextual or resource-level authorization (Tournament Organizer, own-facility checks). Each feature's service layer owns these; this module only provides identity and system role.
- The Admin-facing endpoints that create a Court Owner account and set a user's password. [Admin User Management](../../admin/user-management/) owns them. This module only exposes the service functions they must call (§7.2).
- Email marketing, SMS OTP, changing the account email, and OAuth/MFA. Email OTP registration, password recovery and withdrawal PIN reset are added by `docs/architecture/plans/email-otp-and-withdrawal-pin-plan.md` (2026-11-24).
- Choosing test tooling. It is set project-wide in `tech-stack.md` (Decision #14).

## 6. Upstream References

- Governing PRD: [prd.md](prd.md) (Ready)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §4
- Global documentation rules: `docs/documentation-guide.md` §6.3, §9, §10
- Global architecture/technology: `docs/architecture/tech-stack.md` (Authentication and Authorization Approach, Validation Strategy, Architectural Constraints)
- Global coding/API conventions: `docs/architecture/conventions.md` (Naming, Backend, API, Security Coding Practices, Configuration)
- Business rules/configuration: `docs/business-rules-config-matrix.md` §1.2, §8.1, §8.7
- Global database schema: `docs/architecture/database-schema.md` §3.1, §3.2, §3.26, §3.27, §3.28, §5.12, §6
- Reference Tech Design: [Admin User Management](../../admin/user-management/tech-design.md) (Ready), used for the API namespace `/api/v1` and the success/error response shapes.

How conflicts between references are handled:

| Conflict | Handling |
| --- | --- |
| `tech-stack.md` recommended JWT with access and refresh tokens and left password hashing TBD | Resolved: `tech-stack.md` updated on 2026-09-16 to match Decisions #1–#6 and #16 (Decision Gate). |
| Admin User Management Tech Design §9 says "Bearer Token", and §11 says "session/JWT" | Superseded by Decision #2. Wording update is listed in Follow-ups. |
| Admin Tournament Management Tech Design §5 says "JWT-based authentication follows the current documented direction" | Wording update is listed in Follow-ups. |
| Admin User Management PRD and Tech Design say there is no forced password change, but Auth PRD Decision #17 requires one | Cross-document dependency, handled by Decision #12. See "Dependencies and Blocked Scope". |
| `conventions.md` said the validation library and the authentication mechanism were TBD | Resolved: `conventions.md` updated on 2026-09-16 (Zod; authentication API conventions). |

## 7. Proposed Technical Design

### 7.1 Backend structure

File names follow the kebab-case rule in `conventions.md`.

```text
backend/src/
  index.ts                          # startup: env validation, then listen
  app.ts                            # builds the Express app (middleware, routes, error handler); does not listen
  routes/auth/authRoutes.ts         # /api/v1/auth/*
  routes/skill-levels/skillLevelRoutes.ts   # GET /api/v1/skill-levels (public, no session)
  controllers/auth/AuthController.ts        # HTTP parsing and response shaping only
  controllers/skill-levels/SkillLevelController.ts
  services/auth/AuthService.ts              # register, sign-in, lockout, sessions, password change, service hooks for Admin
  services/auth/password-hasher.ts          # NFKC normalization, HMAC-SHA-256 pepper pre-hash + bcryptjs; dummy hash for timing equalization
  repositories/auth/AuthRepository.ts       # queries on users, player_profiles, skill_levels, auth_sessions, auth_login_lockouts
  repositories/skill-levels/SkillLevelRepository.ts  # reads skill_levels ordered by rank
  validation/auth.ts                        # Zod request schemas and issue-to-error-code mapping
  middleware/auth.middleware.ts             # session lookup, status re-check, forced-change gate, requireRole; attaches req.user
  middleware/csrf.middleware.ts             # double-submit cookie check
  middleware/error.middleware.ts            # centralized error handler, conventions.md error shape
  middleware/rate-limit.middleware.ts       # express-rate-limit instances for auth routes
  utils/session-cookie.ts                   # set/clear sid and csrf_token cookies; readCookie helper
  utils/password.ts                         # password hashing entry point
  errors/AppError.ts                        # application error carrying code, HTTP status, details
  scripts/create-admin.ts                   # operator-only Admin provisioning (Decision #19); not an HTTP route
  shared/config/
    env.ts                        # Zod-validated environment config, loaded once at startup
    system-config.ts              # typed reader for the AUTH_* keys in SYSTEM_CONFIGS, 60-second cache
```

The backend follows the layer-first, capability-namespaced structure defined in `docs/architecture/conventions.md` (Project Structure → Backend). Earlier drafts of this Tech Design described a `modules/auth/` layout; that structure has been superseded and no `modules/` directory exists.

### 7.2 Contract for other modules

- `authenticate`: put on every protected route. It attaches `req.user = { id, email, role }`, or rejects the request (§8.5).
- `requireRole(...roles)`: put after `authenticate`. It rejects other roles with `403 AUTH_FORBIDDEN_ROLE`. Example: `router.get('/admin/users', authenticate, requireRole('ADMIN'), controller.list)`.
- CSRF check: mounted once at app level for `/api/v1`, so feature modules cannot forget it (§8.6).
- Public routes (tournament list, facility browsing, PRD §7.8) do not use `authenticate`. Their owning modules decide that.
- Contextual rules (Organizer, own facility) stay in the owning feature's service layer.
- Service functions for [Admin User Management](../../admin/user-management/), to be called by its endpoints once they exist:
  - `authService.createCourtOwnerAccount({ email, initialPassword, businessName, phone })`: creates `users` (`COURT_OWNER`, `ACTIVE`, `must_change_password = true`) and `court_owner_profiles` in one transaction.
  - `authService.adminSetPassword(userId, newPassword)`: updates `password_hash`, sets `must_change_password = true`, revokes every `auth_sessions` row of the user, and clears the user's lockout (`failed_attempts = 0`, `locked_until = NULL`), all in one transaction (Decision #17).
- Internal function, not available to other modules or over HTTP: `authService.createAdminAccount({ email, password })`, used only by the operator script (Decision #19).

### 7.3 Persistence boundary

- Reads and writes `users`, `player_profiles`, `court_owner_profiles`, `auth_sessions`, and `auth_login_lockouts`.
- Reads `skill_levels` and `system_configs`.
- All eight `AUTH_*` values come from `system_configs` through `system-config.ts`; none are hard-coded. If a row is missing, the reader uses the default documented in `docs/business-rules-config-matrix.md` §8.7 and logs a warning (§12).
- A stored `AUTH_*` value that is not a positive integer is handled like a missing row: the reader uses the matrix §8.7 default and logs at ERROR level with the key and the stored value (Decision #22).
- All queries go through Drizzle with parameterized values.

### 7.4 Sessions, cookies, and origin (Decisions #2, #3, #4)

- **Session token:** 32 random bytes from `node:crypto`, encoded base64url, sent only in a cookie. The database stores the SHA-256 hex digest in `auth_sessions.token_hash`, so a database leak alone does not give usable tokens.
- **`sid` cookie:** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age` equal to the seconds left until `expires_at`. The cookie persists across browser restarts, because PRD §7.4 says durations apply "regardless of device or browser-close behavior".
- **`csrf_token` cookie:** 32 random bytes, base64url, readable by JavaScript (not HttpOnly), with the same `Secure; SameSite=Lax; Path=/; Max-Age` as `sid`. Issued on register, sign-in, and `GET /auth/me` when missing. Cleared on sign-out.
- **`Secure` flag:** always set in production. `http://localhost` is a secure context in current browsers, so local development works with it. The `COOKIE_SECURE` environment variable may turn it off only when `NODE_ENV` is not `production`.
- **Same origin:**
  - In development, the Vite dev server proxies `/api` to `http://localhost:3000`.
  - In production, the frontend and `/api` are served from one origin.
  - The global `app.use(cors())` is removed, and no CORS headers are sent.
- **Reading cookies:** `session-cookie.ts` contains a small parser for the `Cookie` header that reads only `sid` and `csrf_token`. Setting and clearing use Express's built-in `res.cookie` and `res.clearCookie`. No `cookie-parser` dependency is added (§18).
- **JSON only:** auth routes accept only `Content-Type: application/json`. Any other body is rejected with `400 VALIDATION_FAILED`. With no CORS, a cross-site HTML form cannot post to sign-in or register (login CSRF).

### 7.5 Frontend design (Decisions #6, #7)

```text
frontend/
  vite.config.ts                    # server.proxy: '/api' → 'http://localhost:3000'
  src/
    main.tsx                        # AuthProvider + RouterProvider
    app/
      router.tsx                    # react-router-dom route table
      role-home.ts                  # role → starting route
    shared/
      api/http-client.ts            # fetch wrapper: JSON, CSRF header, error-code handling
      auth/require-auth.tsx         # route guard
    features/auth/
      auth-api.ts                   # register, signIn, signOut, me, changePassword, listSkillLevels
      auth-provider.tsx             # React Context: auth state and actions
      use-auth.ts
      sign-in-page.tsx
      register-page.tsx
      change-password-page.tsx
      access-denied-page.tsx
```

Auth state:

```text
loading → unauthenticated | authenticated | passwordChangeRequired
```

- **Start-up:** the app calls `GET /auth/me` once.
  - `200` → `authenticated`, or `passwordChangeRequired` when `requiresPasswordChange` is `true`.
  - `401` → `unauthenticated`.
- **HTTP client:**
  - Every `POST`, `PUT`, `PATCH`, and `DELETE` sends `X-CSRF-Token` with the value of the `csrf_token` cookie.
  - `401 AUTH_SESSION_INVALID` or `401 AUTH_SESSION_EXPIRED` → state becomes `unauthenticated`; go to `/sign-in` and show "session ended".
  - `403 AUTH_PASSWORD_CHANGE_REQUIRED` → state becomes `passwordChangeRequired`.
  - `403 AUTH_CSRF_TOKEN_INVALID` → call `GET /auth/me` once to refresh the cookie, then retry the request once.
- **`RequireAuth` guard (optional `roles` prop):**
  - `loading` → show a loading state; do not redirect.
  - `unauthenticated` → redirect to `/sign-in`.
  - `passwordChangeRequired` → redirect to `/change-password`. Only that page and sign-out stay reachable.
  - `authenticated` with a role not in `roles` → show the access-denied page, not the sign-in page (PRD §7.8).
- **After sign-in or register:** go to `/change-password` when required. Otherwise go to the role's starting route: `PLAYER` → `/feed` (SH01, human-approved 2026-11-18), `COURT_OWNER` → `/owner`, `ADMIN` → `/admin`. The Player index `/` redirects to `/feed`; role authorization and forced-password handling are unchanged.
- **Register page:** loads the options from `GET /api/v1/skill-levels` and shows each level's name and description in rank order (Decision #23).
- **Messages:** chosen by `error.code`, never by the server `message`.
  - `AUTH_INVALID_CREDENTIALS` → "Email hoặc mật khẩu không đúng" (PRD §9).
  - `AUTH_ACCOUNT_RESTRICTED` → account is restricted; contact support.
  - `AUTH_ACCOUNT_LOCKED` → temporarily locked, with the approximate unlock time from `details[0].lockedUntil`.
  - Field errors → taken from `details`.
- **Support contact:** the sign-in page shows it from `VITE_SUPPORT_CONTACT`. Operations supplies the text (PRD Decision #23).
- Frontend guards only shape the user experience. The server enforces every access rule (`conventions.md`).

## 8. Behavior, State, and Flow

### 8.1 Registration (PRD §6.1, §7.1)

```text
POST /auth/register
  → IP rate limit (§11)
  → Zod: strict body (unknown keys such as "role" rejected); email trimmed and lowercased
  → skill_levels lookup by code → missing → 400 AUTH_INVALID_SKILL_LEVEL
  → email already used by any users row, including soft-deleted → 409 AUTH_EMAIL_ALREADY_REGISTERED
  → hash password (§11)
  → one transaction: insert users (PLAYER, ACTIVE, must_change_password = false)
                     + player_profiles + auth_sessions
  → unique-violation on email inside the transaction → 409 AUTH_EMAIL_ALREADY_REGISTERED
  → set sid and csrf_token cookies → 201
```

- The role is always set to `PLAYER` by the server; the request cannot supply it.
- Postcondition: all three rows exist, or none do.

### 8.2 Court Owner account creation (PRD §6.2)

This module does not provide an endpoint. The Admin User Management endpoint must call `authService.createCourtOwnerAccount` (§7.2), which applies the same email normalization and password policy as registration. Blocked until Admin User Management adds the capability ("Dependencies and Blocked Scope").

### 8.3 Sign-in (PRD §6.3, §7.3, §7.7)

```text
POST /auth/login
  → IP rate limit (§11)
  → Zod; email trimmed and lowercased
  → look up users by email
  → not found, or deleted_at IS NOT NULL
      → run the same HMAC + bcrypt comparison against a fixed dummy hash
      → 401 AUTH_INVALID_CREDENTIALS; auth_login_lockouts is neither read nor written (Decision #18)
  → lockout check (§8.4): locked → 429 AUTH_ACCOUNT_LOCKED (password is not checked)
  → verify password
  → wrong → record failure (§8.4) → 401 AUTH_INVALID_CREDENTIALS
  → correct → clear failures (§8.4)
  → status SUSPENDED or DEACTIVATED → 403 AUTH_ACCOUNT_RESTRICTED
  → delete this user's auth_sessions rows that are revoked or past expires_at (cleanup, §10.4)
  → insert auth_sessions:
      idle_timeout_minutes = AUTH_SESSION_IDLE_TIMEOUT_MINUTES_<ROLE>
      expires_at           = now() + AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_<ROLE>
      last_seen_at         = now()
  → set sid and csrf_token cookies
  → 200 { data: { id, email, role, requiresPasswordChange } }
```

- The three `401 AUTH_INVALID_CREDENTIALS` branches (unknown email, wrong password, soft-deleted account) return byte-identical bodies. The unknown-email and soft-deleted branches run the dummy comparison so response time matches, and a soft-deleted account can never reach the locked response (PRD Decision #16). Only server logs record the real reason (§19).
- `429 AUTH_ACCOUNT_LOCKED` carries a `Retry-After` header and `details: [{ "lockedUntil": "<ISO-8601>" }]`, because PRD §9 requires showing roughly when the account unlocks.
- The lock response exists only for existing, non-deleted accounts, so it confirms that such an account exists. Account-existence exposure is already accepted in PRD §12 and Decision #22.

### 8.4 Lockout state (PRD Decision #9, §7.3)

```text
[no row] or failed_attempts < threshold, locked_until IS NULL
   │ wrong password → failed_attempts + 1
   │ failed_attempts reaches AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD
   ▼
[locked] locked_until = now() + AUTH_FAILED_LOGIN_LOCKOUT_MINUTES   (snapshotted)
   │ any attempt while locked_until > now() → 429; password not checked; counter unchanged
   │ locked_until <= now()
   ▼
[lock expired] → treated as failed_attempts = 0, locked_until = NULL before evaluating the attempt

correct password while not locked → failed_attempts = 0, locked_until = NULL
Admin sets a new password (any state) → failed_attempts = 0, locked_until = NULL   (Decision #17)
```

- **Atomic write:** a failure is recorded with one upsert on `auth_login_lockouts (user_id)`. In that single statement it resets an expired lock, increments the counter, and sets `locked_until` only on the transition into the locked state.
- **Expiry resets the counter.** PRD §7.3 says the account "auto-unlocks" after "5 consecutive" failures. If expiry did not reset the counter, one more wrong attempt right after unlock would lock the account again.
- **Attempts during a lock** are not counted and the password is not checked, so a locked account cannot be used to test whether a password is correct.
- **Threshold changes** apply to the next recorded failure. An existing `locked_until` keeps its snapshotted value (matrix §8.1).
- **Admin-set password** clears the lock immediately, so a user who forgot their password can sign in with the new one without waiting (PRD Decision #26).
- **Soft-deleted accounts** never enter this state machine (Decision #18, §8.3).

### 8.5 Authenticated request

```text
authenticate middleware:
  sid cookie missing or malformed → 401 AUTH_SESSION_INVALID
  one query: auth_sessions JOIN users ON users.id = auth_sessions.user_id
             WHERE token_hash = sha256(sid) AND revoked_at IS NULL
  → no row, or expires_at <= now() → 401 AUTH_SESSION_INVALID
  → last_seen_at + idle_timeout_minutes <= now() → 401 AUTH_SESSION_EXPIRED
  → users.deleted_at IS NOT NULL or users.status <> 'ACTIVE' → 401 AUTH_SESSION_INVALID
  → users.must_change_password AND route not in {GET /auth/me, POST /auth/password/change}
      → 403 AUTH_PASSWORD_CHANGE_REQUIRED
  → attach req.user; if last_seen_at is older than 60 seconds, update it
```

- **Idle timeout:** uses the value snapshotted on the session, so a configuration change does not shorten or extend existing sessions (matrix §8.7).
- **Invalid session responses:** every `401` from this middleware also clears `sid` and `csrf_token`.
- **Why status and deletion return `AUTH_SESSION_INVALID`:** so the response does not reveal which condition failed. This applies PRD Decision #13 on every request.
- **Throttled `last_seen_at` update:** idle time is measured with up to 60 seconds of error, which is negligible against 1-hour and 7-day timeouts.

### 8.6 CSRF check (Decision #3)

```text
app-level, on POST/PUT/PATCH/DELETE under /api/v1:
  path is /auth/register or /auth/login → skip (no session yet; JSON-only + no CORS, §7.4)
  no sid cookie → skip (nothing to protect)
  X-CSRF-Token header missing, or not equal to csrf_token cookie (constant-time compare)
    → 403 AUTH_CSRF_TOKEN_INVALID
```

### 8.7 Sign-out (PRD §6.5, §7.6)

```text
POST /auth/logout (CSRF check applies; authenticate is not required)
  → sid present → set revoked_at = now() on the matching row, if any
  → clear sid and csrf_token → 204
```

- Idempotent: an unknown, revoked, or missing session still returns `204`.
- Other sessions of the same user are untouched (PRD Decision #12).

### 8.8 Admin sets a new password (PRD §6.8, §7.7)

`authService.adminSetPassword` (§7.2) applies the password policy, updates `password_hash`, sets `must_change_password = true`, revokes all of the user's sessions, and clears the user's lockout, in one transaction (Decision #17, PRD Decision #26). The next request from any old session gets `401 AUTH_SESSION_INVALID`, and the user can sign in with the new password at once, even if the account was locked. Blocked until Admin User Management calls this function ("Dependencies and Blocked Scope").

### 8.9 Password change (PRD §6.9, §7.5)

```text
POST /auth/password/change (authenticate; allowed while must_change_password; CSRF check applies)
  → IP rate limit (§11)
  → Zod (new password policy)
  → verify currentPassword → wrong → 400 AUTH_CURRENT_PASSWORD_INCORRECT
  → update password_hash, set must_change_password = false
  → 200 { data: { id, email, role, requiresPasswordChange: false } }
```

- Other sessions of the user are **not** revoked, and the current session continues (Decision #13). The PRD requires session revocation only when an Admin sets the password (PRD Decision #14).
- Client behavior (PRD Decision #27, 2026-11-18): after a `200`, the frontend calls `POST /auth/logout` for the current session and opens sign-in with a success notice, for both self-service and forced changes. The endpoint contract above is unchanged.
- A wrong current password does not count toward sign-in lockout, because lockout applies to sign-in attempts (PRD §7.3). Abuse is limited by the IP rate limit.

## 9. API Design

Auth endpoints use `/api/v1/auth`; the skill-level catalog uses `/api/v1/skill-levels`. Requests and responses are JSON. Success responses use `{ data: ... }`, except `204`. Errors use the `conventions.md` shape: `{ "error": { "code", "message", "details" } }`.

### 9.1 Endpoints

| Operation | Method and path | Guards | Request | Success |
| --- | --- | --- | --- | --- |
| Start registration | `POST /auth/register` | IP rate limit | `{ email, password, fullName, phone?, withdrawalPin, withdrawalPinConfirm, skillSurvey, previousChallengeId? }` | `202 { data: { challengeId, expiresAt, resendAvailableAt } }`; no session yet |
| Verify registration | `POST /auth/register/verify` | IP rate limit | `{ challengeId, otp }` | `201 { data: AuthUser, meta: { skillSurveyResult } }` + `sid`, `csrf_token` cookies |
| Resend registration OTP | `POST /auth/register/resend` | IP rate limit | `{ challengeId }` | `200 { data: RegistrationChallenge }` |
| Forgot password | `POST /auth/password/forgot` | IP rate limit | `{ email }` | `200 { data: RegistrationChallenge }`; same shape for every email |
| Verify password reset OTP | `POST /auth/password/reset/verify` | IP rate limit | `{ challengeId, otp }` | `200 { data: { resetToken, expiresAt } }` |
| Resend password reset OTP | `POST /auth/password/reset/resend` | IP rate limit | `{ challengeId }` | `200 { data: RegistrationChallenge }` |
| Reset password | `POST /auth/password/reset` | reset token | `{ resetToken, newPassword }` | `200 { data: { success: true } }`; revokes sessions |
| Sign in | `POST /auth/login` | IP rate limit | `{ email, password }` | `200 { data: AuthUser }` + `sid`, `csrf_token` cookies |
| Sign out | `POST /auth/logout` | CSRF when `sid` present | none | `204`, cookies cleared |
| Current user | `GET /auth/me` | `authenticate` | none | `200 { data: AuthUser }`; issues `csrf_token` if missing |
| Change password | `POST /auth/password/change` | `authenticate`, CSRF, IP rate limit | Forced first change: `{ currentPassword, newPassword }`; voluntary: `{ currentPassword, newPassword, resetToken }` | `200 { data: AuthUser }` |
| Request change OTP | `POST /auth/password/change/request` | `authenticate`, CSRF, IP rate limit | none | `200 { data: RegistrationChallenge }`; not available while `must_change_password` |
| Verify change OTP | `POST /auth/password/change/verify` | `authenticate`, CSRF, IP rate limit | `{ challengeId, otp }` | `200 { data: { resetToken, expiresAt } }` |
| Resend change OTP | `POST /auth/password/change/resend` | `authenticate`, CSRF, IP rate limit | `{ challengeId }` | `200 { data: RegistrationChallenge }` |
| List skill levels | `GET /api/v1/skill-levels` | none (public) | none | `200 { data: [{ code, name, rank, description }] }`, ordered by `rank` ascending (Decision #23) |

`AuthUser` = `{ id, email, role, requiresPasswordChange }`. `password_hash`, tokens, and lockout data are never returned.

`GET /auth/me` is not named in the PRD. It adds no business behavior: it returns the caller's own identity so the frontend can restore state, because it cannot read the HttpOnly cookie.

### 9.2 Request validation (Zod)

| Field | Rule | Field error code |
| --- | --- | --- |
| `email` | string; trimmed; lowercased; valid email format; at most 254 characters | `VALIDATION_FAILED` |
| `password` (register), `newPassword` | string; normalized to Unicode NFKC; 8–64 code points after normalization; not equal to the normalized email, compared case-insensitively (PRD Decision #8) | `AUTH_PASSWORD_POLICY_VIOLATION` |
| `password` (login), `currentPassword` | non-empty string, at most 1024 characters; normalized to NFKC before verification. Sign-in does not apply the policy, so existing passwords keep working if the policy changes. | `VALIDATION_FAILED` |
| `fullName` | string; trimmed; 1–255 characters (technical guard) | `VALIDATION_FAILED` |
| `withdrawalPin` | string; exactly 6 digits; weak patterns (`000000`, `123456`, repeated or sequential) rejected; must equal `withdrawalPinConfirm` | `VALIDATION_FAILED` / `WALLET_PIN_WEAK` |
| OTP fields | `challengeId` non-empty (≤64), `otp` exactly 6 digits | `VALIDATION_FAILED` |
| `skillLevelCode` | non-empty string, then checked against `skill_levels.code` in the database, so catalog changes need no code change *(superseded by the survey extension; the field is rejected with `AUTH_REGISTRATION_FORM_OUTDATED`)* | `AUTH_INVALID_SKILL_LEVEL` |
| Any unknown key, or non-JSON body | rejected (`.strict()`) | `VALIDATION_FAILED` |

- **Top-level code (Decision #21):** if every failing field has the same code, that code is the top-level `error.code`. Otherwise the top-level code is the global `VALIDATION_FAILED` (`conventions.md`, Global Error Codes).
- **Password normalization (Decision #24):** every password is normalized to Unicode NFKC before the policy check and before hashing or verification. Composed and decomposed forms of the same Vietnamese letter, and compatibility characters such as full-width letters, therefore give the same result.
- `details` lists `{ field, code }` for every failing field and never echoes submitted values.

### 9.3 Error-code catalog (Decision #9)

| Code | HTTP | Raised by | Meaning |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | 400 | validation | Malformed or unexpected input, or failing fields with different codes. Global code (`conventions.md`). |
| `AUTH_PASSWORD_POLICY_VIOLATION` | 400 | register, change password | Password breaks PRD Decision #8 |
| `AUTH_INVALID_SKILL_LEVEL` | 400 | register | Skill-level code not in catalog | *(Not raised after the registration skill survey, 2026-11-15.)*
| `AUTH_SKILL_SURVEY_OUTDATED` | 400 | register | *(2026-11-15)* Survey version is not the active version |
| `AUTH_REGISTRATION_FORM_OUTDATED` | 400 | register | *(2026-11-15)* Old form still sends `skillLevelCode` |
| `PLAYER_SKILL_SURVEY_NOT_FOUND` | 404 | own survey result | *(2026-11-22)* The signed-in Player has no survey row |
| `AUTH_SKILL_SURVEY_UNAVAILABLE` | 503 | skill survey, register | *(2026-11-15)* No active survey version |
| `AUTH_CURRENT_PASSWORD_INCORRECT` | 400 | change password | Current password is wrong |
| `AUTH_INVALID_CREDENTIALS` | 401 | sign-in | Unknown email, wrong password, or soft-deleted account (identical body) |
| `AUTH_SESSION_INVALID` | 401 | `authenticate` | Missing, revoked, absolute-expired session, or account no longer in good standing |
| `AUTH_SESSION_EXPIRED` | 401 | `authenticate` | Idle timeout reached |
| `AUTH_ACCOUNT_RESTRICTED` | 403 | sign-in | `SUSPENDED` or `DEACTIVATED`, after the correct password |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 403 | `authenticate` | `must_change_password` is set |
| `AUTH_CSRF_TOKEN_INVALID` | 403 | CSRF middleware | CSRF header missing or not matching the cookie |
| `AUTH_FORBIDDEN_ROLE` | 403 | `requireRole` | Role not allowed for the route |
| `AUTH_EMAIL_ALREADY_REGISTERED` | 409 | register | Email used by any account |
| `AUTH_ACCOUNT_LOCKED` | 429 | sign-in | Account locked; `Retry-After`, `details[0].lockedUntil` |
| `AUTH_OTP_INVALID` | 400 | OTP verify | Wrong, consumed or wrong-purpose code |
| `AUTH_OTP_EXPIRED` | 400 | OTP verify | Challenge expired |
| `AUTH_OTP_LOCKED` | 429 | OTP verify | Five wrong attempts; `details[0].lockedUntil` |
| `AUTH_OTP_RESEND_TOO_SOON` | 429 | OTP resend | 60-second resend window; `details[0].resendAvailableAt` |
| `AUTH_PASSWORD_CHANGE_OTP_REQUIRED` | 400 | change password | Voluntary change without an email-verified authorization |
| `AUTH_RESET_TOKEN_INVALID` | 400 | password/PIN reset | Token missing, expired, consumed or wrong purpose |
| `WALLET_PIN_NOT_SET` | 400 | payout | This account has no withdrawal PIN yet |
| `WALLET_PIN_INVALID` | 400 | payout | Wrong (or concurrently changed) withdrawal PIN |
| `WALLET_PIN_LOCKED` | 429 | payout | PIN-only lock; `details[0].lockedUntil`; the account stays signed in |
| `WALLET_PIN_WEAK` | 400 | registration/PIN reset | Weak 6-digit PIN |
| `WALLET_PAYOUT_IDEMPOTENCY_CONFLICT` | 409 | payout | Same `clientRequestId` reused with different details |
| `AUTH_RATE_LIMITED` | 429 | IP/email rate limiter | Too many requests; `Retry-After` |
| `INTERNAL_ERROR` | 500 | centralized error handler | Unexpected error; generic message, empty `details`. Global code (`conventions.md`). |

`429` is outside the `conventions.md` baseline set (400/401/403/404/409/500). `conventions.md` allows feature-specific mappings, and Decision #9 approves using it. Unexpected failures return `500 INTERNAL_ERROR` through the centralized error handler, with no internal details (Decision #20).

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` is the schema authority. It was updated on 2026-09-16 (its §12 Change Log).

### 10.1 Already documented, missing from code

- `users.must_change_password boolean NOT NULL DEFAULT false` (`database-schema.md` §3.1). It must be added to `backend/src/db/schema/users.ts` and to a migration. This is not a new schema decision.

### 10.2 New tables (Decision #8, added to `database-schema.md` §3.27, §3.28, §5.12)

- `auth_sessions`: `id`, `user_id`, `token_hash` (UNIQUE), `idle_timeout_minutes`, `last_seen_at`, `expires_at`, `revoked_at`, `created_at`. Index on `user_id`. `CHECK (idle_timeout_minutes > 0)`.
- `auth_login_lockouts`: `user_id` (PK), `failed_attempts`, `locked_until`, `updated_at`. `CHECK (failed_attempts >= 0)`.
- Added after the initial table approval, and explicitly confirmed by the Tech Lead at the Decision Gate on 2026-09-16 (Decision #8):
  - the `idle_timeout_minutes` column, so the idle timeout is snapshotted like `expires_at`, as matrix §8.7 requires;
  - the two `CHECK` constraints.
- The `users` table structure is not changed.

### 10.3 Seed data (Decision #11)

A custom SQL data migration in the Drizzle migration folder runs with `db:migrate`:

- `skill_levels`: the six rows from `docs/business-rules-config-matrix.md` §1.2 (`code`, `name`, `rank`, `description`), using `ON CONFLICT (code) DO NOTHING`.
- `system_configs`: the eight `AUTH_*` keys with their §8.7 defaults, `updated_by = NULL`, using `ON CONFLICT (config_key) DO NOTHING`, so a value already changed in the database is never overwritten.

### 10.4 Session row cleanup

Background jobs are TBD project-wide. At each sign-in, the user's rows that are revoked or past `expires_at` are deleted (§8.3). This keeps rows per active user bounded without a scheduler. Rows of users who never sign in again remain; this is acceptable for MVP and is noted for when a scheduler exists.

## 11. Security

- **Password hashing (Decisions #1, #16, #24, #25):**
  - Stored value = bcrypt cost 12 over `base64(HMAC-SHA-256(key, message))`, using the `bcryptjs` async API so the event loop is not blocked for the whole hash.
    - `key` = the bytes obtained by base64-decoding `PASSWORD_PEPPER` (Decision #25).
    - `message` = the UTF-8 bytes of the password after Unicode NFKC normalization (Decision #24).
  - The normalization form and the HMAC key format cannot change once passwords are stored: changing either makes every stored password unverifiable, like changing the pepper.
  - The HMAC step turns every password into 44 ASCII bytes, so bcrypt's 72-byte input limit never truncates a password allowed by PRD Decision #8. Base64 encoding avoids NUL bytes in the bcrypt input.
  - `PASSWORD_PEPPER` is at least 32 random bytes, base64-encoded, supplied only through the environment. `env.ts` refuses to start without it. It is never logged or committed; `.env.example` holds only a placeholder.
  - The pepper is fixed for the life of a deployment. Losing or changing it makes every stored password unverifiable, so it must be backed up with the other production secrets. Pepper rotation is not supported in MVP; supporting it later needs a new decision.
  - The unknown-email branch runs the same HMAC + bcrypt comparison against a fixed dummy hash, so response time does not reveal that the email is unregistered (§8.3).
- **Sessions (Decision #2):** opaque tokens, stored hashed, delivered in `HttpOnly; Secure; SameSite=Lax` cookies (§7.4). Status is re-checked on every request (§8.5). Revocation is per row: sign-out revokes one row; an Admin-set password revokes all rows of the user.
- **CSRF (Decision #3):** double-submit cookie (§8.6), plus JSON-only auth routes and no CORS (§7.4).
  - Residual risk: plain double-submit is weaker against a cookie injected from a compromised sibling subdomain. This is accepted, because the product is served from a single origin (Decision #4).
- **Origin (Decision #4):** same origin in development (Vite proxy) and in production. Open `cors()` is removed.
- **IP rate limit (Decision #5):** `express-rate-limit` with its in-memory store. Thresholds come from `env.ts`:

  | Route | Default | Environment variables |
  | --- | --- | --- |
  | `POST /auth/login` | 20 requests / 15 minutes / IP | `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_LOGIN_WINDOW_MINUTES` |
  | `POST /auth/register` | 10 requests / 60 minutes / IP | `RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_REGISTER_WINDOW_MINUTES` |
  | `POST /auth/password/change` | 10 requests / 15 minutes / IP | `RATE_LIMIT_PASSWORD_CHANGE_MAX`, `RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MINUTES` |

  - `app.set('trust proxy', …)` is driven by `TRUST_PROXY`. Enable it only behind a known reverse proxy; otherwise client IPs can be spoofed through `X-Forwarded-For`.
  - These are technical limits, not business configuration, so they are not in the matrix.
  - The counters are in memory. This does not break the `.agents/AGENTS.md` rule against in-memory cross-request state: the business lockout, which is the source of truth, is persisted (§8.4). The IP limiter is an extra throttle whose counters may reset on restart.
- **Authorization:** RBAC via `requireRole`. Contextual rules stay in feature services (§7.2).
- **Sensitive data:** passwords, raw session tokens, CSRF tokens, and `PASSWORD_PEPPER` are never logged or returned. `password_hash` is never selected into response objects.
- **Account-existence exposure:** this design adds no new exposure beyond what the PRD accepted (PRD §12, Decision #22). Unknown and soft-deleted emails get the same response and timing; the lock response for existing, non-deleted accounts was already accepted (§8.3).

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Duplicate email (any letter case, any status) | Pre-check on lowercased email; unique violation inside the transaction | `409 AUTH_EMAIL_ALREADY_REGISTERED`; nothing written | Field error on email |
| Unknown email at sign-in | No `users` row | Dummy hash compare, `401 AUTH_INVALID_CREDENTIALS` | Generic message |
| Wrong password | Hash mismatch | Failure recorded (§8.4), `401 AUTH_INVALID_CREDENTIALS` | Generic message |
| Account locked | `locked_until > now()` | `429 AUTH_ACCOUNT_LOCKED` with `Retry-After` and `lockedUntil`, even with the correct password | Locked message with approximate unlock time |
| Admin sets a new password while the account is locked | `adminSetPassword` | Lock cleared in the same transaction; sign-in with the new password succeeds at once and requires a password change (Decision #17) | User signs in without waiting |
| `SUSPENDED` or `DEACTIVATED`, correct password | `users.status` | `403 AUTH_ACCOUNT_RESTRICTED`; no session | Restricted message |
| Soft-deleted account, any password, any number of attempts | `users.deleted_at` | Dummy hash compare; `401 AUTH_INVALID_CREDENTIALS`, identical to unknown email; never locked (Decision #18) | Generic message |
| Session idle timeout | `last_seen_at + idle_timeout_minutes <= now()` | `401 AUTH_SESSION_EXPIRED`; cookies cleared | Redirect to sign-in, "session ended" |
| Session absolute expiry or revoked | `expires_at` or `revoked_at` | `401 AUTH_SESSION_INVALID`; cookies cleared | Redirect to sign-in |
| Status or deletion changed while signed in | Status check in `authenticate` | `401 AUTH_SESSION_INVALID` on the next request | Redirect to sign-in |
| Forced change pending, other route called | `must_change_password` | `403 AUTH_PASSWORD_CHANGE_REQUIRED` | Redirect to change-password page |
| Invalid skill-level code | `skill_levels` lookup | `400 AUTH_INVALID_SKILL_LEVEL` | Field error |
| Missing CSRF header or mismatch | CSRF middleware | `403 AUTH_CSRF_TOKEN_INVALID` | Client refreshes via `/auth/me` and retries once |
| IP limit exceeded | Rate limiter | `429 AUTH_RATE_LIMITED` with `Retry-After` | Client waits |
| Missing `system_configs` row | `system-config.ts` | Uses the matrix §8.7 default and logs a warning; the request succeeds | Log shows the seed gap |
| Stored `AUTH_*` value is not a positive integer | `system-config.ts` | Uses the matrix §8.7 default and logs at ERROR level with the key and the stored value; the request succeeds (Decision #22) | Log shows the misconfiguration |
| Required environment variable missing or invalid (for example `PASSWORD_PEPPER`) | `env.ts` at startup | Process refuses to start with a clear message (`conventions.md`) | Operator fixes the environment |
| Admin provisioning script given an email already in use, or a password that breaks the policy | `create-admin.ts` through `authService.createAdminAccount` | Nothing written; the script exits with a non-zero code and a message that contains no password | Operator corrects the input |
| Password longer than 72 UTF-8 bytes (multi-byte characters) | Not a failure | Whole password is used: the HMAC pre-hash reduces it to 44 bytes before bcrypt (Decision #16) | N/A |
| Unexpected error | Centralized error handler | `500 INTERNAL_ERROR` with a generic message and empty `details`; the original error is only in the server log (Decision #20) | Log |

## 13. Concurrency / Idempotency

- **Duplicate registration race:** the `users_email_unique` constraint decides. It enforces case-insensitive uniqueness because every write path stores the lowercased email: registration, `authService.createCourtOwnerAccount`, and the Admin provisioning script (Decision #19). The pre-check only improves the error message.
- **Failed-attempt race:** a single upsert statement (§8.4) prevents lost increments. `locked_until` is set only on the transition into the locked state, so concurrent failures past the threshold do not extend the lock.
- **Registration:** `users`, `player_profiles`, and `auth_sessions` are written in one transaction (`database-schema.md` §6).
- **Admin-set password:** the password update, flag, revocation of all sessions, and lockout reset happen in one transaction (`database-schema.md` §6). No request can see the new password while an old session or the old lock still applies.
- **Idempotency:**
  - Sign-out always returns `204`.
  - Revoking already-revoked rows changes nothing.
  - Seed migrations use `ON CONFLICT DO NOTHING`.

## 14. Performance

- **`authenticate`:** one indexed read per request (`auth_sessions.token_hash` unique index, joined to `users` by primary key). Writes are limited to updating `last_seen_at` at most once per 60 seconds per session.
- **`system-config.ts` (Decision #10):** caches the eight `AUTH_*` rows in process for 60 seconds.
  - A configuration change takes effect for new sessions and failures within 60 seconds.
  - Existing sessions keep their snapshots.
  - This cache only speeds up reads of rarely changing configuration; it is not the source of truth for any session or lockout state.
- **Password hashing:** the HMAC pre-hash costs almost nothing. bcrypt cost 12 in pure JavaScript is intentionally slow (hundreds of milliseconds per hash). Measure p95 sign-in latency during implementation. Changing the cost is a Tech Lead decision; existing hashes stay verifiable because the cost is stored in each hash. The IP rate limit also bounds CPU spent on hashing per client.

## 15. Events / Notifications

- `N/A`: the PRD defines no user notification for auth events, and the notification delivery mechanism is TBD project-wide.
- Audit logging is covered in §19.

## 16. Testing Considerations

Test tooling is set in `tech-stack.md` (Decision #14):

- **Unit:** Vitest.
- **Integration and API:** Vitest with Supertest, against a separate test database on the existing Docker PostgreSQL. "API" means an HTTP-level test against the Express app built by `app.ts`.
- **E2E:** Playwright, for the main flows only:
  - sign-in, including reloading the page, signing out, and then opening a guarded page;
  - forced password change;
  - role-based denial.
- "Time-controlled" means the test sets timestamps or the clock instead of waiting.

**Test-only routes:** API tests of `requireRole` use routes that exist only in the test suite. A test helper registers them on the app only when `NODE_ENV=test`. They are never registered in `app.ts` or `index.ts`, so the running application never exposes them.

| PRD AC | Scenario | Level | Verifies |
| --- | --- | --- | --- |
| 15.1-1 | Valid registration | API | `201`; `users` row is `PLAYER`/`ACTIVE`; `sid` cookie set; sign-in with the email in different letter case succeeds |
| 15.1-2 | Duplicate email, different case, active or soft-deleted | API | `409 AUTH_EMAIL_ALREADY_REGISTERED`; row count unchanged |
| 15.1-3 | Password with 7 or 65 code points, or equal to email | API | `400 AUTH_PASSWORD_POLICY_VIOLATION`; no rows written |
| 15.1-4 | Missing or malformed email | API | `400 VALIDATION_FAILED` with an `email` field error |
| 15.1-5 | Body includes `role: "ADMIN"` or `role: "COURT_OWNER"` | API | `400 VALIDATION_FAILED`; no account created |
| 15.1-6 | Unknown `skillLevelCode` | API | `400 AUTH_INVALID_SKILL_LEVEL`; no rows written |
| 15.1-7 | `skillLevelCode: "AVERAGE"` | Integration | `player_profiles.skill_level_id` points to rank 4 |
| 15.2-1, 15.2-2 | Court Owner forced change | Integration on `authService.createCourtOwnerAccount`; API once Admin User Management adds the endpoint | Blocked end to end ("Dependencies and Blocked Scope") |
| 15.3-1 | Correct credentials | API | `200`; `requiresPasswordChange: false`; cookie attributes per §7.4 |
| 15.3-2 | Wrong password | API | `401 AUTH_INVALID_CREDENTIALS`; no `sid` cookie |
| 15.3-3 | Unknown email | API | Status and body byte-identical to 15.3-2; dummy comparison executed (unit test on service) |
| 15.3-4 | `SUSPENDED` or `DEACTIVATED`, correct password | API | `403 AUTH_ACCOUNT_RESTRICTED`; no session row |
| 15.3-5 | Soft-deleted, correct password | API | Byte-identical to 15.3-2; no session row; no `auth_login_lockouts` row |
| 15.3-6 | Sixth attempt after five failures, correct password | API | `429 AUTH_ACCOUNT_LOCKED`; `Retry-After` and `lockedUntil` present |
| 15.3-7 | Correct password after lock expiry | Integration (time-controlled) | `200`; `failed_attempts = 0` |
| 15.3-8 | One failure, then success, then one failure | Integration | Not locked; counter is 1 |
| 15.3-9 | Admin sets P2: P1 fails, P2 succeeds with forced change | Integration on `authService.adminSetPassword`; API once Admin User Management calls it | Blocked end to end ("Dependencies and Blocked Scope") |
| 15.3-10 | `SUSPENDED` changed back to `ACTIVE` | API | Sign-in `200` |
| 15.3-11 | Locked account; Admin sets P2 before the lock expires | Integration on `authService.adminSetPassword`; API once Admin User Management calls it | Sign-in with P2 returns `200` with `requiresPasswordChange: true`; `failed_attempts = 0`; end-to-end blocked ("Dependencies and Blocked Scope") |
| 15.4-1 | Player session within idle and absolute limits | Integration (time-controlled) + E2E (Playwright sign-in scenario) | `GET /auth/me` returns `200`; page reload keeps the user signed in |
| 15.4-2 | Admin idle over 1 hour, or open over 8 hours | Integration (time-controlled) | `401 AUTH_SESSION_EXPIRED` (idle) or `401 AUTH_SESSION_INVALID` (absolute) |
| 15.4-3 | Sign out, then reuse the old cookie | API + E2E (Playwright sign-in scenario) | `401 AUTH_SESSION_INVALID`; UI goes to sign-in |
| 15.4-4 | Two sessions; sign out on one | API | Other session `GET /auth/me` returns `200` |
| 15.4-5 | Status set to `SUSPENDED`/`DEACTIVATED` or `deleted_at` set mid-session | Integration | Next request returns `401 AUTH_SESSION_INVALID` |
| 15.4-6 | Admin sets password; all sessions end | Integration on `authService.adminSetPassword` | Every old session returns `401`; end-to-end blocked ("Dependencies and Blocked Scope") |
| 15.5-1 | Change password with correct current password | API | `200`; old password fails at sign-in; new password succeeds; other sessions still valid |
| 15.5-2 | Change password with wrong current password | API | `400 AUTH_CURRENT_PASSWORD_INCORRECT`; hash unchanged |
| 15.6-1 | Role change | Review | No endpoint or service function changes `users.role` |
| 15.6-2 | Court Owner account on Player-only routes | Unit on `requireRole` + API with test-only routes here; API in each Player feature's Tech Design | `403 AUTH_FORBIDDEN_ROLE` |
| 15.6-3 | Visitor calls a protected route or opens a guarded page | API (`GET /auth/me`, `POST /auth/password/change`) + E2E (Playwright sign-in scenario, after sign-out) | `401`; UI redirects to `/sign-in` |
| 15.6-4 | Visitor browses public tournament or facility pages | Owned by Tournament/Booking Tech Designs | Those routes do not use `authenticate` |
| 15.6-5 | `PLAYER` or `COURT_OWNER` on an Admin route | Unit on `requireRole` + API with test-only routes + E2E (Playwright role-denial scenario); API on the first Admin User Management route | `403 AUTH_FORBIDDEN_ROLE`; E2E shows the access-denied page |
| 15.6-6 | `ADMIN` on Player-only actions | Unit on `requireRole` + API with test-only routes here; API in each Player feature's Tech Design | `403 AUTH_FORBIDDEN_ROLE` |
| 15.6-7 to 15.6-9 | Organizer rules | Owned by the Tournament Tech Design (§5) | — |

Technical checks beyond the PRD acceptance criteria:

- **Forced change:** with `must_change_password = true`, any route other than `/auth/me` and `/auth/password/change` returns `403 AUTH_PASSWORD_CHANGE_REQUIRED`, and sign-out still returns `204`. The Playwright forced-password-change scenario checks that, after sign-in, only the change-password page is reachable until the change succeeds.
- **CSRF:**
  - A mutating request with `sid` but a missing or wrong `X-CSRF-Token` returns `403 AUTH_CSRF_TOKEN_INVALID`.
  - Register and sign-in without CSRF are accepted.
- **Content type:** a non-JSON body to sign-in or register returns `400 VALIDATION_FAILED`.
- **Cookies:** `sid` is `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`, with `Max-Age` matching `expires_at`. `csrf_token` is not HttpOnly. The stored `token_hash` differs from the cookie value.
- **Rate limit:**
  - The 21st sign-in from one IP within 15 minutes returns `429 AUTH_RATE_LIMITED`.
  - Five wrong passwords below that limit still lock the account.
- **Lock expiry:** after the lock expires, one wrong password does not re-lock the account.
- **Soft-deleted accounts:** six wrong passwords in a row still return `401 AUTH_INVALID_CREDENTIALS`, never `429`, and create no `auth_login_lockouts` row.
- **Admin provisioning script:**
  - `Admin@Example.com` is stored as `admin@example.com`, and sign-in succeeds with either letter case.
  - An email already in use, or a password that breaks the policy, writes nothing and exits with a non-zero code.
  - The password is read from standard input, never from a command-line argument, and is never printed.
- **Concurrency:** two parallel wrong-password requests raise `failed_attempts` by exactly 2.
- **Snapshots:**
  - Changing `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` does not change an existing session's `idle_timeout_minutes`.
  - A missing configuration row falls back to the matrix default and logs a warning.
- **Seed migration:** running it twice creates no duplicates and does not overwrite a changed configuration value.
- **Password pre-hash:**
  - A 64-character Vietnamese password with diacritics (more than 72 UTF-8 bytes) registers and signs in.
  - A second password identical in its first 72 bytes but different afterward fails sign-in.
  - The app refuses to start without `PASSWORD_PEPPER`.
- **Password normalization and HMAC key:**
  - A Vietnamese password registered in composed form signs in when typed in decomposed form, and the reverse.
  - The pre-hash input equals `base64(HMAC-SHA-256(base64-decoded PASSWORD_PEPPER, UTF-8 of NFKC(password)))`, checked against an independent computation.
- **Validation codes:** a malformed email plus a 7-character password returns `400 VALIDATION_FAILED`, with `details` listing `email` (`VALIDATION_FAILED`) and `password` (`AUTH_PASSWORD_POLICY_VIOLATION`).
- **Invalid configuration:** with `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` stored as `'abc'` or `'0'`, sign-in uses the default, and an ERROR log line names the key and the stored value.
- **Skill-level catalog:** `GET /api/v1/skill-levels` without a session returns the six rows in rank order.
- **Unexpected error:** returns `500 INTERNAL_ERROR` with no internal details.
- **Responses and logs:** no response contains `password_hash`, a raw token, or a CSRF token; no log line contains a password, raw token, or `PASSWORD_PEPPER`.

## 17. Migration / Rollout

1. Add the dependencies approved in `tech-stack.md` on 2026-09-16. Backend: `zod`, `bcryptjs`, `express-rate-limit`. Frontend: `react-router-dom`. Test tooling: `vitest`, `supertest`, `@types/supertest` (backend) and `@playwright/test`.
2. Migration: add `users.must_change_password` (§10.1).
3. Migration: create `auth_sessions` and `auth_login_lockouts` with their indexes and checks (§10.2).
4. Data migration: seed `skill_levels` and `system_configs` (§10.3).
5. Backend wiring, in `app.ts` (building the app) and `index.ts` (starting it):
   - Validate environment config at startup.
   - Remove open `cors()`.
   - Mount the CSRF middleware for `/api/v1`, the auth routes, and the centralized error handler.
   - Keep URL-encoded parsing away from auth routes.
6. Frontend wiring: Vite proxy, router, `AuthProvider`, `http-client`, pages.
7. Environment examples: add `PASSWORD_PEPPER` (placeholder only), `COOKIE_SECURE`, `TRUST_PROXY`, `RATE_LIMIT_*` to `backend/.env.example`, and `VITE_SUPPORT_CONTACT` to the frontend.
8. Operations:
   - Before the first deployment, generate `PASSWORD_PEPPER` (at least 32 random bytes) and back it up with the production secrets. Never change it on an environment that already has passwords (§11).
   - Before Admin routes can be exercised, an operator provisions at least one Admin account outside the product (PRD Decision #3) by running `npm run admin:create --prefix backend` (Decision #19):
     - The script loads the same validated environment config (`env.ts`), takes the email as an argument, and reads the password from standard input, so the password never lands in shell history.
     - It calls `authService.createAdminAccount`, which trims and lowercases the email, applies the password policy, hashes with the pepper, and inserts `users` with role `ADMIN`, status `ACTIVE`, and `must_change_password = false`. PRD Decision #17 forces a change only for passwords that an Admin sets.
     - It refuses an email already in use, and it is not reachable over HTTP.

- **Sequencing:** this module ships before any module that uses `authenticate` or `requireRole`.
- **Backward compatibility:** no API consumers exist today (only `/health`). Removing open CORS affects no existing client.
- **Rollback:**
  - Drop `auth_sessions` and `auth_login_lockouts`, and the `must_change_password` column.
  - `skill_levels` seed rows can be removed only while no `player_profiles` row references them.
  - `system_configs` rows can be removed safely.

## 18. Alternatives Considered

| Topic | Chosen | Rejected | Reason |
| --- | --- | --- | --- |
| Session mechanism (Decision #2) | Opaque server-side session in HttpOnly cookie | JWT access and refresh tokens | PRD Decisions #13 and #14 need a database check per request anyway, so JWT would add refresh rotation without its stateless benefit |
| Password hashing (Decision #1) | bcrypt (`bcryptjs`) | Argon2id | No native build step; the 72-byte input limit is handled by Decision #16 |
| Passwords over 72 bytes (Decision #16) | HMAC-SHA-256 pepper pre-hash | "At most 72 UTF-8 bytes" rule; Argon2id | The byte rule contradicts PRD Decision #8; Argon2id needs a native build |
| CSRF (Decision #3) | Double-submit cookie | Synchronizer token | No extra storage; single-origin deployment limits the residual risk |
| Origin (Decision #4) | Same origin | CORS with credentials across origins | Keeps `SameSite=Lax` and no-CORS protections; requires same-origin deployment |
| IP rate limit (Decision #5) | `express-rate-limit`, in memory | Database counter | Matches a single-instance monolith; revisit if multi-instance |
| Frontend router (Decision #6) | `react-router-dom` | TanStack Router | Most established |
| Frontend auth state (Decision #7) | React Context | TanStack Query | No new dependency |
| Lockout storage (Decision #8) | Separate `auth_login_lockouts` table | Columns on `users` | Leaves the `users` table unchanged |
| Configuration read (Decision #10) | 60-second in-process cache | Database read per use | Avoids an extra query per request |
| Seed data (Decision #11) | Data migration | Manual seed script | Every environment gets the data |
| Cookie parsing | Small internal parser for two cookies | `cookie-parser` package | Avoids an unapproved dependency |
| Admin-set password on a locked account (Decision #17) | Clear the lock | Keep the lock until it expires | The forgotten-password flow (PRD §6.10) would fail for the users who need it most |
| Soft-deleted accounts and lockout (Decision #18) | Treat like an unknown email | Apply the lockout | The lock response would reveal that a deleted account exists, against PRD Decision #16 |
| Admin provisioning (Decision #19) | Operator script using `authService` | Written procedure only; `CHECK (email = lower(email))` on `users` | A written procedure can be followed wrongly; the CHECK would change the FROZEN `users` table |

## 19. Observability / Monitoring

- **Logs:** one structured server log line per event, with user ID when known, IP, and outcome.
  - Sign-in attempts, with the real reason: `unknown_email`, `wrong_password`, `locked`, `suspended`, `deactivated`, `soft_deleted`, or `success`.
  - Registration results.
  - Lock entered.
  - Session revoked, with the trigger: sign-out or Admin-set password.
  - CSRF rejections.
  - Rate-limit hits.
  - Configuration fallback: WARN for a missing row, ERROR for an invalid value, with the key and the stored value.
  - Same pattern as the Admin User Management Tech Design §19 audit logs.
- **Never logged:** passwords, raw session tokens, CSRF tokens, `password_hash`, `PASSWORD_PEPPER`.
- **Metrics:** `N/A`. No metrics tool is approved.
- **Alerts:** `N/A`. Observability tooling is TBD project-wide.

## 20. Acceptance / Verification Considerations

- **Given** a database migrated and seeded per §17
  **When** a visitor registers with valid input and then calls `GET /auth/me` with the returned cookies
  **Then** `200` returns the new account without a separate sign-in.

- **Given** an account locked after five failures
  **When** `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` passes and the user signs in with the correct password
  **Then** sign-in succeeds and `failed_attempts` is 0.

- **Given** a signed-in user with `must_change_password = true`
  **When** they call any route other than `GET /auth/me` or `POST /auth/password/change`
  **Then** the response is `403 AUTH_PASSWORD_CHANGE_REQUIRED`, and after a successful password change the same route is allowed.

Verification also requires:

- The migrations in §17 apply cleanly to a copy of the current database.
- Every error code in §9.3 is produced by at least one test.
- Every technical check in §16 passes.

## 21. Decisions and Open Questions

### 21.1 Decision Log

All decisions below were made on **2026-09-16** by the **Tech Lead**, except #17, which was made together with the **Business Owner**. #17–#19 and the confirmation recorded in #8 come from the Decision Gate. #20–#25 come from the task review, approved by Tài (Tech Lead).

| # | Question | Decision | Reason |
| --- | --- | --- | --- |
| 1 | Password hashing algorithm | bcrypt via `bcryptjs`, cost 12, async API | Pure JavaScript, no native build step; simpler build and deployment. Trade-off accepted: weaker than Argon2id against GPU cracking. Its 72-byte input limit is handled by Decision #16. |
| 2 | Session mechanism | Opaque server-side session: 32 random bytes, SHA-256 stored in `auth_sessions`, cookie `HttpOnly; Secure; SameSite=Lax; Path=/` | Immediate revocation (PRD #13, #14) and multiple devices (PRD #12) map directly to rows. JWT would still need a database check per request. |
| 3 | CSRF protection | Double-submit cookie `csrf_token` + `X-CSRF-Token` header on mutating requests, constant-time compare | No server-side storage; fits a JSON single-page app. |
| 4 | Cross-origin setup | Same origin: Vite proxy in development, one origin in production; open `cors()` removed | Keeps `SameSite=Lax` and no-CORS protections. Deployment must serve frontend and API on one origin. |
| 5 | IP rate limit | `express-rate-limit`, in memory; login 20/15 min, register 10/60 min, password change 10/15 min per IP; values in environment variables; `trust proxy` via `TRUST_PROXY` | Simple for a single-instance monolith. Supplements the persistent account lockout and does not replace it. |
| 6 | Frontend router | `react-router-dom` | Most established; lowest risk. |
| 7 | Frontend auth state | React Context + `useAuth`; `/auth/me` on load; 401 → sign-in; 403 `AUTH_PASSWORD_CHANGE_REQUIRED` → forced change | No new dependency; enough for auth state. |
| 8 | Schema | New tables `auth_sessions` and `auth_login_lockouts`; `database-schema.md` updated now. `idle_timeout_minutes` and the two `CHECK` constraints, added afterward, were explicitly confirmed at the Decision Gate. | Smallest addition meeting PRD #9, #10, #12, #13, #14 without changing `users`; the added column keeps idle timeouts snapshotted (matrix §8.7). |
| 9 | Error codes and lockout status | `AUTH_*` catalog in §9.3, including `AUTH_FORBIDDEN_ROLE` (403); lockout returns 429. `AUTH_VALIDATION_FAILED` was later replaced by the global `VALIDATION_FAILED` (#21). | Stable codes for clients; 429 fits "too many attempts". |
| 10 | Configuration read | 60-second in-process cache of `AUTH_*` rows | Avoids a query per request. Existing sessions and locks keep snapshotted values (matrix §8.1). |
| 11 | Seed data | Custom SQL data migration with `ON CONFLICT DO NOTHING`, run by `db:migrate` | Every environment is seeded, and changed values are not overwritten. |
| 12 | Ready before Admin User Management is updated | Yes. Blocked scope is listed in "Dependencies and Blocked Scope" | The blocker is in another document, not a TBD in this one. Registration, sign-in, sessions, lockout, and guards can be built now. |
| 13 | Does self-service password change end other sessions? | No; the current and other sessions continue | Matches the PRD, which requires revocation only for Admin-set passwords (PRD #14); adds no unapproved behavior. |
| 14 | Test tooling | Set project-wide in `tech-stack.md` on 2026-09-16 (task review): Vitest + Supertest; Playwright for main flows only; a separate test database on the existing Docker PostgreSQL | Tooling is a global decision; this design lists what to verify (§16). |
| 15 | Tech Design owner | Tài + Huy | — |
| 16 | Passwords longer than bcrypt's 72-byte input limit | Pre-hash: `base64(HMAC-SHA-256(password, PASSWORD_PEPPER))` (44 bytes) → bcrypt cost 12. `PASSWORD_PEPPER` is a required environment secret of at least 32 random bytes, fixed per deployment and backed up; rotation not supported in MVP. | Uses the whole of every password PRD Decision #8 allows (Vietnamese diacritics take 2–3 UTF-8 bytes, emoji 4), keeps Decision #1 and the PRD unchanged, and adds no dependency (`node:crypto`). A "72-byte" rule was rejected because it contradicts PRD Decision #8. Argon2id was rejected because it needs a native build. |
| 17 | Admin sets a new password while the account is locked (with the Business Owner) | `adminSetPassword` also sets `failed_attempts = 0` and `locked_until = NULL` in the same transaction; recorded in the PRD as Decision #26 | Users who forgot their password are usually locked; keeping the lock would break the support flow in PRD §6.10 and AC 15.3-9. |
| 18 | Soft-deleted accounts and lockout | Treated like an unknown email: dummy hash compare, generic 401, lockout neither read nor written | Keeps soft-deleted accounts indistinguishable from unknown emails, as PRD Decision #16 requires. |
| 19 | Admin provisioning outside the product | Operator script `backend/src/scripts/create-admin.ts` (`npm run admin:create`) calling `authService.createAdminAccount`; not an HTTP route | Guarantees a lowercased email (PRD #6) and correct pepper hashing without changing the `users` table, and stays outside the product (PRD #3). |
| 20 | Code for unexpected errors | Global `INTERNAL_ERROR` (500), defined in `conventions.md` | `conventions.md` requires a code in every error body. |
| 21 | Validation error code | Global `VALIDATION_FAILED` replaces `AUTH_VALIDATION_FAILED`. It is the top-level code when failing fields have different codes; each field keeps its own code in `details`. | One project-wide code for generic validation; clients read field codes from `details`. |
| 22 | Invalid `AUTH_*` value | Use the matrix §8.7 default and log at ERROR level with the key and the stored value | Sign-in keeps working, and the misconfiguration is visible. |
| 23 | Skill-level catalog for the register page | Public `GET /api/v1/skill-levels` in `modules/skill-levels`, ordered by rank | Avoids hard-coding the catalog in the frontend (§9.2). |
| 24 | Password normalization | Unicode NFKC before the policy check and before hashing or verification | Vietnamese letters typed in composed or decomposed form must match; NFKC follows NIST SP 800-63B. Cannot change once passwords are stored. |
| 25 | HMAC key format | The bytes obtained by base64-decoding `PASSWORD_PEPPER` | Matches what `env.ts` validates (at least 32 bytes). Cannot change once passwords are stored. |

### 21.2 Open Questions

None.

## 22. Decision Status

```text
Decision Status: Approved
Approved by: Tech Lead (Tài for #20–#25)
Approved on: 2026-09-16
Approved decisions: §21.1 #1–#25
```

## Dependencies and Blocked Scope

| Dependency | Blocks | Not blocked |
| --- | --- | --- |
| [Admin User Management](../../admin/user-management/) PRD, Tech Design, and Tasks add Court Owner account creation, and make an Admin-set password force a password change, revoke sessions, and clear the lockout (Auth PRD Follow-ups #1–#3) | End-to-end §8.2, §8.8; PRD AC 15.2-1, 15.2-2, 15.3-9, 15.3-11, 15.4-6 | Service functions in §7.2 and their integration tests; everything else in this design |

## Follow-ups for Other Documents

Not changed by this Tech Design. Each needs human confirmation per `docs/documentation-guide.md` §10.

1. **[Admin User Management Tech Design](../../admin/user-management/tech-design.md):**
   - **Done (2026-10-10):** §9 "Bearer Token" and §11 "session/JWT" have been replaced with session cookie (`sid`) + `X-CSRF-Token`, using `authenticate` and `requireRole('ADMIN')`; the list response pagination key was also aligned to `meta`.
   - **Done:** `POST /api/v1/admin/users/:id/password` calls `authService.adminSetPassword` (§7.2), which applies the password policy, sets `must_change_password = true`, revokes all of the user's sessions, and clears the lockout (Decision #17).
   - **Done:** the Admin create-user path applies the shared password policy and sets `must_change_password = true` for `COURT_OWNER` accounts, preserving the Court Owner invariant in §8.2.
2. **[Tournament Management Tech Design](../../tournament/tech-design.md) §5:** the prior "JWT-based authentication follows the current documented direction" wording has been replaced with a reference to the global authentication design.

Done at the Decision Gate on 2026-09-16: `tech-stack.md` and `conventions.md` were updated, and the Auth PRD now links to this Tech Design.

2026-10-23 approved contact extension (human owner choice B): registration optionally accepts phone, normalized per Profile Tech Design PP-07 and stored privately in PLAYER_PROFILES within the registration transaction. AuthUser/session/login contracts stay unchanged; no phone login, OTP or phone disclosure in auth/me.

## Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

```text
Status: Ready
Decision Status: Approved
PRD: prd.md "Social Matchmaking extension" (Ready, business scope)
Schema authority: docs/architecture/database-schema.md §13.8 (SKILL_SURVEY_VERSIONS, PLAYER_SKILL_SURVEYS)
```

The registration skill survey subsections below were rewritten on 2026-11-15 and approved as **Ready** by the human owner on 2026-11-22.

The sections above remain the implemented baseline (direct `skillLevelCode`).

### Registration skill survey — updated 2026-11-15 (Ready 2026-11-22)

Status of this subsection, "Skill levels and survey data" and the survey items in "Verification" below: **Ready** (human-approved 2026-11-22) — rewritten for the survey model confirmed by the human owner on 2026-11-15 (`docs/business-rules-config-matrix.md` §1.2; rationale in `docs/research/bao-cao-cong-thuc-danh-gia-trinh-do.md` §10). It supersedes the 2026-10-31 six-question survey design (details in git history). Reading order for all survey documents: the reading map at the start of the PRD subsection "Registration skill survey".

**Parameters are data, calculation is code.** The survey definition (steps, questions, options with explicit scores, skill list and 0–3 scale, weights, experience mix, returning penalty, bands, G1 `bottleneckRef` per option, G2 `experienceCap` per option) is stored per version in `skill_survey_versions.definition` (jsonb). Version 1 (below) is inserted by migration with status `ACTIVE`. Backend code implements the fixed algorithm: option scores → components $K, R, X, P, A, T$ (with $K = \sum k_j / (3n) \times 100$), weighted sum, returning penalty, unrounded band lookup, G1 and G2 caps, rounding to 2 decimals only when storing or returning. Adding a new rule type or criterion group requires code; changing a number or wording requires a new version.

**Score precision.** Option scores in the definition are stored at full double precision and are never pre-rounded (for example $100/3$ is stored as `33.333333333333336`, not `33.33`). Pre-rounded scores move some answer combinations across a band boundary (for example an exact $S = 15.00$ would become $14.99985$ and drop from `WEAK` to `BEGINNER`).

**Version 1 definition** (feature-level identifiers; wording of every question and option is in the Auth PRD extension, by position):

| Question id | Type | Option codes in order (score; G1 `bottleneckRef`; G2 `experienceCap`) |
| --- | --- | --- |
| `yearsPlaying` | CHOICE, group $X_{\text{years}}$ | `LESS_THAN_6M` (0; —; `AVERAGE_MINUS`), `6M_TO_1Y` (20; —; `AVERAGE`), `1Y_TO_2Y` (40), `2Y_TO_4Y` (60), `4Y_TO_7Y` (80), `7Y_PLUS` (100) |
| `frequencyPerWeek` | CHOICE, group $X_{\text{freq}}$ | `LESS_THAN_1` (0), `ONE` (100/3), `TWO_TO_THREE` (200/3), `FOUR_PLUS` (100) |
| `coaching` | CHOICE, group $T$ | `NONE` (0), `SELF_TAUGHT` (25), `COACH_LESS_THAN_6M` (50), `COACH_6M_PLUS` (75), `TALENT_TEAM` (100) |
| `returningAfterBreak` | BOOLEAN | `true` applies the returning penalty (15); `hiddenWhen: { questionId: "yearsPlaying", optionCode: "LESS_THAN_6M" }` |
| `skill.service`, `skill.clear`, `skill.smash`, `skill.netPlay`, `skill.defense`, `skill.drive`, `skill.backhand`, `skill.footwork`, `skill.doublesPlay` | SKILL, group $K$ | integer 0–3 on the shared `skillScale` |
| `rallyConsistency` | CHOICE, group $R$ | `LESS_THAN_5` (0; 1), `5_TO_9` (20; 2), `10_TO_14` (40; 3), `15_TO_19` (60; 4), `20_PLUS` (80; 5), `20_PLUS_ATTACKING` (100; 6) |
| `stamina` | CHOICE, group $P$ | `UNDER_20M` (0; 2), `20_TO_40M` (25; 3), `ONE_HOUR_FADES_GAME_3` (50; 4), `THREE_GAMES` (75; 5), `MULTIPLE_MATCHES` (100; 6) |
| `tournamentAchievement` | CHOICE, group $A$ | `NONE` (0), `INTERNAL` (25), `DISTRICT_OR_STUDENT` (50), `PROVINCIAL_MEDAL` (75), `NATIONAL_OR_PRO` (100) |

Version 1 also stores: `weights` $\{K: 0.40, R: 0.20, X: 0.15, P: 0.10, A: 0.10, T: 0.05\}$; `experienceMix` $\{years: 0.7, frequency: 0.3\}$; `returningPenalty` 15; `bands` with `minScore` 0, 15, 30, 45, 60, 70, 80 for ranks 1–7; `skillScale` labels (PRD); `steps` (PRD order).

**API**

| Operation | Method / path | Auth | Request | Success response |
| --- | --- | --- | --- | --- |
| Get active survey | `GET /api/v1/auth/skill-survey` | public, no session | none | `200 { data: { version, steps: [{ title, questionIds }], skillScale: [{ value, label }], questions: [{ id, type: "CHOICE" \| "SKILL" \| "BOOLEAN", text, description?, options?: [{ code, label }], hiddenWhen?: { questionId, optionCode } }] } }` |
| Register | `POST /api/v1/auth/register` | IP rate limit | `{ email, password, fullName, phone?, skillSurvey: { version: number, answers: Record<string, string \| number \| boolean> } }` | `201 { data: AuthUser, meta: { skillSurveyResult } }` + `sid`, `csrf_token` cookies |
| Get own survey result | `GET /api/v1/players/me/skill-survey` | `authenticate`, `requireRole('PLAYER')` | none | `200 { data: skillSurveyResult }`; `404 PLAYER_SKILL_SURVEY_NOT_FOUND` when the Player has no survey row |

- The GET response omits scores, weights, bands, `bottleneckRef` and `experienceCap`, so the client cannot preview a level while answering. CHOICE **and BOOLEAN** questions carry `options` (for `returningAfterBreak`: `false` "Không", `true` "Có"), so the client holds no copy of the survey text.
- Response shape (decided 2026-11-22): `AuthUser` stays in `data`; the one-time result goes in `meta.skillSurveyResult`, following the `data`/`meta` envelope in `docs/architecture/conventions.md`.
- `skillSurveyResult` = `{ version, nominalSkillLevel: { code, name, rank }, skillLevel: { code, name, rank }, isSkillTentative, finalScore, components: { K, R, X, P, A, T }, appliedGuardrails: ("G1_BOTTLENECK" | "G2_EXPERIENCE_CAP")[], guardrails: [{ code, cap: { code, name, rank }, criterion?: "K" | "R" | "P" }], strengths: [{ criterion: "K" | "R" | "P" | "X", score }], areaToImprove: { criterion: "K" | "R" | "P", score } }` with scores rounded to 2 decimals. `AuthUser` is unchanged.
- **Server-computed presentation data (decided 2026-11-22).** The server, not the client, derives everything the result screen needs, using the PRD rules: `guardrails` lists each applied guardrail with its cap level; for G1, `criterion` is the component whose term set $\min(\text{Band}(K), \text{Ref}(R), \text{Ref}(P))$, ties broken in the order $K, R, P$; G2 has no `criterion` (its cap comes from `yearsPlaying`). `strengths` = up to two of $K, R, P, X$ with score ≥ 60, highest first, ties in the order $K, R, P, X$ (may be empty). `areaToImprove` = the G1 `criterion` when G1 applied, otherwise the lowest of $K, R, P$ (ties $K, R, P$). Criterion display names are frontend copy.
- **Reading the result again.** Register returns the result once; `GET /api/v1/players/me/skill-survey` returns the same object later (reload of the result screen, link from the profile). It is recomputed from the stored `answers` with the engine and the stored version's definition, which cannot change once `ACTIVE`/`RETIRED`, so the output is identical to the registration result. No extra columns are stored.
- `answers` example: `{ "yearsPlaying": "2Y_TO_4Y", "frequencyPerWeek": "TWO_TO_THREE", "coaching": "SELF_TAUGHT", "returningAfterBreak": false, "skill.service": 2, ..., "rallyConsistency": "15_TO_19", "stamina": "THREE_GAMES", "tournamentAchievement": "INTERNAL" }`.

**Validation and errors**

- Order of checks on register: (1) `skillLevelCode` present → `AUTH_REGISTRATION_FORM_OUTDATED`; (2) no `ACTIVE` version → `AUTH_SKILL_SURVEY_UNAVAILABLE`; (3) `version` ≠ `ACTIVE` → `AUTH_SKILL_SURVEY_OUTDATED`; (4) strict body schema and answers against the definition → `VALIDATION_FAILED`; then the existing email/password checks.
- Answers are validated against the definition of `version`: every visible question answered; option codes exist; skill values are integers 0–3; `returningAfterBreak` is boolean and must be absent or `false` when `yearsPlaying = LESS_THAN_6M`; no unknown keys. Violations → `400 VALIDATION_FAILED` with `details[].field` = question id.
- `version` not equal to the `ACTIVE` version → `400 AUTH_SKILL_SURVEY_OUTDATED`.
- A request still sending `skillLevelCode` → `400 AUTH_REGISTRATION_FORM_OUTDATED` (detected before the strict schema rejects the unknown key), so an old open form shows "Biểu mẫu đã cập nhật, vui lòng tải lại trang".
- No `ACTIVE` version (misconfigured database) → `503 AUTH_SKILL_SURVEY_UNAVAILABLE` for both endpoints; registration is not possible without a survey. `503` is a feature-specific mapping like `429` (§9.3).
- These three codes extend the error-code catalog in §9.3; `AUTH_INVALID_SKILL_LEVEL` is no longer raised by register.

**Persistence.** In the existing registration transaction the server computes the result, inserts `player_profiles` with `skill_level_id` = final level and `is_skill_tentative = true`, and inserts one `player_skill_surveys` row (answers, six component scores, `raw_score`, `final_score`, nominal and resulting level, `applied_guardrails`). Any failure rolls back the user, profile, survey row and session.

**Tentative flag exposure.** The Player profile read model exposes `isSkillTentative` next to `skillLevel` so the profile can label the level as tentative (Profile Tech Design follow-up).

**Other rules**

- No retake: there is no endpoint to submit the survey again; the read endpoint is read-only.
- Player accounts are created only by self-registration with the survey (decided 2026-11-22): Admin user creation no longer offers the `PLAYER` role (AUTH-33), so every Player has exactly one survey row.
- Release: backend and frontend in the same release; the old field is not accepted after release. Development and test databases are reset and re-seeded; accounts created before the survey are sample data and are not migrated.
- Admin endpoints for versions (view, draft, publish) are out of MVP; the schema supports them without change.

**Definition validation** (run by a test on version 1 and before any future version becomes `ACTIVE`):

- weights cover exactly $K, R, X, P, A, T$ and sum to 1; `experienceMix` sums to 1; `returningPenalty` ≥ 0;
- bands start at 0, strictly increase, and list every `skill_levels` code exactly once in rank order;
- every CHOICE question has at least two options; option scores are within 0–100 and strictly increase in option order;
- every option of the $R$ and $P$ questions has an integer `bottleneckRef` from 1 to (number of levels − 1); every `experienceCap` is a valid level code;
- groups $K, R, X_{\text{years}}, X_{\text{freq}}, P, A, T$ are all present; group $K$ has at least one SKILL question; question ids are unique; every id in `steps` exists and every question appears in exactly one step; `hiddenWhen` references an existing question and option.

### Skill levels and survey data

- Migration (next free number in `docs/plans/migration-slot-log.md`; `0032_player_skill_surveys.sql` (created as `0029`, renumbered on 2026-11-22 when develop had taken `0029`–`0031`) — re-check and register the slot before creating it): updates `skill_levels` to the seven-level catalog (rename `GOOD` to "Khá", insert `EXCELLENT` "Giỏi" rank 7, update all descriptions per matrix §1.2); creates `skill_survey_versions` and `player_skill_surveys`; adds `player_profiles.is_skill_tentative`; inserts survey version 1 as `ACTIVE`. `PLAYER_SKILL_ADJUSTMENT_ENABLED` is already `'false'` (migration `0023`, System Configuration), so this migration does not touch it. Migration `0005` is not edited.
- Existing `matchmaking_requests` whose `max_skill_level_id` is `GOOD` would silently exclude `EXCELLENT`; this does not arise because development databases are reset and re-seeded with the release.
- `db/seed.ts`, `db/seed-ratings.ts`, `db/seed-social.ts` and the `UserRepository` fallback text use the seven-level catalog; seeded Players get answers scored through the same engine so their level matches a survey row.
- Code that assumes six levels is updated to seven, including `frontend/src/features/player/profile/ProfileSections.tsx` ("/ 6" and a six-step indicator) and the `maxRank ?? 6` fallback in `backend/src/services/matchmaking/MatchInvitationService.ts`; tests and acceptance criteria that expect six rows are updated in the same task as the migration.

### Access rows

- Social, Matchmaking Apply/Invite and Messaging routes require `PLAYER`; Admin uses only hide routes and Report Management (Social/Messaging Tech Designs).

### Verification

- Unit tests of the scoring engine against version 1: band boundaries ($15, 30, 45, 60, 70, 80$) compared on unrounded values; returning penalty ($-15$, floored at 0); every G1 reference row and both G2 caps; `applied_guardrails` only when a cap is below the nominal band; the six acceptance examples in the Auth PRD extension produce the listed $S$, level and guardrails.
- Precision boundary case: 7 years or more, 1 session per week, no coaching, returning after a break, all skills 0, 10–14 shots, out of breath within 20 minutes, national prize → $S = 15.00$ exactly → `WEAK` (G1 cap 2, not applied).
- Definition validation accepts version 1 and rejects each rule above when violated.
- API/integration: survey row, profile level and `is_skill_tentative = true` commit atomically with the user; the response contains `skillSurveyResult`; outdated version, old form and missing `ACTIVE` version return their codes; a published version cannot be modified (trigger); only one `ACTIVE` version exists; the migrated database has seven skill levels with the new descriptions.

### Final Phase 2 approval — 2026-10-31

This 2026-10-31 approval does not cover the survey content rewritten on 2026-11-15; that content was approved separately on 2026-11-22.

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.

### Frontend presentation migration — D01, 2026-11-17

The human owner authorized the incremental Sign-in UI batch. SignInPage uses a separate SignInLayout (Register/Change-password keep legacy AuthLayout), shared Button/Input/Label/Alert primitives, React Hook Form with Zod/resolver, and lucide icons. `use-sign-in-form.ts` coordinates the existing `useAuth().signIn`; `sign-in-errors.ts` maps stable API codes to Vietnamese feedback. No endpoint, session/cookie/CSRF policy, authorization, role redirect or backend validation changes are introduced.

The form requires email/password, trims only email and does not apply registration password strength rules to existing credentials. It guards duplicate submits before validation, preserves values on failure, associates field errors and focuses server feedback. Pending controls are disabled and the password toggle supports keyboard use. Unrecognized server errors receive a generic client message rather than raw backend text. D01 remains awaiting user review; no other Auth screen is migrated.

Verification: `frontend/playwright.sign-in.config.ts` runs the 22 mocked-API browser cases in `frontend/e2e/sign-in-ui.spec.ts`; production smoke covers Sign-in and unchanged legacy consumers. These checks do not verify the live database/session lifecycle. Delivery evidence and D02 scope are recorded in `docs/architecture/plans/refactor_FE_add_lib/frontend-modernization-history.md` §14.

### Sign-in presentation v2 — 2026-11-18

The user approved the CSS/SVG vector prototype for the existing sign-in screen. The feature now renders that composition using Tailwind tokens, shared labeled fields/brand identity, existing Radix-based primitives, RHF/Zod and Motion presentation hooks. The one-time survey prototype remains documentation only on this branch. Authentication/provider/HTTP client, endpoint contracts, role and forced-password redirects, CSRF refresh and submission guards are unchanged. Verification now includes 31 mocked-API browser cases, live anonymous page rendering and backend health; no live successful credential login is claimed. D01 remains awaiting user review; see the batch history §17.

### Sign-in D01 accepted — 2026-11-18

The user accepted D01 after final fixes: the account-locked unlock time is formatted in `Asia/Ho_Chi_Minh` regardless of browser time zone, and presentation-only text/heading adjustments were made. No endpoint, session, CSRF, redirect or validation behavior changed. Verification: 34 mocked-API browser cases; live credential login is still not claimed. See the batch history §18.

### Change-password, access-denied and session loading — D02, 2026-11-18

Presentation-only migration plus PRD Decision #27. `/change-password` uses a focused layout (no marketing panel) with React Hook Form + Zod: required fields, 8–64 code points after NFKC, not equal to the email (case-insensitive), and a client-only confirmation field; the server remains authoritative and receives only `{ currentPassword, newPassword }`. Error codes map to field or form messages; raw server text is never shown. On success the client signs out the current session and Sign-in shows “Đổi mật khẩu thành công…”. `AuthProvider.signOut(reason)` now records why the session ended (`signedOut` or `passwordChanged`, reset on sign-in/register and on session expiry); `RequireAuth` omits the saved `from` destination after a deliberate sign-out, so the next sign-in starts at the role home. Access-denied is Vietnamese with friendly role names and stays at the blocked URL; the guard's loading state is branded. The Admin header gains an account menu with change-password and sign-out (PRD §6.9, §7.6). No endpoint, cookie, CSRF, authorization or backend change. Verification: 57 mocked-API browser cases (`playwright.sign-in.config.ts`); DB-backed `forced-password-change.spec.ts` and `role-based-denial.spec.ts` were updated but not run in this session. See the batch history §19.

### Player landing and account menu — SH01, verified 2026-11-19

The user approved `/feed` as the Player landing page until a dedicated home is available. `getRoleHomePath('PLAYER')`, the Player logo and return-home action point to `/feed`; `/` redirects there. Owner/Admin landing routes, authentication/session/CSRF contracts and forced-password rules remain unchanged.

`features/auth/account-menu.tsx` now supplies the shared Radix account menu for the Player and Admin shells; logout still calls the existing `use-sign-out.ts` flow. SH01 adds no endpoint or backend behavior. Full mocked-API UI verification passed 86/86; an existing local seeded Player successfully signed in through the actual UI and reached `/feed`, then the isolated test session was signed out. Current status and handoff: [frontend plan](../../../architecture/plans/refactor_FE_add_lib/frontend-modernization-review-plan.md) §3.2.
