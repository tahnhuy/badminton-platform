# 06 — Booking, Court Owner và Matchmaking

- Ưu tiên: 06
- Track/Phase: Track B / Phase 1–2
- Prerequisite: 01 G0, 02 INF-00. **B0/B1 chạy ngay sau 02**; B2/B3 cần 03 (A3/A4/A5); B4 cần 03+04; phần còn lại theo thứ tự trong file.
- Exit gate: Booking thanh toán thật + refund; Owner hủy đúng; Match link/cancel booking hoạt động; E2E thật PASS
- Mở khóa: TRN-05/07/09, SOC booking-venue filter

## 1. Mục đích

Nối các module đã có (booking hold, owner schedule, match lifecycle) với payment/refund/notification để hoàn tất luồng trả tiền, hủy, hoàn tiền và liên kết sân cho kèo. Đây là track mở khóa phần lớn nghiệp vụ còn lại.

## 2. Điểm cần chốt

- [ ] **B-D1:** system booking primitive dùng chung cho Tournament (contract mới).
- [ ] **B-D2:** lock order chung: facility → court/date → booking → match/request.
- [ ] **B-D3:** refund intent được ghi trong transaction hủy, provider gọi ngoài transaction.
- [ ] **B-D4:** Match link chỉ chấp nhận booking đã CONFIRMED/paid của owner.
- [ ] **B-D5:** Owner không được hủy booking Tournament; trả `OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE`.
- [ ] **B-D6:** cancellation job dùng bảng `MATCH_BOOKING_CANCELLATION_JOBS` hiện có; không tạo bảng mới nếu không cần.
- [ ] **B-D7:** E2E dùng backend + DB thật, không intercept API cho luồng tiền.

## 3. Danh sách task chi tiết

### [ ] B0 — BK-15: Chuẩn hóa lock order Booking

**Mục đích:** tránh deadlock giữa booking, block slot, owner hours, match link.

**Việc làm:**

- [ ] Rà `persistBooking` và các write path booking.
- [ ] Áp thứ tự: facility row → court/date advisory → booking → match/request.
- [ ] Tài liệu hóa thứ tự trong Booking Tech Design nếu chưa có.
- [ ] Test barrier: booking vs block, booking vs owner hours, booking vs match link.

**Acceptance:**

- [ ] Không deadlock trong test song song.
- [ ] Không thay đổi hành vi player hiện có.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-lock-order.test.ts
```

### [ ] B1 — SYS-BK-01: System booking primitive

**Mục đích:** Tournament tạo booking hệ thống không thanh toán, dùng chung mọi validation.

**Việc làm:**

- [ ] Tạo `backend/src/contracts/BookingService.ts`:
  - [ ] `createSystemBooking({ courtId, date, startTime, endTime, source, sourceId, actorId })`.
  - [ ] `releaseSystemBooking({ bookingId, reason })`.
- [ ] Implementation trong `services/booking/` dùng repository hiện có.
- [ ] Dùng chung: facility lock → court/date lock → check maintenance block → opening hours → parent facility active → pricing coverage.
- [ ] Lưu `source = TOURNAMENT`, `sourceId = tournamentMatchId` (hoặc cột tương đương đã có).
- [ ] Không tạo payment; không refund.
- [ ] Owner read hiển thị context Tournament; Owner cancel bị chặn.
- [ ] Test: conflict `TOURNAMENT_COURT_UNAVAILABLE`; release idempotent; không tạo payment.

**Acceptance:**

- [ ] TRN-07 có thể schedule qua contract, không tự viết booking logic.
- [ ] Booking hệ thống không xuất hiện như booking trả tiền của Player.
- [ ] Release không tạo refund.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/system-booking.test.ts
```

### [ ] B2 — BK-06: Booking payment integration

**Mục đích:** booking hold → thanh toán → confirm, không có khe hở transaction.

**Việc làm:**

- [ ] Nối `POST /bookings/:id/payment` với provider (A3).
- [ ] Confirm callback (A4) gọi `confirmBooking` trong cùng transaction payment.
- [ ] Recheck ownership, hold expiry, terminal state trong transaction.
- [ ] Không mở lại booking đã EXPIRED/CANCELLED.
- [ ] Test: success, invalid signature, hold hết hạn, late payment, duplicate callback, concurrent confirm/cancel.

**Acceptance:**

- [ ] Booking `PENDING_PAYMENT` → `CONFIRMED` đúng một lần.
- [ ] Booking hết hạn không được confirm.
- [ ] Refund signal khi provider thu tiền muộn.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-payment.test.ts
```

### [ ] B3 — BK-07: Booking cancellation + refund

**Mục đích:** hủy booking tạo refund intent durable, không chỉ đổi status.

**Việc làm:**

- [ ] Bỏ event best-effort; persist refund intent trong cùng transaction hủy (A5).
- [ ] `PENDING_PAYMENT` → `CANCELLED`, `refundStatus=NONE`.
- [ ] `CONFIRMED` trước giờ → `CANCELLED`, refund intent PENDING.
- [ ] Policy player cancel: `PLAYER_CAN_CANCEL_BOOKING`, deadline.
- [ ] Đọc trạng thái refund từ Payment, không suy đoán.
- [ ] Test: unpaid, paid, repeat, concurrent cancel vs confirm, refund worker integration.

**Acceptance:**

- [ ] Hủy paid booking → refund chạy đúng một lần.
- [ ] Hủy unpaid không tạo refund.
- [ ] Repeat idempotent.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-cancel-refund.test.ts
```

### [ ] B4 — BK-10: Booking notifications

**Mục đích:** người dùng biết booking được confirm/hủy/hoàn tiền.

**Việc làm:**

- [ ] Persist notification trong transaction confirm/cancel/refund outcome.
- [ ] Dedup key: `booking:<id>:<event>`.
- [ ] Recipient: booking owner; owner cancellation → player; refund outcome → player.
- [ ] Test: rollback kéo theo notification; retry không nhân đôi.
- [ ] Dùng resolver NTF-05.

**Acceptance:**

- [ ] Mỗi sự kiện có đúng một notification/recipient.
- [ ] Link mở booking detail đúng quyền.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/booking-notifications.test.ts
```

### [ ] B5 — BK-12: Frontend thanh toán thật

**Mục đích:** người dùng thanh toán qua provider thật; Mock chỉ ở dev.

**Việc làm:**

- [ ] Thay `MockPaymentModal` bằng CTA provider khi config VNPAY.
- [ ] Giữ Mock modal chỉ khi `import.meta.env.DEV`/config cho phép.
- [ ] Thêm route `/payment/vnpay-return` (đang thiếu).
- [ ] Return page đọc trạng thái Booking/Payment từ API đã phân quyền; hiển thị processing nếu IPN chưa tới; nút tải lại.
- [ ] Xử lý cancel provider, session expired, network error.
- [ ] Test Playwright: success/cancel/return chậm.

**Acceptance:**

- [ ] Không còn payment CTA chỉ dùng Mock ở production.
- [ ] Return URL không tự confirm.
- [ ] UI hiển thị đúng trạng thái thật.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.booking-payment.config.ts
```

### [ ] B6 — CO-05: Owner cancellation API

**Mục đích:** chủ sân hủy booking đúng chính sách, hoàn tiền và thông báo một lần.

**Việc làm:**

- [ ] Endpoint hủy booking thuộc facility của owner.
- [ ] Eligibility: không Tournament, chưa bắt đầu, trong deadline owner.
- [ ] Row lock; persist CANCELLED + reason + cancelledAt + one refund intent + one notification.
- [ ] Idempotent repeat; policy refusal rõ ràng.
- [ ] Confirm-vs-cancel race an toàn.
- [ ] Test: unpaid/paid, tournament, started, deadline, repeat, race, rollback.

**Acceptance:**

- [ ] Không hủy được booking Tournament/đã bắt đầu.
- [ ] Paid → refund intent PENDING; unpaid → NONE.
- [ ] Không refund/notification thứ hai.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/owner-cancellation.test.ts
```

### [ ] B7 — CO-08: Owner cancellation UI

**Mục đích:** chủ sân hủy có lý do và thấy đúng trạng thái hoàn tiền.

**Việc làm:**

- [ ] Modal bắt buộc lý do + xác nhận chính sách.
- [ ] Hiển thị unpaid/paid/refund pending/success/failed từ API.
- [ ] Disable với Tournament/đã bắt đầu.
- [ ] Refresh detail/history sau khi hủy; lỗi block slot không làm hỏng hiển thị hủy.
- [ ] Playwright desktop/mobile.

**Acceptance:**

- [ ] Không hiển thị “đã hoàn tiền” khi còn PENDING/FAILED.
- [ ] Không có nút hủy với booking không đủ điều kiện.
- [ ] Reason bắt buộc.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.court-owner.config.ts
```

### [ ] B8 — MM-07: Match booking linkage service

**Mục đích:** owner gắn booking đã trả tiền vào Match PENDING_COURT.

**Việc làm:**

- [ ] Validate actor là host; Match `PENDING_COURT`.
- [ ] Booking thuộc owner, `CONFIRMED`/paid, chưa link.
- [ ] Set `booking_id`, `court_id`, `scheduled_at`, status `CONFIRMED` qua `MatchModule`.
- [ ] Notify members trong cùng transaction.
- [ ] Replay cùng booking → idempotent 200.
- [ ] Booking đã link Match khác → `409 MATCH_BOOKING_ALREADY_LINKED`.
- [ ] Test race 2 Match cùng booking; link vs cancel.

**Acceptance:**

- [ ] Match chuyển CONFIRMED với đủ 3 trường.
- [ ] Không link booking chưa thanh toán.
- [ ] Không link chéo owner.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-link.test.ts
```

### [ ] B9 — MM-19: Booking-link API

**Mục đích:** endpoint public cho host chọn booking.

**Việc làm:**

- [ ] `POST /api/v1/matches/:id/booking`.
- [ ] Validate date/window/duration/future/schedule/owner.
- [ ] Outside-area vẫn cho phép nếu policy cho phép.
- [ ] Shared locks; replay idempotent; competing link/cancel an toàn.
- [ ] Test validation + concurrency.

**Acceptance:**

- [ ] Đúng booking → link thành công.
- [ ] Booking sai window/duration → lỗi rõ.
- [ ] Duplicate retry không tạo hiệu lực thứ hai.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-link-api.test.ts
```

### [ ] B10 — MM-20: Cancellation/reconciliation

**Mục đích:** booking bị hủy thì Match liên kết được xử lý; worker retry an toàn.

**Việc làm:**

- [ ] Dùng `MATCH_BOOKING_CANCELLATION_JOBS` hiện có.
- [ ] Persist job trong transaction hủy booking (player/owner/system).
- [ ] Worker bounded batch, claim job, gọi Booking idempotent.
- [ ] Policy refusal là outcome, không retry vô hạn.
- [ ] Booking cancellation hủy Match liên kết; reconcile trước start/complete.
- [ ] Test: rollback, crash/retry, duplicate refund prevention, policy refusal, cancel-vs-link.

**Acceptance:**

- [ ] Không có Match CONFIRMED trỏ booking CANCELLED.
- [ ] Job không mất khi crash; không chạy 2 lần hiệu lực.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/match-booking-cancellation.test.ts
```

### [ ] B11 — MM-15b: Match detail/link UI

**Mục đích:** host chọn booking và theo dõi trạng thái sân.

**Việc làm:**

- [ ] Booking picker: chỉ booking paid/CONFIRMED của owner, đúng window/duration.
- [ ] Hiển thị pending-court deadline, outside-area, lỗi policy.
- [ ] Link action + refresh detail; cancelled outcome.
- [ ] Không cho chọn booking đã link Match khác.
- [ ] Playwright desktop/mobile.

**Acceptance:**

- [ ] Host link được booking và thấy Match CONFIRMED.
- [ ] Booking không hợp lệ bị disable kèm lý do.
- [ ] Cancel booking hiển thị trạng thái Match cập nhật.

**Test đầu ra:**

```bash
cd frontend && npx playwright test --config playwright.matchmaking-profile.config.ts
```

### [ ] B12 — BK-14 + MM-17: E2E thật

**Mục đích:** chứng minh luồng tiền + sân + kèo hoạt động với backend/DB thật.

**Kịch bản bắt buộc:**

- [ ] Booking → payment → confirm → match link → Match CONFIRMED.
- [ ] Booking cancel → refund → notification.
- [ ] Owner cancel → refund → notification.
- [ ] Match cancel → booking cancellation job → reconcile.
- [ ] Duplicate callback/retry không tạo hiệu lực thứ hai.
- [ ] Session/permission cho từng vai trò.

**Acceptance:**

- [ ] Playwright chạy với backend + DB test, không intercept API cho luồng tiền.
- [ ] DB sau test không còn trạng thái treo.

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

- [ ] Booking/payment/refund/notification test PASS.
- [ ] Match link/cancel test PASS.
- [ ] E2E thật PASS.
- [ ] Không có deadlock trong test song song.
- [ ] Full regression trước khi merge.

## 5. Checklist hoàn thành file

- [ ] B0→B12 xong.
- [ ] System booking primitive có contract + test.
- [ ] Owner cancel không hủy được Tournament.
- [ ] Match link chỉ dùng booking paid.
- [ ] Không còn refund best-effort.
- [ ] E2E thật PASS.
- [ ] Docs/tasks cập nhật.
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

Nguồn đã đọc:

- P12 Booking Pending Payment: `12:61292`.
- P18 Refund Status: `12:61532`.
- P61/P62/P63: `12:69476`, `12:69188`, `12:68534`.
- O07 Owner Cancel: `12:70636`; O16 Cancel Result: `12:72910`.
- P21 Waiting For Court: `12:62647`; P23 Match Detail: `12:97013`.

**Chốt:** giữ spec, bỏ Figma-only; không thêm escrow/bank/auto-court.

**BK-12 bổ sung:**

- [ ] Dùng `BookingPendingPage` hiện có; countdown lấy từ `expiresAt`/server, không hardcode 10 phút.
- [ ] Thêm route `/payment/vnpay-return` + trạng thái processing/success/failure; return không tự confirm.
- [ ] Thêm state P61 Payment Failure vào pending/return flow; cho phép thử lại hoặc hủy unpaid.
- [ ] Gộp P18/P62/P63 vào `BookingDetailPage` dạng refund stepper/status; không tạo route riêng nếu không cần.
- [ ] Hiển thị `PENDING/REFUNDED/REFUND_FAILED/NONE` từ API, không suy đoán.
- [ ] Không hiển thị “SSL 256-bit”, “hoàn tiền tức thì”, thông tin tài khoản thụ hưởng, danh sách ngân hàng/ví.
- [ ] Copy cổng thanh toán chỉ nêu VNPAY theo config; không cam kết Napas247/thẻ quốc tế nếu provider không hỗ trợ.

**CO-08 bổ sung:**

- [ ] Dùng O07/O16 làm composition modal/panel, không full-page.
- [ ] Có snapshot booking, lý do bắt buộc, mô tả, xác nhận, result panel với refund state thật.
- [ ] Bỏ escrow/ký quỹ, FairPlay/reputation, guest goodwill/voucher, hotline/SMS, tự động đình chỉ, “hoàn tiền tức thì”, thông tin tài khoản ngân hàng.
- [ ] Disable với booking Tournament/đã bắt đầu; không cho Owner hủy system booking.

**MM-15b bổ sung:**

- [ ] Không triển khai P21 auto court discovery/auto-reserve/live activity/weather; P21 là legacy.
- [ ] Pending-court state dùng booking picker của owner (paid/CONFIRMED, đúng window/duration), không tự tìm sân.
- [ ] P23 chỉ hiển thị sân/giờ/giá/người thanh toán và action leave/link; bỏ map, weather, contact ngoài scope, financial breakdown ngoài payer.
- [ ] Test: pending-court → chọn booking → CONFIRMED; booking sai window bị disable kèm lý do.

**Cập nhật checklist hoàn thành:**

- [ ] BK-12 có return route + refund states.
- [ ] CO-08 là modal, không copy escrow/FairPlay.
- [ ] MM-15b không dùng P21 auto-court.
