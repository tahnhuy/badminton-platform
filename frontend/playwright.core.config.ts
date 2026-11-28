import { defineConfig } from '@playwright/test';

// Keep test seed/reset helpers and direct HTTP calls on this isolated backend.
process.env.E2E_API_ORIGIN = 'http://localhost:3195';
process.env.E2E_WEB_ORIGIN = 'http://localhost:5195';
process.env.RATINGS_TEST_API_ORIGIN = 'http://localhost:3195';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['booking-payment.spec.ts', 'booking-match-e2e.spec.ts', 'ratings-real.spec.ts',
    'sign-in.spec.ts', 'forced-password-change.spec.ts', 'role-based-denial.spec.ts', 'admin-finance.spec.ts', 'demo-matchmaking-split-bill.spec.ts'],
  workers: 1, retries: 0, timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: '../docs/reports/testing/artifacts/system-results',
  use: { baseURL: 'http://localhost:5195', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run start:e2e --prefix ../backend', port: 3195, reuseExistingServer: false, timeout: 60_000,
      env: { PORT: '3195', DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test' } },
    { command: 'npm run dev -- --config vite.core-test.config.ts --port 5195 --strictPort', port: 5195, reuseExistingServer: false, timeout: 60_000 },
  ],
});
