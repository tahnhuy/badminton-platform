# Đối chiếu bộ metric đã cam kết

Nguồn do người dùng chỉ định: [metrics.md](../metrics.md), đọc ngày 28/11/2026. Các cột “Đạt” trong tài liệu nguồn là nội dung cam kết/tự đánh giá trước đó, không thay bằng chứng chạy của đợt này.

Danh mục case nghiệp vụ theo 12 hạng mục nằm tại [`test-cases.csv`](test-cases.csv); tỷ lệ tự động hóa và cách tính tại [`automation-summary.md`](automation-summary.md). Bảng dưới chỉ là ánh xạ nhóm suite, không phải mẫu số case.

| Hạng mục §3 | Bộ test dùng để đối chiếu | Điều kiện/giới hạn đánh giá |
| --- | --- | --- |
| 1. Xác thực/quyền | auth-endpoints, auth-middleware, session-cookie, csrf-and-rate-limit; sign-in/forced-password-change/role-based-denial | Xem status và quyền tài nguyên; phân biệt test-auth và session thật |
| 2. Hồ sơ/khảo sát | skill-survey-engine, skill-survey-api, player-profile, player-avatar; profile UI | Unit công thức được chạy độc lập; tài liệu nguồn ghi 6 nhóm cần đối chiếu phiên bản survey hiện hành |
| 3. Cộng đồng | social-posts/feed/interactions/match-finding; feed/post-detail UI | Social và Matchmaking hiện tách khu vực; cần đối chiếu mô tả demo cũ “bài tìm kèo lên bảng tin” với Project Brief |
| 4. Apply/Invite | matchmaking-applications/membership/lifecycle/payment-lock | Chốt kèo chủ động, trùng lịch, slot và các luồng lỗi |
| 5. Booking | booking-write/availability/lock-order/state-worker/cancel-refund; booking-match E2E | Phải có cạnh tranh thực, không dùng test từ chối đặt trùng tuần tự thay concurrency |
| 6. Ví/thanh toán | wallet-ledger/booking-payment/top-up; match-booking-split; payment integration | Provider MOCK đúng phạm vi cam kết; số dư và ledger kiểm tra sau thao tác/lặp/rollback |
| 7. Court Owner | owner-pricing/schedule/cancellation; owner UI; court-owner-cancel | Kết quả phía Player và hoàn tiền cần real integration/E2E |
| 8. Tournament/bracket | bracketGenerator/scheduleGenerator/placement/score; tournament-live | Unit có nhiều kích thước; demo xuyên hệ thống cần real tournament suite |
| 9. Messaging | messaging-ws-and-presence/messages-media-and-sync/conversations-and-blocks | Đã bổ sung phép đo ≤2000ms: 5 tin direct + 5 tin group; kết quả thực tế ở artifact, không suy rộng thành tải production |
| 10. Rating | ratings/rating-adjustment; ratings-real/UI | Quyền cùng trận, trùng đánh giá và cập nhật hồ sơ |
| 11. Notification | notification-producers/service/resolvers; booking/owner/admin notification | Cần event-specific assertions và idempotency |
| 12. Admin | admin-users/facilities/reports/config-api/dashboard/finance; admin UI | Real API/DB khác UI mock; cần kết quả quyền Admin và dữ liệu thật |

## Ngưỡng sử dụng

- Backend: 100% pass lúc nộp theo §4, đồng thời rubric đòi 100% pass ở CI cuối. Local pass không thay điều kiện CI.
- Type/build: 0 lỗi kiểu và build frontend/backend thành công; đây là metric hỗ trợ, không thay test nghiệp vụ.
- Toàn vẹn: không đặt trùng/không lệch số dư/slot trong kịch bản đồng thời.
- Chat: ≤2 giây. Test mới đo HTTP → real WebSocket, DB thật; sender dùng test-auth và recipient dùng session thật. Không bao gồm internet, thiết bị hoặc thời gian render trình duyệt.
- Tìm sân/availability: chưa thấy ngưỡng latency hoặc concurrency trong metrics.md; chỉ công bố baseline với dữ liệu/tải mô tả rõ.
- Coverage ≥70%, tự động hóa ≥70%, defect Critical/Blocker =0 theo rubric TC2.5; metrics.md không có ngưỡng thay thế các mục này.

## Phạm vi không cam kết và chênh lệch tài liệu

§6 không cam kết rút ví/nâng trình từ giải vì chưa có quyết định lúc lập; repository hiện đã có implementation và test cho các phần này. Đợt full regression vẫn chạy các test đang tồn tại, nhưng không tự dùng chúng để mở rộng sản phẩm cam kết với giảng viên. Cần nhóm xác nhận phiên bản cam kết cuối nếu muốn đưa vào đánh giá khối lượng.

Không chỉnh sửa metrics.md hoặc tài liệu nghiệp vụ để khớp code trong đợt kiểm thử này. Những chênh lệch phải được ghi nhận và người phụ trách tài liệu giải quyết.
