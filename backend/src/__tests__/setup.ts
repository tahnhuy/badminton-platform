import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanTestDatabase } from './test-db';
import { pool } from '../db';
import { resetRateLimitStores } from '../middleware/rate-limit.middleware';
import { registerBlockPort } from '../services/matchmaking/block-port.registry';
import { testBlockPort } from './test-block-port';

beforeAll(cleanTestDatabase);
beforeAll(() => registerBlockPort(testBlockPort));

afterEach(async () => {
  testBlockPort.clear();
  registerBlockPort(testBlockPort);
  resetRateLimitStores();
  await cleanTestDatabase();
});

afterAll(async () => {
  await pool.end();
});

