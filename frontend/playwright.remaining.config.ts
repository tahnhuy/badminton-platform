import { defineConfig } from '@playwright/test';
import core from './playwright.core.config';

// Together with core, mocked UI and tournament configs, collect every checked-in
// spec once. Keep the same isolated backend/origin for the remaining real flows.
export default defineConfig({
  ...core,
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/*-ui.spec.ts', 'tournament-live.spec.ts',
    'booking-payment.spec.ts', 'booking-match-e2e.spec.ts', 'ratings-real.spec.ts',
    'sign-in.spec.ts', 'forced-password-change.spec.ts', 'role-based-denial.spec.ts',
    'admin-finance.spec.ts', 'demo-matchmaking-split-bill.spec.ts'],
  outputDir: '../docs/reports/testing/artifacts/remaining-results',
});
