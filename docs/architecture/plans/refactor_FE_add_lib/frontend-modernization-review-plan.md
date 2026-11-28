# Kế hoạch chuyển đổi frontend theo từng đợt

- Cập nhật: **20/11/2026**, nhánh `feat/frontend-ui-foundation`.
- Phạm vi: **chỉ thay giao diện**, dùng bộ thư viện đã thống nhất và dọn phần trình bày legacy theo consumer; **giữ nguyên logic và cách hoạt động hiện có**, theo nhắc lại của người dùng ngày 19/11/2026.
- **Hiện tại: 28/28 đợt chuyển UI đã đóng; cleanup bổ sung theo yêu cầu người dùng đã DONE (§6).** Không đồng nghĩa toàn bộ UI/legacy đã chuyển; các màn còn lại ở §4. Không push.
- Bản báo cáo cũ **983 dòng**, bao gồm §13–§22, được giữ nguyên tại [lịch sử](frontend-modernization-history.md). File này là nguồn trạng thái hiện tại.
- **Ủy quyền hiện tại:** phân tích → triển khai → cleanup → kiểm chứng → cập nhật tài liệu/trạng thái → commit bằng tiếng Anh, không trailer tác giả → làm đợt kế tiếp. Không tự push. Review tổng hợp sau khi hoàn tất phạm vi đã chốt; chỉ dừng hỏi khi có blocker/quyết định mới hoặc đổi hướng.

## 1. Trạng thái hiện tại

Có **29 mục**: **29 DONE** (D24 theo yêu cầu riêng của người dùng 27/11, chưa commit). Đây là số đợt, không phải số màn hình hay tỷ lệ hoàn thiện sản phẩm.

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
| D07 | DONE | Hồ sơ/ảnh/dialog công khai/liên hệ; 116 test UI và ghi thật trên DB test PASS; [bàn giao](reviews/D07-player-profile.md) |
| D08 | DONE | Feed/bộ lọc/thẻ bài/menu/xóa; 124 test UI + 24 Social và ghi thật trên DB test PASS; [bàn giao](reviews/D08-feed.md) |
| D09 | DONE | Chi tiết bài viết/bình luận/composer/reaction/lightbox; 130 test UI + 24 Social và luồng thật trên DB test PASS; [bàn giao](reviews/D09-post-detail.md) |
| D10 | DONE | Danh sách/tab/thẻ kèo/hủy; 136 test UI + 24 Social và luồng thật trên DB test PASS; [bàn giao](reviews/D10-matchmaking-list.md) |
| D11 | DONE | Chi tiết kèo/ứng tuyển/ứng viên/lời mời + ConfirmDialog; 146 test UI, 24 Social và luồng backend thật PASS; [bàn giao](reviews/D11-recruitment-detail.md) |
| D12 | DONE | Danh sách/chi tiết trận, roster GROUP và cảnh báo rời đã duyệt; 165 test UI + backend thật PASS; [bàn giao](reviews/D12-match-detail.md) |
| D13 | DONE | Modal/lịch sử/panel đánh giá, bảng chung và cleanup CSS; 40 test mục tiêu + backend thật PASS; [bàn giao](reviews/D13-ratings.md) |
| SH02 | DONE | Header/nav/mobile/chọn cơ sở/footer; 35 test mục tiêu + backend thật PASS; [bàn giao](reviews/SH02-owner-shell.md) |
| D14 | DONE | Cơ sở/sân/lịch sử, form dùng chung và cô lập CSS legacy; 35 test mục tiêu + backend thật PASS; [bàn giao](reviews/D14-owner-facilities.md) |
| D15 | DONE | Bảng giá/tạo-sửa, bộ chọn sân và bỏ legacy wrapper; 28 test mục tiêu + backend thật PASS; [bàn giao](reviews/D15-owner-pricing.md) |
| D16 | DONE | Lịch/bảo trì/lịch sử/drawer chi tiết; 54 test mục tiêu + backend thật PASS; [bàn giao](reviews/D16-owner-schedule.md) |
| D17 | DONE | Dashboard/account theo dữ liệu thật, hết wrapper Owner legacy; 26 test mục tiêu + backend thật PASS; [bàn giao](reviews/D17-owner-dashboard-account.md) |
| SH03 | DONE | Sidebar/header/tìm kiếm và layout dùng chung; 37 test mục tiêu + backend thật PASS; [bàn giao](reviews/SH03-admin-shell.md) |
| D18 | DONE | Bảng/filter/modal/toast, cleanup và kiểm chứng backend thật PASS; 12 test User + 25 Shell/Ratings PASS; [bàn giao](reviews/D18-user-management.md) |
| D19 | DONE | Bảng/form/modal/review và dọn adapter/CSS; 49 test + backend thật PASS; [bàn giao](reviews/D19-facility-management.md) |
| D20 | DONE | List/filter/modal/workspace, cleanup; 9 test + backend thật PASS; [bàn giao](reviews/D20-messaging-workspace.md) |
| D21 | DONE | Room/message/composer/media, cleanup; 18 test + backend/WebSocket thật PASS; [bàn giao](reviews/D21-conversation-room.md) |
| D22 | DONE | Dock/bubble/Motion, shared UI và cleanup; 24 test + backend/WS thật PASS; [bàn giao](reviews/D22-global-chat-dock.md) |
| D23 | DONE | Block/search/unblock và cleanup cuối; 6 test + backend thật PASS, kết quả tổng hợp/giới hạn ở §5; [bàn giao](reviews/D23-block-list.md) |
| D24 | DONE | Bố cục lại khu Chủ sân: chọn cơ sở ở header, tab/drawer, lịch có toolbar; E2E mô phỏng khu Owner PASS + dev chỉ đọc; chưa commit; [bàn giao](reviews/D24-owner-layout.md) |

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
5. Kiểm tra responsive ở **390/1280 px**; chỉ chụp khi cần xem trực quan. Lưu ảnh/kết quả chạy ngoài Git, không tạo bộ ảnh/JSON theo từng đợt; repo chỉ giữ hai minh họa dùng lâu dài (§2.5).

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

### 2.5 Repository gọn — yêu cầu người dùng 19/11/2026

- Chỉ commit source/asset ứng dụng, cấu hình cần thiết, test có thể chạy lại/fixture có chủ đích và tài liệu hữu ích. Không commit JSON kết quả, log, trace, raw report hoặc ảnh debug từng lần chạy.
- Output tạm để ở `/tmp`, `.local-artifacts/` đã ignore hoặc CI artifacts. Bàn giao chỉ ghi kết quả, môi trường và giới hạn ngắn gọn; không giảm chất lượng kiểm tra.
- Chỉ giữ [hai ảnh minh họa đại diện](examples/README.md) cho toàn bộ đợt chuyển đổi, thay ảnh khi cần thay vì tích lũy theo đợt. Không chụp ảnh theo quota.
- Đã dọn 92 artifact (71 ảnh/5 JSON/3 ghi chú trong evidence và 13 ảnh preview prototype), khoảng 14,55 MiB khỏi cây mã nguồn; giữ hai ảnh khoảng 0,29 MiB. Các nhận xét/quyết định/kết quả kiểm tra dạng văn bản được giữ. Không sửa code, test hoặc lịch sử commit trong lượt dọn này.

## 3. Các đợt vừa đóng và việc đang làm

- 27/11/2026: theo yêu cầu riêng, hoàn thiện trang hồ sơ cơ sở/sân dùng chung với approvals, bảng cuộn hai chiều và bỏ khối Hồ sơ sân ghép dưới bảng; [bàn giao](reviews/admin-shared-review-page.md).

- 27/11/2026: thu gọn tổng quan tài chính theo yêu cầu riêng của người dùng; bố cục 4 KPI, khối cần xử lý và chi tiết thu gọn; bổ sung điều chỉnh bảng xu hướng theo phê duyệt tiếp theo (ngày giảm dần, ẩn ngày tương lai trong tháng, tổng toàn kỳ, nhãn và căn phải cột tiền). Đã đồng bộ tên/email cho các bảng tài chính và bổ sung contract API theo yêu cầu tiếp theo; áp dụng mẫu Excel gọn đã duyệt cho 7 loại xuất Finance, kiểm chứng bằng workbook/API và bản in LibreOffice. Xem [bàn giao](reviews/finance-overview-density.md).

### 3.1 D03 — Tìm sân `/courts`

- Bổ sung theo yêu cầu 22/11: khung lọc theo prototype (thanh ba nhóm, Dialog/sheet ngày giờ, chip và xóa tất cả); 20/20 UI test, build/lint PASS; tìm kiếm backend thật chỉ đọc PASS. Chi tiết và giới hạn phiên mô phỏng ở [D03](reviews/D03-courts-search.md).

- Implementation/API đã commit: tìm theo cơ sở, 10 cơ sở/trang, URL giữ bộ lọc và trang; API `GET /api/v1/facilities` đã được duyệt. [Rà soát và quyết định](reviews/D03-courts-search.md); [bàn giao cũ §20](frontend-modernization-history.md).
- Kiểm tra thật 19/11: đăng nhập tài khoản mẫu có sẵn, backend/database local; **57 cơ sở, 6 trang, 10 thẻ ở trang 1 và 2**, không lặp cơ sở giữa hai trang, tên thẻ khớp API. Phân trang/reload giữ trang; lọc Hồ Chí Minh ra **56 cơ sở**, reload giữ bộ lọc. Sheet ngày/giờ mobile mở/đóng bằng Escape và trả focus.
- Ảnh/snapshot kiểm tra đã dọn theo §2.5; kết quả được giữ ở trên. Không sửa backend hoặc source D03 trong lượt bàn giao này.
- **DONE:** ghi nhận xác nhận cho chuyển tiếp của người dùng ngày 19/11/2026 sau bàn giao; không mở rộng các thay đổi ngoài UI đã ghi trong lịch sử.

### 3.2 SH01 — Player shell

- Đã dựng 5 mục điều hướng, bottom nav mobile, AccountMenu dùng chung, footer gọn, skip link; Player home `/feed`, `/` redirect `/feed`. Giữ bong bóng chat và khoảng tránh bottom nav; dock vẫn ẩn trên `/messages/*` theo hành vi cũ.
- Đã bỏ PlayerSidebar và selector shell không còn consumer. Nội dung các trang Player vẫn thuộc các đợt riêng. [Quyết định và bàn giao](reviews/SH01-player-shell.md); [tiến độ cũ §22](frontend-modernization-history.md).
- Kiểm chứng hiện tại: **build PASS; lint PASS với 30 warning cũ; check:ui 54 file PASS; toàn bộ 86 test UI API mô phỏng PASS**, trong đó 13 test shell. Không chạy lại các test này chỉ vì đổi tài liệu ở lượt này.
- Đã đăng nhập thật bằng tài khoản mẫu có sẵn; xem `/feed`, `/profile`, `/matchmaking`, `/messages` ở 390/1280: không tràn ngang, đủ 5 mục điều hướng; menu mở bằng bàn phím/Escape trả focus; bong bóng nằm trên bottom nav ở các trang có dock. Ảnh chạy tạm đã được dọn theo §2.5.
- Đã đồng bộ Auth Tech Design và `frontend.md` với `/feed`/shell. SH01 đã commit `1bf0e13` theo ủy quyền mới ngày 19/11/2026. Không push.
- **DONE:** người dùng cho chuyển tiếp ngày 19/11/2026 sau khi hoàn tất kiểm chứng/bàn giao; không thêm phạm vi SH01.

Giới hạn chung: kiểm tra thật dùng một tài khoản mẫu và dữ liệu hiện có (feed/tin nhắn đang rỗng); không tạo/sửa booking, bài viết hoặc tin nhắn. Chỉ tạo rồi đăng xuất phiên kiểm tra; heartbeat presence bị chặn trong harness để tránh đổi presence. Chưa nghiệm thu đầy đủ realtime, nghiệp vụ các trang legacy, Safari/Firefox hoặc WCAG. Kết quả backend suite 592 pass/5 fail trong lịch sử §20.6 chưa được chạy lại hoặc giải quyết trong lượt này.

### 3.3 D04 — Chi tiết sân/lưới giờ: DONE

- **`DONE`**: người dùng cho đóng và chuyển tiếp theo chế độ tuần tự 19/11; trước đó đã duyệt hướng và cho triển khai 19/11/2026; [rà soát, quyết định và bàn giao](reviews/D04-court-detail.md). Phạm vi `/courts/:courtId` + `AvailabilityGrid`; hai route chọn ngày/cơ sở vẫn giữ UI legacy, chỉ kiểm tra liên kết.
- Đã dựng hero xanh/vector, bộ chọn ngày/thời lượng, thẻ khoảng trống có dấu chọn, bảng tóm tắt cạnh lưới trên desktop/xếp dọc mobile. Dùng Tailwind, primitive shadcn/Radix hiện có, lucide và Motion 200 ms/tôn trọng reduced motion; Skeleton/EmptyState dùng chung. Tách rõ khoảng sân trống với giờ bắt đầu/thời lượng; CTA tránh bong bóng chat mặc định/bottom nav.
- Giữ state/default/options, điều kiện chọn/CTA, giá từ server, URL/matchId, hook/service/API và polling 8 giây/last-good. Không thêm thư viện hoặc đổi backend. Xóa inline UI cũ và `SyncIcon` hết consumer; giữ `StateBlocks`/`MatchBookingContext` cho các trang Booking khác. Không thêm CSS/override; 6 file chuyển đổi được thêm vào check:ui.
- Kiểm chứng: **build/lint PASS (30 warning cũ), check:ui 60 file PASS; toàn bộ 99 test UI PASS**, gồm 13 D04; chạy lại nhóm D04 sau tinh chỉnh vùng bấm/bố cục. Dữ liệu thật sân 1/cơ sở 1 ngày 20/11: chọn 06:00, thời lượng 60 phút, giá 80.000đ; đổi thời lượng bỏ lựa chọn, liên kết ngày/cơ sở và URL tiếp tục đúng, không tràn ngang/CTA bị che ở 390/1280. Xem [minh họa desktop D04](examples/court-detail-desktop.png); snapshot kiểm tra tạm đã được dọn theo §2.5.
- Giới hạn: dùng tài khoản mẫu có sẵn, không seed/reset; chỉ đi đến trang tóm tắt, không tạo hold/thanh toán/hủy. Loading/rỗng/lỗi/polling lỗi/reduced motion dùng API mô phỏng; chưa xác minh Safari/Firefox hoặc toàn bộ nghiệp vụ Booking. Commit theo từng đợt theo ủy quyền mới; không push.

## 4. Backlog và phần để sau

- Các đợt `NOT_STARTED` còn **0** mục, theo bảng §1; không triển khai đồng thời hoặc tự chèn đợt mới.
- UI `/courts/:courtId/date` và `/facilities/:facilityId` chưa chuyển trong phạm vi D04 thu gọn; cần chốt lịch chuyển sau, không coi là hoàn tất chỉ vì liên kết đã kiểm tra. Cách chọn giờ bắt đầu chỉ ở đầu khoảng trống là hành vi cũ; mở rộng cần yêu cầu riêng.
- Ngoài đợt hiện tại: panel thông báo; trang Điều khoản/Chính sách/Quy định; Trang chủ Player/Giải đấu quay lại điều hướng khi có trang thật; chuẩn hóa/tìm khu vực không dấu và API địa điểm.
- Register/khảo sát trình độ (`feat/skill-survey`), Wallet, Tournament, Admin dashboard/reports phải chốt riêng theo PRD/API và phạm vi MVP. Không triển khai chỉ vì có bản mẫu hoặc placeholder.
- Dialog hồ sơ công khai không trả focus về nút mở khi đóng (D07); giữ backlog theo phạm vi đã chốt. Hook modal legacy không còn consumer và đã được xóa ở D23.
- **Đã chốt 19/11/2026:** `e2e/matchmaking.spec.ts` lỗi 9/9 từ trước D10 (luồng ghép trận cũ). Trong D11 viết test mới cho luồng còn tồn tại (tìm/mời ứng viên, hộp thư lời mời, hồ sơ công khai từ thành viên/người mời) theo UI hiện tại, sau đó xóa `matchmaking.spec.ts` và `RequestFormModal.tsx`; phần rời trận chuyển D12.
- `Countdown` hiển thị phút tuyệt đối cho hạn xa (định dạng cũ).
- Admin global search giữ race response cũ và URL kết quả về trang danh sách; thay debounce/cancel/request hoặc mở sâu theo ID cần yêu cầu riêng. Nút thông báo chưa có panel.
- Owner booking detail: chưa có UI hủy booking và chưa trả focus khi đóng drawer (hiện trạng cũ, không tự thêm trong D16).
- Messaging: tìm Player chưa chống response cũ; giữ hành vi trong D20, cần scope logic riêng.
- Admin cơ sở: reason/note trong modal đình chỉ hiện bị page/service bỏ qua; không sửa propagation trong đợt UI D19.
- D12: API Match detail không ánh xạ sân ngoài vào facility/court; UI giữ fallback hiện hành. Sửa contract/mapping cần yêu cầu riêng.
- Rủi ro đã biết: warning bundle >500 kB; 29 lint warning hiện còn; backend suite lịch sử có 2 lỗi baseline và 3 migration timeout. Không mở rộng SH01 để sửa chúng.
- Hướng dẫn kiến trúc/token chính thức: [frontend.md](../../frontend.md), [conventions.md](../../conventions.md), [tech-stack.md](../../tech-stack.md). Lịch sử/code đã bàn giao: [báo cáo lưu trữ](frontend-modernization-history.md); các review ở `reviews/` và hai ảnh minh họa ở `examples/`.

### D05 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 71 file PASS; 106 test UI PASS. Summary kiểm tra dữ liệu dev; hold → Mock payment → confirmed → cancel trên backend thật/`badminton_test` riêng, không reset hoặc thay dữ liệu dev. Giữ nguyên phần điều phối, timer, giá và API. [Review/evidence](reviews/D05-booking-checkout.md). Tiếp theo D06, không push.

### D06 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 73 file PASS; 13 test mục tiêu PASS. Dữ liệu thật chỉ đọc trên dev và `badminton_test`. [Bàn giao](reviews/D06-booking-history.md).

### D07 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 83 file PASS; 116 test UI PASS. Dev chỉ đọc; lưu tên/số điện thoại và kiểm tra quyền riêng tư trên `badminton_test`, đã khôi phục giá trị. Xóa `profile.css` và asset hồ sơ. Dialog không trả focus khi đóng (giữ như cũ, ghi backlog). [Bàn giao](reviews/D07-player-profile.md). Tiếp theo D08, không push.

### D08 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 87 file PASS; 124 test UI + 24 test Social PASS (sửa fixture cũ thiếu `isOwner`). Dev/test chỉ đọc; đăng/thả cảm xúc/xóa bài trên `badminton_test`. Xóa 59 selector `social.css` hết consumer; file còn cho D09–D11. [Bàn giao](reviews/D08-feed.md). Tiếp theo D09, không push.

### D09 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 94 file PASS; 130 test UI + 24 test Social PASS. Dev chỉ đọc; trên `badminton_test` đăng bài có ảnh, lightbox, bình luận/xóa, sửa và xóa bài. Logic composer/bình luận/chi tiết không đổi (so diff). [Bàn giao](reviews/D09-post-detail.md). Tiếp theo D10, không push.

### D10 — đã đóng theo chế độ tuần tự

Build/lint/check:ui 97 file PASS; 136 test UI + 24 test Social PASS. Dev chỉ đọc; tạo/hủy kèo trên `badminton_test` rồi dọn. `StatusPill`/`Countdown` chuyển sang `MatchStatus.tsx`. Phát hiện `matchmaking.spec.ts` lỗi 9/9 từ trước — chờ quyết định. [Bàn giao](reviews/D10-matchmaking-list.md). Không push.

### D11 — DONE, 19/11/2026

Chi tiết kèo/ứng tuyển/ứng viên/lời mời và ConfirmDialog đã kiểm chứng; build/lint/check:ui 105 file PASS, 146 test UI + 24 Social PASS. Backend thật trên `badminton_test`: mời/chấp nhận, xin/duyệt, khóa trường, khai báo sân, chốt/hủy PASS; dev chỉ đọc. Đã dọn social.css/test/config/component legacy không dùng và sửa các điểm lệch UI tìm thấy khi self-review. [Bàn giao](reviews/D11-recruitment-detail.md). Tiếp theo rà soát D12, không push.

### D12 — đã đóng theo chế độ tuần tự

Danh sách/chi tiết trận dùng token và component chung; GROUP hiển thị đủ player theo server và cảnh báo rời đúng vai trò theo ngoại lệ đã duyệt. Build/lint/check:ui 111 file PASS; 165 test UI PASS, rerun 19 test D12 PASS. Dev chỉ đọc; trên DB test thật, thành viên GROUP rời giữ Match/mở lại kèo, chủ kèo rời hủy kèo. Xóa match-detail.css; giữ Ratings CSS đến D13. [Bàn giao](reviews/D12-match-detail.md). Không push.

### D13 — đã đóng theo chế độ tuần tự

Ratings chuyển sang Radix/token và bảng chung; xóa ratings.css, giữ adapter DataTable cho consumer legacy. Build/lint/check:ui 118 file PASS; 40 test Ratings/Match/Post detail PASS. Dev chỉ đọc; gửi/lưu/tải lại điểm và Admin đọc trên DB test thật PASS. Không đổi service/command/backend. [Bàn giao](reviews/D13-ratings.md). Tiếp theo SH02, không push.

### SH02 — đã đóng theo chế độ tuần tự

Khung Chủ sân mới giữ nguyên logic facilities/query/signOut; xóa logo và CSS shell cũ, giữ CSS nội dung cho D14–D17. Build/lint/check:ui 122 file PASS; 35 test mục tiêu PASS; dữ liệu Owner dev chỉ đọc 390/1280 PASS. [Bàn giao](reviews/SH02-owner-shell.md). Tiếp theo D14, không push.

### D14 — đã đóng theo chế độ tuần tự

Quản lý cơ sở/sân/lịch sử và form chung chuyển UI, giữ nguyên serialize/command/API; CSS legacy chỉ còn ở trang chưa chuyển và Admin review. Build/lint/check:ui 127 file PASS; 35 test mục tiêu PASS. Dev chỉ đọc 5 trang/390–1280; tạo/từ chối/sửa/gửi lại/duyệt cơ sở, tạo/sửa sân và đề xuất địa chỉ trên DB test thật PASS. [Bàn giao](reviews/D14-owner-facilities.md). Tiếp theo D15, không push.

### D15 — đã đóng theo chế độ tuần tự

Bảng giá, bộ chọn và form dùng component chung, bỏ wrapper legacy Pricing. Build/lint/check:ui 128 file PASS; 28 test mục tiêu PASS. Dev chỉ đọc; tạo/sửa giá và kiểm tra API lưu đúng trên DB test riêng PASS, không đổi logic. [Bàn giao](reviews/D15-owner-pricing.md). Tiếp theo D16, không push.

### D16 — đã đóng theo chế độ tuần tự

Lịch/phân trang/bảo trì và booking drawer dùng token/component chung; giữ phẳng/thứ tự/payload/polling. Build/lint/check:ui 133 file PASS; 54 test mục tiêu PASS. Dev chỉ đọc; block/unblock và Owner xem hold thật trên DB test PASS, hold test đã hủy. Xóa CSS hết consumer; ghi rõ hai giới hạn cũ. [Bàn giao](reviews/D16-owner-schedule.md). Tiếp theo D17, không push.

### D17 — đã đóng theo chế độ tuần tự

Dashboard/account dùng dữ liệu đang có, giữ đường dẫn/query/creation/logout; Owner không còn wrapper/CSS legacy, stylesheet còn lại chỉ ở Admin review đến D19. Build/lint/check:ui 135 file PASS; 26 test mục tiêu và dev chỉ đọc 390/1280 PASS. [Bàn giao](reviews/D17-owner-dashboard-account.md). Tiếp theo SH03, không push.

### SH03 — đã đóng theo chế độ tuần tự

Khung Admin và tìm kiếm chuyển token/component chung, state/request/route không đổi. Xóa CSS/style shell và icon hết consumer; nội dung User/Court vẫn thuộc D18–D19. Build/lint/check:ui 139 file PASS; 37 test mục tiêu và tìm kiếm backend dev chỉ đọc 390/1280 PASS. [Bàn giao](reviews/SH03-admin-shell.md). Tiếp theo D18, không push.

### D18 — đã đóng theo chế độ tuần tự

User Admin chuyển Radix/token, dùng shared filter/table và Sonner; command/API giữ nguyên. Build/lint/check:ui 155 file PASS; 12 test User/shared Court và 25 Shell/Ratings PASS. Tạo/status/password/soft-delete trên DB test thật và responsive 390/1280 PASS; không reset dev hay commit artifact. [Bàn giao](reviews/D18-user-management.md). Tiếp theo D19, không push.

### D19 — đã đóng theo chế độ tuần tự

Quản lý cơ sở/sân và duyệt hồ sơ chuyển UI; xóa adapter DataTable/FilterToolbar và owner.css hết consumer. Build/lint/check:ui 163 file PASS; 49 test mục tiêu PASS. Tạo/status/vô hiệu hóa, reject-resubmit-approve, duyệt sân/địa chỉ và responsive với backend/DB test thật PASS. [Bàn giao](reviews/D19-facility-management.md). Tiếp theo D20; không push.

### D20 — đã đóng theo chế độ tuần tự

Workspace/list/modal dùng token/Radix và feature UI chung, không đổi filter/search/command/socket. Build/lint/check:ui 167 file, 9 test UI và mở DIRECT/tạo GROUP thật trên DB test PASS; responsive 390/1280 không tràn. Xóa CSS riêng workspace, giữ Room/Dock/Blocks tới các đợt tiếp theo. [Bàn giao](reviews/D20-messaging-workspace.md). Tiếp theo D21.

### D21 — đã đóng theo chế độ tuần tự

Room/header/menu/composer/viewer chuyển Radix/token, tách presentation khỏi điều phối; 81 CSS rule hết consumer được xóa. Build/lint/check:ui 172 file, 18 test và trao đổi tin nhắn/media/group qua WebSocket thật trên DB test PASS. Mobile composer tránh bottom nav; giữ handlers/API/UUID/permissions, chỉ scroll animation tôn trọng reduced motion. [Bàn giao](reviews/D21-conversation-room.md). Tiếp theo D22.

### D22 — đã đóng theo chế độ tuần tự

Bubble/Dock dùng Motion/token, reuse list/modal/compact Room. Build/lint/check:ui 173 file, 24 test mục tiêu và luồng live unread/compact reply/drag/expand thật PASS. Hook, storage, timer 165 ms và API giữ nguyên; xóa 37 rule/7 keyframe hết consumer, CSS chỉ còn cho Blocks. [Bàn giao](reviews/D22-global-chat-dock.md). Tiếp theo D23.

### D23 — đã đóng theo chế độ tuần tự

Danh sách chặn dùng component chung; giữ nguyên 4 handler/loadBlocks, request và payload. Xóa messaging.css, Dialog/hook/CSS/icon hết consumer; frontend.md phản ánh kiến trúc hiện tại. Build/lint/check:ui 174 file PASS; 6 test Block và thao tác chặn/bỏ chặn qua backend thật PASS. Test Player shell chuyển từ class legacy sang role/label, vẫn kiểm tra bubble nằm trên bottom nav. [Bàn giao](reviews/D23-block-list.md). Không còn đợt trong danh sách chờ triển khai; xem §5.

## 5. Review tổng hợp — 20/11/2026

**Hoàn tất kỹ thuật 28/28 đợt đã chốt**, không đồng nghĩa toàn bộ sản phẩm đã chuyển UI hoặc đã được người dùng nghiệm thu thủ công. Lượt cuối hoàn thành D18–D23, mỗi đợt một commit tiếng Anh, không trailer tác giả; chưa push. Các thay đổi hành vi lịch sử D02/D03/SH01 và ngoại lệ hiển thị D12 được tách rõ ở §2.1/review tương ứng; không dùng chúng để mở rộng các đợt sau.

| Kết quả | Phạm vi và giới hạn |
| --- | --- |
| Admin D18–D19 | User, cơ sở/sân và duyệt hồ sơ dùng bảng/filter/dialog chung, token và Sonner; bỏ số liệu trang trí không có nguồn. Command, validation, quyền, phân trang và API giữ nguyên. |
| Messaging D20–D23 | Workspace, Room/media, Dock và Block list đồng bộ; list/filter/avatar/start dialog, message bubble/viewer được tái sử dụng. Giữ data hooks/service, UUID, read/typing, WebSocket, busy/permission, drag/storage và timer cũ. |
| Cleanup | Chỉ còn stylesheet index.css cho token/base và các consumer legacy ngoài phạm vi; đã xóa feature CSS, adapter bảng/filter và Dialog/hook/icon không dùng sau kiểm tra consumer. components/ui → common → feature có ranh giới trình bày rõ; không nhân đôi transport/logic. |
| Build/lint | npm run build và npm run lint PASS; check:ui 174 file, 1 stylesheet. Còn 29 lint warning và bundle >500 kB, chưa đổi logic hoặc cấu hình để che warning. |
| UI với API mô phỏng | Lượt tổng cuối, cấu hình gốc 1 worker/retries 0: **286/287 PASS**; ca workspace 390 bị trang trống, trace ghi 50 lỗi tải module net::ERR_NETWORK_CHANGED. Chạy riêng workspace sau đó **6/6 PASS**, không đổi assertion/app để vượt lỗi. Không tuyên bố có một lượt tổng 287/287 PASS. |
| Kiểm tra bổ sung | Social **24/24**, Auth **30/30**, Shell + Dock **19/19**, Block **6/6 PASS**. Một lượt thử 2 worker cũng có timeout khởi tạo trang Auth; nguyên nhân ca đó chưa kết luận. Các lượt riêng là kiểm tra bổ sung, không cộng thành một lượt tổng sạch. |
| Backend thật | D18–D23 kiểm tra thành công trên badminton_test riêng, qua API/UI thật; gồm quản trị, mở DIRECT/GROUP, trao đổi hai người qua WebSocket, reply/edit/reaction/recall/hide, media, group gate, Dock/unread và chặn/bỏ chặn. Kiểm tra 390/1280; phiên kiểm tra logout 204. Không reset/seed dev. Chi tiết từng đợt ở reviews/. |

Trong D18–D23 không thay backend, dependency, API service/data hook/socket hook hoặc payload/logic nghiệp vụ. Chỉ quote-scroll animation tôn trọng reduced motion; component trình bày và hook modal legacy hết dùng được dọn. Không chạy lại toàn bộ backend suite; các lỗi baseline lịch sử vẫn ở §4. Chưa bảo đảm đầy đủ Safari/Firefox, WCAG hoặc mọi tổ hợp realtime/permission.

**Repo bàn giao:** chỉ source/asset runtime, cấu hình, test/fixture được bảo trì và tài liệu; output kiểm tra ở /tmp, không commit JSON/log/trace/bộ ảnh. Hai minh họa examples/ hiện có được giữ nguyên. Những màn Register/khảo sát, hai route Booking legacy, placeholder và lỗi logic ở §4 cần phạm vi riêng; không tự bắt đầu chúng sau D23.

## 6. Cleanup code không sử dụng — yêu cầu người dùng 20/11/2026

- **DONE.** Review sau D23 phát hiện cleanup theo từng consumer chưa bao phủ hết module không được import. Đợt này được người dùng yêu cầu riêng; không thêm đợt UI hoặc đổi logic/route.
- Đã xóa `features/player/pages/PlayerHomePage.tsx`, `app/placeholder-pages.tsx` và `features/matchmaking/utils/requestFormValidation.ts`: không có consumer trong source/test/config. Giữ nguyên các placeholder có route thật và màn đăng ký/chọn ngày/chi tiết cơ sở đang chạy.
- Xóa `CheckShieldIcon`/`BellIcon` chỉ còn consumer ở home đã bỏ; `LoadingCards` và import Skeleton đi kèm; alias `DialogClose`; type `CreateFacilityPayload` (Admin) và `PageMeta` (Ratings) không có consumer. Không đổi các payload/type/service đang dùng.
- Xóa class `animate-fade-in` hết consumer; giữ `fadeIn` của auth-card, animation pulse, class tạo động `auth-alert-${variant}` và CSS của Register. Sửa ghi chú consumer legacy và frontend.md để khớp mã nguồn.
- Rà soát import bằng TypeScript module resolution từ main.tsx: sau cleanup **243/243 module** được kết nối; đối chiếu source/test/config, dynamic import/glob và export reference. Đây là kiểm tra tham chiếu tĩnh, không khẳng định mọi nhánh runtime hay mọi selector đều có thể xóa.
- Kiểm chứng: build/lint/check:ui PASS (174 file, 1 stylesheet); **56/56 test** Sign-in/Player shell/Court detail PASS với API mô phỏng. Đối chiếu AST xác nhận mọi khai báo được giữ trong 5 module chỉnh sửa không đổi. Còn 29 lint warning và cảnh báo bundle baseline. Không chạy lại full/backend suite; không có luồng nghiệp vụ hay giao diện đang chạy được sửa trong lượt xóa code không có consumer này. Output tạm ngoài Git; không sửa backend, dependency, API/data hooks hoặc reset database. Commit cleanup riêng bằng tiếng Anh, không push.

### Separately authorized finance fixes — 2026-11-22

User explicitly authorized correctness changes after the finance audit; this is separate from the closed UI-only batches. Scope: duplicate manual top-up prevention, split reconciliation, manual Owner recovery visibility, mutation-local errors, validated Dialog forms, immediate Owner history invalidation, Admin breadcrumbs/lazy loading and cleanup of shared controls/feature CSS consumers. Existing working-tree changes are preserved; no commit/push or payout-default change. Backend regression checks and frontend verification are recorded in the finance Tech Design and session handoff. Historical batch statuses remain unchanged.

Verification for the separately authorized follow-up: DONE — 36 backend tests, 108 mocked UI checks and 2 real-backend Finance flows pass. Frontend/backend builds, lint/check:ui (217 files; only index.css remains), migration consistency and git diff whitespace check pass. Existing lint/main-bundle warnings remain. Migration 0029 applied locally to dev/test; dev transaction data unchanged. Screenshots reviewed at 390/1280 px and kept under /tmp. No commit/push; shared schema/docs require teammate PR review before merge.

Uncommitted-change review (2026-11-22): fixed missing refund/earning-only Owner report rows, restored wallet input/select styling through shared primitives, and accepted transfer times with seconds. Added regression coverage and corrected four stale shell assertions against behavior already present in HEAD. Verification: 31 backend tests PASS; broad mocked UI run 138/142 PASS (four stale assertions), then all 10 focused regression/shell checks PASS at 390/1280 px. Backend/frontend builds, lint/check:ui, migration consistency and whitespace checks PASS; existing warnings remain. No full backend-suite rerun, commit, push or dev-data changes in this review.


### Admin configs — hoàn tất yêu cầu riêng 27/11/2026

Theo yêu cầu trực tiếp của người dùng, ẩn 4 cấu hình hết tác dụng (timeout thanh toán giải, rating trận giải, no-show grace, expiration bài tìm kèo legacy) và 4 tham số điều chỉnh trình độ từ đánh giá cũ; công tắc cũ tiếp tục ẩn. Đây là thay đổi khả năng hiển thị đã được duyệt riêng, không phải UI-only của các batch trước. Giữ các cấu hình `SKILL_RATING_*`, backend/API/dữ liệu; không migration và không thực hiện RT-10. Đã bỏ group/nhánh render riêng không còn dùng. Build và lint/check:ui PASS (còn cảnh báo hiện có); 12/12 Playwright cấu hình với API mô phỏng PASS, gồm desktop 1280 và mobile 390, kiểm tra ẩn legacy/giữ skill rating và tìm kiếm. Chưa kiểm chứng backend thật trong lượt này; chưa commit.


### Việt hóa cấu hình trình độ — 27/11/2026

Theo yêu cầu người dùng, đổi tên/mô tả 7 cấu hình `SKILL_RATING_*`, nhãn bật/tắt và đơn vị sang tiếng Việt; mô tả nhóm nêu rõ nguồn kết quả giải chuyên nghiệp. Chỉ đổi nội dung hiển thị, giữ giá trị/API/thuật toán. Lint/check:ui và 12/12 Playwright trang cấu hình PASS; test kiểm tra đủ 7 tên tiếng Việt. Chưa commit.


27/11/2026 — Chú thích cấu hình: bỏ giới hạn dòng ở card đơn và card nhóm để hiển thị đầy đủ mô tả dài, giữ nguyên nội dung và hành vi. Lint/check:ui PASS.
