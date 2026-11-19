# Admin Finance Management — Task List

Implementation tasks for the Admin Finance Management feature.

- Feature: Admin Finance Management
- Domain: `features/admin/finance`
- Governing PRD: [prd.md](prd.md) (Draft, decision status PROPOSED)
- Governing Tech Design: [tech-design.md](tech-design.md) (Draft)
- Delivery plan: `docs/plans/14_quan-ly-tai-chinh-admin.md`
- Business rules: `docs/business-rules-config-matrix.md` §2.8; PRD §8
- Schema authority: `docs/architecture/database-schema.md` §3.10, §3.34–§3.40
- Existing code: `backend/src/routes/admin/adminWalletRoutes.ts`,
  `backend/src/controllers/admin/AdminWalletController.ts`,
  `backend/src/services/payments/*`, `backend/src/repositories/wallet/*`,
  `backend/src/repositories/payment/*`

**Task status values**

- `Planned`: scoped and ready to schedule; no implementation started.
- `IN_PROGRESS`: implementation started.
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria and verification pass.

**Definition of Done:** the acceptance criteria pass, tests exist and pass, docs and
migration slot are updated, and any UI work is explicitly marked `UI-REDO`.

> **Frontend note.** Only a base UI is in scope. It must be enough to exercise every
> P0 flow manually and in Playwright. Do not spend effort on final visuals, responsive
> polish, or Figma fidelity; those are deferred to the UI-REDO pass.

> **Decision gate.** FIN-D1 (Owner earnings) and FIN-D2 (fee = 0) must be confirmed
> before FIN-08 is implemented. Other tasks may proceed in parallel.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| FIN-01 | Migration `0025`, finance schema, ledger entry types, indexes | DONE | Decision gate | L |
| FIN-02 | Finance audit service, repository, and API | DONE | FIN-01 | M |
| FIN-03 | Unified transaction ledger repository/service/API | DONE | FIN-01 | L |
| FIN-04 | Finance overview service/API | DONE | FIN-03 | M |
| FIN-05 | Admin wallet detail + credit/debit | DONE | FIN-01, FIN-02 | M |
| FIN-06 | Top-up monitoring + manual match | DONE | FIN-03, FIN-02 | M |
| FIN-07 | Payout management (paginated list/detail/actions) | DONE | FIN-03, FIN-02 | M |
| FIN-08 | Refund queue retry + resolution note | DONE | FIN-03, FIN-02 | M |
| FIN-09 | Owner earnings settlement job + API | DONE | FIN-01, FIN-D1 | L |
| FIN-10 | Reconciliation v1 + discrepancy resolution | DONE | FIN-01, FIN-02, FIN-03 | L |
| FIN-11 | Cash-flow and revenue reports | DONE | FIN-03, FIN-09 | M |
| FIN-12 | Excel export service/API | DONE | FIN-03, FIN-04, FIN-07, FIN-08, FIN-10, FIN-11 | L |
| FIN-13 | Frontend base UI + routes + redirects (UI-REDO) | DONE | FIN-04–FIN-12 APIs | L |
| FIN-14 | E2E, regression, docs sync, and plan close-out | IN_PROGRESS | All | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | FIN-01, FIN-02 | Decision gate for FIN-01 |
| 2 | FIN-03, FIN-05 | Wave 1 |
| 3 | FIN-04, FIN-06, FIN-07, FIN-08 | FIN-03 |
| 4 | FIN-09, FIN-10 | FIN-01; FIN-D1 for FIN-09 |
| 5 | FIN-11, FIN-12 | FIN-09, FIN-10 |
| 6 | FIN-13 | Stable P0 APIs |
| 7 | FIN-14 | All |

---

## [x] FIN-01: Migration `0025`, finance schema, entry types, and indexes

```text
Status: DONE
Size: L
Blocked by: FIN-D1/FIN-D2 confirmation (Owner earning types only)
```

**Objective:** Add the minimal schema needed for Owner earnings and finance audit,
without changing existing money behavior.

**Scope**

- In scope:
  - Extend `chk_wallet_entry_type` with `OWNER_EARNING` and
    `OWNER_EARNING_REVERSAL`.
  - Update `backend/src/db/schema/wallet.ts` and
    `backend/src/repositories/wallet/WalletRepository.ts` type union.
  - New `backend/src/db/schema/finance.ts` for `finance_audit_events`.
  - Supporting indexes in Tech Design §5.4.
  - Register migration slot `0025` in `docs/plans/migration-slot-log.md` before merge.
  - Update `docs/architecture/database-schema.md` with the new table, entry types,
    indexes, and Change Log entry.
- Out of scope:
  - Reconciliation run/items tables (phase 2).
  - Statement imports.
  - Any data backfill.

**Implementation requirements**

1. One migration/PR; do not reuse `0025` for another task.
2. Dropping/recreating the check constraint must keep all existing rows valid.
3. Add Drizzle checks mirroring the SQL constraint.
4. Update `npm run verify:migrations` and commit the snapshot/journal.
5. Do not add fee columns.

**Files/areas affected**

- `backend/src/db/migrations/0025_admin_finance.sql` (proposed name)
- `backend/src/db/migrations/meta/`
- `backend/src/db/schema/wallet.ts`
- `backend/src/db/schema/finance.ts`
- `backend/src/db/schema/index.ts`
- `backend/src/repositories/wallet/WalletRepository.ts`
- `docs/plans/migration-slot-log.md`
- `docs/architecture/database-schema.md`

**Schema impact:** new table + widened check constraint + indexes.

**Verification**

- Fresh and populated test DB migration apply.
- `npm run verify:migrations`.
- Existing wallet tests still pass.
- Inserting an `OWNER_EARNING` entry is accepted; an unknown type is rejected.
- No existing row violates the new constraint.

**Acceptance criteria**

- **Given** a populated database
  **When** `0025` runs
  **Then** no existing row is lost, the new types are accepted, and the new table and
  indexes exist.
- **Given** the Drizzle schema
  **When** `verify:migrations` runs
  **Then** the snapshot matches the SQL.

---

## [x] FIN-02: Finance audit service, repository, and API

```text
Status: DONE
Size: M
Blocked by: FIN-01
```

**Objective:** Make every finance Admin action attributable and append-only auditable.

**Scope**

- In scope:
  - `FinanceAuditRepository` insert/list with filters and pagination.
  - `FinanceAuditService.record(tx, input)` and `list(filter)`.
  - `GET /api/v1/admin/finance/audit`.
  - Zod validation for action/actor/entity/time filters.
  - Sanitized metadata output.
- Out of scope:
  - Wiring every producer (done in the owning tasks).
  - UI (FIN-13).

**Implementation requirements**

1. Insert supports an optional transaction executor.
2. No update/delete methods.
3. Metadata must be JSON-serializable and must not contain secrets or full bank
   account numbers.
4. List supports `action`, `actorId`, `entityType`, `entityId`, `from`, `to`, `page`,
   `limit`.
5. Errors use existing conventions.

**API impact:** one read-only endpoint.

**Verification**

- Unit: insert/read; ordering; filters; pagination; sanitized metadata.
- Integration: action + audit in the same transaction rolls back together.

**Acceptance criteria**

- **Given** a finance action
  **When** it succeeds
  **Then** exactly one audit row exists with actor, action, entity, metadata, and time.
- **Given** a failed transaction
  **When** it rolls back
  **Then** no orphan audit row remains.

---

## [x] FIN-03: Unified transaction ledger repository/service/API

```text
Status: DONE
Size: L
Blocked by: FIN-01
```

**Objective:** Provide one filterable view of all finance movements and a detail view.

**Scope**

- In scope:
  - Normalized `UNION ALL` query over ledger + pending top-ups + pending payouts +
    pending refunds.
  - Filters: source, status, user, reference, amount range, time range.
  - Stable ordering and pagination.
  - Detail endpoint for ledger, top-up, payment, refund, payout.
  - Masked bank account, related booking/registration.
- Out of scope:
  - Reports/aggregates (FIN-04, FIN-11).
  - Export (FIN-12).
  - Mutations.

**Implementation requirements**

1. Prefer the ledger as the spine; include provider intents that have no ledger row.
2. Use half-open `[from, to)` in `Asia/Ho_Chi_Minh`.
3. Avoid N+1: fetch related records in batches or a single query.
4. Cap `limit` at 100.
5. Never select provider secrets.
6. Detail for `ADMIN_ADJUSTMENT` reads description/actor; audit event is included when
   present.

**API impact:** `GET /transactions`, `GET /transactions/:source/:id`.

**Verification**

- Unit/API: source mapping, filters, ordering, pagination, detail, 404, 401/403.
- Integration: a top-up, payment, refund, payout, earning, and adjustment appear once
  each with the correct amount.
- Edge: no rows returns empty data and zero meta.

**Acceptance criteria**

- **Given** one row in each finance source
  **When** the ledger is queried
  **Then** each source appears once with the correct amount, status, user, and time.
- **Given** a detail request
  **When** the record exists
  **Then** related entities are returned and bank account numbers are masked.

---

## [x] FIN-04: Finance overview service/API

```text
Status: DONE
Size: M
Blocked by: FIN-03
```

**Objective:** Give Admin a one-screen operational summary with range filtering.

**Scope**

- In scope:
  - KPI cards per PRD §7.1 and §8.4.
  - Daily trend for cash in, cash out, gross revenue with zero-fill.
  - Lightweight reconciliation count.
  - `GET /overview?range=`.
- Out of scope:
  - Full discrepancy payload (FIN-10).
  - Charting library.

**Implementation requirements**

1. Resolve range in `Asia/Ho_Chi_Minh`; custom range max 366 days.
2. Single CTE statement for KPIs where practical.
3. `generate_series` zero-fill for daily trends.
4. Revenue fields include `isEstimate: true`.
5. Empty period returns zeros.

**API impact:** `GET /overview`.

**Verification**

- Unit: range boundaries, zero-fill, KPI mapping, estimate flag.
- Integration: fixture totals match PRD §8.4.

**Acceptance criteria**

- **Given** fixtures across multiple days
  **When** the overview is requested for `30d`
  **Then** every KPI matches the §8.4 definition and the trend zero-fills missing days.
- **Given** an empty period
  **When** the overview is requested
  **Then** values are zero and the response is not an error.

---

## [x] FIN-05: Admin wallet detail + credit/debit

```text
Status: DONE
Size: M
Blocked by: FIN-01, FIN-02
```

**Objective:** Let Admin inspect and adjust any user wallet safely.

**Scope**

- In scope:
  - Wallet snapshot, ledger entries, holds, payout/top-up summary.
  - Reuse `WalletService.adminCredit/adminDebit`.
  - New finance routes under `/wallets/:userId`.
  - Audit `WALLET_CREDIT`/`WALLET_DEBIT`.
- Out of scope:
  - Changing ledger semantics.
  - Deleting or editing entries.

**Implementation requirements**

1. Resolve user by id first; search by email/name is done client-side against the
   existing Admin user list, or via a small query endpoint.
2. Return `balance`, `held`, `available`, `updatedAt`.
3. Credit/debit require a reason (1–200 chars) and positive amount.
4. Debit over available returns the existing insufficient-balance error.
5. Audit inside the same transaction as the ledger write.
6. Mask PII not required on wallet detail, but do not expose secrets.

**API impact:** `GET /wallets/:userId`, `/entries`, `/holds`, `POST credit/debit`.

**Verification**

- Unit/API: snapshot math, entries, holds, credit/debit, overdraw, audit.
- Integration: ledger + balance + audit commit/rollback together.

**Acceptance criteria**

- **Given** a wallet with held funds
  **When** Admin opens it
  **Then** available = balance − held.
- **Given** Admin debits more than available
  **When** the request is submitted
  **Then** it is rejected and no ledger/audit row is written.
- **Given** a valid adjustment
  **When** it succeeds
  **Then** exactly one ledger entry and one audit row exist.

---

## [x] FIN-06: Top-up monitoring + manual match

```text
Status: DONE
Size: M
Blocked by: FIN-03, FIN-02
```

**Objective:** Let Admin inspect top-up intents and handle missing/mismatched webhook
cases without mutating amounts.

**Scope**

- In scope:
  - List/detail by status/provider/user/time.
  - Ledger match display.
  - Manual match action for a provider transfer with no intent/ledger row.
  - Audit `TOP_UP_MANUAL_MATCH`.
- Out of scope:
  - Changing a `SUCCESS` top-up amount.
  - Deleting top-ups.
  - SePay statement import (phase 2).

**Implementation requirements**

1. Manual match takes provider, provider reference, amount, user, and reason.
2. Idempotent by provider reference; a used reference is rejected.
3. If a matching failed/pending intent exists, link it; otherwise create an explicit
   manual top-up record with provider evidence. In both cases credit through the
   existing top-up path and idempotency pattern, not a raw ledger insert.
4. Reject a provider reference already linked to another record.
5. Do not modify a `SUCCESS` row.

**API impact:** `GET /top-ups`, `GET /top-ups/:id`, `POST /top-ups/:id/manual-match`.

**Verification**

- Unit/API: filters, detail, idempotent match, already-used reference, audit.
- Integration: a manual match credits once and appears in the ledger.

**Acceptance criteria**

- **Given** a provider transfer without a webhook
  **When** Admin records a manual match
  **Then** it is linked and credited exactly once.
- **Given** the same provider reference
  **When** Admin retries the match
  **Then** the request is rejected and no second credit occurs.

---

## [x] FIN-07: Payout management enhancements

```text
Status: DONE
Size: M
Blocked by: FIN-03, FIN-02
```

**Objective:** Make the existing payout queue operational and paginated without
changing the state machine.

**Scope**

- In scope:
  - Paginated list/detail with masked bank account and hold.
  - Approve/reject/paid through the existing `WalletPayoutService`.
  - Audit `PAYOUT_APPROVE`/`PAYOUT_REJECT`/`PAYOUT_MARK_PAID`.
  - Compatibility with `/admin/wallet/payouts` notification deep links.
- Out of scope:
  - Auto-settlement (plan 12).
  - Bulk actions.
  - Changing hold/capture behavior.

**Implementation requirements**

1. Reuse `approve`, `reject`, `markPaid`; do not duplicate logic.
2. Reject requires a reason; mark-paid requires `transferReference`.
3. Terminal states remain terminal; concurrent actions use existing locks.
4. Add audit after the service transaction succeeds; if audit must be atomic, move the
   audit insert into the service transaction.
5. Keep the old array response for `/admin/wallet/payouts`.

**API impact:** `GET /payouts`, `GET /payouts/:id`, actions.

**Verification**

- Unit/API: pagination, filters, detail, actions, invalid transitions, missing
  reference, audit.
- Integration: reject releases hold; mark-paid captures exactly once.

**Acceptance criteria**

- **Given** a `PENDING` payout
  **When** Admin rejects with a reason
  **Then** it becomes `REJECTED`, the hold is released, and an audit row exists.
- **Given** an `APPROVED` payout
  **When** Admin marks paid without a reference
  **Then** it is rejected and state is unchanged.
- **Given** a concurrent double mark-paid
  **When** both calls run
  **Then** exactly one ledger capture exists.

---

## [x] FIN-08: Refund queue retry + resolution note

```text
Status: DONE
Size: M
Blocked by: FIN-03, FIN-02
```

**Objective:** Let Admin intervene in failed refunds with a controlled, idempotent
workflow.

**Scope**

- In scope:
  - List/detail by status/payment/user/time.
  - Retry for `FAILED` refunds within the configured attempt bound.
  - Resolution note without direct ledger mutation.
  - Audit `REFUND_RETRY`/`REFUND_RESOLVE`.
- Out of scope:
  - Direct ledger edits.
  - Refund-to-source.
  - Changing refund policy.

**Implementation requirements**

1. Retry resets the claim in a way that the existing worker can process; do not call
   the provider inside the request transaction.
2. Retry is idempotent and cannot create a second refund credit.
3. Exhausted attempts return `FINANCE_REFUND_NOT_RETRYABLE`.
4. Resolution note is metadata-only; corrections use wallet adjustment.
5. Audit inside/after the action transaction as appropriate.

**API impact:** `GET /refunds`, `GET /refunds/:paymentId`, `POST retry`,
`POST resolve-note`.

**Verification**

- Unit/API: filters, detail, retry bound, duplicate prevention, note, audit.
- Integration: retry eventually credits once; a second retry cannot double-credit.
- Failure: provider error leaves `FAILED` and observable error.

**Acceptance criteria**

- **Given** a `FAILED` refund below the attempt bound
  **When** Admin retries
  **Then** it becomes retryable/processing and eventually `REFUNDED` exactly once.
- **Given** an exhausted refund
  **When** Admin retries
  **Then** it is rejected and no ledger change occurs.

---

## [x] FIN-09: Owner earnings settlement job + API

```text
Status: DONE
Size: L
Blocked by: FIN-01, FIN-D1 confirmation
```

**Objective:** Give Court Owners an organic wallet balance from completed paid
bookings.

**Scope**

- In scope:
  - `OwnerEarningService` eligibility query and credit algorithm.
  - `owner-earning.job.ts` periodic sweep.
  - Admin-triggered bounded sweep and list.
  - Reversal with reason and insufficient-balance handling.
  - Audit `OWNER_EARNING_SWEEP`/`OWNER_EARNING_REVERSAL`.
- Out of scope:
  - Tournament/organizer earnings.
  - Platform fee.
  - T+N holding.

**Implementation requirements**

1. Eligibility: `COMPLETED` booking + `SUCCESS` payment + facility Owner + no existing
   earning entry.
2. Use `bookings.total_amount` snapshot.
3. Credit with `OWNER_EARNING`, `referenceType='BOOKING'`, idempotency
   `owner-earning:<bookingId>`.
4. Lock order must follow existing conventions (`USERS` then `WALLET_ACCOUNTS`).
5. One transaction per booking or a small batch; one failure does not abort the run.
6. Return `{ scanned, credited, skipped, failed }` and audit the run.
7. Reversal uses `OWNER_EARNING_REVERSAL`, requires a reason, and fails closed if
   funds are insufficient.
8. Add a dry-run option to the Admin-triggered sweep (recommended for rollout).

**API impact:** `GET /owner-earnings`, `POST /owner-earnings/sweep`,
`POST /owner-earnings/:bookingId/reverse`.

**Verification**

- Unit: eligibility, owner resolution, idempotency, repeated sweep, unpaid/cancelled
  exclusion, reversal success/insufficient.
- Integration: completed paid booking credits Owner once; payout can draw that
  balance.
- Concurrency: two sweeps cannot double-credit.

**Acceptance criteria**

- **Given** a completed paid booking
  **When** the sweep runs
  **Then** the facility Owner receives exactly one `OWNER_EARNING` of
  `totalAmount`.
- **Given** the sweep runs again
  **When** the booking already has an earning
  **Then** it is skipped and no second entry is written.
- **Given** an Owner with insufficient balance
  **When** Admin reverses an earning
  **Then** the request fails and no negative balance is created.

---

## [x] FIN-10: Reconciliation v1 + discrepancy resolution

```text
Status: DONE
Size: L
Blocked by: FIN-01, FIN-02, FIN-03
```

**Objective:** Replace totals-only reconciliation with a discrepancy workflow.

**Scope**

- In scope:
  - Checks in Tech Design §6.4.
  - Stable discrepancy keys and response shape.
  - Resolution with note and audit.
  - `GET /reconciliation`, `POST /discrepancies/:key/resolve`.
- Out of scope:
  - Persisted runs/items (phase 2).
  - External statement import/API (phase 2).
  - Automatic correction.

**Implementation requirements**

1. Run in a read-only snapshot (repeatable read or a consistent single query).
2. Compare totals and per-entity unmatched records.
3. Return expected/actual/delta and a human-readable message.
4. Resolution never mutates money; it records a note.
5. Cap the discrepancy list (e.g. 500) and include a `truncated` flag.

**API impact:** `GET /reconciliation`, `POST /discrepancies/:key/resolve`.

**Verification**

- Unit: one seeded discrepancy per check; clean fixture returns none.
- Integration: resolution audit; no ledger mutation.
- Edge: large discrepancy sets are capped and flagged.

**Acceptance criteria**

- **Given** a clean fixture
  **When** reconciliation runs
  **Then** it returns zero discrepancies.
- **Given** a seeded mismatch per check
  **When** reconciliation runs
  **Then** each mismatch is returned with a stable key and correct expected/actual.
- **Given** a discrepancy
  **When** Admin resolves it with a note
  **Then** an audit row exists and no money movement occurs.

---

## [x] FIN-11: Cash-flow and revenue reports

```text
Status: DONE
Size: M
Blocked by: FIN-03, FIN-09
```

**Objective:** Provide operational finance reports without accounting-grade claims.

**Scope**

- In scope:
  - Cash-flow report (top-up in, payout out, net).
  - Revenue report (gross, refunds, net estimate, Owner earnings) grouped by day,
    source, or Owner.
  - `GET /reports/cash-flow`, `GET /reports/revenue`.
- Out of scope:
  - Accounting periods, journals, tax, invoices.
  - Custom report builder.
  - Scheduled reports (phase 2; Excel export is FIN-12).

**Implementation requirements**

1. Use PRD §8.4 definitions exactly.
2. `Asia/Ho_Chi_Minh`, half-open intervals.
3. Revenue response includes `isEstimate: true` and a note.
4. Group-by validation: `day | source | owner`.
5. Empty results return zero rows/values.

**API impact:** two read-only endpoints.

**Verification**

- Unit: definitions, grouping, timezone boundaries, estimate flag.
- Integration: fixture totals match hand-calculated values.

**Acceptance criteria**

- **Given** fixtures with top-ups, payouts, payments, refunds, and owner earnings
  **When** each report is requested
  **Then** every total matches §8.4.
- **Given** a revenue report
  **When** it is returned
  **Then** it is labelled as an estimate.

---

## [x] FIN-12: Excel export service/API

```text
Status: DONE
Size: L
Blocked by: FIN-03, FIN-04, FIN-07, FIN-08, FIN-10, FIN-11
```

**Objective:** Export finance data to real `.xlsx` files with audit and safety.

**Scope**

- In scope:
  - Add `exceljs` to backend dependencies.
  - `FinanceExportService` for transactions, top-ups, payouts, refunds, revenue,
    cash-flow, reconciliation.
  - Summary + data sheets, formatting, totals.
  - Formula-injection protection, bank account masking.
  - 20,000-row cap and rate limit.
  - Audit `EXPORT`.
  - `GET /exports/:type`.
- Out of scope:
  - Async jobs, stored files, scheduled exports.
  - CSV.

**Implementation requirements**

1. Reuse the same query/service as the screen.
2. Pre-count rows; over cap returns `FINANCE_EXPORT_TOO_LARGE`.
3. Use `exceljs`; write numbers as numbers, dates as dates.
4. Text sanitization per Tech Design §6.6.
5. Set the headers exactly as specified; no-store.
6. Audit with filters and row count; do not store the file.
7. Rate limit per Admin.

**API impact:** one download endpoint.

**Verification**

- Unit: workbook sheet names, headers, totals, filters, empty export, formula
  injection, mask, cap, audit.
- API: content-type, disposition, auth/rate limit.
- Manual: open the file in Excel/LibreOffice; numbers and dates render correctly.

**Acceptance criteria**

- **Given** filtered transactions
  **When** Admin exports
  **Then** the workbook contains the same rows/totals as the screen.
- **Given** a text value beginning with `=`
  **When** the file is generated
  **Then** it is escaped and not executed as a formula.
- **Given** more than 20,000 rows
  **When** Admin exports
  **Then** the request fails with `FINANCE_EXPORT_TOO_LARGE`.
- **Given** a successful export
  **When** it completes
  **Then** one audit row exists and no file is stored server-side.

---

## [x] FIN-13: Frontend base UI + routes + redirects (UI-REDO)

```text
Status: DONE
Size: L
Blocked by: FIN-04–FIN-12 APIs
```

**Objective:** Provide a testable base UI for every P0 flow. Final visuals are
deferred.

**Scope**

- In scope:
  - Routes under `/admin/finance/*` per Tech Design §8.
  - Sidebar entry “Quản lý tài chính”.
  - Base pages using `AdminSidebar`, `AdminHeader`, and existing styles.
  - `adminFinanceService.ts`, `types.ts`.
  - Simple filters, tables, detail panels, action prompts, loading/empty/error states.
  - Redirects from `/admin/wallet/*` preserving `payoutId`/`paymentId`.
  - Visible `UI-REDO` marker.
- Out of scope:
  - Final visuals, Figma fidelity, responsive polish, chart library.
  - New notification UI.

**Implementation requirements**

1. Do not duplicate HTTP logic; use the shared `httpClient`.
2. Show real API data only; no mock values.
3. Actions must show success/error feedback and refresh the affected list.
4. Export must download via fetch/blob (auth header) and handle errors.
5. Keep the base accessible enough for Playwright selectors (`data-testid` where
   useful).
6. Update `AdminHeader` titles and `AdminSidebar` active state.
7. Keep old routes working.

**API impact:** none.

**Verification**

- `npm run build --prefix frontend`
- `npm run lint --prefix frontend`
- Manual: every P0 flow with a seeded Admin.
- Playwright: FIN-14 config.

**Acceptance criteria**

- **Given** an Admin
  **When** they open `/admin/finance`
  **Then** they can navigate to every section and see real data.
- **Given** an old notification deep link
  **When** it opens `/admin/wallet/payouts?payoutId=1`
  **Then** it redirects to the finance payout list and highlights the row.
- **Given** any finance screen
  **When** it is reviewed
  **Then** it is clearly marked `UI-REDO`.

---

## [ ] FIN-14: E2E, regression, docs sync, and plan close-out

```text
Status: IN_PROGRESS
Size: M
Blocked by: All
```

**Objective:** Prove the feature end-to-end and close the documentation loop.

> **Progress 2026-11-19:** FIN-14 IN_PROGRESS. Backend build, targeted 55/55 tests, migration verify, frontend build, and Playwright 2/2 PASS. Full backend suite timed out in this session and must be rerun before DONE.

**Scope**

- In scope:
  - Playwright config `playwright.admin-finance.config.ts`.
  - Backend regression for wallet/top-up/refund/payout/booking payment.
  - Full backend suite and migration verification.
  - Docs sync: PRD/tech design/tasks, plan 14, index, schema, migration log,
    architecture frontend routes.
  - Evidence block in plan 14.
- Out of scope:
  - UI-REDO visual pass.
  - Phase 2 items.

**Verification**

```bash
npm run db:migrate
npm run verify:migrations
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.admin-finance.config.ts
```

**Acceptance criteria**

- Full backend suite passes.
- Migration verification passes on fresh and populated DBs.
- Backend/frontend builds pass; frontend lint has no new errors.
- Playwright covers the P0 journeys in Tech Design §10.2.
- Plan 14 and `00_danh-muc-task.md` reflect the actual status.
- No unresolved `TBD` remains in the implemented scope.

---

## Evidence — 2026-11-19

- Migration `0025_plain_sister_grimm.sql` applied to dev + test DB; `npm run verify:migrations` PASS (26 migrations, no schema diff).
- Backend `npm run build` PASS.
- Finance targeted suite: `finance-admin.test.ts` 9/9 PASS; wallet/payout/top-up/ledger/refund/booking-payment/admin-notifications/dashboard batch 55/55 PASS.
- Frontend `npm run build` PASS; `npm run lint` has existing warnings only, no errors.
- Playwright `playwright.admin-finance.config.ts` 2/2 PASS (finance tabs + legacy redirect with query params).
- Full backend suite exceeded the 15-minute session limit; FIN-14 remains IN_PROGRESS until a full run completes.
