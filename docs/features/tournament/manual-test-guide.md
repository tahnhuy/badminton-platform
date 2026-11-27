# Hướng dẫn test thủ công chức năng Giải đấu

Tài liệu hỗ trợ kiểm thử triển khai hiện tại trên giao diện. Quy tắc nghiệp vụ thuộc [PRD](prd.md), [Tech Design](tech-design.md) và [business rules](../../business-rules-config-matrix.md).

## 1. Chuẩn bị

Chạy từ thư mục gốc repository, sau khi đã cấu hình `backend/.env` theo README:

```bash
docker compose up -d
npm run db:reset -- --yes   # sao lưu, xoá sạch, migrate và seed bộ dữ liệu demo (~45 giây)
npm run dev
```

- Dữ liệu giải đấu nằm trong bộ seed demo chung (`backend/src/db/seed/steps/10-tournaments.ts`), cùng với tài khoản, ví, đặt sân, ghép trận… Xem [`docs/testing/demo-accounts.md`](../../testing/demo-accounts.md).
- Seed từ chối `NODE_ENV=production`; lệnh `db:reset` **xoá toàn bộ DB dev** (có sao lưu vào `~/db-backups/`).
- Ngày giờ tính theo lúc chạy seed: "hôm qua", "ngày mai" luôn đúng với lúc test.
- Frontend: <http://localhost:5173>, backend: <http://localhost:3000>.

Mật khẩu chung của mọi tài khoản: `123456`.

## 2. Tài khoản dùng trong tài liệu này

| Email | Vai trò | Dùng để |
| --- | --- | --- |
| `chatok111111@gmail.com` | Player — Trung bình khá | Organizer giải 5 (READY) và 14 (DRAFT); có lời mời vào đội ở giải 7; đã đấu giải 1 và 2 |
| `player09@smashpro.vn` | Player (Organizer) | Organizer giải 4 (đang thi đấu, có 1 trận đang đánh) |
| `player18@smashpro.vn` | Player (Organizer) | Organizer giải 11 (đã đóng đăng ký, chờ bốc thăm) |
| `player19@smashpro.vn` | Player (Organizer) | Organizer giải 12 (mới 1 người đăng ký) |
| `player04@smashpro.vn` | Player (Organizer) | Organizer giải 6 (có lệ phí, đang mở) |
| `player13@smashpro.vn` | Player (Organizer) | Organizer giải 8 (miễn phí, đang mở) |
| `player02@smashpro.vn` | Player (Organizer) | Organizer giải 1 (đã kết thúc) — test chia sẻ kết quả |
| `player21@smashpro.vn` | Player — Trung bình khá | Người chơi thường: đăng ký / rút giải đơn |
| `player22@smashpro.vn` | Player | Thử đăng ký giải đã đủ người |
| `player24@smashpro.vn` | Player | Tạo đội mới, mời đồng đội, link mời |
| `player32@smashpro.vn` | Player | Đội trưởng `Đội Mây Trắng` (đủ 2 người, chưa đăng ký) ở giải 7 |
| `player37@smashpro.vn` | Player — Mới chơi | **Ví 0đ**: test "ví chưa đủ tiền" |
| `player12@smashpro.vn`, `player06@smashpro.vn`, `player08@smashpro.vn` | Player — Mới chơi / Giỏi / Yếu | Ngoài khoảng trình độ của giải 9 (Trung bình yếu – Trung bình khá) |

> Trình độ có thể đổi sau các giải đã kết thúc (điểm phong độ tự lên/xuống bậc). Trình độ ghi ở bảng là trạng thái sau khi seed.
| `admin@smashpro.vn` | Admin | Trang quản trị giải, huỷ giải, tính lại phong độ |

## 3. Dữ liệu seed

ID là ID trên database vừa reset (`npm run db:reset`). Nếu khác, tìm theo tên trong `/tournaments` hoặc `/admin/tournaments`.

| ID | Tên giải | Trạng thái | Dùng để test |
| --- | --- | --- | --- |
| 1 | Giải đơn mùa thu Phúc Thịnh 2026 | COMPLETED | Vô địch, nhánh đấu, bài chia sẻ kết quả, nhóm chat, hồ sơ, bảng xếp hạng Đơn |
| 2 | Giải đôi giao hữu Tân Bình | COMPLETED | Nhánh đôi, bảng xếp hạng Đôi |
| 3 | Giải đơn tối thứ 6 (đã huỷ) | CANCELLED | Trạng thái huỷ, 3 người được hoàn 80.000đ |
| 4 | Giải đơn cuối tuần Hoàng Thành | IN_PROGRESS | Vòng 1 đã đánh hôm qua; **1 trận đang đánh**; các trận còn lại đã dời sang ngày mai |
| 5 | Giải đơn tháng 12 · CLB của Tài | READY | Nhánh đấu (6 người, có BYE), lịch, sửa lịch có cảnh báo, bắt đầu trận |
| 6 | Giải đơn mở rộng Quận 7 · tháng 12 | OPEN | Có lệ phí 150.000đ, đăng ký / rút hoàn 100%, ví không đủ |
| 7 | Giải đôi nam nữ Bình Thạnh | OPEN | 2 đội đã đăng ký, 1 đội đủ người chưa đăng ký, 1 đội đang ghép (lời mời chờ `chatok111111@gmail.com`) |
| 8 | Giải đơn giao lưu miễn phí · Quận 10 | OPEN | Đăng ký / rút miễn phí |
| 9 | Giải đơn trình Trung bình (giới hạn trình độ) | OPEN | Chặn trình độ ngoài hạng 3–5 |
| 10 | Giải đơn thách đấu 1-1 (đã đủ người) | OPEN | Đã đủ 2/2, không đăng ký được |
| 11 | Giải đơn cúp CLB Tân Bình (chờ bốc thăm) | REGISTRATION_CLOSED | Sửa hạt giống, bốc thăm, sinh nhánh + lịch |
| 12 | Giải đơn sáng chủ nhật (mới 1 người) | OPEN | Đóng đăng ký khi chưa đủ người → tự huỷ + hoàn phí |
| 13 | Giải đơn tối thứ 3 · Phú Nhuận | OPEN | Admin huỷ giải có phí và hoàn tiền (2 người) |
| 14 | Giải đôi Tết 2027 (bản nháp) | DRAFT | 404 với người khác; quyền xem của Organizer/Admin; form thiết lập |

## 4. Kịch bản test trên giao diện

### 4.1. Khách chưa đăng nhập

1. Mở `/tournaments`. Kiểm tra danh sách, tìm theo tên, lọc trạng thái (`Tất cả`, `Đang mở`, `Sắp đấu`, `Đang đấu`, `Đã xong`), lọc `Miễn phí`, phân trang.
2. Giải nháp (14) không xuất hiện. Mở trực tiếp `/tournaments/14`: phải là trang "Không tìm thấy giải đấu".
3. Mở `/tournaments/1`: xem được thông tin, người tham gia, nhánh đấu, lịch thi đấu. Không có nút đăng ký; hệ thống mời đăng nhập.
4. Mở `/tournaments/rankings`: chuyển tab Đơn/Đôi, lọc theo trình độ.

### 4.2. Player — giải đơn

Đăng nhập `player21@smashpro.vn`.

1. Mở `/tournaments/8` (miễn phí). Bấm **Đăng ký** → xác nhận. Nút đổi thành **Rút đăng ký**, số người tham gia tăng.
2. Mở `/tournaments/mine?role=registered`: giải vừa đăng ký xuất hiện.
3. Bấm **Rút đăng ký** → xác nhận. Số người giảm; giải miễn phí nên ví không đổi.
4. Mở `/tournaments/6` (lệ phí 150.000đ). Bấm **Đăng ký**: dialog hiển thị số dư ví, lệ phí và hạn hoàn tiền. Xác nhận → ví giảm 150.000đ.
5. Mở `/wallet`: có giao dịch thanh toán lệ phí. Quay lại giải, **Rút đăng ký** → ví được hoàn 150.000đ.
6. Đăng nhập `player37@smashpro.vn` (ví 0đ). Mở `/tournaments/6` → **Đăng ký**: dialog báo "Ví chưa đủ tiền" và có nút **Nạp ví**; không tạo đăng ký.
7. Đăng nhập `player12@smashpro.vn` (Mới chơi). Mở `/tournaments/9`: hiển thị không đủ điều kiện trình độ, nút đăng ký bị chặn. Làm lại với `player06@smashpro.vn` (Giỏi) và `player08@smashpro.vn` (Yếu) — đều bị chặn.
8. Đăng nhập `player22@smashpro.vn`. Mở `/tournaments/10`: giải đã đủ 2/2, không đăng ký được.
9. Mở `/tournaments/14` khi đang là `player22`: 404. Đăng nhập `chatok111111@gmail.com` (Organizer): mở được `/tournaments/14` và `/tournaments/14/manage`.
10. Vẫn là `chatok111111@gmail.com`, mở `/tournaments/5`: Organizer không được tự đăng ký giải của mình.

### 4.3. Player — giải đôi (giải 7)

1. Đăng nhập `chatok111111@gmail.com`, mở `/tournaments/mine?role=invited`: có lời mời vào `Đội Bình Minh`.
2. Mở giải 7 → khu **Đội của bạn**: **Chấp nhận** hoặc **Từ chối**. Chấp nhận → đội đủ 2 người; từ chối → đội trưởng vẫn đang ghép đội.
3. Đăng nhập `player32@smashpro.vn`, mở giải 7: `Đội Mây Trắng` đã đủ 2 người. Đội trưởng thấy **Đăng ký đội · 200.000đ**; đăng ký → đội `REGISTERED`, ví trừ 200.000đ. Rút đăng ký (chỉ đội trưởng) → hoàn 200.000đ.
4. Đăng nhập `player24@smashpro.vn`, mở giải 7: tạo đội mới, tìm đồng đội theo tên, gửi lời mời, tạo link mời. Mở link `/tournaments/join/<token>` bằng tài khoản khác để vào đội.
5. Kiểm tra: mỗi người chỉ ở một đội trong cùng giải; đội phải đủ 2 người mới đăng ký được; sau khi đăng ký, thành viên bị khoá.

### 4.4. Organizer console

Mở `/tournaments/mine?role=organized` bằng Organizer của giải tương ứng (bảng mục 2), chọn giải → **Quản lý**.

1. **Giải 14 — Thiết lập** (`chatok111111@gmail.com`): sửa tên/mô tả/lịch, lưu; bấm **Mở đăng ký** (cần địa điểm và hạn đăng ký ở tương lai). Trạng thái chuyển `OPEN_FOR_REGISTRATION`.
2. **Giải 11 — Hạt giống & bốc thăm** (`player18@smashpro.vn`): xem gợi ý hạt giống, sửa số hạt giống (liên tục từ 1), **Lưu hạt giống**; bấm **Bốc thăm & xếp lịch**. Nhánh đấu xuất hiện, BYE dành cho hạt giống cao; giải chuyển `READY`.
3. **Giải 5 — Lịch thi đấu** (`chatok111111@gmail.com`): xem bảng sân × giờ. Sửa một trận trùng sân/giờ với trận khác → lưu được nhưng hiện cảnh báo. Chạy lại xếp lịch → trận đã bắt đầu/đã xong được giữ nguyên.
4. **Giải 5 — Trận đấu**: bấm **Bắt đầu** một trận, sau đó **Nhập tỉ số**. Thử tỉ số không hợp lệ (21–20, 23–20, 31–29) → báo lỗi; tỉ số hợp lệ (21–19, 22–20, 30–29) → lưu được; người thắng đi tiếp.
5. **Giải 4 — Đang thi đấu** (`player09@smashpro.vn`):
   - Nhập tỉ số cho trận đang `IN_PROGRESS`.
   - **Sửa kết quả** một trận vòng 1 khi trận kế tiếp chưa bắt đầu → sửa được; sau khi trận kế tiếp bắt đầu → bị khoá.
   - Thử **Walkover**, **Bỏ cuộc**, **Huỷ trận** trên các trận còn lại.
   - Đánh hết các trận, vào **Kết thúc giải** → xác nhận; kiểm tra vô địch, điểm xếp hạng và trạng thái `COMPLETED`.
6. **Giải 6 — Người tham gia** (`player04@smashpro.vn`): bấm **Loại** một người, nhập lý do → người đó bị loại, được hoàn 150.000đ và nhận thông báo.
7. **Giải 8 — Huỷ giải** (`player13@smashpro.vn`): **Thiết lập** → **Huỷ giải**, nhập lý do → `CANCELLED`; người đã đăng ký nhận thông báo (miễn phí nên không hoàn tiền).
8. **Giải 12 — Đóng khi chưa đủ người** (`player19@smashpro.vn`): bấm **Đóng đăng ký**. Vì chỉ có 1 người, giải tự huỷ và hoàn 50.000đ thay vì chuyển `REGISTRATION_CLOSED`.
9. Kiểm tra các nút bị khoá theo trạng thái: không sửa hạt giống sau khi bốc thăm; không loại người sau khi bốc thăm; không sửa loại kết quả sau khi giải kết thúc (chỉ sửa tỉ số trong 48 giờ, trận chung kết được đổi người thắng).

### 4.5. Kết quả, hồ sơ, Social, chat, thông báo

1. Đăng nhập `player02@smashpro.vn` (Organizer giải 1), mở `/tournaments/1`: thấy vô địch, nhánh đấu, tỉ số; có nút **Chia sẻ kết quả** (nhà vô địch đã chia sẻ sẵn một bài). Chia sẻ → mở `/feed`, thấy bài `TOURNAMENT_RESULT`; thử cảm xúc và bình luận.
2. Đăng nhập `chatok111111@gmail.com`, mở `/profile`: mục **Giải đấu** có lịch sử giải 1 và 2, thứ hạng và điểm; thẻ phong độ hiển thị `R` (chỉ chủ hồ sơ thấy), tiến độ lên bậc (đã lên Trung bình khá sau 2 giải).
3. Mở `/tournaments/rankings`: thử lọc trình độ và phân trang ở cả Đơn và Đôi.
4. Mở giải 1 → **Nhóm chat giải**: gửi tin nhắn; thành viên gồm Organizer và người tham gia, không có người bị chặn.
5. Mở `/notifications`: có thông báo đăng ký, bốc thăm, kết quả, hoàn phí tuỳ tài khoản.

### 4.6. Admin

Đăng nhập `admin@smashpro.vn`.

1. Mở `/admin/tournaments`: thấy mọi trạng thái, kể cả `DRAFT`; tìm theo tên; kiểm tra deep link từ thông báo/global search.
2. Huỷ giải 13: bấm **Huỷ giải**, nhập lý do → xác nhận. Giải `CANCELLED`, 2 người được hoàn 50.000đ và Organizer nhận thông báo.
3. Bấm **Tính lại phong độ** → xác nhận; thao tác chạy lại toàn bộ lịch sử phong độ (không đổi dữ liệu đã đúng).
4. Mở Dashboard/Finance: kiểm tra doanh thu giải đấu và khoản giữ phí của các giải đang mở.

### 4.7. Realtime và polling

1. Mở giải 4 ở hai cửa sổ (`player09@smashpro.vn` là Organizer, một Player khác).
2. Organizer nhập kết quả trận đang đánh → cửa sổ Player tự cập nhật trong khoảng 1 giây nếu WebSocket đang bật; nếu không, trang tự làm mới sau 30 giây.
3. Khách chưa đăng nhập chỉ dùng polling 30 giây, không có nút thao tác.

## 5. Kiểm tra nhanh sau khi test

Có thể kiểm tra bằng giao diện ví, hồ sơ, bảng xếp hạng và thông báo. Nếu cần kiểm tra database local:

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select id, status, name from tournaments order by id;"

docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select u.email, w.balance from wallet_accounts w join users u on u.id = w.user_id
   where u.email in ('chatok111111@gmail.com','player21@smashpro.vn','player37@smashpro.vn') order by u.email;"

docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select tournament_id, placement, count(*), sum(points)
   from tournament_ranking_points group by tournament_id, placement order by tournament_id, placement;"
```

## 6. Chạy lại hoặc reset dữ liệu

- Muốn test lại từ đầu: tắt `npm run dev`, chạy `npm run db:reset -- --yes`, rồi `npm run dev`. Toàn bộ dữ liệu demo (không chỉ giải đấu) được tạo lại.
- Không có lệnh seed riêng cho giải đấu nữa (`db:seed:tournaments` đã gộp vào bộ seed demo).

## 7. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| 404 khi mở giải nháp | Bạn không phải Organizer/Admin của giải `DRAFT` |
| 403 khi vào console | Chỉ Organizer của giải mới quản lý được |
| 409 `TOURNAMENT_INVALID_STATE` | Thao tác không hợp lệ ở trạng thái hiện tại (ví dụ bốc thăm khi chưa đóng đăng ký) |
| 409 `TOURNAMENT_VERSION_CONFLICT` | Dữ liệu vừa bị thay đổi ở tab/cửa sổ khác; tải lại rồi thao tác |
| 409 `WALLET_INSUFFICIENT_BALANCE` | Ví không đủ lệ phí; dùng `player37@smashpro.vn` (ví 0đ) để thấy đúng luồng này |
| 409 `TOURNAMENT_FULL` | Giải đã đủ người (giải 10) |
| 409 `TOURNAMENT_MATCH_LOCKED` | Trận kế tiếp đã bắt đầu, hoặc quá 48 giờ sau khi giải kết thúc |
| 409 `TOURNAMENT_DISABLED` | `TOURNAMENT_ENABLED` đang tắt trong `/admin/configs` |
| Trang trắng / API 500 | Thiếu migration `0040`–`0042` hoặc chưa chạy `npm run db:migrate` |

Lưu ý: tài liệu này chỉ hướng dẫn kiểm thử thủ công; các kết quả tự động và trạng thái task vẫn theo [tasks.md](tasks.md).
