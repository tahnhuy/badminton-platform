# SH01 — Player shell: rà soát trước khi triển khai

- Rà soát: 18/11/2026. Trạng thái hiện tại: **DONE — người dùng cho chuyển tiếp 19/11/2026**. Hướng đã được chốt; bàn giao gọn ở mục 9. Tiến độ cũ xem [lịch sử §22](../frontend-modernization-history.md).
- Phạm vi: khung bao mọi trang Player — `PlayerLayout`, `PlayerHeader` (519 dòng), `PlayerSidebar` (menu mobile), `PlayerFooter`, `nav-tabs.ts`, vị trí `GlobalChatDock` trong layout. Nội dung từng trang và bản thân chat dock (D22) không thuộc đợt này.
- Môi trường: Vite dev 5198, phiên Player mô phỏng (3 tin nhắn chưa đọc), danh sách sân thật từ `/api/v1/facilities`. Ảnh và số đo: [`evidence/SH01-before/`](../evidence/SH01-before/).

## 1. Hiện trạng

| Màn | Ảnh |
| --- | --- |
| Header 390 / 768 / 1024 / 1280 / 1440 | [390](../evidence/SH01-before/header-390.png), [768](../evidence/SH01-before/header-768.png), [1024](../evidence/SH01-before/header-1024.png), [1280](../evidence/SH01-before/header-1280.png), [1440](../evidence/SH01-before/header-1440.png) |
| Menu mobile mở | [390](../evidence/SH01-before/mobile-menu-390.png) |
| Menu tài khoản mở | [1280](../evidence/SH01-before/user-menu-1280.png) |
| Footer + bong bóng chat | [1280](../evidence/SH01-before/footer-1280.png) |

Không tràn ngang ở mọi độ rộng. Điều hướng desktop hiện từ 1024 px, menu hamburger dưới 1024 px.

## 2. Hành vi phải giữ nguyên

1. Mọi route Player nằm trong `PlayerProfileLayout` (ProfileProvider theo tài khoản) → `PlayerLayout`; guard PLAYER giữ nguyên.
2. Tab đang chọn theo `isPlayerTabActive` (bài viết `/posts/*` thuộc Cộng đồng).
3. Số tin nhắn chưa đọc lấy từ `GET /conversations/unread-summary`, làm mới khi có sự kiện `messaging:unread-changed` và khi tab hiện lại.
4. Có lối tới: hồ sơ, lịch đặt sân, đổi mật khẩu, danh sách chặn, đăng xuất (PRD Auth §7.6: đăng xuất từ mọi trang).
5. `GlobalChatDock` luôn có mặt trên trang Player (kéo thả, nhớ vị trí, số chưa đọc).
6. E2E đang dùng nhãn điều hướng (“Sân cầu lông”, “Tìm đối thủ”…) và “Đăng xuất”.

## 3. Nhận xét từ góc độ người dùng

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| U1 | P1 | Trong đợt | ảnh header-1024 | Ở 1024 px nhãn điều hướng xuống 2 dòng và đè chữ “SmashPro” | Điểm chuyển desktop theo nội dung thực (≥ 1280 px cho 7 mục) hoặc rút gọn mục (Q1) |
| U2 | P1 | Cần chốt | `PlayerHeader` | Chuông thông báo **luôn có chấm đỏ** nhưng bấm không làm gì — tín hiệu giả, người dùng tưởng có thông báo | Q2 |
| U3 | P2 | Cần chốt | notes: nav | 7 mục điều hướng, trong đó “Trang chủ” (trang trống “Đây là trang chủ”) và “Giải đấu” là placeholder; sau đăng nhập Player cũng rơi vào trang chủ trống | Q1 |
| U4 | P2 | Trong đợt | ảnh 1280 | Tin nhắn có 4 lối vào (mục điều hướng, icon 💬, menu tài khoản, bong bóng chat); hồ sơ có 3 (icon thẻ, pill tên, menu) | Mỗi chức năng một lối chính trên header (Q4) |
| U5 | P2 | Trong đợt | ảnh mobile-menu | Menu mobile khác desktop: thiếu “Hồ sơ cá nhân”, “Danh sách chặn”; hiện tên “khang” (phần đầu email) trong khi header ghi “Nguyễn Minh Khang” | Một nguồn mục tài khoản cho cả hai; dùng tên hồ sơ |
| U6 | P2 | Cần chốt | ảnh footer | 4 link footer trỏ `#` (không đi đâu), “© 2024”; bong bóng chat đè footer | Q5 |
| U7 | P3 | Trong đợt | ảnh user-menu | “Vai trò: Người chơi (Player)” lẫn tiếng Anh; “PLAYER PORTAL” tiếng Anh | Tiếng Việt, dùng `ROLE_LABELS` |
| U8 | P3 | Trong đợt | ảnh header-390 | 390 px: chuông đè chữ “SmashPro” | Thu gọn logo trên mobile (chỉ biểu tượng) |

## 4. Nhận xét từ góc độ thiết kế giao diện

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| D1 | P1 | Trong đợt | notes | Menu tài khoản tự viết: không `aria-expanded`/`aria-haspopup`, Escape không đóng | Radix `DropdownMenu` (đã có primitive) |
| D2 | P2 | Trong đợt | notes | Menu mobile không có `role="dialog"`/nhãn; dùng hook `useModalA11y` riêng | `Dialog` primitive biến thể ngăn kéo trái |
| D3 | P2 | Trong đợt | code | Hover bằng `onMouseEnter` đổi style trực tiếp, inline style + hex fallback màu cũ (#F2F3FF, #131B2E…) | Tailwind + token; `check:ui` cho file shell |
| D4 | P2 | Trong đợt | ảnh header | Icon trộn: emoji 💬, icon tự vẽ, icon thẻ hồ sơ | lucide (`Bell`, `MessageCircle`, …) |
| D5 | P3 | Trong đợt | notes | Không có link “Bỏ qua tới nội dung chính” cho người dùng bàn phím | Thêm skip link hiện khi focus |
| D6 | P3 | Phối hợp D22 | ảnh footer | Bong bóng chat cố định góc phải đè nội dung cuối trang | Layout chừa khoảng an toàn dưới cùng; vị trí bong bóng thuộc D22 |

## 5. Lỗi/khoảng trống chức năng

| ID | Phạm vi | Nội dung |
| --- | --- | --- |
| F1 | Cần chốt | Backend đã có API thông báo (`/api/v1/notifications`) nhưng frontend chưa có giao diện thông báo |
| F2 | Ngoài đợt | Trang chủ Player (`PlayerHomePage.tsx` 996 dòng) có sẵn nhưng chưa nối route; route `/` đang là placeholder |
| F3 | Backlog | Chưa có trang Điều khoản/Chính sách/Quy định — không tự viết nội dung pháp lý |

## 6. Câu hỏi cần chốt

- **Q1 — Mục điều hướng.** A. 5 mục có chức năng (Sân cầu lông, Tìm đối thủ, Cộng đồng, Tin nhắn, Đánh giá), ẩn “Trang chủ”/“Giải đấu” tới khi có; trang đích sau đăng nhập của Player cần chốt riêng / B. Giữ 7 mục, gắn nhãn “Sắp ra mắt” cho mục chưa có / C. Giữ nguyên.
- **Q2 — Chuông thông báo.** A. Bỏ chấm đỏ giả và ẩn chuông tới khi có giao diện thông báo (ghi backlog) / B. Làm luôn panel thông báo bằng API có sẵn (vượt phạm vi shell, cần đọc PRD/Tech Design thông báo) / C. Giữ chuông, bỏ chấm đỏ.
- **Q3 — Điều hướng mobile.** A. Ngăn kéo trái (như hiện tại) dựng lại bằng Radix Dialog / B. Thanh tab dưới đáy 4–5 mục + nút “Thêm” — thao tác một tay dễ hơn.
- **Q4 — Gọn header.** Mỗi chức năng một lối: [Thông báo] [Tin nhắn có số chưa đọc] [Ảnh đại diện → menu: hồ sơ, lịch đặt sân, danh sách chặn, đổi mật khẩu, đăng xuất]; bỏ icon thẻ hồ sơ và mục trùng.
- **Q5 — Footer.** A. Tối giản: tên + “© năm hiện tại”, bỏ 4 link chết / B. Bỏ footer khỏi trang trong app / C. Giữ link, chờ có trang nội dung.

## 7. Dự kiến file và kiểm thử

- Thay: `PlayerLayout`, `PlayerHeader`, `PlayerSidebar` (hoặc thanh tab dưới), `PlayerFooter`, `nav-tabs.ts`; thêm `components/common/skip-link.tsx` nếu cần; dọn `.player-*` trong `index.css` và phần liên quan trong `profile.css` sau khi kiểm consumer.
- Dùng: `DropdownMenu`, `Dialog`, `Badge`, lucide; đưa file shell vào `ui-check.config.json`.
- Kiểm thử mới `player-shell-ui.spec.ts`: điều hướng + tab đang chọn, số chưa đọc, menu tài khoản bàn phím (Enter/Escape), menu mobile, skip link, đăng xuất, responsive 390/768/1024/1280/1440 không tràn và không đè chữ; chạy lại toàn bộ test UI.

## 8. Quyết định của người dùng

| Câu | Quyết định (18/11/2026) |
| --- | --- |
| Q1 | 5 mục có chức năng: Sân cầu lông, Tìm đối thủ, Cộng đồng, Tin nhắn, Đánh giá; ẩn Trang chủ/Giải đấu tới khi có |
| Trang đích | Player đăng nhập xong, bấm logo và “Về trang của bạn” đều tới **`/feed`**; `/` chuyển hướng sang `/feed` (cập nhật Auth Tech Design) |
| Q2 | Ẩn chuông và chấm đỏ giả; panel thông báo là đợt riêng sau |
| Q3 | Mobile dùng thanh tab dưới đáy |
| Q4 | Gọn header: bỏ icon 💬 (số chưa đọc nằm ở mục “Tin nhắn”), bỏ icon thẻ hồ sơ, bỏ mục “Tin nhắn” trùng trong menu tài khoản. **Bong bóng chat giữ nguyên** (người dùng nhấn mạnh); chỉ đảm bảo không bị thanh tab che |
| Q5 | Footer tối giản: tên + © năm hiện tại, bỏ 4 link chết |

Quyết định trên đã được triển khai; trạng thái hiện tại theo [kế hoạch chính](../frontend-modernization-review-plan.md) §1. Không tự coi kiểm chứng xong là người dùng đã nghiệm thu.

## 9. Bàn giao — 19/11/2026

**AWAITING_REVIEW.** Giữ phạm vi người dùng đã chốt; không thêm tính năng.

- Đã có: header 5 mục, bottom nav dưới 1024 px, AccountMenu Radix dùng chung với Admin, footer gọn/skip link, Player home `/feed`; bỏ chuông/chấm đỏ giả và mục placeholder. Bong bóng chat giữ nguyên, nằm trên bottom nav; vẫn ẩn trên `/messages/*` như trước.
- Cleanup đã có trong working tree: bỏ PlayerSidebar và selector shell không còn consumer; không chuyển nội dung feed/profile/matchmaking/messages trong đợt này. Nơi dùng chung giữ theo ownership: Auth AccountMenu; Messaging unread hook; UI primitive/common.
- Build PASS; lint PASS (30 cảnh báo cũ), check:ui PASS (54 file); **86/86 test UI API mô phỏng PASS**, gồm 13 test shell. Các kết quả này đã được chạy trong lượt review ngay trước bàn giao; source frontend không đổi trong lượt hoàn tất tài liệu nên không chạy lặp.
- Đăng nhập thật bằng tài khoản mẫu đã tồn tại, đi tới `/feed`. Xem feed/profile/matchmaking/messages × 390/1280: 8/8 không tràn ngang, đủ 5 mục; menu bàn phím/Escape trả focus; bong bóng nằm trên bottom nav ở trang có dock. Phiên kiểm tra đã đăng xuất (204). Không seed/reset DB hoặc gửi thao tác nghiệp vụ.
- Ảnh để review: [1280](../evidence/SH01-after/shell-1280.png), [390](../evidence/SH01-after/shell-390.png). [Tóm tắt kiểm chứng thật](../evidence/SH01-after/verification-2026-11-19.json). Đã xem ảnh và so với khung trước ở `SH01-before`; các body vẫn legacy theo đợt riêng.
- Đã đồng bộ Auth Tech Design, route map/shell trong `frontend.md` và quy trình gọn trong plan/conventions/AGENTS. Source hiện có và việc xóa PlayerSidebar đã stage từ trước được giữ nguyên; chưa tự commit/push.

**Giới hạn:** feed và danh sách tin nhắn thật hiện rỗng; không mở conversation, tạo bài/kèo/booking, gửi tin hay thay hồ sơ. Harness cho API đọc đi qua backend thật, chặn mutation nghiệp vụ và heartbeat presence; chưa kiểm chứng realtime/presence. Nội dung các trang cũ và vị trí dock ngoài khoảng tránh bottom nav tiếp tục thuộc đợt tương ứng.

Các server kiểm tra riêng 5198/3000 đã được dừng sau khi kiểm tra; không dừng frontend cũ ở 5173 hoặc PostgreSQL.

**Điểm dừng:** chờ người dùng nghiệm thu SH01. D04 chưa bắt đầu.

**Cập nhật 19/11/2026:** người dùng xác nhận cho tiến hành các đợt tiếp theo sau bàn giao và nhắc lại phạm vi chỉ UI. Ghi nhận đợt này DONE để chuyển D04; các ngoại lệ hành vi đã có vẫn được giữ riêng trong kế hoạch/lịch sử, không mở rộng tiếp.
