# Kế hoạch Social khi Messaging do người khác phụ trách

Cập nhật theo phân công của người dùng, 2026-11-01. Phần này thay thế thứ tự thực thi ở kế hoạch cũ bên dưới. Messaging đang được người khác triển khai và sẽ merge sau; không triển khai lại MSG-* trong nhánh Social. Task nguồn và trạng thái DONE vẫn quản lý ở tasks.md của từng module.

## Phạm vi nhánh Social

- SOC-01…SOC-09.
- SC-12 và NTF-01…05; phần resolver CONVERSATION tích hợp với Messaging khi merge, không đóng NTF-05 đầy đủ trước đó.
- MM-21…31 cho hành trình tìm kèo; không tự tạo/đồng bộ nhóm chat.
- RP-01…08, bao gồm UI RP-03/04 cho Admin; phần MESSAGE và entry Messaging phối hợp với người phụ trách Messaging, không triển khai trùng.
- Route Social cần chốt theo frontend.md. Nhánh booking vẫn tách riêng: sân ngoài + KEEP trước; BK-15/MM-07/19/20 và Booking/Payment nếu cần nghiệm thu đủ nhánh booking.

Đây là phạm vi các task cần cho mục tiêu, không kết luận mọi task đã sẵn sàng hoặc sẽ được viết trong một lượt. Các đoạn bị chặn bởi schema/contract chưa có không được triển khai bằng giả định hoặc stub production.

## Đợt 0 — Chốt ranh giới trước khi hai nhánh phát triển lệch nhau

Thực hiện ngày 2026-11-01 trên nhánh `feat/social`, baseline `04046e8`. Chỉ sửa tài liệu; không đổi code, DB, trạng thái task hay checkbox. Tài liệu đối chiếu dưới đây để người dùng chuyển cho người phụ trách Messaging; không gửi tin nhắn ra ngoài.

### Nguồn quyết định đã duyệt

- `PROJECT-BRIEF.md` §3.4 và §7 "Messaging", §7 dòng chốt ngày 2026-11-01: Messaging độc lập, nhóm chat tạo qua `POST /api/v1/conversations/group`, không khóa chỉ đọc sau 24 giờ.
- `docs/architecture/tech-stack.md`, dòng "Real-Time Messaging": WebSocket `ws` tại `/api/v1/ws/messaging`, xác thực bằng cookie `sid`, REST cho history/upload/catch-up `afterSeq`.
- Messaging Tech Design §2, §7.2, §7.7, §21.2 và commit `04046e8` (bỏ `GroupConversationPort`, `markTerminal`, grace/read-only, `REVOKED`/`LEFT_CHAT`).

### Tài liệu đã đồng bộ trong bước 0

| File | Thay đổi | Căn cứ |
| --- | --- | --- |
| `matchmaking/matchmaking/tasks.md` | MM-25 bỏ MSG-03 trong bảng tổng; MM-25 bỏ "chat sync"; MM-29 bỏ read-only chat, "chat opens", AC grace; MM-30 bỏ "MSG-03 single conversation", bước chat, "one conversation"; viết lại cross-module order và ghi chú MSG-03/MSG-08. | Brief 2026-11-01; MM-25 chi tiết đã là "Blocked by: MM-22" từ `04046e8`. |
| `matchmaking/matchmaking/tech-design.md` | §24.5 bỏ "Messaging read access" và rollback "conversation"; §24.10 bỏ dòng "group conversation creation/membership sync"; §24.11 bước 4 bỏ `ensureGroup` on-demand; §24.12 bỏ "one/two conversations", "roster and chat". | Như trên; Messaging Tech Design §2, §7.2. |
| `matchmaking/matchmaking/prd.md` | Ghi chú Non-Goal "Group chat inside Matchmaking" không còn nói "post-group conversations". | Brief §3.4. |
| `platform/notifications/tasks.md` | NTF-05: "revoked member" → non-member hoặc `LEFT`. | Schema §13.7 chỉ còn `ACTIVE`/`LEFT`. |
| `social/tasks.md` | SOC-04 tách dependency: tạo bài ← SOC-03, MM-23; xóa bài active ← MM-25, MM-31. Status giữ BLOCKED. | MM Tech Design §24.4, §24.7.3; Notifications Tech Design (`MM_POST_CANCELLED`). |
| `docs/architecture/frontend.md` (shared, cần PR review) | Dòng Real-time; ghi chú polling online/typing; dòng Messaging trong bảng route; shared needs; Figma 99:45582, 99:45821, 99:46232 và dòng grace. Route Social đã được người dùng duyệt ngày 2026-11-01; route Messaging còn proposed. | tech-stack "Real-Time Messaging"; Messaging Tech Design §7.7. |

Chỉ sửa Messaging tasks/Tech Design ở phần BlockPort split và group gate đã được duyệt; không triển khai code Messaging; các chỗ còn sót được liệt kê ở mục "Cần người phụ trách Messaging xác nhận".

### Dependency

Đã sửa:

- MM-25: bỏ MSG-03 (bảng tổng). MSG-03 hiện là WebSocket hub, chỉ chờ MSG-02.
- SOC-04: tách tạo bài (SOC-03, MM-23) và xóa bài active (MM-25 hủy, MM-31 notification thành viên).
- Cross-module order (MM tasks): MSG-03 không còn chờ MM-22; SOC-04 chia hai phần ở đợt 5 và 6; bỏ ghi chú `GroupConversationPort`.
- MSG-08 (ghi tại MM tasks, phía consumer): BlockPort nền tảng (← MSG-02) khác phần đóng pending Apply/Invite (← MM-21, MM-22 và MatchmakingBlockPort.closePendingBetween do MM-22 sở hữu, đã ghi trong §24.2). MSG-08 không DONE chỉ với block list.

Đã điều chỉnh: MM-24 ← MSG-08 foundation; giữ nguyên: RP-05 ← MSG-01; RP-06 ← MSG-02; RP-08 ← MSG-09; SOC-09 ← RP-08; MSG-10 ← RP-08; PP-09 ← MSG-09; MSG-08 đã chia rõ foundation/integration trong task nguồn.

### Bảng phối hợp với nhánh Messaging

Hiện trạng code (đọc ngày 2026-11-01): chưa có schema/service Social, Messaging, media private, report service, notification service (chỉ có `contracts/NotificationService.ts`). Router chưa có `/feed`, `/posts/:postId`, `/messages`.

| Hạng mục | Provider | Consumer | Task nguồn | File dự kiến giao nhau | Cần xác nhận |
| --- | --- | --- | --- | --- | --- |
| `MEDIA_FILES` và `PrivateMediaService` | Social (schema §13.1, §13.9; Social Tech Design §7.4) | Messaging (ảnh/file đính kèm, resolver message attachment); Report (resolver evidence cho Admin) | SOC-01, SOC-02; MSG-01 (FK), MSG-04, MSG-05; RP-05, RP-07 | `backend/src/db/schema/` (media), `contracts/PrivateMediaService.ts`, `shared/storage/private-media.ts`, `repositories/media/`, `jobs/`, `shared/config/env.ts`, `.env.example`, `app.ts` | Cách đăng ký resolver và chữ ký `resolveAccess(mediaId, viewer)`; SOC-02 chỉ có `storeImages`, ai bổ sung đường lưu file non-image cho MSG-05; Messaging không tạo storage/bảng media thứ hai. |
| Migration, journal/snapshot | Mỗi nhánh cho migration của mình | Cả hai nhánh, DB dev/test chung máy | SOC-01, SC-12, NTF-01, MM-21, RP-05; MSG-01 (RP-01 không có schema change) | `backend/src/db/migrations/*.sql`, `meta/_journal.json`, `meta/NNNN_snapshot.json` (chuỗi `prevId`) | Thứ tự bắt buộc: SOC-01 trước MSG-01 trước RP-05; SOC-01, SC-12 trước MM-21. Runner áp dụng theo tên file sort và lưu `filename` + SHA-256: sửa file đã áp dụng thì dừng vì checksum, đổi tên file đã áp dụng thì bị coi là migration mới. Cần thống nhất cách cấp số (0011…) và ai tái tạo journal/snapshot khi merge; không áp migration của nhánh chưa merge vào DB dùng chung nếu số file còn có thể đổi. |
| SC-12 và config registry | Social branch (SC-12 gồm domain `social`, `messaging`, `matchmaking`) | Messaging (`MESSAGING_*` §8.9), Matchmaking, Social | SC-12; MSG-02, MSG-04 | `shared/config/config-registry.ts`, `matchmaking-config.ts`, reader mới, seed migration | Messaging không đăng ký/seed key riêng; reader typed cho `MESSAGING_*` do SC-12 hay MSG-02/04 viết; MSG-04 cần SC-12 nên nhánh Messaging phải rebase sau khi SC-12 merge hoặc chấp nhận chờ. |
| `BlockPort`, transaction context, lock order, đóng pending | Messaging: `isBlockedEitherWay` (MSG-08). Matchmaking: thao tác đóng pending Apply/Invite với `close_reason = BLOCKED` | Matchmaking (MM-22 recheck §24.5, MM-24 Apply, Invite mới); Social (liệt kê tại §24.2) | MSG-08; MM-21, MM-22, MM-24 | `contracts/BlockPort.ts`, `contracts/index.ts`, `services/matchmaking/`, `services/messaging/` | Đã chốt MatchmakingBlockPort.closePendingBetween(a, b, tx), MM-22 sở hữu tại §24.2; kiểu transaction truyền qua contract (§24.2: mọi thao tác nhận caller transaction); lock order "Block": users(10, cả hai, tăng dần) → requests(30) → invitations(40) theo §24.7.3; Social dùng `BlockPort` cho việc gì khi PRD nói block không ẩn bài. |
| Report MESSAGE và shared report dialog | Report Management (RP-05 schema, RP-06 API, RP-08 dialog) | Messaging (entry trong menu tin nhắn); Social (entry bài/comment); Admin (RP-07) | RP-05, RP-06, RP-07, RP-08; MSG-01, MSG-02, MSG-09 | `db/schema/reports.ts`, migrations, `services/reports/`, `components/common/` (dialog), `features/admin/`, `features/social/`, `features/messaging/` | Messaging cung cấp hàm kiểm tra quyền đọc tin nhắn cho RP-06 dưới dạng contract nào; ai gắn entry vào menu Messaging (RP-08 hay MSG-09); RP-05/06 vẫn chờ MSG-01/02 theo task hiện tại. |
| Notification resolver `CONVERSATION` | Notifications (NTF-05, nhánh Social) | Notification UI (NTF-04) | NTF-05; MSG-02 | `services/notifications/`, `features/notifications/` | Notifications Tech Design không có loại notification nào trỏ tới conversation ("No notification for reactions or messages"). Đã duyệt hoãn resolver CONVERSATION khỏi NTF-05; không chặn Social, không tạo producer mới. |
| Authorized media component, Player shell, router | Social branch tạo authorized media trong `components/common/` (SOC-08 yêu cầu 1) | Messaging (MSG-09), Report (RP-07, RP-08) | SOC-08, MSG-09, NTF-04, RP-08, PP-09 | `frontend/src/components/common/`, `frontend/src/features/player/components/PlayerLayout.tsx`, `frontend/src/app/router.tsx`, `frontend/src/shared/hooks/` | Props/API chung của component; ai sửa header (Cộng đồng, Tin nhắn + badge riêng, Notifications); thứ tự sửa router; route Messaging cũng còn proposed. |

### Route

Người dùng duyệt `/feed` và `/posts/:postId` ngày 2026-11-01, giữ `/` hiện tại. Mapping đã cập nhật; chưa thay router. Route Messaging vẫn proposed và do chủ nhánh phối hợp chốt.

### Kiểm tra môi trường (chỉ đọc)

- Test scripts: backend `npm test` = `vitest run`; global setup tạo `badminton_test` nếu thiếu và chạy migration; helper có `TRUNCATE`. Vì vậy chạy test là ghi DB test, không chạy trong bước này. Frontend: `test:e2e` (Playwright), các config riêng cho matchmaking/profile.
- PostgreSQL Docker `badminton_postgres` đang chạy, cổng 5433. Truy vấn trong transaction READ ONLY: `badminton_test` đã áp dụng 11/11 migration (0000…0010); `badminton_db` (dev) mới áp dụng 9/11, thiếu 0009 và 0010. Cả hai chưa có bảng Social/Messaging/media; `system_configs` rỗng ở cả hai DB (reader dùng default); DB dev có 2 `matchmaking_requests`, 6 `matches`, 2 `reports` cần đi qua preflight MM-21/RP-05.
- Uploads hiện tại: `backend/uploads` (avatar), phục vụ công khai qua `express.static` tại `/uploads`; môi trường test dùng thư mục tạm. `PRIVATE_UPLOADS_DIR` chưa có trong `env.ts`, `.env.example` hay `.env`. Theo tech-stack: bắt buộc mọi môi trường, đường dẫn tuyệt đối, ghi được, nằm ngoài mọi public static root, không fallback `/uploads`.

### Quyết định người dùng đã duyệt — 2026-11-01

- Duyệt `/feed`, `/posts/:postId`, giữ `/` hiện tại; route Messaging vẫn cần chủ nhánh chốt.
- MSG-08 chia foundation và integration; MM-22/24 cần foundation thật. Không thêm dependency vào toàn MSG-08 gây vòng chặn.
- MM-22 sở hữu `MatchmakingBlockPort.closePendingBetween(a, b, tx)` (§24.2); triển khai được sau MM-21 trước khi MM-22 hoàn tất. MSG-08 integration gọi thao tác này cùng transaction block.
- MM-24 triển khai được với foundation; nghiệm thu xuyên module vẫn phải kiểm tra block đóng pending nguyên tử.
- Hoãn shortcut tạo nhóm khỏi SOC-08/MM-29; nhóm do Player chủ động tạo.
- Tạo nhóm khi Messaging tắt trả 409 MESSAGING_DISABLED, không ghi rows.
- CONVERSATION resolver hoãn khỏi NTF-05 vì chưa có producer; không chặn Social. Giữ resource value, không thêm notification mới.

### Kết luận review bước 0

Bước 0 hoàn tất chuẩn bị tài liệu theo quyết định người dùng; được chuyển sang bước 1. Không có code/migration/DB write trong bước này. Không đổi checkbox hoặc DONE của task tính năng. Shared-document changes vẫn cần PR review trước merge theo quy định repo.

Handoff còn chờ phía Messaging là điều kiện trước tích hợp, không chặn tất cả bước 1. Trước tạo migration phải kiểm tra lại lịch sử hiện tại; trước áp dụng lên DB chung phải thống nhất thứ tự với nhánh Messaging. Dùng DB test tách biệt, không đổi tên migration đã áp dụng. SC-12 sở hữu đăng ký/seed keys; typed reader Messaging do phía Messaging consume theo contract đã chốt.

### Cần người phụ trách Messaging xác nhận

1. Các mục "Cần xác nhận" trong bảng phối hợp.
2. Chỗ còn sót cơ chế cũ trong tài liệu Messaging (phần provider do chủ nhánh dọn; nhánh này chỉ sửa contract split/gate đã được người dùng duyệt):
   - `tasks.md` MSG-03: "Schema/config impact: Reads grace config", "API impact: … legacy posts".
   - `tasks.md` MSG-07: tiêu đề/blocker (MSG-02) khác bảng tổng (MSG-02, MSG-03); "non-revoked".
   - `tasks.md` MSG-08: "Blocked by: MSG-02" chưa ghi dependency phần đóng pending (MM-21/22 và contract Matchmaking).
   - `tasks.md` MSG-09: "read-only", "grace/read-only", "withdrawn member loses the conversation", "revoked members", "hidden tab … no sync or heartbeat" (cần đối chiếu với WebSocket).
   - `tasks.md` MSG-10: "access loss across Matchmaking withdrawal".
   - `tech-design.md` §3 "on withdrawal"; §4 "cursor polling"; §7.5 "(polling)"; §7.7 "All polls … pause", heartbeat; §12 "Terminal event during send … `read_only_at`", "Poll during connection loss"; §16 "group sync still creates conversations"; §17 "Legacy group conversations are created on demand (Matchmaking §24.11 step 4)" (bước 4 nay không còn tạo on-demand), "Frontend polling hooks"; mã lỗi `MESSAGING_READ_ONLY` còn được dùng không.
   - `prd.md` dòng trạng thái "Read-only: after the grace period".
3. Quyết định gate đã được duyệt và ghi trong Messaging Tech Design: tạo nhóm khi tắt Messaging trả 409 MESSAGING_DISABLED; phía Messaging cần triển khai/test.

Các shared-doc/schema changes đi qua PR review theo quy định repo.

### Bước 1 có thể bắt đầu

- Làm được ngay (task Approved, không chờ Messaging): SOC-01, SC-12 (phối hợp số migration và registry), NTF-01 → NTF-02, RP-01 → RP-02. Cần cấp số migration trước khi tạo file.
- Chuẩn bị song song: biến `PRIVATE_UPLOADS_DIR` cho SOC-02 (sau SOC-01), component dùng chung khi API rõ.
- Còn chặn: MM-24 và phần recheck block của MM-22 chờ MSG-08 foundation thật; RP-05/06/08 và SOC-09 còn chờ các phần Messaging tương ứng. Route Social và CONVERSATION resolver không còn chặn.

## Kết quả bước 1 (2026-11-01, chưa merge)

SOC-01, SC-12, NTF-01/02 và RP-01/02 đã có code và test tập trung pass; trạng thái IN_PROGRESS, chưa DONE (xem tasks.md từng module). Full regression sau thay đổi chưa chạy theo yêu cầu người dùng.

| Migration | Task | Ảnh hưởng dữ liệu |
| --- | --- | --- |
| `0011_social_media_foundation` | SOC-01 | Chỉ tạo bảng mới và trigger bất biến `creation_hash`. |
| `0012_social_matchmaking_config_seed` | SC-12 | Preflight dừng nếu giá trị lưu ngoài range; chỉ thêm key còn thiếu, không sửa row có sẵn. |
| `0013_notification_references` | NTF-01 | Thêm cột nullable và index; row cũ giữ nguyên. |

Điều kiện merge với nhánh Messaging:

- Số `0011`–`0014` thuộc nhánh này (`0014` = MM-21, bước 2). Nhánh Messaging bắt đầu từ `0015`; MSG-01 phải sau `0011` vì FK tới `media_files`. Thay đổi so với bước 1 (đã hẹn `0014` cho Messaging) — cần báo lại người phụ trách Messaging.
- Khi merge cần tái tạo chuỗi journal/snapshot theo thứ tự cuối cùng; không đổi tên hoặc sửa file đã áp dụng.
- Các migration mới mới chỉ áp vào `badminton_test` và DB scratch; DB dev đang ở `0008`.
- Contract dùng chung cho Messaging: `contracts/TransactionContext.ts`, `NotificationService.notify(tx, events)`, `loadConfigValues([...] as const)` cho key `MESSAGING_*` (không tạo registry hoặc seed riêng).

## Kết quả bước 2 (2026-11-01, chưa merge)

SOC-02, MM-21, MM-22, MM-26 và NTF-03 đều đã có code, test tập trung đã pass, đang IN_PROGRESS và chưa task nào DONE. Chưa chạy full regression.

Phần còn chặn:
- **Acceptance của MM-22:** chưa nghiệm thu với BlockPort thật của Messaging (MSG-08 foundation). Nhánh này chỉ có `contracts/BlockPort.ts`, và production fail-closed khi chưa có provider.
- **GROUP (MM-23/MM-25):** chưa làm.
- **Quyền xem media qua membership (SOC-05):** đang từ chối mặc định.

Contract dùng chung mới:
- `PrivateMediaService`: `transaction`, `storeImages`, `registerResolver`, `resolveAccess`.
- `BlockPort`: Messaging hiện thực theo đúng chữ ký này.
- `MatchmakingBlockPort.closePendingBetween(a, b, tx)`: Messaging gọi trong transaction block.

Điều kiện merge với nhánh Messaging:
- Migration `0014` thuộc nhánh này, nên Messaging dùng từ `0015`.
- Messaging đăng ký provider BlockPort khi khởi động.

## Thứ tự triển khai nhánh Social

| Đợt | Task / phần việc | Có thể tiến hành trước merge Messaging? |
| --- | --- | --- |
| 1 | SOC-01; SC-12; NTF-01 → NTF-02; RP-01 → RP-02 | Có. SC-12/shared migration cần phối hợp người phụ trách Messaging. |
| 2 | SOC-02; MM-21 → MM-22; MM-26; NTF-03 | Có. MM-22 nghiệm thu chung conflict closure với MM-26. |
| 3 | SOC-03, SOC-05 → SOC-06/07; MM-23 | Có. Bình luận phải có NTF-02 thật; không hoãn notification như bản demo. |
| 4 | MM-25, MM-28 sân ngoài → MM-27; phần tạo bài SOC-04 và xóa qua cancel; chuẩn bị MM-24 theo contract BlockPort | Phần không gọi block làm được; MM-24 và acceptance liên quan block chờ provider thật. SOC-04 phần notification thành viên chờ MM-31; không đóng sớm. |
| 5 | SOC-08 + MM-29 theo API đã sẵn sàng; NTF-04 và resolver POST/recruitment; report POST/COMMENT | UI FREE và recruitment không cần block làm được. RP-05/06 và SOC-08/MM-29 đầy đủ chưa DONE nếu dependency/message/block chưa đủ. |
| 6 | Merge Messaging; tích hợp BlockPort/đóng pending → MM-24 → MM-31; hoàn thiện SOC-04; RP-05/06/07/08; NTF-05 POST/recruitment; hoàn thiện SOC-08/MM-29 | Cần bản merge và contract/schema thật. Thứ tự nội bộ theo dependency: RP-05 trước RP-06, RP-07/08 sau RP-06; MM-31 sau MM-24/25 và NTF-02/05. |
| 7 | SOC-09 + MM-30; chạy regression tích hợp với suite Messaging do người phụ trách cung cấp | Cần sau merge. Không đóng Social full bằng test mock provider. |

Không thực hiện MSG-01…10 trong nhánh này. Việc hoàn thành và test chúng thuộc nhánh Messaging; đợt cuối chỉ phối hợp chạy regression và xử lý lỗi giao tiếp.

## Điểm chờ Messaging không thể bỏ bằng cách bỏ khỏi phạm vi

| Điểm chờ | Nếu Messaging chưa merge | Việc tiếp tục được |
| --- | --- | --- |
| MM-24 ← MSG-08 | Apply chưa thể nghiệm thu kiểm tra block; MM-31 và UI Apply tương ứng còn chờ. | Recruitment core, FREE, UI phần đã có API, test contract phía consumer. |
| MSG-08 đóng pending | BlockPort chỉ đọc block chưa đủ; cần chứng minh pending Apply/Invite bị đóng nguyên tử, không deadlock. | Matchmaking triển khai contract đóng pending theo spec trước. |
| RP-05 ← MSG-01; RP-06 ← MSG-02 | Schema/API report đầy đủ chưa thể hoàn tất theo task hiện tại. | POST/COMMENT logic và test theo schema/contract đã chốt; không bỏ FK hoặc auth MESSAGE để chạy tạm. |
| RP-08 ← MSG-09 | Chưa thể đóng RP-08 toàn bộ, kéo theo SOC-09. | Shared dialog và Social entry làm trước; nối chat sau merge. |
| NTF-05 | CONVERSATION resolver đã hoãn khỏi scope; không chờ Messaging cho resolver này. | Hoàn tất resolver POST/recruitment theo module sở hữu. |
| Shared migration/config/UI conflicts | Merge có thể lỗi schema hoặc journal dù TypeScript build pass. | Giữ danh sách file giao nhau, kiểm tra fresh/populated DB sau merge. |

Không đề xuất tách lại toàn bộ task report để tránh Messaging trong đợt này vì đã có người triển khai module đó. Chỉ chia lát thực hiện trước/sau merge; task đầy đủ vẫn giữ dependency hiện tại.

## Mốc bàn giao

1. Backend FREE hoàn chỉnh: ảnh private, CRUD/feed/detail, reaction/comment và notification thật.
2. Backend recruitment và UI Social phần không phụ thuộc provider Messaging; còn ghi rõ Apply/block/report tích hợp chưa nghiệm thu.
3. Sau merge: Apply/block, report/evidence, resolver và UI hoàn chỉnh; test schema, transaction, lock order và authorization xuyên module.
4. Nghiệm thu cuối: SOC-01…09 và task tích hợp đủ acceptance; desktop/mobile, quota/idempotency/concurrency, hidden media, report snapshot, scheduler, notification navigation. Ghi riêng giới hạn booking nếu chưa làm nhánh đó.

Chưa cam kết ngày kết thúc trước khi biết mốc merge Messaging. Nếu merge trễ, vẫn tiến hành đợt 1–5 nhưng không báo Social full DONE. Kế hoạch chưa thay đổi code hoặc tự duyệt route.

---

## Kế hoạch trước khi phân công Messaging — tham khảo

# Kế hoạch hoàn thành module Social

Ngày rà soát: 2026-11-01. Baseline: `04046e8`.

Kế hoạch này thay thế ưu tiên demo bằng ưu tiên hoàn thành Social. Nguồn trạng thái duy nhất vẫn là tasks.md của từng module; kế hoạch không tự đánh dấu task DONE, duyệt route hoặc thay đổi contract/schema. Kế hoạch demo cũ được giữ cuối tài liệu để tham khảo.

## Phạm vi và điều kiện hoàn thành

Hoàn thành SOC-01…SOC-09: bài FREE và MATCH_FINDING, ảnh private, feed/filter/detail, reaction/comment, notification, tác giả sửa/xóa, Admin hide, report/evidence và UI desktop/mobile. Recruitment đi qua Matchmaking; Messaging độc lập, không tự tạo/đồng bộ nhóm khi kèo thay đổi.

Mức bàn giao theo giới hạn đã được thiết kế cho phép: sân ngoài và hủy với KEEP; liên kết booking và CANCEL được ghi nhận chưa hỗ trợ khi MM-19/20 chưa xong. Đây không phải hoàn thành nhánh booking. Nếu yêu cầu bao gồm mọi nhánh booking, phải thêm nhóm Booking/Payment bên dưới trước nghiệm thu tương ứng.

## Danh sách task cần hoàn thành

| Nhóm | Task nguồn | Lý do và dependency sâu hơn |
| --- | --- | --- |
| Social | SOC-01…SOC-09 | Toàn bộ phạm vi Social; SOC-09 hiện chờ RP-08. |
| Config | SC-12 | Không có dependency triển khai chưa xong theo task; mở SOC-03 và MM-21. Không cần Admin Config UI. |
| Notifications | NTF-01…NTF-05 | Schema → persistence transaction/dedup → API → UI; resolver POST/recruitment cần owning-module access. Resolver conversation nghiệm thu với Messaging khi làm đầy đủ NTF-05. |
| Matchmaking | MM-21…MM-31 | MM-21 ← SOC-01 + SC-12; MM-22 → MM-23; MM-24 cần MSG-08; MM-25 chi tiết chỉ cần MM-22; MM-27 cần MM-25/28; UI MM-29 cần SOC-08 và các API; MM-30 là nghiệm thu tích hợp; MM-31 cần NTF-02/05 + MM-24/25. |
| Messaging theo task hiện tại | MSG-01…MSG-09 | MSG-01 ← SOC-01; MSG-02 → BlockPort MSG-08 cho Apply. RP-08 còn chờ MSG-09, nên kéo theo send/media/history/files/WebSocket/presence/typing. MSG-04 còn cần SOC-02 + SC-12. |
| Report | RP-01/02, RP-05…RP-08 | RP-01 ← Auth hiện có; RP-02 ← RP-01; RP-05 ← SOC-01 + MSG-01; RP-06 ← RP-05 + SOC-05 + MSG-02; RP-07 ← RP-02 + RP-06 + SOC-07; RP-08 ← RP-06 + SOC-08 + MSG-09. |
| Admin report UI | Rà soát RP-03/04 cùng RP-07 | Không phải dependency trực tiếp ghi trong SOC-09, nhưng cần list/detail/resolution thực để Admin truy cập evidence; code hiện chưa có report feature riêng. Không nghiệm thu UI chỉ bằng gọi API thủ công. |
| Kiểm thử Messaging | MSG-10 | Không phải dependency trực tiếp SOC-09; chạy khi bàn giao kèm Messaging đầy đủ do chuỗi RP-08, không thay thế test từng task. |
| Booking đầy đủ, nếu yêu cầu | BK-15, MM-07/19/20, Booking payment/cancellation và phần Payment liên quan | MM-07 chưa xong, MM-08 đã DONE nhưng cần kiểm tra tích hợp mới; MM-19 ← MM-07 + Booking payment; MM-20 ← Booking cancellation + Payment + MM-08. BK-06/07 là các task Booking liên quan theo bảng cross-module; đối chiếu trạng thái thực trước triển khai. Không cần chờ toàn bộ Tournament/Payment của target khác. |

AUTH-26/27/28, PP-08/09 và RT-09/10/11 là scope mở rộng khác, không có cạnh dependency trực tiếp trong SOC-01…09. Không đưa toàn bộ các nhóm này vào đường găng Social; dùng Auth/profile hiện có và chỉ mở task bổ sung nếu acceptance Social thực sự cần hành vi mới.

## Đợt 0 — Đồng bộ tài liệu và đóng điểm chưa rõ

1. Dọn yêu cầu chat cũ trong Matchmaking tasks/tech-design: dependency MM-25 → MSG-03 ở summary, chat sync, ensureGroup/markTerminal/grace và các acceptance còn đòi conversation. Đồng bộ với quyết định Messaging độc lập đã ghi ở PROJECT-BRIEF ngày 2026-11-01.
2. MSG-03 hiện là WebSocket hub: sửa API/config impact còn ghi group legacy/grace; frontend architecture chuyển mô tả Messaging polling cũ sang WebSocket + REST catch-up theo tech-stack hiện hành.
3. MSG-08 cần ghi rõ phần BlockPort nền tảng và phần đóng Apply/Invite pending. Phần tích hợp cần MM-21/22 cùng contract đóng pending; không kết luận DONE toàn MSG-08 chỉ bằng block list.
4. SOC-04 cần ghi rõ tạo bài chờ MM-23; xóa bài active chờ hành vi cancel của MM-25 và notification tương ứng. Chuẩn bị contract trước, hoàn thiện sau khi các provider có thật; không dùng stub để đóng task.
5. Chốt route Social `/feed`, `/posts/:postId` và route Messaging nếu thực hiện nhánh full hiện tại; đây vẫn là đề xuất trong frontend.md. Không tự coi yêu cầu lập kế hoạch là duyệt route cụ thể.
6. Rà soát DB test, dữ liệu legacy/preflight, migration history và PRIVATE_UPLOADS_DIR. Không reset DB hoặc sửa migration đã áp dụng.

Các sửa đổi shared docs/schema đi qua PR review theo .agents/AGENTS.md trước merge. Đây là quy trình review code/tài liệu, không phải dependency vào một module triển khai khác.

## Thứ tự thực thi theo dependency hiện tại

| Đợt | Thứ tự task trong đợt | Kết quả / cổng chuyển tiếp |
| --- | --- | --- |
| 1 | SOC-01; SC-12; NTF-01 → NTF-02; RP-01 → RP-02 | Schema/config sẵn sàng; notification nhận caller transaction, dedup/rollback được kiểm thử. Các nhánh độc lập có thể chuẩn bị đồng thời; migration sắp tuần tự. |
| 2 | SOC-02; MM-21; MSG-01 → MSG-02; NTF-03 | Media private an toàn; backfill legacy không đổi lịch sử; core conversation và API NTF có auth. |
| 3 | SOC-03; SOC-05; MM-22; MM-26; RP-05 | CRUD FREE, feed/detail và membership mới; MM-22 tích hợp conflict closure MM-26 trước khi nghiệm thu acceptance. Migration/report được kiểm thử. |
| 4 | MM-23; MSG-08 nền tảng + tích hợp MM-22; SOC-06; SOC-07; RP-06; NTF-05 phần POST/recruitment khi resolver có thật | Tạo recruitment, kiểm tra block, comment/notification, Admin hide và report snapshot. SOC-06 chỉ đóng khi notification cùng transaction hoạt động. |
| 5 | MM-24; MM-25; MM-28 sân ngoài; SOC-04 hoàn thiện; MM-27; MM-31; RP-07 | Apply/Invite, hủy/rút/reopen, scheduler và xóa bài active đúng nghiệp vụ; evidence giữ được text/ảnh gốc. Chạy notification resolver khi recruitment đã truy cập được. |
| Nhánh Messaging bắt đầu từ đợt 2 | MSG-03 sau MSG-02; MSG-04 sau MSG-02 + SOC-02 + SC-12; MSG-05/06 sau MSG-04; MSG-07 sau MSG-02/03 | Không chặn MM-25. Vẫn cần vì RP-08 hiện chờ MSG-09. Cài dependency ws theo quyết định đã duyệt; kiểm tra manifest thực khi triển khai. |
| 6 | SOC-08 cùng MM-29; NTF-04; MSG-09; RP-03/04 phối hợp RP-07 nếu giữ tách task | UI dùng API thật. Không tạo hai form tìm kèo/API song song. Từng route phải được chốt trước tích hợp. |
| 7 | RP-08; hoàn thiện NTF-05 resolver conversation nếu còn; SOC-09 + MM-30; MSG-10 cho nhánh Messaging bàn giao | Hai Player và Admin hoàn thành hành trình, report/evidence và notification đúng quyền. Mỗi task đã có test riêng trước đợt này. |

## Tối ưu để bỏ blocker UI Messaging — đề xuất chưa áp dụng

Có thể giảm đường găng nhưng phải sửa task/thiết kế liên quan trước, không tự bỏ dependency hiện tại:

- Chia RP-05/06 thành lát POST/COMMENT và MESSAGE; phần Social không chờ schema hoặc authorization conversation.
- RP-08 sở hữu shared dialog + entry Social; task riêng nối Messaging sau. Shared UI/contract report không bị nhân đôi.
- SOC-09 chờ nghiệm thu report POST/COMMENT; MSG-10 chờ report MESSAGE.
- NTF-05 tách nghiệm thu resolver POST/recruitment với CONVERSATION để notification Social không kéo Messaging trở lại.
- Sau thay đổi, Social cần MSG-01/02/08 cho BlockPort theo cách chia task hiện tại; không cần chờ MSG-03…07/09/10. Cần nghiệm thu đóng pending cùng Matchmaking.

Không đưa tối ưu này vào cam kết tiến độ trước khi dependency chính thức được cập nhật. Mặc định kế hoạch thực thi là bảng đợt hiện tại ở trên.

## Blocker và khả năng giải quyết

| Blocker | Ảnh hưởng | Có xử lý ngay? |
| --- | --- | --- |
| SOC-01/SC-12 | Chặn schema/feed/CRUD/recruitment | Có, không chờ module mới. |
| NTF-02 | Bình luận chưa bảo đảm notification nguyên tử | Bắt đầu NTF-01 ngay, rồi NTF-02; UI phải thêm NTF-03/04/05. |
| MM-21/22/23 | Chưa tạo/đọc bài tìm kèo đúng mô hình | Chờ SOC-01 + SC-12; migration anomalies có thể cần xử lý dữ liệu trước. |
| MSG-08 | Apply chưa kiểm tra block và đóng pending đúng nghiệp vụ | Core chờ MSG-01/02; tích hợp chờ membership mới của MM. Không cần WebSocket. |
| RP-08 → MSG-09 | SOC-09 chưa thể đóng dù Social UI chạy | Làm đủ Messaging hoặc cập nhật cách tách report/NTF như đề xuất; không tự đánh dấu dependency đã gỡ. |
| Route proposed | Chặn router/navigation chính thức | Chốt tài liệu, không chờ code module khác; backend và component có thể tiến hành trước. |
| MM-19/20 | Không liên kết/hủy booking đầy đủ | Phụ thuộc Booking/Payment, không cần chặn sân ngoài + KEEP theo giới hạn đã duyệt. |

## Nghiệm thu và bàn giao

- Mỗi task có automated test của chính nó trước DONE: migration, quota/retry/hash, rollback media, authorization/CSRF, hidden/deleted masking, scheduler, lock order.
- E2E FREE: đăng/sửa/xóa ảnh, reaction/comment, notification mở đúng bài; self-comment/reaction không phát notification ngoài spec.
- E2E MATCH_FINDING: tạo draft/invite/publish/Apply/accept, race last slot, rút/reopen/replacement, hủy KEEP, start/end; không yêu cầu tự tạo nhóm chat.
- E2E moderation: Player report POST/COMMENT, Admin xem snapshot sau khi bài sửa/xóa, hide không đổi recruitment/Match; ảnh hết quyền không tải được.
- Desktop 1280px/mobile 390px, giữ draft khi lỗi, focus/keyboard overlay, feature gate và disabled journeys.
- Ghi test đã thực chạy, lỗi còn lại và nhánh booking chưa hỗ trợ. Không tuyên bố toàn bộ sản phẩm hoặc module khác DONE từ kết quả Social.
- Chưa cam kết ngày hoàn thành khi chưa biết nhân lực/môi trường; tiến độ theo từng đợt và dependency thực tế.

---

## Kế hoạch demo trước đây — tham khảo, không còn là mục tiêu chính

# Kế hoạch thực hiện Social base để demo

Ngày: 2026-11-01.

Phạm vi base được người dùng đồng ý trong phiên làm việc: bài tự do, ảnh private, feed/detail, reaction, comment, tác giả sửa/xóa; hoãn notification, recruitment, Messaging, report và Admin hide. Đây là kế hoạch chia lát triển khai của [tasks.md](tasks.md), không tạo backlog hoặc nguồn trạng thái task thứ hai. Các task đầy đủ vẫn giữ dependency và tiêu chí DONE hiện tại; hoàn thành lát demo không đồng nghĩa hoàn thành toàn task.

Thiết kế nền: [PRD](prd.md), [Tech Design](tech-design.md). Hợp đồng API, schema, quota, phân quyền, validation và idempotency giữ theo thiết kế đã duyệt. Hai khác biệt của bản demo được công khai: chỉ phục vụ FREE; bình luận chưa phát notification. Không dùng bản demo để nghiệm thu SOC-06 đầy đủ.

## Mục tiêu bàn giao

Hai tài khoản Player có thể thực hiện luồng: A đăng bài có ảnh → B xem feed/detail, reaction và bình luận → A sửa bài, xóa bình luận hoặc xóa bài → B không còn truy cập nội dung/ảnh đã mất quyền. UI responsive, dùng dữ liệu và API thật.

Không hiển thị các thao tác chưa hỗ trợ: tìm kèo/Apply/Invite, nhắn tin, báo cáo, kiểm duyệt, notification Social. Không thay đổi hành vi Matchmaking/Booking hiện có.

## Thứ tự triển khai

| Bước | Task nguồn / lát triển khai | Phụ thuộc | Đầu ra và điều kiện kiểm tra |
| --- | --- | --- | --- |
| 0 | Chuẩn bị phạm vi, route và môi trường | Không | Ghi rõ khác biệt demo; chốt route trước khi nối router; xác nhận DB test và thư mục private có quyền ghi. Kiểm tra dữ liệu hiện có trước migration. |
| 1 | SOC-01 | Bước 0 | Schema Social/media theo schema §13.1–13.2, gồm creation_hash, CHECK và index. Migration mới chạy được trên DB rỗng và DB test có dữ liệu. |
| 2 | SC-12: lát config Social | Bước 0 | Đăng ký/seed SOCIAL_FEED_ENABLED, SOCIAL_FREE_POSTS_PER_DAY, SOCIAL_COMMENTS_PER_MINUTE theo matrix §8.9; typed reader, defaults, validation, cache. Không ghi đè giá trị đã lưu. SC-12 tổng còn mở. |
| 3 | SOC-02 | SOC-01 | Upload ảnh qua multer/sharp, root private hợp lệ, transaction/rollback cleanup, GC, download có kiểm tra quyền. Ảnh không được phục vụ qua public uploads. |
| 4 | SOC-03 | Bước 1–3 | Tạo/sửa/xóa FREE; quota theo ngày Việt Nam, replay/hash bất biến, author checks, gate. Kiểm tra request trùng, khác payload, cập nhật ảnh và rollback. SOC-03 đầy đủ vẫn cần đối chiếu dependency SC-12 gốc trước khi đóng. |
| 5 | SOC-05: lát feed/detail FREE | SOC-01; dữ liệu bước 4 để nghiệm thu | GET /posts với type=FREE, GET /posts/:id cho FREE; paging/asOf, published_at DESC/id DESC, canView, 404 masking. Chưa hỗ trợ projection/filter MATCH_FINDING; không trả payload nửa vời cho loại này. SOC-05 tổng còn mở, không chờ MM-21 cho lát FREE. |
| 6 | SOC-06: lát reaction/comment, hoãn NTF | Bước 2, 5 | Sáu reaction theo spec, flat comments, quota, replay, xóa bởi tác giả comment hoặc tác giả bài. Mỗi user một reaction/bài; không gửi notification trong demo. SOC-06 tổng còn mở. |
| 7 | SOC-08: lát UI FREE | Bước 4–6; route đã được chốt | Entry Cộng đồng trong Player shell; feed/detail, composer tạo/sửa với ảnh, xác nhận xóa, reaction/comment, paging, loading/empty/error/disabled/rate limit. Giữ draft khi lỗi, hiển thị text thuần, ảnh có auth. Desktop 1280px và mobile 390px. SOC-08 tổng còn mở. |
| 8 | SOC-09: lát nghiệm thu demo | Bước 1–7 | Chạy automated API/integration và Playwright luồng hai Player. Ghi kết quả thực chạy, checklist demo và phần chưa làm. Không đánh dấu SOC-09 đầy đủ vì RP-08 và các nhánh full chưa hoàn thành. |

Có thể chuẩn bị bước 2 cùng bước 1; dựng component/transport UI khi API đã rõ, sau đó nối dữ liệu thật ở bước 7. Migration cần được sắp thứ tự tuần tự. Mỗi lát mang kiểm thử của chính nó, bước 8 chỉ bổ sung kiểm thử xuyên luồng.

## Blocker và các phần chủ động hoãn

| Hạng mục | Ảnh hưởng demo | Chuỗi phụ thuộc nếu làm đầy đủ | Hướng xử lý |
| --- | --- | --- | --- |
| NTF | Bình luận lưu/hiển thị nhưng chủ bài không nhận notification. Reaction vốn không có notification theo spec. | NTF-01 → NTF-02 cho persistence; NTF-03/04/05 cho đọc/UI/điều hướng. | Chủ động hoãn; không chặn lát reaction/comment. Không thêm notification giả hoặc stub production. |
| Matchmaking | Không có bài tìm kèo, filter recruitment, Apply/Invite. | MM-21 ← SOC-01 + SC-12; MM-22 → MM-23 cho tạo recruitment. | Query demo chỉ phục vụ FREE, không đọc bảng recruitment. SOC-05 full vẫn chờ MM-21. |
| Messaging | Không có nhắn tin/nhóm/block trong Social demo. | MSG-01 ← SOC-01; MSG-02 → MSG-03/08, thêm MM-22 cho group/block. | Không nằm trên đường găng FREE. |
| Report | Không có báo cáo hoặc evidence; chưa nghiệm thu moderation. | RP-05 ← SOC-01 + MSG-01; RP-06 ← RP-05 + SOC-05 + MSG-02; RP-08 còn chờ SOC-08 + MSG-09. | Hoãn, ẩn entry báo cáo. Không chờ RP-08 để bàn giao demo; SOC-09 full vẫn mở. |
| Booking/Payment | Không có booking gắn với bài viết. | MM-19/20, Booking/Payment; nhánh booking MM-28 còn BK-15. | Hoãn cùng recruitment, không chặn demo FREE. |
| Admin hide | Không demo kiểm duyệt, tác giả vẫn xóa được bài/comment theo quyền. | SOC-07 ← SOC-05. | Hoãn. Kiểm tra media/visibility cho soft delete vẫn bắt buộc. |
| Route | Chặn nối entry và điều hướng Social chính thức, không chặn backend hoặc component. | frontend.md vẫn ghi /feed và /posts/:postId là proposed. | Đề xuất dùng hai route này; cần xác nhận trước khi cập nhật mapping/router. Kế hoạch này không tự duyệt route. |
| Private media runtime | Thiếu root hợp lệ sẽ chặn server có media theo thiết kế. | SOC-02 ← SOC-01; PRIVATE_UPLOADS_DIR và quyền filesystem. | Cấu hình ngay khi triển khai; không fallback public uploads. |
| Dữ liệu/migration | Dữ liệu hoặc lịch sử migration không hợp lệ có thể chặn áp dụng schema. | Trạng thái DB thực tế chưa được kiểm tra trong lượt lập kế hoạch. | Kiểm tra trước migration; không reset DB hoặc sửa migration cũ. |

## Tiêu chí chấp nhận demo

- Player A đăng FREE có ảnh; refresh vẫn thấy bài, ảnh và nội dung đúng.
- Player B xem được bài, reaction và comment; retry không tạo bài/comment trùng; reaction không nhân bản.
- A sửa bài có dấu edited, thứ tự feed không đổi; ảnh bỏ khỏi bài không còn tải được qua link cũ.
- A xóa comment của mình hoặc comment trên bài mình; B không được sửa/xóa bài của A hay comment ngoài quyền.
- Xóa bài khiến detail, comment/reaction writes và ảnh của bài không còn truy cập được; không lộ lý do qua lỗi khác biệt.
- Quota/gate hoạt động theo cấu hình; mutation yêu cầu session/CSRF; Court Owner/Admin không truy cập Player endpoints.
- API test quota/concurrent retry và rollback không để dư row/file sai; GC không xóa file có row.
- Playwright desktop/mobile chạy luồng chính; trạng thái lỗi giữ draft; UI không hiện tính năng chưa nối.
- Ghi rõ: demo chưa có notification/report/recruitment, chưa phải nghiệm thu toàn module.

## Bàn giao và phạm vi kế tiếp

Mốc A: backend FREE + media + config chạy và kiểm thử được (bước 1–6).

Mốc B: UI FREE chạy luồng hai tài khoản (bước 7).

Mốc C: demo đã kiểm chứng, có hướng dẫn chạy và dữ liệu demo được tạo qua luồng hợp lệ (bước 8).

Chưa ấn định số ngày khi chưa xác nhận nhân lực và môi trường. Khi thực thi, báo tiến độ theo mốc và task nguồn; không đóng task full bằng kết quả demo. Nhánh tiếp theo sau demo: NTF để hoàn thiện SOC-06; recruitment và Messaging cho bài tìm kèo; report/Admin cho moderation.
