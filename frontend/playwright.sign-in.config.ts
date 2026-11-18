import { defineConfig, devices } from '@playwright/test';

/** Contract UI tests only: intercepted APIs, no database or backend seed. */
export default defineConfig({
  testDir: './e2e', testMatch: 'sign-in-ui.spec.ts', workers: 1, retries: 0,
  reporter: 'list', timeout: 30000, outputDir: '/tmp/badminton-d01/playwright-results',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5197', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5197 --strictPort', port: 5197, reuseExistingServer: false },
});
