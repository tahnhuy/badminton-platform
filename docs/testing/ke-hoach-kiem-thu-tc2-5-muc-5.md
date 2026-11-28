# Kế hoạch đạt mức 5 — TC2.5 Kiểm thử phần mềm

- Ngày lập: 28/11/2026.
- Trạng thái: Đang thực hiện — kết quả và giới hạn xem [hồ sơ TC2.5](../reports/testing/README.md); chưa phải xác nhận đạt mức 5.
- Chủ trì: người phụ trách kiểm thử của nhóm; tên người thực hiện từng việc cần được nhóm phân công.
- Phạm vi: TC2.5, tối đa 5 điểm; mục tiêu mức 5 tương ứng 4,5–5,0 điểm.
- Bộ metric do người dùng chỉ định: [metrics.md](../reports/metrics.md); đối chiếu chi tiết tại [metrics mapping](../reports/testing/metrics-mapping.md).
- Nguồn đánh giá: [Rubric CNPM v2, TC2.5 và mục 5, 8](../reports/Rubric_Do_An_Mon_Hoc_CNPM_v2.docx.md).
- Phạm vi sản phẩm: [PROJECT-BRIEF](../../PROJECT-BRIEF.md); nghiệp vụ chi tiết theo PRD/Tech Design hiện hành và [ma trận business rules](../business-rules-config-matrix.md).

## 1. Mục tiêu và nguyên tắc thực hiện

Hoàn thiện bộ kiểm thử và hồ sơ để chứng minh đồng thời mọi yêu cầu mức 5. Số lượng file test không thay thế được độ phủ nghiệp vụ, số đo coverage hoặc kết quả CI.

Kế hoạch này không sửa nghiệp vụ, không xác nhận test đã pass và không thay thế tài liệu đặc tả. Những con số hiện trạng bên dưới là kết quả kiểm kê tĩnh tại thời điểm lập; phải cập nhật bằng baseline thực tế trước khi kết luận. Ngưỡng rubric là ngưỡng tham chiếu; nếu đã có bộ metric được thống nhất với giảng viên ở Bước 3, cần đối chiếu và ghi rõ khác biệt.

Chỉ chạy kiểm thử ghi/xóa dữ liệu trên DB test riêng. Không reset DB dev/production hoặc gọi dịch vụ thanh toán thật để tạo minh chứng. Không thay đổi AC, bỏ assertion, giảm phân quyền hoặc skip test để làm xanh pipeline.

## 2. Đối chiếu yêu cầu và hiện trạng

| ID | Yêu cầu mức 5 | Hiện trạng đã quan sát | Khoảng trống cần xử lý |
| --- | --- | --- | --- |
| R1 | Kế hoạch rõ ràng; ≥ 4 tầng kiểm thử | Có Vitest, Supertest, PostgreSQL test và Playwright; tài liệu test theo tính năng | Chốt kế hoạch tổng, phân loại suite thực tế và lập minh chứng từng tầng; bổ sung phép đo phi chức năng |
| R2 | Coverage dòng lệnh mô-đun cốt lõi ≥ 70% | `backend/vitest.config.ts` chưa cấu hình coverage | Chốt phạm vi file; bổ sung công cụ đo, báo cáo và gate CI; đo baseline rồi bổ sung test |
| R3 | Test case tự động hóa ≥ 70% | Kiểm kê có 113 file `.test.ts` backend và 74 file `.spec.ts` frontend | Chưa có danh mục test case làm mẫu số; cần ánh xạ test tự động và tính tỷ lệ |
| R4 | 100% test pass ở lần CI cuối | Có CI backend và E2E nightly; chưa kiểm tra run mới nhất | Chạy đầy đủ suite đã chốt trên cùng SHA; xử lý fail/skip; lưu kết quả thành công |
| R5 | 0 Critical/Blocker còn tồn; có bug tracker, vòng đời lỗi và regression test | Có báo cáo regression ngày 20/11, có ghi nhận sửa một số lỗi | Rà lại trạng thái hiện tại, chuẩn hóa severity và vòng đời; liên kết bug–commit–test–retest |
| R6 | Truy vết AC; bao phủ ca âm và ca biên | Có PRD và nhiều test âm/biên, chưa thấy ma trận tổng | Lập AC → test case → mã test → kết quả; xử lý AC còn thiếu test |
| R7 | Hồ sơ minh chứng đầy đủ | Tài liệu phân tán; một số log cũ ở `/tmp`; nightly chỉ upload report khi fail | Lưu báo cáo cả khi pass; tạo mục lục có SHA, môi trường, lệnh chạy và link artifact |

Nguồn kiểm tra hiện trạng:

- [Backend test scripts](../../backend/package.json), [Vitest config](../../backend/vitest.config.ts), [backend tests](../../backend/src/__tests__/).
- [Frontend scripts](../../frontend/package.json), [Playwright config](../../frontend/playwright.config.ts), [frontend tests](../../frontend/e2e/).
- [CI](../../.github/workflows/ci.yml), [E2E nightly](../../.github/workflows/e2e-nightly.yml).
- [Báo cáo regression lịch sử](e2e-merge-regression-report.md).

## 3. Phạm vi cần chốt trước khi đo

### 3.1. Danh mục nghiệp vụ

| Nhóm | Nội dung cần rà theo đặc tả | Rủi ro cần ưu tiên |
| --- | --- | --- |
| Authentication/authorization | Đăng nhập, session, CSRF, đổi mật khẩu bắt buộc, quyền theo tài nguyên | Vượt quyền, session hết hạn, truy cập dữ liệu người khác |
| Booking và Court Owner | Availability, giá, tạo/xác nhận/thanh toán/hủy booking, owner cancellation, hoàn tiền | Đặt trùng slot, tính sai tiền, trạng thái không đồng bộ |
| Wallet/payment | Nạp/rút, ledger, số dư, callback, deadline, settlement | Ghi có/trừ/hoàn hai lần, số dư sai, xử lý yêu cầu hết hạn |
| Matchmaking | Apply/invite, chốt kèo, membership, booking link, split bill | Vượt slot, rút kèo sai thời điểm, trừ ví không nguyên tử |
| Tournament | Đăng ký, quyền organizer theo ngữ cảnh, bracket, schedule, score/ranking, tài chính | Sai quyền, lịch không hợp lệ, kết quả/tài chính sai |
| Hỗ trợ đã cam kết | Social, messaging, notification, profile/rating, admin/config/report | Rò dữ liệu, membership sai, cấu hình không được áp dụng |

Split bill hiện đã được bổ sung trong PROJECT-BRIEF ngày 20/11/2026, giới hạn ở booking của kèo đã chốt. Documentation Guide còn mô tả loại khỏi MVP; dùng thứ bậc nguồn tài liệu để xác định phạm vi và ghi nhận mâu thuẫn, không mở rộng sang booking cá nhân hoặc giải đấu.

### 3.2. Phạm vi coverage

- Lập danh sách đường dẫn/glob thực tế cho ba domain cốt lõi Booking, Matchmaking, Tournament và các phần auth/payment/wallet mà các luồng này phụ thuộc.
- Bao gồm services, repositories và logic validation/controller liên quan nếu nằm trong phạm vi đã chốt; liệt kê cụ thể, không dùng mô tả chung chung trong báo cáo cuối.
- File chưa được chạy bởi test vẫn phải xuất hiện trong phép đo.
- Có thể loại mã sinh tự động, test helpers và fixture; mọi exclusion cần lý do. Không loại nhánh khó test hoặc file coverage thấp.
- Ngưỡng rubric: line coverage tổng của phạm vi cốt lõi ≥ 70%. Báo cáo thêm theo mô-đun để phát hiện điểm yếu; ngưỡng ≥ 70% cho từng mô-đun là mục tiêu nội bộ đề xuất, không tự coi là yêu cầu rubric.
- Mỗi lần thay đổi phạm vi đo phải ghi lại lý do và chạy lại; không thu hẹp phạm vi chỉ để vượt ngưỡng.

## 4. Các gói công việc và điều kiện nghiệm thu

Tiến độ thực hiện được ghi ở mục 10 và hồ sơ `docs/reports/testing/`. Chỉ đánh dấu hoàn tất khi đủ điều kiện nghiệm thu của từng task.

### G0 — Chốt phạm vi, baseline và người phụ trách

- [ ] T0.1: Chỉ định người điều phối, người phụ trách từng domain và người review kết quả; ghi tên vào bảng tiến độ ở mục 10.
- [ ] T0.2: Đối chiếu sản phẩm/metric đã cam kết với giảng viên; xác định bản rubric áp dụng và danh sách AC trong phạm vi.
- [x] T0.3: Ghi commit SHA, phiên bản Node/npm/PostgreSQL, cấu hình môi trường đã che secret và danh sách suite/config.
- [x] T0.4: Kiểm kê số test thực tế; phân biệt case nghiệp vụ, test function, test tham số và file test. Không dùng số file làm số case.
- [x] T0.5: Chạy baseline backend, UI mock và E2E thật trên DB riêng; thống kê pass/fail/skip, thời gian và lỗi môi trường.
- [x] T0.6: Mở bug cho mỗi lỗi xác nhận được; tách lỗi ứng dụng, lỗi spec lỗi thời, flaky test và lỗi môi trường.

Đầu ra: phạm vi đã chốt, danh sách suite và baseline có bằng chứng. Hoàn tất khi biết chính xác cần chạy những gì và còn những loại thiếu hụt nào; baseline được phép fail nhưng phải báo cáo trung thực.

### G1 — Danh mục test case và truy vết AC (R1, R3, R6)

- [x] T1.1: Trích AC từ PRD/Tech Design hiện hành; dẫn tới mục nguồn cụ thể. Nếu AC chưa có ID, dùng ID ánh xạ trong danh mục, không tự sửa nghĩa đặc tả. Kết quả: 206 AC đã review, 184 hiện hành trong phạm vi.
- [x] T1.2: Kiểm kê test hiện có và nối từng test với AC/business rule mà assertion thực sự kiểm chứng. Kết quả: 137 liên kết case–artifact pass; phần partial được giữ riêng.
- [x] T1.3: Thiết kế ca thuận, ca âm và ca biên cho từng AC phù hợp; ghi rõ expected result theo nguồn nghiệp vụ. Kết quả: 48 positive, 71 negative, 44 boundary.
- [x] T1.4: Gắn tầng test, mức ưu tiên, cơ chế mock, fixture, đường dẫn và tên test thực thi.
- [x] T1.5: Tính tỷ lệ tự động hóa, xác định ca phải bổ sung; ưu tiên giao dịch tiền, quyền truy cập và concurrency. Kết quả: 135/154 = 87,66%.
- [ ] T1.6: Review ma trận để phát hiện AC không có test, test thiếu assertion và case trùng chỉ để tăng số lượng. Đã có automated validation; chờ nhóm review độc lập.

Đầu ra dự kiến: `docs/reports/testing/test-cases.csv` làm danh mục duy nhất; tạo khi bắt đầu kiểm kê, không tạo file rỗng.

Các cột tối thiểu:

```text
case_id,domain,ac_ref,business_rule_ref,title,test_level,case_type,priority,
preconditions,input_or_steps,expected_result,automation_status,test_file,
test_title,ci_suite,last_result,run_sha,evidence_url,defect_id,owner
```

Quy tắc tính:

- Mẫu số: toàn bộ test case đã chốt trong phạm vi, gồm cả ca manual và chưa tự động hóa.
- Tử số: case đã có test tự động thực thi được và assertion kiểm chứng expected result; không tính planned/placeholder/skip như đã tự động hóa hoàn tất.
- Một case có test ở nhiều tầng vẫn tính một lần; parameterized test chỉ tách case khi có điều kiện và expected result phân biệt rõ.
- `Automation rate = automated cases / total in-scope cases × 100%`, yêu cầu ≥ 70%.
- Theo dõi thêm `AC coverage = AC có case / tổng AC trong phạm vi`; mục tiêu nội bộ là mọi AC trong phạm vi đều truy vết được. Case manual vẫn phải có kết quả thực thi.

### G2 — Coverage và bổ sung test nghiệp vụ (R2)

- [x] T2.1: Chốt manifest phạm vi coverage theo mục 3.2 trước khi đo.
- [x] T2.2: Chọn coverage provider tương thích với Vitest đang cài. Dependency mới cần được xử lý theo quy định dự án trước khi cài; đợt thực hiện đã bổ sung @vitest/coverage-v8 tương thích với Vitest 5.0.2.
- [x] T2.3: Bổ sung cấu hình đo line coverage, HTML/JSON/LCOV và báo cáo theo file; dùng đường dẫn output bị Git ignore hoặc CI artifact.
- [x] T2.4: Chạy baseline coverage; lập bảng file/nhánh thiếu và mức rủi ro.
- [x] T2.5: Viết test bổ sung cho hành vi chưa được kiểm chứng, ưu tiên rollback, idempotency, permission, expiry và trạng thái biên. Không chỉ gọi hàm để tăng coverage.
- [x] T2.6: Đưa ngưỡng line coverage ≥ 70% vào CI đối với phạm vi đã chốt; build/test phải fail nếu không đạt.
- [ ] T2.7: Kiểm tra báo cáo có file chưa được import và exclusion hợp lệ; lưu kết quả trên cùng SHA của lần chốt.

Đầu ra: cấu hình/script đo, manifest phạm vi và báo cáo coverage. Hoàn tất khi line coverage ≥ 70%, artifact đọc được và có thể tái tạo bằng lệnh đã ghi.

### G3 — Bốn cấp độ kiểm thử và ánh xạ nhóm trong rubric (R1, R6)

Bốn cấp độ dùng để trình bày là Unit, Integration, System và Acceptance. API/UI là giao diện kiểm thử, E2E là cách kiểm chứng xuyên hệ thống, phi chức năng là loại kiểm thử; không coi các nhóm này là các cấp độ ngang hàng. Rubric liệt kê unit, integration, API, E2E/UI và phi chức năng nên vẫn cần ánh xạ đầy đủ minh chứng. Acceptance/UAT chưa được xác nhận bởi bộ test tự động của lập trình viên.

| Cấp độ | Minh chứng dự kiến |
| --- | --- |
| Unit | Test hàm/thuật toán độc lập, không DB/HTTP |
| Integration | Service/repository với DB; API qua Express |
| System | Browser → backend → DB thật; kiểm thử bảo mật, concurrency và hiệu năng toàn hệ thống |
| Acceptance | Kịch bản theo AC, người đại diện nghiệp vụ thực hiện và xác nhận; chưa thể tự ghi nhận hoàn tất |

| Nhóm | Cách thực hiện | Minh chứng |
| --- | --- | --- |
| Unit | Logic độc lập: tính giá/điểm, validation, deadline, thuật toán theo đặc tả | Test và assertion không phụ thuộc HTTP/DB thật |
| Integration | Service/repository với PostgreSQL test, transaction, rollback, constraint | Test truy vấn trạng thái DB và invariant sau thao tác |
| API | Supertest qua Express: request, status, error shape, auth và quyền tài nguyên | Response assertion và kiểm tra side effect |
| UI/E2E | Tách UI mock và luồng browser → backend → DB thật | UI mock chứng minh trạng thái màn hình; E2E thật chứng minh tích hợp xuyên hệ thống |
| Phi chức năng | Đồng thời, bảo mật và phép đo hiệu năng trên môi trường xác định | Kịch bản, cấu hình tải, số đo và kết quả invariant |

- [ ] T3.1: Phân loại theo nội dung chạy thực tế; không đếm một HTTP test có DB thành ba tầng chỉ vì dùng nhiều công cụ.
- [x] T3.2: Chốt E2E thật cho login/denial; tìm sân–booking–pay–cancel/refund; owner cancellation; matchmaking–split booking; tournament theo phạm vi đã cam kết.
- [ ] T3.3: Rà suite concurrency đang có, bổ sung phần thiếu: cùng slot, thanh toán lặp, callback lặp, hủy cạnh tranh thanh toán, split bill thiếu tiền. Kiểm chứng số dư, ledger, booking và rollback theo invariant được đặc tả.
- [ ] T3.4: Rà suite bảo mật: session/CSRF/rate limit, truy cập tài nguyên người khác, contextual organizer, private media và webhook signature. Không coi dependency scan thay thế kiểm thử quyền nghiệp vụ.
- [ ] T3.5: Chọn các endpoint có NFR hiệu năng, tối thiểu ưu tiên tìm sân, xem lịch trống và tạo booking; chỉ rõ khối lượng dữ liệu, concurrency, warm-up, thời gian đo và giới hạn môi trường.
- [x] T3.6: Lấy ngưỡng p95/error rate/throughput từ NFR đã chốt. Nếu chưa có, ghi số đo baseline và trình nhóm/giảng viên chốt ngưỡng trước khi đánh giá pass; không tự bịa ngưỡng đã đạt.
- [x] T3.7: Chọn công cụ tải; ưu tiên công cụ hiện có nếu đủ đo. k6/Artillery chỉ là phương án đề xuất, chưa phải quyết định công nghệ của dự án.
- [x] T3.8: Lưu kết quả thô và bảng tổng hợp; nêu rõ provider thanh toán giả lập, môi trường local/CI và giới hạn suy rộng sang production.

Đầu ra: danh mục suite từng tầng, kết quả E2E thật và báo cáo phi chức năng. Hoàn tất khi mọi nhóm có kịch bản đã chạy, kết quả và giới hạn phép đo rõ ràng.

### G4 — Bug tracker và regression (R5)

- [x] T4.1: Dùng GitHub Issues hiện có của repository hoặc tracker nhóm đang duy trì; chọn một nguồn trạng thái duy nhất.
- [x] T4.2: Rà lại BUG-01/BUG-02 và các mục cần điều tra trong báo cáo regression 20/11. Ghi đã sửa trong tài liệu chưa đủ để đóng nếu thiếu retest trên phiên bản hiện tại.
- [ ] T4.3: Mỗi bug có ID, severity, môi trường/SHA phát hiện, bước tái hiện, expected/actual, ảnh/log cần thiết, owner, commit sửa, test regression và bằng chứng retest.
- [ ] T4.4: Dùng vòng đời `Open → In progress → Fixed → Retest → Closed`; retest fail chuyển `Reopened`. Người retest ghi SHA và kết quả.
- [ ] T4.5: Bổ sung regression test cho lỗi logic có thể tự động hóa; lỗi chỉ kiểm tra tay phải có kịch bản lặp lại và lý do.
- [ ] T4.6: Kiểm tra backlog cuối; không đổi severity chỉ để đạt mục tiêu.

Quy ước đề xuất để nhóm thống nhất trước triage:

| Severity | Hướng phân loại |
| --- | --- |
| Blocker | Không thể chạy/kiểm thử sản phẩm hoặc toàn bộ luồng cốt lõi bị chặn, không có cách xử lý phù hợp |
| Critical | Sai/mất tiền hoặc dữ liệu nghiêm trọng, vượt quyền nghiêm trọng, luồng cốt lõi không thể hoàn tất |
| Major/Minor | Lỗi chức năng còn lại hoặc giao diện; đánh giá theo tác động thực tế và khả năng tiếp tục thao tác |

Severity khác priority xử lý; nhãn P0/P1 cũ cần được rà lại theo tác động, không tự ánh xạ máy móc.

Đầu ra: tracker có lịch sử và regression links. Hoàn tất khi 0 Critical/Blocker còn mở, các lỗi đã đóng có retest; lỗi mức thấp còn tồn được công khai.

### G5 — CI và lưu minh chứng (R4, R7)

- [x] T5.1: Tạo manifest suite/config bắt buộc. Đối chiếu cấu hình chuyên biệt: mặc định đang loại `tournament-live.spec.ts`; mọi test trong phạm vi phải được chạy bằng cấu hình phù hợp.
- [x] T5.2: Giữ backend test và UI/E2E thật có DB riêng; tránh các suite reset cùng DB chạy đồng thời. Ghi thứ tự hoặc tách DB nếu cần.
- [ ] T5.3: Chạy coverage gate trong CI; xuất kết quả máy đọc được và báo cáo dễ đọc cho backend/Playwright.
- [x] T5.4: Upload report cả thành công và thất bại. Thiết lập retention đủ đến thời điểm bảo vệ hoặc xuất bản sao hồ sơ trước khi artifact hết hạn.
- [ ] T5.5: Phân biệt lỗi ứng dụng, lỗi assertion lỗi thời, flaky và môi trường; sửa nguyên nhân rồi chạy lại. Nếu dùng retry, công khai số lần retry và flaky, không che lần fail đầu.
- [ ] T5.6: Chốt một commit ứng viên; chạy backend/coverage, UI/E2E bắt buộc và kiểm thử phi chức năng trên chính SHA đó. Các workflow riêng phải ghi cùng SHA.
- [ ] T5.7: Nếu sửa mã/test sau lần chạy, chạy lại phần bị ảnh hưởng và toàn bộ gate cuối trên SHA mới trước khi kết luận.
- [x] T5.8: Tạo bảng tổng hợp planned/executed/pass/fail/skip theo suite. Test bắt buộc skip/cancel/timeout được coi chưa hoàn tất, không tính pass.

`Pass rate = passed / executed × 100%`; báo cáo thêm `executed / planned`. Điều kiện chốt nội bộ: mọi test bắt buộc được thực thi, fail = 0, skip chưa giải quyết = 0 và pass rate = 100%. Không kết luận đạt chỉ từ một job backend xanh khi E2E chưa chạy.

Đầu ra: link các CI run và artifacts cùng SHA. TC2.6 có các yêu cầu pipeline/deploy riêng; kế hoạch này chỉ xử lý phần CI cần để chứng minh TC2.5.

### G6 — Hồ sơ cuối và diễn tập bảo vệ (R7)

- [x] T6.1: Tạo báo cáo tổng hợp có ngày chạy, SHA, môi trường, phạm vi và bảng metric mục 8.
- [ ] T6.2: Liên kết test plan, danh mục test case, mã test, coverage, CI report, phi chức năng và bug tracker.
- [ ] T6.3: Kiểm tra hội đồng có quyền đọc repository, tracker và artifacts; chuẩn bị bản xuất dự phòng nếu artifact có thời hạn.
- [ ] T6.4: Review ngẫu nhiên một số AC và bug: giải thích test kiểm chứng gì, vì sao expected result đúng, và bằng chứng chạy ở đâu.
- [ ] T6.5: Diễn tập tái tạo một suite trên môi trường test sạch bằng hướng dẫn đã ghi.

Đầu ra: báo cáo cuối có thể kiểm tra độc lập; không ghi “đạt mức 5” nếu còn gate chưa hoàn tất.

## 5. Ca âm và ca biên cần rà ưu tiên

Đây là checklist rà khoảng trống, không khẳng định tất cả ca dưới đây đang thiếu. Expected result lấy từ đặc tả hiện hành.

| Nhóm | Ca cần rà |
| --- | --- |
| Auth/quyền | Chưa đăng nhập, session hết hạn, thiếu/sai CSRF, role khác, cùng role nhưng khác chủ tài nguyên |
| Booking | Slot giao nhau, sát ranh giờ mở/đóng cửa, ngày quá khứ, duration sai, giá đổi, tạo lặp, cạnh tranh cùng slot |
| Wallet/payment | Số tiền không hợp lệ, số dư thiếu/đúng bằng tiền phải trả, callback sai chữ ký/trùng/đến muộn, rollback khi lỗi giữa transaction |
| Expiry | Trước/đúng/sau deadline theo quy tắc so sánh đã đặc tả, worker chạy lặp, xác nhận cạnh tranh worker, cấu hình đổi sau khi tạo yêu cầu |
| Matchmaking | Slot cuối, apply/invite trùng, chốt thiếu người, rút trước/sau thanh toán, người ngoài kèo truy cập, một thành viên thiếu ví khi split bill |
| Tournament | Đăng ký trùng/hết hạn, giới hạn số đội, organizer khác giải, kết quả không hợp lệ, đồng hạng, xung đột lịch và thanh toán lặp |
| Hỗ trợ | Payload rỗng/thiếu field, bị block hoặc rời nhóm chat, media riêng tư, notification sau thay đổi nghiệp vụ |

Ví dụ có sẵn để bắt đầu ánh xạ: [wallet-request-expiry.test.ts](../../backend/src/__tests__/wallet-request-expiry.test.ts). Rà các assertion hiện có trước khi viết test mới; dùng thời gian kiểm soát được cho kiểm thử deadline để tránh flaky.

## 6. Hướng dẫn baseline và lệnh chạy

Thực thi sau khi xác nhận DB test riêng, biến môi trường và test fixtures theo cấu hình hiện hành. Test có thể reset dữ liệu; không chạy khi suite khác hoặc server dev đang dùng cùng DB test.

```bash
# Backend: lệnh hiện có
npm test --prefix backend

# Frontend: suite mặc định hiện có
npm run test:e2e --prefix frontend

# Suite giải đấu chuyên biệt hiện có
npm run test:e2e:tournament --prefix frontend
```

Các lệnh này không thay thế manifest toàn bộ cấu hình chuyên biệt. Không dùng `npm test` tại root làm gate hiện tại vì script root vẫn là placeholder báo lỗi. Lệnh coverage và tải sẽ được bổ sung sau khi công cụ/cấu hình được chốt, không coi chúng đã tồn tại.

Backend config hiện dùng PostgreSQL test cổng 5433, payment provider MOCK và test-auth trong môi trường kiểm thử. E2E thật qua browser phải nêu rõ bước nào dùng đăng nhập thật, bước nào seed qua helper, bước nào giả lập nhà cung cấp thanh toán. Không diễn giải test qua test-auth thành minh chứng đầy đủ cho session production.

## 7. Hồ sơ và nơi lưu

Chỉ tạo tài liệu khi bắt đầu công việc tương ứng. Kế hoạch này là một file độc lập; danh sách sau là đầu ra dự kiến, chưa phải file đã tạo.

| Đầu ra | Vị trí dự kiến | Cách duy trì |
| --- | --- | --- |
| Kế hoạch và tiến độ | File hiện tại | Cập nhật checklist, owner và trạng thái |
| Danh mục case + ma trận truy vết | `docs/reports/testing/test-cases.csv` | Một nguồn duy nhất cho AC mapping và tỷ lệ tự động hóa |
| Manifest suite/phạm vi đo | Cấu hình test và mục liên kết trong báo cáo | Tránh sao chép glob khác nhau ở nhiều nơi |
| Bug tracker | GitHub Issues hoặc tracker nhóm đã chọn | Báo cáo chỉ dẫn link/filter, không tạo bản trạng thái cạnh tranh |
| Báo cáo tổng hợp | `docs/testing/bao-cao-kiem-thu-tc2-5.md` | Số liệu có nguồn và SHA |
| Coverage, log, trace, HTML, số đo thô | CI artifacts; local dùng `/tmp` hoặc thư mục đã Git ignore | Không commit tập hợp log, ảnh và báo cáo sinh tự động |

Mỗi bộ minh chứng cần có: SHA, ngày/giờ và múi giờ, người chạy, môi trường, lệnh, suite/config, kết quả và link artifact. Dùng giờ Việt Nam cho mốc trình bày. Che secret và dữ liệu cá nhân trước khi chia sẻ.

## 8. Bảng chỉ số dùng để chốt

| Chỉ số | Mục tiêu | Nguồn minh chứng | Giá trị hiện tại |
| --- | --- | --- | --- |
| Kế hoạch kiểm thử | Có phạm vi, phân công, môi trường và exit criteria | Kế hoạch + baseline | Bản nháp này; chưa hoàn tất triển khai |
| Tầng kiểm thử | ≥ 4; kế hoạch thể hiện cả 5 nhóm rubric liệt kê | Manifest + mã test + report | Chưa tổng hợp xác nhận |
| Line coverage cốt lõi | ≥ 70% | Coverage trên phạm vi đã chốt | Chưa đo |
| Tỷ lệ tự động hóa | ≥ 70% | Danh mục case và phép tính | 135/154 = 87,66% (phạm vi chính); 142/163 = 87,12% nếu gồm case tranh chấp phạm vi |
| Pass CI cuối | 100% | Toàn bộ suite bắt buộc cùng SHA | Chưa xác nhận |
| Critical/Blocker còn mở | 0 | Tracker + retest | Chưa rà backlog hiện tại |
| Truy vết AC, ca âm/biên | Kiểm tra được từng AC trong phạm vi | Danh mục case + nguồn đặc tả | Chưa tổng hợp |
| Regression cho defect | Có test/kịch bản và kết quả retest | Bug → fix → test → CI | Chưa rà đầy đủ |
| Hồ sơ | Đủ và truy cập được | Báo cáo tổng hợp + links | Chưa đóng gói |

## 9. Thứ tự và ước lượng nguồn lực

Ước lượng theo ngày công, không phải cam kết ngày hoàn thành. Cập nhật sau G0 theo lượng fail và coverage thực tế; một ngày công tương đương khoảng một người làm việc tập trung trong ngày.

| Thứ tự | Gói | Ước lượng ban đầu | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | G0: phạm vi, kiểm kê và baseline | 1–2 ngày công | Không |
| 2 | G1: case inventory và traceability | 2–3 ngày công | Phạm vi G0 |
| 3 | G2: coverage và bổ sung test | 2–5 ngày công | Phạm vi G0; hoàn thiện theo G1 |
| 4 | G3: tầng test và phi chức năng | 2–4 ngày công | Baseline, AC/NFR; công cụ đã chốt |
| 5 | G4: triage, fix và regression | 1–4 ngày công, điều chỉnh theo lỗi | Bắt đầu từ G0, tiếp tục suốt kế hoạch |
| 6 | G5: CI và lần chạy chốt | 1–2 ngày công | G2/G3/G4 đủ điều kiện |
| 7 | G6: hồ sơ và diễn tập | 1 ngày công | G1–G5 |

Tổng sơ bộ 10–21 ngày công. Có thể phân công các domain độc lập cho các thành viên, nhưng các suite có reset chung DB phải chạy có điều phối. Không chốt lịch bảo vệ dựa trên ước lượng này trước khi có baseline.

## 10. Bảng theo dõi thực hiện

| Gói | Người thực hiện | Người review | Trạng thái | Bằng chứng/kết quả |
| --- | --- | --- | --- | --- |
| G0 | Codex | Nhóm dự án | Một phần | Baseline và môi trường đã ghi nhận; metrics.md đã xác nhận, còn review phạm vi AC/owner |
| G1 | Codex | Nhóm dự án | Một phần | Danh mục 163 case, 206 AC đã review; tự động hóa 87,66%; chờ nhóm review và xử lý 3 AC meta gap |
| G2 | Codex | Nhóm dự án | Local đạt | Coverage manifest cuối 88,90%; provider/gate đã cấu hình, CI cuối chưa chạy |
| G3 | Codex | Nhóm dự án | Một phần | Toàn bộ suite local pass; frontend 618/618, chat/baseline đã đo; UAT để nhóm chạy sau |
| G4 | Codex | Nhóm dự án | Một phần | Tracker cục bộ và các vấn đề cần triage |
| G5 | Codex | Nhóm dự án | Một phần | Đã cập nhật workflow; chưa publish/chạy CI cho thay đổi |
| G6 | Codex | Nhóm dự án | Một phần | Báo cáo local đã chốt trong docs/reports/testing; diễn tập do nhóm thực hiện |

Các quyết định cần chốt khi bắt đầu phần phụ thuộc: phạm vi file coverage, danh mục AC/test case, ngưỡng NFR còn thiếu, dependency coverage/công cụ tải, nơi quản lý bug và người phụ trách. Đây là các điểm cần xác định trong quá trình triển khai; không cản trở việc lập kế hoạch này.

## 11. Checklist trước khi nộp/bảo vệ

- [ ] Kế hoạch, danh mục AC và phạm vi coverage khớp sản phẩm đã cam kết.
- [ ] Có minh chứng các tầng test và báo cáo phi chức năng.
- [ ] Coverage dòng lệnh cốt lõi ≥ 70%, có file chưa được test trong phép đo.
- [ ] Tự động hóa ≥ 70% theo danh mục case đã chốt, không đếm trùng.
- [ ] Toàn bộ test bắt buộc được chạy và pass 100% trên cùng SHA chốt.
- [ ] Không có skip, flaky hoặc lỗi môi trường chưa được giải trình/xử lý trong gate bắt buộc.
- [ ] 0 Critical/Blocker còn mở; defect có vòng đời, regression và retest.
- [ ] Truy được AC → case → code test → kết quả; có ca âm và ca biên.
- [ ] Báo cáo và artifacts còn truy cập được đến buổi bảo vệ; có bản xuất dự phòng.
- [ ] Thành viên giải thích và tái tạo được các test được chọn ngẫu nhiên.

Chỉ ghi nhận hoàn tất kế hoạch khi mọi gate trên có bằng chứng. Điểm đánh giá cuối do giảng viên/hội đồng quyết định theo rubric và hồ sơ thực tế.

Kết quả đợt local 28/11/2026: backend full 1.187/1.187, unit độc lập 232/232, verification 59/59; frontend 618/618. Kiểm tra artifact xác nhận 115/115 file backend và 74/74 spec frontend được thực thi. Coverage manifest cuối tổng hợp 88,90%. Checkbox chỉ thể hiện phần đã có bằng chứng; chưa chốt toàn bộ G0–G6 hoặc mức 5 vì còn danh mục case/AC, security triage và CI. UAT giữ kịch bản/phiếu theo yêu cầu nhóm.
