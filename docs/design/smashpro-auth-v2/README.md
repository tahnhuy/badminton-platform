# SmashPro — bản mẫu v2: đồ họa vector và tương tác

Ngày: **2026-11-18**. Trạng thái thiết kế: **APPROVED — người dùng chốt 2026-11-18**. Màn đăng nhập đã tích hợp vào ứng dụng; kết quả triển khai D01 đang AWAITING_REVIEW. Khảo sát/kết quả vẫn chỉ là bản mẫu.

Người dùng đánh giá hướng khảo sát và kết quả của v1 khá phù hợp, nhưng đăng nhập chưa đủ ấn tượng, muốn giao diện mượt và không dùng ảnh người chơi. V2 thay hình ảnh ở đăng nhập và bỏ ảnh đó khỏi sidebar khảo sát; giữ bố cục, nội dung và tương tác khảo sát/kết quả để tiếp tục review.

## Mở và thử

Từ repository root:

```bash
python3 -m http.server 5181 --bind 127.0.0.1 --directory docs/design
```

Mở **http://localhost:5181/smashpro-auth-v2/**. Nếu server đang chạy thì không cần khởi động thêm.

- `#sign-in`: rê chuột trên panel sân để thử phản hồi; focus ô nhập và hover nút đăng nhập.
- `#survey`: chọn thang mô tả, chuyển giữa chín kỹ năng và quay lại sửa lựa chọn.
- `#result`: xem kết quả cố định, không phải kết quả tính từ các lựa chọn.
- Bật reduced motion trong hệ điều hành hoặc DevTools để kiểm tra phiên bản không có chuyển động.

V2 dùng font/biểu tượng và CSS nền ở thư mục v1 qua đường dẫn tương đối. Cần giữ cả hai thư mục khi sao chép prototype. Không cần backend, API, npm install hoặc dịch vụ bên ngoài.

## Cách dựng hình hiện tại và thay đổi của v2

Ứng dụng hiện tại có `CourtIllustration()` trong `frontend/src/features/auth/sign-in-layout.tsx`: SVG nội tuyến vẽ đường sân, hai chấm đại diện vị trí người chơi, quay nhẹ bằng SVG transform. Tailwind/CSS tạo bố cục và màu. Trang đã dùng UI primitives và form libraries từ D01; sự đơn giản của hình minh họa là lựa chọn thiết kế, không phải giới hạn của thư viện.

V2 dùng:

- `court-scene.svg`: hình sân chiếu phối cảnh, mặt và cạnh sân, lớp bóng, lưới, vợt có dây, cầu có các lông vũ và đường cầu. Tất cả là path, gradient, pattern và filter SVG; không dùng ảnh chụp hoặc bitmap.
- CSS: nền xanh nhiều lớp, ánh sáng nhẹ, họa tiết chấm, lớp nhãn nổi, chiều sâu và ánh sáng trên nút. Màu/form nhất quán với hai màn còn lại. Đồ họa không biểu diễn dữ liệu người dùng hoặc thành tích thật.
- JavaScript: khi dùng chuột, panel sân dịch chuyển tối đa 6 px ngang, 4 px dọc và quay tối đa 0,6°. `requestAnimationFrame` chỉ được gọi khi con trỏ di chuyển, không có vòng lặp animation chạy liên tục. Pointerleave trả hình về vị trí ban đầu.
- Chuyển trạng thái 180–280 ms, chuyển màn 240 ms; reduced motion tắt animation, parallax và các transform tương tác. Không bật parallax cho thiết bị cảm ứng.
- Mobile: thu gọn phần thương hiệu, dùng hình sân trang trí bên cạnh chữ; form theo luồng dọc. Bản mẫu chưa đo hiệu năng trên điện thoại thật.

Prototype dùng CSS/DOM/SVG gốc để duyệt thiết kế. Khi được duyệt, phần tích hợp React có thể dùng Tailwind và Motion đã có theo nhu cầu; không cần thêm thư viện đồ họa hoặc engine 3D. Font Inter, Lucide và biểu tượng thương hiệu tái dùng từ v1; nguồn/giấy phép xem `../smashpro-auth-v1/assets/SOURCES.md`.

## Trạng thái

| Hạng mục | Trạng thái |
| --- | --- |
| Dựng hướng vector thay ảnh người chơi | DONE |
| Chỉnh tương tác form, nút và phản hồi theo chuột | DONE |
| Giữ mẫu khảo sát/kết quả, thay ảnh sidebar bằng đồ họa CSS | DONE |
| Kiểm tra hiển thị và tương tác prototype | DONE |
| Duyệt thiết kế v2 | DONE — người dùng chốt 18/11/2026 |
| Tích hợp thiết kế mới vào `/sign-in` | AWAITING_REVIEW — đã triển khai, xem kế hoạch §17 |
| Triển khai khảo sát thật | DEFERRED — nhánh `feat/skill-survey` |
| Bắt đầu D02 | NOT_STARTED |

Thiết kế v2 đã được người dùng duyệt. D01 vẫn AWAITING_REVIEW sau triển khai/kiểm chứng; chờ review implementation trước khi bắt đầu D02.

## Kiểm tra đã thực hiện

Playwright + Google Chrome, server tĩnh riêng:

- **18/18 lượt hiển thị:** 3 màn × 320, 390, 768, 1024, 1440, 1920 px; không tràn ngang document; SVG tải được; mỗi màn có một h1 hiện.
- Rê chuột tạo transform trên hình sân; reduced motion đưa transform về `none` và tắt animation màn.
- Hiện/ẩn mật khẩu; gửi form chỉ hiển thị thông báo prototype, không đăng nhập giả.
- Chọn đủ 9 kỹ năng, chuyển kỹ năng, quay lại giữ lựa chọn trong bộ nhớ trang.
- Điều hướng giữa ba mẫu, nút kết quả chỉ hiển thị thông báo.
- Không có lỗi JavaScript hoặc tài nguyên HTTP lỗi trong lượt kiểm tra. Chỉ có GET tới server tĩnh cùng origin; không có request API/mutation, external request hoặc tải ảnh PNG/JPEG/WebP.
- `node --check preview.js`: PASS. Đã xem trực quan ảnh desktop/mobile của đăng nhập và ảnh khảo sát.

Kế thừa các giới hạn của v1: các bước 1/3/4/5 chưa dựng; không lưu câu trả lời qua reload, không tạo tài khoản, không tính điểm. Kết quả chỉ minh họa và có nhãn tạm thời. Đây không phải E2E ứng dụng, nghiệm thu accessibility hoặc thử nghiệm với người dùng. Không chạy lại build/lint/backend tests vì không sửa code ứng dụng.

| Màn | Desktop | Mobile |
| --- | --- | --- |
| Đăng nhập | [1440 px](previews/sign-in-1440.png) | [390 px](previews/sign-in-390.png) |
| Khảo sát | [1440 px](previews/survey-1440.png) | [390 px](previews/survey-390.png) |
| Kết quả | [1440 px](previews/result-1440.png) | [390 px](previews/result-390.png) |

Giữ nguyên v1 để so sánh; ảnh tạo trước đó không được tham chiếu ở v2 hoặc ứng dụng. Sau khi người dùng duyệt, đã tích hợp riêng trang đăng nhập D01; không cài dependencies, commit hoặc push. Chi tiết hiện tại ở [kế hoạch §17](../../architecture/plans/refactor_FE_add_lib/frontend-modernization-review-plan.md). Kết quả kiểm tra ở trên là kiểm tra prototype trước tích hợp, không phải 31 test ứng dụng của lần bàn giao mới.
