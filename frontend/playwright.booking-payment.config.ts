import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  testDir: './e2e',
  testMatch: 'booking-payment.spec.ts',
  timeout: 45000,
});
