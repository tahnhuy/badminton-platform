# Kế hoạch chuẩn hóa dữ liệu cơ sở và thông số sân

- Ngày lập: 2026-11-24
- Cập nhật: 2026-11-24, sau khi chốt quyết định (mục 2)
- Trạng thái: Đã triển khai Giai đoạn A–E (E6 tùy chọn để sau), 2026-11-24
- Phạm vi chính: `/admin/courts`, quản lý sân của Court Owner, API và database liên quan.
- Mục tiêu: thông tin hiển thị phải có nguồn dữ liệu hoặc công thức rõ ràng; dữ liệu chưa có phải ghi “Chưa khai báo”.

## 1. Hiện trạng đã kiểm tra

### 1.1. Dữ liệu và luồng hiện có

- `backend/src/db/schema/facilities.ts`: bảng `facilities`, `courts`, `court_pricings`.
- `courts` hiện có tên, mô tả, trạng thái, cơ sở, thời điểm tạo/sửa và vô hiệu hóa; chưa có trường thông số mặt sân hay tình trạng vật lý.
- Trạng thái cơ sở và sân hiện gồm `ACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`, `REJECTED`.
- `backend/src/db/schema/court-owner.ts`: đã có khóa lịch theo ngày giờ (`court_slot_blocks`, trạng thái `ACTIVE`/`RELEASED`) và hồ sơ xét duyệt (`court_owner_reviews`).
- `court_owner_reviews` chỉ hỗ trợ `ONBOARDING`, `ADDRESS_CHANGE` (ràng buộc `chk_owner_review_kind`). Chỉ số duy nhất `uq_owner_review_pending_court` cho phép một hồ sơ chờ duyệt mỗi cặp (sân, loại).
- `OwnerCourtService` đã có tạo sân chờ duyệt, sửa sân, gửi lại hồ sơ bị từ chối và lịch sử duyệt.
- `FacilityReviewService` đã có luồng Admin duyệt/từ chối cơ sở và sân.
- Frontend Owner nằm tại `frontend/src/features/court-owner/`; đã có `MaintenanceForm` và trang lịch sân.
- Mỗi miền nghiệp vụ hiện có một bảng audit riêng: `admin_action_audits`, `finance_audit_events`, `system_config_audit`.
- `PrivateMediaService` (`backend/src/contracts/PrivateMediaService.ts`) hiện chỉ lưu ảnh JPEG/PNG/WebP, tối đa 5 MB mỗi ảnh và 4 ảnh mỗi lần. Kiểu `FILE` có trong khai báo nhưng chưa có hàm lưu tệp. Quyền đọc đi qua các resolver đăng ký theo từng loại nội dung.

### 1.2. Dữ liệu suy diễn cần loại bỏ

Trong `backend/src/services/admin/AdminFacilityService.ts`:

- Grade được suy ra từ số sân: từ 14 sân thành Grade 1, từ 6 sân thành Grade 2.
- Loại thảm được tự chia theo tỷ lệ hoặc ngưỡng số sân.
- Độ dày được gán sẵn `4.5mm`.
- Ghi chú như “Đang mở bán Slot P06”, “Flagship Arena Hub” được gán sẵn.
- Tên chủ sân mặc định `Chủ sân SmashPro` khi chưa có tên.

Trong `backend/src/repositories/facility/FacilityRepository.ts`:

- `totalBwfCourts` thực chất là tổng số sân chưa vô hiệu hóa, gồm cả sân chờ duyệt và bị từ chối.
- Yonex/PVC được chia tỷ lệ 60/40.
- `quarterGrowth` dùng 90 ngày gần nhất và fallback `4` khi kết quả bằng 0.
- `sellingRate` thực chất là tỷ lệ cơ sở hoạt động.
- `pendingViolations` luôn bằng số cơ sở đình chỉ.
- Tổng cơ sở đang đếm cả cơ sở đã vô hiệu hóa; cơ sở đã vô hiệu hóa còn bị tính là “đình chỉ”, và bộ lọc `SUSPENDED` cũng gộp chúng.
- Bộ lọc `bwfStandard` suy ra từ số sân (14 và 6).

Ở các nơi khác:

- `backend/src/db/seed.ts`: mô tả 3 cơ sở mẫu ghi “BWF Grade 2”, “Grade 1 Hub”, “thảm Yonex đạt chuẩn BWF”.
- `frontend/.../FacilityStatusModal.tsx`: lý do đình chỉ “Độ rọi sáng dưới tiêu chuẩn BWF (< 300 Lux)”; hệ thống không đo độ rọi sáng.
- `docs/features/admin/court-management/tech-design.md` còn mô tả trường `grade`.

### 1.3. Dữ liệu nhập từ Google Places

`backend/src/db/seeds/google-places-facilities.ts` đọc `backend/src/db/data/badminton-places.json` (58 địa điểm, đều ở Hồ Chí Minh). Mọi bản ghi có `placeId` và `cid` duy nhất; không có địa điểm nào đánh dấu đóng cửa. Importer hiện:

- Tạo 4 sân mỗi cơ sở (`COURTS_PER_FACILITY = 4`) với giá khởi tạo 80.000/120.000/90.000 đ, trạng thái `ACTIVE`, đặt được.
- Dùng một tài khoản chủ chung `imported.venues@smashpro.vn`, vai trò `COURT_OWNER`, mật khẩu cố định `Password@123`.
- Điền số điện thoại `0900000000` khi thiếu số, địa chỉ “TP. Hồ Chí Minh” khi thiếu địa chỉ, thành phố `Khác` khi không suy ra được.
- Chống trùng chỉ bằng tên cơ sở; không đọc `placeId`.

Số sân do seed tạo không phải số sân địa điểm xác nhận; chủ sở hữu chung không chứng minh quyền sở hữu địa điểm.

## 2. Quyết định đã chốt

Dấu (*) là mặc định theo đề xuất vì chưa có câu trả lời riêng.

| # | Quyết định |
|---|---|
| 1 | Cơ sở và sân từ importer vẫn `ACTIVE` và đặt được. Dùng chung một chủ sở hữu. Bổ sung thông số mặt sân và tiêu chuẩn (mục 5, 9). |
| 2 | Dữ liệu importer chỉ dùng cho đồ án/demo, không coi là dữ liệu thật. |
| 3 | Giữ tài khoản chủ chung với mật khẩu `Password@123`. Rủi ro được chấp nhận vì chỉ dùng cho demo; không dùng trên môi trường người ngoài truy cập được. |
| 4 | Giữ giá trị mặc định của importer (số điện thoại, địa chỉ, giá). Các bản ghi này được gắn nhãn dữ liệu nhập mẫu. |
| 5 | Chống trùng khi nhập lại bằng mã địa điểm nguồn; không ghi đè bản ghi đã được xác nhận. |
| 6 | Thêm cột nguồn dữ liệu và xác nhận sớm, trong đợt sửa thống kê (mục 4.4). |
| 7 | Cơ sở đã vô hiệu hóa không tính vào thống kê (thẻ ghi “không gồm cơ sở đã vô hiệu hóa”), nhưng danh sách mặc định vẫn hiện, có nhãn “Đã vô hiệu hóa” và bộ lọc riêng. |
| 8 | “Tổng sân” hiển thị dạng “N sân đang hoạt động”, chỉ đếm sân `ACTIVE`. |
| 9 | Chuẩn hóa tên thành phố bằng bảng ánh xạ trước khi đếm độ phủ. |
| 10 | Quý tính theo giờ Việt Nam, quy đổi múi giờ tường minh. |
| 11 | Đổi tên trường API không giữ alias: `totalCourts`, `activeFacilityRate`, `newFacilitiesThisQuarter`; xóa `grade`, `yonexCount`, `pvcCount`, `bwfStandard`. |
| 12 | Sửa cả bốn nhóm nội dung sót: mô tả `seed.ts`, lý do đình chỉ (đổi thành “Độ rọi sáng không đạt yêu cầu vận hành”), tên mặc định chủ sân (đổi thành “Chưa khai báo”), tài liệu tech-design/PRD admin. |
| 13 | Lưu lý do và người thao tác khi đình chỉ hoặc kích hoạt lại cơ sở. |
| 14 | Làm phần thông số mặt sân và tình trạng. Cập nhật PRD Court Owner để ghi rõ thay thế quyết định F08-A. |
| 15 | Giữ nhãn tình trạng “Đang bảo trì”. Chủ sân chỉ khai báo tiêu chuẩn khi sân thật sự đạt chuẩn và phải kèm bằng chứng; Admin duyệt trước khi hiển thị. Tiêu chuẩn là tùy chọn. |
| 16 (*) | Chống ghi đè đồng thời bằng cột số phiên bản `profile_version`. |
| 17 (*) | Lịch sử thay đổi chỉ lưu ở bảng `court_profile_changes`; không thêm cột người/thời điểm sửa vào `courts`. |
| 18 (*) | Chủ sân sửa thông số mặt sân và tình trạng chỉ ghi lịch sử, không cần duyệt lại. Tiêu chuẩn phải qua duyệt (mục 9). |
| 19 | Thông số và tình trạng chỉ chủ sân và Admin xem. Tiêu chuẩn đã được duyệt và còn hạn hiển thị công khai, kèm ngày duyệt. |
| 20 | Chứng nhận tiêu chuẩn là hạng mục bắt buộc của kế hoạch (mục 9), không còn là phần tùy chọn. |

## 3. Nguyên tắc nghiệp vụ

1. Không suy ra chứng nhận, loại thảm hoặc tình trạng từ quy mô sân.
2. Phân biệt trạng thái xét duyệt, đình chỉ vận hành, tình trạng vật lý và khả năng đặt sân theo thời gian.
3. Không chuyển dữ liệu chưa biết thành dữ liệu xác nhận bằng giá trị mặc định. Ngoại lệ đã chốt: giá trị mặc định của importer (quyết định 4) phải được gắn nhãn dữ liệu nhập mẫu.
4. Thông tin Owner khai báo được ghi rõ nguồn; Admin sửa phải có lý do và lịch sử.
5. Khả năng đặt sân do logic booking và lịch khóa quyết định; nhãn tình trạng không khóa booking.
6. Không tự hủy hoặc thay đổi booking đã xác nhận khi sửa tình trạng vật lý.
7. Chỉ hiển thị tiêu chuẩn (BWF và các chuẩn khác) khi có hồ sơ đã được Admin xác minh và còn hạn.
8. Nhãn “Grade” của BWF cho mặt sân không được trình bày giống “Grade” của giải đấu BWF; nhãn hiển thị phải ghi rõ đối tượng (ví dụ “Mặt sân chứng nhận BWF Grade 2”).

## 4. Giai đoạn A: sửa dữ liệu suy diễn, thống kê và thêm cột nguồn

### 4.1. Backend

- Bỏ Grade, surface summary, spec note và status note gán sẵn khỏi DTO. Đổi tên chủ sân mặc định thành “Chưa khai báo”.
- Thay `totalBwfCourts` bằng `totalCourts`; bỏ `yonexCount`, `pvcCount`; đổi `sellingRate` thành `activeFacilityRate`; đổi `quarterGrowth` thành `newFacilitiesThisQuarter`; bỏ `pendingViolations` sau khi kiểm tra consumer.
- Bỏ fallback tăng trưởng `4`.
- Bỏ tham số và logic `bwfStandard` trong repository và `validation/admin.ts`. Không giữ alias (quyết định 11).
- Tách bộ lọc trạng thái: `SUSPENDED` chỉ gồm cơ sở chưa vô hiệu hóa có `status = SUSPENDED`; thêm giá trị lọc riêng cho cơ sở đã vô hiệu hóa (`DISABLED`); các bộ lọc trạng thái còn lại chỉ lấy cơ sở chưa vô hiệu hóa.
- Thêm trường `isDisabled` vào DTO để giao diện gắn nhãn “Đã vô hiệu hóa”.
- Đình chỉ và kích hoạt lại: nhận lý do và người thao tác, ghi bảng audit (mục 4.5) trong cùng transaction với việc đổi trạng thái.
- Rà soát Excel và các consumer API trước khi đổi/bỏ trường.

### 4.2. Định nghĩa thống kê

| Chỉ số | Quy tắc |
|---|---|
| Tổng cơ sở | `deleted_at IS NULL` |
| Cơ sở hoạt động | Thuộc tổng cơ sở và `status = ACTIVE` |
| Cơ sở đình chỉ | Thuộc tổng cơ sở và `status = SUSPENDED` |
| Tổng sân đang hoạt động | Sân `status = ACTIVE`, `deleted_at IS NULL`, thuộc cơ sở `ACTIVE` chưa vô hiệu hóa. Hiển thị “N sân đang hoạt động”. |
| Độ phủ tỉnh/thành | Số thành phố phân biệt sau khi chuẩn hóa tên bằng bảng ánh xạ, trong phạm vi tổng cơ sở |
| Cơ sở mới trong quý | Cơ sở trong phạm vi tổng cơ sở, tạo trong quý theo Asia/Ho_Chi_Minh |
| Tỷ lệ cơ sở hoạt động | Hoạt động / tổng cơ sở; tổng bằng 0 thì trả 0 |

- Quý tính từ đầu quý đến đầu quý tiếp theo theo giờ Việt Nam. `created_at` là `timestamp` không múi giờ, nên phải xác định múi giờ đang lưu (nhiều khả năng UTC) rồi quy đổi tường minh bằng `AT TIME ZONE`.
- Bảng ánh xạ tên thành phố đặt ở một chỗ dùng chung cho thống kê và bộ lọc thành phố. Dữ liệu seed hiện nhất quán (“Hồ Chí Minh”, “Hà Nội”); bảng ánh xạ để xử lý các biến thể do chủ sân nhập tay.
- Các số trên phản ánh bản ghi hệ thống, gồm cả bản ghi nhập mẫu. Thẻ thống kê hiển thị thêm số bản ghi nhập mẫu trong tổng (dựa trên cột nguồn ở mục 4.4).

### 4.3. Frontend Admin

- “Sân thi đấu chuẩn BWF” → “Tổng số sân”, hiển thị “N sân đang hoạt động”.
- “N sân đạt chuẩn” → “N sân”.
- “Tỷ lệ mở bán” → “Tỷ lệ cơ sở hoạt động”.
- Thẻ “Tổng cơ sở” ghi “không gồm cơ sở đã vô hiệu hóa”. Dòng bị vô hiệu hóa trong bảng có nhãn “Đã vô hiệu hóa”. Danh sách mặc định vẫn hiện các dòng này và có bộ lọc riêng.
- Bỏ cột và bộ lọc BWF dựa trên số sân. Bộ lọc tiêu chuẩn thật được thêm lại ở giai đoạn E.
- Bỏ thông tin thảm và ghi chú không có nguồn.
- Đổi nhãn phân trang thành “cụm sân”.
- Giữ một nơi thể hiện tổng kết quả lọc; số dưới bảng theo bộ lọc hiện tại, thẻ thống kê ghi rõ toàn hệ thống.
- Đổi lý do đình chỉ “Độ rọi sáng dưới tiêu chuẩn BWF (< 300 Lux)” thành “Độ rọi sáng không đạt yêu cầu vận hành”. Bảo đảm người dùng vẫn đọc được chính sách đình chỉ trước khi xác nhận.

### 4.4. Cột nguồn dữ liệu và xác nhận

Một migration nhỏ thêm vào `facilities` và `courts`:

| Cột | Quy tắc |
|---|---|
| `data_source` | `OWNER_DECLARED`, `ADMIN_ENTERED`, `GOOGLE_PLACES_IMPORT`, `DEMO_SEED`; NULL là chưa rõ nguồn |
| `source_ref` | Mã tham chiếu nguồn, ví dụ `placeId` của Google Places |
| `confirmed_at`, `confirmed_by` | Thời điểm và người xác nhận dữ liệu; NULL là chưa xác nhận |

- Nguồn nhập và mức xác nhận là hai khái niệm riêng; Google Places không đồng nghĩa đã được Owner xác nhận.
- Chỉ backfill khi có bằng chứng: cơ sở có `owner_id` là tài khoản `imported.venues@smashpro.vn` và các sân của cơ sở đó được gán `GOOGLE_PLACES_IMPORT`. Ba cơ sở trong `seed.ts` gán `DEMO_SEED`. Không đoán nguồn cho bản ghi khác.
- Giao diện Admin hiển thị nhãn “Dữ liệu nhập mẫu (chưa xác nhận)” cho bản ghi chưa có `confirmed_at` và có nguồn `GOOGLE_PLACES_IMPORT` hoặc `DEMO_SEED`.

### 4.5. Audit đình chỉ cơ sở

Bảng audit riêng cho thay đổi trạng thái cơ sở (theo mẫu mỗi miền một bảng): cơ sở, người thao tác, trạng thái trước/sau, mã lý do, ghi chú, thời điểm. Hiện `updateFacilityStatus(id, status, _actorId)` không dùng người thao tác và không nhận lý do, dù hộp thoại bắt buộc chọn lý do.

### 4.6. Nội dung sót

- Viết lại mô tả 3 cơ sở trong `seed.ts` theo hướng trung tính, không nhắc BWF, Grade, Yonex.
- Cập nhật `docs/features/admin/court-management/prd.md` và `tech-design.md` theo DTO mới.
- Cập nhật PRD Court Owner (mục F08, F09) và `docs/architecture/frontend.md` (bảng quyết định ở dòng nhắc F08–F09) để ghi nhận quyết định mới (mục 5, 9).

## 5. Giai đoạn B: dữ liệu thông số và tình trạng sân

Quyết định 14 thay thế phương án F08-A của PRD Court Owner. Phần này chỉ triển khai sau khi PRD đã được cập nhật.

### 5.1. Thông số từng sân

Mở rộng `courts`, tên và danh mục cuối cùng chốt khi triển khai:

| Trường | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `surface_type` | varchar nullable | Danh mục vật liệu: PVC, gỗ, PU/acrylic, khác; không phải thương hiệu |
| `surface_brand` | varchar nullable | Thương hiệu do người khai báo cung cấp |
| `surface_model` | varchar nullable | Dòng sản phẩm |
| `surface_thickness_mm` | decimal nullable | Lớn hơn 0, giới hạn và precision thống nhất khi triển khai |
| `condition` | varchar nullable | `NORMAL`, `NEEDS_MAINTENANCE`, `UNDER_MAINTENANCE`; NULL là chưa khai báo |
| `condition_note` | text nullable | Bắt buộc nếu cần/đang bảo trì |
| `profile_version` | integer not null default 0 | Tăng sau mỗi lần sửa thông số/tình trạng; dùng chống ghi đè (mục 6.1) |

- Không thêm cột người/thời điểm cập nhật vào `courts`; thông tin “cập nhật gần nhất” lấy từ bản ghi mới nhất của bảng lịch sử.
- Validate enum và ràng buộc số/ghi chú ở cả API và database (CHECK) khi phù hợp.
- Chuỗi rỗng được chuẩn hóa thành NULL; phân biệt PATCH bỏ qua trường và chủ động xóa dữ liệu.
- Không đặt tất cả sân cũ thành `NORMAL` hoặc một thương hiệu mặc định.
- Không yêu cầu độ dày nếu chủ sân không có thông tin chính xác.
- `condition` là nhãn khai báo. Khi nhãn là `UNDER_MAINTENANCE` mà không có khối khóa `ACTIVE` nào đang hiệu lực cho sân, giao diện hiển thị cảnh báo “Đã khai báo bảo trì nhưng chưa có lịch khóa”.

### 5.2. Lịch sử thay đổi

Bảng `court_profile_changes`:

- `id`, `court_id`, `actor_id`, `created_at`.
- `change_type`: thông số hoặc tình trạng.
- `before_values`, `after_values`: snapshot có cấu trúc, chỉ các trường được phép.
- `reason`: bắt buộc với Admin chỉnh sửa; ghi chú phù hợp cho Owner.
- Lưu thay đổi, tăng `profile_version` và ghi lịch sử trong cùng transaction; chỉ tạo lịch sử khi giá trị thực sự thay đổi.
- Phân trang lịch sử; chỉ Owner của sân và Admin được đọc.
- Dùng bảng audit riêng, nhất quán với các miền khác; không dùng `admin_action_audits` (dành cho thao tác tài khoản người dùng).

## 6. Giai đoạn C: API, quyền truy cập và màn hình

### 6.1. API Owner

Mở rộng endpoint tạo/sửa sân hiện có cho thông số; dùng luồng riêng hoặc payload rõ ràng cho tình trạng.

- Kiểm tra sân thuộc cơ sở của Owner tại backend.
- Giữ quy tắc sân chờ duyệt không được sửa trái luồng hiện tại.
- Owner không được gửi `reviewedBy`, trạng thái xác minh, người cập nhật hoặc thời gian cập nhật.
- Chống ghi đè đồng thời: client gửi `profile_version` đã đọc; backend cập nhật có điều kiện `WHERE profile_version = $1`, lệch thì trả lỗi xung đột. Không dùng `updated_at` làm phiên bản.
- Lưu thay đổi và audit cùng transaction; dùng cách khóa nhất quán với service hiện có.
- Trả dữ liệu sau lưu, `profile_version` mới và nguồn khai báo.
- Cung cấp lịch sử có page/limit và thứ tự ổn định.

### 6.2. API Admin

- Chi tiết cơ sở trả thông số, tình trạng và tiêu chuẩn đã xác minh của từng sân.
- API cập nhật thông số/tình trạng kiểm tra quyền Admin và bắt buộc lý do.
- API danh sách trả tổng hợp số sân theo tình trạng, gồm nhóm chưa khai báo.
- Filter mặt sân/tình trạng/tiêu chuẩn: khớp cơ sở nếu có ít nhất một sân còn hiệu lực khớp; không đếm trùng cơ sở.
- Tổng hợp theo tập dữ liệu, tránh N+1 query.
- DTO, validation, type frontend và Excel cập nhật đồng bộ.

### 6.3. Quan hệ với booking và bảo trì

- Tái sử dụng `court_slot_blocks` và `MaintenanceForm`, không tạo hệ thống khóa lịch thứ hai.
- Nhãn tình trạng vật lý mang tính khai báo; lịch khóa mới quyết định khoảng thời gian không được đặt.
- Khi chọn “Đang bảo trì”, form hướng dẫn tạo/chọn lịch khóa và nêu rõ nhãn đơn thuần không khóa booking.
- Tạo lịch khóa phải giữ cách kiểm tra xung đột booking hiện có.
- Không tự giải phóng lịch khóa khi đổi tình trạng về bình thường; người dùng cần thao tác rõ ràng với khoảng khóa.
- Không hiển thị “Đang mở bán” chỉ vì cơ sở `ACTIVE`; nếu chưa có phép tính chính xác thì không hiển thị nhãn này.

### 6.4. Court Owner: `/owner/facilities`

- Tái sử dụng form tạo/sửa sân hiện có.
- Nhóm thông tin cơ bản: tên, mô tả.
- Nhóm mặt sân: vật liệu, thương hiệu, dòng sản phẩm, độ dày.
- Nhóm tình trạng: tình trạng và ghi chú, người/thời điểm cập nhật gần nhất (từ lịch sử).
- Nhóm tiêu chuẩn (mục 9): danh sách tiêu chuẩn đã khai báo và trạng thái duyệt; nút khai báo tiêu chuẩn mới.
- Hiển thị “Chưa khai báo” cho dữ liệu cũ; cho phép bổ sung từng sân.
- Có liên kết tới lịch bảo trì và lịch sử cập nhật.
- Thông số do Owner khai báo không tự được trình bày thành thông tin đã chứng nhận.

### 6.5. Admin: `/admin/courts`

Bảng gọn gồm cơ sở/địa chỉ/mã, chủ sở hữu/liên hệ, tổng sân, phân bố tình trạng, trạng thái cơ sở, nhãn nguồn dữ liệu và thao tác.

- Đưa thông số chi tiết vào màn hình/khối chi tiết từng sân.
- Cho phép Admin chỉnh sửa kèm lý do.
- Hiển thị nguồn, thời điểm cập nhật và lịch sử.
- Tình trạng vật lý, trạng thái duyệt và đình chỉ được trình bày riêng.
- Không thêm tất cả thông số vào bảng tổng gây tràn ngang.

### 6.6. Hồ sơ xét duyệt sân mới

- Sân mới tiếp tục dùng `ONBOARDING`; snapshot phải gồm các trường thông số mới nếu người dùng khai báo.
- Tình trạng vật lý thông thường không cần thành một hồ sơ duyệt mới.
- Tiêu chuẩn đi qua luồng riêng (mục 9), không đi qua `court_owner_reviews`.

## 7. Giai đoạn D: dữ liệu Google Places và seed

Importer giữ hành vi tạo sân đặt được với giá mặc định (quyết định 1, 3, 4). Việc cần làm:

1. Kiểm kê số cơ sở/sân do importer tạo, giá mặc định và dữ liệu có booking phụ thuộc.
2. Đánh dấu `data_source = GOOGLE_PLACES_IMPORT` và `source_ref = placeId` khi tạo; ghi rõ số sân và giá do seed tạo chưa được địa điểm xác nhận. Mở rộng `RawPlace` để đọc `placeId`.
3. Thay cách chống trùng từ so tên bằng so `source_ref`. Với bản ghi cũ chưa có `source_ref`, đối chiếu tên và địa chỉ chuẩn hóa rồi cập nhật `source_ref`.
4. Chạy lại không ghi đè thông tin đã có `confirmed_at` hoặc đã được Owner/Admin cập nhật; có chế độ dry-run và báo cáo bản ghi nhập/bỏ qua/xung đột.
5. Chỉ dùng các trường thực sự có trong nguồn; không suy ra tình trạng, vật liệu hay chứng nhận.
6. Quy trình xác nhận dữ liệu/tiếp nhận quản lý bởi Owner riêng; không tự chuyển quyền sở hữu chỉ từ tên địa điểm. Khi Owner tiếp nhận, ghi `confirmed_at`/`confirmed_by`.
7. Không xóa hàng loạt sân mẫu đã liên quan booking; lập danh sách và phương án hiệu chỉnh riêng có kiểm tra phụ thuộc.
8. Tài khoản chủ chung giữ nguyên; ghi chú trong tài liệu importer rằng chỉ dùng cho môi trường demo.

## 8. Quy trình migration và triển khai

1. Chụp số liệu trước thay đổi; kiểm tra consumer API và dữ liệu phụ thuộc.
2. Tạo migration mới theo số thứ tự tiếp theo tại thời điểm triển khai (hiện mới nhất là `0034`); không sửa migration đã áp dụng. Chạy `backend/scripts/verify-migrations.mjs`.
3. Migration bổ sung cột nullable, constraint, bảng audit và index cần thiết; tách thành nhiều migration theo giai đoạn.
4. Không backfill dữ liệu ước tính thành dữ liệu thực tế; chỉ backfill nguồn theo mục 4.4.
5. Chạy thử migration trên database test có dữ liệu cũ.
6. Chạy migration trước khi bật backend dùng cột mới.
7. Triển khai backend và frontend đồng bộ; vì không giữ alias (quyết định 11), hai bên phải phát hành cùng đợt.
8. Xác minh thống kê, quyền truy cập, tạo/sửa sân, review, lịch bảo trì và hiển thị tiêu chuẩn.
9. Theo dõi lỗi API, validation, truy vấn chậm và bản ghi thiếu dữ liệu.
10. Khi rollback ứng dụng, ưu tiên giữ schema bổ sung và dữ liệu mới; không tự drop cột/bảng audit. Việc khôi phục dữ liệu cần phương án riêng.

## 9. Giai đoạn E: chứng nhận tiêu chuẩn mặt sân

### 9.1. Nguyên tắc

Chứng nhận gắn với sản phẩm mặt sân, không gắn với quy mô cơ sở. Ví dụ BWF chứng nhận theo nhãn hiệu và hạng của sản phẩm, chứng chỉ có thời hạn và phân biệt loại dùng làm bề mặt sân (A) với loại chỉ dùng làm lớp nền (B). Vì vậy:

- Khai báo tiêu chuẩn cho một sân bắt buộc có `surface_brand` và `surface_model`.
- Chủ sân khai báo tùy chọn, chỉ khi sân thật sự đạt chuẩn và kèm bằng chứng.
- Admin duyệt trước khi tiêu chuẩn được hiển thị công khai.
- Không dùng lại Grade suy theo quy mô.

### 9.2. Danh mục tiêu chuẩn (đợt đầu)

| Mã | Tiêu chuẩn | Áp dụng cho | Ghi chú |
|---|---|---|---|
| `BWF_GRADE_1` | BWF Grade 1 (International Elite) | Mặt sân | Chứng nhận sản phẩm, có thời hạn; đối chiếu danh sách BWF Equipment Approval Scheme |
| `BWF_GRADE_2` | BWF Grade 2 (International Standard) | Mặt sân | Như trên |
| `EN_14904` | EN 14904 | Mặt sân | Tiêu chuẩn châu Âu cho sàn thể thao trong nhà (hấp thụ lực, ma sát, biến dạng đứng) |
| `DIN_18032_2` | DIN 18032-2 | Mặt sân | Tiêu chuẩn Đức cho sàn nhà thể thao; vẫn được chứng chỉ BWF tham chiếu |
| `ASTM_F2772` | ASTM F2772 | Mặt sân | Tiêu chuẩn Mỹ cho hiệu năng sàn thể thao trong nhà |

- Danh mục lưu trong bảng (mã, tên hiển thị, đối tượng áp dụng, có yêu cầu hạn hay không, đang bật hay tắt) và nạp bằng migration. Thêm tiêu chuẩn mới không cần sửa code logic. Giao diện Admin quản lý danh mục là hạng mục mở rộng nếu cần.
- Chủ sân chọn trong danh mục, không nhập tự do. Một sân có thể có nhiều tiêu chuẩn.
- Ngoài đợt đầu: EN 12193 (chiếu sáng, áp dụng cho cơ sở, cần báo cáo đo hiện trường). Chưa có tiêu chuẩn TCVN nào được xác minh cho mặt sân cầu lông; không đưa vào danh mục cho đến khi có tên và số hiệu cụ thể.
- Thông tin về các tiêu chuẩn này tham khảo từ trang của BWF và nhà sản xuất; chưa đối chiếu với văn bản tiêu chuẩn gốc.

### 9.3. Dữ liệu hồ sơ

Bảng riêng `court_standard_claims`, không mở rộng `court_owner_reviews`: ràng buộc loại và chỉ số duy nhất “một hồ sơ chờ duyệt mỗi cặp (sân, loại)” không cho phép nhiều tiêu chuẩn chờ duyệt trên cùng một sân.

- `id`, `court_id`, `standard_code`, `status`, `submitted_by`, `created_at`.
- Snapshot `surface_brand`, `surface_model` tại thời điểm nộp.
- `issuer`, `reference_no`, `issued_at`, `expires_at` (bắt buộc nếu tiêu chuẩn yêu cầu hạn).
- `reviewed_by`, `reviewed_at`, `rejection_reason`.
- Trạng thái: `PENDING`, `VERIFIED`, `REJECTED`, `INVALIDATED`. “Hết hạn” được tính từ `expires_at`, không cần trạng thái riêng.
- Bảng nối hồ sơ với tệp bằng chứng.
- Ràng buộc CHECK tương tự `court_owner_reviews`: trạng thái quyết định phải có người duyệt, thời điểm duyệt; từ chối phải có lý do.
- Chỉ mục duy nhất: một hồ sơ `PENDING` hoặc `VERIFIED` mỗi cặp (sân, tiêu chuẩn).

### 9.4. Bằng chứng

- Đợt đầu bằng chứng là ảnh (nhãn sản phẩm đã lắp, trang chứng chỉ hoặc báo cáo thử nghiệm), dùng `PrivateMediaService.storeImages` (JPEG/PNG/WebP, tối đa 5 MB mỗi ảnh, 4 ảnh mỗi lần). Cần thêm resolver quyền đọc riêng cho bằng chứng: chủ sân và Admin được đọc, không có URL công khai.
- Hỗ trợ PDF cần mở rộng `PrivateMediaService` (hiện chưa có hàm lưu tệp), kể cả kiểm tra định dạng và kích thước; để thành hạng mục riêng khi cần.
- Ảnh chỉ chứng minh việc lắp đặt; hồ sơ phải có chứng chỉ hoặc báo cáo thử nghiệm (dạng ảnh chụp trang) cùng đơn vị cấp và số tham chiếu.
- Với BWF: Admin đối chiếu nhãn hiệu, dòng sản phẩm, hạng và thời hạn với danh sách BWF; chứng chỉ phải thuộc loại dùng làm bề mặt sân (loại A); lưu ý BWF yêu cầu thảm đặt trên sàn gỗ đàn hồi hoặc nền tương đương.
- Duyệt hoặc từ chối phải có lý do, thời gian và lưu lịch sử; thông báo cho chủ sân qua `NotificationService`.

### 9.5. Hiển thị và vòng đời

- Công khai chỉ hiển thị tiêu chuẩn `VERIFIED` còn hạn, kèm ngày duyệt. Nhãn ghi rõ đối tượng, ví dụ “Mặt sân chứng nhận BWF Grade 2 (International Standard)”.
- Hết hạn: nhãn tự ẩn; gửi thông báo cho chủ sân trước và khi hết hạn.
- Sửa `surface_brand` hoặc `surface_model` của sân đã có hồ sơ `VERIFIED` hoặc `PENDING`: hồ sơ chuyển `INVALIDATED`, chủ sân cần nộp lại. Giao diện cảnh báo trước khi lưu.
- Sửa nội dung hồ sơ đã xác minh tạo yêu cầu mới; không giữ trạng thái xác minh cho nội dung mới.
- Bộ lọc tiêu chuẩn của Admin dựa trên hồ sơ `VERIFIED` còn hạn; lọc theo cơ sở và không đếm trùng.
- Admin thấy hồ sơ chờ duyệt trong màn hình duyệt hiện có hoặc tab riêng; chọn khi triển khai.

## 10. Kiểm thử cần có

| Nhóm | Trường hợp trọng tâm |
|---|---|
| Thống kê | 0 cơ sở; cơ sở/sân vô hiệu hóa; sân `ACTIVE` thuộc cơ sở đình chỉ; sân chờ duyệt không tính; tỷ lệ không chia 0; thẻ ghi đúng phạm vi |
| Thời gian | Đầu/cuối quý, đổi năm, ranh giới theo giờ Việt Nam |
| Bộ lọc trạng thái | `SUSPENDED` không gồm cơ sở đã vô hiệu hóa; lọc riêng “Đã vô hiệu hóa”; danh sách mặc định vẫn hiện |
| Migration | Database cũ nâng cấp được; dữ liệu cũ vẫn đọc/sửa được; backfill nguồn chỉ cho bản ghi có bằng chứng |
| Validation | Enum sai, số âm/0, chuỗi quá dài, ghi chú thiếu, PATCH xóa/bỏ qua |
| Phân quyền | Owner khác bị chặn; không tự xác minh; Admin phải có lý do |
| Lịch sử | Before/after đúng, transaction rollback đồng bộ, không tạo audit cho no-op |
| Đồng thời | Hai lần lưu cùng `profile_version`: lần sau bị báo xung đột |
| Đình chỉ cơ sở | Lưu lý do và người thao tác; rollback đồng bộ |
| Review | Tạo sân, snapshot, từ chối, gửi lại, duyệt vẫn đúng |
| Bảo trì | Xung đột booking; nhãn tình trạng không tự hủy booking/giải phóng khóa; cảnh báo khi có nhãn bảo trì nhưng không có khóa |
| Danh sách | Filter không trùng cơ sở, total đúng, phân trang ổn định |
| Excel | Cùng phạm vi lọc và dữ liệu với UI; chưa khai báo không biến thành 0 |
| Import | Chạy lại an toàn theo `placeId`; không ghi đè bản ghi đã xác nhận; dry-run không ghi dữ liệu |
| Tiêu chuẩn | Duyệt/từ chối, thiếu thương hiệu/dòng sản phẩm bị chặn, sửa thương hiệu làm hồ sơ mất hiệu lực, hết hạn ẩn nhãn, quyền đọc bằng chứng, một hồ sơ hiệu lực mỗi (sân, tiêu chuẩn) |

## 11. Checklist công việc

Giai đoạn A: sửa dữ liệu suy diễn, thống kê, cột nguồn
- [x] A1: Chốt múi giờ lưu `created_at` và bảng ánh xạ tên thành phố.
- [x] A2: Migration cột nguồn (`data_source`, `source_ref`, `confirmed_at`, `confirmed_by`) và backfill có bằng chứng.
- [x] A3: Sửa repository/service: bỏ dữ liệu suy diễn, tách bộ lọc trạng thái, thêm `isDisabled`, đổi tên trường.
- [x] A4: Bảng audit và lưu lý do/người thao tác khi đình chỉ hoặc kích hoạt lại.
- [x] A5: Cập nhật Admin (thẻ, bảng, bộ lọc, nhãn), DTO, Excel.
- [x] A6: Sửa nội dung sót: `seed.ts`, lý do đình chỉ, tên mặc định, tài liệu admin.
- [x] A7: Cập nhật PRD Court Owner (F08, F09) và `docs/architecture/frontend.md`.

Giai đoạn B: thông số và tình trạng
- [x] B1: Chốt danh mục vật liệu và giới hạn độ dày.
- [x] B2: Migration thông số, `profile_version`, bảng `court_profile_changes`.

Giai đoạn C: API và form
- [x] C1: API Owner/Admin, validation, transaction, phân quyền, xung đột phiên bản.
- [x] C2: Form Owner, chi tiết Admin và lịch sử.
- [x] C3: Tổng hợp/filter theo thông số và tình trạng.
- [x] C4: Tích hợp đường dẫn tới luồng khóa lịch và cảnh báo nhãn bảo trì.

Giai đoạn D: importer
- [x] D1: Kiểm kê dữ liệu seed/import và booking phụ thuộc.
- [x] D2: Importer đọc `placeId`, chống trùng theo `source_ref`, dry-run và báo cáo.
- [x] D3: Importer bảo vệ dữ liệu đã xác nhận; Owner gửi yêu cầu tiếp nhận, Admin xác minh/chuyển quyền, Owner đối chiếu và xác nhận cơ sở/sân/giá/giờ hoạt động để ghi `confirmed_at/confirmed_by`. Không xóa sân, giá hoặc booking phụ thuộc.

Giai đoạn E: tiêu chuẩn
- [x] E1: Migration danh mục tiêu chuẩn, `court_standard_claims`, bảng nối bằng chứng.
- [x] E2: Resolver quyền đọc bằng chứng cho `PrivateMediaService`.
- [x] E3: API Owner nộp hồ sơ; API Admin duyệt/từ chối; thông báo.
- [x] E4: Form khai báo tiêu chuẩn (Owner), màn duyệt (Admin), hiển thị công khai và bộ lọc.
- [x] E5: Xử lý hết hạn và mất hiệu lực khi đổi thương hiệu/dòng sản phẩm.
- [ ] E6 (tùy chọn, chưa làm): Hỗ trợ PDF cho bằng chứng; giao diện quản lý danh mục; EN 12193.

Nghiệm thu
- [x] V1: Kiểm thử có mục tiêu, typecheck/build và migration test.
- [~] V2: Nghiệm thu trên dữ liệu cũ và dữ liệu khai báo mới.

## 12. Tiêu chí nghiệm thu

- Không còn Grade, thương hiệu, độ dày hoặc ghi chú vận hành tự sinh từ số sân; không còn tên chủ sân mặc định giả.
- Giá trị 0 được giữ đúng; thống kê có cùng phạm vi và cách tính được mô tả; thẻ ghi rõ phạm vi.
- Dữ liệu chưa khai báo hiển thị đúng, không bị gán mặc định thành thông tin xác nhận.
- Bản ghi seed/import có nhãn nguồn và được phân biệt với dữ liệu đã xác nhận.
- Owner chỉ cập nhật sân của mình; Admin chỉnh sửa có lý do và lịch sử; đình chỉ cơ sở có lý do và người thao tác.
- Booking, lịch khóa, xét duyệt và dữ liệu cũ tiếp tục hoạt động.
- Các trường hiển thị và xuất Excel có nguồn hoặc công thức truy được.
- Chỉ hiển thị tiêu chuẩn đã được Admin xác minh, còn hạn và có bằng chứng; không còn hiển thị BWF suy từ số sân.

## 13. Việc còn mở

Chốt trước migration/form tương ứng. Các mục này không cản trở giai đoạn A.

- Danh mục vật liệu mặt sân và giới hạn hợp lý của độ dày (B1).
- Có hỗ trợ bằng chứng PDF ngay đợt đầu hay chỉ ảnh (hiện chọn ảnh, mục 9.4).
- Màn hình duyệt tiêu chuẩn: tab riêng hay dùng màn hình duyệt hiện có.
- Cách xử lý sân mẫu đã có booking và cách tách khỏi báo cáo vận hành (D1, D3).
- Có cần Admin quản lý danh mục tiêu chuẩn qua giao diện hay chỉ qua migration.


## 14. Nhật ký triển khai Giai đoạn A (2026-11-24)

- A1: `created_at` là `timestamp` không múi giờ do phiên UTC ghi; quý tính bằng mốc UTC tường minh quy đổi từ Asia/Ho_Chi_Minh (`backend/src/shared/facility/quarter.ts`). Bảng ánh xạ thành phố dùng chung ở `backend/src/shared/facility/city.ts`.
- A2: Migration `0035_amazing_callisto.sql` thêm cột nguồn/xác nhận và `facility_status_audits`; backfill chỉ theo bằng chứng (email importer, tên 3 cơ sở seed).
- A3: Bỏ Grade/surface/spec/status note và các trường suy diễn; thống kê theo mục 4.2; bộ lọc `DISABLED` tách khỏi `SUSPENDED`; DTO thêm `isDisabled`, `dataSource`, `confirmedAt`.
- A4: Đình chỉ/kích hoạt ghi `facility_status_audits` cùng transaction; chỉ ghi khi trạng thái thực sự đổi.
- A5: Thẻ thống kê, bảng, bộ lọc, nhãn “Đã vô hiệu hóa”, nhãn dữ liệu nhập mẫu, phân trang “cụm sân” và Excel đã cập nhật; bộ lọc BWF tạm bỏ.
- A6: Mô tả seed trung tính; lý do đình chỉ đổi thành “Độ rọi sáng không đạt yêu cầu vận hành”; tên chủ sân mặc định “Chưa khai báo”.
- A7: PRD/tech-design Admin, PRD Court Owner (§8.3 thay F08-A) và `docs/architecture/frontend.md` đã cập nhật.
- Kiểm chứng: `npx tsc --noEmit` (backend), `npx tsc -b` + `vite build` (frontend), `npm run lint` (pass `check:ui`), `npm run verify:migrations`, `vitest` cho `admin-facilities` và `google-places-seed`.
- Giai đoạn B–E: chưa triển khai; các mục §13 vẫn cần chốt trước migration/form tương ứng.


## 15. Nhật ký triển khai Giai đoạn B–E (2026-11-24)

- B1: Danh mục vật liệu `PVC`, `WOOD`, `PU_ACRYLIC`, `OTHER`; độ dày `decimal(4,1)`, lớn hơn 0 và tối đa 50 mm. Tình trạng `NORMAL`, `NEEDS_MAINTENANCE`, `UNDER_MAINTENANCE`.
- B2: Migration `0036_brown_invisible_woman.sql` thêm cột hồ sơ, `profile_version`, `court_profile_changes`, CHECK/index.
- C1: Owner `PUT /api/v1/owner/courts/:id/profile` (chống ghi đè theo `profileVersion`), lịch sử `GET .../profile-changes`; Admin `PATCH /api/v1/admin/facilities/:facilityId/courts/:courtId/profile` bắt buộc lý do và lịch sử tương ứng. Ghi lịch sử và tăng version trong cùng transaction; no-op không ghi.
- C2: Form thông số/tình trạng và lịch sử ở Owner; hộp thoại thông số sân + lịch sử ở Admin (`/admin/courts`).
- C3: Bộ lọc `condition`/`surfaceType` dùng `EXISTS`, không nhân bản cơ sở; DTO danh sách có `conditionSummary`.
- C4: Cảnh báo “khai báo bảo trì nhưng chưa có lịch khóa đang hiệu lực” dựa trên `court_slot_blocks` hiện tại; không tự tạo/giải phóng khóa.
- D1: Kiểm kê qua seed/importer hiện có; importer gắn `data_source`/`source_ref` và không ghi đè bản ghi đã xác nhận.
- D2: Chống trùng theo `source_ref`, ghép legacy theo tên + địa chỉ chuẩn hóa, hỗ trợ `dryRun` và báo cáo `legacyMatched`; seed chỉ chạm 3 cơ sở demo.
- E1: Migration `0037_naive_black_bird.sql`: danh mục tiêu chuẩn, `court_standard_claims`, `court_standard_evidence`, ràng buộc trạng thái/quyết định và unique một hồ sơ hiệu lực mỗi (sân, tiêu chuẩn).
- E2: Resolver `court-standard-evidence` chỉ cho Owner sở hữu và Admin đọc ảnh; không có URL công khai.
- E3: API Owner gửi hồ sơ (multipart ảnh + metadata), API Admin danh sách/duyệt/từ chối, thông báo cho Owner.
- E4: Form Owner trong trang cơ sở, trang Admin `/admin/standards`, hiển thị công khai trong chi tiết cơ sở của Player (chỉ hồ sơ `VERIFIED` còn hạn, kèm ngày duyệt).
- E5: Hết hạn tự ẩn khỏi hiển thị công khai; đổi thương hiệu/dòng sản phẩm chuyển hồ sơ `PENDING`/`VERIFIED` sang `INVALIDATED`.
- Kiểm chứng: `court-profile` (4), `court-standards` (3), `admin-facilities` (20), `owner-management` (9), `owner-schedule`, `booking-availability`, `booking-confirm-match-facility`; typecheck/build và `verify:migrations` (38 migrations).
- Chưa làm: E6 (PDF, UI quản lý danh mục, EN 12193), kiểm thử tải/nghiệm thu thủ công trên dữ liệu cũ quy mô lớn (V2).


## 17. Hoàn thiện D3: tiếp nhận và xác nhận dữ liệu nhập

### 17.1. Quy trình

1. Owner gửi ID cơ sở và thông tin chứng minh quyền quản lý trên `/owner/facilities`.
2. Admin xem yêu cầu tại `/admin/courts`, kiểm tra bằng chứng và liên hệ xác minh ngoài hệ thống; nhập lý do để duyệt/từ chối.
3. Duyệt chỉ chuyển `owner_id`, không tự ghi xác nhận. Từ chối không chuyển quyền. Mỗi cơ sở chỉ có một yêu cầu đang chờ hoặc đã duyệt nhưng chưa xác nhận.
4. Owner đã được duyệt xem bản đối chiếu gồm địa chỉ, giờ hoạt động, danh sách sân và toàn bộ mức giá; sửa dữ liệu/giá nếu chưa đúng rồi tải lại bản đối chiếu.
5. Owner xác nhận rõ ràng bản dữ liệu đã xem. Backend khóa cơ sở/sân/giá và so với dữ liệu hiện tại; nếu có thay đổi trả 409 để tải lại.
6. Xác nhận ghi `confirmed_at`/`confirmed_by` vào cơ sở và các sân chưa vô hiệu hóa, cùng trạng thái CONFIRMED của yêu cầu trong một transaction. Không đổi `data_source`, trạng thái duyệt hoặc đình chỉ.
7. Giữ quyết định demo ở mục 2: dữ liệu nhập vẫn đặt được theo quy tắc hiện có; tiếp nhận không thêm điều kiện chặn booking demo.

### 17.2. API

- Owner: `GET/POST /api/v1/owner/facility-handovers`.
- Owner: `GET /api/v1/owner/facility-handovers/:id/preview`.
- Owner: `POST /api/v1/owner/facility-handovers/:id/confirm`, bắt buộc `acknowledged: true` và snapshot vừa kiểm tra.
- Admin: `GET /api/v1/admin/facilities/handovers`.
- Admin: `POST /api/v1/admin/facilities/handovers/:id/decision`, quyết định và lý do bắt buộc.
- Owner chỉ xem yêu cầu của mình; preview/confirm chỉ cho yêu cầu đã được duyệt và cơ sở vẫn thuộc Owner đó.
- Bảng `facility_handovers` lưu Owner cũ/mới, thông tin chứng minh, quyết định, Admin, lý do và thời điểm. Migration: `0038_mysterious_mephistopheles.sql`.

### 17.3. Importer

- Đối chiếu mã nguồn trong phạm vi GOOGLE_PLACES_IMPORT.
- Nhánh dữ liệu cũ đọc `confirmed_at` thật; chuẩn hóa hoa/thường và khoảng trắng trong tên rồi đối chiếu địa chỉ chuẩn hóa.
- Nhiều ứng viên gần nhau: dừng báo lỗi thay vì tự chọn hoặc ghi đè.
- Chỉ bổ sung source_ref còn thiếu cho dữ liệu import chưa xác nhận; điều kiện được kiểm tra lại ngay trong câu UPDATE để bảo vệ khi có thao tác đồng thời.
- Không cập nhật nội dung, quyền sở hữu, sân, giá hoặc booking của bản ghi đã tồn tại.

### 17.4. Kiểm chứng

- `facility-handover.test.ts`: duyệt/từ chối, phân quyền, yêu cầu trùng, xác nhận hai bước, snapshot giá thay đổi, đọc đúng confirmed_at và tên dữ liệu cũ chuẩn hóa.
- Database local cần áp dụng migration 0038 trước khi dùng form/API mới.


## 18. Thay đổi phạm vi: bỏ trường vị trí địa lý dạng số

Theo yêu cầu tiếp theo, cơ sở chỉ quản lý địa chỉ hành chính. Đã bỏ trường vị trí địa lý dạng số khỏi schema hiện hành, API, validation, form, seed/import, fixture và tài liệu hợp đồng hiện tại. Migration 0039 xóa cột và gỡ dữ liệu tương ứng trong snapshot xét duyệt cũ. Importer đối chiếu source_ref hoặc tên + địa chỉ chuẩn hóa; không dùng khoảng cách. Các migration, snapshot schema và kiểm thử migration lịch sử được giữ nguyên để bảo đảm nâng cấp từ database cũ.
