// Must be the first static import in the E2E runner. Top-level assignments in
// that runner do not precede evaluation of its static import dependencies.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.PORT = process.env.PORT || '3000';
process.env.COOKIE_SECURE = 'false';
process.env.ALLOW_TEST_AUTH = 'true';
