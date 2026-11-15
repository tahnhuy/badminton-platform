# 04 — Thông báo

- Ưu tiên: 04
- Track/Phase: Track C / Phase 1
- Prerequisite: 01 G0 (D5), 02 INF-00; NTF-01→03 đã DONE
- Exit gate: UI thông báo hoạt động; resolver không cấp quyền; producer dedup đúng
- Mở khóa: BK-10, MM-10, MM-16, TRN-10, Social notification UX

## 1. Mục đích

Backend notification đã có (list/unread/detail/read + persistence transaction-aware), nhưng người dùng chưa thấy gì và notification chưa điều hướng được tới resource. Track này hoàn thiện lớp hiển thị và resolver an toàn, đồng thời nối các producer còn thiếu.

## 2. Điểm cần chốt

- [ ] **NTF-D1 (D5):** bảng `resourceType → route → quyền đọc`.
- [ ] **NTF-D2:** nguồn unread: đếm từ API hay cache; chọn API là source of truth.
- [ ] **NTF-D3:** polling 30 giây; pause khi tab hidden; không dùng WebSocket cho notification trong MVP.
- [ ] **NTF-D4:** không bulk mark-read ngoài spec.
- [ ] **NTF-D5:** resource bị xóa/ẩn → notification vẫn đọc được nhưng không có link hoạt động.
- [ ] **NTF-D6:** notification cho comment/reaction/recruitment dùng key đã có; không tạo type trùng.

## 3. Danh sách task chi tiết

### [ ] C1 — NTF-04: UI thông báo

**Mục đích:** Player đọc được thông báo và biết có thông báo mới.

**File dự kiến:**

- `frontend/src/features/notifications/` (mới)
- `frontend/src/features/player/components/PlayerHeader.tsx`
- `frontend/src/app/router.tsx`

**Việc làm:**

- [ ] Tạo types/service dùng `httpClient` hiện có.
- [ ] Dropdown ở header: 5–10 item gần nhất, badge unread.
- [ ] Trang `/notifications`: danh sách phân trang, filter unread (nếu API hỗ trợ).
- [ ] Polling 30 giây; dừng khi tab hidden; refresh khi focus.
- [ ] Mark-read idempotent; cập nhật badge không cần reload.
- [ ] States: loading, empty, error/retry, session expired.
- [ ] Mobile + desktop; keyboard/focus cho dropdown.
- [ ] Không hiển thị resource link nếu resolver chưa có.

**Acceptance:**

- [ ] Có thông báo mới → badge xuất hiện trong vòng 30 giây.
- [ ] Mở thông báo → read, badge giảm đúng.
- [ ] Tab ẩn không gọi polling.
- [ ] Session hết hạn xử lý qua auth handler hiện có.

**Test đầu ra:**

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.notifications.config.ts
```

### [ ] C2 — NTF-05: Resource resolver và link

**Mục đích:** notification mở đúng resource, nhưng không cấp quyền.

**Việc làm:**

- [ ] Tạo resolver theo allowlist: `POST`, `COMMENT`, `MATCHMAKING_REQUEST`, `MATCH`, `CONVERSATION`, `BOOKING`, `TOURNAMENT` (chỉ type có route thật).
- [ ] Mỗi resolver kiểm tra quyền đọc tại thời điểm mở (dùng `canView`/service tương ứng).
- [ ] Trả `404`/không link khi resource bị xóa/ẩn/không còn quyền.
- [ ] Không đưa id nhạy cảm vào URL nếu không cần.
- [ ] Test cross-user: user khác mở link → 404; resource ẩn → không link.
- [ ] Test notification cũ vẫn đọc được sau khi resource bị xóa.

**Acceptance:**

- [ ] Link không bao giờ cho phép đọc trái phép.
- [ ] Resource không tồn tại → notification vẫn hiển thị nội dung, không crash.
- [ ] Không có resolver nào trả dữ liệu nhạy cảm ngoài allowlist.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/notification-resolvers.test.ts
```

### [ ] C3 — MM-10 + producer còn thiếu

**Mục đích:** các sự kiện nghiệp vụ thực sự tạo notification.

**Việc làm:**

- [ ] Rà producer hiện có: `SOCIAL_POST_COMMENTED`, `MM_APPLICATION_*`, `MM_INVITATION_*`, `MM_POST_*`.
- [ ] Nối MM-10 cho request cancel/withdraw/booking cancellation theo Tech Design.
- [ ] Dedup key ổn định; một sự kiện chỉ một notification/recipient.
- [ ] Persist trong transaction của hành vi; rollback kéo theo notification.
- [ ] Không notify actor cho hành động của chính họ (trừ khi spec yêu cầu).
- [ ] Test: retry không nhân đôi; rollback; recipient isolation.

**Acceptance:**

- [ ] Mỗi sự kiện trong scope tạo đúng một notification/recipient.
- [ ] Không có notification mồ côi khi transaction rollback.
- [ ] Notification link dùng resolver C2.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/notification-service.test.ts
npm test --prefix backend -- --run src/__tests__/notification-producers.test.ts
```

### [ ] C4 — Tài liệu và trạng thái

- [ ] Cập nhật `docs/features/platform/notifications/tasks.md`: NTF-04 DONE, NTF-05 DONE khi test đủ.
- [ ] Ghi rõ type nào chưa có producer/route.
- [ ] Cập nhật route table trong `docs/architecture/frontend.md` nếu thêm `/notifications`.

## 4. Test đầu ra toàn track

```bash
npm test --prefix backend -- --run src/__tests__/notification-api.test.ts
npm test --prefix backend -- --run src/__tests__/notification-service.test.ts
npm test --prefix backend -- --run src/__tests__/notification-resolvers.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.notifications.config.ts
```

- [ ] API notification: recipient isolation, pagination, read idempotent.
- [ ] Service: dedup/rollback/concurrency.
- [ ] Resolver: cross-user 404, hidden resource.
- [ ] UI: badge, polling, read, mobile.
- [ ] Không có notification nào chứa dữ liệu ngoài quyền người nhận.

## 5. Checklist hoàn thành file

- [ ] C1→C4 xong.
- [ ] Notification UI có route và entry ở header.
- [ ] Resolver allowlist + quyền đọc được test.
- [ ] Producer MM-10/BK-10 (phần notification) được nối hoặc có task chéo ghi rõ.
- [ ] Docs cập nhật.
- [ ] `04` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Resolver tin vào resource id mà không check quyền | Luôn gọi service kiểm tra quyền tại thời điểm mở |
| Polling gây tải | 30 giây, pause hidden, cache ngắn |
| Notification lặp | Dedup key + unique index hiện có |
| UI link 404 gây crash | Resolver trả null; UI hiển thị item không link |

---

## 7. Figma audit — chốt 2026-11-15

Nguồn đã đọc:

- P05 Notifications List: `12:56201` (header `12:56207`, article mẫu `12:56253`).
- P45 Notification Detail: `12:67473`.
- P81 Notification Empty: `6:18295`.

**Chốt:** giữ spec, bỏ Figma-only. Không thêm API bulk-read hoặc filter type.

**Giữ từ Figma:**

- [ ] Bố cục list dạng card, icon theo loại, badge trạng thái, thời gian tương đối.
- [ ] Read/unread khác nhau bằng nền + chấm trạng thái, không chỉ màu.
- [ ] Empty state P81; loading/error/retry.
- [ ] Nút CTA mở resource nếu resolver NTF-05 trả link.

**Bổ sung vào task:**

- [ ] **C1:** thêm route `/notifications/:id` + trang chi tiết (P45); list item mở detail, detail có CTA “Xem chi tiết…” khi resource hợp lệ.
- [ ] **C1:** filter chỉ `All | Unread` dùng `isRead`; không có tab Booking/Matchmaking/Tournament/System.
- [ ] **C1:** không có “Đánh dấu tất cả đã đọc”; chỉ read từng item.
- [ ] **C1:** hiển thị icon/status theo notification type; thời gian tương đối; empty P81.
- [ ] **C1:** detail chỉ gồm tiêu đề, nội dung, thời gian, trạng thái đọc, CTA resource; không có preference push/SMS/sound, map, countdown khẩn cấp, “recent related”, ELO/FairPlay.
- [ ] **C2:** CTA chỉ render khi resolver trả route; 404/403 thì ẩn link, giữ nội dung.
- [ ] **C1 test:** Playwright P05/P45/P81: badge, read one, empty, link ẩn khi resource lỗi, mobile 390px.
- [ ] **C3 test:** notification type hiển thị đúng icon/nhóm; không có category tab.

**Loại bỏ khỏi UI (Figma-only):**

- [ ] Bulk-read “Đánh dấu tất cả đã đọc”.
- [ ] Category filter tabs (API không hỗ trợ).
- [ ] Push/SMS/Sound preferences, map preview, urgency countdown, recent-related widget.
- [ ] ELO/FairPlay/“hệ thống tự động” copy không có nguồn dữ liệu.

**Cập nhật checklist hoàn thành:**

- [ ] Có `/notifications/:id` hoặc quyết định inline detail được ghi rõ; mặc định dùng route riêng.
- [ ] Không còn bulk-read/category tab trong UI.
- [ ] P81 empty state có test.
