import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { Client } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// The demo seed (docs/plans/demo-seed-plan.md) runs end to end on its own scratch database:
// any schema or service change that breaks it fails here instead of on demo day. The seed's
// own verification (ledger, reconciliation, timestamps, sign-in) must pass, then a few counts.
const run = promisify(execFile);

function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

describe('demo seed', { timeout: 300_000 }, () => {
  const name = `demo_seed_${process.pid}`;
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: urlFor('badminton_db') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.query(`CREATE DATABASE "${name}"`);
  }, 60_000);

  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  it('resets, seeds every module and passes its own verification', async () => {
    const backend = join(__dirname, '..', '..');
    const url = urlFor(name);
    const { stdout } = await run('npx', ['tsx', 'src/db/seed/index.ts', '--reset', '--yes', '--no-backup'], {
      cwd: backend,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'development' },
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(stdout).toContain('Kiểm tra:');
    expect(stdout).toContain('đối soát Tài chính 0 chỗ lệch');

    const db = new Client({ connectionString: url });
    await db.connect();
    try {
      const count = async (query: string) => Number((await db.query(query)).rows[0].n);
      expect(await count(`SELECT COUNT(*) AS n FROM users WHERE role = 'PLAYER'`)).toBe(40);
      expect(await count(`SELECT COUNT(*) AS n FROM users WHERE email = 'chatok111111@gmail.com'`)).toBe(1);
      expect(await count(`SELECT COUNT(*) AS n FROM bookings`)).toBeGreaterThan(100);
      expect(await count(`SELECT COUNT(*) AS n FROM matches WHERE status = 'COMPLETED'`)).toBeGreaterThan(10);
      expect(await count(`SELECT COUNT(DISTINCT status) AS n FROM tournaments`)).toBe(7);
      expect(await count(`SELECT COUNT(*) AS n FROM email_outbox`)).toBe(0);
      expect(await count(`SELECT COUNT(*) AS n FROM pg_trigger WHERE tgname = 'trg_player_ratings_immutable' AND tgenabled = 'O'`)).toBe(1);
    } finally {
      await db.end();
    }
  });
});
