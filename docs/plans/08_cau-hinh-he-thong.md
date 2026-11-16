# 08 — Cấu hình hệ thống

- Ưu tiên: 08
- Track/Phase: Track F / Phase 1
- Prerequisite: 01 G0 (D6, D7), 02 INF-00
- Exit gate: registry validation + Admin API/UI + audit đầy đủ; không có key “mồ côi”
- Mở khóa: Admin vận hành cấu hình; bổ sung key cho Reports/Tournament/Team

> **Quy ước UI-REDO (2026-11-16):** frontend đang được sửa song song. Chỉ các task/mục có giao diện mới gắn nhãn **UI-REDO**; phần backend/docs giữ trạng thái thường. Mọi mục UI-REDO phải được kiểm tra lại sau khi merge frontend trước khi tính DONE.

## 1. Mục đích

Biến `SYSTEM_CONFIGS` từ chỗ chỉ có reader typed thành bề mặt quản trị thật: registry biết mọi key hợp lệ, validate value/cross-key, API list/detail/update có audit, UI Admin chỉnh cấu hình an toàn. Đây là module độc lập, không nằm trên critical path nhưng cần sớm để tránh mỗi module tự thêm key rời rạc.

## 2. Điểm cần chốt

- [ ] **SC-D1 (D6):** catalog bounds cuối cùng.
- [ ] **SC-D2:** domain mở rộng: thêm `team`, `report` (và bất kỳ domain nào có key).
- [ ] **SC-D3:** key bắt buộc bổ sung: `REPORT_ENABLED`, `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TEAM_INVITATION_TIMEOUT_MINUTES`, các key còn thiếu trong matrix.
- [ ] **SC-D4:** ghi cùng giá trị = no-op, không audit.
- [ ] **SC-D5:** audit append-only; không expose old/new value cho non-Admin.
- [ ] **SC-D6:** update dùng transaction upsert + audit + clear cache sau commit.
- [ ] **SC-D7:** key không secret; nếu có secret thì không đưa vào bảng này.

## 3. Danh sách task chi tiết

### [ ] F1 — SC-09: Audit table

**Mục đích:** có lịch sử thay đổi cấu hình.

**Việc làm:**

- [ ] Migration `SYSTEM_CONFIG_AUDIT`:
  - [ ] `id` PK.
  - [ ] `config_key` varchar, không FK (giữ lịch sử khi key bị xóa).
  - [ ] `old_value` text nullable.
  - [ ] `new_value` text not null.
  - [ ] `changed_by` bigint FK `USERS.id` nullable.
  - [ ] `changed_at` timestamptz default now.
  - [ ] Index theo `config_key`, `changed_at`.
- [ ] Drizzle schema.
- [ ] Không trigger; chỉ app ghi.
- [ ] Test migrate fresh/populated; insert/read; không update/delete audit trong code.

**Acceptance:**

- [ ] Bảng tồn tại sau migration.
- [ ] Không có code path sửa/xóa audit.
- [ ] Existing config rows không bị ảnh hưởng.

**Test đầu ra:**

```bash
npm run db:migrate
npm test --prefix backend -- --run src/__tests__/config-audit-migration.test.ts
```

### [ ] F2 — SC-06: Registry + validation

**Mục đích:** một nguồn sự thật cho key/default/bounds.

**Việc làm:**

- [ ] Mở rộng `ConfigDomain` thêm `team`, `report`.
- [ ] Bổ sung mọi key trong matrix §8.9 và các key đang đọc rải rác.
- [ ] Thêm metadata: type, default, min, max, enum (nếu có), description, domain.
- [ ] Implement `validateConfigValue(key, value)`:
  - [ ] type coercion/parse.
  - [ ] min/max.
  - [ ] enum.
  - [ ] cross-key: `MATCHMAKING_GROUP_MIN_SLOTS ≤ MATCHMAKING_GROUP_MAX_SLOTS`.
- [ ] Implement `validateConfigCrossKeyRules()` cho toàn bộ hoặc theo batch update.
- [ ] Test từng key: valid/invalid/boundary; cross-key; unknown key.

**Acceptance:**

- [ ] Không key nào được ghi nếu không có trong registry.
- [ ] Sai type/range → `CONFIG_VALUE_INVALID`.
- [ ] Cross-key sai bị từ chối.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/config-registry.test.ts
```

### [ ] F3 — SC-07/08: Admin API

**Mục đích:** Admin xem/sửa cấu hình có kiểm soát.

**Việc làm:**

- [ ] `GET /api/v1/admin/configs`:
  - [ ] filter domain/page/limit.
  - [ ] `ConfigItem` gồm configKey, configValue, valueType, domain, description, documentedDefault, usingDefault, updatedAt, updatedBy.
- [ ] `GET /api/v1/admin/configs/:configKey`: 404 nếu không có registry; fallback default.
- [ ] `PATCH /api/v1/admin/configs/:configKey`:
  - [ ] CSRF.
  - [ ] validate registry.
  - [ ] upsert + audit trong 1 transaction.
  - [ ] no-op nếu giá trị không đổi.
  - [ ] clear cache sau commit.
- [ ] `ADMIN` only; 401/403 đúng.
- [ ] Test: default fallback, first write `old_value=NULL`, no-op không audit, concurrent last-commit-wins, unknown key, invalid value.

**Acceptance:**

- [ ] Admin list/detail/update hoạt động.
- [ ] Mỗi lần đổi giá trị tạo đúng 1 audit row.
- [ ] Không audit khi không đổi.
- [ ] Cache invalidation có test.

**Test đầu ra:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-config-api.test.ts
```

### [ ] F4 — SC-10: Admin UI — UI-REDO

**Mục đích:** Admin chỉnh cấu hình không cần gọi API.

**Việc làm:**

- [ ] Route `/admin/configs`, dùng layout Admin hiện có.
- [ ] List: filter domain, tìm key, phân trang, hiển thị default/usingDefault.
- [ ] Detail/edit: input theo type (boolean/integer), hiển thị bounds, lỗi validate.
- [ ] Hiển thị updatedAt/updatedBy; không hiển thị secret (không có key secret).
- [ ] States: loading/empty/error; confirm trước khi lưu.
- [ ] Playwright: sửa 1 boolean + 1 integer; lỗi range; reload giữ giá trị.

**Acceptance:**

- [ ] Admin sửa được key; Reader thấy giá trị mới sau cache clear.
- [ ] UI không cho nhập ngoài bounds.
- [ ] Không có nút xóa key.

**Test đầu ra:**

```bash
npm run build --prefix frontend
cd frontend && npx playwright test --config playwright.admin-config.config.ts
```

### [ ] F5 — SC-11/SC-04/SC-05: Test + docs

**Mục đích:** khóa hợp đồng và cập nhật tài liệu.

**Việc làm:**

- [ ] Test registry toàn bộ key.
- [ ] Test API list/detail/update/audit.
- [ ] Test E2E Admin config.
- [ ] Cập nhật `system-config/tasks.md`: SC-04, SC-05, SC-06→11.
- [ ] Cập nhật Tech Design nếu thêm domain/key.
- [ ] Ghi rõ key nào chỉ đọc, key nào có thể sửa.

**Acceptance:**

- [ ] Toàn bộ SC task trong scope DONE.
- [ ] Docs không còn “Approved” cho task đã xong.
- [ ] Không còn key đọc trực tiếp env trong service (trừ hạ tầng).

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

- [ ] Migration audit fresh/populated.
- [ ] Registry validation đầy đủ.
- [ ] API audit/no-op/concurrency.
- [ ] UI-REDO — UI edit + lỗi bounds.
- [ ] Không có secret trong DB/API/UI.

## 5. Checklist hoàn thành file

- [ ] F1→F5 xong.
- [ ] Domain `team`, `report` có trong registry.
- [ ] `REPORT_ENABLED` + tournament/team timeout key tồn tại.
- [ ] Audit append-only.
- [ ] UI-REDO — Admin UI hoạt động.
- [ ] Docs cập nhật.
- [ ] `08` DONE trong `00_danh-muc-task.md`.

## 6. Rủi ro

| Rủi ro | Cách tránh |
| --- | --- |
| Thêm key rải rác ngoài registry | Rule: mọi key mới phải qua registry + seed |
| Audit ghi cả no-op | So sánh trước khi ghi |
| Cache cũ sau update | Clear sau commit + test đọc lại |
| Bounds chưa chốt | D6; dùng bounds hiện có, thay đổi là data |

---

## 7. Figma audit — chốt 2026-11-15

**UI-REDO:** toàn bộ mục giao diện trong phần Figma audit này chỉ tính DONE sau khi frontend merge và kiểm tra lại UI.

Nguồn đã đọc: A19 System Configuration `12:58657`.

**Chốt:**

- [ ] Cập nhật `docs/architecture/frontend.md`: đưa **A19 vào in-scope** (hiện đang bị xếp “Restricted / Not Build” mâu thuẫn với SC-10 Approved).
- [ ] A19 chỉ dùng làm composition cho list/filter/edit theo SC-07/08; không đổi API.

**Bổ sung vào task:**

- [ ] **F4:** dùng segmented tabs theo `domain` (hoặc filter domain) như A19; list key, default/usingDefault, updatedAt/By.
- [ ] **F4:** editor theo type boolean/integer; hiển thị bounds; lỗi `CONFIG_VALUE_INVALID`; no-op không audit.
- [ ] **F4:** bỏ tab BWF/FairPlay/SmartMatch/ELO, uptime “99.98%”, audit table UI (SC-09 chưa có API đọc audit).
- [ ] **F4:** không hiển thị secret; không có nút xóa key.
- [ ] **F5:** cập nhật `frontend.md` §7.4/§9.3/§9.4 và Change Log.
- [ ] **F5 test:** Playwright A19: filter domain, sửa boolean/integer, reload giữ giá trị, lỗi bounds.

**Loại bỏ khỏi UI:**

- [ ] BWF standards, SmartMatch, FairPlay, uptime, audit trail table.
- [ ] Bất kỳ key/config nào chưa có trong registry.

**Cập nhật checklist hoàn thành:**

- [ ] `frontend.md` không còn xếp A19 Not Build.
- [ ] SC-10 UI không có BWF/FairPlay/SmartMatch/uptime/audit table.
