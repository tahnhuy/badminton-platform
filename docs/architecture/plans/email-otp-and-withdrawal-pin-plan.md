# Kế hoạch email OTP, khôi phục tài khoản và mã rút tiền

Ngày lập: 24/11/2026. Cập nhật sau review ngày 24/11/2026. Trạng thái: đã triển khai backend + frontend + migration `0033_email_otp_withdrawal_pin` (24/11/2026); nghiệm thu gửi thật trên staging vẫn cần thực hiện.

## 1. Mục tiêu, thuật ngữ và quyết định đã chốt

Hoàn thành xác minh email khi đăng ký, quên mật khẩu, quên mã rút tiền và admin cấp lại mật khẩu bằng chuỗi ngẫu nhiên.

Phân biệt hai loại mã:

| Loại | Vòng đời | Mục đích |
| --- | --- | --- |
| OTP email | Sinh cho từng yêu cầu, hết hạn, chỉ dùng một lần | Xác minh đăng ký hoặc cho phép đặt lại một thông tin bảo mật cụ thể |
| Mã rút tiền (giao diện có thể ghi “OTP rút tiền”) | Tạo khi đăng ký, dùng lại đến khi được đổi/cấp lại | Chỉ xác nhận yêu cầu rút tiền |

Mã rút tiền cố định thực chất là PIN, không phải mã dùng một lần. Trong code dùng tên `withdrawalPin` để tránh nhầm với OTP email. Không dùng mã rút tiền để đăng nhập, khôi phục mật khẩu hoặc xác minh email.

Quyết định đã chốt:

- Người dùng tự đặt PIN 6 chữ số và nhập xác nhận khi đăng ký. Khi quên PIN, xác minh OTP email rồi tự đặt PIN mới. Hệ thống không sinh PIN thay người dùng.
- Admin cấp lại mật khẩu bằng chuỗi do hệ thống sinh ngẫu nhiên, admin không tự chọn chuỗi đó.
- Đăng ký với email chưa có tài khoản: gửi OTP để hoàn tất đăng ký. Đăng ký với email đã có tài khoản: không tạo đăng ký tạm, không gửi mail, không đổi mật khẩu hoặc PIN của tài khoản đó; chỉ trả lỗi để giao diện hiển thị "email đã có tài khoản". Chấp nhận việc đăng ký cho biết một email đã tồn tại, giảm rủi ro bằng giới hạn tần suất ở §6.
- Không thêm thời gian chờ (cooldown) rút tiền sau khi đổi PIN hoặc mật khẩu.
- Luồng khôi phục (quên mật khẩu) không tiết lộ email có tồn tại hay không.
- Admin tạo Court Owner vẫn tự chọn mật khẩu ban đầu như hiện tại, nằm ngoài phạm vi kế hoạch này.
- Đổi mật khẩu chủ động khi đang đăng nhập phải xác minh OTP email trước khi nhập mật khẩu mới. Lần đăng nhập đầu tiên sau khi Admin cấp lại mật khẩu vẫn bắt buộc đổi nhưng không cần OTP.

## 2. Hiện trạng dự án

- Backend Express/TypeScript, PostgreSQL/Drizzle; cấu hình qua `backend/src/shared/config/env.ts`.
- `AuthService.register` hiện tạo user, profile, kết quả khảo sát và session; `AuthController.register` đặt cookie ngay. Chưa có bước chờ OTP. Email đã tồn tại trả `409 AUTH_EMAIL_ALREADY_REGISTERED`; giữ hành vi lỗi này.
- Frontend `auth-provider.tsx` đánh dấu authenticated ngay sau register; wizard chuyển sang trang kết quả trình độ.
- `users` đã có `mustChangePassword`, chưa có `emailVerifiedAt` hoặc mã rút tiền.
- Đã có luồng admin reset mật khẩu tại `AdminUserService.setUserPassword` và route `/:id/password`, hiện nhận mật khẩu do admin chọn và gọi `authService.adminSetPassword` (đặt `mustChangePassword`, thu hồi session, xóa lockout đăng nhập trong một transaction). Đổi sang mật khẩu sinh ngẫu nhiên là thay đổi hợp đồng API, không chỉ mở rộng.
- Middleware `authenticate` chặn mọi route khi `mustChangePassword` trừ `/auth/me`, `/auth/password/change`, `/auth/logout`. Các route `/wallet/*` và PIN vì vậy cũng bị chặn cho đến khi đổi mật khẩu.
- Rút tiền Player qua `/wallet/withdrawals`, Court Owner qua `/wallet/owner-payouts`, xử lý chung ở `WalletPayoutService.createRequest` trong một `db.transaction`; chưa kiểm tra mã rút tiền và chưa có khóa idempotency ở mức yêu cầu (body chỉ có `amount`, `bankAccountId`; khóa giữ tiền theo `request.id`).
- Rate limit hiện là `express-rate-limit` với `MemoryStore` (theo từng instance), không có Redis. `trust proxy` đặt bằng 1.
- Chưa có bảng audit cho hành động admin trên user; chỉ có `config-audit`.
- `passwordHasher` hiện dùng NFKC → HMAC-SHA-256(pepper) → bcrypt.
- Đã có mẫu job nền trong `backend/src/jobs/*` và mẫu `clientRequestId` (UUID) trong module social.
- `RESEND_API_KEY` và `EMAIL_FROM` có trong `backend/.env` cục bộ nhưng chưa có trong `env.ts`, `.env.example` hay `package.json` (chưa có thư viện `resend`). Việc domain Verified được người dùng xác nhận; cần nghiệm thu gửi thật khi triển khai.

## 3. Luồng nghiệp vụ

### 3.1. Đăng ký mới

1. Người dùng điền thông tin, mật khẩu, PIN rút tiền + xác nhận và khảo sát trình độ.
2. Backend kiểm tra dữ liệu. Nếu email (đã chuẩn hóa) thuộc tài khoản có sẵn: trả `409 AUTH_EMAIL_ALREADY_REGISTERED`, không tạo đăng ký tạm, không gửi mail; giao diện hiển thị "email đã có tài khoản" kèm đường dẫn tới đăng nhập/quên mật khẩu.
3. Email chưa có tài khoản: chặn PIN yếu, băm mật khẩu/PIN và lưu hồ sơ đăng ký tạm. Không lưu mật khẩu/PIN rõ, chưa tạo user hoặc session.
4. Tạo challenge và đưa thư OTP vào hàng đợi gửi (§4). Phản hồi trả challenge và thời hạn.
5. Người dùng nhập OTP. Backend kiểm tra đúng yêu cầu, mục đích, hạn dùng và số lần thử.
6. Trong một transaction: tiêu thụ OTP, tạo user với `emailVerifiedAt`, lưu PIN đã băm, profile, kết quả khảo sát và session. Nếu email đã bị đăng ký xen giữa (vi phạm unique), trả `409 AUTH_EMAIL_ALREADY_REGISTERED` và hủy đăng ký tạm.
7. Đặt cookie, frontend cập nhật đăng nhập và hiển thị kết quả trình độ như hiện tại.

Đổi email trong lúc chờ xác minh: client gửi kèm challenge cũ khi khởi tạo yêu cầu mới, backend hủy đúng challenge/đăng ký tạm đó. Không hủy theo email, vì người khác có thể đăng ký tạm cùng email và phá phiên đang nhập OTP. Cho phép nhiều đăng ký tạm cùng email; chỉ người nhận được OTP mới hoàn tất, bên đến sau gặp `409`. Giữ kết quả khảo sát đã được backend kiểm tra/tính tại thời điểm bắt đầu, không phụ thuộc việc phiên bản khảo sát đổi trong thời gian nhập OTP.

### 3.2. Quên mật khẩu

1. Nhập email tại trang quên mật khẩu.
2. Luôn trả cùng một phản hồi, gồm challenge ID, dù email có tồn tại hay không. Với email không tồn tại hoặc không đủ điều kiện, trả challenge giả không gắn thư nào và không bao giờ xác minh được. Thời gian phản hồi như nhau vì việc gửi mail chạy bất đồng bộ.
3. Điều kiện nhận OTP: tài khoản `ACTIVE` và chưa bị xóa. Không yêu cầu `emailVerifiedAt` để tài khoản cũ khôi phục được.
4. Xác minh OTP đúng mục đích `PASSWORD_RESET`. Khi tài khoản cũ hoàn thành OTP, đặt `emailVerifiedAt`.
5. Nhận quyền đặt lại ngắn hạn, chỉ dùng một lần; người dùng nhập mật khẩu mới và xác nhận.
6. Transaction cập nhật mật khẩu, tiêu thụ quyền đặt lại, vô hiệu các yêu cầu khôi phục mật khẩu còn lại, xóa lockout đăng nhập và thu hồi toàn bộ session của tài khoản (kèm đóng kết nối WebSocket nhắn tin).
7. Hiển thị trên web “Mật khẩu đã được đặt lại thành công”, yêu cầu đăng nhập lại. Không gửi email thông báo hoặc mật khẩu mới qua email. Không đổi PIN rút tiền.

### 3.3. Quên mã rút tiền và thiết lập lần đầu

1. Người dùng đăng nhập mở Ví/Bảo mật → Quên mã rút tiền (hoặc Thiết lập mã rút tiền nếu chưa có PIN). Giao diện lấy trạng thái từ `GET /wallet/withdrawal-pin`.
2. Backend lấy email từ user đang đăng nhập; không nhận email đích tùy ý từ request.
3. Gửi OTP mục đích `WITHDRAWAL_PIN_RESET` tới email tài khoản.
4. Xác minh OTP, cấp quyền đặt lại gắn với user và mục đích; người dùng nhập PIN mới + xác nhận. Khi hoàn thành OTP, đặt `emailVerifiedAt` nếu chưa có.
5. Transaction cập nhật hash PIN, xóa `failedAttempts`, `lockCount` và `lockedUntil`, tiêu thụ quyền đặt lại và vô hiệu các yêu cầu reset PIN còn lại. Việc xóa khóa chấp nhận được vì đã qua OTP email.
6. PIN cũ mất hiệu lực ngay; hiển thị trên web “Mã PIN rút tiền đã được cập nhật thành công”. Không gửi email thông báo hoặc PIN mới qua email. Không đổi mật khẩu đăng nhập.

Luồng này có thể thực hiện lại khi người dùng quên lần sau, với yêu cầu OTP mới và giới hạn tần suất. Không gửi lại mã cũ vì hệ thống chỉ lưu hash.

### 3.4. Xác nhận rút tiền

1. Người dùng chọn tài khoản ngân hàng, số tiền và nhập PIN rút tiền. Client sinh `clientRequestId` (UUID) cho mỗi lần thao tác.
2. Tra cứu `clientRequestId` của chính user trước. Nếu đã có yêu cầu cùng nội dung, trả lại yêu cầu đó, không kiểm tra lại PIN và không tăng bộ đếm. Cùng ID nhưng khác nội dung trả `409`.
3. Kiểm tra PIN và bộ đếm thử trong một transaction riêng, commit trước khi vào `createRequest`. Lý do: `createRequest` chạy trong một `db.transaction` và sẽ rollback khi ném lỗi, kéo theo việc tăng `failedAttempts` nếu nằm chung. Băm bcrypt diễn ra ngoài transaction chính và không giữ khóa user. Khi vào transaction chính, so sánh `updatedAt`/version của PIN với giá trị đã xác minh để phát hiện PIN đổi giữa chừng.
4. PIN đúng: tiếp tục quy tắc tài chính hiện có về số dư, giới hạn, giữ tiền, duyệt và chuyển khoản.
5. PIN sai/thiếu/chưa thiết lập/bị khóa: không tạo yêu cầu, không giữ hoặc trừ tiền. Trả mã lỗi riêng (`WALLET_PIN_INVALID`, `WALLET_PIN_NOT_SET`, `WALLET_PIN_LOCKED`) để giao diện dẫn người dùng đúng luồng.

Áp dụng ở service chung cho cả Player và Court Owner, tránh bỏ qua kiểm tra bằng route khác. `clientRequestId` có ràng buộc unique `(userId, clientRequestId)` trên yêu cầu rút tiền. PIN không thay thế các bước duyệt rút tiền của admin. Không yêu cầu OTP email cho mỗi lần rút tiền trong phạm vi này.

### 3.5. Admin cấp lại mật khẩu thủ công

1. Admin có quyền mở tài khoản đích và chọn Cấp lại mật khẩu; nhập lý do (bắt buộc) và xác nhận hành động.
2. Backend sinh mật khẩu tạm bằng bộ sinh ngẫu nhiên mật mã (lấy mẫu loại bỏ lệch, không dùng phép chia dư), đề xuất 20 ký tự thỏa chính sách hiện hành (`isPasswordPolicySatisfied`).
3. Băm bằng cơ chế mật khẩu hiện tại, đặt `mustChangePassword=true`, thu hồi session (kèm đóng WebSocket), xóa lockout đăng nhập và hủy các quyền reset mật khẩu cũ.
4. Ghi audit vào bảng audit hành động admin mới (admin, user đích, thời gian, lý do, kết quả); không ghi mật khẩu rõ.
5. Hiển thị mật khẩu tạm cho admin một lần trong phản hồi có `Cache-Control: no-store`; không đưa vào URL, log hoặc notification. Admin bàn giao cho chủ tài khoản qua kênh đã xác minh. Nếu phản hồi bị mất, admin cấp lại.
6. Người dùng đăng nhập bằng mật khẩu tạm phải đổi mật khẩu trước khi dùng ứng dụng, đặc biệt trước thao tác tài chính (middleware hiện có đã chặn `/wallet/*`).
7. Gửi email thông báo việc admin reset, không gửi mật khẩu tạm trong email thông báo. Giữ thông báo cho admin khác khi mục tiêu là tài khoản ADMIN như hiện tại.

Đây là ngoại lệ quản trị được người dùng yêu cầu: không cần OTP email của tài khoản đích để admin thực hiện. Quyền tác động lên tài khoản admin khác phải tuân theo chính sách phân quyền đang có. Admin reset mật khẩu không tự đặt lại PIN; vì PIN chỉ đổi được qua OTP email của chủ tài khoản, admin không thể rút tiền thay người dùng. Thay đổi hợp đồng: API `/:id/password` không còn nhận mật khẩu do admin chọn; cập nhật `admin-users.test.ts`, frontend và tài liệu.

## 4. Dữ liệu và xử lý đồng thời

- Thêm `users.emailVerifiedAt` nullable để phân biệt tài khoản đã xác minh với dữ liệu cũ.
- Bảng đăng ký tạm: ID ngẫu nhiên khó đoán, email chuẩn hóa, hash mật khẩu/PIN, thông tin cá nhân, snapshot kết quả khảo sát, hạn lưu. Không có ràng buộc unique theo email (xem §3.1).
- Bảng challenge: ID, purpose, user hoặc pending registration, email, OTP digest, generation, expiresAt, failedAttempts, lockedUntil, resendAvailableAt, consumedAt và trạng thái gửi (`PENDING_SEND`, `SENT`, `FAILED`). Challenge giả cho quên mật khẩu (§3.2) dùng cùng định dạng ID nhưng không có OTP digest.
- OTP ít entropy nên dùng HMAC với secret backend riêng, gắn ID + purpose + generation; không chỉ SHA-256 mã 6 số.
- Bảng quyền đặt lại: token ngẫu nhiên đủ mạnh, chỉ lưu hash, gắn user/challenge/purpose, expiresAt và consumedAt. Không cho token reset mật khẩu dùng để reset PIN hoặc ngược lại.
- Bảng thông tin PIN riêng: userId unique, pinHash, failedAttempts, lockCount, lockedUntil, updatedAt. Dùng lại `passwordHasher` (NFKC → HMAC pepper → bcrypt) nhưng với pepper riêng cho PIN, vì PIN 6 chữ số chỉ có 1 triệu khả năng; pepper nằm ngoài DB làm cho việc dò offline không khả thi khi chỉ rò DB.
- Hàng đợi gửi mail (outbox): bản ghi thư kèm idempotency key, trạng thái, số lần thử, provider message ID. Job nền (theo mẫu `backend/src/jobs/*`) gửi qua Resend ngoài transaction DB và retry có giới hạn với cùng nội dung và cùng idempotency key (Resend có header `Idempotency-Key`; xác nhận lại trong tài liệu Resend khi triển khai).
- Challenge được kích hoạt ngay khi tạo, hạn tính từ lúc tạo. Thư gửi lỗi hoặc timeout không rõ kết quả: mã vẫn hợp lệ trong hạn (vì có thể đã tới người dùng), người dùng dùng gửi lại khi cần. Gửi lại tăng generation và vô hiệu mã cũ; request trùng không gửi nhiều thư hoặc ghi đè mã mới hơn.
- Dùng khóa hàng/cập nhật có điều kiện trong transaction để chống dùng lại OTP/token, mất cập nhật bộ đếm và xác minh song song.
- Giới hạn tần suất theo email + mục đích lấy từ bảng challenge (bền vững, đúng với nhiều instance). Giới hạn theo IP dùng `MemoryStore` hiện có, chỉ có hiệu lực trong từng instance và phụ thuộc cấu hình `trust proxy`; ghi rõ giới hạn này, chưa thêm Redis.
- Dọn challenge, token, outbox và đăng ký tạm hết hạn bằng job định kỳ idempotent, an toàn khi chạy nhiều instance; không giữ thông tin cá nhân tạm vô thời hạn.

## 5. API dự kiến

Các đường dẫn sau dưới `/api/v1`; tên cuối cùng đồng bộ theo quy ước API dự án.

| Endpoint | Quyền | Kết quả |
| --- | --- | --- |
| `POST /auth/register` | Public | Email mới: tạo đăng ký tạm, gửi OTP, trả challenge và thời hạn, chưa đăng nhập. Email đã có tài khoản: `409 AUTH_EMAIL_ALREADY_REGISTERED`, không gửi mail |
| `POST /auth/register/verify` | Public + challenge | Hoàn tất đăng ký, **không** tạo session và không set cookie (PRD Decision #28; Player đăng nhập sau đó); `409` nếu email đã bị đăng ký xen giữa |
| `POST /auth/register/resend` | Public + challenge | Gửi lại OTP đăng ký |
| `POST /auth/password/forgot` | Public | Phản hồi chung kèm challenge (thật hoặc giả), gửi OTP nếu hợp lệ |
| `POST /auth/password/reset/verify` | Public + challenge | Cấp quyền reset mật khẩu ngắn hạn |
| `POST /auth/password/reset` | Quyền reset đúng mục đích | Lưu mật khẩu mới, thu hồi session |
| `POST /auth/password/reset/resend` | Public + challenge | Gửi lại OTP khôi phục mật khẩu |
| `POST /auth/password/change/request` | Đăng nhập | Gửi OTP xác minh email trước khi đổi mật khẩu chủ động |
| `POST /auth/password/change/verify` | Đăng nhập + challenge | Cấp quyền đổi mật khẩu ngắn hạn |
| `POST /auth/password/change/resend` | Đăng nhập + challenge | Gửi lại OTP đổi mật khẩu |
| `POST /auth/password/change` | Đăng nhập | Bắt buộc đổi lần đầu (không OTP) hoặc đổi chủ động kèm quyền đổi mật khẩu |
| `GET /wallet/withdrawal-pin` | Đăng nhập | Trạng thái PIN: `hasPin`, `lockedUntil` |
| `POST /wallet/withdrawal-pin/reset/request` | Đăng nhập | Gửi OTP tới email của user (dùng cho cả thiết lập lần đầu) |
| `POST /wallet/withdrawal-pin/reset/verify` | Đăng nhập + challenge | Cấp quyền reset PIN |
| `POST /wallet/withdrawal-pin/reset` | Đăng nhập + quyền reset | Lưu PIN mới |
| `POST /wallet/withdrawal-pin/reset/resend` | Đăng nhập + challenge | Gửi lại OTP reset PIN |
| Hai API tạo withdrawal/owner payout hiện có | Đăng nhập đúng role + PIN + `clientRequestId` | Kiểm tra PIN rồi tạo yêu cầu rút tiền, idempotent theo `clientRequestId` |
| API admin `/:id/password` hiện có | Admin được phân quyền | Nhận lý do, sinh mật khẩu tạm ngẫu nhiên, bắt buộc đổi, ghi audit |

Không giữ đường đăng ký cũ có thể tạo user/session mà bỏ qua OTP. Cập nhật validator, DTO, tài liệu API, mock và frontend đồng thời.

## 6. Chính sách bảo vệ đề xuất

| Thông số | Giá trị ban đầu |
| --- | --- |
| OTP email | 6 chữ số, sinh bằng crypto |
| Hạn OTP | 5 phút |
| Sai OTP tối đa | 5 lần/challenge; gửi lại không xóa ngân sách thử sai của yêu cầu |
| Gửi lại | Sau 60 giây |
| Giới hạn gửi | Ban đầu 5 lần/giờ/email/mục đích (từ bảng challenge), cộng giới hạn tổng theo IP (bộ nhớ từng instance); áp dụng cả cho bước tạo đăng ký để hạn chế gửi OTP hàng loạt tới một email và dò email đã đăng ký |
| Quyền đặt lại | Token ngẫu nhiên 32 byte, hạn 10 phút, dùng một lần |
| PIN rút tiền | 6 chữ số, chặn PIN yếu (`000000`, `123456`, dãy lặp, dãy tăng/giảm) |
| Khóa PIN | 5 lần sai khóa 15 phút; lần khóa liên tiếp thứ 2 khóa 1 giờ; từ lần thứ 3 khóa 24 giờ. `lockCount` xóa khi nhập đúng PIN hoặc reset PIN. Chỉ hiển thị cảnh báo trên web khi PIN bị khóa, kèm thời điểm được thử lại và đường dẫn quên PIN; không gửi email |
| Đăng ký tạm | Hết hạn sau 30 phút, dọn dữ liệu định kỳ |

Không dùng resend hoặc tạo challenge mới để vượt khóa OTP. Reset PIN qua OTP email được phép xóa khóa PIN (§3.3). Che email phù hợp trong UI. Phản hồi khôi phục public không tiết lộ trạng thái tồn tại/khóa/xóa của tài khoản; riêng đăng ký công khai việc email đã có tài khoản theo quyết định ở §1. Áp dụng cookie/CSRF và phân quyền hiện có cho API đăng nhập, PIN và admin. Không log payload chứa password, PIN, OTP hoặc token reset.

## 7. Resend và giao diện

- Xây `EmailService` dùng chung, adapter Resend và adapter giả cho test. Không cho frontend gọi Resend trực tiếp. Thêm thư viện `resend` vào backend.
- Secret và provider nằm trong `env.ts`: `RESEND_API_KEY`, `EMAIL_FROM`, `OTP_HMAC_SECRET`, `WITHDRAWAL_PIN_PEPPER`. Thiếu cấu hình ở production thì dừng khởi động (fail-fast); môi trường test dùng adapter giả. Các thông số hạn/giới hạn (`OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_SECONDS`, `OTP_MAX_SENDS_PER_HOUR`, `PENDING_REGISTRATION_TTL_MINUTES`, `RESET_TOKEN_TTL_MINUTES`, `EMAIL_OUTBOX_MAX_ATTEMPTS`, `EMAIL_OUTBOX_TICK_MS`) quản lý trong `SYSTEM_CONFIGS` domain `auth` và có thể chỉnh trong trang Admin. Tách secret theo môi trường; chỉ commit placeholder vào `.env.example`.
- Có 5 loại email/template tiếng Việt: OTP xác minh đăng ký, OTP khôi phục mật khẩu, OTP xác minh đổi mật khẩu chủ động, OTP thiết lập/đặt lại PIN rút tiền và thông báo admin cấp lại mật khẩu (không kèm mật khẩu tạm). Gửi lại OTP dùng cùng loại template theo mục đích.
- Không gửi email thông báo mật khẩu đã đổi, PIN đã đổi hoặc cảnh báo khóa PIN; ba trường hợp này chỉ hiển thị trên giao diện web. Không có template "email đã có tài khoản" vì trường hợp này không gửi mail.
- Không bật theo dõi click/open cho email xác thực nếu không cần.
- Xử lý lỗi, timeout, retry giới hạn và idempotency (§4); lưu provider message ID để tra cứu. Resend chấp nhận thư chưa đồng nghĩa thư đã vào inbox. Khi Resend ngừng hoạt động, đăng ký và khôi phục trả lỗi tạm thời rõ ràng, không có đường bỏ qua OTP.
- Frontend thêm bước PIN và OTP đăng ký, thông báo "email đã có tài khoản" kèm đường dẫn đăng nhập/quên mật khẩu, trang quên/reset mật khẩu, màn hình thiết lập/quên/reset PIN trong Ví, ô PIN khi rút tiền (kèm `clientRequestId`), modal admin hiển thị mật khẩu tạm một lần. Hiển thị kết quả đổi mật khẩu/PIN thành công trên web; khi PIN bị khóa, API trả `lockedUntil` để giao diện hiển thị thời gian được thử lại (kể cả sau tải lại trang), chỉ khóa thao tác PIN/rút tiền, không báo tài khoản bị khóa toàn bộ.
- Hỗ trợ dán OTP, bộ đếm resend theo timestamp backend, báo lỗi rõ và tải lại trang trong thời gian challenge còn hiệu lực.
- Không lưu password/PIN/OTP/reset token trong localStorage hoặc bản nháp đăng ký. Ưu tiên cookie HttpOnly cho quyền reset; nếu dùng bộ nhớ JS, hết phiên tải lại phải xác minh lại.
- Chỉ AuthProvider chuyển authenticated sau verify đăng ký; giữ trang kết quả khảo sát hiện có.

## 8. Tài khoản cũ và Court Owner do admin tạo

- Không tự đánh dấu tài khoản cũ đã xác minh và không sinh PIN mặc định/chung. `emailVerifiedAt` của tài khoản cũ chỉ được đặt khi chủ tài khoản hoàn thành một OTP email (quên mật khẩu hoặc thiết lập/reset PIN).
- Giữ khả năng đăng nhập hiện tại; trước lần rút tiền tiếp theo, user chưa có PIN nhận `WALLET_PIN_NOT_SET` và phải xác minh email rồi thiết lập PIN qua luồng §3.3.
- Court Owner do admin tạo được yêu cầu đổi mật khẩu như hiện tại; thiết lập PIN qua OTP email trước lần rút tiền đầu tiên vì không đi qua đăng ký public.
- Tài khoản bị khóa/xóa không được dùng reset để tự kích hoạt lại. Tài khoản chưa có email truy cập được (kể cả tài khoản seed/demo dùng email giả) cần quy trình hỗ trợ riêng, không tự bỏ qua OTP.
- Triển khai migration mở rộng trước; backend/frontend chuyển luồng phải được phối hợp để client cũ không hiểu nhầm phản hồi đăng ký chờ xác minh là thành công đăng nhập.

## 9. Thứ tự triển khai

Chia thành ba đợt phát hành độc lập.

**Đợt 1: Hạ tầng**
1. Chốt các quyết định ở §1 và thông số ở §6.
2. Migration/schema (`emailVerifiedAt`, challenge, reset token, PIN, đăng ký tạm, outbox, audit admin, `clientRequestId` cho payout), repository, bảo vệ đồng thời, giới hạn tần suất bền vững và cleanup.
3. `EmailService`, adapter Resend/giả, outbox + job gửi, template và cấu hình `env.ts`/`.env.example`.

**Đợt 2: OTP đăng ký và khôi phục mật khẩu** (đổi hợp đồng `/auth/register`, dùng feature flag và phối hợp deploy backend/frontend)
4. Đăng ký chờ OTP, xử lý email đã tồn tại, hoàn tất transaction, cập nhật frontend wizard/AuthProvider và fixture test tạo user đã verify cho test/E2E hiện có.
5. Quên mật khẩu qua email OTP (challenge giả, thu hồi session/WebSocket/quyền cũ).

**Đợt 3: PIN rút tiền và admin reset**
6. Thiết lập/reset PIN, `GET /wallet/withdrawal-pin`, xác thực PIN trong `WalletPayoutService` cho Player và Owner, `clientRequestId`.
7. Admin reset sinh mật khẩu ngẫu nhiên, audit và màn hình một lần.
8. Kiểm thử, cập nhật tài liệu API/env, nghiệm thu thật trên staging rồi phát hành.

## 10. Kiểm thử và tiêu chí hoàn thành

- Kiểm tra chỉ 4 loại email được đưa vào outbox; đổi mật khẩu thành công, đổi PIN thành công và khóa PIN không tạo email. Giao diện hiển thị đúng kết quả thành công hoặc thời gian khóa PIN; tải lại trang vẫn thấy trạng thái khóa từ backend.

- Đăng ký chưa verify không có user/session; đúng OTP tạo đầy đủ user, profile, khảo sát và PIN; verify song song chỉ thành công một lần.
- Đăng ký với email đã có tài khoản trả `409`, không tạo đăng ký tạm, không gửi mail, không đổi mật khẩu/PIN của tài khoản đó. Email bị đăng ký xen giữa lúc chờ OTP trả `409` khi verify và hủy đăng ký tạm.
- Nhiều đăng ký tạm cùng email: chỉ phiên có OTP đúng hoàn tất; hủy đăng ký tạm chỉ theo challenge của chính client.
- OTP sai/hết hạn/đã dùng/sai mục đích bị chặn; resend vô hiệu mã cũ khi mã mới được kích hoạt; khóa và rate limit không bị vượt bằng challenge mới.
- Quên mật khẩu: email tồn tại và không tồn tại cho phản hồi cùng hình dạng (có challenge), không phân biệt được qua nội dung; challenge giả không xác minh được.
- Reset token gắn đúng user/mục đích, không dùng lại; đổi mật khẩu thu hồi tất cả session, đóng WebSocket, xóa lockout đăng nhập và không đổi PIN.
- Reset PIN cần email OTP, PIN cũ mất hiệu lực, xóa khóa PIN và không đổi mật khẩu. Tài khoản khác không thể dùng challenge/token lấy được từ user khác.
- PIN sai không tạo payout hay giữ tiền; bộ đếm sai vẫn được lưu sau khi rút tiền thất bại (không bị rollback); khóa leo thang đúng; PIN yếu bị chặn; kiểm tra cả hai role và các đường gọi service.
- Gửi trùng `clientRequestId` không tạo hai yêu cầu hoặc hai lần giữ tiền; cùng ID khác nội dung trả `409`; retry sau phản hồi mất kết nối trả lại yêu cầu cũ.
- Admin không đủ quyền bị chặn; reset tạo mật khẩu ngẫu nhiên thỏa chính sách, thu hồi session, buộc đổi, phản hồi `no-store`; audit/log không lộ thông tin bí mật.
- Test Resend lỗi/timeout (mã vẫn hợp lệ, gửi lại hoạt động), outbox retry không gửi trùng, hai resend đồng thời và giao dịch DB rollback.
- Test tài khoản cũ (đặt `emailVerifiedAt` sau OTP), Court Owner do admin tạo, tài khoản khóa/xóa và khảo sát đổi phiên bản trong khi chờ OTP.
- E2E cho đăng ký, email đã tồn tại, quên mật khẩu, quên PIN, rút tiền và admin reset; kiểm tra refresh, gửi lại, hết hạn và paste OTP.
- Chạy build, kiểm tra migration và bộ test auth/wallet/admin liên quan. Test tự động dùng mail giả; gửi thật chỉ tới email thử được cho phép.
- Nghiệm thu trên staging bằng Gmail: nhận OTP cho ba mục đích, hoàn thành các luồng và kiểm tra phản hồi Resend cùng inbox/spam. Không thực hiện chuyển khoản thật để kiểm thử.

Hoàn thành khi toàn bộ luồng trên hoạt động, không còn API bỏ qua xác minh/PIN, dữ liệu cũ có đường thiết lập PIN an toàn và các kiểm thử liên quan đạt. Ngoài phạm vi: email marketing, OTP SMS, thay đổi email tài khoản, chuyển khoản ngân hàng tự động, thay đổi quy tắc duyệt payout, cooldown rút tiền sau khi đổi PIN/mật khẩu và đổi cách admin đặt mật khẩu khi tạo Court Owner.
