# Court Owner — Đối chiếu Figma và tài liệu

Ngày rà soát: 2026-10-23 (Asia/Ho_Chi_Minh).

Tài liệu nền: [PRD §8.1/§14.1](prd.md), [Tech Design §7–§10](tech-design.md), [Tasks](tasks.md), business-rules, consolidated schema, frontend architecture, và tài liệu Admin/Booking/Payments/Tournament/Auth liên quan. Human owner đã duyệt 14 khuyến nghị của vòng rà tài liệu trước đó và **chốt toàn bộ F01–F24 theo phương án A ngày 2026-10-23**, bằng chỉ dẫn “ok tiến hành chốt theo đề xuất”. Đây là quyết định cho phạm vi và hành vi giao diện; PRD/Tech Design/Tasks và frontend mapping đã được đồng bộ. Chưa chỉnh canvas Figma hay code trong lần chốt tài liệu này.

## Phạm vi và bằng chứng

Đọc trực tiếp qua Figma MCP, file **Badminton SmashPro**, `D9NrjgxLpE066BcE5Sk8HD`. Session `ac706e08-fe11-47bd-8f89-75f7af01af08`. Đọc nội dung text của toàn bộ O01–O17 trên bảy page Court Owner hiện có, không chỉ dựa vào inventory cũ. Xem ảnh O10, O11, O04, O07, O15 và O08. Các nhận định về thành phần vắng mặt giới hạn trong 17 frame này; không khẳng định file không có thiết kế tương tự ở page khác hoặc prototype ẩn.

| Màn | Node | Nội dung đã đối chiếu |
| --- | --- | --- |
| [O01 Dashboard](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-118625) | 12:118625 | KPI doanh thu/lấp đầy, AI, IoT, ca thuê tháng, escrow, danh sách booking |
| [O02 Facility](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-119465) | 12:119465 | Thông tin, liên hệ, GPS, tiện ích, ảnh, giờ mở cửa |
| [O03 Courts](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-121594) | 13:121594 | Danh sách sân, doanh thu sân, nhóm VIP, khóa/mở bảo trì |
| [O04 Pricing](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-123273) | 13:123273 | Biểu giá toàn CLB, phụ thu, tier, mô phỏng doanh thu |
| [O05 Monitor](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-125104) | 13:125104 | Timeline ngày, hold, bảo trì được mô tả đã hoàn tiền |
| [O06 Booking detail](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-124723) | 13:124723 | Liên hệ che số, snapshot, quyết toán, check-in, PDF, nhắn tin |
| [O07 Cancel](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-125711) | 13:125711 | Hoàn tiền tức thì, MoMo, SMS, voucher, đồng thời khóa sân |
| [O08 Account](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-127059) | 13:127059 | CCCD/eKYC, 2FA, ngân hàng, đổi vai trò, chứng nhận |
| [O09 Facility create](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-119953) | 12:119953 | Wizard, draft, OTP/Zalo/email, 14 ngày, quy chuẩn bắt buộc |
| [O10 Facility edit](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=12-120392) | 12:120392 | Địa chỉ hiệu lực ngay, giới hạn 14 ngày/2 giờ, đóng toàn cơ sở |
| [O11 Court create](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-122835) | 13:122835 | Xuất bản ngay, draft, thông số thiết bị, ảnh, biểu giá kế thừa |
| [O12 Court edit](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-122376) | 13:122376 | Thông số kỹ thuật, trạng thái, chuyển sân, bảo dưỡng |
| [O13 Pricing create](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-123759) | 13:123759 | Chọn nhiều sân, phụ thu, draft/autosave, hẹn kích hoạt |
| [O14 Pricing edit](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-124252) | 13:124252 | Phiên bản bảng giá, AI, hiệu lực ngay/ngày mai, snapshot khi trả tiền |
| [O15 Calendar](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-126028) | 13:126028 | Tuần/tháng, export, đặt lịch Owner, nhiều sân/booking, giải trực tiếp |
| [O16 Cancel result](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-126707) | 13:126707 | Luôn hoàn thành công, tài khoản người nhận, push/voucher, tự đình chỉ |
| [O17 Permission/error](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD/Badminton-SmashPro?node-id=13-127449) | 13:127449 | 403 chung, eKYC mở quyền, dữ liệu hỗ trợ mẫu |

## Các câu hỏi đã chốt — toàn bộ phương án A

**F01–F24: A — APPROVED, human owner, 2026-10-23.** Giữ lại câu hỏi và phương án B để truy vết kết quả rà soát; B không được chọn và không nằm trong phạm vi triển khai. Các quan sát mô tả canvas tại thời điểm đọc, không khẳng định canvas đã được sửa.

### F01 — Escrow, ví và quyết toán (thừa/xung đột)

O01/O06/O07/O08/O16 mô tả tiền ký quỹ, ví doanh thu, SmashPay, MoMo và lịch giải ngân 21:45. Payments chỉ duyệt thanh toán/hoàn tiền VNPAY, không có ví/settlement Owner.

- **A. Bỏ ví/escrow/quyết toán; hiển thị số tiền booking và trạng thái thanh toán/hoàn tiền thực tế.**
- B. Mở thêm nghiệp vụ ví, giữ tiền và quyết toán cho Owner.

### F02 — Kết quả hoàn tiền (xung đột/thiếu)

O07 hứa hoàn tức thì; O16 luôn báo đã nhận tiền, 1.4 giây và thông tin tài khoản/giao dịch mẫu. Cancellation và refund là hai lifecycle riêng; hold chưa trả tiền không cần refund.

- **A. Tách trạng thái đã hủy khỏi NONE/PENDING/REFUNDED/FAILED; chỉ báo hoàn thành khi Payments xác nhận, bỏ dữ liệu ngân hàng không thuộc DTO.**
- B. Cam kết luôn hoàn xong trước khi hiển thị kết quả hủy (đổi mô hình xử lý).

### F03 — Kênh thông báo và voucher (thừa)

O02/O09 hứa email/SMS/Zalo/OTP; O07/O16 hứa SMS/push kèm voucher 20%. MVP chỉ có in-app notification, chưa có voucher.

- **A. Giữ thông báo trong ứng dụng kèm lý do; bỏ các cam kết kênh ngoài và voucher.**
- B. Bổ sung email/SMS/push/Zalo/voucher cùng hợp đồng tích hợp.

### F04 — Duyệt và gửi lại hồ sơ (xung đột/thiếu)

O11 có lựa chọn hoạt động ngay và CTA xuất bản. Trong 17 frame được đọc chưa thấy đủ pending/rejected, lý do, lịch sử và gửi lại cùng resource.

- **A. Đổi CTA thành gửi Admin duyệt; thêm pending/rejected/reason/history/resubmit; chỉ cho đặt khi cả cơ sở và sân ACTIVE cùng các điều kiện khác.**
- B. Bỏ duyệt Admin và cho Owner tự xuất bản (đổi quyết định đã chốt).

### F05 — Địa chỉ và giờ hoạt động (xung đột)

O10 nói đổi địa chỉ/giờ có hiệu lực ngay và snapshot bảo vệ toàn bộ cấu hình. Chốt mới yêu cầu đề xuất địa chỉ giữ bản đã duyệt, chặn giờ ảnh hưởng booking; đổi tên không có thủ tục BWF.

- **A. Tách lưu metadata khỏi gửi đề xuất địa chỉ; hiển thị bản live/bản chờ và lịch sử; chặn đổi giờ xung đột; bỏ yêu cầu hợp đồng BWF khi đổi tên.**
- B. Cho đổi địa chỉ/giờ trực tiếp và giữ ngoại lệ booking cũ.

### F06 — Owner chỉnh cấu hình nền tảng (xung đột)

O09/O10 hiển thị 14 ngày đặt trước, hủy tối thiểu 2 giờ và thời lượng tối thiểu do cơ sở chọn. Business rules quy định cấu hình nền tảng; booking horizon mặc định 7 ngày, owner deadline 0, maintenance riêng 90 ngày.

- **A. Hiển thị giá trị thật từ cấu hình/quyền thao tác server, không cho Owner ghi đè; tách rõ 7 ngày đặt sân và 90 ngày khóa bảo trì.**
- B. Bổ sung cấu hình riêng từng cơ sở và quy tắc ưu tiên/snapshot.

### F07 — Trạng thái bảo trì và khóa slot (xung đột/thiếu)

O03/O10/O12 có bật/tắt sân/cơ sở; O07 gộp hủy và khóa; O05 đồng nhất bảo trì với đã refund. Chưa thấy form chuyên biệt đủ ngày/giờ/lý do, xung đột, block ID.

- **A. Bỏ toggle trạng thái; form khóa một sân/một khoảng với lý do; hủy booking và khóa là hai thao tác; mở toàn bộ một block theo ID, chỉ FREE khi mọi điều kiện cho phép.**
- B. Thêm đóng cả cơ sở/hủy hàng loạt/tự khóa sau hủy (đổi phạm vi và atomicity).

### F08 — Hồ sơ kỹ thuật sân/cơ sở (thừa)

O02/O03/O11/O12 có loại thảm, độ dày, lux, trần, phân khu VIP, ma sát, lịch kiểm định, VAR, tiện ích và pháp nhân; schema/forms được duyệt không có các trường này.

- **A. Form có cấu trúc chỉ dùng các trường đã đặc tả; mô tả tự do cho thông tin bổ sung, bỏ chứng nhận/tính toán suy diễn.**
- B. Mở rộng schema, quản lý thiết bị/pháp lý và quy trình kiểm định.

### F09 — Ảnh và bản đồ (thiếu hợp đồng/thừa tích hợp)

O02/O09/O10/O11/O12 có upload, gallery, cover, kéo ghim, Google Business API. Địa chỉ đã có trong Owner; upload/media và Google integration chưa được đặc tả cho tính năng này.

- **A. MVP giữ địa chỉ theo hợp đồng; bỏ upload/gallery/Google Business.**
- B. Bổ sung media và chọn ghim bản đồ, chốt storage/validation/API/provider riêng.

### F10 — Giá theo sân hay bảng giá toàn CLB (xung đột)

O04/O13/O14 dùng biểu phí có tên/phiên bản, chọn toàn bộ hoặc nhiều sân, nhóm thảm kế thừa. Tài liệu duyệt interval theo từng court, không bulk.

- **A. Chọn một sân rồi tạo/sửa các interval của sân đó; ID hiện hữu cho sửa; dùng ngày kết thúc để ngừng hiệu lực.**
- B. Thêm template/version/inheritance và áp giá nhiều sân.

### F11 — Giá cuối tuần/ngày lễ/phụ thu (thừa)

O04/O13/O14 có +20k cuối tuần, hệ số lễ 1.25x, giảm giá theo thảm. Chưa có rule thứ trong tuần, lịch lễ hoặc thứ tự cộng/nhân trong schema/PRD.

- **A. Bỏ engine phụ thu/hệ số/tier; dùng giá theo khoảng giờ và khoảng ngày không chồng lấn đã duyệt.**
- B. Mở rộng pricing engine và chốt calendar, ưu tiên/cộng dồn, làm tròn, snapshot.

### F12 — Thời điểm snapshot và áp dụng giá (xung đột)

O14 nói snapshot khi trả tiền, vừa áp dụng ngay vừa 00:00 ngày mai; gọi mọi lần sửa là phiên bản bảng giá mới. Booking chụp giá khi tạo hold, kể cả chưa trả tiền.

- **A. Viết rõ snapshot từ lúc tạo booking; hiệu lực theo validFrom/validTo, chỉ booking mới dùng giá mới; hiển thị lỗi overlap và thời gian chưa có giá.**
- B. Chuyển snapshot sang thanh toán và bổ sung phiên bản/kích hoạt theo phút.

### F13 — Draft/autosave/wizard (thừa)

O09/O11/O13 có lưu nháp, tự lưu và xuất bản sau. Tài liệu chưa có lifecycle draft/server autosave; pending approval không phải draft.

- **A. Bỏ lưu nháp/autosave server; giữ form đơn giản và hành động gửi/lưu tường minh.**
- B. Thêm lifecycle bản nháp, lưu tự động và tiếp tục wizard sau.

### F14 — Lịch và lịch sử booking (thừa/thiếu)

O05/O15 tách hai màn, O15 tuần/tháng và export; API hiện duyệt single-day, lịch sử riêng có phân trang. O06/O07/O16 hiện là full-page.

- **A. Một workspace lịch ngày; chi tiết/hủy/kết quả là panel/modal, có lịch sử mọi trạng thái; bỏ tuần/tháng/export khỏi MVP.**
- B. Giữ hai màn, thêm API lịch tuần/tháng và export có kiểm soát.

### F15 — Trạng thái khả dụng và lỗi (thiếu/xung đột)

Timeline hiện thiên về trống/đang đấu/bảo trì, O01 dùng PENDING và IN PLAY; chưa thấy đủ NO_PRICING/CLOSED/parent inactive, không được đánh đồng bảo trì với refund.

- **A. Nhãn tiếng Việt ánh xạ lifecycle chuẩn; FREE/BOOKED/BLOCKED/UNAVAILABLE và nguyên nhân; booking/block vẫn thấy sau đổi giá hoặc đình chỉ.**
- B. Giữ các trạng thái giao diện riêng rồi mở rộng contract/mapping.

### F16 — Booking giải đấu và sau giờ bắt đầu (thiếu)

O15 có trận giải đang live với tỷ số; chưa thấy detail không thanh toán, cấm Owner hủy và hướng dẫn Organizer. O07 chỉ trình bày paid confirmed; thiếu unpaid/disabled/deadline/started.

- **A. Thêm context Tournament không tiền/không action hủy, hướng dẫn Organizer; thêm các trạng thái đủ/không đủ điều kiện hủy và support sau start. Bỏ tỷ số live nếu không có contract.**
- B. Cho Owner sửa/hủy booking giải và xử lý sự cố đang chơi (mở rộng luồng liên tính năng).

### F17 — Đặt hộ, nhiều sân và lịch định kỳ (thừa/xung đột)

O15 có '+ Đặt lịch', một booking sân 01–04, lớp 07–08 và vé tháng; O01 có hợp đồng tháng/khách offline. MVP booking một sân, Player tự đặt; không recurring.

- **A. Bỏ tạo booking Owner/booking nhiều sân/vé tháng; chỉ hiển thị booking hợp lệ từ luồng đã duyệt.**
- B. Thêm đặt hộ/offline/định kỳ/nhiều sân và chốt tiền, quyền, thông báo, chống trùng.

### F18 — Check-in, nhắn tin, PDF và IoT (thừa)

O06 có xác nhận check-in, QR sớm 30 phút, nhắn tin và in phiếu; O01/O15 có smart gate, LED tự bật, VAR/live. Không có capability tương ứng trong MVP đã duyệt.

- **A. Bỏ CTA/cam kết này; giữ đọc chi tiết và hủy đủ điều kiện.**
- B. Bổ sung từng capability cùng state/API/hardware/security cần thiết.

### F19 — Dashboard và mô phỏng doanh thu/AI (thừa)

O01/O03 có doanh thu/tỷ lệ lấp đầy, O04/O13/O14 có dự báo tháng, AI tăng giá, số liệu lịch sử; financial analytics ngoài phạm vi, operational KPI chưa có định nghĩa/API.

- **A. Dashboard tối giản: cơ sở/sân đang quản lý, lịch và tác vụ hiện có; bỏ analytics/AI/projection/export.**
- B. Bổ sung dashboard analytics, chốt công thức, dữ liệu và API trước.

### F20 — O08 Account, eKYC, 2FA và đổi vai trò (thừa/thiếu phạm vi)

O08 có CCCD/thuế/ĐKKD, ngân hàng, 2FA, nút đổi sang Player; Auth dùng một system role mỗi tài khoản, không có MFA; Owner profile CRUD chưa rõ trong PRD hiện tại.

- **A. O08 chỉ đọc thông tin tài khoản hiện có và dẫn sang hành động Auth đã hỗ trợ; bỏ eKYC/bank/role switch, chưa thêm profile-edit riêng.**
- B. Bổ sung đặc tả Owner profile; các phần eKYC/MFA/multi-role/ngân hàng phải chốt phạm vi riêng.

### F21 — Chứng nhận, điểm uy tín và tự đình chỉ (thừa/xung đột)

O01/O07/O08/O16 có điểm FairPlay/sao/hạng Kim Cương/BWF; O16 nói quá 3% hủy sẽ bị dừng bán. Không có rule/capability này và Owner không tự đổi moderation status.

- **A. Bỏ sao/hạng/bảo chứng và ngưỡng tự đình chỉ; chỉ hiển thị trạng thái Admin duyệt/đình chỉ thật.**
- B. Xây thêm chứng nhận/rating/uy tín và chính sách tự đình chỉ (thay đổi phạm vi).

### F22 — Nhiều cơ sở và trạng thái trống (thiếu)

O01–O17 hầu hết gắn một CLB cố định; chưa thấy selector cơ sở, Owner mới chưa có cơ sở, chưa có sân/giá/booking, loading/network retry và pending-only workspace đầy đủ.

- **A. Bổ sung chọn cơ sở thuộc Owner, đường tạo cơ sở đầu tiên, empty/loading/error/retry và trạng thái chờ duyệt; không hiển thị KPI giả.**
- B. Giới hạn Owner chỉ một cơ sở và sửa lại PRD/schema/luồng liên quan.

### F23 — Liên hệ Player (xung đột)

O01/O05/O06/O07 che số điện thoại; PRD đã duyệt Owner thấy full contact trong phạm vi booking sở hữu.

- **A. Cho xem số đầy đủ trong detail thuộc quyền (có thể che mặc định và bấm hiện); không log hoặc lộ ở tài nguyên khác Owner.**
- B. Chỉ cho xem số che và sửa quyết định quyền truy cập; cần kênh liên hệ thay thế.

### F24 — Permission/error và dữ liệu hỗ trợ mẫu (xung đột/thừa)

O17 dùng 403 chung OWNER_RESTRICTED_ACTION và gate eKYC mở quyền giải; O07/O16/O17 có số hotline, email, đội kỹ thuật/SLA và nhiều tuyên bố bảo chứng chưa có nguồn vận hành được duyệt.

- **A. Phân biệt 401/403/404/lỗi nghiệp vụ theo contract, bỏ eKYC nâng quyền; chỉ dùng kênh hỗ trợ thực đã được xác nhận, bỏ số/email/SLA/đội kỹ thuật mẫu.**
- B. Xây thêm tier pháp lý/quyền và dịch vụ hỗ trợ/điều phối kỹ thuật với quy chế riêng.

## Quyết định và bàn giao

- F01–F24 đều chọn **A**, được human owner duyệt ngày **2026-10-23**. Không còn câu hỏi chờ chốt trong bộ rà soát này.
- Hành vi sản phẩm: [PRD §8.2 và §14.2](prd.md). Chi tiết kỹ thuật/UI: [Tech Design §9.8 và §21.2](tech-design.md). Triển khai/kiểm chứng: [Tasks — Figma alignment](tasks.md). Mapping màn hình: `docs/architecture/frontend.md` §9.2/§9.4.
- Việc loại các thành phần vượt phạm vi và bổ sung trạng thái thiếu là yêu cầu cho thiết kế/triển khai tiếp theo; chưa đánh dấu bất kỳ task code nào DONE và chưa thay đổi canvas.
- Shared-document/schema revision vẫn cần teammate PR review trước merge theo `.agents/AGENTS.md` §10. Chốt của human owner không thay thế review đó.

F23 implementation clarification approved 2026-10-23: human choice B at the subsequent missing-phone gate authorizes PP-07 private optional phone schema/collection/editing. This enables the already-approved F23 A full-contact display instead of replacing it with email-only. NULL has an explicit not-provided state; public cards remain private.
