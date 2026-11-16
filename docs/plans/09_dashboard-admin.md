# 09 — Dashboard Admin

- Ưu tiên: 09
- Track/Phase: Track E / Phase 1
- Prerequisite: 01 G0, 02 INF-00
- Exit gate: 3 endpoint dashboard + UI thật; index migration; RBAC/caching đúng
- Mở khóa: không chặn module khác; phục vụ vận hành

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Thay placeholder `/admin/dashboard` bằng dashboard đọc-only có KPI, chart tăng trưởng và recent activities từ dữ liệu thật. Module độc lập, có thể chạy song song ngay sau INF-00.

## 2. Điểm cần chốt

- [ ] **AD-D1:** range cố định `today | 7d | 30d | this_month`.
- [ ] **AD-D2:** định nghĩa KPI theo Tech Design (period vs snapshot).
- [ ] **AD-D3:** 9 index đã duyệt; không thêm index ngoài danh sách.
- [ ] **AD-D4:** recent activities limit 10–20, không phân trang.
- [ ] **AD-D5:** chart dùng SVG/CSS thuần; không thêm chart library.
- [ ] **AD-D6:** cache `private, max-age=30, must-revalidate` cho KPI/charts.
- [ ] **AD-D7:** KPI “estimated revenue” phải label là ước tính, không phải doanh thu kế toán.

## 3. Danh sách task chi tiết

### [ ] E1 — AD-01: Indexes + repository + KPI service

**Mục đích:** có dữ liệu aggregate nhanh và đúng định nghĩa.

**Việc làm:**

- [ ] Migration 9 index theo Tech Design §10:
  - [ ] `USERS (role, status, created_at)`.
  - [ ] `FACILITIES (status, created_at)`.
  - [ ] `COURTS (facility_id, status)`.
  - [ ] `BOOKINGS (created_at)`.
  - [ ] `BOOKINGS (status, booking_date)`.
  - [ ] `REPORTS (status, created_at)`.
  - [ ] `TOURNAMENTS (status, created_at)`.
  - [ ] `TOURNAMENT_REGISTRATIONS (status, registered_at)`.
  - [ ] `PAYMENTS (paid_at)`.
- [ ] Drizzle schema không khai báo lại bảng; chỉ index.
- [ ] Aggregate repository: chỉ trả aggregate rows, không raw entity.
- [ ] `DashboardService`:
  - [ ] resolve range.
  - [ ] KPI users/facilities/pending approvals/bookings/revenue/tournaments/reports.
  - [ ] chart daily users/bookings.
  - [ ] recent activities union.
- [ ] Test SQL trên DB có fixtures: range boundary, deleted rows, status counts, doubles count 2 players.

**Acceptance:**

- [ ] KPI khớp số liệu fixture.
- [ ] Range không hợp lệ → lỗi validate.
- [ ] Không query entity thô ra service.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/dashboard-service.test.ts
```

### [ ] E2 — AD-02: API

**Mục đích:** endpoint ổn định cho UI.

**Việc làm:**

- [ ] `GET /api/v1/admin/dashboard/kpis?range=`.
- [ ] `GET /api/v1/admin/dashboard/charts?range=`.
- [ ] `GET /api/v1/admin/dashboard/recent-activities?limit=`.
- [ ] Zod validation range/limit; lỗi `ADMIN_DASHBOARD_INVALID_RANGE`.
- [ ] `authenticate` + `requireRole('ADMIN')`.
- [ ] Response shape camelCase theo convention (trừ khi D2 áp riêng Reports).
- [ ] Cache-Control đúng.
- [ ] Test 401/403/400/200; empty data; limit bounds.

**Acceptance:**

- [ ] 3 endpoint trả đúng shape.
- [ ] Player/Court Owner 403.
- [ ] Range invalid 400.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/dashboard-api.test.ts
```

### [ ] E3 — AD-03/04: UI — UI-REDO

**Mục đích:** Admin thấy dashboard thật.

**Việc làm:**

- [ ] Trang `/admin/dashboard`, dùng layout Admin hiện có.
- [ ] KPI bento cards theo nhóm; label estimated revenue.
- [ ] TimeRangeSelector 4 lựa chọn; đổi range refetch tất cả widget.
- [ ] Growth chart SVG/CSS; legend, tooltip accessible.
- [ ] Recent activities list, link tới module nếu route có.
- [ ] States loading/empty/error; refresh.
- [ ] Responsive desktop/mobile; không horizontal overflow.
- [ ] Playwright: login Admin → KPI → đổi range → recent activity → navigate.

**Acceptance:**

- [ ] Dashboard thay placeholder.
- [ ] Đổi range cập nhật đúng.
- [ ] Empty state không giả số liệu.
- [ ] Không thêm chart lib.

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

- [ ] Index migration chạy fresh/populated.
- [ ] KPI/chart/activity khớp fixture.
- [ ] RBAC/validation/cache.
- [ ] UI-REDO — UI responsive + empty/error.
- [ ] Không có N+1 query; repository chỉ aggregate.

## 5. Checklist hoàn thành file

- [ ] E1→E3 xong.
- [ ] 9 index có migration.
- [ ] 3 endpoint hoạt động.
- [ ] UI-REDO — UI thay placeholder.
- [ ] Docs/tasks cập nhật AD-01→04.
- [ ] `09` DONE trong `00_danh-muc-task.md`.

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

- [ ] **E3:** giữ top KPI cards + chart + recent activities theo AD; bổ sung 3 nhóm còn thiếu so với Figma: Pending Approvals, Bookings, Revenue.
- [ ] **E3:** Figma chỉ có 4 card (Players, Facilities/Courts, Tournaments, Reports); spec AD yêu cầu đủ 6 nhóm — spec thắng.
- [ ] **E3:** thêm time-range selector và refresh; label revenue là “ước tính”.
- [ ] **E3:** bỏ “Geographic Court & Facility Distribution” (không có trong AD spec/không có geo data).
- [ ] **E3:** bỏ “System Audit Trail” khỏi dashboard (audit thuộc System Config; chưa có API dashboard).
- [ ] **E3:** bỏ “Hệ thống vận hành ổn định/Uptime 99.98%” (số liệu giả).
- [ ] **E3:** chỉ render quick shortcuts nếu route tương ứng đã tồn tại; không tạo route mới.
- [ ] **E3 test:** Playwright: 6 KPI, đổi range, chart, recent activities, empty/error; không có geo/audit/uptime.

**Loại bỏ khỏi UI:**

- [ ] Geographic distribution card, System Audit Trail card, uptime banner, shortcut đến route chưa có.

**Cập nhật checklist hoàn thành:**

- [ ] Dashboard có đủ KPI theo AD Tech Design.
- [ ] Không có geo/audit/uptime.
