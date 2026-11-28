# Khoảng trống danh mục test case nghiệp vụ — TC2.5

- Ngày rà: 28/11/2026.
- Danh mục case: [`test-cases.csv`](test-cases.csv). Số liệu tổng hợp: [`automation-summary.md`](automation-summary.md).
- Nguồn AC đã review: [`acceptance-register.csv`](acceptance-register.csv).
- Tài liệu đối chiếu: `PROJECT-BRIEF.md`, `docs/business-rules-config-matrix.md`, PRD/Tech Design hiện hành, [metrics.md](../metrics.md).
- Phạm vi lần này: chỉ hoàn thiện danh mục và bằng chứng. Không sửa production, không thêm dependency, không viết hàng loạt test mới, không commit/push.

## 1. Kết quả review AC

`acceptance-register.csv` ban đầu có 155 bullet trích tự động từ các mục Acceptance. Lần này review toàn bộ 155 dòng, bổ sung 51 AC cho các domain chưa có mục AC riêng (tournament, wallet/payment, notification, court-owner, auth OTP/CSRF, profile survey/avatar/phone, messaging, matchmaking social), nâng tổng lên **206 dòng**.

| Nhóm | Số dòng | Ý nghĩa |
| --- | ---: | --- |
| `CURRENT / IN_SCOPE` | 184 | AC hiện hành, dùng làm mẫu số truy vết |
| `UNRESOLVED / CONFLICT` | 15 | AC rating: mâu thuẫn phạm vi PROJECT-BRIEF với metrics.md |
| `UNRESOLVED / UNRESOLVED` | 1 | AC-SRC-118 còn Provisional (Decision #21) |
| `SUPERSEDED / HISTORICAL` | 4 | AC-SRC-057, 092, 093, 124 |
| `SUPERSEDED / CONFLICT` | 1 | AC-SRC-071 (cờ rating tournament cũ) |
| `HISTORICAL / OUT_OF_SCOPE` | 1 | AC-SRC-019 (milestone UI-REDO, không phải hành vi) |

**Không có cặp trùng khít.** Một số AC chồng lấn nhưng khác expected result nên được giữ: AC-SRC-020 (shape phân trang admin users, nguồn Draft) và AC-SRC-032 (list user không lộ password_hash); AC-SRC-053 (hủy lặp idempotent) và AC-SRC-051 (hủy lần đầu); AC-SRC-073/074 (summary self/other). Gộp chúng sẽ làm mất một vế kiểm chứng.

### 1.1. AC superseded và lý do

| AC | Lý do |
| --- | --- |
| AC-SRC-057 | Tech Design cũ mô tả tự tạo Match khi người cuối accept. Quyết định 2026-11-08 yêu cầu chủ kèo chủ động chốt; xem `PROJECT-BRIEF.md` §3.2/§7 và `docs/business-rules-config-matrix.md` mục chốt 2026-11-08. |
| AC-SRC-092 | Danh mục 6 mã trình độ cũ bị thay bằng khảo sát 16 câu/7 bậc (2026-11-15). |
| AC-SRC-093 | Đăng ký không còn nhận trực tiếp mã `AVERAGE`; trình độ do khảo sát sinh ra. |
| AC-SRC-124 | PRD Decision #28: đăng ký không đặt cookie; `GET /auth/me` là 401 đến khi đăng nhập. |
| AC-SRC-071 | Tournament không dùng rating sau trận; cờ `TOURNAMENT_RATING_ENABLED` là cấu hình legacy, không còn là oracle. |
| AC-SRC-019 | Tiêu chí milestone “mọi màn UI-REDO”; không phải hành vi nghiệp vụ kiểm chứng được. |

### 1.2. AC unresolved và lý do

- **AC-SRC-064…079 (trừ 071)**: Ratings Tech Design tự ghi “nội dung cũ trái với mục này là thiết kế legacy”, thiết kế mới/TBD chưa Ready; `PROJECT-BRIEF.md` §5 xếp Post-match Rating ngoài MVP; `metrics.md` hạng mục 10 vẫn cam kết. Đây là mâu thuẫn thứ bậc tài liệu, không tự chọn một cách hiểu.
- **AC-SRC-118**: AC công khai danh sách/chi tiết giải và sân còn ghi “Provisional — Decision #21”, chưa đủ căn cứ làm oracle.
- Ngoài ra `PROJECT-BRIEF.md` §7 xác nhận cơ chế điểm phong độ từ giải chuyên nghiệp, còn `metrics.md` §6 nói công thức nâng trình chưa có quyết định. Case TC-TRN-19 được đánh `CONFLICT`, không dùng để mở rộng cam kết.

## 2. AC hiện hành chưa có case

| AC | Nguồn | Lý do / hướng xử lý |
| --- | --- | --- |
| AC-SRC-127 | Auth Tech Design §17 | “Migration áp sạch trên bản sao DB”. Đây là verification migration, đã có log `artifacts/migrations.log` (45 migration, no schema diff) nhưng không phải case nghiệp vụ. Nếu muốn 100% AC có case, tạo case `Integration` riêng cho migration gate; không gán vào case auth. |
| AC-SRC-128 | Auth Tech Design §16 | “Mọi error code §9.3 được sinh bởi ít nhất một test”. Là meta-check trên bộ test, không phải hành vi; cần script đối chiếu error-code registry với test assertions. |
| AC-SRC-129 | Auth Tech Design §16 | “Mọi technical check §16 pass”. Là điều kiện verification tổng hợp; cần bảng ánh xạ từng check sang test/lệnh chạy. |

Ba AC này không làm thay đổi tỷ lệ tự động hóa case nghiệp vụ, nhưng là lý do không công bố “100% AC có case”.

## 3. Case trong phạm vi chưa tự động hóa đầy đủ

19 case `IN_SCOPE` không `AUTOMATED`: 12 `PARTIAL`, 6 `PLANNED`, 1 `MANUAL`.

| Case | Trạng thái | Thiếu gì / việc cần làm |
| --- | --- | --- |
| TC-AUTH-04 | PLANNED | Chưa có test assert riêng email thiếu/sai định dạng. Thêm API/validation test cho từng dạng email. |
| TC-AUTH-08 | PARTIAL | Đã có login refusal và middleware status; chưa có test “Admin suspend → request kế tiếp của user bị 401”. Thêm test tích hợp. |
| TC-AUTH-09 | PARTIAL | Đã khóa sau 5 lần và reset; chưa tua thời gian qua `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` để chứng minh mở khóa. Dùng clock/fake time, không chờ thật. |
| TC-AUTH-13 | PARTIAL | Chỉ assert idle timeout; chưa assert absolute 8h Admin/30d Player. Bổ sung boundary trước/đúng/sau. |
| TC-AUTH-16 | PLANNED | Chưa có test Admin gọi 3 endpoint Player-only (booking, matchmaking, tournament registration). Middleware generic không thay thế. |
| TC-AUTH-19 | PLANNED | Chưa khẳng định không tồn tại route đổi role và payload role bị loại ở mọi endpoint hồ sơ/admin. |
| TC-AUTH-20 | PARTIAL | UI chỉ assert Court Owner bị chặn `/admin`; chưa assert các khu Player-only (matchmaking, booking as booker, tournament participation). |
| TC-PRF-04 | PLANNED | Chưa có test “một Player chỉ làm khảo sát một lần/không retake/không ghi đè kết quả”. |
| TC-PRF-07 | PARTIAL | Đã assert casual cancelled/LEFT và Double; chưa assert tournament WALKOVER, loại BYE, `resultsAvailable` đầy đủ. |
| TC-SOC-09 | PARTIAL | Chỉ có UI mock khóa field sau acceptance; chưa có API test server từ chối đổi start/type/capacity. |
| TC-BK-10 | PLANNED | Owner cancel sau start có test; Player cancel sau start chưa có assertion `BOOKING_CANCELLATION_DEADLINE_PASSED`. |
| TC-BK-15 | PLANNED | Chưa chứng minh đổi `BOOKING_PAYMENT_TIMEOUT_MINUTES` không sửa `expires_at` của booking đã tạo (wallet top-up có snapshot, Booking thì chưa). |
| TC-WAL-12 | PARTIAL | Mark-paid qua webhook có; chưa assert thiếu transfer reference bị từ chối và mọi transition trái state machine. |
| TC-WAL-13 | PARTIAL | Ledger/audit/clean reconcile có; chưa assert đủ mọi loại discrepancy và “cùng amount cho mọi category”. |
| TC-WAL-14 | PARTIAL | Export audit có; chưa assert Admin debit vượt số dư bị từ chối và redaction secret/full bank number. |
| TC-CO-09 | PARTIAL | API availability phản ánh thay đổi; chưa có E2E browser Owner→Player “thấy ngay”. |
| TC-TRN-15 | PARTIAL | Admin cancel running tournament có; chưa có test Admin không được nhập/sửa kết quả. |
| TC-ADM-14 | PARTIAL | Auth/estimate/empty có; payout state machine đầy đủ chưa assert hết (trùng TC-WAL-12). |
| TC-UAT-01 | MANUAL | 14 kịch bản UAT chưa được người đại diện thực hiện. Không tạo kết quả/chữ ký thay. |

Ngoài ra, trong 135 case `AUTOMATED`, một số case ghép nhiều vế trong một expected result và dựa trên nhiều test cùng file/suite (ví dụ TC-AUTH-01, TC-BK-05, TC-TRN-07, TC-ADM-05). Các vế đã được đối chiếu assertion, nhưng khi bảo vệ nên mở đúng test được dẫn, không chỉ đọc tên case.

## 4. Mâu thuẫn tài liệu ảnh hưởng test oracle

| Mã | Mâu thuẫn | Ảnh hưởng |
| --- | --- | --- |
| DOC-01 | Post-match Rating: `PROJECT-BRIEF.md` §5 ngoài MVP; `metrics.md` hạng mục 10 cam kết; Ratings Tech Design ghi legacy/TBD. | 7 case D10 và 15 AC bị treo; không dùng kết quả test để khẳng định phạm vi. |
| DOC-01 (mở rộng) | Điểm phong độ từ giải chuyên nghiệp: PROJECT-BRIEF xác nhận; metrics.md §6 nói công thức chưa quyết định. | TC-TRN-19 bị `CONFLICT`; không dùng để mở rộng cam kết khối lượng. |
| DOC-01 (split bill) | PROJECT-BRIEF bổ sung Split Bill 2026-11-20; `docs/documentation-guide.md` §2.4 vẫn ghi ngoài MVP. | Case split bill dùng PROJECT-BRIEF (thứ bậc cao hơn); ghi nhận để chủ tài liệu sửa, không sửa guide trong đợt này. |
| DOC-01 (social) | `metrics.md` hạng mục 3 mô tả “bài tìm kèo” trên bảng tin cộng đồng; PROJECT-BRIEF tách Social/Matchmaking. | Case dùng hành vi tách khu vực; UI/E2E xác nhận bài tìm kèo không vào feed Social. |
| DOC-01 (draft docs) | Admin frontend-consolidation và System-config Tech Design đang `Draft` nhưng hành vi đã triển khai/test. | AC vẫn `CURRENT` nhưng ghi rủi ro tài liệu; không tự nâng trạng thái Ready. |
| DOC-01 (finance) | Finance PRD AC-06 còn nói owner earning sau completed booking; decision FIN-D1 nói credit khi payment SUCCESS. | Case owner earning dùng decision hiện hành; cần chủ tài liệu đồng bộ. |

Không tự sửa nghĩa nghiệp vụ để khớp code hoặc test. Các mục này cần chủ tài liệu quyết định.

## 5. Thiếu minh chứng thực thi

- **CI cuối**: chưa có run GitHub Actions cho working tree hiện tại. Toàn bộ `PASSED` là local 28/11/2026; không gọi là kết quả CI.
- **UAT**: 14 kịch bản chưa thực hiện; không có chữ ký/kết quả người dùng.
- **Coverage**: báo cáo local 88,90% là tổng hợp hai phép đo trên tập file rời nhau; CI với cấu hình cuối chưa chạy.
- **Pass rate**: 135/135 case `PASSED` đã chạy, nhưng 19 case phạm vi chính chưa chạy đủ; không được báo 100% cho toàn bộ 154 case.
- **Defect**: SEC-01 đã vá và retest, Closed; SEC-02/SEC-03 Moderate vẫn Open. Trong phạm vi repository đã rà: 0 Critical/Blocker đã xác nhận đang mở; cần rà lại trước bảo vệ. Xem [security-triage.md](security-triage.md).
- **Artifact**: `artifacts/` bị Git ignore; khi bàn giao phải mang theo thư mục hoặc link CI còn hiệu lực.

## 6. Ưu tiên khắc phục

### P0 — cần trước khi kết luận tỷ lệ cuối

1. Chốt phạm vi Post-match Rating và công thức điểm phong độ với chủ tài liệu; cập nhật PROJECT-BRIEF/metrics/PRD/TD theo cùng một quyết định.
2. Thêm test cho các lỗ hổng bảo mật/tiền: TC-AUTH-08, TC-AUTH-09, TC-AUTH-13, TC-AUTH-16, TC-BK-10, TC-WAL-12, TC-WAL-14.
3. Chạy CI trên cùng SHA và lưu artifact; không dùng local thay CI.
4. Người đại diện thực hiện UAT-01…UAT-14, ghi kết quả và ký.

### P1 — tăng độ phủ nghiệp vụ

5. TC-AUTH-04 (email malformed), TC-AUTH-19 (đổi role), TC-PRF-04 (no retake), TC-SOC-09 (server-side lock field), TC-BK-15 (booking timeout snapshot).
6. TC-PRF-07 (BYE/WALKOVER/statistics), TC-WAL-13 (đủ loại reconciliation), TC-CO-09 (E2E Owner→Player), TC-TRN-15 (Admin không nhập kết quả), TC-ADM-14 (payout state machine).
7. Tạo case/script cho AC-SRC-127/128/129 để đóng 3 AC meta gap.

### P2 — chất lượng hồ sơ

8. Tách các case ghép quá nhiều vế nếu khi bảo vệ không giải thích được từng assertion.
9. Bổ sung case UI/UX thực (không chỉ mock) cho các luồng chính còn thiếu: tìm sân, feed Social, organizer bracket.
10. Rà lại `trace-links.csv` cũ (47 liên kết/44 AC) và đánh dấu là chi tiết lịch sử, không phải mẫu số.

## 7. Điều kiện đóng gap

- Mỗi AC hiện hành có case hoặc quyết định phạm vi bằng văn bản.
- Mỗi case `AUTOMATED` có ít nhất một test pass trong CI trên SHA chốt.
- Mỗi case `PARTIAL` được nâng đủ hoặc tách phần thiếu thành case `PLANNED` có owner.
- UAT có kết quả và chữ ký; không tự tạo.
- Không còn `CONFLICT` chưa phân xử ảnh hưởng mẫu số.
