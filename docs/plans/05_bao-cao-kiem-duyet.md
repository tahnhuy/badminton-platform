# 05 — Báo cáo và kiểm duyệt

- Ưu tiên: 05
- Track/Phase: Track D / Phase 1–2
- Prerequisite: 01 G0 (D2, D7), 02 INF-00; SOC-07 đã DONE; Messaging đọc tin đã có
- Exit gate: Player report được post/comment/message; Admin xem evidence và hide; UI Admin hoàn chỉnh
- Mở khóa: RP-08 cho Social/Messaging, SOC-09 report flow

## 1. Mục đích

Hoàn thiện vòng đời report: Player tạo report kèm snapshot bằng chứng, Admin xem đúng evidence, hide nội dung vi phạm, và UI dùng chung cho Social/Messaging. Hiện backend Admin list/detail có một phần nhưng chưa có report từ Player và chưa có UI.

## 2. Điểm cần chốt

- [ ] **RP-D1 (D2):** casing API `snake_case` hay `camelCase`.
- [ ] **RP-D2 (D7):** `REPORT_ENABLED` thuộc registry domain `report`, default `true`.
- [ ] **RP-D3:** evidence lưu text + media refs tại thời điểm report; không snapshot bản sao file.
- [ ] **RP-D4:** report target mới: POST, COMMENT, MESSAGE; giữ PLAYER, FACILITY, TOURNAMENT.
- [ ] **RP-D5:** `OTHER` bắt buộc description; reason codes theo matrix §7.
- [ ] **RP-D6:** Admin hide dùng API SOC-07; MESSAGE không có hide trong scope.
- [ ] **RP-D7:** evidence media chỉ Admin của report đó tải được.
- [ ] **RP-D8:** report của chính mình bị chặn `409 REPORT_SELF_FORBIDDEN`.

## 3. Danh sách task chi tiết

### [ ] D1 — RP-01/02: Đóng contract Admin Reports

**Mục đích:** chốt casing và hoàn thiện list/detail/status backend.

**Việc làm:**

- [ ] Áp D2 vào `AdminReportService`, controller, validation, tests.
- [ ] Giữ `GET /api/v1/admin/reports` với filter `target_type`, `status`, pagination.
- [ ] `GET /api/v1/admin/reports/:id` trả detail + target summary.
- [ ] `PATCH /api/v1/admin/reports/:id/status` chỉ Admin, idempotent, validate transition.
- [ ] 404 cho report không tồn tại; 403 Player/Court Owner.
- [ ] Cập nhật `docs/features/admin/report-management/tech-design.md` theo casing đã chốt.

**Acceptance:**

- [ ] Contract review ký.
- [ ] List/detail/status test PASS.
- [ ] Không còn khác biệt casing giữa docs và code.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-reports.test.ts
```

### [ ] D2 — RP-05: Schema target + evidence

**Mục đích:** lưu được report cho post/comment/message và bằng chứng bất biến.

**Việc làm:**

- [ ] Migration (số mới sau INF-00):
  - [ ] `REPORTS.reported_post_id` FK `POSTS.id` nullable.
  - [ ] `REPORTS.reported_comment_id` FK `POST_COMMENTS.id` nullable.
  - [ ] `REPORTS.reported_message_id` FK `MESSAGES.id` nullable.
  - [ ] `REPORTS.reported_attachment_id` nullable (chỉ message).
  - [ ] Thay `chk_report_target` = đúng 1 trong 6 target.
  - [ ] Bảng `REPORT_EVIDENCE`: `report_id` PK FK, `content_text` nullable, `captured_at`.
  - [ ] Bảng `REPORT_EVIDENCE_MEDIA`: PK (`report_id`, `media_id`), FK media.
- [ ] Drizzle schema tương ứng.
- [ ] Backfill/validate report cũ.
- [ ] Test: report cũ pass; 2 target fail; attachment không thuộc message fail.

**Acceptance:**

- [ ] Existing rows hợp lệ sau migration.
- [ ] Không thể tạo report không target hoặc nhiều target.
- [ ] Evidence tables có ràng buộc FK.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/report-evidence-migration.test.ts
```

### [ ] D3 — RP-06: Player report API + snapshot

**Mục đích:** Player report nội dung mình thấy, lưu bằng chứng ngay lúc report.

**Việc làm:**

- [ ] `POST /api/v1/reports` (Player, CSRF).
- [ ] Body: `{ targetType, targetId, attachmentId?, reasonCode, description? }`.
- [ ] Authorize:
  - [ ] POST/COMMENT: dùng `canView` của Social.
  - [ ] MESSAGE: quyền đọc conversation/message của Messaging.
  - [ ] PLAYER/FACILITY/TOURNAMENT: giữ hành vi cũ.
- [ ] Chặn self-report; `REPORT_ENABLED=false` → `409 REPORT_DISABLED`.
- [ ] Reason code allowlist; `OTHER` yêu cầu description; attachment phải thuộc message.
- [ ] Transaction: insert report + `REPORT_EVIDENCE` text + media refs.
- [ ] Evidence bất biến: edit/delete sau đó không đổi snapshot.
- [ ] Test: non-member report message 404; report post ẩn 404; self 409; gate; reason; attachment mismatch.

**Acceptance:**

- [ ] Report post/comment/message tạo đúng 1 report + evidence.
- [ ] Evidence giữ text/media gốc sau khi tác giả sửa/xóa.
- [ ] Không lộ sự tồn tại của nội dung không có quyền (404).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/report-api.test.ts
npm test --prefix backend -- --run src/__tests__/report-evidence.test.ts
```

### [ ] D4 — RP-07: Admin evidence + hide links

**Mục đích:** Admin thấy đúng evidence và hide đúng target.

**Việc làm:**

- [ ] `GET /api/v1/admin/reports/:id` trả `evidence { text, media[] }`.
- [ ] `GET /api/v1/admin/reports/:id/evidence/media/:mediaId` chỉ trả media thuộc report.
- [ ] Media ngoài evidence → 404.
- [ ] Nút hide post/comment gọi API SOC-07; không hide message.
- [ ] Không link tới conversation không giới hạn.
- [ ] Test: Admin khác report không tải được; Player không gọi được; hide kèo không hủy recruitment/booking.

**Acceptance:**

- [ ] Evidence UI chỉ hiển thị nội dung đã capture.
- [ ] Hide không tác động Match/booking.
- [ ] Không có đường đọc file ngoài evidence.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-report-evidence.test.ts
```

### [ ] D5 — RP-03/04: Admin Report UI

**Mục đích:** Admin xử lý report không cần gọi API thủ công.

**Việc làm:**

- [ ] Route `/admin/reports` dùng layout Admin hiện có (`AdminSidebar`, `AdminHeader`).
- [ ] List: filter status/target, pagination, empty/loading/error.
- [ ] Detail: target summary, evidence, status update, hide action.
- [ ] Reuse `DataTable`, `FilterToolbar`, modal/toast hiện có; không thêm UI library.
- [ ] Responsive; keyboard/focus cho modal.
- [ ] Playwright: Admin xem report → hide post → report resolved.

**Acceptance:**

- [ ] Admin list/detail/status/hide hoạt động end-to-end.
- [ ] Player/Court Owner không vào được route.
- [ ] Không có nút hide message.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin-reports.config.ts
```

### [ ] D6 — RP-08: Shared report dialog

**Mục đích:** một dialog report dùng chung cho Social/Messaging.

**Việc làm:**

- [ ] `frontend/src/components/common/ReportDialog.tsx`.
- [ ] Props: targetType, targetId, optional attachment, reason codes, onSubmitted.
- [ ] Entry:
  - [ ] Post card/detail.
  - [ ] Comment item.
  - [ ] Message menu.
- [ ] Chặn report nội dung của mình ở UI và server.
- [ ] Recheck quyền khi mở; nếu mất quyền → đóng dialog và báo không khả dụng.
- [ ] Không upload bằng chứng tùy ý; không cam kết SLA/sanction.
- [ ] Test: report post/comment/message; OTHER description; self-report; gate off; API error.

**Acceptance:**

- [ ] Social không còn nút report “unavailable”.
- [ ] Một dialog duy nhất, không nhân bản flow.
- [ ] Message report không lộ conversation.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.report-dialog.config.ts
```

### [ ] D7 — Tài liệu và trạng thái

- [ ] Cập nhật `report-management/tasks.md` RP-01→08.
- [ ] Cập nhật `social/frontend-implementation.md`: report không còn “unavailable”.
- [ ] Ghi rõ MESSAGE evidence không có hide.
- [ ] Cập nhật schema Change Log cho migration RP-05.

## 4. Test đầu ra toàn track

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/admin-reports.test.ts
npm test --prefix backend -- --run src/__tests__/report-evidence-migration.test.ts
npm test --prefix backend -- --run src/__tests__/report-api.test.ts
npm test --prefix backend -- --run src/__tests__/report-evidence.test.ts
npm test --prefix backend -- --run src/__tests__/admin-report-evidence.test.ts
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

- [ ] Old reports vẫn đọc được.
- [ ] Evidence bất biến sau edit/delete.
- [ ] Cross-user và non-member đều 404.
- [ ] Admin hide không đổi recruitment/Match/booking.
- [ ] UI Social/Messaging có entry report.

## 5. Checklist hoàn thành file

- [ ] D1→D7 xong.
- [ ] RP-05 migration chạy fresh + populated.
- [ ] `REPORT_ENABLED` có registry + seed.
- [ ] Shared dialog dùng ở Social và Messaging.
- [ ] Admin UI route hoạt động.
- [ ] Docs cập nhật.
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
