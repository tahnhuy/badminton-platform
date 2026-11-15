# Migration slot log

Quy ước:

- Mỗi PR chỉ thêm một migration.
- Số migration phải nối tiếp số lớn nhất đã áp dụng; không tái sử dụng số đã dùng.
- File `.sql` đã áp dụng là bất biến; sửa bằng migration mới.
- Mỗi migration mới phải cập nhật `meta/_journal.json`, snapshot tương ứng và file này.
- Snapshot mới nhất phải đại diện đúng schema Drizzle hiện tại; `npm run verify:migrations` phải PASS.

## Trạng thái baseline — 2026-11-15

| Số | File | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| 0000–0014 | `0000_*` … `0014_recruitment_membership_foundation.sql` | Applied | Lịch sử cũ; snapshot có đủ 0000–0014 |
| 0015 | `0015_messaging_foundation.sql` | Applied | Có journal entry; snapshot lịch sử không còn, snapshot 0017 đại diện schema hiện tại |
| 0016 | `0016_messaging_v2_actions_and_group_owner.sql` | Applied | Có journal entry; snapshot lịch sử không còn |
| 0017 | `0017_matchmaking_request_conversations.sql` | Applied | Đã thêm journal entry + `0017_snapshot.json` trong INF-00 |
| **0018** | **Chưa dùng — số kế tiếp** | — | Task tiếp theo phải đăng ký tại đây trước khi merge |

## Lịch sử cấp số

| Ngày | Số | Task/PR | Người giữ số | Ghi chú |
| --- | --- | --- | --- | --- |
| 2026-11-15 | 0018 | Chưa cấp | — | Số kế tiếp hợp lệ |

## Lưu ý môi trường dev

DB dev hiện có checksum `0011` khác file hiện tại (do merge `feat/social` sau khi migration đã áp dụng). Fresh DB đã PASS toàn bộ 0000–0017. Dev DB cần reset theo README (`docker compose down -v && docker compose up -d`) hoặc được review riêng; không sửa file migration đã áp dụng và không cập nhật hash thủ công nếu chưa đối chiếu schema.
