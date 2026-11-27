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
| **0025** | **`0025_plain_sister_grimm.sql`** | **Applied in dev + test DB** | FIN-01: `finance_audit_events`, Owner earning entry types, finance indexes |
| **0026** | **`0026_owner_earning_settlements.sql`** | **Applied in test DB** | FIN-15: `owner_earning_settlements`, seed `OWNER_EARNING_AUTO_CREDIT_ENABLED`, backfill |
| **0027** | **`0027_wallet_auto_approve_payouts_config.sql`** | **Applied in dev + test DB (verified 2026-11-22)** | Seed `WALLET_AUTO_APPROVE_PAYOUTS=true` |
| **0028** | **`0028_mighty_aqueduct.sql`** | **Applied in dev + test DB (verified 2026-11-22)** | Booking cost shares / split booking |
| **0029** | **`0029_finance_provider_transaction.sql`** | **Applied in dev + test DB** | Finance repair: unique provider transaction identity; no duplicate evidence in dev preflight |
| **0030** | **`0030_post_backgrounds.sql`** | **Có trong develop (PR #22)** | Nền bài viết (ghi bổ sung 2026-11-22 khi merge; chưa được đăng ký trước đó) |
| **0031** | **`0031_post_background_constraint.sql`** | **Có trong develop (PR #22)** | Ràng buộc nền bài viết (ghi bổ sung 2026-11-22 khi merge) |
| **0032** | **`0032_player_skill_surveys.sql`** | **Applied in dev + test DB** (branch `feat/skill-survey`, chưa merge) | AUTH-29: 7 bậc trình độ, `skill_survey_versions` (+ trigger bất biến, 1 ACTIVE), `player_skill_surveys`, `player_profiles.is_skill_tentative`, nạp survey version 1; snapshot 0032. Ban đầu tạo là `0029`, đổi thành `0032` khi merge develop (develop đã dùng `0029`–`0031`) |
| **0033** | **`0033_email_otp_withdrawal_pin.sql`** | **Có trong develop** | Xác minh email OTP, PIN rút tiền (ghi bổ sung 2026-11-25 khi merge) |
| **0034** | **`0034_password_change_otp.sql`** | **Có trong develop** | OTP đổi mật khẩu (ghi bổ sung khi merge) |
| **0035**–**0039** | **`0035_amazing_callisto.sql` … `0039_late_peter_parker.sql`** | **Có trong develop** | Quản lý sân, thông số mặt sân, tiếp nhận cơ sở (ghi bổ sung khi merge) |
| **0040** | **`0040_tournament_professional.sql`** | **Applied in dev + test DB (as `0033_…` before renumbering; dev history row renamed)** | TRN-01 professional tournaments schema |
| **0041** | **`0041_skill_rating_ranking.sql`** | **Applied in dev + test DB** (dev backup `~/db-backups/badminton_db_before_0034_*.dump`) | TRN-14/18: `player_profiles.skill_rating`, `rated_match_count`, `skill_level_changes`, `skill_rating_events`, `tournament_ranking_points`, seed `SKILL_RATING_*`, `TOURNAMENT_RANKING_*` |
| **0042** | **`0042_tournament_ranking_field.sql`** | **Applied in dev + test DB (2026-11-25)** | TRN-18: exact draw snapshot; populated legacy backfill + constraints verified; dev backup `~/db-backups/badminton_db_before_0035_20261125_172228.dump` |
| 0043 | Chưa dùng — số kế tiếp | — | Task tiếp theo phải đăng ký tại đây trước khi merge |

## Lịch sử cấp số

| Ngày | Số | Task/PR | Người giữ số | Ghi chú |
| --- | --- | --- | --- | --- |
| 2026-11-25 | 0040–0042 | Merge develop | taidangdev | Tournament migrations `0033`/`0034`/`0035` renumbered to `0040`/`0041`/`0042` because develop had taken `0033`–`0039`; snapshot 0042 regenerated from develop 0039 + merged schema (`verify:migrations` OK) |
| 2026-11-25 | 0035 | Tournament review fixes | Codex | `0035_tournament_ranking_field.sql`; snapshot 0035; exact draw sum/count, legacy unfinished-field backfill |
| 2026-11-15 | 0018 | WAL-01 wallet ledger | Tech Lead | `0018_wallet_ledger.sql`; snapshot 0018 |
| 2026-11-15 | 0019 | WAL-02 wallet top-up | Tech Lead | `0019_wallet_top_ups.sql`; snapshot 0019 |
| 2026-11-15 | 0020 | WAL-04 payment refunds | Tech Lead | `0020_payment_refunds.sql`; snapshot 0020 |
| 2026-11-15 | 0021 | WAL-05/06 wallet payouts | Tech Lead | `0021_wallet_payouts.sql`; snapshot 0021 |
| 2026-11-16 | 0022 | RP-05 report targets + evidence | Tech Lead | `0022_classy_tarantula.sql`; snapshot 0022 |
| 2026-11-18 | 0023 | SC-09/SC-06 system config audit + seed | Tech Lead | `0023_overrated_phantom_reporter.sql`; snapshot 0023 |
| 2026-11-19 | 0024 | AD-01 Admin Dashboard supporting indexes | Tech Lead | `0024_dashboard_indexes.sql`; snapshot 0024 |
| 2026-11-19 | 0025 | FIN-01 Admin Finance schema/audit/indexes | Tech Lead | `0025_plain_sister_grimm.sql`; snapshot 0025 |
| 2026-11-19 | 0026 | FIN-15 Owner earning switch | Tech Lead | `0026_owner_earning_settlements.sql`; snapshot 0026 |
| 2026-11-19 | 0027 | FIN-15 Payout auto-approval config | Tech Lead | `0027_wallet_auto_approve_payouts_config.sql`; snapshot 0027 |
| 2026-11-22 | 0032 | AUTH-29 registration skill survey | taidangdev | `0032_player_skill_surveys.sql`; snapshot 0032; first created as `0029`, renumbered when merging develop (which had taken `0029`–`0031`) |
| 2026-11-25 | 0034 | TRN-14/TRN-18 skill rating and ranking | taidangdev | `0034_skill_rating_ranking.sql`; snapshot 0034; hand-added config seed |
| 2026-11-25 | 0033 | TRN-01 professional tournaments schema | taidangdev | `0033_tournament_professional.sql`; snapshot 0033; hand-added backfill of `tournament_team_players.tournament_id` and legacy value normalisation |

| 2026-11-27 | 0043 | OPR-01 Court Owner partnership requests | taidangdev | `0043_owner_partnership_requests.sql`; snapshot 0043; additive |
| 2026-11-22 | 0029 | Finance correctness follow-up | Finance repair | `0029_finance_provider_transaction.sql`; snapshot 0029 |

## Lưu ý môi trường dev

Ghi chú lịch sử từ INF-00: DB dev từng có checksum `0011` khác file sau khi merge `feat/social`; fresh DB đã PASS 0000–0017. Không sửa migration đã áp dụng hoặc cập nhật hash thủ công để bỏ qua khác biệt.

Kiểm chứng hiện tại (2026-11-25): runner đã đối chiếu thành công toàn bộ checksum 0000–0034 và áp dụng 0035 trên `badminton_db` sau khi sao lưu; không cần reset DB dev cho lần cập nhật này.
