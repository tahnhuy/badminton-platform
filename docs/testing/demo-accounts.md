# Tài khoản và dữ liệu demo

Bộ seed demo tạo một cộng đồng hoàn chỉnh để kiểm thử thủ công và trình bày dự án. Thiết kế: [`docs/plans/demo-seed-plan.md`](../plans/demo-seed-plan.md).

## Chạy seed

```bash
# Tắt `npm run dev` trước (các worker nền không nên chạy song song với seed)
npm run db:reset -- --yes     # sao lưu DB vào ~/db-backups/, xoá sạch, migrate, seed (~40 giây)
npm run dev
```

- `npm run db:seed`: seed một DB vừa migrate và còn trống. Nếu DB đã có người dùng thì lệnh từ chối chạy.
- Dữ liệu tính theo **ngày chạy** (giờ Việt Nam): "hôm qua", "tuần sau"… luôn đúng với lúc chạy. Sát ngày demo nên chạy lại để lịch "sắp tới" còn hợp lý.
- Seed không bao giờ chạy khi `NODE_ENV=production`. Trên server demo từ xa: `SEED_TARGET=demo npm run db:reset -- --yes`.
- Đăng nhập trên trình duyệt sau khi reset: phiên cũ đã bị xoá nên cần đăng nhập lại.

## Thông tin đăng nhập

**Mật khẩu chung: `123456`** · **PIN rút tiền: `123456`** · Mọi email đều đã xác minh.

| Vai trò | Email | Ghi chú |
|---|---|---|
| **Người chơi demo chính** | `chatok111111@gmail.com` (Đặng Ngọc Tài) | Có mặt ở mọi luồng, xem chi tiết bên dưới |
| Admin | `admin@smashpro.vn` | |
| Chủ sân | `owner1@smashpro.vn` | CLB Cầu Lông Phúc Thịnh Quận 7 (8 sân, sân 8 đang bảo trì) |
| Chủ sân | `owner2@smashpro.vn` | Sân Cầu Lông Tân Bình Pro (12 sân gỗ, sân 12 cần bảo trì) |
| Chủ sân | `owner3@smashpro.vn` | CLB Cầu Lông Hoàng Thành Quận 10 (6 sân) |
| Chủ sân mới | `owner4@smashpro.vn` | 1 cơ sở **chờ duyệt** (4 sân), 1 cơ sở **bị từ chối** có lý do |
| Chủ sân vừa hợp tác | `owner.moi@smashpro.vn` | Tạo từ một **yêu cầu hợp tác đã duyệt**, chưa có cơ sở nào (demo luồng thêm cơ sở đầu tiên) |
| Người chơi | `player01@smashpro.vn` … `player39@smashpro.vn` | Tên Việt, đủ 7 bậc trình độ |
| Hệ thống | `imported.venues@smashpro.vn` | Giữ 54 cơ sở nhập từ Google Places, không dùng để demo |

**Trường hợp đặc biệt**

| Tài khoản | Dùng để demo |
|---|---|
| `player36@smashpro.vn` | Đã **chặn** tài khoản demo chính (hai bên không thấy nhau, không nhắn tin được) |
| `player37@smashpro.vn` | **Ví trống**: đặt sân / đăng ký giải sẽ báo thiếu tiền |
| `player38@smashpro.vn` | Người **bị báo cáo**: bài lừa đảo (đã bị Admin ẩn), bình luận xúc phạm, tin nhắn đe doạ |
| `player39@smashpro.vn` | Tài khoản **bị khoá**: đăng nhập bị từ chối |

## Tài khoản demo chính có gì

- **Ví**: khoảng 2.000.000 đ, có tài khoản ngân hàng, lịch sử nạp / thanh toán / hoàn tiền / rút tiền (1 lần rút 500.000 đ đã nhận).
- **Đặt sân**: 6 lượt đã chơi, 1 lượt giữ chỗ hết hạn, 2 lượt sắp tới (ngày mai 19:00 tại Phúc Thịnh, +4 ngày tại Tân Bình), 1 lượt đã huỷ và được hoàn tiền.
- **Ghép trận**: 6 trận đã đấu; đang làm chủ **kèo đôi** sau 2 ngày (1 người đã vào, **1 đơn xin vào chờ duyệt**); là thành viên **kèo nhóm** đã chốt (có nhóm chat); làm chủ **kèo chia tiền sân** sau 6 ngày (4 người, mỗi người đã trả phần của mình).
- **Đánh giá**: đã nhận và đã gửi đánh giá sau trận.
- **Giải đấu**: đã đấu 1 giải đơn và 1 giải đôi (đã kết thúc); **là Organizer** của 1 giải đã bốc thăm và 1 bản nháp; đã đăng ký 1 giải đang mở; có **lời mời vào đội đang chờ** ở 1 giải đôi. Kịch bản test giải đấu chi tiết: [`docs/features/tournament/manual-test-guide.md`](../features/tournament/manual-test-guide.md).
- **Phong độ**: sau 2 giải đã lên bậc **Trung bình khá** (xem thẻ phong độ trong hồ sơ).
- **Cộng đồng**: 4 bài viết có bình luận và cảm xúc; đã báo cáo 1 bình luận xúc phạm.
- **Tin nhắn**: chat 1-1 và nhóm, **có tin chưa đọc** (huy hiệu ở hộp thư).

## Kịch bản demo gợi ý

**Người chơi** (`chatok111111@gmail.com`)
1. Trang chủ / bảng tin: bài viết, thẻ kết quả giải, bài tuyển người.
2. Đặt sân: tìm sân → chọn giờ trống → thanh toán bằng ví → xem trong "Lịch của tôi".
3. Ghép trận: duyệt đơn xin vào kèo đôi của mình; mở nhóm chat của kèo nhóm.
4. Giải đấu: chấp nhận lời mời vào đội ở giải đôi; đăng ký giải đang mở; vào trang quản lý giải mình tổ chức (đã bốc thăm) để xem nhánh đấu và lịch.
5. Hồ sơ: lịch sử giải, điểm xếp hạng, thẻ phong độ, đánh giá nhận được.

**Chủ sân** (`owner1@smashpro.vn`)
1. Lịch sân hôm nay: lượt đang chơi, lượt sắp tới, khoá bảo trì.
2. Danh sách đơn đặt, huỷ đơn có lý do.
3. Ví: doanh thu được cộng, yêu cầu rút tiền đang chờ duyệt.

**Admin** (`admin@smashpro.vn`)
1. Dashboard: người dùng mới, đặt sân, doanh thu theo ngày.
2. Duyệt cơ sở của `owner4` (1 cơ sở + 4 sân chờ duyệt).
3. Tài chính: tổng quan, **5 khoản doanh thu chờ duyệt**, **2 yêu cầu rút tiền chờ duyệt**, đối soát (0 chỗ lệch).
4. Báo cáo vi phạm: 5 báo cáo đang chờ, 1 đã xử lý (bài lừa đảo đã ẩn).
5. Giải đấu: 14 giải đủ trạng thái (huỷ giải 13 để test hoàn phí); cấu hình hệ thống có lịch sử thay đổi.
6. Yêu cầu hợp tác: 2 **chờ xử lý**, 1 **đã liên hệ** (có ghi chú), 1 đã tạo tài khoản (`owner.moi@smashpro.vn`), 1 đã từ chối. Thử "Tạo tài khoản chủ sân" với yêu cầu đã liên hệ; gửi thêm yêu cầu mới tại `/hop-tac` (không cần đăng nhập).

## Dữ liệu tổng quát

| Phần | Nội dung |
|---|---|
| Sân | 3 cơ sở hoạt động, 1 chờ duyệt, 1 bị từ chối, 54 cơ sở Google Places |
| Đặt sân | ~160 lượt trong 45 ngày qua và 7 ngày tới: đã chơi, đang chơi, sắp tới, hết hạn, người chơi huỷ, chủ sân huỷ |
| Ghép trận | ~20 trận đã đấu, 5 kèo sắp tới (đang mở, đã chốt có chat, đã huỷ, chia tiền sân) |
| Giải đấu | 14 giải: 2 đã kết thúc (đơn, đôi), 1 đang đấu (có trận đang đánh), 1 đã bốc thăm, 1 đã đóng đăng ký chờ bốc thăm, 7 đang mở (có phí, miễn phí, giới hạn trình độ, đã đủ người, mới 1 người, giải đôi đang ghép đội…), 1 đã huỷ (hoàn phí), 1 bản nháp; bảng xếp hạng và điểm phong độ |
| Cộng đồng | ~27 bài, bình luận, cảm xúc; 1 lượt chặn |
| Tin nhắn | 8 hội thoại 1-1 và nhóm, nhóm chat của kèo và của giải |
| Kiểm duyệt | 6 báo cáo vi phạm, 1 bài bị ẩn, 2 lần đổi cấu hình có lịch sử |

Số liệu chính xác in ra cuối mỗi lần chạy seed.
