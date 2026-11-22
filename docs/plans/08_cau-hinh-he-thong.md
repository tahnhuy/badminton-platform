# 08 — Cấu hình hệ thống

- Ưu tiên: 08
- Track/Phase: Track F / Phase 1
- Prerequisite: 01 G0 (D6, D7), 02 INF-00
- Exit gate: registry validation + Admin API/UI + audit đầy đủ; không có key “mồ côi”
- Mở khóa: Admin vận hành cấu hình; bổ sung key cho Booking/Refund/Auth/Reports/Tournament/Team

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 0. Trạng thái triển khai — 2026-11-18

**Backend F1–F3 + F5 (registry/API/audit/tests/docs): DONE; F5 E2E còn pending.**

- F1: migration `0023_overrated_phantom_reporter.sql` + Drizzle `systemConfigAudit`; test `config-audit-migration.test.ts` (fresh/populated + insert/read).
- F2: registry phủ đủ domain `booking/tournament/team/auth/refund/report/matchmaking/social/messaging/player-skill-adjustment`; hỗ trợ `type: 'enum'`, `editable`, cross-key booking/auth/matchmaking; `validateConfigValue`; readers booking/owner/auth/refund dùng chung registry.
- `PLAYER_SKILL_ADJUSTMENT_ENABLED` mặc định **false** (registry + seed `0023` cập nhật seed `0008` cũ).
- F3: `GET /api/v1/admin/configs`, `GET /api/v1/admin/configs/:configKey`, `PATCH /api/v1/admin/configs/:configKey`; audit + no-op + concurrency last-commit-wins + clear cache; `CONFIG_KEY_NOT_FOUND`, `CONFIG_VALUE_INVALID`, `CONFIG_KEY_READ_ONLY`.
- F5: test `config-registry.test.ts`, `admin-config-api.test.ts`, `config-audit-migration.test.ts`; docs matrix/schema/tech-design/tasks/migration log cập nhật.
- F4: UI base `/admin/configs` đã có: gom section theo nhóm, gộp các thẻ liên quan vào một card (min/max, bật/tắt + thời gian, mode + giới hạn, phiên idle/absolute, nhóm điều chỉnh trình độ), nhãn chức năng tiếng Việt, sửa inline (không modal), boolean/mode dùng radio có nhãn nội dung, integer/enum có đơn vị/giới hạn, read-only và lỗi validate ngay trong thẻ; **giữ UI-REDO** tới khi merge frontend. Playwright A19 và E2E vẫn là phần còn lại của F4/F5.
- Hướng dẫn test UI thủ công: [`docs/testing/08_cau-hinh-he-thong.md`](../testing/08_cau-hinh-he-thong.md).

**Chưa làm trong đợt này:** audit read API/UI, Playwright `playwright.admin-config.config.ts`, 4 key đề xuất Phụ lục A3 (chờ SC-D12).

## 1. Mục đích

Biến `SYSTEM_CONFIGS` từ chỗ chỉ có reader typed thành bề mặt quản trị thật: registry biết mọi key hợp lệ, validate value/cross-key, API list/detail/update có audit, UI Admin chỉnh cấu hình an toàn. Đây là module độc lập, không nằm trên critical path nhưng cần sớm để tránh mỗi module tự thêm key rời rạc.

## 2. Điểm cần chốt

- [x] **SC-D1 (D6):** catalog bounds cuối cùng cho toàn bộ key trong §8.2–§8.9 và các key đề xuất tại Phụ lục A3.
- [x] **SC-D2:** domain mở rộng: thêm `booking`, `team`, `auth`, `refund`; giữ `report`. Domain phải phủ mọi key trong registry.
- [x] **SC-D3:** key bắt buộc bổ sung: `REPORT_ENABLED` (đã có, giữ nguyên), `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TEAM_INVITATION_TIMEOUT_MINUTES`, **và toàn bộ key §8.2–§8.7 còn thiếu** (Phụ lục A2). Không dừng ở 3 key.
- [x] **SC-D4:** ghi cùng giá trị = no-op, không audit.
- [x] **SC-D5:** audit append-only; không expose old/new value cho non-Admin.
- [x] **SC-D6:** update dùng transaction upsert + audit + clear cache sau commit.
- [x] **SC-D7:** key không secret; nếu có secret thì không đưa vào bảng này.
- [x] **SC-D8:** hỗ trợ `type: 'enum'` trong registry cho `BOOKING_ACTIVE_LIMIT_MODE` (`LIMITED | UNLIMITED`); API/UI validate theo danh sách giá trị.
- [x] **SC-D9:** thêm metadata `editable` (mặc định `true`). Key deprecated/legacy `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` là `editable: false`; API/UI chỉ đọc.
- [x] **SC-D10:** chuyển `REFUND_ENABLED`, `REFUND_PROCESSING_TIMEOUT_MINUTES` từ env sang `SYSTEM_CONFIGS` (giữ env làm fallback/khởi tạo). Cần xác nhận thay đổi hành vi trước khi làm.
- [x] **SC-D11:** chốt xung đột `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`: §8.3 ghi `15`, §8.9 ghi `1440`; giữ `1440` theo §8.9 và đánh dấu §8.3 là legacy.
- [ ] **SC-D12:** chốt 4 key đề xuất mới tại Phụ lục A3 với Business Owner; key chưa chốt thì không đưa vào registry/seed.

## 3. Danh sách task chi tiết

### [x] F1 — SC-09: Audit table

**Mục đích:** có lịch sử thay đổi cấu hình.

**Việc làm:**

- [x] Migration `SYSTEM_CONFIG_AUDIT`:
  - [x] `id` PK.
  - [x] `config_key` varchar, không FK (giữ lịch sử khi key bị xóa).
  - [x] `old_value` text nullable.
  - [x] `new_value` text not null.
  - [x] `changed_by` bigint FK `USERS.id` nullable.
  - [x] `changed_at` timestamptz default now.
  - [x] Index theo `config_key`, `changed_at`.
- [x] Drizzle schema.
- [x] Không trigger; chỉ app ghi.
- [x] Test migrate fresh/populated; insert/read; không update/delete audit trong code.

**Acceptance:**

- [x] Bảng tồn tại sau migration.
- [x] Không có code path sửa/xóa audit.
- [x] Existing config rows không bị ảnh hưởng.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/config-audit-migration.test.ts
```

### [x] F2 — SC-06: Registry + validation

**Mục đích:** một nguồn sự thật cho key/default/bounds, phủ **toàn bộ** §8.2–§8.9 và các key đang đọc rải rác (không chỉ §8.9).

**Việc làm:**

- [x] Mở rộng `ConfigDomain` thêm `booking`, `team`, `auth`, `refund`; giữ `report`.
- [x] Bổ sung toàn bộ key còn thiếu theo Phụ lục A2.
- [x] Gộp định nghĩa trùng: đưa `ownerConfigDefinitions`, `messagingConfigDefinitions` vào `configDefinitions` để chỉ còn một nguồn duy nhất.
- [x] Thêm metadata: type, default, min, max, enum, description, domain, `editable`.
- [x] Hỗ trợ `type: 'enum'` + `allowedValues`; cập nhật type map `ConfigValue`.
- [x] Đánh dấu `editable: false` cho key deprecated/legacy: `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`.
- [x] Implement `validateConfigValue(key, value)`:
  - [x] type coercion/parse.
  - [x] min/max.
  - [x] enum.
  - [x] trả `CONFIG_KEY_READ_ONLY` khi key có `editable: false`.
- [x] Implement `validateConfigCrossKeyRules()` cho toàn bộ hoặc theo batch update:
  - [x] `MATCHMAKING_GROUP_MIN_SLOTS ≤ MATCHMAKING_GROUP_MAX_SLOTS`.
  - [x] `BOOKING_MIN_DURATION_MINUTES ≤ BOOKING_MAX_DURATION_MINUTES`.
  - [x] `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_<ROLE> ≤ AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_<ROLE>` cho từng role.
  - [ ] `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT ≤ TOURNAMENT_MAX_PARTICIPANT_LIMIT` (nếu A3 được duyệt).
- [x] Chuyển reader sang registry:
  - [x] `backend/src/shared/config/booking-config.ts` → `booking` domain.
  - [x] `backend/src/shared/config/owner-config.ts` → `booking` domain; xóa định nghĩa riêng.
  - [x] `backend/src/shared/config/system-config.ts` auth keys → `auth` domain.
  - [x] `REFUND_*` (`env.ts`) → `refund` domain với env fallback (SC-D10).
- [x] Seed key mới idempotent (không ghi đè giá trị Admin đã sửa).
- [x] Test từng key: valid/invalid/boundary; enum; `editable: false`; cross-key; unknown key; mọi key có domain hợp lệ.

**Acceptance:**

- [x] Không key nào được ghi nếu không có trong registry.
- [x] Sai type/range → `CONFIG_VALUE_INVALID`; enum sai cùng mã lỗi.
- [x] Key read-only → `CONFIG_KEY_READ_ONLY`, không tạo audit.
- [x] Cross-key sai bị từ chối.
- [x] Không còn key nào đọc trực tiếp ngoài registry (trừ hạ tầng env).

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/config-registry.test.ts
```

### [x] F3 — SC-07/08: Admin API

**Mục đích:** Admin xem/sửa cấu hình có kiểm soát.

**Việc làm:**

- [x] `GET /api/v1/admin/configs`:
  - [x] filter domain/page/limit.
  - [x] `ConfigItem` gồm configKey, configValue, valueType, domain, description, documentedDefault, usingDefault, updatedAt, updatedBy, editable, allowedValues (nếu enum), min/max (nếu integer).
- [x] `GET /api/v1/admin/configs/:configKey`: 404 nếu không có registry; fallback default.
- [x] `PATCH /api/v1/admin/configs/:configKey`:
  - [x] CSRF.
  - [x] validate registry (type/min/max/enum).
  - [x] từ chối `editable: false` bằng `CONFIG_KEY_READ_ONLY`.
  - [x] upsert + audit trong 1 transaction.
  - [x] no-op nếu giá trị không đổi.
  - [x] clear cache sau commit.
- [x] `ADMIN` only; 401/403 đúng.
- [x] Test: default fallback, first write `old_value=NULL`, no-op không audit, concurrent last-commit-wins, unknown key, invalid value, enum invalid, read-only key.

**Acceptance:**

- [x] Admin list/detail/update hoạt động.
- [x] Mỗi lần đổi giá trị tạo đúng 1 audit row.
- [x] Không audit khi không đổi.
- [x] Key read-only bị từ chối, không audit.
- [x] Cache invalidation có test.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-config-api.test.ts
```

### [ ] F4 — SC-10: Admin UI — UI-REDO

**Mục đích:** Admin chỉnh cấu hình không cần gọi API.

**Việc làm:**

- [ ] Route `/admin/configs`, dùng layout Admin hiện có.
- [ ] List: segmented tabs/filter theo `domain` (gồm booking, tournament, team, auth, refund, report, matchmaking, social, messaging, player-skill-adjustment), tìm key, phân trang, hiển thị default/usingDefault.
- [ ] Detail/edit: input theo type boolean/integer/**enum**; enum dùng select với `allowedValues`; hiển thị bounds, lỗi validate.
- [ ] Key `editable: false` hiển thị read-only kèm badge “Deprecated/Read-only”, không cho lưu.
- [ ] Hiển thị updatedAt/updatedBy; không hiển thị secret (không có key secret).
- [ ] States: loading/empty/error; confirm trước khi lưu.
- [ ] Playwright: sửa 1 boolean + 1 integer + 1 enum; lỗi range; read-only không sửa được; reload giữ giá trị.

**Acceptance:**

- [ ] Admin sửa được key; Reader thấy giá trị mới sau cache clear.
- [ ] UI không cho nhập ngoài bounds/enum.
- [ ] Key read-only không thể lưu.
- [ ] Không có nút xóa key.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin-config.config.ts
```

### [ ] F5 — SC-11/SC-04/SC-05: Test + docs

**Mục đích:** khóa hợp đồng và cập nhật tài liệu.

**Việc làm:**

- [x] Test registry toàn bộ key (bao gồm parity reader ↔ registry).
- [x] Test API list/detail/update/audit/enum/read-only.
- [ ] Test E2E Admin config.
- [x] Cập nhật `system-config/tasks.md`: SC-04, SC-05, SC-06→11.
- [x] Cập nhật Tech Design: domain mới, enum, `editable`, cross-key, danh mục key Phụ lục A.
- [x] Đồng bộ `docs/business-rules-config-matrix.md` §8.2–§8.9: chốt bounds, sửa xung đột §8.3/§8.9, ghi key nào deprecated/read-only.
- [x] Đồng bộ `docs/architecture/database-schema.md` nếu thêm seed/audit (không đổi cấu trúc `SYSTEM_CONFIGS`).
- [x] Ghi rõ key nào chỉ đọc, key nào có thể sửa, key nào còn đọc từ env.

**Acceptance:**

- [ ] Toàn bộ SC task trong scope DONE.
- [x] Docs không còn “Approved” cho task đã xong.
- [x] Không còn key đọc trực tiếp env trong service (trừ hạ tầng).
- [x] Phụ lục A và matrix khớp 100% với registry.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/config-registry.test.ts
npm test --prefix backend -- --run src/__tests__/admin-config-api.test.ts
cd frontend && npx playwright test --config playwright.admin-config.config.ts
```

## 4. Test đầu ra toàn track

```bash
npm run db:migrate
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

- [x] Migration audit fresh/populated.
- [x] Registry validation đầy đủ, phủ 100% Phụ lục A2.
- [x] API audit/no-op/concurrency/enum/read-only.
- [x] Reader parity: booking/owner/auth/refund đọc qua registry.
- [ ] UI-REDO — UI edit + lỗi bounds/enum + read-only.
- [x] Không có secret trong DB/API/UI.

## 5. Checklist hoàn thành file

- [ ] F1→F5 xong.
- [x] Domain `booking`, `team`, `auth`, `refund`, `report` có trong registry.
- [x] Toàn bộ key Phụ lục A2 tồn tại; `REPORT_ENABLED` + tournament/team timeout có mặt.
- [x] Key deprecated/legacy là `editable: false`.
- [x] Enum `BOOKING_ACTIVE_LIMIT_MODE` hoạt động end-to-end.
- [x] Audit append-only.
- [ ] UI-REDO — Admin UI hoạt động.
- [x] Docs cập nhật (matrix, tech design, tasks, Phụ lục A).
- [ ] `08` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Thêm key rải rác ngoài registry | Rule: mọi key mới phải qua registry + seed; test phủ 100% |
| Audit ghi cả no-op | So sánh trước khi ghi |
| Cache cũ sau update | Clear sau commit + test đọc lại |
| Bounds chưa chốt | D6; dùng bounds hiện có, thay đổi là data |
| Reader lệch registry sau refactor | Parity test cho từng reader (booking/owner/auth/refund) |
| Chuyển `REFUND_*` từ env sang DB gây regression | Giữ env fallback + migration seed + test rollback |
| Key đề xuất mới chưa được duyệt | Không seed/không đưa vào registry khi SC-D12 chưa chốt |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc: A19 System Configuration `12:58657`.

**Chốt:**

- [ ] Cập nhật `docs/architecture/frontend.md`: đưa **A19 vào in-scope** (hiện đang bị xếp “Restricted / Not Build” mâu thuẫn với SC-10 Approved).
- [ ] A19 chỉ dùng làm composition cho list/filter/edit theo SC-07/08; không đổi API.

**Bổ sung vào task:**

- [ ] **F4:** dùng segmented tabs theo `domain` (hoặc filter domain) như A19; list key, default/usingDefault, updatedAt/By.
- [ ] **F4:** editor theo type boolean/integer/enum; hiển thị bounds/allowedValues; lỗi `CONFIG_VALUE_INVALID`; key read-only hiển thị disabled; no-op không audit.
- [ ] **F4:** bỏ tab BWF/FairPlay/SmartMatch/ELO, uptime “99.98%”, audit table UI (SC-09 chưa có API đọc audit).
- [ ] **F4:** không hiển thị secret; không có nút xóa key.
- [ ] **F5:** cập nhật `frontend.md` §7.4/§9.3/§9.4, Change Log và danh mục domain/key Phụ lục A.
- [ ] **F5 test:** Playwright A19: filter domain, sửa boolean/integer/enum, read-only, reload giữ giá trị, lỗi bounds.

**Loại bỏ khỏi UI:**

- [ ] BWF standards, SmartMatch, FairPlay, uptime, audit trail table.
- [ ] Bất kỳ key/config nào chưa có trong registry.

**Cập nhật checklist hoàn thành:**

- [ ] `frontend.md` không còn xếp A19 Not Build.
- [ ] SC-10 UI không có BWF/FairPlay/SmartMatch/uptime/audit table.

---

## 8. Phụ lục A — Danh mục key cấu hình

Nguồn đối chiếu bắt buộc khi implement F2. **A1** đã có trong registry; **A2** bắt buộc bổ sung; **A3** đề xuất, chờ SC-D12. Bounds của A2 phần lớn chưa được matrix chốt — dùng SC-D1.

### A1. Đã có trong `config-registry.ts` (23 key)

| Domain | Key | Default | Bounds | Mục đích |
| --- | --- | --- | --- | --- |
| tournament | `TOURNAMENT_RATING_ENABLED` | true | bool | Bật rating cho trận giải |
| player-skill-adjustment | `PLAYER_SKILL_ADJUSTMENT_ENABLED` | false | bool | Bật tự điều chỉnh trình độ (migration `0023` cập nhật seed cũ) |
| player-skill-adjustment | `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` | 5 | 1–100 | Số rating tối thiểu (legacy, sẽ thay bằng MIN_MATCHES) |
| player-skill-adjustment | `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` | 5 | 1–100 | Số trận gần nhất làm cửa sổ đánh giá |
| player-skill-adjustment | `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` | 1 | 1–6 | Khoảng cách trình độ tối thiểu để điều chỉnh |
| player-skill-adjustment | `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` | 14 | 0–365 | Số ngày tối thiểu giữa 2 lần điều chỉnh |
| matchmaking | `MATCHMAKING_ENABLED` | true | bool | Bật/tắt matchmaking |
| matchmaking | `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` | 30 | ≥1, deprecated | Key cũ, sẽ bỏ |
| matchmaking | `MATCHMAKING_MIN_LEAD_TIME_MINUTES` | 60 | ≥0 | Thời gian tối thiểu trước giờ bắt đầu |
| matchmaking | `MATCHMAKING_MATCH_DURATION_MINUTES` | 90 | ≥1 | Thời lượng trận mặc định |
| matchmaking | `MATCHMAKING_APPLICATION_TIMEOUT_MINUTES` | 1440 | 15–10080 | Hạn chờ duyệt đơn Apply |
| matchmaking | `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` | 1440 | 15–10080 | Hạn lời mời trực tiếp |
| matchmaking | `MATCHMAKING_GROUP_MIN_SLOTS` | 3 | 3–20 | Sức chứa nhóm tối thiểu; MIN ≤ MAX |
| matchmaking | `MATCHMAKING_GROUP_MAX_SLOTS` | 12 | 3–20 | Sức chứa nhóm tối đa |
| matchmaking | `MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER` | 3 | 1–20 | Số bài tìm kèo mở tối đa |
| social | `SOCIAL_FEED_ENABLED` | true | bool | Bật/tắt feed |
| social | `SOCIAL_FREE_POSTS_PER_DAY` | 10 | 1–100 | Số bài miễn phí/ngày |
| social | `SOCIAL_COMMENTS_PER_MINUTE` | 10 | 1–60 | Giới hạn comment/phút |
| messaging | `MESSAGING_ENABLED` | true | bool | Bật/tắt chat |
| messaging | `MESSAGING_GROUP_MAX_MEMBERS` | 50 | 3–100 | Số thành viên nhóm tối đa |
| messaging | `MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY` | 20 | 1–500 | Số hội thoại 1-1 mới/ngày |
| messaging | `MESSAGING_MESSAGES_PER_MINUTE` | 30 | 1–300 | Số tin nhắn/phút |
| report | `REPORT_ENABLED` | true | bool | Bật/tắt báo cáo |

### A2. Bắt buộc bổ sung (27 key)

#### A2.1 Booking / Refund — domain `booking`, `refund` (14 key)

| Domain | Key | Default | Bounds | Reader hiện tại | Mục đích |
| --- | --- | --- | --- | --- | --- |
| booking | `BOOKING_ENABLED` | true | bool | `booking-config.ts` | Bật/tắt đặt sân |
| booking | `BOOKING_MIN_DURATION_MINUTES` | 60 | SC-D1 | `booking-config.ts` | Thời lượng đặt sân tối thiểu |
| booking | `BOOKING_MAX_DURATION_MINUTES` | 180 | SC-D1 | `booking-config.ts` | Thời lượng đặt sân tối đa |
| booking | `BOOKING_ADVANCE_WINDOW_DAYS` | 7 | SC-D1 | `booking-config.ts` | Cửa sổ đặt trước tối đa |
| booking | `MAINTENANCE_ADVANCE_WINDOW_DAYS` | 90 | SC-D1 | `owner-config.ts` | Cửa sổ lên lịch bảo trì |
| booking | `BOOKING_ACTIVE_LIMIT_MODE` | LIMITED | enum `LIMITED\|UNLIMITED` | `booking-config.ts` | Chiến lược giới hạn booking active |
| booking | `BOOKING_MAX_ACTIVE_PER_PLAYER` | 5 | SC-D1 | `booking-config.ts` | Số booking active tối đa/Player |
| booking | `PLAYER_CAN_CANCEL_BOOKING` | true | bool | `booking-config.ts` | Player được huỷ booking |
| booking | `PLAYER_CANCELLATION_DEADLINE_MINUTES` | 0 | SC-D1 | `booking-config.ts` | Hạn huỷ của Player trước giờ bắt đầu |
| booking | `OWNER_CAN_CANCEL_BOOKING` | true | bool | `owner-config.ts` | Owner được huỷ booking |
| booking | `OWNER_CANCELLATION_DEADLINE_MINUTES` | 0 | SC-D1 | `owner-config.ts` | Hạn huỷ của Owner trước giờ bắt đầu |
| booking | `BOOKING_PAYMENT_TIMEOUT_MINUTES` | 10 | SC-D1 | `booking-config.ts` | Hạn giữ slot chờ thanh toán |
| refund | `REFUND_ENABLED` | true | bool | `env.ts` | Bật luồng hoàn tiền |
| refund | `REFUND_PROCESSING_TIMEOUT_MINUTES` | 1440 | ≥1 | `env.ts` | Hạn xử lý refund trước khi retry/xử lý tay |

#### A2.2 Tournament — domain `tournament` (4 key)

| Key | Default | Bounds | Mục đích |
| --- | --- | --- | --- |
| `TOURNAMENT_ENABLED` | true | bool | Bật/tắt toàn module giải |
| `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT` | 16 | SC-D1 | Giới hạn participant mặc định khi tạo giải |
| `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES` | 10 | SC-D1 | Hạn giữ slot `PENDING_PAYMENT` |
| `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES` | 15 | SC-D1 | Thời gian chờ trước khi xử no-show/`WALKOVER` |

#### A2.3 Team — domain `team` (1 key)

| Key | Default | Bounds | Mục đích |
| --- | --- | --- | --- |
| `TEAM_INVITATION_TIMEOUT_MINUTES` | 1440 | SC-D1 | Hạn lời mời đội đôi (snapshot lúc tạo) |

#### A2.4 Authentication — domain `auth` (8 key)

| Key | Default | Bounds | Mục đích |
| --- | --- | --- | --- |
| `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD` | 5 | SC-D1 | Số lần đăng nhập sai trước khi khoá tạm |
| `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` | 15 | SC-D1 | Thời gian khoá tài khoản |
| `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER` | 10080 | SC-D1 | Idle timeout session Player |
| `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER` | 43200 | SC-D1 | Thời hạn tuyệt đối session Player |
| `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER` | 10080 | SC-D1 | Idle timeout session Court Owner |
| `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER` | 43200 | SC-D1 | Thời hạn tuyệt đối session Court Owner |
| `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN` | 60 | SC-D1 | Idle timeout session Admin |
| `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN` | 480 | SC-D1 | Thời hạn tuyệt đối session Admin |

### A3. Đề xuất bổ sung — chờ SC-D12

| Domain | Key | Default | Bounds đề xuất | Mục đích |
| --- | --- | --- | --- | --- |
| tournament | `TOURNAMENT_MATCH_DURATION_MINUTES` | 90 | 15–240 | Thời lượng mặc định của system booking/trận giải khi xếp lịch |
| tournament | `TOURNAMENT_MAX_PARTICIPANT_LIMIT` | 128 | 4–256 | Chặn participant limit quá lớn gây bracket/memory/DoS |
| tournament | `TOURNAMENT_CASUAL_IMPORT_MAX_ROWS` | 500 | 1–5000 | Guard số dòng import Excel của giải phong trào (G12) |
| tournament | `TOURNAMENT_ENTRY_FEE_MAX_VND` | 50.000.000 | ≥0 | Chặn nhập sai phí; **cần Business Owner chốt** |

Không thêm vào registry các rule cố định: `TEAM_MAX_MEMBERS=2`, `TOURNAMENT_MIN_PARTICIPANTS=2`, `WITHDRAWAL_REFUND_PERCENT=100`, giới hạn media.

### A4. Nâng cấp registry bắt buộc

- `ConfigDomain` = `booking | tournament | team | auth | refund | report | matchmaking | social | messaging | player-skill-adjustment`.
- `ConfigDefinition` hỗ trợ `type: 'enum'` + `allowedValues`; `ConfigValue` map tương ứng.
- Metadata `editable` (mặc định `true`); key deprecated/legacy là `false` và API/UI chỉ đọc.
- Cross-key: matchmaking group min/max; booking min/max duration; auth idle ≤ absolute theo role; tournament default ≤ max participant (nếu A3 duyệt).
- Một nguồn duy nhất: bỏ `ownerConfigDefinitions`, `messagingConfigDefinitions`; reader dùng `configDefinitions`.
- Seed idempotent: chỉ thêm key thiếu, không ghi đè giá trị đã có.
- API/UI trả/ hiển thị `editable`, `allowedValues`, `min`, `max`, `documentedDefault`, `usingDefault`.
