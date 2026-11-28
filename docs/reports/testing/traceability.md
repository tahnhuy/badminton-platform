# Truy vết AC và quy ước danh mục test case

Ngày rà: 28/11/2026. Tài liệu này mô tả cách truy vết hiện hành; số liệu chi tiết nằm ở [`automation-summary.md`](automation-summary.md) và [`test-case-gaps.md`](test-case-gaps.md).

## 1. Nguồn duy nhất

- [`test-cases.csv`](test-cases.csv) là **danh mục case nghiệp vụ duy nhất** và là mẫu số của tỷ lệ tự động hóa. Mỗi case có `requirement_ref`, `ac_ref`, `business_rule_ref`, `test_file`, `test_title`, `automation_status`, `execution_status`, `evidence`.
- [`acceptance-register.csv`](acceptance-register.csv) là nguồn AC đã review: 206 dòng, mỗi dòng có `review_status` và `scope_status`. 184 dòng `CURRENT / IN_SCOPE`.
- [`trace-links.csv`](trace-links.csv) là chi tiết lịch sử 47 liên kết tới 44 AC, giữ để tham chiếu assertion cũ. **Không dùng làm mẫu số** và không thay `test-cases.csv`.
- [`test-inventory.csv`](test-inventory.csv) là kiểm kê test function bằng AST; không phải danh mục case và không dùng để tính tỷ lệ.

Chạy `node docs/reports/testing/validate-test-cases.cjs` để kiểm tra ID, enum, tham chiếu AC, file/tên test, kết quả pass trong artifact local và tính lại tỷ lệ.

## 2. Quy ước ánh xạ

- `AC-SRC-###` là ID hồ sơ gán cho bullet nguồn, không thay ID đặc tả. `TRN-AC-*`, `WAL-AC-*`, `NTF-AC-*`, `MM-AC-*`, `CO-AC-*`, `AUTH-AC-*`, `PRF-AC-*`, `MSG-AC-*`, `SOC-AC-*`, `PAY-AC-*` là AC tổng hợp từ PRD/Tech Design/business rules cho các domain không có mục AC riêng; văn bản AC ghi rõ nguồn.
- Một case có thể tham chiếu nhiều AC và nhiều test; vẫn tính **một lần** trong tỷ lệ.
- `test_level` chỉ dùng Unit / Integration / System / Acceptance. API/UI/E2E/Security/Concurrency/Performance là `test_type`, không phải tầng.
- `PARTIAL` nghĩa là test hiện có chỉ chứng minh một phần expected result. Không nâng thành `AUTOMATED` nếu thiếu assertion cho vế còn lại.
- `PASSED` chỉ khi có artifact thực thi tương ứng; không suy ra từ source hoặc tên test.

## 3. Kết quả phân loại AC

| Nhóm | Số dòng | Ghi chú |
| --- | ---: | --- |
| CURRENT / IN_SCOPE | 184 | AC hiện hành; 181 có case |
| UNRESOLVED / CONFLICT | 15 | Rating: PROJECT-BRIEF ngoài MVP, metrics.md vẫn cam kết |
| UNRESOLVED / UNRESOLVED | 1 | AC-SRC-118 còn Provisional |
| SUPERSEDED / HISTORICAL | 4 | AC-SRC-057, 092, 093, 124 |
| SUPERSEDED / CONFLICT | 1 | AC-SRC-071 |
| HISTORICAL / OUT_OF_SCOPE | 1 | AC-SRC-019 |

Không có cặp trùng khít. Các cặp chồng lấn (020/032, 051/053, 073/074) được giữ vì expected result khác nhau. Danh sách lý do cụ thể ở [`test-case-gaps.md`](test-case-gaps.md) §1.

## 4. AC hiện hành chưa có case

- AC-SRC-127: migration áp sạch — là verification migration, có log riêng nhưng chưa thành case.
- AC-SRC-128: mọi error code có test — là meta-check trên bộ test.
- AC-SRC-129: mọi technical check §16 pass — là điều kiện verification tổng hợp.

Ba mục này là gap có giải thích, không phải hành vi nghiệp vụ bị bỏ quên. Chi tiết hướng xử lý ở [`test-case-gaps.md`](test-case-gaps.md) §2.

## 5. Mâu thuẫn phải giữ khi review

- Matchmaking: AC-SRC-057 mô tả tự tạo Match khi đủ người, trái quyết định 2026-11-08 (chủ kèo chủ động chốt). Đã đánh `SUPERSEDED`; không viết test theo AC cũ.
- Rating: PROJECT-BRIEF §5 ngoài MVP; metrics.md hạng mục 10 cam kết; Ratings Tech Design ghi legacy/TBD. 7 case bị `CONFLICT`, không trộn vào mẫu số chính.
- Split Bill: PROJECT-BRIEF bổ sung 2026-11-20; documentation-guide §2.4 còn ghi ngoài MVP. Case dùng PROJECT-BRIEF (thứ bậc cao hơn) và ghi nhận để chủ tài liệu sửa.
- Social/Matchmaking: metrics.md hạng mục 3 mô tả “bài tìm kèo” trên bảng tin cộng đồng; PROJECT-BRIEF tách hai khu vực. Test/E2E hiện xác nhận tách khu vực; cần chủ tài liệu đồng bộ wording.
- Auth: AC-SRC-124 (đăng ký đặt cookie), 092/093 (mã trình độ cũ) đã superseded.
- Draft docs: Admin frontend-consolidation và System-config Tech Design đang Draft nhưng hành vi đã triển khai/test; AC giữ `CURRENT` kèm cảnh báo, không tự nâng Ready.

## 6. Điều kiện đóng truy vết

Mỗi AC hiện hành có case hoặc gap được giải thích; mỗi case `AUTOMATED` có test pass trong CI trên SHA chốt; mỗi `PARTIAL` được nâng đủ hoặc tách phần thiếu thành `PLANNED` có owner; UAT có kết quả/chữ ký thật; không còn `CONFLICT` chưa phân xử ảnh hưởng mẫu số.

Số liệu hiện tại: 163 case; 154 case trong phạm vi; 135 `AUTOMATED` = 87,66%; 181/184 AC có case = 98,37%. Không gọi đây là tỷ lệ CI hay tỷ lệ pass toàn bộ.
