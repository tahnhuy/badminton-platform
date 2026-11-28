# Theo dõi defect và các vấn đề minh chứng

Nguồn trạng thái của đợt kiểm thử này là bảng dưới; chưa đồng bộ GitHub Issues vì chưa xác nhận cấu hình tracker và không tạo bản ghi ngoài repository trong lần này. Dùng `Open → In progress → Fixed → Retest → Closed`, hoặc `Reopened`. Mỗi lỗi đóng phải có commit/diff sửa và kết quả retest. Severity khác priority; cảnh báo dependency chưa tự động là defect nghiệp vụ đã khai thác được.

| ID | Phát hiện | Phân loại | Trạng thái | Bằng chứng và việc cần làm |
| --- | --- | --- | --- | --- |
| DOC-01 | AC Matchmaking §20 mô tả tự tạo trận khi đủ người, khác Project Brief chủ động chốt | Mâu thuẫn đặc tả, ảnh hưởng test oracle | Open | `traceability.md`; cần chủ tài liệu cập nhật qua luồng quản lý tài liệu chung |
| SEC-01 | Dependency audit ban đầu có Critical/High, thêm hai High phía frontend | Advisory/exposure; không tự đồng nhất exploit runtime | Closed — patched/retested 28/11 | [Triage và lifecycle](security-triage.md), [20 package findings](security-triage.csv); sau vá: 0 Critical/High, regression API/DB 150/150, UI 40/40, core 15/15 và dashboard thật 1/1 |
| SEC-02 | Drizzle legacy loader kéo esbuild 0.18.20 (4 package findings) | Moderate/dev tooling; current path transform-only, không dùng serve | Open — upstream maintenance | Owner UNASSIGNED; [đường gọi, giới hạn và follow-up](security-triage.md#sec-02--drizzle-legacy-loader--esbuild); không đổi severity hoặc ép downgrade |
| SEC-03 | ExcelJS kéo uuid 8.3.2 (2 package findings) | Moderate/runtime library; hiện chỉ gọi v4 không truyền buffer, ngoài API bị advisory ảnh hưởng | Open — upstream maintenance | Owner UNASSIGNED; [đường gọi và follow-up](security-triage.md#sec-03--exceljs--uuid); finance export regression 17/17 pass |
| EVID-01 | Chưa có CI run cho working tree hiện tại | Thiếu bằng chứng, không phải bug runtime | Open | Chưa commit/push; không dùng local pass thay log CI |
| EVID-02 | Chưa có UAT người đại diện (người dùng đã xác nhận) | Thiếu bằng chứng Acceptance | Open | Kịch bản và mẫu tại `uat.md` |
| EVID-03 | Danh mục AC/case chưa hoàn chỉnh làm mẫu số tự động hóa | Thiếu bằng chứng/đặc tả | Một phần | Đã review 206 AC và tạo `test-cases.csv` 163 case; 3 AC meta gap và 19 case chưa tự động hóa đầy đủ còn mở. Không công bố ≥70% chỉ từ test inventory. |

## Cải thiện bộ test trong đợt này

| ID | Thiếu hụt | Sửa và regression | Trạng thái |
| --- | --- | --- | --- |
| TEST-01 | Ca đặt trùng dùng cùng Player, chưa chứng minh AC hai Player và status/error | Đổi booking-lock-order thành hai Player gọi API đồng thời; assert 201/409, BOOKING_SLOT_UNAVAILABLE và một hold | Closed: verification 59/59, gồm ca cạnh tranh này |
| TEST-02 | Chưa đo ngưỡng chat ≤2 giây đã cam kết | Thêm 10 mẫu HTTP → recipient WebSocket cho direct/group, assert mỗi mẫu ≤2000ms | Closed: 10 mẫu pass; max 20,33ms trong verification |
| TEST-03 | Password unit test import helper có phụ thuộc DB | Dùng fixture survey thuần; chạy bộ unit độc lập không DB | Closed: unit suite 232/232 pass |

## Lỗi lịch sử

[Báo cáo 20/11](../../testing/e2e-merge-regression-report.md) có BUG-01/BUG-02 đã ghi nhận sửa và các mục cần điều tra. Kết quả UI mới được tổng hợp vào báo cáo đợt này; không tự đóng toàn bộ lỗi lịch sử chỉ vì tài liệu có chữ “đã xử lý”.

## Retest lỗi lịch sử ngày 28/11

| ID lịch sử | Kết quả mới | Kết luận giới hạn |
| --- | --- | --- |
| BUG-02 dashboard crash khi payload thiếu series | 4 regression cases trong admin-dashboard-ui đều pass trong bộ 519/519 | Closed ở phạm vi UI regression hiện tại; fix có sẵn từ trước đợt này |
| INV-02 tràn ngang sign-in 320px | Responsive test assert scrollWidth ≤320 và các viewport khác đều pass | Closed cho kịch bản được tái hiện trong test; 39 ảnh của lần UI được thu trong artifacts |
| BUG-01 sidebar chặn thao tác admin | Admin UI regression và real admin-finance đều pass, gồm điều hướng và legacy redirect | Closed trong phạm vi hai ca admin-finance của core 15/15 |
| INV-01 lịch sử điều chỉnh trình độ | ratings-real đã pass trong core 15/15: lịch sử và trạng thái rating theo fixture kiểm thử | Closed trong phạm vi fixture; không suy rộng thành UAT |

## Quy tắc severity khi triage

- Blocker: không thể chạy hoặc hoàn tất toàn bộ luồng cốt lõi, không có cách xử lý phù hợp.
- Critical: sai/mất tiền, dữ liệu nghiêm trọng, vượt quyền nghiêm trọng hoặc luồng cốt lõi bị vô hiệu.
- Major/Minor: phân loại theo tác động thực tế, phạm vi và khả năng tiếp tục thao tác.

Chỉ được báo cáo “0 Critical/Blocker còn mở” sau khi rà backlog, điều tra các fail và hoàn tất security triage; không suy ra từ việc chưa ghi một defect Critical nào.

## Bổ sung về drift đặc tả

Finance AC-06 trong PRD còn diễn đạt owner earning sau completed booking, trong khi decision FIN-D1 cùng tài liệu nói credit ngay khi payment SUCCESS. Admin frontend consolidation còn nhắc AdminLayout trong khi source dùng AdminMain. Các dòng này cần chủ tài liệu review; không đổi production để khớp mô tả lịch sử.

## Triage dependency bước đầu — lịch sử trước bản vá

Audit của đợt này có 18 advisory (11 moderate, 6 high, 1 critical). Kiểm tra source cho thấy `backend/src/app.ts` chỉ đặt `trust proxy` bằng số `1` khi bật `TRUST_PROXY`; chưa thấy cấu hình subnet IPv4-mapped mà advisory proxy-addr mô tả. Đây là quan sát giới hạn trên source, chưa đủ để đóng cảnh báo hay chứng minh deployment an toàn. Các dependency runtime như body-parser, multer và zod vẫn cần kiểm tra đường gọi, phiên bản vá tương thích và regression. Vite/source-map-js/brace-expansion cần phân biệt đường phát triển/build với runtime trước khi gán mức tác động ứng dụng.

Không chạy `npm audit fix --force`, không gán advisory critical thành một exploit đã tái hiện, và không tuyên bố “0 Critical/Blocker” từ kết quả audit này. SEC-01 khi đó giữ Open; đã có kết luận và retest sau bản vá trong phần cập nhật bên dưới.


## Kết luận rà defect/security sau bản vá ngày 28/11/2026

- **0 Critical/Blocker đã xác nhận đang mở trong phạm vi tracker và backlog repository đã rà**; đây là kết luận local có giới hạn, cần rà lại trước bảo vệ. Không suy ra an toàn toàn hệ thống hoặc đã có CI cuối.
- SEC-01 đã đi qua patch → retest → Closed; SEC-02/SEC-03 giữ nguyên Moderate/Open, không ký chấp nhận rủi ro thay nhóm. Không xóa các cảnh báo này khỏi hồ sơ.
- BUG-02/INV-02: retest mới `ui-regression.json` 40/40, gồm 4 trường hợp payload dashboard và responsive 320px. BUG-01: core admin finance và dashboard thật đều pass. INV-01: ratings-real pass trong core 15/15. Chỉ đóng trong phạm vi đã tái hiện, không gán đây là nghiệm thu người dùng.
- Các mục DOC/EVID và backlog UX/logic không tự chuyển Closed khi dependency được vá. Backlog frontend có những mô tả lịch sử; chưa tái hiện đầy đủ thì giữ nguyên tại nguồn. TC2.4 là scan lịch sử, không có SAST/pentest mới trong nhiệm vụ này.
- Chi tiết severity, điều kiện áp dụng, version, nguồn advisory, diff, môi trường, kết quả và giới hạn ở [security-triage.md](security-triage.md). Người thực hiện: Codex theo yêu cầu người dùng; người review/owner follow-up: UNASSIGNED.
