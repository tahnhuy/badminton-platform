# Kế hoạch tách Cộng đồng và Tìm đối thủ

- Ngày: 22/11/2026.
- Trạng thái: đã triển khai ngày 22/11/2026 (xem §9).
- Nhãn đã chốt: **Kèo tham gia / Kèo đã tạo**.
- Mẫu tham chiếu: [matchmaking-ux.html](../mockups/matchmaking-ux.html). Mẫu mô tả bố cục và hành trình; dữ liệu, bộ đếm và form rút gọn trong mẫu không phải đặc tả nghiệp vụ.

## 1. Mục tiêu và phạm vi

Tách hai mục đích sử dụng:

- **Cộng đồng**: chỉ có bài chia sẻ (`FREE`), đăng/sửa/xóa bài, ảnh, cảm xúc, bình luận và báo cáo như hiện tại. Bỏ bộ lọc tìm kèo, nút tìm người chơi và toàn bộ section kèo bên phải.
- **Tìm đối thủ**: danh sách bài tìm kèo/tìm người (`MATCH_FINDING`), bộ lọc, đăng kèo, xem chi tiết và báo cáo. Không có cảm xúc, bình luận hoặc các số đếm tương ứng.
- **Hoạt động của tôi**: trang quản lý riêng trong khu Tìm đối thủ, chia thành **Kèo tham gia** và **Kèo đã tạo**.

“Không tương tác” ở bài tìm kèo được hiểu là không tương tác mạng xã hội. Giữ nguyên xin tham gia, duyệt/từ chối, mời người chơi, nhận/từ chối lời mời, rút, hủy, chốt kèo, nhóm chat và các hành động nghiệp vụ đang được phép. Nhóm chat chỉ xuất hiện theo quyền và điều kiện hiện tại.

Không tạo hai bảng tin riêng “Tìm kèo” và “Tìm người”. Không thêm tìm bạn tập dài hạn, thanh toán mới, thay đổi quy tắc booking, thuật toán gợi ý hoặc cơ chế duyệt người chơi.

## 2. Hiện trạng đã rà soát

| Vị trí | Hiện trạng | Điều cần sửa |
| --- | --- | --- |
| `FeedPage.tsx` | Trộn hai loại bài, bộ lọc kèo bên trái, section kèo cá nhân bên phải, hai nút tạo bài | Chỉ truy vấn `FREE`, bố cục bảng tin chia sẻ |
| `MatchmakingPage.tsx` | Mặc định là Kèo của tôi; có Lời mời và Yêu cầu đã gửi | Chuyển thành nơi khám phá; chuyển quản lý sang trang riêng |
| `SocialPostCard.tsx` | Render cảm xúc và bình luận cho cả hai loại bài | Tách thẻ kèo khỏi phần tương tác xã hội |
| `PostDetailPage.tsx` | Luôn render `PostComments`; breadcrumb về Cộng đồng; có `RecruitmentActions` khi có recruitment | Phân nhánh theo loại bài ở toàn bộ nội dung, điều hướng và hành động |
| `MatchmakingRequestDetailPage.tsx` | Trang quản lý có breadcrumb về Cộng đồng | Đưa về Hoạt động của tôi; giữ quyền quản lý khi bài bị ẩn |
| `SocialRepository.ts` | Bảng tin sắp theo `publishedAt DESC, id DESC` | Bổ sung sắp giờ chơi nếu dùng mặc định “Sắp diễn ra” |
| `SocialInteractionService.ts` | Các hàm cảm xúc/bình luận đã xem chưa chặn riêng `MATCH_FINDING` | Rà và bổ sung chặn tương tác theo loại bài ở API |
| API danh sách cá nhân | Requests có `isOwner`; applications và invitations là nguồn riêng, đều phân trang | Không lọc một trang dữ liệu hỗn hợp để giả lập danh sách theo vai trò |

Nguồn chính: `frontend/src/features/social/`, `frontend/src/features/matchmaking/`, `frontend/src/app/router.tsx`, `backend/src/services/social/`, `backend/src/repositories/social/`.

## 3. Giao diện đích

### 3.1. Cộng đồng `/feed`

- Tiêu đề và mô tả chỉ nói về chia sẻ; ô tạo bài mở thẳng loại `FREE`.
- Một cột bài viết có chiều rộng đọc phù hợp; bỏ bố cục ba cột cũ. Link hồ sơ vẫn có ở shell; không cần giữ sidebar chỉ để lấp khoảng trống.
- Không bộ lọc loại bài, ngày chơi, địa điểm, trình độ hoặc còn chỗ; không nút đăng kèo và không gọi API kèo cá nhân từ trang này.
- Giữ thứ tự mới nhất, tải thêm, làm mới, xem ảnh, hồ sơ tác giả, chỉnh sửa/xóa, cảm xúc, bình luận, báo cáo và trạng thái loading/error/empty.
- URL `/feed` có query lọc cũ không được làm xuất hiện lại `MATCH_FINDING`; làm sạch query không còn hỗ trợ bằng replace history.

### 3.2. Tìm đối thủ `/matchmaking`

- Mở thẳng danh sách kèo công khai. Header có **Hoạt động của tôi** và **Đăng kèo**; không có hàng tab quản lý cũ.
- Desktop: bộ lọc gọn phía trên, danh sách chính; có thể có khối buổi chơi sắp tới bên phải nếu lấy được dữ liệu chính xác. Khối này là phần bổ trợ, không chặn trang chính khi tải lỗi.
- Mobile: nút bộ lọc mở sheet, tóm tắt bộ lọc đang áp dụng; đường vào Hoạt động của tôi luôn thấy được. Không phụ thuộc sidebar desktop.
- Bộ lọc chính: tỉnh/thành, quận/huyện, ngày chơi, trình độ. Mở rộng: giờ chơi, loại kèo, còn chỗ, bao gồm kèo đã kết thúc theo contract hiện có.
- Mặc định kèo đang tuyển và còn chỗ, không bao gồm kèo đã kết thúc. Hiển thị rõ bộ lọc “Còn chỗ” đang bật, tránh điều kiện lọc bị giấu.
- Lưu bộ lọc, thứ tự và trang trong URL; back từ chi tiết khôi phục bộ lọc và vị trí danh sách. Xóa lọc đưa về mặc định đã công bố.
- Thứ tự chính: **Sắp diễn ra** với tie-breaker ổn định; cho phép **Mới đăng**. “Còn nhiều chỗ” trong mockup chưa đưa vào đợt đầu để tránh mở rộng API không cần thiết.
- Chỉ hiện tổng số kèo khi API cung cấp tổng đúng theo bộ lọc; không dùng số item trang hiện tại làm tổng.
- Thẻ kèo: ngày/giờ, tiêu đề, sân/khu vực, trình độ, chi phí nếu có, số chỗ và trạng thái, chủ kèo; mô tả rút gọn. Không tự suy diễn chi phí hay thông tin sân.
- Nút chính **Xem kèo**; menu `⋯` có báo cáo cho người được phép, sửa/xóa cho chủ bài. Chủ kèo có đường vào quản lý.
- Tái sử dụng quy tắc tạo kèo hiện tại: loại đơn/đôi/nhóm, người đi cùng, sức chứa, ngày giờ, trình độ, sân, ảnh, công khai/chưa công khai và idempotency. Không dùng form rút gọn của mockup để thay thế nghiệp vụ.

### 3.3. Hoạt động của tôi

Route đề xuất: `/matchmaking/activity?section=joined|created`; mặc định `joined`.

| Nhãn | Nội dung | Hành động |
| --- | --- | --- |
| **Kèo tham gia** | Lời mời nhận được, yêu cầu đang chờ, kèo đã xác nhận, lịch sử | Nhận/từ chối lời mời; hủy yêu cầu; xem kèo; rút theo điều kiện hiện tại |
| **Kèo đã tạo** | Kèo do mình tạo, yêu cầu cần duyệt và lời mời đã gửi theo kèo | Quản lý kèo; duyệt/từ chối; tìm ứng viên và mời; hủy lời mời; chỉnh sửa/chốt/hủy theo quyền |

- Ưu tiên việc cần xử lý; sau đó kèo sắp chơi; lịch sử vẫn truy cập được, không bỏ trạng thái từ chối/hết hạn/hủy/rút.
- Kèo đã tạo chứa cả bài chưa công khai; kèo của chủ không lặp sang Kèo tham gia.
- Một kèo có thể xuất hiện trong phần yêu cầu/lời mời trước khi xác nhận; phần “Sắp diễn ra” chỉ dành cho tư cách đã xác nhận và trạng thái thực sự sắp chơi.
- Chấp nhận lời mời hoặc duyệt đơn phải cập nhật các danh sách liên quan; một người không bị đếm trùng do vừa có application vừa có invitation.
- Bộ đếm cạnh nhãn chỉ là số việc đang cần người dùng xử lý, có tên truy cập rõ nghĩa. Không dùng tổng dòng/trang hay số cứng; thiếu nguồn tổng đúng thì tạm bỏ bộ đếm.
- Không tải chi tiết từng kèo để tính tổng chờ duyệt; dùng API tổng hợp nếu cần.
- “Các trận của tôi” vẫn truy cập được từ trang Hoạt động, giữ nguyên route và các luồng đặt sân/booking.

### 3.4. Chi tiết bài và quản lý kèo

Giữ `/posts/:postId` là link canonical để không làm hỏng link bài cũ. Render riêng theo `post.type`:

- `FREE`: breadcrumb Cộng đồng, thẻ chia sẻ, cảm xúc và bình luận như hiện tại.
- `MATCH_FINDING`: breadcrumb Tìm đối thủ, nội dung buổi chơi, thành viên theo quyền và vùng hành động nghiệp vụ; không mount component bình luận/cảm xúc, không fetch các API tương tác từ UI.
- Người lạ: xin tham gia nếu được phép; người đang chờ: trạng thái và hủy yêu cầu; người được mời: phản hồi; thành viên: xem/rút theo điều kiện; chủ: quản lý. Dùng trạng thái/permission thực, không chỉ kiểm tra số chỗ phía client.
- Khi đầy chỗ, hết hạn, đã bắt đầu, hủy hoặc không có quyền: giải thích rõ lý do và chỉ hiện hành động hợp lệ. Xung đột dữ liệu sau thao tác phải reload trạng thái.
- Desktop đặt vùng hành động cạnh thông tin; mobile đặt gần phần thông tin quyết định, không để nội dung dài đẩy hành động quá xa. Nếu dùng thanh cố định phải chừa khoảng trống và tránh đè chat/safe area.
- Sửa breadcrumb, nút quay về và đích sau xóa theo loại bài. Không ép bài tìm kèo quay về Cộng đồng.
- Giữ route `/matchmaking/requests/:requestId` để quản lý theo quyền độc lập với khả năng xem bài. Bài bị Admin ẩn không làm mất các quyền quản lý hiện có.

## 4. API và dữ liệu

### 4.1. Tách nguồn danh sách

- Cộng đồng gọi `/api/v1/posts?type=FREE` cố định; Tìm đối thủ gọi cùng nguồn với `type=MATCH_FINDING` và bộ lọc được hỗ trợ.
- Không lọc bỏ sai loại sau khi phân trang: phải lọc ở server để tổng số và tải thêm đúng.
- Giữ mô hình post + recruitment/request hiện có. Việc chuyển vị trí hiển thị không yêu cầu chuyển/xóa các bài đã tồn tại.
- Rà quyền và cấu hình bật/tắt Social đang áp dụng cho việc tạo/xem bài kèo; giữ hành vi hiện tại trong đợt này, không ngầm đổi quyền bằng việc di chuyển component.

### 4.2. Các phần backend cần hoàn thiện trước UI tương ứng

1. **Sắp xếp khám phá:** thêm query sort được validate cho `MATCH_FINDING`, sắp theo giờ bắt đầu ở server trước pagination, tie-breaker bằng ID; giữ `asOf`, quyền hiển thị và bộ lọc ended/open-slots hiện có. Giữ thứ tự cũ khi không truyền sort để tương thích client cũ. Kiểm tra index/query plan, chỉ thêm index nếu cần.
2. **Danh sách theo vai trò:** rà truy vấn requests để bổ sung filter chủ/thành viên ở server nếu chưa có; tổng theo đúng vai trò trước phân trang. Giữ nguồn applications/invitations cho mục đang chờ và lịch sử.
3. **Tổng cần xử lý:** nếu hiện bộ đếm/khối tổng hợp, bổ sung projection hoặc endpoint tổng hợp trả số lời mời nhận đang chờ và số đơn chờ duyệt trên kèo của chủ. Không tải mọi trang hoặc gọi N+1 chi tiết để cộng ở frontend. Tên endpoint/DTO chốt khi triển khai sau khi rà service hiện có; đây là đầu việc bắt buộc nếu UI dùng bộ đếm.
4. **Chặn tương tác xã hội với kèo:** thêm kiểm tra `post.type` tại service cho ghi cảm xúc/tạo bình luận và đọc danh sách bình luận. Trả lỗi nghiệp vụ ổn định, ví dụ `SOCIAL_INTERACTION_NOT_ALLOWED`, sau khi kiểm tra visibility để không lộ bài không có quyền xem. UI ánh xạ thông báo tiếng Việt.
5. **Dữ liệu tương tác cũ:** giữ trong DB, không migrate/xóa; không hiển thị trên bài kèo. Giữ quyền xóa dữ liệu cũ và thao tác kiểm duyệt hợp lệ; không mở lại khả năng tạo tương tác. Rà notification để không phát sinh thông báo cảm xúc/bình luận mới trên kèo bị chặn.

Quy tắc khóa transaction, visibility, lịch trùng, sức chứa, giữ chỗ, thời hạn, replay và authorization vẫn theo service hiện có. Không chặn cả `requireVisiblePost` dùng chung nếu điều đó vô tình làm mất quyền xóa/kiểm duyệt dữ liệu cũ.

## 5. Thiết kế component và file tác động

| Nhóm | File hiện có / phần dự kiến |
| --- | --- |
| Bảng tin | `social/pages/FeedPage.tsx`, `social/hooks/useFeed.ts`, `social/components/SocialPostCard.tsx` |
| Chi tiết | `social/pages/PostDetailPage.tsx`, `social/components/PostComments.tsx` chỉ mount cho `FREE` |
| Khám phá | `matchmaking/pages/MatchmakingPage.tsx`; tách `MatchDiscoveryFilters`, `MatchDiscoveryCard`, hook truy vấn nếu cần |
| Hoạt động | Thêm `matchmaking/pages/MatchmakingActivityPage.tsx`; tái sử dụng `RequestListCard`, `InvitationList`, `ApplicationPanel` với dữ liệu/props phù hợp |
| Nghiệp vụ | `RecruitmentActions`, `RecruitmentEdit`, `PostComposer`, `MatchmakingRequestDetailPage` |
| Điều hướng | `app/router.tsx`, player nav/breadcrumb, link từ notification/profile/chat và các đường quay lại |
| Contract | `social/api.ts`, types bộ lọc, matchmaking services/types, backend validation/controller/service/repository tương ứng |
| Kiểm thử | `frontend/e2e/social.spec.ts`, `matchmaking-list-ui.spec.ts`, `matchmaking-detail-ui.spec.ts`; thêm spec riêng cho khám phá/hoạt động khi cần |

Tách phần trình bày bài chia sẻ và bài kèo rõ ràng; có thể dùng chung AuthorRow, ảnh, report dialog, menu tác giả. Không giữ một thẻ có nhiều nhánh để rồi vô tình render lại social actions cho kèo. Giữ token, primitive, responsive pattern và quy ước frontend đang dùng; không đưa CSS nguyên mẫu vào ứng dụng, không thêm thư viện cho đợt này.

## 6. Điều hướng tương thích

| Link cũ | Xử lý |
| --- | --- |
| `/matchmaking` | Trang khám phá mới |
| `/matchmaking?tab=requests` | Replace sang Hoạt động; bỏ tham số cũ, mặc định Kèo đã tạo; Kèo tham gia vẫn truy cập được bên cạnh |
| `/matchmaking?tab=applications` | Replace sang Kèo tham gia, đưa tới phần yêu cầu đã gửi |
| `/matchmaking?tab=invitations` và `/matchmaking/invitations` | Replace sang Kèo tham gia, đưa tới lời mời nhận được; nếu link có hướng đã gửi thì sang Kèo đã tạo |
| `/posts/:postId` | Giữ link; phân nhánh UI theo loại bài |
| `/matchmaking/requests/:requestId` | Giữ quản lý theo quyền; breadcrumb về Hoạt động |
| `/matchmaking/matches/*` | Giữ nguyên luồng trận và booking |

Dùng query/anchor hợp lệ cho phần đích, hỗ trợ mở trực tiếp và reload. Kiểm tra active navigation ở các trang con; không còn breadcrumb Cộng đồng trong luồng kèo.

## 7. Trình tự triển khai

### Bước 1 — Chuẩn hóa contract và tài liệu

- [x] Rà đầy đủ quyền API, phân trang, tổng số, sort, applications/invitations và deep link thực tế.
- [x] Ghi DTO/query/error code và mapping trạng thái; cập nhật tài liệu Social/Matchmaking liên quan theo thay đổi đã xác nhận.
- [x] Đồng bộ mockup sang “Kèo tham gia / Kèo đã tạo”; ghi rõ phần mẫu rút gọn, không dùng bộ đếm cứng trong ứng dụng.

### Bước 2 — Backend hỗ trợ đúng hành vi

- [x] Triển khai sort khám phá, filter vai trò và nguồn tổng hợp cần thiết; giữ tương thích khi không truyền query mới.
- [x] Chặn tương tác xã hội mới trên bài tìm kèo, giữ dữ liệu cũ và quyền kiểm duyệt.
- [x] Hoàn thành kiểm thử contract, quyền, phân trang, dữ liệu cũ và lỗi nghiệp vụ trước khi nối UI.

### Bước 3 — Tách Cộng đồng và nội dung chi tiết

- [x] Cố định feed `FREE`, dọn bộ lọc/sidebar/nút và copy tìm kèo.
- [x] Tách thẻ chia sẻ/thẻ kèo và phân nhánh chi tiết, báo cáo, điều hướng sau xóa.
- [x] Xác nhận mọi đường vào bài kèo đều không có react/comment, kể cả link trực tiếp và bài cũ.

### Bước 4 — Xây trang khám phá

- [x] Đưa `MATCH_FINDING` về `/matchmaking`, nối bộ lọc/sort/phân trang vào URL.
- [x] Nối đăng kèo đầy đủ nghiệp vụ, tạo nháp/công khai và điều hướng sau lưu.
- [x] Hoàn thiện desktop/mobile, states loading/error/empty, quay lại giữ ngữ cảnh.

### Bước 5 — Xây Hoạt động và nối luồng cũ

- [x] Nhóm dữ liệu thành Kèo tham gia / Kèo đã tạo; giữ lịch sử, lời mời gửi/nhận và Các trận của tôi.
- [x] Nối phản hồi, duyệt, mời, rút, chốt/hủy, quản lý thành viên theo quyền hiện tại.
- [x] Refresh/invalidate các nguồn liên quan sau thao tác; xử lý xung đột, retry và tránh submit trùng.
- [x] Nối redirect cũ, notification, breadcrumb và đường quay về; kiểm tra dữ liệu nhiều trang.

### Bước 6 — Kiểm thử và nghiệm thu

- [x] Chạy checks dưới đây; cập nhật test vốn mặc định `/matchmaking` là danh sách cá nhân.
- [x] Rà thực tế ở 390 / 768 / 1280 px, bàn phím, focus dialog và trình đọc màn hình ở các vùng trạng thái.
- [x] Ghi kết quả, giới hạn còn lại và cập nhật trạng thái kế hoạch sau khi hoàn tất.

## 8. Ma trận kiểm thử và tiêu chí nghiệm thu

| Phạm vi | Kịch bản bắt buộc |
| --- | --- |
| Cộng đồng | Response chỉ `FREE`; query cũ không đổi loại; đăng/sửa/xóa/ảnh/react/comment/report còn hoạt động; không gọi API kèo cá nhân |
| Khám phá | Chỉ `MATCH_FINDING` công khai đúng quyền; lọc/sort đúng trên nhiều trang; không trùng/mất bài do đổi lọc; back/reload giữ ngữ cảnh |
| Bài kèo | Không thanh cảm xúc, số bình luận hoặc comment composer trên thẻ/chi tiết/link trực tiếp; API không nhận tương tác mới; report vẫn hoạt động |
| Tạo/sửa | Đơn/đôi/nhóm, ảnh, nháp/công khai, thông tin sân, trường đã khóa, submit trùng và lỗi upload giữ quy tắc cũ |
| Kèo tham gia | Nhận/từ chối lời mời, xin/hủy yêu cầu, đã nhận, đã rút, hết hạn, trùng lịch, kèo đầy; không xem “đang chờ” là đã giữ chỗ |
| Kèo đã tạo | Chủ thấy đúng kèo của mình qua mọi trang; bài chưa công khai; duyệt/từ chối, tìm ứng viên, gửi/hủy lời mời, chốt/hủy, loại thành viên theo điều kiện |
| Đồng bộ | Hai người tranh chỗ cuối, dữ liệu thay đổi trong lúc duyệt, mutation thất bại; không đếm trùng, cập nhật tổng và trạng thái sau thành công |
| Quyền | Guest/Player/role khác theo routing hiện tại, bài ẩn/xóa, kèo hết hạn/đã bắt đầu, chủ/thành viên/người ngoài; quản lý còn dùng được khi bài bị ẩn |
| Dữ liệu cũ | Bài kèo đã có react/comment vẫn xem thông tin kèo, không hiển thị tương tác; không xóa dữ liệu; moderation hợp lệ còn dùng được |
| Điều hướng | Link cũ, notification, reload, tab vai trò, quay lại danh sách, Các trận của tôi và đường đặt sân có ngữ cảnh |
| UI | Loading/error/empty từng nguồn; sidebar lỗi không chặn khám phá; không tràn ngang; nhãn không cắt; bàn phím/focus/aria; nút chat không che hành động |

Kiểm tra kỹ thuật khi triển khai:

- Frontend: `npm run build`, `npm run check:ui` trong `frontend/`.
- Playwright: chạy các spec Social, matchmaking list/detail và spec khám phá/hoạt động mới; regression booking-link và split-booking khi thay đổi đường dẫn hoặc component liên quan.
- Backend: chạy test feed/posts/interactions, applications/invitations/lifecycle và report liên quan bằng script hiện có; thêm test có ý nghĩa cho sort xuyên trang, filter vai trò, permission và chặn tương tác với kèo.
- Không coi dữ liệu giả trong HTML là bằng chứng nghiệp vụ chạy đúng. Tách kết quả E2E mock API và kiểm chứng tích hợp backend.

Hoàn thành khi hai trang tách đúng loại nội dung, các luồng quản lý hiện tại truy cập đủ qua hai nhãn đã chốt, không còn tương tác xã hội trên bài tìm kèo, API/tổng số/phân trang đúng và các kiểm tra liên quan đạt.

## 9. Kết quả triển khai — 22/11/2026

- **Backend**
  - `GET /api/v1/posts` nhận `sort=upcoming` (validate): sort theo `start_at` của recruitment ở server trước phân trang, tie-break `posts.id`; không truyền `sort` giữ thứ tự `published_at DESC, id DESC` cho client cũ.
  - `GET /api/v1/matchmaking-requests` nhận `role=host|member`; lọc vai trò trước khi đếm/phân trang, không truyền thì giữ phạm vi chủ-hoặc-thành-viên cũ.
  - Ghi cảm xúc, tạo bình luận và đọc bình luận trên `MATCH_FINDING` trả `409 SOCIAL_INTERACTION_NOT_ALLOWED` sau khi kiểm tra visibility (bài không có quyền vẫn 404). Xóa bình luận cũ, xóa cảm xúc cũ và Admin hide vẫn hoạt động; dữ liệu cũ giữ nguyên trong DB.
- **Frontend**
  - `/feed` chỉ gọi `type=FREE`, dọn query cũ bằng replace, bỏ bộ lọc/sidebar/nút tìm kèo.
  - `/matchmaking` là trang khám phá `MATCH_FINDING` với bộ lọc, `hasOpenSlots=true` mặc định, sort `upcoming|newest`, phân trang trong URL; thẻ kèo riêng, không render cảm xúc/bình luận.
  - `/matchmaking/activity?section=joined|created` tách **Kèo tham gia** / **Kèo đã tạo**, giữ lời mời, yêu cầu đã gửi, lịch sử, rút/hủy và liên kết **Các trận của tôi**.
  - `/posts/:postId` phân nhánh UI theo `post.type`; bài kèo dùng breadcrumb Tìm đối thủ, không mount bình luận/cảm xúc; xóa bài kèo quay về Hoạt động của tôi.
  - Redirect: `?tab=requests|applications|invitations` và `/matchmaking/invitations` về Hoạt động của tôi; giữ `/matchmaking/requests/:id` và `/matchmaking/matches/*`.
- **Kiểm chứng**
  - `frontend`: `npm run build`, `npm run check:ui` đạt.
  - `backend`: `tsc --noEmit` đạt; `vitest run social-feed social-interactions matchmaking social-posts` đạt 67 test.
  - Playwright (mock API): `feed-ui`, `matchmaking-list-ui`, `post-detail-ui`, `social`, `matchmaking-detail-ui`, `matchmaking-booking-link`, `match-detail-ui` đạt. `matchmaking-split-booking` fail khi chạy trên dev server đang có dữ liệu sân thật (56 sân) vì spec cần fixture e2e riêng; không liên quan thay đổi đợt này.
