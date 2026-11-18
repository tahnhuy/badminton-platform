# Báo cáo review mã nguồn và kế hoạch chuyển đổi frontend

- Ngày review: **17/11/2026**, múi giờ Việt Nam.
- Nhánh kiểm tra: `feat/frontend-ui-foundation`.
- Commit nền: `397f985` — `feat(matchmaking): chốt kèo thủ công và bảo vệ quyền thành viên`.
- Repository thực tế: `/home/taidangdev/code/uni/tlcn-badminton` (đường dẫn workspace cũ trong hội thoại không còn tồn tại).
- Trạng thái thực hiện: **D00 DONE; D01 DONE — người dùng nghiệm thu ngày 18/11/2026 sau đợt sửa cuối (§18); D02 UX_REVIEW (D02-00); D03–D23 NOT_STARTED.** Phần backlog D02–D23 vẫn là đề xuất, chưa triển khai.
- Cập nhật phạm vi ngày 17/11/2026: người dùng yêu cầu giai đoạn riêng **D00 — cập nhật tài liệu, kiểm tra/cài bổ sung nền và kiểm chứng**, hoàn tất rồi mới làm **D01 — trang `/sign-in`**. Không coi đó là duyệt chuyển đổi toàn bộ frontend hay tự đổi trạng thái các tài liệu gốc.
- Quyết định đầu vào: người dùng xác nhận nhóm đã thống nhất thêm các thư viện frontend. Quyết định dùng thư viện và việc duyệt kế hoạch chuyển đổi chi tiết là hai việc khác nhau.
- Phạm vi review ban đầu: đọc mã nguồn/tài liệu và viết kế hoạch. Cập nhật thực hiện D00: đồng bộ tài liệu, căn dependency và kiểm chứng nền (xem §13); không thay đổi source các trang, không hoàn tác working tree, không commit/push.

## 1. Kết luận và hướng triển khai đề xuất

Frontend đã có nhiều luồng nghiệp vụ hoạt động ở mức implementation: booking, tìm kèo, social, messaging, hồ sơ, chủ sân và quản lý người dùng/sân. Đây là dự án cần chuyển đổi giao diện từng phần, không phải bộ trang tạm có thể thay toàn bộ mà bỏ qua hành vi cũ.

Bộ thư viện nhóm lựa chọn phù hợp với React/Vite và cách tổ chức feature hiện tại. Không cần đổi PERN, backend, session cookie hoặc giao thức Messaging. Việc quan trọng nhất là hoàn thiện nền dùng chung và chuyển đổi theo từng luồng có thể kiểm chứng.

**Thứ tự hiện tại: D00 cập nhật tài liệu và chuẩn bị nền → nghiệm thu D00 → D01 chuyển riêng trang đăng nhập.** Tài liệu giữ phần review toàn hệ thống để tham khảo, còn việc triển khai chia thành các đợt theo trang/luồng nhỏ. Mỗi đợt có đầu ra và nghiệm thu riêng; không gom các nhóm nghiệp vụ vào một lần sửa.

Lộ trình G0–G8 trước đây được thay bằng §6 dưới đây. Không bắt buộc hoàn thiện toàn bộ UI kit, cache/session, shell hay chuyển mọi hook sang TanStack Query trước khi làm một trang. Các phụ thuộc chung chỉ được đưa vào đợt khi thực sự cần cho trang đã chọn.

Khảo sát trình độ là nhánh phụ thuộc backend riêng; không chặn các màn đã có API. Ví, giải đấu, dashboard/report chưa có luồng hoàn chỉnh chỉ được chuẩn hóa placeholder trong kế hoạch này; không tự dựng số liệu hoặc nghiệp vụ để làm đầy giao diện.

## 2. Phương pháp và giới hạn review

### 2.1 Đã kiểm tra trực tiếp

- Git branch, commit, working tree và diff hiện tại.
- `.agents/AGENTS.md`, các phần liên quan trong `PROJECT-BRIEF.md`, documentation guide, conventions, tech-stack và frontend architecture.
- Entry/providers/router, cấu hình Vite/TypeScript/shadcn, package manifests.
- Auth/session và HTTP client; các hook lấy dữ liệu/polling của shared, Booking, Social và Matchmaking.
- Dialog/DataTable, Player shell/ProfileProvider, các màn Admin và service Admin.
- WebSocket hook, trạng thái trong ConversationRoomPane, các API đồng bộ Messaging.
- Cấu hình và danh sách Playwright tests; task AF-01/02/03; nội dung AUTH-31 trên nhánh local `feat/skill-survey` qua `git show`, không checkout/merge nhánh.

### 2.2 Chưa xác minh trong lượt này

**Tại thời điểm review tĩnh ban đầu:** chưa chạy build/lint/trình duyệt. **Kết quả kiểm chứng D00 thực tế được cập nhật ở §13 và thay thế trạng thái chưa chạy đối với các phép kiểm tra đã nêu.** Backend/live E2E và Figma vẫn chưa được kiểm tra trong D00. Vì vậy, các nhận xét về cấu trúc và nội dung code là quan sát tĩnh; lỗi giao diện cụ thể, hiệu năng và tương thích runtime cần được xác minh ở giai đoạn baseline. Báo cáo không tuyên bố các kiểm thử đã pass.

Các số đếm ở dưới lấy từ file trên đĩa, không dùng lại nguyên số cũ trong hội thoại. Review này tập trung frontend và các điểm nối backend, không phải kiểm toán toàn bộ backend.

## 3. Hiện trạng đo được

| Chỉ số | Kết quả | Cách hiểu |
| --- | ---: | --- |
| File `.ts` trong `frontend/src` | 62 | Bao gồm hooks, API, types và utilities |
| File `.tsx` | 119 | Bao gồm pages, components và providers |
| Stylesheet `.css` | 8 | Global và các tính năng |
| Thuộc tính `style={...}` trong TSX | 1.165 | Đếm cú pháp; style động không mặc định là lỗi |
| Mã màu hex trong TS/TSX | 400 | Đếm số lần xuất hiện, không phải 400 màu khác nhau |
| Khai báo `path` trong router | 39 | Có route cha và catch-all; không phải 39 màn độc lập |
| Khai báo index route | 3 | Player home, Owner home, Admin redirect |
| Chỗ dùng placeholder trong router | 5 | Home Player, Tournament, Admin dashboard/tournaments/reports |
| File Playwright `.spec.ts` | 14 | Có cả harness/mock và luồng API thật; không đồng nghĩa phủ hết nghiệp vụ |

Các điểm tập trung mã nguồn:

| File dưới `frontend/src/` | Số dòng | Hướng xử lý |
| --- | ---: | --- |
| `features/messaging/components/ConversationRoomPane.tsx` | 2.061 | Tách phần đồng bộ, composer, danh sách tin, menu, quản lý nhóm |
| `features/messaging/messaging.css` | 1.332 | Xóa theo consumer sau khi chuyển component |
| `index.css` | 1.312 | Tách rõ theme/base/legacy; giảm legacy theo giai đoạn |
| `features/player/pages/PlayerHomePage.tsx` | 996 | Chưa nối index route; không đưa vào sử dụng chỉ vì đã có JSX |
| `features/messaging/components/GlobalChatDock.tsx` | 653 | Giữ hành vi dock, phân tách điều khiển và trình bày |
| `features/admin/components/UserTable.tsx` | 577 | Chuẩn hóa cách compose table, giữ selection/action |
| `features/messaging/pages/MessagingWorkspacePage.tsx` | 530 | Tách workspace data và layout sau khi chốt ownership |
| `features/player/components/PlayerHeader.tsx` | 519 | Tách navigation, account menu và notification entry |

Working tree trước khi viết báo cáo có **17 file tracked thay đổi và 4 file mới**, gồm 3 tài liệu kiến trúc cùng phần nền frontend. Không có commit riêng của foundation tại thời điểm đọc. Số dòng diff CSS lớn phần nhiều đến từ bọc layer và thụt đầu dòng, không đại diện toàn bộ là logic mới.

## 4. Các phát hiện và mức ưu tiên

Các phát hiện dưới đây là snapshot **trước khi thực hiện D00**; đối chiếu §13 để biết mục đã xử lý và mục để lại backlog, không coi tất cả vẫn là blocker hiện tại.

### F01 — P1: Tài liệu chưa ghi nhận thống nhất quyết định thư viện

**Bằng chứng:** đầu `tech-stack.md`/`frontend.md` vẫn ghi Draft/chờ nhóm duyệt; frontend §2 cấm các thư viện mới, §8 cấm thêm polling library, §12 yêu cầu dùng primitive cũ và khớp màn Figma. `conventions.md` và AGENTS vẫn chỉ quy định `components/common/`; tài liệu đặt `cn()` ở `lib/utils.ts` còn code dùng `shared/utils/cn.ts`.

**Tác động:** các lần triển khai sau có thể tuân theo những chỉ dẫn trái nhau, tạo thư mục trùng và component song song.

**Đề xuất:** thay trực tiếp các quy tắc bị thay thế, ghi ngày/nguồn quyết định, cập nhật Confirmed Decisions và hướng dẫn agent. Không thêm tiếp nhiều đoạn lịch sử ở đầu file để rồi giữ nguyên các lệnh cấm bên dưới. `RECOMMENDED` là mức khuyến nghị theo documentation guide, không tương đương trạng thái chờ duyệt. Báo cáo này chưa tự sửa trạng thái tài liệu gốc.

### F02 — P1: CSS đã có layer nhưng nền UI chưa hoàn tất

**Bằng chứng:** `index.css` có thứ tự `theme, base, legacy, components, utilities`, token `@theme static`/`@theme inline`, import Tailwind/animation; 7 stylesheet còn lại bọc `legacy`. `outline: none` vẫn có ở reset input/select/textarea. Có `components.json` nhưng chưa có `components/ui/`.

**Tác động:** chưa thể coi cài shadcn xong; layer không khôi phục focus cho control cũ và không xử lý toàn bộ tác động của Preflight. Style inline vẫn cần được xem xét riêng.

**Đề xuất:** kiểm tra màn cũ trước/sau Preflight; bổ sung focus nhìn thấy được theo component; tạo một nhóm primitive nhỏ có consumer thực tế; kiểm tra các token sinh ra trong CSS build. Không xóa toàn bộ legacy hoặc chạy CLI cho phép ghi đè global CSS mà chưa review diff. Preflight thay đổi heading/list/image mặc định theo [tài liệu Tailwind](https://tailwindcss.com/docs/preflight).

### F03 — P1 trước khi dùng Query cho dữ liệu riêng: thiếu vòng đời cache theo phiên

**Bằng chứng:** `app/query-client.ts` export singleton; `AuthProvider` chưa hủy query/xóa cache khi signOut/hết phiên/đổi tài khoản. Hiện Query chỉ được gắn provider, chưa thấy feature gọi `useQuery`/`useMutation`.

**Tác động:** rủi ro phát sinh khi chuyển feature sang Query: cache hoặc request cũ có thể sống qua lần đổi tài khoản. Đây là khoảng trống cần ngăn trước, không phải kết luận hiện đã lộ dữ liệu.

**Đề xuất:** account-scoped query keys; dừng observer/request cũ, xóa cache riêng và reset state khi đổi phiên; request dùng AbortSignal; không persist dữ liệu riêng vào browser storage. Hủy query không thay thế việc backend kiểm tra quyền. API nhận signal qua boundary có sẵn; tham khảo [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) và [QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient).

### F04 — P2: Retry policy chưa khớp comment; freshness chưa theo từng dữ liệu

**Bằng chứng:** `shouldRetryRequest` không retry `ApiError` 4xx, giới hạn 2 lần và tắt mutation retry, nhưng trả true cho mọi lỗi không phải ApiError. Global `staleTime` là 30 giây, focus refetch bị tắt.

**Đề xuất:** phân biệt lỗi mạng có thể retry với AbortError/lỗi lập trình; không dùng retry mặc định cho mutation booking/payment/gửi tin. Cấu hình freshness/polling theo từng feature. Giữ CSRF retry một lần ở HTTP client, không nhân thêm vòng retry cho 401/403.

### F05 — P2: Nhiều cơ chế lấy dữ liệu có hành vi khác nhau

**Bằng chứng:** `useApiResource` polling 7,5 giây và có AbortController; Booking availability dùng 8 giây và giữ dữ liệu khi refresh lỗi; Matchmaking dùng vòng 5 giây, pause hidden tab; Social dùng refresh theo visibility và phân trang `asOf`, generation/abort/de-duplication.

**Tác động:** thay tất cả bằng một hook chung dễ làm mất stale state, reset filter, nhân polling hoặc làm sai phân trang.

**Đề xuất:** chuyển từng feature sang query hook riêng. Không giữ timer cũ sau khi bật `refetchInterval`. Không ép mọi hook thành một abstraction nhận URL rồi nuốt hết lỗi thành chuỗi. Social giữ ngữ nghĩa snapshot `asOf`; không thêm polling feed.

### F06 — P2: Transport và error handling Admin còn khác phần còn lại

**Bằng chứng:** `adminUserService`, `adminFacilityService`, `adminGlobalSearchService` dùng fetch/helper riêng; `handleResponse` của user service chủ yếu ném `Error(message)`. Có task AF-01/02/03 đang BLOCKED; AF-01 là thay đổi backend pagination.

**Đề xuất:** dùng lại kế hoạch AF hiện có; lập bảng contract thực tế trước khi đổi transport. Không đổi `pagination` thành `meta` chỉ ở client hoặc mở rộng backend trong PR UI. Fetch cùng origin vốn gửi cookie theo mặc định; việc thiếu khai báo credentials không tự chứng minh mất cookie.

### F07 — P2: Shell, table, modal và icon chưa có lộ trình thay thế

**Bằng chứng:** Admin pages tự compose Header/Sidebar; `Dialog` hiện có quản lý portal, focus, busy và trả focus; DataTable có selection/indeterminate/skeleton; nhiều icon inline và Toast riêng.

**Đề xuất:** giữ API của các component chung ở bước đầu, thay phần trình bày bên trong bằng primitive mới. Dialog mới quản lý focus qua Radix thì không gắn thêm một focus trap cũ. Icons phổ thông chuyển dần sang lucide, SVG cầu lông đặc thù giữ lại. Chỉ xóa component cũ khi không còn consumer. Không thêm thư viện table khác chỉ vì ví dụ shadcn dùng nó.

### F08 — P2, rủi ro chuyển đổi cao: Messaging tập trung quá nhiều trách nhiệm

**Bằng chứng:** ConversationRoomPane chứa data loading/cursors, pending message/retry, composer, presence/typing, message actions, group settings và modal. Socket hook đã có reconnect/backoff, dừng reconnect khi close 1008 và heartbeat theo visibility. Dock và full workspace chia sẻ room pane.

**Đề xuất:** tách hook và component từng bước trước/sau đổi skin trong các PR riêng; giữ một nguồn dữ liệu cho mỗi loại trạng thái. Không copy toàn bộ messages sang cả Query và local state để cả hai cùng cập nhật. Bảo toàn seq/version catch-up, đọc tới tin đã render, retry identity và thu hồi quyền sau rời kèo.

### F09 — P2: Phụ thuộc khảo sát và phạm vi nghiệp vụ dễ bị nhập nhằng

**Bằng chứng:** RegisterPage hiện gửi `skillLevelCode`; AUTH-31 mới ở nhánh `feat/skill-survey`, phụ thuộc AUTH-30. Nhánh này còn các mô tả nghiệp vụ cũ/được supersede trong brief và feature docs.

**Đề xuất:** làm Sign-in/Change-password trước để chứng minh nền hoạt động; khảo sát là giai đoạn phụ thuộc contract thật. Không tự tạo bảng câu hỏi, công thức hay API giả trong production. Đối chiếu brief khi tích hợp nhánh; không tự quyết định tách/gộp feed, bỏ Rating, thêm ví hoặc nâng trình bằng giải đấu trong PR đổi UI.

### F10 — P2: Chưa có baseline build, bundle, responsive và regression trong lượt review này

Có 14 file E2E, gồm các bài dùng mock và API thật. Chưa xác minh môi trường Chrome, database test và toolchain runtime sau khi di chuyển repository. Router đang import pages trực tiếp; chưa thấy lazy route tại router. Các dependency mới dùng range `^`, dù lockfile cố định cây cài đặt hiện thời.

**Đề xuất:** đo baseline trước chuyển đổi; ghi lỗi có trước, không quy mọi lỗi cho foundation. Lazy-load chart/hiệu ứng và các route lớn khi có consumer; so sánh cùng môi trường. Nếu nhóm chọn exact version thì pin dependencies mới và cập nhật lockfile trong task nền, không đổi mọi dependency không liên quan.

## 5. Kiến trúc frontend đề xuất

### 5.1 Cấu trúc đích

```text
frontend/src/
  app/
    router.tsx                 # route composition và guards
    providers.tsx              # providers toàn ứng dụng
    query-client.ts            # defaults; không chứa nghiệp vụ tính năng
  components/
    ui/                        # primitive shadcn/Radix do project sở hữu
    common/                    # DataTable, FilterToolbar, AuthorizedImage, ...
  features/<capability>/
    pages/                     # compose màn hình
    components/                # UI riêng tính năng
    hooks/                     # query/mutation/interaction hooks
    services/ hoặc api.ts      # giữ convention tính năng hiện có
    types/                     # contract/types tính năng
    utils/                     # logic thuần cần thiết
  shared/
    api/http-client.ts         # cookie, CSRF, lỗi, fetch options
    auth/require-auth.tsx      # guard UX; backend vẫn quyết định quyền
    hooks/                     # chỉ abstraction thật sự dùng chung
    utils/cn.ts                # clsx + tailwind-merge
    utils/formatDate.ts        # shared formatting
  index.css                    # layer order, token, base, legacy tạm thời
```

Không di chuyển hàng loạt folder chỉ để khớp cây minh họa. API file hiện có ở vị trí hợp lệ được giữ; không tạo hai service cho cùng resource.

### 5.2 Ownership trạng thái

| Trạng thái | Nơi quản lý đề xuất | Quy tắc |
| --- | --- | --- |
| User/auth status | AuthProvider | Không đưa token vào localStorage; giữ handler HTTP |
| Server resources | Feature query hooks | Keys có account và scope/filter phù hợp |
| Input/form errors | React Hook Form + schema tính năng | Backend validation vẫn bắt buộc; map `error.code` |
| Filter cần deep link | URL search params | Back/forward/reload giữ phạm vi |
| Modal, tab, vị trí dock | Local state | Không tạo global store mới |
| Messages/sync/pending | Messaging coordinator theo giai đoạn | Mỗi loại chỉ có một chủ sở hữu; sequence authoritative từ server |
| Online/typing | State tạm trong Messaging | Không persist như dữ liệu lâu dài |

### 5.3 Chính sách dữ liệu và invalidation

- Query key riêng tư có account identity và scope: ví dụ minh họa `['account', userId, 'bookings', filters]`; đây là key frontend đề xuất, không phải API mới.
- Dữ liệu public chỉ dùng chung cache nếu response thật sự không phụ thuộc viewer. Feed/profile có quyền theo viewer phải scope phù hợp.
- Booking create/cancel/payment thành công: cập nhật hoặc invalidate booking detail/list và availability liên quan; chỉ hiển thị server-confirmed success. Countdown local không tự xác nhận thanh toán/giải phóng slot.
- Apply/invite/chốt/rút: invalidate request detail, roster, my-matches và card feed tương ứng; giữ payment-lock error và trạng thái quyền do backend trả.
- Profile mutation: header, modal profile và trang profile dùng cùng dữ liệu đã xác nhận; không để context và Query giữ hai bản profile độc lập lâu dài.
- Logout/session-invalid/account switch: ngừng đọc dữ liệu cũ, hủy queries đang chạy, bỏ cache riêng và state realtime; response đến muộn không được ghi sang scope mới. Không coi abort mutation là đã hủy tác động phía server.
- Background refresh lỗi: giữ dữ liệu tốt trước đó trong cùng scope và hiển thị stale/retry; đổi court/date/facility/account không giữ nhầm dữ liệu scope trước.
- Chọn TTL theo resource; 30 giây không là quy tắc chung cho availability, pending payment, feed hoặc message read markers.

### 5.4 Style, accessibility và performance

- Giữ thương hiệu xanh `#006B2C`, Inter và giao diện sáng làm điểm xuất phát theo định hướng đã trao đổi; dark mode chưa thuộc đợt này.
- Figma là tham khảo phong cách; hành vi, permissions, MVP và dữ liệu thuộc PRD/Tech Design/backend.
- Token semantic thống nhất cho surfaces, text, trạng thái, borders, radius, shadow, spacing; không chỉ đổi hex inline thành chuỗi class arbitrary chứa cùng hex.
- Tailwind dùng scale/token; CSS riêng cho trường hợp cần thiết và có phạm vi. Style inline hợp lệ cho giá trị động như vị trí kéo/thước đo.
- Motion tôn trọng reduced motion; kiểm tra riêng hiệu ứng CSS. Confetti bật `disableForReducedMotion`, chỉ tải tại màn kết quả khi được triển khai. [Motion accessibility](https://motion.dev/docs/react-accessibility).
- Bàn phím, nhãn input, mô tả lỗi, trả focus, Escape, scroll-lock và z-index phải kiểm tra cả dialog trong dock và dialog thông thường.
- Chart chỉ tải tại trang cần biểu đồ; không dựng dashboard số liệu giả. Không đưa Recharts vào provider hay shell chung.

## 6. Kế hoạch chia thành các đợt nhỏ

### Trạng thái và quy trình bàn giao từng giai đoạn

Trạng thái: `NOT_STARTED` (chưa làm), `UX_REVIEW` (đang rà soát giao diện/chức năng hiện tại theo §6.8), `AWAITING_DIRECTION` (đã có báo cáo rà soát, chờ thảo luận và chốt hướng sửa), `IN_PROGRESS` (đang làm), `AWAITING_REVIEW` (đã làm/kiểm chứng, chờ người dùng review), `DONE` (người dùng đã nghiệm thu), `BLOCKED` (có blocker cụ thể). Không đánh dấu DONE chỉ vì code đã có.

| Giai đoạn | Trạng thái | Phạm vi/ghi chú |
| --- | --- | --- |
| D00 | DONE | Người dùng đã xác nhận tiếp tục D01 sau báo cáo D00 (17/11/2026); xem §13 |
| D01 | DONE | Tích hợp mẫu v2, dọn code/CSS (§17) và sửa cuối theo review (§18); người dùng nghiệm thu 18/11/2026 |
| D02 | UX_REVIEW | Người dùng xác nhận bắt đầu 18/11/2026; đang làm D02-00 rà soát `/change-password` và Access-denied theo §6.8 |
| D03 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D04 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D05 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D06 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D07 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D08 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D09 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D10 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D11 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D12 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D13 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D14 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D15 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D16 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D17 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D18 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D19 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D20 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D21 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D22 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |
| D23 | NOT_STARTED | Backlog theo §6.6; chưa được xác nhận bắt đầu |

Trước mỗi giai đoạn giao diện (từ D02): rà soát giao diện và chức năng hiện tại theo §6.8 → gửi nhận xét và hướng sửa → thảo luận, người dùng chốt hướng → mới triển khai. Sau mỗi giai đoạn: cập nhật kết quả/task → báo cáo phần đã làm và test/blocker → đề xuất phạm vi giai đoạn tiếp theo → dừng chờ người dùng xác nhận. Commit message dùng tiếng Anh, không thêm dòng tác giả/Co-authored-by ở cuối. Không tự tạo commit chỉ vì đã chốt quy cách nội dung commit.

### 6.1 Nguyên tắc phạm vi

- **D00 là giai đoạn chuẩn bị riêng; D01 là đợt giao diện đầu tiên đã chọn.** Chỉ bắt đầu D01 sau khi D00 đủ điều kiện nghiệm thu. Danh sách D02 trở đi là hàng đợi tham khảo; không tự động triển khai toàn bộ sau D01.
- Kế hoạch có **24 mục D00–D23**: 1 giai đoạn chuẩn bị, 1 đợt giao diện đã chọn và 22 đợt giao diện dự kiến. Đây không phải 24 đợt triển khai đồng thời hoặc lịch cam kết toàn dự án.
- Mỗi đợt chọn một trang, hoặc một luồng nhỏ mà các bước không thể kiểm chứng độc lập. Nếu một đợt phát sinh quá nhiều trang/component, tách tiếp trước khi mở rộng code.
- Phần nền được bổ sung theo nhu cầu: trang dùng Button/Input thì tạo các primitive đó; không tiện tay làm thêm DataTable, Dialog, chart hoặc Player/Admin shell.
- Một đợt UI không bắt buộc đổi cơ chế dữ liệu. Giữ service/hook hiện có nếu đủ cho trang đó; chuyển Query bằng task riêng khi có lợi ích rõ và đủ cache/session safeguards (§5.3).
- Dọn CSS/component cũ theo consumer của trang vừa chuyển, không đợi một đợt dọn toàn dự án và không xóa CSS còn được trang khác dùng.
- Mỗi đợt có review kết quả, bằng chứng desktop/mobile và kiểm thử liên quan. Kết thúc đợt rồi mới chọn phạm vi đợt kế tiếp.
- Các phát hiện F01–F10 là backlog rủi ro toàn hệ thống, không phải mọi mục đều phải giải quyết trong D01.

### 6.2 Giai đoạn D00 — Cập nhật tài liệu, cài đặt/cấu hình và kiểm chứng nền

**Mục tiêu:** hoàn thành riêng phần chuẩn bị, để khi bắt đầu D01 không vừa làm trang vừa xử lý các quyết định/cấu hình nền chưa rõ. D00 không chuyển giao diện bất kỳ trang nào.

**Thứ tự bắt buộc trong giai đoạn:** cập nhật tài liệu → rà hiện trạng dependencies/config → cài bổ sung và cấu hình phần thiếu → kiểm chứng và bàn giao nền.

| Task | Trạng thái | Công việc | Đầu ra/điều kiện hoàn thành |
| --- | --- | --- | --- |
| D00-01 | DONE | Cập nhật `tech-stack.md`, `frontend.md`, `conventions.md` và hướng dẫn agent liên quan; ghi nhận quyết định thư viện, thay rule cấm cũ, thống nhất `components/ui/`, `shared/utils/cn.ts`, token, Figma và cách chia đợt | Không còn chỉ dẫn trái nhau chi phối nền và D01; giữ quy tắc/API/nghiệp vụ ngoài phạm vi; shared docs được review theo quy trình trước merge |
| D00-02 | DONE | Kiểm kê `package.json`, lockfile, dependencies đã cài, cấu hình Vite/TypeScript/shadcn, token/layer và providers đang có; ghi baseline build/lint và lỗi có trước | Bảng từng thư viện/cấu hình: đã có, còn thiếu, cần dùng ngay hoặc để đợt sau; không tự hoàn tác working tree |
| D00-03 | DONE | Cài bổ sung phần thiếu trong danh sách đã thống nhất; kiểm tra phiên bản/peer dependencies; hoàn thiện alias, Tailwind plugin, `components.json`, `cn()`, theme/layer và provider wiring cần thiết | Manifest/lockfile nhất quán, cấu hình resolve được; giữ CSS cũ còn consumer; chỉ bổ sung phần cần cho nền dùng ngay và D01, không cài lại hoặc thêm package cho đủ danh sách |
| D00-04 | DONE | Chạy build/lint và smoke test trang hiện tại bị tác động bởi global CSS/config/provider; ghi kết quả, file đã đổi và phần còn lại | Không phát sinh lỗi mới; lỗi baseline được phân biệt rõ; có kết quả kiểm chứng làm điều kiện bắt đầu D01 |

**Ranh giới công việc:**

- D00 được sửa tài liệu và phần cấu hình/nền; chưa sửa bố cục, JSX hay form của Sign-in/Register/Change-password hoặc các trang Player/Owner/Admin.
- Giữ các package/config đã có nếu phù hợp; không xem việc cài đặt trước đây là đã nghiệm thu và không tự gỡ chúng. Không thêm thư viện ngoài bộ nhóm đã thống nhất.
- CLI shadcn nếu cần chỉ được dùng có kiểm soát; kiểm tra diff để không ghi đè token/global CSS hoặc sinh nhiều component không có consumer. Button/Input/Label/Alert cho trang thực tế được làm ở D01.
- Không đưa việc hoàn thiện cache/session toàn ứng dụng, chuyển Query cho dữ liệu riêng, DataTable/Dialog toàn hệ thống, shell hoặc refactor Messaging vào D00.
- Motion/Toaster/Query providers đã tồn tại được kiểm tra khả năng khởi động và tác động hiện tại; chưa chuyển feature sang cách quản lý dữ liệu mới. Cache safeguards vẫn phải hoàn thành trước đợt đầu thực sự dùng Query cho dữ liệu riêng.

**Nghiệm thu D00:**

1. Quyết định thư viện và quy tắc nền được ghi thống nhất; không hỏi lại việc cho phép dùng thư viện đã được người dùng xác nhận.
2. Có bảng kiểm kê dependencies/config và kết quả baseline. Môi trường thiếu hoặc test chưa chạy được phải ghi rõ; không báo pass thay cho kết quả chưa có.
3. Build/lint sau chỉnh nền không có lỗi mới; các vấn đề có trước được ghi riêng, không tuyên bố toàn dự án sạch nếu chưa đúng.
4. Kiểm tra trang cũ bị ảnh hưởng, đặc biệt Auth dùng chung và một trang đại diện Player/Owner/Admin khi thay token/reset toàn cục; chưa làm lại giao diện các trang đó.
5. Bàn giao danh sách file nền đã thay đổi, kết quả kiểm chứng và blocker. Nếu blocker nền còn ảnh hưởng trực tiếp tới D01 thì D00 chưa hoàn tất.

**Điểm dừng:** báo cáo D00 đã hoàn thành hoặc blocker còn lại. Chỉ tiếp tục D01 khi điều kiện nền đã đạt; cập nhật kế hoạch này không đồng nghĩa đã chạy D00 hoặc đã cài thêm thư viện.

### 6.3 Đợt D01 — Chuyển riêng trang đăng nhập

**Điều kiện bắt đầu:** D00 đã nghiệm thu, thư viện/config nền sẵn sàng và các blocker trực tiếp đã được xử lý.

**Mục tiêu:** một trang `/sign-in` dùng giao diện mới, đủ trạng thái và giữ luồng xác thực hiện có. Đây cũng là mẫu thiết kế đầu tiên để đánh giá trước khi áp dụng sang trang khác.

**Phạm vi vào:**

- `features/auth/sign-in-page.tsx` và component trình bày riêng của trang nếu cần tách.
- AuthLayout phục vụ đăng nhập. Vì `auth-layout.tsx` đang dùng chung, chọn variant opt-in có mặc định tương thích hoặc layout riêng cho Sign-in; không đổi mặc định khiến Register/Change-password bị chuyển giao diện cùng lúc.
- Primitive tối thiểu thực sự có consumer: Button, Input, Label và Alert; Card hoặc icon lucide nếu trang cần. Không lấy danh sách thư viện được phép làm danh sách bắt buộc dùng.
- Dùng token, alias, shadcn config và nền đã bàn giao ở D00. Nếu phát hiện thiếu cấu hình nền, ghi task bổ sung thuộc D00 với phạm vi rõ; không âm thầm mở rộng D01 thành cài đặt lại foundation.
- Cập nhật tài liệu mô tả đúng trang/component vừa chuyển và kiểm thử trang đăng nhập; không lặp lại việc chốt bộ thư viện ở D01.

**Ngoài phạm vi D01:**

- Chuyển `/register`, khảo sát, `/change-password`, trang Access-denied hoặc các trang sau đăng nhập.
- Player/Owner/Admin shell, DataTable/FilterToolbar, Dialog/Toast toàn hệ thống.
- Chuyển AuthProvider, API/service hoặc các resource riêng tư sang TanStack Query; thay cache/session lifecycle toàn ứng dụng.
- Cài thêm thư viện ngoài danh sách đã thống nhất, tối ưu bundle toàn hệ thống, dọn 7 stylesheet còn lại, refactor Messaging.
- Thêm OTP/OAuth/forgot-password, thay API đăng nhập, password policy hoặc permissions.

Phần foundation đang có trong working tree được kiểm kê và xử lý ở D00, không tự hoàn tác. D01 tập trung vào trang `/sign-in`, component cần cho trang và kiểm chứng luồng đăng nhập.

### 6.4 Công việc chi tiết của D01

Các ID dưới đây là task trong kế hoạch, chưa được đánh dấu hoàn thành. Chúng thay cách gom công việc `FE-MOD-00`–`FE-MOD-28` của bản trước; không là yêu cầu triển khai toàn bộ các task cũ.

| Task | Trạng thái | Công việc | Đầu ra/điều kiện hoàn thành |
| --- | --- | --- | --- |
| D01-01 | DONE | Đọc Auth PRD/Tech Design/test, kế thừa baseline D00 và chốt mẫu Sign-in desktop/mobile: bố cục, màu, form, lỗi/loading | Mẫu thiết kế và danh sách hành vi giữ nguyên; chưa đổi trang thứ hai |
| D01-02 | DONE | Tạo hoặc hoàn thiện Button/Input/Label/Alert và component trang cần dùng trên nền D00 | Component có label/focus, không sinh UI kit thừa; không cài lại foundation |
| D01-03 | DONE | Chuyển SignInPage và layout opt-in, giữ `useAuth().signIn` và transport hiện tại | Trang mới hoạt động; Register/Change-password dùng layout mặc định không bị chuyển theo |
| D01-04 | DONE | Kiểm thử chức năng, bàn phím, mobile và regression các consumer bị ảnh hưởng | Kết quả thực, ảnh so sánh; CSS Sign-in chỉ xóa khi không còn consumer khác |
| D01-05 | DONE | Review đợt và cập nhật tài liệu/kết quả | Bàn giao file đã sửa, kiểm chứng, giới hạn; dừng ở D01, chọn đợt tiếp theo riêng |

| D01-06 | DONE | Dọn implementation/CSS cũ không còn consumer và chuẩn hóa phần dùng chung theo §6.7 | Đã thay CourtIllustration/layout cũ, gộp field markup, bỏ `.auth-support`; giữ legacy còn consumer; xem §17 |

Người dùng đã chốt mẫu v2 ngày 18/11/2026, nên D01-01 là DONE. Implementation và cleanup đang chờ review chung; không tự đánh dấu cả D01 là DONE. Quy tắc thư viện/config nền đã xử lý ở D00, không cài lại trong D01.

**File có thể thay đổi khi thực hiện D01:** `sign-in-page.tsx`, layout/component riêng Sign-in hoặc variant `auth-layout.tsx`, các primitive thực sự cần, test Sign-in và tài liệu mô tả trang. Dùng token sẵn có; bổ sung token riêng nếu mẫu cần thì giới hạn phạm vi và kiểm tra consumer. Package/lockfile, alias, Tailwind plugin, providers và cấu hình shadcn thuộc D00, không mặc định nằm trong scope D01.

### 6.5 Tiêu chí nghiệm thu và điểm dừng D01

- Đăng nhập đúng bằng 3 role, giữ role-home; redirect `from` chỉ trong khu vực phù hợp; tài khoản bắt buộc đổi mật khẩu vẫn đến route cũ.
- Sai thông tin, account restricted/locked, rate limit, validation và lỗi mạng hiển thị đúng trạng thái; thông báo session hết hạn vẫn có; không hiện thông tin thành công giả.
- Pending chặn gửi lặp; hiện/ẩn mật khẩu dùng được bằng bàn phím; label, autocomplete và focus rõ; password không bị lưu vào browser storage.
- Link Register vẫn hoạt động nhưng không chuyển giao diện trang Register trong đợt này. Truy cập Change-password/Access-denied kiểm tra luồng hiện có, không làm lại chúng.
- Kiểm tra ở 390px và 1280px; không tràn viewport; thông báo lỗi không che nút gửi. Không cần animation hoặc confetti để coi đợt này hoàn tất.
- Build/lint và test liên quan không phát sinh lỗi mới; lỗi baseline chưa xử lý phải được ghi rõ, không gọi toàn dự án sạch nếu thực tế không phải vậy.
- Nếu sửa AuthLayout/token/reset chung: smoke Register/Change-password và trang đại diện thuộc khu vực bị tác động; đây là kiểm thử hồi quy, không mở rộng phạm vi làm lại giao diện.
- Chỉ xóa selector mà Sign-in là consumer cuối. Không coi số lượng inline style toàn dự án giảm là tiêu chí của D01.
- **Điểm dừng:** trình bày trang Sign-in đã hoàn thiện cùng kết quả kiểm chứng; không tự chuyển sang D02 hoặc dọn cache/refactor feature khác.

Chưa chốt ngày công D01 vì chưa chạy baseline và chưa chốt mẫu. Ước lượng riêng D00 sau kiểm kê D00-02 và D01 sau chốt mẫu D01-01. Con số 23–35 ngày công của bản trước chỉ là ước lượng thô toàn lộ trình, không còn dùng làm thời hạn hoặc phạm vi giao việc hiện tại.

### 6.6 Các đợt tiếp theo — backlog đề xuất

Chỉ chốt chi tiết một đợt gần nhất khi cần; thứ tự có thể thay đổi theo ưu tiên sản phẩm. Mỗi hàng là đơn vị dự kiến, có thể tiếp tục tách nếu consumer hoặc nghiệp vụ quá lớn.

| Đợt | Trang/luồng dự kiến | Giới hạn chính |
| --- | --- | --- |
| D02 | `/change-password` và màn không đủ quyền | Dùng lại primitive D01; chưa đổi Player shell |
| D03 | `/courts` — danh sách sân và filter | Chưa đổi detail hoặc đặt sân |
| D04 | `/courts/:courtId`, chọn ngày/giờ và facility detail nếu cùng consumer | Nếu quá rộng, tách facility detail thành đợt riêng |
| D05 | Booking summary → pending → detail | Một luồng tạo/giữ chỗ/thanh toán hiện có; không Wallet mới |
| D06 | `/bookings` — danh sách/lịch sử và cancel entry | Tận dụng detail đã làm; kiểm tra invalidation liên quan |
| D07 | `/profile` và contact | Public profile modal/avatar có thể tách tiếp; header chỉ sửa khi cần đồng bộ |
| D08 | `/feed` — bố cục và card feed | Chưa refactor PostDetail/Composer toàn bộ |
| D09 | `/posts/:postId`, comment/reaction; Composer theo consumer | Tách Composer riêng nếu scope lớn; giữ `asOf`/authorized media |
| D10 | `/matchmaking` — danh sách và tạo yêu cầu | Không gom mọi trạng thái quản lý thành viên |
| D11 | Request detail, Apply/Invite, danh sách lời mời | Có thể chia detail và invitations thành hai đợt |
| D12 | My-matches và Match detail | Tách list/detail nếu cần; giữ payment lock và quyền chat |
| D13 | Rating modal/history hiện có | Chỉ làm khi đã đối chiếu scope nghiệp vụ giữa các nhánh |
| D14 | Owner facility management | Chưa chuyển pricing/schedule cùng lượt |
| D15 | Owner pricing | Giữ scope facility/court và contract hiện có |
| D16 | Owner schedule và booking detail panel | Tách panel nếu cần; không đổi chính sách hủy |
| D17 | Owner dashboard/account | Chọn từng trang; không thêm số liệu chưa có API |
| D18 | Admin users | Table/filter/modal theo đúng luồng này; tách refactor AF nếu blocked |
| D19 | Admin courts và facility reviews | Có thể chia list và review; không tự đổi pagination backend |
| D20 | Messaging workspace/list | Giữ room/dock cũ tương thích; chuẩn bị regression realtime trước |
| D21 | ConversationRoomPane | Tách sync/composer/UI thành các thay đổi nhỏ; giữ một nguồn state |
| D22 | GlobalChatDock | Tận dụng room đã kiểm chứng; giữ vị trí/draft/unread |
| D23 | BlockList | Đợt độc lập nhỏ; kiểm thử block/unblock |
| Deferred | Register/survey, home, Tournament, Wallet, Admin dashboard/reports | Chốt riêng khi PRD/API/ưu tiên sẵn sàng; không tự đưa vào các đợt trên |

Shell Player/Owner/Admin được lên một đợt riêng nếu trang chọn cần thay shell. Không nâng việc đổi một trang thành thay cả portal. Cache/session là task dữ liệu riêng trước **đợt đầu tiên thực sự dùng Query cho dữ liệu riêng**, không là điều kiện bắt buộc của D01. Chart/effect/lazy-load thực hiện ở trang sử dụng chúng, không gom thành một đợt nền nặng.

### 6.7 Quy tắc bắt buộc khi chuyển giao diện — xác nhận 18/11/2026

- Mỗi đợt phải **thay code cũ bằng implementation dùng thư viện đã thống nhất**, đồng thời dọn component, hook, import, CSS và asset của phần đã được thay nếu không còn consumer. Không giữ hai implementation chạy song song cho cùng trang.
- Trước khi xóa, tìm tất cả consumer, kể cả class ghép động, media query, pseudo selector và trang legacy. Chỉ xóa phần không còn dùng; ghi rõ phần giữ lại và consumer tương ứng trong bàn giao.
- Không chồng thêm selector hoặc `!important` để vá CSS cũ. Trang mới dùng Tailwind và token chung; primitive ở `components/ui/`. CSS đặc thù thật sự cần thiết phải có phạm vi rõ và lý do; không thêm reset toàn cục hay rule mới vào `@layer legacy`.
- Component có trách nhiệm dùng chung đặt ở `components/common/`; hook/utility tái sử dụng đặt ở `shared/hooks/` hoặc `shared/utils/`. UI, bố cục và nghiệp vụ riêng ở `features/<capability>/`; không tạo bản sao primitive/hook cho từng feature hoặc đưa auth/API logic vào component trình bày.
- Dọn kiến trúc **theo consumer của đợt đang làm**, không mở rộng thành refactor toàn frontend. Register, Change-password và các trang chưa chuyển tiếp tục dùng legacy cho tới đợt tương ứng.
- Nghiệm thu mỗi đợt phải có danh sách code/CSS đã bỏ, dependency/consumer còn giữ, kết quả build/lint và regression liên quan. Chỉ hoàn tất bàn giao khi phần được chuyển không còn phụ thuộc stylesheet legacy của nó.

### 6.8 Rà soát giao diện và chức năng trước khi triển khai — xác nhận 18/11/2026

Áp dụng cho mọi đợt giao diện từ D02 trở đi. D01 đã qua bước tương đương bằng mẫu v1/v2 (§16). Mỗi đợt bắt đầu bằng task **`Dxx-00 — Rà soát hiện trạng`**. Không sửa source của đợt trước khi người dùng chốt hướng.

**Quy trình:**

1. **Quét giao diện hiện tại.** Mở trang thật, dùng backend/database local nếu chạy được. Không reset/seed database dev chỉ để rà soát; nếu phải dùng fixture thì ghi rõ. Chụp ảnh tối thiểu ở 390 px và 1280 px, thêm 768 px khi bố cục thay đổi theo chiều rộng. Xem mọi trạng thái áp dụng được: loading, rỗng, lỗi, thành công, không đủ quyền, đang gửi, dữ liệu dài hoặc nhiều. Thử bàn phím (Tab/Shift+Tab/Enter/Escape) và focus.
2. **Quét chức năng.** Đọc PRD/Tech Design/business rules liên quan, component/hook/API đang dùng và E2E hiện có. Lập danh sách hành vi phải giữ: luồng, validation, mã lỗi, redirect, quyền, polling/realtime. Ghi lỗi và khoảng trống phát hiện được; không sửa nghiệp vụ trong lúc rà soát.
3. **Nhận xét từ hai góc độ.**
   - *Người dùng:* vào trang để làm gì, mất bao nhiêu bước, chỗ nào khó hiểu hoặc vướng, chữ và thông báo lỗi có rõ không, phản hồi sau thao tác, cảm giác tin cậy, trải nghiệm trên điện thoại.
   - *Nhà thiết kế giao diện:* phân cấp thông tin, bố cục và lưới, khoảng cách, typography, màu/token, nhất quán với trang đã chuyển (Sign-in v2) và phong cách Figma, trạng thái hover/focus/disabled, responsive, accessibility (nhãn, tương phản, vùng bấm 44 px, không chỉ dựa vào màu), motion và reduced motion.
4. **Hướng sửa đổi.** Mỗi nhận xét có bằng chứng (ảnh hoặc file:dòng) và đề xuất cụ thể. Khi có nhiều cách làm, trình bày phương án, đánh đổi và khuyến nghị. Nêu dự kiến primitive/common component cần thêm, file sẽ sửa, CSS/component legacy có thể dọn và rủi ro hồi quy.
5. **Dừng để thảo luận.** Chuyển đợt sang `AWAITING_DIRECTION` và gửi báo cáo. Chỉ triển khai sau khi người dùng chốt hướng; người dùng có thể chấp nhận một phần. Ghi quyết định vào báo cáo rà soát rồi mới chuyển `IN_PROGRESS`.

**Phân loại nhận xét:**

| Mức | Ý nghĩa |
| --- | --- |
| P1 | Chặn hoàn thành tác vụ, gây hiểu sai, lỗi accessibility nghiêm trọng |
| P2 | Gây vướng rõ rệt, thiếu trạng thái, thiếu nhất quán đáng kể |
| P3 | Tinh chỉnh thẩm mỹ hoặc chi tiết nhỏ |

| Phạm vi | Cách xử lý |
| --- | --- |
| Trong đợt | Sửa giao diện/tương tác của trang đang làm |
| Cần quyết định nghiệp vụ/API | Ghi nhận, không tự sửa; chỉ làm khi PRD/Tech Design/backend được duyệt |
| Ngoài đợt hoặc TBD | Đưa vào backlog đợt khác hoặc mục TBD; không mở rộng đợt hiện tại |

Nhận xét từ góc độ người dùng/thiết kế không được tự thay đổi nghiệp vụ, API, quyền hoặc đưa nội dung ngoài MVP (`frontend.md` §9.4) vào trang. Những đề xuất loại đó chỉ được ghi lại để người dùng quyết định.

**Đầu ra:** báo cáo `reviews/Dxx-<ten-ngan>.md` trong thư mục kế hoạch này, ảnh hiện trạng ở `evidence/Dxx-before/`. Nếu đợt cần mẫu thiết kế độc lập như D01, dựng mẫu sau khi chốt hướng, lưu ở `docs/design/` và duyệt mẫu trước khi tích hợp.

```markdown
# Dxx — <trang/luồng>: rà soát trước khi triển khai

- Ngày, route, môi trường (backend thật/fixture), tài khoản/role đã dùng

## 1. Hiện trạng — ảnh 390/1280 px và các trạng thái đã xem
## 2. Hành vi phải giữ nguyên — nguồn PRD/Tech Design/code/test
## 3. Nhận xét góc độ người dùng — ID, mức, phạm vi, bằng chứng, hướng sửa
## 4. Nhận xét góc độ thiết kế giao diện — ID, mức, phạm vi, bằng chứng, hướng sửa
## 5. Lỗi/khoảng trống chức năng phát hiện
## 6. Hướng đề xuất tổng thể, các phương án và khuyến nghị
## 7. Dự kiến file, component, CSS legacy sẽ dọn và kiểm thử
## 8. Câu hỏi cần chốt và quyết định của người dùng
```

## 7. Theo dõi route theo đợt

| Nhóm | Route hiện có | Đợt dự kiến |
| --- | --- | --- |
| Chuẩn bị nền | Không chuyển trang | **D00 — tài liệu, dependencies/config và kiểm chứng** |
| Đăng nhập | `/sign-in` | **D01 — sau khi D00 nghiệm thu** |
| Mật khẩu/quyền | `/change-password`, Access-denied là màn guard | D02; kiểm tra redirect từ D01 không phải chuyển UI D02 |
| Discovery | `/courts`, `/courts/:courtId`, `/courts/:courtId/date`, `/facilities/:facilityId` | D03/D04 |
| Booking | `/bookings/new`, `/bookings/:bookingId/pending`, `/bookings/:bookingId`, `/bookings` | D05/D06 |
| Profile | `/profile`, `/profile/contact` | D07 |
| Social | `/feed`, `/posts/:postId` | D08/D09 |
| Matchmaking | `/matchmaking`, `/matchmaking/requests/:requestId`, `/matchmaking/invitations`, `/matchmaking/matches`, `/matchmaking/matches/:matchId` | D10/D11/D12 |
| Rating | `/ratings/given` | D13 sau đối chiếu scope |
| Owner | `/owner`, `/owner/facilities`, `/owner/pricing`, `/owner/schedule`, `/owner/account` | D14–D17; chọn trang cụ thể mỗi lượt |
| Admin | `/admin`, `/admin/users`, `/admin/courts`, `/admin/courts/:facilityId/reviews` | D18/D19; shell/AF là task riêng |
| Messaging | `/messages`, `/messages/:conversationId`, dock, `/settings/blocks` | D20–D23; dock là component, không phải route |
| Deferred | `/register`, `/` index, `/tournaments`, `/admin/dashboard`, `/admin/tournaments`, `/admin/reports` | Không thuộc D01; giữ hành vi hiện tại |
| Router boundary | Các route cha và `*` | Giữ guards/deep link/fallback; không đổi router hàng loạt |

Không lấy tổng path entries làm đơn vị giao việc. Bảng này là bản đồ backlog, không phải chỉ thị sửa toàn bộ các route trên cùng nhánh.

## 8. Kế hoạch kiểm chứng và Definition of Done

### 8.1 Baseline và lệnh dự kiến

D00 ghi baseline, chạy build/lint và kiểm tra tác động nền; D01 kế thừa kết quả đó, chạy lại kiểm chứng phù hợp sau khi sửa trang. Không gộp việc cài nền vào task giao diện.

Các lệnh dưới đây dành cho giai đoạn triển khai, **chưa được chạy trong lượt viết báo cáo**:

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
cd frontend
npm run test:e2e -- e2e/sign-in.spec.ts e2e/forced-password-change.spec.ts e2e/role-based-denial.spec.ts
```

Chạy E2E theo feature thay đổi và cấu hình/harness phù hợp; đọc cấu hình trước vì default Playwright tự bật backend test server, dùng Chrome và không reuse backend ở port 3000. Kiểm tra database test biệt lập; không reset database dev để chạy test. D01 ưu tiên Sign-in và regression forced-password/role denial; các bài này không cho phép sửa giao diện Change-password/Access-denied. Kiểm tra thêm consumer khi thay shared CSS/layout. Full E2E chỉ khi phạm vi thay đổi chung hoặc mốc tích hợp biện minh cho nó; không là điều kiện mặc định của mọi đợt một trang.

### 8.2 Ma trận tình huống tối thiểu

| Nhóm | Tình huống cần kiểm tra |
| --- | --- |
| Auth/cache | A logout → B login; session hết hạn khi query đang chạy; forced password; 401/403; CSRF refresh |
| UI base | Dialog keyboard/focus return, busy state, select/radio labels, destructive confirmation |
| Responsive | 390px và 1280px làm mốc; kiểm tra thêm tablet và desktop rộng; không tràn viewport, composer không bị keyboard che |
| Booking | Refresh lỗi giữ last-good cùng scope; đổi ngày/sân; conflict; hết hold; payment replay và cancel theo API |
| Social | `asOf` load-more, filter change, retry upload, hidden/deleted post, comment/reaction permissions |
| Matchmaking | Apply/Invite, host/member/nonmember, chốt, rút/loại sau payment, group chat access loss |
| Owner/Admin | Đổi facility, giữ draft đúng scope, bulk selection, pagination/filter, permission errors |
| Messaging | Offline/reconnect, seq/version catch-up, retry identity, unread, scroll, block/kick, dock/full view |
| Accessibility | Tab/Shift+Tab/Escape, visible focus, label/error association, không chỉ dùng màu, reduced motion |

Ưu tiên locator theo role/label và dữ liệu thật trong E2E. Không sửa assertion để hợp thức hóa mất chức năng; chỉ đổi selector khi markup/accessibility thực sự đổi. Test mock dùng cho trạng thái UI, test API thật cho contract và permission trọng yếu.

### 8.3 Definition of Done cho từng lát chuyển đổi

- Luồng được chọn hoạt động với API hiện có; đủ loading/success/error/empty và permission states áp dụng.
- Không tạo request/timer trùng; invalidation/cache scope được mô tả và kiểm chứng.
- Primitive/token mới được dùng thống nhất; CSS cũ chỉ xóa khi không còn consumer.
- Build/lint và tests liên quan có kết quả thực; hạn chế môi trường hoặc lỗi có trước được ghi rõ.
- Có bằng chứng desktop/mobile và keyboard cho phần thay đổi; không xem shadcn là bảo đảm tự động đạt mọi tiêu chí accessibility.
- Tài liệu/route map cập nhật khi hành vi hoặc cấu trúc được duyệt thay đổi; diff không chứa backend/schema ngoài phạm vi.

## 9. Nhánh, PR và cách quay lại khi có lỗi

1. Hoàn thành tài liệu/baseline liên quan trực tiếp đến đợt đã chọn trước khi sửa code; không bắt hoàn thiện mọi phần nền hoặc tự hoàn tác working tree đang có.
2. Mỗi đợt có thay đổi độc lập có thể review; tách cập nhật tài liệu và code khi phù hợp, không gom toàn bộ foundation hoặc mọi trang một feature vào một PR. Việc tách commit chỉ thực hiện khi người dùng yêu cầu, không tự stage/commit trong lượt báo cáo.
3. Không gộp đổi API Admin, backend khảo sát, ví hoặc giải đấu vào PR style. Ghi phụ thuộc bằng task/PR liên quan.
4. Mỗi PR ghi route/consumer đã chuyển, API có thay đổi không, kiểm chứng và legacy còn lại. File lớn tách theo trách nhiệm thay vì đạt số dòng bằng cách chia tùy tiện.
5. Khi lỗi hồi quy: giữ phạm vi feature, xử lý hoặc quay lại thay đổi riêng sau khi được cho phép; không dùng reset/clean phá working tree chung. Legacy của các consumer khác được giữ trong giai đoạn chuyển đổi.
6. Shared documents vẫn cần teammate review trước merge theo AGENTS/documentation guide; báo cáo mới này chưa thay thế các nguồn authoritative.

## 10. Phụ thuộc, rủi ro và các quyết định để lại đúng nơi

| Vấn đề | Cách xử lý trong kế hoạch |
| --- | --- |
| AUTH-31 chỉ ở nhánh khảo sát, phụ thuộc AUTH-30 | Không copy contract từ trí nhớ; tích hợp branch/API thật và tài liệu được duyệt trước khi dựng wizard production |
| Khảo sát có nội dung/công thức server-defined | Frontend render definition; không tính điểm nâng trình độc lập; không lưu password cùng draft |
| AF-01/02/03 còn BLOCKED | Chỉ chuẩn hóa style độc lập; làm transport/layout khi thiết kế đủ điều kiện; pagination backend là phần việc riêng |
| Ví và phân loại giải còn phần TBD | Placeholder trung thực; không hiển thị balance/payout/bracket giả như tính năng hoàn chỉnh |
| Brief giữa các nhánh khác nhau | Đối chiếu khi merge; không dùng quyết định nghiệp vụ của nhánh khác để thay đổi code âm thầm |
| Legacy cascade và focus | Baseline screenshot + kiểm tra computed style/keyboard; không chỉ kiểm tra build |
| Hai nguồn dữ liệu khi chuyển Query | Chuyển consumer và ownership cùng lát; không giữ sync hai bản vô thời hạn |
| Migration kéo dài | Giữ checklist route; mỗi giai đoạn có exit criteria; giảm hiệu ứng trang trí trước khi giảm coverage nghiệp vụ |
| Công việc phát sinh ngoài ước lượng | Cập nhật ngày công sau G3; ghi riêng thời gian chờ backend, thiết kế và reviewer |

## 11. Bước thực hiện hiện tại và cách kết thúc mỗi đợt

**Hiện tại (18/11/2026):** D00 và D01 DONE. Người dùng xác nhận bắt đầu D02; D02 đang ở bước D02-00 (rà soát hiện trạng, §6.8). Chưa sửa source D02 cho tới khi người dùng chốt hướng.

Thứ tự: **D00-01 → D00-02 → D00-03 → D00-04 → nghiệm thu D00 → D01-01 → D01-05**. D00 bàn giao tài liệu/config và kết quả kiểm chứng nền; D01 bàn giao một trang đăng nhập đã chuyển đổi. Các phát hiện toàn hệ thống ở §4 và kiến trúc đích ở §5 là cơ sở chọn giải pháp, không cho phép mở rộng hai phạm vi này sang toàn frontend.

Từ D02, mỗi đợt mở đầu bằng `Dxx-00` theo §6.8: rà soát giao diện/chức năng hiện tại, gửi nhận xét góc độ người dùng và thiết kế cùng hướng sửa, dừng ở `AWAITING_DIRECTION` cho tới khi người dùng chốt hướng.

Mỗi đợt kết thúc bằng bản bàn giao ngắn: trang nào đã đổi, file dùng chung bị ảnh hưởng, ảnh desktop/mobile, kiểm thử đã chạy và kết quả, lỗi còn lại, CSS/component cũ còn consumer. Sau đó mới chọn đợt tiếp theo; không coi nghiệm thu một trang là hoàn tất cả Auth hoặc toàn frontend.

## 12. Nguồn đối chiếu

### Trong repository

- `.agents/AGENTS.md`; `PROJECT-BRIEF.md`; `docs/documentation-guide.md`.
- `docs/architecture/{tech-stack,frontend,conventions,database-schema}.md`; `docs/business-rules-config-matrix.md`.
- `docs/features/admin/frontend-consolidation/{tech-design,tasks}.md`.
- Feature PRD/Tech Design/Tasks: Authentication, Booking, Matchmaking, Ratings, Profile, Social, Messaging và Court Owner cho các ràng buộc liên quan.
- `frontend/src/app/router.tsx`, `frontend/src/app/providers.tsx`, `frontend/src/app/query-client.ts`, `frontend/src/main.tsx`, `frontend/src/index.css`.
- Các source path cụ thể ở §3–§4; `frontend/components.json`, Vite/TypeScript config, package/lockfile và `frontend/playwright*.config.ts`.
- AUTH-31 được đọc từ `feat/skill-survey:docs/features/platform/authentication-authorization/tasks.md`; chưa có trong working tree nhánh hiện tại.

### Tài liệu thư viện chính thức

Các link được đối chiếu ngày 17/11/2026 và hỗ trợ lựa chọn kỹ thuật đề xuất, không tự thay thế quyết định dự án:

- [Tailwind Preflight](https://tailwindcss.com/docs/preflight).
- [shadcn/ui — Vite installation](https://ui.shadcn.com/docs/installation/vite).
- [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
- [TanStack QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient).
- [Motion — Accessibility](https://motion.dev/docs/react-accessibility).

## 13. Bàn giao D00 — 17/11/2026

### 13.1 Trạng thái và phạm vi đã thực hiện

- **D00: DONE.** Người dùng đã cho phép chuyển sang D01 sau báo cáo D00 trong hội thoại ngày 17/11/2026. Bằng chứng bên dưới là nhật ký kiểm chứng của D00, không phải kết quả của các thay đổi D01.
- Tại thời điểm bàn giao D00, D01 chưa bắt đầu. Kết quả và trạng thái mới của D01 ở §14; D02–D23 vẫn chưa triển khai.
- Người dùng đã duyệt bộ thư viện và cho phép D00 trong hội thoại. Shared-document PR review trước merge vẫn còn; không tạo PR/commit/push trong lượt này.

### 13.2 Thay đổi của D00 và phần có sẵn

| Nhóm | Kết quả |
| --- | --- |
| Tài liệu công nghệ | tech-stack ghi CONFIRMED cho 10 nhóm thư viện, quy tắc adoption theo trang, auth context/server session và hỗ trợ runtime |
| Frontend architecture | Bỏ lệnh cấm cũ mâu thuẫn, thống nhất primitive/common/`cn()`, alias, token/layer, Figma style reference, modal/icon migration và Query safeguards |
| Conventions/agent | Đồng bộ vị trí shared UI, ranh giới server state, trạng thái giai đoạn và quy tắc review/xác nhận trước giai đoạn tiếp theo |
| README | Căn yêu cầu Node theo Vite 8: `^20.19.0 || >=22.12.0` |
| Dependency | Căn direct `react-is` từ 19.3.1 về exact 19.3.0 cho khớp React 19.3.0; cập nhật manifest, lockfile và cài đặt. Không nâng React hoặc thêm thư viện ngoài danh sách |
| Nền có sẵn được kiểm chứng | Tailwind plugin, alias TS/Vite, `components.json`, `cn()`, CSS theme/base/legacy, AppProviders/QueryClient/MotionConfig/Toaster; không tạo lại các phần này |
| Source các trang | Không sửa Sign-in/AuthLayout/router hay source tính năng. Ảnh desktop/mobile chứng minh các consumer kiểm tra vẫn render |

### 13.3 Kiểm kê dependency và cấu hình

Các phiên bản dưới đây đọc từ package cài đặt; đã đối chiếu với lockfile. Manifest/lock root khớp. Cài đặt không đồng nghĩa mọi thư viện đã có consumer.

| Nhu cầu | Package/version thực tế | Adoption |
| --- | --- | --- |
| Nền | `react@19.3.0` | React hiện có |
| DOM | `react-dom@19.3.0` | React hiện có |
| Build | `vite@8.3.0` | D00 kiểm chứng |
| Style | `tailwindcss@4.3.5` | Nền có sẵn |
| Style plugin | `@tailwindcss/vite@4.3.5` | Nền có sẵn |
| Primitive | `radix-ui@1.8.1` | Primitive có consumer từ D01 |
| Icon | `lucide-react@1.73.0` | Dùng khi chuyển trang |
| Form | `react-hook-form@7.92.0` | Dùng ở form được chuyển |
| Validation | `zod@4.6.7` | Dùng ở form được chuyển |
| Form adapter | `@hookform/resolvers@7.0.6` | Đi cùng form/Zod |
| Class variants | `class-variance-authority@0.7.1` | Helper cho primitive cần dùng |
| Class utility | `clsx@2.1.1` | Đã dùng qua cn() |
| Class merge | `tailwind-merge@3.7.0` | Đã dùng qua cn() |
| CSS animation | `tw-animate-css@1.4.0` | Đã import CSS; không bắt buộc animation |
| Server state | `@tanstack/react-query@5.107.1` | Provider có sẵn; chưa chuyển resource riêng |
| Motion | `motion@14.14.0` | Provider reducedMotion=user có sẵn |
| Toast | `sonner@2.0.8` | Toaster có sẵn; chưa đổi các consumer cũ |
| Date | `date-fns@4.4.0` | Để consumer Booking/Matchmaking |
| Effect | `canvas-confetti@1.9.4` | Tùy chọn ở màn kết quả tương lai |
| Chart | `recharts@3.10.1` | Để dashboard có dữ liệu thật |
| Chart peer | `react-is@19.3.0` | Đã căn khớp React |

- shadcn phân phối source component; `components.json` sẵn sàng, chưa có `components/ui/` là đúng phạm vi D00.
- Node kiểm tra: 22.23.5; npm 10.9.9; Chrome headless 157.0.8103.78.
- Không đưa dữ liệu riêng vào Query ở D00; retry/cancel/cache lifecycle hoàn chỉnh phải làm trước batch đầu thực sự dùng Query cho resource riêng.

### 13.4 Kết quả kiểm chứng trước/sau

| Kiểm tra | Trước | Sau D00 | Kết luận |
| --- | --- | --- | --- |
| TypeScript app (`tsc -p tsconfig.app.json --noEmit`, build info trong /tmp) | PASS | PASS | Không lỗi type mới |
| TypeScript Vite config (`tsc -p tsconfig.node.json --noEmit`) | PASS | PASS | Alias/config hợp lệ |
| Production Vite build (`--configLoader runner`, output /tmp) | PASS | PASS | Đúng bước bundle production; không tạo dist trong repository |
| `npm run lint` | Exit 0, 31 warnings | Exit 0, đúng 31 warnings | So sánh diagnostic theo file/rule: không warning mới; không gọi lint sạch |
| Browser smoke, 6 route × 2 viewport | 12/12 PASS | 12/12 PASS | Không pageerror JS, không API fixture thiếu, không tràn ngang; brand token đúng |

Routes: `/sign-in`, `/register`, `/change-password`, `/` (Player), `/owner`, `/admin/users`; viewport 1280×900 và 390×900. Kiểm tra heading thực, auth/role fixture, load profile/owner/admin list, focus input Auth và chụp ảnh toàn trang. CSS và JS build assets trước/sau byte-identical: CSS 94,69 kB, JS 867,36 kB (gzip 227,36 kB). Bundle >500 kB là warning có trước, không xử lý bằng refactor toàn ứng dụng trong D00.

Ảnh 11/12 trường hợp byte-identical trước/sau. Ảnh Player mobile khác vị trí bubble chat tại thời điểm capture; đã xem thủ công hai ảnh, không có mất nội dung hoặc tràn ngang. Không coi đây là bộ kiểm thử pixel-perfect hoặc bằng chứng đã hoàn thành Messaging.

**Giới hạn:** đây là smoke UI trên production assets với REST/WebSocket mô phỏng, external fonts/network bị chặn để chạy cục bộ. Không dùng account/database thật, không kiểm chứng live auth/session/payment, không chạy backend tests hoặc full Playwright suite. Không tuyên bố kiểm tra Safari/Firefox hoặc toàn bộ accessibility. Chính sách state/auth phía server không thay đổi.

Artifacts và log tạm: `/tmp/badminton-d00.EA4Krh/{baseline,after}/`; script smoke: `/tmp/badminton-d00.EA4Krh/smoke.cjs`; checker: `/tmp/badminton-d00.EA4Krh/check.py`. Các file /tmp là evidence của phiên kiểm tra, không được commit và có thể bị hệ thống dọn.

### 13.5 Còn lại và đề xuất D01

- Còn 31 lint warnings và warning bundle lớn từ trước; giữ làm backlog theo feature, không sửa tràn sang D01.
- Trang hiện có vẫn dùng component/CSS legacy. D01 chỉ tạo Button/Input/Label/Alert cần dùng, chốt mẫu Sign-in desktop/mobile rồi chuyển `/sign-in`.
- D01 giữ `useAuth().signIn`, API/CSRF, redirect theo role/`from`, forced password và lỗi đăng nhập; không chuyển Register/Change-password, shell hoặc Query resources.
- Chưa tạo commit. Nếu người dùng yêu cầu commit, nội dung đề xuất: `chore(frontend): verify UI foundation and document staged migration` — không thêm dòng tác giả/co-author.
- Điểm dừng D00 đã được người dùng xác nhận tiếp tục. Điểm dừng hiện tại là review D01 ở §14; không tự thực hiện D02.

## 14. Bàn giao D01 — Trang đăng nhập (17/11/2026)

### 14.1 Trạng thái và phạm vi

- Người dùng xác nhận bắt đầu D01 trong hội thoại sau khi review D00.
- **D00 DONE; D01 AWAITING_REVIEW; D02–D23 NOT_STARTED.** D01-01–05 đã thực hiện, chờ review chung của người dùng; chưa tự đánh dấu DONE hoặc bắt đầu D02.
- Chỉ `/sign-in` được chuyển giao diện. Không sửa Register/Change-password, AuthLayout cũ, auth API/provider, HTTP client, router, global CSS, dependencies hoặc backend trong D01. Đã đối chiếu hash các file này với snapshot đầu đợt.

### 14.2 Kết quả giao diện và implementation

| Phần | Thay đổi |
| --- | --- |
| Layout Sign-in | Layout riêng opt-in, desktop hai cột với panel xanh/họa tiết sân SVG; mobile/tablet ưu tiên form một cột. Giữ thương hiệu xanh/Inter/token chung, không thêm ảnh hoặc số liệu quảng bá giả |
| Primitive dùng thực tế | `components/ui/button.tsx`, `button-variants.ts`, `input.tsx`, `label.tsx`, `alert.tsx`; pattern shadcn/Radix do project sở hữu, Radix Slot/Label và CVA/cn đã cài. Không tạo UI kit ngoài consumer |
| Form | `sign-in-form.tsx`, React Hook Form + Zod; trim email, giữ nguyên password, không áp password policy đăng ký vào đăng nhập. Label/autocomplete/error association, keyboard toggle và reduced-motion loader |
| Xử lý gửi | `use-sign-in-form.ts` gọi `useAuth().signIn` như cũ; chặn cả chu kỳ validation/submission để không gửi lặp; không dùng Query hoặc mutation auto-retry |
| Phản hồi lỗi | `sign-in-errors.ts` map code sang tiếng Việt; feedback được focus; lockout có thời gian nếu hợp lệ, field errors gắn trường; không hiển thị raw server message ở fallback |
| Redirect/session | Giữ role home, `from` hợp role, forced password change và thông báo phiên hết hạn. Không lưu password/token vào storage |
| CSS cũ | Không xóa `.auth-*` vì Register/Change-password còn consumer. Source stylesheet không thay đổi trong D01; production CSS có thêm utilities từ component mới |

### 14.3 Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build --prefix frontend` | PASS (TypeScript build + Vite production) |
| `npm run lint --prefix frontend` | Exit 0; đúng 31 diagnostic cũ, không thêm warning ở code mới |
| `npx playwright test --config playwright.sign-in.config.ts` trong frontend | **22/22 PASS** |
| Production smoke 6 route × viewport 390/1280 | **12/12 PASS**, không pageerror JS hoặc tràn ngang |
| Scope/hash và `git diff --check` | PASS; file ngoài phạm vi nêu trên không bị sửa trong D01 |

Bộ test mới ở `frontend/e2e/sign-in-ui.spec.ts` và config `frontend/playwright.sign-in.config.ts`, vẫn dùng test root hiện có. Test bao gồm: required/format validation, keyboard focus/toggle, 5 nhóm lỗi tài khoản/server, field errors, network retry chủ động, session expiry, pending/reduced motion/gửi lặp, 3 role, email trim/password preservation/storage, forced password, `from` đúng/sai khu vực, một lần CSRF refresh, responsive 320/390/768/1280 và link Register.

Test focus bàn phím được siết thêm bằng so sánh shadow trước/sau và `:focus-visible`, đã chạy lại riêng sau khi full suite qua. Test backend cũ `sign-in.spec.ts` có assertion Player Dashboard/Sign Out khác shell hiện tại; không sửa assertion hoặc chạy seed/reset database để làm test đó pass trong D01.

Smoke production dùng lại fixture D00 với assets build mới: `/sign-in`, `/register`, `/change-password`, `/`, `/owner`, `/admin/users`. API/WebSocket được mô phỏng, không kiểm chứng session cookie/lockout/payment thật hoặc database. Dev-server có thể log proxy từ request teardown sau điều hướng Admin; không có backend/test database được khởi động bởi config này. Chưa kiểm tra Safari/Firefox hoặc chạy full backend/E2E suite.

### 14.4 Evidence, giới hạn và tác động bundle

- Ảnh mẫu: `/tmp/badminton-d01/sign-in-320.png`, `sign-in-390.png`, `sign-in-768.png`, `sign-in-1280.png`; đã xem trực tiếp desktop/mobile.
- Log: `/tmp/badminton-d01/build.log`, `lint.log`; production smoke/script: `/tmp/badminton-d01/regression/` và `/tmp/badminton-d01/regression.cjs`. File /tmp có thể bị dọn, không commit screenshot/build artifacts.
- Bundle production: JS **1.030,33 kB / gzip 279,50 kB**, CSS **107,72 kB / gzip 20,55 kB**. So với D00: JS tăng khoảng **162,97 kB / gzip 52,14 kB**, do trang bắt đầu dùng form/validation và primitive/icon mới. Cảnh báo chunk >500 kB còn; không thực hiện tối ưu route toàn ứng dụng trong D01.
- Không thêm dependency hoặc thay API. Đây là thay đổi một trang và primitive cần dùng, không đánh dấu toàn Auth hoặc toàn frontend đã chuyển xong.
- Chưa tạo commit. Nội dung đề xuất nếu người dùng yêu cầu: `feat(auth): refresh sign-in page with shared UI primitives`; không thêm dòng tác giả/co-author.

### 14.5 Đề xuất D02 và điểm dừng

D02 dự kiến dùng lại primitive đã có để chuyển riêng `/change-password` và màn không đủ quyền. Trước khi làm sẽ xác định phạm vi file/mẫu, giữ current-password/new-password validation, forced/self-service flow, sign-out và permission guard. Không chuyển Register/khảo sát, Player shell hoặc các feature khác cùng lượt.

**Dừng sau bàn giao D01. Chờ người dùng review giao diện/kết quả và xác nhận bắt đầu D02; không tự chuyển giai đoạn.**

## 15. Review lỗi chạy local sau D01 — 17/11/2026

### 15.1 Lỗi quan sát và nguyên nhân

Ảnh terminal của người dùng cho thấy backend dừng tại validation:
`PRIVATE_UPLOADS_DIR must be an existing directory`; sau đó Vite báo
`ECONNREFUSED 127.0.0.1:3000` khi proxy `/api/v1/auth/me`.

Kiểm tra thực tế: `backend/.env` (ignored) còn trỏ root uploads ở đường dẫn cũ
`/home/taidangdev/Projects/university/senior/TLCN/badminton-platform/private-uploads`,
trong khi dữ liệu đã ở `/home/taidangdev/code/uni/tlcn-badminton/private-uploads`.
Container PostgreSQL `badminton_postgres` đang Exited, gắn volume hiện có
`badminton-platform_postgres_data`; đường dẫn repo mới có Compose project name khác.
Không có thay đổi backend source trong D01 gây ra validation này.

Kiểm chứng D00/D01 trước đó chủ yếu là build/type/lint và browser API fixtures.
Việc này không phát hiện cấu hình local stale hoặc database đang dừng. Thiếu sót
là chưa xác minh runtime backend thật trước khi hướng dẫn người dùng chạy dự án.

### 15.2 Khắc phục và bằng chứng thật

- Chỉ sửa giá trị `PRIVATE_UPLOADS_DIR` trong `backend/.env` về root dữ liệu mới
  đang tồn tại. Không đổi pepper, credentials, migration, source backend hoặc
  nới lỏng validation/private-media containment.
- Chạy `docker start badminton_postgres`, tái dùng container/volume cũ; không
  reset, migrate hoặc seed database.
- Validation môi trường backend: PASS. Kết nối PostgreSQL `badminton_db`: PASS;
  xác nhận các bảng `users`, `auth_sessions` tồn tại bằng truy vấn chỉ đọc.
- Chạy backend thật bằng `npm run dev --prefix backend`: khởi động thành công
  cổng 3000. `GET /health` trả 200.
- `GET /api/v1/auth/me` trực tiếp và qua Vite 5173 cùng trả 401
  `AUTH_SESSION_INVALID`, đúng trạng thái chưa có session; không còn connection refused
  trong lúc backend kiểm tra đang chạy. `/sign-in` trả HTML 200.
- Đã dừng **tiến trình backend kiểm tra do agent tạo** để không chiếm cổng khi
  người dùng khởi động lại root dev; giữ PostgreSQL chạy. Không dừng frontend của
  người dùng. Cần Ctrl+C ở terminal dev cũ, rồi chạy lại `npm run dev` từ repo mới.
- README bổ sung hướng dẫn đường dẫn private uploads sau khi di chuyển repo và
  cách tái dùng container hiện có. Đây là sửa cấu hình local/hướng dẫn khởi động,
  tách khỏi scope implementation giao diện D01.

### 15.3 Ranh giới và phần chưa kiểm chứng

D01 sửa SignInPage, thêm 4 helper/layout/form cho Sign-in, 4 UI primitives (Button,
Input, Label, Alert) cùng helper button variants, 2 file test/config và 3 tài liệu.
Không sửa AuthLayout/Register/Change-password, auth API/provider, HTTP client,
router, source global CSS, dependencies hoặc source backend trong D01; xem §14.
Những thay đổi foundation/global CSS/providers/config/dependencies đã có từ trước
D01 và D00 không được tính thành thay đổi trang đăng nhập.

Bổ sung này xác minh startup, kết nối DB và request auth ẩn danh thật, **chưa xác
minh đăng nhập thành công bằng tài khoản/database thật**. Không coi 22 test API
fixtures là live auth E2E. D01 vẫn AWAITING_REVIEW; không bắt đầu D02, không commit.

## 16. Review thiết kế D01 — 18/11/2026

**D01 vẫn AWAITING_REVIEW; D02–D23 NOT_STARTED.** Người dùng yêu cầu cải thiện cảm giác thị giác và tương tác của đăng nhập trước khi nghiệm thu D01. Điểm tiếp tục hiện tại là duyệt thiết kế và hoàn thiện D01, chưa bắt đầu D02 được đề xuất ở §14.5.

- Đã tạo bản mẫu độc lập gồm đăng nhập, bước khảo sát kỹ thuật và kết quả tại `docs/design/smashpro-auth-v1/`. Người dùng đánh giá khảo sát/kết quả khá phù hợp; đăng nhập chưa đủ ấn tượng và ảnh người chơi không phù hợp.
- Theo phản hồi, tạo [bản mẫu v2](../../../design/smashpro-auth-v2/README.md): sân phối cảnh, vợt/cầu bằng SVG và CSS, ánh sáng/bóng và phản hồi nhẹ theo chuột; bỏ ảnh người chơi trong bản mới. Giữ hướng bố cục và tương tác khảo sát/kết quả. V1 được giữ để đối chiếu.
- Prototype v2 đã kiểm tra 18 lượt hiển thị (3 màn × 6 chiều rộng), tương tác form/khảo sát, phản hồi chuột và reduced motion; chi tiết và giới hạn trong README của v2. Kết quả khảo sát là dữ liệu minh họa cố định, không phải tính điểm thật.
- **Thiết kế v2: AWAITING_REVIEW. Tích hợp thiết kế mới vào React: NOT_STARTED.** Không thay source ứng dụng, auth/session/CSRF, backend, dependencies hoặc dữ liệu. Không commit/push.
- Sau khi người dùng duyệt thiết kế: chỉ chuyển phần trình bày đăng nhập D01, giữ nguyên hành vi xác thực và kiểm chứng liên quan. Báo cáo rồi dừng review. Khảo sát thật vẫn dành cho nhánh `feat/skill-survey` sau đợt UI refactor theo yêu cầu người dùng; không triển khai chỉ vì đã có bản mẫu.

## 17. Bàn giao tích hợp v2 và cleanup D01 — 18/11/2026

### 17.1 Phạm vi và trạng thái

- Người dùng chốt mẫu v2 và yêu cầu áp dụng, đồng thời xác nhận quy tắc cleanup/kiến trúc dùng chung. Quy tắc áp dụng mọi đợt đã được thêm vào **§6.7**, `frontend.md`, `conventions.md` và hướng dẫn agent. Các tài liệu trỏ đúng vị trí kế hoạch mới `plans/refactor_FE_add_lib/`.
- **D00 DONE; thiết kế D01-01 DONE; D01 AWAITING_REVIEW; D02–D23 NOT_STARTED.** Không bắt đầu khảo sát thật hoặc D02.
- Chỉ trang đăng nhập được tích hợp. Register, Change-password, Access-denied, AuthProvider/auth API/HTTP client, router, package/lockfile, database và backend source không bị đổi trong đợt này.

### 17.2 Implementation và phân chia trách nhiệm

| Phần | Vị trí / thay đổi |
| --- | --- |
| Trang đăng nhập | `features/auth/sign-in-page.tsx`, `sign-in-layout.tsx`, `sign-in-form.tsx`: bố cục v2, form, link đăng ký và các trạng thái thật |
| Hero riêng của Auth | `features/auth/sign-in-hero.tsx`: phối cảnh sân, vợt/cầu, nhãn trang trí; Motion `LazyMotion/domAnimation` + `m.img` |
| Asset sản phẩm | `src/assets/illustrations/badminton-court.svg`: bản SVG riêng trong source, không import prototype CSS/HTML hoặc phụ thuộc server 5181 |
| UI dùng chung | `components/common/brand-logo.tsx`; `labeled-input.tsx` gộp nhãn, icon, mô tả lỗi và Input/Label; không chứa API, RHF registration hoặc quy tắc auth |
| Primitive | Cập nhật Input; thêm Button variant `brand` và size `comfortable` bằng CVA; dùng Radix Slot/Label và `cn()` sẵn có |
| Hook dùng chung | `shared/hooks/use-pointer-parallax.ts`, `use-media-query.ts`: Motion values/springs, đăng ký media-query changes, không React state theo từng frame; tắt với touch/reduced motion, kể cả thay đổi preference lúc đang mở trang |
| Token | Thêm palette/shadow/radius trong `@theme` của `index.css`; trang mới opt-in, không đổi giá trị token cũ hoặc thêm selector/reset legacy |

Email/password vẫn do RHF/Zod và `use-sign-in-form.ts` quản lý như trước; giữ trim email, giữ nguyên password, chặn submit lặp, role/from/forced-password redirects và CSRF refresh một lần. Link “Tạo tài khoản” vẫn tới `/register` hiện có, không mở wizard prototype. Không thêm ảnh người chơi, Query mutation hoặc hiệu ứng thành công giả.

### 17.3 Code/CSS đã bỏ và phần giữ lại

- Xóa CourtIllustration và bố cục Sign-in D01 đầu tiên bằng cách thay file hiện có, không giữ implementation dự phòng hay import CSS của prototype.
- Loại markup nhãn/icon/input/lỗi lặp lại ở hai trường nhập; dùng `LabeledInput`. Bỏ import Input/Label trực tiếp ở feature form và SUPPORT_CONTACT ở presentation page. SUPPORT_CONTACT vẫn được giữ trong error mapping vì tài khoản bị hạn chế cần thông tin hỗ trợ.
- Xóa selector `.auth-support` (không còn consumer). Đối chiếu hash `index.css` sau khi đảo ngược đúng phần token/comment mới và selector vừa bỏ khớp baseline: các rule legacy còn lại không bị chỉnh.
- Giữ AuthLayout/AuthAlert, private brand cũ và các rule `auth-*` đang dùng bởi Register/Change-password/Access-denied. Các selector `auth-alert-error/warning/success/info` được ghép động, không phải CSS chết. Không xóa theo kết quả tìm kiếm literal đơn thuần.
- Màn mới không dùng class `.auth-*`; CSS giao diện mới là Tailwind utilities, token chung, SVG asset và Motion style values. Không thêm file CSS riêng hoặc `!important` để đè legacy.
- Giữ bản mẫu v1/v2 và ảnh trong `docs/design` làm hồ sơ thiết kế, không đưa các tài nguyên đó vào runtime bundle.

### 17.4 Kiểm chứng thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` | PASS, gồm TypeScript và production Vite build |
| `npm run lint` | PASS exit 0; đúng 31 diagnostic baseline, không phát sinh warning mới |
| `npx playwright test --config playwright.sign-in.config.ts` | **31/31 PASS**, API fixtures, không seed/reset DB |
| Responsive Sign-in và link tới Register | 320, 390, 768, 1024, 1280, 1440, 1920 px; không tràn ngang; có kiểm tra thứ tự hình/chữ trên desktop |
| Luồng auth | 3 role; from hợp lệ/sai role; forced-password; input validation; 5 API error mappings; network/manual retry; session expiry; pending/duplicate; CSRF refresh một lần |
| Tương tác/a11y liên quan | Nhãn/lỗi/focus bàn phím; hiện/ẩn password; pointer reset; live reduced-motion changes; cảm ứng không bật parallax |
| Consumer legacy | Register qua 7 chiều rộng; Change-password và Access-denied ở 390/1280 px vẫn render, không tràn ngang |
| Runtime thật | `/sign-in` cổng 5173 và backend `/health` cổng 3000 trả 200; mở trang ẩn danh, xem ảnh desktop/mobile thực tế, không nhập/gửi credentials |

Ảnh runtime: [desktop](evidence/d01-v2/sign-in-desktop.png), [mobile](evidence/d01-v2/sign-in-mobile.png). Log/snapshot tạm: `/tmp/smashpro-d01-v2/` (có thể bị hệ thống dọn). Build artifacts là output ignored, không commit.

Bundle hiện tại: JS **1.125,10 kB / gzip 313,06 kB**, CSS **121,54 kB / gzip 22,64 kB**, SVG **6,82 kB / gzip 2,12 kB**. So với lần bàn giao D01 trước v2 (§14): JS tăng 94,77 kB / gzip 33,56 kB, CSS tăng 13,82 kB. Warning chunk >500 kB còn; đã dùng subset LazyMotion cho hero, không mở rộng thành tối ưu router/bundle toàn ứng dụng.

**Giới hạn:** 31 bài kiểm tra dùng API mô phỏng. Runtime thật mới kiểm tra health và render ẩn danh; chưa xác minh đăng nhập thành công bằng tài khoản/database thật, Safari/Firefox hoặc WCAG đầy đủ. Các check của D00/D01 trước vẫn là nhật ký lịch sử, không được coi là chạy lại trong lần này.

### 17.5 Điểm dừng và đề xuất tiếp theo

Dừng chờ người dùng review trang `/sign-in` đã tích hợp. Chưa commit/push. Sau khi nghiệm thu D01, D02 đề xuất chuyển riêng Change-password và Access-denied, dùng lại primitive/field phù hợp và dọn legacy theo consumer. Không chuyển Register/khảo sát hoặc toàn bộ shell cùng D02; cần xác nhận riêng trước khi bắt đầu.

## 18. Sửa cuối và nghiệm thu D01 — 18/11/2026

Người dùng xác nhận đóng D01 sau review code và cho bắt đầu D02. Các điểm review được xử lý như sau:

| Điểm review | Kết quả |
| --- | --- |
| Chữ 8–10 px khó đọc | Theo lựa chọn của người dùng: chữ mang thông tin tối thiểu 12 px (mô tả hero, nhãn lợi ích, hai badge trên hình sân, footer); chữ trang trí in hoa tối thiểu 11 px (hai eyebrow) |
| Khẩu hiệu lặp lại | Theo lựa chọn của người dùng: bỏ tagline cuối thẻ “GẶP ĐỒNG ĐỘI. CHUNG NIỀM VUI.” và câu footer phải “Gặp nhau trên sân. Gắn kết ngoài sân.”; giữ khẩu hiệu hero, mô tả dưới tiêu đề và dòng cuối form |
| Giờ mở khóa theo múi giờ trình duyệt | Định dạng theo `Asia/Ho_Chi_Minh`; có test chạy với trình duyệt ở múi giờ New York |
| `h2` của hero đứng trước `h1` | Khẩu hiệu hero đổi thành `p` (`data-slot="hero-title"`), giao diện không đổi; `h1` “Đăng nhập.” là heading đầu tiên |
| Lỗi giống nhau lặp lại không được focus lại | **Không phải lỗi**: `setError(null)` render trước khi gọi API nên alert được mount lại. Thêm test chống hồi quy, không sửa code |

Kiểm chứng: `npm run build` PASS (JS 1.124,78 kB / gzip 312,97 kB; CSS 121,19 kB); `npm run lint` exit 0 với đúng 31 warning cũ; `npx playwright test --config playwright.sign-in.config.ts` **34/34 PASS** (thêm 3 test). Ảnh sau sửa: [desktop 1440](evidence/d01-final/sign-in-1440.png), [mobile 390](evidence/d01-final/sign-in-390.png).

Giới hạn giữ nguyên như §17.4: test dùng API mô phỏng, chưa kiểm chứng đăng nhập thành công bằng database thật. Test cũ `e2e/sign-in.spec.ts` vẫn có assertion lệch shell hiện tại; để backlog, không sửa trong D01.
