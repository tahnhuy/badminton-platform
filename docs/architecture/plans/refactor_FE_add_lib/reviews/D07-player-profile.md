# D07 — Hồ sơ và thông tin liên hệ

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền.

Phạm vi: trang hồ sơ, form tên/ảnh, thẻ và dialog hồ sơ công khai, trang liên hệ. Giữ provider/API, giới hạn tên 2–50 ký tự, MIME/dung lượng ảnh 2 MB, lưu ảnh ngay, điều kiện hiện điểm (≥3 lượt), null/không khả dụng, trình độ chỉ xem, quyền nhắn tin và cách điều hướng hiện tại. Không triển khai khảo sát/nâng trình hoặc đổi validation/request behavior.

Hướng UI: PageContainer/PageHeader, panel và primitive chung, icon lucide, bố cục hồ sơ xanh đồng bộ; dialog Radix thay focus trap thủ công, giữ cách đóng/mở và focus như cũ. Xóa profile.css chỉ sau khi chuyển đủ consumer; không thêm ảnh/JSON kiểm chứng vào Git.

Baseline: bộ profile cũ có 10 pass/4 fail trước sửa. Hai test modal thiếu Auth/Router trong harness; hai test shell còn kỳ vọng trang chủ và shortcut cũ của SH01. Sửa harness/assertion theo shell đã duyệt, giữ các kiểm tra nghiệp vụ tên/ảnh/race/privacy.

## Bàn giao

- Đã chuyển: `PlayerProfilePage`, `ProfileSections`, `ProfileNameForm`, `ProfileAvatarControl`, `PlayerProfileCard`, `PlayerProfileModal`, `PlayerProfileButton`, `PlayerContactPage` sang PageContainer/PageHeader/ContentPanel, primitive shadcn và lucide. Thêm `ProfileAvatar` (dùng chung trong feature) và primitive `components/ui/progress.tsx` (consumer: `ProfileSections`). 9 file đăng ký check:ui.
- Đã xóa: `profile.css`, `ProfileAssets.tsx` và 11 asset `public/images/profile/*`; không còn consumer. `useModalA11y` vẫn giữ cho 10 modal khác chưa chuyển.
- Giữ nguyên: provider/API/hook, giới hạn tên 2–50, MIME/2 MB, lưu ảnh ngay, điều kiện hiện điểm, trạng thái null/không khả dụng, trình độ chỉ xem; liên hệ giữ trim, để trống → `null`, `maxLength` 40, chặn gửi trùng, lỗi server và nút Tải lại; điều kiện nút Nhắn tin. Breadcrumb `href="/"` giữ như cũ.
- Focus dialog: Radix thay focus trap; Escape/nút Đóng/backdrop đóng như cũ; giữ Shift+Tab đầu tiên về điều khiển cuối. Khi đóng **không** trả focus về nút mở — giống hook cũ, không đổi hành vi; ghi backlog nếu muốn bổ sung.
- Test: baseline 10/14 PASS (4 lỗi harness/assertion SH01 cũ). Sửa harness thêm Auth/Router; 2 test shell đổi sang `/feed` + menu tài khoản của SH01; các kiểm tra tên/ảnh/race/privacy giữ nguyên. Thêm 4 test liên hệ (390/1280, lỗi validation, chặn gửi trùng).
- Kiểm chứng: build PASS (warning bundle cũ); lint PASS 30 warning cũ; check:ui **83 file PASS**; **14 test hồ sơ PASS**; **toàn bộ 116 test UI PASS** trên source cuối.
- Backend thật: dev chỉ đọc (chặn ghi) — hồ sơ/liên hệ đúng dữ liệu, không tràn ngang 390/1280. `badminton_test` riêng: tài khoản test thiếu `player_profiles` nên lần chạy đầu thất bại; đã thêm hồ sơ chỉ trong DB test, rồi chạy lại PASS: lưu/reload tên, lưu số điện thoại, hồ sơ công khai không lộ `phone`/`email`, tên và số được khôi phục (kiểm tra DB). Cả hai phiên đăng xuất 204, không có page error.
- Giới hạn: chưa thử upload ảnh với backend thật (dùng API mô phỏng); chưa xác minh Safari/Firefox. Tiếp theo D08. Không push.
