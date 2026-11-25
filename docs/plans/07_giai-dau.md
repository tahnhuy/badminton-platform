# 07 — Giải đấu

- Ưu tiên: 07
- Track/Phase: Track G / Phase 2–3
- Prerequisite: 01 G0 (D1a cho G1–G11; D1b đã chốt cho G12; D1c partial cho G13), 02 INF-00. **G1–G6 chạy ngay sau 01/02**; G7 cần 03; G8 cần 06 (B1 SYS-BK-01); G10 cần 04 (C2); G12 cần D1b đã chốt; G13 chỉ khi công thức nâng trình được đồng đội chốt.
- Exit gate: giải chuyên nghiệp chạy end-to-end; phong trào/nâng trình chỉ làm khi quyết định tương ứng đã chốt
- Mở khóa: RT-05, PP-05 Tournament, TRN frontend

> **Cập nhật 2026-11-25:** Tournament PRD/Tech Design/tasks được viết lại (Draft, chờ teammate review). Quyết định mới: không liên kết sân/booking (xếp lịch tự động trên sân ảo), điều kiện trình độ min–max, lệ phí trừ ví ngay và chuyển cho Organizer khi giải `COMPLETED`, Organizer loại được người tham gia, bỏ rating trận giải, giải phong trào để sau. Danh sách task mới TRN-01…14 trong `docs/features/tournament/tasks.md` **thay thế** các mục G1–G13 bên dưới (G1–G13 giữ lại làm lịch sử).

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Hoàn thiện module giải đấu từ schema cũ + bracket algorithm thành luồng thật: Organizer tạo giải, Player đăng ký/thanh toán, bracket, xếp lịch sân, ghi điểm, xác định winner, thông báo và UI. Ưu tiên **giải chuyên nghiệp** để không phụ thuộc các quyết định phong trào/nâng trình.

## 2. Điểm cần chốt

- [ ] **TRN-D1 (D1a):** phạm vi giải chuyên nghiệp đã chốt.
- [ ] **TRN-D2:** cột phân loại giải (`competition_type`) và giá trị `PROFESSIONAL`/`CASUAL`.
- [ ] **TRN-D3:** participant model chuyên nghiệp chỉ dùng tài khoản.
- [ ] **TRN-D4:** bracket single-elimination, BYE, seed order.
- [ ] **TRN-D5:** entry fee > 0 dùng payment PENDING; fee = 0 confirm ngay.
- [ ] **TRN-D6:** schedule dùng `BookingService.createSystemBooking`, không tự tạo booking.
- [ ] **TRN-D7:** `TIE`/`WALKOVER`/`NONE` semantics theo Tech Design.
- [ ] **TRN-D8 (D1b):** participant không tài khoản cho phong trào.
- [ ] **TRN-D9 (D1c):** công thức nâng trình, achievement và hiển thị.
- [ ] **TRN-D10:** Admin tournament chỉ read-only nếu PRD không yêu cầu khác.

## 3. Danh sách task chi tiết

### [ ] G1 — TRN-01: Schema + config

**Mục đích:** đưa schema tournament về đúng thiết kế hiện hành và có config cần thiết.

**Việc làm:**

- [ ] Audit delta cũ: `PAYMENTS.booking_id` nullable, `registration_id`, exactly-one check.
- [ ] `TOURNAMENTS.entry_fee/facility_id/venue_note`.
- [ ] `TOURNAMENT_REGISTRATIONS.expires_at` + status values.
- [ ] `MATCHES.court_id` nullable.
- [ ] Thêm `competition_type` (D2), backfill giải cũ = `PROFESSIONAL`.
- [ ] Seed `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES=10`.
- [ ] Thêm registry entry cho key mới (hoặc phối hợp SC-06).
- [ ] Migration + snapshot/journal + `database-schema.md` Change Log.
- [ ] Test fresh/populated; existing payment rows hợp lệ.

**Acceptance:**

- [ ] `npm run db:migrate` sạch.
- [ ] Rows cũ thỏa CHECK mới.
- [ ] Config đọc idempotent.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/tournament-migration.test.ts
```

### [ ] G2 — TRN-02: Core CRUD + lifecycle

**Mục đích:** Organizer quản lý giải và chuyển trạng thái an toàn.

**Việc làm:**

- [ ] `POST/GET/PUT /api/v1/tournaments`; list/detail.
- [ ] Status transitions: DRAFT → OPEN → CLOSED → READY → IN_PROGRESS → COMPLETED/CANCELLED.
- [ ] Optimistic `version`; conflict 409.
- [ ] Authorization theo `creatorId`; Admin cancel theo quyền.
- [ ] Lock edit khi đã có registration CONFIRMED (entry fee).
- [ ] Validate thời gian đăng ký/giải; participant limit.
- [ ] Gate config.
- [ ] Test role/ownership/status/optimistic lock.

**Acceptance:**

- [ ] Organizer khác không sửa được giải.
- [ ] Transition sai bị từ chối.
- [ ] Fee bị khóa sau confirmed registration.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-core.test.ts
```

### [ ] G3 — TRN-03: Teams và invitations

**Mục đích:** hỗ trợ đôi với team/captain/invitation.

**Việc làm:**

- [ ] CRUD team; captain-only.
- [ ] Invitation lifecycle: PENDING/ACCEPTED/DECLINED/EXPIRED.
- [ ] Timeout theo config; dedup.
- [ ] Transaction: accept → add player; capacity check.
- [ ] Test invitation expired/duplicate/self/cross-team.

**Acceptance:**

- [ ] Team đôi chỉ có tối đa 2 player active.
- [ ] Invitation hết hạn không chiếm slot.
- [ ] Không có player ở 2 team cùng giải.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-teams.test.ts
```

### [ ] G4 — TRN-04: Registration và withdrawal

**Mục đích:** Player đăng ký/rút đúng trạng thái và quy tắc.

**Việc làm:**

- [ ] Đăng ký singles/doubles; team registration.
- [ ] Fee = 0 → `CONFIRMED` ngay.
- [ ] Fee > 0 → `PENDING_PAYMENT` + `expires_at`.
- [ ] Uniqueness: một player/team một đăng ký active.
- [ ] Withdrawal: trước khi đóng đăng ký; không rút khi đã bracket/started.
- [ ] Capacity/concurrency: không vượt participant limit.
- [ ] Test race đăng ký cuối, rút + pay, double submit.

**Acceptance:**

- [ ] Không vượt limit.
- [ ] Rút giải phóng slot đúng.
- [ ] Fee 0 confirm ngay, fee > 0 chờ payment.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-registration.test.ts
```

### [ ] G5 — TRN-06: Bracket persistence + endpoint

**Mục đích:** nối bracket algorithm đã có vào DB và API.

**Việc làm:**

- [ ] `POST /tournaments/:id/bracket/generate`.
- [ ] `GET /tournaments/:id/bracket`.
- [ ] Validate N ≥ 2; N < 2 → cancel theo spec.
- [ ] Tạo `MATCHES` + `TOURNAMENT_MATCHES` trong một transaction.
- [ ] BYE auto-advance không tạo MATCHES row.
- [ ] Seed order được tôn trọng; unseeded random có seed.
- [ ] Reject generate lần 2.
- [ ] Test 5→8 slots/3 BYE; rollback giữa chừng; double generate.

**Acceptance:**

- [ ] Bracket đúng power-of-2.
- [ ] Không có partial bracket khi lỗi.
- [ ] Không tạo Match cho BYE.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-bracket.test.ts
```

### [ ] G6 — TRN-12: Seed API + UI — UI-REDO

**Mục đích:** Organizer chọn seed trước khi bốc thăm.

**Việc làm:**

- [ ] `GET /bracket/seeds` trả confirmed registrations + gợi ý.
- [ ] `PUT /bracket/seeds` validate seedNo/registrationId.
- [ ] Chỉ cho phép trước generate, sau CLOSED/READY.
- [ ] UI draw: kéo/chọn seed, hiển thị BYE.
- [ ] Test duplicate/out-of-range/non-confirmed.

**Acceptance:**

- [ ] Seed lưu đúng; generate tôn trọng.
- [ ] Sau generate không sửa seed.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-seeds.test.ts
cd frontend && npx playwright test --config playwright.tournament.config.ts
```

### [ ] G7 — TRN-05: Registration payment

**Mục đích:** thu phí giải qua cùng payment pipeline.

**Prerequisite:** TRN-04 + A3/A4.

**Việc làm:**

- [ ] `POST /registrations/:id/payment` trả URL provider.
- [ ] Webhook confirm registration đúng một lần.
- [ ] Expiry worker: quá hạn → EXPIRED, giải phóng slot.
- [ ] Refund khi hủy giải/rút theo policy (nối A5).
- [ ] Test success/duplicate/late/expiry/refund.

**Acceptance:**

- [ ] Registration PENDING → CONFIRMED sau callback.
- [ ] Duplicate callback không xác nhận 2 lần.
- [ ] Hết hạn không chiếm slot.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-payment.test.ts
```

### [ ] G8 — TRN-07: Scheduling, start, scoring

**Mục đích:** Organizer xếp sân, bắt đầu, ghi điểm.

**Prerequisite:** TRN-06 + B1 SYS-BK-01.

**Việc làm:**

- [ ] `PUT /matches/:match_id/schedule`: tạo system booking qua `BookingService`.
- [ ] Conflict → `409 TOURNAMENT_COURT_UNAVAILABLE`.
- [ ] `POST /matches/:match_id/start`: cần court; first start → tournament IN_PROGRESS.
- [ ] `PUT /matches/:match_id/games`: validate shape/order.
- [ ] Cancel match → release system booking.
- [ ] Không cho reschedule sau start.
- [ ] Test conflict, unscheduled start, release, race schedule/cancel.

**Acceptance:**

- [ ] Schedule tạo booking không thanh toán.
- [ ] Start không có court bị từ chối.
- [ ] Games lưu đúng thứ tự.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-scheduling.test.ts
```

### [ ] G9 — TRN-08: Resolution và advancement

**Mục đích:** xác định winner và đưa vào vòng sau.

**Việc làm:**

- [ ] `PUT /matches/:match_id/result`.
- [ ] Derive `WINNER_DECLARED` từ games; accept `WALKOVER`/`NONE`.
- [ ] Winner phải là participant hợp lệ.
- [ ] Advance vào `next_registration_slot`; idempotent.
- [ ] `NONE` không advance.
- [ ] Test concurrent resolve; wrong winner; double resolve; bracket cuối.

**Acceptance:**

- [ ] Winner xuất hiện đúng slot vòng sau.
- [ ] Resolve lần 2 không đổi kết quả.
- [ ] `NONE` không tự advance.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-resolution.test.ts
```

### [ ] G10 — TRN-10/11: Notifications + Frontend — UI-REDO

**Mục đích:** người dùng thấy giải và nhận thông báo.

**Việc làm:**

- [ ] Notification types: registration confirmed/cancelled, bracket ready, match scheduled/start/result, tournament completed.
- [ ] Resolver tới `/tournaments/:id` và match detail.
- [ ] Player UI `/tournaments`: list/detail/register/withdraw/bracket/my matches.
- [ ] Organizer UI: create/edit, registrations, seeds, schedule, start, result, complete.
- [ ] Admin UI: danh sách/chi tiết read-only theo PRD.
- [ ] Thay placeholder `/tournaments` và `/admin/tournaments`.
- [ ] Responsive + empty/loading/error.

**Acceptance:**

- [ ] Player đăng ký và xem bracket.
- [ ] Organizer chạy giải end-to-end trên UI.
- [ ] Admin không có action ngoài scope.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.tournament.config.ts
```

### [ ] G11 — TRN-09: Cron và refund

**Mục đích:** tự động xử lý hết hạn/hủy/hoàn tiền.

**Việc làm:**

- [ ] Poller registration expiry (config).
- [ ] Poller tournament cancellation/refund.
- [ ] Bounded batch, claim, retry; idempotent.
- [ ] Dùng refund intent A5, không tự đổi status payment.
- [ ] Test crash/retry/duplicate.

**Acceptance:**

- [ ] Registration hết hạn → EXPIRED + slot released.
- [ ] Hủy giải → refund đúng một lần.
- [ ] Worker không xử lý trùng.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/tournament-jobs.test.ts
```

### [ ] G12 — TRN-13: Giải phong trào (D1b đã chốt)

**Mục đích:** giải không bắt buộc tài khoản, không rank/nâng trình.

**Quyết định D1b:** nhập thủ công hoặc Excel; Organizer chọn free/paid; paid dùng payment pipeline; hiển thị summary công khai, ẩn SĐT/ghi chú liên hệ.

**Việc làm:**

- [ ] Nhập participant không tài khoản thủ công hoặc import Excel.
- [ ] Không tạo account giả; không gắn vào lịch sử Player.
- [ ] Bracket/kết quả cho danh sách participant.
- [ ] Không tính rating/skill.
- [ ] UI-REDO — UI Organizer cho participant list; ẩn contact trong public summary.
- [ ] Test: participant không tài khoản không xuất hiện trong profile/rating.

**Acceptance:**

- [ ] Giải phong trào chạy độc lập với tài khoản.
- [ ] Không có dữ liệu giả trong Player history.
- [ ] Không nâng trình.

### [ ] G13 — TRN-14: Thành tích/nâng trình (D1c partial, defer)

**Quyết định D1c:** điều kiện tham gia = Player + thời gian + slot; sửa/hủy kết quả đã nâng trình → revert tự động; công thức/ngưỡng nâng trình và xác nhận thành tích do đồng đội hoàn thiện sau.

**Việc làm:**

- [ ] Lưu achievement theo participant/registration (khi công thức được chốt).
- [ ] Hiển thị profile/Social theo privacy đã chốt.
- [ ] Áp công thức nâng trình đã chốt; không dùng rating.
- [ ] Xử lý sửa/hủy kết quả: revert tự động.
- [ ] Test idempotent, revert, privacy.

**Acceptance:**

- [ ] Chỉ giải professional tác động trình độ.
- [ ] Casual/casual match/rating không nâng trình.
- [ ] Sửa/hủy kết quả revert đúng.

**Nếu công thức chưa có:** TRN-14 ra khỏi release; không mặc định tăng 1 bậc.

## 4. Test đầu ra toàn track

```bash
npm run db:migrate
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.tournament.config.ts
```

- [ ] Migration fresh + populated.
- [ ] Bracket 5→8/3 BYE.
- [ ] Registration limit/concurrency.
- [ ] Payment/refund registration.
- [ ] Schedule/start/result.
- [ ] UI-REDO — UI Player/Organizer/Admin.
- [ ] Không có path nào tạo participant giả.

## 5. Checklist hoàn thành file

- [ ] G1→G11 xong (professional).
- [ ] G12 chỉ xong khi D1b; G13 chỉ xong khi D1c.
- [ ] Bracket persistence có test rollback.
- [ ] System booking được dùng, không tự viết booking.
- [ ] Payment/refund registration có test.
- [ ] UI-REDO — UI thay placeholder.
- [ ] Docs/tasks cập nhật; ghi rõ phần phong trào/nâng trình nếu chưa làm.
- [ ] `07` DONE (hoặc PARTIAL có lý do) trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Schema cũ khác thiết kế mới | TRN-01 audit kỹ; backfill rõ |
| Bracket lỗi giữa transaction | Một transaction + rollback test |
| Schedule đè booking Player | Dùng chung lock/validation với Booking |
| Payment registration trùng | Reuse payment + unique + idempotent |
| TBD phong trào kéo dài | Tách G12/G13 khỏi release professional |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc:

- P26 Discovery/List: `6:3`; P27 Detail: `6:4824`.
- P33 Create: `6:2702`; P35 Manage Participants: `6:3132`.
- P36 Generate/Seeding: `6:4275`; P37 Manage Matches: `6:5685`.
- P31 Bracket: `6:1504`.

**Chốt:** giữ spec; bỏ BWF/prize/map/hotline/ELO.

**Bổ sung vào task:**

- [ ] **G2/G10:** form tạo/sửa chỉ dùng field schema: name, format, matchType, participantLimit, entryFee, facility/venueNote, registration/tournament windows; không có “Fees & Prize Matrix”, prize pool, BWF standard, scale/ELO.
- [ ] **G10:** state coverage cho P68–P73: Registration Success, Registration Closed, Ready, In Progress, Cancelled, Completed; dùng banner/detail state, không tạo route riêng nếu cùng trang.
- [ ] **G10:** P26/P27 bỏ hero “BWF Sanctioned”, “1.2K+ VĐV”, prize structure, hotline/email BTC, cam kết hoàn phí nếu đổi ngày; dùng số liệu thật từ API.
- [ ] **G10:** P35 bỏ “Total Revenue” KPI; giữ slots/confirmed/pending/available và table/filter.
- [ ] **G10:** P36 seeding dùng skill-level + seed order; không ELO/ranking; manual override chỉ trong seed order đã duyệt.
- [ ] **G10:** P55 withdrawal copy đúng PRD: hoàn 100% khi paid CONFIRMED rút trước khi đóng đăng ký; không hứa hoàn tức thì.
- [ ] **G10:** Admin A06/A07 read-only + Admin cancel theo PRD; không triển khai A14 participant management.
- [ ] **G10 test:** Playwright P26/P27/P31/P33/P35/P36/P37 + states P68–P73; kiểm tra không có prize/BWF/map.

**Loại bỏ khỏi UI:**

- [ ] BWF Sanctioned, 1.2K+ athletes, prize matrix/pool, map snippet, hotline/email mẫu, ELO/ranking.
- [ ] “Hoàn phí 100% nếu đổi ngày” (không có rule này trong PRD).
- [ ] Total Revenue KPI trên trang quản lý participants.

**Cập nhật checklist hoàn thành:**

- [ ] Form tạo/sửa không có field ngoài schema.
- [ ] Có state pages/banners P68–P73.
- [ ] Không có prize/BWF/map/hotline.
- [ ] Admin tournament không có A14.
