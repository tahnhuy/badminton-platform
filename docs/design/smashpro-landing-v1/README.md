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

## Bản cập nhật 2026-11-22 (sau góp ý UI/UX)

- Hero và CTA cuối **tràn viền** (nội dung giữ khung 1320 px); footer nền xanh rừng; dải "3 bước" nền nhạt tràn viền.
- Header **cố định, trong suốt trên hero** (chữ trắng, logo nền lime) và chuyển sang nền mờ khi cuộn qua hero; thanh tiến độ cuộn mảnh dưới header; mục lục không sáng khi đang ở hero.
- Hero thấp hơn (tối đa 700 px, gồm header), nút phụ đổi thành link chữ "Tôi đã có tài khoản", thêm dòng "16 câu chọn nhanh, không có câu sai → tạo tài khoản miễn phí ở bước cuối".
- **Thẻ kèo minh họa** thay chip "Ví & chia tiền sân": cho thấy giao diện sản phẩm (dữ liệu minh họa, không phải dữ liệu thật); avatar bật vào lần lượt, ô trống nhấp nháy "+1" rồi đổi "Đủ người ✓".
- Thang 7 bậc có **tên bậc** dưới cột (desktop) và tự chạy demo 1 → 4 một lần, dừng khi người dùng chạm.
- Hiệu ứng: chữ hero hiện lần lượt, minh họa phóng nhẹ vào, vệt sáng lướt nút chính, quầng sáng theo con trỏ trên thẻ tính năng, đường nối 3 bước tự vẽ và icon bật theo thứ tự, logo xoay nhẹ khi rê chuột. Reduced motion: tắt toàn bộ, hiện trạng thái cuối ngay.
- Bỏ họa tiết vạch sân hai bên và viền nét đứt của dải chủ sân.
- Khi header nằm trên hero, nút "Tạo tài khoản" là viền mảnh (chỉ nút chính của hero có màu lime); cuộn qua hero thì nút header trở lại nền xanh.

**Thời lượng chuyển động** (hiện dần 560 ms, hero 640–900 ms, chip/thẻ trôi nổi lặp lại) vượt hướng dẫn 150–300 ms của `frontend.md` §1 — đây là ngoại lệ trang trí của trang giới thiệu, như bản mẫu khảo sát v3; khi làm React có thể rút ngắn hiện dần về ~300 ms.

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
