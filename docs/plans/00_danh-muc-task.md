# Danh mục task hoàn thiện module

Tài liệu mẹ: [ke-hoach-hoan-thien-module-con-lai.md](./ke-hoach-hoan-thien-module-con-lai.md)

Thứ tự file = thứ tự ưu tiên. Số càng nhỏ càng phải làm sớm vì mở khóa nhiều task phía sau. `00` là danh mục, không phải task.

**Trạng thái 2026-11-15:** `01_g0` DONE cho release scope; D1c công thức nâng trình defer cho đồng đội (TRN-14 ngoài release). D9 ví ảo đã chốt và Track A/Payments docs đã sync sang ví-first. `02_inf-00` **DONE**. `03` đang thực hiện: **WAL-01→08 DONE** (ví, nạp SePay bank webhook, trả ví, refund, withdrawal/Owner payout Admin thủ công, admin adjust, reconciliation). Đã có auto-approve sandbox + outgoing webhook PAYOUT. Còn A6 full regression/Playwright và SePay sandbox smoke.

**Trạng thái 2026-11-16:** `05_bao-cao-kiem-duyet` **PARTIAL**: backend D1/D2/D3/D4 (Admin evidence/media) và D7 docs DONE (migration `0022`, `POST /api/v1/reports`, evidence resolver); D4 hide UI, D5 Admin UI và D6 report dialog đã có **base đủ để test**, final visuals còn **UI-REDO**. `04_thong-bao` **PARTIAL**: C2/NTF-05 resolver và C3 producer audit DONE (tests `notification-resolvers` 6/6, `notification-producers` 6/6, `notification-api` + `notification-service` 13/13), C4 docs DONE. C1 UI mới có base và được đánh dấu **UI-REDO** vì frontend đang sửa song song; `MM_BOOKING_CANCELLED` chờ MM-19/20.

**Trạng thái 2026-11-18:** `08_cau-hinh-he-thong` **PARTIAL**: F1–F3 + F5 (registry/audit/API/tests/docs) DONE; F4 có base UI `/admin/configs` nhưng giữ **UI-REDO** tới khi merge frontend; Playwright A19/SC-11 E2E còn pending. `PLAYER_SKILL_ADJUSTMENT_ENABLED` đổi mặc định sang `false` (migration `0023`).

**Trạng thái 2026-11-18 (Admin alerts):** `ADMIN_REPORT_CREATED` và `ADMIN_FACILITY_SUBMITTED` đã DONE cùng Admin notification UI (bell, `/admin/notifications`, deep link report/facility). `13_thong-bao-van-hanh-admin` **DONE**: đã triển khai 6 loại cảnh báo vận hành (payout pending, refund failed, payment mismatch, config changed, high-risk report, security event), helper best-effort, resolver/deep link và Admin wallet UI; tests targeted 43/43 PASS, builds PASS. Full backend suite chưa chạy lại toàn bộ.

**Trạng thái 2026-11-17:** `06_booking-chu-san-matchmaking` **backend/API + E2E DONE** (B0–B4, B6, B8–B10, B12; full backend 71 file / 686 test PASS; E2E backend+DB thật 2/2 PASS). B5/B7/B11 có base UI nhưng giữ **UI-REDO** tới khi merge frontend. Quyết định: ví-first, system booking dùng `MATCHES.booking_id`, notification `booking:<id>:<event>`, hủy booking→Match đồng bộ + job dự phòng.

**Trạng thái 2026-11-19 (Quản lý tài chính Admin):** `14_quan-ly-tai-chinh-admin` **P0 IMPLEMENTED**. Đã triển khai backend + frontend base: sổ giao dịch hợp nhất, ví theo user, top-up monitoring, payout/refund queue, Owner earnings (`OWNER_EARNING` credit ví Owner khi booking `COMPLETED`, phí 0), đối soát nội bộ, báo cáo cash-flow/revenue, Excel export bằng `exceljs`, `finance_audit_events`; migration `0025_plain_sister_grimm.sql` applied test DB. Frontend base đủ test, mọi màn **UI-REDO**. Bằng chứng: backend build PASS, targeted 55/55 PASS, Playwright 2/2 PASS, `verify:migrations` PASS; full backend suite còn pending (timeout) trước khi đóng FIN-14.

**Trạng thái 2026-11-19 (Công tắc Owner earning):** `15_bat-tat-cong-vi-owner-tu-dong` **IMPLEMENTED** (2026-11-19, UI-REDO). Mục tiêu: đã thêm key `OWNER_EARNING_AUTO_CREDIT_ENABLED` (domain `finance`, mặc định `true`) để bật/tắt tự động cộng ví Owner; khi tắt, payment thành công vào hàng chờ Admin duyệt rồi mới cộng ví; khi bật, cộng ví Owner ngay sau payment `SUCCESS`; giữ idempotency ledger và luồng `OWNER_PAYOUT`. Migration `0026`, backend + FE base DONE; targeted tests 67/67 PASS, builds PASS; full suite/deploy còn mở.

**Trạng thái 2026-11-20 (Report target detail):** `16_admin-report-target-detail` **IMPLEMENTED (UI-REDO)**. Đã mở rộng `GET /admin/reports/:id` với object `target` để Admin xác minh đối tượng; PLAYER hiển thị hồ sơ + lịch sử báo cáo + hoạt động công khai, MESSAGE chỉ evidence/snapshot (không mở hội thoại). Không mở luồng tạo report PLAYER/FACILITY/TOURNAMENT; UI base đủ thấy dữ liệu, giữ **UI-REDO** tới khi merge frontend. Tests targeted 19/19 PASS; backend/frontend build PASS.

**Trạng thái 2026-11-22 (Khảo sát trình độ khi đăng ký):** dòng `17` **docs Ready (2026-11-22)**, sẵn sàng code từ AUTH-29. Docs khảo sát (PRD/Tech Design/schema) đã sửa theo quyết định 2026-11-22 và được chủ dự án duyệt Ready; bản mẫu UX `docs/design/smashpro-auth-v3/` đã duyệt (giữ radar). Plan nằm trong `docs/features/platform/authentication-authorization/tasks.md` (AUTH-29…AUTH-33, wave S1–S3), không có file riêng trong `docs/plans/`. Bản đồ đọc tài liệu: đầu mục "Registration skill survey" trong Auth PRD. Migration dự kiến `0029`. Ưu tiên trước phần nâng trình qua giải đấu.

| STT | File | Track/Phase | Mở khóa cho |
| --- | --- | --- | --- |
| 00 | `00_danh-muc-task.md` | Danh mục | — |
| 01 | `01_g0-cong-quyet-dinh.md` | G0 / Phase 0 | Toàn bộ kế hoạch |
| 02 | `02_inf-00-nen-migration.md` | INF-00 / Phase 0 | Mọi migration |
| 03 | `03_thanh-toan-hoan-tien.md` | Track A | Booking, Owner, Matchmaking, Tournament |
| 04 | `04_thong-bao.md` | Track C | Booking, Matchmaking, Tournament, Social |
| 05 | `05_bao-cao-kiem-duyet.md` | Track D | Social report, Admin moderation |
| 06 | `06_booking-chu-san-matchmaking.md` | Track B | Tournament scheduling, Owner, Matchmaking |
| 07 | `07_giai-dau.md` | Track G | Ratings Tournament, Profile Tournament |
| 08 | `08_cau-hinh-he-thong.md` | Track F | Admin vận hành, cấu hình động |
| 09 | `09_dashboard-admin.md` | Track E | Admin vận hành |
| 10 | `10_social-ho-so-va-tich-hop.md` | Track H | Social/Profile/AF/RT hoàn tất |
| 11 | `11_e2e-release.md` | Phase cuối | Release |
| 12 | `12_rut-vi-tu-dong-sepay-bankhub.md` | Track A / dev-demo | Demo rút ví tự động qua SePay Bank Hub sandbox |
| 13 | `13_thong-bao-van-hanh-admin.md` | Track C / Admin Operations | Cảnh báo vận hành Admin, payout/refund/config/report risk/security |
| 14 | `14_quan-ly-tai-chinh-admin.md` | Track E+ / Admin Finance | Vận hành ví-first, Owner earnings, đối soát, báo cáo, Excel export |
| 15 | `15_bat-tat-cong-vi-owner-tu-dong.md` | Track E+ / Admin Finance | Công tắc bật/tắt tự động cộng ví Owner; hàng chờ Admin duyệt khi tắt |
| 16 | `16_admin-report-target-detail.md` | Track D / Admin Moderation | Xem chi tiết đối tượng báo cáo; xác minh PLAYER bằng hồ sơ + lịch sử report + hoạt động công khai |
| 17 | `../features/platform/authentication-authorization/tasks.md` (AUTH-29…AUTH-33) | Auth / Social Matchmaking | Khảo sát trình độ khi đăng ký → trình độ ban đầu 7 bậc cho Player; tiền đề cho nâng trình qua giải đấu |

> **UI-REDO (áp dụng từ `04` trở đi, 2026-11-16):** frontend đang được sửa song song. Mọi task/mục có giao diện phải đánh dấu `[ ] UI-REDO` thay vì `[x]` cho tới khi merge và kiểm tra lại UI; có thể ghi kèm “base đã có” nhưng không tính DONE.

## Quy ước trạng thái

- `[ ]` chưa làm
- `[x]` đã xong và đã có bằng chứng test
- `BLOCKED` chỉ dùng khi thiếu quyết định G0 hoặc thiếu migration slot; không dùng cho “chờ code người khác” nếu task đã có thứ tự trong danh mục này.

## Cách cập nhật

1. Làm đúng thứ tự file; không mở task sau khi task trước chưa đạt exit gate.
2. Mỗi khi tick `[x]`, ghi kèm một dòng bằng chứng: test file/lệnh + kết quả.
3. Khi phát sinh task mới, thêm vào file đúng track và cập nhật bảng trên.
