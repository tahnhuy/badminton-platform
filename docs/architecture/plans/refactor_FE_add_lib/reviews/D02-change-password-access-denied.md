# D02 — Đổi mật khẩu và màn không đủ quyền: rà soát trước khi triển khai

- Ngày: 18/11/2026. Trạng thái rà soát: đã chốt hướng; triển khai và bàn giao ở history §19.
- Route: `/change-password` (tự đổi và bắt buộc đổi), màn Access-denied do `RequireAuth` hiển thị tại route bị chặn, màn chờ phiên `Loading session...` của cùng guard.
- Môi trường: Vite dev cổng 5198, mọi API được mô phỏng bằng Playwright. Backend thật đang chạy nhưng không đăng nhập được: các tài khoản demo trong README (`social.demo.*`) không có trong database local, mật khẩu các tài khoản còn lại không được biết; không seed database theo §6.8. Hai màn này chỉ phụ thuộc `/auth/me` và `/auth/password/change`, nên giao diện mô phỏng phản ánh đúng UI hiện có.
- Role đã xem: PLAYER (tự đổi, bắt buộc đổi), COURT_OWNER và ADMIN (bị chặn).
- Ảnh và số đo: [`evidence/D02-before/`](../evidence/D02-before/), số đo trong `notes.txt`.

## 1. Hiện trạng

| Màn | Ảnh | Ghi chú |
| --- | --- | --- |
| Bắt buộc đổi, 1280/390 | [1280](../evidence/D02-before/mock-forced-1280.png), [390](../evidence/D02-before/mock-forced-390.png) | Dùng `AuthLayout` cũ: panel xanh quảng bá bên trái, thẻ form bên phải |
| Sai mật khẩu hiện tại, 1280/390 | [1280](../evidence/D02-before/mock-wrong-current-1280.png), [390](../evidence/D02-before/mock-wrong-current-390.png) | Banner lỗi và lỗi dưới trường cùng nội dung |
| Vi phạm quy định mật khẩu | [1280](../evidence/D02-before/mock-policy-1280.png) | Mật khẩu 7 ký tự vẫn được gửi lên server |
| Lỗi server khác | [1280](../evidence/D02-before/mock-server-error-1280.png) | Hiện nguyên văn message của server |
| Đang gửi / thành công | [đang gửi](../evidence/D02-before/mock-submitting-1280.png), [thành công](../evidence/D02-before/mock-success-1280.png) | Thành công: thông báo inline, 1 giây sau về trang chủ của role |
| Focus bàn phím | [1280](../evidence/D02-before/mock-keyboard-focus-1280.png) | Input có viền xanh + vòng 3 px; nút có outline 2 px |
| Không đủ quyền, Court Owner 1280/390 | [1280](../evidence/D02-before/mock-denied-court_owner-1280.png), [390](../evidence/D02-before/mock-denied-court_owner-390.png) | Thẻ giữa màn hình, chữ tiếng Anh |
| Không đủ quyền, Admin vào khu Player | [1280](../evidence/D02-before/mock-denied-admin-1280.png), [390](../evidence/D02-before/mock-denied-admin-390.png) | Như trên |
| Đang tải phiên | [1280](../evidence/D02-before/mock-session-loading-1280.png) | Chữ `Loading session...` font hệ thống, không thương hiệu |

Không tràn ngang ở 390, 768, 1280 px.

## 2. Hành vi phải giữ nguyên

Nguồn: Auth PRD §6.9, §7.5, §7.6, §7.8, Decision #8/#17/#18; Tech Design §7 (password change), bảng mã lỗi, §15; code `change-password-page.tsx`, `access-denied-page.tsx`, `require-auth.tsx`; E2E `forced-password-change.spec.ts`, `role-based-denial.spec.ts`, `sign-in-ui.spec.ts`.

1. Gọi `useAuth().changePassword({ currentPassword, newPassword })` → `POST /api/v1/auth/password/change`; không đổi API, CSRF hoặc rate limit.
2. Quy định mật khẩu mới do server quyết định: 8–64 ký tự (sau chuẩn hóa NFKC), không trùng email (không phân biệt hoa thường). Không có quy tắc về loại ký tự.
3. Mã lỗi: `AUTH_CURRENT_PASSWORD_INCORRECT`, `AUTH_PASSWORD_POLICY_VIOLATION`, `AUTH_RATE_LIMITED`, `VALIDATION_FAILED`. Sai mật khẩu hiện tại không tính vào khóa đăng nhập.
4. Bắt buộc đổi: mọi route khác chuyển về `/change-password`; chỉ trang này và đăng xuất dùng được; không có nút thoát khác. Hoàn tất thì về trang chủ của role.
5. Tự đổi: người dùng vẫn đăng nhập; phiên khác không bị thu hồi.
6. Quy định mật khẩu phải hiển thị trên form; mật khẩu luôn bị che khi nhập và không bao giờ hiện lại từ server.
7. Access-denied hiển thị tại URL bị chặn, không chuyển về `/sign-in`; có lối về trang chủ của role và đăng xuất. Backend vẫn là nơi quyết định quyền.
8. E2E hiện dựa vào `#currentPassword`, `#newPassword`, nút “Cập nhật mật khẩu”, tiêu đề “Bắt buộc đổi mật khẩu”/“Đổi mật khẩu” và chữ “Access Denied”. Đổi chữ có chủ đích thì cập nhật assertion theo, không xóa kiểm tra.

## 3. Nhận xét từ góc độ người dùng

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| U1 | P1 | Trong đợt | ảnh denied | Màn không đủ quyền toàn tiếng Anh (“Access Denied”, “Go to Your Home”, “Sign Out”) trong khi cả app tiếng Việt; vai trò hiện mã kỹ thuật `COURT_OWNER` | Viết lại tiếng Việt; hiện tên vai trò thân thiện (Người chơi / Chủ sân / Quản trị viên); nói rõ trang này dành cho ai và nên làm gì tiếp |
| U2 | P1 | Trong đợt | `change-password-page.tsx:74`, ảnh server-error | Lỗi không xác định hiện nguyên văn message của server, có thể lộ chi tiết nội bộ, không nhất quán với Sign-in | Map theo mã lỗi; lỗi khác dùng câu chung “Không thể đổi mật khẩu lúc này. Vui lòng thử lại.” |
| U3 | P2 | Trong đợt | notes: 1 request khi để trống/7 ký tự | Không kiểm tra phía client: để trống hay quá ngắn vẫn phải chờ server trả lỗi | RHF + Zod: bắt buộc nhập, 8–64 ký tự, không trùng email; server vẫn là chuẩn |
| U4 | P2 | Cần chốt | — | Chỉ nhập mật khẩu mới một lần. Dự án không có “quên mật khẩu” tự phục vụ (phải liên hệ hỗ trợ), nên gõ nhầm rất tốn công | Đề xuất thêm ô “Nhập lại mật khẩu mới” (chỉ kiểm tra phía client, không đổi API) — **cần bạn chốt** |
| U5 | P2 | Cần chốt | ảnh 1280 | Người đang dùng app bấm “Đổi mật khẩu” bị đưa sang màn hình kiểu trang đăng nhập có panel quảng bá; không có nút quay lại, chỉ có “Đăng xuất” | Tự đổi cần lối “Quay lại”; bắt buộc đổi giữ không có lối thoát ngoài đăng xuất. Bố cục — **cần bạn chốt** (mục 6) |
| U6 | P2 | Trong đợt | `change-password-page.tsx:147,179` | Nút hiện/ẩn mật khẩu có `tabIndex={-1}`, người dùng bàn phím không bật được | Dùng lại nút toggle của Sign-in (Tab tới được, `aria-pressed`) |
| U7 | P3 | Cần chốt | ảnh success | Thành công thì luôn về trang chủ role sau 1 giây, kể cả khi người dùng vào từ trang hồ sơ | Tự đổi: quay lại trang trước + toast; bắt buộc đổi: giữ về trang chủ role — **cần bạn chốt** |
| U8 | P3 | Trong đợt | ảnh wrong-current | Cùng một lỗi lặp hai lần (banner + dưới trường) | Lỗi theo trường chỉ hiện dưới trường; banner dành cho lỗi chung (rate limit, mạng, server) |
| U9 | P3 | Trong đợt | ảnh session-loading | Màn chờ `Loading session...` tiếng Anh, trống trơn | Spinner nhỏ + logo + “Đang tải phiên đăng nhập…”, tôn trọng reduced motion |

## 4. Nhận xét từ góc độ thiết kế giao diện

| ID | Mức | Phạm vi | Bằng chứng | Nhận xét | Hướng sửa |
| --- | --- | --- | --- | --- | --- |
| D1 | P1 | Trong đợt | `auth-layout.tsx:59-65` | Panel trái có số liệu quảng bá dựng sẵn “1,200+ Người chơi · 45+ Sân” và mô tả giải đấu/bracket chưa có. Trái nguyên tắc không dựng số liệu giả; panel tiếp thị cũng không hợp với người đã đăng nhập | Change-password không dùng `AuthLayout` nữa. Panel vẫn còn ở Register; ghi backlog cho đợt Register, không sửa trong D02 |
| D2 | P2 | Trong đợt | so với ảnh D01 | Hai ngôn ngữ hình ảnh: Sign-in v2 (nền `brand-page`, logo mới, input `brand-soft`, nút `brand`) và màn cũ (gradient xanh, logo “BADMINTON ECOSYSTEM”, input trắng). Người dùng đi từ Sign-in sang đổi mật khẩu bắt buộc thấy như hai sản phẩm | Dùng chung token, `BrandLogo`, `LabeledInput`, `Button` variant `brand` và `Alert` của D01 |
| D3 | P2 | Trong đợt | ảnh 1280 | Hộp “Quy định mật khẩu” màu xanh dương nhạt lạc tông với palette xanh lá; nhiều khối viền nối tiếp (cảnh báo, quy định, lỗi) làm form nặng | Quy định thành checklist nhỏ ngay dưới ô mật khẩu mới (mục 6, Q3); cảnh báo bắt buộc đổi giữ một khối `warning` |
| D4 | P2 | Trong đợt | `access-denied-page.tsx:6` | Icon khiên có dấu tích (`CheckShieldIcon`) mang nghĩa “an toàn/đã xác minh”, ngược với “bị chặn” | Icon lucide `ShieldAlert` hoặc `Lock` |
| D5 | P2 | Trong đợt | ảnh denied 390 | Mobile: thẻ dính sát đầu trang, 2/3 màn hình trống; không logo, không ngữ cảnh | Bố cục canh giữa theo chiều dọc, có logo; nút xếp dọc full-width trên mobile |
| D6 | P3 | Trong đợt | ảnh 1280 | Placeholder `••••••••` trông như ô đã điền sẵn | Placeholder bằng chữ (“Nhập mật khẩu hiện tại”) như Sign-in |
| D7 | P3 | Trong đợt | `access-denied-page.tsx` | Inline style; hai nút cùng trọng lượng thị giác | Tailwind; nút chính “Về trang của bạn”, đăng xuất là nút phụ/ghost |
| D8 | P3 | Trong đợt | ảnh forced lần đầu | Thẻ có hiệu ứng fade 0,2 s từ CSS cũ | Bỏ cùng CSS cũ; nếu cần chuyển động thì dùng Motion có reduced motion |

## 5. Lỗi/khoảng trống chức năng phát hiện

| ID | Phạm vi | Nội dung | Đề xuất |
| --- | --- | --- | --- |
| F1 | Trong đợt | Lỗi theo trường không có `aria-invalid`/`aria-describedby`; sau lỗi focus rơi về `body` (notes) | `LabeledInput` đã xử lý; focus banner lỗi hoặc trường lỗi đầu tiên |
| F2 | Trong đợt | `VALIDATION_FAILED` ghi đè bằng “Dữ liệu không hợp lệ” cho mọi trường | Gắn thông điệp cụ thể theo trường |
| F3 | Cần chốt | Admin không có lối vào “Đổi mật khẩu” (Player có ở header/sidebar, Owner ở trang tài khoản). PRD: “Change Password is reachable from a signed-in area at all times” | Thêm link trong Admin header là sửa Admin shell (thuộc D18). **Cần bạn chốt**: làm nhỏ trong D02 hay ghi backlog |
| F4 | Cần quyết định nghiệp vụ | Mật khẩu mới trùng mật khẩu hiện tại vẫn được chấp nhận (policy không cấm) | Không tự thêm quy tắc; chỉ ghi nhận để PO quyết định |
| F5 | Ngoài đợt | Test cũ `forced-password-change.spec.ts` chờ heading “Player Dashboard” không còn tồn tại; `sign-in.spec.ts` tương tự | Cập nhật assertion khi đụng tới test này trong D02; chạy cần test database |

## 6. Hướng đề xuất tổng thể và phương án

**Hướng chung (khuyến nghị):** cả ba màn dùng một **layout tập trung** mới trong `features/auth/` có cùng tinh thần Sign-in v2 (nền `brand-page`, `BrandLogo`, thẻ trắng bo `radius-brand`), không có panel quảng bá. Form dùng RHF + Zod, `LabeledInput`, toggle mật khẩu dùng chung. Access-denied và màn chờ phiên dùng cùng layout.

Các lựa chọn cần chốt:

- **Q1 — Bố cục trang tự đổi mật khẩu.**
  A. *(khuyến nghị)* Trang tập trung độc lập cho cả hai chế độ: tự đổi có nút “Quay lại”, bắt buộc đổi thì không. Không đụng shell của 3 role.
  B. Tự đổi nằm trong shell của từng role (giữ header/sidebar), bắt buộc đổi vẫn độc lập. Đúng ngữ cảnh hơn nhưng phải sửa router và 3 shell còn legacy → vượt phạm vi D02.
  C. Giữ bố cục hai cột hiện tại, chỉ đổi skin và bỏ số liệu giả.
- **Q2 — Ô nhập lại mật khẩu mới.** Có *(khuyến nghị)* / Không.
- **Q3 — Hiển thị quy định mật khẩu.** Checklist trực tiếp dưới ô mật khẩu mới, tích xanh khi đạt *(khuyến nghị)* / Hộp quy định tĩnh như cũ.
- **Q4 — Sau khi tự đổi thành công.** Quay lại trang trước + toast *(khuyến nghị)* / Giữ hành vi cũ (inline + về trang chủ role). Bắt buộc đổi luôn về trang chủ role.
- **Q5 — Access-denied.** Trang tập trung độc lập có logo *(khuyến nghị)* / Hiển thị trong shell của role người dùng (cần sửa 3 shell → vượt phạm vi).
- **Q6 — Màn chờ phiên vào D02?** Có, cùng file guard và rất nhỏ *(khuyến nghị)* / Để đợt khác.
- **Q7 — Lối vào đổi mật khẩu cho Admin (F3).** Ghi backlog D18 *(khuyến nghị, giữ phạm vi)* / Thêm link nhỏ trong D02.

## 7. Dự kiến file, component, CSS legacy sẽ dọn và kiểm thử

- **Sửa/thêm:** `change-password-page.tsx` (tách `use-change-password-form.ts`, `change-password-form.tsx`, `change-password-errors.ts`), `access-denied-page.tsx`, layout tập trung mới trong `features/auth/`, phần loading của `shared/auth/require-auth.tsx`.
- **Dùng chung:** tách toggle mật khẩu của Sign-in thành `components/common/password-input.tsx` để Sign-in và đổi mật khẩu dùng chung; thêm variant `success`/`info` cho `Alert` nếu cần; thêm `Button` variant `outline` cho nút phụ.
- **Không đổi:** API, `AuthProvider`, `http-client`, router, Register, các shell.
- **CSS/icon có thể dọn (kiểm consumer trước khi xóa):** `.auth-btn-inline`, `.auth-btn-secondary`, `.auth-card-icon`, `.auth-card-icon-danger`, `.auth-alert-info`, `.auth-alert-warning` (Register chỉ dùng error/success); `KeyIcon`, `EyeIcon`, `EyeOffIcon`, `CheckShieldIcon` nếu không còn consumer. `AuthLayout`, `AuthAlert` và phần còn lại của `.auth-*` giữ cho Register.
- **Kiểm thử:** test mock mới cho đổi mật khẩu (validation, các mã lỗi, toggle bàn phím, pending, thành công, bắt buộc đổi chặn route, responsive 390/768/1280) và Access-denied (3 role, tiếng Việt, nút); cập nhật `role-based-denial.spec.ts`, `forced-password-change.spec.ts`, phần legacy trong `sign-in-ui.spec.ts`; build, lint; smoke Register.

## 8. Câu hỏi cần chốt và quyết định

Q1–Q7 ở mục 6, cộng F4 cần PO quyết định (không thuộc D02).

### Quyết định của người dùng — 18/11/2026

| Câu | Quyết định |
| --- | --- |
| Q1 | Trang tập trung độc lập cho cả hai chế độ; tự đổi có “Quay lại”, bắt buộc đổi chỉ có đăng xuất |
| Q2 | Thêm ô “Nhập lại mật khẩu mới” (chỉ kiểm tra phía client) |
| Q3 | Checklist quy định trực tiếp dưới ô mật khẩu mới |
| Q4 | **Thay đổi hành vi:** đổi thành công thì báo thành công, đăng xuất phiên trên thiết bị này và yêu cầu đăng nhập lại bằng mật khẩu mới. Áp dụng cho cả tự đổi và bắt buộc đổi. Thiết bị khác không bị đăng xuất; không sửa backend. Cập nhật Auth PRD §6.9/§7.5 và Tech Design |
| Q5 | Access-denied dùng trang tập trung, tiếng Việt, tên vai trò thân thiện, icon khóa |
| Q6 | Đưa màn chờ phiên vào D02 |
| Q7 | Đưa lối vào đổi mật khẩu cho Admin vào D02 dưới dạng **menu tài khoản** trong Admin header (email, vai trò, “Đổi mật khẩu”, “Đăng xuất”); xử lý luôn việc Admin thiếu đăng xuất (PRD §7.6). Không làm lại phần còn lại của Admin header |
| F4 | Không thêm quy tắc cấm trùng mật khẩu cũ; để PO quyết định sau |

D02 chuyển `IN_PROGRESS`, sau đó `AWAITING_REVIEW` khi bàn giao (history §19).

Hồ sơ rà soát/bàn giao cũ tham chiếu [lịch sử](../frontend-modernization-history.md); trạng thái hiện tại theo [kế hoạch chính](../frontend-modernization-review-plan.md).
