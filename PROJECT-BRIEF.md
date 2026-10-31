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
- MVP hỗ trợ cả kèo đơn, đôi và kèo giao lưu / tuyển vãng lai theo số lượng slot cấu hình của kèo (giới hạn số lượng cụ thể do PRD và business rules quy định). Không hỗ trợ nhóm/CLB đấu nhóm hoặc hội nhóm cộng đồng cố định độc lập với kèo.
- Apply và Invite dùng chung quy tắc nhận thành viên, tính slot (chỉ trừ slot khi đã được chấp nhận/duyệt), kiểm tra trùng lịch và tạo Match khi đủ người.
- Liên kết với Court Booking là tùy chọn: chủ kèo có thể tự khai báo địa điểm sân đã có ngoài hệ thống, hoặc gắn với booking đặt trên hệ thống (trước hay sau khi gom người) theo quy tắc nghiệp vụ.
- Hệ thống không tự động ghép người chơi và không tự tìm/chọn sân theo khoảng cách.

Hướng nghiệp vụ đã xác nhận ngày 2026-10-31 (chi tiết, giới hạn số và cách hiện thực thuộc business rules, PRD và Tech Design; trạng thái, schema và công nghệ chưa được chốt):

- Chủ kèo có thể chuẩn bị kèo trước khi công khai và mời người chơi trong giai đoạn này. Lời mời đang chờ không giữ slot; slot chỉ bị trừ khi người được mời đã chấp nhận. Kèo chưa công khai không nhận Apply và vẫn có thể đủ người chỉ bằng lời mời.
- Kèo đơn và kèo đôi khi đủ người tạo một Match theo đúng số người của loại kèo. Kèo giao lưu khi đủ điều kiện tạo một trận nhiều người không chia đội; những người tham gia cùng trận có thể đánh giá lẫn nhau.
- Điều kiện đủ người: kèo đơn/đôi cần đủ số slot; kèo giao lưu đủ khi kín slot hoặc khi chủ kèo chốt sớm sau khi đạt số người tối thiểu.
- Chỉ kèo giao lưu cho phép chủ kèo khai báo số người đi cùng chưa có tài khoản; kèo đơn/đôi cần đủ 2/4 người có tài khoản. Số này được trừ vào slot; những người này không là thành viên trận, không vào nhóm chat và không đánh giá hoặc bị đánh giá.
- Sân của kèo có thể là sân ngoài hệ thống do chủ kèo tự khai báo (hiển thị là chưa được hệ thống xác minh), hoặc booking đã xác nhận của chủ kèo, được gắn trước hay sau khi gom người. Đến giờ bắt đầu mà kèo vẫn chưa có sân thì kèo bị hủy. Booking đã gắn bị hủy thì trận bị hủy.
- Rút kèo: trước khi đủ người, người rút giải phóng slot. Sau khi đủ người, với kèo đơn/đôi, một người rời làm trận bị hủy (giữ quy tắc hiện hành); với kèo giao lưu, slot được mở lại để tuyển người thay đến giờ bắt đầu, và trận chỉ diễn ra khi đạt số người tối thiểu. Chủ kèo rời thì kèo bị hủy, không chuyển quyền chủ kèo; khi chủ kèo chủ động hủy, chủ kèo chọn giữ booking hoặc yêu cầu hủy booking theo chính sách Booking. Kèo giao lưu không đạt số tối thiểu khi đến giờ thì bị hủy nhưng booking vẫn giữ nguyên, và chủ kèo được thông báo rõ booking vẫn còn hiệu lực.

Hồ sơ cầu lông hỗ trợ nhận diện và đánh giá bạn chơi: thông tin cá nhân, khu vực hoạt động, lối đánh, trình độ, thống kê và đánh giá kỹ năng/thái độ theo quyền công khai dữ liệu.

Trình độ người chơi gồm 2 giai đoạn: xếp hạng ban đầu qua khảo sát đánh giá năng lực trong bước đăng ký tài khoản (thay cho việc tự chọn trực tiếp một mức trình độ; làm một lần, không làm lại; tài khoản đã có giữ mức hiện tại), và tự động hiệu chỉnh dựa trên dữ liệu đánh giá sau các trận đấu thực tế.

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
- Gửi/nhận tin nhắn văn bản, hình ảnh và file đính kèm trong hội thoại cá nhân và nhóm kèo
- Thả reaction trên từng tin nhắn
- Hiển thị trạng thái online và trạng thái đang nhập (typing indicator)
- Danh sách hội thoại, lịch sử tin nhắn, tin nhắn mới và số chưa đọc
- Mở nhóm chat liên quan từ chi tiết kèo hoặc trận đấu
- Đồng bộ thành viên nhóm chat với thành viên đã xác nhận của kèo; người chỉ đang chờ duyệt chưa có quyền vào nhóm

Nhóm chat phục vụ trao đổi trong quá trình gom người và tiếp tục được sử dụng khi kèo đã tạo Match. Thời điểm tạo nhóm, quyền xem lịch sử khi vào/rời nhóm và vòng đời hội thoại được chốt trong PRD Messaging.

Nhóm chat cho trao đổi thêm 24 giờ kể từ khi trận hoàn tất hoặc kèo bị hủy/hết hạn, sau đó chuyển chỉ đọc. Đóng tuyển khi đủ người hoặc chốt sớm không bắt đầu thời gian này.

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
- Nhóm/CLB đấu nhóm (Team vs Team) và hội nhóm cộng đồng cố định độc lập với kèo
- Gọi thoại/video

Ngày 2026-10-31, file đính kèm, reaction trên từng tin nhắn, trạng thái online và trạng thái đang nhập được chuyển vào phạm vi MVP Messaging (§3.4, §7).

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

- Chat cá nhân và nhóm kèo nằm trong phạm vi MVP, hỗ trợ văn bản, hình ảnh, file đính kèm, reaction trên từng tin nhắn, trạng thái online/đang nhập, lịch sử hội thoại và số tin chưa đọc (mở rộng ngày 2026-10-31 theo xác nhận của người dùng).
- Gọi thoại/video không thuộc MVP.
- Nhóm kèo chỉ dành cho chủ kèo và người đã được chấp nhận; người đi cùng chưa có tài khoản không thuộc nhóm chat; quyền hội thoại phải đồng bộ với nghiệp vụ thành viên.
- Chưa lựa chọn thêm công nghệ realtime, thư viện hoặc hạ tầng mới trong Brief. Trạng thái online/đang nhập và file đính kèm có thể đòi hỏi thay đổi `docs/architecture/tech-stack.md` (hiện chỉ xác nhận HTTP polling và lưu file cục bộ); quyết định kỹ thuật thuộc Tech Design và `tech-stack.md`, cần được duyệt riêng.

### Kết quả chốt nghiệp vụ Phase 1

Ngày 2026-10-31 người dùng đã chốt các quy tắc chi tiết về thời hạn Apply/Invite, sức chứa và số tối thiểu của kèo giao lưu, giới hạn bài đang mở, trùng lịch, quyền xem, xử lý booking khi chủ kèo hủy hoặc kèo thiếu người, sửa/xóa bài, reaction/comment, ảnh/file, vòng đời nhóm chat, chat cá nhân, chặn, báo cáo, kiểm duyệt, trạng thái online/đang nhập và thông báo. Quy tắc chi tiết nằm tại `docs/business-rules-config-matrix.md` §3.12–§3.14, §6, §7.

Cùng ngày người dùng duyệt thêm: bộ khảo sát 6 câu và bảng quy đổi (trình độ ban đầu là tự đánh giá, không phải chứng nhận), hiệu chỉnh trình độ theo lượt trận, các key cấu hình mới, giới hạn chống spam bài/comment/chat, quy tắc đổi sân, chi tiết trường hồ sơ và thời gian lưu bằng chứng báo cáo (matrix §1.2, §3.12–§3.14, §6, §8.8–§8.9).

Sau đó người dùng duyệt thêm: sửa mô tả mức `AVERAGE_PLUS`/`GOOD` (thành tích giải không phải điều kiện xếp trình độ), thời lượng kèo giao lưu 60–180 phút (mặc định 90, thời gian kèo phải nằm trọn trong booking đã gắn), phạm vi giá trị của giới hạn bài tự do/comment và nhãn "Giao lưu" khi hiển thị loại trận.

Không còn quyết định nghiệp vụ nào đang chờ trong giai đoạn 1. Schema, API, trạng thái, công nghệ realtime, cách lưu cấu hình và kế hoạch chuyển đổi thuộc Tech Design và tài liệu kiến trúc ở bước sau.

### Trạng thái đồng bộ tài liệu

Ngày 2026-10-31 (giai đoạn 1 rà soát tài liệu): Brief, business rules, các PRD bị ảnh hưởng, `docs/architecture/frontend.md` và tài liệu họp 2026-10-28 được bổ sung hướng nghiệp vụ đã xác nhận. Người dùng đã duyệt phần nghiệp vụ mở rộng Phase 1 là `Ready` sau rà soát cùng ngày. Quy tắc mới thay thế các mô tả cũ được chỉ rõ trong từng PRD; đây không phải xác nhận đã triển khai. Schema, Tech Design, Tasks, `tech-stack.md` và code chưa được cập nhật.

Bản cập nhật ngày 2026-10-28 chỉ điều chỉnh Brief theo yêu cầu của người dùng. Business rules, PRD/Tech Design/Tasks liên quan, schema và tài liệu kiến trúc chưa được cập nhật trong bước này; các mô tả invitation-only tại đó chưa phản ánh phạm vi mới. Không dùng Brief này thay thế đặc tả chi tiết để triển khai. Thay đổi tài liệu dùng chung cần được review qua PR theo `docs/documentation-guide.md` §10.1 trước khi merge.

## 8. Technology Stack

Hệ thống sử dụng PERN Stack:

- Database: PostgreSQL
- Backend: Node.js + Express.js
- Frontend: React

Đây là technology stack đã được nhóm lựa chọn cho dự án.


### Phase 2 — duyệt thiết kế ngày 2026-10-31

Người dùng đã chốt các sửa đổi cuối về thứ tự khóa, quyền và idempotency khi gửi lại, cursor đồng bộ reaction, hash payload tạo bài ban đầu, pin `yauzl@3.4.0` và job hủy booking theo request. Social/Messaging PRD và Tech Design, các phần mở rộng Tech Design liên quan và schema mục tiêu §13 được duyệt Ready. Đây là phê duyệt tài liệu, không phải xác nhận code/migration đã triển khai. Tasks chỉ Approved khi không còn dependency thực thi; phần booking/payment vẫn theo blocker đã ghi. Figma không thuộc lần duyệt Phase 2; các route mới còn đề xuất trong frontend.md không được tự coi là đã duyệt.
