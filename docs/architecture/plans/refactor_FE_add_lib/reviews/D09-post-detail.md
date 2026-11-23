# D09 — Chi tiết bài viết, bình luận/cảm xúc, composer

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền.

## Rà soát

- Hiện trạng: `PostDetailPage`, `PostComments`, `PostComposer` dùng `social.css` và `Dialog` legacy; `ReactionPicker`, `AuthorizedImage` dùng `community-primitives.css`. Lightbox ảnh và hộp thoại xóa bình luận dùng `Dialog` legacy. Nút tạo kèo/loại kèo dùng `.social-button` xám; nhãn trường dồn trong `<label>` không có gợi ý lỗi riêng.
- Góc người dùng: form tạo kèo dài, hai cột trên desktop; phần xem trước nhỏ và dễ lẫn với form; bình luận thiếu phân tách giữa các mục; nút "Báo cáo" bình luận bị vô hiệu không có giải thích hiển thị ngoài `title`.
- Consumer: `PostComposer` dùng ở Feed, sửa bài (thẻ) và Matchmaking (`/matchmaking`, D10). `RecruitmentActions` (D11) hiển thị ở cột phải trang chi tiết và còn dùng class legacy, kể cả `small` được định kiểu bởi `.social-page small`.

## Phạm vi và hướng

- Sửa: `PostDetailPage`, `PostComments`, `PostComposer`, `ReactionPicker`, `AuthorizedImage`. Thêm primitive `ui/textarea` và hook `use-return-focus` (Radix chỉ trả focus về `DialogTrigger`; các hộp thoại mở bằng state cần trả về phần tử đã mở).
- UI: PageContainer/PageHeader, panel 2xl, Button/Input/Label/Textarea/Badge/Skeleton/EmptyState, Dialog Radix (composer rộng cho tìm kèo, lightbox, xóa bình luận), icon lucide; chọn loại kèo dạng nút bật/tắt `aria-pressed`.
- Giữ nguyên: toàn bộ validation/giới hạn (2000/500 ký tự, 4 ảnh, JPEG/PNG/WebP ≤ 5 MB, khoảng trình độ, giờ Việt Nam), payload/idempotency key, `fieldset` khóa khi lưu, không đóng khi đang lưu/xóa, nhãn trường và nút, logic tải thêm/khử trùng lặp bình luận, rate-limit/`SOCIAL_DISABLED`, điều hướng sau tạo kèo chưa công khai, kiểm tra `postId` hợp lệ, `RecruitmentActions` không đổi (D11).
- Cột phải giữ kiểu `small` cho `RecruitmentActions` bằng biến thể Tailwind trên khung chứa; `RecruitmentActions` tự import `social.css`. Sau đợt này xóa selector `social.css`/`community-primitives.css` hết consumer; phần còn lại thuộc D10–D11 và `Dialog` legacy.

## Bàn giao

- Đã chuyển: `PostDetailPage`, `PostComments`, `PostComposer`, `ReactionPicker`, `AuthorizedImage` sang PageContainer/PageHeader, panel 2xl, Button/Input/Label/Textarea/Badge/Skeleton, Dialog Radix (composer, lightbox, xóa bình luận), icon lucide. Thêm `ui/textarea` và `shared/hooks/use-return-focus`. 6 file đăng ký check:ui.
- Đã xóa: 20 selector `social.css` (layout chi tiết, composer, bình luận, ảnh xem trước, file picker, rỗng…) và 7 selector `community-primitives.css` (ảnh, lightbox, reactions). `community-primitives.css` chỉ còn cho `Dialog` legacy; `social.css` còn cho Matchmaking (D10–D11). `RecruitmentActions` tự import `social.css`.
- Giữ nguyên: phần logic của `PostComposer`/`PostComments`/`PostDetailPage` giống hệt bản cũ (đã so diff; chỉ thêm id/hàm trả focus); validation/giới hạn/payload/idempotency, khóa `fieldset` và không đóng khi đang lưu/xóa, nhãn trường/nút, kiểm tra `postId`. Ghi chú "chưa công khai" đổi sang màu cảnh báo, giữ `role=status`.
- Focus: composer, hộp thoại xóa bình luận trả focus về nút đã mở; lightbox dùng `DialogTrigger`.
- Cột phải: `RecruitmentActions` (D11) giữ kiểu `small`/focus cũ qua biến thể Tailwind trên khung chứa. Hai cột chỉ từ `xl` (cũ: một cột dưới 1200 px), cột phải 26rem. Lưới `.recruitment-member` cũ (120/140 px cố định) vẫn làm tên thành viên xuống dòng ở 1280 px — đã có từ trước (cũ còn ~52 px cho tên, nay ~74 px); xử lý trong D11.
- Kiểm chứng: build PASS; lint 30 warning cũ; check:ui **94 file PASS**; **130 test UI PASS** (thêm `post-detail-ui.spec.ts` 6 test); **24 test Social PASS**; feed-ui 8 PASS.
- Backend thật: dev chỉ đọc — bài không tồn tại hiện trạng thái không khả dụng, không tràn 390/1280. `badminton_test`: đăng bài có ảnh → mở chi tiết qua liên kết bình luận → ảnh tải thật, lightbox mở/Escape trả focus → gửi rồi xóa bình luận (đếm 1 → 0) → sửa bài giữ ảnh, hiện "Đã chỉnh sửa" → xóa bài về `/feed`. Không còn bình luận/bài hoạt động trong DB test; phiên đăng xuất 204.
- Giới hạn: chưa xác minh Safari/Firefox; bài kèo thật chưa có dữ liệu (cột phải kiểm bằng API mô phỏng). Tiếp theo D10. Không push.
