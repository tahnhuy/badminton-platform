import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/profile-live', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://localhost:5192', channel: 'chrome' },
  webServer: [
    { command: 'npm run start:e2e --prefix ../backend', port: 3192, reuseExistingServer: false,
      env: { PORT: '3192', DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test' } },
    { command: 'npm run dev -- --config vite.profile-test.config.ts --port 5192 --strictPort', port: 5192, reuseExistingServer: false },
  ],
});
