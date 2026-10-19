# Badminton Ecosystem Digital Platform

## Project Overview
Nền tảng số hóa hệ sinh thái cầu lông.

## Prerequisites
- Node.js (>= 20)
- npm
- Docker & Docker Compose
- Git

## Getting Started

### 1. Database Setup
Copy the environment variables template and start the PostgreSQL container:
```bash
cp .env.example .env
docker compose up -d
```

### 2. Backend Setup
Copy the backend environment template (it defines `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, etc.), install dependencies:
```bash
cp backend/.env.example backend/.env
cd backend
npm install
cd ..
```

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

- Backend: http://localhost:3000
- Frontend: http://localhost:5173 (Vite proxies `/api` to the backend)

> Note: `PASSWORD_PEPPER` must be a valid base64 string decoding to at least 32 bytes.
> If your local database predates a migration change, reset it with
> `docker compose down -v && docker compose up -d` before running `npm run db:migrate`.

### Dữ liệu mẫu và kiểm thử Rating

Chạy `npm run db:seed:ratings` để tạo tài khoản và trận mẫu. Xem [hướng dẫn test Rating](docs/features/matchmaking/ratings/testing-guide.md) để đăng nhập, gửi đánh giá và kiểm tra điều chỉnh trình độ.
