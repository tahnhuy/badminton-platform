import { defineConfig } from '@playwright/test';
import profileConfig from './playwright.profile.config';

export default defineConfig({
  ...profileConfig,
  testDir: './e2e',
  testMatch: 'matchmaking-booking-link.spec.ts',
  expect: { timeout: 10000 },
  webServer: [
    {
      command: 'npm run start:e2e --prefix ../backend',
      port: 3000,
      reuseExistingServer: true,
      timeout: 60000,
    },
    profileConfig.webServer,
  ],
});
