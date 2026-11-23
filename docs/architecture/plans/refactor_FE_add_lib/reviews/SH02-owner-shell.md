# SH02 — Khung Chủ sân

19/11/2026 · DONE · không push

- Phạm vi: OwnerLayout/header/5 liên kết điều hướng/footer, bộ chọn cơ sở; không sửa nội dung D14–D17. Header gọn với BrandLogo chung, desktop nav có icon; mobile đủ 5 mục ở bottom nav và khoảng tránh nội dung. Giữ email và nút đăng xuất trực tiếp hiện có, không thêm menu/chức năng tài khoản.
- Giữ nguyên load facilities qua tất cả các trang API, abort/revision, chọn facilityId hợp lệ hoặc cơ sở đầu tiên, query/URL của từng link, Provider/remount theo cơ sở và signOut. Không thêm polling/session/permission hoặc data layer.
- Thay FilterToolbar của bộ chọn shell bằng NativeSelect dùng chung; giữ nhãn/option/value/onChange. Xóa owner-logo.svg và selector shell hết consumer. owner-main/owner.css vẫn là cầu nối cho nội dung legacy D14–D17, chuyển import sang OwnerUi hiện có; dọn tiếp khi consumer cuối chuyển. Không thêm CSS/override.
- Kiểm chứng: 390/1280, 5 link/active URL, deep link/ID sai/default, chọn cơ sở giữ cách thay query và remount, loading/lỗi/retry, signOut. Kiểm tra dữ liệu thật chỉ đọc; ghi test chỉ trên DB riêng; không seed/reset dev.

## Bàn giao

- Xong header/desktop nav/mobile bottom nav/footer, SkipLink và NativeSelect; đủ 5 điểm đến theo URL cũ. Header không cuộn vỡ thành mục lẻ; grid main dùng content-start để giữ chiều cao bộ chọn như trước khi shell chiếm toàn viewport.
- Đối chiếu nguyên văn khối state/effect/selection/query: không đổi. Không sửa API/backend/hook. Nội dung Account/Dashboard/Facility/Pricing/Schedule còn legacy, không coi SH02 là đã chuyển các trang đó.
- Xóa owner-logo.svg và selector app/header/brand/account/footer hết consumer; giữ owner-main và CSS nội dung trong legacy cho D14–D17, không thêm override.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui 122 file/4 stylesheet. 35 test mục tiêu PASS: 8 Owner shell và 27 Account/access/session liên quan. Fixture chấp nhận request mount lặp do StrictMode, vẫn kiểm tra đủ các trang và không lặp option; không đổi source để làm test qua.
- Dev/backend thật: tài khoản Owner mẫu đang có 1 cơ sở; bộ chọn đúng ID, đủ 5 liên kết, Account không tràn ngang/page error ở 390/1280; logout 204. Chỉ đọc, không reset/seed/ghi dữ liệu dev. Đổi giữa 2 cơ sở, ID sai, lỗi/retry và remount draft dùng API mô phỏng. Chưa kiểm chứng Safari/Firefox hoặc nghiệp vụ Owner chưa chuyển.
