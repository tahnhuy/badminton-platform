# D08 — Bảng tin cộng đồng `/feed`

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền.

## Rà soát

- Hiện trạng: `FeedPage`, `FeedFilters`, `SocialPostCard`, `SocialUi` dùng `social.css` (`@layer legacy`), `FilterToolbar` và `Dialog` legacy; menu bài viết là `<details>` không có quản lý focus/Escape; chip lọc có nút xóa không có tên truy cập; 3 cột cố định 232/1fr/256 px.
- Góc người dùng: thẻ bài kèo dồn thông tin thành các dòng chữ giống nhau (giờ, sân, trình độ, chỗ) nên khó quét; nút hành động và trạng thái cùng màu xám; bộ lọc dài, select nền xám thiếu nhãn hiển thị.
- `social.css` còn consumer: `PostComposer`, `PostComments`, `PostDetailPage` (D09) và Matchmaking (D10–D11). `Notice` có 8 consumer; `AuthorizedImage`/`ReactionPicker` dùng `community-primitives.css`.

## Phạm vi và hướng

- Sửa: `FeedPage`, `FeedFilters`, `SocialPostCard`, `SocialUi` (`Notice`, `AuthorRow`). Thẻ bài cũng hiển thị ở trang chi tiết; bố cục trang chi tiết, composer, bình luận, picker cảm xúc và lightbox ảnh thuộc D09.
- UI: PageContainer/PageHeader, panel bo 2xl, Button/Badge/Input/Label/Skeleton/EmptyState chung, icon lucide; bộ lọc có nhãn hiển thị, mobile dùng sheet Radix; chip lọc có nút bỏ lọc có tên; menu bài viết dùng DropdownMenu Radix; hộp thoại xóa dùng Dialog Radix; thẻ kèo trình bày dạng danh sách có icon.
- Giữ nguyên: khóa lọc/URL, tự gán `type=MATCH_FINDING` khi có bộ lọc kèo, trim, draft chỉ áp dụng khi bấm; `useFeed` (asOf, khử trùng lặp, retry trang sau, refresh khi quay lại tab); 3 kèo ở cột phải và các liên kết; điều kiện hiển thị sửa/xóa/báo cáo/Quản lý kèo; nội dung cảnh báo xóa, `bookingAction` và chặn đóng khi đang xóa; trạng thái `SOCIAL_DISABLED`; nhãn/ký tự hiện có.
- `Notice` chuyển sang Tailwind nhưng giữ kiểu cho `small`/`strong` con để consumer chưa chuyển không vỡ. `social.css` giữ lại; chỉ xóa selector không còn consumer sau khi kiểm tra.

## Bàn giao

- Đã chuyển: `FeedPage`, `FeedFilters`, `SocialPostCard`, `SocialUi` sang PageContainer/PageHeader/ContentPanel/EmptyState, Button/Badge/Input/Label/Skeleton, Dialog (sheet mobile, xác nhận xóa) và DropdownMenu Radix, icon lucide. Thẻ kèo hiển thị giờ/sân/trình độ/chi phí dạng danh sách có icon; chip lọc có nút "Bỏ lọc …" có tên. Select rỗng hiển thị "Tất cả" (giá trị gửi đi vẫn rỗng). 4 file đăng ký check:ui.
- Đã xóa: `assets/ellipsis.svg`; 59 selector `social.css` hết consumer (layout feed, rail, thẻ, menu `<details>`, notice, ảnh, avatar…). `social.css` còn giữ cho composer/bình luận/chi tiết (D09) và Matchmaking (D10–D11); `PostComposer`/`PostComments` tự import để không phụ thuộc trang. `FilterToolbar`/`Dialog` legacy còn consumer khác.
- Giữ nguyên: logic lọc/URL/trim/tự gán `type`, `useFeed`, 3 kèo ở cột phải và liên kết, điều kiện sửa/xóa/báo cáo/Quản lý kèo, nội dung cảnh báo xóa và `bookingAction=KEEP`, không đóng hộp thoại khi đang xóa, `SOCIAL_DISABLED`, nhãn `👍 Thích` (thay bằng icon làm trùng tên với nút "Thích" trong picker nên đã giữ emoji).
- Focus: menu mở/đóng bằng bàn phím, Escape trả focus nút "Thao tác bài viết"; hộp thoại xóa trả focus về nút đó (Radix chỉ tự trả về `DialogTrigger`, nên trả thủ công); sheet lọc mobile trả focus nút "Lọc bài viết".
- Test: baseline Social 23/24 — test "NULL legacy schedule" lỗi từ `397f985` (fixture thiếu `isOwner`); đã bổ sung `isOwner: true`, giữ assertion. 3 selector menu đổi `button` → `menuitem`; bỏ ảnh chụp `/tmp` trong test. Thêm `feed-ui.spec.ts` 8 test (390/1280, chip, sheet, rỗng, menu/xóa/focus/busy, báo cáo, reaction/lỗi trình độ).
- Kiểm chứng: build PASS (warning bundle cũ); lint 30 warning cũ; check:ui **87 file PASS**; **124 test UI PASS**; **24 test Social PASS** (gồm Matchmaking dùng `Notice`). Chạy lại feed-ui 8 + Social 24 + build/lint sau chỉnh cuối.
- Backend thật: dev và `badminton_test` chỉ đọc — feed rỗng, trạng thái rỗng, không tràn 390/1280, không page error. `badminton_test` ghi: đăng bài qua composer → thẻ hiện trong feed → thả "Yêu thích" (1 cảm xúc) → xóa qua menu/hộp thoại mới → biến mất sau reload (bài xóa mềm). Các phiên đăng xuất 204.
- Giới hạn: thẻ kèo/ảnh/chip chỉ xem với API mô phỏng (DB không có bài kèo); chưa xác minh Safari/Firefox. Bong bóng chat có thể che nội dung cuối thẻ trên mobile — thuộc D22. Tiếp theo D09. Không push.
