# Social — Đối chiếu Figma và tài liệu, 2026-11-01

Đây là báo cáo đọc thiết kế, không phê duyệt nghiệp vụ mới và không xác nhận frontend đã được triển khai. Không sửa canvas hoặc các tài liệu đang được người khác cập nhật.

## Phạm vi và nguồn

- Đọc trực tiếp 12 frame Social, gồm màn hình desktop/mobile, trạng thái, components và bàn giao; kiểm tra text, cấu trúc và các native component được frontend.md dẫn chiếu. Xem ảnh desktop feed và composer. Mobile được kiểm tra cấu trúc/text; lần lấy ảnh mobile chưa hoàn tất nên không kết luận về chất lượng hiển thị mobile.
- Đối chiếu các màn hình tích hợp cũ: Matchmaking P19/P20/P21/P23, Notifications P05/P45, Report P38/P74/P75, Admin A08/A09. Những màn hình này không tự trở thành yêu cầu Social chỉ vì cùng tồn tại trong file.
- Nguồn hành vi: [Social PRD](prd.md), [Social Tech Design](tech-design.md), [Social Tasks](tasks.md), [Matchmaking PRD §15](../matchmaking/matchmaking/prd.md), [Matchmaking Tech Design §24](../matchmaking/matchmaking/tech-design.md), [Messaging PRD](../messaging/prd.md), [Report Tech Design](../admin/report-management/tech-design.md), [Notifications Tech Design](../platform/notifications/tech-design.md), [Frontend](../../architecture/frontend.md).
- Quyết định mới ghi trong phần extension được ưu tiên hơn baseline cũ. Ready của tài liệu không đồng nghĩa task/API đã hoàn tất.

## 1. Conflict phải xử lý trước khi triển khai UI

| ID / mức | Bằng chứng Figma | Xung đột và tác động | Đề xuất / có xử lý ngay không |
| --- | --- | --- | --- |
| C01 / P0 | [Composer](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43882), [host chưa công khai](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44007), [bàn giao](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46819) | Vẫn nói tự tạo nhóm khi người đầu tiên nhận, mở nhóm sau duyệt Apply, đồng bộ thành viên theo kèo. Messaging hiện độc lập; shortcut tạo nhóm đã hoãn khỏi SOC-08/MM-29. | Sửa ngay copy, CTA và journey Social để bỏ side effect tạo/sync nhóm. Không cần chờ merge Messaging để sửa thiết kế hoặc làm Social. Entry nhắn riêng chỉ nối khi capability/API Messaging có thật. |
| C02 / P0 | [Rút kèo](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44522), [bàn giao](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46819) | Rút kèo mất quyền đọc/gửi/tải tệp; sau trận 24h nhóm chuyển chỉ đọc. Các lifecycle này đã bị thay thế. | Bỏ ngay cảnh báo thu hồi quyền chat và khóa 24h. Giữ cảnh báo tác động thực đến recruitment/Match/booking. Không thêm dependency Social → lifecycle chat. |
| C03 / P0 | [Booking trong composer](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43884) | Cho chọn booking và nói lịch chơi lấy từ booking. MM-19/MM-20 còn là dependency; liên kết booking phải bao phủ khoảng giờ bài, không tự đổi giờ của bài đã có thành viên. | Hiện tại dùng sân tự khai báo và KEEP; ẩn action liên kết/CANCEL chưa hỗ trợ. Thiết kế tương lai phải biểu diễn validation khoảng giờ/địa điểm và không tự ghi đè giờ. Sửa canvas được ngay; bật action chờ MM-19/MM-20 cùng Booking/Payments theo task của chúng. |
| C04 / P1 | [Chi tiết người chưa tham gia](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43891) | Viewer trên header và chủ kèo cùng là Nguyễn Văn Nam nhưng vẫn có Apply và nhắn chủ kèo. Fixture thể hiện hành động tự tham gia. | Đổi viewer mẫu hoặc chuyển sang host actions; dùng một bảng role/action thống nhất. Sửa ngay, không cần đổi nghiệp vụ. |
| C05 / P1 | [Feed](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43349) | Đang bật ngày 03/11, giờ, Quận 7, còn chỗ nhưng vẫn có bài chia sẻ và kèo 07/11. Bộ lọc recruitment phải phản ánh kết quả đúng theo hợp đồng query. | Chỉnh fixture/active chips cho nhất quán; không biến dữ liệu mẫu thành quy tắc ngoại lệ cho FREE hoặc ngày khác. Các cách hiểu filter chưa chốt trong SOC-05 phải được giải quyết trước nghiệm thu. |
| C06 / P1 | [P05 Notifications](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-86147), [P45](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-86386) | Có “Đánh dấu tất cả đã đọc”, SmartMatch/ELO, cấu hình push/SMS. NTF hiện chỉ read từng item bằng POST; GET không đổi read state, chưa có bulk-read MVP. | Bỏ action bulk và các producer/kênh chưa được duyệt khỏi delivery hiện tại. Bổ sung mẫu notification Social theo catalog thật; không cần chờ API bulk. Deep-link đúng còn phụ thuộc NTF-05/provider visibility. |
| C07 / P1 | [P38 Report](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-114171), [A09](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=13-174106) | Luồng cũ có upload bằng chứng JPG/MP4/PDF 50MB, cam kết xử lý 2–4h, trừ FairPlay/ELO, đình chỉ, yêu cầu bổ sung và chế tài. Report extension dùng snapshot nội dung/media của target và OPEN → RESOLVED. | Lấy board report mới làm nguồn composition; bỏ cam kết/chế tài/upload tùy ý khỏi scope Social. RP-06/07/08 sở hữu API/evidence/UI; canvas sửa được ngay, nghiệm thu end-to-end chờ các task đó. |

## 2. Thiếu hoặc chưa đủ để nghiệm thu

“Thiếu” dưới đây nghĩa là chưa có minh họa đủ rõ trong các frame đã đọc, không khẳng định backend chưa có hành vi.

| ID / mức | Khoảng thiếu | Đề xuất / dependency |
| --- | --- | --- |
| G01 / P0 | [State board](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44308) có xóa FREE và hủy/rời kèo nhưng thiếu dialog xóa bài MATCH_FINDING đang hoạt động với thành viên. | Tách xóa bài của tác giả khỏi Admin hide: xóa phải đi qua cancel, thông báo tác động và KEEP hiện tại. Riêng xóa sau khi trận đã bắt đầu đang được SOC-04 ghi là lựa chọn nghiệp vụ chưa xác nhận: không tự thiết kế thành hành vi đã được duyệt. |
| G02 / P1 | Đủ số slot do companions nhưng chưa có một registered member được ACCEPTED; chưa có trạng thái khóa sửa sau khi tất cả thành viên đã rút. | Thêm GROUP không đủ điều kiện chốt/bắt đầu khi accepted=0 và edit-lock bền vững từ lần accept đầu tiên. MM-29 trình bày rule MM PRD §15.3; không đổi công thức slot. |
| G03 / P1 | Chưa đủ ma trận request/membership: pending, timeout, chủ kèo hủy, bị đóng do lịch trùng/block, accepted rồi withdrawn; Apply và Invite có action khác nhau. | Làm bảng viewer × trạng thái × action, gồm invitee chưa công khai và applicant không có quyền host. Chỉ expose action có endpoint; kiểm chứng Apply/BlockPort thật, không lấy stub test làm bằng chứng tích hợp hoàn tất. |
| G04 / P1 | Một mẫu “đã kết thúc” chưa biểu diễn rõ cancelled/expired/đến giờ bắt đầu/in progress/completed, không có sân hoặc GROUP thiếu người. | Bổ sung nhãn nguyên nhân và action theo role; giữ comments/reactions khi bài vẫn được phép đọc. Không đồng nhất ngừng tuyển với trận hoàn tất. MM-29 sở hữu trạng thái recruitment. |
| G05 / P1 | Admin hide có cảnh báo không hủy kèo, nhưng chưa rõ entry quản lý của host/member khi bài bị ẩn. | Thiết kế đường vào từ dữ liệu kèo của mình thay vì chỉ dùng post-detail đã unavailable; giữ quyền quản lý hợp lệ, không công khai lại nội dung bị ẩn. Đối chiếu SOC-05/MM-29/provider thực. |
| G06 / P1 | Có empty/unavailable/gate/quota nhưng chưa đủ vòng đời feed tải đầu, tải tiếp, tải lỗi/retry và tránh trùng khi refresh. | Thêm trạng thái pagination theo asOf và dedupe, comments load-more, submit pending/chống double click. SOC-08 theo contract sẵn có; không thêm polling định kỳ cho Social. |
| G07 / P1 | [Mobile](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45192) mới có feed/detail kèo; thiếu filters sheet, composer/edit, host management, report và dialog dài. | Bổ sung responsive states ở 390px và kiểm tra chiều rộng nhỏ hơn; tái dùng component, không tạo route mới cho mỗi overlay. Chưa kết luận overflow từ ảnh mobile vì ảnh chưa được kiểm tra. |
| G08 / P1 | [Evidence board](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44643) minh họa MESSAGE rõ hơn POST/COMMENT; A08/A09 cũ chưa có các target mới. | Thêm filter/row/detail POST và COMMENT, snapshot tại lúc report so với nội dung hiện tại đã sửa/xóa/ẩn, hide action đúng target, media hết quyền/không tải được. MESSAGE chỉ xem đúng evidence; RP-07 + resolver media là dependency thực. |
| G09 / P1 | Quota/gate chỉ có vài ví dụ, chưa đủ phân biệt FREE theo ngày Việt Nam, comments theo 60s, quota kèo và feature gates độc lập. | Thêm variant theo error/capability thật; countdown theo Retry-After, limits theo cấu hình. SOCIAL_ENABLED=false không được khóa luôn read/delete/report hoặc quản lý kèo hiện hữu. Tách MATCHMAKING_ENABLED và MESSAGING_ENABLED. |
| G10 / P1 | Chưa có đủ ví dụ notification Apply/Invite/comment/reopen/cancel và target đã ẩn/mất quyền. | Thêm các row/destination/error tương ứng catalog NTF; click không cấp thêm quyền. Không có notification reaction hoặc conversation producer mới. End-to-end chờ NTF-05; không chặn layout feed/composer. |

## 3. Dư, lỗi thời hoặc dễ bị triển khai nhầm

| ID | Bằng chứng | Xử lý đề xuất |
| --- | --- | --- |
| X01 | [P19](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-94015), P20/P21/P23 còn auto-matching, ELO/radius, tự chọn/giữ sân, bước xác nhận, chia tiền, phạt rời kèo. | Đánh dấu legacy/superseded và tách khỏi flow Social hiện tại. Chỉ tái dùng layout phù hợp; không phát sinh task implement các chức năng này. |
| X02 | [Components](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44860) vẫn ghi chưa chuyển native, nhưng các ID 99:47318/47333/47334/47335/47350/47351/47352/47353 thực sự là COMPONENT/COMPONENT_SET. | Sửa chú thích ngay; không tạo lại thư viện. Native không đồng nghĩa đã có Code Connect hoặc implementation. |
| X03 | [Upload state](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44405) hiển thị 62%; chưa có cam kết transport progress tương ứng. | Dùng pending không xác định phần trăm cho đến khi có progress thật. Không giả số %, không thêm staged upload chỉ để khớp hình. |
| X04 | [Community rules link](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43548) chưa có destination được quản lý trong scope hiện tại. | Giữ nội dung hướng dẫn tại chỗ hoặc bỏ link cho tới khi có đích đã duyệt; không tạo dead route. |
| X05 | Lời nhắn mẫu của applicant trong management có thể bị hiểu là Apply kèm message, trong khi bảng API applications không định nghĩa trường này. | Chỉ giữ nếu contract/provider thực có hỗ trợ đã duyệt; nếu không, bỏ khỏi row. Không tự bổ sung payload/database vì một dòng fixture. |

## 4. Tài liệu cần đồng bộ

1. Frontend.md đã ghi `/feed`, `/posts/:postId` được duyệt 2026-11-01 nhưng heading và đoạn sau vẫn nói mọi route còn proposed. SOC-08 vẫn ghi route approval là blocker. Cần chỉ rõ hai route Social đã được duyệt, các route khác giữ trạng thái riêng.
2. Mapping host chưa công khai còn “group-chat entry”; mapping Messaging còn shortcut “not yet assigned”. Sửa theo quyết định standalone và shortcut deferred đã ghi ngay trong cùng tài liệu.
3. Baseline Matchmaking/Report/Notifications cũ và Figma legacy phải có nhãn nguồn tham khảo; extension hiện tại là nguồn hành vi cho Social. Không đánh dấu task DONE chỉ vì design đã có màn hình.
4. SOC-04 đang để ngỏ author deletion sau start; SOC-05 còn cách hiểu bộ lọc/visibility cần xác nhận. Đây là vấn đề cần giải quyết trong contract, không che bằng trạng thái UI chung.

Không tự sửa các tài liệu dùng chung trong lượt audit này; chúng đang có thay đổi của người dùng và cần review theo quy định repository.

## 5. Thứ tự xử lý đề xuất

1. **Chốt nguồn thiết kế:** xử lý C01–C03, C06–C07 và đánh dấu legacy X01. Đồng bộ mô tả route/chat trong frontend/tasks. Các sửa canvas này làm được ngay, không chờ Messaging.
2. **Chốt contract còn mở:** xóa sau start, nghĩa bộ lọc/visibility SOC-05, role/action và payload Apply. Không phát minh hành vi mới trong lúc dựng UI.
3. **Bổ sung flow còn thiếu:** G01–G06, G09; làm feed/composer/detail bằng capability hiện có. Booking link/CANCEL vẫn đóng cho tới khi MM-19/MM-20 thực sự sẵn sàng.
4. **Hoàn thiện tích hợp:** RP-06/07/08, resolver media, NTF-05 và Apply/BlockPort thật. Chờ provider nào thì chỉ gate action tương ứng; không chặn toàn bộ Social vì Messaging chưa merge.
5. **Hoàn thiện mobile và kiểm chứng:** G07/G08/G10, ma trận role/state, deep links, unavailable, upload/quota và end-to-end SOC-09. Không coi board tĩnh là prototype đã chạy.

Các phần đã có và nên giữ: feed ba cột/thu một cột, FREE/MATCH_FINDING cards, comment phẳng, report reason codes, external court, KEEP khi CANCEL chưa khả dụng, empty/unavailable/gate cơ bản, cảnh báo Admin hide không hủy kèo, và native component library. Không cần thiết kế lại toàn bộ Social.
