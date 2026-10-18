# Project Brief — Nền tảng số hóa hệ sinh thái cầu lông

## 1. Tổng quan

Tên đề tài:
Số hóa hệ sinh thái cầu lông

Mục tiêu:
Xây dựng nền tảng số hóa các hoạt động chính trong hệ sinh thái cầu lông, tập trung vào ba nghiệp vụ cốt lõi:
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

### 3.1 Matchmaking

Player có thể:
- Tạo nhu cầu tìm người chơi
- Xác định thời gian
- Xác định khu vực
- Xác định trình độ mong muốn
- Xác định số lượng người
- Tìm người chơi phù hợp
- Xem hồ sơ
- Gửi / chấp nhận / từ chối lời mời
- Tham gia / rời / quản lý nhóm chơi
- Đánh giá đối thủ sau trận

Phạm vi MVP của Matchmaking là **mời trực tiếp (invitation-only)**:

- Player tạo nhu cầu, chủ động tìm và mời từng người chơi cụ thể; người được mời chấp nhận hoặc từ chối.
- Hệ thống không tự động ghép người chơi và không tự tìm/chọn sân theo khoảng cách.
- Khi nhóm đủ số người, chủ kèo tự chọn sân và tạo booking qua Court Booking.
- Mỗi lời mời có thời hạn riêng; nếu nhu cầu hết hạn trước khi đủ người, những người đã chấp nhận được giải phóng và phải bắt đầu lại.

Đánh giá đối thủ gồm:
- Rating trình độ
- Rating thái độ

Dữ liệu đánh giá được sử dụng làm input để hệ thống điều chỉnh trình độ người chơi tự động.

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
thống (bài viết, banner, nội dung tĩnh...). Việc Admin quản lý **cấu hình
hệ thống** (các giá trị `*_ENABLED`, timeout, ngưỡng... trong
`docs/business-rules-config-matrix.md` §8) là **nằm trong MVP** và không
bị loại bởi mục này.

## 6. MVP Focus

MVP tập trung vào ba nghiệp vụ chính:

1. Matchmaking
2. Court Booking
3. Tournament

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

### Matchmaking

MVP Matchmaking hoạt động theo hướng mời trực tiếp (invitation-only):

- Player tạo nhu cầu và chủ động mời từng người chơi cụ thể; người nhận chấp nhận hoặc từ chối.
- Hệ thống không tự động ghép người chơi.
- Hệ thống không tự tìm/chọn sân theo khoảng cách; chủ kèo tự chọn sân và tạo booking qua flow Court Booking.
- Mỗi lời mời có thời hạn riêng (timeout). Khi nhu cầu hết hạn mà chưa đủ người, các lời mời đang chờ hết hạn và những người đã chấp nhận được giải phóng; người chơi phải tạo nhu cầu mới. Không tự động tạo nhóm thay thế.

Decision recorded 2026-10-10 (Human owner).

Bổ sung đã được human owner duyệt và xác nhận Ready ngày 2026-10-10:
- Tìm Player theo tên/trình độ; invitee không cần đang hoạt động hoặc có request.
  Không bỏ qua quy tắc đăng nhập/phân quyền khi phản hồi.
- Owner và người đã nhận lời giữ khung giờ; được rút lời nhận trước khi đủ nhóm.
- Khi đủ nhóm, owner đặt booking cùng ngày, trong khung giờ đã mời, đúng duration
  đã chốt. Khu vực chỉ là gợi ý; sân ngoài khu vực được phép.
- Chưa có sân vào giờ bắt đầu dự kiến thì hủy Match. Rời Match kích hoạt yêu cầu
  hủy booking theo policy; booking bị hủy cũng hủy Match. Refund thuộc Payment.
- Chi tiết: business-rules-config-matrix.md §3 và Matchmaking PRD §8.1.

## 8. Technology Stack

Hệ thống sử dụng PERN Stack:

- Database: PostgreSQL
- Backend: Node.js + Express.js
- Frontend: React

Đây là technology stack đã được nhóm lựa chọn cho dự án.