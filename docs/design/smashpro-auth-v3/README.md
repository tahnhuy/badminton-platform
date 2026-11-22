# SmashPro — bản mẫu v3: khảo sát trình độ và màn kết quả

Ngày: **2026-11-22**. Trạng thái: **APPROVED (2026-11-22)** — chuẩn trải nghiệm cho AUTH-31; giữ radar.

Bản mẫu HTML/CSS/JS độc lập cho toàn bộ luồng `/register` mới: 4 bước khảo sát (đủ 16 câu của version 1), bước tạo tài khoản có phần xem lại, và màn kết quả. Kế thừa phong cách v2 (DS01, Inter, xanh #006B2C, panel xanh rừng). Không cần backend, npm hay mạng.

## Mở và thử

```bash
python3 -m http.server 5181 --bind 127.0.0.1 --directory docs/design
```

Mở **http://localhost:5181/smashpro-auth-v3/**. v3 dùng font và icon của `../smashpro-auth-v1/assets/`, nên giữ cả thư mục `docs/design/`.

- Nút **Bản mẫu v3** (góc dưới trái, mobile: góc trên phải) điền nhanh 6 ví dụ của PRD rồi nhảy tới bước 5; nhập mật khẩu bất kỳ ≥ 8 ký tự để xem kết quả.
- Email `taken@smashpro.vn` mô phỏng lỗi email đã dùng.
- Tải lại trang giữa chừng: câu trả lời và bước hiện tại được giữ (sessionStorage, không lưu mật khẩu).
- Bật reduced motion trong hệ điều hành/DevTools để xem bản không chuyển động.

## Trải nghiệm đã dựng

| Phần | Chi tiết |
| --- | --- |
| Khung | Thanh 5 bước bên trái (bấm quay lại bước đã qua), thẻ nội dung bên phải, ước lượng "Còn khoảng N phút". Mobile: thanh tiến trình 5 đoạn dính trên cùng, nút Quay lại/Tiếp tục dính dưới cùng. |
| Chuyển bước | Trượt + mờ theo hướng (150 ms ra, 260 ms vào); focus chuyển tới tiêu đề bước. |
| Bước 1 | Câu 1 dạng dòng thời gian có thanh lấp đầy; câu 2 dạng cột buổi/tuần; câu 3 thẻ có icon; câu 4 tự ẩn (thu gọn mượt) và xóa câu trả lời khi chọn "Dưới 6 tháng". |
| Bước 2 | 9 kỹ năng, mỗi kỹ năng một **hình minh họa vector có đường cầu chuyển động** (giao cầu, phông, đập, bỏ nhỏ, thủ, tạt, trái tay; bộ pháp và đánh đôi nhìn từ trên). Thanh 9 ô có dấu tick. Chọn bằng chuột/chạm thì **tự sang kỹ năng chưa trả lời kế tiếp**; phím `1`–`4` chọn nhanh; vuốt ngang trên mobile; mũi tên trái/phải để chuyển khi không đứng trên ô chọn. |
| Bước 3–4 | Giữ cầu: hàng quả cầu tăng dần (mức cao nhất có biểu tượng tấn công); thể lực: thanh pin; thành tích: bục huy chương 5 cấp. |
| Kiểm tra bắt buộc | Bấm Tiếp tục khi thiếu câu: báo "Còn N câu…", viền đỏ các câu thiếu, cuộn và focus câu đầu tiên, rung nhẹ (tắt khi reduced motion). Ở bước 2 nhảy tới kỹ năng đầu tiên chưa chọn. |
| Bước 5 | Form tài khoản (checklist mật khẩu đổi trạng thái khi gõ, lỗi gắn từng trường) + **Xem lại câu trả lời** theo bước, mỗi bước có nút "Sửa". Nút gửi có trạng thái đang xử lý. |
| Kết quả | Thang 7 bậc lấp dần từng nấc tới bậc của người chơi; huy hiệu bật lên (spring); tên bậc hiện lên; pháo giấy một lần; thẻ điểm mạnh/cần cải thiện xuất hiện lần lượt; giải thích G1/G2 viết theo hướng tích cực; bấm từng bậc để xem mô tả; nút "Tìm kèo trình độ …". Tải lại vẫn thấy kết quả (mô phỏng `GET /players/me/skill-survey`). |

Điểm, bậc và luật chặn được tính bằng `engine.js` theo matrix §1.2 — đúng cả 6 ví dụ của PRD (#2 nêu "Độ ổn định giữ cầu" như tiêu chí nghiệm thu AUTH-31). Trong ứng dụng thật phần này do server làm; `survey-data.js` tách riêng dữ liệu chỉ server được biết (`SCORING`).

## Cần người dùng duyệt

| # | Nội dung | Ghi chú |
| --- | --- | --- |
| 1 | Toàn bộ trải nghiệm v3 làm chuẩn cho AUTH-31 | Thay phần khảo sát/kết quả của v2 |
| 2 | **Biểu đồ radar 6 tiêu chí** ở màn kết quả | **Đã duyệt giữ (2026-11-22)**, đã thêm vào PRD (Result screen). Dùng `components` có sẵn trong response, không đổi API |
| 3 | Bước xem lại trong bước 5 | Chỉ là giao diện, không đổi nghiệp vụ |
| 4 | Route riêng cho màn kết quả (ví dụ `/welcome/skill`) | Cần thêm vào bảng route `frontend.md` |
| 5 | Câu chữ thẻ điểm mạnh/cần cải thiện và giải thích G1/G2 | Là copy frontend; G1/G2 giữ nguyên câu PRD và thêm một câu động viên |

## Khi chuyển sang React (AUTH-31)

- Câu hỏi/lựa chọn lấy từ `GET /auth/skill-survey`; frontend không giữ bản sao nội dung khảo sát. Phần trình bày riêng (icon câu 3, số quả cầu câu 14, cấp huy chương câu 16, hình minh họa kỹ năng) ánh xạ theo **mã câu hỏi/mã lựa chọn**, có giao diện mặc định khi gặp mã lạ.
- Dùng RHF + zod theo bước, Radix RadioGroup, Motion (chuyển bước, thang bậc, huy hiệu), `canvas-confetti` tải động; hình kỹ năng là component SVG trong `features/auth/register/`.
- Trang đăng ký và màn kết quả tải bằng `lazy()`.

## Kiểm tra đã chạy (Playwright + Chrome)

26/26 kiểm tra đạt, không lỗi JavaScript hay tải tài nguyên:

- Thiếu câu → tô đỏ và báo lỗi; câu 4 ẩn, xóa câu trả lời và hiện lại đúng điều kiện.
- Focus chuyển tới tiêu đề bước; chọn đủ 9 kỹ năng nhờ tự chuyển.
- Tải lại giữ bước và câu trả lời, hiện banner tiếp tục.
- Bước 5: báo lỗi trường khi để trống; email trùng vẫn giữ đủ 16 câu; mật khẩu không bị lưu.
- Kết quả đúng với ví dụ #1, #2 (kèm G1) và #5; vẫn thấy kết quả sau khi tải lại.
- Không tràn ngang ở 1440 và 390 px.
- Reduced motion bỏ animation SVG.

Đã xem ảnh desktop/mobile các bước và màn kết quả.

**Giới hạn:** đây là bản mẫu để duyệt trải nghiệm, không phải E2E ứng dụng hay nghiệm thu accessibility đầy đủ. Chưa thử trên điện thoại thật, Safari hoặc Firefox. Các con số trong mô hình vẫn là giả định của đề tài (báo cáo nghiên cứu §7).
