# Ghi chú tính toàn vẹn đợt chạy 28/11/2026

- Chạy local trên working tree, base SHA ghi trong báo cáo; không commit/push, không tạo run CI hoặc chữ ký UAT.
- Lần baseline backend không coverage ban đầu được dừng để thay bằng lần full coverage đã hoàn tất 1.187/1.187; không tính lần bị dừng là pass. Các lệnh cần PostgreSQL, WebSocket và Chrome được chạy ngoài giới hạn localhost của sandbox. Lỗi môi trường ban đầu không được tính thành lỗi ứng dụng.
- Gate verify:migrations không khởi động được drizzle-kit trong sandbox; chạy lại với quyền thực thi phù hợp đã pass 45 migration/no schema diff. Artifact cuối lưu lần hoàn tất.
- Main backend chạy trong khi bổ sung tooling/test: root setup của lần này vẫn có chi phí cleanup cũ. Verification 59/59 sau đó xác nhận setup cuối và test mới; unit thuần bracket 45 ca/18ms, integration vẫn dọn DB. Không khẳng định đây là một lần full cuối trên commit đã đóng băng.
- Coverage baseline chưa gồm glob sáu validator phẳng. Unit supplement đo đủ sáu file; script kiểm tra không trùng file trước khi tổng hợp. Production source không thay đổi trong đợt này; CI cấu hình cuối cần đo chung một lần.
- Bốn tập frontend được chạy nối tiếp và phân hoạch 74 spec, 618 ca runtime. Tập remaining gồm cả mock và real; tổng 618 không được gọi là 618 real E2E.
- Log Vite có ECONNRESET khi đóng kết nối realtime trong ca block/đổi trang; không có test failure/flaky hay lỗi top-level Playwright đi kèm. Giữ log để điều tra nếu triệu chứng tái hiện ở vận hành.
- Audit backend exit 1 vì 18 advisory; đây là kết quả cần triage, không được báo tất cả gate xanh. Các test/build/lint/migration nêu trong bảng kết quả đều exit 0.
- Source-file execution coverage 115/115 và 74/74 không thay AC coverage hoặc tỷ lệ tự động hóa. `trace-links.csv` cũ phủ 47 liên kết/44 AC; danh mục hiện hành đã review 206 AC và 163 case tại `test-cases.csv` (181/184 AC có case, 135/154 case tự động hóa). Ba AC meta và 19 case chưa tự động hóa đầy đủ được ghi ở `test-case-gaps.md`.
- UAT chưa chạy theo xác nhận người dùng; 14 kịch bản và phiếu được giữ cho nhóm. CI cuối chưa hoàn tất; security triage đã có cập nhật sau bản vá bên dưới. Kế hoạch mức 5 vẫn còn mở.

## Đợt security tiếp theo

Snapshot audit 18 package findings phía trên là trước remediation. Đã vá/retest dependency theo [security-triage.md](security-triage.md), không ghi đè artifacts cũ. Backend còn 6 Moderate, frontend 0; SEC-01 Closed, SEC-02/SEC-03 Open. Giữ riêng kết quả targeted regression sau vá; không gọi đây là full CI cuối. Inventory thêm 4 ca kỹ thuật (190 file/1.417 khai báo); case catalog nghiệp vụ và tỷ lệ automation không tự tăng.
