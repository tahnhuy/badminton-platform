# Court Owner Partnership Request — Tech Design

```text
Status: Ready (approved by the owner in the working session, 2026-11-27)
Owner: taidangdev
PRD: docs/features/court-owner/partnership-request/prd.md
Scope: owner_partnership_requests table, public submit API, Admin review API, two emails, Admin notification, landing/sign-in links, /hop-tac and Admin pages
Decision Status: Approved
```

## 1. Context

The [PRD](prd.md) adds a public request form and an Admin queue in front of the existing Admin
account creation (`AdminUserService.createUser`, `POST /api/v1/admin/users`). The owner gets the
password through the existing forgotten-password OTP flow (`POST /api/v1/auth/password/forgot`
and `/password/reset`). `AuthRepository.resetUserPassword` already sets
`must_change_password = false` and `email_verified_at`, so no change to the auth flow is needed.

## 2. Upstream References

- PRD: [prd.md](prd.md)
- Auth: [Auth PRD](../../platform/authentication-authorization/prd.md) §6.2, §6.10, "Public landing page"
- Conventions: `docs/architecture/conventions.md` (REST under `/api/v1`, `{ data }` / `{ error: { code, message, details } }`)
- Schema: `docs/architecture/database-schema.md` (new section added by this feature)
- Config: `docs/business-rules-config-matrix.md` §8; registry `backend/src/shared/config/config-registry.ts`

## 3. Technical Approach

- New module `partnership` in the existing layering: route → controller → service → repository.
  - `routes/partnership/partnershipRoutes.ts` (public) mounted at `/api/v1/owner-requests`.
  - `routes/admin/adminPartnershipRoutes.ts` mounted at `/api/v1/admin/owner-requests`
    (`authenticate`, `requireRole('ADMIN')`).
  - `services/partnership/PartnershipRequestService.ts`, `repositories/partnership/PartnershipRequestRepository.ts`,
    `validation/partnership.ts` (zod).
- Account creation: `AdminUserService.createCourtOwnerInTx(tx, { email, businessName, phone })`
  runs inside the approval transaction and reuses `UserRepository.insertUser(tx, …)` (split out of
  `createUser`, whose behavior is unchanged):
  - it generates a random 32-byte password (`crypto.randomBytes(32).toString('base64url')`) that is
    hashed and discarded;
  - `mustChangePassword` stays `true` (unchanged rule for Court Owners) and is cleared by the reset
    flow;
  - an existing email (any status) raises `USER_EMAIL_EXISTS`, rolling back the approval.
- Emails go through `emailOutboxService.enqueue(tx, …)` with three new templates.
- Admin notification through `notifyAdmins(tx, …)` with a new resource type `ADMIN_OWNER_REQUEST`.
- New env `APP_PUBLIC_URL` (default `http://localhost:5173`) builds the link in the account-created
  email: `${APP_PUBLIC_URL}/forgot-password?email=<encoded>`. The forgot-password page reads the
  `email` query parameter to pre-fill the field (small frontend change).

## 4. State Machine

```text
PENDING ──contact──▶ CONTACTED
PENDING | CONTACTED ──approve (create account)──▶ APPROVED   (final)
PENDING | CONTACTED ──reject (reason)──────────▶ REJECTED   (final)
```

Every transition is a conditional update `WHERE id = $1 AND status IN (…)`. If no row is updated,
the service reloads the request and returns `OWNER_REQUEST_INVALID_STATE` (409). This makes two
Admins acting at once safe: one wins and the other gets 409.

## 5. API Design

### 5.1 Public

`POST /api/v1/owner-requests` (no auth, CSRF as for `/auth/register`, rate limiter
`ownerRequestRateLimiter`, own `MemoryStore`, window/max from env
`RATE_LIMIT_OWNER_REQUEST_WINDOW_MINUTES` = 60 and `RATE_LIMIT_OWNER_REQUEST_MAX` = 5).

Request:

```json
{
  "contactName": "Nguyễn Văn A",
  "email": "owner@example.com",
  "phone": "0901234567",
  "facilityName": "Sân cầu lông Phú Nhuận",
  "addressLine": "12 Phan Xích Long",
  "district": "Phú Nhuận",
  "city": "TP. Hồ Chí Minh",
  "expectedCourts": 6,
  "note": "Có 6 sân thảm, mở cửa 5h–23h",
  "consent": true,
  "website": ""
}
```

- `website` is the hidden bot field. If it is not empty, the API returns the normal 202 and stores
  nothing.
- Email is trimmed and lowercased. Phone is normalized to `0XXXXXXXXX` (accepts `+84` / `84`),
  regex `^0(3|5|7|8|9)\d{8}$`.
- `consent` must be `true`.

Responses:

| Case | Status | Body |
| --- | --- | --- |
| Accepted, duplicate open request, bot field filled | 202 | `{ "data": { "received": true } }` |
| Email already belongs to an account | 409 | `OWNER_REQUEST_EMAIL_HAS_ACCOUNT`, details `[{ field: 'email' }]` |
| Validation | 400 | `VALIDATION_FAILED` with field details |
| `OWNER_PARTNERSHIP_ENABLED = false` | 503 | `OWNER_REQUEST_DISABLED` |
| Rate limited | 429 | `AUTH_RATE_LIMITED` (shared handler) |

`GET /api/v1/owner-requests/availability` (public) → `{ data: { enabled: boolean } }`, so the page
can show the switched-off state before the visitor fills the form.

### 5.2 Admin (`ADMIN` only)

| Method and path | Purpose |
| --- | --- |
| `GET /admin/owner-requests?status=&q=&page=&limit=` | List, newest first; `meta.counts` per status for the tabs |
| `GET /admin/owner-requests/:id` | Detail, including processor email and linked account |
| `PATCH /admin/owner-requests/:id/note` `{ adminNote }` | Save note (≤ 2000); open requests only |
| `POST /admin/owner-requests/:id/contact` | PENDING → CONTACTED |
| `POST /admin/owner-requests/:id/approve` `{ businessName, phone }` | Create Court Owner and APPROVED |
| `POST /admin/owner-requests/:id/reject` `{ reason }` | REJECTED, reason 10–500 |
| `GET /admin/owner-requests/pending-count` | Menu badge |

Errors: `OWNER_REQUEST_NOT_FOUND` (404), `OWNER_REQUEST_INVALID_STATE` (409),
`USER_EMAIL_EXISTS` (409, from `createUser`; the request stays open), `VALIDATION_FAILED` (400).

## 6. Schema Delta

Migration `backend/src/db/migrations/0043_owner_partnership_requests.sql`, generated from the Drizzle
schema `backend/src/db/schema/partnership.ts`:

```sql
CREATE TABLE owner_partnership_requests (
  id               bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  contact_name     varchar(100) NOT NULL,
  email            varchar(254) NOT NULL,          -- lowercased
  phone            varchar(15)  NOT NULL,          -- normalized 0XXXXXXXXX
  facility_name    varchar(150) NOT NULL,
  address_line     varchar(255) NOT NULL,
  district         varchar(100) NOT NULL,
  city             varchar(100) NOT NULL,
  expected_courts  smallint     NOT NULL,          -- CHECK 1..50
  note             varchar(1000),
  status           varchar NOT NULL DEFAULT 'PENDING',  -- CHECK PENDING|CONTACTED|APPROVED|REJECTED
  admin_note       varchar(2000),
  reject_reason    varchar(500),                   -- CHECK: non-blank when REJECTED
  processed_by     bigint REFERENCES users(id),    -- CHECK: set (with processed_at) when APPROVED/REJECTED
  processed_at     timestamp,
  created_user_id  bigint REFERENCES users(id),    -- CHECK: set when APPROVED
  submitted_ip     varchar(45),
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

-- At most one open request per email (PRD §8); also serializes concurrent submits.
CREATE UNIQUE INDEX uq_owner_request_open_email
  ON owner_partnership_requests (email) WHERE status IN ('PENDING', 'CONTACTED');
CREATE INDEX owner_requests_status_created_idx ON owner_partnership_requests (status, created_at);
```

Status is a `varchar` with a CHECK and timestamps are `timestamp` (without time zone), following the
existing tables (`facility_handovers`, `users`) rather than a new enum type.

`users.id` is `bigint` (identity), so both references are `bigint`. The consolidated schema gets a new
section in `database-schema.md`.

Config: add `OWNER_PARTNERSHIP_ENABLED` (`domain: 'auth'`, boolean, default `true`) to the
registry, which makes it editable on the Admin configuration page.

## 7. Flows

### Submit

1. Validate; honeypot check; config check.
2. If a user with this email exists (any status, including soft-deleted, since the email stays
   unique) → 409 `OWNER_REQUEST_EMAIL_HAS_ACCOUNT`.
3. In one transaction: `INSERT … ON CONFLICT DO NOTHING` (partial unique index). If a row is
   inserted, `notifyAdmins(tx, { type: 'ADMIN_OWNER_REQUEST_CREATED', title: 'Yêu cầu hợp tác mới',
   content: '<facility> – <contact> (<city>)', resource: { type: 'ADMIN_OWNER_REQUEST', id },
   dedupKey: 'owner-request:created:<id>' })` and enqueue `OWNER_REQUEST_RECEIVED`
   (`idempotencyKey: owner-request:received:<id>`).
4. Return 202 (also when nothing was inserted).

### Approve

One transaction:

1. `SELECT … FOR UPDATE` the request; it must be PENDING or CONTACTED.
2. `createUser({ email: request.email, password: <generated>, role: 'COURT_OWNER', businessName, phone }, adminId, tx)`.
3. Update the request to APPROVED with `processed_by`, `processed_at`, `created_user_id`.
4. Enqueue `OWNER_ACCOUNT_CREATED` (`idempotencyKey: owner-request:approved:<id>`).

### Reject

One transaction: conditional update to REJECTED with the reason, then enqueue
`OWNER_REQUEST_REJECTED` (`idempotencyKey: owner-request:rejected:<id>`).

## 8. Emails

Add three templates to `EMAIL_TEMPLATES` and `renderEmail`, with `EmailTemplateData` gaining `contactName`,
`facilityName`, `actionUrl` and `reason` (all escaped):

- `OWNER_REQUEST_RECEIVED`: subject "SmashPro - Đã nhận yêu cầu hợp tác"; the facility name and
  the next steps (SmashPro gọi điện xác minh trong 1–2 ngày làm việc).
- `OWNER_ACCOUNT_CREATED`: subject "SmashPro - Tài khoản chủ sân đã sẵn sàng"; greets the contact,
  names the facility, shows the sign-in email, button "Đặt mật khẩu" → `actionUrl`, explains the
  OTP step. No password.
- `OWNER_REQUEST_REJECTED`: subject "SmashPro - Kết quả yêu cầu hợp tác"; the reason and an
  invitation to send a new request when the situation changes.

## 9. Notifications

- Type `ADMIN_OWNER_REQUEST_CREATED`, resource `ADMIN_OWNER_REQUEST`.
- `NotificationResourceResolver`: `ADMIN_OWNER_REQUEST: viewer.role === 'ADMIN' ? '/admin/partnership-requests?id=<id>' : null`.

## 10. Frontend

- `features/partnership/`: `partnership-api.ts`, `partnership-request-page.tsx` (route `/hop-tac`,
  public, outside `HomeGate`, layout of the auth pages), zod schema shared with the form.
- `features/admin/partnership/`: list page `/admin/partnership-requests`, detail panel, approve
  dialog (pre-filled, email read-only), reject dialog (reason), note editor, sidebar item "Yêu cầu
  hợp tác" with the pending badge (TanStack Query, refetch on focus).
- Landing: `OwnersSection` button → `/hop-tac`; footer link → `/hop-tac`.
- Sign-in page: link to `/hop-tac`.
- Forgot-password page: pre-fill from `?email=`.
- `docs/architecture/frontend.md` route map updated.

## 11. Security

- Public endpoint: rate limit, honeypot, field length limits, consent. It discloses only that an
  email has an account (as `/auth/register` already does), never whether it has an open request.
- The generated password is never logged, returned or emailed.
- `submitted_ip` is kept for abuse review only, shown to Admins in the detail.
- All rendered email values pass through `escapeHtml`.
- Admin endpoints use the existing `authenticate` + `requireRole('ADMIN')`.

## 12. Failure Handling / Edge Cases

| Case | Behavior |
| --- | --- |
| Two submits with the same email at once | Partial unique index; the second does nothing and still gets 202 |
| Email gets an account between submit and approve | `createUser` → `USER_EMAIL_EXISTS` 409; transaction rolled back; request stays open |
| Two Admins approve/reject at once | Row lock / conditional update; the loser gets `OWNER_REQUEST_INVALID_STATE` |
| Email provider down | Outbox retries; account and status are already committed |
| Form switched off while the page is open | Submit returns 503; page switches to the off state |
| Approved owner never receives the email | Admin tells them by phone to use "Quên mật khẩu"; nothing else needed |

## 13. Testing

- Unit: phone normalization, validation limits, email rendering (no password, escaped values).
- API (`backend/src/__tests__/partnership-requests.test.ts`):
  - submit creates PENDING and one Admin notification per active Admin;
  - duplicate open email and bot field return 202 and create nothing (no second receipt email);
  - existing account → 409 `OWNER_REQUEST_EMAIL_HAS_ACCOUNT`;
  - a new request enqueues `OWNER_REQUEST_RECEIVED`;
  - disabled config → 503; rate limit → 429;
  - contact / approve / reject transitions and invalid-state 409;
  - approve creates an ACTIVE Court Owner with `must_change_password = true`, links
    `created_user_id`, enqueues `OWNER_ACCOUNT_CREATED`; then forgot-password + reset signs in
    without a forced change;
  - approve when the email already exists → 409 and the request is still open;
  - reject requires a reason and enqueues `OWNER_REQUEST_REJECTED`;
  - non-Admin → 403.
- E2E (mocked API, Playwright): landing button → `/hop-tac` → success; Admin list → approve dialog.
- Demo seed: a few requests in each status (new step after accounts).

## 14. Migration / Rollout

- Migration 0043 is additive; no backfill.
- `APP_PUBLIC_URL` and the two rate-limit env vars get defaults and are added to `.env.example`.
- Rollback: switch `OWNER_PARTNERSHIP_ENABLED` off; the table can stay.

## 15. Alternatives Considered

- Admin types an initial password and phones it (current §6.2): rejected; the Admin knows the
  password and email ownership is not proven.
- A dedicated "set password" invitation token: rejected for v1; the forgot-password OTP already
  provides the same guarantees without a new token type.

## 16. Acceptance Criteria

- **Given** a visitor on the landing page **When** they choose "Gửi yêu cầu hợp tác" **Then** they
  reach `/hop-tac` without signing in.
- **Given** a valid form **When** it is sent **Then** the success screen shows, a PENDING request
  exists and every active Admin has a "Yêu cầu hợp tác mới" notification.
- **Given** an email with an open request **When** the form is sent **Then** the same success
  screen shows and nothing new is stored or emailed.
- **Given** an email that already has an account **When** the form is sent **Then** the email field
  shows the "đã có tài khoản" message with the `+alias` hint and nothing is stored.
- **Given** an open request **When** an Admin approves it **Then** a Court Owner account exists with
  that email, the request is APPROVED and linked, and an account-created email without a password
  is queued.
- **Given** that email **When** the owner completes "Quên mật khẩu" **Then** they are signed in to
  the Court Owner area with no forced password change.
- **Given** an open request **When** an Admin rejects it without a reason **Then** it is refused;
  with a reason, it becomes REJECTED and the rejection email is queued.
- **Given** an APPROVED or REJECTED request **When** any transition or note change is attempted
  **Then** the API answers 409 `OWNER_REQUEST_INVALID_STATE`.
- **Given** `OWNER_PARTNERSHIP_ENABLED = false` **When** `/hop-tac` is opened **Then** the off state
  shows and a direct submit gets 503.

## 17. Open Questions

None.
