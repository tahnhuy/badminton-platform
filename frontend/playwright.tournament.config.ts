import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'tournament-live.spec.ts',
  workers: 1, retries: 0, reporter: 'list', timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: '../.local-artifacts/tournament-live',
  use: { baseURL: 'http://localhost:5193', channel: 'chrome', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run start:e2e --prefix ../backend', port: 3193, reuseExistingServer: false, timeout: 60_000,
      env: { PORT: '3193', DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test' } },
    { command: 'npm run dev -- --config vite.tournament-test.config.ts --port 5193 --strictPort', port: 5193, reuseExistingServer: false, timeout: 60_000 },
  ],
});
