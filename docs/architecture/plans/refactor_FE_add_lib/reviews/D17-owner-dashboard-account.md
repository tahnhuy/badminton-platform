# D17 — Dashboard và tài khoản Chủ sân

19/11/2026 · DONE · không push

- Phạm vi: OwnerDashboard và OwnerAccountPage. Dùng PageHeader/ContentPanel, Button, Badge và icon hiện có; dashboard chỉ hiển thị các cơ sở/thao tác có dữ liệu thật. Không thêm số liệu doanh thu, biểu đồ, thao tác tài khoản hay API mới.
- Giữ query/facilityId, thứ tự và toàn bộ cơ sở, điều kiện hiển thị, URL, CreateFacilityPanel hiện hành, email/role Auth và signOut trực tiếp. Không đổi logic khởi tạo biểu mẫu hoặc session.
- Bỏ hai wrapper owner-main còn lại ở Owner. Admin FacilityReviewPage là consumer cuối của owner.css: chuyển import tới đó, xóa selector Owner-only hết dùng và giữ phần Admin đến D19.
- Kiểm chứng: 390/1280, rỗng/có cơ sở/tên dài, liên kết và facilityId, toggle tạo cơ sở, thông tin tài khoản/chuyển đổi mật khẩu/logout, dữ liệu Owner thật chỉ đọc. Không seed/reset dev hoặc commit artifact chạy thử.

## Bàn giao

- Dashboard dùng card cơ sở theo đúng thứ tự server, đường dẫn quản lý từng cơ sở và hai lối vào giá/lịch theo facilityId đang chọn; không thêm analytics/số liệu mẫu. Tài khoản chỉ hiển thị email/role Auth và hai thao tác hiện có.
- CreateFacilityPanel vẫn dùng lại từ D14, query/default/toggle/signOut không đổi. Không sửa backend/service/hook hoặc thêm API.
- Xóa wrapper Owner legacy cuối cùng, owner-note/list hết consumer; owner.css chỉ còn phục vụ Admin FacilityReviewPage và đã chuyển import vào trang đó, giữ đến D19. Toàn bộ nội dung Owner trong phạm vi D14–D17 dùng token/component mới, không còn phụ thuộc stylesheet này.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui **135 file/4 stylesheet**. **26 test mục tiêu PASS**: 6 Dashboard/account, 8 Owner shell và 12 Facility. Bao gồm thứ tự/tên dài/link/query, rỗng/tạo cơ sở và logout. Dev/backend thật chỉ đọc cả 5 trang Owner tại 390/1280 PASS, không tràn ngang/page error; logout 204. Không seed/reset/ghi dev hay thêm artifact vào Git.
- Chưa xác minh Safari/Firefox; không coi placeholder analytics hoặc API tương lai là đã triển khai. Tiếp theo SH03.
