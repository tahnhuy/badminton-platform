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
docker-compose up -d
```

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and start the development server:
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup
Navigate to the frontend directory, install dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```

### 4. Run Both Simultaneously
Once dependencies are installed for both backend and frontend, you can run them simultaneously from the root directory:
```bash
npm run dev
```
