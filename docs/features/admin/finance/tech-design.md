# Admin Finance Management — Technical Design

## 1. Metadata

```text
Status: Implemented P0 (2026-11-19)
Owner: Tech Lead
PRD: docs/features/admin/finance/prd.md
Scope: Admin-only finance module under /api/v1/admin/finance and /admin/finance,
       covering overview, unified ledger, wallets, top-ups, payouts, refunds,
       owner earnings, reconciliation, reports, Excel export, and finance audit.
Decision Status: ACCEPTED for implementation (FIN-D1–FIN-D10)
```

This design does not override the governing PRD, `PROJECT-BRIEF.md`,
`docs/business-rules-config-matrix.md`, `docs/architecture/tech-stack.md`,
`docs/architecture/conventions.md`, or `docs/architecture/database-schema.md`.

> **Frontend scope.** Only a base UI is implemented. It must be sufficient to test
> every P0 flow manually and in Playwright. Every screen is marked **UI-REDO** and is
> expected to be reworked after the parallel frontend merge.

> **No new decisions at implementation time.** If a decision is missing, stop and
> update the PRD/tech design first. Do not silently invent a fee, settlement timing,
> or accounting rule.

## 2. Context

The platform is wallet-first. Players top up with SePay/VietQR, pay bookings from
their wallet, receive refunds into their wallet, and request withdrawals. Court Owners
request payouts from their wallet. Admin approves/rejects/marks payouts paid and may
credit/debit wallets with a reason. Ledger entries are append-only.

The existing implementation already provides:

- `backend/src/routes/admin/adminWalletRoutes.ts` — reconciliation, payout list and
  actions, refund list, wallet credit/debit.
- `backend/src/controllers/admin/AdminWalletController.ts` — HTTP layer.
- `backend/src/services/payments/WalletService.ts` — balances, holds, ledger writes.
- `backend/src/services/payments/WalletTopUpService.ts` — top-up intents and SePay
  webhooks.
- `backend/src/services/payments/WalletPayoutService.ts` — payout state machine.
- `backend/src/services/payments/RefundService.ts` and `AdminRefundService.ts` —
  refund worker/queue.
- `backend/src/services/booking/booking-state.service.ts` — booking state sweep.
- `backend/src/repositories/booking/BookingRepository.ts` —
  `findBookingFacilityOwner`, completion transitions.

Gaps this design closes:

1. No unified transaction query across finance sources.
2. No wallet-level Admin view (ledger, holds, related records).
3. Payout list is unpaginated; refund queue has no controlled retry.
4. Reconciliation is totals-only and has no resolution workflow.
5. No Owner earnings source, so `OWNER_PAYOUT` has no organic balance.
6. No operational cash-flow/revenue reports and no Excel export.
7. No audit for export, retry, reconciliation resolution, or Owner settlement.
8. Navigation and routes are split between `/admin/wallet` and dashboard.

## 3. Boundaries and Module Layout

Following `docs/architecture/conventions.md` (layer-first):

| Layer | New/changed files |
| --- | --- |
| Routes | `backend/src/routes/admin/adminFinanceRoutes.ts` (new); keep `adminWalletRoutes.ts` as compatibility alias |
| Controllers | `backend/src/controllers/admin/AdminFinanceController.ts` (new) |
| Validation | `backend/src/validation/admin-finance.ts` (new) |
| Services | `backend/src/services/finance/FinanceOverviewService.ts`, `FinanceTransactionService.ts`, `OwnerEarningService.ts`, `ReconciliationService.ts`, `FinanceReportService.ts`, `FinanceExportService.ts`, `FinanceAuditService.ts` |
| Repositories | `backend/src/repositories/finance/FinanceQueryRepository.ts`, `FinanceAuditRepository.ts`, `OwnerEarningRepository.ts` |
| Jobs | `backend/src/jobs/owner-earning.job.ts` (new) |
| Schema | `backend/src/db/schema/wallet.ts` (entry types), `backend/src/db/schema/finance.ts` (new audit schema) |
| Migration | `0025_admin_finance.sql` (proposed; register in `docs/plans/migration-slot-log.md` before merge) |
| Frontend | `frontend/src/features/admin/finance/` (new base UI) |

Existing services are reused; this module does not fork wallet logic. The Admin
finance service calls `WalletService`, `WalletPayoutService`, and refund services
rather than writing balances directly.

## 4. API Contract

All routes are under `/api/v1/admin/finance` and require
`authenticate` + `requireRole('ADMIN')` at router level. Pagination follows the
existing offset convention (`page`, `limit`, max 100). Errors use the standard
`{ error: { code, message } }` shape.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/overview?range=` | KPI cards and daily totals |
| GET | `/transactions?source=&status=&userId=&referenceType=&referenceId=&from=&to=&minAmount=&maxAmount=&page=&limit=` | Unified ledger |
| GET | `/transactions/:source/:id` | Transaction detail (`source` = `ledger`, `top-up`, `payment`, `refund`, `payout`) |
| GET | `/wallets/:userId` | Wallet snapshot and summary counts |
| GET | `/wallets/:userId/entries?page=&limit=` | Wallet ledger entries |
| GET | `/wallets/:userId/holds?status=&page=&limit=` | Wallet holds |
| POST | `/wallets/:userId/credit` | Admin credit (reuses existing service) |
| POST | `/wallets/:userId/debit` | Admin debit (reuses existing service) |
| GET | `/top-ups?status=&provider=&userId=&from=&to=&page=&limit=` | Top-up list |
| GET | `/top-ups/:id` | Top-up detail with ledger match |
| POST | `/top-ups/:id/manual-match` | Record a manual provider match |
| GET | `/payouts?status=&requestType=&userId=&from=&to=&page=&limit=` | Payout list (paginated) |
| GET | `/payouts/:id` | Payout detail with masked bank account and hold |
| POST | `/payouts/:id/approve` | Approve |
| POST | `/payouts/:id/reject` | Reject with reason |
| POST | `/payouts/:id/paid` | Mark paid with transfer reference |
| GET | `/refunds?status=&paymentId=&userId=&from=&to=&page=&limit=` | Refund queue |
| GET | `/refunds/:paymentId` | Refund detail |
| POST | `/refunds/:paymentId/retry` | Controlled retry |
| POST | `/refunds/:paymentId/resolve-note` | Record manual resolution note |
| GET | `/owner-earnings?ownerId=&status=&from=&to=&page=&limit=` | Owner earnings list |
| POST | `/owner-earnings/sweep` | Admin-triggered bounded sweep |
| POST | `/owner-earnings/:bookingId/reverse` | Exceptional reversal with reason |
| GET | `/reconciliation?range=` | Run reconciliation and list discrepancies |
| POST | `/reconciliation/discrepancies/:key/resolve` | Resolve with note |
| GET | `/reports/cash-flow?range=&groupBy=day` | Cash-flow report |
| GET | `/reports/revenue?range=&groupBy=day\|source\|owner` | Revenue report |
| GET | `/exports/:type?` | Excel export (`transactions`, `top-ups`, `payouts`, `refunds`, `revenue`, `cash-flow`, `reconciliation`) |
| GET | `/audit?action=&actorId=&entityType=&entityId=&from=&to=&page=&limit=` | Finance audit list |
| POST | `/jobs/owner-earnings/run` | Ops trigger for the sweep (ADMIN only) |

### 4.1 Compatibility

- Existing `/api/v1/admin/wallet/*` endpoints remain valid in P0 and delegate to the
  same services. The new finance routes are additive.
- Existing `GET /admin/wallet/payouts` returns an array; the new paginated finance
  endpoint returns `{ data, meta }`. The old shape is preserved for compatibility.
- `/admin/wallet/payouts|refunds|reconciliation` frontend routes redirect to the new
  `/admin/finance/...` routes and preserve `payoutId`/`paymentId` query params.

### 4.2 Error Codes

| Code | HTTP | When |
| --- | --- | --- |
| `FINANCE_INVALID_RANGE` | 400 | Range invalid or outside the allowed maximum |
| `FINANCE_TRANSACTION_NOT_FOUND` | 404 | Unknown source/id |
| `FINANCE_WALLET_NOT_FOUND` | 404 | User has no wallet |
| `FINANCE_EXPORT_UNSUPPORTED_TYPE` | 400 | Unknown export type |
| `FINANCE_EXPORT_TOO_LARGE` | 413 | Row cap exceeded |
| `FINANCE_REFUND_NOT_RETRYABLE` | 409 | Refund is not `FAILED` or attempts exhausted |
| `FINANCE_OWNER_EARNING_NOT_ELIGIBLE` | 409 | Booking not paid/completed or already credited |
| `FINANCE_OWNER_EARNING_INSUFFICIENT_BALANCE` | 409 | Reversal cannot be covered |
| `FINANCE_RECONCILIATION_NOT_FOUND` | 404 | Discrepancy key not present in the current run |
| `FINANCE_MANUAL_MATCH_ALREADY_USED` | 409 | Provider reference already matched |

Existing wallet/payout/refund error codes are reused where applicable.

## 5. Data Model

### 5.1 Reused Tables

No column changes to:

- `PAYMENTS` (§3.10)
- `WALLET_ACCOUNTS`, `WALLET_LEDGER_ENTRIES`, `WALLET_HOLDS` (§3.34–§3.36)
- `WALLET_TOP_UPS` (§3.37)
- `PAYMENT_REFUNDS` (§3.38)
- `WALLET_BANK_ACCOUNTS`, `WALLET_PAYOUT_REQUESTS` (§3.39–§3.40)
- `BOOKINGS`, `COURTS`, `FACILITIES`, `USERS`

### 5.2 New Ledger Entry Types

Extend `chk_wallet_entry_type` and the TypeScript union with:

- `OWNER_EARNING` — positive credit to the facility Owner.
- `OWNER_EARNING_REVERSAL` — negative correction with a reason.

Reference type `BOOKING`, reference id = booking id. Idempotency keys:

- `owner-earning:<bookingId>`
- `owner-earning-reversal:<bookingId>`

### 5.3 `finance_audit_events` (new, append-only)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint PK | identity |
| `actor_id` | bigint | FK `USERS.id`, not null |
| `action` | varchar(40) | `EXPORT`, `PAYOUT_APPROVE`, `PAYOUT_REJECT`, `PAYOUT_MARK_PAID`, `WALLET_CREDIT`, `WALLET_DEBIT`, `REFUND_RETRY`, `REFUND_RESOLVE`, `OWNER_EARNING_SWEEP`, `OWNER_EARNING_REVERSAL`, `RECONCILIATION_RESOLVE`, `TOP_UP_MANUAL_MATCH` |
| `entity_type` | varchar(40) | `PAYOUT`, `REFUND`, `WALLET`, `EXPORT`, `BOOKING`, `TOP_UP`, `RECONCILIATION` |
| `entity_id` | varchar(80) nullable | numeric id or stable discrepancy key |
| `metadata` | jsonb nullable | filters, amounts, reason, before/after state, row count |
| `created_at` | timestamptz | default now |

Indexes: `(actor_id, created_at DESC)`, `(entity_type, entity_id)`,
`(action, created_at DESC)`. No update/delete API.

### 5.4 Supporting Indexes

Add only what the new queries need (verify with `EXPLAIN` before merging):

- `wallet_ledger_entries (entry_type, created_at DESC, id DESC)`
- `wallet_ledger_entries (reference_type, reference_id)`
- `payments (status, paid_at DESC, id DESC)`
- `wallet_top_ups (status, created_at DESC, id DESC)`
- `wallet_payout_requests (status, requested_at DESC, id DESC)`
- `payment_refunds (status, updated_at DESC)`

The existing indexes remain; do not drop or replace them.

### 5.5 Migration `0025_admin_finance.sql` (proposed)

1. Drop and recreate `chk_wallet_entry_type` with the two new values.
2. Create `finance_audit_events` and its indexes.
3. Add the supporting indexes in §5.4.
4. No data backfill. No destructive changes.
5. Update Drizzle schema + snapshot + journal and register the slot before merge.

Phase 2 (not in `0025`): `finance_reconciliation_runs`,
`finance_reconciliation_items`, statement imports.

## 6. Service Design

### 6.1 `FinanceOverviewService`

- Resolve range in `Asia/Ho_Chi_Minh` (reuse the dashboard range resolver if it is
  extracted; otherwise duplicate the small helper with tests).
- Single aggregate query with CTEs for snapshot + period values:
  wallet liability, held, cash in, cash out, gross revenue, refunds, owner earnings,
  pending payouts, failed refunds.
- Daily trend query with `generate_series` zero-fill for the selected range.
- Reconciliation count is read from `ReconciliationService` with a lightweight mode
  (no full discrepancy payload) or computed in the same endpoint with a cap.

### 6.2 `FinanceTransactionService`

- Query `WALLET_LEDGER_ENTRIES` as the spine, then join the owning record by
  `reference_type`/`reference_id` and `entry_type`:
  - `TOP_UP` → `WALLET_TOP_UPS`
  - `PAYMENT` → `PAYMENTS`
  - `REFUND` → `PAYMENT_REFUNDS` / `PAYMENTS`
  - `WITHDRAWAL`/`PAYOUT` → `WALLET_PAYOUT_REQUESTS`
  - `OWNER_EARNING`/`OWNER_EARNING_REVERSAL` → `BOOKINGS`
  - `ADMIN_ADJUSTMENT` → audit metadata/description
- For a unified view that includes provider intents not yet in the ledger (pending
  top-ups, pending payouts, pending refunds), use `UNION ALL` over a normalized CTE:
  `source`, `source_id`, `occurred_at`, `status`, `user_id`, `amount`, `reference`.
- Stable ordering: `occurred_at DESC, source, source_id DESC`.
- Detail endpoint loads the ledger row plus related entities and sanitizes secrets.
- No raw full bank account numbers; mask to last 4 characters.

### 6.2.1 Manual top-up match

- Input: provider, provider reference, amount, user, transfer time, reason.
- If a `PENDING`/`EXPIRED`/`FAILED` top-up intent exists for the same user/amount, link
  the provider reference to it and run the existing top-up credit path.
- If no intent exists, create an explicit manual top-up record (provider, reference,
  amount, user, reason, admin actor) and credit through the same idempotent path; do
  not raw-insert a ledger row.
- Reject a provider reference that is already linked (`FINANCE_MANUAL_MATCH_ALREADY_USED`).
- Never change the amount of an existing `SUCCESS` top-up.
- Record `TOP_UP_MANUAL_MATCH` in `finance_audit_events` in the same transaction.

### 6.3 `OwnerEarningService` and job

Algorithm (one transaction per booking batch):

> The sweep uses the persisted booking status. If the booking state worker has not yet
> persisted `COMPLETED`, the next sweep picks it up; no earning depends on a computed
> but unpersisted status.

1. Select eligible bookings:
   - `bookings.status = 'COMPLETED'`
   - `payments.status = 'SUCCESS'`
   - `bookings.total_amount > 0`
   - no existing ledger entry with `entry_type = 'OWNER_EARNING'` and
     `reference_type = 'BOOKING'`, `reference_id = bookings.id`
   - bounded by sweep range/limit
2. Resolve facility Owner via `bookings → courts → facilities.owner_id`.
3. Lock the Owner wallet row (`USERS` then `WALLET_ACCOUNTS` consistent with existing
   lock order).
4. Credit the Owner wallet with `WalletService.credit`:
   `entryType = 'OWNER_EARNING'`, `referenceType = 'BOOKING'`,
   `referenceId = booking.id`, `idempotencyKey = owner-earning:<bookingId>`,
   `description = 'Doanh thu booking <bookingCode>'`.
5. If the unique idempotency key already exists (for example, two concurrent sweeps),
   treat the booking as `skipped` instead of failing the run.
6. Record a `finance_audit_events` row for the sweep (one per run, with counts) and
   per-booking failures in the run result; do not fail the whole batch for one
   booking.
7. Return `{ scanned, credited, skipped, failed }`.

The periodic job is gated by `OWNER_EARNING_JOB_ENABLED` (default `false`) so historical
bookings are not credited without an explicit rollout decision. The Admin-triggered
endpoint runs the same service for a bounded range and is available regardless of the
job flag.

Reversal:

1. Require a reason.
2. Lock the Owner wallet.
3. If available balance covers the amount, debit with
   `OWNER_EARNING_REVERSAL`, idempotency `owner-earning-reversal:<bookingId>`.
4. Otherwise return `FINANCE_OWNER_EARNING_INSUFFICIENT_BALANCE`; do not force a
   negative balance. Report for reconciliation/manual handling.
5. Audit the action and reason.

### 6.4 `ReconciliationService`

Run checks in one read-only snapshot (repeatable read transaction or a single CTE
statement where practical):

| Check | Expected | Actual |
| --- | --- | --- |
| Top-up | `SUM(top_ups.amount WHERE status='SUCCESS')` | `SUM(ledger.amount WHERE entry_type='TOP_UP')` |
| Payment | `SUM(payments.amount WHERE status='SUCCESS')` | `SUM(ledger.amount WHERE entry_type='PAYMENT')` |
| Refund | `SUM(refunds.amount WHERE status='REFUNDED')` | `SUM(ledger.amount WHERE entry_type='REFUND')` |
| Payout | `SUM(payouts.amount WHERE status='PAID')` | `SUM(-ledger.amount WHERE entry_type IN ('WITHDRAWAL','PAYOUT'))` |
| Owner earning | `SUM(bookings.total_amount WHERE paid+completed)` | `SUM(ledger OWNER_EARNING − REVERSAL)` |
| Wallet balance | `SUM(ledger.amount)` per user | `wallet_accounts.balance` per user |
| Holds | `SUM(holds.amount WHERE status='HELD')` | derived held total |
| Unmatched records | `SUCCESS` top-ups and `PAID` payouts each have a ledger row | missing ledger rows |

Each discrepancy gets a stable key: `"<check>:<entity>:<id>"`. The response includes
type, expected, actual, delta, entity, and a human-readable message.

Resolution records an audit event with the key and note. It does not mutate money.
Any correction must use a wallet adjustment or a refund/payout action, each with its
own audit.

Phase 2 adds persisted runs/items and external statement comparison.

### 6.5 `FinanceReportService`

- Cash flow: cash in (top-ups), cash out (payouts), net cash movement, grouped by day.
- Revenue: gross payments, refunds, net estimated, owner earnings; group by day,
  source, or owner.
- Definitions are exactly PRD §8.4.
- Period bounds `Asia/Ho_Chi_Minh`, half-open.
- Revenue response includes `isEstimate: true` and a note.

### 6.6 `FinanceExportService` (Excel)

Library: `exceljs` (backend dependency). Phase 1 is synchronous with a 20,000-row cap.

Flow:

1. Validate type, filters, range, and cap (run a `COUNT` first).
2. Build an `ExcelJS.Workbook`:
   - `Tổng hợp`: title, filters, generated by (Admin id/email), generated at,
     timezone, row count, totals.
   - `Dữ liệu`: Vietnamese headers, frozen header, autofilter, column widths.
3. Amounts as numbers with `#,##0`; dates as `dd/mm/yyyy hh:mm`.
4. Sanitize text cells: if a value starts with `=`, `+`, `-`, `@`, tab, or CR, prefix
   with `'` and write as string.
5. Mask bank account numbers to last 4 characters.
6. Stream/write the workbook to the response with:
   `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
   `Content-Disposition: attachment; filename="finance-<type>-<yyyyMMdd-HHmm>.xlsx"`,
   `Cache-Control: no-store`.
7. Write one `finance_audit_events` row with action `EXPORT`, type, filters, and row
   count.
8. On errors after headers are sent, log and abort; pre-validate everything possible
   before writing headers.

Phase 2: once row count exceeds the cap, use an async job and a short-lived download
token; do not store the file permanently.

### 6.7 `FinanceAuditService`

- `record(tx, input)` inserts one row; called inside the same transaction as the
  action where possible.
- For exports and read-only resolutions, use a separate transaction after the action
  succeeds.
- Admin list endpoint supports filters and pagination; metadata is returned sanitized.

## 7. Validation

`backend/src/validation/admin-finance.ts`:

- `range`: `today | 7d | 30d | this_month`, optional `from`/`to` for custom ranges with
  a maximum span (proposed 366 days).
- `page` ≥ 1, `limit` 1–100.
- `source`: enum of `ledger | top-up | payment | refund | payout | owner-earning`.
- `status`: per-source enum.
- `amount` filters: positive decimal strings with up to 2 decimals.
- `type` for exports: fixed enum.
- `reason`: required, trimmed, 1–200 characters for adjustments, rejections,
  reversals, and manual matches.
- `transferReference`: required, trimmed, 1–120 characters for mark-paid.
- Reject unknown query keys or invalid date order with `FINANCE_INVALID_RANGE`.

## 8. Frontend Base (UI-REDO)

Routes:

| Route | Base content |
| --- | --- |
| `/admin/finance` | Redirect to `/admin/finance/overview` |
| `/admin/finance/overview` | KPI text cards + simple table trend |
| `/admin/finance/transactions` | Filter bar + paginated table + detail panel |
| `/admin/finance/wallets` | User search + wallet detail |
| `/admin/finance/top-ups` | Status filter + table + manual match action |
| `/admin/finance/payouts` | Status/type filter + table + actions |
| `/admin/finance/refunds` | Status filter + table + retry/note actions |
| `/admin/finance/owner-earnings` | Owner/period filter + sweep trigger |
| `/admin/finance/reconciliation` | Run + discrepancy table + resolve |
| `/admin/finance/reports` | Cash-flow/revenue selector + export button |
| `/admin/finance/audit` | Audit list |

Do not merge the whole finance console into `/admin/wallet/payouts`. Payout is one
tab; transactions, top-ups, refunds, owner earnings, reconciliation, reports, and
audit do not belong to the payout page. The finance module is the parent surface;
`/admin/wallet/payouts` redirects to `/admin/finance/payouts` with query params
preserved.

Components under `frontend/src/features/admin/finance/`:

- `AdminFinanceLayout` or a page with section tabs, using `AdminSidebar` +
  `AdminHeader` + `NotificationsProvider`.
- `adminFinanceService.ts` using the shared `httpClient`.
- `types.ts`.
- Simple tables/filters/action prompts; no chart library.
- Every screen gets a visible `UI-REDO` note in the page header or code comment.
- `/admin/wallet/*` redirects to the equivalent finance route, preserving
  `payoutId`/`paymentId`.

## 9. Security and Privacy

- Router-level `authenticate` + `requireRole('ADMIN')`.
- Export rate limit per Admin (proposed 10/hour; use the existing rate-limit
  middleware style).
- Mask bank account numbers; never return provider secrets/signatures.
- Audit metadata must not contain secrets or full account numbers.
- Admin adjustments require a reason and cannot overdraw.
- No update/delete on ledger or audit. Corrections are new entries.
- Money-changing actions remain inside database transactions; provider calls stay
  outside.

## 10. Testing Strategy

### 10.1 Backend

- `finance-ledger-query.test.ts` — unified source mapping, filters, ordering,
  pagination, detail, empty data.
- `finance-overview.test.ts` — range boundaries, snapshot vs period, zero-fill,
  estimate labels.
- `finance-wallet-admin.test.ts` — wallet detail, credit/debit, overdraw rejection,
  audit row.
- `finance-top-up-admin.test.ts` — status filters, manual match idempotency, mismatch
  handling.
- `finance-payout-admin.test.ts` — pagination, approve/reject/paid, terminal-state
  guards, transfer reference requirement, hold release/capture, audit.
- `finance-refund-admin.test.ts` — queue filters, retry bound, duplicate prevention,
  resolve note, audit.
- `owner-earnings.test.ts` — eligible/ineligible bookings, idempotency, Owner
  resolution, repeated sweep, reversal success/insufficient balance.
- `finance-reconciliation.test.ts` — clean fixture and one seeded discrepancy per
  check type; resolution audit.
- `finance-report.test.ts` — PRD §8.4 definitions, grouping, timezone, estimate.
- `finance-export.test.ts` — auth, content type, sheet names, rows/totals, filters,
  formula injection, mask, row cap, audit, no file retained.
- `finance-audit.test.ts` — append-only, filters, sanitized metadata.
- Extend `wallet-payout.test.ts`, `wallet-top-up.test.ts`, `refund.test.ts`,
  `wallet-booking-payment.test.ts` for regressions.

### 10.2 E2E / Playwright (base UI)

`frontend/playwright.admin-finance.config.ts`:

1. Admin login → overview → change range.
2. Transactions filter → open detail → export download.
3. Wallet search → credit/debit → ledger row.
4. Payout approve/reject/mark paid.
5. Refund failed → retry → status/note.
6. Owner earnings sweep → Owner wallet balance.
7. Reconciliation run → resolve discrepancy.
8. Reports → export.

### 10.3 Commands

```bash
npm run db:migrate
npm test --prefix backend -- --run \
  src/__tests__/finance-ledger-query.test.ts \
  src/__tests__/finance-overview.test.ts \
  src/__tests__/finance-wallet-admin.test.ts \
  src/__tests__/finance-top-up-admin.test.ts \
  src/__tests__/finance-payout-admin.test.ts \
  src/__tests__/finance-refund-admin.test.ts \
  src/__tests__/owner-earnings.test.ts \
  src/__tests__/finance-reconciliation.test.ts \
  src/__tests__/finance-report.test.ts \
  src/__tests__/finance-export.test.ts \
  src/__tests__/finance-audit.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.admin-finance.config.ts
```

Full backend suite and `npm run verify:migrations` must pass before the plan is
marked DONE.

## 11. Rollout and Rollback

Rollout:

1. Apply `0025` to a fresh and a populated test database; verify constraints and
   indexes.
2. Deploy backend with new routes additive; old wallet routes still work.
3. Deploy frontend with redirects and base screens.
4. Run the Owner earnings sweep in dry-run mode first (report counts) if a dry-run
   flag is implemented; otherwise run on a bounded date range.
5. Enable the periodic Owner earnings job after the first manual sweep is verified.

Rollback:

- Routes are additive; revert the frontend deployment first.
- Disable the Owner earnings job; do not delete ledger entries.
- `0025` is additive except the widened check constraint; rollback requires a new
  migration that narrows the constraint only after verifying no new entry types exist.

## 12. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Owner earning duplicate | Unique idempotency key + existence check + tests |
| Reversal overdraw | Fail closed, report, manual adjustment |
| Unified query becomes slow | Narrow indexes, mandatory range for exports, cap rows |
| Excel memory usage | Row cap, stream in phase 2 |
| PII in export/audit | Mask, ADMIN-only, rate limit, no stored files |
| Concurrent payout actions | Existing row locks + state guards + idempotent transitions |
| Reconciliation false positives | Stable keys, fixtures, documented formulas |
| Ledger constraint mismatch | Update SQL check, Drizzle check, and TS union in one migration |

## 13. Open Questions

- FIN-D1 final sign-off: Owner earning at `COMPLETED` (recommended) versus a T+N hold.
- FIN-D2 final sign-off: fee = 0.
- SePay statement/API availability for phase 2 reconciliation.
- Whether post-completion refunds exist; if yes, define the automatic reversal trigger
  or keep it Admin-only.
