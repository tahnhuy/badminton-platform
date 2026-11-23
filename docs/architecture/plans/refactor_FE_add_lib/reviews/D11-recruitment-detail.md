# D11 — Chi tiết kèo, xin tham gia/mời, lời mời

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền; không push.

## Phạm vi và thay đổi

- Chuyển 7 file: `MatchmakingRequestDetailPage`, `MatchmakingInvitationsPage`, `RecruitmentActions`, `ApplicationPanel`, `CandidateList`, `RecruitmentEdit`, `InvitationList` sang PageContainer/PageHeader, primitive shadcn/Radix, icon lucide và token chung. Bỏ lưới thành viên cố định, tên dài được xuống dòng; vùng bấm trong phần chuyển đổi tối thiểu 44 px.
- Thêm `components/common/confirm-dialog.tsx`, dùng lại tại Matchmaking và PostComments; thêm 5 biến thể Button theo token. `DialogContent.closeDisabled` là prop tùy chọn mặc định false; D11 truyền busy để giữ nút đóng bị vô hiệu hóa khi xử lý như dialog cũ. Giữ focus return, Escape/backdrop và chặn đóng khi bận.
- Giữ điều kiện quyền/hiển thị, validation/giá trị mặc định, phân trang (9 ứng viên, 10 lời mời/yêu cầu), polling/refresh, payload/URL và điều kiện khóa trường `MATCHMAKING_FIELD_LOCKED`. Đối chiếu các khối command/load/save với HEAD: không thay đổi. Backend, service, hook dữ liệu và types không sửa.
- Self-review đã sửa: khôi phục điều kiện `!resource.error` cho liên kết Xem bài viết ở header; bỏ sticky cột phải chi tiết bài viết vì danh sách dài có thể không cuộn hết. Nút Hủy của RecruitmentEdit gọi cùng onClose hiện có; không thêm thao tác nghiệp vụ.

## Cleanup

- Xóa `social.css` sau khi kiểm tra hết consumer; bỏ khỏi cấu hình legacy. Đăng ký 8 file mới chuyển vào check:ui.
- Theo quyết định đã ghi 19/11, thay bộ `matchmaking.spec.ts` lỗi 9/9 từ baseline bằng test cho luồng hiện hành; xóa config chỉ phục vụ bộ cũ và `RequestFormModal.tsx` (không consumer). Phần rời trận tiếp tục có `match-detail.spec.ts` và được rà soát trong D12. Cập nhật hướng dẫn test Profile, không để lệnh hiện hành trỏ tới config đã xóa.
- Không thêm ảnh, JSON hoặc log chạy thử vào Git; chỉ giữ mã nguồn/test và báo cáo này.

## Kiểm chứng và giới hạn

- Build/lint PASS (30 warning cũ, cảnh báo bundle cũ); check:ui **105 file PASS**, còn 6 stylesheet legacy. **146 test UI PASS** (10 test chi tiết kèo); **24 test Social PASS**. Sau tinh chỉnh kích thước vùng bấm, chạy lại 10 test chi tiết kèo. Có regression cho lỗi refresh giữ dữ liệu cũ và khóa đóng dialog khi request đang chờ.
- Dev/backend thật: tài khoản mẫu, chỉ đọc; hộp thư lời mời đúng trạng thái và không tràn ngang ở 390/1280. Lần chạy đầu harness dùng nhầm tên tiêu đề; đã sửa đúng nhãn hiện có và chạy lại riêng phần dev PASS, không sửa ứng dụng vì lỗi harness.
- Backend riêng **3010 + badminton_test**, frontend 5199: chủ kèo và 2 Player đăng ký đầy đủ; tạo GROUP công khai → tìm/gửi lời mời → chấp nhận → xin tham gia → chủ kèo duyệt → kiểm tra trường bị khóa → khai báo sân → chốt sớm → hủy. Tất cả PASS, 390/1280 không tràn ngang; không có page error. Xóa bài test và đăng xuất cả 3 phiên (204); không seed/reset hoặc ghi dữ liệu dev. Lượt mới tạo fixture chỉ trên DB test, không đổi API/backend.
- Safari/Firefox và realtime end-to-end chưa xác minh. Các tình huống lỗi/đang gửi dùng API mô phỏng. D12 sẽ rà soát riêng danh sách/chi tiết trận; không sửa luồng rời trận trong D11.
