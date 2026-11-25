# SmashPro — bản mẫu Giải đấu v1

Ngày: **2026-11-25**. Trạng thái: **CHỜ DUYỆT** — chuẩn trải nghiệm cho TRN-07 (trang Player) và TRN-08 (bảng điều khiển Organizer). Dữ liệu là minh họa (`data.js`), không gọi API. Phong cách DS01 (token trong `frontend/src/index.css`), font/icon dùng chung `../smashpro-auth-v1/assets/`.

## Mở và thử

```bash
python3 -m http.server 5181 --bind 127.0.0.1 --directory docs/design
```

Mở **http://localhost:5181/smashpro-tournament-v1/**. Thanh tối trên cùng chỉ có trong bản mẫu: đổi **Người xem** (Khách · Player đủ điều kiện · Player trình Yếu · Player đã đăng ký · Organizer) và **Trạng thái giải #1** (Đang mở · Đã đóng · Đang diễn ra · Đã kết thúc) để xem từng trường hợp.

## Các màn

| Route bản mẫu | Màn | Nội dung chính |
| --- | --- | --- |
| `#/` | Danh sách giải | Tìm theo tên, lọc trạng thái / đơn–đôi / miễn phí / **hợp trình độ tôi**; thẻ giải có lệ phí, trình độ, thanh slot, nhãn "Hợp trình" |
| `#/t/1` | Chi tiết giải | Hero xanh rừng: trạng thái, ngày, địa điểm, Organizer, 4 số liệu; nút chính theo người xem (đăng ký · đăng nhập để đăng ký · không đủ trình kèm lý do · đã đăng ký/rút · quản lý · chia sẻ kết quả) |
| ↳ tab Thông tin | | Thông tin + thể lệ; **Trận tiếp theo của bạn** (giờ, sân, đối thủ, nhắc 30 phút); nhóm chat của giải; quy định rút/vắng mặt/bỏ cuộc |
| ↳ tab Người tham gia | | Tên, trình độ, hạt giống (sau bốc thăm); không email/điện thoại |
| ↳ tab Nhánh đấu | | Cột theo vòng, BYE/walkover/bỏ cuộc, tỉ số từng set, trận đang đánh viền đỏ, ô Vô địch |
| ↳ tab Lịch thi đấu | | Theo giờ, sân, trạng thái; trận của mình được tô |
| Hộp thoại đăng ký | | Lệ phí, số dư ví, số dư sau; thiếu tiền → nút Nạp ví |
| `#/t/1/manage` | Bảng điều khiển Organizer | Thanh tiến trình 6 bước + 6 mục: |
| ↳ Thiết lập | | Form tạo/sửa; trường bị khoá theo trạng thái có ghi lý do; cài đặt sân ảo; Đóng đăng ký, Huỷ giải (hoàn 100%) |
| ↳ Người tham gia | | Bảng VĐV; **Loại** kèm lý do bắt buộc + hoàn tiền (trước bốc thăm) |
| ↳ Hạt giống & bốc thăm | | Gợi ý theo trình độ, sửa số hạt giống, xem trước cặp vòng 1, "Bốc thăm & xếp lịch" |
| ↳ Lịch thi đấu | | **Bảng sân × giờ**; bấm trận chưa đánh để sửa sân/giờ, cảnh báo xung đột tức thì (không chặn lưu); "Xếp lại tự động" |
| ↳ Trận đấu | | Bắt đầu · Walkover · Nhập tỉ số · Sửa; hộp thoại tỉ số kiểm tra luật **ngay khi gõ** (cùng luật backend), set 3 chỉ mở khi 1–1, xem trước người thắng; tab Bỏ cuộc / Huỷ trận |
| ↳ Kết thúc giải | | Lệ phí sẽ chuyển vào ví Organizer; tự kết thúc sau 3 ngày; cửa sổ sửa 48 giờ |
| `#/new` | Tạo giải | Form Thiết lập trống |
| `#/mine` | Giải của tôi | Đã đăng ký · Tổ chức · Lời mời vào đội |

Mobile 390 px: không tràn ngang (kiểm bằng Playwright); tab cuộn ngang; bảng lịch cuộn ngang; hộp thoại tỉ số vừa màn hình. Reduced motion tắt toàn bộ chuyển động.

## Cần duyệt

| # | Câu hỏi | Đề xuất của bản mẫu |
| --- | --- | --- |
| 1 | Thanh điều hướng Player hiện có 5 mục (Cộng đồng · Tìm đối thủ · Sân · Tin nhắn · **Đánh giá**). Thêm "Giải đấu" thế nào? | Thay mục **Đánh giá** bằng **Giải đấu** (đánh giá sau trận đã tạm hoãn theo Brief; trang đánh giá vẫn vào được từ hồ sơ) |
| 2 | Nhánh đấu trên mobile | Cuộn ngang toàn bộ nhánh (như bản mẫu) |
| 3 | Sửa lịch | Bấm trận → hộp thoại sửa sân/giờ (bản mẫu). Kéo-thả trên bảng để sau |
| 4 | Hero xanh rừng ở trang chi tiết | Giữ (đồng bộ landing/kết quả khảo sát) |
| 5 | Câu chữ | Là đề xuất, sửa thoải mái |

Chưa có trong bản mẫu (làm ở task sau, dùng lại thành phần ở đây): đội đôi và lời mời (TRN-09), bảng xếp hạng thành tích (TRN-18), mục Giải đấu trên hồ sơ (TRN-16), trang Admin (TRN-12).

## Khi chuyển sang React

- `frontend/src/features/tournaments/` — React Query, RHF + Zod, primitive shadcn có sẵn; route theo Tech Design §12.
- Luật tỉ số: dùng lại bảng luật của `backend/src/services/tournaments/result/score.ts` (bản JS ở `score.js`).
- Thời lượng chuyển động trong khuôn khổ 150–300 ms của `frontend.md` §1.
