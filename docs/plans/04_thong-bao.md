# 04 — Thông báo

- Ưu tiên: 04
- Track/Phase: Track C / Phase 1
- Prerequisite: 01 G0 (D5), 02 INF-00; NTF-01→03 đã DONE
- Exit gate: UI thông báo hoạt động; resolver không cấp quyền; producer dedup đúng
- Mở khóa: BK-10, MM-10, MM-16, TRN-10, Social notification UX

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Các mục gắn **UI-REDO** đã có base đủ để test chức năng nhưng phải làm lại/kiểm tra giao diện sau khi merge. Không tính là DONE.

## 1. Mục đích

Backend notification đã có (list/unread/detail/read + persistence transaction-aware), nhưng người dùng chưa thấy gì và notification chưa điều hướng được tới resource. Track này hoàn thiện lớp hiển thị và resolver an toàn, đồng thời nối các producer còn thiếu.

## 2. Điểm cần chốt

- [x] **NTF-D1 (D5):** bảng `resourceType → route → quyền đọc` (xem dưới).
- [x] **NTF-D2:** nguồn unread: API là source of truth; frontend chỉ cache hiển thị và refresh.
- [x] **NTF-D3:** polling 30 giây; pause khi tab hidden; refresh khi focus; không WebSocket.
- [x] **NTF-D4:** không bulk mark-read; chỉ read từng item.
- [x] **NTF-D5:** resource bị xóa/ẩn → notification vẫn đọc được, `resourcePath = null`.
- [x] **NTF-D6:** dùng key/type hiện có; không tạo type trùng.

Bảng D5 đã chốt và triển khai trong `backend/src/services/notifications/NotificationResourceResolver.ts`:

| resourceType | Route | Quyền đọc tại thời điểm mở | Ghi chú |
| --- | --- | --- | --- |
| `POST` | `/posts/:postId` | Social `canView` (`postVisibility`) | Chỉ PLAYER; ẩn/xóa → không link |
| `COMMENT` | `/posts/:postId#comment-:commentId` | Comment chưa xóa/ẩn + `canView` của post | Chỉ PLAYER |
| `MATCHMAKING_REQUEST` | `/matchmaking/requests/:requestId` | `getRequestDetail` (owner/member/public tier) | Không có quyền → không link |
| `MATCH` | `/matchmaking/matches/:matchId` | `getMatchDetail` (chỉ participant) | Không có quyền → không link |
| `CONVERSATION` | `/messages/:conversationId` | `getConversationAccess` (ACTIVE member) | Giữ allowlist; chưa có producer |
| `BOOKING` | `/bookings/:bookingId` | `getBookingDetail` (chỉ booking owner) | Producer thuộc BK-10 |
| `TOURNAMENT` | — | — | **Không resolver**: chưa có route detail thật, chờ TRN-10 |

Quy ước UI-REDO: `[ ] UI-REDO` = có base chạy được nhưng chưa chốt giao diện.

## 3. Danh sách task chi tiết

### [ ] C1 — NTF-04: UI thông báo — PARTIAL (logic DONE, UI-REDO)

**Mục đích:** Player đọc được thông báo và biết có thông báo mới.

**File dự kiến:**

- `frontend/src/features/notifications/` (mới)
- `frontend/src/features/player/components/PlayerHeader.tsx`
- `frontend/src/app/router.tsx`

**Việc làm:**

- [x] Tạo types/service dùng `httpClient` hiện có (`features/notifications/services/notifications-api.ts`).
- [ ] UI-REDO — Dropdown ở header: base 5 item gần nhất + badge unread đã có; chờ chốt giao diện.
- [ ] UI-REDO — Trang `/notifications`: base phân trang + filter `All | Unread` đã có; chờ Figma P05.
- [x] Polling 30 giây; dừng khi tab hidden; refresh khi focus (`notifications-context.tsx`).
- [x] Mark-read idempotent; badge cập nhật không cần reload.
- [ ] UI-REDO — States loading/empty/error/retry đã có base; session expired dùng auth handler hiện có.
- [ ] UI-REDO — Mobile + desktop; keyboard/focus cho dropdown mới ở mức cơ bản.
- [x] Không hiển thị resource link nếu resolver chưa có; CTA chỉ render từ `resourcePath`.
- [x] Thêm `/notifications/:id` (P45 base) và CTA “Xem chi tiết”; không bulk-read/category tab.

**Acceptance:**

- [ ] UI-REDO — Có thông báo mới → badge xuất hiện trong vòng 30 giây (logic polling đã có, chưa test Playwright).
- [ ] UI-REDO — Mở thông báo → read, badge giảm đúng (logic đã có, chưa test Playwright).
- [x] Tab ẩn không gọi polling (`document.visibilityState`).
- [x] Session hết hạn xử lý qua `httpClient` auth handler hiện có.

**Test đầu ra:**

```bash
npm run build --prefix frontend   # PASS 2026-11-16
npm run lint --prefix frontend    # PASS (chỉ warning hiện hữu)
cd frontend && npx playwright test --config playwright.notifications.config.ts  # UI-REDO: chưa thêm spec
```

### [x] C2 — NTF-05: Resource resolver và link — DONE

**Mục đích:** notification mở đúng resource, nhưng không cấp quyền.

**Việc làm:**

- [x] Resolver allowlist: `POST`, `COMMENT`, `MATCHMAKING_REQUEST`, `MATCH`, `CONVERSATION`, `BOOKING`; `TOURNAMENT` cố ý bỏ vì chưa có route detail thật.
- [x] Mỗi resolver kiểm tra quyền đọc tại thời điểm mở (`postVisibility`, `getRequestDetail`, `getMatchDetail`, `getConversationAccess`, `getBookingDetail`).
- [x] `resourcePath = null` khi resource xóa/ẩn/không còn quyền; notification vẫn trả nội dung.
- [x] URL chỉ chứa id số của resource, không thêm dữ liệu nhạy cảm.
- [x] Test cross-user: resource ẩn/unpublished/không participant → không link; notification người khác → 404.
- [x] Test notification cũ vẫn đọc được sau khi resource bị ẩn; `GET /notifications/:id` trả `resourcePath: null`.

**Acceptance:**

- [x] Link không bao giờ cho phép đọc trái phép; resolver fail-closed với `AppError`.
- [x] Resource không tồn tại → notification vẫn hiển thị nội dung, không crash.
- [x] Không resolver nào trả dữ liệu ngoài allowlist (unknown type → `null`).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/notification-resolvers.test.ts  # 6/6 PASS 2026-11-16
```

### [x] C3 — MM-10 + producer còn thiếu — DONE (trừ booking cancellation cross-task)

**Mục đích:** các sự kiện nghiệp vụ thực sự tạo notification.

**Việc làm:**

- [x] Rà producer hiện có: `SOCIAL_POST_COMMENTED`, `MM_APPLICATION_*`, `MM_INVITATION_*`, `MM_POST_*`, `MM_MEMBERSHIP_CHANGED`, `MM_RECRUITMENT_REOPENED`, `MM_CLOSED_INSUFFICIENT_PLAYERS`, `MM_COURT_UPDATED`.
- [x] MM-10 request cancel/withdraw đã nối qua `matchmakingNotifications.post` / `reopened` trong transaction lifecycle.
- [ ] BLOCKED (cross-task) — `MM_BOOKING_CANCELLED`: MM-20/MM-19 chưa deliver (hủy booking kèm theo đang bị từ chối), nên chưa có producer. Ghi ở `docs/features/matchmaking/matchmaking/tasks.md`; làm khi BK-10/MM-20 mở.
- [x] Dedup key ổn định; một sự kiện một notification/recipient (kể cả recipient trùng trong cùng call).
- [x] Persist trong transaction của hành vi; rollback kéo theo notification (đã test ở `notification-service.test.ts`).
- [x] Không notify actor cho hành động của chính họ.
- [x] Test producer: retry cùng key, actor exclusion, recipient isolation.

**Acceptance:**

- [x] Mỗi sự kiện trong scope tạo đúng một notification/recipient.
- [x] Không có notification mồ côi khi transaction rollback.
- [x] Notification link dùng resolver C2 (`resourcePath`).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/notification-service.test.ts   # 13/13 cùng API suite PASS
npm test --prefix backend -- --run src/__tests__/notification-producers.test.ts # 6/6 PASS 2026-11-16
```

### [x] C4 — Tài liệu và trạng thái

- [x] Cập nhật `docs/features/platform/notifications/tasks.md`: NTF-05 DONE; NTF-04 PARTIAL/UI-REDO.
- [x] Ghi rõ type chưa có producer/route: `TOURNAMENT` (chưa route detail/producer), `BOOKING` (resolver có, producer BK-10), `CONVERSATION` (resolver có, producer defer), `MM_BOOKING_CANCELLED` (chờ MM-19/20).
- [x] Cập nhật route table trong `docs/architecture/frontend.md`: `/notifications`, `/notifications/:id`.

## 4. Test đầu ra toàn track

```bash
npm test --prefix backend -- --run src/__tests__/notification-api.test.ts
npm test --prefix backend -- --run src/__tests__/notification-service.test.ts
npm test --prefix backend -- --run src/__tests__/notification-resolvers.test.ts
npm test --prefix backend -- --run src/__tests__/notification-producers.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.notifications.config.ts
```

- [x] API notification: recipient isolation, pagination, read idempotent; thêm `createdAt` cho thời gian tương đối.
- [x] Service: dedup/rollback/concurrency.
- [x] Resolver: cross-user 404, hidden resource, unknown type.
- [x] Producer: dedup key ổn định, actor exclusion, recipient isolation.
- [ ] UI-REDO — UI: badge, polling, read, mobile (Playwright chưa thêm; base thủ công).
- [x] Không có notification nào chứa dữ liệu ngoài quyền người nhận.

## 5. Checklist hoàn thành file

- [ ] C1→C4 xong — C1 còn UI-REDO; C2/C3/C4 DONE.
- [x] Notification UI có route và entry ở header (base).
- [x] Resolver allowlist + quyền đọc được test.
- [ ] Producer MM-10/BK-10: MM-10 xong; phần booking cancellation/BK-10 ghi task chéo, chờ MM-19/20 + BK-10.
- [x] Docs cập nhật.
- [ ] `04` DONE trong `00_danh-muc-task.md` — đang PARTIAL vì UI-REDO.

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

- [ ] UI-REDO — Bố cục list dạng card, icon theo loại, badge trạng thái, thời gian tương đối (base có card/chấm trạng thái/thời gian; icon theo loại còn thiếu).
- [x] Read/unread khác nhau bằng nền + chấm trạng thái, không chỉ màu (base).
- [ ] UI-REDO — Empty state P81; loading/error/retry (base dùng StateBlock, chờ Figma).
- [x] Nút CTA mở resource nếu resolver NTF-05 trả link.

**Bổ sung vào task:**

- [x] **C1:** thêm route `/notifications/:id` + trang chi tiết (P45 base); list item mở detail, detail có CTA “Xem chi tiết…” khi resource hợp lệ.
- [x] **C1:** filter chỉ `All | Unread` dùng `isRead`; không có tab Booking/Matchmaking/Tournament/System.
- [x] **C1:** không có “Đánh dấu tất cả đã đọc”; chỉ read từng item.
- [ ] UI-REDO — **C1:** hiển thị icon/status theo notification type; thời gian tương đối; empty P81.
- [x] **C1:** detail chỉ gồm tiêu đề, nội dung, thời gian, trạng thái đọc, CTA resource; không có preference push/SMS/sound, map, countdown khẩn cấp, “recent related”, ELO/FairPlay.
- [x] **C2:** CTA chỉ render khi resolver trả route; 404/403 thì ẩn link, giữ nội dung.
- [ ] UI-REDO — **C1 test:** Playwright P05/P45/P81: badge, read one, empty, link ẩn khi resource lỗi, mobile 390px.
- [ ] UI-REDO — **C3 test:** notification type hiển thị đúng icon/nhóm; không có category tab.

**Loại bỏ khỏi UI (Figma-only):**

- [x] Bulk-read “Đánh dấu tất cả đã đọc” — không có trong UI/API.
- [x] Category filter tabs (API không hỗ trợ) — không có trong UI.
- [x] Push/SMS/Sound preferences, map preview, urgency countdown, recent-related widget — không có trong UI.
- [x] ELO/FairPlay/“hệ thống tự động” copy không có nguồn dữ liệu — không có trong UI.

**Cập nhật checklist hoàn thành:**

- [x] Có `/notifications/:id` hoặc quyết định inline detail được ghi rõ; mặc định dùng route riêng.
- [x] Không còn bulk-read/category tab trong UI.
- [ ] UI-REDO — P81 empty state có test (Playwright chưa thêm).
