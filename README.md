# Badminton Ecosystem Digital Platform

## Project Overview
Nền tảng số hóa hệ sinh thái cầu lông.

## Prerequisites
- Node.js (`^20.19.0 || >=22.12.0`, required by Vite 8)
- npm
- Docker & Docker Compose
- Git

## CI (trial)

The current `ci.yml` checks pull requests targeting `main` and supports manual runs: backend migration
verification, build and tests; frontend lint and build. Playwright runs nightly
at 02:00 Vietnam time and manually once the workflow is on the default branch.
This does not deploy the application. Setup, review and branch-protection steps
are in the [CI plan](docs/plans/ke-hoach-cicd-github-actions.md).

Local checks from the repository root (backend tests need the isolated test DB
and test environment described in the plan):

```bash
npm run verify:migrations --prefix backend
npm run build --prefix backend
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
```

## Getting Started

### 1. Database Setup
Copy the environment variables template and start the PostgreSQL container:
```bash
cp .env.example .env
docker compose up -d
```

If the project directory was moved and `badminton_postgres` already exists, reuse
that container and its existing volume with `docker start badminton_postgres`.
The default Compose project name changes with the directory name; do not create a
second database merely to fix a moved path.

### 2. Backend Setup
Copy the backend environment template (it defines `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, etc.), install dependencies:
```bash
cp backend/.env.example backend/.env
cd backend
npm install
cd ..
```

Before starting the backend, set `PRIVATE_UPLOADS_DIR` in `backend/.env` to an
**existing absolute directory** outside public uploads. From the repository root,
`mkdir -p private-uploads` and `realpath private-uploads` give a suitable location.
After moving the repository, update this path to the new location. Keep the
existing `.env` values and `PASSWORD_PEPPER`; do not recopy the template over them.
A stale path prevents the API from starting and causes Vite proxy
`ECONNREFUSED` errors on `/api/v1/auth/me`.

### 3. Frontend Setup
Navigate to the frontend directory, install dependencies, and prepare the root scripts:
```bash
npm install
cd frontend
npm install
cd ..
```

### 4. Run Both Simultaneously
From the root directory, apply migrations, seed data, then start both servers:
```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Social demo (local database only): run `npm run db:seed:social`, then open `/feed`.
The seed adds 12 free posts (including private images), 6 recruitment posts,
comments/reactions and four Player demo accounts: `social.demo.nam@example.com`,
`social.demo.an@example.com`, `social.demo.ha@example.com`, `social.demo.duc@example.com`.
New accounts use `Password@123`; reruns preserve existing passwords, manual edits
and original recruitment dates, and do not duplicate posts. Log in as Nam for host
and unpublished-post views; enable “Bao gồm kèo đã kết thúc” to see the cancelled post.
Accepted members are explicit demo fixtures, not verification of Apply/BlockPort
integration. No chat groups or bookings are created. Requires migrations, enabled
Social/Matchmaking config and a valid `PRIVATE_UPLOADS_DIR` in `backend/.env`.

- Backend: http://localhost:3000
- Frontend: http://localhost:5173 (Vite proxies `/api` to the backend)

> Note: `PASSWORD_PEPPER` must be a valid base64 string decoding to at least 32 bytes.
> If your local database predates a migration change, reset it with
> `docker compose down -v && docker compose up -d` before running `npm run db:migrate`.

### Dữ liệu mẫu và kiểm thử Rating

Chạy `npm run db:seed:ratings` để tạo tài khoản và trận mẫu. Xem [hướng dẫn test Rating](docs/features/matchmaking/ratings/testing-guide.md) để đăng nhập, gửi đánh giá và kiểm tra điều chỉnh trình độ.
