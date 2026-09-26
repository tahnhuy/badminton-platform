# Prompt Flow — Hướng dẫn viết prompt tạo tài liệu feature

Tài liệu này hướng dẫn cách viết prompt cho AI agent để tạo PRD → Tech Design → Tasks cho một feature mới. Mỗi bước có **prompt mẫu**, **context cần cung cấp**, và **tiêu chí kiểm tra output**.

Quy trình:

```
Mô tả feature (tiếng Việt) → PRD → Tech Design → Tasks → Review (Bước 4) → Implementation (Bước 5)
```

---

## Nguyên tắc chung khi viết prompt

1. **Luôn nêu feature scope cụ thể** — tránh prompt mơ hồ như "tạo feature booking cho tôi".
2. **Tham chiếu đúng section** trong authoritative docs thay vì mô tả lại.
3. **Nêu rõ role nào liên quan** (Player / Court Owner / Admin / Organizer).
4. **Nêu rõ những gì KHÔNG thuộc scope** để AI không thêm tự ý.
5. **Dùng câu lệnh rõ ràng**: "Draft PRD theo template", "Đừng chọn tech", "Không tạo schema".

---

## Bước 1 — Tạo PRD

### Khi nào cần PRD?

Khi feature có ít nhất một trong:
- Hành vi người dùng mới hoặc thay đổi
- Luật nghiệp vụ (business rule) mới
- Thay đổi permission / role behavior

### Prompt mẫu

```
Đọc các tài liệu sau trước khi bắt đầu:
- PROJECT-BRIEF.md
- docs/documentation-guide.md
- docs/business-rules-config-matrix.md (phần liên quan)
- docs/templates/PRD-template.md

Sau đó draft một PRD cho feature: [TÊN FEATURE]

Mô tả feature:
[Mô tả ngắn 3-5 câu: feature làm gì, ai dùng, vì sao cần]

Các role liên quan:
- Player: [mô tả tác động]
- Court Owner: [mô tả tác động hoặc "N/A"]
- Admin: [mô tả tác động hoặc "N/A"]

Những gì KHÔNG thuộc scope PRD này:
- [item 1]
- [item 2]

Lưu file vào: docs/features/[domain]/[feature-name]/prd.md
Status: Draft (KHÔNG được tự mark Ready)
Fulfills: PROJECT-BRIEF.md §[số section]
```

### Context bắt buộc cung cấp

| Thông tin | Ví dụ |
|---|---|
| Tên feature | "Court Booking — Player flow" |
| Domain | `booking`, `matchmaking`, `tournament`, `admin`, `platform` |
| Role chính | Player / Court Owner / Admin |
| Brief section | §3.2 (Court Booking) |
| Business rules cần áp dụng | "real-time, không có Pending → Approve flow" |
| Scope rõ ràng | "Chỉ player-side, không làm owner dashboard" |

### Tiêu chí kiểm tra PRD output

- [ ] Status: `Draft`
- [ ] Có `Fulfills: PROJECT-BRIEF.md §X`
- [ ] Không có API endpoint, database field, tên component
- [ ] Không tự thêm system role mới
- [ ] Không promote out-of-MVP items
- [ ] Có `## 14. Open Questions` với `[TBD]` cho mọi điều chưa rõ
- [ ] Không quyết định tech (framework, lib, provider)

### Ví dụ cụ thể — Booking PRD

```
Đọc: PROJECT-BRIEF.md, docs/documentation-guide.md §2.3,
docs/business-rules-config-matrix.md §5, docs/templates/PRD-template.md

Draft PRD cho feature: Court Booking — Player Flow

Mô tả:
Player tìm sân, xem slot còn trống theo thời gian thực, đặt sân,
xác nhận và thanh toán/đặt cọc online. Player có thể hủy theo chính sách.
Booking xác nhận theo cơ chế real-time (HTTP polling đã được confirm trong tech-stack.md).

Role liên quan:
- Player: tìm sân, xem slot, tạo booking, hủy booking
- Court Owner: N/A trong PRD này (owner dashboard là feature riêng)
- Admin: N/A trong PRD này

KHÔNG thuộc scope PRD này:
- Owner dashboard / quản lý slot phía owner
- Refund management module độc lập (out of MVP)
- Split Bill (out of MVP)
- Booking history của Court Owner

Lưu: docs/features/booking/player-booking/prd.md
Status: Draft
Fulfills: PROJECT-BRIEF.md §3.2 và §7
```

---

## Bước 2 — Tạo Tech Design

### Khi nào cần Tech Design?

Khi feature có ít nhất một trong:
- API endpoint mới hoặc thay đổi
- Thay đổi database schema
- State transition phức tạp
- Concurrency / idempotency concerns
- Tích hợp external service

### Điều kiện tiên quyết

PRD phải ở status **Ready** (human đã confirm) trước khi bắt đầu Tech Design.

### Prompt mẫu

```
Đọc các tài liệu sau trước khi bắt đầu:
- docs/features/[domain]/[feature-name]/prd.md (READY)
- docs/architecture/tech-stack.md
- docs/architecture/conventions.md
- docs/architecture/database-schema.md (phần liên quan)
- docs/business-rules-config-matrix.md (phần liên quan)
- docs/templates/tech-design-template.md

Draft Tech Design cho: [TÊN FEATURE]

Constraints bắt buộc từ authoritative docs:
- Stack: PERN (PostgreSQL, Express.js, React, Node.js)
- API prefix: /api/v1/
- Auth: opaque session cookie, middleware authenticate + requireRole
- Pagination: offset-based (page + limit, meta response)
- Real-time: HTTP polling (nếu feature cần)
- Validation: Zod tại request boundary
- Error shape: { error: { code, message, details } }
- [Thêm constraint đặc thù nếu có]

Yêu cầu kỹ thuật cụ thể:
- [Requirement 1]
- [Requirement 2]

KHÔNG làm trong Tech Design này:
- [Out-of-scope item]

Lưu: docs/features/[domain]/[feature-name]/tech-design.md
Status: Draft
Decision Status: Proposed
```

### Context bắt buộc cung cấp

| Thông tin | Ví dụ |
|---|---|
| PRD đã Ready | Link tới prd.md |
| Schema sections liên quan | `database-schema.md §3.5 BOOKINGS` |
| Business rules liên quan | `business-rules-config-matrix.md §5.1` |
| Constraints đặc thù | "payment idempotent", "no pending flow" |
| State machine nếu có | "PENDING → CONFIRMED → CANCELLED" |
| Concurrency concern | "concurrent booking của cùng slot" |

### Tiêu chí kiểm tra Tech Design output

- [ ] Status: `Draft`, Decision Status: `Proposed`
- [ ] Link tới governing PRD
- [ ] API dùng prefix `/api/v1/`
- [ ] Auth dùng `authenticate` + `requireRole` middleware
- [ ] Pagination dùng `page`/`limit`/`meta` đúng format
- [ ] Error shape đúng: `{ error: { code, message, details } }`
- [ ] Schema delta ghi rõ — không reproduce full schema
- [ ] State machine có đủ transitions và edge cases
- [ ] Concurrency/idempotency được xử lý rõ ràng
- [ ] Acceptance criteria dùng Given/When/Then
- [ ] Không tự thêm dependency ngoài approved list
- [ ] `[TBD]` cho mọi quyết định chưa resolve

### Ví dụ cụ thể — Booking Tech Design

```
Đọc:
- docs/features/booking/player-booking/prd.md (Ready)
- docs/architecture/tech-stack.md (Confirmed Decisions)
- docs/architecture/conventions.md (API Conventions, Pagination)
- docs/architecture/database-schema.md §3.5 (BOOKINGS), §3.3 (COURTS)
- docs/business-rules-config-matrix.md §5 (Booking Rules)
- docs/templates/tech-design-template.md

Draft Tech Design cho: Court Booking — Player Flow

Constraints bắt buộc:
- Không có Pending → Owner approve/reject flow (PROJECT-BRIEF.md §7)
- Booking real-time: HTTP polling mỗi 5-10s (tech-stack.md)
- Payment: VNPAY, idempotent callback handling (tech-stack.md)
- Concurrency: PostgreSQL row locking / exclusion constraints cho slot
- Notifications: in-app DB table khi owner hủy (tech-stack.md)

State machine booking:
SLOT_SELECTED → PAYMENT_PENDING → CONFIRMED → (CANCELLED_BY_PLAYER | CANCELLED_BY_OWNER)

KHÔNG làm:
- Owner dashboard API
- Refund module độc lập
- Split bill

Lưu: docs/features/booking/player-booking/tech-design.md
Status: Draft, Decision Status: Proposed
```

---

## Bước 3 — Tạo Tasks

### Khi nào cần Tasks?

Sau khi Tech Design ở status **Ready** (human đã confirm).

### Prompt mẫu

```
Đọc các tài liệu sau:
- docs/features/[domain]/[feature-name]/prd.md (Ready)
- docs/features/[domain]/[feature-name]/tech-design.md (Ready)
- docs/architecture/conventions.md
- docs/templates/task-template.md

Tạo tasks.md cho feature: [TÊN FEATURE]

Yêu cầu về format:
- Dùng ID prefix: [XX] (ví dụ: BK cho booking, MM cho matchmaking)
- File nằm tại: docs/features/[domain]/[feature-name]/tasks.md
- Phải có: header block, Summary table, Execution Order, từng task section
- **Mỗi task heading PHẢI có `[ ]` ở đầu**: `## [ ] XX-NN: Title`
  Khi task hoàn thành, đổi thành `[x]`: `## [x] XX-NN: Title`
- Mỗi task: Objective, Scope, Implementation requirements, Files affected,
  API impact, Schema impact, Verification, Acceptance criteria (Given/When/Then)

Hướng dẫn split task:
- Tách backend (migration, API) và frontend (UI, service layer) riêng
- Tách query (GET) và mutation (POST/PATCH/DELETE) khi cần
- Một task không quá Large về size
- Task phải có thể implement và verify độc lập

Không được:
- Tự quyết [TBD] nào còn trong Tech Design
- Thêm scope ngoài PRD và Tech Design
- Bịa file path nếu chưa biết (dùng "[Proposed — verify during implementation]")
- Tự đánh `[x]` vào task heading — chỉ human/implementer mới được tick
```

### Tiêu chí kiểm tra Tasks output

- [ ] File tại `docs/features/[domain]/[feature-name]/tasks.md`
- [ ] Có Summary table với ID, title, status, depends on, size
- [ ] Có Execution Order khi tasks có dependencies
- [ ] Mỗi task có Objective, Scope (in/out), Implementation requirements
- [ ] **Mỗi task heading có `[ ]` ở đầu** — ví dụ: `## [ ] BK-01: Migrate schema`
- [ ] **Không có task nào đã bị `[x]`** khi mới tạo (chỉ implementer mới được tick)
- [ ] Acceptance criteria dùng **Given/When/Then** (không có "Given:")
- [ ] Files affected dùng `[Proposed — verify during implementation]` khi chưa chắc
- [ ] Status ban đầu: `Approved` cho task sẵn sàng, `BLOCKED` nếu có dependency chưa giải quyết
- [ ] Không có task nào tự resolve TBD từ Tech Design
- [ ] Link `prd.md` và `tech-design.md` dùng relative path (không có `../`)

### Convention checkbox

```markdown
## [ ] BK-01: Database migration — Booking schema        ← chưa làm
## [ ] BK-02: Backend API — tạo và xem booking           ← chưa làm
## [x] BK-01: Database migration — Booking schema        ← đã xong ✓
```

Rule:
- `[ ]` = chưa làm hoặc đang làm (IN_PROGRESS)
- `[x]` = đã hoàn thành và acceptance criteria pass
- Chỉ người implement mới được đổi `[ ]` → `[x]`, không phải AI agent khi tạo file

---

## Bước 4 — Review checklist trước khi mark Ready

Trước khi yêu cầu human review, prompt AI agent chạy self-check:

```
Review lại [prd.md / tech-design.md / tasks.md] vừa tạo và kiểm tra:

PRD:
- Không có API, database, tech decision nào không?
- Tất cả business rules đều link tới business-rules-config-matrix.md chưa?
- Scope có vi phạm PROJECT-BRIEF.md §5 (Out of MVP) không?

Tech Design:
- API prefix /api/v1/ đúng không?
- Error shape đúng convention không?
- Pagination dùng page/limit/meta chưa?
- Schema delta chỉ ghi delta, không reproduce full schema?
- Acceptance criteria có thể verify thực tế không?
- Có [TBD] nào block implementation không? Nếu có, liệt kê ra.

Tasks:
- Mỗi task có thể implement và verify riêng lẻ không?
- Link tới prd.md và tech-design.md đúng chưa?
- Không có task nào scope quá rộng (Large+)?

Báo cáo vấn đề tìm thấy. Không tự fix mà cần human confirm.
```

---

## Bước 5 — Thực hiện chức năng (Implementation)

### Khi nào bắt đầu Implementation?

Chỉ bắt đầu implement khi **tất cả** điều kiện sau đã thoả:
- PRD ở trạng thái **Ready** (human đã confirm).
- Tech Design ở trạng thái **Ready** và không còn `[TBD]` nào block implementation.
- `tasks.md` đã được tạo và ít nhất một task có Status `Approved`.

### Prompt mẫu

```
Đọc kỹ các tài liệu sau trước khi viết bất kỳ dòng code nào:
- docs/features/[domain]/[feature-name]/prd.md (Ready)
- docs/features/[domain]/[feature-name]/tech-design.md (Ready)
- docs/features/[domain]/[feature-name]/tasks.md
- docs/architecture/tech-stack.md
- docs/architecture/conventions.md
- docs/architecture/database-schema.md (phần liên quan)
- AGENTS.md (đặc biệt §4 AI Coding Safety Rules và §6 Frontend/Backend Conventions)

Implement task: [XX-NN: Tên task]

Scope của task này:
- In scope: [liệt kê từ tasks.md § XX-NN Scope]
- Out of scope: [liệt kê từ tasks.md § XX-NN Scope]

Constraints bắt buộc:
- Stack: PERN (PostgreSQL, Express.js, React, Node.js) + TypeScript
- API prefix: /api/v1/
- Auth middleware: authenticate + requireRole([...])
- Validation: Zod tại request boundary
- Error shape: { error: { code, message, details } }
- Pagination meta: { page, limit, total, totalPages }
- Không thêm dependency ngoài approved list trong tech-stack.md
- [Constraint đặc thù của task nếu có, ví dụ: idempotent payment callback]

Sau khi implement:
1. Kiểm tra lại AGENTS.md §4 safety rules.
2. Chạy git diff và liệt kê tất cả file đã thay đổi.
3. Nếu thay đổi bất kỳ API contract / DB schema / business behavior → cập nhật doc liên quan trong cùng session (AGENTS.md §5 No-Doc-Debt Rule).
4. Báo cáo: file đã tạo/sửa, API impact, schema impact, và bất kỳ vấn đề phát hiện khi implement.
5. KHÔNG tự đánh [x] vào task heading trong tasks.md — đó là quyền của implementer/human.
```

### Context bắt buộc cung cấp

| Thông tin | Ví dụ |
|---|---|
| Task ID cụ thể | `BK-02: Backend API — Tạo booking` |
| Link tech-design | `docs/features/booking/player-booking/tech-design.md` |
| Dependency tasks đã done | `BK-01 (DB migration)` |
| Constraint đặc thù | `idempotent payment callback`, `SELECT FOR UPDATE`, `real-time HTTP polling` |
| Files liên quan đã biết | `backend/src/modules/bookings/`, `frontend/src/features/booking/` |

### Tiêu chí kiểm tra Implementation output

- [ ] Chỉ implement đúng scope task, không thêm feature ngoài PRD/Tech Design
- [ ] Không thêm dependency ngoài approved list
- [ ] Route handler mỏng: validation → service → response (không nhét logic vào controller)
- [ ] Service chứa business orchestration, Repository xử lý persistence
- [ ] Transaction boundaries rõ ràng cho mọi mutation phức tạp
- [ ] Middleware `authenticate` + `requireRole` đúng role, không bỏ qua auth
- [ ] Không expose internal error detail ra API response
- [ ] Zod schema validate request body/params/query trước khi vào service
- [ ] Input validation không bị bypass ở bất kỳ layer nào
- [ ] Parameterized queries — không có raw SQL nối chuỗi
- [ ] Không để in-memory state làm source of truth cho cross-request coordination
- [ ] git diff clean — không có unrelated refactoring
- [ ] Nếu thay đổi API contract / schema / business behavior → đã update doc liên quan

### Ví dụ cụ thể — Booking BK-02 Backend API

```
Đọc:
- docs/features/booking/player-booking/prd.md (Ready)
- docs/features/booking/player-booking/tech-design.md (Ready) — §2 API Design, §3 State Machine, §4 Concurrency
- docs/features/booking/player-booking/tasks.md — task BK-02
- docs/architecture/conventions.md (API Conventions, Pagination, Error Shape)
- docs/architecture/database-schema.md §3.6 COURTS, §3.8 BOOKINGS, §3.10 PAYMENTS
- AGENTS.md §4, §6, §7, §8

Implement task BK-02: Backend API — Tạo booking và thanh toán

In scope (từ tasks.md BK-02):
- POST /api/v1/bookings — tạo booking, validate slot trống, lock row, tạo payment record
- GET /api/v1/bookings/my-bookings — danh sách booking của player (pagination)
- GET /api/v1/bookings/:id — chi tiết booking (chỉ owner player hoặc admin)
- Xử lý idempotent VNPAY callback: cập nhật booking PENDING_PAYMENT → CONFIRMED

Out of scope:
- Cancel booking (BK-03)
- Payment timeout worker / cron (BK-04)
- Frontend UI (BK-05)

Constraints đặc thù:
- Concurrency: SELECT ... FOR UPDATE khi kiểm tra slot trước khi insert booking
- Idempotency: VNPAY callback dùng payment_id để idempotent — gọi 2 lần không confirm 2 lần
- Không có Pending → Owner approve flow (PROJECT-BRIEF.md §7)
- Late payment: nếu booking đã EXPIRED thì callback kích hoạt refund, không confirm

Sau khi implement:
- Chạy git diff, liệt kê tất cả file thay đổi
- Xác nhận API prefix /api/v1/ đúng trên tất cả routes
- Báo cáo nếu phát hiện schema gap hay edge case ngoài Tech Design
- KHÔNG tự đánh [x] vào BK-02 trong tasks.md
```

---

## Quick reference — Tên file và đường dẫn

```
docs/features/
├── booking/
│   └── player-booking/
│       ├── prd.md
│       ├── tech-design.md
│       └── tasks.md
├── matchmaking/
│   └── [feature-name]/
├── tournament/
│   └── [feature-name]/
├── admin/
│   └── [feature-name]/        ← court-management, user-management, v.v.
└── platform/
    └── [feature-name]/        ← authentication-authorization, notifications, v.v.
```

**Task ID prefix gợi ý:**

| Domain | Prefix | Ví dụ |
|---|---|---|
| Booking | BK | BK-01 |
| Matchmaking | MM | MM-01 |
| Tournament | TN | TN-01 |
| Admin Court Mgmt | CM | CM-01 |
| Admin User Mgmt | UM | UM-01 |
| Admin Report | RP | RP-01 |
| Admin Tournament | AT | AT-01 |
| Auth/Platform | AUTH | AUTH-01 |
| Notifications | NT | NT-01 |
| Payments | PY | PY-01 |

---

## Những lỗi phổ biến cần tránh

| Lỗi | Ví dụ sai | Đúng |
|---|---|---|
| PRD chứa API | "Endpoint GET /bookings trả về..." | Mô tả behavior: "Player có thể xem danh sách booking" |
| Tech Design chứa business rule mới | Thêm rule không có trong PRD | Link tới PRD hoặc business-rules-config-matrix |
| Task tự resolve TBD | Chọn một option khi Tech Design còn `[TBD]` | Ghi `BLOCKED` và nêu TBD cần resolve |
| AI mark doc là Ready | `Status: Ready` trong output | Luôn để `Draft` — human mới được mark Ready |
| Link sai relative path | `../prd.md` (khi còn trong tasks/ folder) | `prd.md` (cùng folder) |
| Tự thêm dependency | `import redis from 'redis'` | Chỉ dùng approved dependencies |
| Reproduce full schema | Copy toàn bộ BOOKINGS table | Chỉ ghi schema **delta** và link tới database-schema.md |
| Implement trước khi doc Ready | Code khi PRD/Tech Design còn Draft | Chờ human confirm Ready rồi mới implement |
| Nhét business logic vào controller | `req.body` check trong route handler | Logic vào service layer, controller chỉ translate transport |
| AI tự đánh `[x]` task | `## [x] BK-02: ...` trong tasks.md | Chỉ implementer/human được tick task done |

---

## Tham khảo nhanh — Authoritative docs

| Cần biết gì | Đọc ở đâu |
|---|---|
| Project scope, MVP, roles | `PROJECT-BRIEF.md` |
| Quy trình tạo doc | `docs/documentation-guide.md` |
| Stack, confirmed decisions | `docs/architecture/tech-stack.md` |
| API, pagination, naming | `docs/architecture/conventions.md` |
| Database schema | `docs/architecture/database-schema.md` |
| Business rules, config | `docs/business-rules-config-matrix.md` |
| PRD template | `docs/templates/PRD-template.md` |
| Tech Design template | `docs/templates/tech-design-template.md` |
| Task template | `docs/templates/task-template.md` |
| AI coding safety rules | `AGENTS.md` §4, §6, §7, §8 |
