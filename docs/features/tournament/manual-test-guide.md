# Hướng dẫn test thủ công chức năng Giải đấu

Tài liệu hỗ trợ kiểm thử triển khai hiện tại trên giao diện. Quy tắc nghiệp vụ thuộc [PRD](prd.md), [Tech Design](tech-design.md) và [business rules](../../business-rules-config-matrix.md).

## 1. Chuẩn bị

Chạy từ thư mục gốc repository, sau khi đã cấu hình `backend/.env` theo README:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed:tournaments
npm run dev
```

- Seed chỉ chấp nhận PostgreSQL local và từ chối `NODE_ENV=production`.
- Cần migration `0040`–`0042`; nếu database dev còn cũ, chạy `npm run db:migrate` trước.
- Chạy lại seed an toàn: giải nào đã có theo tên sẽ được bỏ qua, không tạo trùng.
- Không cần chạy `npm run db:seed` tổng nếu database đã có tài khoản, skill level và survey version.
- Frontend: <http://localhost:5173>, backend: <http://localhost:3000>.

Mật khẩu chung của mọi tài khoản seed: `Password@123`.

## 2. Tài khoản seed

| Email | Vai trò | Dùng để |
| --- | --- | --- |
| `tournament.organizer@example.com` | Player (Organizer) | Tạo giải, console Organizer, bốc thăm, nhập kết quả, kết thúc giải |
| `tournament.p01@example.com` | Player — Giỏi | Đội trưởng đang ghép đội, đội vô địch đôi, người không hợp giải giới hạn trình |
| `tournament.p02@example.com` | Player — Khá | Nhận lời mời đội, vô địch đơn, dùng test chia sẻ kết quả/hồ sơ |
| `tournament.p03@example.com` | Player — Trung bình khá | Đội trưởng đã đăng ký giải đôi, người đóng phí |
| `tournament.p04@example.com` | Player — Trung bình | Đã đăng ký nhiều giải, dùng test rút/hoàn phí |
| `tournament.p05@example.com` | Player — Trung bình yếu | Đội trưởng đội đủ người chưa đăng ký |
| `tournament.p06@example.com` | Player — Yếu | Thành viên đội đôi |
| `tournament.p07@example.com` | Player — Mới chơi | Người không hợp giải giới hạn trình độ |
| `tournament.p08@example.com` | Player — Trung bình | Người đăng ký/hoàn phí |
| `tournament.p09@example.com` | Player — Trung bình khá | Người đăng ký/hoàn phí |
| `tournament.p10@example.com` | Player — Khá | Á quân đơn, người thử giải đã đủ chỗ |
| `tournament.p11@example.com` | Player — Trung bình yếu | Người đóng phí |
| `tournament.p12@example.com` | Player — Yếu | Người không hợp giải giới hạn trình độ |
| `tournament.broke@example.com` | Player — Mới chơi | Ví 0đ, test “ví chưa đủ tiền” |
| `admin@smashpro.vn` | Admin | Trang quản trị giải, huỷ giải, tính lại phong độ |

Mỗi Player demo có ví `1.000.000đ`, trừ `tournament.broke@example.com` là `0đ`.

## 3. Dữ liệu seed

ID bên dưới là ID trên database trống. Nếu database đã có giải khác, tìm theo tên trong `/tournaments`; seed in ID thực tế khi chạy.

| ID | Tên giải | Trạng thái | Dùng để test |
| --- | --- | --- | --- |
| 1 | `[DEMO] Bản nháp — chỉ Organizer thấy` | DRAFT | 404 với người khác, quyền xem của Organizer/Admin, form thiết lập |
| 2 | `[DEMO] Đơn mở — miễn phí` | OPEN | Đăng ký/rút miễn phí, trạng thái đã đăng ký |
| 3 | `[DEMO] Đơn mở — có lệ phí` | OPEN | Trừ ví 50.000đ, rút hoàn 100%, ví không đủ |
| 4 | `[DEMO] Đơn giới hạn trình độ` | OPEN | Chặn trình độ ngoài hạng 3–5 |
| 5 | `[DEMO] Đơn đã đủ người` | OPEN | Giải đã đủ 2/2, nút đăng ký bị chặn |
| 6 | `[DEMO] Đã đóng đăng ký — chờ bốc thăm` | REGISTRATION_CLOSED | Sửa hạt giống, bốc thăm, sinh nhánh + lịch |
| 7 | `[DEMO] Sẵn sàng thi đấu` | READY | Nhánh đấu, lịch, sửa lịch có cảnh báo, bắt đầu trận |
| 8 | `[DEMO] Đang thi đấu` | IN_PROGRESS | 2 trận đã xong + 1 trận đang đấu; nhập tỉ số, sửa kết quả, walkover/bỏ cuộc/huỷ trận, kết thúc giải |
| 9 | `[DEMO] Đã hoàn thành` | COMPLETED | Vô địch, chia sẻ kết quả, nhóm chat, hồ sơ, bảng xếp hạng |
| 10 | `[DEMO] Đã huỷ` | CANCELLED | Trạng thái huỷ và hoàn phí |
| 11 | `[DEMO] Đôi — mở đăng ký` | OPEN | Ghép đội, lời mời, link mời, đăng ký/rút đội |
| 12 | `[DEMO] Đôi — đã hoàn thành` | COMPLETED | Nhánh đôi, bảng xếp hạng Đôi, chia sẻ kết quả đôi |
| 13 | `[DEMO] Đóng khi chưa đủ người` | OPEN | Đóng đăng ký khi chỉ có 1 người → tự huỷ + hoàn phí |
| 14 | `[DEMO] Admin huỷ và hoàn phí` | OPEN | Admin huỷ giải có phí và hoàn tiền |

Chi tiết dữ liệu đã tạo:

- Giải 6 có 6 người đăng ký; giải 7, 8, 9 có 8 người.
- Giải 8: 2 trận vòng 1 đã có kết quả, 1 trận đang `IN_PROGRESS`.
- Giải 9: đủ 7 trận, có vô địch (p02), á quân (p10), điểm xếp hạng và nhóm chat.
- Giải 11: p01 đang ghép đội và đã mời p02 (lời mời chờ); p03/p04 đã đăng ký; p05/p06 đủ đội nhưng chưa đăng ký.
- Giải 12: 4 đội đã đấu xong; p01/p02 vô địch.
- Giải 10 và 14 có phí 50.000đ; giải 11 và 12 có phí 100.000đ/đội.

## 4. Kịch bản test trên giao diện

### 4.1. Khách chưa đăng nhập

1. Mở `/tournaments`. Kiểm tra danh sách, tìm theo tên, lọc trạng thái (`Tất cả`, `Đang mở`, `Sắp đấu`, `Đang đấu`, `Đã xong`), lọc `Miễn phí`, phân trang.
2. Giải `[DEMO] Bản nháp` không xuất hiện. Mở trực tiếp `/tournaments/1`: phải là trang “Không tìm thấy giải đấu”.
3. Mở `/tournaments/9`: xem được thông tin, người tham gia, nhánh đấu, lịch thi đấu. Không có nút đăng ký; hệ thống mời đăng nhập.
4. Mở `/tournaments/rankings`: chuyển tab Đơn/Đôi, lọc theo trình độ; thấy p02 trong Đơn và p01/p02 trong Đôi.

### 4.2. Player — giải đơn

Đăng nhập `tournament.p05@example.com`.

1. Mở `/tournaments/2` (`Đơn mở — miễn phí`). Bấm **Đăng ký** → xác nhận. Thông báo thành công, nút đổi thành **Rút đăng ký**, số người tham gia tăng.
2. Mở `/tournaments/mine?role=registered`: giải vừa đăng ký xuất hiện.
3. Bấm **Rút đăng ký** → xác nhận. Số người giảm; giải miễn phí nên ví không đổi.
4. Mở `/tournaments/3` (`Đơn mở — có lệ phí`). Bấm **Đăng ký**: dialog hiển thị số dư ví, lệ phí 50.000đ và hạn hoàn tiền. Xác nhận → ví giảm 50.000đ.
5. Mở `/wallet`: có giao dịch `PAYMENT` cho giải. Quay lại giải, **Rút đăng ký** → ví được hoàn 50.000đ, có giao dịch `REFUND`.
6. Đăng xuất, đăng nhập `tournament.broke@example.com`. Mở `/tournaments/3` → **Đăng ký**: dialog báo “Ví chưa đủ tiền” và có nút **Nạp ví**; không tạo đăng ký.
7. Đăng nhập `tournament.p07@example.com` (Mới chơi). Mở `/tournaments/4`: hiển thị không đủ điều kiện trình độ (ngoài hạng 3–5), nút đăng ký bị chặn. Làm lại với `tournament.p01@example.com` (Giỏi) và `tournament.p12@example.com` (Yếu) — đều bị chặn.
8. Đăng nhập `tournament.p10@example.com`. Mở `/tournaments/5`: giải đã đủ 2/2, không đăng ký được.
9. Mở `/tournaments/1` khi đang là p10: 404. Đăng nhập Organizer: mở được `/tournaments/1` và `/tournaments/1/manage`.
10. Đăng nhập Organizer, mở `/tournaments/2`: Organizer không được tự đăng ký giải của mình.

### 4.3. Player — giải đôi

1. Đăng nhập `tournament.p02@example.com`, mở `/tournaments/mine?role=invited`: có lời mời từ p01 vào đội `Đôi Sấm Sét` ở giải 11.
2. Mở giải 11 → khu **Đội của bạn**: **Chấp nhận** hoặc **Từ chối**. Chấp nhận → đội đủ 2 người; từ chối → p01 vẫn đang ghép đội.
3. Đăng nhập `tournament.p05@example.com`, mở giải 11: đội `Đôi Ánh Sao` đã đủ 2 người. Đội trưởng thấy **Đăng ký đội · 100.000đ**; đăng ký → đội `REGISTERED`, ví trừ 100.000đ. Rút đăng ký (chỉ đội trưởng) → hoàn 100.000đ.
4. Đăng nhập `tournament.p07@example.com`, mở giải 11: tạo đội mới, tìm đồng đội theo tên, gửi lời mời, tạo link mời. Mở link `/tournaments/join/<token>` bằng tài khoản khác để vào đội.
5. Kiểm tra: mỗi người chỉ ở một đội trong cùng giải; đội phải đủ 2 người mới đăng ký được; sau khi đăng ký, thành viên bị khoá.

### 4.4. Organizer console

Đăng nhập `tournament.organizer@example.com`. Mở `/tournaments/mine?role=organized`, chọn giải → **Quản lý**.

1. **Giải 1 — Thiết lập:** sửa tên/mô tả/lịch, lưu; bấm **Mở đăng ký** (cần địa điểm và hạn đăng ký ở tương lai). Kiểm tra trạng thái chuyển `OPEN_FOR_REGISTRATION`.
2. **Giải 6 — Hạt giống & bốc thăm:** xem gợi ý hạt giống, sửa số hạt giống (phải liên tục từ 1), **Lưu hạt giống**; bấm **Bốc thăm & xếp lịch**. Kiểm tra nhánh đấu xuất hiện, hạt giống 1–2 ở hai nửa nhánh, 1–4 ở bốn phần tư, BYE dành cho hạt giống cao; giải chuyển `READY`.
3. **Giải 7 — Lịch thi đấu:** xem bảng sân × giờ. Sửa một trận trùng sân/giờ với trận khác → lưu được nhưng hiện cảnh báo. Chạy lại xếp lịch → trận đã bắt đầu/đã xong được giữ nguyên.
4. **Giải 7 — Trận đấu:** bấm **Bắt đầu** một trận, sau đó **Nhập tỉ số**. Thử tỉ số không hợp lệ (21–20, 23–20, 31–29) → báo lỗi; tỉ số hợp lệ (21–19, 22–20, 30–29) → lưu được; người thắng đi tiếp vào vòng sau.
5. **Giải 8 — Đang thi đấu:**
   - Nhập tỉ số cho trận đang `IN_PROGRESS`.
   - **Sửa kết quả** một trận đã xong khi trận kế tiếp chưa bắt đầu → sửa được; sau khi trận kế tiếp bắt đầu → bị khoá.
   - Thử **Walkover**, **Bỏ cuộc**, **Huỷ trận** trên các trận còn lại.
   - Đánh hết các trận, vào **Kết thúc giải** → xác nhận; kiểm tra vô địch, điểm xếp hạng và trạng thái `COMPLETED`.
6. **Giải 3 — Người tham gia:** bấm **Loại** một người, nhập lý do → xác nhận. Kiểm tra người đó bị loại, được hoàn 50.000đ và nhận thông báo.
7. **Giải 2 — Huỷ giải:** **Thiết lập** → **Huỷ giải**, nhập lý do → trạng thái `CANCELLED`; người đã đăng ký nhận thông báo (giải miễn phí nên không hoàn tiền).
8. **Giải 13 — Đóng khi chưa đủ người:** bấm **Đóng đăng ký**. Vì chỉ có 1 người, giải tự huỷ và hoàn 50.000đ thay vì chuyển `REGISTRATION_CLOSED`.
9. Kiểm tra các nút bị khoá theo trạng thái: không sửa hạt giống sau khi bốc thăm; không loại người sau khi bốc thăm; không sửa loại kết quả sau khi giải kết thúc (chỉ sửa tỉ số trong 48 giờ, trận chung kết được đổi người thắng).

### 4.5. Kết quả, hồ sơ, Social, chat, thông báo

1. Đăng nhập `tournament.p02@example.com`, mở `/tournaments/9`: thấy vô địch, nhánh đấu, tỉ số; có nút **Chia sẻ kết quả**. Chia sẻ → mở `/feed`, thấy bài `TOURNAMENT_RESULT`; thử cảm xúc và bình luận.
2. Mở `/profile`: mục **Giải đấu** có lịch sử giải, thứ hạng và điểm; thẻ phong độ hiển thị `R` (chỉ chủ hồ sơ thấy), tiến độ lên bậc.
3. Mở `/tournaments/rankings`: p02 xuất hiện ở Đơn và Đôi; thử lọc trình độ và phân trang.
4. Mở giải 9 → **Nhóm chat giải**: gửi tin nhắn; kiểm tra thành viên gồm Organizer và người tham gia, không có người bị chặn.
5. Mở `/notifications`: có thông báo đăng ký, bốc thăm, kết quả, hoàn phí tuỳ tài khoản.

### 4.6. Admin

Đăng nhập `admin@smashpro.vn`.

1. Mở `/admin/tournaments`: thấy mọi trạng thái, kể cả `DRAFT`; tìm theo tên; kiểm tra deep link từ thông báo/global search.
2. Huỷ giải 14: bấm **Huỷ giải**, nhập lý do → xác nhận. Kiểm tra giải `CANCELLED`, 2 người được hoàn 50.000đ và Organizer nhận thông báo.
3. Bấm **Tính lại phong độ** → xác nhận; thao tác chạy lại toàn bộ lịch sử phong độ (không đổi dữ liệu đã đúng).
4. Mở Dashboard/Finance: kiểm tra doanh thu giải đấu và khoản giữ phí của giải đang mở.

### 4.7. Realtime và polling

1. Mở cùng một giải ở hai cửa sổ (một Organizer, một Player).
2. Organizer nhập kết quả → cửa sổ Player tự cập nhật trong khoảng 1 giây nếu WebSocket đang bật; nếu không, trang tự làm mới sau 30 giây.
3. Khách chưa đăng nhập chỉ dùng polling 30 giây, không có nút thao tác.

## 5. Kiểm tra nhanh sau khi test

Có thể kiểm tra bằng giao diện ví, hồ sơ, bảng xếp hạng và thông báo. Nếu cần kiểm tra database local:

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select id,status,name from tournaments where name like '[DEMO]%' order by id;"

docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select u.email, w.balance from wallet_accounts w join users u on u.id=w.user_id
   where u.email like 'tournament.%' order by u.email;"

docker exec badminton_postgres psql -U badminton_user -d badminton_db -c \
  "select tournament_id, placement, count(*), sum(points)
   from tournament_ranking_points group by tournament_id, placement order by tournament_id, placement;"
```

## 6. Chạy lại hoặc reset dữ liệu

- Chạy lại `npm run db:seed:tournaments` chỉ bổ sung giải còn thiếu; giải đã có được giữ nguyên, kể cả khi bạn đã thao tác trên đó.
- Muốn test lại từ đầu, reset database local (xóa toàn bộ dữ liệu dev):
  ```bash
  docker compose down -v
  docker compose up -d
  npm run db:migrate
  npm run db:seed
  npm run db:seed:tournaments
  ```
- Có thể chạy thêm các seed khác (`db:seed:social`, `db:seed:ratings`, …) nếu cần dữ liệu liên quan.

## 7. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| 404 khi mở giải nháp | Bạn không phải Organizer/Admin của giải `DRAFT` |
| 403 khi vào console | Chỉ Organizer của giải mới quản lý được |
| 409 `TOURNAMENT_INVALID_STATE` | Thao tác không hợp lệ ở trạng thái hiện tại (ví dụ bốc thăm khi chưa đóng đăng ký) |
| 409 `TOURNAMENT_VERSION_CONFLICT` | Dữ liệu vừa bị thay đổi ở tab/cửa sổ khác; tải lại rồi thao tác |
| 409 `WALLET_INSUFFICIENT_BALANCE` | Ví không đủ lệ phí; dùng `tournament.broke@example.com` để thấy đúng luồng này |
| 409 `TOURNAMENT_FULL` | Giải đã đủ người (giải 5) |
| 409 `TOURNAMENT_MATCH_LOCKED` | Trận kế tiếp đã bắt đầu, hoặc quá 48 giờ sau khi giải kết thúc |
| 409 `TOURNAMENT_DISABLED` | `TOURNAMENT_ENABLED` đang tắt trong `/admin/configs` |
| Trang trắng / API 500 | Thiếu migration `0040`–`0042` hoặc chưa chạy `npm run db:migrate` |

Lưu ý: tài liệu này chỉ hướng dẫn kiểm thử thủ công; các kết quả tự động và trạng thái task vẫn theo [tasks.md](tasks.md).
