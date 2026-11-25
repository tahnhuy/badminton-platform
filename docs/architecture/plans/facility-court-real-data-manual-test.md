# Hướng dẫn kiểm thử thủ công: dữ liệu cơ sở và thông số sân

- Ngày lập: 2026-11-24
- Phạm vi: Giai đoạn A–E của `facility-court-real-data-plan.md`
- Môi trường: local/demo. Dữ liệu Google Places và demo seed **chỉ dùng cho đồ án/demo**, không phải dữ liệu thật.

## 1. Chuẩn bị môi trường

```bash
# Từ thư mục gốc repository
docker compose up -d postgres

cd backend
npm run db:migrate
npm run db:seed

# Cửa sổ 1
npm run dev

# Cửa sổ 2
cd frontend
npm run dev
```

Kiểm tra migration đã áp dụng:

```bash
cd backend
npm run verify:migrations
```

Kỳ vọng: báo `OK`, migration mới nhất là `0037_naive_black_bird` (hoặc cao hơn nếu sau này có thêm).

### 1.1. Tài khoản seed

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@smashpro.vn` | `Password@123` |
| Court Owner | `quocbao.tran@phucthinhbadminton.vn` | `Password@123` |
| Court Owner khác | `bach.hoang@badmintonpro.vn` | `Password@123` |
| Chủ sân nhập mẫu | `imported.venues@smashpro.vn` | `Password@123` |
| Player | `nam.nguyen@example.com` | `Password@123` |

Nếu tài khoản Admin chưa có, tạo bằng:

```bash
cd backend
printf 'MatKhauManh123!' | npx tsx src/scripts/create-admin.ts admin@smashpro.vn
```

### 1.2. Lưu ý dữ liệu

- Không chạy `db:seed` trên môi trường dùng chung.
- Không xóa hàng loạt sân đã có booking.
- Nên tạo cơ sở/sân mới bằng giao diện cho các bước thay đổi thông số.
- Dữ liệu nhập mẫu phải hiện nhãn `Dữ liệu nhập mẫu (chưa xác nhận)`.

## 2. Nhóm A: Admin sửa dữ liệu suy diễn, thống kê, nguồn dữ liệu

### A-01. Thẻ thống kê và phạm vi

1. Đăng nhập Admin, mở `/admin/courts`.
2. Quan sát 4 thẻ:
   - `Tổng cơ sở toàn quốc`
   - `Tổng số sân`
   - `Cơ sở đang hoạt động`
   - `Đang tạm đình chỉ`

Kỳ vọng:
- Thẻ tổng cơ sở ghi rõ `Không gồm cơ sở đã vô hiệu hóa`.
- Thẻ tổng sân ghi `sân đang hoạt động`, mô tả chỉ đếm sân `ACTIVE` thuộc cơ sở đang hoạt động.
- Thẻ hoạt động ghi `Tỷ lệ cơ sở hoạt động`.
- Thẻ đình chỉ ghi `Không gồm cơ sở đã vô hiệu hóa`.
- Số bản ghi nhập mẫu chưa xác nhận xuất hiện trong mô tả thẻ tổng cơ sở.
- Không còn chữ `BWF`, `Grade`, `Yonex`, `PVC`, `4.5mm` tự sinh trong bảng.

### A-02. Bộ lọc trạng thái

1. Chọn bộ lọc trạng thái `Đã vô hiệu hóa`, quan sát danh sách.
2. Chuyển sang `Tạm đình chỉ (SUSPENDED)`.

Kỳ vọng:
- `Đã vô hiệu hóa` chỉ trả các dòng đã xóa mềm, có nhãn `Đã vô hiệu hóa`.
- `SUSPENDED` không còn chứa dòng đã vô hiệu hóa.
- Danh sách mặc định (không lọc trạng thái) vẫn hiện các dòng đã vô hiệu hóa.

### A-03. Đình chỉ cơ sở có lý do và người thao tác

1. Chọn một cơ sở đang hoạt động.
2. Bấm nút `Tạm đình chỉ cơ sở` (biểu tượng cấm).
3. Chọn lý do, nhập ghi chú nội bộ, xác nhận.
4. Kiểm tra CSDL:

```bash
docker compose exec postgres psql -U badminton_user -d badminton_db -c \
"SELECT facility_id, actor_id, from_status, to_status, reason_code, note, created_at FROM facility_status_audits ORDER BY id DESC LIMIT 5;"
```

Kỳ vọng:
- Trạng thái cơ sở chuyển `SUSPENDED`.
- Có bản ghi audit với `actor_id` là Admin đang đăng nhập, lý do và ghi chú vừa nhập.
- Lý do `Độ rọi sáng không đạt yêu cầu vận hành` xuất hiện trong danh sách, không còn câu “dưới tiêu chuẩn BWF (< 300 Lux)”.
- Mở lại cơ sở bằng `Thẩm định lại`; trạng thái về `ACTIVE` và có thêm bản ghi audit.

### A-04. Nhãn dữ liệu nhập mẫu và Excel

1. Tìm một cơ sở thuộc chủ `SmashPro Imported Venues`.
2. Quan sát cột cơ sở và bảng.
3. Bấm `Xuất Excel`.

Kỳ vọng:
- Dòng nhập mẫu có nhãn `Dữ liệu nhập mẫu (chưa xác nhận)`.
- Excel có cột nguồn dữ liệu/xác nhận; không còn cột phân hạng/loại thảm; dữ liệu chưa khai báo không bị đổi thành 0.
- Phân trang ghi `cụm sân`.

### A-05. Ngăn xếp dữ liệu suy diễn

Kiểm tra không còn các dữ liệu sau trong DTO/UI:
- Grade theo số sân.
- Tên chủ sân giả `Chủ sân SmashPro`; tên thiếu phải là `Chưa khai báo`.
- Ghi chú `Đang mở bán Slot P06`, `Flagship Arena Hub`.
- Tỷ lệ Yonex/PVC, tăng trưởng mặc định `4`.

## 3. Nhóm B/C: Thông số mặt sân và tình trạng

### B-01. Owner khai báo thông số sân

1. Đăng nhập Owner `quocbao.tran@phucthinhbadminton.vn`.
2. Mở `/owner/facilities`, chọn cơ sở.
3. Trong `Danh sách sân`, bấm `Chi tiết / Sửa sân` ở một sân `ACTIVE`.
4. Tại `Thông số mặt sân & tình trạng`, nhập:
   - Vật liệu: `PU / Acrylic`
   - Thương hiệu: `Yonex`
   - Dòng sản phẩm: `Pro 2026`
   - Độ dày: `4.5`
   - Tình trạng: `Đang bảo trì`
   - Ghi chú: `Thay lưới và kiểm tra đèn`
5. Bấm `Lưu thông số sân`.

Kỳ vọng:
- Lưu thành công, bảng `Danh sách sân` hiển thị mặt sân và tình trạng.
- Dòng `Phiên bản hồ sơ` tăng từ 0 lên 1.
- `Lịch sử thông số sân` có 2 mục: `Thông số` và `Tình trạng`.
- Không có nhãn nào gọi đây là “chứng nhận”.

### B-02. Bắt buộc ghi chú bảo trì

1. Chọn `Đang bảo trì`.
2. Xóa ghi chú.
3. Bấm lưu.

Kỳ vọng: báo lỗi yêu cầu ghi chú; dữ liệu không đổi.

### B-03. Chống ghi đè đồng thời

1. Mở cùng một sân ở hai tab.
2. Tab 1 đổi thương hiệu thành `Yonex A`, lưu.
3. Tab 2 (chưa tải lại) đổi dòng sản phẩm thành `Model B`, lưu.

Kỳ vọng: tab 2 nhận thông báo `Thông số sân đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.` và không ghi đè tab 1.

### B-04. Cảnh báo bảo trì nhưng chưa khóa lịch

1. Giữ tình trạng `Đang bảo trì`.
2. Không tạo lịch khóa.
3. Quan sát cảnh báo trong khối thông số.

Kỳ vọng: hiện `Đã khai báo bảo trì nhưng chưa có lịch khóa đang hiệu lực. Hãy tạo lịch khóa để chặn đặt sân.`

4. Mở `/owner/schedule`, tạo khóa bảo trì cho đúng sân và khoảng thời gian hiện tại.
5. Quay lại `/owner/facilities`, tải lại.

Kỳ vọng: cảnh báo biến mất. Nhãn tình trạng không tự khóa booking; chỉ khoảng khóa mới chặn đặt.

### B-05. Owner khác không sửa được

1. Đăng nhập `bach.hoang@badmintonpro.vn`.
2. Mở sân của cơ sở không thuộc sở hữu (nếu có URL/id) hoặc thử gọi API.

Kỳ vọng: trả 404, không lộ dữ liệu.

### B-06. Admin xem/sửa thông số và lịch sử

1. Đăng nhập Admin, mở `/admin/courts`.
2. Bấm nút `Thông số sân` ở dòng cơ sở.
3. Chọn từng sân, quan sát thông số, tình trạng, phiên bản và lịch sử gần nhất.
4. Sửa tình trạng thành `Cần bảo trì`, nhập ghi chú và **bắt buộc nhập lý do**.
5. Lưu.

Kỳ vọng:
- Thiếu lý do: báo lỗi, không lưu.
- Có lý do: lưu thành công, lịch sử có actor và lý do.
- Bảng danh sách hiển thị `Bảo trì: N · Chưa khai báo: M`.
- Bộ lọc `Tất cả tình trạng sân` và `Tất cả mặt sân` trả đúng cơ sở, không lặp dòng.

### B-07. Dữ liệu cũ chưa khai báo

1. Mở một sân cũ chưa từng nhập thông số.

Kỳ vọng:
- Không tự gán `NORMAL`, không tự gán thương hiệu/độ dày.
- UI hiển thị `Chưa khai báo`.

## 4. Nhóm E: Tiêu chuẩn mặt sân

### E-01. Owner nộp hồ sơ BWF

Điều kiện: sân đã có `Thương hiệu` và `Dòng sản phẩm`.

1. Mở một sân, kéo xuống `Tiêu chuẩn mặt sân (tùy chọn)`.
2. Chọn `Mặt sân chứng nhận BWF Grade 2 (International Standard)`.
3. Nhập đơn vị cấp `BWF`, số tham chiếu `BWF-2026-001`, ngày cấp, ngày hết hạn (bắt buộc với BWF).
4. Chọn 1–4 ảnh JPEG/PNG/WebP, mỗi ảnh tối đa 5 MB.
5. Bấm `Gửi hồ sơ tiêu chuẩn`.

Kỳ vọng:
- Hồ sơ xuất hiện với trạng thái `Chờ duyệt`.
- Có liên kết `Bằng chứng #...`; bấm mở được ảnh khi đang đăng nhập Owner sở hữu.
- Admin nhận thông báo hồ sơ mới.

### E-02. Chặn thiếu dữ liệu

Thử lần lượt:
1. Sân chưa có thương hiệu/dòng sản phẩm.
2. BWF nhưng bỏ trống ngày hết hạn.
3. Không chọn ảnh.
4. Nộp trùng tiêu chuẩn khi đã có hồ sơ chờ duyệt/còn hiệu lực.

Kỳ vọng: mỗi trường hợp bị chặn với thông báo tương ứng; không tạo hồ sơ rác.

### E-03. Admin duyệt/từ chối

1. Đăng nhập Admin, mở `/admin/standards`.
2. Lọc `Chờ duyệt`.
3. Mở bằng chứng, đối chiếu thương hiệu/dòng sản phẩm/thời hạn.
4. Bấm `Duyệt`, xác nhận.
5. Thử một hồ sơ khác: bấm `Từ chối` khi chưa nhập lý do; sau đó nhập lý do và xác nhận.

Kỳ vọng:
- Từ chối thiếu lý do bị chặn.
- Duyệt chuyển `Đã duyệt`; từ chối chuyển `Bị từ chối` và hiển thị lý do.
- Owner nhận thông báo kết quả.

### E-04. Quyền đọc bằng chứng

1. Owner sở hữu mở link bằng chứng: được phép.
2. Admin mở link bằng chứng: được phép.
3. Player hoặc Owner khác mở cùng link: nhận 404 `MEDIA_NOT_FOUND`.

### E-05. Hiển thị công khai

1. Đăng nhập Player `nam.nguyen@example.com`.
2. Mở `/courts`, tìm cơ sở có sân vừa được duyệt, mở chi tiết cơ sở (`/facilities/:id`).
3. Quan sát thẻ sân.

Kỳ vọng:
- Chỉ hiển thị tiêu chuẩn `Đã duyệt` và còn hạn, kèm tên sản phẩm/tiêu chuẩn.
- Hồ sơ `Chờ duyệt`, `Bị từ chối`, `Mất hiệu lực` hoặc đã hết hạn không hiển thị.
- Không còn nhãn BWF suy ra từ số sân.

### E-06. Mất hiệu lực khi đổi thương hiệu/dòng sản phẩm

1. Owner sửa `Thương hiệu` hoặc `Dòng sản phẩm` của sân đã có tiêu chuẩn `Đã duyệt`.
2. Lưu.
3. Kiểm tra `/admin/standards` và chi tiết cơ sở của Player.

Kỳ vọng:
- Hồ sơ chuyển `Mất hiệu lực` (`INVALIDATED`).
- Nhãn công khai biến mất.
- Owner cần nộp hồ sơ mới.

### E-07. Hết hạn

1. Tạo hồ sơ với ngày hết hạn đã qua (nếu UI cho phép) hoặc cập nhật CSDL ở môi trường test.
2. Tải lại chi tiết cơ sở của Player.

Kỳ vọng: nhãn tự ẩn; hồ sơ vẫn còn trong lịch sử Admin/Owner nhưng không hiển thị công khai.

Kiểm tra nhanh bằng CSDL:

```bash
docker compose exec postgres psql -U badminton_user -d badminton_db -c \
"SELECT id, court_id, standard_code, status, expires_at, reviewed_at FROM court_standard_claims ORDER BY id DESC LIMIT 10;"
```

## 5. Nhóm D: Importer và dữ liệu mẫu

Chạy ở chế độ chỉ báo cáo, không ghi dữ liệu:

```bash
cd backend
npx tsx -e "(async () => { const { seedGooglePlacesFacilities } = await import('./src/db/seeds/google-places-facilities'); console.log(await seedGooglePlacesFacilities({ dryRun: true })); process.exit(0); })();"
```

Kỳ vọng:
- Báo cáo có `total`, `valid`, `imported`, `skipped`, `legacyMatched`.
- `dryRun` không tạo cơ sở/sân/giá mới.
- Chạy lại importer không ghi đè cơ sở đã có `confirmed_at` hoặc đã được Owner/Admin chỉnh sửa.
- Cơ sở mới do importer tạo có `data_source = GOOGLE_PLACES_IMPORT` và `source_ref` là `placeId`.

Kiểm tra:

```bash
docker compose exec postgres psql -U badminton_user -d badminton_db -c \
"SELECT id, name, data_source, source_ref, confirmed_at FROM facilities WHERE data_source = 'GOOGLE_PLACES_IMPORT' ORDER BY id LIMIT 10;"
```

## 6. Hồi quy bắt buộc

Thực hiện sau các nhóm trên:

1. **Review sân/cơ sở:** tạo cơ sở/sân mới bằng Owner, Admin duyệt/từ chối, Owner gửi lại; lịch sử vẫn đúng.
2. **Booking:** đặt một sân `ACTIVE` có giá; xác nhận booking vẫn tạo được.
3. **Bảo trì:** tạo khóa trùng booking còn hiệu lực phải bị từ chối; nhãn tình trạng không tự hủy booking.
4. **Đình chỉ:** đình chỉ cơ sở không tự hủy booking đã xác nhận.
5. **Excel:** xuất theo bộ lọc hiện tại; số dòng và phạm vi khớp UI.

## 7. Checklist kết quả

| # | Trường hợp | Kết quả |
|---|---|---|
| 1 | Thẻ thống kê đúng phạm vi, không còn dữ liệu suy diễn | [ ] |
| 2 | Lọc `SUSPENDED` không gồm `DISABLED`; lọc `DISABLED` riêng | [ ] |
| 3 | Đình chỉ lưu lý do + người thao tác | [ ] |
| 4 | Owner lưu thông số/tình trạng, có lịch sử, chống ghi đè | [ ] |
| 5 | Cảnh báo bảo trì chưa khóa lịch | [ ] |
| 6 | Admin sửa thông số bắt buộc lý do | [ ] |
| 7 | Nộp/duyệt/từ chối tiêu chuẩn, thông báo Owner | [ ] |
| 8 | Chỉ tiêu chuẩn verified còn hạn hiển thị công khai | [ ] |
| 9 | Đổi thương hiệu/dòng sản phẩm làm hồ sơ mất hiệu lực | [ ] |
| 10 | Bằng chứng chỉ Owner sở hữu và Admin đọc được | [ ] |
| 11 | Importer `dryRun` không ghi dữ liệu, chạy lại an toàn | [ ] |
| 12 | Booking/review/bảo trì/Excel không hồi quy | [ ] |

## 8. Phạm vi chưa có trong đợt này

- E6: PDF bằng chứng, giao diện quản lý danh mục tiêu chuẩn, EN 12193.
- D3: chưa có màn hình/endpoint để Owner tự “tiếp nhận” dữ liệu và ghi `confirmed_at/confirmed_by`; hiện chỉ có quy trình vận hành riêng.
- Không có URL công khai cho bằng chứng tiêu chuẩn.

## 9. Khi phát hiện lỗi

Ghi lại:
1. Vai trò và tài khoản.
2. URL/màn hình.
3. Các bước tái hiện.
4. Kết quả thực tế và kỳ vọng.
5. Mã lỗi API (nếu có) và thời điểm.
6. Ảnh chụp hoặc dữ liệu liên quan (không chứa thông tin nhạy cảm).


## Loại bỏ tọa độ khỏi thông tin cơ sở

- Form tạo cơ sở, sửa cơ sở và đề xuất địa chỉ không có trường nhập tọa độ.
- Tạo cơ sở mới chỉ bằng địa chỉ hành chính, liên hệ và giờ hoạt động vẫn thành công.
- Owner gửi đề xuất địa chỉ và Admin duyệt được mà không cần trường vị trí địa lý dạng số.
- API chi tiết cơ sở công khai, Owner và Admin chỉ trả địa chỉ hành chính.
- Import chạy lại đối chiếu mã địa điểm nguồn; bản ghi cũ đối chiếu tên và địa chỉ chuẩn hóa, trường hợp mơ hồ báo lỗi.
- Migration 0039 xóa hai cột vị trí địa lý và các trường tương ứng trong snapshot hồ sơ duyệt đã lưu; không xóa cơ sở, sân, giá hoặc booking.
