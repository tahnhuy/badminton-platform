# Project Brief — Nền tảng số hóa hệ sinh thái cầu lông

## 1. Tổng quan

Tên đề tài:
Số hóa hệ sinh thái cầu lông

Bối cảnh:
Người chơi hiện tìm đối thủ, tuyển vãng lai và tìm nhóm qua các group Facebook/Zalo. Bài đăng dễ trôi, khó lọc theo khu vực, thời gian, trình độ và số slot; việc gom người, trao đổi và đặt sân bị tách rời.

Mục tiêu:
Xây dựng nền tảng kết nối cộng đồng cầu lông thông qua bảng tin gồm bài đăng tự do và bài tìm kèo có cấu trúc, tương tác reaction/comment, hồ sơ người chơi và nhắn tin cá nhân/nhóm, gắn với ba nghiệp vụ cốt lõi:
- Matchmaking
- Court Booking
- Tournament

## 2. System Roles

Hệ thống gồm 3 role:

- Player
- Court Owner
- Admin

Tournament Organizer không phải system role riêng.

Tournament Organizer là quyền theo ngữ cảnh của Player:
- Player tạo một tournament
- Player trở thành Organizer trong phạm vi tournament đó
- Quyền Organizer chỉ có hiệu lực đối với tournament mà Player tổ chức

## 3. Core Business Areas

### 3.1 Social Matchmaking

Player có thể:
- Đăng bài tự do để chia sẻ và trao đổi với cộng đồng cầu lông
- Thả / thay đổi / gỡ reaction và bình luận (comment) trên bài đăng tự do hoặc bài tìm kèo
- Đăng bài tìm đối thủ / tuyển vãng lai kèm thông tin kèo (thời gian, khu vực/sân, trình độ mong muốn, quy mô số slot và ghi chú kèo)
- Xem bảng tin chung và lọc bài theo các tiêu chí tìm kèo
- Xem chi tiết bài đăng và hồ sơ cầu lông của người chơi
- Xin tham gia kèo (Apply), hủy yêu cầu đang chờ; chủ kèo duyệt hoặc từ chối
- Chủ động tìm người chơi và gửi lời mời (Invite); người nhận chấp nhận hoặc từ chối
- Theo dõi bài của mình, yêu cầu tham gia, lời mời và danh sách thành viên của kèo
- Tham gia / rút khỏi kèo theo trạng thái và quy tắc nghiệp vụ
- Đánh giá trình độ và thái độ người chơi cùng kèo sau trận

Phạm vi MVP là **Social có bài đăng tự do, reaction/comment và bài tìm kèo kết hợp Apply/Invite hai chiều**:

- Bảng tin hỗ trợ hai loại bài: bài đăng tự do (phục vụ chia sẻ/thảo luận) và bài tìm kèo (có thêm thông tin Matchmaking, ghi chú thông tin kèo/chi phí dự kiến và quản lý slot).
- Cả hai loại bài hỗ trợ reaction và comment. Reaction/comment không làm phát sinh yêu cầu tham gia hoặc chiếm slot.
- Bài tìm kèo là phần mở rộng của nhu cầu Matchmaking; bài tự do không tự tạo nhóm chơi, Match hoặc booking.
- Người chơi đã đăng nhập có thể xem thông tin công khai của bài đang tuyển; thông tin quản lý và trao đổi riêng chỉ dành cho người có quyền.
- MVP hỗ trợ cả kèo đơn, đôi và kèo giao lưu / tuyển vãng lai theo số lượng slot cấu hình của kèo (giới hạn số lượng cụ thể do PRD và business rules quy định). Không hỗ trợ quản lý giải nội bộ nhóm/CLB phức tạp trong MVP.
- Apply và Invite dùng chung quy tắc nhận thành viên, tính slot (chỉ trừ slot khi đã được chấp nhận/duyệt), kiểm tra trùng lịch và tạo Match khi đủ người.
- Liên kết với Court Booking là tùy chọn: chủ kèo có thể tự khai báo địa điểm sân đã có ngoài hệ thống, hoặc gắn với booking đặt trên hệ thống (trước hay sau khi gom người) theo quy tắc nghiệp vụ.
- Hệ thống không tự động ghép người chơi và không tự tìm/chọn sân theo khoảng cách.

Hướng nghiệp vụ đã xác nhận ngày 2026-10-31 (chi tiết, giới hạn số và cách hiện thực thuộc business rules, PRD và Tech Design; trạng thái, schema và công nghệ chưa được chốt):

- Chủ kèo có thể chuẩn bị kèo trước khi công khai và mời người chơi trong giai đoạn này. Lời mời đang chờ không giữ slot; slot chỉ bị trừ khi người được mời đã chấp nhận. Kèo chưa công khai không nhận Apply và vẫn có thể đủ người chỉ bằng lời mời.
- Kèo đơn và kèo đôi khi đủ người tạo một Match theo đúng số người của loại kèo. Kèo giao lưu khi đủ điều kiện tạo một trận nhiều người không chia đội; những người tham gia cùng trận có thể đánh giá lẫn nhau.
- Điều kiện đủ người: kèo đơn/đôi cần đủ số slot; kèo giao lưu đủ khi kín slot hoặc khi chủ kèo chốt sớm sau khi đạt số người tối thiểu.
- Chỉ kèo giao lưu cho phép chủ kèo khai báo số người đi cùng chưa có tài khoản; kèo đơn/đôi cần đủ 2/4 người có tài khoản. Số này được trừ vào slot; những người này không là thành viên trận trên hệ thống và không đánh giá hoặc bị đánh giá.
- Sân của kèo có thể là sân ngoài hệ thống do chủ kèo tự khai báo (hiển thị là chưa được hệ thống xác minh), hoặc booking đã xác nhận của chủ kèo, được gắn trước hay sau khi gom người. Đến giờ bắt đầu mà kèo vẫn chưa có sân thì kèo bị hủy. Booking đã gắn bị hủy thì trận bị hủy.
- Rút kèo: trước khi đủ người, người rút giải phóng slot. Sau khi đủ người, với kèo đơn/đôi, một người rời làm trận bị hủy (giữ quy tắc hiện hành); với kèo giao lưu, slot được mở lại để tuyển người thay đến giờ bắt đầu, và trận chỉ diễn ra khi đạt số người tối thiểu. Chủ kèo rời thì kèo bị hủy, không chuyển quyền chủ kèo; khi chủ kèo chủ động hủy, chủ kèo chọn giữ booking hoặc yêu cầu hủy booking theo chính sách Booking. Kèo giao lưu không đạt số tối thiểu khi đến giờ thì bị hủy nhưng booking vẫn giữ nguyên, và chủ kèo được thông báo rõ booking vẫn còn hiệu lực.

Hồ sơ cầu lông hỗ trợ nhận diện và đánh giá bạn chơi: thông tin cá nhân, khu vực hoạt động, lối đánh, trình độ, thống kê và đánh giá kỹ năng/thái độ theo quyền công khai dữ liệu.

Trình độ người chơi gồm 2 giai đoạn: xếp hạng ban đầu qua bài khảo sát đánh giá năng lực 6 nhóm tiêu chí có trọng số (thang 0–100 điểm, có tính nền tảng/tần suất, kỹ thuật, bộ pháp, chiến thuật/thể lực, trừ điểm nghỉ > 6 tháng và quy tắc chặn trần chống khai khống) trong bước đăng ký tài khoản (làm một lần, không làm lại; tài khoản đã có giữ mức hiện tại), và tự động hiệu chỉnh dựa trên dữ liệu đánh giá sau các trận đấu thực tế.

### 3.2 Court Booking

Booking sân phải hoạt động theo hướng thời gian thực.

Player:
- Tìm sân
- Xem thông tin sân
- Xem giá
- Xem slot trống
- Chọn sân
- Chọn ngày / giờ
- Tạo booking
- Thanh toán / đặt cọc online khi xác nhận booking
- Hủy booking theo chính sách dành cho Player
- Xem lịch sử và booking sắp tới

Court Owner:
- Không duyệt từng booking theo flow thông thường
- Giám sát booking
- Điều chỉnh / xử lý khi có sự cố
- Có thể khóa slot
- Có thể hủy booking do sự cố / bảo trì phía sân
- Khi Owner hủy phải thông báo cho Player và xử lý hoàn tiền theo chính sách

### 3.3 Tournament

Player:
- Tìm kiếm tournament
- Xem chi tiết
- Đăng ký
- Hủy đăng ký
- Xem participant
- Theo dõi bracket
- Xem lịch thi đấu
- Xem kết quả

Organizer:
- Tạo tournament
- Chỉnh sửa / hủy tournament
- Thiết lập thể thức
- Thiết lập số lượng người
- Thiết lập thời gian / địa điểm
- Thiết lập phí
- Thiết lập hạn đăng ký
- Quản lý participant
- Bốc thăm
- Seed player
- Sinh bracket
- Quản lý trận đấu
- Cập nhật / xác nhận kết quả
- Chuyển người thắng sang vòng tiếp theo
- Hủy trận
- Kết thúc tournament
- Công bố kết quả
- Lưu lịch sử tournament

### 3.4 Messaging

Messaging là chức năng nhắn tin thời gian thực (real-time qua WebSocket) độc lập dành cho Player, gồm:

- Nhắn tin cá nhân (1-1) giữa hai Player, truy cập từ danh sách hội thoại, hồ sơ hoặc bài viết/kèo
- Nhắn tin nhóm (Group chat) độc lập: Player có thể tạo nhóm chat kèm danh sách thành viên, thêm thành viên vào nhóm và rời nhóm; không phụ thuộc cứng vào vòng đời của Matchmaking
- Gửi/nhận tin nhắn văn bản, hình ảnh và file đính kèm trong hội thoại cá nhân và hội thoại nhóm theo thời gian thực qua WebSocket kết hợp REST API
- Thả reaction trên từng tin nhắn
- Hiển thị trạng thái online và trạng thái đang nhập (typing indicator)
- Danh sách hội thoại, lịch sử tin nhắn, tin nhắn mới và số chưa đọc
- Hỗ trợ gọi lại API tạo nhóm kèm danh sách thành viên (`POST /api/v1/conversations/group`) khi giao diện Social/Matchmaking muốn thêm nút tạo nhanh nhóm chat cho thành viên của kèo
- Quản lý chặn người dùng (Block/Unblock) hai chiều

Messaging được thiết kế tách rời (decoupled) khỏi Matchmaking để hoạt động độc lập, không bị khóa `Read-only` sau 24 giờ khi trận kết thúc, giúp các nhóm chơi cầu lông duy trì liên lạc lâu dài qua nhiều buổi chơi.

Quyền đọc/gửi tin nhắn được kiểm tra theo thành viên hội thoại (`ACTIVE`). Tách biệt hoàn toàn thành viên hội thoại với trạng thái tham gia kèo/trận đấu.



## 4. Admin

Admin quản lý nền tảng:

- Người dùng
- Court Owner
- Sân / cơ sở
- Tournament
- Báo cáo / vi phạm
- Cấu hình hệ thống
- Dashboard thống kê tổng quan

Admin không tham gia nghiệp vụ chơi cầu lông.

## 5. Out of MVP

Các chức năng chưa triển khai trong MVP:

### Split Bill

Split Bill chưa thuộc MVP.

Đưa vào hướng phát triển sau khi hoàn thành các nghiệp vụ chính.

### Refund Management

Quản lý hoàn tiền độc lập phía Court Owner chưa cần triển khai như một module riêng trong MVP.

Tuy nhiên, flow hoàn tiền khi Court Owner hủy booking do sự cố vẫn phải được xử lý ở mức cần thiết cho booking.

### Super Admin

Chưa triển khai.

Có thể phát triển sau khi hệ thống cần phân cấp Admin và RBAC nâng cao.

### Match Rescheduling

Hoãn trận chưa triển khai trong MVP.

Lý do:
Việc re-schedule có thể ảnh hưởng dây chuyền đến lịch thi đấu và các vòng tiếp theo của bracket.

### Court Rating

Đánh giá cơ sở sân là nice-to-have, chưa thuộc MVP.

### System Content Management

Không thuộc phạm vi hiện tại.

Lưu ý: "System Content Management" dùng để chỉ việc quản lý nội dung hệ
thống (bài biên tập của nền tảng, banner, nội dung tĩnh...). Mục này không loại trừ bài đăng tự do, bài tìm kèo, reaction/comment do Player tạo trong Social. Việc Admin quản lý **cấu hình
hệ thống** (các giá trị `*_ENABLED`, timeout, ngưỡng... trong
`docs/business-rules-config-matrix.md` §8) là **nằm trong MVP** và không
bị loại bởi mục này.

### Social và Messaging nâng cao

Chưa thuộc MVP:
- Kết bạn/theo dõi, chia sẻ lại bài đăng (share/repost) và bảng tin đề xuất cá nhân hóa
- Nhóm/CLB đấu nhóm (Team vs Team) và hội nhóm cộng đồng cố định độc lập với kèo
- Gọi thoại/video

Ngày 2026-10-31, file đính kèm, reaction trên từng tin nhắn, trạng thái online và trạng thái đang nhập được chuyển vào phạm vi MVP Messaging (§3.4, §7).

Clarification approved by the human owner, 2026-11-01: “trao đổi trong nhóm” means a group explicitly created by a Player in Messaging, not automatically created or synchronized by recruitment. The optional create-group shortcut is deferred from the current Social delivery.

## 6. MVP Focus

MVP tập trung vào ba nghiệp vụ chính:

1. Social Matchmaking: bài đăng tự do, reaction/comment, đăng/tìm kèo, Apply/Invite hai chiều và hồ sơ cầu lông
2. Court Booking
3. Tournament

Messaging cá nhân và nhóm kèo nằm trong MVP, hỗ trợ văn bản, hình ảnh, file đính kèm, reaction tin nhắn, trạng thái online/đang nhập, lịch sử tin nhắn và trạng thái chưa đọc để kết nối và tổ chức kèo. Tournament vẫn giữ phạm vi tổ chức giải, bốc thăm và sinh bracket.

Luồng trải nghiệm chính: xem hồ sơ / tìm bài → xin tham gia hoặc nhận lời mời → trao đổi trong nhóm → đủ người tạo trận (và đặt sân trên hệ thống nếu cần) → đánh giá sau trận.

Các chức năng khác chỉ được đưa vào MVP nếu cần thiết để ba nghiệp vụ trên hoạt động hoàn chỉnh.

## 7. Confirmed Business Decisions

### Booking

Booking phải theo hướng real-time.

Flow chính:

Player
→ xem slot realtime
→ chọn slot
→ hệ thống giữ/xác nhận slot theo cơ chế realtime
→ booking được xác nhận

Court Owner đóng vai trò:
- giám sát
- quản lý slot
- điều chỉnh khi có sự cố

Không sử dụng mô hình:
Player → Pending → Owner approve/reject

### Split Bill

Không thuộc MVP.

Sẽ phát triển sau khi hoàn thành các nghiệp vụ chính.

### Social và Matchmaking

- Bài đăng tự do và bài tìm kèo đều nằm trong MVP, có reaction và comment.
- Bài tìm kèo hiển thị thêm ghi chú thông tin kèo / chi phí dự kiến (chỉ phục vụ minh bạch thông tin, không xử lý chia tiền thanh toán tự động).
- Trình độ người chơi gồm 2 giai đoạn: xếp hạng ban đầu qua khảo sát đánh giá năng lực trong bước đăng ký tài khoản, và tự động hiệu chỉnh dựa trên đánh giá sau các trận đấu thực tế (quyết định 2026-10-31).

MVP Matchmaking mở rộng từ invitation-only sang **Social Matchmaking với Apply/Invite hai chiều** theo yêu cầu cập nhật phạm vi ngày 2026-10-28:

- Chủ kèo đăng nhu cầu lên bảng tin; Player tìm kèo và xin tham gia để chủ kèo duyệt, hoặc nhận lời mời trực tiếp từ chủ kèo.
- Hỗ trợ cả kèo đơn, đôi và kèo giao lưu / tuyển vãng lai theo số lượng slot cấu hình của kèo; hệ thống không tự động ghép người hoặc chọn sân.
- Gộp chung luồng Invite và Apply: chỉ trừ slot của kèo khi thành viên đã được chấp nhận/duyệt và tạo Match khi đủ người theo quy tắc nghiệp vụ.
- Hỗ trợ liên kết tùy chọn với Court Booking: chủ kèo có thể tự có sân ngoài hệ thống, hoặc gắn với booking đặt qua hệ thống (trước hay sau khi gom người).
- Các quy tắc nghiệp vụ chi tiết về giới hạn số người, thời hạn, kiểm tra trùng lịch, rút kèo, điều kiện gắn booking, hủy trận và chấm điểm sau trận được quy định tại PRD và `docs/business-rules-config-matrix.md`.
- Ngày 2026-10-31 người dùng xác nhận hướng nghiệp vụ tại §3.1: giai đoạn chuẩn bị kèo trước khi công khai, kèo giao lưu tạo trận nhiều người không chia đội, chốt sớm kèo giao lưu theo số tối thiểu, người đi cùng ngoài hệ thống, sân tự khai báo hoặc booking gắn trước/sau, hủy kèo khi chưa có sân hoặc khi booking bị hủy, và quy tắc rút kèo theo loại kèo. Các lựa chọn này chưa xác nhận schema, trạng thái mới hoặc công nghệ.

Quyết định invitation-only ngày 2026-10-10 được thay thế về cơ chế khám phá và kết nối. Các quy tắc không bị thay đổi bởi phạm vi mới tiếp tục được giữ; PRD và business rules phải được cập nhật trước khi triển khai luồng mới.

### Messaging

- Chat cá nhân (1-1) và chat nhóm (Group chat) độc lập nằm trong phạm vi MVP, hoạt động real-time qua WebSocket (kết hợp REST API), hỗ trợ văn bản, hình ảnh, file đính kèm, reaction trên từng tin nhắn, trạng thái online/đang nhập, lịch sử hội thoại và số tin chưa đọc.
- Gọi thoại/video không thuộc MVP.
- Messaging hoạt động độc lập, không gắn cứng với vòng đời Matchmaking và không tự động khóa chỉ đọc sau 24 giờ; giao diện Social/Matchmaking khi cần có thể gọi trực tiếp API tạo nhóm kèm danh sách thành viên của Messaging.
- Cơ chế truyền tải real-time cho Messaging sử dụng WebSocket trên Node.js + React (xác thực qua session cookie hiện có), chi tiết kỹ thuật quy định tại `docs/architecture/tech-stack.md` và Messaging Tech Design.

### Kết quả chốt nghiệp vụ & thiết kế (2026-10-31)

Ngày 2026-10-31 người dùng đã chốt các quy tắc chi tiết về thời hạn Apply/Invite, sức chứa và số tối thiểu của kèo giao lưu, giới hạn bài đang mở, trùng lịch, quyền xem, xử lý booking khi chủ kèo hủy hoặc kèo thiếu người, sửa/xóa bài, reaction/comment, ảnh/file, vòng đời nhóm chat, chat cá nhân, chặn, báo cáo, kiểm duyệt, trạng thái online/đang nhập và thông báo. Quy tắc chi tiết nằm tại `docs/business-rules-config-matrix.md` §3.12–§3.14, §6, §7.

Cùng ngày người dùng duyệt thêm: bộ khảo sát 6 nhóm tiêu chí có trọng số (thang 0–100 điểm kèm quy tắc chặn trần chống khai khống; trình độ ban đầu là tự đánh giá, không phải chứng nhận), hiệu chỉnh trình độ theo lượt trận, các key cấu hình mới, giới hạn chống spam bài/comment/chat, quy tắc đổi sân, chi tiết trường hồ sơ và thời gian lưu bằng chứng báo cáo (matrix §1.2, §3.12–§3.14, §6, §8.8–§8.9). Ngày 2026-11-01 người dùng chốt tách Messaging thành module độc lập (hỗ trợ chat 1-1 và tạo nhóm chat độc lập, không khóa 24h) và dùng WebSocket cho real-time chat.

Sau đó người dùng duyệt thêm: sửa mô tả mức `AVERAGE_PLUS`/`GOOD` (thành tích giải không phải điều kiện xếp trình độ), thời lượng kèo giao lưu 60–180 phút (mặc định 90, thời gian kèo phải nằm trọn trong booking đã gắn), phạm vi giá trị của giới hạn bài tự do/comment và nhãn "Giao lưu" khi hiển thị loại trận.

Người dùng đã chốt tiếp thiết kế kỹ thuật (Phase 2, 2026-10-31): thứ tự khóa toàn cục, quyền và idempotency khi gửi lại, cursor đồng bộ reaction, hash payload tạo bài ban đầu, pin `yauzl@3.4.0`, job hủy booking theo request, và điều kiện kèo giao lưu phải có tối thiểu 1 thành viên có tài khoản trên hệ thống được duyệt (tức ≥ 2 tài khoản tính cả chủ kèo) mới tạo hoặc bắt đầu Match. Social/Messaging PRD và Tech Design, các phần mở rộng Tech Design liên quan và schema mục tiêu §13 trong `docs/architecture/database-schema.md` đã được duyệt `Ready`.

### Trạng thái đồng bộ tài liệu

Ngày 2026-10-31 (hoàn tất Phase 1 & Phase 2): Brief, `docs/business-rules-config-matrix.md`, các PRD/Tech Design/Tasks liên quan, `docs/architecture/database-schema.md` (§13), `docs/architecture/tech-stack.md`, `docs/architecture/conventions.md`, `docs/architecture/frontend.md` và tài liệu họp 2026-10-28 đã được cập nhật và duyệt `Ready` ở cấp tài liệu. Quy tắc mới thay thế các mô tả invitation-only cũ được chỉ rõ trong từng PRD và Tech Design.

Đây là phê duyệt tài liệu, không phải xác nhận code hay database migration đã triển khai. Các task chỉ chuyển sang `Approved` khi không còn dependency thực thi; phần tích hợp booking/payment vẫn chờ blocker đã ghi (`MM-19`/`MM-20`/`BK-15`). Thay đổi tài liệu dùng chung và schema cần được review qua PR theo `docs/documentation-guide.md` §10.1 trước khi merge.

## 8. Technology Stack

Hệ thống sử dụng PERN Stack:

- Database: PostgreSQL
- Backend: Node.js + Express.js
- Frontend: React

Đây là technology stack đã được nhóm lựa chọn cho dự án.





