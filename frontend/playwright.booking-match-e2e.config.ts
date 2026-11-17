import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  testDir: './e2e',
  testMatch: 'booking-match-e2e.spec.ts',
  timeout: 180000,
});
