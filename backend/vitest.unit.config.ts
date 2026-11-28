import { PURE_UNIT_TEST_PATHS } from './src/__tests__/unit-suite-paths';
import { defineConfig } from 'vitest/config';

// Pure components only: no global DB setup, auth bypass or cleanup hooks.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/validation/{booking,matchmaking,tournaments,auth,payment,wallet}.ts'],
      reportsDirectory: '../docs/reports/testing/artifacts/coverage-validation',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
    },
    env: { PASSWORD_PEPPER: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    environment: 'node',
    include: [...PURE_UNIT_TEST_PATHS],
    fileParallelism: false,
  },
});
