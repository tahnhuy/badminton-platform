# Kế hoạch chuyển đổi frontend theo từng đợt

- Cập nhật: **19/11/2026**, nhánh `feat/frontend-ui-foundation`.
- Phạm vi: **chỉ thay giao diện**, dùng bộ thư viện đã thống nhất và dọn phần trình bày legacy theo consumer; **giữ nguyên logic và cách hoạt động hiện có**, theo nhắc lại của người dùng ngày 19/11/2026.
- **Hiện tại: D06 DONE; tiếp theo D07.** Thực hiện tuần tự theo ủy quyền 19/11/2026: phân tích, UI/cleanup, kiểm chứng, tài liệu và commit từng đợt; chỉ dừng hỏi khi có vấn đề cần quyết định/đổi hướng. Không push.
- Bản báo cáo cũ **983 dòng**, bao gồm §13–§22, được giữ nguyên tại [lịch sử](frontend-modernization-history.md). File này là nguồn trạng thái hiện tại.
- **Ủy quyền hiện tại:** phân tích → triển khai → cleanup → kiểm chứng → cập nhật tài liệu/trạng thái → commit bằng tiếng Anh, không trailer tác giả → làm đợt kế tiếp. Không tự push. Review tổng hợp sau khi hoàn tất phạm vi đã chốt; chỉ dừng hỏi khi có blocker/quyết định mới hoặc đổi hướng.

## 1. Trạng thái hiện tại

Có **28 mục**: **9 DONE, 19 NOT_STARTED**. Đây là số đợt, không phải số màn hình hay tỷ lệ hoàn thiện sản phẩm.

| Đợt | Trạng thái | Nội dung / bước còn lại |
| --- | --- | --- |
| D00 | DONE | Thư viện, cấu hình và tài liệu nền |
| D01 | DONE | Trang đăng nhập |
| D02 | DONE | Đổi mật khẩu, không đủ quyền, chờ phiên, menu tài khoản Admin |
| D03 | DONE | Đã bàn giao/kiểm tra thật; người dùng cho chuyển tiếp 19/11; xem §3.1 |
| DS01 | DONE | Token, thang chữ/bo góc, mẫu trang và check:ui |
| SH01 | DONE | Đã bàn giao/kiểm chứng; người dùng cho chuyển tiếp 19/11; xem §3.2 |
| D04 | DONE | Đã triển khai/kiểm chứng; người dùng cho đóng và tiếp tục tuần tự 19/11; [bàn giao](reviews/D04-court-detail.md) |
| D05 | DONE | Summary/pending/detail + dialog/status UI; 106 test UI và luồng thật trên DB test PASS; [bàn giao](reviews/D05-booking-checkout.md) |
| D06 | DONE | Lịch sử/filter/card/pager; 13 test mục tiêu và dữ liệu thật PASS; [bàn giao](reviews/D06-booking-history.md) |
| D07 | NOT_STARTED | Hồ sơ và contact |
| D08 | NOT_STARTED | Feed |
| D09 | NOT_STARTED | Chi tiết bài viết, comment/reaction, composer theo consumer |
| D10 | NOT_STARTED | Danh sách và tạo yêu cầu tìm kèo |
| D11 | NOT_STARTED | Request detail, Apply/Invite, lời mời |
| D12 | NOT_STARTED | Danh sách và chi tiết trận |
| D13 | NOT_STARTED | Đánh giá hiện có |
| SH02 | NOT_STARTED | Owner shell, dự kiến trước D14 |
| D14 | NOT_STARTED | Quản lý cơ sở của chủ sân |
| D15 | NOT_STARTED | Giá sân |
| D16 | NOT_STARTED | Lịch chủ sân và chi tiết booking |
| D17 | NOT_STARTED | Dashboard/account chủ sân có dữ liệu thật |
| SH03 | NOT_STARTED | Admin shell, dự kiến trước D18 |
| D18 | NOT_STARTED | Quản lý người dùng Admin |
| D19 | NOT_STARTED | Quản lý sân và duyệt cơ sở |
| D20 | NOT_STARTED | Danh sách/workspace tin nhắn |
| D21 | NOT_STARTED | ConversationRoomPane |
| D22 | NOT_STARTED | GlobalChatDock |
| D23 | NOT_STARTED | Danh sách chặn |

Trạng thái hiện tại: `NOT_STARTED` → `UX_REVIEW` → `IN_PROGRESS` → `DONE` sau kiểm chứng/tài liệu/commit. `AWAITING_DIRECTION`/`BLOCKED` chỉ khi có quyết định hoặc blocker cần người dùng. `DONE` trong chế độ thực hiện tuần tự là hoàn tất kỹ thuật theo ủy quyền; không giả nhận đã có review thủ công từng đợt. Người dùng review tổng hợp cuối cùng.

## 2. Cách thực hiện — chốt 19/11/2026

### 2.1 Khóa phạm vi

- **Chỉ UI:** được đổi bố cục, màu/chữ/khoảng cách, responsive, icon, chuyển động và component trình bày. Tách component/hook trình bày dùng chung phải giữ nguyên tác dụng của các thao tác.
- **Giữ hành vi trước/sau:** không đổi bước/thứ tự luồng, validation/giá trị mặc định, điều kiện hiển thị hoặc cho phép thao tác, URL đích/redirect, quyền, phiên đăng nhập, quy tắc phân nhóm/lọc/sắp xếp/phân trang, tính giá hoặc trạng thái nghiệp vụ. Không bỏ lối vào chức năng đang có chỉ để làm giao diện gọn.
- Giữ service/API và cách lấy dữ liệu hiện có; không đổi backend, contract, thời điểm/tần suất request, retry/cache/realtime hoặc chuyển data layer chỉ vì đang áp dụng thư viện UI. Phát hiện lỗi logic thì ghi backlog; chỉ sửa theo yêu cầu riêng được người dùng chốt.
- Mỗi đợt chọn một trang hoặc một luồng nhỏ có thể nghiệm thu. Đọc trước luồng liên quan để tránh làm lại, nhưng chỉ sửa phần đã chốt.
- Không tự chèn đợt nền mới. D00/DS01 đã có; component dùng chung được bổ sung theo nhu cầu của đợt hiện tại.
- Phát hiện ngoài phạm vi đưa vào §4; không tiện tay sửa. Blocker trực tiếp phải được nêu rõ tác động để chốt phạm vi.
- Không tự thay API/backend, nghiệp vụ, permission hoặc thêm thư viện. Các ngoại lệ đã được duyệt trước đây (như API phân trang cơ sở D03) được ghi trong lịch sử.

**Phân biệt với lịch sử:** các thay đổi đã có trước lời nhắc này gồm D02 đăng xuất sau đổi mật khẩu, D03 API/phân trang theo cơ sở và SH01 trang đích Player `/feed`/thay các mục điều hướng. Đây là thay đổi hành vi, không gọi là chỉnh UI thuần. Giữ dấu vết trong lịch sử và nêu riêng khi review; lời nhắc hiện tại không tự nghiệm thu các phần còn chờ duyệt và không phải lệnh hoàn tác chúng. Không áp dụng các ngoại lệ đó cho đợt tiếp theo.

### 2.2 Quy trình và báo cáo gọn

1. Rà soát UI và hành vi hiện có: PRD/Tech Design, code/test, dữ liệu; ghi nhận ngắn từ góc độ người dùng và thiết kế.
2. Chốt trước: **trang được sửa, hành vi/API giữ nguyên, phần dùng chung/legacy cần xử lý, tiêu chí hoàn thành**. Chỉ hỏi tối đa 3 vấn đề cần quyết định; câu hỏi không cần thiết thì tự xử lý trong phạm vi đã duyệt.
3. Ghi phân tích/hướng triển khai vào `reviews/<đợt>-*.md`, làm theo phạm vi và hướng đã chốt. Theo ủy quyền mới, không chờ duyệt thường lệ; hỏi khi có quyết định chưa rõ hoặc cần đổi hướng/phạm vi.
4. Triển khai → dọn code/CSS → kiểm chứng theo tác động → cập nhật trạng thái/bàn giao ngắn → commit riêng → tự làm đợt kế tiếp. Review tổng hợp cuối cùng. Báo cáo mới khoảng một trang, đủ phần đã đổi/xóa/giữ, test, giới hạn và bước tiếp theo.
5. Ảnh mặc định **390/1280 px**; thêm kích thước chỉ khi có lý do xác minh breakpoint. Không chụp thêm ảnh chỉ để đủ hồ sơ.

### 2.3 Cleanup và kiến trúc dùng chung

- Thay implementation cũ của phần đã chuyển; xóa import, component, hook, selector và asset không còn consumer. Kiểm tra cả class ghép động, media query và pseudo selector trước khi xóa.
- Không giữ hai implementation cùng trang hoặc thêm selector/`!important` để vá chồng legacy. UI mới dùng Tailwind, semantic token/thang thiết kế DS01; không thêm rule vào `@layer legacy`.
- Primitive shadcn/Radix ở `components/ui/`; UI composed dùng chung ở `components/common/`; hook/utility thật sự tái sử dụng ở `shared/hooks/`, `shared/utils/`; phần riêng ở `features/<capability>/`.
- Feature giữ validation, API/query và điều phối của mình. Không đưa nghiệp vụ/transport vào component trình bày; dùng `shared/api/http-client.ts` để giữ cookie/CSRF/error handling.
- Chỉ dọn trong consumer của đợt. Legacy của trang chưa chuyển vẫn giữ; liệt kê consumer trong bàn giao. Register, các trang Booking/Social/Messaging chưa chuyển không được coi là đã xong chỉ vì shell/token mới.
- DS01 và cấu hình `frontend/ui-check.config.json` áp dụng cho file đã chuyển. Không tạo ngoại lệ check:ui thiếu lý do; không chuyển tài nguyên riêng vào Query trước khi có cache/session safeguards phù hợp.

### 2.4 Kiểm chứng đủ theo tác động

- API mô phỏng: loading, error, empty, validation và tình huống khó tái hiện. Backend/dữ liệu thật: luồng thành công, hình dạng dữ liệu, phân trang/lọc/liên kết. Ghi rõ phần nào dùng loại nào.
- Trước bàn giao cần xem phần đã đổi với backend thật; không seed/reset database dev chỉ để kiểm tra. Nếu môi trường/tài khoản chưa sẵn sàng, ghi giới hạn và chưa tuyên bố đã kiểm chứng luồng thật.
- Test theo trang bị đổi; khi sửa shell, primitive, token hoặc provider thì kiểm tra các consumer bị ảnh hưởng. Không lặp full suite sau thay đổi chỉ ở tài liệu; chạy lại khi source đổi, có lỗi hoặc có nghi ngại chưa giải quyết.
- Build/lint/check:ui cần qua; phân biệt warning baseline. Không sửa assertion để hợp thức hóa mất chức năng. Kiểm tra bàn phím, focus, nhãn/lỗi, reduced motion và responsive 390/1280 px.
- Hoàn thành bàn giao khi có: đúng luồng đã chốt, cleanup/consumer rõ, kết quả kiểm chứng thực, tài liệu đồng bộ. Trong chế độ tuần tự, ghi `DONE` sau khi kiểm chứng/tài liệu/commit đầy đủ và phân biệt với review thủ công cuối cùng của người dùng.
- Bàn giao phải xác nhận hành vi trước/sau không đổi; nếu có tác động logic ngoài UI thì nêu riêng và chưa coi phần đó thuộc phạm vi đã được phép. Test hồi quy giữ các điều kiện nghiệp vụ cũ, không đổi assertion để hợp thức hóa hành vi mới.

## 3. Các đợt vừa đóng và việc đang làm

### 3.1 D03 — Tìm sân `/courts`

- Implementation/API đã commit: tìm theo cơ sở, 10 cơ sở/trang, URL giữ bộ lọc và trang; API `GET /api/v1/facilities` đã được duyệt. [Rà soát và quyết định](reviews/D03-courts-search.md); [bàn giao cũ §20](frontend-modernization-history.md).
- Kiểm tra thật 19/11: đăng nhập tài khoản mẫu có sẵn, backend/database local; **57 cơ sở, 6 trang, 10 thẻ ở trang 1 và 2**, không lặp cơ sở giữa hai trang, tên thẻ khớp API. Phân trang/reload giữ trang; lọc Hồ Chí Minh ra **56 cơ sở**, reload giữ bộ lọc. Sheet ngày/giờ mobile mở/đóng bằng Escape và trả focus.
- Ảnh: [1280](evidence/D03-after/real-2026-11-19-1280.png), [390](evidence/D03-after/real-2026-11-19-390.png). Không sửa backend hoặc source D03 trong lượt bàn giao này.
- **DONE:** ghi nhận xác nhận cho chuyển tiếp của người dùng ngày 19/11/2026 sau bàn giao; không mở rộng các thay đổi ngoài UI đã ghi trong lịch sử.

### 3.2 SH01 — Player shell

- Đã dựng 5 mục điều hướng, bottom nav mobile, AccountMenu dùng chung, footer gọn, skip link; Player home `/feed`, `/` redirect `/feed`. Giữ bong bóng chat và khoảng tránh bottom nav; dock vẫn ẩn trên `/messages/*` theo hành vi cũ.
- Đã bỏ PlayerSidebar và selector shell không còn consumer. Nội dung các trang Player vẫn thuộc các đợt riêng. [Quyết định và bàn giao](reviews/SH01-player-shell.md); [tiến độ cũ §22](frontend-modernization-history.md).
- Kiểm chứng hiện tại: **build PASS; lint PASS với 30 warning cũ; check:ui 54 file PASS; toàn bộ 86 test UI API mô phỏng PASS**, trong đó 13 test shell. Không chạy lại các test này chỉ vì đổi tài liệu ở lượt này.
- Đã đăng nhập thật bằng tài khoản mẫu có sẵn; xem `/feed`, `/profile`, `/matchmaking`, `/messages` ở 390/1280: không tràn ngang, đủ 5 mục điều hướng; menu mở bằng bàn phím/Escape trả focus; bong bóng nằm trên bottom nav ở các trang có dock. [Ảnh 1280](evidence/SH01-after/shell-1280.png), [ảnh 390](evidence/SH01-after/shell-390.png).
- Đã đồng bộ Auth Tech Design và `frontend.md` với `/feed`/shell. SH01 đã commit `1bf0e13` theo ủy quyền mới ngày 19/11/2026. Không push.
- **DONE:** người dùng cho chuyển tiếp ngày 19/11/2026 sau khi hoàn tất kiểm chứng/bàn giao; không thêm phạm vi SH01.

Giới hạn chung: kiểm tra thật dùng một tài khoản mẫu và dữ liệu hiện có (feed/tin nhắn đang rỗng); không tạo/sửa booking, bài viết hoặc tin nhắn. Chỉ tạo rồi đăng xuất phiên kiểm tra; heartbeat presence bị chặn trong harness để tránh đổi presence. Chưa nghiệm thu đầy đủ realtime, nghiệp vụ các trang legacy, Safari/Firefox hoặc WCAG. Kết quả backend suite 592 pass/5 fail trong lịch sử §20.6 chưa được chạy lại hoặc giải quyết trong lượt này.

### 3.3 D04 — Chi tiết sân/lưới giờ: DONE

- **`DONE`**: người dùng cho đóng và chuyển tiếp theo chế độ tuần tự 19/11; trước đó đã duyệt hướng và cho triển khai 19/11/2026; [rà soát, quyết định và bàn giao](reviews/D04-court-detail.md). Phạm vi `/courts/:courtId` + `AvailabilityGrid`; hai route chọn ngày/cơ sở vẫn giữ UI legacy, chỉ kiểm tra liên kết.
- Đã dựng hero xanh/vector, bộ chọn ngày/thời lượng, thẻ khoảng trống có dấu chọn, bảng tóm tắt cạnh lưới trên desktop/xếp dọc mobile. Dùng Tailwind, primitive shadcn/Radix hiện có, lucide và Motion 200 ms/tôn trọng reduced motion; Skeleton/EmptyState dùng chung. Tách rõ khoảng sân trống với giờ bắt đầu/thời lượng; CTA tránh bong bóng chat mặc định/bottom nav.
- Giữ state/default/options, điều kiện chọn/CTA, giá từ server, URL/matchId, hook/service/API và polling 8 giây/last-good. Không thêm thư viện hoặc đổi backend. Xóa inline UI cũ và `SyncIcon` hết consumer; giữ `StateBlocks`/`MatchBookingContext` cho các trang Booking khác. Không thêm CSS/override; 6 file chuyển đổi được thêm vào check:ui.
- Kiểm chứng: **build/lint PASS (30 warning cũ), check:ui 60 file PASS; toàn bộ 99 test UI PASS**, gồm 13 D04; chạy lại nhóm D04 sau tinh chỉnh vùng bấm/bố cục. Dữ liệu thật sân 1/cơ sở 1 ngày 20/11: chọn 06:00, thời lượng 60 phút, giá 80.000đ; đổi thời lượng bỏ lựa chọn, liên kết ngày/cơ sở và URL tiếp tục đúng, không tràn ngang/CTA bị che ở 390/1280. [Ảnh desktop](evidence/D04-after/selected-1280.png), [ảnh lựa chọn mobile](evidence/D04-after/selected-390.png), [số đo](evidence/D04-after/verification.json).
- Giới hạn: dùng tài khoản mẫu có sẵn, không seed/reset; chỉ đi đến trang tóm tắt, không tạo hold/thanh toán/hủy. Loading/rỗng/lỗi/polling lỗi/reduced motion dùng API mô phỏng; chưa xác minh Safari/Firefox hoặc toàn bộ nghiệp vụ Booking. Commit theo từng đợt theo ủy quyền mới; không push.
- **Tiếp theo sau nghiệm thu:** rà soát D05 (summary → pending → detail), đề xuất bố cục và phần trình bày dùng chung; giữ toàn bộ tính giá/giữ chỗ/thanh toán/timer/trạng thái/API. Phân tích và triển khai D05 theo ủy quyền tuần tự, giữ phạm vi riêng và commit riêng.

## 4. Backlog và phần để sau

- Các đợt `NOT_STARTED` còn **19** mục, theo bảng §1; không triển khai đồng thời hoặc tự chèn đợt mới.
- UI `/courts/:courtId/date` và `/facilities/:facilityId` chưa chuyển trong phạm vi D04 thu gọn; cần chốt lịch chuyển sau, không coi là hoàn tất chỉ vì liên kết đã kiểm tra. Cách chọn giờ bắt đầu chỉ ở đầu khoảng trống là hành vi cũ; mở rộng cần yêu cầu riêng.
- Ngoài đợt hiện tại: panel thông báo; trang Điều khoản/Chính sách/Quy định; Trang chủ Player/Giải đấu quay lại điều hướng khi có trang thật; chuẩn hóa/tìm khu vực không dấu và API địa điểm.
- Register/khảo sát trình độ (`feat/skill-survey`), Wallet, Tournament, Admin dashboard/reports phải chốt riêng theo PRD/API và phạm vi MVP. Không triển khai chỉ vì có bản mẫu hoặc placeholder.
- Rủi ro đã biết: warning bundle >500 kB; 30 lint warning ở code legacy; backend suite lịch sử có 2 lỗi baseline và 3 migration timeout. Không mở rộng SH01 để sửa chúng.
- Hướng dẫn kiến trúc/token chính thức: [frontend.md](../../frontend.md), [conventions.md](../../conventions.md), [tech-stack.md](../../tech-stack.md). Lịch sử/code đã bàn giao: [báo cáo lưu trữ](frontend-modernization-history.md); các review ở `reviews/` và ảnh ở `evidence/`.

### D05 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 71 file PASS; 106 test UI PASS. Summary kiểm tra dữ liệu dev; hold → Mock payment → confirmed → cancel trên backend thật/`badminton_test` riêng, không reset hoặc thay dữ liệu dev. Giữ nguyên phần điều phối, timer, giá và API. [Review/evidence](reviews/D05-booking-checkout.md). Tiếp theo D06, không push.
