# D12 — Danh sách và chi tiết trận

19/11/2026 · AWAITING_DIRECTION · chưa sửa source D12.

## Phạm vi dự kiến

- `MyMatchesPage`, `MatchDetailPage` và component trình bày lịch/sân, đội hình, chi phí, thao tác và dialog rời trận. Đồng bộ PageContainer, token, Button, Dialog và icon đang có; desktop hai cột, mobile xếp dọc, thông tin chính dễ quét.
- Giữ service/API, polling/last-good, pagination, điều kiện thao tác, URL, quyền, validation và command rời trận. Modal đánh giá thuộc D13; CSS còn consumer phải giữ đến khi chuyển xong.
- Kiểm chứng trạng thái tải/rỗng/lỗi, quyền chủ kèo/thành viên, các trạng thái trận, rời trận đang gửi/xung đột, focus và 390/1280 px; kiểm tra backend thật trên DB test riêng. Không thêm thư viện/artifact chạy thử vào Git.

## Hai điểm cần quyết định

1. **GROUP bị mất danh sách người chơi trên UI.** `MatchInfo.tsx` chỉ lọc `teamNo === 1/2`; `RecruitmentLifecycleService.assignTeams` trả `teamNo: null` cho GROUP. Kiểm tra read-only với backend 3010, frontend 5199 và `badminton_test`: trận GROUP #1 có 3 player trong API nhưng 0 nút hồ sơ và 2 dòng “Chưa có thông tin người chơi.” trên UI. Không sửa dữ liệu, phiên kiểm tra đã logout 204.
2. **Cảnh báo rời trận không phản ánh quy tắc hiện hành.** `MatchActions`/`LeaveMatchDialog` nói mọi lần rời đều hủy cả nhóm và yêu cầu hủy booking. Tech Design §24.4 và `RecruitmentLifecycleService.withdrawLocked` phân biệt: thành viên GROUP rời trước giờ chơi thì giữ Match/mở lại tuyển người; chủ kèo rời thì hủy kèo và giữ booking (`KEEP`); thành viên đơn/đôi rời sau khi chốt thì hủy trận, booking liên quan được xử lý theo cơ chế hiện có. Nội dung UI phải dựa trên từng trường hợp; không tự sửa backend.

Đây là lỗi đã tồn tại, không do D11. Theo plan §2.1 và AGENTS §12, không tự sửa bộ lọc/phân nhóm hoặc lỗi logic trong đợt chỉ UI.

## Đề xuất để người dùng chốt

- Cho phép ngoại lệ trình bày hẹp trong D12: GROUP hiển thị một danh sách toàn bộ player API trả về theo đúng thứ tự, giữ nhãn đã rời; đơn/đôi giữ đội A/B do server trả về. Không tự chia đội/sắp xếp hoặc bổ sung người đi cùng không có trong API.
- Sửa lời giải thích và xác nhận rời trận theo loại trận/vai trò và quy tắc backend hiện hành, bao gồm thông tin booking; giữ nguyên nút, điều kiện cho phép thao tác, payload, endpoint và kết quả thực tế.
- Nếu chưa duyệt ngoại lệ: chỉ đổi style, giữ bộ lọc/nội dung cũ và ghi hai lỗi vào backlog. Chưa triển khai phương án nào khi đang chờ quyết định.
