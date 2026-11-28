# Cấp độ kiểm thử, phạm vi coverage và manifest suite

## 1. Bốn cấp độ

| Cấp độ | Suite/nguồn | Phạm vi chứng minh và giới hạn |
| --- | --- | --- |
| Unit | `backend/vitest.unit.config.ts`: bracketGenerator, scheduleGenerator, score, placement, skillRating, skill-survey-engine, vnpay-signature, validation-boundaries, password-hasher, facility-stats-helpers, rating-adjustment, request-schedule | Thuật toán độc lập, không chạy global DB setup. Đây là tập unit đã xác nhận, không khẳng định mọi test trong backend là unit |
| Integration | `backend/vitest.config.ts` | Service/repository + PostgreSQL; Supertest gọi Express + DB. Tên describe “Unit” trong admin-users không biến test có DB thật thành unit |
| System | Playwright real backend, DB; concurrency/security suites | Chỉ E2E thật chứng minh browser → API → DB. Nhà cung cấp payment/email được giả lập phải công khai |
| Acceptance | `uat.md` + người đại diện thực hiện | Chưa chạy, không tự ký thay người dùng |

API/UI là giao diện kiểm thử; phi chức năng là loại kiểm thử, không phải ba cấp độ bổ sung. Rubric liệt kê các nhóm này nên vẫn cung cấp ánh xạ:

| Nhóm rubric | Minh chứng |
| --- | --- |
| Unit | Unit report và source |
| Integration | Backend full suite/report, state DB và transaction assertions |
| API | Supertest: auth endpoints, booking, admin config và các API test |
| E2E/UI | Playwright UI mock và real backend báo cáo riêng |
| Phi chức năng | CSRF/rate-limit, private media, lock order/concurrency; performance baseline mới |

Danh sách Unit được duy trì tại `backend/src/__tests__/unit-suite-paths.ts`, dùng chung cho standalone config và guard cleanup của full suite. Chỉ các đường dẫn thuần đã review được bỏ hook DB; đường dẫn không biết vẫn dọn DB. Đây là thay đổi test infrastructure, không giảm bcrypt cost hoặc thay logic production.

## 2. Coverage manifest

Cấu hình thực thi duy nhất: `backend/vitest.config.ts`.

- Bao gồm mọi file `.ts` trong layers services/repositories/controllers/routes/validation của booking, matchmaking, match, tournaments, auth, payments/payment và wallet; kèm auth/CSRF/rate-limit middleware khớp glob.
- Bao gồm file chưa được import khi test; chỉ loại file `*.test.ts` trong glob này. Đây là phạm vi cố định cho phép đo, không loại file theo mức coverage.
- Hỗ trợ facility/owner và các module khác vẫn có test trong full suite nhưng chưa nằm trong phép đo cốt lõi này. Cần đối chiếu cam kết giảng viên nếu muốn tính cả các module hỗ trợ khác vào mẫu số.
- Báo cáo V8: text, HTML, JSON summary, LCOV. Gate line coverage tổng ≥70%; không áp đặt branch ≥70% như yêu cầu rubric.
- Provider `@vitest/coverage-v8` đồng phiên bản với Vitest (hiện 5.1.2 sau security maintenance; baseline đầu dùng 5.0.2); package lock giữ phiên bản tái tạo.

## 3. Manifest chạy

Chạy các suite ghi DB nối tiếp, không đồng thời reset cùng database.

| Suite | Lệnh từ repository root | Ghi chú |
| --- | --- | --- |
| Unit độc lập | `npm run test:unit --prefix backend` | Không DB |
| Backend + coverage | `npm run test:coverage --prefix backend` | DB test cổng 5433; test auth và payment MOCK |
| UI mock | `npm run test:e2e --prefix frontend -- --config playwright.sign-in.config.ts` | Vite 5197; `*-ui.spec.ts`; không backend |
| E2E mặc định | `npm run test:e2e --prefix frontend` | Backend 3000, Vite 5173; bao gồm UI và real specs, trừ tournament-live |
| Auth/booking/payment/split bill/rating/admin finance thật | `npm run test:e2e --prefix frontend -- --config playwright.core.config.ts` | Backend 3195, Vite 5195; tập tập trung, không thay toàn bộ manifest |
| Spec còn lại (mock + real) | `npm run test:e2e --prefix frontend -- --config playwright.remaining.config.ts` | 83 ca/21 file; loại các file đã chạy ở UI/core và tournament; cùng cổng 3195/5195 |
| Tournament thật | `npm run test:e2e:tournament --prefix frontend` | Backend 3193, Vite 5193; chạy sau suite khác có reset DB |
| Hiệu năng baseline | `npm test --prefix backend -- performance-baseline.test.ts` | 5 warm-up + 50 request/endpoint, concurrency 5; dataset nhỏ, chưa có latency SLA cho search/availability; messaging đo ≤2 giây theo metrics.md |

Các config chuyên biệt còn lại kiểm kê bằng `rg --files frontend -g 'playwright*.config.ts'`; config lọc lại cùng spec không được tính thành test case mới. Các file demo không mặc nhiên là UAT, vì chưa có người nghiệm thu.

## 4. Lưu kết quả

Tất cả kết quả đợt này đặt dưới `docs/reports/testing/`; file máy sinh nằm trong `artifacts/` đã ignore Git. Không commit log/trace/screenshot collections. CI lưu artifact 90 ngày; trước bảo vệ cần xuất bản sao nếu quá thời hạn hoặc repository private chưa cấp quyền.

Local kết quả thuộc working tree dựa trên SHA ghi trong báo cáo, chưa phải commit mới đã publish. Không dùng SHA gốc để nói rằng CI đã kiểm chứng các thay đổi chưa commit.

## 5. Bổ sung phạm vi validation trong đợt chạy local

Lần full backend đầu khởi động trước khi bổ sung glob cho sáu file validation dạng phẳng. Vì vậy `coverage/` của baseline chỉ đo các layer/glob ban đầu; `coverage-validation/` từ unit run đo riêng đủ sáu file, gồm cả file 0%. Script tổng hợp chỉ cộng khi hai tập file rời nhau; nếu trùng sẽ yêu cầu merge theo dòng thay vì cộng sai mẫu số. Báo cáo local tổng hợp phải ghi rõ hai phép đo. CI dùng cấu hình cuối sẽ đo toàn bộ phạm vi trong một lần chạy; chưa có CI cho working tree này.

## 6. Phạm vi thực thi toàn bộ frontend

Bốn cấu hình phân hoạch 74 spec hiện có: UI mock 44 file, core 8 file, remaining 21 file và tournament 1 file. Các spec trong remaining có cả mock contract và backend thật; không gộp tất cả thành real E2E. Số ca được lấy từ runtime report, không suy ra từ số file. Runner chạy nối tiếp đủ bốn tập; đây là bằng chứng local, chưa thay lần CI cuối.
