# 06 — Booking, Court Owner và Matchmaking

- Ưu tiên: 06
- Track/Phase: Track B / Phase 1–2
- Prerequisite: 01 G0, 02 INF-00. **B0/B1 chạy ngay sau 02**; B2/B3 cần 03 (A3/A4/A5); B4 cần 03+04; phần còn lại theo thứ tự trong file.
- Exit gate: Booking thanh toán thật + refund; Owner hủy đúng; Match link/cancel booking hoạt động; E2E thật PASS
- Mở khóa: TRN-05/07/09, SOC booking-venue filter

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Nối các module đã có (booking hold, owner schedule, match lifecycle) với payment/refund/notification để hoàn tất luồng trả tiền, hủy, hoàn tiền và liên kết sân cho kèo. Đây là track mở khóa phần lớn nghiệp vụ còn lại.

## 2. Điểm cần chốt

- [x] **B-D1:** system booking primitive dùng chung cho Tournament (contract mới).
- [x] **B-D2:** lock order chung: facility → court/date → booking → match/request.
- [x] **B-D3:** refund intent được ghi trong transaction hủy, provider gọi ngoài transaction.
- [x] **B-D4:** Match link chỉ chấp nhận booking đã CONFIRMED/paid của owner.
- [x] **B-D5:** Owner không được hủy booking Tournament; trả `OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE`.
- [x] **B-D6:** cancellation job dùng bảng `MATCH_BOOKING_CANCELLATION_JOBS` hiện có; không tạo bảng mới nếu không cần.
- [x] **B-D7:** E2E dùng backend + DB thật, không intercept API cho luồng tiền.

## 3. Danh sách task chi tiết

### [x] B0 — BK-15: Chuẩn hóa lock order Booking

**Mục đích:** tránh deadlock giữa booking, block slot, owner hours, match link.

**Việc làm:**

- [x] Rà `persistBooking` và các write path booking.
- [x] Áp thứ tự: facility row → court/date advisory → booking → match/request.
- [x] Tài liệu hóa thứ tự trong Booking Tech Design nếu chưa có.
- [x] Test barrier: booking vs block, booking vs owner hours, booking vs match link.

**Acceptance:**

- [x] Không deadlock trong test song song.
- [x] Không thay đổi hành vi player hiện có.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-lock-order.test.ts
```

### [x] B1 — SYS-BK-01: System booking primitive

**Mục đích:** Tournament tạo booking hệ thống không thanh toán, dùng chung mọi validation.

**Việc làm:**

- [x] Tạo `backend/src/contracts/BookingService.ts`:
  - [x] `createSystemBooking({ courtId, date, startTime, endTime, source, sourceId, actorId })`.
  - [x] `releaseSystemBooking({ bookingId, reason })`.
- [x] Implementation trong `services/booking/` dùng repository hiện có.
- [x] Dùng chung: facility lock → court/date lock → check maintenance block → opening hours → parent facility active → pricing coverage.
- [x] Lưu `source = TOURNAMENT`, `sourceId = tournamentMatchId` (hoặc cột tương đương đã có).
- [x] Không tạo payment; không refund.
- [ ] UI-REDO — Owner read hiển thị context Tournament; Owner cancel bị chặn.
- [x] Test: conflict `TOURNAMENT_COURT_UNAVAILABLE`; release idempotent; không tạo payment.

**Acceptance:**

- [x] TRN-07 có thể schedule qua contract, không tự viết booking logic.
- [x] Booking hệ thống không xuất hiện như booking trả tiền của Player.
- [x] Release không tạo refund.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/system-booking.test.ts
```

### [x] B2 — BK-06: Booking payment integration

**Mục đích:** booking hold → thanh toán → confirm, không có khe hở transaction.

**Việc làm:**

- [x] Nối `POST /bookings/:id/payment` với provider (A3).
- [x] Confirm callback (A4) gọi `confirmBooking` trong cùng transaction payment.
- [x] Recheck ownership, hold expiry, terminal state trong transaction.
- [x] Không mở lại booking đã EXPIRED/CANCELLED.
- [x] Test: success, invalid signature, hold hết hạn, late payment, duplicate callback, concurrent confirm/cancel.

**Acceptance:**

- [x] Booking `PENDING_PAYMENT` → `CONFIRMED` đúng một lần.
- [x] Booking hết hạn không được confirm.
- [x] Refund signal khi provider thu tiền muộn.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-payment.test.ts
```

### [x] B3 — BK-07: Booking cancellation + refund

**Mục đích:** hủy booking tạo refund intent durable, không chỉ đổi status.

**Việc làm:**

- [x] Bỏ event best-effort; persist refund intent trong cùng transaction hủy (A5).
- [x] `PENDING_PAYMENT` → `CANCELLED`, `refundStatus=NONE`.
- [x] `CONFIRMED` trước giờ → `CANCELLED`, refund intent PENDING.
- [x] Policy player cancel: `PLAYER_CAN_CANCEL_BOOKING`, deadline.
- [x] Đọc trạng thái refund từ Payment, không suy đoán.
- [x] Test: unpaid, paid, repeat, concurrent cancel vs confirm, refund worker integration.

**Acceptance:**

- [x] Hủy paid booking → refund chạy đúng một lần.
- [x] Hủy unpaid không tạo refund.
- [x] Repeat idempotent.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-cancel-refund.test.ts
```

### [x] B4 — BK-10: Booking notifications

**Mục đích:** người dùng biết booking được confirm/hủy/hoàn tiền.

**Việc làm:**

- [x] Persist notification trong transaction confirm/cancel/refund outcome.
- [x] Dedup key: `booking:<id>:<event>`.
- [x] Recipient: booking owner; owner cancellation → player; refund outcome → player.
- [x] Test: rollback kéo theo notification; retry không nhân đôi.
- [x] Dùng resolver NTF-05.

**Acceptance:**

- [x] Mỗi sự kiện có đúng một notification/recipient.
- [x] Link mở booking detail đúng quyền.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-notifications.test.ts
```

### [ ] B5 — BK-12: Frontend thanh toán thật — UI-REDO

**Mục đích:** người dùng thanh toán qua provider thật; Mock chỉ ở dev.

**Việc làm:**

- [ ] UI-REDO CTA thanh toán dùng ví khi có số dư; Mock chỉ hiển thị trong dev/test (đã chốt ví-first, không dùng VNPAY cho booking).
- [ ] UI-REDO Giữ Mock modal chỉ khi `import.meta.env.DEV`/config cho phép.
- [x] Không thêm route `/payment/vnpay-return` trong release này (quyết định ví-first).
- [x] Không áp dụng return page VNPAY; Booking detail/pending đọc trạng thái thật từ API.
- [ ] UI-REDO Xử lý cancel provider, session expired, network error.
- [ ] UI-REDO Test Playwright: success/cancel/return chậm.

**Acceptance:**

- [ ] UI-REDO Không còn payment CTA chỉ dùng Mock ở production (backend chặn Mock ngoài dev/test; UI ẩn Mock ngoài DEV).
- [x] Không áp dụng Return URL VNPAY.
- [ ] UI-REDO UI hiển thị đúng trạng thái thật.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.booking-payment.config.ts
```

### [x] B6 — CO-05: Owner cancellation API

**Mục đích:** chủ sân hủy booking đúng chính sách, hoàn tiền và thông báo một lần.

**Việc làm:**

- [x] Endpoint hủy booking thuộc facility của owner.
- [x] Eligibility: không Tournament, chưa bắt đầu, trong deadline owner.
- [x] Row lock; persist CANCELLED + reason + cancelledAt + one refund intent + one notification.
- [x] Idempotent repeat; policy refusal rõ ràng.
- [x] Confirm-vs-cancel race an toàn.
- [x] Test: unpaid/paid, tournament, started, deadline, repeat, race, rollback.

**Acceptance:**

- [x] Không hủy được booking Tournament/đã bắt đầu.
- [x] Paid → refund intent PENDING; unpaid → NONE.
- [x] Không refund/notification thứ hai.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/owner-cancellation.test.ts
```

### [ ] B7 — CO-08: Owner cancellation UI — UI-REDO

**Mục đích:** chủ sân hủy có lý do và thấy đúng trạng thái hoàn tiền.

**Việc làm:**

- [ ] UI-REDO Modal bắt buộc lý do + xác nhận chính sách.
- [ ] UI-REDO Hiển thị unpaid/paid/refund pending/success/failed từ API.
- [ ] UI-REDO Disable với Tournament/đã bắt đầu.
- [ ] UI-REDO Refresh detail/history sau khi hủy; lỗi block slot không làm hỏng hiển thị hủy.
- [ ] UI-REDO Playwright desktop/mobile.

**Acceptance:**

- [ ] UI-REDO Không hiển thị “đã hoàn tiền” khi còn PENDING/FAILED.
- [ ] UI-REDO Không có nút hủy với booking không đủ điều kiện.
- [ ] UI-REDO Reason bắt buộc.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.court-owner.config.ts
```

### [x] B8 — MM-07: Match booking linkage service

**Mục đích:** owner gắn booking đã trả tiền vào Match PENDING_COURT.

**Việc làm:**

- [x] Validate actor là host; Match `PENDING_COURT`.
- [x] Booking thuộc owner, `CONFIRMED`/paid, chưa link.
- [x] Set `booking_id`, `court_id`, `scheduled_at`, status `CONFIRMED` qua `MatchModule`.
- [x] Notify members trong cùng transaction.
- [x] Replay cùng booking → idempotent 200.
- [x] Booking đã link Match khác → `409 MATCH_BOOKING_ALREADY_LINKED`.
- [x] Test race 2 Match cùng booking; link vs cancel.

**Acceptance:**

- [x] Match chuyển CONFIRMED với đủ 3 trường.
- [x] Không link booking chưa thanh toán.
- [x] Không link chéo owner.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-link.test.ts
```

### [x] B9 — MM-19: Booking-link API

**Mục đích:** endpoint public cho host chọn booking.

**Việc làm:**

- [x] `POST /api/v1/matches/:id/booking`.
- [x] Validate date/window/duration/future/schedule/owner.
- [x] Outside-area vẫn cho phép nếu policy cho phép.
- [x] Shared locks; replay idempotent; competing link/cancel an toàn.
- [x] Test validation + concurrency.

**Acceptance:**

- [x] Đúng booking → link thành công.
- [x] Booking sai window/duration → lỗi rõ.
- [x] Duplicate retry không tạo hiệu lực thứ hai.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-link-api.test.ts
```

### [x] B10 — MM-20: Cancellation/reconciliation

**Mục đích:** booking bị hủy thì Match liên kết được xử lý; worker retry an toàn.

**Việc làm:**

- [x] Dùng `MATCH_BOOKING_CANCELLATION_JOBS` hiện có.
- [x] Persist job trong transaction hủy booking (player/owner/system).
- [x] Worker bounded batch, claim job, gọi Booking idempotent.
- [x] Policy refusal là outcome, không retry vô hạn.
- [x] Booking cancellation hủy Match liên kết; reconcile trước start/complete.
- [x] Test: rollback, crash/retry, duplicate refund prevention, policy refusal, cancel-vs-link.

**Acceptance:**

- [x] Không có Match CONFIRMED trỏ booking CANCELLED.
- [x] Job không mất khi crash; không chạy 2 lần hiệu lực.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-cancellation.test.ts
```

### [ ] B11 — MM-15b: Match detail/link UI — UI-REDO (base đã có)

**Mục đích:** host chọn booking và theo dõi trạng thái sân.

**Việc làm:**

- [ ] UI-REDO Booking picker: chỉ booking paid/CONFIRMED của owner, đúng window/duration.
- [ ] UI-REDO Hiển thị pending-court deadline, outside-area, lỗi policy.
- [ ] UI-REDO Link action + refresh detail; cancelled outcome.
- [ ] UI-REDO Không cho chọn booking đã link Match khác.
- [ ] UI-REDO Playwright desktop/mobile.

**Acceptance:**

- [ ] UI-REDO Host link được booking và thấy Match CONFIRMED.
- [ ] UI-REDO Booking không hợp lệ bị disable kèm lý do.
- [ ] UI-REDO Cancel booking hiển thị trạng thái Match cập nhật.

**Test đầu ra:**

```bash
cd frontend && npx playwright test --config playwright.matchmaking-profile.config.ts
```

### [x] B12 — BK-14 + MM-17: E2E thật

**Mục đích:** chứng minh luồng tiền + sân + kèo hoạt động với backend/DB thật.

**Kịch bản bắt buộc:**

- [x] Booking → payment → confirm → match link → Match CONFIRMED.
- [x] Booking cancel → refund → notification.
- [x] Owner cancel → refund → notification.
- [x] Match cancel → booking cancellation job → reconcile.
- [x] Duplicate callback/retry không tạo hiệu lực thứ hai.
- [x] Session/permission cho từng vai trò.

**Acceptance:**

- [x] Playwright chạy với backend + DB test, không intercept API cho luồng tiền.
- [x] DB sau test không còn trạng thái treo.

**Test đầu ra:**

```bash
cd frontend && npx playwright test --config playwright.booking-match-e2e.config.ts
```

## 4. Test đầu ra toàn track

```bash
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.booking-match-e2e.config.ts
```

- [x] Booking/payment/refund/notification test PASS.
- [x] Match link/cancel test PASS.
- [x] E2E thật PASS.
- [x] Không có deadlock trong test song song.
- [x] Full regression trước khi merge.

## 5. Checklist hoàn thành file

- [ ] B0→B12 xong.
- [x] System booking primitive có contract + test.
- [x] Owner cancel không hủy được Tournament.
- [x] Match link chỉ dùng booking paid.
- [x] Không còn refund best-effort.
- [x] E2E thật PASS.
- [x] Docs/tasks cập nhật.
- [ ] `06` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Deadlock booking/block/match | Một lock order duy nhất, test barrier |
| Link booking đã hủy | Recheck trạng thái trong transaction |
| Refund hai lần | Claim DB + idempotent provider + reconcile |
| Owner hủy booking giải đấu | Check source/context trước khi cho phép |
| E2E intercept API che lỗi thật | Bắt buộc backend + DB thật cho luồng tiền |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc:

- P12 Booking Pending Payment: `12:61292`.
- P18 Refund Status: `12:61532`.
- P61/P62/P63: `12:69476`, `12:69188`, `12:68534`.
- O07 Owner Cancel: `12:70636`; O16 Cancel Result: `12:72910`.
- P21 Waiting For Court: `12:62647`; P23 Match Detail: `12:97013`.

**Chốt:** giữ spec, bỏ Figma-only; không thêm escrow/bank/auto-court.

**BK-12 bổ sung:**

- [ ] UI-REDO Dùng `BookingPendingPage` hiện có; countdown lấy từ `expiresAt`/server, không hardcode 10 phút.
- [x] Không thêm route `/payment/vnpay-return` trong release này (quyết định ví-first; Booking detail/pending đọc trạng thái thật từ API).
- [ ] UI-REDO Thêm state P61 Payment Failure vào pending/return flow; cho phép thử lại hoặc hủy unpaid.
- [ ] UI-REDO Gộp P18/P62/P63 vào `BookingDetailPage` dạng refund stepper/status; không tạo route riêng nếu không cần.
- [ ] UI-REDO Hiển thị `PENDING/REFUNDED/REFUND_FAILED/NONE` từ API, không suy đoán.
- [ ] UI-REDO Không hiển thị “SSL 256-bit”, “hoàn tiền tức thì”, thông tin tài khoản thụ hưởng, danh sách ngân hàng/ví.
- [ ] UI-REDO Copy thanh toán/ví theo provider thực tế; không cam kết VNPAY/Napas247/thẻ quốc tế cho booking.

**CO-08 bổ sung:**

- [ ] UI-REDO Dùng O07/O16 làm composition modal/panel, không full-page.
- [ ] UI-REDO Có snapshot booking, lý do bắt buộc, mô tả, xác nhận, result panel với refund state thật.
- [ ] UI-REDO Bỏ escrow/ký quỹ, FairPlay/reputation, guest goodwill/voucher, hotline/SMS, tự động đình chỉ, “hoàn tiền tức thì”, thông tin tài khoản ngân hàng.
- [ ] UI-REDO Disable với booking Tournament/đã bắt đầu; không cho Owner hủy system booking.

**MM-15b bổ sung:**

- [ ] UI-REDO Không triển khai P21 auto court discovery/auto-reserve/live activity/weather; P21 là legacy.
- [ ] UI-REDO Pending-court state dùng booking picker của owner (paid/CONFIRMED, đúng window/duration), không tự tìm sân.
- [ ] UI-REDO P23 chỉ hiển thị sân/giờ/giá/người thanh toán và action leave/link; bỏ map, weather, contact ngoài scope, financial breakdown ngoài payer.
- [ ] UI-REDO Test: pending-court → chọn booking → CONFIRMED; booking sai window bị disable kèm lý do.

**Cập nhật checklist hoàn thành:**

- [x] BK-12 refund states từ API; không có return route VNPAY (đã chốt ví-first).
- [ ] UI-REDO CO-08 là modal, không copy escrow/FairPlay.
- [ ] UI-REDO MM-15b không dùng P21 auto-court.

---

## 8. Completion log — 2026-11-17

**Quyết định đã chốt với chủ dự án:**

- **Thanh toán:** tiếp tục **ví-first** theo `03` D9/PAY-D4. B2 dùng luồng ví hiện có; B5 không thêm luồng VNPAY booking/`/payment/vnpay-return` trong release này. UI production không mở Mock; Mock chỉ còn trong dev/test.
- **System booking (B1):** không thêm cột `source/source_id`; danh tính giải đấu dùng liên kết hiện có `TOURNAMENT_MATCHES → MATCHES.booking_id` (Owner Tech Design §7.7).
- **Notification booking (B4):** dùng bộ `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_EXPIRED`, `BOOKING_REFUNDED`, `BOOKING_REFUND_FAILED`; dedup `booking:<id>:<event>`; người nhận là Player sở hữu booking.
- **Hủy booking ↔ Match (B10):** hủy booking cập nhật Match liên kết **ngay trong transaction** và ghi `MATCH_BOOKING_CANCELLATION_JOBS` dự phòng; worker chạy trong matchmaking scheduler để xử lý chiều Match → Booking và recovery.

**Bằng chứng test (backend):**

```bash
npm test --prefix backend -- --run src/__tests__/booking-lock-order.test.ts
npm test --prefix backend -- --run src/__tests__/system-booking.test.ts
npm test --prefix backend -- --run src/__tests__/booking-payment.test.ts
npm test --prefix backend -- --run src/__tests__/booking-cancel-refund.test.ts
npm test --prefix backend -- --run src/__tests__/booking-notifications.test.ts
npm test --prefix backend -- --run src/__tests__/owner-cancellation.test.ts
npm test --prefix backend -- --run src/__tests__/match-booking-link.test.ts
npm test --prefix backend -- --run src/__tests__/match-booking-link-api.test.ts
npm test --prefix backend -- --run src/__tests__/match-booking-cancellation.test.ts
```

Kết quả: 9 file / 43 test PASS. Full backend regression: **71 file / 686 test PASS** (`npm test --prefix backend`, 2026-11-17). Các regression liên quan (`wallet-booking-payment`, `payment-integration`, `booking-state-worker`, `booking-write`, `matchmaking-payment-lock`, `matchmaking-lifecycle`, `social-match-finding`) PASS.

**Bằng chứng UI/E2E:**

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test --config playwright.booking-payment.config.ts
cd frontend && npx playwright test --config playwright.court-owner.config.ts
cd frontend && npx playwright test --config playwright.matchmaking-profile.config.ts
cd frontend && npx playwright test --config playwright.booking-match-e2e.config.ts
```

Kết quả: B5 2/2 PASS, B7 2/2 PASS, B11 1/1 PASS, B12 real backend+DB 2/2 PASS. `npm run verify:migrations --prefix backend` OK (23 migrations, no schema diff).

**Ghi chú lock order:** Booking creation giữ thứ tự `facility → court/date advisory → booking`; các luồng liên kết/hủy Match giữ thứ tự Matchmaking đã duyệt `users → request → Match → Booking` để không đảo ngược với withdrawal/removal. Payment confirmation khóa `users(owner) → booking` trước khi ghi notification.

**Còn UI-REDO:** B5, B7, B11 và các mục giao diện ở §7 chỉ tính DONE sau khi frontend merge và kiểm tra lại UI; backend/API và test đã hoàn tất.
