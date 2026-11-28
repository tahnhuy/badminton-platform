# Checklist phần còn lại để hoàn thành TC2.5 mức 5

Ngày cập nhật: 28/11/2026. Trạng thái: chưa đóng toàn bộ điều kiện mức 5. Người phụ trách/review: nhóm phân công, hiện chưa ghi tên.

Tài liệu này ghi việc còn làm; không thay [kế hoạch G0–G6](../../testing/ke-hoach-kiem-thu-tc2-5-muc-5.md), [danh mục case duy nhất](test-cases.csv) hoặc [defect tracker](defects.md). Căn cứ đánh giá là [rubric TC2.5](../Rubric_Do_An_Mon_Hoc_CNPM_v2.docx.md) và [metrics đã cam kết](../metrics.md).

## 1. Mốc hiện tại

| Nội dung | Kết quả đang có | Phần cần xác nhận cuối |
| --- | --- | --- |
| Kế hoạch và nhóm kiểm thử | Có Unit, Integration, API, UI/E2E và phi chức năng | Manifest, phạm vi và bằng chứng khớp phiên bản cuối |
| Core line coverage | 88,90% tổng hợp hai tập file rời nhau từ các lần chạy local | CI đo manifest cuối trong một lần, đạt ≥70% |
| Tự động hóa | 135/154 case trong phạm vi = 87,66%; gồm cả CONFLICT là 142/163 = 87,12% | Review mapping/assertion, chốt phạm vi và tính lại; không mặc định số liệu đã được nghiệm thu |
| Truy vết AC | 181/184 AC hiện hành có case; còn 3 AC meta gap | Xử lý gap, quyết định phạm vi và ca âm/biên |
| Test thực thi | Backend full 1.187/1.187; unit 232/232; verification 59/59; frontend 618/618 pass local | CI cuối pass 100% trên SHA chứa thay đổi cuối |
| Defect/security | Đã triage/vá/retest local; 0 Critical/High audit, 0 Critical/Blocker đã xác nhận mở trong phạm vi đã rà | Còn 6 Moderate theo dõi upstream; rà lại trên SHA chốt/trước bảo vệ |
| UAT | Có 14 kịch bản và phiếu; chưa chạy theo xác nhận người dùng | Nhóm chạy sau; không ghi kết quả/chữ ký thay |

Nguồn số liệu: [automation summary](automation-summary.md), [gap report](test-case-gaps.md), [báo cáo kết quả](bao-cao-tc2-5.md). Các số trên thuộc hồ sơ local ngày 28/11/2026, không phải kết quả CI mới.

## 2. Ưu tiên 1 — Chốt phạm vi và hoàn thiện AC/case

- [ ] Ghi quyết định và nguồn có thẩm quyền cho các mục còn tranh chấp:
  - Rating sau trận: 15 AC và 7 case D10; PROJECT-BRIEF, metrics và Ratings Tech Design đang khác nhau.
  - Điểm phong độ giải chuyên nghiệp: TC-TRN-19; đối chiếu quyết định hiện hành với metrics §6.
  - AC-SRC-118 / TC-AUTH-21: xác định hiệu lực quyết định Provisional.
- [ ] Với các mâu thuẫn Split Bill, Social/Matchmaking và tài liệu Admin/System-config Draft, ghi nguồn hiện hành dùng làm expected result và cập nhật tài liệu sở hữu theo quy trình repository. Không chọn hành vi chỉ vì code/test đang làm như vậy.
- [ ] Xử lý AC-SRC-127, AC-SRC-128, AC-SRC-129: bổ sung case/check kỹ thuật hoặc ánh xạ minh chứng phù hợp với từng điều kiện meta. Nếu phân loại lại phạm vi, ghi lý do và nguồn quyết định; không bỏ chỉ để tăng tỷ lệ.
- [ ] Review các case ghép nhiều vế, đặc biệt TC-AUTH-01, TC-BK-05, TC-TRN-07, TC-ADM-05: từng vế expected result phải có assertion chứng minh. Chưa đủ thì giữ PARTIAL hoặc tách case hợp lý.
- [ ] Rà ca âm/biên theo từng AC phù hợp; ghi lý do nếu không áp dụng. Kiểm tra quyền tài nguyên, deadline, rollback, idempotency và concurrency ở các nghiệp vụ rủi ro cao.
- [ ] Cập nhật `acceptance-register.csv`, `test-cases.csv`, gap report và automation summary nhất quán; phân công owner thực tế cho phần còn mở.
- [ ] Chạy lại validator và review đầu ra sau mọi thay đổi danh mục:

```bash
node docs/reports/testing/validate-test-cases.cjs
```

**Điều kiện đóng:** mọi AC hiện hành được xử lý bằng case/minh chứng phù hợp hoặc quyết định phạm vi có căn cứ; không còn CONFLICT ảnh hưởng kết luận chưa được giải thích. Tỷ lệ được tính lại từ danh mục, vẫn ≥70%, mỗi case tính một lần. Validator pass chỉ xác nhận cấu trúc/liên kết; không thay review nghĩa nghiệp vụ và assertion.

## 3. Ưu tiên 2 — Bổ sung automation theo rủi ro

Hiện còn 19 case trong phạm vi chưa tự động hóa đầy đủ: 12 PARTIAL, 6 PLANNED và 1 MANUAL. Danh sách chi tiết giữ tại [gap report](test-case-gaps.md), tránh duy trì danh sách trạng thái thứ hai ở đây.

- [ ] Review 19 case và chọn phần cần tự động hóa thêm theo tác động. Không bắt buộc nâng hết thành AUTOMATED để đạt ngưỡng 70%.
- [ ] Ưu tiên gap Auth: email malformed, mở khóa sau lockout, absolute session timeout, Admin gọi endpoint Player-only, đổi role và Court Owner vào khu Player. Đối chiếu case/source hiện hành trước khi viết test.
- [ ] Ưu tiên các phần PARTIAL liên quan tiền, payout, giao dịch nguyên tử, quyền truy cập và chuyển trạng thái. Bổ sung assertion nghiệp vụ; không chỉ gọi endpoint để tăng số lượng/coverage.
- [ ] Mỗi case chưa triển khai có owner, lý do, mức ưu tiên và trạng thái rõ. Giữ MANUAL/UAT đúng bản chất.
- [ ] Test mới/sửa được chạy lại; cập nhật liên kết và kết quả theo artifact thực tế. Không nâng trạng thái chỉ vì đã viết mã test.

**Điều kiện đóng:** automation ≥70% trên phạm vi đã chốt; các gap rủi ro cao được xử lý hoặc có quyết định xử lý minh bạch. Không đồng nhất “đạt 70%” với “không còn lỗ hổng kiểm thử”.

## 4. Ưu tiên 3 — Đóng kết luận defect/security

- [x] Rà backlog và trạng thái trong [defects.md](defects.md), gồm lỗi lịch sử và lỗi mới phát hiện. Giữ một nguồn trạng thái duy nhất.
- [x] Triage lại 18 advisory backend đã ghi nhận (1 critical, 6 high, 11 moderate): phiên bản, đường phụ thuộc, runtime/dev, điều kiện khai thác, cấu hình triển khai và ảnh hưởng thực tế.
- [x] Ghi kết luận cho từng advisory liên quan: áp dụng/không áp dụng/cần điều tra, kèm bằng chứng. Severity của advisory không tự động là severity của defect ứng dụng.
- [x] Sửa các lỗi áp dụng thực tế bằng thay đổi tương thích; không tự chạy nâng cấp phá vỡ hoặc `audit fix --force` để làm sạch số đếm.
- [x] Với defect được sửa, ghi ID, severity, expected/actual, bước tái hiện, môi trường/SHA, diff/commit sửa, regression và retest. Retest fail thì mở lại.
- [ ] Review backlog trước lần chạy chốt và trước bảo vệ; xác nhận **0 Critical/Blocker còn mở**. Không hạ severity hoặc đóng lỗi chỉ để đạt rubric.

**Điều kiện đóng:** có kết luận triage và bằng chứng retest, tracker phản ánh đúng thực trạng; đủ căn cứ xác nhận 0 defect Critical/Blocker còn tồn. Việc này chưa được chứng minh chỉ bằng test pass hoặc audit scan.

Đã thực hiện triage, vá và regression local ngày 28/11/2026: backend 0 Critical/High, còn 6 Moderate; frontend 0 findings; không còn Critical/Blocker đã xác nhận mở trong phạm vi backlog được rà. Xem [báo cáo security](security-triage.md). SEC-02/SEC-03 giữ Open; bước rà lại trên phiên bản chốt/trước bảo vệ vẫn để chưa hoàn tất.

## 5. Ưu tiên 4 — Chạy CI cuối trên cùng phiên bản

- [ ] Sau khi chốt source/test/phạm vi, chuẩn bị một commit ứng viên và ghi SHA. Commit/push chỉ thực hiện khi được yêu cầu theo quy định repository.
- [ ] Đối chiếu manifest: toàn bộ test trong phạm vi chạy bằng cấu hình phù hợp, gồm tournament-live riêng. Không bỏ ca bắt buộc hoặc tái sử dụng dữ liệu/server dev.
- [ ] Chạy backend test/coverage, frontend build/lint, UI/E2E và kiểm thử phi chức năng bắt buộc trên cùng SHA; suite reset cùng DB phải chạy nối tiếp hoặc có DB riêng.
- [ ] CI đo manifest coverage cuối trong một lần; giữ cả file chưa được import. Core line coverage ≥70%, không thu hẹp manifest để vượt gate.
- [ ] Xác nhận **100% test pass ở CI cuối**, báo planned/executed/pass/fail/skip; không có skip/cancel/timeout chưa xử lý. Nếu dùng retry, công khai failure ban đầu và flaky, điều tra nguyên nhân.
- [ ] Lưu URL workflow/job, SHA, cấu hình, thời gian và artifacts. Các workflow riêng phải trỏ cùng SHA; ghi rõ MOCK/sandbox và giới hạn môi trường.
- [ ] Nếu sửa mã/test sau đó, chạy lại phần ảnh hưởng và toàn bộ gate chốt trên SHA mới; không dùng artifact cũ để chứng minh phiên bản mới.

**Điều kiện đóng:** mọi suite bắt buộc có kết quả CI hợp lệ trên SHA chốt, 100% pass, coverage ≥70%; liên kết mở được. Kết quả local hiện có không thay điều kiện này.

## 6. UAT — Nhóm thực hiện sau

- [ ] Phân công đại diện Player, Court Owner, Admin và người điều phối; Organizer là quyền theo ngữ cảnh của Player.
- [ ] Thực hiện [14 kịch bản UAT](uat.md) trên môi trường test/staging, ghi phiên bản, dữ liệu, expected/actual, lỗi và nhận xét.
- [ ] Retest sau sửa và lưu xác nhận nghiệm thu thực tế; không tạo người tham gia, chữ ký hoặc kết quả thay nhóm.

**Phân biệt phạm vi:** rubric TC2.5 liệt kê Unit/Integration/API/E2E-UI/phi chức năng, không ghi biên bản UAT thành một điều kiện riêng. UAT là phần còn thiếu nếu nhóm muốn chứng minh đủ bốn cấp độ chuẩn Unit–Integration–System–Acceptance hoặc phục vụ nghiệm thu sản phẩm. Không tự áp các ngưỡng người dùng/SUS của TC2.7 vào TC2.5.

## 7. Ưu tiên 5 — Chốt hồ sơ và chuẩn bị bảo vệ

- [ ] Cập nhật [báo cáo TC2.5](bao-cao-tc2-5.md), [automation summary](automation-summary.md), gap report, tracker và README bằng số liệu cuối, không để các bảng mâu thuẫn.
- [ ] Liên kết AC → case → file/tên test → kết quả → SHA; ghi rõ ca âm/biên, manual, mock và integration thật.
- [ ] Lưu coverage HTML/LCOV/JSON, test report, log CI, dữ liệu phi chức năng và bằng chứng regression. Artifact máy sinh nằm dưới `artifacts/`, không commit theo quy định repository.
- [ ] Kiểm tra quyền đọc và thời hạn lưu artifact; chuẩn bị bản xuất dự phòng dùng được trong buổi bảo vệ.
- [ ] Diễn tập mở ngẫu nhiên AC/case/bug, giải thích expected result, assertion và kết quả; tái tạo suite theo hướng dẫn.

## 8. Bảng xác nhận cuối

| Điều kiện TC2.5 mức 5 | Bằng chứng cuối | Xác nhận |
| --- | --- | --- |
| Kế hoạch rõ ràng, ≥4 nhóm kiểm thử theo rubric | Plan + manifest + report thực thi | Chưa chốt |
| Core line coverage ≥70% | Coverage CI trên SHA cuối | Chưa chốt |
| Case tự động hóa ≥70% | Danh mục đã chốt + công thức + liên kết test | Chưa chốt; hiện đo được 87,66% |
| 100% test pass ở CI cuối | URL run/job + SHA + report | Chưa có |
| 0 Critical/Blocker; có lifecycle/regression | Tracker + triage + retest | Local đã rà: 0 đã xác nhận mở; cần rà lại trước bảo vệ |
| Truy vết AC, có ca âm/biên | Register + case catalog + test/evidence | Còn gap/phạm vi tranh chấp |

Chỉ kết luận đủ căn cứ mức 5 khi các yêu cầu rubric ở bảng trên có bằng chứng phù hợp. Điểm cuối do giảng viên/hội đồng quyết định; không tự đánh dấu hoàn tất từ kết quả validator hoặc số lượng test.
