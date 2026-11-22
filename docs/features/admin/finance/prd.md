# Product Requirements Document (PRD) - Admin Finance Management (Quản lý tài chính Admin)

## Status and Ownership

```text
Status: Implemented P0 (2026-11-19)
Owner: PM / Platform Team
Fulfills: PROJECT-BRIEF.md §4 (Admin); 2026-11-08 platform wallet scope decision
Scope: Admin-only finance console — overview, unified transaction ledger, wallets,
       top-ups, payouts, refunds, owner earnings settlement, reconciliation,
       operational revenue reports, Excel export, and finance audit.
```

This PRD defines product behavior and business rules only. It does not define API
contracts, database schema, queries, or implementation structure; those live in
`tech-design.md`, which must not override this document.

> **Implementation status.** No Admin Finance Management production behavior exists
> yet beyond the wallet/payout/refund operations delivered by
> `docs/plans/03_thanh-toan-hoan-tien.md` and the operational alerts delivered by
> `docs/plans/13_thong-bao-van-hanh-admin.md`. The frontend for this feature is a
> **base implementation only**; every screen is marked **UI-REDO** and must be
> reworked after the parallel frontend merge. The base must be sufficient to test
> flows and business rules end-to-end.

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §4, §5, §6
- Payment/wallet scope and decisions: `docs/features/platform/payments-refunds/prd.md`
- Wallet ledger schema: `docs/architecture/database-schema.md` §3.10 `PAYMENTS`,
  §3.34 `WALLET_ACCOUNTS`, §3.35 `WALLET_LEDGER_ENTRIES`, §3.36 `WALLET_HOLDS`,
  §3.37 `WALLET_TOP_UPS`, §3.38 `PAYMENT_REFUNDS`, §3.39 `WALLET_BANK_ACCOUNTS`,
  §3.40 `WALLET_PAYOUT_REQUESTS`
- Dashboard revenue definition: `docs/features/admin/dashboard/prd.md` §7, §14
  (estimated transaction value, not accounting-grade revenue)
- Refund rules: `docs/business-rules-config-matrix.md` §2.8
- Architecture/API conventions: `docs/architecture/conventions.md`,
  `docs/architecture/frontend.md`
- Implementation plans:
  - `docs/plans/03_thanh-toan-hoan-tien.md` (wallet, top-up, refund, payout)
  - `docs/plans/12_rut-vi-tu-dong-sepay-bankhub.md` (dev/demo payout settlement)
  - `docs/plans/13_thong-bao-van-hanh-admin.md` (finance alerts, Admin wallet UI)
  - `docs/plans/14_quan-ly-tai-chinh-admin.md` (delivery plan)

## Related Documents

- PRD: this document
- Tech Design: [tech-design.md](tech-design.md)
- Task List: [tasks.md](tasks.md)
- Delivery plan: `docs/plans/14_quan-ly-tai-chinh-admin.md`

## 1. Problem

- **Who is affected:** Admins responsible for the platform-wide wallet, payment,
  refund, and payout operation.
- **What is difficult or unavailable today:**
  - Money movements exist in several tables (`PAYMENTS`, `WALLET_LEDGER_ENTRIES`,
    `WALLET_TOP_UPS`, `WALLET_PAYOUT_REQUESTS`, `PAYMENT_REFUNDS`) but there is no
    unified, filterable transaction view.
  - Admin can approve/reject/mark payouts and adjust wallets, but cannot inspect a
    user's wallet, ledger history, holds, and related booking in one place.
  - Refunds are visible as a failed-refund queue but there is no controlled retry
    or manual resolution workflow.
  - Reconciliation only returns a few totals and unmatched IDs; there is no
    discrepancy workflow, no persisted run, and no export.
  - Reports are limited to estimated revenue on the dashboard (not yet implemented);
    there is no cash-flow view or operational finance report.
  - Court Owners have no earnings source: booking payment debits the Player wallet
    but never credits the facility Owner wallet, so `OWNER_PAYOUT` requests can only
    draw from funds manually credited by an Admin.
- **Why it matters within MVP:** `PROJECT-BRIEF.md` §4 states that Admin manages
  platform payments and the virtual wallet. Without an Admin finance console, the
  wallet-first model cannot be operated safely or audited.

## 2. Goals

- Give Admin one console to monitor and operate platform money.
- Provide a unified, filterable transaction ledger with links to the owning
  booking/registration/user and an Excel export.
- Let Admin inspect any user's wallet (balance, held, available, ledger, holds).
- Let Admin operate top-up, payout, and refund exceptions with explicit states,
  reasons, and audit.
- Settle Court Owner earnings from completed paid bookings into the Owner wallet.
- Provide reconciliation between provider intents, internal ledger, and wallet
  balances, with a discrepancy workflow.
- Provide operational cash-flow and revenue reports, clearly labelled as estimates
  where applicable, and export them to Excel.
- Keep every money-changing Admin action attributable and append-only auditable.

## 3. Non-Goals

The following are explicitly out of scope for this PRD and the MVP:

- Accounting-grade revenue, statutory reporting, tax, invoices, or double-entry
  general ledger.
- Multi-tier Admin, Super Admin, or advanced RBAC. The only actor is `ADMIN`.
- Real bank transfer execution; payout remains Admin-approved manual transfer.
- Split Bill, escrow, or platform lending/credit.
- Provider payout automation in production. The SePay Bank Hub demo remains
  governed by `docs/plans/12_rut-vi-tu-dong-sepay-bankhub.md`.
- Tournament/organizer settlement in phase 1; tournament payments are included
  once `TRN-05` exists (phase 2).
- Charging a platform fee. The MVP keeps fee = 0 (G0 D9).
- User-facing finance screens. This feature is Admin-only.
- Business intelligence, custom report builder, or data warehouse.

## 4. Scope

### In Scope

1. **Finance overview** — KPI cards and simple trends for wallet liability, cash in,
   cash out, refunds, gross revenue, and reconciliation discrepancies.
2. **Unified transaction ledger** — money movements across top-ups, payments,
   refunds, withdrawals/payouts, owner earnings, and Admin adjustments, with filters,
   pagination, detail view, and Excel export.
3. **Wallet management (Admin)** — search a user, view balance/held/available,
   ledger history, active holds, and perform credit/debit with mandatory reason.
4. **Top-up monitoring** — list and inspect top-up intents by provider/status/time;
   support manual matching when a provider transfer is missing its webhook.
5. **Payout management** — list/detail, approve/reject/mark paid, bank account and
   hold context, transfer reference, and audit.
6. **Refund management** — queue by status, inspect failure reason/attempts, retry
   within a controlled bound, and record manual resolution notes.
7. **Owner earnings settlement** — credit the facility Owner wallet immediately when
   a booking payment succeeds, idempotently; support automatic refund reversal.
8. **Reconciliation** — compare top-up/payment/refund/payout intents with ledger
   entries, wallet balances, and Owner earnings; list discrepancies and resolve them
   with a note.
9. **Operational reports** — cash-flow report and internal revenue report by period,
   source, and Owner; export to Excel.
10. **Excel export** — server-generated `.xlsx` for transactions, top-ups, payouts,
    refunds, revenue, cash flow, and reconciliation.
11. **Finance audit** — append-only audit of export, payout actions, wallet
    adjustments, refund retries, owner settlement sweeps, and reconciliation
    resolutions.
12. **Configuration** — reuse existing refund settings; no new fee/limit keys in MVP.

### Out of Scope

- All items in §3.
- Persisted provider statement import (phase 2).
- Async/background export jobs (phase 2; phase 1 is synchronous with a row cap).
- Maker-checker / dual approval (phase 2).
- Accounting period close, journals, trial balance.

## 5. Target Users and Roles

| Role | Access |
| --- | --- |
| `ADMIN` | Full access to every screen and endpoint in this PRD. |
| `PLAYER` | No access. Sees only their own wallet in the existing Player wallet screen. |
| `COURT_OWNER` | No access. Sees only their own wallet/payout screens. |

No new system role is introduced. Contextual permission (Tournament Organizer) does
not grant any finance access.

## 6. User Journeys

1. **Daily monitoring** — Admin opens `/admin/finance`, reviews KPI cards and
   discrepancies, filters the last 7 days, then exports the transaction ledger.
2. **Investigate a wallet** — Admin searches a user, opens the wallet detail, reviews
   balance/held/available, ledger entries, holds, and related bookings, then applies a
   credit/debit with a reason.
3. **Top-up exception** — Admin filters pending/expired top-ups, opens one, compares
   provider reference/amount to the ledger, and records a manual match or notes a
   mismatch for reconciliation.
4. **Payout operation** — Admin opens the payout queue, inspects bank account/hold,
   approves or rejects with a reason, then after the bank transfer marks it paid with
   the transfer reference.
5. **Refund exception** — Admin opens failed refunds, reviews the last error, retries
   within the allowed limit, and records the outcome.
6. **Owner settlement check** — Admin filters Owner earnings by Owner/period, confirms
   each completed paid booking has exactly one earning entry, and sees the Owner payout
   draw from that balance.
7. **Reconciliation** — Admin runs reconciliation for a period, reviews discrepancies
   by type, opens the related records, resolves each with a note, and exports the run.
8. **Report/export** — Admin selects cash-flow or revenue, chooses a period and group
   by, previews totals, and downloads an Excel workbook.

## 7. Functional Requirements

### 7.1 Finance Overview

- **FR-FIN-01:** The system can show only `ADMIN` a finance overview for a selected
  range (`today`, `7d`, `30d`, `this_month`, or a custom bounded range).
- **FR-FIN-02:** The overview can show: total wallet balance, total held, cash in,
  cash out, refunds, gross payment revenue, net estimated revenue, Owner earnings,
  pending payouts, failed refunds, and reconciliation discrepancy count.
- **FR-FIN-03:** The overview can show a simple daily trend for cash in, cash out, and
  gross revenue without adding a charting library (base UI may use text/table).
- **FR-FIN-04:** Empty periods show zero/empty states, never fabricated data.

### 7.2 Unified Transaction Ledger

- **FR-FIN-05:** The system can list money movements from all finance sources in one
  paginated view, newest first, with a stable tie-break.
- **FR-FIN-06:** The ledger can be filtered by source/type, status, user, reference
  type/id, amount range, and time range.
- **FR-FIN-07:** Each row can show: timestamp, source, type, status, user, amount,
  balance after (where applicable), reference, description, and actor.
- **FR-FIN-08:** The system can show a transaction detail with related user, booking or
  registration, payment, refund, payout, top-up, hold, idempotency key, and audit
  events.
- **FR-FIN-09:** The ledger can be exported to Excel with the active filters.

### 7.3 Wallet Management

- **FR-FIN-10:** Admin can search a user by id/email/name and open the wallet detail.
- **FR-FIN-11:** The wallet detail can show balance, held, available, ledger entries,
  active holds, payout requests, and top-up history.
- **FR-FIN-12:** Admin can credit or debit a wallet with a mandatory reason.
- **FR-FIN-13:** A debit cannot make available balance negative.
- **FR-FIN-14:** Every adjustment creates exactly one ledger entry and one finance
  audit event with the Admin actor.

### 7.4 Top-up Monitoring

- **FR-FIN-15:** Admin can list top-ups by status (`PENDING`, `SUCCESS`, `FAILED`,
  `EXPIRED`), provider, user, and time range.
- **FR-FIN-16:** Admin can inspect provider reference, amount, status, paid time, and
  the matching ledger entry.
- **FR-FIN-17:** Admin can record a manual match for a provider transfer that has no
  successful top-up intent. The match must include provider evidence (provider
  reference, amount, transfer time) and a reason, must be idempotent by provider
  reference, and must be auditable. It is not a free-form wallet credit; if no intent
  exists, the system records an explicit manual top-up linked to the provider
  reference.
- **FR-FIN-18:** Admin cannot silently change a `SUCCESS` top-up amount or delete a
  top-up.

### 7.5 Payout Management

- **FR-FIN-19:** Admin can list payouts by status, type (`WITHDRAWAL`,
  `OWNER_PAYOUT`), user, and time range, with pagination.
- **FR-FIN-20:** Admin can inspect bank account (masked), amount, hold, requester,
  reviewer, notes, transfer reference, and timestamps.
- **FR-FIN-21:** Admin can approve or reject a `PENDING` payout; reject requires a
  reason and releases the hold.
- **FR-FIN-22:** Admin can mark an `APPROVED` payout as `PAID` only with a non-empty
  bank transfer reference; mark-paid captures the hold and writes exactly one ledger
  entry.
- **FR-FIN-23:** Payout actions are idempotent and cannot regress a terminal state.

### 7.6 Refund Management

- **FR-FIN-24:** Admin can list refunds by status (`PENDING`, `PROCESSING`,
  `REFUNDED`, `FAILED`), payment, user, and time range.
- **FR-FIN-25:** Admin can inspect the refund amount, reason, attempts, last error,
  related booking/registration, and ledger entry.
- **FR-FIN-26:** Admin can retry a `FAILED` refund within the configured attempt
  policy; retry is idempotent and cannot create a second refund credit.
- **FR-FIN-27:** Admin can record a manual resolution note without mutating ledger
  entries directly; any correction uses a wallet adjustment with a reason.
- **FR-FIN-28:** Refunds always credit the wallet, never the original funding source.

### 7.7 Owner Earnings Settlement

- **FR-FIN-29:** The system credits the facility Owner as soon as a booking payment is
  `SUCCESS` and the booking is still active (`CONFIRMED`, `IN_PROGRESS`, or
  `COMPLETED`). The periodic sweep only catches paid bookings that missed this
  immediate trigger.
- **FR-FIN-30:** The system can credit the facility Owner wallet with the booking
  `totalAmount` for each such booking, exactly once, using an idempotency key
  `owner-earning:<bookingId>`.
- **FR-FIN-31:** Owner earnings use a dedicated ledger entry type (`OWNER_EARNING`);
  they are not `ADMIN_ADJUSTMENT`, `PAYMENT`, or `PAYOUT`.
- **FR-FIN-32:** Unpaid, refunded, cancelled, or not-completed bookings never produce
  Owner earnings.
- **FR-FIN-33:** Admin can trigger an Owner earnings sweep for a bounded period and
  see how many bookings were credited, skipped, or failed.
- **FR-FIN-34:** An exceptional post-completion reversal uses
  `OWNER_EARNING_REVERSAL` and requires an Admin reason. If the Owner wallet cannot
  cover the reversal, the system records the failure and does not force a negative
  balance; the case goes to reconciliation/manual handling.
- **FR-FIN-30a:** Admin can enable or disable automatic Owner earning credit through
  the System Configuration key `OWNER_EARNING_AUTO_CREDIT_ENABLED` (default `true`).
- **FR-FIN-30b:** When automatic credit is disabled, each successful eligible payment
  creates a `PENDING` Owner earning settlement immediately and no wallet balance
  changes. Admin must approve the settlement before the Owner wallet is credited;
  rejecting it produces no credit.
- **FR-FIN-30c:** Approving a settlement credits the Owner wallet exactly once with
  `OWNER_EARNING`; approval is idempotent and re-checks that the booking is still
  active and its payment is still `SUCCESS`.
- **FR-FIN-30d:** Turning automatic credit back on does not auto-credit existing
  `PENDING` settlements; Admin still decides each one.
- **FR-FIN-30e:** When a payment is refunded, a `PENDING` settlement is rejected
  automatically and a `CREDITED` earning is reversed with
  `OWNER_EARNING_REVERSAL` when the Owner wallet has enough available balance. If it
  does not, the Player refund still succeeds and Admin is alerted for manual handling.
- **FR-FIN-35:** Platform fee is 0 in MVP; the earning amount equals the booking
  `totalAmount`.

### 7.8 Reconciliation

- **FR-FIN-36:** Admin can run reconciliation for a selected range.
- **FR-FIN-37:** Reconciliation checks at least:
  - `TOP_UP SUCCESS` totals versus `TOP_UP` ledger entries.
  - `PAYMENT SUCCESS` totals versus `PAYMENT` ledger entries.
  - `PAYMENT_REFUNDS REFUNDED` totals versus `REFUND` ledger entries.
  - `PAYOUT PAID` totals versus `WITHDRAWAL`/`PAYOUT` ledger entries.
  - Paid completed bookings versus `OWNER_EARNING` entries.
  - Each wallet balance versus the sum of its ledger entries.
  - Active hold totals versus available-balance derivation.
- **FR-FIN-38:** Reconciliation returns a list of discrepancies with type, entity,
  expected value, actual value, and a stable key.
- **FR-FIN-39:** Admin can resolve a discrepancy with a note; resolution is audited.
  Resolution does not mutate ledger entries.
- **FR-FIN-40:** Reconciliation results can be exported to Excel.

### 7.9 Reports

- **FR-FIN-41:** The system can produce a cash-flow report: top-up cash in, payout cash
  out, and net cash movement for the range.
- **FR-FIN-42:** The system can produce an internal revenue report: gross successful
  payments, refunds, net estimated, and Owner earnings, grouped by day, source
  (booking/registration), or Owner.
- **FR-FIN-43:** Revenue values are labelled as estimates and are not presented as
  accounting or settlement figures.
- **FR-FIN-44:** Reports respect `Asia/Ho_Chi_Minh` and half-open intervals
  `[start, end)`.

### 7.10 Excel Export

- **FR-FIN-45:** Admin can export transactions, top-ups, payouts, refunds, revenue,
  cash flow, and reconciliation to a real `.xlsx` file.
- **FR-FIN-46:** Exports use the same filters and definitions as the on-screen view.
- **FR-FIN-47:** Each workbook contains a summary sheet (filters, generator, time,
  timezone, row count, totals) and a data sheet.
- **FR-FIN-48:** Empty exports produce a workbook with headers and zero totals, not an
  error.
- **FR-FIN-49:** Exports are capped; over-cap requests fail with a clear error asking
  the Admin to narrow the filter.
- **FR-FIN-50:** Each export creates a finance audit event with actor, type, filters,
  and row count; the file is not persisted server-side.
- **FR-FIN-51:** Export cells must not execute as formulas; text values beginning with
  `=`, `+`, `-`, or `@` are escaped.

### 7.11 Audit and Security

- **FR-FIN-52:** Only `ADMIN` can access finance endpoints and screens.
- **FR-FIN-53:** Every money-changing or export action records the Admin actor, action,
  entity, metadata, and timestamp in an append-only finance audit.
- **FR-FIN-54:** Ledger entries remain append-only; no API updates or deletes them.
- **FR-FIN-55:** Responses and logs never include provider secrets, webhook
  signatures, or full bank account numbers (mask to last 4 characters).
- **FR-FIN-56:** The system enforces a per-Admin export rate limit.

## 8. Business Rules

### 8.1 Money and ledger invariants

1. `WALLET_LEDGER_ENTRIES` is the source of truth for wallet balance changes. Every
   balance change writes exactly one ledger entry in the same database transaction.
2. `WALLET_ACCOUNTS.balance` includes held funds. Available balance is
   `balance - SUM(WALLET_HOLDS.amount WHERE status = 'HELD')`.
3. Ledger entries are append-only. Corrections use a new entry with a reason.
4. Amounts are VND with up to two decimals, stored as `numeric(14,2)`; no negative
   wallet balance is allowed.
5. Idempotency keys are unique per user when present. Replays return the existing
   result and never duplicate money movement.
6. Provider calls are never made inside a database transaction that also mutates the
   ledger; claim/commit/confirm patterns are reused from the existing payment code.

### 8.2 State machines

| Entity | States | Allowed transitions |
| --- | --- | --- |
| Top-up | `PENDING`, `SUCCESS`, `FAILED`, `EXPIRED` | `PENDING → SUCCESS/FAILED/EXPIRED`; terminal states never reopen |
| Refund | `PENDING`, `PROCESSING`, `REFUNDED`, `FAILED` | `PENDING → PROCESSING → REFUNDED/FAILED`; `FAILED → PROCESSING` only by controlled retry |
| Payout | `PENDING`, `APPROVED`, `REJECTED`, `PAID`, `FAILED` | `PENDING → APPROVED/REJECTED`; `APPROVED → PAID`; `PAID` terminal |
| Owner earning | `EARNED`, `REVERSED` (represented by ledger entry types) | `EARNED → REVERSED` only by Admin action with reason |

### 8.3 Owner earnings

1. Eligibility: booking has a successful wallet payment, is in `COMPLETED` status, and
   belongs to a court/facility with an Owner.
2. Amount: booking `totalAmount`; platform fee is 0.
3. Credit target: facility Owner's wallet.
4. Idempotency: `owner-earning:<bookingId>`; at most one earning entry per booking.
5. Timing: available immediately after the settlement sweep; no T+N hold in MVP.
6. Reversal: `OWNER_EARNING_REVERSAL` with a mandatory reason; never force a negative
   balance. If funds are insufficient, the sweep/reversal fails and is reported for
   manual handling.
7. Tournament/organizer earnings are out of scope until tournament payments exist.

### 8.4 Reporting definitions

| Metric | Definition |
| --- | --- |
| Cash in | `SUM(WALLET_TOP_UPS.amount)` where `status = 'SUCCESS'` and `paid_at` in range |
| Cash out | `SUM(WALLET_PAYOUT_REQUESTS.amount)` where `status = 'PAID'` and `paid_at` in range |
| Gross payment revenue | `SUM(PAYMENTS.amount)` where `status = 'SUCCESS'` and `paid_at` in range; booking + registration |
| Refunds | `SUM(PAYMENT_REFUNDS.amount)` where `status = 'REFUNDED'` and `completed_at` in range |
| Net estimated revenue | gross payment revenue − refunds, with the caveat that refunds may relate to earlier periods |
| Owner earnings | `SUM(OWNER_EARNING) − SUM(OWNER_EARNING_REVERSAL)` in range |
| Wallet liability | snapshot `SUM(WALLET_ACCOUNTS.balance)` |
| Held | snapshot `SUM(WALLET_HOLDS.amount WHERE status = 'HELD')` |
| Pending payouts | snapshot count/amount of payouts in `PENDING` |
| Failed refunds | snapshot count/amount of refunds in `FAILED` |

All periods use `Asia/Ho_Chi_Minh` and half-open intervals `[start, end)`. Revenue is
labelled **estimate** and must not be described as accounting revenue or settlement.

### 8.5 Excel export rules

1. Format is Office Open XML (`.xlsx`), generated on the backend.
2. The export uses the same query/service as the screen, with identical filters.
3. Maximum rows per export: 20,000 in phase 1; over-cap returns a validation error.
4. Workbook contains a summary sheet and one data sheet.
5. Amounts use `#,##0`; dates use `dd/mm/yyyy hh:mm`; headers are frozen and
   auto-filter is enabled.
6. Bank account numbers are masked; text cells are protected against formula
   injection.
7. Exports are audited; files are streamed/downloaded and not stored server-side.
8. Export endpoints are rate-limited per Admin.

### 8.6 Audit

Every action in §7.11 writes `finance_audit_events` with:

- actor Admin id;
- action (`EXPORT`, `PAYOUT_APPROVE`, `PAYOUT_REJECT`, `PAYOUT_MARK_PAID`,
  `WALLET_CREDIT`, `WALLET_DEBIT`, `REFUND_RETRY`, `REFUND_RESOLVE`,
  `OWNER_EARNING_SWEEP`, `OWNER_EARNING_REVERSAL`, `RECONCILIATION_RESOLVE`,
  `TOP_UP_MANUAL_MATCH`);
- entity type/id (payout, refund, wallet/user, export, booking, top-up);
- metadata (filters, amounts, reason, previous/next state, row count);
- created timestamp.

Audit rows are never updated or deleted.

## 9. Acceptance Criteria

- **AC-01:** Only `ADMIN` can call finance endpoints; Player and Court Owner receive
  `403`; unauthenticated requests receive `401`.
- **AC-02:** The unified ledger returns the same amount for a top-up, payment, refund,
  payout, and adjustment as the owning table and the ledger entry.
- **AC-03:** Admin credit/debit creates exactly one ledger entry and one audit event;
  an over-balance debit is rejected.
- **AC-04:** Payout approve/reject/mark-paid obey the state machine; mark-paid without a
  transfer reference is rejected; reject releases the hold.
- **AC-05:** A failed refund retry produces at most one refund credit.
- **AC-06:** A completed paid booking produces exactly one `OWNER_EARNING` entry for the
  facility Owner; repeated sweeps do not duplicate it.
- **AC-07:** Reconciliation detects each seeded discrepancy type and reports zero
  discrepancies in a clean fixture.
- **AC-08:** Cash-flow and revenue reports return the §8.4 definitions and label
  revenue as an estimate.
- **AC-09:** Excel export downloads a valid `.xlsx`, contains the expected sheets and
  rows, respects filters, and writes one audit event.
- **AC-10:** Empty ranges return zero totals and empty states.
- **AC-11:** No finance response or log exposes a provider secret, signature, or full
  bank account number.
- **AC-12:** The base frontend lets an Admin exercise every P0 flow end-to-end, and all
  screens are marked **UI-REDO**.

## 10. Decision Log

Decisions below were accepted for implementation on 2026-11-19. Changing a decision
requires updating this PRD, the tech design, and the tasks.

| # | Decision | Choice | Date | Status |
| --- | --- | --- | --- | --- |
| FIN-D1 | Owner earnings model | Credit the facility Owner wallet immediately when payment is `SUCCESS` and the booking is still active, idempotent, amount = `totalAmount`, fee = 0 | 2026-11-19 | ACCEPTED (revised) |
| FIN-D2 | Platform fee | Keep 0 in MVP (G0 D9); no fee columns/UI | 2026-11-19 | ACCEPTED |
| FIN-D3 | Reporting depth | Phase 1 operational reports split into cash flow and internal revenue, labelled estimates; accounting-grade later | 2026-11-19 | ACCEPTED |
| FIN-D4 | Navigation | New `/admin/finance` module; keep `/admin/wallet/*` redirects preserving query params | 2026-11-19 | ACCEPTED |
| FIN-D5 | Reconciliation | Phase 1 internal provider-intent/ledger/balance checks; phase 2 SePay API or statement import | 2026-11-19 | ACCEPTED |
| FIN-D6 | Tournament finance | Phase 2 after `TRN-05`; phase 1 bookings only | 2026-11-19 | ACCEPTED |
| FIN-D7 | Excel export | Backend `exceljs`, synchronous phase 1, 20,000-row cap; async/streaming later | 2026-11-19 | ACCEPTED |
| FIN-D8 | Audit | New append-only `finance_audit_events`; ledger and payout columns alone are insufficient | 2026-11-19 | ACCEPTED |
| FIN-D9 | Frontend depth | Base UI only, sufficient for flow tests; every screen `UI-REDO` | 2026-11-19 | ACCEPTED |
| FIN-D10 | Maker-checker | Not in MVP; phase 2 threshold-based dual approval | 2026-11-19 | ACCEPTED |
| FIN-D12 | Payout auto-approval | `WALLET_AUTO_APPROVE_PAYOUTS` default `true`; when off every withdrawal/owner payout waits for Admin approval. Admin still marks paid after the manual transfer | 2026-11-19 | ACCEPTED |
| FIN-D11 | Owner earning auto-credit switch | `OWNER_EARNING_AUTO_CREDIT_ENABLED` default `true`; when off, successful eligible payments create a `PENDING` settlement and Admin approval is required before crediting the Owner wallet | 2026-11-19 | ACCEPTED |

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Owner earnings create duplicate credit | Idempotency key per booking + unique index + sweep tests |
| Refund after Owner earning causes negative balance | Reversal only with reason; fail closed and report for manual handling |
| Reporting period mismatch between revenue and refunds | Show gross and refunds separately; label net as estimate |
| Export leaks PII or is abused | ADMIN-only, rate limit, masking, audit, row cap, no stored files |
| Excel formula injection | Escape text cells beginning with formula characters |
| Reconciliation false positives | Stable keys, documented invariants, fixture tests for each discrepancy type |
| Frontend base mistaken for final UI | Explicit `UI-REDO` labels and plan checklist |
| Adding a new ledger type breaks constraints | Migration extends the check constraint and updates Drizzle/type unions together |
| Large exports exhaust memory | Row cap in phase 1; async streaming in phase 2 |
| Tournament data unavailable in phase 1 | Generic source filter; tournament reports enabled in phase 2 |

## 12. Dependencies

- Existing wallet ledger, top-up, refund, payout, and Admin adjustment services.
- Booking status worker (`advanceInProgressToCompleted`) and facility owner lookup.
- Existing notification alerts for payout pending, refund failed, and payment mismatch.
- Existing Admin shell (`AdminSidebar`, `AdminHeader`, `NotificationsProvider`).
- `exceljs` added to backend dependencies.
- Migration slot `0025` (to be registered before implementation).

## 13. Open Items

- Final product sign-off on FIN-D1 (Owner earnings timing) and FIN-D2 (fee = 0).
- Confirm whether SePay exposes a transaction/statement API usable in phase 2.
- Confirm whether post-completion refunds are allowed by booking policy; the default
  assumption is no, with Admin-managed exceptions.
