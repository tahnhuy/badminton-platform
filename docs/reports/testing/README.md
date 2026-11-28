# Hồ sơ kiểm thử TC2.5

Đợt local ngày 28/11/2026: backend full 1.187/1.187, unit 232/232, xác nhận cuối 59/59; frontend 618/618. Coverage core tổng hợp 88,90%.

Danh mục case nghiệp vụ đã hoàn thiện tại [`test-cases.csv`](test-cases.csv): **163 case**, 154 case trong phạm vi chính, **135 case tự động hóa đầy đủ = 87,66%**. Trong 184 AC hiện hành, 181 AC có case (98,37%). Số liệu và cách tính ở [`automation-summary.md`](automation-summary.md); gap và mâu thuẫn ở [`test-case-gaps.md`](test-case-gaps.md).

Kết quả local **không phải CI**; UAT chưa thực hiện theo xác nhận của nhóm. Kế hoạch mức 5 còn các gate CI, UAT, phạm vi/3 AC meta gap và rà lại defect trước bảo vệ.

Đợt dependency/security tiếp theo đã triage và vá Critical/High: backend còn 6 Moderate (hai advisory gốc), frontend audit 0; các regression sau vá đều pass. SEC-01 Closed, SEC-02/SEC-03 Open. Các số full suite/coverage phía trên thuộc snapshot trước bản vá. Xem [báo cáo security](security-triage.md) và [bảng triage từng package](security-triage.csv).

## Tài liệu

- [Checklist phần còn lại để hoàn thành TC2.5 mức 5](checklist-hoan-thanh-tc2-5-muc-5.md).
- [Báo cáo kết quả và đánh giá rubric](bao-cao-tc2-5.md).
- [Tỷ lệ tự động hóa và cách tính](automation-summary.md).
- [Khoảng trống AC/case và mâu thuẫn](test-case-gaps.md).
- [Ánh xạ metrics.md theo 12 hạng mục](metrics-mapping.md).
- [Kế hoạch G0–G6](../../testing/ke-hoach-kiem-thu-tc2-5-muc-5.md).
- [Phân hoạch 74 spec frontend](frontend-suite-manifest.csv).
- [Cấp độ, phạm vi coverage và manifest suite](test-levels-and-suites.md).
- [Truy vết AC và quy ước danh mục](traceability.md).
- [Coverage theo file](coverage-by-file.csv): số liệu từ full backend và phép đo validation bổ sung.
- [Danh mục test case nghiệp vụ](test-cases.csv): **nguồn duy nhất** cho mẫu số tự động hóa.
- [Acceptance nguồn đã review](acceptance-register.csv): 206 dòng, có `review_status`/`scope_status`; 184 AC hiện hành trong phạm vi.
- [Danh mục test tĩnh](test-inventory.csv): kiểm kê test function, **không phải** mẫu số case.
- [Liên kết AC tới test cụ thể](trace-links.csv): chi tiết lịch sử 47 liên kết/44 AC; đã được thay bằng `test-cases.csv` làm nguồn chính.
- [Defect và vấn đề minh chứng](defects.md).
- [Kết luận security, bản vá và regression](security-triage.md), [triage package/advisory](security-triage.csv).
- [Ghi chú tính toàn vẹn và giới hạn đợt chạy](run-notes.md).
- [Kịch bản và phiếu UAT](uat.md): chưa có người dùng thực hiện.

## Kiểm tra danh mục

```bash
node docs/reports/testing/validate-test-cases.cjs
```

Script kiểm tra ID duy nhất, trường bắt buộc, enum, tham chiếu AC, file/tên test, kết quả pass trong artifact local và tính lại tỷ lệ theo domain/AC. Lần chạy 28/11/2026: 0 lỗi, 0 cảnh báo, 142 liên kết test–artifact pass.

## Tái tạo

Có thể chạy nối tiếp các gate bằng `bash docs/reports/testing/run-tests.sh`. Script ghi exit code và vẫn thu kết quả các suite sau khi một suite fail. Đây là runner local, không thay log GitHub Actions; E2E hệ thống trong runner là tập auth, booking–match, rating và admin finance, không thay toàn bộ E2E mặc định.

```bash
node docs/reports/testing/inventory.cjs
node docs/reports/testing/extract-acceptance.cjs   # chỉ trích nguồn thô; không ghi đè register đã review
npm run test:unit --prefix backend
npm run test:coverage --prefix backend
npm test --prefix backend -- performance-baseline.test.ts
npm run test:e2e --prefix frontend -- --config playwright.sign-in.config.ts
npm run test:e2e --prefix frontend -- --config playwright.core.config.ts
npm run test:e2e --prefix frontend -- --config playwright.remaining.config.ts
npm run test:e2e:tournament --prefix frontend
node docs/reports/testing/validate-test-cases.cjs
```

Các suite dùng DB phải chạy nối tiếp trên `badminton_test`; kiểm tra không có tiến trình khác dùng DB đó. Không dùng lệnh reset trên dữ liệu dev/production.

Các output máy sinh đặt tại `artifacts/` và không được commit. Khi chuyển hồ sơ, cần mang theo thư mục này hoặc link CI artifacts còn hiệu lực; repository chỉ chứa tài liệu/source không thay thế báo cáo thực thi.
