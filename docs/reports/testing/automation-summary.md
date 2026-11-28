# Tỷ lệ tự động hóa test case nghiệp vụ — TC2.5

- Ngày chốt số liệu: 28/11/2026 (giờ Việt Nam).
- Danh mục nguồn duy nhất: [`test-cases.csv`](test-cases.csv) — 163 case nghiệp vụ, ID ổn định.
- Nguồn AC đã review: [`acceptance-register.csv`](acceptance-register.csv) — 206 dòng, mỗi dòng có `review_status` và `scope_status`.
- Bằng chứng thực thi: các báo cáo local trong `artifacts/` của đợt 28/11/2026 trên base SHA `6d7cf36` + working tree. **Không phải kết quả CI** và không thay thế lần chạy CI cuối.
- Phạm vi đối chiếu: [metrics.md](../metrics.md) 12 hạng mục, [rubric TC2.5](../Rubric_Do_An_Mon_Hoc_CNPM_v2.docx.md), [kế hoạch G0–G6](../../testing/ke-hoach-kiem-thu-tc2-5-muc-5.md).

## 1. Định nghĩa và công thức

```text
Tỷ lệ tự động hóa =
  số case nghiệp vụ trong phạm vi có automation_status = AUTOMATED
  / tổng case nghiệp vụ trong phạm vi
  × 100%
```

Quy tắc áp dụng:

- Mẫu số gồm **AUTOMATED, PARTIAL, PLANNED, MANUAL**; không loại case thủ công để tăng tỷ lệ.
- Một case chỉ tính một lần dù có nhiều test, nhiều tầng hoặc nhiều file.
- Chỉ `AUTOMATED` được tính vào tử số. `PARTIAL` không được làm tròn thành tự động hóa đầy đủ.
- Case có `scope_status = CONFLICT` (mâu thuẫn phạm vi tài liệu) được báo riêng, không trộn vào mẫu số chính. Bảng độ nhạy §5 cho thấy tỷ lệ nếu tính cả các case này.
- Tỷ lệ tự động hóa tách khỏi **tỷ lệ pass** và **tỷ lệ AC có case**. Ba số đo ở §2, §4 và §6.

Ánh xạ 12 hạng mục `metrics.md`: 1→D01_AUTH, 2→D02_PROFILE, 3→D03_SOCIAL, 4→D04_MATCHMAKING, 5→D05_BOOKING, 6→D06_WALLET, 7→D07_COURT_OWNER, 8→D08_TOURNAMENT, 9→D09_MESSAGING, 10→D10_RATING, 11→D11_NOTIFICATION, 12→D12_ADMIN. `X_UAT` là gate Acceptance xuyên domain.

## 2. Số liệu tổng

| Chỉ số | Giá trị |
| --- | ---: |
| Tổng case trong danh mục | 163 |
| Case trong phạm vi chính (`IN_SCOPE`) | 154 |
| Case tự động hóa đầy đủ trong phạm vi | **135** |
| **Tỷ lệ tự động hóa trong phạm vi** | **87,66%** |
| Case `PARTIAL` trong phạm vi | 12 |
| Case `PLANNED` trong phạm vi | 6 |
| Case `MANUAL` trong phạm vi | 1 |
| Case `CONFLICT` (báo riêng) | 9 |
| Case có kết quả `PASSED` trong phạm vi | 135 |
| Tỷ lệ pass của case đã thực thi trong phạm vi | 135/135 = 100% (local) |

**Lưu ý:** 100% pass chỉ là của 135 case `AUTOMATED` đã chạy trong đợt local. 19 case còn lại trong phạm vi giữ `NOT_RUN`; không suy ra pass từ source hoặc từ test inventory.

Phân bố tầng kiểm thử trong danh mục:

| Tầng | Số case | Ghi chú |
| --- | ---: | --- |
| Unit | 5 | Công thức khảo sát, bracket, schedule, score, VNPAY signature |
| Integration | 140 | Service/repository + PostgreSQL, API Supertest |
| System | 17 | 8 E2E, 7 UI, 2 Performance; gồm 4 case `PARTIAL`/`PLANNED` (AUTH-20, AUTH-21, SOC-09, CO-09); UI mock không thay backend thật |
| Acceptance | 1 | Gate UAT-01…UAT-14, `NOT_RUN`, không có chữ ký |

`API`, `Security`, `Concurrency`, `Performance`, `UI`, `E2E`, `UAT` là `test_type`, không phải tầng.

## 3. Theo domain

| Domain | Tổng case | AUTOMATED | PARTIAL | PLANNED | MANUAL | Trong phạm vi | Tự động trong phạm vi | Tỷ lệ domain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| D01_AUTH | 21 | 13 | 4 | 4 | 0 | 20 | 13 | 65,00% |
| D02_PROFILE | 10 | 8 | 1 | 1 | 0 | 10 | 8 | 80,00% |
| D03_SOCIAL | 14 | 13 | 1 | 0 | 0 | 14 | 13 | 92,86% |
| D04_MATCHMAKING | 16 | 16 | 0 | 0 | 0 | 16 | 16 | 100,00% |
| D05_BOOKING | 16 | 14 | 0 | 2 | 0 | 16 | 14 | 87,50% |
| D06_WALLET | 16 | 13 | 3 | 0 | 0 | 16 | 13 | 81,25% |
| D07_COURT_OWNER | 9 | 8 | 1 | 0 | 0 | 9 | 8 | 88,89% |
| D08_TOURNAMENT | 20 | 19 | 1 | 0 | 0 | 19 | 18 | 94,74% |
| D09_MESSAGING | 12 | 12 | 0 | 0 | 0 | 12 | 12 | 100,00% |
| D10_RATING | 7 | 6 | 1 | 0 | 0 | 0 | 0 | n/a (toàn bộ CONFLICT) |
| D11_NOTIFICATION | 5 | 5 | 0 | 0 | 0 | 5 | 5 | 100,00% |
| D12_ADMIN | 16 | 15 | 1 | 0 | 0 | 16 | 15 | 93,75% |
| X_UAT | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0,00% |
| **Tổng** | **163** | **142** | **13** | **7** | **1** | **154** | **135** | **87,66%** |

Đọc bảng:

- D01_AUTH chỉ đạt 65,00% trong phạm vi. Đây là domain yếu nhất: 4 case `PARTIAL` và 4 `PLANNED` liên quan khóa tài khoản, absolute timeout, Admin-only play, đổi role, email malformed. Không được che bằng tỷ lệ tổng.
- D10_RATING có 7 case nhưng toàn bộ nằm ngoài mẫu số chính vì mâu thuẫn phạm vi (xem §5). 6 case có test pass nhưng không chứng minh phạm vi cam kết.
- X_UAT là gate Acceptance cho 14 kịch bản UAT, chưa thực hiện; không nhân bản 14 kịch bản thành 14 case tự động.

## 4. Tỷ lệ AC có case (khác tỷ lệ tự động hóa)

| Chỉ số | Giá trị |
| --- | ---: |
| AC hiện hành trong phạm vi | 184 |
| AC có ít nhất một case | 181 |
| **Tỷ lệ AC có case** | **98,37%** |
| AC chưa có case | 3 |

Ba AC chưa có case là AC-SRC-127, AC-SRC-128, AC-SRC-129 — các điều kiện kiểm chứng kỹ thuật của Authentication Tech Design (migration áp sạch, mọi error code có test, mọi technical check §16 pass). Đây là điều kiện verification/meta, không phải hành vi nghiệp vụ; xem [test-case-gaps.md](test-case-gaps.md) §2.

AC có case **không** đồng nghĩa case đã tự động hóa: 12 case `PARTIAL`, 6 `PLANNED`, 1 `MANUAL` vẫn có AC nguồn.

## 5. Mâu thuẫn phạm vi và độ nhạy

Case `CONFLICT` (9):

- 7 case D10_RATING (AC-SRC-064…079, trừ AC-SRC-071 đã superseded): `PROJECT-BRIEF.md` §5 xếp Post-match Rating ngoài MVP; `metrics.md` hạng mục 10 vẫn cam kết; Ratings Tech Design ghi legacy/TBD.
- 1 case D08_TOURNAMENT (TC-TRN-19): `PROJECT-BRIEF.md` §3.4/§7 xác nhận cơ chế điểm phong độ từ giải chuyên nghiệp; `metrics.md` §6 nói công thức nâng trình chưa có quyết định.
- 1 case D01_AUTH (TC-AUTH-21): AC-SRC-118 còn ghi Provisional (Decision #21).

Độ nhạy:

| Cách tính | Tử số | Mẫu số | Tỷ lệ |
| --- | ---: | ---: | ---: |
| Phạm vi chính (báo cáo chính) | 135 | 154 | **87,66%** |
| Gồm toàn bộ case kể cả CONFLICT | 142 | 163 | 87,12% |
| Minh họa nếu tách 14 kịch bản UAT thành case thủ công riêng (không phải cách tính chính thức) | 135 | 168 | 80,36% |

Cả ba cách đều trên 70%. Tuy vậy, **không tuyên bố tỷ lệ cuối cùng đã chốt** khi còn 3 AC meta gap, 1 AC provisional, 15 AC rating chưa phân xử và UAT/CI chưa có.

## 6. Kiểm tra và tái tạo

Chạy:

```bash
node docs/reports/testing/validate-test-cases.cjs
```

Script kiểm tra:

- `case_id` duy nhất, đủ trường bắt buộc, enum hợp lệ, `owner = UNASSIGNED`.
- Mọi `ac_ref` tồn tại trong `acceptance-register.csv`; không đưa AC rating vào case `IN_SCOPE`.
- File test tồn tại và `test_title` xuất hiện trong source.
- Case `PASSED` phải có test tương ứng **pass** trong artifact local; không suy ra từ source.
- Tính lại tỷ lệ theo domain, tổng, AC coverage và in JSON để đối chiếu.

Kết quả lần chạy 28/11/2026: 0 lỗi cấu trúc, 0 cảnh báo; **142 liên kết test–artifact** được xác nhận pass (135 case phạm vi chính + 7 case CONFLICT). Đây là kiểm tra liên kết và kết quả local, không phải xác nhận CI.

## 7. Kết luận đối với ngưỡng ≥70%

- **Theo danh mục đã review, ngưỡng ≥70% được đáp ứng:** 135/154 = **87,66%**. Nếu tính cả case tranh chấp phạm vi: 142/163 = 87,12%.
- **Không đạt kết luận “đã chốt tỷ lệ cuối”** vì: 3 AC meta gap; AC-SRC-118 provisional; 15 AC rating chưa có phán quyết phạm vi; UAT chưa thực hiện; chưa có CI run cho working tree.
- Việc đạt 70% **không** đồng nghĩa đạt TC2.5 mức 5. TC2.5 còn yêu cầu coverage ≥70%, 100% pass ở CI cuối, 0 Critical/Blocker, bug tracker/regression và ≥4 tầng có minh chứng; các mục này được theo dõi riêng trong [bao-cao-tc2-5.md](bao-cao-tc2-5.md).
- Không điều chỉnh mẫu số, không đổi case `PARTIAL` thành `AUTOMATED`, không loại case thủ công để đạt ngưỡng.

## 8. Giới hạn minh chứng

- Kết quả `PASSED` đến từ artifact local ngày 28/11/2026 (`backend.json`, `unit.json`, `system.json`, `remaining.json`, `tournament.json`, `ui.json`), không phải log GitHub Actions.
- Test dùng DB test cổng 5433, payment provider MOCK/SePay sandbox; không gọi tiền thật.
- UI mock không chứng minh tích hợp backend; chỉ E2E thật (`system`, `remaining`, `tournament`) chứng minh xuyên hệ thống.
- UAT và chữ ký người đại diện không được tạo thay; xem [uat.md](uat.md).
- Số liệu sẽ phải chạy lại nếu danh mục AC, phạm vi hoặc bộ test thay đổi.
