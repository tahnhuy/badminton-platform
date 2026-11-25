# 19 — Thông báo nhận cho Court Owner (Owner Inbox)

- Ngày lập kế hoạch: 2026-11-23
- Trạng thái: **IMPLEMENTED — P0 + P1 DONE (2026-11-23)**. PRD/Tech Design Notifications + Court Owner đã đồng bộ; code, test backend targeted, build và Playwright Owner đã chạy. Frontend lint còn một cảnh báo `check:ui` có sẵn ở `OwnerWalletPage` ngoài phạm vi plan này.
- Track/Phase: Track C (Notifications) + Court Owner
- Prerequisite: NTF-01…NTF-05 DONE; session auth/role `COURT_OWNER`; Booking/Payment/Owner/Admin review APIs hiện có
- Exit gate: Owner thấy chuông + danh sách + chi tiết thông báo; producer tạo đúng một thông báo cho mỗi sự kiện; deep link mở đúng màn Owner và không cấp quyền; test + build PASS
- Mở khóa: Owner không còn phải tự làm mới lịch/ví để biết booking mới, booking bị hủy, tiền về hoặc hồ sơ được duyệt
- Tài liệu liên quan:
  - [Notifications PRD](../features/platform/notifications/prd.md)
  - [Notifications Tech Design](../features/platform/notifications/tech-design.md)
  - [Notifications Tasks](../features/platform/notifications/tasks.md)
  - [Court Owner PRD](../features/court-owner/prd.md)
  - [Court Owner Tech Design](../features/court-owner/tech-design.md)
  - [Court Owner Tasks](../features/court-owner/tasks.md)
  - [Frontend architecture](../architecture/frontend.md)
  - [Plan 04 — Thông báo](./04_thong-bao.md)

> **Vì sao cần kế hoạch riêng:** nền notification đã có và dùng được cho mọi role, nhưng hiện **không có producer nào gửi cho Court Owner**, **không có resource resolver cho màn Owner**, và `/owner` **chưa bọc `NotificationsProvider`**. Đây là tính năng mới về nghiệp vụ (danh mục sự kiện Owner được nhận), không phải chỉ nối UI, nên phải chốt phạm vi trước khi code.

## 0. Quyết định đã chốt

| ID | Nội dung | Quyết định | Trạng thái |
| --- | --- | --- | --- |
| OWN-D1 | Danh mục sự kiện P0 cho Owner | `OWNER_BOOKING_CREATED`, `OWNER_BOOKING_CANCELLED`, `OWNER_PAYOUT_APPROVED/REJECTED/PAID` | ĐÃ CHỐT |
| OWN-D2 | Thời điểm báo booking mới | Chỉ khi booking chuyển `CONFIRMED` (đã thanh toán). Không báo hold `PENDING_PAYMENT` để tránh nhiễu | ĐÃ CHỐT |
| OWN-D3 | Hủy booking nào thì báo Owner | P0: chỉ Player tự hủy (`mode = PLAYER`). Không báo Owner tự hủy, hủy do Match/system hoặc hold hết hạn trong kế hoạch này | ĐÃ CHỐT |
| OWN-D4 | Trạng thái payout báo Owner | `APPROVED`, `REJECTED`, `PAID`, gồm auto-approve. Không báo `PENDING`; chưa đưa `FAILED` vào phạm vi | ĐÃ CHỐT |
| OWN-D5 | Sự kiện P1 | `OWNER_EARNING_CREDITED`, `OWNER_EARNING_REVERSED`, kết quả duyệt/từ chối hồ sơ cơ sở/sân | ĐÃ CHỐT |

Quy ước nội dung: không đưa email/số điện thoại/ghi chú nội bộ vào title/content. Owner xem liên hệ người đặt trong màn chi tiết booking vốn đã được kiểm quyền. Không sao chép `payout.adminNote` vào thông báo; payout bị từ chối chỉ báo mã, số tiền và trạng thái. Hồ sơ cơ sở/sân dùng `rejectionReason` vốn được công khai cho Owner. Lý do hủy do người dùng nhập phải được giới hạn độ dài và loại bỏ thông tin liên hệ; không đưa nguyên văn dữ liệu tự do vào notification.

Danh mục đã chốt gồm **11 type**: 5 type P0 và 6 type P1. P1 đã được duyệt về phạm vi, chưa có nghĩa là đã triển khai. Không bổ sung thông báo khác khi chưa có yêu cầu mở rộng.

## 1. Mục tiêu

1. Court Owner nhận thông báo in-app cho các sự kiện vận hành thuộc cơ sở của mình.
2. Có chuông + badge chưa đọc, trang danh sách, trang chi tiết và deep link trong `/owner`.
3. Mỗi sự kiện chỉ tạo đúng một thông báo cho mỗi Owner, kể cả khi callback/retry lặp.
4. Link từ thông báo không cấp quyền: mở lại phải kiểm tra Owner hiện còn sở hữu resource.
5. Không thêm hạ tầng mới: dùng bảng `NOTIFICATIONS`, polling 30 giây và API hiện có.

## 2. Hiện trạng (đã kiểm tra code)

| Hạng mục | Hiện trạng | Bằng chứng |
| --- | --- | --- |
| API notifications | Đã caller-scoped cho mọi role đăng nhập; `GET /notifications`, `/unread`, `/:id`, `POST /:id/read`; không cần API mới | `backend/src/routes/notifications/notificationRoutes.ts`, `backend/src/services/notifications/NotificationQueryService.ts` |
| Persistence | Transaction-aware, dedup `UNIQUE(user_id, dedup_key)`, rollback theo transaction | `backend/src/services/notifications/NotificationService.ts` |
| Resolver | Allowlist chưa có resource type nào của Owner | `backend/src/services/notifications/NotificationResourceResolver.ts` |
| Producer cho Owner | Không có. Booking chỉ báo Player; payout/earning/hồ sơ chỉ báo Admin | `booking.service.ts:759`, `WalletPayoutService.ts:65`, `OwnerEarningService.ts:208`, `OwnerFacilityService.ts:35` |
| UI Owner | `/owner` chưa bọc `NotificationsProvider`; `OwnerHeader` có chuông placeholder ghi “tính năng chưa được kết nối” | `frontend/src/app/router.tsx:167`, `frontend/src/features/court-owner/components/OwnerHeader.tsx:16` |
| UI dùng lại được | `NotificationsMenu`, `NotificationsPage`, `NotificationDetailPage`, context polling đã nhận `basePath` | `frontend/src/features/notifications/` |
| Deep link lịch | `OwnerSchedulePage` chưa đọc `bookingId` từ query; `BookingDetailPanel` đã mở được theo id | `frontend/src/features/court-owner/pages/OwnerSchedulePage.tsx` |

Lưu ý: `docs/features/court-owner/tasks.md` đang ghi CO-05 `BLOCKED` trong khi plan 06 đã ghi backend CO-05 xong. Kế hoạch này không sửa trạng thái đó; khi triển khai phải đồng bộ lại tài liệu theo thực tế.

## 3. Phạm vi

**Trong phạm vi**

- Producer notification cho các sự kiện P0 và các sự kiện P1 đã chốt, triển khai sau P0.
- Recipient resolution theo chủ sở hữu facility/booking/payout/settlement.
- Resource resolver + deep link cho màn Owner.
- Owner inbox UI dùng lại component notification hiện có.
- Test backend targeted, resolver, frontend build/lint/UI-check và Playwright.

**Ngoài phạm vi**

- Push/email/SMS/WebSocket; bulk mark-read; notification preferences.
- Bảng/schema mới hoặc migration.
- Inbox riêng theo từng facility (một inbox theo user, lọc theo facility khi mở link).
- Thay đổi luồng nghiệp vụ Owner/Booking/Payment; chỉ thêm notification trong transaction hiện có.
- Thông báo cho Tournament Organizer hoặc thay đổi Admin inbox.

## 4. Thiết kế đã chốt

### 4.1 Danh mục sự kiện P0

| Type | Producer (transaction hiện có) | Recipient | Resource | Dedup key |
| --- | --- | --- | --- | --- |
| `OWNER_BOOKING_CREATED` | `BookingService.confirmBookingInTransaction` khi booking chuyển `CONFIRMED` (không phải nhánh `EXPIRED`) | `facilities.owner_id` của booking | `OWNER_BOOKING` id = bookingId | `owner-booking-created:<bookingId>` |
| `OWNER_BOOKING_CANCELLED` | `BookingService.cancelBookingTransaction` khi `mode = PLAYER` | Owner của facility chứa booking | `OWNER_BOOKING` id = bookingId | `owner-booking-cancelled:<bookingId>` |
| `OWNER_PAYOUT_APPROVED` | `WalletPayoutService.approve` và nhánh auto-approve trong `createRequest`, chỉ `requestType = OWNER_PAYOUT` | `payout.user_id` | `OWNER_PAYOUT` id = payoutId | `owner-payout:<payoutId>:approved` |
| `OWNER_PAYOUT_REJECTED` | `WalletPayoutService.reject` | `payout.user_id` | `OWNER_PAYOUT` id = payoutId | `owner-payout:<payoutId>:rejected` |
| `OWNER_PAYOUT_PAID` | `WalletPayoutService.markPaid` | `payout.user_id` | `OWNER_PAYOUT` id = payoutId | `owner-payout:<payoutId>:paid` |

Nội dung đã chốt:

- Booking mới: mã booking, tên sân, ngày, khung giờ, số tiền; không kèm email/số điện thoại.
- Booking bị hủy: mã booking, ngày/giờ, lý do hủy đã làm sạch, câu “khung giờ đã được giải phóng”.
- Payout: mã payout, số tiền, trạng thái thực tế ; không đưa `adminNote` vào thông báo.

### 4.2 Sự kiện P1 (đã chốt, triển khai sau P0)

| Type | Producer | Recipient | Resource | Dedup key |
| --- | --- | --- | --- | --- |
| `OWNER_EARNING_CREDITED` | `OwnerEarningService.settleBooking` (auto) và `approve()` (Admin duyệt tay) | `settlement.owner_id` | `OWNER_EARNING` id = settlementId | `owner-earning:<settlementId>` |
| `OWNER_EARNING_REVERSED` | `OwnerEarningService.handlePaymentRefund` và `reverse()` thủ công, chỉ khi thực sự ghi nợ thu hồi thành công | `settlement.owner_id` | `OWNER_EARNING` id = settlementId | `owner-earning-reversal:<bookingId>` |
| `OWNER_FACILITY_REVIEW_APPROVED` / `_REJECTED` | `FacilityReviewService.decide` cho cơ sở: `ONBOARDING` và `ADDRESS_CHANGE`, không có `courtId` | `facility.owner_id` | `OWNER_FACILITY` id = facilityId | `owner-facility-review:<reviewId>` |

Bổ sung kết quả duyệt sân:

| Type | Producer | Recipient | Resource | Dedup key |
| --- | --- | --- | --- | --- |
| `OWNER_COURT_REVIEW_APPROVED` / `OWNER_COURT_REVIEW_REJECTED` | `FacilityReviewService.decide` cho `ONBOARDING` có `courtId` | Owner của facility chứa sân | `OWNER_COURT` id = courtId | `owner-court-review:<reviewId>` |

- `OWNER_FACILITY_REVIEW_APPROVED` và `OWNER_FACILITY_REVIEW_REJECTED` dùng chung nhóm cho onboarding cơ sở và đổi địa chỉ; title/content phải phân biệt loại hồ sơ.
- Một lần quyết định review chỉ gửi một kết quả cho đúng đối tượng cơ sở hoặc sân, không gửi cả hai.
- Thu hồi tự động/thủ công dùng chung dedup `owner-earning-reversal:<bookingId>`. Không gửi khi thiếu số dư, chỉ từ chối settlement chưa được cộng tiền, hoặc phát hiện đã thu hồi từ trước.
- Nhánh `reverse()` thủ công phải được kiểm tra để notification và ghi nợ cùng transaction; không gửi sau commit bằng transaction riêng.
- Không tạo `OWNER_PAYOUT_FAILED` trong kế hoạch này; cảnh báo lỗi webhook cho Admin không đồng nghĩa payout đã chuyển trạng thái `FAILED`.

### 4.3 Recipient resolution, transaction và lock order

Tạo helper mới `backend/src/services/notifications/owner-notifications.ts`, theo mẫu `admin-notifications.ts`:

- `notifyBookingOwner(tx, bookingId, input)`: resolve `facilities.owner_id` bằng dữ liệu booking; nếu Owner không tồn tại hoặc đã soft-delete thì bỏ qua.
- `notifyPayoutOwner(tx, payoutId, input)`: chỉ chấp nhận `requestType = OWNER_PAYOUT`; recipient là `user_id` của payout.
- `notifyOwnerEarning(tx, settlement, input)`: recipient là `settlement.owner_id`.
- `notifyFacilityOwner(tx, facilityId, input)`: recipient là `facilities.owner_id`.
- Mỗi helper gọi `notificationService.notify(tx, [{ recipientId, ... }])`, không mở transaction riêng.

**Lock order bắt buộc:** thêm notification Owner vào transaction có sẵn nghĩa là insert thêm FK tới `USERS` của Owner. Các luồng booking hiện lock `USERS(player) → BOOKING`; phải lock thêm `USERS(owner)` **trước** `BOOKING` và theo thứ tự id tăng dần:

- Dùng `bookingRepository.lockUsersAscending([playerId, facilityOwnerId], tx)` ở đầu transaction.
- Áp dụng cho: `confirmBooking()` (transaction tự tạo), luồng thanh toán ví trong `payment.service.ts`, `processMockPaymentConfirm`, `cancelBookingTransaction` và luồng chia tiền `MatchBookingSplitService` gọi `confirmBookingInTransaction`.
- Rà toàn bộ caller của `confirmBookingInTransaction` trước khi sửa. Với matchmaking, gộp facility Owner vào tập user hiện có (host, thành viên, người đặt), loại trùng và khóa tăng dần ngay từ đầu; giữ thứ tự `USERS → REQUEST → MATCH → BOOKING`. Không khóa Player trước rồi mới khóa Owner bằng một lượt riêng.
- Rà cả payout, earning và facility/court review khi bổ sung FK notification; bảo toàn thứ tự khóa của từng transaction, không mặc định các luồng hiện tại đã khóa Owner trước resource.
- `confirmBookingInTransaction` chỉ insert notification; không tự lock Owner sau khi đã lock Booking. Caller chịu trách nhiệm lock đủ hai user trước Booking.
- Nếu không lock đúng, một transaction lock Owner muộn có thể deadlock với luồng Admin duyệt payout/owner earning đang lock Owner trước.

Ghi chú: `notifyBooking` hiện đã lock Player theo cùng nguyên tắc (`booking.service.ts:616`); mở rộng sang facility Owner phải giữ invariant của cả Booking và Matchmaking.

### 4.4 Resource resolver và deep link

Thêm vào allowlist `NotificationResourceResolver.ts`:

| resourceType | Điều kiện mở | `resourcePath` |
| --- | --- | --- |
| `OWNER_BOOKING` | `viewer.role = COURT_OWNER`; `ownerBookingReadRepository.detail(viewer.id, id)` trả row; facility chưa xóa | `/owner/schedule?facilityId=<facilityId>&bookingId=<bookingId>&date=<bookingDate>` |
| `OWNER_PAYOUT` | `viewer.role = COURT_OWNER`; payout tồn tại, `requestType = OWNER_PAYOUT`, `userId = viewer.id` | `/owner/wallet` |
| `OWNER_EARNING` | `viewer.role = COURT_OWNER`; settlement tồn tại, `ownerId = viewer.id` | `/owner/wallet` |
| `OWNER_FACILITY` | `viewer.role = COURT_OWNER`; `ownerFacilityRepository.find(viewer.id, id)` trả row | `/owner/facilities?facilityId=<facilityId>` |

Bổ sung resource sân:

| resourceType | Điều kiện mở | `resourcePath` |
| --- | --- | --- |
| `OWNER_COURT` | `viewer.role = COURT_OWNER`; sân và facility chưa xóa, facility thuộc viewer | `/owner/facilities?facilityId=<facilityId>&courtId=<courtId>` |

Bổ sung `facilityId: facilities.id` vào `selection` của `OwnerBookingReadRepository` để resolver dựng link mà không đổi response API (không đưa field này vào `bookingSummary` nếu chưa cần).

### 4.5 Frontend

- Bọc route `/owner` (và các route con) bằng `NotificationsProvider` trong `frontend/src/app/router.tsx`.
- Thay chuông placeholder trong `OwnerHeader.tsx` bằng `<NotificationsMenu basePath="/owner/notifications" />`.
- Thêm route con:
  - `/owner/notifications` → `NotificationsPage` với `basePath="/owner/notifications"`.
  - `/owner/notifications/:id` → `NotificationDetailPage` với `basePath="/owner/notifications"`.
- `notificationTypeLabel` thêm nhánh `OWNER_BOOKING`, `OWNER_PAYOUT`, `OWNER_EARNING`, `OWNER_FACILITY`, `OWNER_COURT`.
- `OwnerSchedulePage` đọc `bookingId` và `date` từ query. Validate id/ngày; đối chiếu ngày và facility bằng booking detail được kiểm quyền trước khi mở drawer. Lịch và drawer phải cùng ngày, cùng facility.
- Đóng drawer thì xóa `bookingId` khỏi query; đổi ngày/cơ sở thì bỏ query detail cũ, không tự mở lại drawer do polling/render. Khi Back/Forward, đồng bộ lại theo URL. Link không còn quyền hoặc resource đã xóa phải hiện trạng thái không thể mở, không tự chuyển sang booking/cơ sở khác.
- `OwnerFacilityPage` đọc `courtId` sau khi tải đúng facility, mở phần sửa/chi tiết sân tương ứng; đổi cơ sở hoặc đóng phần chi tiết thì bỏ `courtId`.
- Không thêm tab/category mới; giữ All/Unread, phân trang và polling 30 giây hiện có.
- Deep link payout/earning mở `/owner/wallet`; nếu muốn highlight dòng payout, thêm query `payoutId` ở task UI riêng, không chặn P0.

### 4.6 API/schema impact

- Không thêm endpoint, bảng, cột hay migration.
- Thêm giá trị application-level cho `notifications.type` và `resource_type`; ghi vào Notifications Tech Design.
- API detail notification giữ nguyên shape; chỉ có thêm `resourcePath` khi type/resource mới được resolve.

## 5. Task breakdown

### OWN-01 — Helper producer Owner + recipient resolution (M)

- Tạo `backend/src/services/notifications/owner-notifications.ts`.
- Resolve recipient trong transaction; bỏ qua user đã xóa; không lọc role ở bước insert (resolver kiểm role khi mở).
- Test: đúng recipient, không gửi nhầm Owner khác, rollback khi insert lỗi, dedup khi gọi lặp.

### OWN-02 — Producer booking created/cancelled (M)

- Sửa `booking.service.ts` tại `confirmBookingInTransaction` và `cancelBookingTransaction`.
- Lock `USERS(player) + USERS(owner)` tăng dần trước `BOOKING` ở các entry point nêu tại §4.3.
- Chỉ báo created khi `CONFIRMED`; chỉ báo cancelled khi `mode = PLAYER` (P0).
- Test: booking thanh toán ví/mock tạo đúng một thông báo; Player hủy tạo đúng một thông báo; Owner tự hủy không tạo thông báo cho chính Owner; retry không nhân đôi; rollback notification rollback booking.

### OWN-03 — Producer payout Owner (S)

- Sửa `WalletPayoutService.approve/reject/markPaid` và nhánh auto-approve trong `createRequest`.
- Chỉ áp dụng `requestType = OWNER_PAYOUT`; không gửi cho `WITHDRAWAL` của Player.
- Test: approve/reject/paid mỗi trạng thái đúng một thông báo; replay idempotent; không báo khi tạo yêu cầu PENDING.

### OWN-04 — Producer P1 earning/facility/court review (M, đã chốt)

- Sửa `OwnerEarningService` (auto credit, approve, reversal tự động và thủ công cùng transaction) và `FacilityReviewService.decide`.
- Nội dung duyệt/từ chối hồ sơ phải kèm lý do từ chối nếu có.
- Test: credit/duyệt tay/reversal; duyệt/từ chối facility và court; không báo trùng khi Admin bấm lại.

### OWN-05 — Resolver + deep link (S)

- Thêm 5 resource type tại §4.4.
- Test trong `notification-resolvers.test.ts`: Owner khác → `resourcePath: null`; role khác → null; booking/facility/payout bị xóa hoặc không thuộc Owner → null; notification của người khác vẫn 404.
- Test link booking chứa đúng `facilityId`, `bookingId`, `date`; link sân chứa đúng `facilityId`, `courtId`.

### OWN-06 — Owner inbox UI (M)

- `router.tsx`: provider + 2 route con.
- `OwnerHeader.tsx`: dùng `NotificationsMenu`.
- `utils.ts`: nhãn type Owner.
- `OwnerSchedulePage.tsx`: mở detail đúng ngày từ query và dọn query khi đóng/đổi ngữ cảnh; `OwnerFacilityPage.tsx`: mở đúng sân theo `courtId`.
- Test UI: chuông hiển thị badge; danh sách/chi tiết; mark-read giảm badge; empty/error/retry; mobile 390 px và desktop 1280 px; không vỡ layout.

### OWN-07 — Đồng bộ tài liệu (S, thực hiện trước code và cập nhật khi hoàn tất)

- Notifications PRD/tech-design/tasks: thêm extension Owner, bảng type/resource/dedup, task `NTF-08`.
- Court Owner PRD/tech-design/tasks: thêm capability nhận thông báo, task `CO-09` (hoặc số kế tiếp thực tế).
- `docs/architecture/frontend.md`: thêm `/owner/notifications` và `/owner/notifications/:id` vào route map.
- `docs/plans/00_danh-muc-task.md`: thêm dòng 19.
- Ghi chú đồng bộ trạng thái CO-05/CO-08 nếu vẫn lệch giữa tasks và plan 06.

### OWN-08 — Verification/E2E (M)

- Backend targeted tests + build.
- Frontend build, lint, `check:ui`; thêm file mới vào `frontend/ui-check.config.json`.
- Playwright: sửa `testMatch` của `playwright.court-owner.config.ts` để chạy cả `court-owner-cancel.spec.ts` và `owner-notifications.spec.ts` (hiện chỉ match file cancel); thêm `owner-notifications.spec.ts`, dùng mock API cho UI và một luồng thật với backend/DB nếu môi trường cho phép.

## 6. Test matrix

```bash
npm test --prefix backend -- --run \
  src/__tests__/owner-notifications.test.ts \
  src/__tests__/booking-notifications.test.ts \
  src/__tests__/notification-resolvers.test.ts \
  src/__tests__/owner-cancellation.test.ts

npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

Playwright (sau khi thêm spec):

```bash
cd frontend && npx playwright test --config playwright.court-owner.config.ts
```

Các case bắt buộc:

- Booking `CONFIRMED` → đúng một `OWNER_BOOKING_CREATED`; booking `EXPIRED` không tạo.
- Player hủy → đúng một `OWNER_BOOKING_CANCELLED`; Owner hủy → không gửi cho Owner.
- Payout `APPROVED`/`REJECTED`/`PAID` → đúng một thông báo mỗi transition; replay không nhân đôi.
- Owner A không đọc được notification của Owner B (404).
- Mở link `OWNER_BOOKING` của Owner khác → `resourcePath: null`; notification cũ vẫn đọc được.
- Notification insert lỗi → transaction domain rollback (theo contract hiện có).
- Không có email/số điện thoại hoặc `adminNote` trong title/content, kể cả dữ liệu tự do chứa thông tin liên hệ.
- Thanh toán chia tiền xác nhận booking → đúng một thông báo; test concurrency với hủy booking, payout/earning và kiểm tra lock order.
- Thu hồi tự động/thủ công cùng booking → tối đa một thông báo; thiếu số dư hoặc replay không báo thành công.
- Duyệt/từ chối cơ sở, đổi địa chỉ, sân → đúng type, reviewId dedup và link; replay quyết định không tạo trùng.
- Link booking quá khứ/tương lai mở đúng ngày; đóng/đổi ngày/đổi cơ sở và Back/Forward không mở lại detail sai.
- Link sân mở đúng phần chi tiết/sửa sân; sân đã xóa hoặc đổi chủ không có resourcePath.
- Playwright phải liệt kê được `owner-notifications.spec.ts` bằng config trước khi xác nhận E2E PASS.

## 7. Rủi ro và biên

| Rủi ro | Xử lý |
| --- | --- |
| Deadlock do FK lock `USERS` của Owner | Lock cả player + owner tăng dần trước `BOOKING`; test confirm/cancel đồng thời |
| Notification lỗi làm rollback payment/booking | Giữ contract hiện có (notification là một phần transaction); test rollback; không dùng best-effort cho sự kiện nghiệp vụ |
| Gửi nhầm Player withdrawal thành Owner payout | Lọc `requestType = OWNER_PAYOUT` ở producer và resolver |
| Link cấp quyền ngoài ý muốn | Resolver kiểm role + quan hệ sở hữu tại thời điểm mở; lỗi/không tìm thấy → `null` |
| Owner bị xóa/khóa | Bỏ qua insert nếu user không tồn tại/đã xóa; notification cũ vẫn đọc được nếu còn quyền |
| Nhiễu do quá nhiều sự kiện | P0 chỉ 3 nhóm; earning/facility/court review để P1 đã chốt theo OWN-D5 |
| `/owner` polling tăng tải | Dùng đúng context 30 giây hiện có; pause khi tab ẩn; không thêm polling riêng |
| Link booking chọn sai facility | Resolver luôn kèm `facilityId`; `OwnerLayout` chỉ chấp nhận facility thuộc Owner |

## 8. Thứ tự thực hiện đã chốt

1. OWN-D1…OWN-D5 đã chốt theo xác nhận của chủ dự án. Thực hiện OWN-07: cập nhật Notifications + Court Owner PRD/Tech Design sang Ready theo phạm vi này; không yêu cầu duyệt lại các quyết định đã chốt.
2. OWN-01 → OWN-02 → OWN-03 (P0 backend).
3. OWN-05 resolver.
4. OWN-06 frontend inbox.
5. OWN-08 verification P0.
6. OWN-04 P1 đã duyệt phạm vi; mở rộng OWN-05/06/08 cho P1 và cập nhật OWN-07 theo kết quả thực tế.

## 9. Acceptance criteria tổng

- **Given** Owner đang ở `/owner` **When** có booking mới đã thanh toán **Then** badge tăng ở lần polling kế tiếp (chu kỳ 30 giây khi tab đang hiển thị và API hoạt động; tab ẩn tải lại khi quay lại) và mở được chi tiết booking từ thông báo.
- **Given** Player hủy booking **When** Owner mở thông báo **Then** thấy mã booking, ngày/giờ, lý do và mở đúng lịch của cơ sở.
- **Given** Admin duyệt/từ chối/đánh dấu đã chuyển payout Owner **When** Owner mở `/owner` **Then** nhận đúng thông báo trạng thái và mở được ví.
- **Given** notification của Owner khác hoặc resource không còn thuộc Owner **When** mở **Then** không có link/404, không lộ nội dung resource.
- **Given** callback/retry lặp **When** producer chạy lại **Then** không có thông báo trùng.
- **Given** notification insert lỗi **When** transaction rollback **Then** booking/payout state cũng rollback.
- Không thêm migration, endpoint hay dependency mới.


## 10. Bằng chứng triển khai — 2026-11-23

- Backend: `owner-notifications.ts`, producer booking/payout/earning/review, resolver `OWNER_*`, lock `USERS` trước resource.
- Frontend: `/owner` bọc `NotificationsProvider`; bell dùng `NotificationsMenu`; `/owner/notifications`, `/owner/notifications/:id`; deep link `bookingId`/`date`/`courtId` có kiểm tra facility và ngày.
- Backend targeted PASS: `owner-notifications` 10/10; `booking-notifications`; `owner-cancellation`; `notification-resolvers`; `owner-earning-settlement`; `wallet-payout`; `admin-notifications`; `booking-payment`; `matchmaking-payment-lock`; `match-booking-split`.
- Build: `npm run build --prefix backend` PASS; `npm run build --prefix frontend` PASS.
- Playwright: `owner-notifications` 5/5 PASS; `owner-shell-ui`, `owner-schedule-ui`, `owner-facilities-ui` 40/40 PASS.
- Lint: ESLint chỉ còn warning hiện hữu; `check:ui` báo `OwnerWalletPage.tsx:163 [off-scale-radius]` có sẵn từ working tree trước batch này, không sửa vì ngoài phạm vi.
