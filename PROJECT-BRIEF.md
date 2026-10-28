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
- Đăng bài tìm đối thủ / tuyển người chơi với tiêu đề, mô tả, ngày giờ, khu vực và khoảng trình độ mong muốn
- Xem bảng tin chung và lọc theo khu vực, ngày giờ, trình độ, loại trận đơn/đôi và slot còn thiếu
- Xem chi tiết bài đăng và hồ sơ cầu lông của người chơi
- Xin tham gia kèo (Apply), hủy yêu cầu đang chờ; chủ kèo duyệt hoặc từ chối
- Chủ động tìm người chơi và gửi lời mời (Invite); người nhận chấp nhận hoặc từ chối
- Mời một người chơi khác trước khi đăng bài tìm kèo; bài công khai hiển thị số slot còn nhận sau khi tính chủ kèo và slot dành cho người được mời
- Theo dõi bài của mình, yêu cầu tham gia, lời mời và thành viên nhóm
- Tham gia / rút khỏi nhóm theo trạng thái kèo và quy tắc nghiệp vụ
- Đánh giá trình độ và thái độ đối thủ sau trận

Phạm vi MVP là **Social có bài đăng tự do, reaction/comment và bài tìm kèo kết hợp Apply/Invite hai chiều**:

- Bảng tin hỗ trợ hai loại bài: bài đăng tự do và bài tìm kèo. Bài tự do phục vụ chia sẻ/thảo luận; bài tìm kèo có thêm thông tin Matchmaking và quản lý slot.
- Cả hai loại bài hỗ trợ reaction và comment. Reaction/comment không làm phát sinh yêu cầu tham gia hoặc chiếm slot.
- Bài tìm kèo là phần mở rộng của nhu cầu Matchmaking; bài tự do không tự tạo nhóm chơi, Match hoặc booking.
- Chủ kèo có thể mời một người trước khi đăng. Ví dụ kèo đôi có tổng 4 slot: chủ kèo + slot dành cho A được mời trước → khi công khai chỉ nhận thêm 2 người. Slot dành cho lời mời chưa được chấp nhận không được coi là thành viên đã xác nhận hoặc dùng để tạo Match; cách giữ/giải phóng slot được chốt trong PRD.
- Người chơi đã đăng nhập có thể xem thông tin công khai của bài đang tuyển; thông tin quản lý và trao đổi riêng chỉ dành cho người có quyền.
- MVP gom từng cá nhân thành trận đơn (2 người) hoặc đôi (4 người), bao gồm chủ kèo. Không hỗ trợ nhóm đấu nhóm hoặc buổi chơi có số người tùy ý.
- Apply và Invite dùng chung quy tắc nhận thành viên, tính slot, kiểm tra trùng lịch và tạo trận; không được nhận trùng người hoặc vượt số lượng.
- Khi đủ người, hệ thống tạo Match; chủ kèo tự chọn sân và tạo booking qua Court Booking.
- Hệ thống không tự động ghép người chơi và không tự tìm/chọn sân theo khoảng cách.
- Bài hết hạn, bị hủy hoặc đã đủ người không tiếp tục hiển thị là đang tuyển. Chi tiết thời hạn được xác định trong PRD và business rules.

Hồ sơ cầu lông hỗ trợ nhận diện và đánh giá bạn chơi: tên, avatar, giới thiệu ngắn, khu vực hoạt động, lối đánh, trình độ, thống kê và đánh giá kỹ năng/thái độ theo quyền công khai dữ liệu.

Dữ liệu đánh giá sau trận được sử dụng làm input để hệ thống điều chỉnh trình độ người chơi tự động.

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

Messaging là chức năng hỗ trợ kết nối và tổ chức kèo của Player, gồm:

- Nhắn tin cá nhân giữa hai Player, truy cập từ hồ sơ hoặc bài tìm kèo
- Nhắn tin nhóm gắn với kèo cho chủ kèo và những người đã được chấp nhận qua Apply/Invite
- Gửi/nhận tin nhắn văn bản, ảnh và file trong hội thoại cá nhân và nhóm kèo
- Thả / thay đổi / gỡ reaction trên tin nhắn
- Hiển thị trạng thái online và đang nhập
- Danh sách hội thoại, lịch sử tin nhắn, tin nhắn mới và số chưa đọc
- Mở nhóm chat liên quan từ chi tiết kèo hoặc trận đấu
- Đồng bộ thành viên nhóm chat với thành viên kèo; người chỉ đang chờ duyệt chưa có quyền vào nhóm

Nhóm chat phục vụ trao đổi trong quá trình gom người và tiếp tục được sử dụng khi kèo đã tạo Match. Thời điểm tạo nhóm, quyền xem lịch sử khi vào/rời nhóm và vòng đời hội thoại được chốt trong PRD Messaging.

Quyền đọc/gửi tin nhắn phải được kiểm tra theo thành viên hội thoại. Rời hội thoại không đồng nghĩa với rút khỏi kèo hoặc hủy trận.

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
- Nhóm đấu nhóm, buổi chơi tuyển số người tùy ý và nhóm cộng đồng độc lập với kèo
- Gọi thoại/video

## 6. MVP Focus

MVP tập trung vào ba nghiệp vụ chính:

1. Social Matchmaking: bài đăng tự do, reaction/comment, đăng/tìm kèo, mời trước khi đăng, Apply/Invite và hồ sơ cầu lông
2. Court Booking
3. Tournament

Messaging cá nhân và nhóm kèo nằm trong MVP, hỗ trợ văn bản, ảnh/file, reaction, trạng thái online và đang nhập để kết nối và tổ chức kèo. Tournament vẫn giữ phạm vi tổ chức giải, bốc thăm và sinh bracket.

Luồng trải nghiệm chính: xem hồ sơ / tìm bài → xin tham gia hoặc nhận lời mời → trao đổi trong nhóm → đủ người tạo trận → đặt sân → đánh giá sau trận.

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
- Chủ kèo được mời một người trước khi đăng; kèo 4 slot gồm chủ kèo và slot dành cho người được mời trước chỉ nhận thêm 2 người từ bài công khai. Chỉ thành viên đã xác nhận mới được tính để tạo Match.

MVP Matchmaking mở rộng từ invitation-only sang **Social Matchmaking với Apply/Invite hai chiều** theo yêu cầu cập nhật phạm vi ngày 2026-10-28:

- Chủ kèo đăng nhu cầu lên bảng tin; Player tìm kèo và xin tham gia để chủ kèo duyệt, hoặc nhận lời mời trực tiếp từ chủ kèo.
- Giữ mô hình trận đơn/đôi 2/4 cá nhân; hệ thống không tự động ghép người hoặc chọn sân.
- Tìm Player theo tên/trình độ; người được mời không cần đang hoạt động hoặc có request. Phản hồi vẫn phải qua đăng nhập và phân quyền.
- Chủ kèo và người đã được nhận giữ khung giờ; thành viên được rút trước khi đủ nhóm. Người được nhận qua hai luồng chịu cùng quy tắc giữ lịch, rút nhóm và tạo Match khi đủ người.
- Khi bài hết hạn trước khi đủ người, đóng các yêu cầu/lời mời đang chờ và giải phóng người đã nhận; không tự động tạo nhóm thay thế.
- Chủ kèo chọn booking cùng ngày, trong khung giờ và đúng duration của kèo; khu vực là gợi ý, sân ngoài khu vực được phép.
- Chưa có sân vào giờ bắt đầu dự kiến thì hủy Match. Rút khỏi Match xử lý hủy trận/booking theo policy; booking bị hủy cũng hủy Match. Refund thuộc Payment.

Quyết định invitation-only ngày 2026-10-10 được thay thế về cơ chế khám phá và kết nối. Các quy tắc không bị thay đổi bởi phạm vi mới tiếp tục được giữ; PRD và business rules phải được cập nhật trước khi triển khai luồng mới.

### Messaging

- Chat cá nhân và nhóm kèo nằm trong phạm vi MVP, hỗ trợ văn bản, gửi ảnh/file, reaction trên tin nhắn, trạng thái online và đang nhập, lịch sử và chưa đọc.
- Gọi thoại/video không thuộc MVP.
- Nhóm kèo chỉ dành cho chủ kèo và người đã được chấp nhận; quyền hội thoại phải đồng bộ với nghiệp vụ thành viên.
- Chưa lựa chọn thêm công nghệ realtime, thư viện hoặc hạ tầng mới trong Brief. Quyết định kỹ thuật thuộc Tech Design và `docs/architecture/tech-stack.md`.

### Các quyết định cần chốt trong tài liệu chi tiết

- [TBD] Thời hạn tuyển của bài tìm kèo, Apply và Invite; quyền sửa/xóa bài, comment và các loại reaction. Bài tự do không áp dụng thời hạn tuyển của kèo.
- [TBD] Luồng mời trước khi đăng: tạo/lưu kèo trước khi công khai, thời điểm gửi lời mời và công khai, thời hạn giữ slot, xử lý khi người được mời từ chối/hết hạn/rút hoặc chủ kèo bỏ đăng; kiểm tra trùng lịch khi xác nhận.
- [TBD] Loại file, dung lượng, quyền tải ảnh/file và chính sách lưu trữ; quy tắc hiển thị online/đang nhập.
- [TBD] Thời điểm tạo nhóm chat, quyền đọc lịch sử khi vào/rời nhóm và trạng thái chat khi kèo hết hạn, hủy hoặc trận kết thúc.
- [TBD] Chính sách bắt đầu chat cá nhân, chặn người dùng và báo cáo bài đăng/tin nhắn.

### Trạng thái đồng bộ tài liệu

Bản cập nhật ngày 2026-10-28 chỉ điều chỉnh Brief theo yêu cầu của người dùng. Business rules, PRD/Tech Design/Tasks liên quan, schema và tài liệu kiến trúc chưa được cập nhật trong bước này; các mô tả invitation-only tại đó chưa phản ánh phạm vi mới. Không dùng Brief này thay thế đặc tả chi tiết để triển khai. Thay đổi tài liệu dùng chung cần được review qua PR theo `docs/documentation-guide.md` §10.1 trước khi merge.

## 8. Technology Stack

Hệ thống sử dụng PERN Stack:

- Database: PostgreSQL
- Backend: Node.js + Express.js
- Frontend: React

Đây là technology stack đã được nhóm lựa chọn cho dự án.
