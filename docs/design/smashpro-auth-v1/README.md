# SmashPro — bản thiết kế đăng nhập & khảo sát v1

Ngày: **2026-11-18**. Trạng thái: **AWAITING_REVIEW — chờ người dùng duyệt thiết kế**.

Đây là bản mẫu HTML/CSS/JavaScript độc lập để duyệt hình ảnh, bố cục, responsive và một số tương tác. Chưa tích hợp vào React, chưa thay thế `/sign-in`, chưa triển khai AUTH-31 và không kết nối API/database. Nội dung này không thay thế PRD, Tech Design hay kế hoạch chuyển đổi frontend.

## Trạng thái công việc

| Công việc | Trạng thái | Kết quả / điều kiện tiếp tục |
| --- | --- | --- |
| Thống nhất hướng ảnh thể thao, màu xanh có chiều sâu, form sáng | DONE | Người dùng đồng ý trong hội thoại |
| Dựng mẫu đăng nhập desktop và mobile | DONE | `index.html#sign-in` |
| Dựng một bước kỹ thuật và kết quả cùng phong cách | DONE | `index.html#survey`, `index.html#result` |
| Kiểm tra bản mẫu trên trình duyệt | DONE | 3 màn × 4 chiều rộng; tương tác mô tả bên dưới |
| Duyệt thiết kế D01 | AWAITING_REVIEW | Chờ nhận xét và xác nhận của người dùng |
| Tích hợp thiết kế được duyệt vào trang đăng nhập React | NOT_STARTED | Chỉ bắt đầu sau xác nhận; phạm vi D01 |
| Triển khai khảo sát đăng ký thật | DEFERRED | Nhánh `feat/skill-survey`, sau đợt refactor UI theo yêu cầu người dùng |
| Bắt đầu D02 | NOT_STARTED | Không thuộc đợt thiết kế này |

**Tình trạng file kế hoạch:** khi bắt đầu đợt thiết kế, file kế hoạch chỉ chứa `nghe t`. Ngày 2026-11-18, theo yêu cầu người dùng, đã khôi phục [bản kế hoạch trước khi ghi nhầm](../../architecture/plans/refactor_FE_add_lib/frontend-modernization-history.md) từ nội dung và các lần cập nhật ghi trong nhật ký phiên làm việc trước: 665 dòng, đủ §1–15 và bảng trạng thái D00–D23. Đây là bản phục hồi trước đợt thiết kế; bảng trên tiếp tục ghi trạng thái review bản mẫu hiện tại. Chưa commit hoặc push.

## Mở bản xem trước

Từ thư mục gốc repository:

```bash
python3 -m http.server 5180 --bind 127.0.0.1 --directory docs/design/smashpro-auth-v1
```

Mở **http://localhost:5180/**. Nếu server đang chạy thì không cần chạy thêm.

- Đăng nhập: http://localhost:5180/#sign-in
- Khảo sát kỹ thuật: http://localhost:5180/#survey
- Kết quả minh họa: http://localhost:5180/#result

Thanh ở dưới cùng để đổi màn và xem thông tin bản mẫu; thanh này chỉ phục vụ review thiết kế. Có thể dùng trình duyệt thu hẹp cửa sổ để kiểm tra responsive. Bản mẫu không cần `npm install`, backend, Docker hoặc kết nối mạng. Font, ảnh và biểu tượng đều ở trong thư mục này.

## Hướng thiết kế

Tham khảo cách dùng ảnh thể thao và khu vực form sáng của [Playora](https://dribbble.com/shots/27436353-Playora-Sports-Mobile-App-Login-On-Boarding-Page). Bố cục, tài nguyên và nội dung của bản mẫu được xây dựng riêng cho SmashPro; không lấy ảnh hoặc tài nguyên của mẫu tham khảo.

Giữ màu thương hiệu **#006B2C**, font **Inter** và biểu tượng cầu lông hiện có. Xanh rừng, màu chanh nhạt và trắng ngà là **đề xuất màu bổ sung trong bản mẫu**, chưa thay token toàn ứng dụng. Vùng ảnh tối và panel huy hiệu là đồ họa thương hiệu trong giao diện sáng, không phải chế độ tối.

| Màn | Điểm chính | Khi thu nhỏ |
| --- | --- | --- |
| Đăng nhập | Ảnh cầu lông riêng, tiêu đề lớn; form hai trường rõ ràng; lời mời tạo tài khoản | Ảnh thành banner ngắn, form xếp dưới, nút và nhãn vẫn hiện rõ |
| Khảo sát | Sidebar 5 bước; bước 2 có 9 kỹ năng; xem từng kỹ năng với bốn lựa chọn | Tiến trình chuyển thành hàng ngang; lựa chọn xếp dọc; thanh chọn kỹ năng cuộn ngang |
| Kết quả | Huy hiệu, thang 7 bậc, hai điểm mạnh và một hướng cải thiện; hành động tìm trận | Huy hiệu lên trước; phần giải thích và thẻ thông tin xếp dưới |

Chuyển màn 240 ms, trạng thái tương tác 180 ms; vô hiệu hóa chuyển động khi người dùng chọn reduced motion. Không có carousel, video tự chạy hoặc hiệu ứng lặp. Biểu tượng và màu luôn đi kèm chữ để giải thích trạng thái.

## Nội dung khảo sát và giới hạn của bản mẫu

Đọc trực tiếp từ nhánh **`feat/skill-survey` tại `4c4802b`**, qua `git show`, không checkout/merge:

- `docs/features/platform/authentication-authorization/prd.md`, mục “Registration skill survey — content updated 2026-11-15”.
- `docs/features/platform/authentication-authorization/tech-design.md`, mục khảo sát cùng ngày.
- `docs/business-rules-config-matrix.md` §1.2 của nhánh đó: thang 7 bậc.

Các phần cập nhật khảo sát vẫn có trạng thái **Draft**. Bản mẫu không nâng trạng thái tài liệu nghiệp vụ hoặc chọn lại thuật toán.

Giữ định hướng **khảo sát trước → tạo tài khoản cuối → kết quả sau khi đăng ký thành công**. Chỉ dựng bước 2 để review; không thêm một bước nghiệp vụ ngoài 5 bước. Chín kỹ năng và thang bốn mô tả được lấy từ bản nháp PRD. Không hiện điểm hoặc bậc dự đoán trong lúc trả lời.

Những khác biệt cố ý của prototype:

- Nút “Tạo tài khoản” mở thẳng **mẫu bước 2**, kèm thông báo giải thích; các bước 1, 3, 4, 5 chưa dựng. Trong bản mẫu, trạng thái hoàn thành bước 1 là minh họa.
- Chọn kỹ năng, đi tới/lùi và quay lại sửa được trong bộ nhớ của trang. Reload xóa câu trả lời; **chưa hiện thực lưu theo tab** như yêu cầu của PRD. Không lưu mật khẩu hoặc dữ liệu vào browser storage.
- Nút “Hoàn tất phần kỹ thuật” báo bước tiếp theo là “Thực chiến & thể lực”; không nhảy sang kết quả hay tạo tài khoản. Nút hoàn tất kiểm tra các kỹ năng còn thiếu và đưa về mục đó.
- Nút đăng nhập chỉ hiện thông báo bản mẫu; không xác thực, không gửi dữ liệu và không có trạng thái thành công giả.
- Màn kết quả là **fixture cố định minh họa**: “Trung bình khá”, điểm mạnh “Kỹ thuật / Kinh nghiệm”, hướng cải thiện “Thể lực”. Không suy ra từ lựa chọn trong bản mẫu; không có công thức frontend hoặc khẳng định đây là kết quả đánh giá thật.
- Kết quả có nhãn “tạm thời”, thang 7 bậc và ghi chú điều chỉnh qua giải đấu chuyên nghiệp như bản nháp. Không bổ sung chứng nhận, huy chương thi đấu thật hay lời hứa nâng trình từ rating.
- Huy hiệu chỉ là đồ họa thử nghiệm. Các con số, biểu tượng trang trí không phải thành tích của một tài khoản.

## Kiểm tra đã thực hiện

Ngày 2026-11-18, dùng Playwright với Google Chrome, server tĩnh riêng trên port 5180:

- **12/12 lượt hiển thị:** 3 màn × 320, 390, 768, 1440 px; không tràn ngang ở document; ảnh tải được; mỗi màn có một tiêu đề chính đang hiện.
- Hiện/ẩn mật khẩu; gửi form mẫu chỉ hiện thông báo.
- Trả lời đủ 9 kỹ năng, tiến/lùi, quay lại vẫn giữ lựa chọn trong phiên trang.
- Chuyển ba màn qua thanh review; nút tìm trận chỉ hiện thông báo prototype.
- Reduced motion tắt animation của màn hình.
- Không có lỗi JavaScript hoặc tài nguyên HTTP lỗi trong các kiểm tra; các request quan sát được đều là GET tới server tĩnh cùng origin, không có request API hay request mutation.
- Đã mở và kiểm tra trực quan ảnh chụp desktop/mobile của cả ba màn.
- Đối chiếu SHA-256 của **668 file có sẵn trước đợt này**: không file nào bị đổi. Toàn bộ thay đổi của đợt nằm trong thư mục `docs/design/smashpro-auth-v1/` mới.

Đây là kiểm tra **prototype**. Chưa phải nghiệm thu WCAG, thử với người dùng, kiểm tra đăng nhập backend hoặc kiểm tra nghiệp vụ khảo sát. Không chạy lại build/lint/E2E ứng dụng vì không sửa mã nguồn ứng dụng.

Ảnh chụp kiểm tra đã dọn khỏi Git. Mở bản mẫu HTML theo hướng dẫn phía trên để xem đăng nhập, khảo sát và kết quả; không cần lưu thêm bộ ảnh preview.

## Điểm cần người dùng review

1. Ảnh, phối màu xanh rừng/chanh nhạt và mức độ nổi bật có hợp SmashPro không?
2. Cách xem từng kỹ năng trong một bước có dễ hiểu và đủ nhanh không?
3. Màn kết quả có tạo cảm giác tích cực, đồng thời làm rõ trình độ tạm thời không?

Sau khi được duyệt: chỉ tích hợp **màn đăng nhập** vào D01 bằng các thư viện đã được phép; giữ nguyên AuthProvider, HTTP client, session/CSRF, vai trò và điều hướng hiện có. Kiểm tra hành vi đăng nhập, lỗi/loading, focus, responsive và trang legacy liên quan; cập nhật tài liệu/status rồi dừng review. Hai màn khảo sát vẫn là tài liệu tham khảo cho nhánh riêng. Chưa commit hoặc push.
