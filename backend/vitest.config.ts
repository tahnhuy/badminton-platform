import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
    env: {
      DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test',
    },
  },
});
