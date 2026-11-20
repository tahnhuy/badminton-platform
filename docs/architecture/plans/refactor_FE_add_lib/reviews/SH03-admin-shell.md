# SH03 — Khung Admin

19/11/2026 · DONE · không push

- Phạm vi: AdminSidebar, AdminHeader, GlobalSearchResults và wrapper trình bày dùng chung cho 3 trang đang compose shell. Giữ state tại từng trang, không chuyển sang router layout làm state tồn tại qua navigation. Nội dung User/Court thuộc D18–D19; placeholder không trở thành chức năng thật.
- Giữ 5 URL/menu và thuật toán lọc tab, collapse/mobile callback, breadcrumb tĩnh, query/results/debounce 280 ms/click outside/chọn kết quả, cách mở/đóng/xóa tìm kiếm mobile/desktop và AdminAccountMenu. Không sửa transport/API, không thêm hủy request/cache hoặc sửa race tìm kiếm.
- Dùng BrandLogo/Button/Input, lucide, token; chiều rộng sidebar 240/68 desktop, 260 mobile, header 72 như cũ. Bỏ badge 4/chấm đỏ và email avatar mẫu tĩnh; sidebar dùng email từ Auth Context sẵn có, không thêm API. Giữ nút thông báo hiện có nhưng chưa thêm panel.
- Dọn CSS shell hết consumer; main và modal hiện có vẫn giữ vị trí/tầng bọc, không chuyển workflow hoặc mất lối vào placeholder. Kiểm chứng 390/1280, menu/collapse/filter, tìm kiếm các nhóm/URL/clear/mobile, account và dữ liệu Admin thật chỉ đọc. Không thêm dependency/artifact chạy thử.

## Bàn giao

- Xong shell/tìm kiếm, thêm AdminMain dùng chung và SkipLink tới main. Ba trang giữ state, nội dung main và overlay ở vị trí cũ; không thêm router-level persistence. Sidebar đóng trên mobile được ẩn khỏi thứ tự focus, các callback mở/đóng/điều hướng không đổi.
- Khối state/effect/debounce/click-outside/navigation của AdminHeader đối chiếu nguyên văn không đổi; admin service, HTTP transport và router không sửa. Không sửa race tìm kiếm cũ hoặc thay đường dẫn kết quả thành chi tiết ID.
- Xóa khoảng 200 dòng CSS shell, hơn 1.000 dòng style/JSX lặp; xóa DashboardIcon/MenuIcon sau xác minh hết consumer. Giữ nội dung/table/modal User/Court legacy cho D18–D19 và placeholder cho phạm vi riêng. Bỏ badge/chấm đỏ/email mẫu hard-code; không thêm chức năng thông báo.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui **139 file/4 stylesheet**. **37 test mục tiêu PASS**: 10 shell/search và 27 Account/access/session. Có collapse 240→68, mobile 5 route, filter local, debounce/trim 280 ms, nhóm/kết quả/clear/click outside và menu tài khoản.
- Dev/backend thật chỉ đọc: Admin mẫu; collapse/menu và tìm kiếm desktop/mobile PASS; q=badminton khớp API **2 user, 4 cơ sở**, Tournament/Reports rỗng. Không tràn ngang/page error tại 390/1280, logout 204. Không seed/reset/ghi dữ liệu dev hoặc thêm artifact vào Git. Chưa xác minh Safari/Firefox hay nghiệp vụ nội dung D18–D19.
