# Rà soát giao diện chi tiết trận giao lưu

Ngày rà soát: 19/10/2026. Đề xuất giao diện đã được người dùng chấp thuận triển khai; xem kết quả và giới hạn ở phần cập nhật cuối tài liệu.

## Căn cứ

- Code: `frontend/src/features/matchmaking/pages/MatchDetailPage.tsx`, types/service Matchmaking, `backend/src/services/matchmaking/MatchService.ts` và Booking Detail.
- Quy tắc: Project Brief, Matchmaking PRD/Tech Design (đặc biệt §7.4 và §9.6–9.8), Ratings PRD/Tech Design; kiến trúc frontend.
- Figma đã đọc nội dung P23, P47, P67 và xem ảnh P23: [P23 — Match Detail](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-97013), [P47 — Leave Confirmation](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-64957), [P67 — Player Left](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-67861).
- Đây là rà soát mã nguồn và thiết kế; chưa kiểm tra trang thực tế bằng trình duyệt trong lần rà soát này.

## Kết luận hiện trạng

Trang `/matchmaking/matches/:matchId` vẫn là bố cục thô: heading, đoạn văn, danh sách người chơi và các nút. Đợt cập nhật Ratings chỉ cải thiện CTA và modal rating tại đây. Chưa có banner tổng quan, bố cục thẻ/cột, phân đội hoặc vùng hành động theo trạng thái như Figma.

Không nên sao chép P23 nguyên trạng. Thiết kế phù hợp về phân cấp thị giác nhưng chứa nhiều nội dung không thuộc MVP và chưa bao quát đầy đủ vòng đời hiện tại.

## Xung đột và phần dư

| Nội dung thiết kế | Vấn đề | Đề xuất |
| --- | --- | --- |
| Chia đều bốn slot, phần tiền mỗi người, ví SmashPay/thanh toán tại quầy | Split Bill và wallet ngoài MVP; chủ kèo thanh toán toàn bộ booking qua Booking | Thẻ chi phí ghi tổng tiền sân, người thanh toán; chỉ chủ kèo có link chi tiết booking. Không tự chia tiền. |
| Điểm kỹ năng 6.x, phần trăm cân bằng, xác suất thắng, ELO, winrate | Không có các trường/thuật toán này trong Match Detail; casual Match không ghi kết quả | Hiển thị tên và trình độ catalog; bỏ biểu đồ so sánh và kết quả giả. |
| Tự gửi yêu cầu đánh giá sau giờ đấu, xác thực tỷ số ba set | Rating không có event notification đã duyệt; casual không có luồng xác thực tỷ số | CTA rating khi server trả `COMPLETED`, dùng eligibility API và modal hiện có. |
| Đôi Nam | Model chỉ có `SINGLES`/`DOUBLES`, không có phân loại giới tính | Ghi Đấu đơn/Đấu đôi; không suy ra giới tính. |
| Check-in bằng mã trận, tủ đồ, cầu tài trợ, thảm BWF, parking và cổng đón tiếp | Không có contract/dữ liệu xác nhận | Bỏ nội dung hứa hẹn; dùng tên sân và địa chỉ thực tế. |
| Lịch Google/Apple, chia sẻ công khai, bản đồ nhúng, thời tiết, hotline mẫu | Chưa thuộc contract của tính năng; chi tiết trận là participant-only | Chưa thêm ở đợt đầu. Có thể sao chép mã trận cục bộ; không tạo public share hoặc điền hotline giả. |
| P47 bắt buộc lý do rời và checkbox cam kết | API leave không nhận lý do | Modal xác nhận nêu tác động, nút giữ trận/rời trận; không thêm trường bắt buộc mới. |
| P47/P67 điểm FairPlay, tiền phạt, hoàn 100% về ví trong 5–15 phút | Không có hệ thống điểm phạt; leave chỉ ghi việc yêu cầu hủy booking, hoàn tiền do Payment quản lý | Thông báo trận đã hủy và booking đang được xử lý theo policy. Chỉ hiển thị kết quả hoàn tiền thật từ Booking cho chủ kèo. |
| P47 tìm đồng đội thay thế, hỗ trợ đổi giờ; P67 mời riêng giữ sân | Thay thế tự động/reschedule ngoài MVP; rời làm hủy trận | Chỉ dẫn về danh sách hoặc tạo yêu cầu mới. Không hứa giữ lại sân/tiêu chí. |

## Phần thiếu trong thiết kế và code

| Khoảng trống | Hiện trạng | Ưu tiên |
| --- | --- | --- |
| Chờ chủ kèo đặt sân | P23 chỉ minh họa CONFIRMED; code có deadline và link tìm sân nhưng trình bày đơn giản | P1: banner chờ sân, deadline; chủ kèo có hành động đặt/liên kết, thành viên thấy hướng dẫn chờ. |
| Liên kết booking | Tech Design mô tả `POST /api/v1/matches/:id/booking`, nhưng kiểm tra triển khai ngày 19/10 cho thấy backend chưa có route này (MM-07/MM-19 BLOCKED vì Payment); frontend cũng chưa có client/call. Link tìm sân không mang context trận | P1 chức năng: nối booking đã thanh toán với trận, giữ context qua flow Booking. Có thể bắt đầu bằng chọn booking đã có của mình để liên kết; server kiểm tra toàn bộ điều kiện. |
| Ràng buộc chọn booking | Match Detail chưa trả đầy đủ preferred window/duration của request | Không tự lọc theo dữ liệu đoán. Tái sử dụng contract đã duyệt, map lỗi server; nếu cần thêm metadata để chọn thuận tiện, xử lý tại tài liệu/API sở hữu trước. |
| Đội hình | API có `teamNo`, tên, skill, trạng thái; code vẫn một danh sách | P1: hai thẻ Đội A/B từ teamNo server; badge Bạn từ auth ID, Đã rời từ status. Không tự xáo đội/cân bằng lại. |
| Chi tiết thanh toán | API có price/payer; booking ID chỉ trả cho owner | P1: tách thẻ rõ ràng, giá null là chưa có dữ liệu, giá 0 vẫn là 0. Không đoán tên payer nếu không tìm thấy trong danh sách. |
| Đang diễn ra/hoàn tất/đã hủy | Code xử lý nhưng chưa có phân cấp nội dung; Figma chính chỉ CONFIRMED | P1: một trang với biến thể theo năm trạng thái; nội dung và CTA theo server, không tạo route cho từng trạng thái. |
| Rời trận và cập nhật nền | Code hiển thị confirm inline; điều kiện chủ yếu theo status, có thể trễ giữa hai lần poll | P1: modal có focus trap, khóa gửi lặp, map lỗi `MATCH_ALREADY_STARTED`/`MATCH_NOT_LEAVABLE`, refresh sau xung đột. Không tự chuyển status bằng countdown. |
| Chủ kèo xử lý hủy/refund | Match Detail không có cancellation-job/refund payload; code mới dẫn sang booking | Tách trạng thái hủy trận và hoàn tiền. Chủ kèo xem booking để biết kết quả thật; không dựng timeline tiền từ Match status. |
| Loading/error/mobile | Code có trạng thái cơ bản; chưa có skeleton theo bố cục hoặc phân biệt lỗi refresh nền | P2: lỗi lần đầu là màn lỗi; lỗi polling giữ dữ liệu kèm cảnh báo cần cập nhật, không trình bày dữ liệu cũ như còn chắc chắn hợp lệ. Test thao tác đổi trạng thái đồng thời. |

## Bố cục đề xuất

Desktop: breadcrumb về Các trận của tôi; banner mã trận, thể thức, thời gian và trạng thái; bên dưới hai cột khoảng 2:1. Cột chính có Lịch & sân và Đội hình. Cột phụ có Chi phí & booking và Hành động. Mobile xếp một cột, đưa trạng thái/hành động cần xử lý lên trước.

- `PENDING_COURT`: “Nhóm đã đủ người — chờ đặt sân”; lịch dự kiến, hạn đặt sân; chủ kèo được đặt/liên kết, thành viên chờ; rời trước deadline theo server.
- `CONFIRMED`: lịch/sân đã chốt, đội hình, tổng chi phí; chủ kèo xem booking; rời trước giờ bắt đầu. Countdown chỉ thông tin.
- `IN_PROGRESS`: nhấn mạnh trận đang diễn ra; không rời hoặc đánh giá; giữ thông tin lịch/sân.
- `COMPLETED`: đưa rating lên vị trí hành động chính, hiển thị số người còn lại hoặc Xem đánh giá đã gửi; không hiển thị thắng/thua cho casual.
- `CANCELLED`: banner nguyên nhân, giữ lịch và thành viên để tra cứu; không rời/rating; chủ kèo có link booking nếu có; tạo yêu cầu mới là luồng mới.

Các phần có thể dùng API hiện tại: banner, lịch/sân/địa chỉ, hai đội, tổng tiền/payer, rating, xác nhận rời. Các phần phụ thuộc cần tách riêng: liên kết booking xuyên flow, metadata gốc để hỗ trợ lựa chọn booking và trạng thái hủy/refund chi tiết.

## Trình tự thực hiện đề xuất

1. Hoàn thiện P23 theo dữ liệu hiện có và năm trạng thái, giữ luồng Ratings mới; modal rời theo tinh thần P47 nhưng bỏ nội dung dư.
2. Hoàn thiện luồng chủ kèo liên kết booking đã thanh toán — đây là thiếu sót chức năng cần ưu tiên cùng đợt hoàn thiện Matchmaking, không chỉ sửa CSS.
3. Kiểm tra E2E owner/member, đơn/đôi, năm trạng thái, booking null/giá 0, rời sát giờ và polling conflict, rating pending/all-rated, mobile 360 px. Non-participant vẫn nhận 404; thành viên không được lộ booking ID.

Không thay đổi code, business rules hoặc Figma trong lần rà soát này.


## Cập nhật triển khai — 19/10/2026

- Đã hoàn thiện P23 theo dữ liệu hiện có: banner/mã trận có sao chép, lịch/sân/địa chỉ, hai đội từ `teamNo`, nhãn Bạn/Đã rời, tổng tiền và payer, booking link chỉ cho owner. Có năm trạng thái và giao diện 360 px/desktop.
- Rời trận dùng modal xác nhận có focus trap/khôi phục focus, khóa lặp và khóa đóng khi đang gửi, lỗi theo code và refresh khi có xung đột. Lỗi polling hiển thị cảnh báo dữ liệu cũ và vô hiệu hóa nút rời.
- Luồng rating mới được giữ lại cho `COMPLETED`; `CANCELLED` không có rating/rời trận. Không dựng điểm ELO/FairPlay, kết quả, chia tiền hoặc hoàn tiền giả.
- Luồng chọn sân → chọn ngày/giờ → summary → pending → booking detail giữ query `matchId` và có link quay lại trận; query chỉ là ngữ cảnh điều hướng, không cấp quyền hoặc tự liên kết booking.
- **Đính chính kết luận ban đầu:** endpoint liên kết booking chưa triển khai. `MatchCoreService.linkBooking` chỉ là thao tác ghi nội bộ, không phải API có xác thực/kiểm tra booking. MM-07/MM-19 còn BLOCKED bởi Booking Payment; MM-20 còn chờ xử lý hủy/refund. Không thêm một API thiếu validation hoặc dùng dữ liệu test để giả xác nhận thật.
- Payment chưa có module/cổng hoạt động: đợt này không thể xác nhận luồng thanh toán → liên kết trận thực tế. Không thay đổi trạng thái các task phụ thuộc này.

Kiểm chứng triển khai: build/lint hoàn thành (còn cảnh báo effect/bundle hiện hữu);
32 Playwright cases đã qua, gồm 11 case chi tiết trận/điều hướng Booking, 7 case
Matchmaking và 14 case Ratings (có 1 phiên đăng nhập/database thật). Đã xem ảnh
desktop và mobile 360 px. Không kiểm chứng luồng liên kết booking trả tiền vì
module/API phụ thuộc chưa tồn tại.
