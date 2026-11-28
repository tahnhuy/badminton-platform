# Thu gọn tổng quan tài chính — 27/11/2026

Phạm vi được người dùng chốt: giảm mật độ thẻ tại `/admin/finance/overview` theo đề xuất trong phiên làm việc. Trước thay đổi có 12 KPI và tối đa 5 thẻ giải đấu cùng mức nhấn mạnh, khiến số liệu chính và việc cần xử lý khó phân biệt.

Đã thay bố cục bằng 4 KPI chính (số dư ví, tiền vào, tiền ra, doanh thu ròng ước tính). Khả dụng/tạm giữ nằm trong thẻ số dư. Ba hàng tác vụ được gom trong “Cần xử lý”, nhấn mạnh số mục có phát sinh và liên kết tới các trang tài chính hiện có. Chi tiết doanh thu và lệ phí giải đấu dùng disclosure native, mặc định thu gọn; lệ phí ròng vẫn hiện trong tóm tắt. Toàn bộ số liệu cũ còn truy cập được; bảng xu hướng, bộ lọc, xuất Excel và API/service giữ nguyên. Không thêm dependency hoặc sửa component dùng chung; KpiCard còn consumer ở các tab khác nên được giữ.

Kiểm chứng: frontend build và lint/check:ui qua (còn warning sẵn có về hooks/Fast Refresh và kích thước bundle). Playwright kiểm tra desktop 1280px, mobile 390px, mở chi tiết, số liệu, liên kết và chống tràn ngang bằng API mô phỏng. Backend localhost:3000 không hoạt động nên chưa xác minh dữ liệu thật; không seed/reset dữ liệu. Kết quả: 55 bài hồi quy qua; bài mobile mới ban đầu lỗi bộ chọn trùng nhãn với navigation, đã sửa selector và chạy lại qua (tổng 56 bài được xác minh). Không commit/push trong yêu cầu này.

## Điều chỉnh bảng xu hướng — 27/11/2026

Người dùng duyệt riêng: ngày mới nhất trước; nhãn “Doanh thu gộp” và chú thích chưa trừ hoàn tiền; hiển thị khoảng ngày/giờ Việt Nam; ẩn ngày tương lai khi xem “Tháng này”; thêm tổng toàn kỳ. Đây là thay đổi thứ tự và phạm vi hiển thị được yêu cầu rõ ràng, không áp dụng cho tab báo cáo hoặc API. Tổng tính từ toàn bộ chuỗi ngày trong kỳ hiển thị, độc lập phân trang. Các cột tiền/tiêu đề căn phải và chia chiều rộng rõ ràng, loại khoảng trắng lớn sau số doanh thu như ảnh phản hồi. DataTable có thêm slot footer tùy chọn (`tfoot`); các consumer không truyền footer giữ giao diện hiện tại. Không đổi công thức số liệu hoặc service/backend.

Kiểm chứng lượt này: build và lint/check:ui qua; đã bổ sung kiểm tra tháng hiện tại với đồng hồ cố định theo giờ Việt Nam tại 390/1280px, thứ tự ngày, tổng và căn lề. Playwright: 57 bài qua trong lượt hồi quy; bài phân trang ban đầu dùng fixture 30 ngày nhưng endDate chỉ tới ngày 20, đã đồng bộ endDate của fixture và chạy lại qua. Tổng 58 bài được xác minh, bao gồm hai bài mới 390/1280px. Giới hạn kiểm chứng dữ liệu thật giữ như trên.

Theo yêu cầu tiếp theo, dòng “Tổng toàn kỳ” được ghim đáy vùng cuộn bằng sticky cells, nền đặc và viền trên. Playwright 4/4 qua ở 390/1280px, gồm kiểm tra vị trí dòng tổng khi cuộn đầu/giữa/cuối bảng và phân trang; build, lint/check:ui qua. Không đổi cách tính tổng.

## Nhãn tham chiếu và danh tính giao dịch — 27/11/2026

Theo yêu cầu riêng của người dùng, bảng `/admin/finance/transactions` dịch `TOURNAMENT_REGISTRATION:44` thành “Đăng ký giải đấu #44” và hiển thị tên/email thay ID. API danh sách bổ sung `userName`/`userEmail` từ left joins với users và hồ sơ Player/Owner hiện có; không thay mã lưu trữ, bộ lọc, phân trang hoặc thao tác tiền. Tên được ưu tiên, email hiển thị phụ hoặc thay tên; chỉ dùng ID dự phòng khi thiếu cả hai. Contract bổ sung đã ghi trong Finance Tech Design. Build backend/frontend và lint/check:ui qua; 5 bài UI mục tiêu qua (mock API). Kiểm thử API thật chạy trên DB test riêng kiểm tra tài khoản có/không có tên: 1/1 bài mục tiêu qua (16 bài khác không chạy). Không thay dữ liệu dev.

## Đồng bộ danh tính toàn bộ bảng tài chính — 27/11/2026

Người dùng yêu cầu áp dụng mẫu người dùng ở tab Giao dịch cho các bảng còn hiển thị ID trong khu vực Finance. Đã dùng `FinanceUser` chung cho Giao dịch, Nạp tiền, Chi trả, Hoàn tiền, hai bảng Thu nhập chủ sân, người thực hiện trong lịch sử ví/Nhật ký thao tác, Báo cáo theo chủ sân và đối tượng ví trong Đối soát; thẻ chủ ví cũng ưu tiên tên/email. ID giao dịch/booking/tham chiếu và metadata truy vết không bị đổi thành danh tính người dùng. Trường hợp không có người thực hiện hiển thị “Hệ thống”; thiếu tên dùng email, thiếu cả hai mới dự phòng ID.

API bổ sung trường danh tính từ một batch lookup cho mỗi trang; không thêm request HTTP, dependency hay migration, không đổi lọc/sắp xếp/phân trang, xuất Excel hoặc nghiệp vụ tiền. Contract đã cập nhật Finance Tech Design. Component mới đã đăng ký check:ui. Kiểm chứng: build frontend/backend và lint/check:ui qua; backend 18/18 bài trên DB test riêng qua. UI 20 bài qua trong lượt chính, bài ví 390px đã đóng gợi ý bằng Escape trong test và chạy lại qua; tổng 21 bài được xác minh, gồm 16 trường hợp bảng ở 390/1280px và hồi quy Giao dịch/Chi trả/Thu nhập/Ví/Nhật ký. Không seed/reset DB dev, không commit/push.

Theo yêu cầu tiếp theo, nút “Chạy đối soát” hiển thị toast “Đã chạy đối soát thành công.” sau phản hồi thành công còn hiệu lực. Không thông báo thành công khi vào trang tự tải, đang chờ, request cũ hoặc lỗi; kết quả có chênh lệch vẫn là một lần chạy thành công. Build, lint/check:ui và 2/2 bài Playwright mục tiêu (thành công/lỗi, có kiểm tra trạng thái đang chờ) qua. API và dữ liệu đối soát giữ nguyên.

Theo yêu cầu tiếp theo, bảng Báo cáo theo ngày sắp ngày giảm dần trước khi phân trang, đưa ngày mới nhất lên đầu. Nhóm theo nguồn/chủ sân, API và xuất Excel giữ nguyên. Build, lint/check:ui và 4/4 bài UI mục tiêu qua, gồm thứ tự xuyên trang, báo cáo chủ sân 390/1280px và tổng báo cáo.

Theo ảnh phản hồi, đã căn lại bảng Nhật ký thao tác: chia độ rộng 5 cột rõ ràng, cho phép xuống dòng tại thời gian/danh tính/hành động/đối tượng, phân bổ thêm chỗ cho metadata. FinanceValue có chế độ compact chỉ dùng ở audit: bộ lọc lồng nhau xếp thành lưới 2 cột thay vì kéo dài theo chiều dọc, giữ toàn bộ trường dữ liệu. Build, lint/check:ui và 6/6 bài UI mục tiêu qua, gồm 390/1280px, kiểm tra chiều cao dòng mẫu dưới 190px và hồi quy chi tiết giao dịch dùng FinanceValue mặc định. Không đổi API hoặc dữ liệu nhật ký.

## Áp dụng mẫu Excel đã duyệt — 27/11/2026

Đã áp dụng mẫu gọn cho 7 loại xuất Excel Finance: Giao dịch, Nạp tiền, Chi trả, Hoàn tiền, Doanh thu, Dòng tiền và Đối soát. Tách formatter riêng tại `finance-export-template.ts`; phần truy vấn/bộ lọc/cách tính gốc giữ nguyên. Tiêu đề bảng hàng 8, KPI nhỏ, nền xanh/so le, nhãn tiếng Việt, tên/email kèm ID, giờ Việt Nam, ô tiền số và công thức tổng có cached results; không cộng cột số dư hoặc tổng các loại chênh lệch. Báo cáo theo ngày xếp mới nhất trước. Giữ sheet Tổng hợp, mở mặc định sheet dữ liệu; sheet Payout đổi tên Chi trả. Không dùng dữ liệu mẫu trong file xuất thật. Cập nhật contract bố cục trong Finance Tech Design.

Kiểm chứng: backend build qua; 17 bài Excel độc lập qua; bộ hồi quy finance-admin 18 bài qua và bài download API được chạy lại với assertion bố cục mới qua. Kiểm thử phát hiện chênh lệch âm đang là chuỗi đã escape; formatter đã chuyển đúng thành ô số và kiểm thử âm qua. Đã tạo 7 workbook qua service thật với fixture mô phỏng và mở/xuất PDF bằng LibreOffice; xem bố cục Giao dịch/Dòng tiền và chỉnh căn KPI để không dính số với ô kế bên. Kết quả tạm ở /tmp; không thay DB dev, không commit/push.

Theo chỉnh sửa tiếp theo của người dùng, toàn bộ tổng quan/chỉ số/tổng tiền/bộ lọc/thông tin xuất/ghi chú chỉ nằm ở sheet Tổng hợp. Sheet dữ liệu chỉ có bảng: tiêu đề hàng 1, dữ liệu hàng 2, cố định một hàng tiêu đề; bỏ khối đầu, dòng tổng và ghi chú cuối bảng. Cách tính tổng backend giữ nguyên. Build backend, 17/17 bài Excel và bài tải file qua API trên DB test đều qua.
