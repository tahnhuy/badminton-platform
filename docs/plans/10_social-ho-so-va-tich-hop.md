# 10 — Social hoàn thiện, Profile và tích hợp

- Ưu tiên: 10
- Track/Phase: Track H / Phase 3–4
- Prerequisite: 05 Reports (RP-06/07/08), 04 Notifications, 06 Booking/MM (cho SOC-05), 07 Tournament (cho PP-05/RT-05)
- Exit gate: Social E2E thật; Profile đầy đủ; các phần consolidation/rating giải đấu theo quyết định
- Mở khóa: không; đây là lớp hoàn thiện cuối

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Đóng các khoảng trống còn lại sau khi Social lõi, Reports, Notifications và Tournament đã xong: filter theo sân booking, E2E thật, profile đầy đủ, admin frontend consolidation và rating trong giải đấu.

## 2. Điểm cần chốt

- [ ] **H-D1:** filter khu vực dùng cả external court và booking venue sau MM-19.
- [ ] **H-D2:** E2E thật dùng DB test reset, không intercept API.
- [ ] **H-D3:** PP-05 Tournament chỉ mở khi có participant-facing Tournament Match Detail.
- [ ] **H-D4 (D8):** AF-01→03 chỉ làm nếu Tech Design Ready.
- [ ] **H-D5:** RT-05 dùng tournament match detail riêng, không mở rộng casual endpoint.
- [ ] **H-D6:** không thêm chat entry/group shortcut từ Social nếu chưa có spec.

## 3. Danh sách task chi tiết

### [ ] H1 — SOC-05: Filter theo sân booking

**Mục đích:** filter khu vực không bỏ sót kèo gắn booking.

**Việc làm:**

- [ ] Rà `RecruitmentRepository.feedFilter`.
- [ ] Thêm nhánh lọc theo booking facility/court khi booking đã link (MM-19).
- [ ] Giữ filter external court cho kèo ngoài hệ thống.
- [ ] Không trả kèo trùng khi cả hai nguồn khớp.
- [ ] Test: kèo external, kèo booking, kèo cả hai; city/district; không có booking.
- [ ] Cập nhật Tech Design §7.6 nếu cần.

**Acceptance:**

- [ ] Filter thành phố/quận trả đúng cả hai loại sân.
- [ ] Không thay đổi kết quả cũ với kèo external.
- [ ] Không N+1 query.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/social-feed-filter.test.ts
```

### [ ] H2 — SOC-09: E2E Social thật

**Mục đích:** chứng minh Social hoạt động với DB/backend thật, không chỉ contract test.

**Kịch bản bắt buộc:**

- [ ] Publish free post + image → feed → react → comment → edit → delete.
- [ ] Match-finding creation → apply/invite → chấp nhận → feed/detail đúng quyền.
- [ ] Author xóa kèo active → cancellation flow → post ẩn.
- [ ] Admin hide post/comment → feed/detail 404.
- [ ] Report post/comment → Admin evidence → hide.
- [ ] Quota free post/comment; replay idempotency; media authorization.
- [ ] Social gate off: đọc/delete/report vẫn đúng, create/edit/comment/reaction bị chặn.
- [ ] Desktop 1280px + mobile 390px.

**Acceptance:**

- [ ] Tất cả kịch bản PASS với backend + DB thật.
- [ ] Không còn test chỉ intercept API cho các luồng trên.
- [ ] Reset DB trước/sau test hoặc dùng DB cô lập.

**Test đầu ra:**

```bash
cd frontend && npx playwright test --config playwright.social-e2e.config.ts
```

### [ ] H3 — PP-01/02/05: Profile hoàn tất

**Mục đích:** profile có aggregate non-null và mở được từ Tournament.

**Việc làm:**

- [ ] PP-01: aggregate stats không trả null không cần thiết; fallback cho user mới.
- [ ] PP-02: API profile trả contract ổn định; không field giả.
- [ ] UI-REDO — PP-05: mở public profile modal từ Tournament participant/match.
- [ ] Test: user chưa có trận; có rating; có tournament; privacy.
- [ ] Cập nhật `profile/tasks.md` PP-01/02/05.

**Acceptance:**

- [ ] Profile không crash với dữ liệu thiếu.
- [ ] Public profile từ Tournament hiển thị đúng.
- [ ] Không lộ dữ liệu private.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/player-profile.test.ts
cd frontend && npx playwright test --config playwright.profile.config.ts
```

### [ ] H4 — AF-01→03: Admin frontend consolidation (chỉ sau D8)

**Mục đích:** thống nhất pagination/http client/layout Admin.

**Việc làm:**

- [ ] AF-01: admin user list trả `meta` đúng chuẩn chung.
- [ ] AF-02: admin services dùng `httpClient` chung.
- [ ] AF-03: `AdminLayout` ở router level.
- [ ] Không đổi UI/hành vi ngoài consolidation.
- [ ] Test regression Admin users/facilities/reports/config/dashboard.

**Nếu D8 chưa Ready:** không làm; giữ pattern hiện tại. Không chặn task khác.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin.config.ts
```

### [ ] H5 — RT-05: Rating trong Tournament Match — UI-REDO

**Mục đích:** participant đánh giá sau trận giải đấu thật.

**Prerequisite:** G10 Tournament Match Detail.

**Việc làm:**

- [ ] Gắn rating component vào Tournament Match Detail.
- [ ] Chỉ participant thực tế, trận completed hợp lệ.
- [ ] Dùng Match ID thật, không dùng bracket-link ID.
- [ ] Không mở rộng casual endpoint.
- [ ] `TOURNAMENT_RATING_ENABLED` gate; `WALKOVER/NONE/UNRESOLVED` không ratable.
- [ ] Test eligible/ineligible; privacy; idempotent.

**Acceptance:**

- [ ] Chỉ trận hợp lệ cho rating.
- [ ] Casual và Tournament tách route/scope.
- [ ] Không ảnh hưởng nâng trình (theo D1c).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/ratings-tournament.test.ts
cd frontend && npx playwright test --config playwright.ratings.config.ts
```

### [ ] H6 — Tài liệu và trạng thái

- [ ] Cập nhật `social/tasks.md` SOC-05/08/09.
- [ ] Cập nhật `profile/tasks.md`.
- [ ] `admin/frontend-consolidation/tasks.md` theo D8.
- [ ] `ratings/tasks.md` RT-05.
- [ ] Ghi rõ phần nào defer và lý do.

## 4. Test đầu ra toàn track

```bash
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.social-e2e.config.ts
cd frontend && npx playwright test --config playwright.profile.config.ts
cd frontend && npx playwright test --config playwright.ratings.config.ts
```

- [ ] Social E2E thật PASS.
- [ ] Profile đầy đủ.
- [ ] AF chỉ PASS nếu D8 Ready.
- [ ] Rating Tournament đúng scope.
- [ ] UI-REDO — Không còn placeholder Social/Profile liên quan.

## 5. Checklist hoàn thành file

- [ ] H1→H6 xong (hoặc defer có lý do cho H4).
- [ ] SOC-05 filter cả booking venue.
- [ ] SOC-09 E2E thật.
- [ ] PP-01/02/05 DONE.
- [ ] RT-05 DONE khi Tournament có match detail.
- [ ] AF quyết định rõ làm/hoãn.
- [ ] Docs cập nhật.
- [ ] `10` DONE/PARTIAL trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Filter trùng kèo | DISTINCT/EXISTS theo postId; test |
| E2E lại là contract test | Bắt buộc backend+DB thật, không route intercept |
| AF đổi layout gây vỡ Admin | Chỉ làm sau D8; regression toàn Admin |
| RT-05 mở rộng casual | Tách route/feature scope |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc/đối chiếu: Social feed `99:43349`, post detail `99:43550`, composer `99:43701`, states `99:44308`, report/evidence `99:44643`, mobile `99:45192`, `99:45274`; P25/P32/P56 cho rating.

**Chốt:** Social UI hiện có giữ nguyên composition; chỉ bổ sung test/state còn thiếu.

**Bổ sung vào task:**

- [ ] **H2:** E2E bao phủ states: empty/loading/error, unavailable/hidden, ended, quota, gate off, report success/error, mobile 390px.
- [ ] **H2:** không có report upload tùy ý, SLA/hotline/FairPlay, chat entry/group shortcut, notification preferences.
- [ ] **H3 (PP-05):** profile modal chỉ dùng field đã duyệt; bỏ extra fields/ELO/uy tín/BWF trong P44/P85.
- [ ] **H5 (RT-05):** dùng Kỹ năng + Thái độ 1–5; bỏ ELO/MMR/FairPlay vote/ELO delta trong P25/P32/P56; chỉ tournament match đủ điều kiện.
- [ ] **H4 (AF):** không đổi UI ngoài consolidation; không dùng A19/Figma làm lý do mở rộng.
- [ ] **H2 test:** Playwright Social E2E thật với backend + DB; không route intercept.

**Loại bỏ khỏi UI:**

- [ ] Report upload/evidence tùy ý, SLA/hotline/FairPlay, chat group shortcut, ELO/FairPlay profile/rating.

**Cập nhật checklist hoàn thành:**

- [ ] H2 bao phủ state/gate/mobile.
- [ ] PP/RT không có ELO/FairPlay.
- [ ] Không thêm UI ngoài spec.
