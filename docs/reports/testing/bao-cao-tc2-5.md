# Báo cáo kiểm thử và đánh giá TC2.5

Ngày thực hiện: 28/11/2026, giờ Việt Nam. Trạng thái: đã hoàn tất đợt thực thi local; kế hoạch mức 5 chưa đóng toàn bộ gate. Source nền: `6d7cf36ebc3296adc45b882637d55ad24ab5c81f` + working tree thay đổi chưa commit/push. Môi trường local Node v24.21.0, PostgreSQL 16.15 test riêng cổng 5433, Chrome/Playwright; CI cấu hình Node 22. Không coi kết quả local là bằng chứng CI của working tree.

Nguồn: [rubric TC2.5](../Rubric_Do_An_Mon_Hoc_CNPM_v2.docx.md), [metric đã cam kết](../metrics.md), [kế hoạch G0–G6](../../testing/ke-hoach-kiem-thu-tc2-5-muc-5.md).

## 1. Công việc đã thực hiện

- Đối chiếu 12 hạng mục metrics với test hiện có, ghi nhận drift đặc tả thay vì sửa nghiệp vụ theo nội dung lịch sử.
- Kiểm kê 189 file test và 1.413 khai báo tĩnh; runtime có thể mở rộng test tham số nên không dùng số này làm số test chạy hoặc mẫu số tự động hóa.
- Review 155 bullet acceptance nguồn, bổ sung 51 AC cho các domain chưa có mục AC riêng, nâng register lên 206 dòng với `review_status`/`scope_status`. Phân loại: 184 AC hiện hành trong phạm vi, 15 AC rating bị treo do mâu thuẫn phạm vi, 5 AC superseded, 1 AC historical. Không có cặp trùng khít.
- Hoàn thiện danh mục case nghiệp vụ duy nhất [`test-cases.csv`](test-cases.csv): 163 case, 154 case trong phạm vi, 135 case tự động hóa đầy đủ. Tỷ lệ tự động hóa **87,66%**; 181/184 AC hiện hành có case (98,37%). Số liệu và giới hạn ở [`automation-summary.md`](automation-summary.md), gap ở [`test-case-gaps.md`](test-case-gaps.md).
- Giữ `trace-links.csv` 47 liên kết/44 AC như chi tiết lịch sử, không dùng làm mẫu số.
- Tạo Unit suite độc lập; chia sẻ danh sách pure suite với cleanup guard, loại phụ thuộc DB khỏi fixture password unit. Các suite tích hợp/API vẫn dọn DB như trước.
- Thêm 5 ca Unit về ngày nhuận/thời gian, bộ lọc tìm sân, PIN/UUID và registration payload. Bổ sung đo chat theo ngưỡng ≤2 giây đã cam kết.
- Củng cố ca đặt trùng thành hai Player gọi API đồng thời, kiểm tra status/error và một hold trong DB.
- Thêm phép đo search/availability với 5 request đồng thời, dataset và giới hạn phép đo rõ ràng; không tự đặt SLA ngoài metrics.
- Cấu hình V8 coverage cho core layers + sáu file validation, gate line ≥70%; lưu HTML, LCOV, JSON summary.
- Cập nhật CI chạy coverage và upload báo cáo cả khi thành công; nightly lưu report 90 ngày và chạy riêng tournament-live; tăng backend timeout 90 phút theo quan sát local.
- Thêm E2E core/remaining config dùng cổng riêng 3195/5195, không tái sử dụng server dev; runner local ghi report/exit code vào thư mục hồ sơ.
- Tạo defect tracker, retest các regression UI lịch sử, chuẩn bị kịch bản/phiếu UAT và mục lục minh chứng.

## 2. Kết quả đã xác nhận

| Kiểm tra | Kết quả | Minh chứng |
| --- | --- | --- |
| Unit độc lập | 232/232 pass, 0 fail | [JSON](artifacts/unit.json) |
| UI mock | 519/519 pass, 0 skip/fail/flaky; khoảng 16,3 phút | [JSON](artifacts/ui.json), [39 ảnh](artifacts/ui-screenshots-manifest.json) |
| Backend full + coverage | 1.187/1.187 pass, 113 file, 0 fail/skip; 61,1 phút | [JSON](artifacts/backend.json), [log](artifacts/backend-coverage.log) |
| Xác nhận thay đổi cuối | 59/59 pass trong 5 file; bracket thuần 45 ca/18ms, DB cleanup vẫn chạy cho integration | [JSON](artifacts/verification.json), [log](artifacts/verification.log) |
| E2E core backend thật | 15/15 pass, 0 skip/fail/flaky; 1,4 phút | [JSON](artifacts/system.json), [log](artifacts/system.log) |
| E2E còn lại (cả mock và real) | 83/83 pass, 0 skip/fail/flaky; 5,1 phút | [JSON](artifacts/remaining.json), [log](artifacts/remaining.log) |
| Tournament live | 1/1 pass, 39,5 giây: 4 đăng ký trả tiền → draw → 3 trận → hoàn tất và credit Organizer một lần | [JSON](artifacts/tournament.json), [log](artifacts/tournament.log) |
| Migration/schema | Pass: 45 migration, latest 0044_court_deletion_reviews, no schema diff | [Log](artifacts/migrations.log) |
| Độ trễ chat | 10/10 mẫu pass; cao nhất 20,33ms <2000ms, local HTTP → real WebSocket | [Dữ liệu](artifacts/messaging-latency.json) |
| Search/availability baseline | Mỗi endpoint 50 mẫu, concurrency 5, 0 lỗi; p95 search 20,23ms, availability 16,82ms | [Dữ liệu và dataset](artifacts/performance.json); chưa có SLA p95 |
| Backend build | Pass | [Log](artifacts/backend-build.log) |
| Frontend build | Pass; có warning kích thước bundle | [Log](artifacts/frontend-build.log) |
| Frontend lint | Exit 0; có warning có sẵn | [Log](artifacts/frontend-lint.log); không diễn giải thành 0 lint issue của TC2.4 |
| Cấu hình/tooling | YAML parse, shell syntax, Node syntax, trace links và diff whitespace kiểm tra thành công | [Kiểm tra local](artifacts/tooling-checks.log) |

**Frontend tổng cộng 618/618 pass**, 0 skip/fail/flaky, trong 74/74 spec; bốn tập file rời nhau. [Kiểm tra thực thi](artifacts/execution-manifest.json) xác nhận 115/115 file backend xuất hiện trong hợp các report backend/unit/verification, không có file nguồn bị bỏ sót. Điều này không thay tỷ lệ bao phủ AC hay mẫu số tự động hóa.

Các hàng Unit/backend có thể chồng lấp test; không cộng số pass của các suite để tuyên bố số case duy nhất.

## 3. Phạm vi coverage

Xem [manifest](test-levels-and-suites.md#2-coverage-manifest). Lần full đầu khởi động trước khi thêm glob validation dạng phẳng; phép đo Unit bổ sung đo đủ sáu file validation, kể cả file 0%. Coverage validation riêng đạt 73,97% dòng (145/196), **không phải coverage toàn bộ core**. Chỉ tính tổng hai phép đo khi xác nhận tập file rời nhau; CI với cấu hình cuối sẽ đo chung trong một lần.

Backend full: **89,37% dòng (5.518/6.174)**. Hai tập file đã xác nhận rời nhau; cộng bổ sung validation được **88,90% dòng (5.663/6.370)** cho manifest cuối, vượt 70%. Đây là phép tổng hợp hai lần đo local trên production source không thay đổi, không phải kết quả CI trên một commit cuối. Xem [coverage theo file](coverage-by-file.csv), [HTML core](artifacts/coverage/index.html), [HTML validation](artifacts/coverage-validation/index.html). Những file type-only 0 dòng không ảnh hưởng mẫu số; file có dòng nhưng 0% vẫn được giữ trong báo cáo.

## 4. Đánh giá theo từng yêu cầu mức 5

| Yêu cầu | Kết luận hiện tại |
| --- | --- |
| Kế hoạch rõ ràng, ≥4 nhóm rubric | Có kế hoạch, Unit/Integration/API/UI-E2E và security/concurrency/đo hiệu năng; đều có report thực thi local. Theo cách phân cấp chuẩn, Unit/Integration/System có mã test; Acceptance/UAT chưa có người nghiệm thu |
| Core line coverage ≥70% | Đạt ở phép đo local: 88,90% trên manifest cuối (tổng hợp file rời nhau); còn chờ CI cấu hình cuối |
| Tự động hóa ≥70% | **Đạt theo danh mục đã review:** 135/154 = 87,66% case trong phạm vi; 142/163 = 87,12% nếu tính cả case tranh chấp phạm vi. Chưa chốt tỷ lệ cuối vì còn 3 AC meta gap, 15 AC rating chưa phân xử và UAT/CI chưa có. Xem [automation-summary.md](automation-summary.md) và [test-cases.csv](test-cases.csv) |
| 100% pass ở CI cuối | Chưa đạt minh chứng: thay đổi chưa commit/publish và chưa có run CI cho chúng. Local pass không thay thế yêu cầu này |
| 0 Critical/Blocker; lifecycle và regression | Đã triage/vá/retest local: 0 Critical/Blocker đã xác nhận mở trong phạm vi tracker/backlog đã rà. Audit backend còn 6 Moderate, frontend 0; xem [security](security-triage.md). Cần rà lại trước bảo vệ |
| Truy vết AC, ca âm/biên | Đã review 206 AC: 184 hiện hành, 181 có case (98,37%); 3 AC meta gap có giải thích. 163 case gồm 71 ca âm và 44 ca biên; xem [test-case-gaps.md](test-case-gaps.md) |
| Hồ sơ minh chứng | Đã tập trung trong thư mục này; artifacts là output máy sinh, Git ignored |

**Chưa đủ căn cứ nhận TC2.5 mức 5 (4,5–5,0/5).** Không tự quy đổi sang mức 4/3 khi các mẫu số và kết quả bắt buộc chưa được xác nhận. Các gate kỹ thuật local đã pass; các điều kiện chưa đủ bằng chứng bên dưới giữ trạng thái mở. Không ghi kế hoạch G0–G6 hoàn tất khi còn các phần này.

## 5. Những việc cần hoàn tất trước bảo vệ

1. Hoàn tất phân xử drift nguồn (rating, split bill, social wording) và rà lại 19 case chưa tự động hóa đầy đủ trong [test-case-gaps.md](test-case-gaps.md); không tự đổi nghĩa nghiệp vụ.
2. Theo dõi SEC-02/SEC-03 Moderate và audit/review backlog lại trên phiên bản chốt, trước bảo vệ. Đợt security đã vá hết Critical/High và retest; không chạy audit fix --force.
3. Chạy CI trên commit chứa thay đổi cuối và lưu artifacts còn hiệu lực đến bảo vệ; không publish/commit khi chưa được yêu cầu theo quy định repo.
4. Người đại diện nghiệp vụ thực hiện [UAT](uat.md), ghi kết quả và xác nhận; không tạo chữ ký/người tham gia thay.
5. Nhóm diễn tập truy vết ngẫu nhiên AC/bug/test và tái tạo trên môi trường sạch.

## 6. Mục lục dữ liệu chi tiết

- [Metrics mapping](metrics-mapping.md), [suite và cấp độ](test-levels-and-suites.md).
- [Tỷ lệ tự động hóa](automation-summary.md), [danh mục case](test-cases.csv), [khoảng trống](test-case-gaps.md).
- [Traceability](traceability.md), [trace links lịch sử](trace-links.csv), [acceptance nguồn đã review](acceptance-register.csv), [test inventory](test-inventory.csv).
- [Defect tracker](defects.md), [14 kịch bản UAT](uat.md), [ghi chú đợt chạy](run-notes.md).
- [8 ảnh bổ sung từ core/remaining, gồm UI mock và real](artifacts/system-screenshots-manifest.json), [exit codes](artifacts/exit-codes.tsv).
- [Manifest frontend](frontend-suite-manifest.csv), [kiểm tra đủ file thực thi](artifacts/execution-manifest.json), [môi trường](artifacts/environment.json).
- [Summary máy đọc được](artifacts/summary.json), [audit gốc](artifacts/audit.json), [CI observation](artifacts/ci-observation.json).
- Runner: `bash docs/reports/testing/run-tests.sh`; kiểm kê và tổng hợp qua các script `.cjs` cùng thư mục.

Artifact/log/ảnh không được commit; cần đóng gói thư mục artifacts hoặc lưu link CI khi bàn giao. Chỉ bản Markdown/CSV/script duy trì được đưa vào source control.


## Cập nhật dependency/security sau khi lập case catalog

Đã hoàn tất [triage và regression security](security-triage.md): 150/150 API/DB, 232/232 unit (coverage provider cũng chạy thành công), 40/40 UI, 15/15 core E2E, 1/1 dashboard thật; build, lint/check:ui và migration pass. Backend còn 6 Moderate từ hai advisory gốc, 0 High/Critical; frontend audit 0. SEC-01 Closed, SEC-02/SEC-03 Open.

Các con số full suite/coverage ở phần đầu là snapshot **trước** bản vá dependency, không phải full gate trên dependency graph mới. Artifact mới lưu riêng trong `artifacts/security/`. Inventory mới có 190 file/1.417 khai báo; bốn ca security kỹ thuật không tự được cộng vào mẫu số/tử số case nghiệp vụ. Full CI trên SHA cuối vẫn chưa có.
