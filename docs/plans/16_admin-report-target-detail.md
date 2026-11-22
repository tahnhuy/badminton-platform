# 16 — Admin Report: xem chi tiết đối tượng báo cáo

- Ngày lập kế hoạch: 2026-11-20
- Trạng thái: **IMPLEMENTED** (2026-11-20); giao diện **base đủ thấy dữ liệu**, giữ nhãn UI-REDO
- Track/Phase: Track D / Admin Moderation, sau `05_bao-cao-kiem-duyet`
- Prerequisite: `05_bao-cao-kiem-duyet` (RP-01→RP-08); dữ liệu report + evidence hiện có
- Exit gate: Admin mở một report và thấy được thông tin đối tượng bị báo cáo (player, post,
  comment, facility, tournament, message) để xác minh; với PLAYER thấy được hồ sơ, lịch sử
  báo cáo và hoạt động công khai gần đây; không mở hội thoại riêng tư; test + build PASS
- Mở khóa: thao tác kiểm duyệt có căn cứ, giảm resolve report theo cảm tính
- Tài liệu liên quan:
  - [Report Management PRD](../features/admin/report-management/prd.md)
  - [Report Management Tech Design](../features/admin/report-management/tech-design.md)
  - [Report Management Tasks](../features/admin/report-management/tasks.md)
  - [Kế hoạch 05 — Báo cáo và kiểm duyệt](./05_bao-cao-kiem-duyet.md)

> **UI-REDO (áp dụng):** frontend chỉ làm base đủ thấy dữ liệu. Không thêm chart, tab,
> animation hay modal phụ. Các màn mới giữ nhãn `[ ] UI-REDO` tới khi merge frontend và
> kiểm tra lại final visuals.

## 0. Quyết định đã chốt cho đợt này

| # | Quyết định | Phương án |
| --- | --- | --- |
| RT-D1 | Cách trả dữ liệu đối tượng | Gắn object `target` vào `GET /api/v1/admin/reports/:id`; không thêm endpoint mới |
| RT-D2 | Mức xác minh PLAYER | Đầy đủ: hồ sơ + lịch sử báo cáo + hoạt động công khai gần đây + link quản lý người dùng |
| RT-D3 | Luồng tạo report mới | **Không mở rộng** trong đợt này; chỉ xem dữ liệu PLAYER/FACILITY/TOURNAMENT đã có |
| RT-D4 | Dữ liệu MESSAGE | Chỉ hiển thị evidence/snapshot của đúng tin nhắn; **không** trả `conversationId` hay thread |
| RT-D5 | Ảnh của post hiện tại | Chỉ dùng ảnh trong evidence snapshot; chưa mở quyền Admin đọc mọi ảnh post |
| RT-D6 | Hành động trên target | Không thêm action mới; giữ hide post/comment và resolve report hiện có |
| RT-D7 | Target không còn tồn tại | Trả `available: false`, UI báo “không còn tồn tại”; report history vẫn hiển thị |
| RT-D8 | Index DB | Không thêm index trong v1; cân nhắc partial index cho các cột `reported_*` nếu dữ liệu lớn |
| RT-D9 | UI scope | Base UI dạng definition list + badge + danh sách ngắn; không tối ưu visual |

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu

Admin mở dialog “Xem & xử lý” của một report và thấy được:

1. Đối tượng bị báo cáo là ai/cái gì, không chỉ `Loại #ID`.
2. Với nội dung (post/comment/message): nội dung hiện tại + trạng thái ẩn/xóa + tác giả.
3. Với player: hồ sơ tài khoản, tín hiệu rủi ro (số report, số reporter, lý do), hoạt động
   công khai gần đây để đánh giá hành vi.
4. Với facility/tournament: thông tin tóm tắt + lịch sử báo cáo của chính đối tượng.
5. Đường dẫn nhanh sang module quản lý tương ứng (PLAYER → `/admin/users?userId=`).

### 1.2 Ngoài phạm vi

- Không thêm luồng tạo report `PLAYER | FACILITY | TOURNAMENT` từ UI.
- Không mở toàn bộ hội thoại/tin nhắn xung quanh MESSAGE.
- Không thêm action suspend player/hide facility trực tiếp trong dialog report.
- Không thêm index/migration trong v1.
- Không làm chart, timeline nâng cao, export.

## 2. Hiện trạng và khoảng trống

| Khu vực | Hiện tại | Thiếu |
| --- | --- | --- |
| Backend detail | `GET /admin/reports/:id` trả report + `evidence` | Không có `target` |
| Backend data | Chỉ tạo report POST/COMMENT/MESSAGE qua API | PLAYER/FACILITY/TOURNAMENT chỉ có từ dữ liệu cũ/seed/test |
| Frontend dialog | Hiển thị mô tả người báo + evidence | Chỉ hiện “Đối tượng: Loại #ID” |
| PLAYER verification | Không có snapshot nội dung | Cần hồ sơ + lịch sử report + hoạt động công khai |
| MESSAGE | Evidence đúng tin nhắn được báo cáo | Không được mở conversation; chỉ cần metadata người gửi |

### 2.1 Vì sao PLAYER cần cách xác minh khác

Report PLAYER là báo cáo **cấp tài khoản**, không gắn với một nội dung cụ thể. Hệ thống không
lưu snapshot nội dung tại thời điểm báo cáo, nên Admin không thể “xem lại bài viết/tin nhắn”
như report POST/MESSAGE. Cách xác minh hợp lý:

1. Danh tính tài khoản bị báo cáo.
2. Mẫu hình báo cáo: số lượng, số người báo khác nhau, lý do, thời gian.
3. Hoạt động công khai gần đây của tài khoản (bài viết/bình luận, kể cả nội dung đã bị ẩn/xóa).
4. Mô tả của người báo (đã có trong report detail).

Khuyến nghị product (ngoài scope đợt này): nếu sau này mở report PLAYER, nên bắt buộc mô tả
và/hoặc yêu cầu chọn một tin nhắn/bài viết cụ thể để hệ thống chụp evidence.

## 3. API contract

### 3.1 Mở rộng `GET /api/v1/admin/reports/:id`

Giữ nguyên các field hiện có, thêm `target`. `target` là discriminated union theo `type`.

```json
{
  "data": {
    "id": "101",
    "reporterId": "456",
    "targetType": "PLAYER",
    "reportedPlayerId": "789",
    "reasonCode": "HARASSMENT",
    "description": "Người này liên tục nhắn tin xúc phạm.",
    "status": "OPEN",
    "resolvedAt": null,
    "createdAt": "2026-11-19T10:00:00.000Z",
    "updatedAt": "2026-11-19T10:00:00.000Z",
    "evidence": { "text": null, "media": [] },
    "target": {
      "type": "PLAYER",
      "available": true,
      "reportHistory": {
        "total": 5,
        "open": 1,
        "last30Days": 2,
        "distinctReporters": 4,
        "byReason": [
          { "reasonCode": "HARASSMENT", "count": 3 },
          { "reasonCode": "SPAM", "count": 2 }
        ],
        "recent": [
          {
            "id": "101",
            "reporterId": "456",
            "reasonCode": "HARASSMENT",
            "status": "OPEN",
            "createdAt": "2026-11-19T10:00:00.000Z"
          }
        ]
      },
      "player": {
        "id": "789",
        "displayName": "Nguyễn Văn A",
        "email": "a@example.com",
        "phone": "0900000000",
        "avatarUrl": null,
        "role": "PLAYER",
        "status": "ACTIVE",
        "deletedAt": null,
        "joinedAt": "2026-01-12T08:00:00.000Z",
        "skillLevel": { "id": 2, "name": "Trung bình" }
      },
      "recentContent": {
        "posts": [
          {
            "id": "55",
            "type": "FREE",
            "excerpt": "Nội dung bài viết…",
            "createdAt": "2026-11-18T09:00:00.000Z",
            "hiddenAt": null,
            "deletedAt": null
          }
        ],
        "comments": [
          {
            "id": "77",
            "postId": "55",
            "excerpt": "Nội dung bình luận…",
            "createdAt": "2026-11-18T09:05:00.000Z",
            "hiddenAt": "2026-11-18T10:00:00.000Z",
            "deletedAt": null
          }
        ],
        "hiddenPostCount": 1,
        "hiddenCommentCount": 1
      }
    }
  }
}
```

Quy ước chung:

- `reportHistory` có mặt ở **mọi** target type.
- `recent` tối đa 5, mới nhất trước; bao gồm cả report hiện tại.
- `last30Days` tính theo `createdAt >= now - 30 ngày`.
- `distinctReporters` tính trên toàn bộ thời gian.
- `recentContent` giới hạn 5 bài viết + 5 bình luận; excerpt tối đa ~160 ký tự.
- Nội dung đã ẩn/xóa vẫn trả kèm `hiddenAt`/`deletedAt` để Admin thấy nhãn; không trả nội dung
  riêng tư ngoài phạm vi trên.

### 3.2 Payload theo loại

**POST**

```json
{
  "type": "POST",
  "available": true,
  "reportHistory": { "...": "..." },
  "post": {
    "id": "55",
    "type": "FREE",
    "title": null,
    "body": "Nội dung bài viết hiện tại…",
    "author": {
      "id": "789",
      "displayName": "Nguyễn Văn A",
      "avatarUrl": null,
      "status": "ACTIVE"
    },
    "publishedAt": "2026-11-18T09:00:00.000Z",
    "editedAt": null,
    "createdAt": "2026-11-18T09:00:00.000Z",
    "deletedAt": null,
    "hiddenAt": null,
    "hiddenBy": null
  }
}
```

**COMMENT**

```json
{
  "type": "COMMENT",
  "available": true,
  "reportHistory": { "...": "..." },
  "comment": {
    "id": "77",
    "body": "Nội dung bình luận…",
    "author": { "id": "789", "displayName": "Nguyễn Văn A", "avatarUrl": null, "status": "ACTIVE" },
    "createdAt": "2026-11-18T09:05:00.000Z",
    "deletedAt": null,
    "hiddenAt": "2026-11-18T10:00:00.000Z"
  },
  "post": {
    "id": "55",
    "title": null,
    "bodyExcerpt": "Nội dung bài viết cha…",
    "author": { "id": "456", "displayName": "Trần B", "avatarUrl": null, "status": "ACTIVE" },
    "deletedAt": null,
    "hiddenAt": null
  }
}
```

**MESSAGE**

```json
{
  "type": "MESSAGE",
  "available": true,
  "reportHistory": { "...": "..." },
  "message": {
    "id": "900",
    "sender": { "id": "789", "displayName": "Nguyễn Văn A" },
    "body": "Nội dung tin nhắn…",
    "createdAt": "2026-11-18T09:10:00.000Z",
    "deletedAt": null
  }
}
```

Không trả `conversationId`, danh sách thành viên hay tin nhắn xung quanh.

**FACILITY**

```json
{
  "type": "FACILITY",
  "available": true,
  "reportHistory": { "...": "..." },
  "facility": {
    "id": "12",
    "facilityCode": "FAC-012",
    "name": "Sân cầu lông A",
    "address": "1 Đường A",
    "ward": null,
    "district": "Q1",
    "city": "HCM",
    "phone": "0900000000",
    "description": "…",
    "openingTime": "06:00:00",
    "closingTime": "22:00:00",
    "status": "ACTIVE",
    "deletedAt": null,
    "owner": { "id": "321", "name": "Chủ sân", "email": "owner@example.com", "phone": "090..." },
    "courtCount": 6
  }
}
```

**TOURNAMENT**

```json
{
  "type": "TOURNAMENT",
  "available": true,
  "reportHistory": { "...": "..." },
  "tournament": {
    "id": "8",
    "name": "Giải A",
    "description": "…",
    "format": "KNOCKOUT",
    "matchType": "SINGLES",
    "status": "DRAFT",
    "participantLimit": 8,
    "entryFee": "0",
    "registrationStart": "2030-01-01T00:00:00.000Z",
    "registrationEnd": "2030-01-05T00:00:00.000Z",
    "tournamentStart": "2030-01-10T00:00:00.000Z",
    "tournamentEnd": "2030-01-11T00:00:00.000Z",
    "deletedAt": null,
    "creator": { "id": "456", "displayName": "Trần B", "email": "b@example.com", "status": "ACTIVE" },
    "facility": { "id": "12", "name": "Sân cầu lông A" }
  }
}
```

**Target không còn**

```json
{
  "type": "PLAYER",
  "available": false,
  "reportHistory": { "...": "..." }
}
```

### 3.3 Lỗi và bảo mật

- Endpoint vẫn dùng `authenticate` + `requireRole('ADMIN')`; lỗi 401/403/404 giữ nguyên.
- Target thiếu bản ghi → `200` với `available: false`, không 500 và không lộ chi tiết DB.
- Không trả `passwordHash`, email nội bộ khác, hay dữ liệu hội thoại.
- UI render text bằng React (escape mặc định); không dùng `dangerouslySetInnerHTML`.

## 4. Task backend

### [x] RTP-01 — DTO và service target detail

**Việc làm:**

- [x] Thêm types `AdminReportTargetView`, `TargetReportHistoryView`, payload từng loại trong
  `backend/src/services/admin/AdminReportService.ts` hoặc file types riêng.
- [x] Tạo `backend/src/services/admin/AdminReportTargetService.ts`:
  - nhận `ReportRecord`, xác định target type/id;
  - build `reportHistory`;
  - switch theo loại để build payload;
  - trả `available: false` khi không tìm thấy bản ghi target.
- [x] `AdminReportService.getReport` gọi target service và gắn `target` vào response.

**Files:**

- `backend/src/services/admin/AdminReportService.ts`
- `backend/src/services/admin/AdminReportTargetService.ts` (mới)

### [x] RTP-02 — Repository đọc dữ liệu target

**Việc làm:**

- [x] Tạo `backend/src/repositories/admin/AdminReportTargetRepository.ts`:
  - `reportHistoryByTarget(type, targetId)`: total/open/last30Days/distinctReporters/byReason.
  - `recentReportsByTarget(type, targetId, limit = 5)`.
  - `recentPostsByAuthor(authorId, limit = 5)`.
  - `recentCommentsByAuthor(authorId, limit = 5)`.
  - `hiddenContentCounts(authorId)`.
  - `findSkillLevel(id)`, `findTournament(id)`.
- [x] Tận dụng repository có sẵn cho phần đã có method:
  - `userRepository.findUserById`
  - `facilityRepository.findById`
  - `socialRepository.findPost` / `findComment`
  - `messagingRepository.findMessageById`
- [x] Excerpt: cắt ~160 ký tự, chuẩn hóa whitespace.
- [x] Giữ id dạng string trong response.

**Lưu ý hiệu năng:** không thêm index v1; các query đều `LIMIT 5` hoặc aggregate theo target.

### [x] RTP-03 — Test backend

- [x] `backend/src/__tests__/admin-reports.test.ts`:
  - Cập nhật allowlist của detail: thêm key `target`.
  - PLAYER: profile + `reportHistory` (2 report cùng user, 1 OPEN, 1 RESOLVED, số reporter khác
    nhau) + `recentContent` rỗng khi user chưa có bài.
  - FACILITY: trả đúng name/address/status/owner/courtCount.
  - TOURNAMENT: trả đúng name/status/dates/creator.
  - 401/403 vẫn đúng.
- [x] `backend/src/__tests__/admin-report-evidence.test.ts`:
  - POST: `target.post.body`, author, flags.
  - COMMENT: thêm case report comment, kiểm tra `target.comment` + `target.post`.
  - MESSAGE: `target.message` có sender/body; `expect(target.message).not.toHaveProperty('conversationId')`.
- [x] Test target không tồn tại: nếu không tạo được bằng FK, test ở service-level với repo mock
  hoặc bỏ qua kèm ghi chú (defensive branch).

**Lệnh:**

```bash
npm test --prefix backend -- --run src/__tests__/admin-reports.test.ts
npm test --prefix backend -- --run src/__tests__/admin-report-evidence.test.ts
npx tsc --noEmit --project backend/tsconfig.json
```

## 5. Task frontend (base UI)

### [ ] RTP-04 (UI-REDO) — Types và render panel

**Việc làm:**

- [x] `frontend/src/features/admin/reports/types/report.ts`: thêm types target detail.
- [x] Tạo `frontend/src/features/admin/reports/components/ReportTargetPanel.tsx`:
  - PLAYER: hồ sơ + risk + recent content + link user.
  - POST/COMMENT: nội dung + author + badge ẩn/xóa.
  - FACILITY/TOURNAMENT: definition list tóm tắt.
  - MESSAGE: sender + thời gian + body + ghi chú không mở hội thoại.
  - `available: false`: thông báo “Đối tượng không còn tồn tại hoặc đã bị xóa”.
- [x] `ReportManagementPage.tsx`:
  - render `<ReportTargetPanel target={detail.target} />` phía trên “Mô tả từ người báo cáo”;
  - đổi “Người báo cáo #id” thành link `/admin/users?userId=<reporterId>`;
  - không thêm fetch mới vì target nằm trong detail.
- [x] `reports.css`: style tối thiểu cho panel, badge `Đã ẩn`/`Đã xóa`, grid chỉ số risk.

**Files:**

- `frontend/src/features/admin/reports/types/report.ts`
- `frontend/src/features/admin/reports/components/ReportTargetPanel.tsx` (mới)
- `frontend/src/features/admin/reports/pages/ReportManagementPage.tsx`
- `frontend/src/features/admin/reports/reports.css`

### 5.1 Layout base (đủ thấy dữ liệu)

```text
┌ Đối tượng bị báo cáo ────────────────────────────────────────────┐
│ [avatar] Nguyễn Văn A   [ACTIVE]                                 │
│ a@example.com · 0900000000 · Tham gia 12/01/2026                 │
│ Trình độ: Trung bình            [Mở hồ sơ người dùng]            │
│                                                                   │
│ Tín hiệu kiểm duyệt                                              │
│ Tổng 5 · Đang mở 1 · 30 ngày 2 · Reporter khác nhau 4            │
│ Lý do: Quấy rối (3) · Spam (2)                                   │
│                                                                   │
│ Báo cáo gần đây                                                   │
│ #101 · Người báo #456 · Quấy rối · Chờ xử lý · 19/11 10:00      │
│                                                                   │
│ Hoạt động công khai gần đây                                      │
│ Bài viết #55 · "Nội dung…" · 18/11 · [Đã ẩn]                     │
│ Bình luận #77 trong bài #55 · "Nội dung…" · 18/11               │
└───────────────────────────────────────────────────────────────────┘
```

Yêu cầu base UI:

- Không chart, không tab, không animation.
- Danh sách rỗng hiển thị “Chưa có dữ liệu”.
- Badge trạng thái dùng class hiện có nếu phù hợp; không cần đồng bộ visual cuối.
- Mobile: panel xếp dọc, không tràn ngang.

### [x] RTP-05 — Kiểm tra frontend

```bash
npx tsc -b --noEmit --project frontend/tsconfig.json
npm run lint --prefix frontend
npm run build --prefix frontend
```

## 6. Docs

- [x] Cập nhật `docs/features/admin/report-management/tech-design.md` §2.2:
  - mô tả object `target` và các payload theo loại;
  - ghi rõ MESSAGE không trả conversation;
  - ghi rõ PLAYER chỉ có report history + public activity, không có content snapshot.
- [x] Cập nhật `docs/features/admin/report-management/tasks.md`: thêm RP-10 tương ứng RTP-01→05.
- [x] Cập nhật `docs/plans/00_danh-muc-task.md`: thêm dòng 16 và trạng thái khi hoàn thành.

## 7. Acceptance checklist

- [x] Mở report PLAYER: thấy hồ sơ, risk, report gần đây, hoạt động công khai, link user.
- [x] Mở report POST: thấy nội dung hiện tại, author, trạng thái ẩn/xóa; evidence vẫn bên dưới.
- [x] Mở report COMMENT: thấy comment + bài viết cha + author.
- [x] Mở report FACILITY/TOURNAMENT: thấy thông tin tóm tắt + report history.
- [x] Mở report MESSAGE: chỉ thấy sender/thời gian/body snapshot; không có conversation.
- [x] Target thiếu bản ghi: UI báo không còn tồn tại, không crash.
- [x] 401/403/404 giữ nguyên; không lộ dữ liệu ngoài allowlist.
- [x] Test backend targeted PASS; frontend build + lint PASS.
- [x] Không có thay đổi schema/migration trong đợt này.

## 8. Rủi ro và theo dõi

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| --- | --- | --- |
| Report PLAYER không có evidence nên vẫn khó kết luận | Admin phải dựa vào mô tả + lịch sử | Hiển thị rõ “báo cáo cấp tài khoản”; ghi chú sản phẩm cho đợt mở report PLAYER |
| Truy vấn report history theo target chưa có index | Chậm khi dữ liệu lớn | LIMIT 5 + aggregate; thêm partial index ở đợt sau nếu cần |
| Nội dung đã xóa vẫn hiển thị | Nhạy cảm | Chỉ Admin thấy; gắn nhãn `Đã xóa`/`Đã ẩn` |
| Response detail phình to | Chậm nhẹ khi mở dialog | Giới hạn 5 phần tử mỗi danh sách; chỉ tính khi mở detail |
| UI base chưa phải final | Lệch visual | Giữ nhãn `UI-REDO` tới khi merge frontend |

## 9. Bằng chứng hoàn thành (2026-11-20)

- Backend: `GET /api/v1/admin/reports/:id` trả thêm `target`; thêm `AdminReportTargetService`,
  `AdminReportTargetRepository`; mở rộng `PostRow` với `hiddenBy`.
- Tests backend: `admin-reports.test.ts` + `admin-report-evidence.test.ts` — **19/19 PASS**.
- Frontend: types target detail, `ReportTargetPanel`, render trong dialog, reporter link,
  CSS base; `tsc -b` + `npm run build` PASS.
- Không có migration/schema change.
- UI vẫn **UI-REDO**: base đủ thấy dữ liệu, chưa kiểm tra final visual sau merge frontend.
