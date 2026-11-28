# Bản cam kết sản phẩm cuối cùng và bộ metric đánh giá

**Đề tài:** Số hóa hệ sinh thái cầu lông (PERN: PostgreSQL, Express/Node.js, React)

## 1. Thang đánh giá mức hoàn thành (1–5)

| Mức | Ý nghĩa | Kết luận |
|---|---|---|
| 1 | Chỉ có thiết kế/tài liệu, chưa chạy được | Không đạt |
| 2 | Có một phần chạy được, luồng chính chưa trọn vẹn | Không đạt |
| 3 | Luồng chính chạy được end-to-end, còn thiếu luồng phụ/xử lý lỗi | Đạt (tối thiểu) |
| 4 | Luồng chính và luồng lỗi chạy ổn, có kiểm thử tự động cho luồng chính | Đạt tốt |
| 5 | Mọi luồng chạy ổn, kiểm thử tự động cả luồng chính và luồng lỗi, giao diện và tài liệu khớp code | Đạt xuất sắc |

Ngưỡng **Đạt = từ mức 3 trở lên**. Cột "Mức cam kết cuối kỳ" là mức nhóm cam kết đạt được tại thời điểm nộp sản phẩm cuối cùng. Đánh giá thực tế được đối chiếu lại bằng các metric ở cột "Mục tiêu".

## 2. Vấn đề nghiên cứu và tính thực tiễn

Người chơi cầu lông hiện tìm đối thủ và tuyển vãng lai qua group Facebook/Zalo. Cách này có 4 hạn chế:
1. Bài đăng trôi nhanh, khó lọc theo khu vực, giờ chơi, trình độ và số slot còn trống.
2. Không kiểm chứng được trình độ và thái độ người xin vào (khai man trình, bùng kèo).
3. Gom người và đặt sân tách rời nhau.
4. Chủ kèo phải đếm slot thủ công qua bình luận và tin nhắn.

Sản phẩm thay thế quy trình trên bằng bảng tin có cấu trúc, hồ sơ người chơi, đặt sân thời gian thực và công cụ tổ chức giải đấu.

## 3. Sản phẩm cam kết vào cuối kỳ

| # | Hạng mục cam kết | Metric đo lường được | Mục tiêu (đạt mức cam kết khi) | Mức cam kết cuối kỳ | Kết luận |
|---|---|---|---|---|---|
| 1 | **Xác thực và phân quyền** (Player / Court Owner / Admin) | Đăng ký, đăng nhập, đổi mật khẩu; truy cập sai vai trò bị từ chối | 3 vai trò hoạt động; truy cập trái quyền trả 401/403; có test cho cả luồng đúng và luồng lỗi | 5 | Đạt |
| 2 | **Hồ sơ người chơi** (khảo sát 6 nhóm tiêu chí, avatar, điểm kỹ năng/thái độ) | Khảo sát tính điểm thang 0–100 và gán trình độ; hồ sơ hiển thị đúng quyền công khai | Người dùng mới hoàn tất khảo sát và xem hồ sơ công khai; có test cho công thức tính điểm | 5 | Đạt |
| 3 | **Bảng tin cộng đồng** (bài tự do, bài tìm kèo, reaction, comment, ảnh, bộ lọc) | Đăng/sửa/xóa bài; lọc ra đúng kết quả; phân trang không trùng bài | Demo đủ luồng đăng bài → lọc → reaction/comment; có test giao diện cho luồng chính | 5 | Đạt |
| 4 | **Matchmaking Apply/Invite hai chiều** (kèo đơn, đôi, giao lưu) | Xin tham gia/mời → duyệt/từ chối → chốt; chặn trùng lịch; slot đếm đúng | Không người nào vào hai kèo trùng giờ; trạng thái kèo chuyển đúng; có test cả luồng lỗi | 5 | Đạt |
| 5 | **Đặt sân thời gian thực** (tìm sân, slot trống, giá giờ thường/giờ vàng, hủy theo chính sách) | Hai người đặt cùng slot thì chỉ một người thành công | Không đặt trùng slot trong kiểm thử đồng thời; hủy và hoàn tiền theo đúng chính sách | 4 | Đạt tốt |
| 6 | **Thanh toán và ví ảo** (nạp, thanh toán bằng số dư, hoàn tiền, chia đều chi phí kèo) | Số dư ví khớp sổ giao dịch sau mỗi thao tác; thiếu tiền thì từ chối đặt sân | Luồng nạp → thanh toán → hoàn tiền chạy với cổng thanh toán giả lập; có test đối soát số dư | 4 | Đạt tốt |
| 7 | **Quản lý sân (Court Owner)** (cơ sở, sân, giá, khóa slot, hủy do sự cố) | Chủ sân cấu hình giá và khóa slot; Player thấy kết quả ngay | Luồng cấu hình → hiển thị cho Player đúng; xử lý được hủy do sự cố kèm hoàn tiền | 4 | Đạt tốt |
| 8 | **Giải đấu và sinh bracket** (tạo giải, đăng ký, bốc thăm, bracket nhị phân, cập nhật kết quả) | Với 4/8/16 người, bracket sinh đúng số trận; người thắng được chuyển vòng | Có kiểm thử thuật toán bracket; demo trọn một giải từ tạo đến công bố kết quả | 4 | Đạt tốt |
| 9 | **Nhắn tin thời gian thực** (1-1, nhóm, WebSocket, chưa đọc, chặn) | Tin nhắn đến người nhận trong ≤ 2 giây; số chưa đọc đúng | Chat 1-1 và nhóm hoạt động; người bị chặn không nhắn được; có test cho quyền đọc/gửi | 4 | Đạt tốt |
| 10 | **Đánh giá sau trận** (kỹ năng, thái độ) | Chỉ người cùng trận được đánh giá; không đánh giá hai lần | Điểm hiển thị đúng trên hồ sơ; có test cho luồng lỗi | 5 | Đạt |
| 11 | **Thông báo trong ứng dụng** | Mỗi sự kiện chính (lời mời, duyệt, hủy kèo, booking) sinh đúng một thông báo | Không nhân đôi, không thiếu; có test cho từng loại sự kiện | 5 | Đạt |
| 12 | **Admin** (người dùng, cơ sở sân, báo cáo vi phạm, cấu hình hệ thống, dashboard) | Admin khóa/mở tài khoản, duyệt cơ sở, đổi cấu hình có hiệu lực | Các màn quản trị chạy với dữ liệu thật; có test cho quyền Admin | 5 | Đạt |

**Mức trung bình các hạng mục: 55/12 ≈ 4,58/5.**

## 4. Metric chất lượng chung

| Metric | Cách đo | Mục tiêu | Mức cam kết |
|---|---|---|---|
| Kiểm thử tự động backend | Chạy vitest trên PostgreSQL thật; ghi số test pass/tổng | 100% test pass tại thời điểm nộp | 5 |
| Biên dịch | `tsc` backend và frontend; build frontend | 0 lỗi kiểu, build thành công | 5 |
| Bảo mật cơ bản | Phân quyền theo vai trò, CSRF, giới hạn tần suất, kiểm tra dữ liệu đầu vào | Mọi endpoint nhạy cảm yêu cầu xác thực và đúng vai trò | 5 |
| Toàn vẹn dữ liệu | Thao tác đồng thời (đặt sân, nhận thành viên) | Không phát sinh dữ liệu trùng hoặc lệch slot/số dư | 5 |
| Tài liệu | PRD, Tech Design, Tasks từng module; hướng dẫn chạy dự án | Mỗi module có tài liệu khớp với code | 4 |
| Demo | Kịch bản chạy từ đầu đến cuối | Chạy trọn luồng chính, không lỗi chặn | 5 |

**Mức trung bình metric chất lượng: 29/6 ≈ 4,83/5.**

## 5. Kịch bản demo chính

1. Đăng ký, làm khảo sát, nhận trình độ ban đầu.
2. Đăng bài tìm kèo lên bảng tin, người chơi khác lọc và xin tham gia.
3. Chủ kèo xem hồ sơ người xin vào, duyệt, chốt kèo.
4. Đặt sân theo thời gian thực, thanh toán bằng ví, chia chi phí.
5. Chat nhóm để trao đổi, sau trận đánh giá kỹ năng và thái độ.
6. Chủ sân quản lý giá/slot; Admin xem dashboard và xử lý báo cáo.
7. Tạo một giải đấu, bốc thăm, sinh bracket, cập nhật kết quả.

## 6. Phạm vi không cam kết

Gọi thoại/video, kết bạn/theo dõi, đề xuất cá nhân hóa, quản lý CLB, hoãn trận, đánh giá cơ sở sân, quản lý hoàn tiền độc lập cho chủ sân, Super Admin. Công thức nâng trình từ giải chuyên nghiệp và rút tiền từ ví chưa có quyết định nghiệp vụ, nên không nằm trong cam kết.

## 7. Rủi ro và cách kiểm soát

| Rủi ro | Kiểm soát |
|---|---|
| Phạm vi rộng (3 vai trò, nhiều module) | Ưu tiên luồng demo chính; hạng mục phụ cam kết mức 4 |
| Booking, ví và kèo phụ thuộc nhau | Chốt giao diện giữa các module trước; kiểm thử tích hợp luồng chia chi phí |
| Giải đấu có quy tắc chưa chốt | Cam kết bracket và giải phong trào trước, phần nâng trình để sau |

## 8. Tổng kết

- Trung bình các hạng mục: **4,58/5**; trung bình metric chất lượng: **4,83/5**.
- Kết luận: **Đạt**, 12/12 hạng mục đạt từ mức 4 trở lên.