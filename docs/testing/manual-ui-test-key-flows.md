# Kiểm thử thủ công trên giao diện — các luồng nghiệp vụ then chốt

Tài liệu này hướng dẫn kiểm thử tay (manual UI test) các luồng nghiệp vụ cốt lõi sau khi
merge nhánh `develop` (đợt refactor UI foundation) vào `integration-huy`. Mục tiêu là xác nhận
các tính năng cũ vẫn hoạt động đúng sau khi giao diện được chuyển sang hệ UI mới.

> Lưu ý chung
>
> - Một số màn vẫn dùng CSS legacy (admin finance, dashboard, reports, approvals, configs,
>   notifications, owner wallet, report dialog, time-range filter). Chênh lệch nhẹ về style là
>   chấp nhận được; ưu tiên kiểm tra **dữ liệu và hành vi**, không phải độ đồng bộ thị giác.
> - Các màn đã chuyển sang Tailwind/lucide: admin shell, owner shell, booking, matchmaking,
>   player shell, social, messaging.
> - Sau mỗi luồng có dữ liệu ghi (thanh toán, hủy, duyệt), nên tải lại trang để xác nhận trạng thái
>   lấy lại từ server thay vì chỉ tin vào state cục bộ.

## 0. Chuẩn bị môi trường

Từ thư mục gốc repository:

```bash
docker compose up -d
npm run db:reset -- --yes   # sao lưu, xoá sạch, migrate và seed dữ liệu demo
npm run dev
```

- Frontend thường ở `http://localhost:5173`, backend ở cổng cấu hình trong `.env`.
- Cài dependency mới sau merge: `npm install` (develop thêm nhiều package).
- Seed demo đã gồm kèo/chia tiền sân, báo cáo vi phạm, thông báo Admin, tài chính và giải đấu; các lệnh `db:seed:*` riêng lẻ không còn. Danh sách tài khoản: [`demo-accounts.md`](demo-accounts.md).

Tài khoản seed (mật khẩu chung `123456`, đầy đủ tại [`demo-accounts.md`](demo-accounts.md)):

| Vai trò | Email | Dùng để |
| --- | --- | --- |
| Admin | `admin@smashpro.vn` | Finance, duyệt hồ sơ, báo cáo, cấu hình, dashboard |
| Court Owner | `owner1@smashpro.vn` | Ví chủ sân, hủy booking, đặt sân cho kèo |
| Player | `player01@smashpro.vn` | Đặt sân, thanh toán ví, báo cáo, nhận thông báo |

> Luồng ví & thu nhập chủ sân chi tiết đã có tại
> [`docs/guides/owner-wallet-earning-testing.md`](../guides/owner-wallet-earning-testing.md).
> Tài liệu này bổ sung phần kiểm thử tổng hợp sau merge.

---

## 1. Booking và thanh toán bằng ví, hủy và hoàn tiền

**Mục tiêu:** đặt sân, giữ chỗ, thanh toán bằng ví, hủy trước giờ và xem trạng thái hoàn tiền.

**Đường dẫn:** `/courts` → `/courts/:courtId/date` → `/bookings/new` →
`/bookings/:bookingId/pending` → `/bookings/:bookingId`.

**Các bước**

1. Đăng nhập Player, vào `/courts`, tìm cơ sở và chọn sân.
2. Chọn ngày và khung giờ trống, bấm đặt sân để sang trang tóm tắt.
3. Xác nhận tạo booking; hệ thống chuyển sang trang chờ thanh toán.
4. Bấm **Thanh toán ngay**. Chọn phương thức **ví** và xác nhận thanh toán thành công.
5. Mở `/bookings`, mở booking vừa tạo, kiểm tra trạng thái và chi tiết thanh toán.
6. Với booking đã xác nhận trước giờ bắt đầu, bấm **Yêu cầu hủy đặt sân**, nhập lý do và xác nhận.
7. Tải lại trang chi tiết booking, kiểm tra mục **Tiến trình hoàn tiền**.

**Kết quả mong đợi**

- Sau thanh toán, booking chuyển khỏi trạng thái chờ và hiển thị đã thanh toán.
- Hủy trước giờ được hoàn 100% vào ví; mục hoàn tiền hiển thị đúng một trong các trạng thái:
  đang hoàn tiền (`PENDING`/`REFUND_PENDING`), đã hoàn (`REFUNDED`), thất bại (`REFUND_FAILED`),
  hoặc không phát sinh hoàn tiền.
- Số dư ví Player tăng tương ứng sau khi hoàn tiền.

**Điểm cần chú ý sau merge**

- Trang chờ thanh toán có link **Nạp tiền vào ví** khi lỗi liên quan số dư ví.
- Trạng thái hoàn tiền phải map đủ cả `REFUND_PENDING`/`REFUND_FAILED`, không để trống.

---

## 2. Chủ sân hủy booking và hoàn tiền cho người chơi

**Mục tiêu:** chủ sân hủy booking do sự cố, hệ thống hoàn tiền theo trạng thái thanh toán.

**Đường dẫn:** `/owner/schedule` → mở **Xem booking** trên một slot đã đặt.

**Các bước**

1. Đăng nhập Court Owner, vào `/owner/schedule`, chọn cơ sở và ngày có booking.
2. Trên slot đã đặt, bấm **Xem booking** để mở panel chi tiết.
3. Kiểm tra khối **Hủy booking do sự cố từ phía sân**.
4. Nhập lý do (bắt buộc), bấm **Xác nhận hủy booking**.
5. Quan sát thông báo kết quả và tải lại lịch.
6. Đăng nhập Player tương ứng, kiểm tra booking và số dư ví.

**Kết quả mong đợi**

- Không cho hủy khi booking đã bắt đầu (hiển thị thông báo lý do).
- Booking đã thanh toán: hoàn tiền vào ví người chơi, trạng thái hoàn tiền cập nhật.
- Booking chưa thanh toán: giải phóng khung giờ, không phát sinh hoàn tiền.
- Sau khi hủy, danh sách lịch của owner tự làm mới.

---

## 3. Đặt sân cho kèo và chia đều tiền qua ví (split booking)

**Mục tiêu:** chủ kèo đặt sân cho nhóm, chia tiền cho thành viên, xử lý thiếu số dư ví.

**Đường dẫn:** `/matchmaking/matches/:matchId` → nút **Tiến hành đặt sân** →
`/matchmaking/matches/:matchId/book`.

**Các bước (đặt sân mới)**

1. Đăng nhập chủ kèo, mở chi tiết trận ở trạng thái chờ đặt sân.
2. Bấm **Tiến hành đặt sân**.
3. Trên trang đặt sân, lọc theo thành phố/quận nếu cần; kiểm tra danh sách cơ sở/sân gợi ý đúng
   khung giờ của kèo.
4. Bấm **Chọn sân này**, xem bảng xem trước: tổng tiền, mỗi người, danh sách thành viên.
5. Bấm **ĐẶT SÂN & CHIA TIỀN** và xác nhận.

**Các bước (liên kết booking đã thanh toán)**

1. Trong chi tiết trận, dùng khối **Chọn booking đã thanh toán** (BookingPicker).
2. Chọn một booking phù hợp và xác nhận liên kết.

**Kịch bản thiếu số dư ví**

1. Chọn một kèo mà một thành viên không đủ số dư.
2. Sau khi xác nhận, hệ thống báo lỗi thiếu số dư và hiển thị danh sách người bị chặn.
3. Bấm **Nhắc nạp ví** cho từng người hoặc **Nhắc tất cả nạp ví**.
4. Nạp ví cho thành viên đó rồi thử lại.

**Kết quả mong đợi**

- Tạo booking thành công, tiền chia đều và trừ ví đúng; trận chuyển sang đã xác nhận sân.
- Bảng chi phí trong chi tiết trận hiển thị từng người đã trả/đã hoàn.
- Khi thiếu ví: chặn đặt, liệt kê đúng người thiếu, gửi nhắc thành công, thử lại được sau khi nạp.
- Liên kết booking có sẵn cập nhật chi phí và trạng thái trận.

---

## 4. Admin Finance (ví, payout, hoàn tiền, đối soát)

**Mục tiêu:** kiểm tra module tài chính hợp nhất sau merge.

**Đường dẫn:** `/admin/finance/overview` và các tab:
`/admin/finance/transactions`, `/wallets`, `/top-ups`, `/payouts`, `/refunds`,
`/owner-earnings`, `/reconciliation`, `/reports`, `/audit`.

**Các bước**

1. Đăng nhập Admin, mở `/admin/finance/overview`, kiểm tra số liệu tổng quan theo khoảng thời gian.
2. Chuyển qua các tab, kiểm tra dữ liệu tải được và bộ lọc trạng thái hoạt động.
3. Tab **Payout**: duyệt/từ chối một yêu cầu rút tiền đang chờ.
4. Tab **Refunds**: kiểm tra danh sách hoàn tiền và trạng thái.
5. Tab **Owner earnings**: duyệt hoặc từ chối một settlement; thử **Chạy sweep**.
6. Tab **Đối soát**: bấm **Chạy đối soát**, kiểm tra kết quả.
7. Kiểm tra các đường dẫn cũ `/admin/wallet/*` tự chuyển sang `/admin/finance/*`.

**Kết quả mong đợi**

- Số liệu khớp với giao dịch thực tế; thao tác duyệt/từ chối cập nhật trạng thái và có toast.
- Xuất Excel/cash-flow/revenue tải file được.
- Redirect `/admin/wallet`, `/admin/wallet/payouts`, `/admin/wallet/refunds`,
  `/admin/wallet/reconciliation` về đúng tab finance.

---

## 5. Ví chủ sân và tự động cộng doanh thu

**Mục tiêu:** owner xem ví, rút tiền, và công tắc tự động cộng doanh thu.

**Đường dẫn:** `/owner/wallet`.

**Các bước**

1. Đăng nhập Court Owner, mở `/owner/wallet`.
2. Kiểm tra **Số dư khả dụng**, danh sách giao dịch/settlement.
3. Tạo **Yêu cầu rút tiền**: chọn tài khoản nhận tiền, nhập số tiền, gửi.
4. Ở phía Admin, duyệt payout tương ứng (xem mục 4).
5. Kiểm tra lại trạng thái yêu cầu rút ở ví owner.
6. Kiểm tra công tắc tự động cộng doanh thu theo hướng dẫn
   [`owner-wallet-earning-testing.md`](../guides/owner-wallet-earning-testing.md).

**Kết quả mong đợi**

- Số dư và lịch sử hiển thị đúng; không cho rút vượt số dư khả dụng.
- Sau khi admin duyệt, trạng thái payout cập nhật (đã duyệt/đã chuyển).
- Khi bật tự động: booking thanh toán thành công cộng ví owner ngay; khi tắt: vào hàng chờ duyệt.

---

## 6. Duyệt cơ sở, sân và đổi địa chỉ

**Mục tiêu:** admin xử lý hàng đợi duyệt hồ sơ.

**Đường dẫn:** `/admin/approvals`; badge đếm trên sidebar.

**Các bước**

1. Đăng nhập Admin, kiểm tra badge **Duyệt cơ sở & sân** trên sidebar (số hồ sơ chờ).
2. Mở `/admin/approvals`, lọc theo trạng thái/loại hồ sơ.
3. Mở một hồ sơ cơ sở, xem chi tiết; bấm duyệt.
4. Mở một hồ sơ sân hoặc đổi địa chỉ; bấm duyệt hoặc từ chối kèm lý do.
5. Quay lại danh sách, kiểm tra trạng thái và badge giảm.

**Kết quả mong đợi**

- Danh sách hiển thị đúng hồ sơ chờ/đã duyệt/bị từ chối.
- Duyệt/từ chối cập nhật trạng thái; lý do từ chối hiển thị cho owner.
- Badge trên sidebar giảm sau khi xử lý.

---

## 7. Báo cáo nội dung và kiểm duyệt của Admin

**Mục tiêu:** người dùng báo cáo bài viết/bình luận/tin nhắn; admin xem bằng chứng và xử lý.

**Đường dẫn:** feed `/feed`, chi tiết bài `/posts/:postId`, messaging; admin `/admin/reports`.

**Các bước**

1. Player mở menu thao tác trên một bài viết của người khác, chọn **Báo cáo bài viết**.
2. Chọn lý do, nhập mô tả nếu cần, gửi; kiểm tra màn xác nhận đã gửi.
3. Lặp lại với một bình luận (**Báo cáo**) và một tin nhắn (menu tin nhắn →
   **Báo cáo tin nhắn**).
4. Đăng nhập Admin, mở `/admin/reports`, mở chi tiết một báo cáo.
5. Kiểm tra **Bằng chứng tại thời điểm gửi** (văn bản/tệp/ảnh đính kèm).
6. Bấm **Đánh dấu đã xử lý**; với bài viết/bình luận có thể bấm **Ẩn**.

**Kết quả mong đợi**

- Báo cáo gửi thành công cho cả 3 loại đối tượng.
- Admin thấy đúng đối tượng, người báo cáo, mô tả và bằng chứng.
- Xử lý xong trạng thái chuyển sang đã xử lý; nội dung bị ẩn không còn hiển thị công khai.
- Với tin nhắn: chỉ xem bằng chứng đúng tin nhắn, không có thao tác ẩn (theo phạm vi MVP).

---

## 8. Thông báo (player và admin)

**Mục tiêu:** chuông thông báo và trang danh sách/chi tiết hoạt động sau merge.

**Đường dẫn:** player `/notifications`, `/notifications/:id`; admin
`/admin/notifications`, `/admin/notifications/:id`.

**Các bước**

1. Player bấm chuông trên header, kiểm tra panel gần đây và badge số chưa đọc.
2. Mở **Xem tất cả** → trang `/notifications`; mở một thông báo để xem chi tiết.
3. Đánh dấu đã đọc (nếu có) và kiểm tra badge giảm.
4. Admin bấm chuông trên Admin header, mở `/admin/notifications`, mở chi tiết.

**Kết quả mong đợi**

- Chuông hiển thị đúng số chưa đọc; panel không che mất ô tìm kiếm.
- Danh sách và chi tiết tải đúng; nội dung/tài nguyên liên kết điều hướng chính xác.

---

## 9. Cấu hình hệ thống

**Mục tiêu:** admin xem/sửa cấu hình nghiệp vụ.

**Đường dẫn:** `/admin/configs`.

**Các bước**

1. Đăng nhập Admin, mở `/admin/configs`.
2. Lọc theo nhóm/tìm kiếm; mở một cấu hình.
3. Sửa một giá trị hợp lệ, lưu; tải lại để xác nhận.
4. Thử nhập giá trị không hợp lệ để kiểm tra validate.

**Kết quả mong đợi**

- Cấu hình tải đúng nhóm, hiển thị giá trị mặc định rõ ràng.
- Lưu thành công và giữ giá trị sau khi tải lại; giá trị sai bị chặn kèm thông báo.

---

## 10. Admin Dashboard

**Mục tiêu:** bảng điều khiển vận hành hiển thị số liệu và điều hướng nhanh.

**Đường dẫn:** `/admin/dashboard`.

**Các bước**

1. Đăng nhập Admin, mở `/admin/dashboard`.
2. Kiểm tra các thẻ KPI và bảng hoạt động gần đây.
3. Đổi khoảng thời gian (`TimeRangeFilter`) và làm mới.
4. Bấm các quick action để điều hướng sang màn tương ứng.

**Kết quả mong đợi**

- KPI và bảng tải đúng theo khoảng thời gian.
- Quick action điều hướng đúng đích; không có link gãy sau merge.

---

## Checklist tổng hợp

| # | Luồng | Route chính | Kết quả |
| --- | --- | --- | --- |
| 1 | Booking ví + hủy/hoàn tiền | `/courts`, `/bookings` | [ ] Đạt [ ] Lỗi |
| 2 | Owner hủy booking | `/owner/schedule` | [ ] Đạt [ ] Lỗi |
| 3 | Split booking + chia tiền | `/matchmaking/matches/:id/book` | [ ] Đạt [ ] Lỗi |
| 4 | Admin finance | `/admin/finance/*` | [ ] Đạt [ ] Lỗi |
| 5 | Owner wallet + tự động cộng | `/owner/wallet` | [ ] Đạt [ ] Lỗi |
| 6 | Duyệt cơ sở/sân | `/admin/approvals` | [ ] Đạt [ ] Lỗi |
| 7 | Báo cáo + kiểm duyệt | `/feed`, `/admin/reports` | [ ] Đạt [ ] Lỗi |
| 8 | Thông báo | `/notifications`, `/admin/notifications` | [ ] Đạt [ ] Lỗi |
| 9 | Cấu hình hệ thống | `/admin/configs` | [ ] Đạt [ ] Lỗi |
| 10 | Admin dashboard | `/admin/dashboard` | [ ] Đạt [ ] Lỗi |

Khi ghi nhận lỗi, nên kèm: route, vai trò, bước tái hiện, ảnh chụp, và thông báo lỗi
(console/network) để dễ đối chiếu với thay đổi UI sau merge.
