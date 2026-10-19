# Product Requirements Document (PRD) — Booking Payment Integration

## Status and Ownership

```text
Status: Ready
Owner: taidangdev & Nhat Huy (Team)
Fulfills: PROJECT-BRIEF.md §3.2 (Court Booking), §7 (Confirmed Real-time Booking Decision)
Scope: Integration of online payment into the Player Court Booking lifecycle (Unblocking BK-06 and BK-12)
```

> **Lifecycle note:** This PRD has been reviewed and approved by the human owner on 2026-10-18. All open items in §11 have been resolved. Implementation proceeds according to §12.

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md` (§3.2 Court Booking, §6 MVP Focus, §7 Confirmed Business Decisions)
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md` (§2 Court Booking Rules, §8.2 Booking Configuration)
- Governing Feature PRD: `docs/features/booking/player-booking/prd.md` (Ready)
- Governing Platform Payment PRD: `docs/features/platform/payments-refunds/prd.md` (Ready)
- Global database schema: `docs/architecture/database-schema.md` (§3.8 `BOOKINGS`, §3.10 `PAYMENTS`)

## Related Documents

- Parent PRD: `docs/features/booking/player-booking/prd.md`
- Related Platform PRD: `docs/features/platform/payments-refunds/prd.md`
- Technical Design: `docs/features/booking/player-booking/tech-design.md` & `docs/features/platform/payments-refunds/tech-design.md`
- Task List: `docs/features/booking/player-booking/tasks.md` (Tasks `BK-06`, `BK-12`, `BK-14`)

---

## 1. Problem

Currently, the Court Booking player flow stops at the hold stage:
- A Player selects a court slot and creates a hold booking with status `PENDING_PAYMENT`.
- On the Chờ thanh toán screen (`BookingPendingPage`), the 10-minute hold countdown timer elapses, and the slot is automatically released as `EXPIRED`.
- The CTA button **"Mở cổng thanh toán"** is disabled because the payment integration between `BookingModule` and `PaymentModule` (`BK-06` / `BK-12`) is not yet connected.
- As a result, no court booking can ever reach the `CONFIRMED` status through user actions.

This problem blocks the completion of the Court Booking MVP — one of the three core business areas defined in `PROJECT-BRIEF.md` §6.

---

## 2. Goals

- Enable Players to initiate and complete online payment for their held court slots before the 10-minute hold expires.
- Immediately transition the booking status from `PENDING_PAYMENT` to `CONFIRMED` upon successful payment verification.
- Provide a development-friendly **Mock Payment mode** for immediate local testing, end-to-end user flow verification, and presentation demo.
- Support **VNPAY Sandbox integration** for realistic external payment gateway simulation.
- Ensure payment confirmation is idempotent: duplicate callbacks or retries never result in duplicate confirmations or conflicting slots.
- Support full refund signaling when an eligible confirmed booking is cancelled by the Player according to policy.

---

## 3. Non-Goals

- Split Bill (explicitly outside MVP per `PROJECT-BRIEF.md` §5).
- Partial payments or deposit-only bookings (MVP requires 100% full payment per `PROJECT-BRIEF.md` §3.2).
- Cash or in-person payment on arrival at the court facility.
- Multi-currency or international payment gateways (VNPAY / VND only).
- Independent owner refund console (refunds follow the automated policy).

---

## 4. Scope

### In Scope
- Unlocking the payment button on `BookingPendingPage`.
- Payment initiation contract for held bookings (`PENDING_PAYMENT` only).
- Dual-provider strategy:
  1. **Mock Provider (Priority 1)**: Immediate one-click success simulation for local development and review.
  2. **VNPAY Sandbox Provider (Priority 2)**: Full redirect and IPN webhook callback handling.
- Atomic state advancement: Payment `SUCCESS` triggers `BookingConfirmed` domain event and sets booking to `CONFIRMED`.
- Handling edge cases: Late payment arriving after hold expiration (`EXPIRED`) must trigger automated refund signal and never reopen an expired slot.
- Cancellation and refund triggering for `CONFIRMED` bookings before match start time.

### Out of Scope
- Tournament entry fee payment (governed by Tournament feature).
- Manual bank transfer reconciliation.

---

## 5. Target Users and Roles

- **Player**: Holds a court slot, views payment summary, executes payment (Mock or VNPAY), receives instant confirmation, and views booking in their dashboard.
- **Court Owner**: Supervises confirmed bookings on their court schedule (does not manually approve payments).
- **Admin**: Views financial transaction logs in `PAYMENTS` table and audits system configuration.

---

## 6. User Journey

### 6.1 Happy Path: Successful Online Payment
1. Player selects a court, date, start time, and duration; reviews price on `BookingSummaryPage`, and clicks **"Đặt sân ngay"**.
2. System creates a `PENDING_PAYMENT` booking hold with a 10-minute countdown and redirects the Player to `BookingPendingPage`.
3. Player clicks **"Thanh toán ngay"** (previously disabled).
4. **Payment step**:
   - *If Mock mode:* A payment confirmation dialog appears showing booking details and amount; Player clicks "Xác nhận thanh toán thành công".
   - *If VNPAY mode:* Player is redirected to the secure VNPAY Sandbox gateway, selects payment method (QR/ATM/App), and authorizes payment.
5. Upon successful payment verification, the system transitions booking to `CONFIRMED`.
6. Player is redirected to `BookingDetailPage` with a green badge **"ĐÃ XÁC NHẬN"**, booking code, and calendar details.

### 6.2 Alternative Path: Hold Expiry Before Payment
1. Player opens `BookingPendingPage` but does not complete payment within 10 minutes.
2. The countdown reaches `00:00`.
3. Background worker marks the booking as `EXPIRED` and releases the slot.
4. If payment is attempted after expiry, the system rejects payment or immediately queues a refund without reopening the slot.

### 6.3 Cancellation of a Confirmed Booking
1. Player opens their upcoming booking on `BookingDetailPage` and clicks "Hủy đặt sân".
2. System checks cancellation policy (must be before start time / within allowed cancellation window).
3. System marks booking as `CANCELLED`, releases the court slot, and transitions payment record to `REFUND_PENDING` $\rightarrow$ `REFUNDED`.

---

## 7. Functional Requirements

- **FR-PAY-01**: The system shall permit payment initiation only for bookings currently in `PENDING_PAYMENT` status owned by the authenticated Player.
- **FR-PAY-02**: The system shall calculate the exact payable amount based on the snapshot in `BOOKING_PRICING_DETAILS` (preventing price tampering).
- **FR-PAY-03**: The system shall provide a Mock payment option in development environment that immediately confirms the transaction without external network calls.
- **FR-PAY-04**: The system shall validate VNPAY IPN callback signatures using SHA512 and the configured secret key.
- **FR-PAY-05**: The system shall execute `confirmBooking` and update `PAYMENTS.status = 'SUCCESS'` within a single atomic database transaction.
- **FR-PAY-06**: The system shall ignore duplicate payment callbacks idempotently without throwing errors or creating duplicate bookings.
- **FR-PAY-07**: The system shall emit a `BookingConfirmed` event upon confirmation so notification services can consume it.

---

## 8. Business Rules

- **BR-PAY-01**: Payment timeout equals `BOOKING_PAYMENT_TIMEOUT_MINUTES` (default 10 minutes) from `docs/business-rules-config-matrix.md` §8.2.
- **BR-PAY-02**: Exactly 100% of the total amount must be paid; no partial deposit is allowed.
- **BR-PAY-03**: A payment arriving after expiry never reopens a slot. The amount charged must be marked for 100% refund.
- **BR-PAY-04**: Cancellation of a `CONFIRMED` booking triggers a 100% refund signal if cancelled within the allowed window.

---

## 9. UI/UX Behavior

- **Entry Point**: `BookingPendingPage` (`/bookings/:bookingId/pending`).
- **Payment Button**:
  - Primary button **"Thanh toán ngay"** (active, not disabled).
  - Displays loading spinner while initiating transaction.
- **Countdown Timer**: Real-time MM:SS countdown; when reaching 00:00, disables payment CTA and notifies user that the slot has expired.
- **Post-Payment Transition**: Automatic redirect to `/bookings/:bookingId` with positive feedback banner and confirmed state.

---

## 10. Constraints

- Must use existing schema `BOOKINGS` and `PAYMENTS` (`docs/architecture/database-schema.md` §3.8, §3.10) without adding unapproved columns.
- Must follow Layer-First backend architecture (`routes/`, `controllers/`, `services/`, `repositories/`) and Feature-First frontend architecture (`features/booking/`).
- External secrets (VNPAY hash secret) must never be committed to Git or exposed to the client.

## 11. Decisions & Resolved Items

The following items have been reviewed and confirmed by the human owner:

| # | Item | Decision Confirmed by User | Implementation Details |
|---|---|---|---|
| **TBD-01** | **Thứ tự ưu tiên triển khai adapter thanh toán** | **Phương án A: Làm Mock Payment trước** | Triển khai Mock Payment Adapter trước nhằm thông luồng booking từ `HOLD` -> `CONFIRMED` ngay lập tức, phục vụ test luồng và demo. Sau đó sẽ triển khai VNPAY Sandbox Adapter. |
| **TBD-02** | **Trải nghiệm giao diện khi bấm Thanh toán ở chế độ Mock** | **Phương án A: Mở Modal mô phỏng thanh toán** | Khi Player bấm "Thanh toán ngay" trên `BookingPendingPage`, hiển thị `MockPaymentModal` hiển thị thông tin đặt sân, số tiền thanh toán, và các nút "Xác nhận thanh toán thành công" / "Mô phỏng thanh toán thất bại" / "Đóng". |
| **TBD-03** | **Cơ chế Hoàn tiền (Refund) khi Player hủy booking đã CONFIRMED** | **Phương án A: Tự động mô phỏng hoàn tiền** | Cập nhật `refund_status = 'REFUNDED'` trên bản ghi thanh toán tự động khi Player hủy booking hợp lệ theo chính sách hoàn tiền. |
| **TBD-04** | **Vị trí tổ chức code Backend** | **Phương án A: Tách thành Platform Capability độc lập** | Đặt tại `backend/src/services/payments/`, `backend/src/controllers/payments/`, `backend/src/routes/payments/` và `backend/src/repositories/payment.repository.ts`, tuân thủ kiến trúc Layer-First và sẵn sàng tái sử dụng cho Tournament. |

---

## 12. Detailed Implementation Plan & Roadmap

### Phase 1: Payment Backend Core & Mock Adapter (Sprint 1)
1. **Config & Types**:
   - Khai báo kiểu dữ liệu thanh toán: `PaymentStatus`, `PaymentMethod`, `PaymentProvider` (`MOCK`, `VNPAY`).
   - Cập nhật config runtime: `PAYMENT_PROVIDER=MOCK` (mặc định cho development).
2. **Payment Repository (`backend/src/repositories/payment.repository.ts`)**:
   - `createPayment`: Tạo bản ghi thanh toán với `status = 'PENDING'`.
   - `findPaymentById`: Lấy thông tin thanh toán theo ID.
   - `findPaymentByBookingId`: Lấy thông tin thanh toán theo `booking_id`.
   - `updatePaymentStatus`: Cập nhật trạng thái (`SUCCESS`, `FAILED`, `REFUNDED`).
3. **Payment Service (`backend/src/services/payments/payment.service.ts`)**:
   - `createBookingPayment({ bookingId, userId })`: Kiểm tra booking hợp lệ (`PENDING_PAYMENT`, còn hạn giữ chỗ), tạo hoặc tái sử dụng bản ghi `PAYMENTS`.
   - `processMockPayment({ bookingId, paymentId, simulatedStatus })`: Gọi `BookingService.confirmBooking({ bookingId, paymentId })` trong transaction an toàn, cập nhật `PAYMENTS.status = 'SUCCESS'`.
   - `processRefund({ bookingId })`: Xử lý hoàn tiền khi booking bị hủy.
4. **Payment Controller & Routes (`backend/src/routes/payments/` & `backend/src/controllers/payments/`)**:
   - `POST /api/v1/bookings/:bookingId/payment`: Tạo yêu cầu thanh toán.
   - `POST /api/v1/payments/mock/confirm`: API xác nhận thanh toán mock (chỉ mở trong môi trường non-production).
   - `GET /api/v1/payments/:paymentId`: Xem trạng thái thanh toán.

### Phase 2: Booking Module Integration & Endpoints Wiring (Sprint 2)
1. **Wire `BookingService.confirmBooking`**:
   - Đảm bảo `confirmBooking` được kích hoạt an toàn từ `PaymentService`.
   - Kiểm tra idempotent: nếu booking đã `CONFIRMED`, callback trả về thành công không lỗi.
   - Kiểm tra hạn giữ chỗ: nếu đã quá hạn `expires_at`, không chuyển sang `CONFIRMED` mà kích hoạt hoàn tiền.
2. **Wire Refund on Cancellation**:
   - Khi gọi `POST /api/v1/bookings/:id/cancel` đối với booking đã `CONFIRMED` và đủ điều kiện hoàn tiền, gọi `PaymentService.processRefund`.

### Phase 3: Frontend Integration & Mock Payment UX (Sprint 3)
1. **Frontend Service (`frontend/src/features/booking/services/bookingPaymentService.ts`)**:
   - Hàm `initiateBookingPayment(bookingId)`
   - Hàm `confirmMockPayment(bookingId, paymentId)`
2. **Mock Payment Modal (`MockPaymentModal.tsx`)**:
   - Hiển thị modal trực quan với thông tin sân, giờ chơi, tổng số tiền (VND).
   - Nút "Xác nhận thanh toán (Thành công)" và nút "Hủy".
3. **Update `BookingPendingPage.tsx`**:
   - Mở khóa nút **"Thanh toán ngay"** (bỏ disabled).
   - Khi bấm, gọi `initiateBookingPayment` và mở `MockPaymentModal`.
   - Khi xác nhận thành công, redirect sang `/bookings/:bookingId` với trạng thái `CONFIRMED` và toast thông báo thành công.

### Phase 4: VNPAY Sandbox Adapter (Sprint 4)
1. **VNPAY Helper (`backend/src/services/payments/providers/vnpay.provider.ts`)**:
   - Xây dựng URL thanh toán có chữ ký HMAC SHA512 với `vnp_HashSecret`.
   - Xác thực chữ ký IPN callback từ VNPAY.
2. **VNPAY IPN & Return Route**:
   - `GET/POST /api/v1/payments/vnpay/callback`: Xử lý IPN từ VNPAY webhook, gọi idempotent `confirmBooking`.
   - `GET /api/v1/payments/vnpay/return`: Chuyển hướng người dùng về lại Frontend sau khi hoàn tất trên cổng VNPAY.

### Phase 5: Testing & Verification
1. **Unit & Integration Tests**:
   - Unit test signature HMAC SHA512 và tính toán số tiền.
   - Integration test: Tạo booking `PENDING_PAYMENT` -> Mock Pay -> Trở thành `CONFIRMED`.
   - Concurrency & idempotency test: Giả lập 2 callback đồng thời chỉ xác nhận booking đúng 1 lần.
   - Expired test: Thanh toán sau khi hết hạn giữ chỗ -> Không mở lại sân, chuyển sang hoàn tiền.
2. **Playwright E2E Flow**:
   - Search court -> Chọn slot -> Đặt sân -> Mở thanh toán -> Xác nhận thanh toán -> Kiểm tra trang chi tiết booking `CONFIRMED`.

