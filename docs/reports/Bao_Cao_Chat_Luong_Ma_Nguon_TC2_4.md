# Báo cáo phân tích tĩnh mã nguồn, quét secret và coding convention — TC2.4

**Dự án:** Badminton Platform  
**Ngày đánh giá:** 26/11/2026

## 1. Kết quả tổng hợp

| Hạng mục | Kết quả |
| --- | --- |
| Phân tích tĩnh SonarJS | **0 Blocker, 0 Critical**, 311 Major, 462 Minor |
| Lint frontend | **0 lỗi**, 66 cảnh báo |
| Lint backend | **0 lỗi**, 41 cảnh báo |
| Mã trùng lặp | **2,76%** số dòng theo jscpd |
| Quét secret | **5 phát hiện mỗi phạm vi quét**; 5 cảnh báo giả theo ngữ cảnh, **0 secret thật được xác nhận** |
| TypeScript và build | Đạt ở backend và frontend |


Kết quả 0 Blocker/Critical được phân loại theo `defaultSeverity` của SonarJS. Các cảnh báo Major/Minor và Oxlint vẫn thuộc danh mục vấn đề chất lượng mã nguồn.

## 2. Phân tích tĩnh mã nguồn

### 2.1. Công cụ và phạm vi

| Công cụ | Phiên bản | Phạm vi và cấu hình |
| --- | --- | --- |
| ESLint / SonarJS | 9.39.5 / 4.2.3 | 751 tệp TypeScript/TSX thuộc backend và frontend; bộ quy tắc `sonarjs.configs.recommended`; parser có thông tin kiểu; ngưỡng cognitive complexity 15; `allowInlineConfig: false` |
| typescript-eslint | 8.74.0 | Thông tin kiểu theo tsconfig của backend và frontend |
| Oxlint frontend | 1.82.0 | 486 tệp, 116 quy tắc |
| Oxlint backend | 1.82.0 | 484 tệp, 96 quy tắc mặc định |
| jscpd | 4.0.5 | TypeScript/TSX ở backend và frontend; `min-lines=5`, `min-tokens=50` |


### 2.2. Kết quả SonarJS

| Mức độ | Số lượng |
| --- | --- |
| Blocker | **0** |
| Critical | **0** |
| Major | 311 |
| Minor | 462 |
| **Tổng vấn đề** | **773** |
| Lỗi parser nghiêm trọng | **0** |

| Quy tắc Blocker/Critical | Mức độ | Số vấn đề |
| --- | --- | --- |
| S3516 — `no-invariant-returns` | Blocker | 0 |
| S3776 — `cognitive-complexity` | Critical | 0 |
| S2871 — `no-alphabetical-sort` | Critical | 0 |
| S3735 — `void-use` | Critical | 0 |
| S2004 — `no-nested-functions` | Critical | 0 |

Mức độ được ánh xạ theo metadata `defaultSeverity` tương ứng với bản SonarJS 4.2.3. Đây là phép phân tích bằng ESLint/SonarJS, không phải kết quả từ SonarQube Server. Mức `error` của ESLint không đồng nghĩa với Blocker/Critical.

Các vấn đề Major/Minor gồm đề xuất về props chỉ đọc, gán lại tham số, API/type deprecated và biểu thức điều kiện lồng nhau.

### 2.3. Kết quả lint

| Nhóm cảnh báo | Frontend | Backend |
| --- | --- | --- |
| `set-state-in-effect` | 51 | 0 |
| `only-export-components` | 9 | 0 |
| `exhaustive-deps` | 3 | 0 |
| `incompatible-library` | 3 | 0 |
| `no-unused-vars` | 0 | 40 |
| `no-control-regex` | 0 | 1 |
| **Tổng cảnh báo** | **66** | **41** |
| **Tổng lỗi** | **0** | **0** |

Design-system guard đạt trên 287 tệp UI; hệ thống còn 1 stylesheet legacy. Backend chưa có cấu hình lint được tích hợp thường xuyên vào CI.

### 2.4. Mã trùng lặp

| Chỉ số | Kết quả |
| --- | --- |
| Tệp nguồn duy nhất trong thống kê định dạng | 743 |
| Tổng số dòng theo công cụ | 81.922 |
| Số đoạn trùng lặp | 195 |
| Số dòng trùng lặp | 2.265 |
| Tỷ lệ dòng trùng lặp | **2,76%** |
| Tỷ lệ token trùng lặp | 2,55% |

Tỷ lệ dòng trùng lặp nằm trong ngưỡng **≤3%**. Số liệu dựa trên cách phân tích định dạng của jscpd và không đồng nhất với chỉ số duplication của SonarQube.

## 3. Báo cáo quét secret

### 3.1. Công cụ và kết quả

**Công cụ:** Gitleaks 8.30.1, quy tắc mặc định, che giá trị nhạy cảm bằng `--redact=100`.

| Phạm vi | Quy mô | Phát hiện thô | Cảnh báo giả theo ngữ cảnh | Secret thật được xác nhận |
| --- | --- | --- | --- | --- |
| Lịch sử Git | 220 commit do công cụ báo cáo | 5 | 5 | **0** |
| Tệp dự án | 1.298 tệp thuộc phạm vi kiểm tra | 5 | 5 | **0** |

Hai phạm vi có cùng 5 loại phát hiện thuộc quy tắc `generic-api-key`. Exit code của Gitleaks là 1 do vẫn có phát hiện thô; kết quả phân loại không thay đổi số phát hiện của công cụ.

Phạm vi không bao gồm dependency, đầu ra build, tệp bị Git ignore và symlink. Phép quét lịch sử bao phủ các ref được thu thập trong phạm vi kiểm tra, chưa xác nhận bao phủ mọi ref trên remote. Số commit Gitleaks báo cáo không đại diện cho việc phân tích độc lập mọi merge commit.

### 3.2. Phân loại phát hiện

| Vị trí | Nội dung được nhận diện | Kết luận theo ngữ cảnh |
| --- | --- | --- |
| `backend/.env.example:56–57` | Regex khớp từ biến mẫu rỗng sang tên biến ở dòng tiếp theo | Không có giá trị khóa được cung cấp |
| `frontend/e2e/admin-users-ui.spec.ts:10` | Mật khẩu tạm giả trong response mock | Dữ liệu kiểm thử giao diện |
| `backend/src/__tests__/wallet-top-up.test.ts:138` | Idempotency key cố định | Định danh yêu cầu kiểm thử, không phải credential |
| `backend/src/__tests__/social-step1-migrations.test.ts:175` | Key cố định của fixture bài đăng | Dữ liệu kiểm thử migration |
| `docs/architecture/frontend.md:75` | Figma file identifier | Định danh tệp, không phải access token |

**Kết luận:** 5 cảnh báo giả theo ngữ cảnh, 0 secret thật được xác nhận trong các phát hiện. Phân loại dựa trên nội dung và vai trò sử dụng trong dự án, không bao gồm thử xác thực với dịch vụ bên ngoài hoặc xác minh khả năng tái sử dụng ở môi trường khác.

Các tệp cấu hình `backend/.env` và `frontend/.env` thuộc Git ignore; các tệp cấu hình môi trường được theo dõi theo mẫu kiểm tra là hai tệp `.env.example`.

## 4. Coding convention

| Nhóm | Quy ước |
| --- | --- |
| Tên biến và hàm | `camelCase`; tên thể hiện rõ ý nghĩa và trách nhiệm |
| Component, lớp và kiểu | `PascalCase` cho component, class, type và interface |
| Hằng số | `UPPER_SNAKE_CASE` |
| React hook | Tên bắt đầu bằng `use` |
| Tệp và thư mục | Quy ước chung `kebab-case`, có ngoại lệ theo framework |
| Cấu trúc backend | Phân lớp `routes`, `controllers`, `services`, `repositories` theo chức năng; hợp đồng liên mô-đun ở `contracts` |
| Cấu trúc frontend | Chức năng ở `src/features`; router/provider ở lớp ứng dụng; UI và tiện ích dùng chung ở vùng chia sẻ |
| API | REST, tiền tố `/api/v1/`, mã HTTP nhất quán; phân trang theo `page`, `limit`, `meta` |
| Validation | Zod tại biên tiếp nhận dữ liệu; kiểm tra dữ liệu trước xử lý nghiệp vụ |
| Database | Định danh `snake_case`, truy vấn có tham số, migration rõ ràng; transaction bao quát thao tác cần tính nguyên tử |
| Bảo mật | Kiểm tra quyền ở backend; cấu hình nhạy cảm qua biến môi trường; không hardcode hoặc ghi log secret |
| Xử lý lỗi | Mã lỗi nhất quán; không trả stack trace cho người dùng |
| Kiểm thử | Vitest/Supertest cho backend; Playwright cho luồng giao diện |
| Git và review | Commit có ý nghĩa; thay đổi tài liệu dùng chung và schema qua PR có thành viên khác review |

Đây là bộ quy ước áp dụng cho dự án; kết quả lint không chứng minh mọi tệp đều tuân thủ đầy đủ các quy ước về đặt tên, phân lớp và nghiệp vụ. Formatter, pre-commit và cấu hình lint backend thường xuyên chưa có quyết định thống nhất.

## 5. Kết quả kiểm thử và build

| Hạng mục | Kết quả | Phạm vi và giới hạn |
| --- | --- | --- |
| TypeScript backend và frontend | Đạt | Kiểm tra kiểu với `--noEmit` |
| Build backend | Đạt | Biên dịch ứng dụng backend |
| Build frontend | Đạt | Còn cảnh báo chunk lớn hơn 500 kB |
| Kiểm thử backend | **1.150 đạt, 1 bỏ qua** | 108 tệp test đạt; tổng 1.151 test; exit code 0 |
| Kiểm thử giao diện | **209/209 đạt** | 21 tệp test, Chrome, API mock, viewport 390/1280 px |
| Đối chiếu hành vi | **3.378 phép so sánh đạt** | Validation khảo sát/cấu hình, canonical query và chữ ký VNPAY, sinh lịch và cảnh báo lịch, nhãn thông báo |
| HTTP client | **19 kịch bản đạt** | HTTP method, JSON/FormData, header, CSRF refresh/retry, lỗi mạng, sự kiện phiên đăng nhập và Retry-After |

Test backend bị bỏ qua là test CLI tạo tài khoản admin qua child process và nhận mật khẩu từ stdin; kết quả của test này chưa được xác nhận. Kiểm thử giao diện dùng API mock không thay thế kiểm thử tích hợp với cơ sở dữ liệu thật hoặc kết quả CI Nightly. Các phép đối chiếu hành vi sử dụng dữ liệu có seed cố định, không đại diện cho mọi đầu vào.

## 6. Chỉ số quản lý chất lượng

### 6.1. Pull request và review

| Chỉ số | Kết quả |
| --- | --- |
| PR đã merge trong dữ liệu khảo sát | 34 |
| Khoảng thời gian merge | 25/09/2026–25/11/2026 |
| PR có review chính thức từ người khác trước merge | **0/34 (0%)** |
| Tuần có commit trong khoảng quan sát | 12/12 tuần, từ 13/09 đến 25/11/2026 |

Review chính thức gồm `APPROVED`, `CHANGES_REQUESTED` hoặc `COMMENTED` từ người khác tác giả trước thời điểm merge. Chỉ số 0/34 tính theo số PR, chưa đủ mẫu số để xác định tỷ lệ thay đổi qua PR có review. Số tuần có commit chỉ phản ánh khoảng quan sát, chưa đại diện cho toàn học kỳ.

### 6.2. CI

| Workflow | Tổng lượt chạy | Thành công | Thất bại | Bị hủy | Tỷ lệ thành công |
| --- | --- | --- | --- | --- | --- |
| CI của dự án | 7 | 6 | 0 | 1 | **85,71%** |
| E2E Nightly | 4 | 0 | 4 | 0 | **0%** |
| Dependabot | 7 | 7 | 0 | 0 | 100% |

Cả 4 lượt E2E Nightly thất bại tại bước **Run Playwright E2E**; nguyên nhân từng test chưa được xác định. Các tỷ lệ phản ánh dữ liệu lịch sử tại thời điểm khảo sát. Workflow CI của dự án có migration/build/test backend và lint/build frontend, chưa tích hợp Gitleaks, jscpd hoặc SonarJS.
