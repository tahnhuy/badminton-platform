# Kế hoạch bộ seed demo

**Trạng thái:** Hoàn thành giai đoạn 1–5 (2026-11-27) · **Nhánh:** `chore/demo-seed` (chưa push) · **Người phụ trách:** taidangdev

Thay toàn bộ các script seed hiện có (`backend/src/db/seed.ts`, `seed-*.ts`, `seeds/`) bằng **một bộ seed duy nhất**. Bộ seed này xoá sạch DB, chạy migration, rồi nạp một cộng đồng demo đầy đủ, dùng để kiểm thử thủ công và trình bày dự án.

## 1. Vì sao phải làm lại

- Mỗi script cũ tự tạo nhóm tài khoản riêng (`split.demo.*`, `report.*`, `admin-notif.*`, `rating.*`). Dữ liệu vì vậy không liên quan với nhau, không thành một câu chuyện demo được.
- Không có dữ liệu giải đấu. Gần như không có ví có tiền, đặt sân theo thời gian, tin nhắn hay quyết toán chủ sân, nên Dashboard và Tài chính trống.
- Chưa theo kịp `develop`: không có PIN rút tiền, chưa đánh dấu email đã xác minh.
- Script chỉ chạy được với localhost, nên không dùng được cho server demo khi deploy.

## 2. Nguyên tắc

1. **Một lệnh:**
   - `npm run db:reset -- --yes`: sao lưu, xoá schema, migrate rồi seed.
   - `npm run db:seed`: seed trên DB vừa migrate.
2. **Không seed dữ liệu tham chiếu:** bậc trình độ, bộ câu hỏi khảo sát, tiêu chuẩn sân và `system_configs` đã do migration tạo.
3. **Kết quả lặp lại được:** bộ sinh ngẫu nhiên có hạt giống cố định, email cố định. Thời gian tính tương đối so với ngày chạy theo giờ Asia/Ho_Chi_Minh.
4. **Tiền và chuyển trạng thái đi qua service thật** (ví, thanh toán, hoàn tiền, đăng ký giải, kết thúc giải…), để số dư, sổ ví, thông báo và đối soát luôn khớp. Dữ liệu tĩnh (người dùng, sân, bảng giá, bài viết) thì insert trực tiếp. Dữ liệu quá khứ được tạo qua service rồi dời mốc thời gian (`lib/backdate.ts`).
5. **Mật khẩu hash lúc chạy** bằng `passwordHasher`, vì hash phụ thuộc `PASSWORD_PEPPER` của từng môi trường. Không lưu sẵn hash trong code.
6. **Không gửi email thật:** seed không ghi vào `email_outbox`. Email của tài khoản demo chính là địa chỉ Gmail thật.
7. **An toàn:**
   - Từ chối chạy nếu `NODE_ENV=production`.
   - DB không phải localhost thì phải có thêm `SEED_TARGET=demo`.
   - Xoá dữ liệu bắt buộc có `--yes`.
   - Sao lưu tự động (`pg_dump`) vào `~/db-backups/` trước khi xoá DB local.

## 3. Cấu trúc

```
backend/src/db/seed/
  index.ts            điều phối: kiểm tra môi trường → (reset) → các bước → verify → in tóm tắt
  reset.ts            sao lưu, DROP SCHEMA public CASCADE, CREATE SCHEMA, runMigrations()
  lib/
    random.ts         PRNG có hạt giống
    clock.ts          mốc thời gian, daysAgo / daysFromNow / at(giờ VN)
    accounts.ts       user + profile + khảo sát hợp lệ (từ seeds/skill-survey-seed.ts) + PIN + email đã xác minh
    backdate.ts       dời created_at/updated_at/… của bản ghi vừa tạo
    images.ts         chép ảnh mẫu vào uploads/ và PRIVATE_UPLOADS_DIR
  data/
    people.ts         tên người chơi, bậc, khu vực
    facilities.ts     cơ sở chính, sân, bảng giá
    google-places.json  54 cơ sở thật (chuyển từ seeds/google-places-facilities.ts)
    posts.ts, messages.ts, tournaments.ts
    images/           ảnh đại diện, ảnh bài viết, ảnh minh chứng
  steps/
    01-accounts.ts  02-facilities.ts  03-wallets.ts  04-bookings.ts  05-finance.ts
    06-matchmaking.ts  07-ratings.ts  08-social.ts  09-messaging.ts
    10-tournaments.ts  11-moderation.ts  99-verify.ts
```

`package.json` (backend) chỉ còn `db:reset`, `db:seed`, `db:create-admin`. Lệnh cuối dùng cho production: tạo Admin đầu tiên, mật khẩu lấy từ biến môi trường, không có dữ liệu demo.

## 4. Tài khoản demo

Mật khẩu chung: **`123456`**. Mật khẩu này không đạt chính sách mật khẩu khi đăng ký hoặc đổi qua giao diện. Seed ghi hash trực tiếp, và lúc đăng nhập hệ thống không kiểm tra chính sách. Tất cả tài khoản đều đã xác minh email và có PIN rút tiền `123456`.

| Vai trò | Email | Ghi chú |
|---|---|---|
| **Người chơi demo chính** | `chatok111111@gmail.com` | Tham gia mọi luồng: ví có tiền, đặt sân quá khứ và sắp tới, ghép trận, bài viết, tin nhắn, Organizer của một giải, đã đăng ký giải khác, có lịch sử phong độ và hạng |
| Admin | `admin@smashpro.vn` | |
| Chủ sân | `owner1@smashpro.vn` … `owner3@smashpro.vn` | Mỗi người một cơ sở chính đang hoạt động, có doanh thu và quyết toán |
| Chủ sân chờ duyệt | `owner4@smashpro.vn` | Cơ sở chờ duyệt và một cơ sở bị từ chối |
| Người chơi | `player01@smashpro.vn` … `player39@smashpro.vn` | Tên Việt, trải đủ 7 bậc |
| Trường hợp đặc biệt | trong nhóm trên | 1 tài khoản bị khoá, 1 bị báo cáo, 1 ví trống, 1 chặn người demo chính |
| Tài khoản hệ thống | `imported.venues@smashpro.vn` | Giữ 54 cơ sở Google Places, không dùng để demo |

## 5. Dữ liệu theo bước

| Bước | Nội dung |
|---|---|
| 01 tài khoản | Admin, 4 chủ sân, 40 người chơi (gồm tài khoản demo chính), khảo sát hợp lệ, ảnh đại diện |
| 02 sân | 3 cơ sở chính và sân, bảng giá giờ thường/giờ cao điểm, khoá giờ bảo trì, hồ sơ sân và yêu cầu tiêu chuẩn chờ duyệt, 54 cơ sở Google Places |
| 03 ví | Nạp ví cho người chơi qua adapter giả lập, tài khoản ngân hàng cho chủ sân |
| 04 đặt sân | Khoảng 150 lượt từ -45 đến +14 ngày: đã chơi, sắp tới, đang giữ chỗ, huỷ có hoàn tiền, chia tiền |
| 05 tài chính | Quyết toán doanh thu chủ sân; yêu cầu rút tiền chờ duyệt, đã duyệt, bị từ chối |
| 06 ghép trận | Yêu cầu đang mở, lời mời, trận sắp đấu và đã đấu có tỉ số |
| 07 đánh giá | Đánh giá sau trận, một đề xuất điều chỉnh trình độ |
| 08 Cộng đồng | Khoảng 40 bài (tự do, tuyển người, kết quả giải), ảnh, cảm xúc, bình luận, chặn người dùng |
| 09 tin nhắn | Chat 1-1, nhóm, nhóm của trận ghép, chat giải; có ảnh và cảm xúc |
| 10 giải đấu | Nháp; đang mở (đơn, có phí); đang mở (đôi, có đội đang lập); đã bốc thăm; đang đấu; 2 giải đã kết thúc (đơn, đôi); đã huỷ có hoàn tiền. Có điểm phong độ, đổi bậc, bảng xếp hạng |
| 11 kiểm duyệt | Báo cáo vi phạm (chờ xử lý / đã xử lý), thay đổi cấu hình có audit, thông báo cho Admin |
| 99 kiểm tra | Chạy các truy vấn đối soát của trang Tài chính; lệch thì báo lỗi. In số lượng bản ghi và bảng tài khoản |

## 6. Deploy

- **Production:** chỉ chạy `db:migrate` và `db:create-admin`, **không bao giờ** seed demo.
- **Server demo:** `SEED_TARGET=demo npm run db:reset -- --yes`.
  - Server cần `PAYMENT_PROVIDER` là adapter giả lập.
  - Cần ổ đĩa lưu bền cho `uploads/` và `PRIVATE_UPLOADS_DIR`.
  - User DB phải có quyền `DROP SCHEMA`.
- Nên reset lại sát ngày demo, để lịch đặt sân "sắp tới" và giải "đang mở" còn hợp lý.

## 7. Giai đoạn

| # | Nội dung | Xong khi | Tiến độ |
|---|---|---|---|
| 1 | Khung (`index`, `reset`, `lib`), bước 01–03; xoá seed cũ; sửa `package.json` | `db:reset` chạy được; đăng nhập được bằng các tài khoản ở §4 | ✅ `83a1808` |
| 2 | Bước 04–05 | Dashboard và Tài chính Admin/Chủ sân có số liệu; đối soát khớp | ✅ `03f52db` |
| 3 | Bước 06–09 | Các luồng ghép trận, đánh giá, Cộng đồng, tin nhắn có dữ liệu | ✅ `c3ca94b` |
| 4 | Bước 10 | Đủ trạng thái giải; bảng xếp hạng và điểm phong độ có dữ liệu | ✅ `2bb1fb0` |
| 5 | Bước 11, `99-verify`, test chạy seed trên DB nháp, `docs/testing/demo-accounts.md`, cập nhật tài liệu cũ | Test xanh; tài liệu không còn nhắc lệnh seed cũ | ✅ (xem bên dưới) |

Tài liệu cần sửa khi xoá seed cũ: `docs/testing/{06_booking-chu-san-matchmaking,08_cau-hinh-he-thong,09_matchmaking-split-booking,manual-ui-test-key-flows,rating-danh-gia-manual-test}.md`, `docs/features/matchmaking/ratings/testing-guide.md`, `docs/guides/owner-wallet-earning-testing.md`, `docs/plans/{02_inf-00-nen-migration,06_booking-chu-san-matchmaking,13_thong-bao-van-hanh-admin}.md`, `docs/architecture/plans/facility-court-real-data-manual-test.md`.

### Kết quả hiện tại (2026-11-27)

`npm run db:reset -- --yes` chạy khoảng 40 giây và tạo (danh sách tài khoản và kịch bản demo: [`docs/testing/demo-accounts.md`](../testing/demo-accounts.md)):

| Phần | Dữ liệu |
|---|---|
| Tài khoản | 1 Admin, 4 chủ sân, 40 người chơi (đủ 7 bậc, có khảo sát, đã xác minh email, có PIN rút tiền) |
| Sân | 3 cơ sở hoạt động (8/12/6 sân, hồ sơ mặt sân, bảng giá), 1 chờ duyệt, 1 bị từ chối, 54 cơ sở Google Places; 5 khoá bảo trì |
| Ví | Nạp ví qua adapter giả lập; tự nạp thêm khi thiếu; 6 tài khoản ngân hàng |
| Đặt sân | 164 lượt: 118 đã chơi, 1 đang chơi, 29 sắp tới, 8 hết hạn, 6 người chơi huỷ, 2 chủ sân huỷ (đều đã hoàn tiền) |
| Tài chính | Doanh thu tự cộng / duyệt tay / 1 từ chối / 5 chờ duyệt; rút tiền đủ trạng thái (đã trả, đã duyệt, chờ duyệt, từ chối) |
| Cộng đồng | 26 bài, 57 bình luận, 153 cảm xúc; `player36` chặn tài khoản demo chính |
| Tin nhắn | 7 hội thoại, 31 tin; tài khoản demo chính có 6 tin chưa đọc |
| Ghép trận | 21 trận đã đấu; sắp tới: kèo đôi có đơn chờ duyệt, kèo nhóm đã chốt có nhóm chat, kèo đơn đang mở, kèo đã huỷ, kèo đặt sân chia tiền 4 người |
| Đánh giá | ~170 lượt đánh giá sau trận |
| Giải đấu | 14 giải: 2 đã kết thúc (đơn, đôi; điểm xếp hạng, điểm phong độ, đổi bậc, chia sẻ kết quả), 1 đang đấu (có trận đang đánh), 1 đã bốc thăm (tài khoản demo là Organizer), 1 chờ bốc thăm, 7 đang mở (có phí, miễn phí, giới hạn trình độ, đã đủ người, mới 1 người, đôi đang ghép đội), 1 đã huỷ (hoàn phí), 1 bản nháp. Gộp các tình huống của `seed-tournaments.ts` (develop, 26/11) khi merge |
| Kiểm duyệt | 6 báo cáo vi phạm (bài, bình luận, tin nhắn), 1 bài bị Admin ẩn, 2 lần đổi cấu hình có lịch sử |

Bước kiểm tra cuối (`99-verify`) làm seed thất bại nếu: sổ ví lệch số dư hoặc âm theo thời gian; có bản ghi mang thời gian tương lai ở bất kỳ bảng nào; đối soát Tài chính của Admin có chỗ lệch (hôm nay, 7 ngày, 30 ngày, tháng này, toàn bộ); có email trong hàng đợi gửi; không đăng nhập được bằng mật khẩu chung.

### Khác với kế hoạch ban đầu

- Giải đấu quá khứ: bộ xếp lịch không bao giờ xếp trận trước "bây giờ", nên sau khi bốc thăm seed dịch nguyên lịch (giữ khoảng cách giữa các trận) về ngày khai mạc thật.
- Chưa seed yêu cầu xác nhận tiêu chuẩn sân và bàn giao cơ sở (cần tệp minh chứng thật); có thể bổ sung sau.
- Test `backend/src/__tests__/demo-seed.test.ts` chạy toàn bộ seed trên một DB nháp riêng (~45 giây) và kiểm tra bước tự kiểm của seed.
- Tài liệu test cũ đã chuyển sang tài khoản mới; ba hướng dẫn phụ thuộc dữ liệu riêng của seed cũ (`09_matchmaking-split-booking.md`, `rating-danh-gia-manual-test.md`, `features/matchmaking/ratings/testing-guide.md`) có ghi chú ở đầu và cần viết lại theo dữ liệu mới.

- Đặt sân chỉ tới **+7 ngày** (cấu hình `BOOKING_ADVANCE_WINDOW_DAYS = 7`), không phải +14.
- **Đặt sân chia tiền** làm ở bước 06 (ghép trận) thay vì bước 04, vì cần một trận đã chốt danh sách.
- **Chưa có ảnh** trong bài viết và tin nhắn (dùng nền màu cho bài ngắn). Có thể bổ sung ở giai đoạn 5.
- Seed nạp `app.ts` (dựng ứng dụng, không mở cổng, không chạy worker) để các "port" như kiểm tra chặn được đăng ký giống khi server chạy.
- Trận ghép quá khứ: hệ thống chỉ nhận kèo ở tương lai, nên seed tạo kèo ở giờ "ẩn" 01:00 ngày mai (sân đóng cửa, không trùng lịch), cho vào kèo và chốt danh sách bằng service thật, rồi dời về giờ thật và để worker ghép trận hoàn tất trận.
- `player_ratings` không cho sửa (trigger): seed dời thời gian trong một transaction tạm tắt rồi bật lại trigger.

### Điều cần báo nhóm

- **Đối soát Tài chính khung 1 ngày** ghép "thanh toán trong ngày" với "doanh thu cộng ví trong ngày". Nếu Admin duyệt tay doanh thu sang ngày khác, khung "hôm nay" báo lệch dù số liệu đúng. Dữ liệu demo duyệt trong cùng ngày để tránh cảnh báo giả; nên xem lại quy tắc này trong `FinanceReportRepository.reconciliationPairs`.
- Nên **tắt `npm run dev`** trước khi chạy `db:reset`, để các worker nền không chạy song song với seed.

## 8. Ảnh hưởng tới nhóm

- Các lệnh `db:seed:social`, `db:seed:ratings`, `db:seed:reports`, `db:seed:admin-notifications`, `db:seed:split`, `db:seed:audit-scroll` bị bỏ. Dữ liệu tương ứng nằm trong bộ seed mới.
- `db:reset` **xoá toàn bộ DB dev** trên máy người chạy. Có sao lưu tự động, nhưng nên báo trước cho cả nhóm.
