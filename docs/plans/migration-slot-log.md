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
| **0018** | **`0018_wallet_ledger.sql`** | **Applied in test DB; code committed pending** | WAL-01: wallet accounts, ledger entries, holds |
| **0019** | **`0019_wallet_top_ups.sql`** | **Applied in test DB** | WAL-02: wallet top-up intent |
| **0020** | **`0020_payment_refunds.sql`** | **Applied in test DB** | WAL-04: refund intents/worker |
| **0021** | **`0021_wallet_payouts.sql`** | **Applied in test DB** | WAL-05/06: bank accounts + payout requests |
| **0022** | **`0022_classy_tarantula.sql`** | **Applied in test DB** | RP-05: report targets + evidence tables + `REPORT_ENABLED` seed |
| **0023** | **`0023_overrated_phantom_reporter.sql`** | **Applied in test DB** | SC-09: `SYSTEM_CONFIG_AUDIT`; seed tournament/team keys; `PLAYER_SKILL_ADJUSTMENT_ENABLED=false` |
| **0024** | **`0024_dashboard_indexes.sql`** | **Applied in dev + test DB** | AD-01: 9 dashboard supporting indexes; snapshot 0024 |
| **0025** | **Chưa dùng — số kế tiếp** | — | Task tiếp theo phải đăng ký tại đây trước khi merge |

## Lịch sử cấp số

| Ngày | Số | Task/PR | Người giữ số | Ghi chú |
| --- | --- | --- | --- | --- |
| 2026-11-15 | 0018 | WAL-01 wallet ledger | Tech Lead | `0018_wallet_ledger.sql`; snapshot 0018 |
| 2026-11-15 | 0019 | WAL-02 wallet top-up | Tech Lead | `0019_wallet_top_ups.sql`; snapshot 0019 |
| 2026-11-15 | 0020 | WAL-04 payment refunds | Tech Lead | `0020_payment_refunds.sql`; snapshot 0020 |
| 2026-11-15 | 0021 | WAL-05/06 wallet payouts | Tech Lead | `0021_wallet_payouts.sql`; snapshot 0021 |
| 2026-11-16 | 0022 | RP-05 report targets + evidence | Tech Lead | `0022_classy_tarantula.sql`; snapshot 0022 |
| 2026-11-18 | 0023 | SC-09/SC-06 system config audit + seed | Tech Lead | `0023_overrated_phantom_reporter.sql`; snapshot 0023 |
| 2026-11-19 | 0024 | AD-01 Admin Dashboard supporting indexes | Tech Lead | `0024_dashboard_indexes.sql`; snapshot 0024 |
| — | 0025 | Chưa cấp | — | Số kế tiếp hợp lệ |

## Lưu ý môi trường dev

DB dev hiện có checksum `0011` khác file hiện tại (do merge `feat/social` sau khi migration đã áp dụng). Fresh DB đã PASS toàn bộ 0000–0017. Dev DB cần reset theo README (`docker compose down -v && docker compose up -d`) hoặc được review riêng; không sửa file migration đã áp dụng và không cập nhật hash thủ công nếu chưa đối chiếu schema.
