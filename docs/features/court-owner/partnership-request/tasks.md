# Court Owner Partnership Request — Task List

Implementation tasks for the Court Owner partnership request feature.

- Linked PRD: [prd.md](prd.md)
- Linked Tech Design: [tech-design.md](tech-design.md)
- Decisions: PRD §14 (2026-11-27)

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.

The PRD and Tech Design were approved by the owner on 2026-11-27; all tasks are Approved.

**Definition of Done:** the task's acceptance criteria pass and the required verification steps
listed under "Verification" are complete.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| OPR-01 | Schema, migration 0045, config key and env | Approved | — | S |
| OPR-02 | Public submit API | Approved | OPR-01 | M |
| OPR-03 | Admin review API and account creation | Approved | OPR-01 | M |
| OPR-04 | Emails and Admin notification | Approved | OPR-02, OPR-03 | S |
| OPR-05 | Public page `/hop-tac` and entry links | Approved | OPR-02 | M |
| OPR-06 | Admin "Yêu cầu hợp tác" page | Approved | OPR-03 | M |
| OPR-07 | Demo seed, E2E and documentation updates | Approved | OPR-04, OPR-05, OPR-06 | S |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | OPR-01 | — |
| 2 | OPR-02, OPR-03 | OPR-01 |
| 3 | OPR-04, OPR-05, OPR-06 | Wave 2 |
| 4 | OPR-07 | Wave 3 |

---

## [ ] OPR-01: Schema, migration 0045, config key and env

```text
Status: Approved
Size: S
Blocked by: N/A
```

**Objective:** Store partnership requests and add the switch and environment values the feature needs.

**Implementation requirements**

1. Migration `0045_owner_partnership_requests.sql` and Drizzle schema `db/schema/partnership.ts`
   exactly as Tech Design §6.
2. `OWNER_PARTNERSHIP_ENABLED` in `shared/config/config-registry.ts` (domain `auth`, boolean, true).
3. Env `APP_PUBLIC_URL`, `RATE_LIMIT_OWNER_REQUEST_WINDOW_MINUTES`, `RATE_LIMIT_OWNER_REQUEST_MAX`
   with defaults in `shared/config/env.ts` and `backend/.env.example`.
4. Add the table to `docs/architecture/database-schema.md` and the key to
   `docs/business-rules-config-matrix.md` §8 (shared documents: reviewed in the PR).

**Verification**

- `npm run verify:migrations`; migration applies on a fresh DB and on the demo DB.
- Config appears on the Admin configuration page.

**Acceptance criteria**

- **Given** a migrated DB **When** two open requests with the same email are inserted **Then** the second fails on `owner_request_open_email_uq`.
- **Given** a REJECTED row without a reason **When** it is written **Then** the check constraint refuses it.

---

## [ ] OPR-02: Public submit API

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Accept requests from visitors safely (Tech Design §5.1, §7 Submit).

**Implementation requirements**

1. `validation/partnership.ts` (fields, phone normalization, consent, honeypot).
2. `ownerRequestRateLimiter` with its own store, reset in `resetRateLimitStores`.
3. `POST /api/v1/owner-requests` and `GET /api/v1/owner-requests/availability`.
4. Service: config check, existing-account check, `INSERT … ON CONFLICT DO NOTHING`, Admin
   notification in the same transaction (notification wiring finished in OPR-04).

**Verification**

- API tests: create, duplicate, existing account 409, honeypot, disabled 503, rate limit 429, validation 400.

**Acceptance criteria**

- **Given** an email with an account **When** it is submitted **Then** 409 `OWNER_REQUEST_EMAIL_HAS_ACCOUNT` and no row.
- **Given** a valid request **When** submitted **Then** 202 and one PENDING row with the normalized phone.

---

## [ ] OPR-03: Admin review API and account creation

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Let Admins list, annotate, contact, approve and reject requests (Tech Design §5.2, §7).

**Implementation requirements**

1. `adminPartnershipRoutes.ts` with the endpoints of Tech Design §5.2, Admin only.
2. Optional `tx` on `AdminUserService.createUser` and `UserRepository.createUser`; existing callers unchanged.
3. Approve: row lock, generated password, create Court Owner, link, APPROVED, in one transaction.
4. Contact / reject / note with conditional updates and `OWNER_REQUEST_INVALID_STATE`.
5. List with status filter, search, pagination and per-status counts; pending count endpoint.

**Verification**

- API tests for every transition, 409 on final states, 409 `USER_EMAIL_EXISTS` keeps the request
  open, 403 for non-Admin.
- Approved owner: forgot-password + reset → sign-in without forced change.

**Acceptance criteria**

- **Given** a PENDING request **When** approved **Then** a Court Owner with that email exists, `must_change_password = true`, and the request is APPROVED with `created_user_id`.
- **Given** two simultaneous approvals **When** both run **Then** exactly one account is created.

---

## [ ] OPR-04: Emails and Admin notification

```text
Status: Approved
Size: S
Blocked by: N/A
```

**Objective:** Tell Admins about new requests and the requester about the outcome (Tech Design §8, §9).

**Implementation requirements**

1. Templates `OWNER_REQUEST_RECEIVED`, `OWNER_ACCOUNT_CREATED` and `OWNER_REQUEST_REJECTED` in `services/email/templates.ts`.
2. Enqueue on submit/approve/reject inside their transactions with the idempotency keys of §7.
3. Notification type `ADMIN_OWNER_REQUEST_CREATED` and resolver `ADMIN_OWNER_REQUEST`.

**Verification**

- Unit: rendered emails contain no password, escape user values, link to `/forgot-password?email=`.
- API: one notification per active Admin; resolver returns the Admin URL only for Admins.

**Acceptance criteria**

- **Given** an approval **When** the outbox is processed **Then** the owner receives one account-created email.

---

## [ ] OPR-05: Public page `/hop-tac` and entry links

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Give visitors the form and the ways to reach it (PRD §6.1, §9).

**Implementation requirements**

1. `features/partnership/` page with form, success, off, rate-limited and error states; note for signed-in users.
2. Public route `/hop-tac` in `app/router.tsx`.
3. Landing `OwnersSection` button and footer link → `/hop-tac`; sign-in page link; forgot-password
   page pre-fills `?email=`.
4. Update `docs/architecture/frontend.md` routes.

**Verification**

- `npm run lint`, `npm run build`; component tests for validation and states; check at 360 px.

**Acceptance criteria**

- **Given** a visitor **When** they choose "Gửi yêu cầu hợp tác" on the landing page **Then** `/hop-tac` opens without sign-in.

---

## [ ] OPR-06: Admin "Yêu cầu hợp tác" page

```text
Status: Approved
Size: M
Blocked by: N/A
```

**Objective:** Admin queue and actions (PRD §6.2, §9).

**Implementation requirements**

1. Route `/admin/partnership-requests` (`?id=` opens the detail), sidebar item with pending badge.
2. Table, status tabs with counts, search, detail panel, note editor.
3. Approve dialog pre-filled (email read-only), reject dialog with reason, contact action, toasts,
   409 handling (reload and show the current status).

**Verification**

- Lint, build, component tests for dialogs; manual run against the demo seed.

**Acceptance criteria**

- **Given** a pending request **When** the Admin approves it from the dialog **Then** the row moves to "Đã tạo tài khoản" and links to the new user.

---

## [ ] OPR-07: Demo seed, E2E and documentation updates

```text
Status: Approved
Size: S
Blocked by: N/A
```

**Objective:** Make the feature demoable and close the documentation follow-ups (PRD §15).

**Implementation requirements**

1. Seed step with requests in every status (one APPROVED linked to an existing seeded owner), via
   the real service; `email_outbox` still empty after the seed; `docs/testing/demo-accounts.md`.
2. Playwright (mocked API): landing → `/hop-tac` → success; Admin approve flow.
3. Auth PRD "Public landing page" item 6 and §6.2, User Management PRD link.
4. Mark this feature's documents Implemented after verification.

**Verification**

- `demo-seed.test.ts` passes; E2E passes; targeted backend tests pass.

**Acceptance criteria**

- **Given** a fresh `db:reset` **When** the Admin opens "Yêu cầu hợp tác" **Then** requests in all four statuses are listed.
