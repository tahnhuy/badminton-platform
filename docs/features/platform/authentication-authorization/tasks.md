# Authentication & Authorization - Task List

Implementation tasks for the Authentication & Authorization feature.

- Linked PRD: [prd.md](prd.md) (Ready)
- Linked Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved, decisions #1–#25)
- Registration skill survey (rewritten 2026-11-15): the PRD, Tech Design and schema subsections are Ready (human-approved 2026-11-22); tasks AUTH-29…AUTH-33 are Approved.
- Decision Gate: PASSED on 2026-09-16
- Task review: approved on 2026-09-16 by Tài (Tech Lead) — see "Decisions Applied"
- Assignee: TBD for every task

**Rules applied** (`.agents/AGENTS.md`, `docs/documentation-guide.md` §5.4): no task creates a new design decision or changes the PRD, the Tech Design, `database-schema.md`, or `docs/business-rules-config-matrix.md`.

**Task status values**

- `Approved`: reviewed and ready to start (same convention as the Admin User Management tasks). Execution then moves through `IN_PROGRESS` and `DONE` (`docs/templates/task-template.md`).
- `BLOCKED`: cannot start; the blocker is named.
- `Merged into AUTH-0x`: the work is part of the named task. The ID is kept for traceability.

**Testing conventions for every task** (`docs/architecture/tech-stack.md`, Tech Design §16)

- **Unit:** Vitest.
- **Integration and API:** Vitest + Supertest, against the test database set up in AUTH-19.
- **E2E:** Playwright (harness in AUTH-25), for three scenarios only:
  - sign-in (including reload, sign-out, and opening a guarded page afterward), in AUTH-16;
  - forced password change, in AUTH-17;
  - role-based denial, in AUTH-15.
- **Test-only routes:** a test helper registers them only when `NODE_ENV=test`. They never appear in `app.ts` or `index.ts`.

**Definition of Done:** the task's acceptance criteria pass, and the automated tests under "Testing requirements" exist and pass. Backend tests need AUTH-19; Playwright scenarios need AUTH-25. A task can be implemented before its harness exists, but cannot move to `DONE` until its tests run.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| AUTH-01 | Backend foundation: dependencies, environment config, app setup, DB client, error handling | DONE | — | M |
| AUTH-02 | Schema: `must_change_password`, `auth_sessions`, `auth_login_lockouts` | DONE | — | S |
| AUTH-03 | Seed data migration: skill levels and `AUTH_*` configuration | DONE | AUTH-02 | S |
| AUTH-04 | System configuration reader for `AUTH_*` keys | DONE | AUTH-01, AUTH-03 | S |
| AUTH-05 | Password hasher and request validation | DONE | AUTH-01 | M |
| AUTH-06 | Session store and cookie helpers | DONE | AUTH-01, AUTH-02, AUTH-04 | M |
| AUTH-07 | `authenticate` and `requireRole` middleware | DONE | AUTH-06 | M |
| AUTH-08 | CSRF middleware, IP rate limiters, and auth router skeleton | DONE | AUTH-01, AUTH-06 | M |
| AUTH-09 | `POST /auth/register` | DONE | AUTH-03, AUTH-05, AUTH-06, AUTH-08 | M |
| AUTH-10 | `POST /auth/login` with account lockout | DONE | AUTH-04, AUTH-05, AUTH-06, AUTH-08 | L |
| AUTH-11 | `GET /auth/me` and `POST /auth/logout` | DONE | AUTH-07, AUTH-08 | S |
| AUTH-12 | `POST /auth/password/change` | DONE | AUTH-05, AUTH-07, AUTH-08 | S |
| AUTH-13 | Service functions for Admin User Management | DONE | AUTH-05, AUTH-06, AUTH-07, AUTH-10, AUTH-12 | M |
| AUTH-14 | Operator script to provision Admin accounts | DONE | AUTH-02, AUTH-05, AUTH-10 | S |
| AUTH-15 | Frontend foundation: proxy, router, HTTP client, auth state, route guard | DONE | AUTH-11 | M |
| AUTH-16 | Sign-in page | DONE | AUTH-10, AUTH-15 | S |
| AUTH-17 | Change-password page (voluntary and forced) | DONE | AUTH-12, AUTH-15 | S |
| AUTH-18 | Register page | DONE | AUTH-09, AUTH-15, AUTH-24 | S |
| AUTH-19 | Backend test harness: Vitest, Supertest, test database | DONE | AUTH-01, AUTH-03 | M |
| AUTH-20 | Response code for unexpected server errors | Merged into AUTH-01 | — | — |
| AUTH-21 | Error code when several fields fail validation | Merged into AUTH-05 | — | — |
| AUTH-22 | Handling an invalid `AUTH_*` configuration value | Merged into AUTH-04 | — | — |
| AUTH-23 | End-to-end verification through Admin User Management endpoints | **BLOCKED** (Admin User Management) | AUTH-13 | S |
| AUTH-24 | `GET /api/v1/skill-levels` | DONE | AUTH-01, AUTH-03 | S |
| AUTH-25 | Playwright E2E harness | DONE | AUTH-15, AUTH-19 | M |


## Execution Order

Tasks in the same wave can run in parallel once the earlier waves they depend on are done.

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | AUTH-01, AUTH-02 | — |
| 2 | AUTH-03, AUTH-05 | AUTH-02 (for 03); AUTH-01 (for 05) |
| 3 | AUTH-04, AUTH-19, AUTH-24 | AUTH-01 and AUTH-03 |
| 4 | AUTH-06 | AUTH-01, AUTH-02, AUTH-04 |
| 5 | AUTH-07, AUTH-08 | AUTH-06 (and AUTH-01 for 08) |
| 6 | AUTH-09, AUTH-10, AUTH-11, AUTH-12 | See Summary |
| 7 | AUTH-13, AUTH-14, AUTH-15 | See Summary |
| 8 | AUTH-16, AUTH-17, AUTH-18, AUTH-25 | See Summary |
| Blocked | AUTH-23 | Admin User Management updates, then AUTH-13 |
| S1 | AUTH-29 | — (survey docs Ready 2026-11-22) |
| S2 | AUTH-30, AUTH-32, AUTH-33 | AUTH-29 |
| S3 | AUTH-31 | AUTH-30 |

Waves S1–S3 are the registration skill survey (added 2026-11-22; details from "Registration skill survey" near the end of this file). AUTH-26…AUTH-28 are superseded and have no wave.

Start AUTH-19 as early as wave 3 allows, so later tasks can run their tests as they are written.

---

## [ ] AUTH-01: Backend foundation — dependencies, environment config, app setup, DB client, error handling

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Provide the shared backend pieces every auth task needs:

- approved dependencies;
- validated environment config;
- an app module that tests can import;
- a Drizzle database client;
- application errors and unexpected errors in the `conventions.md` shape;
- leveled structured logging;
- removal of open CORS.

**Scope**

- In scope:
  - Install `zod`, `bcryptjs`, `express-rate-limit`.
  - `env.ts`.
  - Split `app.ts` (build) from `index.ts` (start).
  - DB client.
  - Application error type.
  - Centralized error handler, including `500 INTERNAL_ERROR` (merged from AUTH-20).
  - Log helper with levels.
  - Remove `app.use(cors())`.
  - Update `backend/.env.example`.
- Out of scope:
  - CSRF, rate limiters, auth router (AUTH-08).
  - Test tooling (AUTH-19).

**Implementation requirements**

1. Add `zod`, `bcryptjs`, `express-rate-limit` to `backend/package.json`, as approved in `tech-stack.md`. Add no other runtime dependency.
2. `shared/config/env.ts` validates the environment once at startup with Zod. If invalid, exit non-zero with a clear message that prints no secret values. Variables:
   - `NODE_ENV` (`development`, `test`, `production`) and `PORT` (default `3000`).
   - `DATABASE_URL`: required.
   - `PASSWORD_PEPPER`: required, base64, at least 32 bytes after decoding.
   - `COOKIE_SECURE`: honored only when `NODE_ENV` is not `production`; in production `Secure` is always on.
   - `TRUST_PROXY`: optional, off by default.
   - Rate limits, with defaults:

     | Variable | Default |
     | --- | --- |
     | `RATE_LIMIT_LOGIN_MAX` | 20 |
     | `RATE_LIMIT_LOGIN_WINDOW_MINUTES` | 15 |
     | `RATE_LIMIT_REGISTER_MAX` | 10 |
     | `RATE_LIMIT_REGISTER_WINDOW_MINUTES` | 60 |
     | `RATE_LIMIT_PASSWORD_CHANGE_MAX` | 10 |
     | `RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MINUTES` | 15 |
3. `app.ts` builds and exports the Express app (middleware, routes, error handler) without listening. `index.ts` loads `env.ts`, imports the app, and calls `listen`. This lets Supertest import the app and keeps test-only routes out of the running application (Tech Design §7.1, §16).
4. Drizzle client for runtime queries using `DATABASE_URL`. The migration runner keeps using `DIRECT_URL`.
5. `shared/http/app-error.ts`: an error carrying `code`, HTTP status, and `details`.
6. `shared/http/error-handler.ts`:
   - An application error → `{ "error": { "code", "message", "details" } }` with its status.
   - Any other error → `500` with `code: "INTERNAL_ERROR"`, a generic message, and `details: []`. The original error is logged at ERROR level (Decision #20, merged AUTH-20).
   - Responses never include stack traces, SQL, or internal messages.
7. Log helper:
   - Writes one JSON line per event through `console`, with levels `info`, `warn`, `error`.
   - No logging library, because Observability is TBD in `tech-stack.md`.
   - Callers must never pass passwords, raw tokens, CSRF tokens, or `PASSWORD_PEPPER`.
8. In `app.ts`, do not register `cors()`. Register the error handler last. Keep `GET /health` unchanged.
9. `backend/.env.example`: add every variable above. `PASSWORD_PEPPER` gets a placeholder that is clearly not a real secret.

**Files/areas affected**

- `backend/package.json`, `backend/.env.example`
- `backend/src/index.ts`, `backend/src/app.ts`
- `backend/src/shared/config/env.ts`
- `backend/src/shared/http/app-error.ts`, `backend/src/shared/http/error-handler.ts`
- `[Proposed — verify during implementation]` `backend/src/db/client.ts`
- `[Proposed — verify during implementation]` `backend/src/shared/logging/logger.ts`

**API impact:** CORS headers are no longer sent. Unexpected errors return `500 INTERNAL_ERROR`. `GET /health` is unchanged.

**Schema/config impact:** new environment variables only.

**Testing requirements**

- Vitest unit:
  - A missing `PASSWORD_PEPPER`, or one shorter than 32 bytes, fails validation.
  - Rate-limit variables fall back to their defaults.
  - `COOKIE_SECURE=false` has no effect when `NODE_ENV=production`.
- Vitest unit:
  - An application error returns the `conventions.md` shape.
  - A generic error returns `500 INTERNAL_ERROR`, with none of the original message, stack trace, or SQL.
- Vitest + Supertest API: `GET /health` returns `200`, and a request with a foreign `Origin` gets no `Access-Control-Allow-Origin` header.

**Acceptance criteria**

- **Given** `PASSWORD_PEPPER` is not set
  **When** the backend starts
  **Then** the process exits with a non-zero code and a message naming the variable, without printing any secret value.

- **Given** a route throws an application error with code `AUTH_ACCOUNT_RESTRICTED` and status 403
  **When** the request completes
  **Then** the response is `403` with body `{ "error": { "code": "AUTH_ACCOUNT_RESTRICTED", "message": ..., "details": [...] } }`.

- **Given** a route throws an unexpected error whose message contains SQL
  **When** the request completes
  **Then** the response is `500` with `code: "INTERNAL_ERROR"`, a generic message, and empty `details`, and the original error appears only in an ERROR log line.

- **Given** the backend is running
  **When** a request arrives with an `Origin` header from another site
  **Then** the response has no `Access-Control-Allow-Origin` header.

**References:** Tech Design §7.1, §7.3, §7.4, §9.3, §11, §12, §17 steps 1, 5, 7, §19, Decisions #4, #20; `docs/architecture/conventions.md` (Global Error Codes, Error Handling, Configuration & Environment).

---

## [ ] AUTH-02: Schema — `must_change_password`, `auth_sessions`, `auth_login_lockouts`

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Bring the Drizzle schema and migrations in line with `database-schema.md` §3.1, §3.27, §3.28, and §5.12.

**Scope**

- In scope: the `users.must_change_password` column, the two new tables with their unique key, index, and checks, and one generated migration.
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
3. Run `npm run db:generate`, review the generated SQL against `database-schema.md`, and keep the SQL with the updated `meta` snapshot and journal.
4. Apply with `npm run db:migrate`, both to an empty database and to one that already has `0000`.
5. `migrate.ts` only applies migrations forward, so rolling back means manually dropping the added objects (Tech Design §17). Never edit a migration file after it has been applied: the runner rejects checksum changes.

**Files/areas affected**

- `backend/src/db/schema/users.ts`, `backend/src/db/schema/index.ts`
- `[Proposed — verify during implementation]` `backend/src/db/schema/auth.ts`
- `backend/src/db/migrations/0001_*.sql`, `backend/src/db/migrations/meta/*`

**API impact:** none.

**Schema/config impact:** implements the approved delta in Tech Design §10.1–§10.2. No schema document change.

**Testing requirements**

- Vitest integration (test database):
  - Migrations apply cleanly from empty.
  - Each constraint rejects invalid data: duplicate `token_hash`; `failed_attempts = -1`; `idle_timeout_minutes = 0`.
- Manual: apply the migration to a database that already has `0000` and existing `users` rows.

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

## [ ] AUTH-03: Seed data migration — skill levels and `AUTH_*` configuration

```text
Status: DONE
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

- Vitest integration: after migrating, the rows match the matrix exactly.
- Vitest integration: when a `system_configs` row already exists with another value before this migration runs, that value is kept.

**Acceptance criteria**

- **Given** an empty database
  **When** all migrations run
  **Then** `skill_levels` has exactly the six rows with ranks 1–6 matching matrix §1.2 *(seven rows after AUTH-29, 2026-11-15)*, and `system_configs` has the eight `AUTH_*` keys with the §8.7 defaults.

- **Given** `system_configs` already contains `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD = '7'`
  **When** this migration runs
  **Then** the value stays `'7'`, and no duplicate row is created.

**References:** Tech Design §10.3, §17 step 4, Decision #11; `docs/business-rules-config-matrix.md` §1.2, §8.7.

---

## [ ] AUTH-04: System configuration reader for `AUTH_*` keys

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Read the eight `AUTH_*` values from `system_configs` with typed accessors, a 60-second cache, and the approved fallbacks for missing and invalid values.

**Scope**

- In scope:
  - Typed getters for the lockout threshold and duration.
  - Idle and absolute session timeout getters per role.
  - The cache.
  - Fallback for a missing row.
  - Fallback for an invalid value (merged from AUTH-22).
- Out of scope: any admin UI or API for editing configuration.

**Implementation requirements**

1. `shared/config/system-config.ts` reads the eight keys through the Drizzle client.
2. Cache the rows in process for 60 seconds (Decision #10); after expiry, the next read goes to the database.
3. A missing row returns the matrix §8.7 default and logs at WARN level with the key. The request is not failed.
4. A stored value that is not a positive integer (for example `'abc'` or `'0'`) returns the matrix §8.7 default and logs at ERROR level with the key and the stored value. The request is not failed (Decision #22).
5. Expose per-role accessors so callers never build key names by string concatenation: `PLAYER`, `COURT_OWNER`, and `ADMIN`, each with idle and absolute timeouts.

**Files/areas affected:** `backend/src/shared/config/system-config.ts`.

**API impact:** none.

**Schema/config impact:** reads `system_configs`. No change.

**Testing requirements**

- Vitest integration: a seeded value is returned.
- Vitest integration: a deleted row returns the default and logs one WARN line naming the key.
- Vitest integration: `'abc'` and `'0'` each return the default and log one ERROR line with the key and the stored value.
- Vitest integration (time-controlled): a changed value is not visible before 60 seconds and is visible after.

**Acceptance criteria**

- **Given** the seeded database
  **When** the admin idle timeout is read
  **Then** it returns `60`.

- **Given** the `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` row is deleted
  **When** the lockout duration is read
  **Then** it returns `15`, and a WARN line naming that key is logged.

- **Given** `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` is stored as `'abc'`
  **When** the Player idle timeout is read
  **Then** it returns `10080`, and an ERROR line naming the key and the value `abc` is logged.

**References:** Tech Design §7.3, §12, §14, §19, Decisions #10, #22; `docs/business-rules-config-matrix.md` §8.1, §8.7.

---

## [ ] AUTH-05: Password hasher and request validation

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Implement password normalization and hashing (Decisions #1, #16, #24, #25) and the Zod request schemas with the approved error-code rules (Tech Design §9.2, Decision #21).

**Scope**

- In scope:
  - `password-hasher.ts`: normalize, hash, verify, dummy verification.
  - `auth.validation.ts`: schemas for register, login, and password change, field codes, and the top-level code rule (merged from AUTH-21).
- Out of scope: the database check that a skill-level code exists (AUTH-09).

**Implementation requirements**

1. Normalize every password to Unicode NFKC before any policy check, hashing, or verification (Decision #24).
2. Hash = `bcryptjs` cost 12 over `base64(HMAC-SHA-256(key, message))`, using the async API only.
   - `key` = the bytes from base64-decoding `PASSWORD_PEPPER` (Decision #25).
   - `message` = the UTF-8 bytes of the NFKC-normalized password.
   - The normalization form and the key format must never change once passwords are stored.
3. Verify uses the same pipeline. The dummy verification compares against a fixed hash computed once at startup with the same pipeline (§8.3).
4. Schemas, all `.strict()`:
   - `email`: trimmed, lowercased, valid format, at most 254 characters.
   - Register `password` and `newPassword`: 8–64 code points after NFKC, and not equal to the normalized email compared case-insensitively.
   - Login `password` and `currentPassword`: 1–1024 characters, no policy check.
   - `fullName`: trimmed, 1–255 characters.
   - `skillLevelCode`: non-empty string.
5. Field codes:
   - Password-policy issues → `AUTH_PASSWORD_POLICY_VIOLATION`.
   - `skillLevelCode` issues → `AUTH_INVALID_SKILL_LEVEL`.
   - Any other issue, an unknown key, or a non-JSON body → `VALIDATION_FAILED`.
6. Top-level code: if every failing field has the same code, use it; otherwise use `VALIDATION_FAILED`. `details` lists `{ field, code }` for every failing field and never contains submitted values.

**Files/areas affected:** `backend/src/services/auth/password-hasher.ts`, `backend/src/validation/auth.validation.ts`.

**API impact:** defines the validation contract in Tech Design §9.2.

**Schema/config impact:** reads `PASSWORD_PEPPER` from `env.ts`.

**Testing requirements**

- Vitest unit:
  - A 64-code-point Vietnamese password with diacritics (more than 72 UTF-8 bytes) hashes and verifies.
  - A password identical in its first 72 bytes but different afterward does not verify.
- Vitest unit:
  - A password registered in composed form verifies when given in decomposed form, and the reverse.
  - A full-width letter verifies as its normal form.
- Vitest unit: the pre-hash output equals an independent `node:crypto` computation using the base64-decoded pepper and the NFKC-normalized password.
- Vitest unit:
  - 7 and 65 code points are rejected; 8 and 64 are accepted.
  - An emoji counts as one code point.
  - A password equal to the email in different letter case is rejected.
- Vitest unit:
  - A body with a `role` key → `VALIDATION_FAILED`.
  - A malformed email plus a 7-character password → top-level `VALIDATION_FAILED`, with `details` for both fields and their own codes.
  - `details` never contains submitted values.

**Acceptance criteria**

- **Given** `newPassword` equals `User@Example.com` and the email is `user@example.com`
  **When** it is validated
  **Then** it fails with top-level `AUTH_PASSWORD_POLICY_VIOLATION`.

- **Given** a password containing "ệ" hashed in composed form
  **When** the same password is verified in decomposed form
  **Then** verification succeeds.

- **Given** a register body with a malformed email and a 7-character password
  **When** it is validated
  **Then** the top-level code is `VALIDATION_FAILED`, and `details` lists `email` with `VALIDATION_FAILED` and `password` with `AUTH_PASSWORD_POLICY_VIOLATION`.

**References:** Tech Design §8.3, §9.2, §9.3, §11, Decisions #1, #16, #21, #24, #25; PRD Decision #8; `docs/architecture/conventions.md` (Global Error Codes).

---

## [ ] AUTH-06: Session store and cookie helpers

```text
Status: DONE
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

**Files/areas affected:** `backend/src/repositories/auth/auth.repository.ts`, `backend/src/shared/auth/session-cookie.ts`.

**API impact:** none directly.

**Schema/config impact:** uses `auth_sessions` and the AUTH-04 accessors.

**Testing requirements**

- Vitest integration:
  - The stored `token_hash` differs from the cookie token.
  - A new session copies the role's idle timeout.
  - Changing the configuration afterward does not change an existing session's `idle_timeout_minutes`.
- Vitest integration:
  - Revoke-all revokes only that user's sessions.
  - Cleanup deletes only revoked or expired rows of that user.
  - `last_seen_at` is not updated within 60 seconds.
- Vitest unit:
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

## [ ] AUTH-07: `authenticate` and `requireRole` middleware

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Provide the reusable protection for every protected route in this and other modules.

**Scope**

- In scope:
  - `authenticate` per Tech Design §8.5.
  - `requireRole(...roles)`.
  - Request typing.
  - The test helper that mounts test-only routes.
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
5. Test-only routes (Tech Design §16):
   - A helper inside the test suite mounts routes guarded by `authenticate` + `requireRole('PLAYER')`, `requireRole('COURT_OWNER')`, and `requireRole('ADMIN')`.
   - The helper registers them only when `NODE_ENV=test` and refuses otherwise.
   - These routes are never imported or registered in `app.ts` or `index.ts`.

**Files/areas affected**

- `backend/src/shared/auth/authenticate.middleware.ts`
- `backend/src/shared/auth/authorize.middleware.ts`
- `backend/src/shared/auth/types.ts`
- `[Proposed — verify during implementation]` test helper under the backend test folder chosen in AUTH-19

**API impact:** defines the shared `401`/`403` behavior for protected routes (`conventions.md` → Authentication). No production route is added.

**Schema/config impact:** none.

**Testing requirements**

- Vitest + Supertest API (test-only routes): each `authenticate` branch returns its code, and cookies are cleared on every `401`.
- Vitest integration (time-controlled): PRD AC 15.4-2 — an Admin session idle over 1 hour → `401 AUTH_SESSION_EXPIRED`; open over 8 hours → `401 AUTH_SESSION_INVALID`.
- Vitest integration: PRD AC 15.4-5 — after `status` becomes `SUSPENDED`/`DEACTIVATED`, or `deleted_at` is set, the next request → `401 AUTH_SESSION_INVALID`.
- Vitest unit: `requireRole` allows listed roles and returns `403 AUTH_FORBIDDEN_ROLE` otherwise.
- Vitest + Supertest API (test-only routes), auth-module part of PRD AC 15.6-2, 15.6-5, 15.6-6:
  - `COURT_OWNER` and `ADMIN` on the `PLAYER` route → `403 AUTH_FORBIDDEN_ROLE`.
  - `PLAYER` and `COURT_OWNER` on the `ADMIN` route → `403 AUTH_FORBIDDEN_ROLE`.
  - The matching role → `200`.
- Vitest unit: the test-route helper refuses to register routes when `NODE_ENV` is not `test`.

**Acceptance criteria**

- **Given** a valid session whose user was just set to `SUSPENDED`
  **When** any route protected by `authenticate` is called
  **Then** the response is `401 AUTH_SESSION_INVALID`, and `sid` and `csrf_token` are cleared.

- **Given** a valid session with `must_change_password = true`
  **When** a protected route other than `GET /api/v1/auth/me` or `POST /api/v1/auth/password/change` is called
  **Then** the response is `403 AUTH_PASSWORD_CHANGE_REQUIRED`.

- **Given** a signed-in `COURT_OWNER`
  **When** a test-only route protected by `requireRole('PLAYER')` is called
  **Then** the response is `403 AUTH_FORBIDDEN_ROLE`.

- **Given** the application started through `index.ts`
  **When** any test-only route path is requested
  **Then** the route does not exist.

**References:** Tech Design §7.2, §8.5, §9.3, §12, §16 (test-only routes); PRD §7.7, §7.8, Decision #13.

---

## [ ] AUTH-08: CSRF middleware, IP rate limiters, and auth router skeleton

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Add the app-level CSRF check (Decision #3), the per-IP rate limiters (Decision #5), and the shared auth router with its JSON-only guard, so the endpoint tasks AUTH-09 to AUTH-12 can run in parallel.

**Scope**

- In scope:
  - CSRF middleware for `/api/v1`.
  - The three rate limiters and `trust proxy` wiring.
  - An empty `auth.routes.ts` mounted at `/api/v1/auth`.
  - The JSON-only guard for auth routes.
- Out of scope: any auth endpoint (AUTH-09 to AUTH-12); account lockout (AUTH-10).

**Implementation requirements**

1. CSRF, for `POST`, `PUT`, `PATCH`, and `DELETE` under `/api/v1`:
   - Skip `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
   - Skip requests without a `sid` cookie.
   - Otherwise require `X-CSRF-Token` equal to the `csrf_token` cookie, using `crypto.timingSafeEqual` (a length mismatch fails).
   - Failure → `403 AUTH_CSRF_TOKEN_INVALID`.
   - Mounted once in `app.ts`, before any `/api/v1` router.
2. `rate-limit.ts`:
   - `express-rate-limit` instances for login, register, and password change, with limits from `env.ts` and the in-memory store.
   - Handler response: `429` with `Retry-After` and `{ "error": { "code": "AUTH_RATE_LIMITED", ... } }`.
   - Exported for the endpoint tasks to attach.
3. `app.ts`: `app.set('trust proxy', …)` from `TRUST_PROXY`, off by default.
4. `auth.routes.ts`: an empty router mounted at `/api/v1/auth` in `app.ts`.
5. JSON-only guard on that router: a request body with a content type other than `application/json`, or malformed JSON, → `400 VALIDATION_FAILED`. URL-encoded parsing must not apply to `/api/v1/auth`.

**Files/areas affected**

- `backend/src/shared/auth/csrf.middleware.ts`
- `backend/src/shared/http/rate-limit.ts`
- `backend/src/routes/auth/auth.routes.ts`
- `backend/src/app.ts`

**API impact:** mutating `/api/v1` requests made with a session must send `X-CSRF-Token`. New `429 AUTH_RATE_LIMITED` and `400 VALIDATION_FAILED` (non-JSON body on auth routes) responses.

**Schema/config impact:** uses the `RATE_LIMIT_*` and `TRUST_PROXY` variables from AUTH-01.

**Testing requirements**

- Vitest + Supertest API, CSRF (test-only routes):
  - With `sid`, a missing or wrong `X-CSRF-Token` → `403`; a matching one passes.
  - Without `sid`, the request passes.
  - `POST /api/v1/auth/register` and `/login` are not checked.
- Vitest + Supertest API, rate limit: requests beyond the configured limit get `429 AUTH_RATE_LIMITED` with `Retry-After`. The test uses a low limit set through the environment; the 21st login within 15 minutes is checked in AUTH-10.
- Vitest + Supertest API, JSON guard: a form-encoded body and malformed JSON sent to `/api/v1/auth/login` → `400 VALIDATION_FAILED`.

**Acceptance criteria**

- **Given** a request with a `sid` cookie to a mutating `/api/v1` route other than register and login, without `X-CSRF-Token`
  **When** it is sent
  **Then** the response is `403 AUTH_CSRF_TOKEN_INVALID`.

- **Given** `POST /api/v1/auth/login` with `Content-Type: application/x-www-form-urlencoded`
  **When** it is sent
  **Then** the response is `400 VALIDATION_FAILED`.

**References:** Tech Design §7.2, §7.4, §8.6, §11, §16 (CSRF, content type, rate limit), Decisions #3, #5, #21.

---

## [ ] AUTH-09: `POST /auth/register`

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Let a visitor self-register as a Player and be signed in immediately (PRD §6.1, §7.1).

**Scope**

- In scope: the register route, controller, and service.
- Out of scope: the router skeleton and JSON guard (AUTH-08); the register page (AUTH-18).

**Implementation requirements**

1. On `auth.routes.ts` (AUTH-08): register rate limiter → validation (AUTH-05) → controller → service.
2. Service flow (Tech Design §8.1):
   1. Look up `skill_levels.code`; if missing → `400 AUTH_INVALID_SKILL_LEVEL` with `details: [{ field: "skillLevelCode", code: "AUTH_INVALID_SKILL_LEVEL" }]`.
   2. Any `users` row with that email, including soft-deleted → `409 AUTH_EMAIL_ALREADY_REGISTERED`.
   3. Hash the password (AUTH-05).
   4. In one transaction: insert `users` (`PLAYER`, `ACTIVE`, `must_change_password = false`), `player_profiles` (`full_name`, `skill_level_id`), and a session.
   5. A unique violation on email inside the transaction → `409 AUTH_EMAIL_ALREADY_REGISTERED`.
3. The role is always set by the server.
4. Set `sid` and `csrf_token`. Respond `201 { data: { id, email, role, requiresPasswordChange: false } }`.
5. Log each registration result without personal secrets.

**Files/areas affected**

- `backend/src/routes/auth/auth.routes.ts`, `backend/src/controllers/auth/auth.controller.ts`, `backend/src/services/auth/auth.service.ts`, `backend/src/repositories/auth/auth.repository.ts`

**API impact:** new `POST /api/v1/auth/register` (Tech Design §9.1).

**Schema/config impact:** writes `users`, `player_profiles`, `auth_sessions`; reads `skill_levels`.

**Testing requirements** (Tech Design §16)

- Vitest + Supertest API: PRD AC 15.1-1 — `201`, `PLAYER`/`ACTIVE`, `sid` set. Sign-in with the email in different letter case succeeds (added once AUTH-10 exists).
- Vitest + Supertest API: PRD AC 15.1-2 — duplicate email in different letter case, active or soft-deleted → `409`; row count unchanged.
- Vitest + Supertest API: PRD AC 15.1-3 → `400 AUTH_PASSWORD_POLICY_VIOLATION`; 15.1-4 and 15.1-5 → `400 VALIDATION_FAILED`; 15.1-6 → `400 AUTH_INVALID_SKILL_LEVEL`. No rows written in any case.
- Vitest integration: PRD AC 15.1-7 — `skillLevelCode: "AVERAGE"` stores the rank-4 skill level.
- Vitest integration: if the session insert fails, no `users` or `player_profiles` row remains.

**Acceptance criteria**

- **Given** no account uses `new@example.com`
  **When** a visitor posts valid input with `email: "New@Example.com"` and `skillLevelCode: "AVERAGE"`
  **Then** the response is `201` with `role: "PLAYER"`, the stored email is `new@example.com`, the profile's skill level has rank 4, and `sid` and `csrf_token` cookies are set.

- **Given** a soft-deleted account uses `old@example.com`
  **When** a visitor registers with `OLD@example.com`
  **Then** the response is `409 AUTH_EMAIL_ALREADY_REGISTERED`, and no row is created.

- **Given** a request body containing `"role": "ADMIN"`
  **When** it is posted
  **Then** the response is `400 VALIDATION_FAILED`, and no account is created.

**References:** Tech Design §8.1, §9, §12, §13, §19; PRD §6.1, §7.1, §15.1, Decisions #1, #4, #5, #6, #7.

---

## [ ] AUTH-10: `POST /auth/login` with account lockout

```text
Status: DONE
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

1. On `auth.routes.ts` (AUTH-08): login rate limiter → validation → controller → service.
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

**Files/areas affected:** `backend/src/routes/auth/auth.routes.ts`, `backend/src/controllers/auth/auth.controller.ts`, `backend/src/services/auth/auth.service.ts`, `backend/src/repositories/auth/auth.repository.ts`.

**API impact:** new `POST /api/v1/auth/login` (Tech Design §9.1, §9.3).

**Schema/config impact:** reads and writes `auth_login_lockouts` and `auth_sessions`; reads configuration (AUTH-04).

**Testing requirements** (Tech Design §16)

- Vitest + Supertest API: PRD AC 15.3-1 to 15.3-6 and 15.3-10.
- Vitest integration (time-controlled): PRD AC 15.3-7 — sign-in succeeds after the lock expires, and `failed_attempts = 0`.
- Vitest integration: PRD AC 15.3-8 — one failure, one success, one failure → not locked, counter = 1.
- Vitest + Supertest API, technical checks:
  - After lock expiry, one wrong password does not re-lock.
  - A soft-deleted account with six wrong passwords always gets `401`, never `429`, and has no lockout row.
  - Two parallel wrong-password requests raise the counter by exactly 2.
  - The 21st login from one IP within 15 minutes → `429 AUTH_RATE_LIMITED`, and five wrong passwords below that limit still lock the account.
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

**References:** Tech Design §8.3, §8.4, §9, §12, §13, §19, Decisions #9, #18; PRD §7.3, §7.7, §15.3, Decisions #9, #15, #16.

---

## [ ] AUTH-11: `GET /auth/me` and `POST /auth/logout`

```text
Status: DONE
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

**Files/areas affected:** `backend/src/routes/auth/auth.routes.ts`, `backend/src/controllers/auth/auth.controller.ts`, `backend/src/services/auth/auth.service.ts`.

**API impact:** new `GET /api/v1/auth/me` and `POST /api/v1/auth/logout` (Tech Design §9.1).

**Schema/config impact:** updates `auth_sessions.revoked_at`.

**Testing requirements**

- Vitest integration (time-controlled): PRD AC 15.4-1 (API part) — within the idle and absolute limits, `GET /auth/me` returns `200`.
- Vitest + Supertest API: PRD AC 15.4-3 (API part) — after sign-out, the old cookie gets `401 AUTH_SESSION_INVALID`.
- Vitest + Supertest API: PRD AC 15.4-4 — two sessions; sign out one; the other still gets `200`.
- Vitest + Supertest API: PRD AC 15.6-3 (API part) — without a session, `GET /auth/me` returns `401`.
- Vitest + Supertest API:
  - Sign-out with an unknown, revoked, or missing session returns `204`.
  - With `must_change_password = true`, `GET /auth/me` returns `200` with `requiresPasswordChange: true`, and sign-out returns `204`.
- The UI parts of 15.4-1, 15.4-3, and 15.6-3 are covered by the Playwright sign-in scenario in AUTH-16.

**Acceptance criteria**

- **Given** the same account signed in on two devices
  **When** device A signs out
  **Then** device A's next `GET /auth/me` returns `401 AUTH_SESSION_INVALID`, and device B's returns `200`.

- **Given** a request with no `sid` cookie
  **When** `POST /api/v1/auth/logout` is called
  **Then** the response is `204`.

**References:** Tech Design §8.5, §8.7, §9.1, Decisions #7, #12; PRD §6.5, §7.6, §15.4.

---

## [ ] AUTH-12: `POST /auth/password/change`

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Let a signed-in user change their password, which also satisfies a forced change (PRD §6.9, §7.5).

**Scope**

- In scope: the route and service.
- Out of scope: revoking other sessions, which is not done for a self-service change (Decision #13).

**Implementation requirements**

1. On `auth.routes.ts` (AUTH-08): password-change rate limiter → `authenticate` (allowed while `must_change_password` is set) → validation → controller → service. The CSRF check applies.
2. Wrong `currentPassword` → `400 AUTH_CURRENT_PASSWORD_INCORRECT`. The password is not changed, and `auth_login_lockouts` is not touched.
3. Otherwise update `password_hash` (NFKC + pepper pipeline from AUTH-05), set `must_change_password = false`, and respond `200 { data: { id, email, role, requiresPasswordChange: false } }`.
4. No session is revoked, including the caller's.

**Files/areas affected:** `backend/src/routes/auth/auth.routes.ts`, `backend/src/controllers/auth/auth.controller.ts`, `backend/src/services/auth/auth.service.ts`.

**API impact:** new `POST /api/v1/auth/password/change` (Tech Design §9.1).

**Schema/config impact:** updates `users.password_hash` and `users.must_change_password`.

**Testing requirements**

- Vitest + Supertest API: PRD AC 15.5-1 — `200`; the old password fails at sign-in; the new one succeeds; other sessions still get `200`.
- Vitest + Supertest API: PRD AC 15.5-2 — `400 AUTH_CURRENT_PASSWORD_INCORRECT`; the hash is unchanged.
- Vitest + Supertest API: Tech Design §20, third criterion — a route blocked with `403 AUTH_PASSWORD_CHANGE_REQUIRED` is allowed after a successful change.

**Acceptance criteria**

- **Given** a signed-in user with `must_change_password = true`
  **When** they submit the correct current password and a valid new password
  **Then** the response is `200` with `requiresPasswordChange: false`, and a previously blocked protected route now succeeds.

- **Given** a signed-in user
  **When** they submit a wrong current password
  **Then** the response is `400 AUTH_CURRENT_PASSWORD_INCORRECT`, and the stored hash is unchanged.

**References:** Tech Design §8.9, §9, Decision #13; PRD §6.9, §7.5, §15.5, Decisions #17, #18.

---

## [ ] AUTH-13: Service functions for Admin User Management

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Provide the two service functions that Admin User Management endpoints must call (Tech Design §7.2), verified at service level.

**Scope**

- In scope: `authService.createCourtOwnerAccount` and `authService.adminSetPassword`.
- Out of scope:
  - Any HTTP endpoint. Endpoints and their validation of `businessName` and `phone` belong to Admin User Management.
  - End-to-end verification through those endpoints (AUTH-23).

**Implementation requirements**

1. `createCourtOwnerAccount({ email, initialPassword, businessName, phone })`:
   - Normalize the email as in registration and apply the password policy (AUTH-05).
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

**Files/areas affected:** `backend/src/services/auth/auth.service.ts`, `backend/src/repositories/auth/auth.repository.ts`.

**API impact:** none (internal functions).

**Schema/config impact:** writes `users`, `court_owner_profiles`, `auth_sessions`, `auth_login_lockouts`.

**Testing requirements** (service level; end-to-end is AUTH-23)

- Vitest + Supertest: PRD AC 15.2-1, 15.2-2.
  1. Create a Court Owner through the service.
  2. `POST /auth/login` returns `requiresPasswordChange: true`, and a protected route returns `403 AUTH_PASSWORD_CHANGE_REQUIRED` (AUTH-07).
  3. After `POST /auth/password/change` (AUTH-12), signing in again returns `requiresPasswordChange: false`.
- Vitest + Supertest: PRD AC 15.3-9 — after `adminSetPassword`, the old password fails and the new one succeeds with `requiresPasswordChange: true`.
- Vitest + Supertest: PRD AC 15.3-11 — on a locked account, `adminSetPassword` lets the new password sign in at once, and `failed_attempts = 0`.
- Vitest + Supertest: PRD AC 15.4-6 — every existing session returns `401 AUTH_SESSION_INVALID` afterward.
- Vitest integration: if any step of `adminSetPassword` fails, none of the four changes remain.

**Acceptance criteria**

- **Given** a locked account with two active sessions
  **When** `adminSetPassword` runs with a valid password
  **Then** both sessions are revoked, `failed_attempts = 0`, `locked_until` is `NULL`, and sign-in with the new password returns `200` with `requiresPasswordChange: true`.

- **Given** an email already used by a soft-deleted account
  **When** `createCourtOwnerAccount` is called with it
  **Then** no row is written, and the duplicate-email error is raised.

**References:** Tech Design §7.2, §8.2, §8.8, §13, Decision #17; PRD §6.2, §6.8, §7.7, Decisions #2, #14, #17, #26; `docs/architecture/database-schema.md` §6.

---

## [ ] AUTH-14: Operator script to provision Admin accounts

```text
Status: DONE
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

**Files/areas affected:** `backend/src/scripts/create-admin.ts`, `backend/src/services/auth/auth.service.ts`, `backend/package.json`.

**API impact:** none.

**Schema/config impact:** writes `users`.

**Testing requirements** (Tech Design §16)

- Vitest integration, running the script as a child process with the password on standard input:
  - `Admin@Example.com` is stored as `admin@example.com`.
  - Signing in through `POST /auth/login` (AUTH-10) works with either letter case.
- Vitest integration: a duplicate email, or a password breaking the policy, writes nothing and exits non-zero.
- Vitest integration: the password is not accepted as an argument and never appears in output.

**Acceptance criteria**

- **Given** no account uses `admin@example.com`
  **When** an operator runs `npm run admin:create --prefix backend -- Admin@Example.com` and types a valid password on standard input
  **Then** a `users` row with role `ADMIN`, status `ACTIVE`, and email `admin@example.com` exists, and signing in with `ADMIN@EXAMPLE.COM` succeeds.

- **Given** the email already exists
  **When** the script runs
  **Then** it exits with a non-zero code, and no row is written.

**References:** Tech Design §7.1, §7.2, §12, §13, §17 step 8, Decision #19; PRD Decision #3.

---

## [ ] AUTH-15: Frontend foundation — proxy, router, HTTP client, auth state, route guard

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Replace the Vite starter with the auth-aware application shell described in Tech Design §7.5.

**Scope**

- In scope:
  - `react-router-dom`, the Vite proxy, and the HTTP client.
  - `AuthProvider` and `useAuth`, plus the `RequireAuth` guard.
  - The route table, placeholder role home pages with a sign-out control, and the access-denied page.
  - The Playwright role-denial scenario.
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
4. `features/auth/auth-api.ts`: `register`, `signIn`, `signOut`, `me`, `changePassword`, `listSkillLevels` (`GET /api/v1/skill-levels`).
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
   - A visitor opening `/` is therefore sent to `/sign-in`. Public tournament and facility pages will come from those features.
8. `app/role-home.ts`: `PLAYER` → `/`, `COURT_OWNER` → `/owner`, `ADMIN` → `/admin`.
9. `main.tsx` renders `AuthProvider` and the router. Remove the starter content that is no longer referenced.

**Files/areas affected**

- `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`
- `frontend/src/app/router.tsx`, `frontend/src/app/role-home.ts`
- `frontend/src/shared/api/http-client.ts`, `frontend/src/shared/auth/require-auth.tsx`
- `frontend/src/features/auth/auth-api.ts`, `auth-provider.tsx`, `use-auth.ts`, `access-denied-page.tsx`
- Removed starter files: `frontend/src/App.tsx`, `App.css`, unused assets (routing now lives in `frontend/src/app/router.tsx`)

**API impact:** consumes `/api/v1/auth/*` and `/api/v1/skill-levels`.

**Schema/config impact:** none.

**Testing requirements**

- Playwright role-denial scenario (needs AUTH-25), for PRD AC 15.6-5:
  1. Sign in as `PLAYER` (through the API) and open `/admin` → the access-denied page is shown, not the sign-in page.
  2. Repeat as `COURT_OWNER`.
- Manual, until AUTH-25 runs: the same scenario, plus a check that a `403 AUTH_CSRF_TOKEN_INVALID` triggers one `GET /auth/me` and one retry.

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

**References:** Tech Design §7.4, §7.5, §16, Decisions #4, #6, #7; PRD §6.4, §6.6, §7.8, §9.

---

## [ ] AUTH-16: Sign-in page

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide the sign-in page with the messages approved in PRD §9, and own the Playwright sign-in scenario.

**Scope**

- In scope:
  - `/sign-in` form, error messages, support contact, redirect after success, link to register.
  - The Playwright sign-in scenario.
- Out of scope: register page (AUTH-18).

**Implementation requirements**

1. Email and password fields. The password field is masked. The form cannot be submitted twice while a request is in progress.
2. Messages chosen by `error.code`:
   - `AUTH_INVALID_CREDENTIALS` → exactly "Email hoặc mật khẩu không đúng".
   - `AUTH_ACCOUNT_RESTRICTED` → the account is restricted; contact support (no reason).
   - `AUTH_ACCOUNT_LOCKED` → temporarily locked, with the approximate unlock time from `details[0].lockedUntil`.
   - `AUTH_RATE_LIMITED` → try again later.
   - `VALIDATION_FAILED` → field errors from `details`.
   - Messages are text, not color only.
   - Exact wording is defined only for invalid credentials; the other messages must convey the PRD §9 content and are reviewed by the PM.
3. Show the support contact from `VITE_SUPPORT_CONTACT` (PRD Decision #23). Add the variable to `frontend/.env.example`. Operations must supply the value before release.
4. On success: go to `/change-password` if `requiresPasswordChange`, otherwise to the role's starting route.

**Files/areas affected:** `frontend/src/features/auth/sign-in-page.tsx`, `frontend/src/app/router.tsx`, `frontend/.env.example`.

**API impact:** consumes `POST /api/v1/auth/login`.

**Schema/config impact:** new frontend variable `VITE_SUPPORT_CONTACT`.

**Testing requirements**

- Playwright sign-in scenario (needs AUTH-25; covers the UI parts of PRD AC 15.4-1, 15.4-3, 15.6-3):
  1. A wrong password, and separately an unknown email, show exactly "Email hoặc mật khẩu không đúng".
  2. Sign in with valid credentials → the role's starting route.
  3. Reload the page → still signed in (15.4-1).
  4. Sign out → on `/sign-in`.
  5. Open a guarded page → redirected to `/sign-in` (15.4-3, 15.6-3).
- Manual: the locked message shows an unlock time; the restricted message shows no reason; the support contact is visible.

**Acceptance criteria**

- **Given** a wrong password, and separately an unknown email
  **When** the user submits the sign-in form
  **Then** both show exactly "Email hoặc mật khẩu không đúng".

- **Given** a signed-in user who reloads the page and then signs out
  **When** they open a guarded page
  **Then** they are redirected to `/sign-in`.

- **Given** an account with `must_change_password = true`
  **When** the user signs in successfully
  **Then** they are taken to `/change-password`.

**References:** Tech Design §7.5, §16; PRD §6.3, §6.4, §6.5, §6.10, §9, Decisions #15, #16, #23.

---

## [ ] AUTH-17: Change-password page (voluntary and forced)

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide the password-change step for both voluntary and forced changes (PRD §7.5, §9), and own the Playwright forced-password-change scenario.

**Scope**

- In scope: `/change-password` form, both modes, the success redirect, and the Playwright forced-password-change scenario.
- Out of scope: confirm-password or other fields not in the API contract.

**Implementation requirements**

1. Fields: `currentPassword` and `newPassword`, both masked. Submit once.
2. Show the password requirements from PRD Decision #8: 8–64 characters, and not the same as the email.
3. Forced mode (`passwordChangeRequired`): the page cannot be dismissed, and no other route is reachable except sign-out (AUTH-15 guard).
4. Messages by code: `AUTH_CURRENT_PASSWORD_INCORRECT`, `AUTH_PASSWORD_POLICY_VIOLATION`, `VALIDATION_FAILED` (field errors), `AUTH_RATE_LIMITED`.
5. On success: state becomes `authenticated`; navigate to the role's starting route.

**Files/areas affected:** `frontend/src/features/auth/change-password-page.tsx`, `frontend/src/app/router.tsx`.

**API impact:** consumes `POST /api/v1/auth/password/change`.

**Schema/config impact:** none.

**Testing requirements**

- Playwright forced-password-change scenario (needs AUTH-25):
  1. Use an account with `must_change_password = true`, created with the AUTH-19 test helpers.
  2. Sign in → lands on `/change-password`.
  3. Opening `/` or `/owner` returns to `/change-password`.
  4. A successful change lands on the role's starting route.
- Manual: the wrong-current-password message, and the voluntary mode reached from a signed-in page.

**Acceptance criteria**

- **Given** a user in `passwordChangeRequired` state
  **When** they try to open `/` or `/owner`
  **Then** they are sent back to `/change-password`.

- **Given** the forced change succeeds
  **When** the response arrives
  **Then** the user lands on their role's starting route.

**References:** Tech Design §7.5, §8.9, §16; PRD §6.2 step 4, §6.8, §6.9, §7.5, §9.

---

## [ ] AUTH-18: Register page

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide the Player registration page (PRD §6.1, §9).

**Scope**

- In scope:
  - `/register` form with email, password, full name, and skill level.
  - Password requirements.
  - Success confirmation, automatic sign-in, and redirect to `/`.
- Out of scope: backend changes (AUTH-09, AUTH-24).

**Implementation requirements**

1. Load the skill levels with `listSkillLevels` (`GET /api/v1/skill-levels`, AUTH-24). Show each level's name and self-assessment description in rank order (Decision #23). Do not hard-code the catalog.
2. Fields: email, password (masked), full name, skill level. Submit once.
3. Show the password requirements from PRD Decision #8.
4. Messages by code:
   - `AUTH_EMAIL_ALREADY_REGISTERED`, `AUTH_PASSWORD_POLICY_VIOLATION`, `AUTH_INVALID_SKILL_LEVEL`, `AUTH_RATE_LIMITED`.
   - `VALIDATION_FAILED` → field errors from `details`.
5. On `201`: confirm registration, set state to `authenticated`, navigate to `/`.
6. If the skill-level list fails to load, show an error and keep the form from being submitted.

**Files/areas affected:** `frontend/src/features/auth/register-page.tsx`, `frontend/src/app/router.tsx`.

**API impact:** consumes `GET /api/v1/skill-levels` and `POST /api/v1/auth/register`.

**Schema/config impact:** none.

**Testing requirements**

- No Playwright scenario: E2E is limited to the three main flows. The register API is covered by AUTH-09 and the catalog API by AUTH-24.
- Manual checklist:
  - The six levels appear in rank order with descriptions. *(Superseded by AUTH-31: the level comes from the survey.)*
  - A valid registration lands on `/` signed in.
  - A duplicate email shows its message.
  - Password requirements are visible.

**Acceptance criteria**

- **Given** a visitor on `/register`
  **When** they open the skill-level field
  **Then** the six levels from `GET /api/v1/skill-levels` are shown in rank order, each with its description. *(Superseded by AUTH-31.)*

- **Given** valid input
  **When** the visitor submits
  **Then** a confirmation is shown, and they arrive at `/` already signed in.

**References:** Tech Design §7.5, §9.1, §9.2, Decision #23; PRD §6.1, §9, Decisions #4, #5; `docs/business-rules-config-matrix.md` §1.2.

---

## [ ] AUTH-19: Backend test harness — Vitest, Supertest, test database

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Make the backend unit, integration, and API tests of every task runnable (Q1).

**Scope**

- In scope:
  - Vitest and Supertest setup.
  - A separate test database on the existing Docker PostgreSQL (port 5433), migrated with `db:migrate`.
  - Data isolation between tests.
  - Test helpers.
  - The `test` script.
  - Aligning `DB_PORT` in the root `.env.example` to `5433`.
- Out of scope: Playwright (AUTH-25); CI pipeline setup (not in any governing document).

**Implementation requirements**

1. Add `vitest`, `supertest`, `@types/supertest` as backend dev dependencies (approved in `tech-stack.md`). Add a `test` script to `backend/package.json`.
2. Test database:
   - A separate database on the Docker PostgreSQL at port 5433 (for example `badminton_test`).
   - A setup step creates it if missing and runs `db:migrate` against it before the tests.
   - Tables are cleaned between tests.
3. Test environment:
   - `NODE_ENV=test`, `DATABASE_URL` and `DIRECT_URL` pointing to the test database.
   - A test-only `PASSWORD_PEPPER`; no production secret is committed.
4. Helpers:
   - Create a user with any role, status, `deleted_at`, or `must_change_password`.
   - Sign in and return cookies.
   - Set timestamps for time-controlled tests.
   - Import the app from `app.ts`.
5. Root `.env.example`: change `DB_PORT=5432` to `DB_PORT=5433`, matching `docker-compose.yml` and `backend/.env.example`.

**Files/areas affected**

- `backend/package.json`
- Root `.env.example`
- `[Proposed — verify during implementation]` Vitest config and test setup files in `backend/`
- `[Proposed — verify during implementation]` test environment file in `backend/`

**API impact:** none.

**Schema/config impact:** test-only environment; `DB_PORT` example value.

**Testing requirements:** a sample Vitest + Supertest test calls `GET /health` and passes.

**Acceptance criteria**

- **Given** a clean checkout with the Docker PostgreSQL running on port 5433
  **When** `npm test --prefix backend` is run
  **Then** the test database is created if missing, migrations are applied to it, and the sample test passes.

- **Given** the root `.env.example`
  **When** it is copied to `.env` and `docker-compose up -d` is run
  **Then** PostgreSQL listens on port 5433, matching `backend/.env.example`.

**References:** Tech Design §16, §17, Decision #14; `docs/architecture/tech-stack.md` (Testing Strategy); `docs/architecture/conventions.md` (Testing Conventions).

---

## [ ] AUTH-20: Response code for unexpected server errors

```text
Status: Merged into AUTH-01
```

Decision Q2 (`INTERNAL_ERROR`, Tech Design Decision #20) is implemented by AUTH-01, implementation requirement 6.

---

## [ ] AUTH-21: Error code when several fields fail validation

```text
Status: Merged into AUTH-05
```

Decision Q3 (global `VALIDATION_FAILED`, Tech Design Decision #21) is implemented by AUTH-05, implementation requirements 5–6.

---

## [ ] AUTH-22: Handling an invalid `AUTH_*` configuration value

```text
Status: Merged into AUTH-04
```

Decision Q4 (matrix default + ERROR log, Tech Design Decision #22) is implemented by AUTH-04, implementation requirement 4.

---

## [ ] AUTH-23: End-to-end verification through Admin User Management endpoints

```text
Status: BLOCKED
Size: S
Blocked by: Admin User Management PRD, Tech Design, and Tasks not yet updated (Auth PRD Follow-ups #1–#3)
```

**Objective:** Verify PRD AC 15.2-1, 15.2-2, 15.3-9, 15.3-11, 15.4-6 through the real Admin endpoints, not only at service level (AUTH-13).

**Why blocked:**

- Admin User Management has no Court Owner creation endpoint.
- Its Ready Tech Design still says an Admin-set password does not force a change, and it does not revoke sessions or clear the lockout.
- Its `POST /api/v1/admin/users/:id/password` must call `authService.adminSetPassword`.

**Implementation requirements** (once Admin User Management is updated and implemented)

1. Vitest + Supertest API tests through the Admin endpoints for the five ACs.
2. Confirm the Admin endpoints use `authenticate`, `requireRole('ADMIN')`, and the CSRF header, not a Bearer token.

**Files/areas affected:** tests only; `[TBD — Admin User Management test locations]`.

**API impact:** none in this feature.

**Schema/config impact:** none.

**Testing requirements:** Vitest + Supertest API — the five ACs above, end to end.

**Acceptance criteria**

- **Given** a locked user with two active sessions
  **When** an Admin calls the set-password endpoint with a valid password
  **Then** both sessions return `401`, and the user signs in at once with the new password and `requiresPasswordChange: true`.

**References:** Tech Design "Dependencies and Blocked Scope", §7.2, §8.2, §8.8; PRD Follow-ups #1–#3.

---

## [ ] AUTH-24: `GET /api/v1/skill-levels`

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Expose the skill-level catalog publicly so the register page does not hard-code it (Decision #23).

**Scope**

- In scope: the `routes/skill-levels/`, `controllers/skill-levels/`, and `repositories/skill-levels/` code, mounted in `app.ts`.
- Out of scope: any write operation on skill levels.

**Implementation requirements**

1. `GET /api/v1/skill-levels`:
   - No `authenticate`, and no CSRF (it is a `GET`).
   - Reads `skill_levels` ordered by `rank` ascending.
   - Responds `200 { data: [{ code, name, rank, description }] }`.
2. Sets no cookies.
3. Unexpected errors go to the centralized error handler (`500 INTERNAL_ERROR`).

**Files/areas affected**

- `backend/src/routes/skill-levels/skill-levels.routes.ts`
- `backend/src/controllers/skill-levels/skill-levels.controller.ts`
- `backend/src/repositories/skill-levels/skill-levels.repository.ts`
- `backend/src/app.ts`

**API impact:** new public `GET /api/v1/skill-levels` (Tech Design §9.1).

**Schema/config impact:** reads `skill_levels`.

**Testing requirements**

- Vitest + Supertest API:
  - Without any cookie, the response is `200` with the six seeded rows in rank order, matching `docs/business-rules-config-matrix.md` §1.2.
  - The response has no `Set-Cookie` header.

**Acceptance criteria**

- **Given** the seeded database and no session
  **When** `GET /api/v1/skill-levels` is called
  **Then** the response is `200` with six items ordered by rank 1–6, each with `code`, `name`, `rank`, and `description`. *(Seven items, ranks 1–7, after AUTH-29.)*

**References:** Tech Design §7.1, §9.1, Decision #23; `docs/business-rules-config-matrix.md` §1.2.

---

## [ ] AUTH-25: Playwright E2E harness

```text
Status: DONE
Size: M
Blocked by: N/A
```

**Objective:** Make the three Playwright scenarios runnable: sign-in (AUTH-16), forced password change (AUTH-17), and role-based denial (AUTH-15).

**Scope**

- In scope:
  - Install and configure `@playwright/test`.
  - Start the backend (`NODE_ENV=test`, test database) and the Vite dev server for the run.
  - A smoke test.
- Out of scope: the three scenarios themselves (owned by AUTH-15, 16, 17); any other E2E scenario; CI pipeline setup.

**Implementation requirements**

1. Add `@playwright/test` (approved in `tech-stack.md`) and a script to run the E2E tests.
2. The configuration:
   - Starts the backend against the test database from AUTH-19, and the frontend dev server with its `/api` proxy.
   - Waits for both to be ready, then runs the tests.
3. Test data: reuse the AUTH-19 helpers or the API to create users before a scenario.
4. Smoke test: opening `/sign-in` shows the sign-in form.

**Files/areas affected**

- `[Proposed — verify during implementation]` Playwright config and `e2e/` folder in `frontend/`
- `frontend/package.json`

**API impact:** none.

**Schema/config impact:** test-only environment.

**Testing requirements:** the smoke test passes.

**Acceptance criteria**

- **Given** a clean checkout with the Docker PostgreSQL running on port 5433
  **When** the E2E test command is run
  **Then** the backend and frontend start against the test database, and the smoke test passes.

**References:** Tech Design §16, §17; `docs/architecture/tech-stack.md` (Testing Strategy).

---

## Decisions Applied (task review, 2026-09-16, approved by Tài — Tech Lead)

| Item | Decision | Recorded in |
| --- | --- | --- |
| Q1 | Vitest + Supertest; separate test database on the existing Docker PostgreSQL (port 5433); Playwright only for sign-in, forced password change, and role-based denial | `tech-stack.md`, `conventions.md`, `documentation-guide.md` §16, `database-schema.md` §9, Tech Design #14 and §16; AUTH-19, AUTH-25 |
| Q2 | Global code `INTERNAL_ERROR` for unexpected errors | `conventions.md` (Global Error Codes), Tech Design #20; AUTH-01 |
| Q3 | Global code `VALIDATION_FAILED` replaces `AUTH_VALIDATION_FAILED`; it is the top-level code only when failing fields have different codes; field codes in `details` | `conventions.md` (Global Error Codes), Tech Design #21; AUTH-05 |
| Q4 | An invalid `AUTH_*` value uses the matrix §8.7 default and logs at ERROR level with the key and the stored value | Tech Design #22; AUTH-04 |
| Q5 | Public `GET /api/v1/skill-levels` | Tech Design #23 and §9.1; AUTH-24, AUTH-18 |
| A4 | Stale test-framework TBD lines updated | `documentation-guide.md` §16 and §17, `database-schema.md` §9 and §12 |
| B1 | Passwords normalized to Unicode NFKC | Tech Design #24; AUTH-05 |
| B2 | HMAC key = base64-decoded bytes of `PASSWORD_PEPPER` | Tech Design #25; AUTH-05 |
| B3 | Auth router skeleton and JSON-only guard moved to AUTH-08 | AUTH-08 to AUTH-12 |
| B4 | Test dependencies added: AUTH-07 and AUTH-12 for AUTH-13; AUTH-10 for AUTH-14 | AUTH-13, AUTH-14 |
| B5 | UI parts of 15.4-1, 15.4-3, 15.6-3 folded into the Playwright sign-in scenario | Tech Design §16; AUTH-16 |
| B6 | Supertest role tests with test-only routes, mounted only by a test helper when `NODE_ENV=test`, never in `app.ts` or `index.ts` | Tech Design §16; AUTH-07 |
| B7 | Playwright setup split into AUTH-25; root `.env.example` `DB_PORT` set to 5433 in AUTH-19 | AUTH-19, AUTH-25 |
| B8 | AUTH-20, 21, 22 merged into AUTH-01, 05, 04 | Stub entries above |

## PRD Acceptance Criteria Traceability

| PRD AC | Task(s) | Test type |
| --- | --- | --- |
| 15.1-1 to 15.1-7 | AUTH-09 (with AUTH-05 unit tests) | Vitest + Supertest |
| 15.2-1, 15.2-2 | AUTH-13 (service level); AUTH-23 (end to end, BLOCKED) | Vitest + Supertest |
| 15.3-1 to 15.3-8, 15.3-10 | AUTH-10 | Vitest + Supertest |
| 15.3-9, 15.3-11 | AUTH-13 (service level); AUTH-23 (end to end, BLOCKED) | Vitest + Supertest |
| 15.4-1 | AUTH-11 (API); AUTH-16 (UI reload) | Vitest + Supertest; Playwright sign-in |
| 15.4-2, 15.4-5 | AUTH-07 | Vitest (time-controlled) |
| 15.4-3 | AUTH-11 (API); AUTH-16 (UI after sign-out) | Vitest + Supertest; Playwright sign-in |
| 15.4-4 | AUTH-11 | Vitest + Supertest |
| 15.4-6 | AUTH-13 (service level); AUTH-23 (end to end, BLOCKED) | Vitest + Supertest |
| 15.5-1, 15.5-2 | AUTH-12 | Vitest + Supertest |
| 15.6-1 | AUTH-13, AUTH-14 (no code path changes `users.role`) | Review |
| 15.6-2, 15.6-6 | AUTH-07 (test-only routes); API checks in future Player feature tasks | Vitest + Supertest |
| 15.6-3 | AUTH-11 (API); AUTH-16 (UI) | Vitest + Supertest; Playwright sign-in |
| 15.6-4 | Future Tournament and Booking feature tasks (public routes) | — |
| 15.6-5 | AUTH-07 (test-only routes); AUTH-15 (UI); API check on the first Admin User Management route | Vitest + Supertest; Playwright role-denial |
| 15.6-7 to 15.6-9 | Future Tournament feature tasks (Organizer rules) | — |
| Forced change (§7.5, 15.2-1 behavior in the UI) | AUTH-17 | Playwright forced password change |

## Follow-ups Outside This Task List

Listed only; not changed here.

1. **Auth PRD "Related Documents"** still says "Task or issue: Not yet created". The PRD is Ready, so adding the link to this file needs approval.
2. **Admin User Management (Ready):**
   - PRD, Tech Design, and Tasks need Auth PRD Follow-ups #1–#3: Court Owner creation; forced password change, session revocation, and lockout reset when an Admin sets a password.
   - Tech Design §9 and §11 still say "Bearer Token" and "session/JWT".
   - `tasks.md` Task 1 still says there is no `must_change_password` field.
   - Unblocks AUTH-23.
3. **Admin Tournament Management Tech Design §5** still says "JWT-based authentication follows the current documented direction".

---

# Social Matchmaking extension — tasks (registration skill survey, updated 2026-11-15)

Governing documents: `docs/business-rules-config-matrix.md` §1.2 (rules), Auth PRD "Registration skill survey — content updated 2026-11-15", Auth Tech Design "Registration skill survey — updated 2026-11-15" and "Skill levels and survey data", `docs/architecture/database-schema.md` §13.8. Rationale: `docs/research/bao-cao-cong-thuc-danh-gia-trinh-do.md`.

AUTH-01…AUTH-25 keep their status. The 2026-10-31 tasks AUTH-26…AUTH-28 (six-question "Method 2B" survey) are **superseded**, were never implemented, and are replaced by AUTH-29…AUTH-33 (AUTH-33 added 2026-11-22). Reading order for all survey documents: the reading map at the start of the PRD subsection "Registration skill survey".

**Gate:** the updated PRD, Tech Design and schema subsections were marked Ready by the human owner on 2026-11-22 (`docs/documentation-guide.md` §6.3); AUTH-29…AUTH-33 are `Approved` and start in the wave order S1–S3. Shared-document and schema changes go through a teammate-reviewed PR.

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| AUTH-26…28 | 2026-10-31 six-question survey (backend, UI, description migration) | Superseded 2026-11-15 | — | — |
| AUTH-29 | Seven-level catalog, survey schema, version 1 definition and scoring engine | Approved | — | M |
| AUTH-30 | Registration API with skill survey | Approved | AUTH-29 | M |
| AUTH-31 | Register page: survey-first wizard and result screen | Approved | AUTH-30 | M |
| AUTH-32 | Seven-level follow-up: seed scripts, profile display, invitation fallback, level pickers | Approved | AUTH-29 | S |
| AUTH-33 | Survey guardrails outside Auth: lock rating adjustment config, Player creation only via registration | Approved | AUTH-29 | S |

## [—] AUTH-26…AUTH-28 — Superseded 2026-11-15

Not implemented. AUTH-26 (backend) → AUTH-29 + AUTH-30; AUTH-27 (UI) → AUTH-31; AUTH-28 (description migration) → AUTH-29 + AUTH-32. Original text: git history of this file.

## [ ] AUTH-29: Seven-level catalog, survey schema, version 1 definition and scoring engine

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Database structures, survey version 1 and a pure, tested scoring engine; existing tests keep passing with seven levels.

**Scope**

- In scope: migration `0029` — next free slot as of 2026-11-22; re-check `docs/plans/migration-slot-log.md`, register the slot and update journal/snapshot (seven-level `skill_levels` with new descriptions; `skill_survey_versions` with one-`ACTIVE` partial index and immutability trigger; `player_skill_surveys`; `player_profiles.is_skill_tentative`; version 1 `definition` inserted as `ACTIVE`; `PLAYER_SKILL_ADJUSTMENT_ENABLED` is not changed — already `'false'` since migration `0023`); Drizzle schema; definition validator; scoring engine; updating existing tests, fixtures and acceptance checks that expect six levels (e.g. AUTH-02, AUTH-24 tests).
- Out of scope: HTTP endpoints (AUTH-30), UI (AUTH-31), seed scripts and non-auth code (AUTH-32), Admin version management.

**Implementation requirements**

1. Version 1 `definition` equals the "Version 1 definition" table in the Tech Design (question ids, option codes, option scores at full precision, `bottleneckRef`, `experienceCap`) plus weights, experience mix, penalty and bands from matrix §1.2; question and option wording from the PRD by position.
2. The engine is a pure function `(definition, answers) → result`; it compares with band boundaries on unrounded values and rounds to 2 decimals only in returned/stored values.
3. `applied_guardrails` lists a guardrail only when its cap is below the nominal band.
4. The definition validator implements every rule in the Tech Design "Definition validation" list.
5. Migration `0005` is not edited.

**Files/areas affected** `[Proposed — verify during implementation]`

- `backend/src/db/migrations/0029_player_skill_surveys.sql` (number per slot log), `backend/src/db/schema/` (survey tables, `index.ts`), `backend/src/services/auth/` (scoring engine, definition validator), `backend/src/__tests__/` (new tests; six-level expectations updated)

**API impact:** None (`GET /skill-levels` returns seven levels as data).

**Schema/config impact:** `database-schema.md` §13.8; `skill_levels` data. No config change (`PLAYER_SKILL_ADJUSTMENT_ENABLED` already `'false'` via migration `0023`).

**Verification**

- Unit: PRD acceptance examples #1–#6 (S, level, guardrails); each band boundary just below and at the boundary; penalty floor at 0; each G1 reference row; both G2 caps; the precision boundary case in the Tech Design ($S = 15.00$ → `WEAK`).
- Unit: the validator accepts version 1 and rejects each listed violation.
- Integration on a migrated database: seven levels with new descriptions; exactly one `ACTIVE` version; updating an `ACTIVE` definition fails; the full existing test suite passes.

**Acceptance criteria**

- **Given** the answers of PRD example #1 **When** scored with version 1 **Then** $S = 56.25$, level `AVERAGE`, no guardrail.
- **Given** PRD examples #2 and #3 **Then** `AVERAGE_MINUS` with `G1_BOTTLENECK` and `AVERAGE_MINUS` with `G2_EXPERIENCE_CAP` respectively.
- **Given** PRD examples #4, #5, #6 **Then** `GOOD` (76.96), `EXCELLENT` (81.96), `AVERAGE_PLUS` (66.96).

## [ ] AUTH-30: Registration API with skill survey

```text
Status: Approved
Size: M
Blocked by: AUTH-29
```

**Objective:** Serve the active survey and register Players with a server-computed level and a one-time result.

**Scope**

- In scope: `GET /api/v1/auth/skill-survey` (BOOLEAN questions include `options`); `POST /api/v1/auth/register` with `skillSurvey: { version, answers }` and `meta.skillSurveyResult` in the `201` response, including server-computed `guardrails` (cap + G1 criterion), `strengths` and `areaToImprove`; `GET /api/v1/players/me/skill-survey` (own result, recomputed from stored answers; `404 PLAYER_SKILL_SURVEY_NOT_FOUND`); answer validation against the definition; `AUTH_SKILL_SURVEY_OUTDATED`, `AUTH_REGISTRATION_FORM_OUTDATED`, `AUTH_SKILL_SURVEY_UNAVAILABLE`; `isSkillTentative` in the Player profile read model.
- Out of scope: UI; retake; Admin endpoints.

**Implementation requirements**

1. The GET response omits scores, weights, bands, `bottleneckRef` and `experienceCap`.
2. Detect `skillLevelCode` before strict-schema validation; then check in the Tech Design order: unavailable → outdated version → answers.
4. Strengths, area to improve and the G1 criterion are produced by the scoring engine (pure function, unit-tested with ties), not by controllers or the frontend.
3. Profile (`skill_level_id`, `is_skill_tentative = true`) and survey row are inserted in the existing `registerPlayer` transaction; `AuthUser` is unchanged.

**Files/areas affected** `[Proposed — verify during implementation]`

- `backend/src/validation/auth.ts`, `backend/src/services/auth/AuthService.ts`, `backend/src/repositories/auth/AuthRepository.ts`, `backend/src/controllers/auth/AuthController.ts`, `backend/src/routes/auth/authRoutes.ts`, `backend/src/routes/players/profileRoutes.ts` (own-result route), Player profile read repository/service, `backend/src/__tests__/auth-endpoints.test.ts`; every other test or helper that registers through the API (e.g. `player-contact.test.ts`, `player-profile.test.ts`, `frontend/e2e/profile-live/identity.spec.ts`)

**API impact:** Register request and response change; new public GET; profile read adds `isSkillTentative`.

**Schema/config impact:** None beyond AUTH-29.

**Verification**

- API: valid registration returns `skillSurveyResult`; missing answer, unknown option code, skill outside 0–3, `returningAfterBreak = true` with less than 6 months → `400 VALIDATION_FAILED` with the question id as field; wrong version → `AUTH_SKILL_SURVEY_OUTDATED`; old form → `AUTH_REGISTRATION_FORM_OUTDATED`; no active version → `503 AUTH_SKILL_SURVEY_UNAVAILABLE`; failure after the user insert rolls back all rows.

**Acceptance criteria**

- **Given** valid answers equal to PRD example #4 **When** registering **Then** the response is `201` with `meta.skillSurveyResult.skillLevel.code = "GOOD"` and `finalScore = 76.96`, the profile has `is_skill_tentative = true`, and one survey row with version 1 exists.
- **Given** PRD example #2 was registered **When** the Player calls `GET /api/v1/players/me/skill-survey` **Then** the result equals the registration result, with a `G1_BOTTLENECK` guardrail whose `criterion` is `R` and `areaToImprove.criterion = "R"`.

## [ ] AUTH-31: Register page: survey-first wizard and result screen

```text
Status: Approved
Size: M
Blocked by: AUTH-30
```

**Objective:** Replace the direct level choice on `/register` with the survey-first wizard and the result screen described in the PRD.

**Scope**

- In scope: steps ① Tiểu sử & thói quen → ② Kỹ thuật → ③ Thực chiến & thể lực → ④ Thành tích thi đấu → ⑤ Tạo tài khoản → result screen; required answers per step; item 4 hidden and cleared per PRD; answers (never the password) kept across a reload in the same tab; no score shown while answering; result screen with badge, 7-level ladder, strengths, area to improve, six-criterion radar chart, guardrail explanation and tentative note; messages for the three survey error codes.
- Out of scope: profile changes (AUTH-32).

**Implementation requirements**

1. Steps, questions and options come only from the survey API; the frontend has no copy of the survey.
2. Follow `docs/architecture/frontend.md` as approved at implementation time, including any UI libraries approved there; accessible radio groups, focus moved to the step heading on step change, reduced motion respected.
3. Use the approved prototype `docs/design/smashpro-auth-v3` (approved 2026-11-22; supersedes the v2 survey and result screens) as the UX reference: step transitions, skill illustrations with auto-advance, missing-answer highlighting, review in step ⑤, result animations and radar. See its README "Khi chuyển sang React".
4. `register()` in `auth-provider.tsx` must return the survey result instead of only `AuthUser`; replace the current redirect to `/` after success with the result screen; clear the saved answers after success.
5. The result screen renders server data only (strengths, area to improve, `components` for the radar, guardrail explanation); a reload loads it from `GET /api/v1/players/me/skill-survey`. Shows the "no strengths" line when `strengths` is empty.
6. This is also the UI migration of `/register`: remove `AuthLayout`, `AuthAlert` and the `.auth-*` legacy CSS once Register no longer uses them, and add the new files to `ui-check.config.json`.

**Files/areas affected** `[Proposed — verify during implementation]`

- `frontend/src/features/auth/register-page.tsx` and new wizard components under `frontend/src/features/auth/`, `frontend/src/features/auth/auth-api.ts`, `frontend/src/index.css`, `frontend/e2e/`

**API impact:** Consumes AUTH-30.

**Schema/config impact:** None.

**Verification**

- E2E: register through all steps and see the result screen; an unanswered item blocks the step; changing item 1 to "Dưới 6 tháng" hides and clears item 4; reload keeps answers; an outdated-version response shows the reload message.

**Acceptance criteria**

- **Given** an unanswered item in the current step **When** pressing Next **Then** the item is highlighted and the step does not change.
- **Given** a successful registration with PRD example #2 answers **When** the result screen opens **Then** it shows `AVERAGE_MINUS` and the G1 explanation naming "Độ ổn định giữ cầu" as the weakest criterion.

## [ ] AUTH-32: Seven-level follow-up: seed scripts, profile display, invitation fallback, level pickers

```text
Status: Approved
Size: S
Blocked by: AUTH-29
```

**Objective:** Remove six-level assumptions outside the registration flow and keep sample data consistent.

**Scope**

- In scope: every seed script that creates Players — `db/seed.ts` (also its `GOOD` "Khá / Giỏi" label and `|| 6` fallback), `db/seed-ratings.ts`, `db/seed-social.ts`, `db/seed-reports.ts`, `db/seed-admin-notifications.ts`, `db/seed-match-booking.ts` (sample Players get survey answers scored by the engine); `UserRepository` fallback text; `frontend/src/features/player/profile/ProfileSections.tsx` ("/ 6", six-step indicator → seven; "tạm thời" label from `isSkillTentative`); `maxRank ?? 6` fallback in `backend/src/services/matchmaking/MatchInvitationService.ts`; skill-level pickers and range filters (e.g. Matchmaking level range) show seven levels; release note: reset development databases and run all seed scripts.
- Out of scope: tournament promotion.

**Files/areas affected** `[Proposed — verify during implementation]`

- `backend/src/db/seed*.ts`, `backend/src/repositories/user/UserRepository.ts`, `backend/src/services/matchmaking/MatchInvitationService.ts`, `frontend/src/features/player/profile/ProfileSections.tsx`, frontend level pickers

**API impact:** None beyond AUTH-29/30.

**Schema/config impact:** Data only.

**Verification**

- Fresh seed: every sample Player has a survey row whose resulting level equals the profile level. Profile shows "x / 7". Matchmaking level filters list seven levels.

**Acceptance criteria**

- **Given** a freshly seeded database **When** opening a Player profile at rank 7 **Then** it shows "7 / 7", seven filled steps and the "tạm thời" label.

## [ ] AUTH-33: Survey guardrails outside Auth: lock rating adjustment config, Player creation only via registration

```text
Status: Approved
Size: S
Blocked by: AUTH-29
```

**Objective:** Close two paths that would break the survey model (owner decisions 2026-11-22).

**Scope**

- In scope:
  - `PLAYER_SKILL_ADJUSTMENT_ENABLED` becomes read-only: mark it deprecated/non-editable in `backend/src/shared/config/config-registry.ts` (reject Admin updates via the config API) and hide its toggle in `frontend/src/features/admin/configs/config-ui-meta.ts`; update the stale "until RT-10" comment. Reason: the rating mapping (`targetRankFromAverage`) stops at rank 6 and would demote `EXCELLENT` Players. Rating records stay for reference/display.
  - Admin user creation no longer offers `PLAYER`: `backend/src/validation/admin.ts` role enum, `UserRepository` create path (`skillLevelId`), and `frontend/src/features/admin/components/CreateUserModal.tsx` (remove the role option and the hard-coded four-level picker).
- Out of scope: removing the rating-based adjustment code; Admin creation of Court Owner/Admin accounts.

**Verification**

- API: updating `PLAYER_SKILL_ADJUSTMENT_ENABLED` through the Admin config API is rejected; creating a user with role `PLAYER` through the Admin API returns `400 VALIDATION_FAILED`.
- UI: the config page shows no toggle for this key; the create-user dialog has no Player option.

**Acceptance criteria**

- **Given** an Admin **When** they try to enable rating-based skill adjustment **Then** the change is refused and the value stays `false`.
- **Given** an Admin **When** they open the create-user dialog **Then** only non-Player roles can be chosen.
