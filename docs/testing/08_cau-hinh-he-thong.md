# Hướng dẫn test thủ công — Cấu hình hệ thống (Plan 08)

Tài liệu này hướng dẫn **thao tác trực tiếp trên giao diện** để kiểm tra phần
System Configuration đã làm trong
[`docs/plans/08_cau-hinh-he-thong.md`](../plans/08_cau-hinh-he-thong.md):
danh sách cấu hình theo domain, sửa boolean/integer/enum, validate range/cross-key,
key read-only và audit thay đổi.

> **UI-REDO:** trang `/admin/configs` mới có **base UI đủ để test**. Sau khi merge
> frontend cần kiểm tra lại giao diện; backend/API/audit đã hoàn tất.
>
> **Chưa có trên UI:** màn hình đọc audit, nút reset về mặc định, tạo/xoá key.

---

## 1. Chuẩn bị môi trường

> Tài khoản và dữ liệu mẫu: xem [`docs/testing/demo-accounts.md`](demo-accounts.md). Mật khẩu chung `123456`.

### 1.1 Khởi động DB + migration + seed + app

```bash
cd /home/nhathuy/Code/badminton-platform
docker compose up -d
npm run db:reset -- --yes   # sao lưu, xoá sạch, migrate và seed dữ liệu demo
npm run dev
```

Mở http://localhost:5173.

Cần có migration **`0023_overrated_phantom_reporter.sql`** (bảng
`system_config_audit`, seed `TOURNAMENT_*`/`TEAM_INVITATION_TIMEOUT_MINUTES`,
`PLAYER_SKILL_ADJUSTMENT_ENABLED=false`).

Nếu DB dev báo checksum mismatch (đã ghi trong
[`docs/plans/migration-slot-log.md`](../plans/migration-slot-log.md)), reset DB dev:

```bash
docker compose down -v
docker compose up -d
npm run db:reset -- --yes   # sao lưu, xoá sạch, migrate và seed dữ liệu demo
```

### 1.2 Tài khoản seed

Mật khẩu chung: `123456`

| Vai trò | Email | Dùng để |
| --- | --- | --- |
| Admin | `admin@smashpro.vn` | Vào `/admin/configs` |
| Player | `player01@smashpro.vn` | Kiểm tra bị chặn khỏi Admin |
| Owner | `owner1@smashpro.vn` | Kiểm tra bị chặn khỏi Admin |

> Admin `admin@smashpro.vn` luôn có sau khi chạy `npm run db:reset -- --yes`.

### 1.3 Kiến thức nhanh về màn hình

- URL: **`/admin/configs`**.
- Sidebar: **Cấu hình hệ thống**.
- Các thông số được gom thành **section theo nhóm** (Đặt sân, Giải đấu, Đội thi đấu...).
- Các thông số liên quan được **gộp chung một thẻ** (min/max, bật/tắt + thời gian,
  cách giới hạn + số lượt, phiên idle/absolute, nhóm điều chỉnh trình độ).
- Mỗi thẻ chỉnh sửa trực tiếp, **không mở modal**; ô phụ chỉ hiện khi cần
  (ví dụ chọn **Giới hạn theo số lượt** mới hiện ô số lượt tối đa).
- Tên hiển thị là **chức năng** (ví dụ `BOOKING_ENABLED` → **Cho phép đặt sân**);
  UI **không hiển thị tên key kỹ thuật**.
- Boolean dùng **radio** với nhãn nội dung (ví dụ **Cho phép đặt sân** / **Tạm tắt đặt sân**).
- Integer có ô số + đơn vị + giới hạn; enum dùng radio/select có nhãn nội dung.
- Nút **Lưu** chỉ bật khi giá trị thay đổi và tất cả ô hợp lệ; **Hoàn tác** trả về giá trị đang lưu.
- Nhập sai range/cross-key: cảnh báo tiếng Việt hiện **ngay dưới ô nhập**, nút **Lưu** bị disable;
  sửa hợp lệ thì cảnh báo biến mất và **Lưu** bật lại.
- Card read-only hiện badge **Chỉ đọc**, control bị disable.

Tổng số key trong registry: **50**.

| Domain | Số key |
| --- | --- |
| `booking` | 12 |
| `tournament` | 5 |
| `team` | 1 |
| `auth` | 8 |
| `refund` | 2 |
| `report` | 1 |
| `matchmaking` | 9 |
| `social` | 3 |
| `messaging` | 4 |
| `player-skill-adjustment` | 5 |

---

## 2. Test 1 — Phân quyền truy cập

1. **Chưa đăng nhập**: mở trực tiếp `/admin/configs`.
   - **Kỳ vọng:** bị chuyển về trang đăng nhập, không thấy dữ liệu cấu hình.
2. Đăng nhập Player `player01@smashpro.vn`, mở `/admin/configs`.
   - **Kỳ vọng:** bị chặn (không phải Admin), không thấy sidebar Admin.
3. Đăng nhập Owner `owner1@smashpro.vn`, mở `/admin/configs`.
   - **Kỳ vọng:** bị chặn.
4. Đăng xuất, đăng nhập Admin `admin@smashpro.vn`, mở `/admin/configs`.
   - **Kỳ vọng:** thấy trang **Cấu hình hệ thống**, sidebar có mục
     **Cấu hình hệ thống**, danh sách key hiển thị.

---

## 3. Test 2 — Danh sách, lọc và tìm kiếm

1. Mở `/admin/configs`.
2. **Kỳ vọng mặc định:**
   - Bộ lọc `Tất cả nhóm`.
   - Hiển thị **50 cấu hình** và đủ 10 section theo nhóm.
   - Có các nhãn chức năng quen thuộc:
     **Cho phép đặt sân**, **Bật giải đấu**, **Hạn lời mời vào đội**,
     **Thời gian chờ tối đa của phiên quản trị viên**,
     **Tự động điều chỉnh trình độ**.
3. Chọn nhóm **Đặt sân**.
   - **Kỳ vọng:** chỉ còn section **Đặt sân** với **12 cấu hình** (8 thẻ do đã gộp nhóm).
4. Chọn nhóm **Giải đấu**.
   - **Kỳ vọng:** có **Bật giải đấu**, **Số người tham gia mặc định**,
     **Thời gian giữ chỗ đăng ký chờ thanh toán**,
     **Cho phép đánh giá trận giải đấu**,
     **Thời gian chờ trước khi xử thua do vắng mặt**.
5. Chọn nhóm **Đội thi đấu**.
   - **Kỳ vọng:** có **Hạn lời mời vào đội**, giá trị `1440` phút.
6. Chọn nhóm **Xác thực**.
   - **Kỳ vọng:** có **8** thẻ phiên/đăng nhập; thử tìm `quản trị viên`.
7. Gõ vào ô tìm kiếm: `đặt sân`.
   - **Kỳ vọng:** lọc theo **nhãn chức năng/mô tả**, không cần gõ tên key.
8. Gõ `không tồn tại`.
   - **Kỳ vọng:** hiện trạng thái **Không có cấu hình phù hợp**.
9. Bấm **Làm mới** hoặc xoá ô tìm kiếm/chọn `Tất cả nhóm`.
   - **Kỳ vọng:** danh sách trở lại đủ 10 section.

---

## 4. Test 3 — Sửa boolean

Key dùng test: `BOOKING_ENABLED` — nhãn **Cho phép đặt sân**.

1. Mở nhóm **Đặt sân**, tìm thẻ **Cho phép đặt sân**.
2. **Kỳ vọng:**
   - Có 2 radio: **Cho phép đặt sân** và **Tạm tắt đặt sân**.
   - Radio **Cho phép đặt sân** đang được chọn.
3. Chọn **Tạm tắt đặt sân**.
   - **Kỳ vọng:** nút **Lưu** bật lên, nút **Hoàn tác** xuất hiện.
4. Bấm **Lưu**.
5. **Kỳ vọng:**
   - Toast: `Đã lưu "Cho phép đặt sân". Giá trị mới áp dụng trong tối đa 60 giây.`
   - Thẻ giữ radio **Tạm tắt đặt sân**.
   - Không còn badge **Đang dùng mặc định** (nếu trước đó có).
   - Dòng cập nhật cuối thẻ có thời gian và `Admin #<id>`.
6. Tải lại trang `/admin/configs`.
   - **Kỳ vọng:** vẫn chọn **Tạm tắt đặt sân**.
7. Kiểm tra chéo nghiệp vụ (tuỳ chọn):
   - Đăng nhập Player → vào `/courts` → thử đặt sân.
   - **Kỳ vọng:** booking bị chặn với lỗi `BOOKING_DISABLED`
     (hoặc UI báo đặt sân đang tắt).
8. Quay lại Admin, chọn lại **Cho phép đặt sân** và **Lưu** để khôi phục.

---

## 5. Test 4 — Sửa integer trong giới hạn

Key dùng test: `BOOKING_MAX_ACTIVE_PER_PLAYER` — nằm trong thẻ **Giới hạn lượt đặt sân** (mặc định `5`, range 1–50).

1. Tìm thẻ **Giới hạn lượt đặt sân**.
2. Chọn **Giới hạn theo số lượt**.
   - **Kỳ vọng:** hiện thêm ô **Số lượt đặt sân tối đa mỗi người**, giá trị `5`, đơn vị **lượt**, giới hạn `1 đến 50`.
3. Nhập `8`, bấm **Lưu**.
4. **Kỳ vọng:** toast thành công; ô giữ `8`; tải lại vẫn giữ `8`.
5. Nhập lại `5`, bấm **Lưu** để khôi phục.
6. Khi giá trị chưa đổi, nút **Lưu** bị disable.
7. Chọn **Không giới hạn**.
   - **Kỳ vọng:** ô số lượt tối đa **biến mất**; bấm **Lưu** chỉ lưu mode.
8. Chọn lại **Giới hạn theo số lượt** để khôi phục.

> No-op không tạo audit row. Kiểm tra ở mục 10 nếu cần.

---

## 6. Test 5 — Sửa enum

Key dùng test: `BOOKING_ACTIVE_LIMIT_MODE` — nằm trong thẻ **Giới hạn lượt đặt sân**.

1. Tìm thẻ **Giới hạn lượt đặt sân**.
2. **Kỳ vọng:** có 2 radio:
   **Giới hạn theo số lượt** (`LIMITED`) và **Không giới hạn** (`UNLIMITED`).
3. Chọn **Không giới hạn**, bấm **Lưu**.
4. **Kỳ vọng:** thẻ giữ lựa chọn mới; ô số lượt tối đa bị ẩn; tải lại vẫn giữ.
5. Chọn lại **Giới hạn theo số lượt**, bấm **Lưu** để khôi phục.

---

## 7. Test 6 — Validate range và cross-key

### 7.1 Integer ngoài range

1. Tìm thẻ **Giới hạn lượt đặt sân**, chọn **Giới hạn theo số lượt**.
2. Nhập `0` vào ô **Số lượt đặt sân tối đa mỗi người**.
   - **Kỳ vọng:** cảnh báo hiện ngay dưới ô
     `Số lượt đặt sân tối đa mỗi người phải từ 1 đến 50 lượt.`;
     nút **Lưu** bị disable.
3. Nhập `51`.
   - **Kỳ vọng:** vẫn cảnh báo range, **Lưu** bị disable.
4. Nhập `8`.
   - **Kỳ vọng:** cảnh báo biến mất, **Lưu** bật lại.

### 7.2 Cross-key booking

Điều kiện: thẻ **Thời lượng đặt sân** đang có tối thiểu `60`, tối đa `180`.

1. Tìm thẻ **Thời lượng đặt sân** — có **2 ô nhập trong cùng một thẻ**.
2. Nhập tối thiểu `200`, tối đa giữ `180`.
   - **Kỳ vọng:** cảnh báo ngay trong thẻ
     `Thời lượng đặt sân tối thiểu không được lớn hơn thời lượng đặt sân tối đa.`;
     nút **Lưu** bị disable.
3. Đổi tối đa thành `240`, tối thiểu giữ `200`.
   - **Kỳ vọng:** cảnh báo biến mất; bấm **Lưu** lưu thành công cả hai (200 ≤ 240), toast 1 lần cho thẻ.
4. Khôi phục tối thiểu `60`, tối đa `180`, bấm **Lưu**.

### 7.3 Cross-key auth (tuỳ chọn)

1. Tìm thẻ **Phiên quản trị viên** — có 2 ô: idle và absolute.
2. Nhập idle `600` (lớn hơn absolute mặc định `480`).
   - **Kỳ vọng:** cảnh báo ngay trong thẻ
     `Thời gian chờ tối đa của phiên quản trị viên không được lớn hơn thời hạn tối đa phiên quản trị viên.`;
     nút **Lưu** bị disable.
3. Không cần khôi phục vì giá trị bị từ chối.
4. Tăng absolute lên `720`, giữ idle `600`.
   - **Kỳ vọng:** cảnh báo biến mất; bấm **Lưu** lưu thành công cả hai.

---

## 8. Test 7 — Key read-only

Key dùng test: `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` — nhãn **Hạn bài tìm kèo (legacy)**.

1. Lọc nhóm **Tìm kèo**, tìm thẻ **Hạn bài tìm kèo (legacy)**.
2. **Kỳ vọng:**
   - Có badge **Chỉ đọc**.
   - Ô số bị disable.
   - Có ghi chú **Cấu hình này là legacy/chỉ đọc và không thể chỉnh sửa.**
   - Không có nút **Lưu**.
3. Mở nhóm **Điều chỉnh trình độ**, tìm thẻ **Tự động điều chỉnh trình độ**.
   - Trường **Số đánh giá tối thiểu (legacy)** trong thẻ có badge **Chỉ đọc**
     và ô nhập bị disable; các trường khác trong thẻ vẫn sửa được bình thường.

> Nếu gọi API trực tiếp, backend trả `409 CONFIG_KEY_READ_ONLY` và không tạo audit.

---

## 9. Test 8 — Giá trị mặc định quan trọng

1. Lọc nhóm **Điều chỉnh trình độ**.
2. Kiểm tra thẻ **Tự động điều chỉnh trình độ**.
   - **Kỳ vọng:** radio **Tắt tự động điều chỉnh** đang chọn
     (mặc định mới từ migration `0023`).
   - Thẻ hiển thị thêm các ô: **Số đánh giá tối thiểu (legacy)** (read-only),
     **Số trận tối thiểu**, **Khoảng cách trình độ**, **Thời gian chờ**.
3. (Tuỳ chọn) Nếu DB chưa có row cho key này, thẻ có badge **Đang dùng mặc định**.
4. Lọc nhóm **Tìm kèo**, kiểm tra thẻ **Hạn phản hồi lời mời**.
   - **Kỳ vọng:** giá trị `1440` phút.

---

## 10. Test 9 — Audit và no-op (kiểm tra DB)

UI chưa có màn hình audit, nên kiểm tra bằng SQL.

```bash
docker compose exec postgres psql -U badminton_user -d badminton_db \
  -c "SELECT config_key, old_value, new_value, changed_by, changed_at
      FROM system_config_audit
      ORDER BY id DESC
      LIMIT 10;"
```

1. Thực hiện một thay đổi mới (ví dụ `BOOKING_MAX_ACTIVE_PER_PLAYER=7`).
2. Chạy SQL trên.
   - **Kỳ vọng:** có đúng **1** dòng mới:
     `old_value=5`, `new_value=7`, `changed_by=<admin id>`.
3. Bấm lưu lại giá trị `7` (no-op), chạy SQL lại.
   - **Kỳ vọng:** **không** có dòng audit mới.

Kiểm tra giá trị hiện tại:

```bash
docker compose exec postgres psql -U badminton_user -d badminton_db \
  -c "SELECT config_key, config_value, updated_by, updated_at
      FROM system_configs
      WHERE config_key = 'BOOKING_MAX_ACTIVE_PER_PLAYER';"
```

- **Kỳ vọng:** `config_value=7`, `updated_by` là Admin, `updated_at` mới.

Khôi phục `BOOKING_MAX_ACTIVE_PER_PLAYER=5` trên UI sau khi test.

---

## 11. Test 10 — Cache và hiệu lực sau lưu

Lưu ý: date picker Player hiện hardcode hiển thị 7 ngày; backend mới là nơi
enforce `BOOKING_ADVANCE_WINDOW_DAYS`. Vì vậy kiểm tra bằng thao tác đặt sân.

1. Đổi `BOOKING_ADVANCE_WINDOW_DAYS` từ `7` thành `3`, lưu.
2. Trong vòng tối đa 60 giây, đăng nhập Player → `/courts` → chọn sân.
3. Chọn ngày **cách hôm nay 4–7 ngày** (UI vẫn có thể hiển thị), thử tạo booking.
   - **Kỳ vọng:** backend từ chối với `BOOKING_OUTSIDE_ADVANCE_WINDOW`.
4. Chọn ngày trong 3 ngày tới và tạo booking.
   - **Kỳ vọng:** tạo được (nếu còn slot hợp lệ).
5. Nếu ngày 4–7 vẫn tạo được:
   - Chờ thêm tối đa 60 giây (cache TTL) rồi thử lại.
   - Nếu vẫn sai, kiểm tra backend đang chạy đúng DB và đã lưu giá trị.
6. Khôi phục `BOOKING_ADVANCE_WINDOW_DAYS=7`.

---

## 12. Checklist thao tác nhanh

- [ ] Player/Owner không vào được `/admin/configs`.
- [ ] Admin thấy trang, sidebar **Cấu hình hệ thống**.
- [ ] Danh sách có 50 cấu hình; lọc `Đặt sân` = 12, `Xác thực` = 8, `Đội thi đấu` = 1.
- [ ] Tìm kiếm theo nhãn chức năng/mô tả hoạt động; xoá lọc hoạt động.
- [ ] Boolean dùng radio có nhãn nội dung, không hiện `true`/`false`.
- [ ] Sửa **Cho phép đặt sân** → **Tạm tắt đặt sân** → reload giữ giá trị.
- [ ] Sửa integer trong range thành công; nút Lưu tắt khi chưa đổi.
- [ ] Thẻ **Giới hạn lượt đặt sân** hiện/ẩn ô số lượt tối đa theo radio mode.
- [ ] Thẻ **Thời lượng đặt sân** có 2 ô nhập và lưu cùng lúc.
- [ ] Thẻ **Phiên quản trị viên** có 2 ô idle/absolute và lưu cùng lúc.
- [ ] Nhập sai range: cảnh báo tiếng Việt hiện ngay, nút Lưu bị disable.
- [ ] Sửa về giá trị hợp lệ: cảnh báo mất, nút Lưu bật lại.
- [ ] Cross-key booking (min > max) bị chặn đúng rule.
- [ ] Card read-only hiện **Chỉ đọc**, control bị disable, không có nút Lưu.
- [ ] `PLAYER_SKILL_ADJUSTMENT_ENABLED` mặc định `false`.
- [ ] `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` = `1440`.
- [ ] Thay đổi tạo đúng 1 audit row; lưu lại cùng giá trị không tạo audit.
- [ ] Đổi `BOOKING_ADVANCE_WINDOW_DAYS` có hiệu lực trong ≤60 giây.

---

## 13. Lỗi thường gặp trên UI

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không thấy mục **Cấu hình hệ thống** | Đăng nhập đúng Admin; kiểm tra role tài khoản. |
| Danh sách trống / lỗi tải | Kiểm tra backend chạy, migration `0023` đã áp dụng, DB đúng. |
| Báo `CONFIG_KEY_NOT_FOUND` | Key không có trong registry; chỉ dùng các key hiện trên UI. |
| Báo `CONFIG_VALUE_INVALID` | Kiểm tra type/range/enum/cross-key; xem message ngay trong thẻ. |
| Báo `CONFIG_KEY_READ_ONLY` | Key legacy/read-only; không sửa được. |
| Lưu thành công nhưng nghiệp vụ chưa đổi ngay | Chờ tối đa 60 giây (cache) rồi tải lại; kiểm tra đúng key/domain. |
| Sửa xong nhưng reload mất | Kiểm tra DB/đúng môi trường; xem SQL mục 10. |
| Dev DB lỗi checksum migration | Reset DB dev theo mục 1.1. |

---

## 14. Ghi chú phạm vi

- Trang này chỉ quản lý **business configuration** trong `SYSTEM_CONFIGS`;
  không quản lý secret/env hạ tầng.
- Không có API/UI đọc audit, reset mặc định, tạo/xoá key trong release này.
- `PLAYER_SKILL_ADJUSTMENT_ENABLED` đổi mặc định sang `false`; bật lại bằng UI
  nếu muốn kiểm tra luồng tự điều chỉnh trình độ.
- Các key đề xuất ở Phụ lục A3 của plan 08 chưa có trong registry nên **không**
  xuất hiện trên UI.
- Toàn bộ mục giao diện giữ nhãn **UI-REDO** tới khi merge frontend và kiểm tra lại.
