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
| POST | `/top-ups/:id/manual-match` | Match provider evidence to the selected locked intent |
| POST | `/top-ups/manual-match` | Explicit transfer without an intent; reject if a matching pending intent exists |
| GET | `/payouts?status=&requestType=&userId=&from=&to=&page=&limit=` | Payout list (paginated) |
| GET | `/payouts/:id` | Payout detail with masked bank account and hold |
| POST | `/payouts/:id/approve` | Approve |
| POST | `/payouts/:id/reject` | Reject with reason |
| POST | `/payouts/:id/paid` | Mark paid with transfer reference |

Payout auto-approval is controlled by `WALLET_AUTO_APPROVE_PAYOUTS` (finance domain,
default `true`). When `false`, `WalletPayoutService.createRequest` leaves every
request `PENDING` and notifies Admins. In both modes a manual bank transfer and
`mark paid` with a transfer reference are still required.
| GET | `/refunds?status=&paymentId=&userId=&from=&to=&page=&limit=` | Refund queue |
| GET | `/refunds/:paymentId` | Refund detail |
| POST | `/refunds/:paymentId/retry` | Controlled retry |
| POST | `/refunds/:paymentId/resolve-note` | Record manual resolution note |
| GET | `/owner-earnings?ownerId=&status=&from=&to=&page=&limit=` | Owner earnings list |
| POST | `/owner-earnings/sweep` | Admin-triggered bounded sweep |
| POST | `/owner-earnings/:bookingId/reverse` | Exceptional reversal with reason |
| GET | `/owner-earning-settlements?status=&ownerId=&from=&to=&page=&limit=` | Settlement queue (manual approval) |
| GET | `/owner-earning-settlements/:id` | Settlement detail |
| POST | `/owner-earning-settlements/:id/approve` | Approve and credit Owner wallet |
| POST | `/owner-earning-settlements/:id/reject` | Reject with mandatory reason |
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

> The primary trigger is the successful payment transaction. The sweep is a safety
> net for paid bookings that missed the immediate trigger; it no longer waits for
> `COMPLETED`.

1. Select eligible bookings (immediate trigger after payment, sweep as catch-up):
   - `payments.status = 'SUCCESS'`
   - `bookings.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')`
   - `bookings.total_amount > 0`
   - no existing ledger entry with `entry_type = 'OWNER_EARNING'` and
     `reference_type = 'BOOKING'`, `reference_id = bookings.id`
   - no existing `OWNER_EARNING_SETTLEMENTS` row for the booking
   - bounded by sweep range/limit
2. Resolve facility Owner via `bookings → courts → facilities.owner_id`.
3. Read `OWNER_EARNING_AUTO_CREDIT_ENABLED` through `financeConfig`.
   `PaymentService` calls `settleBooking` inside the wallet/mock payment transaction
   after confirmation, and skips it when confirmation requested a refund.
4. **Auto mode (`true`)**: in one transaction, credit the Owner wallet and insert
   `OWNER_EARNING_SETTLEMENTS` with `status='CREDITED'`, `mode='AUTO'` and the ledger
   entry id. Credit uses `WalletService.credit`:
   `entryType = 'OWNER_EARNING'`, `referenceType = 'BOOKING'`,
   `referenceId = booking.id`, `idempotencyKey = owner-earning:<bookingId>`,
   `description = 'Doanh thu booking <bookingCode>'`.
5. **Manual mode (`false`)**: in one transaction, insert a settlement with
   `status='PENDING'`, `mode='MANUAL'` without touching the ledger, then notify active
   Admins (`ADMIN_OWNER_EARNING_PENDING`, dedup `admin-owner-earning:<bookingId>`).
6. If the unique idempotency key or settlement booking id already exists (for example,
   two concurrent sweeps), treat the booking as `skipped` instead of failing the run.
   A pre-existing `PENDING` settlement is never auto-credited.
7. Record a `finance_audit_events` row for the sweep (one per run, with counts) and
   per-booking failures in the run result; do not fail the whole batch for one
   booking.
8. Return `{ scanned, credited, pending, skipped, failed }`.

The periodic job is always started unless the infrastructure kill-switch
`OWNER_EARNING_JOB_ENABLED` is `false` (default `true`). It reads the finance config at
each run, so switching between auto and manual does not require a deploy. The
Admin-triggered endpoint runs the same service for a bounded range.

Manual approval:

1. Lock the settlement row `FOR UPDATE`.
2. `CREDITED` returns the row unchanged (idempotent approve); `REJECTED` returns 409.
3. Re-check booking is still active (`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`) and has a
   `SUCCESS` payment; fail closed otherwise.
4. Credit the Owner wallet with the same `owner-earning:<bookingId>` idempotency key.
5. Update the settlement to `CREDITED` with ledger id, `decided_by`, `decided_at`.
6. Record `OWNER_EARNING_APPROVE` in `finance_audit_events`.

Reject requires a reason, only transitions `PENDING → REJECTED`, writes no ledger
entry, and records `OWNER_EARNING_REJECT`.

Refund handling:

- `RefundService` calls `handlePaymentRefund` in the same refund transaction.
- `PENDING` → `REJECTED` automatically.
- `CREDITED` → debit `OWNER_EARNING_REVERSAL` with idempotency
  `owner-earning-reversal:<bookingId>` when available balance covers the amount.
- Insufficient Owner balance: Player refund still commits and Admins receive
  `ADMIN_OWNER_EARNING_REVERSAL_FAILED` for manual handling.

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
| Payment | `SUM(payments.amount WHERE paid_at IS NOT NULL AND status IN ('SUCCESS','REFUND_PENDING','REFUNDED','REFUND_FAILED'))` | `SUM(ledger.amount WHERE entry_type='PAYMENT')` |
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
   - A report-specific data sheet containing only the data table: header at row 1, records from row 2, one frozen header row and the first frozen column; autofilter covers the actual table. Report title, summary metrics, totals, filters, export metadata and notes live exclusively on `Tổng hợp`.
   - Green headers, alternating rows, semantic status colors, and an explicit empty state. Backend-calculated totals remain on `Tổng hợp`; do not add a total/footer block to the data sheet or sum running balances/heterogeneous reconciliation deltas.
3. Amounts remain numeric with a VND format (negative amounts in red, zero shown as a dash). Excel date serials store Vietnam wall-clock time and display `dd/mm/yyyy hh:mm`; date-only group keys display `dd/mm/yyyy`. Daily revenue/cash-flow rows show newest days first. Print in landscape, one page wide with the table header repeated; height is not capped to one page for long exports.
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
| `/admin/finance/owner-earnings` | Owner/period filter, sweep trigger, pending approvals (auto-credit toggle off) |
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

- FIN-D1 final sign-off: Owner earning at payment `SUCCESS` (accepted 2026-11-19) versus a T+N hold.
- FIN-D2 final sign-off: fee = 0.
- SePay statement/API availability for phase 2 reconciliation.
- Whether post-completion refunds exist; if yes, define the automatic reversal trigger
  or keep it Admin-only.

### Finance table and filter presentation — 2026-11-21

- Finance tables opt into the shared DataTable scroll region: maximum height `min(60svh, 36rem)`, horizontal overflow when needed, an opaque sticky header, and keyboard focus. Pagination remains outside the scroll region. Other Admin tables retain their existing scroll behavior. Finance column headers, amounts, dates and action labels do not break across lines.
- Column names, enum labels, navigation, reconciliation explanations and structured transaction/audit details use Vietnamese display labels. API enum values, identifiers, email addresses, provider names and original free-text notes remain intact. Times display in `Asia/Ho_Chi_Minh`; monetary values use Vietnamese formatting.
- Overview, revenue reports and reconciliation expose existing range presets plus an explicit custom-date form (inclusive, up to 366 days). Preset controls appear only for endpoints supporting them.
- Paginated lists expose existing API filters through an expandable detail form with Apply/Clear: dates and user ID for transactions/top-ups/payouts/refunds, provider for top-ups, request type for payouts, payment ID for refunds, amount bounds and reference type/ID for transactions, dates/owner ID for both owner-income views, and dates/actor/object for audit. Existing status/source/action selectors remain available. Applied filters reset pagination to page 1 and are forwarded to applicable Excel exports. Wallet history retains the API's user lookup and pagination; no unsupported server filters or sorting are introduced.
- Reconciliation can filter the complete returned discrepancy set by type locally; its existing summary and truncation indicator remain visible.
- Filter controls remain available while lists load or fail. Detailed fields stack on narrow screens and use two/four columns on larger screens. Verification uses mocked API contracts at 390/1280 px; per-run screenshots stay in `/tmp`.

Verification: frontend build and lint/check:ui PASS; 48 mocked-API regression tests PASS (finance, users, facilities), followed by 3 focused scroll/header/export checks PASS after final adjustments. This is frontend/API-contract verification, not a new live payment or database integration run.

### Wallet account typeahead — 2026-11-21

`/admin/finance/wallets` uses the existing Admin user search endpoint (`GET /api/v1/admin/users?search=&page=1&limit=8`). Search waits 300 ms after at least two trimmed characters; results show the profile name, email, user ID and translated role. Existing player/owner/admin wallet access is preserved. Selecting a suggestion loads that user's wallet and resets the ledger to page 1; entering a positive safe integer and submitting retains direct lookup by user ID. Typing a name/email never sends it as a wallet ID.

The combobox supports Arrow Up/Down, Enter, Escape, pointer/touch selection, loading/empty/error states and retry. Clearing or editing invalidates the selected account and disables credit/debit until the new wallet is loaded. Late search/wallet responses cannot restore a previous account. The search toolbar remains mounted during wallet loading/errors. No backend, authorization or wallet mutation contract changes are introduced.

### Finance pagination presentation — 2026-11-21

All finance tables use the existing Admin `TablePagination` footer: 10/20/50 rows (default 10), localized total count, numbered pages and previous/next controls. The footer remains visible for single-page/empty results and outside the table scroll region. Changing page size resets to page 1; source/status/detail filters remain applied. Owner-income tab changes reset to page 1.

Transactions, wallet entries, top-ups, payouts, refunds, both owner-income views and audit send page/limit to their existing APIs. Overview trends, revenue report groups and the returned reconciliation result set paginate locally without refetching or changing aggregate totals; reconciliation filters apply before pagination. Overview pagination replaces the previous last-14-days display cap, allowing all returned days to be inspected. Export scope remains all matching records, independent of the displayed page.

### Pre-commit review fixes — 2026-11-21

Finance reads now ignore stale successes, failures and completion states after filters, pagination, wallet selection or sections change. Post-mutation refreshes use the current view and become no-ops after unmount. Transaction detail has inline loading/error states and cannot reopen after closing or changing the list. Returning to a section restores any applied detailed-filter fields, and the pending owner-income tab displays the API total rather than the current page length.

Localized detail rendering translates only recognized enum/date fields; notes, transaction references and numeric identifiers retain their original content. Display dictionaries use own-key lookup so unknown values such as `constructor` render safely. The wallet suggestion popover treats its lookup button as part of the search interaction, allowing a highlighted suggestion to be selected by the button as well as Enter.

Review verification: 97 UI contract tests across the six affected Admin specs PASS; 6 focused final checks PASS (including the additional typeahead-button test). Both backend integration suites PASS: 25 tests on badminton_test, including sorting and validation. Frontend/backend builds, frontend lint/check:ui and diff whitespace checks PASS; existing lint and bundle-size warnings remain. No commit or push was performed.

### Finance correctness follow-up — 2026-11-22

User-approved repair scope: preserve the existing payout auto-approval decision and manual recovery policy.

- Manual matching uses the URL intent id, validates provider/user/amount, and never creates another intent when that id is absent or invalid. The separate collection endpoint creates `MANUAL-…` only when no matching pending intent exists. Repeated evidence is serialized with a transaction advisory lock; migration 0029 enforces unique non-null `(provider, provider_transaction_id)` across webhook/manual completion. Each path uses `wallet-topup:<id>`. Provider evidence must use the provider transaction identity (SePay bank webhook `id`, falling back to `referenceCode` when `id` is absent).
- Reconciliation includes `WALLET_SPLIT` in payment/refund totals and checks total and per-member ledger amounts. Paid payment history remains eligible after refund transitions.
- Outstanding Owner recovery is derived from durable refunded payments and Owner earning ledger entries without reversal, independent of the selected date range. `OWNER_EARNING_REVERSAL_PENDING:<bookingId>` remains visible until a reversal posts. Admin retries the existing reversal endpoint with a reason; insufficient attempts are audited. Notes do not settle the debt. There is no automatic retry, negative wallet balance, or new earning-settlement status.
- Finance mutation errors stay in their dialog or use an error toast; page-load errors own the full-page empty state. Financial input dialogs use react-hook-form/zod and reject thousands separators. Manual matching can be opened directly from a pending top-up row.
- Regression checks cover manual replay/concurrency/late callback, split reconciliation and insufficient Owner recovery followed by concurrent manual retries. Frontend coverage includes selected-intent payloads, invalid amount formatting, action failures preserving the table and explicit recovery actions.

Verification (2026-11-22): 36 backend tests pass across Finance Admin, Owner settlements, wallet top-ups and payouts; includes a signed SePay webhook racing manual matching and per-member split mismatches with correct aggregate totals. 108 mocked-browser checks pass across Finance, Dashboard, Reports, Match booking, Owner schedule/history and Player wallet, plus 2 Finance flows with a real backend on `badminton_test`. The UI checks include 390/1280 px, Popover focus/Escape, populated Recharts and 500-character refund notes. Backend/frontend builds, frontend lint/check:ui and migration consistency pass (lint retains existing warnings). Migration 0029 applied to local dev and test after dev preflight found zero duplicate provider identities. No financial records were edited in dev, no payout-default change, and no commit/push. Build retains the existing main-bundle size warning; Admin pages now have separate lazy chunks. Shared schema/architecture changes still require teammate PR review before merge under AGENTS.md.

### Correctness review — 2026-11-22

Revenue grouped by Owner includes every Owner with payments, refunds or earning ledger entries in the selected period. An Owner with only a refund or settlement in that period still has a row; missing gross revenue is zero. Manual-match transfer times accept minutes or seconds and are interpreted in `Asia/Ho_Chi_Minh`.

### Transaction display identity — 2026-11-27

`GET /api/v1/admin/finance/transactions` additionally returns nullable `userName` and `userEmail` per row, resolved by left joins on the existing user ID and Player/Owner profiles. Names use the Player full name or Owner business name; accounts without a profile still expose their email. IDs, filtering, ordering and pagination remain unchanged. The Admin transaction table shows name with email underneath, falls back to email, then the user ID if neither is available. `TOURNAMENT_REGISTRATION` remains the stored reference code; its display label is “Đăng ký giải đấu #<id>”. No migration is required.

### Finance list identities — 2026-11-27

The same display convention applies across Admin Finance. Top-up/payout/refund lists add nullable `userName`/`userEmail`; Owner earning and settlement lists add `ownerName` alongside `ownerEmail`; wallet entries and audit lists add `actorName`/`actorEmail`. Wallet snapshots include `user.userName`. Revenue rows grouped by Owner add `ownerName`/`ownerEmail` while retaining the original key/label; reconciliation WALLET discrepancies add `userName`/`userEmail` using the wallet's user ID. Other discrepancy references retain their entity identifiers.

Services enrich each returned page via one batched, read-only identity query, skipping empty ID sets. Player full name and Owner business name use the existing profile tables, with email fallback. No new HTTP requests, schema migrations, monetary mutations, filtering/grouping/pagination changes or Excel export changes are introduced. IDs remain available for commands and traceability; missing identities retain an ID fallback. Wallet entries without an actor display “Hệ thống”. Admin accounts without a profile display email.

### Approved Excel template rollout — 2026-11-27

The preview template approved by the user is applied to all seven Finance export types through `finance-export-template.ts`; the later user refinement places all overview content on `Tổng hợp` only. No preview/sample data is included. Each workbook retains its `Tổng hợp` sheet, opens on the report data sheet, and records the same applied filters, actual exported row count and totals. Summary metrics use the existing totals rather than inventing new accounting indicators. Names/emails are resolved in one batched identity lookup for recipients, operators and wallet discrepancies; stable IDs remain in the same cells (or existing reference columns) for traceability. Labels and known enum/reference codes are Vietnamese; unknown values remain readable. Source data grouping/calculation, list filtering, row cap, access control, Excel text protection, bank data exposure and one-successful-export audit behavior remain unchanged. Sheet `Payout` is renamed `Chi trả`; data rows start at 2, with the table header at row 1. External spreadsheet consumers must account for the new layout. Backend-calculated summary totals describe the exported scope and are independent of Excel's local filter visibility.

Verification includes workbook readback for every type, empty exports, numeric amounts and summary contents, negative reconciliation deltas, Vietnam timestamps, text formula protection, owner grouping, daily ordering and over-cap/unsupported failures. The real API download is checked against the separate test database. LibreOffice print previews are generated in `/tmp`, outside maintained source.
