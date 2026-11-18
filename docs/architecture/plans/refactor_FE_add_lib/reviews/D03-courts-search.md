# D03 — Tìm sân `/courts`: rà soát trước khi triển khai

- Ngày: 18/11/2026. Trạng thái rà soát: đã chốt hướng; triển khai và bàn giao ở plan §20.
- Route: `/courts` (Player), kể cả biến thể `?matchId=` khi đặt sân cho trận.
- Môi trường: Vite dev cổng 5198; phiên Player được mô phỏng, còn `GET /api/v1/courts` đi thẳng tới backend local (API công khai, chỉ đọc) nên ảnh dùng **dữ liệu thật**: 248 sân, 8 cơ sở, 2 thành phố. Lỗi/chờ được mô phỏng riêng.
- Ảnh và số đo: [`evidence/D03-before/`](../evidence/D03-before/), `notes.txt`.

## 1. Hiện trạng

| Màn | Ảnh |
| --- | --- |
| Mặc định 1280 / 768 / 390 | [1280](../evidence/D03-before/default-1280.png), [768](../evidence/D03-before/default-768.png), [390 toàn trang](../evidence/D03-before/default-390.png), [390 màn đầu](../evidence/D03-before/default-390-viewport.png) |
| Chỉ nhập tỉnh rồi tìm | [1280](../evidence/D03-before/city-only-validation-1280.png) |
| Gõ đúng placeholder “TP. Hồ Chí Minh” | [1280](../evidence/D03-before/placeholder-city-empty-1280.png) |
| Tìm theo khung giờ | [1280](../evidence/D03-before/window-search-1280.png) |
| Đang tải / lỗi / rỗng | [loading](../evidence/D03-before/loading-1280.png), [error](../evidence/D03-before/error-1280.png), [empty 390](../evidence/D03-before/empty-390.png) |
| Phân trang | [1280](../evidence/D03-before/pagination-1280.png) |
| Đặt sân cho trận | [1280](../evidence/D03-before/match-context-1280.png) |
| Focus bàn phím | [1280](../evidence/D03-before/keyboard-focus-1280.png) |

Không tràn ngang ở 390/768/1280 px.

## 2. Hành vi phải giữ nguyên

Nguồn: Booking PRD (§ tìm sân, quyết định “tìm theo khu vực, ngày, giờ; sắp theo giá”), Tech Design §9.1/§14, code `CourtSearchPage.tsx`, `CourtSearchFilters.tsx`, `CourtCard.tsx`, `useBookingMatchContext.ts`, E2E `booking-flow.spec.ts`.

1. Gọi `GET /api/v1/courts` với `city`, `district`, `date`, `startTime`, `endTime`, `page`, `limit=9`; không đổi API.
2. Lọc theo khung giờ chỉ khi có đủ `date` + `startTime` + `endTime`; giờ kết thúc phải sau giờ bắt đầu.
3. Server sắp theo giá tăng dần; `available` thực tế luôn `true` (khi có khung giờ, sân không trống bị loại khỏi kết quả).
4. “Xem lịch trống” mở `/courts/:id?date=…`, giữ `matchId` qua `forMatch()`; banner ngữ cảnh trận vẫn hiển thị và có link quay lại trận.
5. Trang chỉ đọc dữ liệu công khai; không tạo booking.
6. E2E `booking-flow.spec.ts` dựa vào việc vào `/courts` thấy tên cơ sở; giữ tên cơ sở hiển thị dạng text.

## 3. Nhận xét từ góc độ người dùng

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| U1 | P1 | Trong đợt | notes: 0 request, ảnh city-only | **Chỉ nhập tỉnh rồi bấm “Tìm sân” bị chặn** với lỗi “Vui lòng chọn đủ ngày, giờ bắt đầu và giờ kết thúc”, vì ô ngày đã điền sẵn hôm nay. Người dùng không tìm theo khu vực được nếu không xóa ngày | Ngày luôn có giá trị; chỉ bắt buộc **cả hai giờ** khi người dùng nhập một trong hai |
| U2 | P1 | Trong đợt + backlog backend | ảnh placeholder-city, `CourtRepository` ILIKE | Placeholder gợi ý “TP. Hồ Chí Minh” nhưng dữ liệu là “Hồ Chí Minh” → gõ đúng gợi ý ra **0 sân**. Gõ không dấu (“ho chi minh”) cũng 0. Tên quận không thống nhất (“Quận Gò Vấp”, “Bình Thạnh”) | Ngắn hạn: placeholder khớp dữ liệu, gợi ý “gõ một phần tên, có dấu”. Dài hạn (cần Tech Design/backend): tìm không dấu, danh sách tỉnh/quận — **cần chốt** |
| U3 | P1 | Cần chốt | page1: 8/9 thẻ cùng “Phúc Thịnh Quận 7” | Mỗi **sân** là một thẻ, nên một cơ sở 16 sân chiếm gần 2 trang. Người dùng phải lướt qua hàng loạt thẻ giống hệt để thấy cơ sở khác | Gom theo cơ sở trên trang (mục 6, Q1) |
| U4 | P2 | Trong đợt | notes: back/reload | **Mất bộ lọc và số trang** khi quay lại từ trang chi tiết hoặc tải lại (Gò Vấp, trang 2/5 → toàn bộ, trang 1/28). Không chia sẻ được link tìm kiếm | Lưu bộ lọc và trang vào URL (`?city=&district=&date=&from=&to=&page=`) theo plan §5.2 |
| U5 | P2 | Trong đợt | ảnh 1280 | Nhãn “Còn trống” hiện cho mọi sân kể cả khi chưa chọn giờ — không mang thông tin, dễ hiểu nhầm là còn trống cả ngày | Chỉ hiện “Trống 18:00–20:00” khi đã tìm theo khung giờ (Q3) |
| U6 | P2 | Trong đợt | ảnh 390 màn đầu | Mobile: 5 ô lọc xếp dọc chiếm cả màn hình đầu, chưa thấy kết quả nào | Thu gọn bộ lọc trên mobile (Q2) |
| U7 | P2 | Trong đợt | notes: raw message | Lỗi tải danh sách hiện nguyên văn message server | Thông điệp chung tiếng Việt + nút thử lại |
| U8 | P3 | Trong đợt | ảnh 1280 | Không cho biết kết quả đang sắp theo giá | Dòng tóm tắt “248 sân · giá thấp đến cao” |
| U9 | P3 | Giới hạn kỹ thuật | ảnh 1280 | Ô ngày/giờ native hiển thị theo locale trình duyệt (`11/18/2026`, `--:-- --` AM/PM) | Giữ input native (lịch chọn ngày cần `react-day-picker`, chưa có trong danh sách thư viện); nêu lại nếu muốn thêm thư viện |

## 4. Nhận xét từ góc độ thiết kế giao diện

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| D1 | P1 | Trong đợt | notes: focus | Ô nhập không có dấu hiệu focus (outline none, không ring, không đổi viền) | Dùng `Input`/`Label` primitive có focus ring như Auth |
| D2 | P2 | Trong đợt | `CourtCard.tsx` | Thẻ lặp địa chỉ hai lần (dòng địa chỉ đã gồm phường/quận, dòng sau lặp “phường, quận, thành phố”); tên cơ sở xuống 2 dòng chen với badge | Một dòng địa chỉ rút gọn (quận, thành phố) + icon; tên cơ sở 1–2 dòng không đè badge |
| D3 | P2 | Trong đợt | ảnh 1280 | Card đồng loạt nút xanh đậm → 9 CTA cùng trọng lượng, mắt không biết nhìn đâu | Cả thẻ là vùng bấm hoặc CTA nhẹ hơn; nhấn mạnh giá và tên |
| D4 | P2 | Trong đợt | 1165 inline style toàn dự án | Trang và 4 component dùng inline style/hex | Tailwind + token; tách `Pagination`, `EmptyState` thành component dùng chung (Bookings, Admin sẽ dùng lại) |
| D5 | P3 | Trong đợt | notes headings | Heading nhảy H1 → H3 | H2 cho tên cơ sở/nhóm |
| D6 | P3 | Trong đợt | notes loading | Skeleton không có `aria-busy`/thông báo; khối xám đơn sắc | Skeleton theo hình thẻ + `aria-busy` và chữ ẩn “Đang tải danh sách sân” |
| D7 | P3 | Trong đợt | notes pagination | Bấm “Sau” cuộn lên đầu nhưng focus ở lại nút “Sau” dưới đáy | Đưa focus về tiêu đề kết quả sau khi đổi trang |
| D8 | P3 | Ngoài đợt (shell) | ảnh 390 | Header Player trên mobile: chữ “SmashPro” bị cắt; bong bóng chat đè badge thẻ; footer ghi “© 2024 SmashPro Inc.” | Ghi backlog đợt Player shell |

## 5. Lỗi/khoảng trống chức năng

| ID | Phạm vi | Nội dung |
| --- | --- | --- |
| F1 | Trong đợt | Lỗi U1 chặn tìm theo khu vực (bug logic validation phía client) |
| F2 | Backlog backend | Tìm `ILIKE` phân biệt dấu, không chuẩn hóa tiền tố “TP.”/“Quận”; không có API danh sách địa điểm. Cần Tech Design trước khi đổi |
| F3 | Backlog API | API trả theo sân, phân trang theo sân; muốn kết quả theo cơ sở chuẩn xác cần endpoint/contract mới |
| F4 | Trong đợt | Không có bộ nhớ đệm: quay lại trang danh sách luôn tải lại từ đầu |

## 6. Hướng đề xuất và lựa chọn cần chốt

**Hướng chung (khuyến nghị):** dựng lại trang bằng Tailwind/primitive, bộ lọc là form RHF + Zod nhỏ, trạng thái lọc và trang nằm trên URL, dữ liệu qua TanStack Query (dữ liệu công khai, không cần phân tách theo tài khoản), giữ API hiện có.

- **Q1 — Cách trình bày kết quả.**
  A. *(khuyến nghị)* Gom theo cơ sở **trong trang hiện tại**: mỗi cơ sở một thẻ (tên, địa chỉ, giờ mở cửa, giá từ) kèm danh sách sân dạng nút nhỏ “Sân 01 · 80.000đ”. Một cơ sở có thể nối sang trang sau (ghi “tiếp theo ở trang sau”). Không đổi API.
  B. Giữ mỗi sân một thẻ nhưng gọn hơn (hàng ngang), tên cơ sở nhạt đi khi lặp liên tiếp.
  C. Đề xuất API tìm theo cơ sở (task backend riêng); D03 tạm làm B.
- **Q2 — Bộ lọc trên mobile.** Thu gọn: một nút “Bộ lọc” mở panel, hiển thị các lọc đang áp dụng dạng chip *(khuyến nghị)* / Giữ form xếp dọc như hiện tại.
- **Q3 — Nhãn trạng thái trên thẻ.** Chỉ hiện “Trống 18:00–20:00” khi đã tìm theo khung giờ *(khuyến nghị)* / Giữ “Còn trống” luôn hiển thị.
- **Q4 — Ô tỉnh/quận.** Giữ ô nhập tự do, sửa placeholder và gợi ý; ghi backlog tìm không dấu và danh sách địa điểm cho backend *(khuyến nghị)* / Mở task backend ngay trong D03 (vượt phạm vi UI).
- **Q5 — Lưu bộ lọc vào URL và dùng TanStack Query.** Có — back/reload giữ bộ lọc, quay lại hiện ngay từ cache *(khuyến nghị)* / Chỉ lưu URL, giữ cách gọi API hiện tại / Giữ nguyên.

Các điểm U1, U7, D1, D5–D7 là sửa lỗi/chuẩn hóa, làm trong đợt mà không cần chốt riêng.

## 7. Dự kiến file và kiểm thử

- **Sửa/thay:** `pages/CourtSearchPage.tsx`, `components/CourtSearchFilters.tsx`, `components/CourtCard.tsx` (hoặc `FacilityResultCard` nếu chọn Q1-A); thêm `hooks/use-court-search.ts` (Query + URL), schema bộ lọc.
- **Dùng chung mới:** `components/common/pagination.tsx`, `components/common/empty-state.tsx`; có thể thêm `components/ui/badge.tsx`, `skeleton.tsx`. `StateBlocks.tsx` còn consumer khác trong Booking (`LoadingCards`, `StateBlock`) — chỉ xóa phần không còn dùng.
- **Không đổi:** API/backend, `MatchBookingContext` (chỉ đổi style nếu cần), trang chi tiết sân (D04), Player shell.
- **Kiểm thử:** bộ test mới cho `/courts` với API mô phỏng (lọc khu vực, khung giờ, validation, URL/back/reload, phân trang và focus, rỗng/lỗi/đang tải, `matchId`, responsive 390/768/1280, bàn phím); chạy lại `booking-flow.spec.ts` nếu có môi trường test DB.

## 8. Quyết định của người dùng

### Quyết định của người dùng — 18/11/2026

| Câu | Quyết định |
| --- | --- |
| Q1 | Gom theo cơ sở trong trang: mỗi cơ sở một thẻ, các sân là nút nhỏ; không đổi API |
| Q2 | Mobile thu gọn: ô khu vực luôn hiện, ngày/giờ trong panel “Bộ lọc”, lọc đang áp dụng hiện dạng chip |
| Q3 | Chỉ hiện nhãn “Trống HH:mm–HH:mm” khi đã tìm theo khung giờ |
| Q4 | Sửa placeholder/gợi ý ở UI; tìm không dấu và danh sách địa điểm ghi backlog backend |
| Q5 | Bộ lọc và trang trên URL; dữ liệu qua TanStack Query |

U1, U7, D1, D5–D7 sửa trong đợt.

**Bổ sung 18/11/2026 (sau khi xem bản đầu):** người dùng chốt phân trang theo **cơ sở** thay vì gom trong trang; thêm API `GET /api/v1/facilities` (plan §20.5). D03 chuyển `IN_PROGRESS`, sau đó `AWAITING_REVIEW` khi bàn giao (plan §20).
