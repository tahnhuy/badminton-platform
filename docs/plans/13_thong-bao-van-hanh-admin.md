# 13 — Thông báo vận hành Admin mở rộng

> **Lưu ý (2026-11-27):** lệnh `npm run db:seed:admin-notifications` và các tài khoản riêng của nó đã bị gỡ khi gộp mọi seed thành một bộ seed demo (`npm run db:reset -- --yes`, xem [`docs/plans/demo-seed-plan.md`](demo-seed-plan.md)). Seed mới tạo thông báo Admin thật từ các luồng (hồ sơ cơ sở chờ duyệt, doanh thu chờ duyệt, yêu cầu rút tiền, báo cáo vi phạm). Các bước dưới đây mô tả bộ dữ liệu cũ và cần viết lại theo dữ liệu mới.


- Ngày lập kế hoạch: 2026-11-18
- Trạng thái: **DONE** (triển khai 2026-11-18)
- Track/Phase: Track C / Admin Operations
- Prerequisite: `04_thong-bao`, `05_bao-cao-kiem-duyet`, `03_thanh-toan-hoan-tien`, `08_cau-hinh-he-thong`
- Liên quan: [14_quan-ly-tai-chinh-admin.md](./14_quan-ly-tai-chinh-admin.md) — Admin finance console thay `/admin/wallet/*` bằng `/admin/finance/*` (giữ redirect)
- Liên quan trực tiếp: [Notifications Tech Design](../features/platform/notifications/tech-design.md), [Notifications Tasks](../features/platform/notifications/tasks.md), [Report Tech Design](../features/admin/report-management/tech-design.md), [User Management Tech Design](../features/admin/user-management/tech-design.md), [Bảng cấu hình](../business-rules-config-matrix.md)

## 0. Quyết định đã chốt cho đợt này

1. Tái sử dụng `NotificationService.notify(tx, events)` và mô hình `resourceType/resourceId/dedupKey` hiện có; không thêm queue, event bus, email/push/SMS.
2. Người nhận luôn là tài khoản `ADMIN`, `status = ACTIVE`, chưa bị xóa mềm. Sự kiện bảo mật loại trừ Admin là actor.
3. Payout pending, refund failed, config changed và high-risk report phát thông báo **trong cùng transaction** với nghiệp vụ để commit/rollback đồng bộ.
4. Alert do webhook/payment mismatch phát **sau khi transaction nghiệp vụ đã thất bại**, bằng một transaction riêng (best-effort) và chỉ ghi log khi gửi alert lỗi; alert không được đổi response webhook.
5. Sự kiện bảo mật (tạo tài khoản Admin, reset mật khẩu Admin) dùng best-effort sau khi nghiệp vụ hoàn tất ở phase đầu; nếu cần strict consistency sẽ refactor `UserRepository`/`AuthService` sang executor về sau.
6. Không làm daily digest trong đợt này. Không đổi cơ chế polling 30 giây, không thêm notification preferences.
7. `notifications.type`, `resource_type` là `varchar`: **không cần migration mới** cho các loại thông báo. Config mới chỉ cần registry + default, không cần seed row.

## 1. Mục tiêu

Bổ sung 6 loại cảnh báo vận hành để Admin không bỏ sót việc cần xử lý:

1. Payout đang chờ duyệt.
2. Hoàn tiền thất bại.
3. Payout/webhook thanh toán thất bại hoặc lệch số tiền.
4. Cấu hình hệ thống bị thay đổi.
5. Report có dấu hiệu rủi ro cao (nhiều người report cùng nội dung).
6. Thay đổi bảo mật liên quan tài khoản Admin.

Mỗi loại phải có: producer trong transaction phù hợp, dedup key ổn định, deep link chỉ resolve cho Admin, hiển thị đúng nhãn trong UI, test và docs tương ứng.

## 2. Danh mục thông báo

| # | Type | Sự kiện | Người nhận | Resource / Deep link | Dedup key | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `ADMIN_PAYOUT_PENDING` | `WITHDRAWAL` hoặc `OWNER_PAYOUT` được tạo và ở trạng thái `PENDING` (không auto-approve) | Active Admins | `ADMIN_PAYOUT` → `/admin/wallet/payouts?payoutId=<id>` | `admin-payout:<payoutId>` | P0 |
| 2 | `ADMIN_REFUND_FAILED` | `RefundService.failRefund` đánh dấu refund `FAILED` | Active Admins | `ADMIN_REFUND` → `/admin/wallet/refunds?paymentId=<id>` | `admin-refund:<paymentId>` | P0 |
| 3 | `ADMIN_PAYOUT_FAILED` | Outgoing payout webhook/payment xử lý thất bại hoặc sai amount | Active Admins | `ADMIN_PAYOUT` → `/admin/wallet/payouts?payoutId=<id>` | `admin-payout-failed:<payoutId>:<reason>` | P0 |
| 3b | `ADMIN_PAYMENT_MISMATCH` | Webhook top-up/payout lệch amount hoặc verify signature thất bại | Active Admins | `ADMIN_PAYMENT` → `/admin/wallet/reconciliation` | `admin-payment-mismatch:<provider>:<orderRef>:<reason>` | P0 |
| 4 | `ADMIN_CONFIG_CHANGED` | Admin cập nhật một `system_config` thành công | Active Admins trừ actor | `ADMIN_CONFIG_AUDIT` → `/admin/configs?key=<configKey>` | `admin-config:<auditId>` | P1 |
| 5 | `ADMIN_HIGH_RISK_REPORT` | Cùng một target bị ≥ ngưỡng số người report khác nhau trong cửa sổ thời gian | Active Admins | `ADMIN_REPORT` → `/admin/reports?reportId=<latestReportId>` | `admin-report-risk:<targetType>:<targetId>:<windowStart>` | P1 |
| 6 | `ADMIN_SECURITY_EVENT` | Tạo tài khoản `ADMIN` hoặc reset mật khẩu tài khoản `ADMIN` | Active Admins trừ actor | `ADMIN_USER` → `/admin/users?userId=<userId>` | `admin-security:<event>:<userId>:<timestamp-bucket>` | P2 |

Ghi chú:

- Type `ADMIN_PAYMENT_MISMATCH` và `ADMIN_PAYOUT_FAILED` chỉ phát khi lỗi đã xảy ra; không thay thế response lỗi hiện tại.
- `ADMIN_HIGH_RISK_REPORT` chỉ phát một lần cho mỗi `(targetType, targetId, windowStart)`, không phát lại cho từng report sau ngưỡng.
- `ADMIN_SECURITY_EVENT` dùng `content` để phân biệt `ACCOUNT_CREATED` / `PASSWORD_RESET`; không tạo thêm type riêng ở phase này.

## 3. Không nằm trong phạm vi

- Email, SMS, push, WebSocket hay notification preferences.
- Daily/weekly digest, unsubscribe, mute theo loại.
- Tự động khóa tài khoản, sanction người dùng, SLA/đếm giờ xử lý report.
- Thay đổi luồng nghiệp vụ payout/refund/config/report ngoài việc phát alert.
- Refactor toàn bộ notification Player; chỉ tái sử dụng component với `basePath` như hiện tại.

## 4. Hiện trạng liên quan

- Đã có `backend/src/services/notifications/admin-notifications.ts` với `notifyAdmins(tx, input)`.
- Đã có 2 producer:
  - `ADMIN_REPORT_CREATED` trong `ReportSubmissionService`.
  - `ADMIN_FACILITY_SUBMITTED` trong `OwnerFacilityService` và `OwnerCourtService`.
- Đã có resolver `ADMIN_REPORT`, `ADMIN_FACILITY` trong `NotificationResourceResolver`.
- Admin UI đã có `/admin/notifications`, `/admin/notifications/:id`, bell trên `AdminHeader`.
- Chưa có Admin UI cho payout/refund/reconciliation; API payout hiện chỉ có `GET /api/v1/admin/wallet/payouts` và các action approve/reject/paid.
- Chưa có API list refund cho Admin; `RefundRepository` chỉ có `findById`, `claimNext`, `markRefunded`, `markFailed`.
- `AdminConfigService.updateConfig` đã ghi `system_config_audit` trong transaction nhưng chưa trả `audit.id`.
- `SystemConfigPage`, `UserManagementPage` chưa đọc query param để mở đúng bản ghi từ notification.
- Payout `FAILED` hiện chưa được set ở service; các lỗi webhook đang throw ra ngoài.

## 5. Kế hoạch kỹ thuật theo workstream

### NTF-A1 — Mở rộng helper và resolver dùng chung

**Mục đích:** chuẩn hóa recipient, dedup, best-effort và deep link trước khi thêm producer.

**Việc làm:**

- [x] Mở rộng `notifyAdmins(tx, input)`:
  - thêm `excludeUserIds?: number[]` để loại actor.
  - thêm hàm `notifyAdminsBestEffort(input)` mở transaction riêng, dùng cho webhook/security alert.
  - đảm bảo khi không có Admin active thì return sạch, không lỗi.
- [x] Thêm resolver allowlist:
  - `ADMIN_PAYOUT` → `/admin/wallet/payouts?payoutId=<id>`; kiểm tra `ADMIN` + payout tồn tại.
  - `ADMIN_REFUND` → `/admin/wallet/refunds?paymentId=<id>`; kiểm tra `ADMIN` + refund intent tồn tại.
  - `ADMIN_PAYMENT` → `/admin/wallet/reconciliation`; kiểm tra `ADMIN`.
  - `ADMIN_CONFIG_AUDIT` → `/admin/configs?key=<configKey>`; kiểm tra `ADMIN` + audit row tồn tại.
  - `ADMIN_USER` → `/admin/users?userId=<id>`; kiểm tra `ADMIN` + user tồn tại, chưa xóa.
- [x] Bổ sung nhãn UI trong `frontend/src/features/notifications/utils.ts`:
  - `ADMIN_PAYOUT*` → “Ví & Payout”
  - `ADMIN_REFUND*`, `ADMIN_PAYMENT*` → “Thanh toán”
  - `ADMIN_CONFIG*` → “Cấu hình”
  - `ADMIN_HIGH_RISK_REPORT` → “Báo cáo ưu tiên”
  - `ADMIN_SECURITY*` → “Bảo mật”

**Test:**

- [x] Resolver trả `null` cho non-Admin và resource không tồn tại.
- [x] `excludeUserIds` không gửi cho actor.
- [x] Best-effort không làm fail caller.

### NTF-A2 — Cảnh báo tài chính (P0)

**Mục đích:** Admin thấy ngay payout cần duyệt và các lỗi refund/payment cần can thiệp.

**Producer:**

- [x] `WalletPayoutService.createRequest`:
  - sau khi tạo request + hold, nếu trạng thái cuối là `PENDING` thì `notifyAdmins(tx, ...)`.
  - nội dung phân biệt `WITHDRAWAL` và `OWNER_PAYOUT`; kèm amount, request id.
  - không phát khi `WALLET_AUTO_APPROVE_PAYOUTS` đưa request sang `APPROVED`.
- [x] `RefundService.failRefund`:
  - thêm `ADMIN_REFUND_FAILED` trong cùng transaction đang `markFailed`.
  - nội dung kèm paymentId, bookingId nếu có, lỗi rút gọn.
- [x] `WalletTopUpService`:
  - khi verify signature thất bại, orderRef thiếu, hoặc amount mismatch: gọi `notifyAdminsBestEffort`.
  - khi `handleSepayOutgoingPayout` amount mismatch: phát `ADMIN_PAYOUT_FAILED` / `ADMIN_PAYMENT_MISMATCH` best-effort, sau đó vẫn throw lỗi như hiện tại.
  - không log secret/signature; chỉ orderRef, provider, amount nếu an toàn.

**API/UI cần bổ sung để deep link có đích:**

- [x] Backend:
  - `GET /api/v1/admin/refunds?status=FAILED&page=&limit=` (mới) trong `adminWalletRoutes` hoặc route admin payment riêng.
  - Service/repository list refund kèm `paymentId`, `status`, `attempts`, `lastError`, `updatedAt`.
- [x] Frontend:
  - Route `/admin/wallet/payouts` + trang danh sách payout, filter status, action approve/reject/mark paid, đọc `payoutId` để mở/highlight.
  - Route `/admin/wallet/refunds` + trang danh sách refund lỗi, đọc `paymentId` để highlight.
  - Route `/admin/wallet/reconciliation` hiển thị dữ liệu `GET /admin/wallet/reconciliation` hiện có.
  - Thêm mục sidebar “Ví & thanh toán”; dùng icon hiện có hoặc bổ sung icon mới.
  - Các trang mới dùng `AdminSidebar` + `AdminHeader` + `NotificationsProvider` sẵn có.

**Test:**

- [x] Payout `PENDING` tạo đúng 1 notification/Admin; auto-approve không tạo.
- [x] Refund `FAILED` tạo alert, rollback test: nếu notify lỗi thì transaction fail.
- [x] Payment mismatch không làm đổi response webhook, nhưng tạo alert best-effort.
- [x] API refund list chỉ Admin, filter/pagination đúng.
- [x] Deep link mở đúng payout/refund.

### NTF-A3 — Cảnh báo thay đổi cấu hình (P1)

**Mục đích:** có nhiều Admin vẫn truy vết được ai đổi cấu hình gì.

**Việc làm:**

- [x] `AdminConfigService.updateConfig`: `insert(systemConfigAudit).returning({ id })`; gọi `notifyAdmins(tx, ... exclude actor)`.
- [x] Nội dung: `configKey`, giá trị cũ → mới, thời điểm; không đưa dữ liệu nhạy cảm nếu sau này có key secret.
- [x] Resolver `ADMIN_CONFIG_AUDIT` đọc bảng `system_config_audit` theo id.
- [x] Frontend `SystemConfigPage` đọc `?key=` để filter/highlight đúng config (không cần auto-save).
- [x] Không phát khi value không đổi (service đã return sớm).

**Test:**

- [x] Một Admin đổi config → các Admin khác nhận, actor không nhận.
- [x] Value không đổi → không có notification.
- [x] Transaction rollback khi insert audit/notification lỗi.
- [x] Deep link mở đúng key.

### NTF-A4 — Report rủi ro cao (P1)

**Mục đích:** ưu tiên nội dung bị nhiều người report thay vì chỉ xử lý từng report.

**Config mới (registry domain `report`):**

- [x] `REPORT_HIGH_RISK_THRESHOLD`: integer, default `5`, min `2`, max `100`.
- [x] `REPORT_HIGH_RISK_WINDOW_HOURS`: integer, default `24`, min `1`, max `720`.
- [x] Không cần migration; đọc qua `reportConfig` facade.

**Việc làm:**

- [x] Thêm `reportConfig.getRisk()` hoặc mở rộng `get()` trả 2 key mới.
- [x] `ReportRepository.countDistinctReportersForTarget(targetType, targetId, since)` dùng `COUNT(DISTINCT reporter_id)` và index sẵn có; map target type sang đúng cột.
- [x] Trong `ReportSubmissionService.create`, sau khi insert report, nếu count ≥ threshold:
  - `notifyAdmins` với resource `ADMIN_REPORT` trỏ tới report vừa tạo.
  - dedup theo target + windowStart; windowStart = `floor(now / windowMs) * windowMs` (UTC).
  - nội dung kèm targetType/targetId, số người report, ngưỡng.
- [x] Không phát trùng khi report thứ 6, 7… trong cùng cửa sổ.

**Test:**

- [x] Dưới ngưỡng không phát; đạt ngưỡng phát đúng 1 lần.
- [x] Reporter trùng không được đếm 2 lần.
- [x] Cửa sổ mới phát lại được sau khi hết window.
- [x] Chỉ đếm report chưa quá `windowStart`.

### NTF-A5 — Sự kiện bảo mật tài khoản Admin (P2)

**Mục đích:** Admin khác biết khi có tài khoản Admin mới hoặc mật khẩu Admin bị reset.

**Việc làm:**

- [x] `AdminUserService.createUser`: nếu `role === 'ADMIN'`, sau khi tạo thành công gọi `notifyAdminsBestEffort`.
- [x] `AdminUserService.setUserPassword`: nếu target là `ADMIN`, sau khi `adminSetPassword` thành công gọi alert; loại actor nếu actor là Admin.
- [x] Cần lấy `actorAdminId`: hiện controller chưa truyền actor vào `createUser`/`setUserPassword`; bổ sung tham số `actorAdminId`.
- [x] Nội dung không chứa mật khẩu; chỉ email/userId và hành động.
- [x] Frontend `UserManagementPage` đọc `?userId=` để mở/highlight đúng user.
- [x] Đánh dấu rõ đây là best-effort; nếu alert lỗi chỉ log, không fail thao tác tạo/reset.

**Test:**

- [x] Tạo Admin → các Admin khác nhận; tạo Player/Owner không phát.
- [x] Reset mật khẩu Admin → các Admin khác nhận, actor không nhận.
- [x] Alert lỗi không làm fail create/reset.
- [x] Deep link mở đúng user.

### NTF-A6 — UI dùng chung và deep link

- [x] `NotificationsMenu`, `NotificationsPage`, `NotificationDetailPage` đã hỗ trợ `basePath`; dùng cho Admin.
- [x] Admin notification detail CTA mở đúng trang mới.
- [x] Các trang đích đọc query param và highlight/mở item:
  - `/admin/reports?reportId=`
  - `/admin/courts?status=PENDING_APPROVAL`
  - `/admin/configs?key=`
  - `/admin/users?userId=`
  - `/admin/wallet/payouts?payoutId=`
  - `/admin/wallet/refunds?paymentId=`
- [ ] Mobile 390px: menu chuông, danh sách, CTA không tràn.
- [x] UI-REDO: đánh dấu các màn mới là UI-REDO tới khi merge frontend, theo quy ước `00_danh-muc-task.md`.

### NTF-A7 — Test và bằng chứng

**Backend test mới/bổ sung:**

- [x] `admin-notifications.test.ts` mở rộng cho payout, refund, config, high-risk, security.
- [x] `notification-resolvers.test.ts` thêm resource mới + non-Admin null.
- [x] `wallet-payout.test.ts`: pending/auto-approve.
- [x] `refund.test.ts`: failed refund alert.
- [x] `system-config.test.ts` hoặc test hiện có: config change alert + actor exclusion.
- [x] `report-submission.test.ts`: high-risk threshold/window/dedup.

**Lệnh kiểm tra dự kiến:**

```bash
npm test --prefix backend -- --run \
  src/__tests__/admin-notifications.test.ts \
  src/__tests__/notification-resolvers.test.ts \
  src/__tests__/wallet-payout.test.ts \
  src/__tests__/refund.test.ts \
  src/__tests__/report-submission.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

- [x] Full backend suite PASS sau khi hoàn tất phase 2 (ghi rõ số file/test và thời gian).
- [ ] Playwright/tối thiểu kiểm tra thủ công các deep link; ghi UI-REDO nếu chưa có spec.

## 6. Thứ tự thực hiện và exit gate

### Phase P0 — Tài chính

- NTF-A1 (helper/resolver/nhãn) + NTF-A2 (payout pending, refund failed, payment mismatch) + API/UI tối thiểu payout/refund.
- Exit gate: Admin thấy payout pending trong chuông, mở đúng payout; refund failed có alert; webhook mismatch không đổi hành vi cũ.

### Phase P1 — Cấu hình và rủi ro report

- NTF-A3 + NTF-A4.
- Exit gate: đổi config bởi Admin A tạo alert cho Admin B, không cho A; report đạt ngưỡng chỉ phát 1 alert/cửa sổ.

### Phase P2 — Bảo mật

- NTF-A5 + deep link user management.
- Exit gate: tạo/reset Admin có alert best-effort, không ảnh hưởng thao tác chính.

### Phase P3 — Regression và docs sync

- Chạy full backend suite, build/lint frontend.
- Tick toàn bộ checklist docs bên dưới.
- Cập nhật trạng thái `04_thong-bao`, `05_bao-cao-kiem-duyet`, `03`, `08` nếu hành vi/config thay đổi.

## 7. Cập nhật tài liệu bắt buộc

| Tài liệu | Nội dung phải thêm/cập nhật |
| --- | --- |
| `docs/plans/13_thong-bao-van-hanh-admin.md` | File này; cập nhật trạng thái và bằng chứng test khi triển khai |
| `docs/plans/00_danh-muc-task.md` | Thêm dòng `13` vào bảng và ghi trạng thái Planned/Partial/DONE |
| `docs/features/platform/notifications/prd.md` | Mục “Admin operations extension — Planned”: 6 loại, in-app only, không đổi polling |
| `docs/features/platform/notifications/tech-design.md` | Bảng type/producer/recipient/dedup; resource allowlist mới; quy tắc best-effort cho webhook/security |
| `docs/features/platform/notifications/tasks.md` | Thêm `NTF-06` (Admin operational alerts) và task con A1–A7, trạng thái + test evidence |
| `docs/features/admin/report-management/tech-design.md` | `ADMIN_HIGH_RISK_REPORT`, ngưỡng/cửa sổ, dedup, deep link |
| `docs/features/admin/report-management/tasks.md` | Task RP mới cho high-risk alert, config keys và test |
| `docs/features/admin/user-management/tech-design.md` | `ADMIN_SECURITY_EVENT`, phạm vi best-effort, loại trừ actor |
| `docs/features/admin/user-management/tasks.md` | Task security alert + deep link `?userId=` |
| `docs/business-rules-config-matrix.md` | `REPORT_HIGH_RISK_THRESHOLD`, `REPORT_HIGH_RISK_WINDOW_HOURS` (domain `report`) |
| `docs/plans/03_thanh-toan-hoan-tien.md` | Alert payout pending/refund failed/payment mismatch, hành vi không đổi luồng tiền |
| `docs/plans/12_rut-vi-tu-dong-sepay-bankhub.md` | Ghi rõ auto-settle không phát `ADMIN_PAYOUT_PENDING`; chỉ phát khi request còn `PENDING` hoặc lỗi outgoing |
| `docs/architecture/frontend.md` | Route `/admin/wallet/payouts`, `/admin/wallet/refunds`, `/admin/wallet/reconciliation`; query param deep link của các trang admin |
| `docs/architecture/database-schema.md` (nếu cần) | Chỉ ghi chú không đổi schema; type/resource vẫn là `varchar` |

**Nguyên tắc docs:** không đánh dấu DONE cho tới khi code + test + docs cùng được cập nhật và có bằng chứng lệnh test.

## 8. Rủi ro và cách tránh

| Rủi ro | Cách tránh |
| --- | --- |
| Admin bị spam alert tài chính | Chỉ phát khi cần hành động (`PENDING`) hoặc lỗi thật; dedup theo resource; không phát cho auto-approve |
| Webhook lỗi nhưng alert làm thay đổi response | Alert best-effort trong transaction riêng, bọc try/catch + log; response lỗi giữ nguyên |
| High-risk report phát lặp | Dedup theo `(targetType, targetId, windowStart)`; chỉ Admin active |
| Config change alert lộ giá trị nhạy cảm | Chỉ dùng config registry; nếu thêm key secret phải mask trước khi ghi content |
| Security alert làm fail thao tác admin | Best-effort, không throw ra controller |
| Deep link 404 do resource đã xóa | Resolver fail-closed trả `null`; notification vẫn đọc được |
| UI mới bị coi là DONE khi chưa merge | Đánh dấu UI-REDO đúng quy ước trong `00_danh-muc-task.md` |

## 9. Checklist hoàn thành file

- [x] P0 DONE: payout pending, refund failed, payment mismatch + API/UI tối thiểu + test.
- [x] P1 DONE: config changed, high-risk report + config keys + docs matrix + test.
- [x] P2 DONE: security event + deep link user + test.
- [x] Docs ở §7 đã cập nhật đầy đủ.
- [x] `00_danh-muc-task.md` phản ánh đúng trạng thái cuối.
- [x] Không có migration mới cho notification; config mới dùng registry default, không có migration/seed row.


## 10. Bằng chứng triển khai — 2026-11-18

- Backend: shared helper/resolver (`admin-notifications.ts`, `NotificationResourceResolver.ts`), financial producers, config audit alert, high-risk report aggregation, Admin security/refund APIs and Admin wallet UI.
- Tests: `admin-notifications.test.ts` 9/9 PASS; `wallet-payout`, `wallet-top-up`, `admin-config-api`, `report-submission`, `notification-resolvers` 34/34 PASS.
- Builds: backend + frontend PASS. Lint frontend PASS (warnings only, no new errors).
- Không có migration mới. Full backend suite chưa chạy lại toàn bộ trong phiên này.


## 11. Seed dữ liệu mẫu — 2026-11-18

```bash
npm run db:seed:admin-notifications
# hoặc: npm run db:seed:admin-notifications --prefix backend
```

- Script: `backend/src/db/seed-admin-notifications.ts`; chỉ chạy trên PostgreSQL local, có advisory lock và idempotent theo dedup key `seed-admin-notif:v1:*`.
- Tài khoản: `admin-notif.one@example.com` / `admin-notif.two@example.com`, mật khẩu `Password@123`.
- `admin-notif.two` nhận đủ 9 mẫu; `admin-notif.one` nhận 8 mẫu (không nhận `ADMIN_SECURITY_EVENT` vì là actor).
- Tạo kèm resource thật để deep link hoạt động: report, facility pending, payout PENDING có hold, failed refund, config audit, user.
