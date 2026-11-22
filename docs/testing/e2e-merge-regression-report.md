# Báo cáo lỗi E2E sau khi merge develop vào integration-huy

- **Nhánh:** `integration-huy`
- **Commit mốc:** `6ae7151` (merge `966c417` + fix owner refund)
- **Thời điểm chạy:** 2026-11-20
- **Mục tiêu:** xác nhận các luồng nghiệp vụ cũ còn nguyên vẹn sau khi merge đợt
  refactor UI foundation từ `develop`.
- **Phạm vi:** Playwright E2E hiện có (mocked API + real backend + DB `badminton_test`).

## 0. Cách chạy và môi trường

- **Mocked UI tests** (`*-ui.spec.ts`, split-booking mocked, booking-link, social):
  chạy trên working tree hiện tại, Vite port riêng `5197`/`5198`, không cần backend.
- **Real backend tests**: chạy trong **git worktree tách biệt** tại `/tmp/e2e-run`
  (port backend `3001`, frontend `5174`, DB `postgres://...@localhost:5433/badminton_test`),
  để không đụng server dev đang dùng cho kiểm thử tay.
- Worktree đã được dọn sau khi chạy. Không có thay đổi nào được commit trong quá trình test.

Lệnh tham khảo:

```bash
# Mocked UI
npx playwright test --config playwright.sign-in.config.ts

# Mocked split-booking / booking-link / social (config tạm)
npx playwright test --config playwright.tmp-mocked.config.ts

# Real backend (worktree, port đã đổi 3001/5174)
npx playwright test --config playwright.admin-finance.config.ts
npx playwright test --config playwright.tmp-real2.config.ts   # booking + owner cancel
npx playwright test --config playwright.tmp-real3.config.ts   # dashboard/auth/ratings/smoke...
```

## 1. Tổng hợp kết quả

| Nhóm | Pass | Fail |
| --- | --- | --- |
| Mocked UI (`*-ui.spec.ts`) | 266 | 21 |
| Mocked split-booking / booking-link / social | 25 | 2 |
| Real: booking-payment, booking-match-e2e, court-owner-cancel | 6 | 0 |
| Real: admin-finance | 1 | 1 |
| Real: admin-dashboard, booking-flow, court-owner-flow, sign-in, forced-password-change, role-based-denial, ratings-real, smoke | 7 | 5 |

Kết luận nhanh:

- Các luồng **tiền và booking cốt lõi** (thanh toán ví, hoàn tiền, owner hủy, split booking real) **pass**.
- Có **2 lỗi thật** cần sửa: layout admin legacy vỡ (P0) và dashboard crash khi API trả rỗng/thiếu field (P1).
- Phần lớn fail còn lại là **spec kỳ vọng hành vi cũ** (nav 5 mục, báo cáo bị disable, CTA "Tìm sân cho nhóm", trang chủ `/`...) — cần cập nhật test, không phải bug ứng dụng.
- Còn **2 điểm cần điều tra** (ratings history, overflow 320px).

---

## 2. Lỗi thật — cần sửa

### BUG-01 (P0) — Layout admin legacy vỡ, nội dung nằm dưới sidebar fixed

**Khu vực:** Admin — Finance, Wallet, Approvals, Configs, Reports, Notifications, Dashboard.

**Triệu chứng**

- Click vào tab/nav trong các trang admin legacy bị chặn: Playwright báo phần tử bị
  `aside[aria-label="Thanh điều hướng quản trị"]` che và intercept pointer events.
- Test tiêu biểu: `admin-finance.spec.ts` › "Admin can open the finance console and navigate its base sections"
  (click link "Giao dịch" timeout 180s).

**Nguyên nhân**

- Trong đợt refactor, `develop` đã bỏ định nghĩa CSS của các class legacy:
  `.admin-layout`, `.admin-main-wrapper`, `.sidebar-collapsed`.
- Các trang legacy vẫn dùng các class này nên mất `margin-left`, nội dung hiển thị
  bắt đầu từ x=0 trong khi `AdminSidebar` mới là `position: fixed`, `width: 240px`,
  `z-60` → sidebar phủ lên nội dung và chặn click.

**Bằng chứng**

- Playwright call log: "`<a ... href="/admin/dashboard">` from `<aside aria-label="Thanh điều hướng quản trị" class="fixed ... z-60 ...">` subtree intercepts pointer events".
- Không còn rule CSS nào cho `.admin-main-wrapper` (đã kiểm tra toàn bộ `src/**/*.css`).

**File bị ảnh hưởng**

- `frontend/src/features/admin/finance/AdminFinancePage.tsx:868-869`
- `frontend/src/features/admin/wallet/AdminWalletPage.tsx:277-278`
- `frontend/src/features/admin/pages/FacilityApprovalPage.tsx:218-219`
- `frontend/src/features/admin/configs/pages/SystemConfigPage.tsx:302-303`
- `frontend/src/features/admin/reports/pages/ReportManagementPage.tsx:252-253`
- `frontend/src/features/admin/components/AdminNotificationLayout.tsx:17-18`
- `frontend/src/features/admin/dashboard/pages/AdminDashboardPage.tsx:31-32`

**Hướng sửa đề xuất**

- Migrate các trang trên sang component `AdminMain` (đã có sẵn và đang pass ở
  `UserManagementPage`, `CourtManagementPage`, `AdminPlaceholderPage`).
- Thay `<div className="admin-layout">` + `<div className="admin-main-wrapper ...">`
  bằng `AdminMain` với `isCollapsed` truyền vào, giữ nguyên `main` bên trong.
- Sau khi sửa, chạy lại `admin-finance` + `admin-dashboard` và kiểm tra click tab
  ở tất cả các trang legacy.

**Đã xử lý (2026-11-20):** Đã migrate 7 file trên sang `AdminMain` và thay wrapper
`.admin-layout` bằng `flex min-h-svh bg-background font-sans text-foreground`.
Không còn tham chiếu `admin-layout`, `admin-main-wrapper`, `sidebar-collapsed`
trong `src`. Kiểm chứng mocked ở 1280px: nội dung `main` bắt đầu sau sidebar 240px
và link "Giao dịch" ở Tài chính click được (không bị sidebar chặn) trên
`/admin/finance/overview`, `/admin/approvals`, `/admin/configs`, `/admin/reports`,
`/admin/notifications`; `tsc`, `lint`, `build` pass.

**Mức độ:** chặn thao tác hoàn toàn trên các màn admin legacy → phải sửa trước khi merge tiếp.

---

### BUG-02 (P1) — Admin dashboard crash khi API trả dữ liệu rỗng/thiếu field

**Khu vực:** `/admin/dashboard`.

**Triệu chứng**

- Trang rơi vào ErrorBoundary: `Unexpected Application Error!`
  `Cannot read properties of undefined (reading 'newUsers')`.
- Xảy ra khi API `/admin/dashboard/charts` trả `{ data: [] }` hoặc object thiếu `series`
  (ví dụ môi trường mocked trả catch-all `{ data: [], meta }`).

**Nguyên nhân**

- `AdminDashboardPage.tsx:82` đọc trực tiếp `charts.series.newUsers` /
  `charts.series.newBookings` mà không kiểm tra `series` tồn tại.
- Tương tự, các chart phụ có thể giả định shape cố định.

**File liên quan**

- `frontend/src/features/admin/dashboard/pages/AdminDashboardPage.tsx:82`
- `frontend/src/features/admin/dashboard/components/GrowthChart.tsx`
- `frontend/src/features/admin/dashboard/services/admin-dashboard-service.ts`

**Hướng sửa đề xuất**

- Guard: `const series = charts.series ?? { newUsers: [], newBookings: [] };`
  và truyền giá trị an toàn vào `GrowthChart`.
- Hoặc validate/normalize shape trong `admin-dashboard-service` trước khi set state
  (đảm bảo `series`, `newUsers`, `newBookings` luôn là mảng).
- Cân nhắc hiển thị empty state thay vì crash khi response không đúng shape.

**Đã xử lý (2026-11-20):** Chuẩn hoá payload tại boundary API bằng
`normalizeDashboardCharts` trong `admin-dashboard-service.ts`: `series` và toàn bộ
mảng con (`newUsers`, `newBookings`, `revenueByDay`, …) luôn là mảng, `range` giữ
giá trị hợp lệ. Nhờ đó các widget hiển thị trạng thái "no data" sẵn có thay vì crash.
Phần loading biểu đồ trong `AdminDashboardPage` được đổi sang primitive `Skeleton`
+ Tailwind/token (không thêm rule vào `@layer legacy`). Thêm regression spec
`frontend/e2e/admin-dashboard-ui.spec.ts` (4 pass: payload đầy đủ + `{ data: [] }`
+ thiếu `series` + `series: {}`); `tsc`, `lint`, `build` pass.

**Mức độ:** với backend thật hiện pass, nhưng dễ vỡ khi API lỗi/một phần → nên xử lý phòng thủ.

---

## 3. Fail do spec kỳ vọng hành vi cũ (cần cập nhật E2E, không phải bug app)

Các spec dưới đây được viết cho UI/hành vi trước khi ta thêm tính năng, nên cần cập nhật
kỳ vọng cho khớp sản phẩm hiện tại.

| Spec | Kỳ vọng cũ | Hành vi hiện tại (đúng) |
| --- | --- | --- |
| `admin-shell-ui.spec.ts` | nav có 5 mục | 8 mục (thêm Duyệt cơ sở, Tài chính, Cấu hình) |
| `owner-shell-ui.spec.ts` | nav có 5 mục | 6 mục (thêm Ví & thu nhập) |
| `player-shell-ui.spec.ts` | header 5 khu vực, không có nút Thông báo | có `NotificationsMenu` + thứ tự menu tài khoản thay đổi |
| `feed-ui.spec.ts` | menuitem "Báo cáo bài viết" bị disable + "đang hoàn thiện" | báo cáo đã bật (mở `ReportDialog`) |
| `match-detail-ui.spec.ts` | CTA "Tìm sân cho nhóm" → `/courts` | CTA "Tiến hành đặt sân" → `/matchmaking/matches/:id/book` |
| `account-pages-ui.spec.ts` | link "Về trang của bạn" của ADMIN → `/admin` | `/admin/dashboard` |
| `sign-in-ui.spec.ts` | ADMIN đăng nhập về `/admin/users` hoặc `/admin` | `/admin/dashboard`; PLAYER về `/feed` |
| `smoke.spec.ts` | link "Đăng ký người chơi" trên `/sign-in` | link "Tạo tài khoản" |
| `booking-checkout-ui.spec.ts` | "Đã hoàn ... về phương thức thanh toán gốc." | copy hoàn tiền mới theo ví ("hoàn tiền vào ví") |
| `booking-flow.spec.ts` | `getByText('E2E Badminton Club')` khớp 1 phần tử | UI tìm sân mới render 3 phần tử → strict mode violation, cần selector cụ thể hơn |
| `matchmaking-split-booking.spec.ts` | mock `/api/v1/courts` + shape `CourtSummary` | app gọi `/api/v1/facilities` (facility-paged) → cần cập nhật mock và shape |
| `court-owner-flow.spec.ts` | ô "Chọn cơ sở" thao tác được khi dialog mở | ô chọn cơ sở nằm trong trang, bị dialog che → cần đóng dialog hoặc đổi selector |

Ghi chú thêm:

- `sign-in-ui.spec.ts` responsive 320px fail do tràn ngang 2px — tách riêng ở mục 4.
- `sign-in-ui.spec.ts` "discards a saved route..." và "redirects ADMIN..." cùng nguyên nhân
  role-home ADMIN đổi sang `/admin/dashboard`.

---

## 4. Cần điều tra thêm (P2)

### INV-01 — Ratings history không hiển thị ở admin user detail

- Spec: `ratings-real.spec.ts:45`.
- Sau khi player đánh giá, mở admin user detail: không thấy text
  `Lịch sử điều chỉnh trình độ (1)`.
- Text này tồn tại trong `frontend/src/features/ratings/components/UserRatingsPanels.tsx:147`
  và được render qua `UserDetailsModal`.
- Cần kiểm tra: dữ liệu điều chỉnh trình độ có được tạo sau rating không (backend),
  hoặc panel có render nhưng text/heading khác sau merge.

### INV-02 — Tràn ngang 2px ở sign-in 320px

- Spec: `sign-in-ui.spec.ts:166` — `document.documentElement.scrollWidth = 322` tại viewport 320.
- Nghi do hero art/typography ở breakpoint hẹp. Không chặn chức năng nhưng cần xử lý
  để đảm bảo không cuộn ngang trên thiết bị nhỏ.

---

## 5. Thứ tự xử lý đề xuất

1. **BUG-01 (P0)**: migrate 7 trang admin legacy sang `AdminMain`; chạy lại `admin-finance`, `admin-dashboard`.
2. **BUG-02 (P1)**: guard `charts.series` trong dashboard; thêm empty state.
3. Cập nhật các spec ở mục 3 theo hành vi hiện tại (ưu tiên `admin-shell`, `owner-shell`, `matchmaking-split-booking`, `booking-flow`).
4. Điều tra INV-01, INV-02.
5. Chạy lại toàn bộ nhóm E2E và xác nhận.

## 6. Phụ lục — file log tham khảo

- Mocked UI: `/tmp/e2e-ui.txt`
- Mocked split/link/social: `/tmp/e2e-mocked-extra.txt`
- Real booking/payment/owner: `/tmp/e2e-real2.txt`
- Real admin-finance: `/tmp/e2e-real1.txt`
- Real dashboard/auth/ratings/smoke: `/tmp/e2e-real3.txt`

Các file log nằm ngoài repo (thư mục tạm), chỉ dùng để đối chiếu khi cần.
