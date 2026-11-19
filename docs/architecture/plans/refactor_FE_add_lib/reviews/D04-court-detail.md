# D04 — Chi tiết sân: rà soát và hướng UI

- **19/11/2026 · AWAITING_REVIEW**. Rà soát ban đầu trước sửa: đọc source/xem UI, đăng nhập tài khoản mẫu có sẵn; backend/database thật; sân 1, ngày 20/11/2026. Loading/rỗng/lỗi dùng API mô phỏng, không seed/reset hoặc tạo booking.
- Đề xuất đợt này: `/courts/:courtId` + `AvailabilityGrid`. Route chọn ngày và cơ sở chỉ kiểm tra liên kết, giữ giao diện hiện tại để làm sau; không chèn đợt mới.
- Ảnh trước: [1280](../evidence/D04-before/selected-1280.png), [390](../evidence/D04-before/selected-390.png). [Số đo/trạng thái](../evidence/D04-before/verification.json).

## Hành vi giữ nguyên

- `date` từ URL hoặc hôm nay; mặc định 60 phút; lựa chọn **60/90/120/150/180**. Đổi ngày/thời lượng xóa lựa chọn như cũ; không thêm validation, min-date hoặc giá trị mặc định mới.
- Giữ `useCourtAvailability`, service, GET `/courts/:id/availability`, tham số và polling **8 giây**; giữ last-good khi refresh lỗi. Không chuyển sang Query, đổi cache/retry hoặc chia khoảng trống thành các giờ bắt đầu mới.
- Chỉ chọn interval theo `startTime`, giữ điều kiện disabled và cách hiện nút tiếp tục; giá/backend quyết định. Giữ URL/date/startTime/durationMinutes và `forMatch`/`matchId`; không thêm bước hoặc thay luồng giữ chỗ/thanh toán.

## Nhận xét và hướng sửa

| ID · mức | Bằng chứng người dùng/thiết kế | Đề xuất chỉ ở UI |
| --- | --- | --- |
| U1 · P1 | Ảnh thật: “KHUNG GIỜ ĐÃ CHỌN 06:00–22:00” nhưng thời lượng 1 giờ, giá 80.000đ. Đây là khoảng trống 960 phút, dễ bị hiểu là thời gian đã đặt. `CourtDetailPage` phần tóm tắt đang dùng `interval.endTime`. | Tách nhãn **“Khoảng sân trống 06:00–22:00”** và **“Bắt đầu 06:00 · Thời lượng 1 giờ · Tạm tính…”**. Không đổi interval, giờ được chọn, công thức giá hoặc tham số gửi. |
| D1 · P1 | Input ngày khi focus có `outline:none`, `box-shadow:none` ở cả 390/1280; nguồn đang dùng input/select inline cao 42 px. | Input/Label và native select có focus ring rõ, vùng bấm ≥44 px, liên kết label/id; giữ value/onChange/options. |
| D2 · P2 | Nút khung giờ chỉ thể hiện chọn bằng viền/nền, không có `aria-pressed`; số đo trả `null`. | Button có trạng thái nhấn + dấu chọn/chữ để nhận biết; giữ `onSelect` và disabled. |
| U2/D3 · P2 | Thông tin sân, bộ chọn và tóm tắt rời rạc; ảnh mobile: phần chọn sát bottom nav/bong bóng, desktop dư khoảng trống. | Nhóm thông tin/bộ chọn thành card; desktop lưới giờ cạnh tóm tắt, mobile xếp dọc/chừa khoảng an toàn. Giữ CTA chỉ xuất hiện khi có lựa chọn. |
| D4 · P2 | Loading/lỗi lần đầu không có h1 (số đo 0); khoảng cách/chữ/bo góc inline, lệch `/courts` mới. | Khung tiêu đề tĩnh “Chi tiết sân” khi chưa có tên; PageContainer/PageHeader, Skeleton/EmptyState và token DS01, không thêm request. |

## Phạm vi đã được duyệt

Thay phần trình bày trong `CourtDetailPage.tsx` và `AvailabilityGrid.tsx`; tách bộ chọn/tóm tắt thành component riêng Booking nếu cần. Dùng primitive/common đã có và lucide, không thêm dependency. AvailabilityGrid chỉ có một consumer nên thay trực tiếp, không giữ bản cũ; `StateBlocks`, hook và icon còn consumer khác phải giữ. Thêm file đã chuyển vào check:ui.

Dòng “Cập nhật thời gian thực” hiện kèm đồng hồ `useNow`, không phải thời điểm API trả dữ liệu; đề xuất đổi nhãn thành **“Giờ hiện tại”**, giữ đồng hồ và polling. Cách chọn giờ bắt đầu chỉ ở đầu khoảng trống là hành vi hiện có; mọi yêu cầu mở rộng giờ chọn là backlog riêng, không sửa trong D04.

**Rà soát trước triển khai:** dữ liệu thật/đã chọn ở 390 và 1280 không tràn ngang; đổi thời lượng bỏ lựa chọn; liên kết chọn ngày/cơ sở hoạt động. Đã xem loading/rỗng/lỗi bằng fixture. Chưa tạo hold/thanh toán, chưa chạy booking-flow (có reset DB). Ở bước rà soát chưa chạy build/lint vì chưa sửa source; kết quả sau triển khai ở phần bàn giao bên dưới.

**Hướng đã chốt:** làm đúng phạm vi và bố cục/nhãn phía trên, giữ hai route phụ và toàn bộ logic như cũ; xong D04 lại dừng review.

**Quyết định 19/11/2026:** người dùng đồng ý triển khai hướng trên, yêu cầu tận dụng thư viện đã có để UI đẹp và mượt hơn. Giữ phạm vi hai component/trang và các component trình bày Booking được tách ra; không đổi hành vi/API, không thêm thư viện. D04 xong sẽ dừng review, chưa tự bắt đầu D05.

## Bàn giao 19/11/2026 — AWAITING_REVIEW

- **Đã đổi:** hero xanh với vector sân; Input/Label, native select 52 px; lưới Button có `aria-pressed`/dấu chọn, giá server và trạng thái thiếu thời lượng; bảng lựa chọn sticky desktop/xếp dọc mobile, Motion 200 ms và reduced motion. CTA desktop gọn để tránh bong bóng chat mặc định; mobile đủ khoảng tránh bottom nav. Giữ h1 khi loading/lỗi; dùng Skeleton/EmptyState chung. Link cơ sở có vùng bấm ≥44 px.
- **Kiến trúc/cleanup:** `CourtDetailPage` giữ điều phối cũ; tách `CourtDetailHeader`, `CourtTimeFilters`, `CourtAvailabilityPanel`, `CourtSelectionSummary` riêng Booking, tái sử dụng primitive/common/shared đã có. Thay trực tiếp inline UI trong page/grid; xóa `SyncIcon` không còn consumer. `StateBlocks` vẫn phục vụ SelectDate/FacilityDetail/BookingSummary/Pending/Detail/MyBookings; `MatchBookingContext` vẫn dùng nhiều trang, không xóa. Không tạo CSS mới hoặc thêm rule đè legacy; thêm 6 file vào check:ui.
- **Hành vi:** không đổi date/default 60 phút/5 lựa chọn, reset lựa chọn, fits/null-price/CTA, startTime của interval, giá hay URL/matchId; hook/service/types/utils/backend và hai route phụ không đổi so với đầu D04. Giữ polling 8 giây, last-good khi poll lỗi; không chuyển Query hoặc tính/chia giờ mới.
- **Kiểm tra:** build và lint PASS (30 warning baseline); check:ui **60 file PASS**. Bộ hồi quy API mô phỏng **99 PASS** (86 cũ + **13 D04**); chạy lại 13 D04 sau tinh chỉnh trình bày. Bao phủ defaults/options, disabled/null/multiple-price, reset ngày/thời lượng, URL/matchId, loading/error/retry/empty/invalid, keyboard/focus/reduced motion, polling 8 giây/last-good/phục hồi giá.
- **Dữ liệu thật:** tài khoản mẫu có sẵn, sân 1/cơ sở 1 ngày 20/11; khoảng trống 06–22, bắt đầu 06:00, 60 phút, **80.000đ**. Chọn/reset, liên kết ngày/cơ sở và đi tới `/bookings/new` đúng tham số ở 390/1280; không tràn ngang, CTA không bị che; đăng xuất phiên kiểm tra 204. [Desktop](../evidence/D04-after/selected-1280.png) · [mobile, vùng lựa chọn](../evidence/D04-after/selected-390.png) · [số đo](../evidence/D04-after/verification.json).
- **Giới hạn/để sau:** chưa tạo hold/thanh toán/hủy, không seed/reset; heartbeat presence bị chặn trong harness. Trạng thái khó/reduced motion/poll lỗi dùng fixture, chưa xác minh Safari/Firefox/WCAG đầy đủ. Bundle >500 kB và lint warning cũ vẫn là backlog; không sửa ngoài phạm vi.
- **Dừng:** D04 chờ người dùng nghiệm thu; chưa commit/push. D05 chưa bắt đầu: trước tiên rà soát summary/pending/detail, đề xuất bố cục, giữ nghiệp vụ/timer/API, chờ chốt hướng rồi mới sửa.

**Cập nhật 19/11/2026:** người dùng cho đóng D04 và thực hiện tuần tự toàn bộ kế hoạch, commit từng đợt, review tổng hợp cuối cùng; chỉ dừng khi có vấn đề cần quyết định/đổi hướng. D04 DONE; các nhãn chờ review phía trên là lịch sử bàn giao, không còn là điểm dừng hiện tại.
