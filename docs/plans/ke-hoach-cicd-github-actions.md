# Kế hoạch CI/CD — GitHub Actions (Giai đoạn 1: CI only)

| Trường | Giá trị |
| --- | --- |
| Trạng thái | **CI đã xanh trên `develop`; đã chốt baseline (CI-03). Chờ merge lên `main`, chạy E2E tay (CI-05), review tài liệu (CI-06) và bật branch protection (CI-07)** |
| Ngày lập | 2026-11-23 |
| Phạm vi | CI cho PR và push `develop`/`main`; E2E chạy nightly trên default branch (`main`) |
| Ngoài phạm vi | CD/deploy, Docker production, secrets production, SAST/dependency scanning |
| Tài liệu liên quan | [`docs/architecture/tech-stack.md`](../architecture/tech-stack.md), [`docs/architecture/conventions.md`](../architecture/conventions.md), [`.agents/AGENTS.md`](../../.agents/AGENTS.md) |

> **Lưu ý về thẩm quyền tài liệu:** `docs/architecture/tech-stack.md` hiện ghi
> Deployment/CI-CD là **TBD** (mục “Deployment-Related Decisions” và
> “Technical Decisions That Remain TBD”). Kế hoạch này chỉ đề xuất CI; việc
> chốt CI platform và cập nhật `tech-stack.md` phải được con người xác nhận và
> đi qua PR có review của thành viên còn lại (AGENTS §10). Tài liệu này **không**
> tự động biến quyết định TBD thành CONFIRMED.

---

## 1. Mục tiêu

1. Tự động phát hiện lỗi biên dịch, lint, migration và test backend ngay trên PR.
2. Tự động phát hiện lỗi type-check/build/lint frontend ngay trên PR.
3. Chạy Playwright E2E định kỳ (nightly) để bắt lỗi luồng nghiệp vụ quan trọng.
4. Bảo vệ nhánh `main` và `develop` bằng required status checks.
5. Giữ thay đổi **tối thiểu**: không sửa code ứng dụng, không đổi API, không đổi
   test logic, không thêm dependency runtime.
6. Giữ repository sạch: không commit report/log/artifact sinh ra khi chạy CI.

## 2. Quyết định đã được người dùng chốt (2026-11-23)

| Hạng mục | Quyết định |
| --- | --- |
| Phạm vi đợt này | **Chỉ CI**, chưa deploy |
| Deployment | Chưa cần; vẫn là **TBD** trong `tech-stack.md` |
| Mục tiêu chất lượng | Đảm bảo một phần chất lượng code và nghiệp vụ |
| PR | Unit/integration backend + lint/build frontend |
| E2E | Nightly; PR **không** chạy E2E |
| CI platform | GitHub Actions (repo đã nằm trên GitHub) |
| Nhánh | Quy trình `feature → develop → main`. `develop` là nhánh tích hợp; `main` đã tồn tại và là default branch của repo (`origin/HEAD`) |

> **Hiệu chỉnh 2026-11-23 (sau khi đối chiếu repo):** bản nháp đầu ghi sai rằng
> repo chưa có `main`. Thực tế `origin/main` tồn tại (merge PR #25 `develop → main`).
> Các điều chỉnh về trigger push, branch protection và nightly bên dưới là kết
> quả của việc sửa nhận định này. Người dùng đã đồng ý áp dụng các đề xuất ở §15;
> riêng reviewer cho `tech-stack.md` (§15 mục 6) vẫn mở.

## 3. Hiện trạng kỹ thuật (bằng chứng)

### 3.1. Repository

- Remote: `git@github.com:tahnhuy/badminton-platform.git`.
- Nhánh `main` đã tồn tại và đồng bộ với `origin/main`; `origin/HEAD` trỏ tới
  `main` (default branch). `origin/develop` là nhánh tích hợp. `main` hiện là
  `develop` cộng một merge commit (PR #25).
- Cả `main` lẫn `develop` đều **chưa có** thư mục `.github/`, workflow,
  Dockerfile hay cấu hình CI/CD.
- Lockfile tồn tại ở cả 3 cấp:
  - `package-lock.json` (root, chỉ có `concurrently`)
  - `backend/package-lock.json`
  - `frontend/package-lock.json`
- Không dùng npm workspace; mỗi thư mục cài dependency riêng.

### 3.2. Backend

| Hạng mục | Hiện trạng | Nguồn |
| --- | --- | --- |
| Runtime | Node.js, TypeScript | `backend/package.json` |
| Build | `tsc` → `dist/` | `backend/package.json` (`build`) |
| Test | Vitest, **82 file** `*.test.ts` | `backend/package.json`, `backend/src` |
| Test config | `environment: node`, `fileParallelism: false`, `testTimeout: 30000` | `backend/vitest.config.ts` |
| Test DB | `postgres://...@localhost:5433/badminton_test` | `backend/vitest.config.ts`, `backend/src/__tests__/test-db.ts` |
| DB admin | `postgres://...@localhost:5433/badminton_db` | `backend/src/__tests__/test-db.ts` |
| Tạo test DB | `globalSetup` gọi `ensureTestDatabase()` rồi chạy migration | `backend/src/__tests__/global-setup.ts` |
| Env bắt buộc | `DATABASE_URL`, `PASSWORD_PEPPER` (base64 ≥ 32 bytes), `PRIVATE_UPLOADS_DIR` | `backend/src/shared/config/env.ts` |
| Private uploads khi test | Vitest tự tạo thư mục tạm | `backend/vitest.config.ts` |
| Migration check | `verify:migrations` kiểm tra journal/SQL bằng `drizzle-kit` | `backend/package.json`, `backend/scripts/verify-migrations.mjs` |
| Migration runner | Advisory lock, checksum, bảng `custom_migration_history` | `backend/src/db/migrate.ts` |
| Số migration hiện tại | 33 file `.sql` (`verify:migrations` báo "33 migrations", mới nhất `0032_player_skill_surveys`) | `backend/src/db/migrations` |

**Điểm quan trọng:** `PASSWORD_PEPPER` không được set trong `vitest.config.ts`.
Local lấy từ `backend/.env`; trên CI **bắt buộc** truyền biến môi trường này,
nếu không `env.ts` sẽ `process.exit(1)` ngay khi import.

**Rủi ro thời gian:** 82 file test chạy tuần tự (`fileParallelism: false`) vì
dùng chung một test DB. Cần đo baseline ở lần chạy đầu; chưa bật sharding để
tránh phải tách nhiều DB.

**Baseline CI-03 (2026-11-23, run
[45140460178](https://github.com/tahnhuy/badminton-platform/actions/runs/45140460178),
push `develop`, kết quả **success**):**

| Job | Thời gian | Ghi chú |
| --- | --- | --- |
| backend | **11m06s** (08:40:04 → 08:51:10 UTC) | test step 10m34s; build 2s; verify migrations < 1s |
| frontend | **31s** | install 8s; lint 1s; build 12s |

Ghi chú: số đo cục bộ trước đó (>27 phút trên máy đang chạy tiến trình khác)
không phản ánh runner GitHub. Vì vậy `timeout-minutes` của job backend được hạ
từ 60 xuống **30 phút** (margin ~2,7x so với baseline) để fail sớm khi treo mà
vẫn đủ dư cho lần chạy chậm. Frontend giữ **15 phút** (margin rất lớn). Không
tối ưu `cleanTestDatabase()` trong đợt này vì đổi hạ tầng test.

### 3.3. Frontend

| Hạng mục | Hiện trạng | Nguồn |
| --- | --- | --- |
| Build | `tsc -b && vite build` | `frontend/package.json` |
| Lint | `oxlint && node scripts/check-ui.mjs` | `frontend/package.json` |
| UI guard | Đọc `ui-check.config.json`, chặn CSS/hex/inline style ngoài quy ước DS01 | `frontend/scripts/check-ui.mjs` |
| E2E | Playwright, **54 file** `*.spec.ts` trong `frontend/e2e` (63 file nếu tính cả helper, mock và fixture) | `frontend/playwright.config.ts` |
| E2E browser | `channel: 'chrome'` | `frontend/playwright.config.ts` |
| E2E web server | Backend `npm run start:e2e --prefix ../backend` (port 3000) + Vite (port 5173) | `frontend/playwright.config.ts` |
| E2E DB | `badminton_test` tại port 5433 | `backend/src/__tests__/e2e-env.ts` |
| E2E env | Tự set `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `PORT`, `COOKIE_SECURE`, `ALLOW_TEST_AUTH`, `PAYMENT_PROVIDER`, `REFUND_ENABLED`, `PRIVATE_UPLOADS_DIR` | `backend/src/__tests__/e2e-env.ts` |

**Điểm quan trọng:** `e2e-server.ts` truy vấn `pool` (DB `badminton_test`)
**trước khi** gọi `ensureTestDatabase()`. Vì vậy trên CI (DB hoàn toàn mới),
workflow E2E phải **tạo trước** database `badminton_test`; chỉ tạo `badminton_db`
bằng service Postgres là chưa đủ.

**Lưu ý:** `frontend/e2e/tmp-courts-visual.spec.ts` đang được git theo dõi, chỉ
chụp ảnh ra `/tmp` và không có assertion. Playwright sẽ chạy file này trong
nightly. Không xóa/loại trừ trong đợt này (không đổi test); đã ghi backlog ở
§16 (quyết định §15 mục 8).

### 3.4. Runtime

| Hạng mục | Giá trị |
| --- | --- |
| Node local | v24.21.0 |
| npm local | 11.19.0 |
| Yêu cầu Vite 8 | `^20.19.0 || >=22.12.0` (README) |
| Đề xuất CI | Node **22** (LTS, thỏa yêu cầu Vite 8, khớp `@types/node@22` backend) |

## 4. Nguyên tắc thiết kế CI

1. **Không đổi code ứng dụng.** Chỉ thêm file workflow và cập nhật tài liệu.
2. **Không dùng secret production.** CI chỉ dùng pepper test cố định, công khai
   trong workflow và ghi rõ “test-only”.
3. **DB service cố định đúng port 5433** để khớp URL hardcode trong test.
4. **Tách job backend/frontend** để chạy song song và chỉ ra lỗi rõ ràng.
5. **E2E tách workflow** vì chậm và cần Chrome.
6. **Không lưu artifact vào repo.** Report/trance đẩy lên GitHub Artifacts với
   retention ngắn.
7. **Fail fast, timeout rõ ràng.** Tránh job treo tiêu tốn phút.
8. **Concurrency cancel-in-progress** cho CI để hủy run cũ khi push tiếp.

## 5. Kiến trúc workflow

```
PR mở/cập nhật      ──► ci.yml
push develop, main  ──► ci.yml
workflow_dispatch   ──► ci.yml

schedule (nightly)  ──► e2e-nightly.yml   (chỉ chạy khi file có trên default branch `main`)
workflow_dispatch   ──► e2e-nightly.yml   (chỉ hiện trên UI khi file có trên default branch)

ci.yml
├── job backend   (Postgres 16 service, Node 22)
│   1. npm ci
│   2. npm run verify:migrations
│   3. npm run build (tsc)
│   4. npm test (Vitest + Supertest, DB thật)
└── job frontend  (Node 22)
    1. npm ci
    2. npm run lint (oxlint + check:ui)
    3. npm run build (tsc -b + vite build)

e2e-nightly.yml
└── job e2e       (Postgres 16 service, Node 22, Chrome)
    1. npm ci (backend + frontend)
    2. tạo database badminton_test
    3. npx playwright install --with-deps chrome
    4. npm run test:e2e -- --reporter=list,html --trace=retain-on-failure
    5. upload artifact khi fail
```

## 6. Chi tiết `ci.yml`

### 6.1. Trigger và cấu hình chung

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop, main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'
```

> Không dùng `${{ env.PASSWORD_PEPPER }}` ở cấp job: GitHub Actions **không**
> cho phép context `env` tham chiếu chính nó trong `jobs.<job_id>.env`. Vì vậy
> pepper test được khai báo trực tiếp trong `env` của từng job (xem bên dưới).

Ghi chú:

- `pull_request` không lọc nhánh để mọi PR (kể cả PR vào nhánh feature) đều được
  kiểm tra; nếu muốn tiết kiệm phút, có thể giới hạn `branches: [develop, main]`.
- `push.branches: [develop, main]` giúp commit merge vào cả hai nhánh đều được
  kiểm tra, khớp quy trình `feature → develop → main`.
- `concurrency` dùng `github.ref` nên push mới vào `develop` chỉ hủy run cũ của
  `develop`, không ảnh hưởng run của `main`.
- Có thể thêm `paths-ignore` cho `docs/**`, `**/*.md` sau khi pipeline ổn định.
  Khuyến nghị **chưa** thêm ở lần đầu để tránh bỏ sót thay đổi cấu hình.
- `permissions: contents: read` là mức tối thiểu; không workflow nào cần ghi repo.

### 6.2. Job `backend`

```yaml
jobs:
  backend:
    name: backend
    runs-on: ubuntu-latest
    timeout-minutes: 30 # baseline 2026-11-23: 11m06s; giữ margin ~2,7x

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: badminton_user
          POSTGRES_PASSWORD: badminton_password
          POSTGRES_DB: badminton_db
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U badminton_user -d badminton_db"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      NODE_ENV: test
      DATABASE_URL: postgres://badminton_user:badminton_password@localhost:5433/badminton_test
      DIRECT_URL: postgres://badminton_user:badminton_password@localhost:5433/badminton_test
      # Pepper CHỈ dùng cho test/CI. Không phải secret production.
      # Base64 giải mã đúng 32 byte; có thể thay bằng giá trị test cố định khác.
      PASSWORD_PEPPER: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Verify migrations
        working-directory: backend
        run: npm run verify:migrations

      - name: Type-check / build
        working-directory: backend
        run: npm run build

      - name: Run unit/integration tests
        working-directory: backend
        run: npm test
```

Giải thích luồng DB:

1. Service Postgres tạo sẵn database `badminton_db` (dùng làm admin connection).
2. `vitest` `globalSetup` kết nối `badminton_db`, tạo `badminton_test` nếu chưa có,
   sau đó chạy toàn bộ migration lên `badminton_test`.
3. Test cleanup chỉ truncate khi `current_database() = 'badminton_test'`
   (đã có guard trong `test-db.ts`).

Vì sao đặt `DIRECT_URL` dù test truyền URL trực tiếp: một số đoạn migration có thể
đọc `DIRECT_URL` khi không truyền override; đặt sẵn để tránh phụ thuộc file `.env`.

### 6.3. Job `frontend`

```yaml
  frontend:
    name: frontend
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint (oxlint + design-system guard)
        working-directory: frontend
        run: npm run lint

      - name: Type-check / build
        working-directory: frontend
        run: npm run build
```

`npm run lint` đã bao gồm `check:ui`; **không** tách riêng để tránh lệch cấu hình
với local. `npm run build` đã bao gồm `tsc -b`.

## 7. Chi tiết `e2e-nightly.yml`

### 7.1. Trigger

```yaml
name: E2E Nightly

on:
  schedule:
    # 19:00 UTC = 02:00 sáng giờ Việt Nam (UTC+7), tránh giờ làm việc.
    - cron: '0 19 * * *'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: e2e-nightly
  cancel-in-progress: false

env:
  NODE_VERSION: '22'
  CI: 'true'
```

`cancel-in-progress: false` để không hủy run nightly đang chạy nếu có dispatch
thủ công trùng lúc.

**Ràng buộc về default branch (`main`):**

- Workflow `schedule` chỉ chạy khi file `e2e-nightly.yml` nằm trên default
  branch, và luôn dùng commit mới nhất của default branch. File chỉ có trên
  `develop` thì lịch nightly **không chạy**; nút "Run workflow" cũng chỉ hiện
  khi file có trên default branch.
- Bước `actions/checkout` không chỉ định `ref`, nên nightly kiểm tra `main`,
  không phải `develop`. Muốn kiểm tra `develop`, phải thêm `ref: develop`
  (hoặc tạo workflow riêng). Quyết định hiện tại (§15 mục 7): chỉ kiểm tra
  `main`; ghi backlog ở §16.
- `workflow_dispatch` chạy trên nhánh được chọn ở ô "Use workflow from", nên có
  thể chạy tay E2E trên `develop` khi file workflow đã có trên nhánh đó.
- Hệ quả cho triển khai: `e2e-nightly.yml` phải được merge vào `main` thì
  nightly mới hoạt động (xem CI-02, CI-05).

### 7.2. Job `e2e`

```yaml
jobs:
  e2e:
    name: e2e
    runs-on: ubuntu-latest
    timeout-minutes: 45

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: badminton_user
          POSTGRES_PASSWORD: badminton_password
          POSTGRES_DB: badminton_db
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U badminton_user -d badminton_db"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      # Pepper test-only; xem ghi chú ở mục 6.1.
      PASSWORD_PEPPER: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install backend dependencies
        working-directory: backend
        run: npm ci

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Ensure test database exists
        working-directory: backend
        run: |
          node -e '
          const { Client } = require("pg");
          (async () => {
            const client = new Client({
              connectionString: "postgres://badminton_user:badminton_password@localhost:5433/badminton_db",
            });
            await client.connect();
            const result = await client.query(
              "SELECT 1 FROM pg_database WHERE datname = $1",
              ["badminton_test"],
            );
            if (result.rowCount === 0) {
              await client.query("CREATE DATABASE badminton_test");
              console.log("Created badminton_test");
            } else {
              console.log("badminton_test already exists");
            }
            await client.end();
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
          '

      - name: Install Chrome for Playwright
        working-directory: frontend
        run: npx playwright install --with-deps chrome

      - name: Run Playwright E2E
        working-directory: frontend
        run: npm run test:e2e -- --reporter=list,html --trace=retain-on-failure

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            frontend/playwright-report
            frontend/test-results
          retention-days: 7
          if-no-files-found: ignore
```

Giải thích các điểm dễ sai:

1. **Tạo `badminton_test` trước khi chạy E2E** vì `e2e-server.ts` query DB trước
   `ensureTestDatabase()`. Không có bước này, lần chạy đầu trên CI sẽ fail.
2. **Không sửa `playwright.config.ts`**: vẫn dùng `channel: 'chrome'`; CI cài
   Chrome qua `playwright install chrome`. Reporter/trace được override bằng CLI
   nên local không đổi hành vi.
3. **`CI=true`** làm `reuseExistingServer: false` (đã là mặc định khi có biến CI),
   đảm bảo backend/frontend do Playwright tự khởi động.
4. **Backend chạy bằng `tsx`** (`start:e2e`), không cần `npm run build` trước.
5. **Artifact chỉ upload khi fail** để tránh lưu report mỗi đêm.

## 8. Biến môi trường và secret

| Biến | Dùng ở | Giá trị | Loại |
| --- | --- | --- | --- |
| `NODE_VERSION` | cả hai workflow | `22` | Workflow env |
| `PASSWORD_PEPPER` | cả hai job | Base64 giải mã 32 byte, test-only | Job env (không phải secret) |
| `DATABASE_URL` | backend job | `.../badminton_test` | Workflow env |
| `DIRECT_URL` | backend job | `.../badminton_test` | Workflow env |
| `CI` | E2E | `true` | Workflow env |
| `POSTGRES_*` | service | user/password/db test | Service env |

Không cần GitHub Secrets cho giai đoạn này. **Không** đưa bất kỳ biến production
nào (`SEPAY_*`, `VNPAY_*`, pepper thật, DB production) vào workflow CI.

Nếu team muốn tránh literal trong file, có thể chuyển pepper test sang
**Actions Variable** (Settings → Secrets and variables → Actions → Variables):
`PASSWORD_PEPPER: ${{ vars.CI_TEST_PASSWORD_PEPPER }}`. Khi đó cần cấu hình biến
ở cấp repository trước khi workflow chạy.

## 9. Bảo vệ nhánh và quy trình review

### 9.1. Branch protection cho `main` và `develop`

Sau khi pipeline xanh ổn định, áp dụng cho **từng** nhánh `main` và `develop`
(`main` là default branch, nhận merge từ `develop`):

1. Settings → Branches → Add branch protection rule.
2. Branch name pattern: `main`, sau đó lặp lại với `develop`.
3. Bật:
   - **Require a pull request before merging**.
   - **Require status checks to pass before merging**.
   - Chọn required checks: `backend`, `frontend`.
   - **Require branches to be up to date before merging** (khuyến nghị).
4. Không bật “Include administrators” nếu team cần hotfix khẩn cấp; quyết định
   theo quy trình của nhóm.

Tên required check là **tên job** (`name: backend`, `name: frontend`), không phải
tên workflow. Nếu đổi tên job sau này, phải cập nhật branch protection.

### 9.2. Nhánh `main` và production

`main` đã tồn tại và là default branch; `ci.yml` chạy trên push vào cả `develop`
và `main`. Việc `main` có phải nhánh production hay không chưa được chốt
(Deployment vẫn TBD). Kế hoạch này **không** thêm job deploy và **không** coi
`main` là môi trường production.

## 10. Tài liệu cần cập nhật

Theo no-doc-debt rule và AGENTS §10, sau khi con người chốt CI platform:

| Tài liệu | Thay đổi đề xuất |
| --- | --- |
| `docs/architecture/tech-stack.md` | Thêm dòng “CI” = GitHub Actions (unit/integration trên PR, E2E nightly); **giữ Deployment = TBD**; ghi changelog ngày chốt và người duyệt |
| `README.md` (tùy chọn) | Badge CI + 3 lệnh kiểm tra local tương đương pipeline |

Quy trình:

1. Tạo PR riêng cho thay đổi `tech-stack.md` (shared document).
2. Thành viên còn lại review trước khi merge.
3. Không mark tài liệu là READY nếu chưa có xác nhận của con người.

## 11. Kế hoạch triển khai chi tiết

| ID | Việc cần làm | File | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| CI-01 | Tạo workflow CI | `.github/workflows/ci.yml` | YAML hợp lệ; job backend/frontend định nghĩa đủ |
| CI-02 | Tạo workflow E2E nightly | `.github/workflows/e2e-nightly.yml` | Cron + dispatch; có bước tạo test DB |
| CI-03 | Đo baseline trên PR nháp | PR vào `develop` | **DONE 2026-11-23**: run 45140460178 xanh; backend 11m06s, frontend 31s; hạ timeout backend 60→30 |
| CI-04 | Xử lý flaky/timeout nếu có | workflow hoặc ghi backlog | Không giảm phạm vi test; ghi rõ nguyên nhân |
| CI-05 | Chạy tay E2E nightly | Actions → Run workflow (cần `e2e-nightly.yml` đã có trên `main`) | E2E xanh; artifact xuất hiện khi cố tình fail |
| CI-06 | Cập nhật tài liệu | `tech-stack.md`, `README.md` | PR tài liệu được review, merge |
| CI-07 | Bật branch protection | GitHub Settings | `backend`, `frontend` là required checks trên `main` và `develop` |
| CI-08 | Tổng kết | PR/issue | Ghi run URL, thời gian, quyết định |

Thứ tự thực hiện: **CI-01 → CI-03 → CI-02 → CI-05 → CI-06 → CI-07 → CI-08**.
CI-04 chèn vào bất kỳ lúc nào phát hiện bất ổn.

## 12. Tiêu chí nghiệm thu (Definition of Done)

- [ ] PR bất kỳ vào repo kích hoạt `ci.yml`.
- [ ] Push vào `develop` và `main` kích hoạt `ci.yml`.
- [ ] Job `backend` xanh: `verify:migrations`, `build`, `test` đều pass.
- [ ] Job `frontend` xanh: `lint` (gồm `check:ui`), `build` pass.
- [ ] E2E nightly chạy được bằng `workflow_dispatch` và theo lịch.
- [ ] Khi E2E fail, artifact `playwright-report` được upload.
- [ ] Không có file artifact/report bị commit vào repo.
- [ ] `main` và `develop` yêu cầu `backend` + `frontend` trước khi merge.
- [ ] `e2e-nightly.yml` có trên `main` (default branch); lịch nightly chạy được.
- [ ] `tech-stack.md` cập nhật qua PR có review, Deployment vẫn TBD.
- [ ] Không thay đổi code ứng dụng/API/test logic.

## 13. Kiểm chứng tại chỗ (local dry-run)

Trước khi push, chạy các lệnh tương đương để biết trước kết quả:

```bash
# Backend (cần Postgres đang chạy theo docker-compose)
cd backend
npm ci
npm run verify:migrations
npm run build
PASSWORD_PEPPER='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
DATABASE_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_test' \
DIRECT_URL='postgres://badminton_user:badminton_password@localhost:5433/badminton_test' \
npm test

# Frontend
cd ../frontend
npm ci
npm run lint
npm run build

# E2E (chạy tay, dùng DB test)
cd ../frontend
npm run test:e2e
```

Lưu ý: test backend sẽ truncate dữ liệu trong `badminton_test`; **không** chạy
nhầm với `badminton_db` và **không** seed lại dữ liệu dev để “làm xanh” CI.

Kiểm tra cú pháp YAML trước khi push (tùy chọn):

```bash
# Nếu có actionlint
actionlint .github/workflows/*.yml
```

## 14. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp |
| --- | --- | --- |
| Thiếu `PASSWORD_PEPPER` làm backend exit ngay | Cao | Set `PASSWORD_PEPPER` ở cấp job; đã ghi trong workflow |
| DB test chưa tồn tại ở E2E CI | Cao | Bước “Ensure test database exists” chạy trước E2E |
| Sai port DB (5433 hardcode) | Cao | Service map `5433:5432`, không đổi test code |
| Test backend chạy lâu do tuần tự | Trung bình | Baseline CI 11m06s (§3.2); timeout 30 phút (margin ~2,7x); chỉ shard khi tách DB |
| Playwright `channel: chrome` thiếu browser | Trung bình | `playwright install --with-deps chrome` |
| Flaky test làm đỏ PR | Trung bình | Ghi nhận test/file; không giảm phạm vi; retry có kiểm soát nếu được duyệt |
| Tốn phút Actions | Thấp | `concurrency` cancel; cache npm; E2E chỉ nightly |
| Lộ secret | Thấp | Chỉ dùng pepper test; không dùng biến production; không in env |
| Workflow lỗi thời khi lên Node mới | Thấp | `NODE_VERSION` tập trung một chỗ; nâng sau khi kiểm tra Vite/TS |
| Deploy bị hiểu nhầm là đã có | Thấp | Tài liệu ghi rõ Deployment vẫn TBD; không có job deploy |

## 15. Quyết định cho các câu hỏi mở

Người dùng yêu cầu áp dụng các đề xuất của mục này (2026-11-23). Các mục 4, 8, 9
trước đó chưa có đề xuất; đề xuất được bổ sung và áp dụng cùng đợt. Chỉ mục 6
vẫn mở vì cần người cụ thể.

| # | Câu hỏi | Quyết định (theo đề xuất) | Áp dụng ở |
| --- | --- | --- | --- |
| 1 | Node version | Cố định Node **22**, không dùng ma trận 22 + 24. Giảm thời gian chạy và khớp `@types/node@22` của backend. Mọi dependency chính (Vite 8, Vitest 5, oxlint) đều chấp nhận Node ≥ 22.12 | §3.4, `NODE_VERSION` ở Phụ lục A/B |
| 2 | Phạm vi trigger | `pull_request` **mọi PR**, không lọc nhánh. `push` chạy trên `[develop, main]` | §6.1, Phụ lục A |
| 3 | Bỏ qua docs-only | **Chưa** thêm `paths-ignore`. Xem lại sau khi pipeline ổn định | §6.1 |
| 4 | Pepper test | Giữ **literal test-only** trong workflow. Không cần cấu hình repo trước khi chạy lần đầu, và giá trị không phải secret. Chuyển sang Actions Variable chỉ khi team muốn (đã mô tả ở §8) | §8, Phụ lục A/B |
| 5 | Pin action | Dùng tag **`@v4`** cho giai đoạn đầu. Cân nhắc pin SHA khi chuyển sang CD | Phụ lục A/B |
| 6 | Reviewer PR `tech-stack.md` | **Còn mở.** AGENTS §10 bắt buộc thành viên còn lại của nhóm review; cần con người chỉ định người cụ thể trước CI-06 | §10 |
| 7 | Nightly kiểm tra nhánh nào | **`main`** (default branch), không thêm `ref`. Cần kiểm tra `develop` thì chạy tay `workflow_dispatch` và chọn nhánh | §7.1 |
| 8 | Spec tạm `tmp-courts-visual.spec.ts` | **Giữ nguyên** trong đợt này vì xóa là đổi test, ngoài phạm vi CI. Ghi backlog để team dọn riêng | §3.3, §16 |
| 9 | `timeout-minutes` backend | Hạ còn **30 phút** theo baseline CI-03 (11m06s, margin ~2,7x). **Không** tối ưu `cleanTestDatabase()` trong đợt này vì đổi hạ tầng test. Ghi backlog | §3.2, §6.2, §16 |

## 16. Việc ngoài phạm vi (ghi backlog, không làm đợt này)

- CD/deploy lên VPS/PaaS, Dockerfile production, Nginx reverse proxy.
- Tự động chạy migration khi release.
- Quản lý secret production, rotation.
- SAST, dependency scanning, license scanning (`npm audit` mới chỉ nên chạy
  không chặn pipeline khi được duyệt).
- Coverage threshold, test sharding, test song song nhiều DB.
- Tối ưu thời gian chạy backend test, ví dụ `cleanTestDatabase()` chạy
  `TRUNCATE ... CASCADE` sau mỗi test (đổi hạ tầng test, cần review riêng).
- Dọn spec tạm `frontend/e2e/tmp-courts-visual.spec.ts` (không có assertion).
- Nightly cho `develop` (thêm `ref: develop` hoặc workflow riêng) nếu chạy tay
  không đủ.
- Pin GitHub Actions theo commit SHA khi chuyển sang CD.
- `paths-ignore` cho thay đổi chỉ có docs, sau khi pipeline ổn định.
- Thông báo Slack/Telegram khi pipeline fail.
- Release tagging/changelog tự động.

## 17. Nhật ký thay đổi

| Ngày | Thay đổi | Trạng thái |
| --- | --- | --- |
| 2026-11-23 | Lập kế hoạch CI-only theo lựa chọn của người dùng; xác định các điểm kỹ thuật DB/pepper/Chrome | DRAFT |
| 2026-11-23 | Đối chiếu với repo và sửa: (1) `main` đã tồn tại và là default branch, thêm `main` vào push trigger và branch protection; (2) nightly chỉ chạy khi workflow có trên default branch và kiểm tra `main`; (3) E2E có 54 file `*.spec.ts` (63 file tổng); (4) migration là 33 file, không phải 34; (5) timeout job backend nâng tạm lên 60 phút vì chạy thử cục bộ >27 phút chưa xong; (6) thêm câu hỏi mở về nightly/spec tạm/timeout | DRAFT |
| 2026-11-23 | Áp dụng các đề xuất ở §15: chuyển thành bảng quyết định; bổ sung đề xuất cho mục 4, 8, 9; thêm 4 việc vào backlog §16. Chỉ còn mục 6 (reviewer `tech-stack.md`) mở | DRAFT |
| 2026-11-23 | **CI-03 DONE**: run 45140460178 trên `develop` xanh; backend 11m06s (test 10m34s), frontend 31s. Hạ `timeout-minutes` backend 60→30; ghi baseline vào §3.2, §15 mục 9 | DRAFT |

## Phụ lục A — Nội dung đầy đủ của `.github/workflows/ci.yml`

> Đây là bản tham chiếu đầy đủ, có thể copy vào repo khi triển khai CI-01.
> Ghi chú: `PASSWORD_PEPPER` là giá trị **test-only**, không phải secret.

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop, main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  backend:
    name: backend
    runs-on: ubuntu-latest
    timeout-minutes: 30 # baseline 2026-11-23: 11m06s; giữ margin ~2,7x

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: badminton_user
          POSTGRES_PASSWORD: badminton_password
          POSTGRES_DB: badminton_db
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U badminton_user -d badminton_db"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      NODE_ENV: test
      DATABASE_URL: postgres://badminton_user:badminton_password@localhost:5433/badminton_test
      DIRECT_URL: postgres://badminton_user:badminton_password@localhost:5433/badminton_test
      # Pepper CHỈ dùng cho test/CI. Không phải secret production.
      PASSWORD_PEPPER: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Verify migrations
        working-directory: backend
        run: npm run verify:migrations

      - name: Type-check / build
        working-directory: backend
        run: npm run build

      - name: Run unit/integration tests
        working-directory: backend
        run: npm test

  frontend:
    name: frontend
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint (oxlint + design-system guard)
        working-directory: frontend
        run: npm run lint

      - name: Type-check / build
        working-directory: frontend
        run: npm run build
```

## Phụ lục B — Nội dung đầy đủ của `.github/workflows/e2e-nightly.yml`

> Đây là bản tham chiếu đầy đủ, có thể copy vào repo khi triển khai CI-02.
> Bước “Ensure test database exists” là **bắt buộc** trên CI mới vì
> `e2e-server.ts` query DB trước khi `ensureTestDatabase()` chạy.

```yaml
name: E2E Nightly

on:
  schedule:
    # 19:00 UTC = 02:00 sáng giờ Việt Nam (UTC+7).
    - cron: '0 19 * * *'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: e2e-nightly
  cancel-in-progress: false

env:
  NODE_VERSION: '22'
  CI: 'true'

jobs:
  e2e:
    name: e2e
    runs-on: ubuntu-latest
    timeout-minutes: 45

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: badminton_user
          POSTGRES_PASSWORD: badminton_password
          POSTGRES_DB: badminton_db
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U badminton_user -d badminton_db"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      # Pepper CHỈ dùng cho test/CI. Không phải secret production.
      PASSWORD_PEPPER: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install backend dependencies
        working-directory: backend
        run: npm ci

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Ensure test database exists
        working-directory: backend
        run: |
          node -e '
          const { Client } = require("pg");
          (async () => {
            const client = new Client({
              connectionString: "postgres://badminton_user:badminton_password@localhost:5433/badminton_db",
            });
            await client.connect();
            const result = await client.query(
              "SELECT 1 FROM pg_database WHERE datname = $1",
              ["badminton_test"],
            );
            if (result.rowCount === 0) {
              await client.query("CREATE DATABASE badminton_test");
              console.log("Created badminton_test");
            } else {
              console.log("badminton_test already exists");
            }
            await client.end();
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
          '

      - name: Install Chrome for Playwright
        working-directory: frontend
        run: npx playwright install --with-deps chrome

      - name: Run Playwright E2E
        working-directory: frontend
        run: npm run test:e2e -- --reporter=list,html --trace=retain-on-failure

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            frontend/playwright-report
            frontend/test-results
          retention-days: 7
          if-no-files-found: ignore
```

## 18. Bàn giao triển khai thử — 2026-11-23

- Đã tạo `ci.yml` và `e2e-nightly.yml` từ Phụ lục A/B (CI-01, CI-02).
- Người dùng thực hiện commit/push, mở PR, kiểm tra Actions và review. Chưa bật
  branch protection, chưa deploy; CI-03 đã xong, CI-05/CI-07 chưa hoàn thành.
- `tech-stack.md` ghi nhận trạng thái thử nghiệm; reviewer tài liệu vẫn cần được
  chỉ định. Không coi đây là bằng chứng CI đã xanh hay quyết định production.
- `actionlint` kiểm tra cả hai workflow pass; `git diff --check` pass.
- Kiểm tra tại chỗ: backend build, frontend lint/build và `verify:migrations`
  pass (33 migration, không có schema diff). Playwright thu thập được 508 test
  trong 54 file; Vitest liệt kê được 82 file test. Thu thập không phải chạy test.
- Chưa chạy lại toàn bộ backend/E2E suite; kết quả đầy đủ và thời gian chạy phải
  được ghi nhận từ lần GitHub Actions đầu tiên. Giữ nguyên timeout tạm và phạm vi test.

### Các bước người dùng thực hiện

1. Từ trạng thái hiện tại trên `main`, tạo nhánh riêng, ví dụ `ci/github-actions`;
   commit các workflow, README, ghi chú tech stack và kế hoạch. Push nhánh và mở
   PR vào `develop`; nhờ thành viên còn lại review phần tài liệu dùng chung.
2. Trong PR → Checks, chờ cả `backend` và `frontend`. Nếu đỏ, mở job → step đỏ,
   gửi tên step, phần log lỗi và URL run; không bỏ qua test để làm xanh pipeline.
3. Khi CI xanh và được review, merge theo luồng `develop → main`.
4. Khi workflow đã có trên `main`, Actions → E2E Nightly → Run workflow → chọn
   `main`. Nếu fail, gửi log step lỗi và tải artifact `playwright-report` nếu có.
5. Sau khi kết quả CI/E2E ổn định, mới bật required checks `backend`, `frontend`
   cho từng nhánh theo §9. Ghi run URL và thời gian để chốt baseline.

### Cập nhật CI-03 — baseline thật từ GitHub Actions (2026-11-23)

- Run: <https://github.com/tahnhuy/badminton-platform/actions/runs/45140460178>
  (`push` `develop`, commit `b358bea`, kết quả **success**).
- Job `backend`: 11m06s; trong đó `Run unit/integration tests` 10m34s.
- Job `frontend`: 31s; lint và build đều xanh.
- Đã hạ `timeout-minutes` backend từ 60 xuống 30 (margin ~2,7x) trong
  `.github/workflows/ci.yml`; frontend giữ 15.
- Việc tiếp theo: merge `develop → main` để `e2e-nightly.yml` có trên default
  branch, sau đó chạy tay `E2E Nightly` (CI-05). Chưa bật branch protection.
