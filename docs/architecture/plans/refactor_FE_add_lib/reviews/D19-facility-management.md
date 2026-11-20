# D19 — Quản lý cơ sở/sân và duyệt hồ sơ

## Phạm vi và rà soát

- CourtManagementPage: thống kê API, filters, bảng, export, tạo và modal đình chỉ/kích hoạt; FacilityReviewPage: cơ sở/sân, lịch sử và quyết định hồ sơ/địa chỉ.
- Người dùng: bảng rộng cần vùng cuộn rõ, thao tác nhỏ, form dài thiếu nhãn/focus. Thiết kế: nhiều inline style/SVG riêng và owner.css đã hết consumer khác. Chuyển sang shared table/filter, AdminMetricCard/AdminDialog, token/lucide; bỏ đồ thị trang trí không có dữ liệu.
- Giữ nguyên services, debounce/request guard, sort/page/limit (đổi limit ở Court giữ trang), export toàn bộ 100/trang, form defaults/validation/payload, window.confirm khi vô hiệu hóa và mọi điều kiện thao tác. Review giữ polling, từng pager 10/trang, loại hồ sơ, whitelist trường, reason bắt buộc chỉ khi từ chối và callback reload.
- Modal trạng thái trước đây chỉ đóng bằng Hủy; giữ không đóng bằng Escape/nền, không thêm nút X. Ghi chú reason hiện chưa đi qua page/service; ghi backlog, không sửa. Copy chỉ mô tả tác động theo Tech Design, không hứa tự kích hoạt sân chưa duyệt.
- Dọn DataTable/FilterToolbar adapter và CSS hết consumer sau đối chiếu toàn src; không đổi provider/data layer/backend.

## Kiểm chứng

- Build/lint/check:ui PASS (163 file, 3 stylesheet legacy); 49 test Admin facilities/users, Owner facilities và Ratings PASS. Bảng mới kiểm chứng selection/pagination/modal với các consumer đã chuyển.
- Backend thật, DB `badminton_test`, không reset: Admin tạo cơ sở, đình chỉ/kích hoạt/vô hiệu hóa; Owner gửi hồ sơ, Admin từ chối → gửi lại → duyệt; duyệt sân và đề xuất địa chỉ. API xác nhận lưu trạng thái/địa chỉ; danh sách/modal/review 390/1280 không tràn sau transition; không page error, logout 204.
- Giữ service/command/state/payload và polling; reason/note của modal hiện vẫn bị page bỏ qua như trước, ghi backlog. Không sửa backend hoặc thêm dependency.
- Xóa renderer/adapter DataTable legacy, re-export FilterToolbar cũ và owner.css sau khi hết consumer. Bảng modern là implementation duy nhất; width/minWidth runtime được giữ, checkbox có nhãn. Xóa CSS admin-table/page/filter/metrics hết consumer, bỏ đồ thị SVG trang trí không có series dữ liệu.
- Shared AdminDialog thêm tùy chọn giữ policy đóng của từng modal; modal trạng thái không thêm X/Escape. Copy mô tả đúng tác động Tech Design, không hứa tự duyệt/mở bán sân chưa đủ điều kiện.
- Chỉ source/test/tài liệu duy trì được commit; output chạy ngoài repo. Hoàn tất kỹ thuật theo ủy quyền, tiếp theo D20.
