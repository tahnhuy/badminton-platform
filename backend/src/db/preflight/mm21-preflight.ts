/**
 * MM-21 read-only preflight (Matchmaking Tech Design §24.11 step 1).
 *
 * Runs the exact preflight block of migration 0014 inside a READ ONLY transaction and
 * always rolls back. Prints the status report and every anomaly; exit code 1 when the
 * migration would stop. Never writes.
 *
 * Usage: npx tsx src/db/preflight/mm21-preflight.ts [connection-url]
 *        (defaults to DIRECT_URL; the URL is never printed)
 */
import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export function mm21PreflightSql(): string {
  const migration = readFileSync(path.join(__dirname, '../migrations/0014_recruitment_membership_foundation.sql'), 'utf8');
  const start = migration.indexOf('DO $$');
  const end = migration.indexOf('--> statement-breakpoint', start);
  if (start < 0 || end < 0) throw new Error('MM-21 preflight block not found in migration 0014');
  return migration.slice(start, end);
}

export interface PreflightOutcome {
  ok: boolean;
  notices: string[];
  anomalies: string | null;
  alreadyMigrated: boolean;
}

export async function runMm21Preflight(connectionString: string): Promise<PreflightOutcome> {
  const client = new Client({ connectionString });
  const notices: string[] = [];
  client.on('notice', notice => notices.push(notice.message ?? ''));
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const migrated = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'matchmaking_invitations' AND column_name = 'player_id'",
    );
    if (migrated.rowCount) return { ok: true, notices, anomalies: null, alreadyMigrated: true };
    try {
      await client.query(mm21PreflightSql());
      return { ok: true, notices, anomalies: null, alreadyMigrated: false };
    } catch (error) {
      return { ok: false, notices, anomalies: (error as Error).message, alreadyMigrated: false };
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

if (require.main === module) {
  const url = process.argv[2] ?? process.env.DIRECT_URL;
  if (!url) {
    console.error('Provide a connection URL or set DIRECT_URL.');
    process.exit(2);
  }
  runMm21Preflight(url).then(outcome => {
    for (const notice of outcome.notices) console.log(notice);
    if (outcome.alreadyMigrated) console.log('MM-21 already applied (player_id exists); nothing to check.');
    else if (outcome.ok) console.log('MM-21 preflight: no anomalies.');
    else console.error(outcome.anomalies);
    process.exit(outcome.ok ? 0 : 1);
  }).catch(error => {
    console.error('MM-21 preflight failed to run:', (error as Error).message);
    process.exit(2);
  });
}
