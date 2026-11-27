# Seed dữ liệu mẫu và test thủ công Rating

> **Lưu ý (2026-11-27):** lệnh `npm run db:seed:ratings` và các tài khoản riêng của nó đã bị gỡ khi gộp mọi seed thành một bộ seed demo (`npm run db:reset -- --yes`, xem [`docs/plans/demo-seed-plan.md`](../plans/demo-seed-plan.md)). Seed mới có khoảng 20 trận ghép đã đấu và khoảng 170 lượt đánh giá thật giữa `player01`–`player39` và `chatok111111@gmail.com`; không còn các lô `rating.<batch>.*` với ID cố định. Các bước dưới đây mô tả bộ dữ liệu cũ và cần viết lại theo dữ liệu mới.


- Ngày: 2026-11-23
- Phạm vi: đánh giá sau trận (Rating) trên giao diện Player và Admin
- Tài liệu nghiệp vụ: [Ratings PRD](../features/matchmaking/ratings/prd.md), [Ratings Tech Design](../features/matchmaking/ratings/tech-design.md), [Business rules](../business-rules-config-matrix.md)

> **Hành vi hiện hành:** rating **không dùng để nâng trình**. `PLAYER_SKILL_ADJUSTMENT_ENABLED`
> đang là `false` và Admin không sửa được key này. Trình độ đến từ khảo sát đăng ký; chỉ
> giải đấu chuyên nghiệp mới là cơ sở nâng trình (công thức còn TBD). Vì vậy khi test, trình
> độ của người nhận đánh giá **không đổi** và mục “Lịch sử điều chỉnh trình độ” phải rỗng.
>
> Từ 2026-11-23, luồng này cũng có **thông báo nhận đánh giá** và **điểm tổng hợp trên hồ sơ**;
> xem Bước 5 và Bước 5b.
>
> Hướng dẫn cũ `docs/features/matchmaking/ratings/testing-guide.md` có bước kỳ vọng tăng bậc;
> bỏ qua kỳ vọng đó khi test theo tài liệu này.

## 1. Dữ liệu đã seed

Đã chạy trên database phát triển:

```bash
RATING_DEMO_BATCH=manual1124 npm run db:seed:ratings
```

Seed chỉ chạy với PostgreSQL local, từ chối `NODE_ENV=production`, tạo dữ liệu trong một
transaction và không xóa dữ liệu cũ. Mật khẩu chung: `Password@123`.

### 1.1 Tài khoản

| Email | ID | Vai trò | Dùng để |
| --- | ---: | --- | --- |
| `rating.manual1124.rater@example.com` | 52 | PLAYER | Đăng nhập và gửi đánh giá |
| `rating.manual1124.target@example.com` | 53 | PLAYER | Người nhận đánh giá; trình độ Mới chơi (cấp 1) |
| `rating.manual1124.partner@example.com` | 54 | PLAYER | Đồng đội; đã có 4 đánh giá lịch sử cho target |
| `rating.manual1124.opponent@example.com` | 55 | PLAYER | Đối thủ |
| `rating.manual1124.outsider@example.com` | 56 | PLAYER | Người ngoài trận, kiểm tra quyền |
| `rating.manual1124.admin@example.com` | 57 | ADMIN | Xem đánh giá và lịch sử điều chỉnh |

### 1.2 Trận và dữ liệu nền

| Trận | Loại | Dữ liệu thô | Trạng thái hiển thị trên UI |
| --- | --- | --- | --- |
| `#16` | DOUBLES | `COMPLETED` | Đã kết thúc, được đánh giá |
| `#17` | DOUBLES | `IN_PROGRESS` khi seed; scheduler đã chuyển `COMPLETED` vì giờ đã qua | Đã kết thúc, cũng được đánh giá |

`#17` được seed là `IN_PROGRESS`, nhưng scheduler và API đọc trạng thái hiệu lực theo thời gian
đã chuyển thành `COMPLETED`. Vì vậy **không dùng #17 để test trường hợp “chưa kết thúc”**.
Muốn test trường hợp đó, tạo một kèo có giờ bắt đầu trong tương lai hoặc dùng test API.

Target đang có:

- 4 đánh giá lịch sử (kỹ năng 5, thái độ 4) từ partner trên 4 trận đơn riêng;
- 0 dòng điều chỉnh trình độ;
- trình độ `Mới chơi` (cấp 1), trạng thái `Tạm thời`.

Hai trận #16/#17 mỗi trận có 4 người: rater, target, partner, opponent.

### 1.3 Batch nhiều dữ liệu để xem phân trang

Đã seed thêm batch `manual1125` với 25 đánh giá do rater gửi:

```bash
RATING_DEMO_BATCH=manual1125 RATING_DEMO_GIVEN=25 npm run db:seed:ratings
```

| Email | ID | Vai trò |
| --- | ---: | --- |
| `rating.manual1125.rater@example.com` | 58 | PLAYER có 25 đánh giá đã gửi |
| `rating.manual1125.target@example.com` | 59 | PLAYER nhận 29 đánh giá (4 lịch sử + 25 bulk) |
| `rating.manual1125.admin@example.com` | 63 | ADMIN |

Mật khẩu chung `Password@123`. Hai trận nền là `#22` (COMPLETED) và `#23`; 25 trận bulk là
`#24`–`#48`, mỗi trận đơn có link matchmaking để cột **Trận** hiển thị tên chủ kèo và giờ.

`RATING_DEMO_GIVEN` là tuỳ chọn, nhận 0–100, chỉ tạo khi batch chưa tồn tại. Chạy lại cùng
batch sẽ trả `reused: true` và không thêm bulk.

## 2. Chạy ứng dụng

Từ thư mục gốc repository:

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Seed lại cùng batch sẽ trả `reused: true` và giữ nguyên dữ liệu/đánh giá đã gửi.
  Muốn test lại từ đầu, dùng batch mới (xem §6).

## 3. Test luồng chính trên giao diện

### Bước 1 — Đăng nhập rater

1. Mở http://localhost:5173/sign-in.
2. Đăng nhập `rating.manual1124.rater@example.com` / `Password@123`.
3. Vào http://localhost:5173/matchmaking/matches (mục **Các trận của tôi**).

Kỳ vọng: thấy hai trận #16 và #17, cả hai có nhãn **Đã kết thúc**. Tiêu đề dùng cùng định
dạng với trang Hoạt động: `<tên chủ kèo> – <ngày>, <giờ bắt đầu>–<giờ kết thúc>`, dòng dưới
là loại trận **Đôi**. Với batch này, tiêu đề tương tự
`Rating manual1124 rater – 22/11/2026, 18:39–20:39`. Không còn tiêu đề dạng `Trận #<id>`.

### Bước 2 — Mở modal đánh giá

1. Mở trực tiếp http://localhost:5173/matchmaking/matches/16.
2. Trong panel **Thao tác trận đấu**, bấm **Đánh giá người chơi**.

Kỳ vọng:

- Modal **Đánh giá người chơi sau trận**, loại trận **Đấu đôi**.
- Tiến độ ban đầu: **Đã gửi 0/3 người** (target, partner, opponent).
- Rater không xuất hiện trong danh sách vì không được tự đánh giá.

### Bước 3 — Gửi đánh giá cho target

1. Tick chọn **Rating manual1124 target**.
2. Chọn **Kỹ năng 5/5**, **Thái độ 4/5**.
3. Nhập nhận xét, ví dụ `Test rating mẫu 2026-11-23`.
4. Bấm **Gửi đánh giá**.

Kỳ vọng:

- Hiện thông báo **Đánh giá đã được ghi nhận.**
- Target chuyển sang mục **Bạn đã đánh giá**, không còn trong danh sách chờ.
- Tiến độ tăng thành **Đã gửi 1/3 người**.
- Đóng modal rồi mở lại: target vẫn không nằm trong danh sách chờ.

Có thể đánh giá tiếp partner và opponent để thấy trạng thái **Đã gửi cho tất cả người chơi**
và nút đổi thành **Xem đánh giá đã gửi**.

### Bước 4 — Kiểm tra lịch sử đã gửi

1. Mở http://localhost:5173/ratings/given.
2. Tìm dòng có **Người được đánh giá** là target, **Trận #16**, kỹ năng 5 sao, thái độ 4 sao,
   nhận xét vừa nhập.
3. Tải lại trang (F5).

Kỳ vọng: dòng đánh giá vẫn còn sau khi tải lại.

### Bước 5 — Kiểm tra hồ sơ target

1. Đăng xuất, đăng nhập `rating.manual1124.target@example.com` / `Password@123`.
2. Mở http://localhost:5173/profile.

Kỳ vọng:

- **Trình độ thi đấu**: **Mới chơi**, có nhãn **Tạm thời**, không đổi so với trước khi bị đánh giá.
- Mục **Đánh giá từ người chơi** hiển thị điểm tổng hợp do người khác gửi:
  **Kỹ năng thi đấu 5.00 / 5.00**, **Thái độ thi đấu 4.00 / 5.00**, **5 lượt đánh giá**
  (4 đánh giá lịch sử + 1 vừa gửi). Danh tính người đánh giá không hiển thị.
- Nếu mở hồ sơ công khai của target từ một tài khoản Player khác, modal cũng hiển thị hai điểm
  tổng hợp này; email/phone vẫn không xuất hiện.

### Bước 5b — Kiểm tra thông báo nhận đánh giá

1. Vẫn đăng nhập target, mở http://localhost:5173/notifications hoặc bấm chuông thông báo.
2. Kiểm tra thông báo **Bạn nhận được đánh giá mới** (nhóm **Đánh giá**), nội dung cho biết
   điểm tổng hợp trong hồ sơ đã được cập nhật. Thông báo không nêu tên người đánh giá.
3. Mở thông báo, bấm **Xem chi tiết** → phải điều hướng tới `/profile`.
4. Nếu target đang mở sẵn ứng dụng, thông báo xuất hiện trong vòng tối đa 30 giây (polling).

Nếu đánh giá trùng bị gửi lại, không được tạo thêm thông báo thứ hai.

### Bước 6 — Kiểm tra trên Admin

1. Đăng xuất, đăng nhập `rating.manual1124.admin@example.com` / `Password@123`.
2. Mở http://localhost:5173/admin/users.
3. Tìm `Rating manual1124 target`, mở **Chi tiết hồ sơ người dùng**.

Kỳ vọng sau khi rater đã gửi 1 đánh giá:

| Mục | Kỳ vọng |
| --- | --- |
| `TRÌNH ĐỘ` | `Cấp 1` |
| `Đánh giá đã nhận` | `(5)` — 4 đánh giá lịch sử + 1 vừa gửi |
| Nội dung bảng nhận | Có dòng trận `#16`, kỹ năng `5/5`, thái độ `4/5`, nhận xét vừa nhập |
| `Lịch sử điều chỉnh trình độ` | `(0)` và hiện **Chưa có dữ liệu.** |

Đây là điểm xác nhận quan trọng: **rating không nâng trình**, không có dòng điều chỉnh.

### Bước 7 — Kiểm tra quyền

1. Đăng nhập `rating.manual1124.outsider@example.com`.
2. Mở trực tiếp http://localhost:5173/matchmaking/matches/16.

Kỳ vọng: không xem được trận hoặc không có nút đánh giá; outsider không thể gửi rating.
Nếu dùng API trực tiếp, người ngoài trận nhận `403 RATING_NOT_PARTICIPANT`.

### Bước 8 — Gửi trùng và đánh giá ở trận khác

- Gửi lại đúng target/trận #16: API trả `200` với target nằm trong `alreadyRated`,
  không tạo thêm dòng, không điều chỉnh trình độ.
- Rater có thể đánh giá target một lần nữa ở trận #17 (khác trận). Đây là hợp lệ:
  mỗi cặp rater–target chỉ giới hạn một lần **trong cùng một trận**.

Cách kiểm tra nhanh bằng DevTools: mở Network khi gửi rating, **Copy as fetch**, giữ cookie
phiên và header `X-CSRF-Token`, rồi gửi lại cùng payload.

### Bước 9 — Kiểm tra bảng phân trang và scroll (batch `manual1125`)

1. Đăng nhập `rating.manual1125.rater@example.com` / `Password@123`.
2. Mở http://localhost:5173/ratings/given.
3. Kiểm tra:
   - Thanh phân trang hiển thị **Hiển thị 10 trên tổng số 25 đánh giá**, bộ chọn 10/20/50
     và các nút số trang 1/2/3, trước/sau.
   - Trang 1 và 2 có 10 dòng; trang 3 còn 5 dòng.
   - Vùng bảng cuộn được **cả dọc và ngang**; header cột dính trên cùng khi cuộn dọc.
   - Cột **Trận** hiển thị dạng `<chủ kèo> – <ngày>, <giờ bắt đầu>–<giờ kết thúc>`,
     không còn `Trận #<id>`.
4. Đổi bộ chọn số dòng sang 20 hoặc 50: số trang giảm tương ứng và quay về trang 1.
5. Đăng nhập target `manual1125`, mở `/profile`: mục đánh giá tổng hợp hiển thị 29 lượt.

## 4. Kiểm tra API (tuỳ chọn)

Dùng ID thực tế từ output seed; các ID dưới đây ứng với batch `manual1124`.

Gửi rating:

```http
POST /api/v1/matches/16/ratings
Content-Type: application/json
X-CSRF-Token: <csrf_token>

{
  "ratings": [
    { "ratedPlayerId": 53, "skillRating": 5, "attitudeRating": 4, "comment": "Test rating mẫu" }
  ]
}
```

Các GET hữu ích:

- `/api/v1/matches/16/ratings/pending` — danh sách chờ và đánh giá do chính người gọi gửi.
- `/api/v1/users/53/ratings/summary` — điểm tổng hợp của target.
- `/api/v1/users/52/ratings?direction=given` — lịch sử rater đã gửi.
- `/api/v1/users/53/skill-adjustments` — lịch sử điều chỉnh, chỉ Admin gọi được.

| Ca test | Kết quả mong đợi |
| --- | --- |
| Gửi hợp lệ lần đầu | `201`, có dòng mới trong `created` |
| Gửi lại cùng target/trận | `200`, target nằm trong `alreadyRated`, không thêm dòng |
| Target là chính rater | `409 RATING_SELF_FORBIDDEN` |
| Target ngoài trận | `409 RATING_TARGET_NOT_PARTICIPANT` |
| Người gửi ngoài trận | `403 RATING_NOT_PARTICIPANT` |
| Điểm 0, 6, số thập phân hoặc thiếu tiêu chí | `400` |
| Nhận xét dài hơn 500 ký tự | `400` |
| Mảng rỗng hoặc lặp target trong cùng payload | `400` |

## 5. Kiểm tra nhanh bằng SQL (chỉ đọc)

Với Docker Compose mặc định:

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "SELECT count(*) AS ratings FROM player_ratings WHERE rated_player_id = 47;" -c \
  "SELECT count(*) AS adjustments FROM player_skill_adjustments WHERE player_id = 47;" -c \
  "SELECT p.skill_level_id, s.name FROM player_profiles p JOIN skill_levels s ON s.id = p.skill_level_id WHERE p.user_id = 47;"
```

Kỳ vọng sau khi đã gửi 1 rating: `ratings = 5`, `adjustments = 0`, trình độ vẫn là `Mới chơi`.
Nếu database của bạn dùng tên/user khác, thay tham số `psql` cho phù hợp; không chạy lệnh ghi.

## 6. Tuỳ chọn: kiểm tra code path điều chỉnh legacy

Chỉ làm nếu bạn muốn xác nhận cơ chế cũ vẫn còn trong code. **Đây không phải hành vi nghiệp vụ
hiện hành**, key này read-only trên Admin và tài liệu nghiệp vụ yêu cầu không bật lại nếu chưa có
quyết định mapping mới.

Khuyến nghị dùng batch riêng để không làm bẩn kịch bản chính:

```bash
RATING_DEMO_BATCH=legacy1123 npm run db:seed:ratings
```

Sau đó, chỉ trên database local:

```bash
# Bật tạm thời
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "UPDATE system_configs SET config_value = 'true' WHERE config_key = 'PLAYER_SKILL_ADJUSTMENT_ENABLED';"
```

- Chờ tối đa 60 giây (cache config) hoặc khởi động lại backend.
- Đăng nhập rater của batch `legacy1123`, đánh giá target ở trận `COMPLETED` (hoặc trận còn lại).
- Nếu đủ 5 đánh giá và khoảng cách bậc đạt ngưỡng, target sẽ dịch **một bậc**; Admin thấy
  `Lịch sử điều chỉnh trình độ (1)`.
- Luôn trả lại cấu hình sau khi test:

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "UPDATE system_configs SET config_value = 'false' WHERE config_key = 'PLAYER_SKILL_ADJUSTMENT_ENABLED';"
```

Chờ hết cache hoặc restart backend. Trình độ đã bị đổi bởi lần test legacy sẽ không tự hoàn tác.

## 7. Seed lại và dọn dẹp

- Chạy lại cùng batch: seed trả `reused: true`, giữ nguyên trận và đánh giá đã gửi.
- Muốn dữ liệu mới hoàn toàn: dùng batch khác, ví dụ:

```bash
RATING_DEMO_BATCH=manual1124 npm run db:seed:ratings
RATING_DEMO_BATCH=manual1126 RATING_DEMO_GIVEN=30 npm run db:seed:ratings
```

Email đổi thành `rating.manual1124.*@example.com`; lấy match ID/ID người dùng từ output seed.
`RATING_DEMO_GIVEN` chỉ áp dụng cho batch mới.

- Seed không xóa dữ liệu và không đổi system config. Không cần cleanup cho môi trường dev.

## 8. Test tự động (tham khảo)

```bash
npm test --prefix backend -- ratings.test.ts rating-adjustment.test.ts
```

Ngày 2026-11-23 chạy lại: **35/35** `ratings.test.ts`; bộ targeted ratings/notification/profile/matchmaking **90/90** PASS trên database test `badminton_test`.

Playwright:

```bash
cd frontend
npx playwright test --config playwright.sign-in.config.ts ratings-ui.spec.ts
npx playwright test ratings-real.spec.ts
```

`ratings-real.spec.ts` dùng session/API/database thật trên `badminton_test`; không dùng endpoint
test để seed database phát triển.
