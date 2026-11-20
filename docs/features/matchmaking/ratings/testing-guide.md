# Hướng dẫn test Rating với dữ liệu mẫu

Tài liệu hỗ trợ kiểm thử triển khai hiện tại; quy tắc nghiệp vụ thuộc [PRD](prd.md), [Tech Design](tech-design.md) và [business rules](../../../business-rules-config-matrix.md).

## 1. Chuẩn bị và seed

Chạy từ thư mục gốc repository, sau khi cài dependencies và cấu hình `backend/.env` theo README:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed:ratings
npm run dev
```

Seed chỉ chấp nhận PostgreSQL local và từ chối `NODE_ENV=production`. Toàn bộ dữ liệu của một batch được tạo trong một transaction. Không cần chạy seed tổng; không xóa dữ liệu hay thay đổi system config hiện có.

Lệnh in ra email, user ID, match ID, URL hai trận và cấu hình điều chỉnh trình độ đang áp dụng. Mật khẩu chung: `Password@123`.

| Email (batch mặc định) | Mục đích |
| --- | --- |
| `rating.default.rater@example.com` | Đăng nhập gửi đánh giá |
| `rating.default.target@example.com` | Nhận đánh giá; bắt đầu ở Mới chơi |
| `rating.default.partner@example.com` | Thành viên trận; đã gửi đánh giá lịch sử cho target |
| `rating.default.opponent@example.com` | Thành viên còn lại |
| `rating.default.outsider@example.com` | Kiểm tra người ngoài trận |
| `rating.default.admin@example.com` | Xem đánh giá và lịch sử điều chỉnh |

Có một trận đôi `COMPLETED` và một trận đôi `IN_PROGRESS`, mỗi trận gồm rater, target, partner, opponent. Target có sẵn `minRatings - 1` đánh giá lịch sử, kỹ năng 5, thái độ 4; mặc định là 4 đánh giá. Những dòng lịch sử được chèn làm fixture, chưa chạy điều chỉnh trình độ. Lần gửi mới qua ứng dụng sẽ kiểm tra điều chỉnh thật.

Chạy lại cùng batch trả lại các trận đã tạo, giữ nguyên kết quả test. Muốn test lại từ đầu, tạo batch mới:

```bash
RATING_DEMO_BATCH=round2 npm run db:seed:ratings
```

Email batch mới có dạng `rating.round2.rater@example.com`. Batch gồm 1–32 ký tự chữ thường, chữ số hoặc dấu `-`.

## 2. Test trên giao diện

1. Mở `http://localhost:5173/sign-in`, đăng nhập tài khoản rater.
2. Mở URL trận `COMPLETED` do seed in ra. Chọn **Đánh giá người chơi**.
3. Chọn `Rating default target`, kỹ năng **5**, thái độ **4**, nhập nhận xét `Test rating mẫu`, gửi.
4. Kiểm tra thông báo thành công, target chuyển vào **Bạn đã đánh giá** và không còn trong danh sách chờ. Trong trận đôi, cả đồng đội và đối thủ đều có thể được đánh giá; không có bản thân rater.
5. Mở `/ratings/given`, kiểm tra nhận xét và hai điểm vừa gửi; tải lại trang, dữ liệu vẫn còn.
6. Đăng nhập target, mở `/api/v1/users/<targetId>/ratings/summary` trên cùng origin của frontend để kiểm tra điểm tổng hợp qua API (trang hồ sơ chưa được tích hợp). Với cấu hình mặc định, target có 5 lượt đánh giá, kỹ năng trung bình 5, thái độ trung bình 4. Kiểm tra trình độ tăng từ **Mới chơi** lên **Yếu** (một bậc) trong chi tiết người dùng của admin ở bước tiếp theo.
7. Đăng nhập admin, mở `/admin/users`, tìm `Rating default target`, mở chi tiết. Kiểm tra đánh giá nhận và một dòng lịch sử điều chỉnh với `ratingsConsidered = 5`, rank 1 → 2.
8. Trở lại rater, mở trận `IN_PROGRESS`: chưa được gửi rating. Đăng nhập outsider và thử URL trận hoàn tất: không được đánh giá.

Nếu cấu hình hiện tại tắt điều chỉnh hoặc đặt threshold lớn hơn khoảng cách rank, việc không tăng trình độ là đúng. Seed in cấu hình thực tế và không ghi đè cấu hình. Kỳ vọng tăng bậc ở bước 6 áp dụng cấu hình mặc định. Với cooldown mặc định 14 ngày, đánh giá mới tiếp theo không làm tăng thêm bậc ngay.

## 3. Kiểm tra API và lỗi biên

Dùng DevTools Network khi gửi trên UI để lấy request thật; **Copy as fetch** rồi thay payload để test. Giữ cookie phiên và header `X-CSRF-Token`; thiếu chúng sẽ bị chặn trước khi đến kiểm tra rating. Dùng ID từ kết quả seed, không cố định ID giữa các database.

Request chính: `POST /api/v1/matches/<completedMatchId>/ratings`:

```json
{
  "ratings": [
    { "ratedPlayerId": 14, "skillRating": 5, "attitudeRating": 4, "comment": "Test rating mẫu" }
  ]
}
```

`14` chỉ là ví dụ; thay bằng ID target thực tế.

| Ca test | Kết quả mong đợi |
| --- | --- |
| Gửi hợp lệ lần đầu | 201, có dòng mới trong `created` |
| Gửi lại cùng target và trận | 200, nằm trong `alreadyRated`; không thêm dòng hoặc điều chỉnh lần nữa |
| Target là chính rater | 409 `RATING_SELF_FORBIDDEN` |
| Target là outsider | 409 `RATING_TARGET_NOT_PARTICIPANT` |
| Người gửi là outsider | 403 `RATING_NOT_PARTICIPANT` |
| Trận đang `IN_PROGRESS` | 409 `MATCH_NOT_COMPLETED` |
| Điểm 0, 6, số thập phân hoặc thiếu một tiêu chí | 400 |
| Nhận xét dài hơn 500 ký tự | 400 |
| Mảng rỗng hoặc lặp target trong cùng payload | 400 |

Các GET hữu ích:

- `/api/v1/matches/<matchId>/ratings/pending`: danh sách chờ và đánh giá do chính người gọi gửi.
- `/api/v1/users/<targetId>/ratings/summary`: điểm tổng hợp, không lộ danh tính người đánh giá.
- `/api/v1/users/<raterId>/ratings?direction=given`: lịch sử đã gửi, dùng phiên rater.
- `/api/v1/users/<targetId>/skill-adjustments`: lịch sử điều chỉnh, dùng phiên admin.

## 4. Test tự động

```bash
npm test --prefix backend -- ratings.test.ts rating-adjustment.test.ts
```

Backend dùng database riêng `badminton_test` ở localhost:5433 theo cấu hình Vitest. Các test có cơ chế reset dữ liệu test.
Chạy backend và Playwright tuần tự vì cả hai dùng và reset cùng database này.

```bash
cd frontend
npx playwright test --config playwright.sign-in.config.ts ratings-ui.spec.ts
# Separate real-session suite (uses/reset test DB):
npx playwright test ratings-real.spec.ts
```

Playwright tự khởi động backend E2E và frontend; giải phóng cổng 3000 trước khi chạy. Cần trình duyệt Chrome theo `frontend/playwright.config.ts`. `ratings-real.spec.ts` kiểm tra phiên đăng nhập thật, lưu rating, tải lại lịch sử và admin xem điều chỉnh. Fixture E2E riêng chỉ hoạt động trên `badminton_test`; không dùng endpoint test để seed database phát triển.

`ratings-ui.spec.ts` (đổi tên trong D13) chạy API mô phỏng, không khởi động/reset backend. Bộ này cũng kiểm tra Tab/Shift+Tab được giữ trong modal, kể cả lúc gửi khi toàn bộ điều khiển bị vô hiệu hóa; các nút sao có `tabIndex=-1` không tham gia thứ tự Tab.
