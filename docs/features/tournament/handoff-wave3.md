# Bàn giao giai đoạn 3 — Giao diện Giải đấu (TRN-07, TRN-08)

Ngày: 2026-11-25 · Nhánh: `docs/tournament-redesign` (chưa push; nhánh này chứa cả tài liệu lẫn code giải đấu) · Người quyết định: chủ dự án (taidangdev).

Tài liệu này đủ để bắt đầu code React cho giai đoạn 3 mà không cần đọc lại lịch sử trao đổi. Nguồn sự thật vẫn là PRD, Tech Design và `tasks.md`; tài liệu này tóm tắt và chỉ đường.

---

## 1. Tình trạng khi bàn giao

| Giai đoạn | Task | Trạng thái | Commit |
| --- | --- | --- | --- |
| 1 — API giải đơn | TRN-01 schema (migration `0033`) | DONE | `9ec2f6f` |
| | TRN-02 CRUD + vòng đời | DONE | `7c027f7` |
| | TRN-03 đăng ký đơn + lệ phí ví | DONE | `8064fb9` |
| 2 — API thi đấu | TRN-04 seed, bốc thăm, bracket | DONE | `b949ca6` |
| | TRN-05 xếp lịch sân ảo | DONE | `eff44d7` |
| | TRN-06 điều hành trận | DONE | `ee86ca0` |
| 3 — Giao diện | Prototype HTML (TRN-07 + TRN-08) | XONG, chờ duyệt 5 điểm | `dced3a2`, `7d9d9ed` |
| | TRN-07 trang Player (React) | CHƯA BẮT ĐẦU | — |
| | TRN-08 bảng điều khiển Organizer (React) | CHƯA BẮT ĐẦU | — |

Kiểm chứng backend cuối giai đoạn 2: toàn bộ suite 1029/1030 test PASS; 2 test migration timeout khi chạy chung đã được nâng timeout (`88bf621`) và PASS khi chạy lại. Migration `0033` đã chạy trên DB dev `badminton_db` (backup trong `~/db-backups/`).

## 2. Việc phải làm trước khi code

**Chủ dự án duyệt 5 điểm** trong `docs/design/smashpro-tournament-v1/README.md` §"Cần duyệt". Không tự quyết; nếu chưa có câu trả lời thì hỏi.

| # | Điểm | Đề xuất của prototype | Ảnh hưởng tới code |
| --- | --- | --- | --- |
| 1 | Thêm mục "Giải đấu" vào thanh điều hướng Player (hiện 5 mục, có "Đánh giá") | Thay "Đánh giá" bằng "Giải đấu" | `frontend/src/features/player/nav-tabs.ts`, test shell Player |
| 2 | Nhánh đấu trên mobile | Cuộn ngang cả nhánh | Component bracket |
| 3 | Sửa lịch | Bấm trận → hộp thoại; kéo-thả để sau | Bảng lịch Organizer |
| 4 | Hero xanh rừng ở trang chi tiết | Giữ | Trang chi tiết |
| 5 | Câu chữ | Đề xuất, sửa thoải mái | Mọi màn |

## 3. Phạm vi giai đoạn 3

**TRN-07 — Player / khách** (`tasks.md` §TRN-07, PRD §9, Tech Design §12):
- `/tournaments` danh sách + bộ lọc (trạng thái, đơn/đôi, miễn phí, hợp trình độ tôi, tìm tên).
- `/tournaments/:id` chi tiết, 4 tab: Thông tin · Người tham gia · Nhánh đấu · Lịch thi đấu.
- Đăng ký (hộp thoại hiện lệ phí + số dư ví, thiếu tiền → link `/wallet`), rút đăng ký.
- `/tournaments/mine` — Đã đăng ký · Tổ chức · Lời mời (lời mời chỉ hiển thị danh sách giải; thao tác đội ở TRN-09).
- Mục "Giải đấu" trên thanh điều hướng Player (theo quyết định điểm 1).

**TRN-08 — Organizer** (`tasks.md` §TRN-08):
- `/tournaments/new`, `/tournaments/:id/manage` với 6 mục: Thiết lập · Người tham gia · Hạt giống & bốc thăm · Lịch thi đấu (bảng sân × giờ) · Trận đấu (bắt đầu, tỉ số, walkover, bỏ cuộc, huỷ, sửa) · Kết thúc giải.

**Ngoài phạm vi giai đoạn 3** (có ở prototype làm minh họa nhưng chưa có API — hiển thị ở trạng thái tắt hoặc bỏ):
| Chức năng | Task có API | Trong giai đoạn 3 |
| --- | --- | --- |
| Đội đôi, lời mời, link mời | TRN-09 | Giải đôi: hiện "Sắp có đăng ký theo đội"; không nút đăng ký |
| Cập nhật realtime | TRN-15 | Dùng `refetchInterval` 30 s khi giải `READY`/`IN_PROGRESS` |
| Nhắc trước 30 phút, thông báo | TRN-10/11 | Chỉ câu chữ, không chức năng |
| Nhóm chat của giải, chia sẻ lên Social, lịch sử trên Profile | TRN-16 | Bỏ khỏi UI (không có `conversationId`, không có `POST /share`) |
| Điểm phong độ, bảng xếp hạng | TRN-14, TRN-18 | Không |
| Trang Admin | TRN-12 | Không |

## 4. Thiết kế tham chiếu

- Prototype: `docs/design/smashpro-tournament-v1/` (`index.html`, `styles.css`, `app.js`, `data.js`, `score.js`, `README.md`). Mở:
  ```bash
  python3 -m http.server 5181 --bind 127.0.0.1 --directory docs/design
  # http://localhost:5181/smashpro-tournament-v1/  — thanh tối trên cùng đổi người xem và trạng thái giải
  ```
- Token DS01: `frontend/src/index.css` (xanh `--color-brand` #006b2c, xanh rừng `--color-brand-forest` #093a29, lime `--color-brand-lime` #d4ed8b, nền #f2f5ef). Trong React **chỉ dùng class token Tailwind**, không hex.
- **Nhánh đấu** (góp ý chủ dự án 2026-11-25, bắt buộc giữ): đường nối SVG từ người thắng tới đúng ô ở vòng sau (trận `i` của vòng `r` vào trận `⌊i/2⌋` vòng `r+1`, ô trên khi `i` chẵn); nhánh đã quyết định màu xanh + vệt lime chảy về vòng trong, vẽ dần theo vòng khi mở tab; trận đang đánh chảy chậm màu hồng; chưa quyết định để xám; **người thua mờ + xám + gạch tên**; ô Vô địch sáng viền lime. Tham khảo `drawBracketLines()` trong `app.js` và khối CSS `.bracket-lines`. Reduced motion: tắt hiệu ứng, đường vẫn hiện.
- Hộp thoại tỉ số: kiểm tra luật **khi gõ**; set 3 chỉ mở khi 1–1; xem trước người thắng. Luật nằm ở `backend/src/services/tournaments/result/score.ts` (bản JS `score.js`) — chép thành module thuần ở frontend, giữ cùng bảng ví dụ test.

## 5. API sẵn có (backend, tiền tố `/api/v1/tournaments`)

JSON camelCase, danh sách `{ data, meta: { page, limit, total, totalPages } }`, lỗi `{ error: { code, message, details } }`. Ghi cần phiên PLAYER + CSRF (http client đã lo). Thời gian là ISO UTC; hiển thị theo giờ Việt Nam.

| Phương thức | Đường dẫn | Ai | Ghi chú cho UI |
| --- | --- | --- | --- |
| GET | `/` | công khai | `status`, `matchType`, `free`, `eligibleForMe`, `from`, `to`, `q`, `page`, `limit≤50`; không trả DRAFT |
| GET | `/mine?role=organized\|registered\|invited` | Player | `organized` gồm cả bản nháp |
| GET | `/:id` | công khai (DRAFT: Organizer) | `viewer.{isOrganizer, registrationId, eligible, ineligibleReason}` → quyết định nút chính; `slotsLeft`, `confirmedCount`, `organizer`, `minSkillLevel`, `maxSkillLevel`, `schedule.*`, `version` |
| POST | `/` | Player | tạo DRAFT |
| PATCH | `/:id` | Organizer | kèm `version`; lỗi `TOURNAMENT_FIELD_LOCKED` có `details[].field` → đánh dấu trường bị khoá |
| POST | `/:id/open` · `/close` · `/cancel` · `/complete` | Organizer | kèm `version`; `cancel` có `reason?` |
| GET | `/:id/registrations` | công khai | danh sách người tham gia (tên, avatar, trình độ, seed) |
| POST | `/:id/registrations` | Player | body `{}` (đơn); trừ ví; lỗi `WALLET_INSUFFICIENT_BALANCE` có `details[0].required/balance` |
| DELETE | `/:id/registrations/:registrationId` | chủ đăng ký | rút khi còn mở; hoàn 100% |
| POST | `/:id/registrations/:registrationId/remove` | Organizer | `{ reason }` 1–300 ký tự |
| GET · PUT | `/:id/seeds` | Organizer | GET: `{ editable, version, entries[{ registrationId, seedNo, suggestedSeedNo, skillRank, players, teamName }] }`; PUT `{ version, seeds:[{registrationId, seedNo}] }` (1..k liên tục) |
| POST | `/:id/draw` | Organizer | `{ version }` → bracket + lịch tự động, trạng thái READY |
| GET | `/:id/bracket` | công khai | `{ generated, totalRounds, drawSeed, rounds[{ roundIndex, matches[{ id, slot1, slot2 (registrationId, seedNo, players, fromBye), winnerRegistrationId, resolution, status, scheduledAt, courtLabel, sets[{setNo,team1Score,team2Score}], nextMatchId }] }] }` — `roundIndex` bắt đầu từ 0 |
| GET | `/:id/schedule` | công khai | `{ matchDurationMinutes, courtCount, matches[...], warnings? }` — `warnings` chỉ cho Organizer |
| POST | `/:id/schedule/auto` | Organizer | `{ version }`; ghi đè chỉnh tay của trận chưa đánh (hỏi xác nhận) |
| PATCH | `/:id/matches/:tournamentMatchId/schedule` | Organizer | `{ courtLabel, scheduledAt }` → `{ match, warnings }`; **tăng version** |
| POST | `/:id/matches/:tournamentMatchId/start` | Organizer | trả bracket mới |
| PUT | `/:id/matches/:tournamentMatchId/result` | Organizer | `{type:'SETS', sets}` · `{type:'RETIRED', retiredSlot, sets}` · `{type:'WALKOVER', winnerSlot, reason?}` · `{type:'CANCEL', reason}`; trả bracket mới |

Ví: `GET /api/v1/wallet` → `{ balance, held, available }` (dùng `available` cho hộp thoại đăng ký); trang nạp ví ở `/wallet`.

**Mã lỗi cần câu chữ tiếng Việt** (Tech Design §3.6): `TOURNAMENT_NOT_FOUND`, `TOURNAMENT_FORBIDDEN`, `TOURNAMENT_INVALID_STATE`, `TOURNAMENT_VERSION_CONFLICT` (tải lại), `TOURNAMENT_FIELD_LOCKED`, `TOURNAMENT_REGISTRATION_CLOSED`, `TOURNAMENT_FULL`, `TOURNAMENT_NOT_ELIGIBLE` (`details[0].code` = `BELOW_MIN_LEVEL`/`ABOVE_MAX_LEVEL`), `TOURNAMENT_ORGANIZER_CANNOT_PLAY`, `TOURNAMENT_ALREADY_REGISTERED`, `TOURNAMENT_TEAM_REQUIRED`, `WALLET_INSUFFICIENT_BALANCE`, `TOURNAMENT_SEED_INVALID`, `TOURNAMENT_BRACKET_ALREADY_GENERATED`, `TOURNAMENT_NOT_ENOUGH_PARTICIPANTS`, `TOURNAMENT_MATCH_NOT_PLAYABLE`, `TOURNAMENT_MATCH_LOCKED`, `TOURNAMENT_RESULT_INVALID` (`details[{setNo, reason}]`), `TOURNAMENT_CORRECTION_WINDOW_CLOSED`, `TOURNAMENT_NOT_FINISHED`, `TOURNAMENT_DISABLED`, `VALIDATION_FAILED` (`details[{field, code}]`).

**Dữ liệu UI tự suy ra (không có endpoint riêng):**
- "Trận tiếp theo của bạn": từ `/schedule` + `viewer.registrationId` — trận chưa xong đầu tiên có ô chứa registration đó.
- Trạng thái nút chính trang chi tiết: từ `status` + `viewer.*` (bảng trong prototype `heroCta()`).
- Trường khoá ở form Thiết lập: quy tắc ở Tech Design §6.2 (hiển thị trước), lỗi `TOURNAMENT_FIELD_LOCKED` là nguồn cuối.

## 6. Quy ước frontend phải theo

- Thư mục `frontend/src/features/tournaments/` (pages, components, hooks, services, types) theo `docs/architecture/frontend.md` §3, §7; service gọi `httpClient` (`src/shared/api/http-client.ts`).
- React Query cho dữ liệu máy chủ (query key theo giải: `['tournament', id, ...]`), RHF + Zod cho form, primitive `src/components/ui/*` (dialog, select, table, toggle-group, radio-group, progress, skeleton, badge, alert…).
- Route: thêm vào `src/app/router.tsx` (trang Player trong `PlayerLayout`; trang công khai cho khách theo cách landing/route công khai đã làm); lazy-load trang nặng (bracket, console). Cập nhật bảng route `frontend.md` §4.2.
- **DS01 guard**: thêm file mới vào `ui-check.config.json` → `npm run check:ui` cấm hex, inline style tĩnh, CSS import, cỡ chữ/radius ngoài thang. Đường nối SVG: dùng class Tailwind + biến (stroke qua `stroke-primary`…); hiệu ứng qua Motion hoặc keyframe trong config Tailwind, không file CSS mới.
- Chuyển động 150–300 ms (`frontend.md` §1); ngoại lệ "dòng chảy" của nhánh đấu đã được chủ dự án yêu cầu — ghi chú ngoại lệ trong file.
- Câu chữ tiếng Việt; không lộ email/số điện thoại của người tham gia.
- Thêm nhãn giao dịch ví `TOURNAMENT_EARNING` ("Lệ phí giải (Organizer)") trong `src/features/wallet/types.ts` và `WalletPage.tsx` (việc tồn đọng từ TRN-03).

## 7. Kiểm chứng bắt buộc

| Bước | Lệnh / cách làm |
| --- | --- |
| Kiểu và build | `cd frontend && npx tsc -b && npm run build` |
| Lint + DS01 | `npm run lint` (gồm `check:ui`) |
| E2E giao diện (mock API) | `e2e/tournament-ui.spec.ts`, `e2e/tournament-organizer-ui.spec.ts` theo mẫu `e2e/auth-ui-mocks.ts` (`mockAuthApi` + `handlers`); 390/1280 px không tràn ngang; reduced motion |
| E2E thật (một luồng) | `e2e/tournament-live.spec.ts`: tạo → mở → 4 Player đăng ký (ví được nạp sẵn) → đóng → bốc thăm → đánh tới chung kết → kết thúc → ví Organizer được cộng. Cần backend E2E riêng ở cổng 3000 (dừng backend dev trước) |
| Backend không đổi | Nếu phải sửa backend: test liên quan + `tsc`; full suite chỉ cuối giai đoạn 4 và 6 |

Lưu ý môi trường:
- Playwright tự chạy backend E2E ở cổng 3000 (`reuseExistingServer: false`) — backend dev đang chạy sẽ chặn. Test mock thuần có thể dùng config tạm chỉ khởi Vite (cách đã làm ở AUTH-35).
- Mọi thao tác ghi khi kiểm thử chỉ trên DB `badminton_test`; không ghi `badminton_db` trừ khi chủ dự án yêu cầu.
- Không cho agent review chạy test cùng lúc với mình (chung `badminton_test` → deadlock/FK lỗi giả).

## 8. Quy trình (đã thống nhất)

1. Mở task: `tasks.md` → `IN_PROGRESS` + mục "Tiến độ" (đã làm / đã kiểm / còn lại), cập nhật sau mỗi bước.
2. Gặp điểm chưa quyết, đổi hành vi hay phạm vi → **dừng hỏi chủ dự án**.
3. Code → kiểm chứng §7 → tự review diff → cập nhật tài liệu (chỉ ghi kết quả đã kiểm thật).
4. Commit tiếng Anh, **không dòng co-author**, code và docs tách commit; **không push khi chưa hỏi**; ảnh/log chạy thử không commit (để ngoài repo).
5. Làm hết các task của giai đoạn rồi **dừng báo cáo**, chờ duyệt trước giai đoạn 4.

## 9. Bài học từ giai đoạn 1–2 (áp dụng khi phải đụng backend)

- Trong transaction đang giữ khoá dòng, **mọi truy vấn đi qua `tx`**, không dùng `db` toàn cục (đã gây nguy cơ cạn pool khi ≥ 10 người đăng ký cùng lúc).
- Kiểm trạng thái trước version để mã lỗi đúng nghĩa (ví dụ bốc thăm lần hai → `BRACKET_ALREADY_GENERATED`).
- Sửa lịch tay tăng `version` → màn hình Organizer phải lấy `version` mới sau mỗi lần lưu lịch trước khi bấm "Xếp lại".
- TODO còn mở trong `TournamentMatchService`: sau khi sửa kết quả của giải đã kết thúc phải tính lại vị trí / điểm phong độ (TRN-14/16).

## 10. Tài liệu liên quan

- `docs/features/tournament/prd.md` (28 quyết định; bảng tóm tắt S1–S17 đầu file)
- `docs/features/tournament/tech-design.md` (§3 API, §6 luật sửa, §7 thuật toán, §12 frontend)
- `docs/features/tournament/tasks.md` (Working Process, TRN-07/08, tiến độ từng task)
- `docs/business-rules-config-matrix.md` §4–§5
- `docs/design/smashpro-tournament-v1/README.md`
- `docs/architecture/frontend.md`
- `docs/research/bao-cao-cong-thuc-nang-trinh.md` (bối cảnh điểm phong độ — chưa dùng ở giai đoạn 3)
