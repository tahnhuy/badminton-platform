import { ensureTestDatabase } from './test-db';

export async function setup() {
  await ensureTestDatabase();
}
