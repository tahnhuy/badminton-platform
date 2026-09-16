# Authentication & Authorization - Task List

Implementation tasks for the Authentication & Authorization feature.

- Linked PRD: [prd.md](../prd.md) (Ready)
- Linked Tech Design: [tech-design.md](../tech-design.md) (Ready, Decision Status: Approved)
- Decision Gate: PASSED on 2026-09-16
- Assignee: TBD for every task

Rules applied (`AGENTS.md`, `docs/documentation-guide.md` §5.4):

- No task creates a new design decision or changes the PRD, the Tech Design, `database-schema.md`, or `docs/business-rules-config-matrix.md`.
- Where the governing documents leave a decision open, that part is split into its own task with status `BLOCKED`. The open questions are listed in "Decisions Needed".
- Status values follow `docs/templates/task-template.md`: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

**Definition of Done for every task:** the task's acceptance criteria pass, and the automated tests listed under "Testing requirements" exist and pass. Automated tests need the test harness from AUTH-19, which is `BLOCKED`. Until AUTH-19 is unblocked, a task can be implemented and checked manually but cannot move to `DONE`.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| AUTH-01 | Backend foundation: dependencies, environment config, DB client, error handling | TODO | — | M |
| AUTH-02 | Schema: `must_change_password`, `auth_sessions`, `auth_login_lockouts` | TODO | — | S |
| AUTH-03 | Seed data migration: skill levels and `AUTH_*` configuration | TODO | AUTH-02 | S |
| AUTH-04 | System configuration reader for `AUTH_*` keys | TODO | AUTH-01, AUTH-03 | S |
| AUTH-05 | Password hasher and request validation schemas | TODO | AUTH-01 | M |
| AUTH-06 | Session store and cookie helpers | TODO | AUTH-01, AUTH-02, AUTH-04 | M |
| AUTH-07 | `authenticate` and `requireRole` middleware | TODO | AUTH-06 | M |
| AUTH-08 | CSRF middleware and IP rate limiters | TODO | AUTH-01, AUTH-06 | S |
| AUTH-09 | `POST /auth/register` | TODO | AUTH-03, AUTH-05, AUTH-06, AUTH-08 | M |
| AUTH-10 | `POST /auth/login` with account lockout | TODO | AUTH-04, AUTH-05, AUTH-06, AUTH-08 | L |
| AUTH-11 | `GET /auth/me` and `POST /auth/logout` | TODO | AUTH-07, AUTH-08 | S |
| AUTH-12 | `POST /auth/password/change` | TODO | AUTH-05, AUTH-07, AUTH-08 | S |
| AUTH-13 | Service functions for Admin User Management | TODO | AUTH-05, AUTH-06, AUTH-10 | M |
| AUTH-14 | Operator script to provision Admin accounts | TODO | AUTH-02, AUTH-05 | S |
| AUTH-15 | Frontend foundation: proxy, router, HTTP client, auth state, route guard | TODO | AUTH-11 | M |
| AUTH-16 | Sign-in page | TODO | AUTH-10, AUTH-15 | S |
| AUTH-17 | Change-password page (voluntary and forced) | TODO | AUTH-12, AUTH-15 | S |
| AUTH-18 | Register page | **BLOCKED** (Q5) | AUTH-09, AUTH-15 | S |
| AUTH-19 | Automated test harness | **BLOCKED** (Q1) | AUTH-01, AUTH-03 | M |
| AUTH-20 | Response code for unexpected server errors | **BLOCKED** (Q2) | AUTH-01 | S |
| AUTH-21 | Error code when several fields fail validation | **BLOCKED** (Q3) | AUTH-05 | S |
| AUTH-22 | Handling an invalid `AUTH_*` configuration value | **BLOCKED** (Q4) | AUTH-04 | S |
| AUTH-23 | End-to-end verification through Admin User Management endpoints | **BLOCKED** (external) | AUTH-13 | S |

---

## AUTH-01: Backend foundation — dependencies, environment config, DB client, error handling

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Provide the shared backend pieces every auth task needs: approved dependencies, validated environment config, a Drizzle database client, application errors in the `conventions.md` shape, structured logging, and removal of open CORS.

**Scope**

- In scope:
  - Install the approved backend dependencies: `zod`, `bcryptjs`, `express-rate-limit`.
  - Environment config, DB client, application error type, error handler for application errors, and a log helper.
  - Remove `app.use(cors())` and update `backend/.env.example`.
- Out of scope:
  - The response code for unexpected (non-application) errors (AUTH-20).
  - Rate limiters (AUTH-08).
  - Any route.

**Implementation requirements**

1. Add `zod`, `bcryptjs`, `express-rate-limit` to `backend/package.json` (approved in `tech-stack.md`, 2026-09-16). Add no other runtime dependency.
2. `shared/config/env.ts` validates the environment once at startup with Zod and exits with a non-zero code and a clear message when invalid. The message must not print secret values. Variables:
   - `NODE_ENV`, `PORT` (default `3000`), `DATABASE_URL` (required).
   - `PASSWORD_PEPPER`: required, base64, at least 32 bytes after decoding.
   - `COOKIE_SECURE`: honored only when `NODE_ENV` is not `production`; in production the `Secure` flag is always on.
   - `TRUST_PROXY`: optional, off by default.
   - `RATE_LIMIT_LOGIN_MAX` (20), `RATE_LIMIT_LOGIN_WINDOW_MINUTES` (15), `RATE_LIMIT_REGISTER_MAX` (10), `RATE_LIMIT_REGISTER_WINDOW_MINUTES` (60), `RATE_LIMIT_PASSWORD_CHANGE_MAX` (10), `RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MINUTES` (15).
3. Drizzle client for runtime queries, using `DATABASE_URL` (the migration runner keeps using `DIRECT_URL`).
4. `shared/http/app-error.ts`: an error carrying `code`, HTTP status, and `details`.
5. `shared/http/error-handler.ts`:
   - Converts an application error to `{ "error": { "code", "message", "details" } }` with its status.
   - Never includes stack traces, SQL, or internal messages.
   - Logs the error server-side.
6. Log helper that writes one JSON line per event through `console`. No logging library, because Observability is TBD in `tech-stack.md`. Callers must never pass passwords, raw tokens, CSRF tokens, or `PASSWORD_PEPPER`.
7. `index.ts`:
   - Load `env.ts` before anything else.
   - Remove `app.use(cors())`.
   - Register the error handler last.
   - Keep `GET /health` unchanged.
8. `backend/.env.example`: add every variable above. `PASSWORD_PEPPER` gets a placeholder value that is clearly not a real secret.

**Files/areas affected**

- `backend/package.json`
- `backend/.env.example`
- `backend/src/index.ts`
- `backend/src/shared/config/env.ts`
- `backend/src/shared/http/app-error.ts`
- `backend/src/shared/http/error-handler.ts`
- `[Proposed — verify during implementation]` `backend/src/db/client.ts`
- `[Proposed — verify during implementation]` `backend/src/shared/logging/logger.ts`

**API impact:** CORS headers are no longer sent. `GET /health` is unchanged.

**Schema/config impact:** new environment variables only. No schema change.

**Testing requirements**

- Unit:
  - A missing `PASSWORD_PEPPER`, or one shorter than 32 bytes, fails validation.
  - Rate-limit variables fall back to their defaults.
  - `COOKIE_SECURE=false` has no effect when `NODE_ENV=production`.
- Unit: the error handler returns the `conventions.md` shape for an application error, and the body contains no stack trace.

**Acceptance criteria**

- **Given** `PASSWORD_PEPPER` is not set
  **When** the backend starts
  **Then** the process exits with a non-zero code and a message naming the variable, without printing any secret value.

- **Given** a route throws an application error with code `AUTH_VALIDATION_FAILED` and status 400
  **When** the request completes
  **Then** the response is `400` with body `{ "error": { "code": "AUTH_VALIDATION_FAILED", "message": ..., "details": [...] } }`.

- **Given** the backend is running
  **When** a request arrives with an `Origin` header from another site
  **Then** the response has no `Access-Control-Allow-Origin` header.

**References:** Tech Design §7.1, §7.3, §7.4 (same origin), §11, §17 steps 1, 5, 7, §19; `docs/architecture/conventions.md` (Error Handling; Configuration & Environment).

---

## AUTH-02: Schema — `must_change_password`, `auth_sessions`, `auth_login_lockouts`

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Bring the Drizzle schema and migrations in line with `database-schema.md` §3.1, §3.27, §3.28, and §5.12.

**Scope**

- In scope: the `users.must_change_password` column, the two new tables, their unique key, index, and checks, and one generated migration.
- Out of scope: seed data (AUTH-03); any change to existing columns or constraints; editing migration `0000`.

**Implementation requirements**

1. `users.ts`: add `mustChangePassword` → `must_change_password boolean NOT NULL DEFAULT false`.
2. New schema file, exported from `schema/index.ts`:
   - `auth_sessions`:
     - `id` bigint identity primary key.
     - `user_id` bigint NOT NULL, foreign key to `users.id`.
     - `token_hash` varchar NOT NULL UNIQUE.
     - `idle_timeout_minutes` integer NOT NULL.
     - `last_seen_at` and `expires_at`: timestamp NOT NULL.
     - `revoked_at`: timestamp, nullable.
     - `created_at`: timestamp NOT NULL DEFAULT now().
     - Index on `user_id`; `CHECK (idle_timeout_minutes > 0)`.
   - `auth_login_lockouts`:
     - `user_id` bigint primary key, foreign key to `users.id`.
     - `failed_attempts` integer NOT NULL DEFAULT 0.
     - `locked_until`: timestamp, nullable.
     - `updated_at`: timestamp NOT NULL DEFAULT now().
     - `CHECK (failed_attempts >= 0)`.
   - Use the same timestamp type and foreign-key style as the existing schema. No `ON DELETE` action, because users are only soft-deleted.
3. Run `npm run db:generate` and review the generated SQL against `database-schema.md`. Commit the SQL together with the updated `meta` snapshot and journal.
4. Apply the migration with `npm run db:migrate`, both to an empty database and to a database that already has `0000`.
5. `migrate.ts` only applies migrations forward, so rolling back means manually dropping the added objects (Tech Design §17). Never edit a migration file after it has been applied: the runner rejects checksum changes.

**Files/areas affected**

- `backend/src/db/schema/users.ts`
- `backend/src/db/schema/index.ts`
- `[Proposed — verify during implementation]` `backend/src/db/schema/auth.ts`
- `backend/src/db/migrations/0001_*.sql`
- `backend/src/db/migrations/meta/*`

**API impact:** none.

**Schema/config impact:** implements the already-approved delta in Tech Design §10.1–§10.2. `database-schema.md` needs no update.

**Testing requirements**

- Integration: the migration applies cleanly both to an empty database and to one that already has `0000`.
- Integration: every constraint rejects invalid data (duplicate `token_hash`; `failed_attempts = -1`; `idle_timeout_minutes = 0`).

**Acceptance criteria**

- **Given** a database with only migration `0000` applied and existing `users` rows
  **When** `npm run db:migrate` runs
  **Then** it succeeds, and every existing user has `must_change_password = false`.

- **Given** the migrated database
  **When** a second `auth_sessions` row with an existing `token_hash` is inserted
  **Then** the insert is rejected.

- **Given** the migrated database
  **When** an `auth_login_lockouts` row with `failed_attempts = -1`, or an `auth_sessions` row with `idle_timeout_minutes = 0`, is inserted
  **Then** the insert is rejected by the check constraint.

**References:** Tech Design §10.1, §10.2, §17 steps 2–3; `docs/architecture/database-schema.md` §3.1, §3.27, §3.28, §5.12.

---

## AUTH-03: Seed data migration — skill levels and `AUTH_*` configuration

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Make every environment start with the skill-level catalog and the eight authentication configuration values.

**Scope**

- In scope: one custom SQL migration inserting the six `skill_levels` rows and the eight `system_configs` rows.
- Out of scope: any other reference data or configuration.

**Implementation requirements**

1. Create a custom migration after the AUTH-02 migration (for example `npx drizzle-kit generate --custom`), so it sorts after `0001` in `migrate.ts`.
2. `skill_levels`:
   - The six rows from `docs/business-rules-config-matrix.md` §1.2, copied exactly (`code`, `name`, `rank`, `description`).
   - `ON CONFLICT (code) DO NOTHING`.
3. `system_configs`:
   - The eight `AUTH_*` keys from matrix §8.7, with `config_value` set to the documented default and `description` set to the matrix "Meaning" text.
   - `updated_by = NULL`; `ON CONFLICT (config_key) DO NOTHING`.
4. Do not copy the values into any other document or code comment; the matrix stays the single source.

**Files/areas affected:** `backend/src/db/migrations/0002_*.sql` and the `meta` files.

**API impact:** none.

**Schema/config impact:** data only. Values come from matrix §1.2 and §8.7.

**Testing requirements**

- Integration: after migrating, the rows match the matrix exactly.
- Integration: when a `system_configs` row already exists with another value before this migration runs, that value is kept.

**Acceptance criteria**

- **Given** an empty database
  **When** all migrations run
  **Then** `skill_levels` has exactly the six rows with ranks 1–6 matching matrix §1.2, and `system_configs` has the eight `AUTH_*` keys with the §8.7 defaults.

- **Given** `system_configs` already contains `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD = '7'`
  **When** this migration runs
  **Then** the value stays `'7'`, and no duplicate row is created.

**References:** Tech Design §10.3, §17 step 4, Decision #11; `docs/business-rules-config-matrix.md` §1.2, §8.7.

---

## AUTH-04: System configuration reader for `AUTH_*` keys

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Read the eight `AUTH_*` values from `system_configs` with typed accessors, a 60-second cache, and the documented fallback for missing rows.

**Scope**

- In scope:
  - Typed getters for the lockout threshold and duration.
  - Idle and absolute session timeout getters per role.
  - The cache, and the fallback for a missing row.
- Out of scope: behavior when a row exists but its value is not a valid positive integer (AUTH-22, BLOCKED).

**Implementation requirements**

1. `shared/config/system-config.ts` reads the eight keys through the Drizzle client.
2. Cache the rows in process for 60 seconds (Decision #10); after expiry, the next read goes to the database.
3. A missing row returns the default from matrix §8.7 and logs a warning naming the key (Tech Design §12). The request is not failed.
4. Expose per-role accessors so callers never build key names by string concatenation: `PLAYER`, `COURT_OWNER`, and `ADMIN`, each with idle and absolute timeouts.

**Files/areas affected:** `backend/src/shared/config/system-config.ts`.

**API impact:** none.

**Schema/config impact:** reads `system_configs`. No change.

**Testing requirements**

- Integration: a seeded value is returned.
- Integration: a deleted row returns the matrix default and logs one warning.
- Integration (time-controlled): a changed value is not visible before 60 seconds and is visible after.

**Acceptance criteria**

- **Given** the seeded database
  **When** the admin idle timeout is read
  **Then** it returns `60`.

- **Given** the `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` row is deleted
  **When** the lockout duration is read
  **Then** it returns `15`, and a warning naming that key is logged.

**References:** Tech Design §7.3, §12, §14, Decision #10; `docs/business-rules-config-matrix.md` §8.1, §8.7.

---

## AUTH-05: Password hasher and request validation schemas

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Implement password hashing (Decisions #1, #16) and the Zod request schemas with their error-code mapping (Tech Design §9.2).

**Scope**

- In scope:
  - `password-hasher.ts`: hash, verify, and a dummy verification for timing equalization.
  - `auth.validation.ts`: schemas for register, login, and password change, plus the issue-to-error-code mapping for single-field failures.
- Out of scope:
  - The top-level error code when several fields fail with different codes (AUTH-21, BLOCKED).
  - The database check that a skill-level code exists (AUTH-09).

**Implementation requirements**

1. Hash = `bcryptjs` cost 12 over `base64(HMAC-SHA-256(password, PASSWORD_PEPPER))`, using the async API only.
2. Verify runs the same pipeline. The dummy verification compares against a fixed hash computed once at startup with the same pipeline, so unknown and soft-deleted emails take the same time as real ones (§8.3).
3. Schemas, all `.strict()`:
   - `email`: trimmed, lowercased, valid format, at most 254 characters.
   - Register `password` and `newPassword`: 8–64 Unicode code points (not UTF-16 units), and not equal to the normalized email compared case-insensitively.
   - Login `password` and `currentPassword`: 1–1024 characters, no policy check.
   - `fullName`: trimmed, 1–255 characters.
   - `skillLevelCode`: non-empty string.
4. Mapping:
   - Password-policy issues → `AUTH_PASSWORD_POLICY_VIOLATION`.
   - `skillLevelCode` issues → `AUTH_INVALID_SKILL_LEVEL`.
   - Any other issue, an unknown key, or a non-JSON body → `AUTH_VALIDATION_FAILED`.
   - `details` lists `{ field, code }` and never contains submitted values.

**Files/areas affected:**

- `backend/src/modules/auth/password-hasher.ts`
- `backend/src/modules/auth/auth.validation.ts`

**API impact:** defines the validation part of the contract in Tech Design §9.2. No route yet.

**Schema/config impact:** reads `PASSWORD_PEPPER` from `env.ts`.

**Testing requirements**

- Unit:
  - A 64-code-point Vietnamese password with diacritics (more than 72 UTF-8 bytes) hashes and verifies.
  - A password identical in its first 72 bytes but different afterward does not verify.
  - The stored hash is not the password or its HMAC.
- Unit:
  - 7 and 65 code points are rejected; 8 and 64 are accepted.
  - An emoji counts as one code point.
  - A password equal to the email in different letter case is rejected.
- Unit:
  - A body with a `role` key is rejected with `AUTH_VALIDATION_FAILED`.
  - `details` never contains the submitted values.

**Acceptance criteria**

- **Given** `newPassword` equals `User@Example.com` and the email is `user@example.com`
  **When** it is validated
  **Then** it fails with `AUTH_PASSWORD_POLICY_VIOLATION`.

- **Given** a password of 64 Vietnamese characters with diacritics
  **When** it is hashed and then verified
  **Then** verification succeeds, and a password differing only after its 72nd byte fails.

**References:** Tech Design §8.3, §9.2, §11, Decisions #1, #16; PRD Decision #8.

---

## AUTH-06: Session store and cookie helpers

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Provide the session persistence functions and the cookie helpers used by sign-in, register, `authenticate`, and sign-out.

**Scope**

- In scope:
  - Repository functions for `auth_sessions`.
  - Setting, clearing, and reading the `sid` and `csrf_token` cookies.
- Out of scope: middleware (AUTH-07, AUTH-08) and routes.

**Implementation requirements**

1. Create session:
   - Token = 32 random bytes from `node:crypto`, base64url; store `token_hash` = SHA-256 hex.
   - `idle_timeout_minutes` and `expires_at` = now + the absolute timeout, both taken from AUTH-04 for the user's role at creation time.
   - `last_seen_at` = now.
   - Return the raw token only to the caller.
2. Find the active session by raw token: a single query joining `users`, filtered by `token_hash` and `revoked_at IS NULL`, returning the session and the user's `id`, `email`, `role`, `status`, `deleted_at`, `must_change_password`.
3. Revoke one session by token. Revoke all sessions of a user. Delete a user's sessions that are revoked or past `expires_at`.
4. Touch `last_seen_at` only when it is more than 60 seconds old.
5. `session-cookie.ts`:
   - `sid`: `HttpOnly; SameSite=Lax; Path=/; Max-Age` = seconds until `expires_at`; `Secure` per AUTH-01.
   - `csrf_token`: 32 random bytes, base64url, not HttpOnly, same attributes and `Max-Age`.
   - Clear both.
   - A small parser for the `Cookie` header that reads only `sid` and `csrf_token`. No `cookie-parser`.

**Files/areas affected:**

- `backend/src/modules/auth/auth.repository.ts`
- `backend/src/shared/auth/session-cookie.ts`

**API impact:** none directly.

**Schema/config impact:** uses `auth_sessions` and the AUTH-04 accessors.

**Testing requirements**

- Integration:
  - The stored `token_hash` differs from the cookie token.
  - A new session copies the role's idle timeout.
  - Changing the configuration afterward does not change an existing session's `idle_timeout_minutes`.
- Integration:
  - Revoke-all revokes only that user's sessions.
  - Cleanup deletes only revoked or expired rows of that user.
  - `last_seen_at` is not updated within 60 seconds.
- Unit:
  - Cookie attributes and `Max-Age` are correct.
  - The parser handles a missing header, extra cookies, and malformed values.

**Acceptance criteria**

- **Given** a Player session created with the seeded configuration
  **When** it is read back
  **Then** `idle_timeout_minutes = 10080`, `expires_at` is 30 days after creation, and `token_hash` is not the raw token.

- **Given** a user with three sessions, one revoked
  **When** cleanup runs for that user
  **Then** only the revoked row (and any row past `expires_at`) is deleted.

**References:** Tech Design §7.4, §8.3, §8.5, §10.2, §10.4, §14, Decisions #2, #10.

---

## AUTH-07: `authenticate` and `requireRole` middleware

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Provide the reusable protection for every protected route in this and other modules.

**Scope**

- In scope:
  - `authenticate` per Tech Design §8.5.
  - `requireRole(...roles)`.
  - Request typing.
- Out of scope:
  - CSRF (AUTH-08).
  - Contextual rules such as Organizer or own facility, which belong to each feature.

**Implementation requirements**

1. `authenticate`:
   - Missing or malformed `sid` → `401 AUTH_SESSION_INVALID`.
   - No active session, or `expires_at <= now()` → `401 AUTH_SESSION_INVALID`.
   - `last_seen_at + idle_timeout_minutes <= now()` → `401 AUTH_SESSION_EXPIRED`.
   - `deleted_at` set, or `status` not `ACTIVE` → `401 AUTH_SESSION_INVALID`.
   - `must_change_password` and the route is neither `GET /api/v1/auth/me` nor `POST /api/v1/auth/password/change` → `403 AUTH_PASSWORD_CHANGE_REQUIRED`.
   - Otherwise attach `req.user = { id, email, role }` and touch `last_seen_at` (AUTH-06).
2. Every `401` from `authenticate` also clears `sid` and `csrf_token`.
3. `requireRole(...roles)` returns `403 AUTH_FORBIDDEN_ROLE` when `req.user.role` is not listed.
4. `shared/auth/types.ts` defines `Role` and the authenticated request type.

**Files/areas affected:**

- `backend/src/shared/auth/authenticate.middleware.ts`
- `backend/src/shared/auth/authorize.middleware.ts`
- `backend/src/shared/auth/types.ts`

**API impact:** defines the shared `401`/`403` behavior used by all protected routes (`conventions.md` → Authentication).

**Schema/config impact:** none.

**Testing requirements**

- Integration: each branch above returns its code; cookies are cleared on every `401`.
- Integration (time-controlled): PRD AC 15.4-2 — an Admin session idle over 1 hour returns `401 AUTH_SESSION_EXPIRED`; one open over 8 hours returns `401 AUTH_SESSION_INVALID`.
- Integration: PRD AC 15.4-5 — after `status` becomes `SUSPENDED`/`DEACTIVATED`, or `deleted_at` is set, the next request returns `401 AUTH_SESSION_INVALID`.
- Unit: `requireRole` allows listed roles and returns `403 AUTH_FORBIDDEN_ROLE` otherwise. This is the auth-module part of PRD AC 15.6-2, 15.6-5, 15.6-6.

**Acceptance criteria**

- **Given** a valid session whose user was just set to `SUSPENDED`
  **When** any route protected by `authenticate` is called
  **Then** the response is `401 AUTH_SESSION_INVALID`, and `sid` and `csrf_token` are cleared.

- **Given** a valid session with `must_change_password = true`
  **When** a protected route other than `GET /api/v1/auth/me` or `POST /api/v1/auth/password/change` is called
  **Then** the response is `403 AUTH_PASSWORD_CHANGE_REQUIRED`.

- **Given** a signed-in `PLAYER`
  **When** a route protected by `requireRole('ADMIN')` is called
  **Then** the response is `403 AUTH_FORBIDDEN_ROLE`.

**References:** Tech Design §7.2, §8.5, §9.3, §12; PRD §7.7, §7.8, Decision #13.

---

## AUTH-08: CSRF middleware and IP rate limiters

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Add the app-level CSRF check (Decision #3) and the per-IP rate limiters (Decision #5).

**Scope**

- In scope: the CSRF middleware mounted for `/api/v1`, the three rate limiters, and `trust proxy` wiring.
- Out of scope: account lockout (AUTH-10).

**Implementation requirements**

1. CSRF, for `POST`, `PUT`, `PATCH`, and `DELETE` under `/api/v1`:
   - Skip `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
   - Skip requests without a `sid` cookie.
   - Otherwise require `X-CSRF-Token` equal to the `csrf_token` cookie, using `crypto.timingSafeEqual` (a length mismatch fails).
   - Failure → `403 AUTH_CSRF_TOKEN_INVALID`.
2. Mount the CSRF middleware once in `index.ts`, before any `/api/v1` router.
3. `rate-limit.ts`:
   - `express-rate-limit` instances for login, register, and password change, with limits from `env.ts` and the in-memory store.
   - Handler response: `429` with `Retry-After` and body `{ "error": { "code": "AUTH_RATE_LIMITED", ... } }`.
4. `index.ts`: `app.set('trust proxy', …)` from `TRUST_PROXY`, off by default.

**Files/areas affected:**

- `backend/src/shared/auth/csrf.middleware.ts`
- `backend/src/shared/http/rate-limit.ts`
- `backend/src/index.ts`

**API impact:** all mutating `/api/v1` requests made with a session must send `X-CSRF-Token`. New `429 AUTH_RATE_LIMITED` responses.

**Schema/config impact:** uses the `RATE_LIMIT_*` and `TRUST_PROXY` variables from AUTH-01.

**Testing requirements**

- API:
  - With `sid`, a missing or wrong `X-CSRF-Token` returns `403`; a matching one passes.
  - Without `sid`, the request passes.
  - Register and login pass without the header.
- API: the 21st login request from one IP within 15 minutes returns `429 AUTH_RATE_LIMITED` with `Retry-After`.

**Acceptance criteria**

- **Given** a request with a `sid` cookie to `POST /api/v1/auth/logout` without `X-CSRF-Token`
  **When** it is sent
  **Then** the response is `403 AUTH_CSRF_TOKEN_INVALID`.

- **Given** 20 login requests from one IP within 15 minutes
  **When** a 21st is sent
  **Then** the response is `429 AUTH_RATE_LIMITED` with a `Retry-After` header.

**References:** Tech Design §7.2, §8.6, §11, §16 (CSRF, rate limit), Decisions #3, #5.

---

## AUTH-09: `POST /auth/register`

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Let a visitor self-register as a Player and be signed in immediately (PRD §6.1, §7.1).

**Scope**

- In scope: the auth router (created here), the JSON-only guard for auth routes, and the register controller and service.
- Out of scope: the register page (AUTH-18).

**Implementation requirements**

1. `auth.routes.ts` under `/api/v1/auth`, mounted in `index.ts`.
   - A request body with a content type other than `application/json`, or malformed JSON, returns `400 AUTH_VALIDATION_FAILED`.
   - URL-encoded parsing must not apply to auth routes.
2. Route chain: register rate limiter → validation (AUTH-05) → controller → service.
3. Service flow (Tech Design §8.1):
   1. Look up `skill_levels.code`; if missing → `400 AUTH_INVALID_SKILL_LEVEL`.
   2. Any `users` row with that email, including soft-deleted → `409 AUTH_EMAIL_ALREADY_REGISTERED`.
   3. Hash the password.
   4. In one transaction: insert `users` (`PLAYER`, `ACTIVE`, `must_change_password = false`), `player_profiles` (`full_name`, `skill_level_id`), and a session.
   5. A unique violation on email inside the transaction → `409 AUTH_EMAIL_ALREADY_REGISTERED`.
4. The role is always set by the server.
5. Set `sid` and `csrf_token`. Respond `201 { data: { id, email, role, requiresPasswordChange: false } }`.
6. Log each registration result without personal secrets.

**Files/areas affected:**

- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.repository.ts`
- `backend/src/index.ts`

**API impact:** new `POST /api/v1/auth/register` (Tech Design §9.1).

**Schema/config impact:** writes `users`, `player_profiles`, `auth_sessions`; reads `skill_levels`.

**Testing requirements** (Tech Design §16)

- API: PRD AC 15.1-1 — `201`, `PLAYER`/`ACTIVE`, `sid` set; sign-in with the email in different letter case succeeds (after AUTH-10).
- API: PRD AC 15.1-2 — duplicate email in different letter case, active or soft-deleted → `409`; row count unchanged.
- API: PRD AC 15.1-3, 15.1-4, 15.1-5, 15.1-6 — the codes from AUTH-05 and `AUTH_INVALID_SKILL_LEVEL`; no rows written.
- Integration: PRD AC 15.1-7 — `skillLevelCode: "AVERAGE"` stores the rank-4 skill level.
- Integration: if the session insert fails, no `users` or `player_profiles` row remains.

**Acceptance criteria**

- **Given** no account uses `new@example.com`
  **When** a visitor posts valid input with `email: "New@Example.com"` and `skillLevelCode: "AVERAGE"`
  **Then** the response is `201` with `role: "PLAYER"`, the stored email is `new@example.com`, the profile's skill level has rank 4, and `sid` and `csrf_token` cookies are set.

- **Given** a soft-deleted account uses `old@example.com`
  **When** a visitor registers with `OLD@example.com`
  **Then** the response is `409 AUTH_EMAIL_ALREADY_REGISTERED`, and no row is created.

- **Given** a request body containing `"role": "ADMIN"`
  **When** it is posted
  **Then** the response is `400 AUTH_VALIDATION_FAILED`, and no account is created.

**References:** Tech Design §7.4, §8.1, §9, §12, §13, §19; PRD §6.1, §7.1, §15.1, Decisions #1, #4, #5, #6, #7.

---

## AUTH-10: `POST /auth/login` with account lockout

```text
Status: TODO
Size: L
Blocked by: N/A
```

**Objective:** Sign users in, apply the persistent lockout, and return the approved error responses (PRD §6.3, §7.3, §7.7).

**Scope**

- In scope:
  - The sign-in route and service.
  - Lockout repository functions.
  - Session cleanup at sign-in.
  - Sign-in logs.
- Out of scope: clearing the lockout when an Admin sets a password (AUTH-13).

**Implementation requirements**

1. Route chain: login rate limiter → validation → controller → service.
2. Service flow (Tech Design §8.3):
   1. Look up the user by email.
   2. Unknown email or `deleted_at` set → dummy verification (AUTH-05) → `401 AUTH_INVALID_CREDENTIALS`, without reading or writing `auth_login_lockouts`.
   3. `locked_until > now()` → `429 AUTH_ACCOUNT_LOCKED` with `Retry-After` (seconds) and `details: [{ "lockedUntil": "<ISO-8601>" }]`, without checking the password.
   4. Wrong password → record the failure, then `401 AUTH_INVALID_CREDENTIALS`.
   5. Correct password → set `failed_attempts = 0` and `locked_until = NULL`.
   6. `SUSPENDED` or `DEACTIVATED` → `403 AUTH_ACCOUNT_RESTRICTED`.
   7. Delete that user's revoked or expired sessions, create a session, set cookies.
   8. Respond `200 { data: { id, email, role, requiresPasswordChange } }`.
3. Record a failure with one atomic upsert on `auth_login_lockouts (user_id)` that, in the same statement:
   - treats an expired lock as `failed_attempts = 0`;
   - increments the counter;
   - sets `locked_until = now() + lockout minutes` only on the transition to the threshold (Tech Design §8.4).
4. The three `401 AUTH_INVALID_CREDENTIALS` branches return byte-identical status and body.
5. Log every attempt with its real reason (`unknown_email`, `wrong_password`, `locked`, `suspended`, `deactivated`, `soft_deleted`, `success`) and log when a lock is entered. Never log the password.

**Files/areas affected:**

- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.repository.ts`

**API impact:** new `POST /api/v1/auth/login` (Tech Design §9.1, §9.3).

**Schema/config impact:** reads and writes `auth_login_lockouts` and `auth_sessions`; reads the lockout and session configuration (AUTH-04).

**Testing requirements** (Tech Design §16)

- API: PRD AC 15.3-1 to 15.3-6 and 15.3-10.
- Integration (time-controlled): PRD AC 15.3-7 — sign-in succeeds after the lock expires, and `failed_attempts = 0`.
- Integration: PRD AC 15.3-8 — one failure, one success, one failure → not locked, counter = 1.
- Technical checks:
  - After lock expiry, one wrong password does not re-lock.
  - A soft-deleted account with six wrong passwords always gets `401`, never `429`, and has no lockout row.
  - Two parallel wrong-password requests raise the counter by exactly 2.
  - Five wrong passwords below the IP limit still lock the account.
  - The unknown-email and wrong-password bodies are byte-identical.

**Acceptance criteria**

- **Given** an `ACTIVE` account with five consecutive failed attempts
  **When** a sixth attempt uses the correct password
  **Then** the response is `429 AUTH_ACCOUNT_LOCKED` with `Retry-After` and `details[0].lockedUntil`, and no session is created.

- **Given** a soft-deleted account
  **When** six sign-ins with wrong passwords are made
  **Then** every response is `401 AUTH_INVALID_CREDENTIALS`, and no `auth_login_lockouts` row exists.

- **Given** a `SUSPENDED` account
  **When** the user signs in with the correct password
  **Then** the response is `403 AUTH_ACCOUNT_RESTRICTED`, and no session is created.

**References:** Tech Design §8.3, §8.4, §9, §12, §13, §19, Decisions #9, #17 (lock reset, done in AUTH-13), #18; PRD §7.3, §7.7, §15.3, Decisions #9, #15, #16.

---

## AUTH-11: `GET /auth/me` and `POST /auth/logout`

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Let the frontend restore auth state, and let users sign out of the current device.

**Scope**

- In scope: both routes.
- Out of scope: sign-out from all devices, which is not part of MVP (PRD Decision #12).

**Implementation requirements**

1. `GET /api/v1/auth/me`:
   - Protected by `authenticate`, and allowed while `must_change_password` is set.
   - Responds `200 { data: { id, email, role, requiresPasswordChange } }`.
   - When the `csrf_token` cookie is missing, issues a new one with `Max-Age` matching the session's remaining lifetime.
2. `POST /api/v1/auth/logout`:
   - Not protected by `authenticate`; the app-level CSRF check applies.
   - When `sid` is present, set `revoked_at = now()` on the matching session, if any.
   - Always clear `sid` and `csrf_token` and respond `204`.
   - Log the revocation with trigger `sign_out`.

**Files/areas affected:**

- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`

**API impact:** new `GET /api/v1/auth/me` and `POST /api/v1/auth/logout` (Tech Design §9.1).

**Schema/config impact:** updates `auth_sessions.revoked_at`.

**Testing requirements**

- Integration (time-controlled): PRD AC 15.4-1 — within the idle and absolute limits, `GET /auth/me` returns `200`.
- API: PRD AC 15.4-3 — after sign-out, the old cookie gets `401 AUTH_SESSION_INVALID`.
- API: PRD AC 15.4-4 — two sessions; sign out one; the other still gets `200`.
- API: PRD AC 15.6-3 (API part) — without a session, `GET /auth/me` returns `401`.
- API: sign-out with an unknown, revoked, or missing session returns `204`.
- API: with `must_change_password = true`, `GET /auth/me` returns `200` with `requiresPasswordChange: true`, and sign-out returns `204`.

**Acceptance criteria**

- **Given** the same account signed in on two devices
  **When** device A signs out
  **Then** device A's next `GET /auth/me` returns `401 AUTH_SESSION_INVALID`, and device B's returns `200`.

- **Given** a request with no `sid` cookie
  **When** `POST /api/v1/auth/logout` is called
  **Then** the response is `204`.

**References:** Tech Design §8.5, §8.7, §9.1, Decisions #7, #12; PRD §6.5, §7.6, §15.4.

---

## AUTH-12: `POST /auth/password/change`

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Let a signed-in user change their password, which also satisfies a forced change (PRD §6.9, §7.5).

**Scope**

- In scope: the route and service.
- Out of scope: revoking other sessions, which is not done for a self-service change (Decision #13).

**Implementation requirements**

1. Route chain: password-change rate limiter → `authenticate` (allowed while `must_change_password` is set) → validation → controller → service. The CSRF check applies.
2. Wrong `currentPassword` → `400 AUTH_CURRENT_PASSWORD_INCORRECT`. The password is not changed, and `auth_login_lockouts` is not touched.
3. Otherwise update `password_hash`, set `must_change_password = false`, and respond `200 { data: { id, email, role, requiresPasswordChange: false } }`.
4. No session is revoked, including the caller's.

**Files/areas affected:**

- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`

**API impact:** new `POST /api/v1/auth/password/change` (Tech Design §9.1).

**Schema/config impact:** updates `users.password_hash` and `users.must_change_password`.

**Testing requirements**

- API: PRD AC 15.5-1 — `200`; the old password fails at sign-in; the new one succeeds; other sessions still get `200`.
- API: PRD AC 15.5-2 — `400 AUTH_CURRENT_PASSWORD_INCORRECT`; the hash is unchanged.
- API: Tech Design §20, third criterion — a route blocked with `403 AUTH_PASSWORD_CHANGE_REQUIRED` is allowed after a successful change.

**Acceptance criteria**

- **Given** a signed-in user with `must_change_password = true`
  **When** they submit the correct current password and a valid new password
  **Then** the response is `200` with `requiresPasswordChange: false`, and a previously blocked protected route now succeeds.

- **Given** a signed-in user
  **When** they submit a wrong current password
  **Then** the response is `400 AUTH_CURRENT_PASSWORD_INCORRECT`, and the stored hash is unchanged.

**References:** Tech Design §8.9, §9, Decision #13; PRD §6.9, §7.5, §15.5, Decisions #17, #18.

---

## AUTH-13: Service functions for Admin User Management

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Provide the two service functions that Admin User Management endpoints must call (Tech Design §7.2), verified at service level.

**Scope**

- In scope: `authService.createCourtOwnerAccount` and `authService.adminSetPassword`.
- Out of scope:
  - Any HTTP endpoint. Endpoints and their request validation of `businessName` and `phone` belong to Admin User Management.
  - End-to-end verification through those endpoints (AUTH-23).

**Implementation requirements**

1. `createCourtOwnerAccount({ email, initialPassword, businessName, phone })`:
   - Normalize the email as in registration and apply the password policy.
   - Duplicate email (any status) → the same duplicate-email error as registration.
   - In one transaction, insert `users` (`COURT_OWNER`, `ACTIVE`, `must_change_password = true`) and `court_owner_profiles`.
2. `adminSetPassword(userId, newPassword)`:
   - Apply the password policy.
   - In one transaction:
     - update `password_hash`;
     - set `must_change_password = true`;
     - revoke every `auth_sessions` row of the user;
     - set `failed_attempts = 0` and `locked_until = NULL` in `auth_login_lockouts`.
3. Log session revocation with trigger `admin_set_password`.
4. Neither function changes `users.role` (PRD AC 15.6-1).

**Files/areas affected:**

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.repository.ts`

**API impact:** none (internal functions).

**Schema/config impact:** writes `users`, `court_owner_profiles`, `auth_sessions`, `auth_login_lockouts`.

**Testing requirements** (service level; end-to-end is AUTH-23)

- Integration: PRD AC 15.2-1, 15.2-2.
  1. Create a Court Owner.
  2. Sign-in returns `requiresPasswordChange: true`, and protected routes return `403`.
  3. After the password change, signing in again returns `requiresPasswordChange: false`.
- Integration: PRD AC 15.3-9 — after `adminSetPassword`, the old password fails and the new one succeeds with `requiresPasswordChange: true`.
- Integration: PRD AC 15.3-11 — on a locked account, `adminSetPassword` lets the new password sign in at once, and `failed_attempts = 0`.
- Integration: PRD AC 15.4-6 — every existing session returns `401 AUTH_SESSION_INVALID` afterward.
- Integration: if any step of `adminSetPassword` fails, none of the four changes remain.

**Acceptance criteria**

- **Given** a locked account with two active sessions
  **When** `adminSetPassword` runs with a valid password
  **Then** both sessions are revoked, `failed_attempts = 0`, `locked_until` is `NULL`, and sign-in with the new password returns `200` with `requiresPasswordChange: true`.

- **Given** an email already used by a soft-deleted account
  **When** `createCourtOwnerAccount` is called with it
  **Then** no row is written, and the duplicate-email error is raised.

**References:** Tech Design §7.2, §8.2, §8.8, §13, Decision #17; PRD §6.2, §6.8, §7.7, Decisions #2, #14, #17, #26; `docs/architecture/database-schema.md` §6.

---

## AUTH-14: Operator script to provision Admin accounts

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Let an operator create Admin accounts outside the product with a correct email and password hash (Decision #19).

**Scope**

- In scope: `authService.createAdminAccount`, `backend/src/scripts/create-admin.ts`, and the `admin:create` npm script.
- Out of scope: any HTTP route or UI for creating Admins (PRD Decision #3).

**Implementation requirements**

1. `createAdminAccount({ email, password })`:
   - Normalize the email and apply the password policy.
   - Duplicate email (any status) → fail.
   - Insert `users` with `ADMIN`, `ACTIVE`, `must_change_password = false`.
2. The script:
   - Loads `env.ts`, takes the email as a command-line argument, and reads the password from standard input, never from an argument.
   - Calls `createAdminAccount`.
   - Prints the new user ID on success.
   - Exits non-zero with a message that contains no password on any failure.
3. `backend/package.json`: `"admin:create": "npx tsx src/scripts/create-admin.ts"`, following the existing `db:migrate` pattern.

**Files/areas affected:**

- `backend/src/scripts/create-admin.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/package.json`

**API impact:** none.

**Schema/config impact:** writes `users`.

**Testing requirements** (Tech Design §16, Admin provisioning script)

- Integration: `Admin@Example.com` is stored as `admin@example.com`, and sign-in works with either letter case.
- Integration: a duplicate email, or a password breaking the policy, writes nothing and exits non-zero.
- Integration: the password is not accepted as an argument and never appears in output.

**Acceptance criteria**

- **Given** no account uses `admin@example.com`
  **When** an operator runs `npm run admin:create --prefix backend -- Admin@Example.com` and types a valid password on standard input
  **Then** a `users` row with role `ADMIN`, status `ACTIVE`, and email `admin@example.com` exists, and signing in with `ADMIN@EXAMPLE.COM` succeeds.

- **Given** the email already exists
  **When** the script runs
  **Then** it exits with a non-zero code, and no row is written.

**References:** Tech Design §7.1, §7.2, §12, §13, §17 step 8, Decision #19; PRD Decision #3.

---

## AUTH-15: Frontend foundation — proxy, router, HTTP client, auth state, route guard

```text
Status: TODO
Size: M
Blocked by: N/A
```

**Objective:** Replace the Vite starter with the auth-aware application shell described in Tech Design §7.5.

**Scope**

- In scope:
  - `react-router-dom`, the Vite proxy, and the HTTP client.
  - `AuthProvider` and `useAuth`, plus the `RequireAuth` guard.
  - The route table, placeholder role home pages with a sign-out control, and the access-denied page.
- Out of scope: sign-in, change-password, and register pages (AUTH-16 to AUTH-18).

**Implementation requirements**

1. Add `react-router-dom` (approved in `tech-stack.md`).
2. `vite.config.ts`: `server.proxy` sends `/api` to `http://localhost:3000`.
3. `shared/api/http-client.ts`:
   - JSON requests.
   - Sends `X-CSRF-Token` from the `csrf_token` cookie on `POST`, `PUT`, `PATCH`, and `DELETE`.
   - `401 AUTH_SESSION_INVALID` or `AUTH_SESSION_EXPIRED` → auth state becomes `unauthenticated`; navigate to `/sign-in` with a "session ended" message.
   - `403 AUTH_PASSWORD_CHANGE_REQUIRED` → state becomes `passwordChangeRequired`.
   - `403 AUTH_CSRF_TOKEN_INVALID` → call `GET /auth/me` once, then retry once.
   - Returns other errors to the caller with `code` and `details`.
4. `features/auth/auth-api.ts`: `register`, `signIn`, `signOut`, `me`, `changePassword`.
5. `auth-provider.tsx` and `use-auth.ts`:
   - States `loading`, `unauthenticated`, `authenticated`, `passwordChangeRequired`.
   - Calls `GET /auth/me` once on start.
   - `signOut` calls `POST /auth/logout`, sets `unauthenticated`, and navigates to `/sign-in`.
6. `shared/auth/require-auth.tsx` (optional `roles`):
   - `loading` → loading state, no redirect.
   - `unauthenticated` → `/sign-in`.
   - `passwordChangeRequired` → `/change-password`.
   - Role not allowed → access-denied page.
7. `app/router.tsx`:
   - `/sign-in` and `/register` are public.
   - `/change-password` requires any signed-in user.
   - `/` requires `PLAYER`, `/owner` requires `COURT_OWNER`, `/admin` requires `ADMIN`.
   - The role home pages are placeholders (Tech Design §7.5) and each shows a sign-out control (PRD §9).
8. `app/role-home.ts`: `PLAYER` → `/`, `COURT_OWNER` → `/owner`, `ADMIN` → `/admin`.
9. `main.tsx` renders `AuthProvider` and the router. Remove the starter content that is no longer referenced.

**Files/areas affected:**

- `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`
- `frontend/src/app/router.tsx`, `frontend/src/app/role-home.ts`
- `frontend/src/shared/api/http-client.ts`, `frontend/src/shared/auth/require-auth.tsx`
- `frontend/src/features/auth/auth-api.ts`, `auth-provider.tsx`, `use-auth.ts`, `access-denied-page.tsx`
- Starter files: `frontend/src/App.tsx`, `App.css`, unused assets

**API impact:** consumes `/api/v1/auth/*`.

**Schema/config impact:** none.

**Testing requirements**

- E2E (needs AUTH-19):
  - PRD AC 15.4-1: a reload keeps the user signed in.
  - PRD AC 15.4-3: after sign-out, a guarded page redirects to `/sign-in`.
  - PRD AC 15.6-3: a visitor opening a guarded page is sent to `/sign-in`.
  - PRD AC 15.6-5: a `PLAYER` opening `/admin` sees the access-denied page.
- Manual until AUTH-19: the same four flows, against the running backend through the Vite proxy.

**Acceptance criteria**

- **Given** a signed-in `PLAYER`
  **When** they reload `/`
  **Then** they stay on `/` without being asked to sign in.

- **Given** a signed-in `PLAYER`
  **When** they open `/admin`
  **Then** the access-denied page is shown, not the sign-in page.

- **Given** the backend returns `403 AUTH_CSRF_TOKEN_INVALID` for a request
  **When** the client handles it
  **Then** it calls `GET /auth/me` once and retries the original request once.

**References:** Tech Design §7.4, §7.5, Decisions #4, #6, #7; PRD §6.4, §6.6, §7.8, §9.

---

## AUTH-16: Sign-in page

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Provide the sign-in page with the messages approved in PRD §9.

**Scope**

- In scope: `/sign-in` form, error messages, support contact, redirect after success, link to register.
- Out of scope: register page (AUTH-18).

**Implementation requirements**

1. Email and password fields. The password field is masked. The form cannot be submitted twice while a request is in progress.
2. Messages chosen by `error.code`:
   - `AUTH_INVALID_CREDENTIALS` → exactly "Email hoặc mật khẩu không đúng".
   - `AUTH_ACCOUNT_RESTRICTED` → the account is restricted; contact support (no reason).
   - `AUTH_ACCOUNT_LOCKED` → temporarily locked, with the approximate unlock time from `details[0].lockedUntil`.
   - `AUTH_RATE_LIMITED` → try again later.
   - Field errors → from `details`.
   - Messages are text, not color only.
   - Exact wording is defined only for invalid credentials; the other messages must convey the PRD §9 content and are reviewed by the PM.
3. Show the support contact from `VITE_SUPPORT_CONTACT` (PRD Decision #23). Add the variable to `frontend/.env.example`. Operations must supply the value before release.
4. On success: go to `/change-password` if `requiresPasswordChange`, otherwise to the role's starting route.

**Files/areas affected:**

- `frontend/src/features/auth/sign-in-page.tsx`
- `frontend/src/app/router.tsx`
- `frontend/.env.example`

**API impact:** consumes `POST /api/v1/auth/login`.

**Schema/config impact:** new frontend variable `VITE_SUPPORT_CONTACT`.

**Testing requirements**

- E2E (needs AUTH-19):
  - Wrong password and unknown email show the identical message.
  - A locked account shows an unlock time.
  - A forced-change account lands on `/change-password`.
- Manual until AUTH-19: the same flows.

**Acceptance criteria**

- **Given** a wrong password, and separately an unknown email
  **When** the user submits the sign-in form
  **Then** both show exactly "Email hoặc mật khẩu không đúng".

- **Given** an account with `must_change_password = true`
  **When** the user signs in successfully
  **Then** they are taken to `/change-password`.

**References:** Tech Design §7.5; PRD §6.3, §6.10, §9, Decisions #15, #16, #23.

---

## AUTH-17: Change-password page (voluntary and forced)

```text
Status: TODO
Size: S
Blocked by: N/A
```

**Objective:** Provide the password-change step for both voluntary and forced changes (PRD §7.5, §9).

**Scope**

- In scope: `/change-password` form, both modes, and the success redirect.
- Out of scope: confirm-password or other fields not in the API contract.

**Implementation requirements**

1. Fields: `currentPassword` and `newPassword`, both masked. Submit once.
2. Show the password requirements from PRD Decision #8: 8–64 characters, and not the same as the email.
3. Forced mode (`passwordChangeRequired`): the page cannot be dismissed, and no other route is reachable except sign-out (AUTH-15 guard).
4. Messages by code: `AUTH_CURRENT_PASSWORD_INCORRECT`, `AUTH_PASSWORD_POLICY_VIOLATION`, `AUTH_RATE_LIMITED`.
5. On success: state becomes `authenticated`; navigate to the role's starting route.

**Files/areas affected:**

- `frontend/src/features/auth/change-password-page.tsx`
- `frontend/src/app/router.tsx`

**API impact:** consumes `POST /api/v1/auth/password/change`.

**Schema/config impact:** none.

**Testing requirements**

- E2E (needs AUTH-19): forced mode blocks navigation until a successful change, then lands on the role home.
- Manual until AUTH-19: the same flow, plus the wrong-current-password message.

**Acceptance criteria**

- **Given** a user in `passwordChangeRequired` state
  **When** they try to open `/` or `/owner`
  **Then** they are sent back to `/change-password`.

- **Given** the forced change succeeds
  **When** the response arrives
  **Then** the user lands on their role's starting route.

**References:** Tech Design §7.5, §8.9; PRD §6.2 step 4, §6.8, §6.9, §7.5, §9.

---

## AUTH-18: Register page

```text
Status: BLOCKED
Size: S
Blocked by: Q5 — how the frontend gets the skill-level catalog
```

**Objective:** Provide the Player registration page (PRD §6.1, §9).

**Scope**

- In scope:
  - `/register` form with email, password, full name, and skill level.
  - Password requirements.
  - Success confirmation, automatic sign-in, and redirect to `/`.
- Out of scope: any backend change (depends on Q5).

**Why blocked:** the page must show each level's name and self-assessment description (`docs/business-rules-config-matrix.md` §1.2), but the Tech Design has no API that returns the catalog. Hard-coding the list would contradict Tech Design §9.2 ("catalog changes need no code change"). Choosing either option is a design decision (Q5).

**Implementation requirements** (once Q5 is decided)

1. Fields: email, password (masked), full name, skill level (options with descriptions from the Q5 source). Submit once.
2. Show the password requirements from PRD Decision #8.
3. Messages by code: `AUTH_EMAIL_ALREADY_REGISTERED`, `AUTH_PASSWORD_POLICY_VIOLATION`, `AUTH_INVALID_SKILL_LEVEL`, `AUTH_VALIDATION_FAILED` (field errors), `AUTH_RATE_LIMITED`.
4. On `201`: confirm registration, set state to `authenticated`, navigate to `/`.

**Files/areas affected:**

- `frontend/src/features/auth/register-page.tsx`
- `frontend/src/app/router.tsx`
- `[TBD — depends on Q5]`

**API impact:** consumes `POST /api/v1/auth/register`; the catalog source depends on Q5.

**Schema/config impact:** none.

**Testing requirements:** E2E (needs AUTH-19) — valid registration lands on `/` signed in; a duplicate email shows its message.

**Acceptance criteria**

- **Given** a visitor on `/register`
  **When** they open the skill-level field
  **Then** the six levels from matrix §1.2 are shown in rank order, each with its self-assessment description.

- **Given** valid input
  **When** the visitor submits
  **Then** a confirmation is shown, and they arrive at `/` already signed in.

**References:** Tech Design §7.5, §9.2; PRD §6.1, §9, Decisions #4, #5; `docs/business-rules-config-matrix.md` §1.2.

---

## AUTH-19: Automated test harness

```text
Status: BLOCKED
Size: M
Blocked by: Q1 — test framework, test database, and E2E tooling (TBD in tech-stack.md; Tech Design Decision #14)
```

**Objective:** Make the "Testing requirements" of every task runnable.

**Scope**

- In scope:
  - Backend unit, integration, and API test runner.
  - Test database setup with migrations.
  - Helpers for creating users and sessions and controlling time.
  - E2E tooling if Q1 chooses it.
- Out of scope: CI pipeline setup (not in any governing document).

**Why blocked:** no testing framework, test database strategy, or E2E tool is approved. `tech-stack.md` lists "Testing Tools: TBD", and the Tech Design deliberately does not choose one (Decision #14).

**Implementation requirements** (once Q1 is decided)

1. Add the approved test dependencies and a `test` script in `backend/package.json` (and `frontend/package.json` if E2E is approved).
2. Test database: create and migrate it with the existing `db:migrate`, and isolate data between tests.
3. Helpers: create a user in any role and status, sign in and return cookies, and set timestamps for time-controlled tests.
4. `PASSWORD_PEPPER` and other test variables come from a test environment file that is not committed with real secrets.

**Files/areas affected:** `[TBD — depends on Q1]`.

**API impact:** none.

**Schema/config impact:** test-only environment.

**Testing requirements:** one sample API test against `GET /health` runs and passes in a clean checkout.

**Acceptance criteria**

- **Given** a clean checkout with the database container running
  **When** the documented test command is run
  **Then** migrations are applied to the test database, and the sample test passes.

**References:** Tech Design §16, Decision #14; `docs/architecture/tech-stack.md` (Testing Strategy); `docs/architecture/conventions.md` (Testing Conventions).

---

## AUTH-20: Response code for unexpected server errors

```text
Status: BLOCKED
Size: S
Blocked by: Q2 — error code for 500 responses
```

**Objective:** Complete the centralized error handler for errors that are not application errors.

**Why blocked:**

- Tech Design §9.3 says unexpected failures return `500` "with no internal details" but defines no error code.
- `conventions.md` requires every error body to carry a `code`.
- `AGENTS.md` §7 forbids inventing error-code names.

**Implementation requirements** (once Q2 is decided)

1. In `error-handler.ts`, any error that is not an application error → `500` with the approved code, a generic message, and `details: []`. Log the original error server-side only.
2. Add the code to the global conventions location chosen in Q2.

**Files/areas affected:** `backend/src/shared/http/error-handler.ts`; the document chosen in Q2.

**API impact:** defines the `500` body for every module.

**Schema/config impact:** none.

**Testing requirements:** Unit — a thrown generic error returns `500` with the approved code, and the body contains no message, stack trace, or SQL from the original error.

**Acceptance criteria**

- **Given** a route throws an unexpected error whose message contains SQL
  **When** the request completes
  **Then** the response is `500` with the approved code, a generic message, and no part of the original message.

**References:** Tech Design §9.3, §12; `docs/architecture/conventions.md` (Error Handling); `AGENTS.md` §7.

---

## AUTH-21: Error code when several fields fail validation

```text
Status: BLOCKED
Size: S
Blocked by: Q3 — top-level code when field errors map to different codes
```

**Objective:** Define the top-level `error.code` for a request with failures that map to different codes. Example: an invalid email (`AUTH_VALIDATION_FAILED`) together with a short password (`AUTH_PASSWORD_POLICY_VIOLATION`).

**Why blocked:** Tech Design §9.2 defines one code per field and says `details` lists `{ field, code }`. It does not say which code goes in the top-level `error.code` when the codes differ.

**Implementation requirements** (once Q3 is decided)

1. Extend the AUTH-05 mapping to apply the decided rule.
2. Update Tech Design §9.2 through the Tech Lead, if Q3 requires it.

**Files/areas affected:** `backend/src/modules/auth/auth.validation.ts`.

**API impact:** top-level error code for mixed validation failures on register and password change.

**Schema/config impact:** none.

**Testing requirements:** Unit — an invalid email plus a 7-character password returns the decided top-level code, and `details` contains both fields with their own codes.

**Acceptance criteria**

- **Given** a register body with a malformed email and a 7-character password
  **When** it is posted
  **Then** the response is `400` with the top-level code decided in Q3, and `details` lists `email` with `AUTH_VALIDATION_FAILED` and `password` with `AUTH_PASSWORD_POLICY_VIOLATION`.

**References:** Tech Design §9.2, §9.3.

---

## AUTH-22: Handling an invalid `AUTH_*` configuration value

```text
Status: BLOCKED
Size: S
Blocked by: Q4 — behavior when a configuration row holds a non-positive or non-integer value
```

**Objective:** Define and implement what the configuration reader does with an invalid stored value.

**Why blocked:**

- Tech Design §7.3 and §12 define only the missing-row case (use the default and log a warning).
- A value such as `'abc'` or `'0'` is undefined behavior. With `'0'`, a new session would violate `CHECK (idle_timeout_minutes > 0)`.

**Implementation requirements** (once Q4 is decided)

1. Extend `system-config.ts` with the decided behavior.
2. Update Tech Design §12 through the Tech Lead.

**Files/areas affected:** `backend/src/shared/config/system-config.ts`.

**API impact:** depends on Q4.

**Schema/config impact:** none.

**Testing requirements:** Integration — with `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER = '0'` and with `'abc'`, the decided behavior occurs.

**Acceptance criteria**

- **Given** `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` is stored as `'abc'`
  **When** a Player signs in
  **Then** the behavior decided in Q4 occurs, and a server log line names the key.

**References:** Tech Design §7.3, §12, §14; `docs/business-rules-config-matrix.md` §8.7; `docs/architecture/database-schema.md` §5.12.

---

## AUTH-23: End-to-end verification through Admin User Management endpoints

```text
Status: BLOCKED
Size: S
Blocked by: Admin User Management PRD, Tech Design, and Tasks not yet updated (Auth PRD Follow-ups #1–#3)
```

**Objective:** Verify PRD AC 15.2-1, 15.2-2, 15.3-9, 15.3-11, 15.4-6 through the real Admin endpoints, not only at service level (AUTH-13).

**Why blocked:** Admin User Management has no Court Owner creation endpoint yet. Its Ready Tech Design still says an Admin-set password does not force a change, and it does not revoke sessions or clear the lockout. Its `POST /api/v1/admin/users/:id/password` must call `authService.adminSetPassword`.

**Implementation requirements** (once Admin User Management is updated and implemented)

1. API tests through the Admin endpoints for the five ACs.
2. Confirm the Admin endpoints use `authenticate`, `requireRole('ADMIN')`, and the CSRF header, not a Bearer token.

**Files/areas affected:** tests only; `[TBD — Admin User Management test locations]`.

**API impact:** none in this feature.

**Schema/config impact:** none.

**Testing requirements:** API — the five ACs above, end to end.

**Acceptance criteria**

- **Given** a locked user with two active sessions
  **When** an Admin calls the set-password endpoint with a valid password
  **Then** both sessions return `401`, and the user signs in at once with the new password and `requiresPasswordChange: true`.

**References:** Tech Design "Dependencies and Blocked Scope", §7.2, §8.2, §8.8; PRD Follow-ups #1–#3.

---

## Decisions Needed

Each question blocks only the task named. Owner for all: Tech Lead.

**Q1 (blocks AUTH-19). Which test tooling does the project use?**

- **Runner:**
  - **A.** Vitest + Supertest.
  - **B.** Jest + Supertest.
  - **Recommendation: A.** The frontend already uses Vite, so one runner can serve both.
- **Test database:**
  - **A.** A separate database (for example `badminton_test`) in the existing Docker PostgreSQL, migrated with `db:migrate` before the run, with tables cleaned between tests.
  - **B.** A throwaway container per run. This adds a new dependency such as Testcontainers.
  - **Recommendation: A.**
- **E2E** (UI parts of 15.4-1, 15.4-3, 15.6-3, 15.6-5):
  - **A.** Playwright.
  - **B.** A written manual checklist for MVP.
  - **Recommendation: A**, because `tech-stack.md` recommends E2E for critical flows and sign-in is the most critical one.
- Any choice requires updating "Testing Tools" in `tech-stack.md`.

**Q2 (blocks AUTH-20). What error code does a 500 response carry?**

- **A.** A global code `INTERNAL_ERROR`, documented once in `conventions.md` for all modules.
- **B.** A different name chosen by the Tech Lead, documented in the same place.
- Omitting the code is not offered, because it breaks the `conventions.md` error shape.
- **Recommendation: A.**

**Q3 (blocks AUTH-21). When field errors map to different codes, what is the top-level `error.code`?**

- **A.** `AUTH_VALIDATION_FAILED` whenever more than one code is involved. Each field keeps its own code in `details`.
- **B.** A fixed order, for example `AUTH_VALIDATION_FAILED` before `AUTH_PASSWORD_POLICY_VIOLATION` before `AUTH_INVALID_SKILL_LEVEL`, returning the first that applies.
- **Recommendation: A.** It is simpler, and the client already reads per-field codes from `details`.

**Q4 (blocks AUTH-22). What happens when a stored `AUTH_*` value is not a positive integer?**

- **A.** Treat it like a missing row: use the matrix §8.7 default, log a warning naming the key, and let the request succeed. This matches Tech Design §12.
- **B.** Fail the request with `500` and log an error, so the misconfiguration is noticed at once.
- **Recommendation: A.**

**Q5 (blocks AUTH-18). How does the register page get the skill-level catalog?**

- **A.** A new public endpoint `GET /api/v1/skill-levels` returning `200 { data: [{ code, name, rank, description }] }` sorted by rank, with no authentication. Needs a Tech Design §9 addition and a backend task.
- **B.** Hard-code the six levels in the frontend. Any change to matrix §1.2 then needs a frontend code change, and the list is duplicated outside the matrix.
- **Recommendation: A.**

## PRD Acceptance Criteria Traceability

| PRD AC | Task(s) |
| --- | --- |
| 15.1-1 to 15.1-7 | AUTH-09 (with AUTH-05 unit tests) |
| 15.2-1, 15.2-2 | AUTH-13 (service level), AUTH-23 (end to end, BLOCKED) |
| 15.3-1 to 15.3-8, 15.3-10 | AUTH-10 |
| 15.3-9, 15.3-11 | AUTH-13 (service level), AUTH-23 (end to end, BLOCKED) |
| 15.4-1 | AUTH-11 (API), AUTH-15 (E2E) |
| 15.4-2, 15.4-5 | AUTH-07 |
| 15.4-3 | AUTH-11 (API), AUTH-15 (E2E) |
| 15.4-4 | AUTH-11 |
| 15.4-6 | AUTH-13 (service level), AUTH-23 (end to end, BLOCKED) |
| 15.5-1, 15.5-2 | AUTH-12 |
| 15.6-1 | AUTH-13, AUTH-14 (no code path changes `users.role`) |
| 15.6-2, 15.6-6 | AUTH-07 (`requireRole` unit); API checks belong to future Player feature tasks |
| 15.6-3 | AUTH-11 (API), AUTH-15 (E2E) |
| 15.6-4 | Future Tournament and Booking feature tasks (public routes) |
| 15.6-5 | AUTH-07 (unit), AUTH-15 (E2E); API check on the first Admin User Management route |
| 15.6-7 to 15.6-9 | Future Tournament feature tasks (Organizer rules) |

## Notes and Follow-ups Outside This Task List

These need human action and are not implementation tasks here:

1. **Auth PRD "Related Documents":** still says "Task or issue: Not yet created". The PRD is Ready and frozen, so adding the link to this file needs approval.
2. **Admin User Management (Ready):**
   - PRD, Tech Design, and Tasks need the updates listed in Auth PRD Follow-ups #1–#3.
   - Its Tech Design §9 and §11 wording ("Bearer Token", "session/JWT").
   - Its `tasks.md` Task 1 still says there is no `must_change_password` field.
   - Unblocks AUTH-23.
3. **Admin Tournament Management Tech Design §5:** still refers to JWT (Auth Tech Design Follow-up 2).
4. **Existing local setup inconsistency, not caused by this feature:**
   - Root `.env.example` sets `DB_PORT=5432`.
   - `docker-compose.yml` defaults to `5433`, and `backend/.env.example` connects to `5433`.
   - Worth fixing before AUTH-19 sets up the test database.
5. **Visitors at `/`:** following Tech Design §7.5, `/` is the Player starting route and is guarded, so a visitor is sent to `/sign-in`. Public tournament and facility pages (PRD §7.8) will be added by those features.
