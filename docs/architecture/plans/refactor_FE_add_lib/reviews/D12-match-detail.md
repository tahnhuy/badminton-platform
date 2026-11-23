# D12 — Danh sách và chi tiết trận

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền; không push.

## Phạm vi và thay đổi

- `MyMatchesPage`, `MatchDetailPage` và phần lịch/sân, người chơi, chi phí, thao tác, dialog rời trận dùng PageContainer/ContentPanel, Button/Dialog Radix, Skeleton, lucide và token chung. Hero xanh, thẻ trận, hai cột desktop/xếp dọc mobile; huy hiệu trạng thái có nền riêng để dễ đọc trên hero.
- **Ngoại lệ trình bày được người dùng duyệt 19/11:** GROUP hiện toàn bộ player API trả về theo đúng thứ tự, bao gồm nhãn Đã rời; đơn/đôi giữ đội A/B từ server. Sửa lời giải thích/xác nhận rời theo loại trận/vai trò, bao gồm mốc khóa thanh toán hiện hành. Type `teamNo` nullable phản ánh contract đang có; không đổi dữ liệu/backend.
- Giữ command rời trận nguyên văn, chống gửi trùng, chặn đóng khi bận, refresh sau xung đột, điều kiện thao tác/quyền, URL, phân trang, thứ tự, polling 5 giây/last-good và luồng mở đánh giá. Không chuyển data layer hoặc thêm thư viện.

## Cleanup

- Xóa `match-detail.css` và import sau khi hết consumer; `StateBlocks` của Matchmaking trở thành adapter nhỏ dùng EmptyState chung, bỏ inline style cũ. Xóa 5 selector danh sách trận trong ratings.css; phần modal/admin Ratings vẫn giữ đến D13.
- Đổi tên bộ test giữ nguyên 11 trường hợp thành `match-detail-ui.spec.ts` để chạy bằng cấu hình UI chung, cập nhật fixture tìm sân theo facilities từ D03 và chọn theo role thay CSS cũ. Bổ sung 8 trường hợp GROUP, cảnh báo rời, phân trang/mở đánh giá và trạng thái danh sách. Không thêm config đợt riêng hoặc ảnh/JSON/log vào Git.

## Kiểm chứng và giới hạn

- Build/lint PASS (30 warning legacy và warning bundle); check:ui 111 file, còn 5 stylesheet legacy. 165 test UI PASS; sau chỉnh lời cảnh báo, chạy lại riêng 19 test D12 PASS.
- Dev chỉ đọc danh sách ở 390/1280; backend 3010 + `badminton_test`: tạo GROUP qua API thật, xác nhận người tham gia, chốt rồi xem đủ danh sách ở 390/1280; thành viên rời qua UI → Match CONFIRMED/kèo OPEN, chủ kèo rời qua UI → CANCELLED. Không tràn ngang/page error, đã xóa bài fixture và logout 3 phiên (204); không reset/ghi dữ liệu dev.
- Chưa kiểm tra rời với booking đã thanh toán bằng dữ liệu thật (giữ nguyên backend guard); các quyền/lỗi/bận/giá 0 dùng API mô phỏng. Safari/Firefox chưa xác minh.
- Phát hiện ngoài phạm vi: Match detail API không trả thông tin sân ngoài hệ thống vào `facility/court`, nên trận đã xác nhận bằng sân ngoài vẫn hiện fallback chưa có sân. Đây là hiện trạng trước đợt, chưa sửa contract/mapping trong D12.
