# Project Brief — Nền tảng số hóa hệ sinh thái cầu lông

## 1. Tổng quan

Tên đề tài:
Số hóa hệ sinh thái cầu lông (Badminton Ecosystem Digital Platform)

Bối cảnh:
Người chơi hiện tìm đối thủ, tuyển vãng lai và tìm nhóm qua các group Facebook/Zalo. Bài đăng dễ trôi, khó lọc theo khu vực, thời gian, trình độ và số slot; việc gom người, trao đổi và đặt sân bị tách rời.

Mục tiêu:
Xây dựng nền tảng kết nối cộng đồng cầu lông gồm bảng tin Social (chia sẻ, thảo luận, vinh danh giải đấu) và khu vực Matchmaking tìm kèo có cấu trúc, hồ sơ người chơi, nhắn tin thời gian thực, gắn với ba nghiệp vụ cốt lõi:
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

### 3.1 Social

Player có thể:
- Đăng bài tự do để chia sẻ kinh nghiệm, trao đổi và thảo luận với cộng đồng cầu lông
- Thả / thay đổi / gỡ reaction và bình luận (comment) trên bài viết
- Chia sẻ / vinh danh thành tích đạt được từ các Giải đấu chuyên nghiệp lên bảng tin
- Xem chi tiết bài đăng và hồ sơ cầu lông của người chơi khác
- Quản lý bài đăng của mình (chỉnh sửa, xóa)

Phạm vi: Bảng tin Social hoạt động độc lập với Matchmaking, tập trung vào kết nối và chia sẻ cộng đồng; không gộp chung bài tìm kèo vào feed Social.

### 3.2 Matchmaking

Player có thể:
- Đăng bài tìm đối thủ / tuyển vãng lai kèm thông tin kèo có cấu trúc (thời gian, khu vực/sân, trình độ mong muốn, quy mô số slot, chi phí dự kiến) trên khu vực Matchmaking riêng biệt
- Xem danh sách kèo và lọc theo các tiêu chí (khu vực, thời gian, trình độ, slot trống)
- Xem chi tiết thông tin kèo và hồ sơ cầu lông của người tham gia
- Xin tham gia kèo (Apply), hủy yêu cầu đang chờ; chủ kèo duyệt hoặc từ chối
- Chủ động tìm người chơi và gửi lời mời (Invite); người nhận chấp nhận hoặc từ chối
- Theo dõi kèo của mình, yêu cầu tham gia, lời mời và danh sách thành viên của kèo
- Hỗ trợ cả kèo đơn, đôi và kèo giao lưu / tuyển vãng lai theo số lượng slot cấu hình
- Liên kết với Court Booking là tùy chọn: chủ kèo có thể tự khai báo sân ngoài hệ thống (chưa xác minh), hoặc gắn với booking đặt trên hệ thống (trước hay sau khi gom người). Đến giờ bắt đầu mà kèo chưa có sân thì kèo bị hủy; booking đã gắn bị hủy thì trận bị hủy.

Quy tắc chốt kèo, rút kèo và nhóm chat:
- **Chủ kèo chủ động chốt**: Apply/Invite được chấp nhận chỉ giữ chỗ; chủ kèo phải chủ động bấm chốt danh sách để tạo Match (Singles/Doubles cần đủ 2/4 tài khoản; GROUP cần đạt tối thiểu và có ít nhất một thành viên ngoài chủ kèo). Kèo còn OPEN khi đến giờ bắt đầu sẽ EXPIRED.
- **Điều kiện rút kèo**: Người chơi chỉ có thể xin rút khỏi kèo, hoặc bị chủ kèo loại, **trước khi booking gắn với kèo được thanh toán thành công** và trước giờ bắt đầu. Sau khi thanh toán tiền sân thành công, quyền rút bị khóa để bảo vệ chi phí sân của cả nhóm.
- **Đồng bộ nhóm chat**: Khi người chơi rút/rời khỏi kèo (hoặc bị chủ kèo loại khi còn hợp lệ trước khi thanh toán sân), hệ thống **tự động gỡ quyền thành viên (kick) khỏi nhóm chat của kèo** nhằm bảo mật thông tin trận đấu (không xóa tin nhắn cũ và không ảnh hưởng đến các nhóm chat độc lập).

Trình độ người chơi:
- Trình độ ban đầu được xác định qua bài khảo sát đánh giá năng lực 6 nhóm tiêu chí có trọng số (thang 0–100 điểm kèm quy tắc chặn trần chống khai khống) trong bước đăng ký tài khoản (làm 1 lần duy nhất).
- **Cơ chế đánh giá người chơi sau trận (Post-match Rating) tạm hoãn (Pending / Out of MVP)**. Việc nâng trình/thăng hạng người chơi được chuyển sang gắn với thành tích thi đấu tại **Giải đấu chuyên nghiệp**.

### 3.3 Court Booking & Thanh toán Ví sàn

Booking sân hoạt động theo hướng thời gian thực (real-time).

Player:
- Tìm sân, xem thông tin sân, giá và slot trống theo thời gian thực
- Chọn sân, ngày, giờ và tạo booking
- **Thanh toán qua Ví sàn (Platform Wallet)**: Tiền booking được trừ trực tiếp từ số dư ví nội bộ của Player; nếu số dư không đủ, hệ thống điều hướng sang luồng nạp tiền vào ví qua cổng thanh toán online (MoMo/VNPay/VietQR)
- Hủy booking theo chính sách dành cho Player; tiền hoàn được cộng trực tiếp vào ví nội bộ của Player
- Xem lịch sử và booking sắp tới

Court Owner:
- Không duyệt từng booking theo flow thủ công (không dùng `Player → Pending → Owner approve/reject`)
- Giám sát booking và trạng thái slot thời gian thực
- Điều chỉnh / xử lý khi có sự cố, có thể chủ động khóa slot bảo trì
- Có thể hủy booking do sự cố / bảo trì phía sân (hệ thống tự động thông báo và hoàn tiền về ví cho Player)
- Doanh thu từ booking sau khi hoàn tất được kết chuyển vào ví nội bộ của Court Owner để đối soát và rút tiền

### 3.4 Tournament

Hệ thống hỗ trợ 2 mô hình giải đấu:
1. **Giải phong trào**: Mô hình mở, giao lưu cọ xát, không tính điểm thăng hạng trình độ, cho phép người tham gia đăng ký tự do không bắt buộc tạo tài khoản hệ thống.
2. **Giải chuyên nghiệp**: Bắt buộc người tham gia phải có tài khoản hệ thống và đáp ứng đúng tiêu chuẩn trình độ; kết quả thi đấu dùng để **tính điểm nâng trình** và **lưu/vinh danh thành tích** vào trang cá nhân (Profile) & bảng tin Social.

Player:
- Tìm kiếm giải đấu, xem chi tiết
- Đăng ký tham gia (đơn/đôi), thanh toán lệ phí giải qua Ví sàn
- Hủy đăng ký theo quy định
- Xem danh sách người tham gia, theo dõi bracket, lịch thi đấu và kết quả

Organizer (quyền ngữ cảnh của Player):
- Tạo tournament, thiết lập thể thức, số lượng, thời gian, địa điểm, lệ phí, hạn đăng ký
- Phân loại giải phong trào hoặc giải chuyên nghiệp
- Quản lý participant, bốc thăm, xếp hạt giống (seeding), sinh bracket
- Quản lý trận đấu, cập nhật / xác nhận kết quả, chuyển người thắng sang vòng tiếp theo, kết thúc và công bố giải
- Lưu lịch sử và vinh danh giải đấu

**Trọng tâm thuật toán của đề tài TLCN**:
- *Thuật toán xếp bảng & phân nhánh giải đấu (Tournament Bracket Generation & Scheduling)*: Phân bổ hạt giống (seeding placement), xử lý suất miễn vòng đầu (BYE allocation), xếp lịch thi đấu tự động tránh trùng lịch sân và vận động viên.
- *Thuật toán tính điểm & nâng trình giải đấu (Tournament-based Ranking Algorithm)*: Tính điểm tích lũy và điều kiện thăng hạng trình độ người chơi dựa trên thành tích vòng đấu đạt được tại giải chuyên nghiệp.

### 3.5 Messaging

Messaging là chức năng nhắn tin thời gian thực (real-time qua WebSocket kết hợp REST API) dành cho Player, gồm:
- Nhắn tin cá nhân (1-1) giữa hai Player, truy cập từ danh sách hội thoại, hồ sơ hoặc bài viết
- Nhắn tin nhóm (Group chat): Nhóm chat độc lập tự tạo hoặc nhóm chat được tạo tự động cho thành viên của kèo Matchmaking
- Gửi/nhận tin nhắn văn bản, hình ảnh và file đính kèm theo thời gian thực
- Thả reaction trên từng tin nhắn
- Hiển thị trạng thái online và trạng thái đang nhập (typing indicator)
- Danh sách hội thoại, lịch sử tin nhắn, tin nhắn mới và số chưa đọc
- Quản lý chặn người dùng (Block/Unblock) hai chiều
- **Quy tắc đồng bộ thành viên kèo**: Khi một người chơi rút/rời khỏi kèo (khi còn hợp lệ trước khi thanh toán), hệ thống tự động gỡ quyền thành viên (kick) người chơi đó ra khỏi nhóm chat của kèo. Nhóm chat độc lập tự tạo ngoài kèo không bị ảnh hưởng bởi quy tắc này.

## 4. Admin

Admin quản lý nền tảng:

- Người dùng
- Court Owner
- Sân / cơ sở
- Tournament
- Báo cáo / vi phạm
- Cấu hình hệ thống
- Dashboard thống kê tổng quan
- Quản lý Ví sàn & Dòng tiền toàn hệ thống (theo dõi số dư ví, nạp/rút, đối soát với cổng thanh toán và chủ sân)

Admin không tham gia nghiệp vụ chơi cầu lông.

## 5. Out of MVP

Các chức năng chưa triển khai trong MVP:

### Player Post-match Ratings

Đánh giá trình độ và thái độ người chơi sau trận (Post-match Rating) tạm hoãn (Pending / Out of MVP) theo định hướng từ GVHD để tránh rủi ro đánh giá cảm tính, cày điểm ảo hoặc thiếu khách quan. Cơ chế thăng hạng trình độ được chuyển sang đánh giá qua kết quả thực tế tại Giải đấu chuyên nghiệp.

### Split Bill

Split Bill chưa thuộc MVP.

Đưa vào hướng phát triển sau khi hoàn thành các nghiệp vụ chính.

### Refund Management

Quản lý hoàn tiền độc lập phía Court Owner chưa cần triển khai như một module riêng trong MVP.

Tuy nhiên, flow hoàn tiền khi Court Owner hủy booking do sự cố vẫn phải được xử lý ở mức cần thiết cho booking (hoàn tiền về ví sàn cho Player).

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

Lưu ý: "System Content Management" dùng để chỉ việc quản lý nội dung hệ thống (bài biên tập của nền tảng, banner, nội dung tĩnh...). Mục này không loại trừ bài đăng tự do do Player tạo trong Social. Việc Admin quản lý **cấu hình hệ thống** (các giá trị `*_ENABLED`, timeout, ngưỡng... trong `docs/business-rules-config-matrix.md` §8) là **nằm trong MVP** và không bị loại bởi mục này.

### Social và Messaging nâng cao

Chưa thuộc MVP:
- Kết bạn/theo dõi, chia sẻ lại bài đăng (share/repost) và bảng tin đề xuất cá nhân hóa
- Nhóm/CLB đấu nhóm (Team vs Team) và hội nhóm cộng đồng cố định độc lập với kèo
- Gọi thoại/video

## 6. MVP Focus

MVP tập trung vào ba nghiệp vụ chính:

1. **Matchmaking**: Tạo/tìm kèo có cấu trúc, Apply/Invite hai chiều, kiểm soát slot, chủ kèo chốt thủ công, điều kiện rút kèo trước khi thanh toán sân thành công (rời kèo thì xóa khỏi nhóm chat), liên kết booking tùy chọn.
2. **Court Booking**: Đặt sân thời gian thực, tích hợp thanh toán qua **Ví sàn nội bộ (Platform Wallet)**.
3. **Tournament**: Quản lý giải đấu với 2 phân hạng: **Giải phong trào** (mở, không rank, không cần tài khoản) và **Giải chuyên nghiệp** (yêu cầu tài khoản, tính điểm nâng trình, lưu thành tích vào trang cá nhân & vinh danh lên Social).

Hệ thống bổ trợ:
- **Social Feed**: Bảng tin cộng đồng độc lập (bài đăng tự do, reaction/comment, chia sẻ/vinh danh giải đấu).
- **Messaging**: Nhắn tin cá nhân và nhóm real-time qua WebSocket (hỗ trợ văn bản, hình ảnh, file đính kèm, reaction, typing indicator, online status, đồng bộ gỡ quyền thành viên khi rút kèo).
- **Hồ sơ & Trình độ**: Khảo sát năng lực ban đầu 6 tiêu chí lúc đăng ký + thăng hạng trình độ qua Giải đấu chuyên nghiệp.
- **Quản lý Ví sàn**: Admin quản trị số dư và dòng tiền nạp/rút toàn sàn.

Luồng trải nghiệm chính: Khảo sát trình độ khi đăng ký → Tìm bài Social / Tìm kèo Matchmaking → Ghép kèo & trao đổi nhóm chat → Chủ kèo chốt danh sách → Thanh toán sân qua Ví sàn (khóa quyền rút) → Đấu giải chuyên nghiệp để nâng trình và lưu thành tích vinh danh lên Social & Profile.

## 7. Confirmed Business Decisions

### Booking & Ví sàn (Platform Wallet)

- Booking hoạt động theo hướng real-time: Xem slot realtime → Giữ slot realtime → Thanh toán qua Ví sàn → Booking xác nhận.
- Court Owner giám sát slot, điều chỉnh khi có sự cố, không dùng quy trình duyệt thủ công `Player → Pending → Owner approve/reject`.
- **Mô hình Ví sàn**: Admin quản lý ví toàn sàn. Mỗi người dùng (Player, Court Owner) có một ví nội bộ. Thanh toán booking / lệ phí giải đấu được trừ từ số dư ví; nếu thiếu tiền thì nạp thêm qua cổng thanh toán online. Doanh thu tiền sân được kết chuyển vào ví của Court Owner. Khi hủy booking hợp lệ, tiền được hoàn về ví của Player.

### Tách biệt Social và Matchmaking

- Tách riêng biệt 2 phân hệ: **Social** (bảng tin bài viết tự do, thảo luận, chia sẻ ảnh, vinh danh giải đấu) và **Matchmaking** (chuyên trang tìm kèo, bộ lọc khu vực/thời gian/trình độ/slot, luồng Apply/Invite).
- Bài tìm kèo không gộp chung vào bảng tin Social.

### Quy tắc chốt kèo, rút kèo và nhóm chat

- **Chủ kèo bấm chốt thủ công**: Apply/Invite được duyệt chỉ giữ chỗ; khi chủ kèo bấm chốt mới tạo Match và đóng các yêu cầu đang chờ.
- **Điều kiện rút kèo**: Người chơi chỉ được phép xin rút khỏi kèo, hoặc bị chủ kèo loại, **trước khi booking gắn với kèo được thanh toán thành công** và trước giờ bắt đầu. Khi đã thanh toán tiền sân xong, quyền rút/loại bị khóa để tránh bùng kèo làm mất tiền sân của nhóm.
- **Đồng bộ nhóm chat**: Khi một người chơi rút/rời khỏi kèo (khi còn hợp lệ), hệ thống **tự động gỡ quyền thành viên (kick) người chơi đó ra khỏi nhóm chat liên kết của kèo**.

### Trình độ người chơi & Đóng băng Rating sau trận

- Trình độ ban đầu: Đánh giá một lần qua bài khảo sát năng lực 6 nhóm tiêu chí có trọng số (0–100 điểm kèm quy tắc chặn trần) khi đăng ký tài khoản.
- **Post-match Ratings**: Tạm hoãn (Pending / Out of MVP). Không dùng cơ chế người chơi đánh giá lẫn nhau sau trận.
- **Thăng hạng trình độ**: Chỉ khi tham gia và đạt thành tích tại **Giải đấu chuyên nghiệp**, người chơi mới được tích lũy điểm để nâng hạng trình độ (rank promotion).

### Phân loại Giải đấu & Trọng tâm Thuật toán

- Phân loại 2 mô hình giải đấu:
  1. **Giải phong trào**: Giao lưu cọ xát, không tính rank, cho phép người tham gia đăng ký tự do không bắt buộc tạo tài khoản hệ thống.
  2. **Giải chuyên nghiệp**: Bắt buộc có tài khoản hệ thống, xét duyệt trình độ/hạt giống, kết quả thi đấu dùng để tính điểm nâng trình và lưu thành tích vào trang cá nhân & vinh danh lên Social.
- **Hai bài toán thuật toán trọng tâm của đề tài TLCN**:
  1. *Thuật toán xếp bảng & phân nhánh giải đấu*: Thuật toán Seeding (phân bổ hạt giống), xử lý BYE (miễn vòng), sinh nhánh đấu (Bracket generation) và xếp lịch đấu tự động tránh trùng sân / vận động viên.
  2. *Thuật toán tính điểm & nâng trình giải đấu*: Thuật toán tính điểm tích lũy thành tích thi đấu tại giải chuyên nghiệp để xác định ngưỡng thăng hạng trình độ cho vận động viên.

### Messaging

- Chat cá nhân (1-1) và chat nhóm (Group chat) nằm trong phạm vi MVP, hoạt động real-time qua WebSocket (kết hợp REST API), hỗ trợ văn bản, hình ảnh, file đính kèm, reaction trên từng tin nhắn, trạng thái online/đang nhập, lịch sử hội thoại và số tin chưa đọc.
- Với nhóm chat của kèo Matchmaking, thành viên rút kèo sẽ bị tự động gỡ quyền khỏi nhóm chat liên kết. Nhóm chat độc lập tự tạo duy trì liên lạc lâu dài.
- Gọi thoại/video không thuộc MVP.

### Lịch sử chốt nghiệp vụ (Audit Trail)

- **2026-10-31**: Chốt bộ khảo sát 6 nhóm tiêu chí lúc đăng ký, mở rộng Apply/Invite hai chiều, WebSocket real-time chat, và các ràng buộc dữ liệu.
- **2026-11-08 (Hoàn thiện chốt kèo & gỡ quyền chat)**: Chuyển xác nhận sang chủ động chốt; khóa rút kèo sau khi booking đã thanh toán thành công; tự động gỡ quyền thành viên chat liên kết khi rời kèo (150 tests PASS trên nhánh develop).
- **2026-11 (Họp GVHD Review TLCN)**:
  1. Tách biệt hoàn toàn Social và Matchmaking.
  2. Rút kèo: Chỉ được rút trước khi thanh toán sân thành công; người rút bị gỡ khỏi nhóm chat của kèo.
  3. Thanh toán: Áp dụng mô hình Ví sàn nội bộ (Platform Wallet) do Admin quản lý toàn sàn, mỗi người 1 ví, thiếu tiền thì nạp.
  4. Trình độ: Tạm hoãn (Pending) cơ chế Rating sau trận; chỉ tham gia giải đấu chuyên nghiệp mới được nâng trình.
  5. Giải đấu: Chia 2 mô hình (Phong trào không tài khoản/không rank vs Chuyên nghiệp tính điểm nâng trình & vinh danh profile/social).
  6. Thuật toán: Xác định 2 thuật toán trọng tâm của đề tài là Thuật toán xếp bảng/nhánh đấu giải & Thuật toán tính điểm nâng trình giải đấu.

## 8. Technology Stack

Hệ thống sử dụng PERN Stack:

- Database: PostgreSQL
- Backend: Node.js + Express.js
- Frontend: React

Đây là technology stack đã được nhóm lựa chọn cho dự án.
