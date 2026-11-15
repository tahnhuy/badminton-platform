# Danh mục task hoàn thiện module

Tài liệu mẹ: [ke-hoach-hoan-thien-module-con-lai.md](./ke-hoach-hoan-thien-module-con-lai.md)

Thứ tự file = thứ tự ưu tiên. Số càng nhỏ càng phải làm sớm vì mở khóa nhiều task phía sau. `00` là danh mục, không phải task.

**Trạng thái 2026-11-15:** `01_g0` DONE cho release scope; D1c công thức nâng trình defer cho đồng đội (TRN-14 ngoài release). D9 ví ảo đã chốt nhưng Track A/Payments docs sync defer. `02_inf-00` **DONE** (journal/snapshot, guard, fresh+populated test, INF-01 docs sync). Dừng tại đây; `03` chưa bắt đầu.

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

## Quy ước trạng thái

- `[ ]` chưa làm
- `[x]` đã xong và đã có bằng chứng test
- `BLOCKED` chỉ dùng khi thiếu quyết định G0 hoặc thiếu migration slot; không dùng cho “chờ code người khác” nếu task đã có thứ tự trong danh mục này.

## Cách cập nhật

1. Làm đúng thứ tự file; không mở task sau khi task trước chưa đạt exit gate.
2. Mỗi khi tick `[x]`, ghi kèm một dòng bằng chứng: test file/lệnh + kết quả.
3. Khi phát sinh task mới, thêm vào file đúng track và cập nhật bảng trên.
