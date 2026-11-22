# 05 — Báo cáo và kiểm duyệt

- Ưu tiên: 05
- Track/Phase: Track D / Phase 1–2
- Prerequisite: 01 G0 (D2, D7), 02 INF-00; SOC-07 đã DONE; Messaging đọc tin đã có
- Exit gate: Player report được post/comment/message; Admin xem evidence và hide; UI Admin hoàn chỉnh
- Mở khóa: RP-08 cho Social/Messaging, SOC-09 report flow

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Hoàn thiện vòng đời report: Player tạo report kèm snapshot bằng chứng, Admin xem đúng evidence, hide nội dung vi phạm, và UI dùng chung cho Social/Messaging. Hiện backend Admin list/detail có một phần nhưng chưa có report từ Player và chưa có UI.

## 2. Điểm cần chốt

- [x] **RP-D1 (D2):** casing API `snake_case` hay `camelCase`.
- [x] **RP-D2 (D7):** `REPORT_ENABLED` thuộc registry domain `report`, default `true`.
- [x] **RP-D3:** evidence lưu text + media refs tại thời điểm report; không snapshot bản sao file.
- [x] **RP-D4:** report target mới: POST, COMMENT, MESSAGE; giữ PLAYER, FACILITY, TOURNAMENT.
- [x] **RP-D5:** `OTHER` bắt buộc description; reason codes theo matrix §7.
- [x] **RP-D6:** Admin hide dùng API SOC-07; MESSAGE không có hide trong scope.
- [x] **RP-D7:** evidence media chỉ Admin của report đó tải được.
- [x] **RP-D8:** report của chính mình bị chặn `409 REPORT_SELF_FORBIDDEN`.

## 3. Danh sách task chi tiết

### [x] D1 — RP-01/02: Đóng contract Admin Reports — DONE (2026-11-16)

**Mục đích:** chốt casing và hoàn thiện list/detail/status backend.

**Việc làm:**

- [x] Áp D2 vào `AdminReportService`, controller, validation, tests (camelCase).
- [x] Giữ `GET /api/v1/admin/reports` với filter `targetType`, `status`, pagination.
- [x] `GET /api/v1/admin/reports/:id` trả detail + target summary.
- [x] `PATCH /api/v1/admin/reports/:id/status` chỉ Admin, validate transition; wording idempotent-repeat còn chờ quyết định (RP-02 IN_PROGRESS).
- [x] 404 cho report không tồn tại; 403 Player/Court Owner.
- [x] Cập nhật `docs/features/admin/report-management/tech-design.md` theo casing đã chốt.

**Acceptance:**

- [ ] Contract review ký.
- [x] List/detail/status test PASS.
- [x] Không còn khác biệt casing giữa docs và code.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-reports.test.ts
```

### [x] D2 — RP-05: Schema target + evidence — DONE (2026-11-16)

**Mục đích:** lưu được report cho post/comment/message và bằng chứng bất biến.

**Việc làm:**

- [x] Migration (số mới sau INF-00):
  - [x] `REPORTS.reported_post_id` FK `POSTS.id` nullable.
  - [x] `REPORTS.reported_comment_id` FK `POST_COMMENTS.id` nullable.
  - [x] `REPORTS.reported_message_id` FK `MESSAGES.id` nullable.
  - [x] `REPORTS.reported_attachment_id` nullable (chỉ message).
  - [x] Thay `chk_report_target` = đúng 1 trong 6 target.
  - [x] Bảng `REPORT_EVIDENCE`: `report_id` PK FK, `content_text` nullable, `captured_at`.
  - [x] Bảng `REPORT_EVIDENCE_MEDIA`: PK (`report_id`, `media_id`), FK media.
- [x] Drizzle schema tương ứng.
- [x] Backfill/validate report cũ.
- [x] Test: report cũ pass; 2 target fail; attachment không thuộc message fail.

**Acceptance:**

- [x] Existing rows hợp lệ sau migration.
- [x] Không thể tạo report không target hoặc nhiều target.
- [x] Evidence tables có ràng buộc FK.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/report-evidence-migration.test.ts
```

### [x] D3 — RP-06: Player report API + snapshot — DONE (2026-11-16)

**Mục đích:** Player report nội dung mình thấy, lưu bằng chứng ngay lúc report.

**Việc làm:**

- [x] `POST /api/v1/reports` (Player, CSRF).
- [x] Body: `{ targetType, targetId, attachmentId?, reasonCode, description? }`.
- [x] Authorize:
  - [x] POST/COMMENT: dùng `canView` của Social.
  - [x] MESSAGE: quyền đọc conversation/message của Messaging.
  - [x] PLAYER/FACILITY/TOURNAMENT: giữ hành vi cũ.
- [x] Chặn self-report; `REPORT_ENABLED=false` → `409 REPORT_DISABLED`.
- [x] Reason code allowlist; `OTHER` yêu cầu description; attachment phải thuộc message.
- [x] Transaction: insert report + `REPORT_EVIDENCE` text + media refs.
- [x] Evidence bất biến: edit/delete sau đó không đổi snapshot.
- [x] Test: non-member report message 404; report post ẩn 404; self 409; gate; reason; attachment mismatch.

**Acceptance:**

- [x] Report post/comment/message tạo đúng 1 report + evidence.
- [x] Evidence giữ text/media gốc sau khi tác giả sửa/xóa.
- [x] Không lộ sự tồn tại của nội dung không có quyền (404).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/report-submission.test.ts
```

### [ ] D4 — RP-07: Admin evidence + hide links — PARTIAL (backend DONE, UI-REDO)

**Mục đích:** Admin thấy đúng evidence và hide đúng target.

**Việc làm:**

- [x] `GET /api/v1/admin/reports/:id` trả `evidence { text, media[] }`.
- [x] `GET /api/v1/admin/reports/:id/evidence/media/:mediaId` chỉ trả media thuộc report.
- [x] Media ngoài evidence → 404.
- [x] Base UI — Nút hide post/comment gọi API SOC-07; không hide message (UI-REDO final visuals).
- [x] Không link tới conversation không giới hạn.
- [x] Test: Admin khác report không tải được; Player không gọi được; hide kèo không hủy recruitment/booking.

**Acceptance:**

- [x] Base UI — Evidence UI chỉ hiển thị nội dung đã capture (UI-REDO final visuals).
- [ ] Hide không tác động Match/booking.
- [x] Không có đường đọc file ngoài evidence.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-report-evidence.test.ts
```

### [x] D5 — RP-03/04: Admin Report UI — BASE DONE (UI-REDO final)

**Mục đích:** Admin xử lý report không cần gọi API thủ công.

**Việc làm:**

- [x] Route `/admin/reports` dùng layout Admin hiện có (`AdminSidebar`, `AdminHeader`).
- [x] List: filter status/target, pagination, empty/loading/error.
- [x] Detail: target summary, evidence, status update, hide action.
- [x] Reuse `DataTable`, `FilterToolbar`, modal/toast hiện có; không thêm UI library.
- [x] Responsive; keyboard/focus cho modal.
- [ ] Playwright: Admin xem report → hide post → report resolved.

**Acceptance:**

- [x] Admin list/detail/status/hide hoạt động end-to-end.
- [x] Player/Court Owner không vào được route.
- [x] Không có nút hide message.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin-reports.config.ts
```

### [x] D6 — RP-08: Shared report dialog — BASE DONE (UI-REDO final)

**Mục đích:** một dialog report dùng chung cho Social/Messaging.

**Việc làm:**

- [x] `frontend/src/components/common/ReportDialog.tsx`.
- [x] Props: targetType, targetId, optional attachment, reason codes, onSubmitted.
- [x] Entry:
  - [x] Post card/detail.
  - [x] Comment item.
  - [x] Message menu.
- [x] Chặn report nội dung của mình ở UI và server.
- [x] Recheck quyền khi mở; nếu mất quyền → đóng dialog và báo không khả dụng.
- [x] Không upload bằng chứng tùy ý; không cam kết SLA/sanction.
- [ ] Test: report post/comment/message; OTHER description; self-report; gate off; API error.

**Acceptance:**

- [x] Social không còn nút report “unavailable”.
- [x] Một dialog duy nhất, không nhân bản flow.
- [x] Message report không lộ conversation.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.report-dialog.config.ts
```

### [x] D7 — Tài liệu và trạng thái — DONE (2026-11-16)

- [x] Cập nhật `report-management/tasks.md` RP-01→08.
- [x] Cập nhật `social/frontend-implementation.md`: report không còn “unavailable”.
- [x] Ghi rõ MESSAGE evidence không có hide.
- [x] Cập nhật schema Change Log cho migration RP-05.

## 4. Test đầu ra toàn track

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/admin-reports.test.ts
npm test --prefix backend -- --run src/__tests__/report-evidence-migration.test.ts
npm test --prefix backend -- --run src/__tests__/report-submission.test.ts
npm test --prefix backend -- --run src/__tests__/admin-report-evidence.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

- [x] Old reports vẫn đọc được.
- [x] Evidence bất biến sau edit/delete.
- [x] Cross-user và non-member đều 404.
- [ ] Admin hide không đổi recruitment/Match/booking.
- [x] Base UI — UI Social/Messaging có entry report (UI-REDO final visuals).

## 5. Checklist hoàn thành file

- [ ] D1→D7 xong.
- [x] RP-05 migration chạy fresh + populated.
- [x] `REPORT_ENABLED` có registry + seed.
- [x] Base UI — Shared dialog dùng ở Social và Messaging (UI-REDO final visuals).
- [x] Base UI — Admin UI route hoạt động (UI-REDO final visuals).
- [x] Docs cập nhật.
- [ ] `05` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Snapshot evidence bị thay đổi khi edit | Chỉ ghi evidence lúc create; không update theo target |
| Lộ nội dung không có quyền qua 404/403 khác nhau | Luôn trả 404 cho không có quyền |
| Admin tải media ngoài report | Kiểm tra cặp (reportId, mediaId) |
| Casing đổi gây vỡ FE | D2 trước UI; mapping tập trung ở service |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc:

- P38 Submit Report (legacy): `6:5259` (target cards `6:5310`).
- Social Report & Evidence (chuẩn mới): `99:44643`.
- A08 Report List: `12:77300`.
- A09 Report Detail: `12:77985`.

**Chốt:** dùng board `99:44643` làm chuẩn cho Player dialog; P38 chỉ tham khảo bố cục, không dùng target legacy.

**Bổ sung vào task:**

- [ ] **D6:** target cards dùng `POST`, `COMMENT`, `MESSAGE` (+ attachment của message); không dùng Player/Facility/Tournament legacy trong dialog Social/Messaging.
- [ ] **D6:** reason codes hiển thị đúng: Spam, Quấy rối/xúc phạm, Nội dung không phù hợp, Lừa đảo, Tiết lộ thông tin riêng tư, Khác; `Khác` bắt buộc mô tả.
- [ ] **D6:** hiển thị “Bằng chứng được chọn” là snapshot text/media tại thời điểm report; không cho upload bằng chứng tùy ý.
- [ ] **D6:** states: đang gửi, gửi thành công, gửi lỗi; lỗi giữ nguyên lý do/mô tả; nút “Thử gửi lại”.
- [ ] **D6:** không có SLA 4 bước, hotline, cam kết FairPlay, chế tài/đình chỉ.
- [ ] **D4/D5 (A08):** chỉ giữ table/filter/pagination; bỏ 4 KPI SLA/Precision/Avg Response, “Uptime 99.98%”, FairPlay sandbox banner.
- [ ] **D4/D5 (A09):** giữ target/reporter/evidence/status/hide; bỏ form chế tài, điểm FairPlay, audit trail xử lý; sticky action bar chỉ chứa cập nhật trạng thái + hide.
- [ ] **D4:** reviewer evidence panel dùng layout `99:44643`; message chỉ xem đúng tin nhắn/tệp được report; không mở conversation, không hide message.
- [ ] **D5 test:** Playwright A08/A09: filter, evidence snapshot sau edit, hide post/comment, không có sanction form; P38 success/error/retry.

**Loại bỏ khỏi UI:**

- [ ] 3 target cards Player/Facility/Tournament trong P38.
- [ ] Upload JPG/MP4/PDF 50MB, SLA 2–4h, hotline, cam kết FairPlay.
- [ ] A08 KPI SLA/Precision/Uptime; A09 disciplinary form, audit trail, penalty.

**Cập nhật checklist hoàn thành:**

- [ ] RP-08 dùng `99:44643`; không dùng target legacy.
- [ ] Có success/error/retry và snapshot preview.
- [ ] Admin A08/A09 không có KPI/SLA/sanction ngoài spec.
