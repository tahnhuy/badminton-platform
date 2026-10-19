import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/profile', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://localhost:5190', channel: 'chrome' },
  webServer: { command: 'npm run dev -- --port 5190 --strictPort', port: 5190, reuseExistingServer: false },
});
