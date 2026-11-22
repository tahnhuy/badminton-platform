# SmashPro — bản mẫu trang giới thiệu v1

Ngày: **2026-11-22**. Trạng thái: **APPROVED (2026-11-22)** — chuẩn trải nghiệm cho AUTH-34. Email hợp tác vẫn là chỗ giữ chỗ (`[TBD]` trong PRD).

Trang công khai cho khách chưa đăng nhập ở `/`: giới thiệu SmashPro, mời làm khảo sát trình độ (đăng ký) hoặc đăng nhập. Người đã đăng nhập vẫn được chuyển về trang chủ theo vai trò như hiện tại. Phong cách DS01 (xanh rừng, lime, Inter), dùng lại minh họa sân của trang đăng nhập.

## Mở và thử

```bash
python3 -m http.server 5181 --bind 127.0.0.1 --directory docs/design
```

Mở **http://localhost:5181/smashpro-landing-v1/**. Bản mẫu dùng font/icon của `../smashpro-auth-v1/assets/`; nút đăng ký dẫn tới bản mẫu khảo sát `../smashpro-auth-v3/`, nút đăng nhập tới `../smashpro-auth-v2/#sign-in`.

## Quyết định đã chốt (2026-11-22)

| Câu hỏi | Lựa chọn |
| --- | --- |
| Dải chủ sân | Dải nhỏ + nút "Liên hệ hợp tác" (mailto); tài khoản chủ sân vẫn do Admin tạo |
| Dữ liệu | Chỉ nội dung tĩnh, không gọi API, không số liệu bịa |
| Cách làm | Bản mẫu HTML trước, duyệt rồi mới sửa tài liệu và code |
| Nút chính | "Khám phá trình độ – 3 phút" (khảo sát làm mồi) + "Tôi đã có tài khoản" |

## Bố cục

1. **Header dính**: logo, mục lục (Tính năng · Cách bắt đầu · Trình độ · Chủ sân, tô sáng theo vị trí cuộn), Đăng nhập + Tạo tài khoản. Nền mờ khi cuộn.
2. **Hero** xanh rừng: "Hẹn nhau trên sân.", lời mời, 2 nút, 2 điểm "Miễn phí tạo tài khoản · 16 câu hỏi, không có câu sai"; minh họa sân trượt nhẹ theo chuột, quả cầu bay theo đường cong, chip nổi "7 bậc trình độ", "Ví & chia tiền sân".
3. **4 thẻ tính năng**: Tìm kèo đúng trình độ · Đặt sân, trả bằng ví · Bảng tin & nhắn tin · Giải đấu chuyên nghiệp.
4. **3 bước**: Khảo sát → Nhận bậc → Ra sân; đường nối tự vẽ khi cuộn tới.
5. **Thang 7 bậc tương tác**: cột cao dần, chọn bằng chuột hoặc phím mũi tên/Home/End để xem mô tả (matrix §1.2); nút "Làm khảo sát ngay"; ghi chú "tạm thời".
6. **Dải chủ sân** + **CTA cuối** "Sẵn sàng ra sân?" + footer.
7. **Mobile (≤ 720px)**: header chỉ còn nút đăng nhập dạng icon; thanh nút dính dưới cùng xuất hiện khi nút hero đã cuộn khỏi màn hình và ẩn khi tới CTA cuối.

Khối hiện dần khi cuộn (90 ms lệch nhau); reduced motion tắt toàn bộ chuyển động, quả cầu và parallax.

## Cần duyệt

| # | Nội dung | Ghi chú |
| --- | --- | --- |
| 1 | Bố cục và câu chữ | Câu chữ là đề xuất, sửa thoải mái |
| 2 | Email hợp tác | `hoptac@smashpro.example` là **chỗ giữ chỗ** — cần email thật hoặc bỏ mailto |
| 3 | Thay đổi route | `/` cho khách chưa đăng nhập → trang này (cần sửa bảng route `frontend.md` §4.2, `RequireAuth`/router và ghi chú trong Auth PRD §7.8) |
| 4 | Trang đăng nhập/đăng ký có link quay về trang giới thiệu | Ví dụ bấm logo |

## Khi chuyển sang React

- `features/landing/` (hoặc `features/public/`), route `/` công khai: chưa đăng nhập → `LandingPage`, đã đăng nhập → `getRoleHomePath(role)`; lazy-load.
- Thang bậc lấy từ `GET /api/v1/skill-levels` (đã công khai), không giữ bản sao mô tả.
- Motion cho reveal/parallax theo quy tắc `frontend.md` §1; IntersectionObserver cho mục lục và thanh nút mobile.
- E2E: khách thấy trang giới thiệu, Player/Owner/Admin đã đăng nhập được chuyển đi, 390/1280 px không tràn ngang, reduced motion.

## Đã kiểm tra

Chrome 1440 và 390 px: không tràn ngang, không lỗi JavaScript hay tải tài nguyên; chọn bậc hiển thị đúng mô tả; thanh nút mobile hiện đúng lúc. Chưa thử Safari/Firefox.
