# Đối chiếu Figma và frontend Ratings

Ngày rà soát: 18/10/2026. Trạng thái: **Đề xuất**, chưa phải đặc tả Ready hoặc xác nhận hoàn thành triển khai.

## Căn cứ và giới hạn

- Thiết kế: [Badminton SmashPro](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro), page `ALLL` (`5:2`). Đã đọc nội dung P25, P04, P23, P40, P44, P85, P32, P56–58, A03, A19 và xem ảnh P25.
- Quy tắc: [Project Brief](../../../../PROJECT-BRIEF.md), [Ratings PRD](prd.md) §4, §8–9, §15; [Tech Design](tech-design.md) §9, §23; [Frontend Architecture](../../../architecture/frontend.md), [Profile PRD](../../player/profile/prd.md).
- Code: `frontend/src/features/ratings/`, các host Matchmaking, router, Admin User Detail, backend Ratings routes/service và các bài E2E Ratings hiện có.
- Đây là rà soát thiết kế và mã nguồn; chưa chạy trình duyệt trên ứng dụng, chưa chạy lại E2E. Các vấn đề tương tác bên dưới là kết luận từ code, cần xác minh bằng trình duyệt khi triển khai.
- Figma là tham chiếu thị giác. Phạm vi và hành vi theo tài liệu nghiệp vụ đã duyệt; không sao chép nội dung vượt MVP.

## 1. Kết luận

Không cần xây lại Ratings từ đầu. Nền tảng hai chiều điểm, gửi một phần, gửi lại an toàn, xem bản đã gửi và Admin tra cứu đã có. Cần hoàn thiện cách trình bày, ngữ cảnh và khả năng khám phá; bổ sung tổng hợp trên hồ sơ theo module Profile; tích hợp Tournament khi có host thực tế.

P25 có thể cung cấp cách trình bày bằng thẻ người chơi, banner trận và vùng hướng dẫn. Nội dung ELO, FairPlay dạng điểm, đánh giá sân và form khác nhau theo từng người không phù hợp sản phẩm hiện tại.

## 2. Xung đột và phần dư trong Figma

| Màn hình | Quan sát | Xử lý đề xuất |
| --- | --- | --- |
| [P25](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-64508) | Đồng đội chỉ có tinh thần hợp tác; một đối thủ có ba lựa chọn thực lực; đối thủ còn lại chỉ có thái độ. | Mỗi người được chọn đều có **Kỹ năng 1–5 + Thái độ 1–5**, nhận xét tùy chọn. Áp dụng giống nhau cho đồng đội và đối thủ. |
| P25 | Sao hiển thị sẵn 5/5, tag khen ngợi đã được chọn. | Giữ trạng thái ban đầu chưa chọn điểm như code hiện tại. Bỏ tag vì contract không có trường này; không tự gán điểm hoặc chuyển tag thành dữ liệu mới. |
| P25 | Nói đánh giá cân bằng ELO, đóng góp huy hiệu và điểm Uy tín, thuật toán ghép cặp thông minh. | Thay bằng giải thích điểm kỹ năng là đầu vào cho điều chỉnh trình độ có giới hạn. Điểm thái độ là chiều đánh giá riêng; không suy ra điểm phạt hay ưu tiên ghép trận. |
| P25 | Đánh giá thảm sân, ánh sáng. | Bỏ cả khối: Court Rating nằm ngoài MVP. |
| P25 | Bảng tỷ số và thời lượng thực đấu 58 phút. | Với trận giao lưu, chỉ hiển thị thông tin thật từ host: loại trận, giờ đặt/lịch chơi, sân và người tham gia. Không dựng tỷ số hoặc coi thời lượng booking là thời lượng thi đấu thực tế. Kết quả giải chỉ hiển thị nếu domain Tournament cung cấp. |
| P25 | “Gửi đánh giá & Hoàn tất” dễ hiểu là phải đánh giá cả ba người. | Giữ gửi một tập con không rỗng; CTA ghi “Gửi đánh giá (N người)”. Cho phép đóng/bỏ qua, không phạt và không đặt hạn chót mới. |
| [P23](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-97013) | Tự gửi yêu cầu đánh giá sau một giờ cố định, tính ELO, xác thực tỷ số. | CTA chỉ dựa trên `COMPLETED` và phản hồi eligibility của server. Không thêm rating notification vì chưa có event được duyệt. |
| [P40](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-65756), P04, P44, P85 | ELO, biến động điểm, FairPlay 98/100, khảo sát ELO, radar sáu trục và bảo chứng BWF/HBF. | Dùng trình độ trong catalog và tổng hợp hai chiều rating. Không có dữ liệu/cơ chế đã duyệt cho các chỉ số hoặc tuyên bố bảo chứng này. |
| [P32](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=6-3756), P56 | Hạng ELO, biến động ELO, “Bình chọn FairPlay”. | Dùng trình độ catalog; tái sử dụng form rating chuẩn trong trận giải đủ điều kiện. Không tạo hệ thống bình chọn riêng. |
| P57 | Trừ điểm FairPlay và đình chỉ ba tháng khi walkover. | Không suy ra chế tài từ rating. Walkover không được đánh giá; vi phạm thuộc Report Management theo quy trình riêng. |
| [A03](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-75447), A19 | Biểu đồ uy tín, khấu trừ FairPlay và dung sai ELO. | Phần Ratings của Admin chỉ đọc bản ghi và lịch sử điều chỉnh. Các config Ratings dùng khóa đã duyệt; không dùng ELO/FairPlay. Việc xây UI cấu hình là phạm vi System Config riêng. |

## 3. Hiện trạng frontend và điểm thiếu

| Khu vực | Đã có trong code | Khoảng trống và mức ưu tiên |
| --- | --- | --- |
| `RatingModal.tsx` | Hai điểm bắt buộc, comment ≤500 ký tự, chọn một phần người chơi, pending/rated, loading/error/retry, chống gửi lặp, tải lại sau thành công. | **P1:** tiêu đề “Đánh giá đối thủ” chưa bao quát đồng đội. Thiếu loại trận/ngày/sân, tiến độ và dấu hiệu đang chọn bao nhiêu người. |
| `StarRating.tsx` | Sao 1–5, nhãn ARIA, trạng thái chưa chọn. | **P1:** `label` chỉ dùng cho ARIA, không render nhãn chữ nhìn thấy được; hai hàng sao không thể hiện rõ kỹ năng hay thái độ cho người nhìn. Chưa có điều hướng phím mũi tên/roving focus theo mẫu radio group. `invalid` mới thể hiện bằng màu, chưa nối lỗi tới nhóm sao. |
| Form validation | Chặn gửi khi thiếu điểm hoặc không chọn người. | **P1:** lỗi đang ở đầu form, không gắn cụ thể với từng trường và không đưa focus tới trường lỗi. Nên chỉ đánh dấu người được chọn, giữ nguyên draft để sửa. |
| Đóng modal | Có nút đóng, Escape, backdrop, focus trap và khóa scroll. | **P1:** lúc gửi chỉ nút đóng ở footer bị khóa; nút X, Escape và backdrop vẫn đóng được. Cần trạng thái “đang gửi” nhất quán, tránh người dùng mất dấu kết quả. **P2:** hook chưa trả focus về nút mở khi đóng. |
| `MatchDetailPage.tsx` | Chỉ mở rating khi trận hoàn tất, xử lý lỗi tải pending, all-rated vẫn xem được. | **P1:** đổi CTA thành “Đánh giá người chơi”; thêm số còn lại và tóm tắt ngữ cảnh khi mở form. |
| `MyMatchesPage.tsx` | Có rating trên trận hoàn tất, xem lại khi đã gửi hết. | **P1:** danh sách hiện là `ul/li` cơ bản, chưa có cấu trúc thẻ rõ ràng như P40. **P2:** mỗi trận hoàn tất gọi pending riêng; gửi xong tăng một version chung làm các entry tải lại. Đây là chi phí request, chưa phải bằng chứng lỗi hiệu năng. |
| `/ratings/given` | Route trong PlayerLayout, navigation, bảng, phân trang, empty/error/retry, comment render dạng text. | **P1:** cần bố cục responsive cho tên/comment dài. Match ID là text hiện là lựa chọn an toàn vì API chưa trả domain của trận; không gọi đây là lỗi thiếu link. |
| Tổng hợp đánh giá | Có `ratingsService.getSummary()` và kiểu `RatingSummary`; backend có endpoint. | **P1:** chưa có chỗ gọi/hiển thị trong frontend. Own-profile/public player card chưa triển khai; home vẫn placeholder. Đây là khoảng trống của luồng xem đánh giá đã nhận, cần phối hợp Profile. |
| Admin User Detail | `UserRatingsPanels` có given/received và lịch sử điều chỉnh, phân trang riêng, chỉ đọc. | **P2:** 7 cột trong modal dễ chật; cần kiểm tra mobile, dùng tab/section rõ ràng, có retry từng section và tên nguồn điều chỉnh dễ hiểu thay vì raw `source`. |
| Tournament | Backend Ratings có eligibility; có error copy cho disabled/not-played. | **Phụ thuộc:** chưa có `features/tournament/`, route hiện placeholder. RT-05 đã ghi BLOCKED phần Tournament host. Không thể coi reusable modal là đã hoàn tất tích hợp giải đấu. |

Những điểm đúng cần giữ: không tự đánh giá; không sửa/xóa sau gửi; không ép đánh giá đủ mọi người; duplicate trả thành công rồi đọc lại server; không lộ danh tính người đánh giá trong giao diện tổng hợp của Player. Admin mới được xem received rows và lịch sử điều chỉnh qua API hiện tại.

## 4. Bố cục đề xuất

### Form rating — cải thiện modal đang có

Giữ cách mở modal từ chi tiết/lịch sử trận trong đợt đầu, tránh thêm route chỉ để giống P25. Dùng vùng dialog rộng hơn trên desktop, xếp một cột trên mobile; bảo đảm nội dung cuộn được và nút gửi dễ tìm.

1. Đầu form: “Đánh giá người chơi sau trận”, mã trận, loại trận, ngày giờ và sân nếu host đã có dữ liệu. Badge “Đã gửi X/Y người”.
2. Thẻ người chơi: tên, checkbox chọn đánh giá; hai nhãn chữ “Kỹ năng” và “Thái độ”, mỗi nhãn có sao 1–5 và số điểm; nhận xét kèm bộ đếm. Không đoán team/avatar/skill nếu dữ liệu chưa có.
3. Khu “Đã gửi”: bản đã ghi nhận gồm hai điểm, comment và thời gian gửi từ `rating.createdAt`; không có hành động sửa/xóa.
4. Hướng dẫn ngắn: tự nguyện, không tự đánh giá, không sửa sau gửi; kỹ năng có thể ảnh hưởng điều chỉnh trình độ theo cấu hình. Không hứa mỗi lượt gửi đều đổi trình độ.
5. Cuối form: “Đóng” và “Gửi đánh giá (N người)”; sau gửi thành công giữ modal để xem bản ghi và tiếp tục người còn lại. Khi hết pending, hiện “Bạn đã đánh giá tất cả người chơi” và nút “Đóng”.

**Dữ liệu:** `PendingResponse` hiện chỉ có loại trận, ID và người pending/rated; không có ngày/sân/team/avatar/trình độ. Có thể truyền ngữ cảnh hiển thị từ Matchmaking host qua props tùy chọn; eligibility vẫn dựa trên Ratings API. Không gọi endpoint Matchmaking để lấy chi tiết một Tournament Match.

### Hồ sơ và tổng hợp

- Đặt hai ô “Kỹ năng trung bình”, “Thái độ trung bình”, cùng tổng số đánh giá trong own-profile/public player card theo Profile spec. Điểm sao là phản hồi, khác với trình độ hiện tại trong catalog.
- Dưới ba đánh giá, giao diện Profile chỉ hiện số lượng và “Chưa đủ dữ liệu”; không render trung bình, phân bố hay suy ra điểm bị ẩn. Không dùng `null` như điểm 0.
- Khi đủ dữ liệu, dùng giá trị tổng hợp từ server. Không đưa danh sách người gửi, nhận xét cá nhân hay thời điểm từng received rating vào Player UI.
- Không tái sử dụng `StarRatingDisplay` nguyên trạng cho số trung bình lẻ: component hiện dùng `String.repeat()` cho sao nguyên. Cần kiểu hiển thị riêng phù hợp số thập phân, kèm con số rõ ràng.
- “Đánh giá đã gửi” dẫn tới route hiện có. Không thêm Player adjustment-history view vì endpoint lịch sử hiện chỉ cho Admin; việc mở rộng cần quyết định riêng.

### Lịch sử trận và Admin

- P40: thẻ gồm mã trận, loại, thời gian, sân, trạng thái, “Xem chi tiết” và CTA đánh giá/xem lại. Không cần winrate/ELO hoặc tỷ số giả để làm đẹp bố cục.
- Lịch sử rating: desktop dùng DataTable hiện có; mobile cân nhắc thẻ theo hàng hoặc vùng cuộn rõ ràng. Comment dài phải wrap; luôn có người nhận, hai điểm, mã trận, ngày gửi.
- Admin: nhóm ba section đọc riêng biệt, giữ pagination độc lập; lỗi section có retry riêng. Không thêm nút phạt, sửa điểm, xóa rating hoặc chỉnh tay trình độ.

## 5. Kế hoạch thực hiện và tiêu chí nghiệm thu

| Đợt | Công việc | Điều kiện nghiệm thu |
| --- | --- | --- |
| 1 — ưu tiên trước | Đổi wording đồng đội/đối thủ; render nhãn hai chiều; thêm ngữ cảnh, tiến độ, CTA số người; lỗi theo trường; radio keyboard; thống nhất đóng khi gửi và trả focus. | Trận đơn/đôi đều gửi được một phần; mỗi người chọn có đủ hai điểm; bàn phím dùng được; lỗi giữ draft; gửi lại không đổi dữ liệu; sau gửi hết vẫn xem được. Không thêm API/dependency. |
| 2 — lịch sử và trình bày | Làm thẻ lịch sử trận, cải thiện responsive lịch sử rating và Admin; thêm retry section và nội dung all-rated rõ ràng. | Kiểm tra 360/768/1280 px, tên/comment dài; không mất nội dung hoặc tràn trang; pagination hoạt động độc lập; link chỉ dùng domain đã biết. |
| 3 — Profile | Triển khai host Profile theo tài liệu Ready của module; nối `getSummary`, own/public card và ngưỡng hiển thị. | Test 0/1/2/3+ ratings, hidden/null, inactive target, lỗi mạng; không lộ received rows hoặc rater identity. Xác minh Profile API thực tế trước khi tích hợp. |
| 4 — Tournament | Khi có participant-facing Match Detail thật, tái sử dụng rating view và ngữ cảnh của Tournament. | Chỉ participant được đánh giá trận `COMPLETED` có kết quả đã chơi `WINNER_DECLARED`, gate bật. Walkover/unresolved/disabled không mở form gửi; không truy vấn casual detail bằng Tournament ID. |

Các đợt là đề xuất phân chia triển khai, không sửa trạng thái RT/PP hiện có. Đợt 3–4 phụ thuộc module khác; không dựng toàn bộ Profile/Tournament trong một task sửa hình thức Ratings.

## 6. Kiểm chứng cần thực hiện khi sửa frontend

Mở rộng các bài có sẵn trong `frontend/e2e/ratings.spec.ts` và `ratings-real.spec.ts`, thay vì viết bộ test song song. Hiện có 11 mocked cases và 1 real-session case; lần rà soát này chỉ đọc, chưa chạy lại.

- Kiểm tra nhãn chữ, keyboard sao, focus lỗi/đóng dialog, hành vi trong lúc gửi, giao diện mobile và comment 500 ký tự.
- Giữ regression: chưa hoàn tất không có CTA; partial submit; duplicate-safe success; all-rated read-only; giữ draft khi lỗi; response cũ không ghi đè modal mới; phân trang và comment XSS-safe; Admin read-only.
- Chạy lint/build và E2E liên quan sau sửa. Real-session E2E phải dùng `badminton_test` theo runner hiện có, không dùng seed/cleanup của test trên DB development.
- Test Profile threshold/privacy và Tournament eligibility khi host tương ứng được triển khai.

## 7. Sai lệch tài liệu cần xử lý riêng

- `docs/architecture/frontend.md` §9 nói `ALLL` đã bị thay thế bởi canvas phân loại; truy cập file hiện tại chỉ thấy một page `ALLL`. Cần cập nhật inventory theo file thực tế.
- Các phần cũ của tài liệu frontend còn nói Ratings integration pending, trong khi cuối file và code đã có casual integration; khi triển khai nên thống nhất mô tả hiện trạng.
- Profile tasks còn ghi Ratings chưa có implementation; backend Ratings và summary client hiện đã có. Cần đánh giá lại dependency, không mặc nhiên coi toàn bộ Profile đã sẵn sàng.
- Tài liệu frontend cũ loại cả A19/System Configuration, trong khi Brief §4 và bộ tài liệu platform/system-config cho phép quản lý cấu hình hệ thống. Không dùng đoạn cũ này để loại bỏ các config Ratings hợp lệ; xử lý mâu thuẫn tại tài liệu sở hữu, không đưa ELO/FairPlay vào thay thế.

Rà soát này không sửa tài liệu kiến trúc chung, business rules, API hoặc Figma. Các thay đổi tài liệu chung phải theo quy trình review của repository.

## 8. Cập nhật triển khai giao diện — 19/10/2026

Theo yêu cầu triển khai của người dùng, đã cập nhật phần giao diện độc lập với Profile/Tournament:

- Modal có banner/ngữ cảnh trận từ host, tiến độ đã gửi, thẻ người chơi, hai nhãn điểm hiển thị, comment và nút gửi theo số người được chọn; bản đã gửi có điểm số và thời gian, all-rated giữ quyền xem.
- Sao có một tab stop mỗi nhóm, điều hướng mũi tên/Home/End; validation nối mô tả lỗi và focus tới điểm còn thiếu. Đóng modal trả focus về nút mở. Trong lúc gửi, X/Escape/backdrop/footer đều không đóng form.
- Lịch sử trận dùng thẻ và số người còn lại; lịch sử đánh giá có heading, pagination và comment wrap; Admin section có retry riêng và tên nguồn tự động bằng tiếng Việt.
- CSS nằm trong `frontend/src/features/ratings/ratings.css`, dùng token hiện có; không thêm route, API, dependency hoặc thay đổi business rules.
- Profile aggregate và Tournament host vẫn là phần phụ thuộc chưa triển khai trong lần sửa giao diện này.

Kiểm chứng: build/lint hoàn thành (lint còn cảnh báo `set-state-in-effect` hiện hữu; build cảnh báo bundle >500 kB). Playwright chạy trên cổng riêng 3017/5187 với runner `badminton_test` do cổng 3000 đang được dùng; 14 cases gồm 13 mocked và 1 real-session đã qua. Có kiểm tra ảnh modal 360 px và 1280 px. Test real-session nhận API origin qua `RATINGS_TEST_API_ORIGIN` (mặc định giữ 3000), dùng Playwright `baseURL` cho frontend để có thể chạy cô lập.
