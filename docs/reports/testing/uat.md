# Kịch bản Acceptance/UAT và phiếu ghi nhận

Trạng thái: CHƯA THỰC HIỆN — người dùng xác nhận ngày 28/11/2026; giữ kịch bản/phiếu để nhóm chạy sau. Không có chữ ký/kết quả người dùng được tạo thay. Cấp độ Acceptance xác nhận nghiệp vụ; UI/E2E tự động chỉ hỗ trợ, không thay thế người nghiệm thu.

## Chuẩn bị

- Dùng môi trường staging/test và tài khoản demo; không nạp/rút tiền thật.
- Ghi phiên bản/SHA, URL môi trường, ngày giờ Việt Nam, người điều phối.
- Người tham gia đại diện Player, Court Owner và Admin. Organizer là quyền Player trong giải của mình, không phải role hệ thống mới.
- Đối chiếu expected result với PRD/Tech Design hiện hành. Với thao tác có deadline, chuẩn bị dữ liệu test phù hợp thay vì đổi đồng hồ production.
- Ghi người tham gia bằng mã ẩn danh và vai trò nghiệp vụ; giữ thông tin cá nhân ngoài repo công khai.

## Kịch bản

| ID | Vai trò | Tác vụ | Kết quả cần xác nhận | Kết quả thực tế |
| --- | --- | --- | --- | --- |
| UAT-01 | Player | Đăng nhập, tìm sân theo điều kiện, xem lịch và giá | Thông tin đủ để chọn slot hợp lệ; không chào slot đã bị chiếm | Chưa chạy |
| UAT-02 | Player | Đặt sân, trả bằng ví đủ tiền, mở lịch sử | Xác nhận ngay, số tiền đúng, không cần chủ sân duyệt | Chưa chạy |
| UAT-03 | Player | Trả bằng ví thiếu tiền | Không xác nhận booking sai; có hướng dẫn nạp tiền | Chưa chạy |
| UAT-04 | Player | Hủy booking đã trả trước hạn, thao tác lại | Hoàn tiền theo chính sách đúng một lần; trạng thái và số dư nhất quán | Chưa chạy |
| UAT-05 | Court Owner + Player | Chủ sân hủy do vận hành | Người chơi nhận thông báo và hoàn tiền theo đặc tả | Chưa chạy |
| UAT-06 | Player/host | Tạo kèo, apply/invite, duyệt và chủ động chốt | Thành viên đúng, không vượt slot, không tự tạo Match trước bước chốt | Chưa chạy |
| UAT-07 | Nhóm Player | Split booking với một người thiếu ví, sau đó đủ tiền | Thiếu tiền không trừ một phần; đủ tiền chia đúng theo quy tắc; rút sau thanh toán bị khóa | Chưa chạy |
| UAT-08 | Player/organizer | Tạo giải, mở đăng ký, draw/schedule, cập nhật kết quả | Đúng quyền contextual, không xung đột lịch, kết quả/placement đúng | Chưa chạy |
| UAT-09 | Admin | Xem tài chính, lọc/xuất và kiểm tra giao dịch mẫu | Dữ liệu khớp giao dịch đã thực hiện; không lộ thông tin nhạy cảm | Chưa chạy |
| UAT-10 | Admin + Player | Đổi timeout, tạo yêu cầu ví, đợi/quét hết hạn | Yêu cầu có deadline đúng; hết hạn không được ghi có; thay cấu hình không sửa deadline cũ | Chưa chạy |

| UAT-11 | Player | Đăng ký/OTP, làm survey, xem và sửa tên/thông tin liên hệ | Trình độ theo survey đã cam kết, thay đổi được lưu qua reload; số điện thoại không bị công khai ngoài quyền cho phép | Chưa chạy |
| UAT-12 | Hai Player | Đăng bài, phản hồi, mở chat direct/group và gửi tin | Nội dung đúng người nhận, quyền thành viên đúng; ghi nhận trải nghiệm tốc độ, đối chiếu số đo tự động ≤2 giây riêng | Chưa chạy |
| UAT-13 | Player | Mở thông báo booking/match, đi tới tài nguyên, đánh dấu đã đọc | Đúng đích và đúng quyền; trạng thái đã đọc được giữ sau reload | Chưa chạy |
| UAT-14 | Player cùng trận | Đánh giá sau trận, thử gửi lại và dùng người ngoài trận | Người đủ điều kiện gửi được; không tạo đánh giá trùng hoặc cho người không đủ quyền | Chưa chạy |

Với mỗi dòng: người điều phối ghi dữ liệu ban đầu (tài khoản, ID sân/kèo/giải và số dư), người tham gia thực hiện tác vụ trên UI, đối chiếu kết quả mong đợi và ghi phiếu bên dưới. Với UAT-02/04/07, chụp số dư/trạng thái trước–sau và đối chiếu ledger bằng người có quyền; với UAT-08, lưu bracket trước–sau cập nhật kết quả. Mỗi lần chạy lại giữ phiếu cũ và tạo bản retest có cùng ID kịch bản.

## Phiếu cho mỗi lần chạy

| Trường | Giá trị cần điền |
| --- | --- |
| Người tham gia/vai trò, người điều phối | Chưa ghi nhận |
| SHA/môi trường/ngày giờ | Chưa ghi nhận |
| ID kịch bản và dữ liệu đầu vào | Chưa ghi nhận |
| Thành công/thất bại/bị chặn; thời gian hoàn thành | Chưa ghi nhận |
| Kết quả thực tế, nhận xét, bug ID | Chưa ghi nhận |
| Retest sau sửa lỗi | Chưa ghi nhận |
| Chấp nhận/chấp nhận có điều kiện/chưa chấp nhận và người xác nhận | Chưa ghi nhận |

Điều kiện hoàn tất: mọi kịch bản bắt buộc được thực hiện, lỗi Critical/Blocker được đóng sau retest, người đại diện xác nhận. Muốn dùng kết quả cho TC2.7 phải bổ sung các yêu cầu riêng về số người, task success, khảo sát và cải tiến trước–sau của tiêu chí đó.
