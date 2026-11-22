# 14 — Quản lý tài chính Admin

- Ngày lập kế hoạch: 2026-11-19
- Trạng thái: **P0 IMPLEMENTED** (2026-11-19); FIN-14 full-suite verification còn pending
- Track/Phase: Track E+ / Admin Operations, sau `03`, `09`, `13`
- Prerequisite: `01 G0` (D9), `02 INF-00`, `03_thanh-toan-hoan-tien` (WAL-01→08), `13_thong-bao-van-hanh-admin`
- Exit gate: Admin vận hành được toàn bộ dòng tiền; Owner có nguồn thu từ booking; có audit/export; test + migration PASS
- Mở khóa: vận hành ví-first an toàn; báo cáo tài chính vận hành; đối soát; chuẩn bị cho kế toán phase sau
- Tài liệu chi tiết:
  - [PRD](../features/admin/finance/prd.md)
  - [Tech Design](../features/admin/finance/tech-design.md)
  - [Tasks](../features/admin/finance/tasks.md)

> **Quy ước UI-REDO (áp dụng):** frontend chỉ làm **base đủ để test luồng/nghiệp vụ**.
> Mọi màn hình mới phải gắn nhãn `[ ] UI-REDO` và không tính DONE cho tới khi merge
> frontend và kiểm tra lại UI. Không đầu tư visual/Figma trong đợt này.

## 0.1 Trạng thái triển khai — 2026-11-19

**Đã triển khai P0 backend + frontend base.** Bằng chứng:

- Migration `0025_plain_sister_grimm.sql` applied in **dev + test DB**; `npm run verify:migrations` PASS (26 migrations, no schema diff).
- Backend build PASS.
- Targeted backend tests PASS: `finance-admin` 9/9 + wallet/payout/top-up/ledger/refund/booking-payment/admin-notifications/dashboard 55/55.
- Frontend build PASS; `oxlint` warnings only (no errors).
- Playwright `playwright.admin-finance.config.ts` 2/2 PASS: finance tabs + legacy route redirect.
- Full backend suite chưa chạy xong trong phiên này (quá thời gian 15 phút); cần chạy lại trước khi đánh dấu FIN-14 DONE.

## 0. Quyết định đã chốt cho đợt này

Các quyết định dưới đây đã được chấp nhận để lập kế hoạch ngày 2026-11-19. Cần xác
nhận cuối của Product Owner tại exit gate trước khi code FIN-09.

| # | Quyết định | Phương án |
| --- | --- | --- |
| FIN-D1 | Nguồn thu của Court Owner | Credit ví Owner khi booking đã thanh toán chuyển `COMPLETED`; entry `OWNER_EARNING`; số tiền = `BOOKING.totalAmount`; idempotency `owner-earning:<bookingId>` |
| FIN-D2 | Phí nền tảng | Giữ **0** theo G0 D9; không thêm cột/UI phí trong MVP |
| FIN-D3 | Độ sâu báo cáo | P0 báo cáo vận hành, tách **dòng tiền thực** và **doanh thu nội bộ**, gắn nhãn ước tính; số kế toán để P1/P2 |
| FIN-D4 | Điều hướng | Module mới `/admin/finance`; giữ `/admin/wallet/*` redirect, bảo toàn query param |
| FIN-D5 | Đối soát | P0 đối soát nội bộ (intent ↔ ledger ↔ balance); P1 mới thêm SePay API/import sao kê |
| FIN-D6 | Giải đấu | P1 sau `TRN-05`; P0 chỉ booking |
| FIN-D7 | Excel export | Backend `exceljs`, file `.xlsx` thật; P0 đồng bộ, cap 20.000 dòng; P1 async/streaming |
| FIN-D8 | Audit | Bảng mới append-only `finance_audit_events`; không chỉ dựa vào ledger/payout row |
| FIN-D9 | Frontend | Base UI đủ test; mọi màn hình `UI-REDO` |
| FIN-D10 | Maker-checker | Không làm trong MVP; P2 mới thêm duyệt kép theo ngưỡng |

## 1. Mục tiêu

1. Admin có một nơi để **xem và vận hành toàn bộ dòng tiền**: ví, nạp, thanh toán,
   hoàn, rút/payout, điều chỉnh, thu nhập Owner, đối soát, báo cáo.
2. Có **sổ giao dịch hợp nhất** thay vì phải mở nhiều bảng rời rạc.
3. Admin can thiệp được các ngoại lệ (top-up thiếu webhook, refund lỗi, payout chờ
   duyệt) với lý do và audit rõ ràng.
4. Court Owner có **nguồn thu thật** từ booking đã hoàn tất, để `OWNER_PAYOUT` không
   còn phụ thuộc vào Admin credit tay.
5. Có **đối soát** phát hiện lệch giữa provider intent, ledger và số dư ví.
6. Có **báo cáo vận hành + export Excel** phục vụ kiểm tra nội bộ.
7. Không phá vỡ nguyên tắc ví-first, append-only ledger, idempotency và phân quyền
   `ADMIN`.

## 2. Không nằm trong phạm vi

- Kế toán thuế, hóa đơn, bút toán kép, chốt kỳ, báo cáo tài chính theo chuẩn kế toán.
- Super Admin / maker-checker / RBAC nâng cao.
- Chuyển tiền thật ra ngân hàng; payout vẫn duyệt tay.
- Split Bill, escrow, tín dụng, ví doanh nghiệp.
- Tự động payout production; SePay Bank Hub demo vẫn theo `12_rut-vi-tu-dong-sepay-bankhub.md`.
- Doanh thu/hoàn tiền giải đấu trong P0 (P1 sau `TRN-05`).
- Import sao kê/SePay API trong P0 (P1).
- Async export, lưu file export trên server, export theo lịch (P1/P2).
- Màn hình tài chính cho Player/Owner (họ chỉ dùng ví của mình như hiện tại).

## 3. Hiện trạng và khoảng trống

### 3.1 Đã có

- Ledger/hold/balance: `backend/src/services/payments/WalletService.ts`,
  `backend/src/repositories/wallet/WalletRepository.ts`.
- Nạp SePay + webhook: `WalletTopUpService.ts`.
- Thanh toán booking bằng ví: `payment.service.ts` (debit ví, tạo `PAYMENTS SUCCESS`,
  confirm booking).
- Refund durable + worker: `RefundService.ts`, `payment_refunds`, `refund.job.ts`.
- Payout + duyệt tay: `WalletPayoutService.ts`, `WALLET_PAYOUT_REQUESTS`.
- Admin hiện có: `/api/v1/admin/wallet/reconciliation`, list payouts/refunds,
  approve/reject/paid, credit/debit (`adminWalletRoutes.ts`).
- Cảnh báo vận hành: `13_thong-bao-van-hanh-admin.md` (payout pending, refund failed,
  payment mismatch).
- UI base: `frontend/src/features/admin/wallet/AdminWalletPage.tsx` (payouts, refunds,
  reconciliation) + sidebar “Ví & thanh toán”.

### 3.2 Chưa có

1. **Sổ giao dịch hợp nhất** và màn hình chi tiết giao dịch.
2. **Quản lý ví theo user**: balance/held/available, ledger, holds, liên kết booking.
3. **Top-up monitoring** + xử lý ca thiếu webhook/amount mismatch.
4. **Payout list phân trang + detail** (hiện list không phân trang, thiếu bank/hold).
5. **Refund retry có kiểm soát** + ghi chú xử lý tay.
6. **Owner earnings**: booking hoàn tất không credit Owner; `OWNER_PAYOUT` không có
   nguồn ví.
7. **Đối soát chi tiết**: hiện chỉ totals + unmatched id, không có discrepancy key,
   resolve hay run.
8. **Báo cáo cash-flow/revenue** và **Excel export**.
9. **Audit** cho export/retry/reconciliation resolve/owner settlement.
10. **Tài liệu PRD/tech-design/tasks** trước file này.

### 3.3 Rủi ro hiện trạng

| Rủi ro | Hệ quả |
| --- | --- |
| Owner không có thu nhập | Payout không hợp lệ về nguồn tiền; Admin phải credit tay |
| Không có sổ giao dịch | Điều tra sai lệch phải query nhiều bảng, dễ bỏ sót |
| Reconciliation chỉ totals | Không xác định được bản ghi nào lệch |
| Retry refund thủ công ngoài hệ thống | Có thể credit hai lần, mất audit |
| Export CSV thủ công | Sai định nghĩa, rò rỉ PII, không audit |
| UI base bị coi là final | Scope creep visual; chậm merge frontend |

## 4. Kiến trúc và phạm vi kỹ thuật

### 4.1 Nguyên tắc

1. **Ledger là source of truth**; mọi thay đổi số dư đi qua `WalletService`.
2. Không sửa/xóa ledger; correction là entry mới có lý do.
3. Idempotency bắt buộc cho top-up/refund/payout/owner earning.
4. Provider call nằm ngoài transaction DB.
5. Chỉ `ADMIN`; mọi hành động tiền/export có audit.
6. Không thêm thư viện chart; Excel dùng `exceljs` ở backend.
7. Frontend base dùng `httpClient` và Admin shell hiện có.

### 4.2 Module/layer

- Route mới: `backend/src/routes/admin/adminFinanceRoutes.ts`.
- Giữ `adminWalletRoutes.ts` làm compatibility alias.
- Controller: `AdminFinanceController`.
- Validation: `validation/admin-finance.ts`.
- Services: `FinanceOverviewService`, `FinanceTransactionService`,
  `OwnerEarningService`, `ReconciliationService`, `FinanceReportService`,
  `FinanceExportService`, `FinanceAuditService`.
- Repositories: `FinanceQueryRepository`, `FinanceAuditRepository`,
  `OwnerEarningRepository`.
- Job: `jobs/owner-earning.job.ts`.
- Schema: `db/schema/finance.ts` + cập nhật `wallet.ts`.
- Frontend: `frontend/src/features/admin/finance/`.

### 4.3 Migration

- Slot dự kiến: **`0025_admin_finance.sql`** (đăng ký tại
  `docs/plans/migration-slot-log.md` trước khi merge; chưa cấp số chính thức trong
  đợt tài liệu này).
- Nội dung:
  1. Mở rộng `chk_wallet_entry_type` thêm `OWNER_EARNING`,
     `OWNER_EARNING_REVERSAL`.
  2. Bảng `finance_audit_events` (append-only) + index.
  3. Index hỗ trợ query ledger/payment/top-up/payout/refund.
- Không đổi cột bảng hiện có; không backfill; không migration phá hủy.
- P1 mới thêm bảng `finance_reconciliation_runs`/`items` và import sao kê.

## 5. Chức năng chi tiết

Thứ tự dưới đây là phạm vi P0; task ID tương ứng trong
[tasks.md](../features/admin/finance/tasks.md).

### 5.1 Tổng quan tài chính (FIN-04)

- KPI: tổng số dư ví, tổng held, cash in, cash out, refunds, gross revenue,
  net estimated, owner earnings, payout pending, refund failed, số lệch đối soát.
- Range: `today | 7d | 30d | this_month | custom` (custom tối đa 366 ngày).
- Trend đơn giản theo ngày (P0 có thể dạng bảng/text; không thêm chart lib).
- Empty state trả 0, không dữ liệu giả.

### 5.2 Sổ giao dịch hợp nhất (FIN-03)

- Nguồn: ledger + top-up pending + payout pending + refund pending.
- Filter: source/status/user/reference/amount/time.
- Cột: thời gian, nguồn, loại, trạng thái, user, số tiền, balance after, reference,
  diễn giải, actor.
- Detail: user, booking/registration, payment/refund/payout/top-up, hold,
  idempotency, audit liên quan.
- Mask số tài khoản; không trả secret/signature.

### 5.3 Quản lý ví theo user (FIN-05)

- Tìm user (id/email/name) → mở ví.
- Hiển thị balance/held/available, ledger entries, holds, payout/top-up gần đây.
- Credit/debit bắt buộc lý do; debit không vượt available.
- Một ledger entry + một audit event cho mỗi lần điều chỉnh.

### 5.4 Top-up monitoring (FIN-06)

- List theo status/provider/user/time; detail có provider reference, amount,
  paid time, ledger match.
- Manual match khi có chuyển khoản nhưng thiếu webhook:
  - bắt buộc provider/reference/amount/user/reason;
  - idempotent theo provider reference;
  - credit qua đường top-up chuẩn, không raw insert.
- Không sửa amount của top-up `SUCCESS`; không xóa top-up.

### 5.5 Payout management (FIN-07)

- List phân trang + detail bank account (mask), hold, requester, reviewer, note,
  transfer reference.
- Approve/reject (reason bắt buộc)/mark paid (transfer reference bắt buộc).
- State machine giữ nguyên: `PENDING → APPROVED → PAID`, reject release hold,
  mark-paid capture hold một lần.
- Audit từng action; giữ endpoint cũ cho deep link.

### 5.6 Refund management (FIN-08)

- Queue theo status/payment/user/time; detail amount, reason, attempts, last error,
  booking/registration, ledger.
- Retry chỉ với `FAILED` và trong attempt bound; idempotent, không credit hai lần.
- Resolution note không sửa ledger; correction dùng wallet adjustment có lý do.
- Refund luôn về ví, không hoàn nguồn nạp.

### 5.7 Owner earnings settlement (FIN-09)

- Điều kiện: booking `COMPLETED`, payment `SUCCESS`, có facility Owner, chưa có
  earning entry.
- Số tiền: `BOOKING.totalAmount`; phí = 0.
- Credit ví Owner: `OWNER_EARNING`, `referenceType='BOOKING'`,
  idempotency `owner-earning:<bookingId>`.
- Chạy job định kỳ (gate bởi `OWNER_EARNING_JOB_ENABLED`, mặc định **false**) + Admin
  trigger sweep có giới hạn thời gian; trả `{ scanned, credited, skipped, failed }`.
- Reversal ngoại lệ: `OWNER_EARNING_REVERSAL`, bắt buộc lý do; nếu ví không đủ thì
  fail closed và đưa vào đối soát/xử lý tay, không tạo số dư âm.
- Không áp dụng cho giải đấu trong P0.

### 5.8 Đối soát (FIN-10)

Check tối thiểu:

1. Top-up `SUCCESS` vs ledger `TOP_UP`.
2. Payment `SUCCESS` vs ledger `PAYMENT`.
3. Refund `REFUNDED` vs ledger `REFUND`.
4. Payout `PAID` vs ledger `WITHDRAWAL`/`PAYOUT`.
5. Booking paid+completed vs `OWNER_EARNING`/reversal.
6. Balance từng ví vs tổng ledger.
7. Tổng hold `HELD` vs phần held suy ra từ available.
8. Bản ghi `SUCCESS`/`PAID` thiếu ledger tương ứng.

Mỗi lệch có key ổn định `"<check>:<entity>:<id>"`, expected/actual/delta. Resolve chỉ
ghi audit + note, không sửa tiền. P0 chạy on-demand; P1 mới lưu run/items.

### 5.9 Báo cáo vận hành (FIN-11)

- **Cash-flow:** cash in (top-up), cash out (payout), net.
- **Revenue nội bộ:** gross payment, refunds, net estimated, owner earnings; group by
  day/source/owner.
- Tất cả theo `Asia/Ho_Chi_Minh`, interval nửa mở `[start, end)`.
- Revenue gắn `isEstimate: true`; không gọi là doanh thu kế toán/quyết toán.
- P0 tập trung booking; payment có `registration_id` vẫn vào cùng query/report nếu
  dữ liệu tồn tại, nhưng nghiệm thu luồng giải đấu (trả/hoàn) để P1 sau `TRN-05`.

### 5.10 Excel export (FIN-12)

- `.xlsx` thật bằng `exceljs` ở backend; không CSV đổi đuôi.
- Loại: transactions, top-ups, payouts, refunds, revenue, cash-flow, reconciliation.
- Workbook: sheet “Tổng hợp” (filter, người xuất, thời điểm, timezone, row count,
  totals) + sheet “Dữ liệu”.
- Format: header froze/autofilter, amount `#,##0`, date `dd/mm/yyyy hh:mm`.
- Bảo mật: mask bank account; chống formula injection; ADMIN-only; rate limit.
- P0 cap 20.000 dòng; vượt cap trả `FINANCE_EXPORT_TOO_LARGE`.
- Audit `EXPORT` (actor, type, filter, row count); không lưu file trên server.
- P1: async job + streaming nếu cần.

### 5.11 Audit (FIN-02)

- Bảng `finance_audit_events` append-only.
- Action: export, payout approve/reject/mark paid, wallet credit/debit, refund
  retry/resolve, owner earning sweep/reversal, reconciliation resolve, top-up manual
  match.
- Metadata: filter, amount, reason, before/after, row count; không chứa secret/PII
  nhạy cảm.

## 6. Luồng nghiệp vụ chính

### 6.1 Nạp ví

```text
User tạo top-up → VietQR → SePay webhook (HMAC)
  → transaction: top-up SUCCESS + ledger TOP_UP
  → duplicate/late/mismatch: không credit lần 2, ghi nhận + alert
  → Admin: xem queue, manual match nếu thiếu webhook
```

### 6.2 Thanh toán booking

```text
Player bấm thanh toán → debit ví (PAYMENT, idempotent)
  → PAYMENTS SUCCESS + booking CONFIRMED (cùng transaction)
  → thiếu tiền: WALLET_INSUFFICIENT_BALANCE + CTA nạp
```

### 6.3 Hoàn tiền

```text
Hủy booking/giải → refund intent PENDING (cùng transaction hủy)
  → worker claim → credit ví REFUND → payment/refund REFUNDED
  → lỗi → FAILED + alert → Admin retry/resolve note
```

### 6.4 Rút ví / Owner payout

```text
User/Owner tạo request + bank account → hold
  → Admin approve/reject (reason) → reject release hold
  → Admin chuyển khoản tay → mark paid + transferReference
  → capture hold + ledger WITHDRAWAL/PAYOUT
```

### 6.5 Admin credit/debit

```text
Tìm user → amount + reason
  → ledger ADMIN_ADJUSTMENT + audit actor
  → debit không vượt available
```

### 6.6 Owner earnings

```text
Booking COMPLETED + payment SUCCESS
  → job/sweep tìm booking chưa có OWNER_EARNING
  → lock Owner wallet → credit OWNER_EARNING (idempotent)
  → Owner thấy số dư → tạo OWNER_PAYOUT
```

### 6.7 Đối soát

```text
Admin chọn kỳ → chạy reconciliation
  → so sánh intent ↔ ledger ↔ balance
  → danh sách lệch (key ổn định)
  → Admin resolve + note → audit
  → export Excel
```

### 6.8 Export

```text
Admin chọn loại + filter → validate + count (cap)
  → build workbook → stream .xlsx
  → audit EXPORT
```

## 7. Quy tắc nghiệp vụ bắt buộc

1. `WALLET_LEDGER_ENTRIES` là source of truth; append-only.
2. `available = balance − SUM(holds HELD)`.
3. Idempotency key unique theo user; replay trả kết quả cũ.
4. Không gọi provider trong transaction DB.
5. Top-up: terminal state không mở lại; late/duplicate không credit lần 2.
6. Refund: 100% về ví, tối đa một credit/payment.
7. Payout: không mark paid nếu thiếu transfer reference; reject phải có lý do.
8. Adjustment: reason bắt buộc; không debit vượt available.
9. Owner earning: chỉ booking paid+completed; một earning/booking; phí 0.
10. Reversal: reason bắt buộc; fail closed nếu không đủ số dư.
11. Reporting: `Asia/Ho_Chi_Minh`, nửa mở; doanh thu gắn nhãn ước tính.
12. Export: `.xlsx`, cap dòng, mask, chống formula injection, audit.
13. Chỉ `ADMIN`; không lộ secret/signature/full bank account.
14. Không xóa/sửa ledger/audit; correction là entry mới.

## 8. API đề xuất

Tất cả dưới `/api/v1/admin/finance`, `authenticate + requireRole('ADMIN')`.

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/overview?range=` | KPI + trend |
| GET | `/transactions?...` | Sổ giao dịch hợp nhất |
| GET | `/transactions/:source/:id` | Chi tiết giao dịch |
| GET | `/wallets/:userId` | Ví + summary |
| GET | `/wallets/:userId/entries` | Ledger ví |
| GET | `/wallets/:userId/holds` | Hold ví |
| POST | `/wallets/:userId/credit\|debit` | Điều chỉnh ví |
| GET | `/top-ups`, `/top-ups/:id` | Top-up queue/detail |
| POST | `/top-ups/:id/manual-match` | Ghép tay |
| GET | `/payouts`, `/payouts/:id` | Payout list/detail |
| POST | `/payouts/:id/approve\|reject\|paid` | Duyệt/chi |
| GET | `/refunds`, `/refunds/:paymentId` | Refund queue/detail |
| POST | `/refunds/:paymentId/retry` | Retry có kiểm soát |
| POST | `/refunds/:paymentId/resolve-note` | Ghi chú xử lý |
| GET | `/owner-earnings` | Danh sách earning |
| POST | `/owner-earnings/sweep` | Chạy sweep có giới hạn |
| POST | `/owner-earnings/:bookingId/reverse` | Reversal ngoại lệ |
| GET | `/reconciliation?range=` | Chạy đối soát |
| POST | `/reconciliation/discrepancies/:key/resolve` | Resolve lệch |
| GET | `/reports/cash-flow`, `/reports/revenue` | Báo cáo |
| GET | `/exports/:type` | Excel export |
| GET | `/audit` | Finance audit |
| POST | `/jobs/owner-earnings/run` | Ops trigger sweep |

Chi tiết request/response, error code và validation: xem
[tech-design.md](../features/admin/finance/tech-design.md) §4, §7.

## 9. Frontend base (UI-REDO)

### 9.1 Route

| Route | Nội dung base |
| --- | --- |
| `/admin/finance` | Redirect `/admin/finance/overview` |
| `/admin/finance/overview` | KPI cards + bảng trend |
| `/admin/finance/transactions` | Filter + bảng + detail panel |
| `/admin/finance/wallets` | Tìm user + ví detail |
| `/admin/finance/top-ups` | Filter + bảng + manual match |
| `/admin/finance/payouts` | Filter + bảng + action |
| `/admin/finance/refunds` | Filter + bảng + retry/note |
| `/admin/finance/owner-earnings` | Filter + sweep |
| `/admin/finance/reconciliation` | Run + bảng lệch + resolve |
| `/admin/finance/reports` | Chọn báo cáo + export |
| `/admin/finance/audit` | Bảng audit |

**Không gộp toàn bộ vào `/admin/wallet/payouts`.** Payout chỉ là một tab nghiệp vụ;
các phần giao dịch, nạp tiền, hoàn tiền, owner earnings, đối soát, báo cáo và audit
không thuộc phạm vi trang payout. Tạo module cha `/admin/finance` với tab điều hướng;
`/admin/wallet/payouts` chỉ redirect sang `/admin/finance/payouts` và giữ query param.

### 9.2 Yêu cầu base

- Dùng `AdminSidebar`, `AdminHeader`, `NotificationsProvider`, `httpClient`.
- Bảng/filter/action prompt đơn giản; không chart lib; không mock data.
- Có loading/empty/error; action có feedback và refresh.
- Export dùng fetch + blob (có auth header).
- `/admin/wallet/*` redirect sang `/admin/finance/*`, giữ `payoutId`/`paymentId`.
- Sidebar đổi “Ví & thanh toán” → “Quản lý tài chính”.
- Mỗi trang gắn nhãn **UI-REDO**.
- Base phải đủ để Playwright thao tác: ưu tiên `data-testid` ổn định.

## 10. Test và bằng chứng

### 10.1 Backend

- `finance-ledger-query.test.ts`
- `finance-overview.test.ts`
- `finance-wallet-admin.test.ts`
- `finance-top-up-admin.test.ts`
- `finance-payout-admin.test.ts`
- `finance-refund-admin.test.ts`
- `owner-earnings.test.ts`
- `finance-reconciliation.test.ts`
- `finance-report.test.ts`
- `finance-export.test.ts`
- `finance-audit.test.ts`
- Regression: `wallet-payout`, `wallet-top-up`, `refund`, `wallet-booking-payment`.

### 10.2 Playwright base

`frontend/playwright.admin-finance.config.ts`:

1. Login Admin → overview → đổi range.
2. Transactions filter → detail → export.
3. Wallet search → credit/debit.
4. Payout approve/reject/paid.
5. Refund failed → retry/note.
6. Owner earnings sweep → ví Owner.
7. Reconciliation run → resolve.
8. Reports → export.

### 10.3 Lệnh kiểm tra

```bash
npm run db:migrate
npm run verify:migrations
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.admin-finance.config.ts
```

## 11. Phasing và exit gate

### P0 — Vận hành cơ bản (bắt buộc)

FIN-01 → FIN-14 (trừ phần P1).

Exit gate:

- Admin xem được sổ giao dịch, ví, top-up, payout, refund, owner earnings.
- Owner có earning từ booking hoàn tất; payout rút được từ số dư thật.
- Credit/debit/approve/reject/mark paid/retry có audit.
- Đối soát nội bộ phát hiện lệch và resolve được.
- Excel export hoạt động, có audit, cap dòng.
- Tests/builds/migration PASS; UI base đủ test; mọi màn `UI-REDO`.

### P1 — Báo cáo và đối soát mở rộng

- Tournament payments/refunds sau `TRN-05`.
- SePay API/import sao kê; lưu reconciliation run/items.
- Async export/streaming; export theo lịch.
- Dashboard finance nâng cao (nếu cần).

### P2 — Nâng cao

- Maker-checker theo ngưỡng.
- Số liệu kế toán/chốt kỳ.
- Tự động đối soát/alert nâng cao.
- T+N hold cho owner earnings (nếu Business yêu cầu).

## 12. Rủi ro và cách tránh

| Rủi ro | Cách tránh |
| --- | --- |
| Owner earning trùng | Idempotency `owner-earning:<bookingId>` + unique index + test sweep lặp |
| Reversal làm âm ví | Fail closed, báo lỗi, xử lý tay/đối soát |
| Báo cáo revenue/refund lệch kỳ | Tách gross/refund riêng; label net là ước tính |
| Export rò rỉ PII | ADMIN-only, rate limit, mask, cap, audit, không lưu file |
| Excel formula injection | Escape text bắt đầu `= + - @` |
| Đối soát false positive | Key ổn định, invariant tài liệu hóa, fixture từng loại lệch |
| UI base bị coi là final | Gắn `UI-REDO`, không đánh dấu DONE UI |
| Migration check constraint lỗi | Test fresh/populated; cập nhật SQL + Drizzle + TS union cùng lúc |
| Export lớn hết RAM | Cap 20k P0; async/stream P1 |
| Concurrent payout/refund | Row lock + idempotency + state guard hiện có |

## 13. Checklist hoàn thành file

### 13.1 Tài liệu

- [x] PRD `docs/features/admin/finance/prd.md`.
- [x] Tech Design `docs/features/admin/finance/tech-design.md`.
- [x] Tasks `docs/features/admin/finance/tasks.md`.
- [x] Plan `14_quan-ly-tai-chinh-admin.md`.
- [x] `00_danh-muc-task.md` cập nhật trạng thái P0 IMPLEMENTED.
- [x] `docs/architecture/frontend.md` cập nhật route `/admin/finance/*` + redirect.
- [x] `docs/architecture/database-schema.md` cập nhật bảng/index/entry type.
- [x] `docs/plans/migration-slot-log.md` đăng ký `0025`.
- [ ] `docs/business-rules-config-matrix.md` cập nhật quy tắc Owner earning nếu cần.

### 13.2 Triển khai (khi code)

- [x] FIN-01→FIN-13 DONE; FIN-14 IN_PROGRESS (chờ full suite).
- [x] Migration `0025` applied in test DB; `verify:migrations` PASS.
- [ ] Full backend test PASS (targeted 55/55 PASS; full suite timeout).
- [x] Backend/frontend build PASS; frontend lint no new errors.
- [x] Playwright `admin-finance` PASS 2/2.
- [x] Không còn `TBD` trong phạm vi P0.
- [x] Mọi màn UI gắn `UI-REDO`.

## 14. Liên kết và cập nhật tài liệu liên quan

| Tài liệu | Nội dung cần cập nhật khi triển khai |
| --- | --- |
| `docs/features/platform/payments-refunds/prd.md` | Ghi chú Owner earnings + Admin finance console |
| `docs/features/platform/payments-refunds/tech-design.md` | Entry type mới, Owner settlement job, Admin finance APIs |
| `docs/features/admin/dashboard/prd.md` | Liên kết sang finance; revenue estimate vẫn giữ |
| `docs/plans/03_thanh-toan-hoan-tien.md` | Liên kết plan 14; Owner earnings bổ sung |
| `docs/plans/13_thong-bao-van-hanh-admin.md` | Liên kết UI finance thay `/admin/wallet` (redirect) |
| `docs/plans/00_danh-muc-task.md` | Thêm dòng 14 + trạng thái |
| `docs/architecture/frontend.md` | Route `/admin/finance/*`, redirect `/admin/wallet/*` |
| `docs/architecture/database-schema.md` | `finance_audit_events`, entry type, index |
| `docs/plans/migration-slot-log.md` | Slot `0025` |
