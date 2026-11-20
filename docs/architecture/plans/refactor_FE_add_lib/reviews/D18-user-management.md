# D18 — Quản lý người dùng Admin

## Phạm vi và rà soát

- Chuyển bảng, thống kê, bộ lọc, menu tác vụ, phân trang và năm modal người dùng sang token/shared UI/Radix; thông báo qua Toaster Sonner hiện có.
- Góc nhìn người dùng: bảng quá rộng, tác vụ nhỏ, modal khó dùng trên mobile. Góc nhìn thiết kế: nhiều style inline và số liệu mẫu (`+12.4%`, điểm fair-play, quy mô sân) không có nguồn API. Bỏ nội dung mẫu; không tạo API/điểm mới.
- Giữ nguyên service, debounce 300 ms, chống response cũ, lọc/sort/pagination/selection, xuất `.xls` toàn bộ trang, `window.confirm` khi bulk-delete, payload/validation/defaults, điều kiện Admin và timer toast 4 giây. Modal giữ Escape/đóng bằng nút, không đóng khi bấm nền; không thêm bước thao tác.
- Shared filter/table/pager phục vụ các consumer; CSS chỉ xóa khi không còn consumer, phần Admin sân giữ tới D19.

## Kiểm chứng và bàn giao — 20/11/2026

- Build/lint/check:ui PASS (155 file, 4 stylesheet legacy); còn warning lint và bundle >500 kB, không mở rộng đợt để sửa.
- 37 ca mục tiêu Admin users/shell/Ratings: 36 đạt lần chạy chung; ca mới về phân trang Court sửa kỳ vọng theo code gốc (đổi limit giữ trang, khác User reset trang), chạy lại toàn bộ 12 ca Admin users đạt. Không đổi app để thỏa test.
- Backend thật trên `badminton_test`, không reset: đăng nhập Admin, xem danh sách/modal ở 390/1280 không tràn; tạo Player, đổi trạng thái SUSPENDED, reset mật khẩu và xóa mềm thành công. API xác nhận deletedAt được lưu trong khi status vẫn SUSPENDED đúng hành vi hiện có; logout 204, không page error.
- Đối chiếu 18 khối handler/command giữ nguyên; không đổi backend/service/dependency. Sonner adapter vẫn dùng timer 4 giây của từng page. Test thêm shared filter/pager và timer ở CourtManagementPage.
- Thay/xóa hơn 2.500 dòng trình bày cũ; format JSX, xóa toàn bộ selector filter-toolbar hết consumer. Giữ DataTable adapter/CSS bảng cho Admin review tới D19; FilterToolbar uppercase chỉ re-export để consumer D19 tiếp tục dùng. Không có hai renderer filter.
- Không thêm artifact chạy vào Git; test/log/ảnh kiểm chứng lưu ngoài repo. D18 hoàn tất kỹ thuật theo ủy quyền tuần tự; không giả nhận người dùng đã nghiệm thu thủ công.

Tiếp theo D19: quản lý sân/cơ sở và hồ sơ duyệt; giữ nguyên trạng thái, điều kiện thao tác, API/payload và logic review.
