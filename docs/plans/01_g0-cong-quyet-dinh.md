# 01 — G0: Cổng quyết định

- Ưu tiên: 01 (cao nhất)
- Track/Phase: G0 / Phase 0
- Prerequisite: Không
- Exit gate: Tất cả quyết định bên dưới có kết luận bằng văn bản, có owner và ngày; D1c công thức nâng trình được defer rõ ràng cho đồng đội (TRN-14 ngoài release)
- Không được bắt đầu code của track liên quan trước khi dòng tương ứng được tick
- Cập nhật chốt: 2026-11-15

## 1. Mục đích

Chốt mọi điểm `TBD`/mơ hồ có thể làm thay đổi schema, API hoặc contract trước khi viết code. Mục tiêu là không có work package nào phải dừng giữa chừng vì thiếu quyết định nghiệp vụ.

## 2. Trạng thái quyết định — chốt 2026-11-15

| ID | Trạng thái | Kết luận đã chốt | Còn lại / defer |
| --- | --- | --- | --- |
| D1a | **CLOSED (mechanics)** | Single-elimination; Singles/Doubles; entry fee; Organizer theo ngữ cảnh; seed/draw; trạng thái; system booking. Điều kiện tham gia chuyên nghiệp: Player đăng nhập + trong thời gian đăng ký + còn slot. | Xác nhận kết quả/thành tích và hiển thị achievement → TRN-14 (D1c) |
| D1b | **CLOSED** | Organizer nhập tay hoặc import Excel; không tạo tài khoản; Organizer chọn free/paid (paid dùng payment pipeline); hiển thị summary công khai, ẩn SĐT/ghi chú liên hệ | Chi tiết template Excel/validator → thiết kế TRN-13, không phải quyết định nghiệp vụ |
| D1c | **PARTIAL / DEFERRED** | Điều kiện tham gia chuyên nghiệp đã chốt; sửa/hủy kết quả → revert tự động; rating không dùng nâng trình | Công thức/ngưỡng nâng trình, xác nhận thành tích, quyền xác nhận: **đồng đội hoàn thành sau**; TRN-14 ra khỏi release hiện tại |
| D2 | **CLOSED** | Dùng `camelCase` cho Admin Reports API; sửa Tech Design/example và code theo hướng này | RP-01/02 cập nhật contract/test |
| D3 | **CLOSED** | Dùng bảng `PAYMENT_REFUNDS` (status, attempt, last_error, claimed_at, completed_at); một payment có thể có nhiều attempt | Chi tiết cột/index → PAY-04 + `database-schema.md` |
| D4 | **CLOSED (defer sandbox)** | Code adapter/signature/test offline + Mock E2E; VNPAY sandbox smoke là release gate, không chặn code | Cần credentials/IPN/quyền refund trước smoke |
| D5 | **CLOSED** | Resolver hiện tại: `POST`, `MATCHMAKING_REQUEST`; `CONVERSATION` defer. Route đích và quyền đọc theo `frontend.md` + `canView`/recruitment access | `BOOKING`/`TOURNAMENT` bổ sung khi producer tương ứng (BK-10/TRN-10) |
| D6 | **CLOSED** | Xác nhận bounds/default theo System Config Tech Design §7.3 và business matrix | Không đổi bounds trong release này |
| D7 | **CLOSED (decision)** | `REPORT_ENABLED` domain `report`, default `true`; chỉ chặn tạo report, không chặn Admin xử lý report cũ | Registry/seed implementation → F2/RP-06 |
| D8 | **CLOSED (defer)** | AF-01→03 ra khỏi release; giữ pattern Admin hiện tại | Không chặn Dashboard/Reports/Config |
| **D9** | **CLOSED** | Ví ảo thuộc release. Nạp bằng VNPAY; rút tự động qua VNPAY payout; user tự thêm tài khoản nhận; xử lý ngay; refund về ví; Court Owner tạo payout request + Admin duyệt; không phí nền tảng; không hạn mức; Admin credit/debit ví có audit append-only | Payments docs + Track A đã sync sang ví-first |

## 3. Điểm cần chốt (ma trận gốc)

| ID | Câu hỏi cần chốt | Owner đề xuất | Đầu ra bắt buộc | Chặn task |
| --- | --- | --- | --- | --- |
| D1a | Giải **chuyên nghiệp**: thể thức bracket, đơn/đôi, điều kiện tham gia, phí, quyền Organizer, xác nhận kết quả | Product + Tech Lead | Cập nhật `tournament/prd.md`, `tech-design.md`, `tasks.md` | TRN-01→08, 10, 11 |
| D1b | Giải **phong trào**: nhập người không tài khoản, đăng ký/phí, hiển thị Social/privacy | Product | Cập nhật PRD/Tech Design + quyết định schema participant | TRN-13 |
| D1c | **Nâng trình** từ giải chuyên nghiệp: công thức, ngưỡng, xử lý sửa/hủy kết quả | Product | Cập nhật business rules + Tech Design | TRN-14 |
| D2 | Casing API Admin Reports: `snake_case` hay `camelCase` | Tech Lead | Ghi trong `report-management/tech-design.md` | RP-01/02/03/04 |
| D3 | Schema delta cho refund durable: cột/bảng claim, attempt, timeout, lỗi cuối | Tech Lead + schema review | Delta trong `database-schema.md` + Tech Design | PAY-04 |
| D4 | VNPAY sandbox: credentials, IPN HTTPS, quyền refund | Ops/Business | Biên bản xác nhận môi trường | Chỉ release gate |
| D5 | Route/authorization cho notification resource resolver | Tech Lead | Bảng resource type → route → quyền đọc | NTF-05 |
| D6 | Catalog bounds System Config §7.3 | Business Owner | Xác nhận hoặc điều chỉnh bounds | SC-06/SC-08 |
| D7 | `REPORT_ENABLED`: registry + seed + gate | Tech Lead | Key trong registry, seed idempotent | RP-06 |
| D8 | Đưa `admin/frontend-consolidation` Tech Design sang Ready | Tech Lead | Tech Design Ready | AF-01→03 |
| D9 | Ví ảo toàn sàn có thuộc release này không; nếu có, chốt nạp/rút/refund/phí/đối soát | Product + Tech Lead | Cập nhật Payments PRD/Tech Design/tasks | PAY-01→04, BK-06/12, TRN-05 |

## 4. Danh sách task chi tiết

### [x] G0-01 — Chốt D1a (Tournament chuyên nghiệp)

- [x] Xác nhận thể thức: single-elimination.
- [x] Xác nhận đơn/đôi và quy tắc team/invitation.
- [x] Xác nhận điều kiện tham gia: Player đăng nhập + trong thời gian đăng ký + còn slot.
- [x] Xác nhận phí, thời hạn thanh toán, chính sách rút/hủy theo PRD hiện tại.
- [x] Xác nhận quyền Organizer theo ngữ cảnh tournament.
- [x] Ghi quyết định vào file này; PRD/Tech Design/Tasks cập nhật cùng ngày.
- [x] Tech Lead review.
- [ ] Xác nhận kết quả/thành tích: defer sang TRN-14.

### [x] G0-02 — Chốt D1b (Tournament phong trào)

- [x] Xác nhận cách nhập participant: thủ công hoặc Excel; không tạo tài khoản.
- [x] Xác nhận không tạo tài khoản giả, không gắn vào lịch sử Player.
- [x] Xác nhận Organizer chọn free/paid; paid dùng payment pipeline.
- [x] Xác nhận hiển thị summary công khai, ẩn SĐT/ghi chú liên hệ.
- [ ] Chốt chi tiết schema/template Excel → thiết kế TRN-13.
- [x] Cập nhật tài liệu và ký.

### [ ] G0-03 — Chốt D1c (Nâng trình chuyên nghiệp)

- [x] Xác nhận điều kiện tham gia chuyên nghiệp (Player + thời gian + slot).
- [x] Xác nhận sửa/hủy kết quả: revert tự động.
- [x] Xác nhận rating không dùng nâng trình.
- [ ] Công thức/ngưỡng nâng trình: **defer**, đồng đội hoàn thành sau.
- [ ] Xác nhận thành tích/quyền xác nhận: **defer** cùng TRN-14.
- [ ] Cập nhật business rules + Tech Design cho phần công thức (khi có).

### [x] G0-04 — Chốt D2 (Casing Reports)

- [x] So sánh `snake_case` hiện tại với `conventions.md`.
- [x] Chọn `camelCase`.
- [x] Ghi quyết định vào Tech Design.
- [x] Xác nhận frontend mapping sẽ dùng camelCase.
- [ ] RP-01/02 cập nhật code/test theo camelCase.

### [x] G0-05 — Chốt D3 (Refund persistence)

- [x] Chọn bảng `PAYMENT_REFUNDS` thay vì thêm cột rải rác.
- [x] Xác nhận một payment có nhiều attempt; lưu claim/attempt/last_error/completed_at.
- [x] Không phá payment rows hiện có (bảng mới).
- [ ] Viết delta chi tiết + migration trong PAY-04.
- [ ] Ghi `database-schema.md` Change Log trong PAY-04.

### [x] G0-06 — Chốt D4 (VNPAY sandbox)

- [x] Quyết định defer sandbox: code adapter/signature/test offline + Mock E2E trước.
- [x] Xác nhận thiếu sandbox chỉ chặn smoke test, không chặn code.
- [ ] Có credentials/IPN/quyền refund trước release gate.
- [ ] Ghi biên bản môi trường khi có.

### [x] G0-07 — Chốt D5 (Notification resolver)

- [x] Resource type hiện tại: `POST`, `MATCHMAKING_REQUEST`; `CONVERSATION` defer.
- [x] Route đích: `/posts/:postId`, `/matchmaking/requests/:requestId`.
- [x] Quyền đọc: `canView` của Social/recruitment access; link không cấp quyền.
- [x] 404/403 → neutral unavailable, không link.
- [x] Ghi vào Notifications Tech Design.
- [ ] `BOOKING`/`TOURNAMENT` bổ sung khi BK-10/TRN-10 có producer.

### [x] G0-08 — Chốt D6 (Config bounds)

- [x] Rà toàn bộ key trong `config-registry.ts`.
- [x] Xác nhận min/max/enum/default theo Tech Design §7.3 + matrix.
- [x] Xác nhận cross-key rule `MATCHMAKING_GROUP_MIN_SLOTS ≤ MATCHMAKING_GROUP_MAX_SLOTS`.
- [x] Không đổi bounds trong release này; thay đổi sau là config data.

### [x] G0-09 — Chốt D7 (`REPORT_ENABLED`)

- [x] Xác nhận key domain `report`, default `true`.
- [x] Xác nhận gate chỉ chặn tạo report; Admin review/hide vẫn hoạt động.
- [x] Quyết định đã có trong matrix/Tech Design.
- [ ] Thêm key vào registry + seed idempotent → F2/RP-06 (implementation).

### [x] G0-10 — Chốt D8 (Admin frontend consolidation)

- [x] Review Tech Design AF.
- [x] Quyết định defer AF-01→03 ra khỏi release.
- [x] Ghi rõ AF không chặn Dashboard/Reports/Config.
- [x] Giữ pattern Admin hiện tại.

### [ ] G0-11 — Công bố quyết định

- [x] Tập hợp link tới PRD/Tech Design/ADR đã cập nhật.
- [x] Ghi decision log trong file này.
- [x] Cập nhật `00_danh-muc-task.md` khi D9 đóng.
- [x] Đồng bộ PRD/Tech Design Tournament/Reports/Payments theo decision log.

### [x] G0-12 — Chốt D9 (Ví ảo)

- [x] Xác nhận ví ảo thuộc release hiện tại.
- [x] Nạp bằng VNPAY; rút tự động qua VNPAY payout.
- [x] User tự thêm tài khoản nhận; xử lý ngay khi lệnh hợp lệ.
- [x] Refund booking/giải về ví.
- [x] Court Owner tạo payout request; Admin duyệt.
- [x] Không phí nền tảng, không hạn mức trong MVP.
- [x] Admin credit/debit ví có lý do + audit append-only.
- [x] Cập nhật Payments PRD/Tech Design/Tasks và Track A sang ví-first.

## 5. Test đầu ra

```bash
# 1. Không còn TBD trong các mục đã chốt
grep -rn "TBD" docs/features/tournament docs/features/admin/report-management docs/features/platform/payments-refunds

# 2. Decision log có ngày
grep -rn "2026-11-15" docs/plans/01_g0-cong-quyet-dinh.md docs/features/tournament docs/features/admin/report-management
```

- [x] Mỗi quyết định D1a–D8 có kết luận/owner/ngày trong file này.
- [ ] PRD/Tech Design/Tasks liên quan đã đồng bộ.
- [ ] D9 được chốt trước khi bắt đầu Payments.
- [ ] Tech Lead xác nhận không có code phụ thuộc quyết định chưa đóng.

## 6. Checklist hoàn thành file

- [x] D1a, D1b, D2, D3, D4, D5, D6, D7, D8 đã chốt.
- [x] D9 ví ảo đã chốt; Track A cập nhật sang ví + top-up VNPAY.
- [x] D1c phần công thức defer có ghi owner/đồng đội; TRN-14 ra khỏi release.
- [x] PRD/Tech Design/Database schema đã cập nhật cho Tournament/Reports/Payments.
- [x] `01` DONE trong `00_danh-muc-task.md` (G0 release scope).

## 7. Ghi chú đồng bộ tài liệu

- Tournament: cập nhật đoạn `TBD` về participant/fee/privacy/eligibility/revert; giữ `TBD` cho công thức nâng trình.
- Reports: ghi quyết định camelCase; RP-01/02 cập nhật example/test.
- Payments: ghi quyết định `PAYMENT_REFUNDS`; PAY-04 tạo migration chi tiết.
- System Config: bounds giữ nguyên.
- AF: ghi defer trong `admin/frontend-consolidation/tasks.md`.
