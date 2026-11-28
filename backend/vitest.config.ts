import { defineConfig } from 'vitest/config';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Social Tech Design §7.4: tests use a temporary private media root, outside every
// public static root (the test avatar root is a separate tmp directory).
const privateUploadsDir = mkdtempSync(join(tmpdir(), 'badminton-private-uploads-test-'));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../docs/reports/testing/artifacts/coverage',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: [
        'src/{services,repositories,controllers,routes,validation}/{booking,matchmaking,match,tournaments,auth,payments,payment,wallet}/**/*.ts',
        'src/validation/{booking,matchmaking,tournaments,auth,payment,wallet}.ts',
        'src/middleware/{auth,csrf,rate-limit}*.ts',
      ],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 70 },
    },
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    globalSetup: ['./src/__tests__/global-setup.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 20000,
    env: {
      DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test',
      ALLOW_TEST_AUTH: 'true',
      PAYMENT_PROVIDER: 'MOCK',
      WALLET_AUTO_APPROVE_PAYOUTS: 'false',
      PRIVATE_UPLOADS_DIR: privateUploadsDir,
    },
  },
});
