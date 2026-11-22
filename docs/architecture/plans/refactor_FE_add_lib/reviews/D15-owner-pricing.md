# D15 — Bảng giá sân

19/11/2026 · DONE · không push

- Phạm vi: OwnerPricingPage/CourtPricing. Hiện bộ chọn sân và bảng/form dùng legacy, thông điệp snapshot chưa được phân cấp. Dùng PageHeader/ContentPanel, NativeSelect, bảng chung, OwnerForm đã chuyển D14; mobile bảng cuộn có hướng dẫn, desktop phân tách bảng và form.
- Giữ toàn bộ sân/thứ tự từ API, giá trị chọn mặc định/fallback, state editing, key remount theo sân, GET giá không polling, POST endpoint/payload/pricingId, ngày giờ/number/null và điều kiện busy. Giữ nguyên cách lưu thành công/lỗi và quy tắc giá snapshot; không thêm xóa giá, bulk hoặc tự tính giá.
- Gỡ import DataTable/FilterToolbar legacy và wrapper CSS riêng của Pricing; giữ CSS cho các consumer Owner/Admin còn lại. Không thêm dependency/CSS hoặc đổi service/backend.
- Kiểm chứng dự kiến: chọn/đổi sân và cơ sở, tạo/sửa giá, validTo null, lỗi chồng lấn giữ input, khóa khi gửi, giá 0, trống/lỗi, 390/1280; dev chỉ đọc và create/edit trên DB test riêng.

## Bàn giao

- Xong PageHeader, bộ chọn sân NativeSelect, bảng khung giá và panel tạo/sửa giá, dùng OwnerForm/Feedback hiện có. Bỏ facade DataTable/FilterToolbar và wrapper owner-main legacy của Pricing; không còn CSS riêng của trang.
- Đối chiếu state/load/selection trước–sau không đổi; service/hooks/backend không sửa. Giữ cả sân pending trong danh sách như trước, không tự lọc/đổi quyền. Giữ hành vi form uncontrolled: tạo xong không tự reset khi key không đổi, sửa xong trở lại form mới.
- Build/lint PASS (30 warning cũ, warning bundle); check:ui **128 file/4 stylesheet**. **28 test mục tiêu PASS**: 8 Pricing, 12 Facility và 8 Owner shell; có payload POST/pricingId, trim/time/number/null, lỗi overlap/busy, giá 0 và 390/1280.
- Backend thật trên DB test: Owner/cơ sở/sân từ D14, tạo khung 06:00–22:00 giá 100.000 rồi sửa 120.000; API lưu đúng và validTo null, không tràn ngang/page error 390/1280; logout 204. Dev chỉ đọc cả 5 trang Owner ở hai kích thước sau đổi, đều PASS/logout 204. Không reset/ghi dev hoặc thêm artifact chạy thử vào Git.
- Chưa kiểm chứng lại nghiệp vụ snapshot booking/thanh toán vì không đổi; Safari/Firefox chưa xác minh. Tiếp theo D16.
