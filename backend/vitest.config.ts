import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    globalSetup: ['./src/__tests__/global-setup.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
    env: {
      DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test',
      ALLOW_TEST_AUTH: 'true',
    },
  },
});
