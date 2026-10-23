import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanTestDatabase } from './test-db';
import { pool } from '../db';
import { resetRateLimitStores } from '../middleware/rate-limit.middleware';

beforeAll(cleanTestDatabase);

afterEach(async () => {
  resetRateLimitStores();
  await cleanTestDatabase();
});

afterAll(async () => {
  await pool.end();
});

