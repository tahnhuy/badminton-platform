# Kế hoạch hoàn thiện các module còn lại

- Ngày lập: 2026-11-15
- Baseline rà soát: `397f985` (`feat(matchmaking): chốt kèo thủ công và bảo vệ quyền thành viên`)
- Phạm vi: toàn bộ module còn thiếu/dở dang trong `backend/`, `frontend/`, đối chiếu `docs/features/**/tasks.md`
- Mục tiêu: hoàn thiện theo thứ tự **dependency-first**, không có work package nào phải chờ một quyết định chưa tồn tại hoặc một module chưa được lên lịch

---

## 1. Nguyên tắc để không bị block

1. **Quyết định trước, code sau.** Mọi điểm `TBD` ảnh hưởng schema/API được đưa vào **G0 — Cổng quyết định** ở Tuần 0. Không work package nào bắt đầu trước khi cổng tương ứng đóng.
2. **Không dùng stub production.** Mock payment chỉ chạy ở `development/test`; resolver/report/booking thiếu provider thì fail-closed, không giả lập thành công.
3. **Làm theo vertical slice.** Mỗi work package gồm schema → repo → service → API → UI → test → docs, để không tạo “nửa module” mới.
4. **Track song song theo hợp đồng.** Các track A–F chỉ giao nhau qua contract đã có (`PaymentProvider`, `NotificationService`, `PrivateMediaService`, `RecruitmentPort`, `MatchModule`) và qua migration đã đăng ký số.
5. **Nền migration phải sạch trước.** Sửa lệch journal/snapshot hiện tại (INF-00) trước khi thêm bất kỳ migration mới.
6. **External dependency chỉ chặn release gate, không chặn code.** VNPAY sandbox credentials/merchant refund không cần để viết adapter, test offline, Mock E2E; chỉ cần cho smoke test cuối.
7. **Không mở rộng scope ngoài tài liệu.** Các mục chưa có đặc tả (ví dụ trang chủ Player, chat từ Social) không nằm trong kế hoạch này; cần quyết định sản phẩm riêng.

---

## 2. Hiện trạng module (đối chiếu code)

| Module | Trạng thái thực tế | Thiếu chính |
| --- | --- | --- |
| Payments/Refunds | Chỉ Mock; `PAY-01` chưa có adapter VNPAY/signature; `PAY-03` chưa webhook; `PAY-04` chưa refund worker | Adapter + signature, webhook idempotent, refund durable, production guards |
| Booking Player | BK-01→05, 08, 09, 11, 13 DONE | BK-06/07/10/12/14 |
| Court Owner | CO-01→04, 06, 07 DONE | CO-05/08 |
| Matchmaking | MM-01→06, 08, 09, 11→13, 18, 21→31 phần lớn DONE | MM-07/19/20, MM-15 booking UI, MM-17 E2E thật |
| Notifications | NTF-01→03 DONE (backend + API) | NTF-04 UI/unread, NTF-05 resolver/link, producer MM-10 |
| Reports | RP-01/02 backend list/detail; chưa có report Player | RP-05/06/07/08, UI RP-03/04, casing RP-01/02 |
| Admin Dashboard | Chỉ placeholder FE; không API | AD-01→04 |
| System Config | Reader typed + registry một phần | SC-06→11, audit table, Admin API/UI |
| Tournament | Chỉ schema cũ + bracket algorithm | TRN-01→12, system booking, UI, casual tournament (TBD) |
| Social | Lõi DONE; report/notification/booking-link còn thiếu | RP-08 entry, NTF-04/05, MM-19/20, SOC-09, filter booking venue |
| Player Profile | PP-01/02/05 partial | Aggregate non-null + Tournament UI |
| Admin frontend consolidation | Chưa làm; Tech Design chưa Ready | AF-01→03 (không critical path) |

---

## 3. G0 — Cổng quyết định (Tuần 0, bắt buộc đóng trước khi code phần liên quan)

| ID | Quyết định | Owner | Ảnh hưởng | Nếu trễ |
| --- | --- | --- | --- | --- |
| **D1a** | Chốt phạm vi Tournament **chuyên nghiệp**: loại bracket, đăng ký đơn/đôi, điều kiện xác nhận thành tích, quyền Organizer | Product + Tech Lead | TRN-01/02/03/04/06/07/08/10/11 | Hoãn Track G; các track khác vẫn chạy |
| **D1b** | Chốt cách nhập người tham gia **phong trào không tài khoản**, phí/đăng ký phong trào, hiển thị Social/privacy | Product | TRN-13 (đề xuất) | Chỉ hoãn tính năng phong trào; không chặn professional |
| **D1c** | Chốt công thức/ngưỡng nâng trình từ giải chuyên nghiệp, xử lý sửa/hủy kết quả | Product | TRN-14 (đề xuất) | Không chặn giải professional; achievement để sau |
| **D2** | Chốt casing API Reports: giữ `snake_case` hay chuyển `camelCase` theo `conventions.md` | Tech Lead | RP-01/02/03/04 | Có thể làm RP-05/06 độc lập; UI chờ D2 |
| **D3** | Duyệt schema delta phục vụ refund durable (claim/attempt/timeout) | Tech Lead + schema review | PAY-04 | Không chặn PAY-01/02/03; PAY-04 chờ D3 |
| **D4** | Xác nhận VNPAY sandbox credentials, IPN HTTPS, quyền refund | Ops/Business | Smoke test PAY-03/04 | Không chặn code/test offline; chỉ chặn release gate |
| **D5** | Chốt route/authorization cho notification resource resolver | Tech Lead | NTF-05 | Có thể làm NTF-04 với route hiện có; NTF-05 hoãn |
| **D6** | Xác nhận catalog bounds System Config (§7.3) lần cuối | Business Owner | SC-06/SC-08 | Dùng bounds hiện có; thay đổi là config data, không đổi API |
| **D7** | Bổ sung `REPORT_ENABLED` vào config registry/seed | Tech Lead | RP-06 | RP-06 chờ; RP-05/07 độc lập |
| **D8** | Đưa `admin/frontend-consolidation` Tech Design sang Ready | Tech Lead | AF-01→03 | Không critical path; giữ nguyên cấu trúc Admin hiện tại |

**Exit gate G0:** mỗi quyết định có kết luận ghi trong PR/ADR hoặc cập nhật trực tiếp PRD/Tech Design tương ứng. Không có quyết định nào được “ngầm hiểu” trong code.

---

## 4. INF-00 — Sửa nền migration trước khi thêm bất kỳ bảng/cột nào

**Vấn đề phát hiện:**

- `backend/src/db/migrations/meta/_journal.json` dừng ở `0016`, nhưng thư mục có `0017_matchmaking_request_conversations.sql`.
- Snapshot Drizzle chỉ có đến `0014_snapshot.json`; thiếu snapshot `0015`, `0016`, `0017`.
- `database-schema.md` và tasks có chỗ còn ghi số migration cũ (`0002`, `0007`), không còn đúng thực tế.
- Runner `backend/src/db/migrate.ts` áp migration theo tên file + checksum, không dùng journal; nhưng `drizzle-kit generate` dùng journal/snapshot. Lệch này sẽ sinh migration sai hoặc báo diff rỗng sai.

**Việc phải làm:**

1. Chạy `drizzle-kit generate` trên baseline hiện tại và xác nhận diff rỗng; nếu không, tái tạo `0015`–`0017` snapshot và bổ sung journal entry đúng `tag`/`when`/`version`.
2. Viết test/CI kiểm tra:
   - mọi file `.sql` đều có journal entry;
   - `drizzle-kit generate` không sinh file mới trên schema hiện tại;
   - `npm run db:migrate` chạy sạch trên DB trống và DB có dữ liệu mẫu.
3. Chốt quy ước cấp số migration: **số kế tiếp hợp lệ là 0018**; mỗi PR chỉ được thêm một migration; ghi số đã dùng vào `docs/plans/migration-slot-log.md` (tạo mới) trong cùng PR.
4. Cập nhật `docs/architecture/database-schema.md` Change Log cho `0015`–`0017` nếu chưa có.

**Exit criteria:**

- `npm run db:migrate` PASS trên fresh DB.
- `drizzle-kit generate` không tạo file mới.
- CI/migration-check PASS.
- Không còn file `.sql` nào thiếu journal/snapshot.

> Đây là điều kiện tiên quyết của **mọi** migration bên dưới. Làm trước Tuần 1.

---

## 5. Sơ đồ phụ thuộc tổng thể

```text
G0 (quyết định)
 └─ INF-00 (migration baseline)
     ├─ Track A: PAY-01 → PAY-06 → PAY-02 → PAY-03 → PAY-04 → PAY-05
     │     ├─ Track B: BK-06/BK-07/BK-10/BK-12/BK-14
     │     │     ├─ CO-05 → CO-08
     │     │     └─ MM-07 → MM-19 → MM-20 → MM-15b → MM-17
     │     └─ TRN-05/TRN-09 (sau Track G + PAY-04)
     ├─ Track C: NTF-04 → NTF-05 → MM-10/BK-10
     ├─ Track D: RP-01/02 (D2) → RP-05 → RP-06 (D7) → RP-07 → RP-08
     │            RP-03/04 sau RP-01/02
     ├─ Track E: AD-01 → AD-02 → AD-03 → AD-04
     ├─ Track F: SC-09 → SC-06 → SC-07/08 → SC-10/11 → SC-04/05
     ├─ Track G: D1a → TRN-01 → TRN-02 → TRN-03 → TRN-04 → TRN-06 → TRN-12
     │            → SYS-BK-01 → TRN-07 → TRN-08 → TRN-10/11 → TRN-05/TRN-09
     │            D1b → TRN-13 (phong trào); D1c → TRN-14 (nâng trình)
     └─ Track H: SOC-09, SOC booking-venue filter (sau MM-19), PP-05 Tournament UI (sau Track G)
```

**Không có vòng phụ thuộc.** Các nhánh A, C, D, E, F chạy song song được ngay sau INF-00. Track B chờ A; Track G chờ A + B (SYS-BK + payment) và D1a.

---

## 6. Chi tiết work package

### Track A — Payments & Refunds (critical path)

> **Cập nhật D9 — 2026-11-15:** ví ảo thuộc release. Track A chuyển sang **ví-first**: làm A0/WAL-01→08 trước; booking/giải trả bằng số dư ví, VNPAY chỉ dùng nạp/rút; refund credit ví. Chi tiết thực thi trong `03_thanh-toan-hoan-tien.md`. Các mục A1–A6 dưới đây giữ phần VNPAY adapter/webhook nhưng A3/A4/A5 phải đọc theo bản ví-first.

#### A1. PAY-01 — Cấu hình payment, signature và VNPAY adapter

- **Mục tiêu:** có provider thật để PAY-02/03/04 không phải giả lập.
- **Prereq:** INF-00.
- **Việc làm:**
  1. Chuẩn hóa env/config: `PAYMENT_PROVIDER`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`, `REFUND_ENABLED`, `REFUND_PROCESSING_TIMEOUT_MINUTES`.
  2. Xóa fallback `VNPAY → MOCK` trong `services/payments/provider.factory.ts`; thiếu config VNPAY phải fail rõ ràng.
  3. Viết `services/payments/adapters/vnpay.adapter.ts`:
     - build payment URL (amount ×100, GMT+7, locale, orderInfo, expiry);
     - verify signature HMAC-SHA512, chuẩn hóa thứ tự key, loại key rỗng, chống duplicate key;
     - query/refund request payload + parse response;
     - không log secret.
  4. Unit test signature: payload hợp lệ, bị sửa, thiếu key, key trùng, encoding.
  5. Cập nhật `.env.example`.
- **Exit:** signature verify PASS; thiếu config fail-closed; adapter được factory trả về khi `PAYMENT_PROVIDER=VNPAY`.

#### A2. PAY-06 — Mock provider an toàn

- **Prereq:** A1.
- **Việc làm:**
  1. Chặn `MOCK` ngoài `development/test` (cả factory và endpoint confirm).
  2. Không cho client override provider.
  3. Sửa thứ tự `simulateFailure` sau guard trạng thái terminal; confirmation dùng chung transaction với Booking.
  4. Test: production + Mock bị từ chối; replay terminal không đổi trạng thái; concurrent confirm một hiệu lực.
- **Exit:** Mock chỉ tồn tại ở dev/test; booking confirm idempotent.

#### A3. PAY-02 — Khởi tạo thanh toán

- **Prereq:** A1, A2.
- **Việc làm:**
  1. Booking: `POST /api/v1/bookings/:id/payment` trả URL VNPAY thật; reuse PENDING payment; lock booking + payment; amount lấy từ snapshot.
  2. Chuẩn hóa lỗi `409 PAYMENT_NOT_PAYABLE`.
  3. Tạo interface khởi tạo generic cho registration (Booking làm trước; registration nối ở G7/TRN-05, không stub production).
  4. Test: concurrent tạo 2 request → 1 payment dùng được; ownership; hold hết hạn; terminal.
- **Exit:** booking trả URL provider thật; Mock và VNPAY cùng contract.

#### A4. PAY-03 — Webhook/IPN idempotent

- **Prereq:** A3.
- **Việc làm:**
  1. `GET` + `POST /api/v1/payments/vnpay/webhook` (giữ POST tương thích; GET theo VNPAY).
  2. Verify signature trước mọi thay đổi; map `RspCode`/`Message` đúng contract provider; trả response provider, không trả envelope frontend.
  3. Một transaction: payment → SUCCESS + confirm Booking; duplicate callback không tác dụng lần 2; late payment không mở lại entity; set refund signal nếu provider đã thu.
  4. Return URL handler chỉ redirect, không confirm.
- **Exit:** duplicate/parallel callback chỉ 1 hiệu lực; invalid signature 400; late-payment an toàn.

#### A5. PAY-04 — Refund durable

- **Prereq:** A4 + D3.
- **Việc làm:**
  1. Schema delta refund intent/claim (D3): trạng thái `REFUND_PENDING`, attempt/claim timestamp, lỗi cuối, thời điểm timeout; migration riêng.
  2. Consumer cho `BookingCancelled`, `OwnerBookingCancelled`, `TournamentCancelled`, `RegistrationWithdrawn`: ghi intent trong cùng transaction hủy.
  3. Worker claim bằng update có điều kiện; gọi provider ngoài transaction; lưu kết quả; retry có giới hạn; timeout theo config; `REFUND_ENABLED=false` vẫn để intent observable.
  4. Mock + VNPAY adapter.
- **Exit:** hai worker chạy song song → đúng 1 refund; crash/retry không double; refund failed/timeout hiển thị đúng.

#### A6. PAY-05 — Test coverage

- **Prereq:** A3, A4, A5.
- **Việc làm:** bổ sung test signature/webhook, concurrent init, refund claim/retry/timeout, registration payment; Playwright pay → confirm → cancel → refund (Mock; VNPAY sandbox là release gate D4).

---

### Track B — Booking, Court Owner, Matchmaking integration

#### B0. BK-15 — Chuẩn hóa lock order Booking

- **Prereq:** INF-00.
- **Việc làm:** rà lại `persistBooking` lock court/facility theo thứ tự chung; test booking vs block vs owner hours.

#### B1. SYS-BK-01 — System booking primitive (mới, bắt buộc cho Tournament)

- **Prereq:** B0.
- **Lý do:** Tournament Tech Design yêu cầu booking hệ thống tạo bởi Organizer, không thanh toán, dùng chung lock order; hiện chỉ có `MatchBookingPort` (không dùng trong MVP) và không có `BookingService` contract.
- **Việc làm:**
  1. Tạo contract `backend/src/contracts/BookingService.ts` + implementation trong Booking module: `createSystemBooking({ courtId, date, startTime, endTime, source, sourceId, actorId })`, `releaseSystemBooking(bookingId, reason)`.
  2. Dùng chung lock facility → court/date, check maintenance block, opening hours, parent facility active, pricing coverage.
  3. Gắn `source = TOURNAMENT`, `matchId/tournamentId` đọc được; Owner cancel trả `OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE`.
  4. Test: conflict `TOURNAMENT_COURT_UNAVAILABLE`; release idempotent; không tạo refund.
- **Exit:** TRN-07 có thể schedule mà không tự viết logic booking.

#### B2. BK-06 — Booking payment integration

- **Prereq:** A3, A4.
- **Việc làm:** hai bước hold + payment; confirm callback atomic; UI/redirect dùng Return handler; test race confirm/cancel/hold expiry.

#### B3. BK-07 — Booking cancellation + refund event

- **Prereq:** A5, BK-06.
- **Việc làm:** bỏ best-effort event; persist refund intent trong transaction hủy; đọc trạng thái refund từ payment; test unpaid `NONE`, paid `PENDING/REFUNDED/FAILED`.

#### B4. BK-10 — Booking notifications

- **Prereq:** BK-06, BK-07, NTF-02 (đã DONE).
- **Việc làm:** persist notification trong transaction confirm/cancel/refund outcome; dedup key; test rollback.

#### B5. BK-12 — Frontend payment thật

- **Prereq:** BK-06, A4.
- **Việc làm:**
  1. Thay `MockPaymentModal` bằng CTA VNPAY thật; giữ Mock chỉ ở dev.
  2. Thêm route `/payment/vnpay-return` (đang thiếu) đọc trạng thái từ Booking API đã phân quyền; hiển thị đang xử lý khi IPN chậm.
  3. Test: cancel provider, return URL, session hết hạn, lỗi mạng.

#### B6. CO-05 — Owner cancellation API

- **Prereq:** B3, B4, A5.
- **Việc làm:** eligibility + row lock; persist CANCELLED + reason + one refund intent + one notification trong transaction; retry/failure; không cho hủy booking Tournament/đã bắt đầu.
- **Exit:** no second refund/notification; confirm-vs-cancel race an toàn.

#### B7. CO-08 — Owner cancellation UI

- **Prereq:** CO-05.
- **Việc làm:** modal bắt buộc lý do; phân biệt unpaid/paid/refund pending/failed; hiển thị real state từ API; block action với Tournament/started.

#### B8. MM-07 — Match booking linkage

- **Prereq:** BK-06 (booking CONFIRMED), MM-05.
- **Việc làm:** validate owner, Match `PENDING_COURT`, booking thuộc owner, paid/CONFIRMED, chưa link; set `booking_id/court_id/scheduled_at/CONFIRMED` qua `MatchModule`; replay cùng booking idempotent; `409 MATCH_BOOKING_ALREADY_LINKED`.

#### B9. MM-19 — Booking-link API

- **Prereq:** MM-07, A4.
- **Việc làm:** `POST /api/v1/matches/:id/booking`; validate date/window/duration/future/schedule/owner; lock order chung; ngoài khu vực vẫn cho phép; race link vs cancel.

#### B10. MM-20 — Cancellation/reconciliation

- **Prereq:** B3, MM-08, A5.
- **Việc làm:** dùng `MATCH_BOOKING_CANCELLATION_JOBS` (đã có schema) + worker bounded retry; Booking cancellation hủy Match liên kết; reconcile trước start/complete; policy refusal là outcome, không phải lỗi mạng.

#### B11. MM-15b — Match detail/link UI

- **Prereq:** MM-19.
- **Việc làm:** booking picker (paid bookings của owner), link action, pending-court deadline, outside-area, cancellation outcome, refresh.

#### B12. MM-17 / BK-14 — E2E thanh toán thật

- **Prereq:** B2→B11.
- **Việc làm:** Playwright với backend thật + DB test: booking → thanh toán → confirm; cancel → refund; match link → confirmed; owner cancel; notification. Không dùng intercept API cho các luồng này.

---

### Track C — Notifications (độc lập, chạy sớm)

#### C1. NTF-04 — UI thông báo

- **Prereq:** NTF-03 (DONE).
- **Việc làm:**
  1. `features/notifications/` dùng `PlayerHeader` hiện có; dropdown + trang danh sách; unread badge.
  2. Polling 30 giây (pause khi tab hidden); mark-read idempotent; không bulk-read ngoài spec.
  3. States: loading/empty/error; điều hướng tới resource nếu resolver có, nếu không thì không tạo link giả.
  4. Test component + Playwright mobile/desktop.

#### C2. NTF-05 — Resource resolver & link

- **Prereq:** D5 + NTF-02/03.
- **Việc làm:** resolver theo allowlist `POST`, `COMMENT`, `MATCHMAKING_REQUEST`, `MATCH`, `CONVERSATION`, `BOOKING`, `TOURNAMENT`; mỗi resolver phải kiểm tra quyền đọc tại thời điểm mở; link không cấp quyền. Test: resource bị ẩn/xóa → 404/không link; cross-user 404.

#### C3. MM-10 + producers còn thiếu

- **Prereq:** C2, MM-05/06, BK-10.
- **Việc làm:** persist `MM_APPLICATION_*`, `MM_INVITATION_*`, `MM_POST_*`, booking/match events đúng dedup; bổ sung acceptance MM-31.

---

### Track D — Reports & Moderation

#### D1. RP-01/02 — Đóng casing + hoàn thiện backend list/detail

- **Prereq:** D2.
- **Việc làm:** thống nhất casing; bổ sung filter target POST/COMMENT/MESSAGE sau RP-05; test RBAC/pagination/404; cập nhật Tech Design nếu cần.
- **Exit:** contract review ký; test admin-reports PASS.

#### D2. RP-05 — Schema target + evidence

- **Prereq:** INF-00.
- **Việc làm:**
  1. Migration: `reported_post_id`, `reported_comment_id`, `reported_message_id`; `reported_attachment_id`; thay `chk_report_target` đúng 1 trong 6 target (giữ target cũ Player/Facility/Tournament).
  2. Bảng `REPORT_EVIDENCE` (`report_id` PK, `content_text`, `captured_at`) và `REPORT_EVIDENCE_MEDIA` (`report_id`, `media_id`).
  3. Test: report cũ vẫn hợp lệ; 2 target bị từ chối; attachment không thuộc message bị từ chối.

#### D3. RP-06 — Player report API + snapshot

- **Prereq:** D2, D7, Social `canView` (DONE), Messaging read access (DONE).
- **Việc làm:**
  1. `POST /api/v1/reports` (Player, CSRF) `{ targetType, targetId, attachmentId?, reasonCode, description? }`.
  2. Authorize read access; chặn self-report; `REPORT_ENABLED`; reason codes; `OTHER` bắt buộc description.
  3. Persist report + evidence text + media refs trong cùng transaction; evidence bất biến sau edit/delete.
  4. Test: edit post sau report → evidence gốc; non-member report message 404; gate off → `409 REPORT_DISABLED`.

#### D4. RP-07 — Admin evidence + hide links

- **Prereq:** D1, D3, SOC-07 (DONE).
- **Việc làm:** `GET /admin/reports/:id` trả evidence; `GET /admin/reports/:id/evidence/media/:mediaId` chỉ media thuộc report; UI evidence panel; nút hide post/comment gọi API SOC-07; không hide message, không link chat.
- **Exit:** Admin chỉ thấy evidence; hide kèo không hủy recruitment/booking.

#### D5. RP-03/04 — Admin report UI

- **Prereq:** D1 + RP-07 (cho detail evidence).
- **Việc làm:** list/filter/pagination; detail; status update; reuse `AdminSidebar/AdminHeader`, `DataTable`, `FilterToolbar`; route `/admin/reports`.
- **Exit:** Admin xử lý report end-to-end.

#### D6. RP-08 — Shared report dialog + entry points

- **Prereq:** D3, SOC-08 (DONE), MSG-09 (DONE).
- **Việc làm:**
  1. `components/common/ReportDialog` dùng chung.
  2. Entry trên post, comment, message; chặn report nội dung của chính mình; recheck quyền khi mở/khôi phục.
  3. Không tạo API/schema thứ hai; không kèm upload tuỳ ý hay sanction.
- **Exit:** báo cáo post/comment/message hoạt động; Social không còn nút report “unavailable”.

---

### Track E — Admin Dashboard (độc lập)

#### E1. AD-01 — Indexes + repository + KPI service

- **Prereq:** INF-00.
- **Việc làm:** migration 9 index theo Tech Design §10; aggregate repository chỉ trả aggregate; KPI service theo range `today|7d|30d|this_month`; snapshot vs period đúng định nghĩa; test SQL trên DB mẫu.

#### E2. AD-02 — API

- **Prereq:** E1.
- **Việc làm:** `GET /api/v1/admin/dashboard/kpis|charts|recent-activities`; Zod range/limit; `Cache-Control private,max-age=30`; lỗi `ADMIN_DASHBOARD_INVALID_RANGE`; test RBAC/validation/empty.

#### E3. AD-03/04 — UI

- **Prereq:** E2.
- **Việc làm:** KPI cards, chart SVG/CSS thuần (không thêm chart lib), time-range selector, recent activities, quick links; route `/admin/dashboard`.
- **Exit:** Admin dashboard thật thay placeholder; Playwright mobile/desktop.

---

### Track F — System Configuration (độc lập)

#### F1. SC-09 — Audit table

- **Prereq:** INF-00.
- **Việc làm:** migration `SYSTEM_CONFIG_AUDIT` append-only (id, config_key, old_value, new_value, changed_by, changed_at); index; không trigger.

#### F2. SC-06 — Registry + validation

- **Prereq:** F1, D6.
- **Việc làm:** bổ sung domain `team`, `report`, key còn thiếu (`REPORT_ENABLED`, `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TEAM_INVITATION_TIMEOUT_MINUTES`); validation type/range/enum/cross-key; test bounds.

#### F3. SC-07/08 — Admin API

- **Prereq:** F2.
- **Việc làm:** list/detail/update; fallback default; no-op không audit; upsert + audit một transaction; clear cache sau commit; CSRF; lỗi `CONFIG_KEY_NOT_FOUND`/`CONFIG_VALUE_INVALID`; test concurrent last-commit-wins.

#### F4. SC-10 — Admin UI

- **Prereq:** F3.
- **Việc làm:** `/admin/configs`; filter domain; edit typed value; hiển thị `usingDefault`, updatedAt/By; states loading/error; không hiển thị secret.

#### F5. SC-11/SC-04/SC-05 — Test + docs

- **Prereq:** F3/F4.
- **Việc làm:** registry/API/audit/E2E; tài liệu System Config cập nhật trạng thái; đóng SC-04/05.

---

### Track G — Tournament (sau D1a; professional trước)

#### G1. TRN-01 — Schema + config

- **Prereq:** D1a + INF-00.
- **Việc làm:**
  1. Xác nhận/hoàn tất delta cũ: `PAYMENTS.booking_id` nullable, `registration_id`, check exactly-one; `TOURNAMENTS.entry_fee/facility_id/venue_note`; `TOURNAMENT_REGISTRATIONS.expires_at`; `MATCHES.court_id` nullable; seed timeout.
  2. Thêm cột phân loại giải (`competition_type` hoặc tên đã chốt tại D1a) cho professional/casual; backfill giải cũ = professional.
  3. Chốt participant model professional (account-only); casual để D1b.
  4. Migration + snapshot/journal + schema docs.
- **Exit:** fresh/populated migration PASS; existing rows hợp lệ; config idempotent.

#### G2. TRN-02 — Core CRUD + lifecycle

- **Prereq:** G1.
- **Việc làm:** create/update/list/detail/status; organizer authorization theo resource; optimistic `version`; lock rules sau registration; gates config; test role/ownership/validation.

#### G3. TRN-03 — Teams & invitations

- **Prereq:** TRN-02.
- **Việc làm:** team CRUD, invitation lifecycle, expiry, dedup, transaction; doubles registration gắn team.

#### G4. TRN-04 — Registration & withdrawal

- **Prereq:** TRN-03.
- **Việc làm:** đăng ký singles/doubles; free entry → CONFIRMED ngay; fee > 0 → PENDING_PAYMENT + expires_at; withdrawal theo trạng thái; unique constraints; test race capacity/withdraw/pay.

#### G5. TRN-06 — Bracket persistence + endpoint

- **Prereq:** TRN-04 (cần confirmed registrations), G1.
- **Việc làm:** nối pure bracket hiện có (`services/tournaments/bracket/`) vào transaction: tạo `MATCHES` + `TOURNAMENT_MATCHES`, auto-BYE, READY; rollback toàn bộ; test 5→8 slots/3 BYE; reject double generate.

#### G6. TRN-12 — Seed API + UI

- **Prereq:** TRN-06, TRN-02.
- **Việc làm:** `GET/PUT seeds`; validate seed range/duplicate; lock sau generate; UI organizer draw.

#### G7. TRN-05 — Registration payment

- **Prereq:** TRN-04 + A3/A4 (PAY-02/03).
- **Việc làm:** `POST /registrations/:id/payment`; provider URL; webhook confirm registration; expiry worker; test payment/refund path.

#### G8. TRN-07 — Scheduling/start/scoring

- **Prereq:** TRN-06 + SYS-BK-01.
- **Việc làm:** schedule qua `BookingService.createSystemBooking`; `TOURNAMENT_COURT_UNAVAILABLE`; start/games; release booking khi cancel; test conflict/race.

#### G9. TRN-08 — Resolution/advancement

- **Prereq:** TRN-07.
- **Việc làm:** derive `WINNER_DECLARED`; accept `WALKOVER`/`NONE`; advance winner; idempotent; concurrent resolution 1 thắng.

#### G10. TRN-10 + TRN-11 — Notifications + Frontend

- **Prereq:** TRN-02..08 + C2.
- **Việc làm:** notification types/resolvers; Player portal `/tournaments` (list/detail/registration/bracket), Organizer UI (create/manage/seeds/schedule/result); Admin tournament view (read-only nếu chưa có spec) — chỉ làm phần có trong PRD.
- **Exit:** placeholder `/tournaments` và `/admin/tournaments` được thay.

#### G11. TRN-09 — Cron/refund integration

- **Prereq:** TRN-05 + TRN-08 + A5.
- **Việc làm:** poller registration expiry/cancel/refund; bounded batch; idempotent; dùng refund intent.

#### G12 (đề xuất). TRN-13 — Giải phong trào

- **Prereq:** D1b.
- **Phạm vi:** nhập participant không tài khoản, danh sách participant, bracket/kết quả; không tạo account giả; không ghi vào lịch sử Player; không nâng trình/rank.
- **Nếu D1b chưa xong:** không triển khai; professional vẫn ship.

#### G13 (đề xuất). TRN-14 — Thành tích & nâng trình chuyên nghiệp

- **Prereq:** D1c + G9.
- **Phạm vi:** ghi nhận thành tích, hiển thị Social/profile, công thức nâng trình đã chốt; không dùng rating để nâng trình.
- **Nếu D1c chưa xong:** không triển khai; không mặc định “tham gia = tăng 1 bậc”.

---

### Track H — Social finishing, Profile, Admin consolidation

#### H1. SOC-05 booking-venue filter

- **Prereq:** MM-19.
- **Việc làm:** mở rộng `RecruitmentRepository.feedFilter` lọc cả `external_court_*` và booking facility/court; test filter theo sân booking; giữ filter cũ.

#### H2. SOC-09 — E2E thật

- **Prereq:** RP-08, SOC-08, NTF-04/05, backend Social DONE.
- **Việc làm:** Playwright + DB thật: publish/replay/quota/media auth/hide/reaction/comment/report; desktop + mobile; role matrix; gate off.

#### H3. PP-01/02/05 — Profile hoàn tất

- **Prereq:** Track G participant detail (cho PP-05 Tournament).
- **Việc làm:** aggregate non-null, profile stats có tournament; public profile modal mở từ Tournament; test.

#### H4. AF-01→03 — Admin frontend consolidation (optional)

- **Prereq:** D8.
- **Việc làm:** `meta` pagination, shared `httpClient`, `AdminLayout` route-level. Không làm nếu Tech Design chưa Ready; Admin Report/Dashboard/Config vẫn dùng pattern hiện tại.

#### H5. RT-05 — Ratings Tournament host

- **Prereq:** G10 (participant-facing Tournament Match Detail).
- **Việc làm:** gắn rating component vào tournament match detail; giữ casual routes riêng; test eligible participants.

---

## 7. Lịch trình 10 tuần (song song theo track)

| Tuần | Track A (Payments) | Track B (Booking/MM) | Track C (Notif) | Track D (Reports) | Track E/F (Admin) | Track G (Tournament) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | G0 + INF-00 | — | — | — | — | D1a/D1b/D1c |
| 1 | PAY-01 | BK-15 | NTF-04 | RP-01/02 (D2) | AD-01; SC-09 | TRN-01 (sau D1a) |
| 2 | PAY-06, PAY-02 | SYS-BK-01 | NTF-04 test | RP-05 | AD-02; SC-06 | TRN-02 |
| 3 | PAY-03 | BK-06 | NTF-05 | RP-06 (D7) | AD-03; SC-07 | TRN-03/04 |
| 4 | PAY-04 (D3) | BK-07/BK-10 | NTF-05 test | RP-07 | AD-04; SC-08 | TRN-06 |
| 5 | PAY-05 | BK-12, CO-05 | MM-10 | RP-03/04 | SC-10/11 | TRN-12 |
| 6 | hardening | CO-08, MM-07 | — | RP-08 | SC-04/05 | TRN-05/07 |
| 7 | — | MM-19, MM-20 | — | — | — | TRN-08/09/10 |
| 8 | — | MM-15b, MM-17 | — | — | — | TRN-11; TRN-13 nếu D1b |
| 9 | — | BK-14 E2E | — | SOC-09 | — | TRN-14 nếu D1c |
| 10 | Release gate D4 | Regression | Regression | Regression | Regression | Regression |

**Ghi chú tiến độ:**

- A1→A5 là chuỗi tuần tự, nhưng A6/test có thể bắt đầu từ tuần 3.
- Nếu D3 chưa đóng đúng tuần 4, A5 chuyển sang tuần 5; B3/B6/B10 dời tương ứng 1 tuần. Các track C/D/E/F vẫn giữ nguyên.
- Nếu D1a chưa đóng ở tuần 0, G1 dời; tuần 1–6 dồn nguồn lực sang A–F. Kế hoạch không bị block vì G là nhánh cuối.
- Nếu D1b/D1c chưa đóng, G12/G13 không nằm trong release; professional vẫn hoàn tất.

---

## 8. Ma trận kiểm thử & lệnh xác minh

### 8.1 Loại test bắt buộc theo work package

| Loại | Áp dụng | Ví dụ |
| --- | --- | --- |
| Unit | signature, bracket, validation, resolver logic | `vnpay-signature.test.ts`, `config-registry.test.ts` |
| Integration (Postgres thật) | migration, transaction, repo, refund claim | `report-evidence.test.ts`, `payment-refund.test.ts` |
| API (supertest) | mọi endpoint mới; RBAC/CSRF/404 masking | `report-api.test.ts`, `dashboard-api.test.ts` |
| Concurrency | payment init/webhook, refund worker, booking hold, match link/cancel | 2 request song song → 1 hiệu lực |
| Playwright contract | UI state, form, responsive | cấu hình hiện có |
| Playwright real E2E | booking→pay→refund, report, tournament, Social | DB test + backend thật, không intercept API |
| Manual sandbox | VNPAY IPN/refund | chỉ release gate D4 |

### 8.2 Lệnh chạy

```bash
npm run db:migrate
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.<feature>.config.ts
```

- Không chấp nhận “test pass” chỉ từ test double cho các acceptance cần provider thật (ghi rõ trong PR).
- Mỗi migration phải chạy trên **fresh DB** và **DB có dữ liệu mẫu**.
- Trước merge: `git diff --check`; không commit secret; cập nhật docs/tasks tương ứng.

---

## 9. Quy ước migration/API/config

1. **Số migration:** bắt đầu từ `0018` sau INF-00; mỗi PR một file; cập nhật `docs/plans/migration-slot-log.md`.
2. **Journal/snapshot:** regenerate cùng PR; không sửa file migration đã áp dụng (checksum).
3. **Không đổi tên file đã áp dụng.** Nếu cần sửa, tạo migration mới.
4. **API casing:** theo D2; không trộn snake_case/camelCase trong cùng module.
5. **Config mới:** thêm vào `shared/config/config-registry.ts` (type/default/min/max/domain), seed idempotent, reader typed, không đọc env trực tiếp trong service.
6. **Feature gate:** mọi gate mới phải fail-closed; Admin review không bị khóa bởi gate Player.
7. **Contract cross-module:** thêm vào `backend/src/contracts/`; consumer không import service cụ thể; transaction do caller sở hữu.

---

## 10. Risk register

| Risk | Mức | Giảm thiểu |
| --- | --- | --- |
| Journal/snapshot lệch (`0015`–`0017`) sinh migration sai | Cao | INF-00 trước mọi thứ; CI check generate rỗng |
| Refund schema delta chưa duyệt (D3) | Cao | D3 tuần 0; PAY-01/02/03 vẫn làm độc lập |
| VNPAY sandbox thiếu credentials | Trung bình | Adapter/signature/test offline; Mock E2E; D4 chỉ release gate |
| Casing Reports gây breaking FE | Trung bình | D2 trước RP-03/04; giữ adapter mapping nếu đổi |
| Notification resolver lộ dữ liệu | Cao | Allowlist + recheck quyền khi mở; cross-user 404 test |
| Race refund/link/cancel | Cao | Claim DB, lock order chung, test song song, không gọi provider trong transaction |
| Tournament TBD kéo dài | Cao | D1a/b/c tuần 0; professional tách khỏi phong trào; G12/G13 ngoài release |
| Migration number trùng giữa nhánh | Trung bình | Slot log + một migration/PR + rebase SOP |
| Docs status lệch code (Social/MM/BlockPort) | Trung bình | INF-01 cập nhật tasks theo bằng chứng code; không đổi status khi chưa test |
| Bundle FE tăng | Thấp | Không thêm chart lib; code-split route Admin |
| Scope creep (trang chủ Player, chat Social) | Trung bình | Ghi rõ out-of-scope; cần quyết định sản phẩm riêng |

---

## 11. Definition of Ready / Done

### Ready (trước khi bắt đầu WP)

- Prereq đã DONE và có test chứng minh.
- Quyết định G0 liên quan đã đóng.
- API/schema delta đã ghi trong Tech Design hoặc PR mô tả rõ.
- Migration slot đã đăng ký.
- Test plan ghi rõ loại test và DB dùng.

### Done (khi đóng WP)

- Acceptance criteria của task gốc PASS.
- Test unit/integration/API/concurrency tương ứng có trong repo và PASS.
- `npm run build` backend + frontend PASS; lint frontend PASS.
- Migration chạy fresh + populated PASS; docs/schema Change Log cập nhật.
- Không có TODO/stub production; không log secret.
- PR mô tả rõ phần chưa làm (nếu có) và không tự đánh dấu DONE cho task khác.

---

## 12. Mapping task cũ → work package mở khóa

| Task cũ | Được mở khóa bởi |
| --- | --- |
| BK-06 | A3 (PAY-02) + A4 (PAY-03) |
| BK-07 | A5 + BK-06 |
| BK-10 | BK-06/BK-07 + C1/C2 |
| BK-12 | BK-06 + A4 |
| BK-14 | B1→B12 |
| CO-05 | A5 + B3/B4 |
| CO-08 | CO-05 |
| MM-07 | BK-06 |
| MM-19 | MM-07 + A4 |
| MM-20 | MM-08 + B3 + A5 |
| MM-15 (booking) | MM-19 |
| MM-17 | B12 |
| NTF-04 | NTF-03 (đã DONE) |
| NTF-05 | D5 + NTF-02/03 |
| RP-03/04 | D1 (RP-01/02) |
| RP-05/06/07/08 | D2/D3/D4/D6 |
| AD-01→04 | E1→E3 |
| SC-06→11 | F1→F5 |
| TRN-01 | D1a + INF-00 |
| TRN-02→04 | TRN-01 |
| TRN-06 | TRN-04 |
| TRN-12 | TRN-06 + TRN-02 |
| TRN-05 | TRN-04 + A3/A4 |
| TRN-07 | TRN-06 + SYS-BK-01 |
| TRN-08 | TRN-07 |
| TRN-09 | TRN-05 + TRN-08 + A5 |
| TRN-10/11 | TRN-02→08 + C2 |
| SOC-05 filter | MM-19 |
| SOC-09 | RP-08 + C1 + H2 |
| PP-05 Tournament | TRN-11 |
| RT-05 | TRN-11 |
| AF-01→03 | D8 |

---

## 13. Checklist theo tuần

### Tuần 0

- [ ] G0: D1a, D1b, D1c, D2, D3, D5, D6, D7, D8 có kết luận.
- [ ] INF-00: journal/snapshot `0015`–`0017` sửa xong; generate diff rỗng.
- [ ] Tạo `docs/plans/migration-slot-log.md`; chốt 0018 là số kế tiếp.
- [ ] INF-01: rà lại status Social/MM/BlockPort; chỉ sửa docs theo bằng chứng.

### Tuần 1–5

- [ ] A1→A5 hoàn tất; A6 bắt đầu.
- [ ] C1→C3; D1→D5; E1→E3; F1→F5.
- [ ] B0/B1 xong; B2/B3 bắt đầu sau A3/A4/A5.

### Tuần 5–8

- [ ] B4→B11; CO-05/08; MM-07/19/20/15b.
- [ ] G1→G11 professional.
- [ ] D6 (RP-08) xong.

### Tuần 9–10

- [ ] B12, H1, H2, H3.
- [ ] Release gate D4 nếu có sandbox.
- [ ] Full regression + build + lint + docs status sync.
- [ ] Tổng kết: module nào DONE, module nào intentionally partial (G12/G13/AF) và lý do.

---

## 14. Ngoài phạm vi kế hoạch này

- Trang chủ Player `/` (đang placeholder): chưa có PRD/route spec; cần quyết định sản phẩm trước.
- Chat/nhóm chat tạo từ Social hoặc Matchmaking: thuộc Messaging, hiện đã hoàn thành phần lõi; shortcut tạo nhóm chưa có spec.
- Split bill, ví ảo, nạp/rút tiền, đối soát chủ sân: quyết định 2026-11-08 nêu TBD; không nằm trong kế hoạch kỹ thuật này.
- Nâng trình tự động từ rating: đã bị thay thế; chỉ giải chuyên nghiệp (D1c).
- Upload tài liệu/PDF trên post, scan malware, moderation tự động: non-goal Social.
- AF-01→03 nếu D8 chưa Ready.

---

## 15. Phụ lục — file dự kiến chạm

| Nhóm | File/thư mục |
| --- | --- |
| Migration | `backend/src/db/migrations/*`, `meta/_journal.json`, `meta/*_snapshot.json` |
| Payments | `backend/src/services/payments/**`, `routes/payments/**`, `contracts/PaymentService.ts` |
| Booking | `backend/src/services/booking/**`, `contracts/BookingService.ts`, `routes/booking/**` |
| Matchmaking | `backend/src/services/matchmaking/**`, `routes/matchmaking/**`, `jobs/matchmakingScheduler.ts` |
| Notifications | `backend/src/services/notifications/**`, `routes/notifications/**`, `frontend/src/features/notifications/**` |
| Reports | `backend/src/db/schema/reports.ts`, `services/admin/AdminReportService.ts`, `repositories/reports/**`, `routes/admin/reportRoutes.ts`, `frontend/src/features/admin/**` |
| Dashboard | `backend/src/services/admin/Dashboard*`, `routes/admin/`, `frontend/src/features/admin/pages/AdminDashboardPage.tsx` |
| System Config | `backend/src/shared/config/**`, `db/schema/config.ts`, `routes/admin/config*`, `frontend/src/features/admin/pages/SystemConfigPage.tsx` |
| Tournament | `backend/src/db/schema/tournaments.ts`, `services/tournaments/**`, `routes/tournament/**`, `frontend/src/features/tournament/**` |
| Social/Profile | `frontend/src/features/social/**`, `features/player/profile/**`, `backend/src/services/social/**` |
| Docs | `docs/features/**/tasks.md`, `docs/architecture/database-schema.md`, `docs/architecture/frontend.md`, `docs/business-rules-config-matrix.md` |

---

## 16. Kết luận điều hành

- **Đường găng:** INF-00 → PAY-01 → PAY-06 → PAY-02 → PAY-03 → PAY-04 → BK-06/07 → CO-05/MM-19/20 → TRN-05/09.
- **Hai quyết định có thể làm trượt tiến độ:** D3 (refund schema) và D1a (Tournament professional). Cả hai nằm ở Tuần 0, có owner rõ ràng, không chặn các track độc lập.
- **Không có work package nào chờ một module “sẽ làm sau” mà không có ID và thứ tự.** Mọi task từng BLOCKED đều có dòng mapping ở §12.
- **Phần không thể hoàn tất trong 10 tuần do nghiệp vụ TBD** (giải phong trào, nâng trình chuyên nghiệp) được tách thành G12/G13, không giả định, không đánh dấu DONE, và không chặn release của phần professional.
