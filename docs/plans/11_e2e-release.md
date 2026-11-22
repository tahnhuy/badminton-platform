# 11 — E2E và Release

- Ưu tiên: 11
- Track/Phase: Phase cuối / Release
- Prerequisite: 01→10 đã đạt exit gate tương ứng
- Exit gate: full regression, E2E thật, docs đồng bộ, release checklist ký
- Chặn: release

> **Quy ước UI-REDO (2026-11-16):** `11` không có task hoàn thiện UI riêng; chỉ kiểm tra regression/E2E UI ở R2/R3 sau khi frontend merge. Các mục giao diện ở plan khác phải được đánh dấu UI-REDO và xử lý trước khi chạy release gate.

## 1. Mục đích

Khóa chất lượng toàn hệ thống sau khi các module hoàn tất: chạy regression đầy đủ, E2E thật cho luồng tiền/quyền, rà migration/security/docs, xác nhận release gate (bao gồm VNPAY sandbox nếu có) và ghi rõ phần defer.

## 2. Điểm cần chốt

- [ ] **REL-D1:** phạm vi release: module nào DONE, module nào PARTIAL/DEFERRED.
- [ ] **REL-D2:** VNPAY sandbox có sẵn hay không; nếu không, release với Mock demo và ghi rõ.
- [ ] **REL-D3:** DB test cô lập, không dùng chung DB dev.
- [ ] **REL-D4:** migration đã review theo slot log, không còn file thiếu journal.
- [ ] **REL-D5:** không còn `TODO/FIXME/stub production` trong module release.
- [ ] **REL-D6:** docs status khớp code/test.
- [ ] **REL-D7:** rollback plan cho migration/index (drop index/disable gate).

## 3. Danh sách task chi tiết

### [ ] R1 — Regression toàn backend

- [ ] Chạy full suite trên DB test cô lập.
- [ ] Ghi lại số file/test PASS, thời gian.
- [ ] Không chấp nhận skip test liên quan release.
- [ ] Điều tra mọi flaky test; không retry che lỗi.

```bash
npm test --prefix backend
npm run build --prefix backend
```

### [ ] R2 — Regression frontend

- [ ] Build production.
- [ ] Lint (oxlint).
- [ ] Playwright contract suites.
- [ ] Không tăng warning mới nghiêm trọng.

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test
```

### [ ] R3 — E2E thật theo module

- [ ] Booking: booking → payment → confirm → cancel → refund.
- [ ] Owner: cancel booking paid/unpaid; schedule/block.
- [ ] Matchmaking: tạo kèo → apply/invite → chốt → link booking → confirm.
- [ ] Tournament: tạo giải → đăng ký/thanh toán → bracket → schedule → result.
- [ ] Social: post/report/hide/comment/reaction.
- [ ] Notifications: nhận, đọc, mở resource.
- [ ] Admin: report evidence/hide; config; dashboard.
- [ ] Chạy desktop + mobile cho luồng chính.

### [ ] R4 — Migration review

- [ ] Mọi migration mới có trong `migration-slot-log.md`.
- [ ] `drizzle-kit generate` không diff.
- [ ] Fresh DB + populated DB PASS.
- [ ] Không sửa file đã áp dụng.
- [ ] Index migration dashboard/audit/report/refund đã áp dụng.
- [ ] Có rollback/disable plan.

```bash
cd backend && npx drizzle-kit generate
npm run db:migrate
```

### [ ] R5 — Security review

- [ ] RBAC mọi endpoint mới: ADMIN/COURT_OWNER/PLAYER.
- [ ] CSRF cho mutation.
- [ ] Ownership/tenant isolation (owner/facility, booking, report evidence).
- [ ] Media evidence/report không lộ file ngoài quyền.
- [ ] Notification resolver không cấp quyền.
- [ ] Không log secret/signature/token.
- [ ] Rate limit/quota không bị bypass qua replay.
- [ ] 404 masking cho resource không có quyền.

### [ ] R6 — Data integrity & concurrency

- [ ] Refund chỉ một lần dưới 2 worker.
- [ ] Payment callback song song một hiệu lực.
- [ ] Booking lock order không deadlock.
- [ ] Match link/cancel race an toàn.
- [ ] Tournament register limit race.
- [ ] Report evidence bất biến.
- [ ] Notification dedup.

### [ ] R7 — Config gate review

- [ ] `SOCIAL_FEED_ENABLED`.
- [ ] `MATCHMAKING_ENABLED`.
- [ ] `MESSAGING_ENABLED` (nếu có).
- [ ] `REPORT_ENABLED`.
- [ ] `REFUND_ENABLED`.
- [ ] `TOURNAMENT_RATING_ENABLED`.
- [ ] Gate tắt không khóa Admin review/hủy/withdraw theo spec.

### [ ] R8 — Tài liệu và trạng thái

- [ ] Cập nhật `docs/features/**/tasks.md` theo bằng chứng.
- [ ] Cập nhật README nếu setup/env thay đổi.
- [ ] Cập nhật `.env.example`.
- [ ] Cập nhật `database-schema.md` Change Log.
- [ ] Cập nhật `docs/architecture/frontend.md` route mới.
- [ ] Ghi rõ module PARTIAL/DEFERRED trong plan và task file.

### [ ] R9 — Release gate VNPAY (D4)

- [ ] Có credentials sandbox.
- [ ] IPN HTTPS đã đăng ký và gọi được.
- [ ] Smoke: tạo payment → IPN → confirm.
- [ ] Smoke: refund → trạng thái REFUNDED.
- [ ] Nếu không có D4: release với Mock/dev, ghi rõ “chưa nghiệm thu sandbox”, không tuyên bố production payment.

### [ ] R10 — Đóng task files

- [ ] `01` G0 DONE.
- [ ] `02` INF DONE.
- [ ] `03` Payments DONE (hoặc DONE-with-sandbox-gate).
- [ ] `04` Notifications DONE.
- [ ] `05` Reports DONE.
- [ ] `06` Booking/Owner/MM DONE.
- [ ] `07` Tournament DONE professional; G12/G13 ghi rõ.
- [ ] `08` System Config DONE.
- [ ] `09` Dashboard DONE.
- [ ] `10` Social/Profile DONE/PARTIAL có lý do.
- [ ] `11` Release DONE.

## 4. Test đầu ra

```bash
npm run db:migrate
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend && npx playwright test
cd backend && npx drizzle-kit generate
```

Kỳ vọng:

- [ ] Không test fail/skip ngoài danh sách được duyệt.
- [ ] Không file migration mới từ generate.
- [ ] Build/lint PASS.
- [ ] E2E thật PASS cho luồng release.
- [ ] Không còn TODO/stub production.

## 5. Checklist release

- [ ] Regression backend PASS + log.
- [ ] Regression frontend PASS + log.
- [ ] E2E thật PASS + log.
- [ ] Migration review PASS.
- [ ] Security review PASS.
- [ ] Concurrency review PASS.
- [ ] Docs/status sync.
- [ ] Release gate D4 quyết định rõ.
- [ ] Rollback plan có.
- [ ] Biên bản release ký.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Test pass nhưng flaky | Chạy lặp, sửa gốc, không retry che |
| Migration lệch ở release | INF-00 + slot log + generate check |
| E2E chỉ mock | Bắt buộc backend + DB thật |
| Tuyên bố production payment khi chưa sandbox | Ghi rõ gate D4; không overclaim |
| Docs lệch code | R8 cập nhật theo test evidence |
