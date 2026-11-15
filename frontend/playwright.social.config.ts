import { defineConfig, devices } from '@playwright/test';

/** Contract UI tests intercept APIs; no test or development database is reset. */
export default defineConfig({
  testDir: './e2e', testMatch: 'social.spec.ts', fullyParallel: false, workers: 1,
  reporter: 'list', timeout: 30000,
  use: { baseURL: 'http://localhost:5180', ...devices['Desktop Chrome'], channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5180 --strictPort', port: 5180, reuseExistingServer: false },
});
