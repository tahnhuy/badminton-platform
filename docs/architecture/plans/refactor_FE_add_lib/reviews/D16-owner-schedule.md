# D16 — Lịch Chủ sân và chi tiết booking

19/11/2026 · DONE · không push

- Phạm vi: OwnerSchedulePage, MaintenanceForm, OwnerHistory, BookingDetailPanel. Dùng PageHeader/ContentPanel, bảng chung, NativeSelect/Input/OwnerForm và Dialog dạng drawer. Giữ lịch phẳng đúng thứ tự court/slot server, không tự chuyển sang lịch nhóm, lọc/sắp xếp hoặc API khác.
- Giữ ngày mặc định Việt Nam, các điều kiện xem booking/mở khóa, blockId/payload, busy/refresh, dữ liệu liên hệ/TOURNAMENT, status/refund/giá, lịch sử 10/trang và lọc reset trang 1, polling 7,5 giây, key/remount và form bảo trì giữ nháp khi đổi sân nhưng reset khi đổi ngày.
- Drawer giữ Escape/nút đóng, chặn đóng bằng backdrop như cũ, không tự bổ sung return focus (lỗi cũ); giữ màn chi tiết chỉ đọc, không thêm UI hủy booking dù backend có endpoint. Không thay nghiệp vụ/cách lấy dữ liệu.
- Cleanup: bỏ wrapper/import shared legacy của Schedule/History/Maintenance, xóa selector fields/dialog/grid/slot-actions/primary hết consumer; giữ Owner CSS cho Dashboard/Account và Admin FacilityReview. Chia sẻ helper focus trình bày với RatingModal, không nhân bản phần xử lý Tab khi content đang được focus.
- Kiểm chứng: 390/1280, thứ tự/nhãn lịch, ngày/refresh, bộ lọc/phân trang/chi tiết, riêng tư Tournament, block/unblock đúng payload, lỗi/busy/polling và drawer bàn phím; dev chỉ đọc, ghi trên DB test riêng.

## Bàn giao

- Xong lịch/bảo trì/lịch sử và drawer booking. Dialog có variant side dùng lại, không đổi default center/sheet; helper focusDialogEdge dùng chung với Ratings giữ thứ tự Tab ban đầu. Các khối state/read/selection và SlotInfo đối chiếu nguyên văn không đổi; API/hooks/backend không sửa.
- Xóa selector owner-fields/dialog/grid/slot-actions/primary và media nhánh hết consumer; còn Dashboard/Account/Admin review dùng Owner CSS. Giữ ResourceState/Feedback/Pager dùng chung, không thêm bộ table/form thứ hai.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui **133 file/4 stylesheet**. **54 test mục tiêu PASS**: 11 Schedule, 8 Pricing, 12 Facility, 8 Owner shell và 15 Ratings. Bao gồm riêng tư Tournament, giữ thứ tự slot, giá 0, payload block/unblock, draft khi đổi sân/ngày, polling lỗi/giữ dữ liệu, filter reset trang và drawer Escape/backdrop/focus.
- Dev chỉ đọc cả 5 trang Owner ở 390/1280 PASS, không page error, logout 204. Trên `badminton_test`: khóa 06:00–07:00 qua UI → mở khóa cả block qua UI; Player tạo hold riêng để Owner xem lịch/chi tiết ở 390/1280, liên hệ và giá từ API hiển thị đúng, backdrop không đóng/Escape đóng. Đã hủy hold test bằng Player API và logout 2 phiên 204; không reset/ghi dev.
- Giới hạn cũ được giữ: drawer không trả focus về nút mở; chưa có UI hủy booking Owner. Không thêm các hành vi đó trong D16. Chưa xác minh Safari/Firefox hoặc nghiệp vụ hoàn tiền/realtime ngoài phạm vi.
