# DS01 — Nền thiết kế thống nhất: rà soát trước khi triển khai

> 19/11/2026: ảnh/kết quả chạy tạm đã được dọn theo yêu cầu giữ repository gọn. Các kết luận kiểm tra bên dưới được giữ; không cần lưu snapshot từng lần chạy trong Git.

- Ngày: 18/11/2026. Trạng thái rà soát: đã chốt hướng; triển khai và bàn giao ở history §21.
- Lý do có đợt này: người dùng chọn chèn DS01 (token + quy chuẩn bố cục + kiểm tra tự động) và SH01 (Player shell) trước D04 để các đợt trang sau dùng chung một nền.
- Bản so sánh: [`docs/design/ds01-palette/index.html`](../../../../design/ds01-palette/index.html), ảnh `previews/options-1440.png`.

## 1. Hiện trạng đo được

| Hạng mục | Kết quả |
| --- | --- |
| Bảng màu | **Hai bộ song song.** Bộ cũ theo Figma (`--bg-app` #FAF8FF tím nhạt, `--text-primary` #131B2E navy, `--text-secondary` #505F76 xanh xám) dùng ở mọi trang cũ: `var(--text-secondary)` 232 lần, `var(--text-primary)` 187, `var(--color-brand)` 175. Bộ mới (Sign-in v2: nền #F2F5EF, chữ #172C24, chữ phụ #68756E, viền #DFE7DC) chỉ ở Auth. Các trang D02/D03 trộn: nền trang cũ + token mới |
| Tương phản | Chữ phụ Sign-in v2 #68756E trên nền #F2F5EF = **4,38:1 — dưới chuẩn AA 4,5** (header/footer Sign-in). Trên nền trắng 4,82 đạt |
| Cỡ chữ | 15 giá trị trong inline style; nhiều nhất 13 px (217), 12 px (112), 11 px (79), 10 px (17), 9 px (3) |
| Bo góc | 10 giá trị (4, 6, 7, 8, 10, 12, 14, 16, 999, 9999) |
| Mã hex trong TSX | ~370 lần; nhiều nhất Player (156) và Admin (148) |
| Token trùng nghĩa | `brand-ink` vs `--text-primary`, `brand-muted` vs `--text-secondary/--text-muted`, `brand-border` vs `--border-*`, `brand-soft` vs `--bg-subtle`, `success` = `brand` |

## 2. Nhận xét

**Người dùng:** đi từ Sign-in (nền xanh lá dịu) vào app (nền tím nhạt, chữ navy) như sang sản phẩm khác; trong cùng trang `/courts` thẻ mới viền xanh lá nằm trên nền tím. Nhiều chữ 10–11 px khó đọc trên điện thoại.

**Thiết kế:** không có nguồn sự thật duy nhất cho màu chữ/nền/viền; mỗi đợt tự chọn cỡ chữ và bo góc → càng chuyển nhiều trang càng lệch. Thiếu mẫu trang (danh sách, chi tiết, form, bảng quản trị) nên bố cục mỗi đợt tự quyết.

## 3. Đề xuất phạm vi DS01

1. **Một bộ token ngữ nghĩa** trong `index.css`: `background`, `card`, `foreground`, `muted-foreground`, `border`, `input`, `primary`, trạng thái (`success/caution/danger/info` + nền). Token `brand-*` trang trí (forest, lime, mint…) giữ cho hero Auth. Bỏ token trùng nghĩa.
2. **Thang chữ:** 12 (tối thiểu cho chữ có thông tin) / 14 / 16 / 18 / 24 / 30 px. **Bo góc:** 8 / 12 / 16 / 28 / tròn. Khoảng cách bội số 4 px; khung trang tối đa 1440 px, lề 16/24 px.
3. **Mẫu trang** viết vào `frontend.md`: trang danh sách có bộ lọc (như `/courts`), trang chi tiết, trang form, trang bảng quản trị; component dùng chung tương ứng (`PageHeader`, `PageContainer`).
4. **Kiểm tra tự động** `npm run check:ui`: trong các thư mục/file đã chuyển, báo lỗi khi có mã hex, `style={{…}}` giá trị tĩnh, `var(--legacy-token)` hoặc file CSS mới. Danh sách file đã chuyển nằm trong một file cấu hình, mỗi đợt thêm vào.
5. Áp dụng lại cho các trang đã chuyển (Auth, `/courts`) và sửa lỗi tương phản.

Ngoài phạm vi: đổi bố cục trang cũ, dark mode, Player shell (SH01).

## 4. Câu hỏi cần chốt

- **Q1 — Bảng màu chung** (xem ảnh so sánh): A xanh lá dịu mở rộng Sign-in v2 *(khuyến nghị: khớp mẫu đã duyệt, chữ phụ chỉnh đậm hơn để đạt AA)* / B trung tính, xanh chỉ cho điểm nhấn / C giữ bảng màu cũ theo Figma (khi đó Auth phải đổi theo).
- **Q2 — Cách áp dụng cho trang cũ:** đổi giá trị các biến cũ (`--bg-app`, `--text-primary`…) sang bảng màu mới ngay, để mọi trang cũ đổi màu cùng lúc; mã hex viết cứng (~370) chưa theo cho tới đợt của trang đó *(khuyến nghị)* / chỉ trang đã chuyển dùng bảng màu mới, trang cũ giữ nguyên đến đợt của nó.
- **Q3 — Thang chữ và bo góc** như mục 3.2 *(khuyến nghị)* / điều chỉnh.
- **Q4 — Kiểm tra tự động `check:ui`** cho phần đã chuyển *(khuyến nghị)* / không làm.

## 5. Quyết định của người dùng

| Câu | Quyết định (18/11/2026) |
| --- | --- |
| Q1 | Bảng màu A — xanh lá dịu mở rộng Sign-in v2; chữ phụ #5B6862 để đạt AA |
| Q2 | Đổi giá trị biến cũ ngay để mọi trang cũ đổi màu; hex viết cứng xử lý theo đợt của trang |
| Q3 | Thang chữ 12/14/16/18/24/30 px, bo góc 8/12/16/28/tròn |
| Q4 | Thêm `npm run check:ui`, chạy cùng lint |

DS01 chuyển `IN_PROGRESS`, sau đó `AWAITING_REVIEW` khi bàn giao (history §21).

Hồ sơ rà soát/bàn giao cũ tham chiếu [lịch sử](../frontend-modernization-history.md); trạng thái hiện tại theo [kế hoạch chính](../frontend-modernization-review-plan.md).
