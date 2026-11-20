# D14 — Quản lý cơ sở và sân

19/11/2026 · DONE · không push

- Phạm vi: OwnerFacilityPage, tạo cơ sở dùng chung, OwnerForm, ReviewPanel và trạng thái OwnerUi. Hiện UI card/form dày, thiếu phân cấp giữa thông tin/địa chỉ/sân và thiếu vùng bấm 44 px. Dùng ContentPanel/PageHeader, Input/Textarea/Label/Button, bảng chung và token; desktop 2 cột metadata/địa chỉ, mobile xếp dọc. Không thêm ảnh mẫu, bản đồ hoặc dashboard.
- Giữ FormData/uncontrolled form, trim/number/null/time, required/maxLength, busy/disabled; điều kiện Pending/Rejected/Active/Suspended, initial/key, endpoints/payload, việc refresh/remount/select, polling 7,5 giây và review 10/trang. Không chuyển form/data layer hoặc thêm bước xác nhận thao tác.
- Tách CreateFacilityPanel khỏi Dashboard để dùng lại; Dashboard còn thuộc D17. CSS legacy chỉ giữ consumer D15–D17; dọn selector đã hết consumer, không thêm override. Shared DataTable dùng facade modern có sẵn.
- Kiểm chứng: tạo/sửa/gửi lại cơ sở, đề xuất địa chỉ, tạo/sửa/gửi lại sân, lỗi giờ/required/khóa khi bận, pending, lịch sử, 390/1280, đổi cơ sở và giữ nháp qua polling. Dev chỉ đọc; thao tác ghi chỉ trên DB test riêng.

Consumer ngoài Owner: Admin `FacilityReviewPage` còn dùng owner-main/card/actions; không xóa toàn bộ owner.css ở D17. Đã bỏ ancestor owner-main khỏi OwnerLayout và giới hạn trong wrapper display:contents của Dashboard/Pricing/Schedule/Account legacy; D17 chuyển import còn lại sang Admin review, sau đó xóa CSS khi D19 hoàn tất.

## Bàn giao

- Xong bố cục metadata/địa chỉ/sân/lịch sử và component tạo cơ sở dùng lại trong Dashboard. Giữ nguyên khối serialize/submit OwnerForm (đối chiếu nguyên văn), metadata fields, command/hook/service/backend, key phiên bản và polling 7,5 giây.
- Xóa selector owner-status/error/review/columns/aside hết consumer. Owner CSS nay import ở Dashboard legacy; wrapper chỉ đổi phạm vi trình bày, không đổi state của 4 trang chưa chuyển. Bảng modern có gợi ý cuộn ngang để thao tác trên mobile. Self-review bắt lỗi tràn khi gỡ ancestor; main grid đã khóa minmax(0,1fr)/min-width:0 và rerun đạt.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui **127 file/4 stylesheet**. **35 test mục tiêu PASS**: 12 Facility (gồm giữ nháp qua polling), 8 Owner shell và 15 Ratings hồi quy bảng chung.
- Dev chỉ đọc cả 5 trang Owner ở 390/1280: không tràn ngang/page error; logout 204. Trên `badminton_test` riêng: tạo cơ sở qua UI → pending khóa sửa → Admin từ chối → Owner sửa/gửi lại → Admin duyệt; tạo sân/duyệt/sửa sân; đề xuất địa chỉ giữ địa chỉ hiệu lực, khóa form khi chờ. API lưu đúng, logout cả 3 phiên 204. Fixture giữ lại trên DB test để dùng D15–D16; không reset/ghi dev.
- Chưa nghiệm thu Safari/Firefox hoặc luồng hủy booking/thanh toán ngoài phạm vi D14. Không thêm ảnh/JSON/log vào Git.
