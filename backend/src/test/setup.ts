import { afterEach, afterAll } from 'vitest';
import { cleanTestDatabase } from './test-db';
import { pool } from '../db/client';
import { resetRateLimitStores } from '../shared/http/rate-limit';

afterEach(async () => {
  resetRateLimitStores();
  await cleanTestDatabase();
});

afterAll(async () => {
  await pool.end();
});

