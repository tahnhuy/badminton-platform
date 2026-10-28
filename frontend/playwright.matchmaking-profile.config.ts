import { defineConfig } from '@playwright/test';
import profileConfig from './playwright.profile.config';

export default defineConfig({ ...profileConfig, testDir: './e2e', testMatch: 'matchmaking.spec.ts', expect: { timeout: 10000 } });
