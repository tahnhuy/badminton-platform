# D24 — Bố cục lại khu Chủ sân
27/11/2026 · DONE kỹ thuật, chưa commit · không push
- Yêu cầu người dùng 27/11: bố cục Owner chưa ổn, duyệt mockup `.local-artifacts/owner-layout-prototype.html` rồi triển khai. Phạm vi: **chỉ trình bày** Owner shell, Dashboard, Quản lý cơ sở, Bảng giá, Lịch đặt. Ví và Tài khoản/Thông báo giữ nội dung.
- Rà soát: bộ chọn cơ sở là thẻ full-width chen đầu mọi trang; header (`max-w-360`) lệch main (`max-w-320`); Quản lý cơ sở là một cột dài (form → sân → hồ sơ → tiêu chuẩn → lịch sử); Lịch đặt xếp 6 khối dọc, lưới dùng màu Tailwind cứng.
## Đã đổi
- **Shell:** bộ chọn cơ sở (cùng `Select`, nhãn "Chọn cơ sở", `data-value`, query `facilityId`) chuyển lên header, hiện ở mọi trang khi có cơ sở. Header/main cùng `max-w-360` và gutter. Nav desktop dùng nhãn ngắn dưới 1536 px (tên truy cập vẫn là nhãn đầy đủ).
- **Dashboard:** "Thêm cơ sở" và lối tắt Giá/Lịch lên `PageHeader`; panel riêng bị bỏ. Chưa có cơ sở thì vẫn hiện form inline như cũ (người dùng còn đăng xuất được).
- **Quản lý cơ sở:** tab `?tab=info|courts|reviews|handover` (Radix Tabs mới ở `components/ui/tabs.tsx`; panel `forceMount` nên giữ nháp và thời điểm request). Thêm/sửa sân mở trong drawer; `?courtId=` vẫn mở đúng sân và chọn tab Sân. "Thêm cơ sở" mở drawer. Bàn giao cơ sở thành tab riêng.
- **Bảng giá:** bảng khung giá và form xếp 2 cột từ 1280 px.
- **Lịch đặt:** toolbar ngày (◀ ▶, Hôm nay, Làm mới) + nút "Khóa bảo trì" mở form trong drawer; tab Lưới / Danh sách / Lịch sử (`?tab=`). Lưới tự cuộn tới giờ mở cửa, vẫn đủ 00:00–24:00, màu dùng token, chú thích đặt trên lưới.
## Giữ nguyên
API, hook, polling, payload, validation, quyền, URL đích, nhãn/aria của các nút và trường (trừ chỗ bên dưới). Lưu sân xong drawer đóng (trước đây form đặt lại tại chỗ). Nháp form bảo trì mất khi đóng drawer (trước đây ở lại trên trang).
## Khác biệt hành vi cần lưu ý
- Thêm nút ◀ ▶ / Hôm nay ở lịch: dùng lại `changeDate`, không đổi quy tắc ngày.
- Drawer không đóng khi bấm nền (giống drawer booking cũ) để tránh mất nháp.
- Số điện thoại Owner **không thuộc D24** (cần API): làm riêng ở CO-10 (`features/court-owner/tasks.md`, PRD §14.3), ngoài phạm vi UI-only của đợt này.
## Kiểm chứng
- `npm run lint` PASS (check:ui 291 file); `tsc -b` PASS.
- E2E mô phỏng khu Owner (shell, dashboard, facilities, pricing, schedule, wallet, notifications, cancel, account, finance-shared) PASS sau khi cập nhật selector cho tab/drawer; thêm test: tab trong URL, deep link `courtId`, thêm cơ sở từ header, nút ngày, cuộn lưới tới giờ mở cửa.
- Dev (backend thật, chỉ đọc, Owner mẫu): 6 trang ở 390/1280 không tràn ngang, không page error; kiểm 1024/1536 cho header. Ghi thật chỉ qua API mô phỏng. Chưa kiểm Safari/Firefox.
