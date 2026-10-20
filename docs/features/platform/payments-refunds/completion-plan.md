# Kế hoạch hoàn thành Payment và tích hợp VNPAY Sandbox

```text
Status: Draft
Ngày rà soát: 2026-10-20
Phạm vi: PAY-01…PAY-06; tích hợp Booking và các dependency để hoàn tất Payment
```

Đây là kế hoạch thực thi bổ sung, không thay thế PRD, Tech Design hoặc tạo danh sách task thứ hai. Trạng thái task tiếp tục được quản lý duy nhất trong [tasks.md](./tasks.md). Các đề xuất thay đổi contract/schema dưới đây chưa được coi là quyết định đã duyệt.

## 1. Kết luận về khả năng triển khai

**Có thể bắt đầu Booking + VNPAY Sandbox ngay, nhưng không thể cam kết DONE toàn bộ Payment mà không có module ngoài.** Auth đã có; Booking có hold, snapshot giá, xác nhận và hủy. Các phần này cần sửa transaction và nối Payment trong cùng đợt triển khai, không cần chờ một module Booking mới.

| Phạm vi | Có thể làm ngay? | Điều kiện còn thiếu |
| --- | --- | --- |
| Config, provider guards, chữ ký, adapter VNPAY, test offline | Có | Chốt khác biệt contract ở §3 trước khi triển khai phần bị ảnh hưởng |
| Booking initialization, atomic confirmation, Mock E2E | Có | Chỉnh integration Booking trong phạm vi đợt Payment |
| Booking thanh toán qua gateway sandbox thực | Có thể chuẩn bị toàn bộ code | Merchant credentials, IPN HTTPS được cấu hình và môi trường test hoạt động |
| Refund Booking, recovery và test Mock | Có thể thiết kế/triển khai sau khi chốt persistence | Chốt §3; không phụ thuộc Tournament |
| Refund sandbox thực | Có thể viết adapter/test offline | Quyền/API refund của merchant, giao dịch sandbox hợp lệ và persistence đầy đủ |
| Registration payment và refund khi rút/hủy giải | Chưa hoàn tất được | TRN-04; cancellation producers của Tournament, liên quan TRN-09 |
| Owner cancellation gọi refund | Chưa nghiệm thu end-to-end được | CO-05 và notification đi cùng cancellation theo thiết kế Owner |
| Matchmaking cancellation gọi refund | Có thể kiểm thử từ Booking trước | Nghiệm thu cuối cần luồng cancellation/retry của Matchmaking |

Chỉ có schema Tournament và code bracket trong repository; chưa có registration service/routes để Payment xác nhận registration. Không tạo stub production hoặc dùng test fixture để tuyên bố dependency này đã hoàn thành.

## 2. Tài liệu chi phối và nguồn kỹ thuật

- [Payment PRD](./prd.md), [Payment Tech Design](./tech-design.md), [Payment tasks](./tasks.md).
- [Booking Payment Integration PRD](../../booking/player-booking/payment-integration-prd.md), [Booking Tech Design](../../booking/player-booking/tech-design.md).
- [Tournament Tech Design](../../tournament/tech-design.md), [Tournament tasks](../../tournament/tasks.md), [Owner tasks](../../court-owner/tasks.md).
- Schema duy nhất: [database-schema.md](../../../architecture/database-schema.md); không định nghĩa schema thay thế trong kế hoạch này.
- Đối chiếu VNPAY ngày 2026-10-20: [Thanh toán PAY và IPN/Return](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [QueryDR và Refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).

Theo hướng dẫn VNPAY: IPN nhận GET qua HTTPS; Return chỉ hiển thị kết quả, không cập nhật giao dịch. Số tiền gửi gateway bằng VND nhân 100; thời gian GMT+7. Sandbox payment URL là `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`; API query/refund là `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`. Khi triển khai phải đối chiếu lại encoding/checksum và response contract trực tiếp từ nguồn trên.

## 3. Các điểm phải chốt trước phần triển khai tương ứng

### 3.1 IPN, Return và API contract

- Hiện platform Tech Design/tasks quy định `POST /api/v1/payments/vnpay/webhook`; Booking integration PRD lại mô tả `/vnpay/callback`. Đề xuất giữ path platform `/api/v1/payments/vnpay/webhook`, bổ sung GET theo VNPAY; xác định có giữ POST tương thích hay không.
- Chốt mapping HTTP/app error với acknowledgement `RspCode`/`Message` của VNPAY, nhất là chữ ký sai và callback lặp. Không trả response envelope dành cho frontend tại IPN nếu không đúng provider contract.
- Đề xuất backend Return handler xác minh dữ liệu rồi redirect về trang Booking để đọc trạng thái từ API đã phân quyền. Return không tự xác nhận thanh toán; IPN đến chậm thì giao diện hiển thị đang xử lý và cho tải lại.
- Đồng bộ các thay đổi được chốt vào Payment Tech Design và Booking integration PRD trước khi code endpoint/UI tương ứng. Các contract bảo mật vẫn thuộc tài liệu hiện hành, không tự chọn cách nới lỏng.

### 3.2 Persistence phục vụ refund và recovery

- Hiện `PAYMENTS` chưa thể hiện rõ dữ liệu phục hồi một refund đã gửi nhưng process chết trước khi ghi kết quả. `updated_at` không đủ làm toàn bộ lịch sử request/claim/retry.
- Đối chiếu dữ liệu cần cho VNPAY refund/query: tham chiếu gốc, thời gian tạo giao dịch gốc, request identity ổn định và kết quả xác minh. Không thay thời gian giao dịch gốc bằng thời điểm retry.
- Đề xuất trước tiên đánh giá khả năng dùng payment lifecycle và dữ liệu hiện có. Nếu cần thêm metadata, claim timestamp hoặc cấu trúc persistence, viết delta trong Tech Design và xin duyệt schema theo quy định repository; không tự thêm bảng/column trong đợt code.
- Chốt cách xử lý kết quả refund chưa rõ sau network timeout/crash: đối soát theo khả năng provider trước khi gửi lại; không coi DB lock là bảo đảm hoàn tiền ngoài hệ thống đúng một lần.
- Chốt mốc tính timeout và mapping `REFUND_FAILED`/`REFUND_PENDING` với recovery theo thiết kế; không tự biến lỗi mạng thành một refund mới.

### 3.3 Môi trường sandbox

- Xác nhận có `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và merchant được phép test refund; không đưa giá trị secret vào docs/chat/log.
- Cấu hình IPN HTTPS công khai tới backend test; đăng ký URL với VNPAY. Localhost đơn thuần không nhận được IPN từ provider.
- Chốt Return URL, frontend origin/CORS, cookie và trusted proxy cho môi trường test; không tắt Auth/CSRF để chạy demo.
- Credentials/quyền refund/URL hiện chưa được xác minh. Thiếu chúng chặn smoke test trực tiếp, không chặn viết adapter/test offline.

## 4. Thứ tự triển khai

### Đợt 1 — Nền tảng và an toàn provider (PAY-01, PAY-06)

1. Loại bỏ fallback `VNPAY → MOCK`; provider không hỗ trợ phải lỗi rõ ràng.
2. Chặn `MOCK` ngoài development/test ở config và endpoint; client không được override sang Mock để vượt runtime policy.
3. Đồng bộ config với Tech Design: `VNPAY_PAYMENT_URL` thay tên hiện tại `VNPAY_PAY_URL`, Return/IPN URLs và cấu hình cần thiết cho query/refund được ghi vào thiết kế. Không thay tên config âm thầm.
4. VNPAY được chọn thì bắt buộc đủ config; Mock không yêu cầu credentials. Đọc refund flags/timeouts từ config boundary hiện có.
5. Viết adapter bằng Node.js primitives hiện có; không thêm dependency hoặc hạ tầng mới nếu chưa được duyệt.
6. Unit test chọn provider, production rejection, thiếu config, ký/xác minh, payload trùng key hoặc sai kiểu, sửa số tiền/reference/chữ ký.

**Cổng kiểm tra:** không môi trường production nào có thể xác nhận thanh toán bằng Mock; test chữ ký độc lập gateway pass.

### Đợt 2 — Khởi tạo Booking và confirmation dùng chung (PAY-02, PAY-03, PAY-06)

1. Lock booking và tạo/reuse payment trong transaction; các request đồng thời chỉ nhận một pending payment hợp lệ. Quy định lock order thống nhất với cancel/expiry để tránh deadlock.
2. Snapshot amount/provider/reference của payment; không lấy amount từ client. Không đổi provider của một pending attempt khi reuse. Chính sách retry/reference phải được ghi vào Tech Design và tương thích yêu cầu VNPAY.
3. Truyền transaction context qua Payment repository và primitive xác nhận Booking; sửa contract type-only đang không khớp implementation. Không để Booking tự commit rồi Payment mới ghi success.
4. Đưa Mock và VNPAY vào cùng confirmation orchestration sau bước xác minh provider. Lock và kiểm tra trạng thái payment; không cho failure simulation ghi đè success/refund.
5. Kiểm tra payment-target, amount, merchant, provider và transaction identity trước thay đổi; callback lặp không thay transaction ID hoặc xác nhận lần hai.
6. Late success không mở lại booking hết hạn/hủy: ghi nhận charged payment và refund intent theo lifecycle đã duyệt trong cùng transaction. Chỉ phát side effects sau commit; recovery dựa vào DB.
7. Đồng bộ lỗi khởi tạo với `409 PAYMENT_NOT_PAYABLE`; bảo vệ payment detail cho mọi target, bao gồm registration khi được tích hợp.

**Cổng kiểm tra:** concurrent create/confirm/cancel/expiry và forced rollback không để payment-booking lệch trạng thái; các test success/failure/replay/late callback pass.

### Đợt 3 — VNPAY IPN và Booking return UX (PAY-03; BK-06/BK-12)

1. Tạo payment URL và lưu đủ thông tin gốc để đối soát/refund. Gateway expiry không vượt hold expiry.
2. Cài IPN theo contract đã chốt ở §3.1; xác thực provider thay session cookie/CSRF cho callback. Các endpoint player tiếp tục dùng bảo vệ hiện hành.
3. Xác minh payload và acknowledgement; map success/failure vào orchestration của đợt 2. Không xác nhận chỉ từ một response code mà bỏ các trường trạng thái cần đối chiếu.
4. Nối redirect thực trên `BookingPendingPage`; thêm return flow theo frontend architecture, không lấy query string làm trạng thái thanh toán đã tin cậy.
5. Xử lý return trước IPN, không return, refresh, session hết hạn và gateway cancel mà không cho thanh toán lại một payment đã finalized.

**Cổng kiểm tra:** callback ký hợp lệ qua HTTP xác nhận booking đúng một lần; Return đơn thuần không thay DB; giao diện đọc đúng kết quả từ server.

### Đợt 4 — Refund bền vững và reconciliation (PAY-04)

1. Sau khi §3.2 được chốt, Booking cancellation ghi refund intent cùng transaction; không phụ thuộc duy nhất vào event bus.
2. Worker in-process dùng DB claim; xử lý `SUCCESS → REFUND_PENDING → REFUNDED | REFUND_FAILED` và full refund theo policy.
3. Provider call ngoài transaction giữ lock dài; lưu identity trước khi gọi, kết quả sau khi xác minh, có recovery khi restart/worker chết.
4. Dùng query/reconciliation cho trạng thái không rõ, không gửi refund lần hai chỉ vì timeout. Không coi provider trả HTTP thành công là refund đã hoàn tất.
5. Áp dụng `REFUND_ENABLED` và timeout; công việc chưa xử lý vẫn truy vấn/quan sát được. Cấm provider refund cho payment Mock hoặc ngược lại.
6. Kết nối cancellation producers đã có; dành integration points rõ ràng cho Owner/Tournament. Không tự triển khai cả các module đó trong scope Payment.

**Cổng kiểm tra:** hai worker, duplicate cancel, crash sau provider call, timeout và restart không phát sinh refund trùng hoặc mất refund intent.

### Đợt 5 — Test tự động và smoke sandbox (PAY-05; BK-14)

1. Sửa fixture cleanup đang lỗi FK trong booking confirmation test; chỉ dùng test DB riêng.
2. Chạy unit/integration/API cho đợt 1–4; thêm auth/CSRF, payment visibility, duplicate/tampered callback, amount mismatch, rollback và concurrency tests.
3. Playwright Mock: tìm sân → hold → trả tiền → confirmed → hủy → thấy refund; thêm failure/retry và hết hạn. Test local callback VNPAY có chữ ký dùng môi trường test, không gọi production.
4. Chuẩn bị sandbox checklist trong feature docs: config names, IPN/Return URLs, thao tác test và cách kiểm tra DB/log đã che dữ liệu nhạy cảm.
5. Khi §3.3 đủ điều kiện, chạy gateway thực: success, user cancel/failure, Return trước IPN, replay callback, late success và full refund nếu merchant hỗ trợ. Ghi kết quả quan sát và lý do case chưa chạy.
6. Chạy TypeScript/backend tests/frontend build và Playwright phù hợp; cập nhật task progress và docs trong cùng đợt thay đổi. Không dùng test callback giả thay bằng chứng gateway/refund sandbox thực.

**Cổng kiểm tra:** Booking thanh toán sandbox được xác nhận từ IPN, hoàn tiền có bằng chứng provider và trạng thái local khớp; case chưa kiểm chứng được ghi rõ.

### Đợt 6 — Hoàn tất integration ngoài Payment

1. Khi TRN-04 sẵn sàng: nối registration initialization/confirmation vào transaction chung, kiểm tra Single owner/Double captain, snapshot fee/expiry, late success và withdrawal.
2. Khi Tournament cancellation sẵn sàng: nối `TournamentCancelled`/`RegistrationWithdrawn` vào refund lifecycle; test hủy hàng loạt, replay và retry.
3. Khi CO-05 sẵn sàng: test Owner cancellation ghi refund intent và notification nguyên tử, refund chỉ một lần.
4. Kiểm chứng Matchmaking gọi Booking theo policy, policy refusal không refund, crash/retry không mất yêu cầu hoặc refund lần hai.

**Cổng kiểm tra:** không đánh DONE phần registration hoặc toàn bộ refund coverage khi producer/consumer ngoài Payment còn thiếu.

## 5. Điều kiện đánh dấu DONE theo task hiện có

| Task | Điều kiện hoàn tất |
| --- | --- |
| PAY-01 | Config/adapter/signature và verification tương ứng pass; các config/API discrepancy đã được giải quyết trong docs |
| PAY-02 | Booking và registration cùng tạo/reuse payment đúng quyền/amount/state, concurrency-safe, có URL thực |
| PAY-03 | VNPAY IPN xác minh, acknowledgement, atomic confirmation cho hai target, replay và late-payment pass |
| PAY-04 | Booking/Owner/Tournament cancellation được xử lý durable; refund đầy đủ, concurrency/recovery/timeout và sandbox verification đạt yêu cầu |
| PAY-05 | Coverage lifecycle của các target, callbacks, refund, concurrency và E2E đạt tiêu chí tasks.md |
| PAY-06 | Mock bị cấm production; cả Booking/registration đi qua shared idempotent path, test acceptance pass |

Mốc có thể bàn giao trước là **Booking + VNPAY Sandbox**, kèm các phần refund đã kiểm chứng. Mốc này không tương đương DONE toàn bộ PAY-01…06. Không hạ acceptance criteria hoặc đổi scope task để che dependency Tournament/Owner.

## 6. Bước tiếp theo

Chốt §3.1–3.2 trong tài liệu sở hữu, xác nhận môi trường sandbox ở §3.3, rồi thực hiện đợt 1 → 5 cho Booking. Đợt 6 tiếp tục khi module liên quan sẵn sàng. Không cần đợi Tournament để bắt đầu nền tảng, adapter, Booking và các test độc lập.
