# Triage defect/security — TC2.5, ngày 28/11/2026

Trạng thái: đã hoàn tất triage và regression local sau bản vá; SEC-01 Closed, SEC-02/SEC-03 Moderate vẫn Open. Tracker trạng thái duy nhất là [defects.md](defects.md); [security-triage.csv](security-triage.csv) giữ chi tiết từng package/advisory, đường phụ thuộc, phiên bản và đánh giá áp dụng. Không tạo GitHub Issues hoặc commit/push trong đợt này.

## 1. Phạm vi và cách đánh giá

- Rà audit mới của cả backend và frontend, gồm dev và runtime; audit runtime backend được lưu riêng. Không dựa riêng vào scan cũ.
- Đối chiếu advisory gốc với cấu hình, middleware, npm scripts và đường gọi thư viện trong repository. Không suy ra một exploit đã tái hiện chỉ từ severity trên npm.
- Rà tracker, BUG-01/BUG-02 và INV-01/INV-02 trong [regression lịch sử](../../testing/e2e-merge-regression-report.md), backlog §4 của [kế hoạch frontend](../../architecture/plans/refactor_FE_add_lib/frontend-modernization-review-plan.md). Các mục UX/logic chưa tái hiện không tự được đóng hoặc đổi severity.
- [TC2.4](../Bao_Cao_Chat_Luong_Ma_Nguon_TC2_4.md) là bằng chứng phân tích tĩnh trước đó, không phải lần scan SAST mới trong đợt này. Không tuyên bố đã pentest toàn sản phẩm, kiểm tra hạ tầng triển khai hoặc rà GitHub Issues ngoài tracker cục bộ.
- `TRUST_PROXY` mặc định false trong schema/example. Khi bật, app tin một hop; việc chỉ cho phép đi qua proxy tin cậy cần được kiểm tra theo topology triển khai. Đợt này không kiểm tra hạ tầng hoặc đổi chính sách proxy; bản vá thư viện không tự chứng minh topology đúng.
- Dữ liệu retest dùng DB `badminton_test` riêng; thanh toán MOCK/sandbox. Không thay đổi API, nghiệp vụ, cấu hình trust proxy hoặc dữ liệu dev/production.

## 2. Audit trước và sau

| Phạm vi | Trước | Sau |
| --- | --- | --- |
| Backend, gồm dev | 18 package findings: 1 critical, 6 high, 11 moderate | 6 moderate, **0 high/critical** |
| Backend, bỏ dev | Chưa dùng làm baseline riêng | 2 moderate (ExcelJS/uuid), **0 high/critical** |
| Frontend, gồm dev | 2 high (Vite, source-map-js) | **0 findings** |

Các số là package findings theo npm audit; chuỗi phụ thuộc có thể kế thừa cùng một advisory. Sáu mục backend còn lại đến từ **hai advisory gốc**, không phải sáu lỗ hổng độc lập.

Minh chứng gốc: [backend trước](artifacts/security/backend-before.json), [backend sau](artifacts/security/backend-after.json), [backend runtime](artifacts/security/backend-runtime-after.json), [frontend trước](artifacts/security/frontend-before.json), [frontend sau](artifacts/security/frontend-after.json). Audit backend vẫn exit 1 vì Moderate; không báo audit hoàn toàn sạch.

## 3. Đánh giá áp dụng và bản sửa

| Nhóm | Đánh giá và xử lý |
| --- | --- |
| proxy-addr | App dùng `trust proxy = 1`, khác điều kiện subnet rộng/malformed trong [advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). Vẫn cập nhật 2.0.7 → **2.0.8**. Regression kiểm tra IPv4 không bị tin cậy bởi subnet IPv6 rộng và subnet mapped đúng vẫn hoạt động. |
| body-parser | `express.json()` và raw webhook parser chạy trước auth: bộ giải nén có đường vào runtime. Cập nhật 2.3.0 → **2.4.0** theo [advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828). Regression gửi đúng byte gzip, kiểm tra payload có byte thừa bị từ chối và server tiếp tục nhận request hợp lệ. Không tuyên bố đã gây crash trên phiên bản cũ. |
| Multer | Middleware upload hiện dùng filter đồng bộ mặc định; chưa tìm thấy điều kiện async fileFilter của [advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). Cập nhật phòng ngừa **2.4.0 → 2.5.0**; retest avatar/private media/message attachments, quyền download và file không hợp lệ. |
| Zod | Validation là đường runtime; giới hạn HTTP body không thay bản vá. Cập nhật **4.6.5 → 4.6.7**, nâng minimum trong package manifest. Regression mảng có `.max(2)` với 2.000 phần tử không hợp lệ chỉ tạo lỗi kích thước, không tích lũy lỗi từng phần tử. Nguồn: [advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). |
| Vite/source-map-js | Tooling dev/build có rủi ro riêng, không tự coi là an toàn vì không chạy production. Hai dự án resolve **Vite 8.4.0, source-map-js 1.2.4**; frontend minimum Vite 8.4.0. Retest build, UI và browser với backend thật. Nguồn: [Vite](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| Vitest/mocker/coverage | Không có browser mock-server mode trong config đang dùng, nhưng vẫn cập nhật đồng bộ **5.0.2 → 5.1.2**. Retest unit, coverage provider và API. Nguồn: [mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [Windows traversal](https://github.com/advisories/GHSA-xp26-3454-mjgp). Không tuyên bố đã chạy retest trên Windows. |
| brace-expansion | Nhánh 1.x cũ thuộc ts-node-dev → rimraf/glob/minimatch, production script dùng `node dist/index.js`. Lock cập nhật **1.1.18 → 1.1.22** trong constraint sẵn có. Nguồn: [advisory](https://github.com/advisories/GHSA-qhr7-859c-m2p7). |
| qs/ip-address | Cập nhật transitive tương thích **qs 6.16.0 → 6.17.1**, **ip-address 10.7.2 → 10.7.7**. Retest request/auth/rate limit; chưa chứng minh endpoint app gọi nhánh stringify comma của qs hoặc nhận tùy ý zone identifier. Nguồn: [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [ip-address](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5). |

Thay đổi nằm trong package manifest/lockfile; không thêm dependency ứng dụng mới, override xuyên major, downgrade Drizzle/ExcelJS hoặc chạy `npm audit fix --force`. Minimum phiên bản trực tiếp và quyết định maintenance đã ghi tại [tech-stack](../../architecture/tech-stack.md); shared-document PR review vẫn cần trước merge.

## 4. Hai nhóm Moderate giữ mở

### SEC-02 — Drizzle legacy loader / esbuild

- Bốn package findings: drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild 0.18.20.
- [Advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99) liên quan dev server `serve`. Installed core-utils dùng `transform`, `transformSync`, `version`; không có `serve/context` trong đường gọi đã rà, không thấy script mở esbuild serve.
- Công cụ migration không phải endpoint HTTP của ứng dụng; gate migration được chạy lại. Đây là kết luận giới hạn cho đường hiện hành, không phải chứng minh mọi cách dùng esbuild đều an toàn.
- **Open — Moderate / theo dõi upstream**, owner UNASSIGNED. Cần bản upstream tương thích hoặc đánh giá riêng trước khi thay loader. Rà lại nếu dùng Drizzle Studio/serve hoặc mở công cụ dev ra mạng. Không chấp nhận đề xuất audit downgrade phá vỡ chỉ để giảm số đếm.

### SEC-03 — ExcelJS / uuid

- Hai runtime package findings: exceljs 4.4.0 → uuid 8.3.2.
- [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) liên quan v3/v5/v6 khi truyền buffer/offset. Trong installed ExcelJS, `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js` gọi `v4()` không truyền buffer/offset; không tìm thấy đường app dùng API bị ảnh hưởng. Finance XLSX export được retest.
- **Open — Moderate / theo dõi upstream**, owner UNASSIGNED. Cần ExcelJS tương thích dùng uuid đã vá hoặc thử nghiệm migration riêng; không ép override uuid qua major mà chưa kiểm chứng. Rà lại nếu thêm UUID v3/v5/v6, buffer/offset hoặc thay thư viện export.

Hai mục trên không bị xóa khỏi audit, không đổi severity advisory và không được coi là nhóm đã ký chấp nhận rủi ro. Trạng thái Open/phần việc tiếp theo giữ tại tracker.

## 5. Regression và bằng chứng phiên bản

Bảng giữ riêng kết quả sau bản vá; không cộng các suite chồng lấp thành số case nghiệp vụ.

| Kiểm tra | Kết quả | Minh chứng |
| --- | --- | --- |
| Unit sau cập nhật | 232/232 pass | [JSON](artifacts/security/unit.json) |
| Unit + coverage provider mới | 232/232 pass; validation 73,97% (không phải core coverage mới) | [Log](artifacts/security/unit-coverage.log) |
| API/DB và security dependency regression | 150/150 pass trong 14 file, gồm 4 ca security mới; 0 fail/skip; 379,45 giây | [Log](artifacts/security/backend-regression.log) |
| UI dashboard/sign-in | 40/40 pass; 0 skip/fail/flaky | [JSON](artifacts/security/ui-regression.json) |
| Core browser/backend thật | 15/15 pass, 0 skip/fail/flaky | [JSON](artifacts/security/system-regression.json) |
| Admin dashboard backend thật | 1/1 pass, 0 skip/fail/flaky | [JSON](artifacts/security/admin-dashboard-real.json) |
| Backend/frontend build | Pass | [Backend](artifacts/security/backend-build.log), [frontend](artifacts/security/frontend-build.log) |
| Frontend lint/check:ui | Exit 0, vẫn có warning có sẵn | [Log](artifacts/security/frontend-lint.log) |
| Migration/schema | Pass: 45 migrations, no schema diff | [Log](artifacts/security/migrations.log) |

Test mới: [security-dependency-regression.test.ts](../../../backend/src/__tests__/security-dependency-regression.test.ts). Đây là 4 ca regression kỹ thuật; không tự cộng vào tử số case nghiệp vụ để tăng tỷ lệ automation. Inventory sau bổ sung: 190 file, 1.417 khai báo tĩnh (116 backend, 74 frontend).

Các report full backend 1.187/1.187, frontend 618/618 và coverage 88,90% trước đợt maintenance vẫn là bằng chứng lịch sử. Chúng không chứng minh toàn bộ dependency graph mới đã chạy full CI. Không ghi đè artifacts cũ; đợt này lưu riêng dưới `artifacts/security/`.

## 6. Kết luận và việc phải lặp lại trước bảo vệ

**Kết luận tại đợt rà 28/11/2026: không còn defect Critical/Blocker đã xác nhận đang mở trong tracker/backlog repository đã rà.** SEC-01 đóng sau patch và retest; các regression lịch sử đã retest trong giới hạn kịch bản. Audit có 0 Critical/High ở cả hai dự án, nhưng backend vẫn còn 6 Moderate thuộc SEC-02/SEC-03.

Kết luận dựa đồng thời trên triage đường gọi, bản sửa, review backlog và regression; không chỉ từ số đếm audit. Đây không phải bảo đảm toàn hệ thống không có lỗ hổng, pentest hạ tầng, CI cuối hoặc xác nhận tình trạng vào ngày bảo vệ. Các mục UX/logic trong backlog frontend chưa tái hiện vẫn giữ trạng thái nguồn, không được tự đóng. Người review nhóm chưa được chỉ định.

Vòng đời SEC-01: Open (audit trước) → In progress (đối chiếu advisory/source) → Fixed (package/lock patch) → Retest (150 API/DB, 232 unit, 40 UI, 15 core, 1 dashboard real) → Closed. Các suite có thể chồng lấp nên không cộng thành số case nghiệp vụ. Bằng chứng phiên bản và diff tại [manifest](artifacts/security/manifest.json), [diff riêng đợt này](artifacts/security/dependency-changes.patch), [kết quả tổng hợp](artifacts/security/summary.json). SHA nền là base của working tree, không phải commit mới đã kiểm chứng bởi CI.

Có thể tái tạo audit bằng `npm audit --json --prefix backend`, `npm audit --omit=dev --json --prefix backend`, `npm audit --json --prefix frontend`. Lệnh audit backend exit 1 vì Moderate là kết quả cần lưu, không bỏ qua bằng cách tuyên bố audit sạch. Lệnh retest và exit code thực tế được ghi trong summary/manifest; toàn bộ raw output đặt riêng trong thư mục security.

- Giữ SEC-02/SEC-03 mở và phân công người theo dõi upstream; nếu phát hiện đường khai thác mới thì triage lại tác động thực tế.
- Chạy full gate CI trên SHA cuối sau review/commit theo yêu cầu riêng; giữ artifact, package/lock hash và link workflow.
- Audit và review backlog lại trước bảo vệ, sau khi đổi dependencies/cấu hình proxy/upload/export hoặc sau advisory mới. Chỉ tiếp tục xác nhận 0 Critical/Blocker khi có bằng chứng tương ứng.
