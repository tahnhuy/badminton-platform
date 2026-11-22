# 09 — Dashboard Admin

- Ưu tiên: 09
- Track/Phase: Track E / Phase 1
- Prerequisite: 01 G0, 02 INF-00
- Exit gate: 3 endpoint dashboard + UI thật; index migration; RBAC/caching đúng
- Mở khóa: không chặn module khác; phục vụ vận hành

> **Trạng thái 2026-11-19:** E1–E3 đã triển khai; backend tests `dashboard-service` + `dashboard-api` PASS, Playwright `playwright.admin-dashboard.config.ts` PASS.
>
> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Thay placeholder `/admin/dashboard` bằng dashboard đọc-only có KPI, chart tăng trưởng và recent activities từ dữ liệu thật. Module độc lập, có thể chạy song song ngay sau INF-00.

## 2. Điểm cần chốt

- [x] **AD-D1:** range cố định `day | month | year | custom` (2026-11-19); `custom` bắt buộc `startDate`/`endDate` và `endDate > startDate`.
- [x] **AD-D2:** định nghĩa KPI theo Tech Design (period vs snapshot).
- [x] **AD-D3:** 9 index đã duyệt; không thêm index ngoài danh sách.
- [x] **AD-D4:** recent activities limit 10–20, không phân trang.
- [x] **AD-D5:** chart dùng SVG/CSS thuần; không thêm chart library.
- [x] **AD-D6:** cache `private, max-age=30, must-revalidate` cho KPI/charts.
- [x] **AD-D7:** KPI “estimated revenue” phải label là ước tính, không phải doanh thu kế toán.

## 3. Danh sách task chi tiết

### [x] E1 — AD-01: Indexes + repository + KPI service

**Mục đích:** có dữ liệu aggregate nhanh và đúng định nghĩa.

**Việc làm:**

- [x] Migration 9 index theo Tech Design §10:
  - [x] `USERS (role, status, created_at)`.
  - [x] `FACILITIES (status, created_at)`.
  - [x] `COURTS (facility_id, status)`.
  - [x] `BOOKINGS (created_at)`.
  - [x] `BOOKINGS (status, booking_date)`.
  - [x] `REPORTS (status, created_at)`.
  - [x] `TOURNAMENTS (status, created_at)`.
  - [x] `TOURNAMENT_REGISTRATIONS (status, registered_at)`.
  - [x] `PAYMENTS (paid_at)`.
- [x] Drizzle schema không khai báo lại bảng; chỉ index.
- [x] Aggregate repository: chỉ trả aggregate rows, không raw entity.
- [x] `DashboardService`:
  - [x] resolve range.
  - [x] KPI users/facilities/pending approvals/bookings/revenue/tournaments/reports.
  - [x] chart daily users/bookings.
  - [x] recent activities union.
- [x] Test SQL trên DB có fixtures: range boundary, deleted rows, status counts, doubles count 2 players.

**Acceptance:**

- [x] KPI khớp số liệu fixture.
- [x] Range không hợp lệ → lỗi validate.
- [x] Không query entity thô ra service.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/dashboard-service.test.ts
```

### [x] E2 — AD-02: API

**Mục đích:** endpoint ổn định cho UI.

**Việc làm:**

- [x] `GET /api/v1/admin/dashboard/kpis?range=`.
- [x] `GET /api/v1/admin/dashboard/charts?range=`.
- [x] `GET /api/v1/admin/dashboard/recent-activities?limit=`.
- [x] Zod validation range/limit; lỗi `ADMIN_DASHBOARD_INVALID_RANGE`.
- [x] `authenticate` + `requireRole('ADMIN')`.
- [x] Response shape camelCase theo convention (trừ khi D2 áp riêng Reports).
- [x] Cache-Control đúng.
- [x] Test 401/403/400/200; empty data; limit bounds.

**Acceptance:**

- [x] 3 endpoint trả đúng shape.
- [x] Player/Court Owner 403.
- [x] Range invalid 400.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/dashboard-api.test.ts
```

### [x] E3 — AD-03/04: UI — UI-REDO

**Mục đích:** Admin thấy dashboard thật.

**Việc làm:**

- [x] Trang `/admin/dashboard`, dùng layout Admin hiện có.
- [x] KPI bento cards theo nhóm; label estimated revenue.
- [x] `TimeRangeFilter` global (shared `components/common`) 4 lựa chọn Ngày này/Tháng này/Năm này/Khoảng; đổi range refetch tất cả widget; custom chặn ngày kết thúc không sau ngày bắt đầu.
- [x] Growth chart SVG/CSS; legend, tooltip accessible.
- [x] Bổ sung 6 biểu đồ (2026-11-19): doanh thu ước tính theo ngày, trạng thái booking, heatmap giờ × thứ, top cơ sở, báo cáo theo loại, trạng thái giải đấu — tất cả SVG/CSS thuần, không thêm dependency.
- [x] Recent activities list, link tới module nếu route có.
- [x] States loading/empty/error; refresh.
- [x] Responsive desktop/mobile; không horizontal overflow.
- [x] Playwright: login Admin → KPI → đổi range → recent activity → navigate.

**Acceptance:**

- [x] Dashboard thay placeholder.
- [x] Đổi range cập nhật đúng.
- [x] Empty state không giả số liệu.
- [x] Không thêm chart lib.

**Test đầu ra:**

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.admin-dashboard.config.ts
```

## 4. Test đầu ra toàn track

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/dashboard-service.test.ts
npm test --prefix backend -- --run src/__tests__/dashboard-api.test.ts
npm run build --prefix backend
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin-dashboard.config.ts
```

- [x] Index migration chạy fresh/populated.
- [x] KPI/chart/activity khớp fixture.
- [x] RBAC/validation/cache.
- [x] UI-REDO — UI responsive + empty/error.
- [x] Không có N+1 query; repository chỉ aggregate.

## 5. Checklist hoàn thành file

- [x] E1→E3 xong.
- [x] 9 index có migration.
- [x] 3 endpoint hoạt động.
- [x] UI-REDO — UI thay placeholder.
- [x] Docs/tasks cập nhật AD-01→04.
- [x] `09` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| KPI sai định nghĩa period/snapshot | Test fixture theo từng range |
| Query nặng thiếu index | Đúng 9 index đã duyệt; EXPLAIN kiểm tra |
| Chart thêm dependency | SVG/CSS thuần |
| Số liệu giả khi rỗng | Empty state thật, không mock |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc: A01 Admin Dashboard `12:73936`.

**Chốt:** theo AD Tech Design, không copy widget Figma-only.

**Bổ sung vào task:**

- [x] **E3:** giữ top KPI cards + chart + recent activities theo AD; bổ sung 3 nhóm còn thiếu so với Figma: Pending Approvals, Bookings, Revenue.
- [x] **E3:** Figma chỉ có 4 card (Players, Facilities/Courts, Tournaments, Reports); spec AD yêu cầu đủ 6 nhóm — spec thắng.
- [x] **E3:** thêm time-range selector và refresh; label revenue là “ước tính”.
- [x] **E3:** bỏ “Geographic Court & Facility Distribution” (không có trong AD spec/không có geo data).
- [x] **E3:** bỏ “System Audit Trail” khỏi dashboard (audit thuộc System Config; chưa có API dashboard).
- [x] **E3:** bỏ “Hệ thống vận hành ổn định/Uptime 99.98%” (số liệu giả).
- [x] **E3:** chỉ render quick shortcuts nếu route tương ứng đã tồn tại; không tạo route mới.
- [x] **E3 test:** Playwright: 6 KPI, đổi range, chart, recent activities, empty/error; không có geo/audit/uptime.

**Loại bỏ khỏi UI:**

- [x] Geographic distribution card, System Audit Trail card, uptime banner, shortcut đến route chưa có.

**Cập nhật checklist hoàn thành:**

- [x] Dashboard có đủ KPI theo AD Tech Design.
- [x] Không có geo/audit/uptime.
