# D10 — Danh sách và tạo yêu cầu tìm kèo `/matchmaking`

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền.

## Rà soát

- Hiện trạng: `MatchmakingPage` và `RequestListCard` dùng inline style/biến legacy, emoji làm icon, tab là nút không có trạng thái `aria-pressed`, phân trang tự dựng, hộp thoại hủy dùng `Dialog` legacy. Tạo kèo đã dùng `PostComposer` (chuyển ở D09).
- `StatusPill`/`Countdown` (inline style) dùng chung cho danh sách, lời mời, trận của tôi và chi tiết trận. Nội dung tab "Lời mời" (`InvitationList`) và "Yêu cầu đã gửi" (`ApplicationPanel`) thuộc D11.
- Phát hiện ngoài phạm vi: `e2e/matchmaking.spec.ts` (cập nhật lần cuối 19/10, trước luồng Social/tuyển người 01/11) lỗi **9/9 ngay trên baseline**; kiểm tra text/luồng cũ không còn tồn tại. `RequestFormModal.tsx` (318 dòng) không còn consumer nhưng là đối tượng của một test trong bộ đó. Chờ người dùng quyết định; D10 không sửa/xóa hai phần này.

## Bàn giao

- Đã chuyển: `MatchmakingPage` (PageContainer/PageHeader, nhóm tab và hướng lời mời `aria-pressed`, Skeleton/EmptyState, `Pagination` chung, hộp thoại hủy Radix trả focus), `RequestListCard` (thẻ có tên truy cập, icon lucide thay emoji, Button). Tách `StatusPill`/`Countdown` sang `MatchStatus.tsx` (Tailwind, cùng nhãn/màu theo nhóm trạng thái) và cập nhật 4 consumer; `StateBlocks.tsx` chỉ còn `StateBlock` cho trang chưa chuyển. 3 file đăng ký check:ui.
- Giữ nguyên: logic trang giống hệt (so diff), polling chỉ ở tab kèo, 10 kèo/trang và cập nhật trang dạng hàm, URL tab, hai hướng lời mời, nút "Tìm người" vẫn mở chi tiết kèo, điều kiện hiện nút, nội dung/hành vi hủy (thông báo lỗi trên trang và trong hộp thoại, không đóng khi đang hủy), tạo kèo mở composer và chuyển tới bài. `ApplicationPanel` tự import `social.css`.
- Đổi nhãn: nút đầu trang "+ Tạo yêu cầu" → icon + "Tạo yêu cầu" (cùng hành động với nút ở trạng thái rỗng); selector trong `social.spec.ts` đổi theo.
- Kiểm chứng: build PASS; lint 30 warning cũ; check:ui **97 file PASS**; **136 test UI PASS** (thêm `matchmaking-list-ui.spec.ts` 6 test); **24 test Social PASS**; `matchmaking.spec.ts` vẫn 9/9 lỗi như baseline.
- Backend thật: dev chỉ đọc — 0 kèo, ba tab không tràn 390/1280. `badminton_test`: tạo kèo chưa công khai từ `/matchmaking` → thẻ hiện "Đang tìm người" → hộp thoại hủy (Quay lại trả focus) → xác nhận, thẻ "Đã hủy" → xóa bài để dọn. Đăng xuất 204, không page error.
- Giới hạn: bộ đếm hiển thị phút tuyệt đối cho hạn xa (ví dụ "Còn 38371830:37") — định dạng cũ, giữ nguyên. Chưa xác minh Safari/Firefox. Tiếp theo D11. Không push.
