# Tạo Google Form khảo sát nhu cầu cầu lông

Script [tao-khao-sat.gs](tao-khao-sat.gs) chứa sẵn 22 câu hỏi và 6 phần từ [bộ câu hỏi](../../docs/research/bo-cau-hoi-khao-sat-nhu-cau.md). Không cần tải file Markdown lên Google hoặc cài thư viện. Đây là bản dữ liệu chụp tại thời điểm viết; sửa Markdown sau này không tự cập nhật script hay form đã tạo.

## Cách chạy

1. Mở [Google Apps Script](https://script.google.com/) bằng tài khoản muốn sở hữu form, chọn **Dự án mới / New project**.
2. Mở `Code.gs`, xóa mã mẫu và dán **toàn bộ** nội dung `tao-khao-sat.gs` vào. Lưu dự án.
3. Chọn hàm **taoKhaoSat** trên thanh công cụ, nhấn **Chạy / Run**.
4. Khi Google yêu cầu, chọn **Xem lại quyền / Review permissions**, chọn tài khoản và cho phép script tạo, quản lý Google Forms. Không cần Deploy, bật Google Forms API hoặc tạo API key. Nếu tài khoản trường học/công ty chặn cấp quyền, cần tài khoản được quản trị viên cho phép chạy Apps Script.
5. Đợi lần chạy hoàn tất. Mở **Nhật ký thực thi / Execution log**, lấy **Link chỉnh sửa**. Nếu lần chạy đầu chỉ hoàn tất bước cấp quyền, nhấn Run lại.
6. Mở form, dùng **Xem trước / Preview** để kiểm tra các nhánh. Script tạo **bản nháp chưa xuất bản**, không tự phát hành khảo sát.
7. Trong giao diện Google Forms, nhấn **Xuất bản / Publish**. Kiểm tra quyền người trả lời và chọn **Bất kỳ ai có đường liên kết / Anyone with the link** nếu muốn khảo sát công khai và tài khoản cho phép. Lấy liên kết trả lời để gửi khảo sát. Thử mở liên kết bằng cửa sổ ẩn danh để xác nhận không yêu cầu đăng nhập.

Script tắt thu email và tắt giới hạn một câu trả lời mỗi tài khoản. Chính sách Google Workspace vẫn có thể hạn chế quyền truy cập ngoài tổ chức; hãy kiểm tra quyền người trả lời trong giao diện trước khi chia sẻ.

## Nội dung được tạo

- Giới thiệu rồi vào câu hỏi phân nhóm ngay, không có câu xác nhận tham gia.
- Văn bản ngắn/dài, chọn một, chọn nhiều, dropdown, thang 1–5 và bảng một lựa chọn mỗi dòng.
- Các nhánh ở C01, C10, C13; chỉ người từng dự hoặc tổ chức giải trả lời phần giải đấu. Người chơi trả lời 15–17 câu; chỉ quản lý sân 10 câu; kiêm hai vai trò 20–22 câu; nhóm chưa chơi hoặc nhóm khác 5 câu (tính cả câu góp ý tùy chọn).
- Đáp án “Khác” dùng ô nhập tự do có sẵn của Google Forms.
- C06, C12, C19 giới hạn tối đa 3 lựa chọn.
- Câu bắt buộc và tùy chọn, mô tả, thanh tiến trình và thông báo sau khi gửi.

Các lựa chọn như “Không gặp vấn đề nào” có hướng dẫn chọn riêng, nhưng script không tự chặn chọn chung với đáp án khác. Google Forms không có quy tắc checkbox dựng sẵn cho tổ hợp loại trừ này; cần rà soát khi tổng hợp dữ liệu như hướng dẫn trong bộ câu hỏi.

## Chạy lại và xử lý lỗi

**Bản rút gọn dùng khóa lưu ID riêng `BADMINTON_SURVEY_SHORT_V2_FORM_ID`.** Nếu đã tạo form 43 câu bằng bản script trước, thay toàn bộ `Code.gs` bằng mã mới và chạy `taoKhaoSat`: script sẽ tạo một form rút gọn mới, giữ nguyên form cũ và dữ liệu trả lời. Dùng liên kết mới cho các đợt khảo sát tiếp theo.

Chạy lại bản rút gọn trong cùng dự án Apps Script chỉ in lại link form rút gọn đã tạo; không tạo bản trùng, không thêm câu hỏi và không ghi đè chỉnh sửa thủ công. Muốn tạo một bản mới, dùng dự án Apps Script mới rồi dán lại mã.

Nếu quá trình tạo lỗi giữa chừng hoặc hết thời gian, link bản nháp đã được ghi vào nhật ký và ID được giữ trong thuộc tính dự án. Lần chạy tiếp theo báo bản chưa hoàn tất thay vì tạo trùng hoặc tiếp tục thêm câu hỏi. Mở bản nháp để kiểm tra; muốn dựng lại từ đầu, chạy mã trong dự án Apps Script mới. Script không tự xóa form cũ hoặc dữ liệu trả lời.

## Kiểm tra trước khi gửi khảo sát

Thử các trường hợp: người chơi chưa dự giải; người chơi đã dự giải; người tổ chức giải; chỉ quản lý sân; vừa chơi vừa quản lý sân; người chưa chơi có dự định; người không thuộc các nhóm trên. Kiểm tra C13 ở cả hai đáp án. Thử chọn 4 đáp án ở một câu giới hạn 3 và kiểm tra hiển thị bảng trên điện thoại.

Mã đã được kiểm tra cú pháp và điều hướng bằng môi trường mô phỏng cục bộ. Việc cấp quyền, tạo form và hiển thị thực tế cần được xác nhận khi chạy trên tài khoản Google của bạn.

## Tài liệu Google

- [Forms Service](https://developers.google.com/apps-script/reference/forms).
- [Tạo form và chọn trạng thái xuất bản](https://developers.google.com/apps-script/reference/forms/form-app).
- [Điều hướng qua PageBreakItem](https://developers.google.com/apps-script/reference/forms/page-break-item).
- [Giới hạn số lựa chọn checkbox](https://developers.google.com/apps-script/reference/forms/checkbox-validation-builder).
