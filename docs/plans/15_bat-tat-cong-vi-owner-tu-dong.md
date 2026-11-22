# 15 — Bật/tắt tự động cộng ví Owner

- Ngày lập kế hoạch: 2026-11-19
- Trạng thái: **IMPLEMENTED** (2026-11-19); UI base ở trạng thái UI-REDO
- Track/Phase: Track E+ / Admin Finance, sau `14_quan-ly-tai-chinh-admin`
- Prerequisite: `14_quan-ly-tai-chinh-admin` (FIN-09 owner earnings), `08_cau-hinh-he-thong` (registry/config Admin), `03_thanh-toan-hoan-tien` (WALLET, OWNER_PAYOUT)
- Exit gate: Admin bật/tắt được tự động cộng ví Owner từ màn Cấu hình hệ thống; khi tắt, mỗi booking đủ điều kiện vào hàng chờ duyệt và chỉ cộng ví sau khi Admin duyệt; không double-credit; test + migration PASS
- Mở khóa: vận hành linh hoạt giữa tự động và kiểm soát thủ công mà không cần deploy/đổi env
- Tài liệu chi tiết:
  - [Admin Finance PRD](../features/admin/finance/prd.md)
  - [Admin Finance Tech Design](../features/admin/finance/tech-design.md)
  - [Admin Finance Tasks](../features/admin/finance/tasks.md)
  - [System Config Tech Design](../features/platform/system-config/tech-design.md)
  - [Bảng cấu hình](../business-rules-config-matrix.md)

> **UI-REDO (áp dụng):** frontend chỉ làm base đủ test luồng/nghiệp vụ. Màn cấu hình
> và màn duyệt Owner earnings phải gắn nhãn `[ ] UI-REDO` tới khi merge frontend và
> kiểm tra lại UI.

## 0. Quyết định đã chốt cho đợt này

| # | Quyết định | Phương án |
| --- | --- | --- |
| OE-D1 | Thời điểm cộng ví Owner khi bật tự động | **Ngay khi payment `SUCCESS`** và booking còn hiệu lực; `COMPLETED` không còn là điều kiện |
| OE-D2 | Hành vi khi tắt tự động | Tạo hàng chờ duyệt theo từng booking; Admin duyệt thì **cộng ví Owner** bằng `OWNER_EARNING`; sau đó Owner rút qua `OWNER_PAYOUT` như hiện tại |
| OE-D3 | Giá trị mặc định | **Bật** (`true`) để giữ hành vi tự động hiện tại sau khi triển khai |
| OE-D4 | Nguồn sự thật của cấu hình | `SYSTEM_CONFIGS` qua key mới `OWNER_EARNING_AUTO_CREDIT_ENABLED`; env `OWNER_EARNING_JOB_ENABLED` chỉ còn là kill-switch hạ tầng |
| OE-D5 | Chống cộng trùng | Giữ idempotency ledger `owner-earning:<bookingId>`; thêm unique `booking_id` ở bảng settlement |
| OE-D6 | Domain cấu hình | Thêm domain `finance` vào registry và UI cấu hình; key đứng độc lập, không cần group |
| OE-D7 | Thông báo | Mỗi settlement `PENDING` phát một cảnh báo Admin, dedup theo booking |
| OE-D8 | Phạm vi duyệt | P0 duyệt/từ chối từng settlement; bulk approve để P1 nếu volume lớn |

### 0.1 Giả định cần Product Owner xác nhận ở exit gate

1. ~~Khi tắt tự động, booking chỉ vào hàng chờ sau khi `COMPLETED`.~~ **Đã đổi
   2026-11-19:** settlement được tạo ngay sau payment `SUCCESS`; huỷ/hoàn tiền sẽ
   tự động thu hồi Owner earning nếu ví Owner còn đủ số dư.
2. Admin duyệt là **cộng ví Owner**, không phải chuyển khoản ngân hàng trực tiếp.
   Bước chuyển tiền ra ngân hàng vẫn là `OWNER_PAYOUT` hiện có (Owner tạo yêu cầu,
   Admin approve + mark paid).
3. Nếu đổi cấu hình từ TẮT sang BẬT, các settlement `PENDING` đang có **không tự động
   cộng**; Admin vẫn phải duyệt hoặc từ chối để tránh thay đổi trạng thái ngoài ý muốn.

## 1. Mục tiêu

1. Admin bật/tắt luồng tự động cộng ví Owner ngay trong màn Cấu hình hệ thống, không
   cần sửa env hay deploy lại.
2. Khi bật: booking đủ điều kiện được cộng ví Owner tự động như hiện tại.
3. Khi tắt: booking đủ điều kiện được đưa vào hàng chờ; Admin duyệt thì mới cộng ví
   Owner, từ chối thì không cộng.
4. Mọi thay đổi tiền vẫn append-only, idempotent, có audit và không tạo số dư âm.
5. Không phá vỡ luồng payout hiện có: Owner vẫn rút tiền qua `OWNER_PAYOUT`.

## 2. Không nằm trong phạm vi

- Chuyển khoản ngân hàng tự động hoặc thay đổi cơ chế payout.
- Cộng ví Owner ngay khi payment `SUCCESS` (đã chốt OE-D1).
- Duyệt theo lô, duyệt nhiều cấp, maker-checker, ngưỡng tiền tự động.
- Thay đổi phí nền tảng; phí vẫn bằng 0.
- Giải đấu/tournament settlement (P1 sau `TRN-05`).
- Sửa ledger trực tiếp hoặc xoá settlement.
- Thu hồi tự động khi refund đã nằm trong scope (xem §4.6); trường hợp ví Owner
  không đủ vẫn đưa Admin xử lý thủ công.

## 3. Hiện trạng và khoảng trống

### 3.1 Đã có

- `OwnerEarningService.settleBooking()` được gọi ngay trong transaction payment
  `SUCCESS`, credit ví Owner với idempotency `owner-earning:<bookingId>`; `sweep()`
  là lưới an toàn cho booking đã thanh toán bị lỡ trigger
  (`backend/src/services/finance/OwnerEarningService.ts`).
- Job `owner-earning.job.ts` chạy mỗi 5 phút nhưng bị gate bởi
  `OWNER_EARNING_JOB_ENABLED`, mặc định `false`
  (`backend/src/shared/config/env.ts`, `backend/src/index.ts`).
- Admin finance có màn Owner earnings, sweep tay và API reversal.
- System Configuration có registry, cache 60 giây, audit, API và UI `/admin/configs`.
- Payout duyệt tay: `WALLET_PAYOUT_REQUESTS`, `WalletPayoutService`.

### 3.2 Chưa có

1. Không có key cấu hình nghiệp vụ để bật/tắt auto credit; chỉ có env.
2. Không có trạng thái/ bảng lưu booking đang chờ Admin duyệt.
3. Không có API approve/reject owner earning.
4. Không có thông báo Admin khi có earning chờ duyệt.
5. Reconciliation cũ coi mọi booking `COMPLETED` thiếu ledger là lệch; đã sửa để
   hiểu settlement `PENDING`/`REJECTED` và mốc payment `SUCCESS`.
6. Admin finance Owner earnings chỉ hiển thị ledger đã cộng, không có hàng chờ.

### 3.3 Rủi ro hiện trạng

| Rủi ro | Hệ quả |
| --- | --- |
| Auto credit phụ thuộc env, mặc định tắt | Tiền đã trừ Player nhưng Owner không nhận; phải sweep tay |
| Không có hàng chờ duyệt | Khi tắt auto, Admin không biết booking nào cần cộng |
| Không có idempotency ở tầng nghiệp vụ ngoài ledger | Hai lần duyệt có thể ghi hai settlement hoặc lỗi khó hiểu |
| Reconciliation không biết PENDING | Báo động giả, mất tin cậy đối soát |
| Toggle giữa hai chế độ | Có thể double-credit nếu không thống nhất nguồn sự thật |

## 4. Quy tắc nghiệp vụ

### 4.1 Điều kiện tạo earning (không đổi)

Một booking đủ điều kiện khi:

- có `payments.status = 'SUCCESS'`;
- `bookings.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')` (không huỷ/hết hạn);
- `bookings.total_amount > 0`;
- có facility Owner qua `bookings → courts → facilities.owner_id`;
- chưa có `OWNER_EARNING` ledger cho booking;
- chưa có settlement row cho booking (trừ trường hợp settlement `PENDING` được xử lý
  theo chế độ thủ công).

### 4.2 Khi cấu hình BẬT

```text
Payment SUCCESS (transaction thanh toán)
  → booking đủ điều kiện, chưa có settlement/ledger
  → tạo settlement CREDITED (mode AUTO) + credit ví Owner OWNER_EARNING
     trong cùng transaction
  → idempotency owner-earning:<bookingId>

Sweep/job vẫn chạy định kỳ làm lưới an toàn cho booking đã thanh toán
nhưng chưa có settlement/ledger.
```

- Nếu booking đã có settlement `PENDING` (do trước đó cấu hình TẮT): **không tự cộng**;
  để Admin duyệt/từ chối (OE-D8/giả định 3).
- Nếu ledger đã tồn tại: bỏ qua, không tạo settlement trùng.

### 4.3 Khi cấu hình TẮT

```text
Payment SUCCESS (transaction thanh toán)
  → booking đủ điều kiện, chưa có settlement/ledger
  → tạo settlement PENDING (mode MANUAL), không ghi ledger, không đổi số dư
  → phát thông báo ADMIN_OWNER_EARNING_PENDING

Sweep/job vẫn tạo PENDING cho booking đã thanh toán bị lỡ trigger.
```

### 4.4 Admin duyệt / từ chối

```text
PENDING --approve--> CREDITED + OWNER_EARNING ledger + audit
PENDING --reject(reason)--> REJECTED + audit
```

- Approve bắt buộc kiểm tra lại: booking vẫn `CONFIRMED`/`IN_PROGRESS`/`COMPLETED`,
  payment vẫn `SUCCESS` (không bị `REFUNDED`), chưa có ledger.
- Approve là idempotent: gọi lại không cộng lần hai; trả settlement hiện tại.
- Reject bắt buộc lý do; không cộng ví; không xoá row.
- Không cho approve settlement `REJECTED` hoặc `CREDITED` sang trạng thái khác.

### 4.5 Chuyển đổi cấu hình

- BẬT → TẮT: booking mới sau thời điểm đọc cấu hình vào `PENDING`; ledger cũ giữ nguyên.
- TẮT → BẬT: booking mới auto credit; `PENDING` cũ giữ nguyên cho Admin xử lý.
- Cache cấu hình tối đa 60 giây; UI cảnh báo độ trễ này.
- Áp dụng theo lần sweep, không hồi tố.

### 4.6 Refund / huỷ sau khi đã cộng

- Khi refund payment thành công:
  - settlement `PENDING` bị chuyển `REJECTED` tự động;
  - settlement `CREDITED` được thu hồi bằng `OWNER_EARNING_REVERSAL` nếu ví Owner còn
    đủ số dư.
- Nếu ví Owner không đủ, hệ thống vẫn hoàn tiền Player, phát cảnh báo
  `ADMIN_OWNER_EARNING_REVERSAL_FAILED` và để Admin xử lý thủ công/đối soát.

## 5. Thiết kế kỹ thuật

### 5.1 Cấu hình mới

| Thuộc tính | Giá trị |
| --- | --- |
| Key | `OWNER_EARNING_AUTO_CREDIT_ENABLED` |
| Domain | `finance` (domain mới) |
| Type | `boolean` |
| Default | `true` |
| Editable | Có |
| Description | Tự động cộng ví chủ sân khi thanh toán booking thành công |

Thay đổi:

- `backend/src/shared/config/config-registry.ts`: thêm `finance` vào `CONFIG_DOMAINS`,
  thêm definition key.
- `backend/src/shared/config/finance-config.ts` (mới): reader typed
  `financeConfig.getOwnerEarningConfig()` dùng `loadConfigValues`, `clearCache`.
- `frontend/src/features/admin/configs/types/config.ts`: thêm domain + label
  “Tài chính”.
- `frontend/src/features/admin/configs/config-ui-meta.ts`: label/description/nhãn
  boolean “Tự động cộng ví” / “Chờ Admin duyệt”.
- Không cần `CONFIG_GROUPS`; key boolean sẽ render standalone.
- Seed migration `INSERT ... ON CONFLICT DO NOTHING` để tránh WARN missing config.
- Bổ sung key `WALLET_AUTO_APPROVE_PAYOUTS` (cùng domain `finance`, mặc định `true`) để chuyển công tắc auto-approve payout từ env sang System Configuration; migration `0027`.
- `docs/business-rules-config-matrix.md`: thêm §8.10 Finance Configuration.

Env:

- Đổi `OWNER_EARNING_JOB_ENABLED` default sang `true` và cập nhật `.env.example`.
- Giữ env làm kill-switch hạ tầng: `false` = tắt worker hoàn toàn (cả auto và tạo
  PENDING). Tài liệu phải ghi rõ đây không phải công tắc nghiệp vụ.
- `backend/src/index.ts` luôn start worker khi env true; worker đọc config mỗi lần chạy.

### 5.2 Bảng mới `OWNER_EARNING_SETTLEMENTS`

| Column | Type | Ý nghĩa |
| --- | --- | --- |
| `id` | bigint PK | ID settlement |
| `booking_id` | bigint unique, not null, FK BOOKINGS | Một settlement/booking |
| `owner_id` | bigint not null, FK USERS | Chủ sân nhận tiền |
| `amount` | decimal(14,2) not null, check > 0 | Bằng `BOOKING.total_amount` |
| `status` | varchar(20) not null | `PENDING`, `CREDITED`, `REJECTED` |
| `mode` | varchar(10) not null | `AUTO`, `MANUAL` |
| `ledger_entry_id` | bigint nullable, FK WALLET_LEDGER_ENTRIES | Entry đã cộng |
| `decided_by` | bigint nullable, FK USERS | Admin duyệt/từ chối; null với AUTO |
| `decided_at` | timestamp nullable | Thời điểm quyết định |
| `note` | varchar(500) nullable | Lý do từ chối/ghi chú duyệt |
| `created_at` | timestamp not null | Thời điểm tạo |
| `updated_at` | timestamp not null | Cập nhật cuối |

Indexes:

- unique `booking_id`;
- `(status, created_at, id)` cho hàng chờ;
- `(owner_id, created_at, id)` cho tra cứu Owner;
- unique `ledger_entry_id` (nullable) để một ledger không gắn hai settlement.

Backfill migration:

- Với mọi ledger `OWNER_EARNING` đã có, tạo settlement `CREDITED`, `mode='AUTO'`,
  `ledger_entry_id` tương ứng, `decided_at = ledger.created_at`.
- Bỏ qua nếu `booking_id` đã có row.

### 5.3 Service

Mở rộng `OwnerEarningService` (hoặc tách `OwnerEarningSettlementService` dùng chung):

1. `scanEligible()`: query booking đủ điều kiện, loại booking đã có settlement hoặc
   ledger; trả kèm ownerId/amount/bookingCode.
2. `process()`:
   - đọc `financeConfig.getOwnerEarningConfig()`;
   - nếu AUTO: mỗi booking, trong transaction tạo settlement `CREDITED` + gọi
     `walletService.credit` với `OWNER_EARNING`, idempotency cũ;
   - nếu MANUAL: mỗi booking, trong transaction tạo settlement `PENDING` và phát
     notification;
   - lỗi một booking không làm fail cả batch; trả
     `{ scanned, credited, pending, skipped, failed }`.
3. `approve(settlementId, adminId, note?)`:
   - lock settlement `FOR UPDATE`;
   - nếu `CREDITED` trả luôn (idempotent), `REJECTED` báo lỗi;
   - kiểm tra lại booking còn hiệu lực, payment `SUCCESS`, chưa có ledger;
   - `walletService.credit` trong cùng transaction;
   - cập nhật settlement `CREDITED`, `decided_by`, `decided_at`, `ledger_entry_id`;
   - audit `OWNER_EARNING_APPROVE`.
4. `reject(settlementId, adminId, reason)`:
   - lock row; chỉ `PENDING`;
   - cập nhật `REJECTED`, note, decided_by/at;
   - audit `OWNER_EARNING_REJECT`.
5. `sweep()` hiện có giữ làm alias/entrypoint cho Admin chạy tay; hành vi theo config.

Lock order: tuân thủ hiện có `USERS` → `WALLET_ACCOUNTS`; settlement lock lấy sau khi
đã xác định booking/owner và trước khi credit. Không tạo lock order mới.

### 5.4 API Admin

Tất cả `ADMIN`-only, dưới `/api/v1/admin/finance`:

| Method | Path | Body / Query | Mô tả |
| --- | --- | --- | --- |
| GET | `/owner-earning-settlements` | `status`, `ownerId`, `from`, `to`, `page`, `limit` | Danh sách settlement |
| GET | `/owner-earning-settlements/:id` | — | Chi tiết + booking + ledger |
| POST | `/owner-earning-settlements/:id/approve` | `{ note? }` | Duyệt và cộng ví |
| POST | `/owner-earning-settlements/:id/reject` | `{ reason }` | Từ chối, không cộng |
| POST | `/owner-earnings/sweep` | `{ from?, to?, limit?, dryRun? }` | Giữ endpoint hiện có; chạy theo config |

Validation mới trong `validation/admin-finance.ts`; controller mới trong
`AdminFinanceController`; route thêm vào `adminFinanceRoutes.ts`.

Response settlement gồm: `id`, `bookingId`, `bookingCode`, `ownerId`, `ownerEmail`,
`amount`, `status`, `mode`, `ledgerEntryId`, `decidedBy`, `decidedAt`, `note`,
`createdAt`, `updatedAt`.

### 5.5 Audit

Thêm action vào `FINANCE_AUDIT_EVENTS`:

- `OWNER_EARNING_APPROVE`;
- `OWNER_EARNING_REJECT`.

Metadata: settlementId, bookingId, ownerId, amount, mode, note/reason. Không chứa
thông tin ngân hàng.

### 5.6 Thông báo Admin

- Type mới: `ADMIN_OWNER_EARNING_PENDING`.
- Nội dung: “Owner earning chờ duyệt: booking <code>, Owner #<id>, <amount>đ”.
- Resource: `ADMIN_OWNER_EARNING`, id = settlement id.
- Deep link: `/admin/finance/owner-earnings?settlementId=<id>` (tab Chờ duyệt).
- Dedup key: `admin-owner-earning:<bookingId>`.
- Thêm resolver trong `NotificationResourceResolver`, nhãn trong
  `frontend/src/features/notifications/utils.ts`, mapping route trong `AdminHeader`.
- `notifications.type` là varchar nên không cần migration cho type.

### 5.7 Frontend

**Cấu hình hệ thống**

- Domain “Tài chính” xuất hiện trong filter và section.
- Card boolean `OWNER_EARNING_AUTO_CREDIT_ENABLED` với hai lựa chọn:
  - “Tự động cộng ví Owner” (`true`);
  - “Chờ Admin duyệt” (`false`).
- Mô tả nêu rõ: tắt tự động không làm mất tiền; booking vào hàng chờ duyệt.

**Admin Finance → Owner earnings**

- Thêm tab/filter “Chờ duyệt” (settlement `PENDING`) và “Đã cộng” (ledger hiện có).
- Cột: booking, Owner, số tiền, ngày hoàn tất, trạng thái, mode, người duyệt.
- Action approve (có note tuỳ chọn), reject (bắt buộc lý do), có confirm.
- Hiển thị banner khi config đang TẮT.
- Deep link `settlementId` mở đúng tab và highlight row.
- Gắn nhãn `UI-REDO`.

### 5.8 Reconciliation và báo cáo

- `ReconciliationService`:
  - Không tính booking đang có settlement `PENDING`/`REJECTED` vào expected ledger.
  - Thêm check `OWNER_EARNING_MISSING`: booking đã thanh toán `SUCCESS` còn hiệu lực
    nhưng không có cả ledger và settlement.
  - Thêm thông tin (non-discrepancy) `OWNER_EARNING_PENDING`: count/amount đang chờ.
- `FinanceQueryService.overview` có thể thêm `pendingOwnerEarnings` (count/amount) để
  Admin thấy tiền chưa cộng. Không tính vào revenue.
- Báo cáo revenue vẫn chỉ dùng ledger `OWNER_EARNING`/reversal; pending chỉ là thông
  tin vận hành.

### 5.9 Tài liệu phải cập nhật

- `docs/business-rules-config-matrix.md` §8.10.
- `docs/features/platform/system-config/tech-design.md` §7.3 registry catalog.
- `docs/features/platform/system-config/prd.md` scope domain.
- `docs/features/admin/finance/prd.md` FR-FIN-29→35 + decision log.
- `docs/features/admin/finance/tech-design.md` §6.3 + API/schema.
- `docs/features/admin/finance/tasks.md` task mới.
- `docs/architecture/database-schema.md` §3.42 + migration history + ERD.
- `docs/features/platform/notifications/tech-design.md` (type + deep link).
- `docs/plans/00_danh-muc-task.md` thêm dòng 15.
- `backend/.env.example` + hướng dẫn env.

## 6. Workstreams và task

| ID | Task | Phụ thuộc | Size |
| --- | --- | --- | --- |
| OE-01 | Docs + matrix + registry/config domain `finance` + key mới | — | M |
| OE-02 | Migration `0026`: bảng settlements + seed config + backfill | OE-01 | M |
| OE-03 | Service: eligibility, auto/manual processing, worker đọc config | OE-01, OE-02 | L |
| OE-04 | Service duyệt/từ chối + audit + idempotency | OE-03 | M |
| OE-05 | API list/detail/approve/reject + validation/controller/routes | OE-04 | M |
| OE-06 | Notification pending + resolver + deep link + nhãn UI | OE-03 | S |
| OE-07 | FE config card + FE finance tab chờ duyệt/actions (UI-REDO) | OE-05 | M |
| OE-08 | Reconciliation/report/overview adjustments | OE-03 | M |
| OE-09 | Tests: unit, integration, API, notification, reconciliation | OE-02→08 | L |
| OE-10 | Verification + docs closure + rollout checklist | OE-09 | S |

### 6.1 OE-01 — Cấu hình và tài liệu

- [x] Thêm domain `finance` + key `OWNER_EARNING_AUTO_CREDIT_ENABLED` vào registry.
- [x] Thêm reader `finance-config.ts`.
- [x] Cập nhật matrix §8.10, system-config docs, env example.
- [x] Cập nhật frontend types/labels/meta.
- Acceptance: API config trả key mới; default `true`; UI hiện card ở domain Tài chính.

### 6.2 OE-02 — Migration `0026`

- [x] Tạo bảng `OWNER_EARNING_SETTLEMENTS` + check constraints + indexes.
- [x] Seed config key `true` (`ON CONFLICT DO NOTHING`).
- [x] Backfill từ ledger `OWNER_EARNING` hiện có.
- [x] Drizzle schema + snapshot + `database-schema.md`.
- Acceptance: migration apply sạch trên dev/test; `npm run verify:migrations` PASS;
  backfill đúng số ledger cũ, không tạo trùng.

### 6.3 OE-03 — Xử lý theo config

- [x] Worker luôn chạy khi env bật; đọc config mỗi lần sweep.
- [x] AUTO: tạo `CREDITED` + credit ledger trong một transaction.
- [x] MANUAL: tạo `PENDING`, không đổi số dư.
- [x] Loại booking đã có ledger/settlement; không tự cộng `PENDING` cũ.
- [x] Trả counts `scanned/credited/pending/skipped/failed`.
- Acceptance: bật → ledger + settlement `CREDITED/AUTO`; tắt → chỉ `PENDING`;
  chạy lặp không double-credit; một booking lỗi không fail batch.

### 6.4 OE-04 — Duyệt/từ chối

- [x] Approve: lock row, re-check eligibility, credit ledger, update `CREDITED`,
  audit; idempotent.
- [x] Reject: bắt buộc reason, update `REJECTED`, audit.
- [x] Chặn approve khi booking/payment không còn hợp lệ.
- Acceptance: approve cộng đúng một lần; reject không cộng; gọi lặp an toàn;
  audit đủ actor/reason.

### 6.5 OE-05 — API

- [x] Schema validation query/body/param.
- [x] Controller + routes `GET list/detail`, `POST approve/reject`.
- [x] Trả 400/404/409 đúng mã lỗi hiện có.
- [x] Test ADMIN-only.
- Acceptance: API list phân trang/filter; approve/reject đúng state machine.

### 6.6 OE-06 — Thông báo

- [x] Producer khi tạo `PENDING`, dedup theo booking.
- [x] Resolver + deep link + nhãn + route mapping.
- [x] Test resolver và dedup.
- Acceptance: có đúng một cảnh báo/booking; click mở đúng settlement.

### 6.7 OE-07 — Frontend (UI-REDO)

- [x] Card cấu hình domain Tài chính.
- [x] Tab Chờ duyệt/Đã cộng + actions + confirm + lý do.
- [x] Banner trạng thái config; deep link `settlementId`.
- [x] `npm run build --prefix frontend` PASS; lint không error.
- Acceptance: thao tác được toàn bộ luồng bằng UI base.

### 6.8 OE-08 — Đối soát/báo cáo

- [x] Loại `PENDING`/`REJECTED` khỏi expected ledger.
- [x] Thêm `OWNER_EARNING_MISSING` và `OWNER_EARNING_PENDING`.
- [x] Overview thêm pending count/amount (không vào revenue).
- Acceptance: chế độ thủ công không sinh discrepancy giả; thiếu cả ledger lẫn
  settlement bị báo đúng.

### 6.9 OE-09 — Test

- [x] Config: default, update, audit, cache invalidation, domain list.
- [x] Service: AUTO, MANUAL, toggle, idempotency, reject, refunded booking.
- [x] API: auth, validation, list filter, approve/reject.
- [x] Notification + resolver + dedup.
- [x] Reconciliation: PENDING không lệch; missing bị bắt.
- [x] Build backend + frontend; targeted suite PASS.
- Acceptance: các test trên PASS trên `badminton_test`; full suite chạy trước khi
  đóng task.

### 6.10 OE-10 — Rollout

- [x] Apply migration dev/test (migration `0026`, test DB applied).
- [ ] Deploy với config default `true`; xác nhận auto credit hoạt động.
- [ ] Tắt config trên UI; tạo booking đã thanh toán; xác nhận `PENDING` + notification.
- [ ] Approve; xác nhận ledger + số dư Owner tăng đúng một lần.
- [ ] Chạy reconciliation; xác nhận không lệch.
- [x] Cập nhật tasks/plan status + bằng chứng test.

## 7. Kịch bản kiểm thử chấp nhận

1. **Auto ON**: payment `SUCCESS` → một ledger `OWNER_EARNING`, một settlement
   `CREDITED/AUTO`, số dư Owner tăng đúng `totalAmount`; chạy sweep lần nữa không tăng.
2. **Manual OFF**: booking tương tự → một settlement `PENDING/MANUAL`, không ledger,
   số dư không đổi, có notification Admin.
3. **Approve**: Admin duyệt → ledger `OWNER_EARNING` + settlement `CREDITED`, audit
   `OWNER_EARNING_APPROVE`; approve lần hai không cộng thêm.
4. **Reject**: từ chối có lý do → settlement `REJECTED`, không ledger, audit
   `OWNER_EARNING_REJECT`; không thể approve lại.
5. **Refunded/cancelled**: payment không `SUCCESS` không tạo settlement/ledger;
   payment đã `REFUNDED` thì settlement `PENDING` bị reject hoặc earning bị reversal.
6. **Toggle**: bật lại khi còn `PENDING` → auto sweep bỏ qua `PENDING`; Admin vẫn
   duyệt được.
7. **Reconciliation**: chế độ OFF không báo lệch cho `PENDING`; booking thiếu cả
   ledger lẫn settlement bị báo `OWNER_EARNING_MISSING`.
8. **Config API/UI**: đổi key có audit `ADMIN_CONFIG_CHANGED`, áp dụng trong ≤60 giây.

## 8. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
| --- | --- |
| Double-credit khi toggle/duyệt lặp | Unique `booking_id` + idempotency ledger + approve idempotent |
| Toggle ON tự cộng backlog `PENDING` ngoài ý muốn | Quy tắc: auto bỏ qua settlement `PENDING` |
| Notification spam khi nhiều booking | Dedup theo booking; P1 cân nhắc bulk/summary nếu volume lớn |
| Reconciliation báo sai ở chế độ thủ công | Cập nhật check loại `PENDING`/`REJECTED`; test riêng |
| Env bị hiểu là công tắc nghiệp vụ | Tài liệu ghi rõ env là kill-switch hạ tầng; UI/config là công tắc chính |
| Admin duyệt booking đã refund | Re-check trạng thái trước khi credit; trả 409 |
| Backlog duyệt lớn | Phân trang, filter Owner/ngày; bulk approve P1 |
| Cache 60 giây gây hiểu nhầm | UI cảnh báo độ trễ như các key khác |

## 8.1 Bằng chứng triển khai (2026-11-19)

- Migration `0026_owner_earning_settlements.sql` applied trên `badminton_test`; `npm run verify:migrations` PASS (27 migrations, latest `0026`, no schema diff).
- Backend build PASS; frontend build PASS.
- `owner-earning-settlement.test.ts` 6/6 PASS (auto ngay sau payment, manual pending, approve idempotent, reject, refund reversal, config API).
- Regression targeted: finance/owner-earning 16/16; wallet/booking/refund/payment 51/51 PASS.
- Frontend: config card domain Tài chính + tab Chờ duyệt/Đã cộng + trang Owner `/owner/wallet` (Ví & thu nhập, base UI-REDO).
- Hướng dẫn test UI: `docs/guides/owner-wallet-earning-testing.md`.
- Trang Owner hiển thị/copy nội dung chuyển khoản `PAYOUT-<id>` để test webhook.
- `WALLET_AUTO_APPROVE_PAYOUTS` đã chuyển sang `SYSTEM_CONFIGS` (migration `0027`); env tương ứng đã bỏ.
- Chưa chạy full backend suite và chưa deploy thật; các mục rollout còn lại giữ mở.

## 9. Rollback

- Tắt `OWNER_EARNING_AUTO_CREDIT_ENABLED` trên UI để dừng auto credit ngay mà không
  cần deploy; booking mới vào `PENDING`.
- Set env `OWNER_EARNING_JOB_ENABLED=false` để dừng worker khẩn cấp (dừng cả tạo
  `PENDING`).
- Không xoá settlement/ledger; nếu cần sửa tiền, dùng `OWNER_EARNING_REVERSAL` hoặc
  `ADMIN_ADJUSTMENT` có lý do và audit.
- Migration không phá dữ liệu cũ; backfill chỉ thêm row từ ledger hiện có.
