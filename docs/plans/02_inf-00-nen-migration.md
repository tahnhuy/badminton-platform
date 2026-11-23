# 02 — INF-00: Nền migration và đồng bộ tài liệu

- Ưu tiên: 02
- Track/Phase: INF-00 + INF-01 / Phase 0
- Prerequisite: 01 G0 (đã DONE cho release scope)
- Exit gate: `drizzle-kit generate` không sinh diff; `db:migrate` sạch trên fresh + populated DB
- Chặn: toàn bộ task có migration
- Trạng thái 2026-11-15: **INF-00 DONE; INF-01 DONE** (E2E thật được theo dõi ở task riêng)

## 1. Mục đích

Sửa lệch journal/snapshot trước khi thêm bất kỳ bảng/cột nào. Nếu bỏ qua, migration mới có thể sai số, mất snapshot hoặc không sinh được DDL. Đồng thời đồng bộ trạng thái tài liệu với code thực tế để tránh làm lại task đã xong hoặc tưởng task đã xong.

## 2. Điểm cần chốt

- [x] **INF-D1:** Số migration kế tiếp là `0018`.
- [x] **INF-D2:** Mỗi PR chỉ thêm một migration; số được ghi vào `docs/plans/migration-slot-log.md`.
- [x] **INF-D3:** File migration đã áp dụng là bất biến; sửa bằng migration mới.
- [x] **INF-D4:** Snapshot được tái tạo bằng `drizzle-kit generate`, không sửa tay.
- [x] **INF-D5:** Danh sách task được cập nhật theo bằng chứng code + test cho Social/MM/AF/Payments.

## 3. Danh sách task chi tiết

### [x] INF-00-A — Audit migration hiện tại

- [x] Liệt kê toàn bộ file `.sql`: 18 file `0000`–`0017`.
- [x] Đối chiếu từng file với `meta/_journal.json`: `0017` thiếu journal entry; `0015`/`0016` đã có.
- [x] Đối chiếu snapshot gần nhất: chỉ có đến `0014`; thiếu snapshot `0015`–`0017`.
- [x] Ghi điểm lệch: journal thiếu `0017`, snapshot thiếu `0015`–`0017`.
- [x] Xác nhận DB dev đã áp dụng `0017_matchmaking_request_conversations.sql`; scratch DB áp dụng sạch.

**Bằng chứng:** `custom_migration_history` có `0017`; `\d matchmaking_request_conversations` tồn tại.

### [x] INF-00-B — Sửa journal và snapshot

- [x] Chạy `cd backend && npx drizzle-kit generate`.
- [x] Xác định diff do snapshot `0014` còn thiếu schema messaging/request-conversation.
- [x] Bổ sung journal entry cho `0017` với tag `0017_matchmaking_request_conversations`.
- [x] Tạo `meta/0017_snapshot.json` từ schema Drizzle hiện tại; không tạo snapshot giả cho `0015`/`0016`.
- [x] Chạy lại generate: “No schema changes, nothing to migrate”.
- [x] Không sửa nội dung file `.sql` đã áp dụng.

**Ghi chú:** snapshot `0015`/`0016` không thể tái tạo lịch sử mà không có schema tại thời điểm đó; `0017_snapshot.json` đại diện schema hiện tại và là snapshot mới nhất. Không sửa tay snapshot cũ.

### [x] INF-00-C — Test migration

- [x] DB trống `badminton_migration_check`: `npm run db:migrate` áp dụng đủ `0000`–`0017`.
- [x] Chạy lại lần 2: skip toàn bộ, không lỗi.
- [x] Seed dữ liệu mẫu vào scratch DB; chạy migrate lại không mất dữ liệu.
- [x] Check DB scratch: `custom_migration_history` có 18 rows; không checksum mismatch.
- [x] Ghi log vào file này.
- [ ] Dev DB hiện tại có checksum `0011` lệch do merge sau khi áp dụng; cần reset/review riêng.

**Lệnh đã chạy:**

```bash
docker exec badminton_postgres psql -U badminton_user -d badminton_db \
  -c "DROP DATABASE IF EXISTS badminton_migration_check;" \
  -c "CREATE DATABASE badminton_migration_check;"
DIRECT_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_migration_check' npm run db:migrate
DATABASE_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_migration_check' \
DIRECT_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_migration_check' npm run db:seed
DIRECT_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_migration_check' npm run db:migrate
```

### [x] INF-00-D — CI/migration guard

- [x] Thêm `backend/scripts/verify-migrations.mjs`.
- [x] Kiểm tra mọi `.sql` có journal entry và mọi journal tag có file.
- [x] Chạy `drizzle-kit generate` trong temp dir; fail nếu sinh file mới.
- [x] Thêm `npm run verify:migrations` vào `backend/package.json`.
- [x] Test bằng file `9999_fake.sql`: script exit 1 với “has no journal entry”.

**Bằng chứng:** `npm run verify:migrations` → `OK: 18 migrations, latest 0017..., no schema diff`.

### [x] INF-00-E — Migration slot log

- [x] Tạo `docs/plans/migration-slot-log.md`.
- [x] Ghi baseline `0017` đã dùng; `0018` là số kế tiếp.
- [x] Ghi quy ước: một migration/PR, một slot, cập nhật journal/snapshot.
- [x] Ghi chú dev DB checksum `0011` cần reset/review.

### [x] INF-00-F — Cập nhật Change Log schema

- [x] Rà `docs/architecture/database-schema.md`.
- [x] Bổ sung mục “Migration reconciliation — 2026-11-15 (INF-00)”.
- [x] Xác nhận không thêm migration “ma”; `0015`/`0016` giữ lịch sử, `0017` có snapshot.
- [ ] Sửa tham chiếu số migration lịch sử (`0002`, `0007`) trong task docs — chỉ sửa nếu gây hiểu sai; ưu tiên ghi rõ “historical”.

### [x] INF-01 — Đồng bộ trạng thái task

- [x] `social/tasks.md`: SOC-08 đổi BLOCKED → IN_PROGRESS; report entry RP-08 vẫn mở.
- [x] `matchmaking/tasks.md`: giữ MM-14/15/16/17 IN_PROGRESS; phần còn thiếu đã ghi trong từng task (booking link, notification, E2E thật).
- [x] `social/completion-plan.md` và `frontend-implementation.md`: cập nhật BlockPort production đã đăng ký bởi `MessagingService`; còn E2E.
- [x] `payments-refunds/tasks.md`: đã thêm D9 wallet extension; giữ PAY-* không DONE.
- [x] `admin/frontend-consolidation/tasks.md`: đã ghi D8 defer.
- [x] Không đổi status nếu chưa có test tương ứng; MM-24 giữ IN_PROGRESS vì E2E.

## 4. Test đầu ra

```bash
cd backend
npm run verify:migrations
npx drizzle-kit generate          # kỳ vọng: "No schema changes"
npm run db:migrate                # DB dev có thể fail checksum 0011 — xem ghi chú
npm test -- --run src/__tests__/matchmaking-migration.test.ts
```

- [x] Fresh DB: tất cả migration applied, không lỗi.
- [x] Re-run scratch: tất cả skipped, không checksum mismatch.
- [x] Populated scratch: dữ liệu mẫu còn nguyên.
- [x] Generate trên schema hiện tại: không file mới.
- [x] CI guard fail khi thêm `.sql` thiếu journal.
- [ ] `grep -rn "0002\|0007" docs/features` rà tham chiếu lịch sử (không chặn INF-00).

## 5. Checklist hoàn thành file

- [x] INF-00-A → INF-00-F xong (trừ ghi chú lịch sử).
- [x] INF-01 xong (phần còn lại là E2E thật, không phải docs).
- [x] `docs/plans/migration-slot-log.md` tồn tại.
- [x] CI migration guard hoạt động.
- [x] Không còn task nào bị BLOCKED chỉ vì migration baseline.
- [x] Cập nhật `00_danh-muc-task.md`: INF-00 + INF-01 DONE.

## 6. Rủi ro và cách tránh

| Rủi ro | Cách tránh |
| --- | --- |
| Sửa snapshot bằng tay làm sai lịch sử | Chỉ dùng `drizzle-kit generate`; review diff |
| Hai nhánh cùng lấy `0018` | Slot log + một migration/PR + rebase trước khi merge |
| DB dev có checksum `0011` lệch | Reset DB dev theo README hoặc review riêng; không sửa file đã áp dụng |
| Snapshot `0015`/`0016` không có | Ghi rõ `0017` là snapshot hiện tại; không giả tạo lịch sử |
| Docs sửa quá nhiều ngoài phạm vi | Chỉ sửa trạng thái có bằng chứng; không đổi quyết định nghiệp vụ |
