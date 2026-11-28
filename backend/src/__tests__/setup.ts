import { beforeAll, afterEach, afterAll, expect } from 'vitest';
import { PURE_UNIT_TEST_PATHS } from './unit-suite-paths';
import { cleanTestDatabase } from './test-db';
import { pool } from '../db';
import { resetRateLimitStores } from '../middleware/rate-limit.middleware';
import { registerBlockPort } from '../services/matchmaking/block-port.registry';
import { testBlockPort } from './test-block-port';

// Unknown paths retain cleanup. Only explicitly reviewed pure suites bypass DB
// fixtures; this does not change database isolation for integration/API tests.
const currentPath = expect.getState().testPath?.replace(/\\/g, '/');
const isPureUnit = PURE_UNIT_TEST_PATHS.some(path => currentPath?.endsWith(`/${path}`));
if (!isPureUnit) {
  beforeAll(cleanTestDatabase);
  beforeAll(() => registerBlockPort(testBlockPort));

  afterEach(async () => {
    testBlockPort.clear();
    registerBlockPort(testBlockPort);
    resetRateLimitStores();
    await cleanTestDatabase();
  });
}

afterAll(async () => {
  await pool.end();
});

