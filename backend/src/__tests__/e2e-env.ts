// Must be the first static import in the E2E runner. Top-level assignments in
// that runner do not precede evaluation of its static import dependencies.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.PORT = process.env.PORT || '3000';
process.env.COOKIE_SECURE = 'false';
process.env.ALLOW_TEST_AUTH = 'true';
// Social Tech Design §7.4: temporary private media root for the E2E server.
if (!process.env.PRIVATE_UPLOADS_DIR) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require('os') as typeof import('os');
  process.env.PRIVATE_UPLOADS_DIR = mkdtempSync(`${tmpdir()}/badminton-private-uploads-e2e-`);
}
