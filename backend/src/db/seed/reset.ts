import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from 'pg';
import { runMigrations } from '../migrate';

/** Back up, wipe the `public` schema and re-run every migration (reference data included). */
export async function resetDatabase(url: string, options: { backup: boolean; log: (message: string) => void }): Promise<void> {
  if (options.backup) backupDatabase(url, options.log);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    options.log('Xoá schema public…');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  await runMigrations(url);
}

function backupDatabase(url: string, log: (message: string) => void): void {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  const directory = path.join(os.homedir(), 'db-backups');
  fs.mkdirSync(directory, { recursive: true });
  // Local wall-clock time in the file name (YYYYMMDD_HHMMSS), like the other backups in ~/db-backups.
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const file = path.join(directory, `${database}_before_seed_reset_${stamp}.dump`);

  try {
    execFileSync('pg_dump', ['-Fc', '-d', url, '-f', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // No local pg_dump: dump from inside the Postgres container (docker-compose setup).
    const container = process.env.SEED_BACKUP_CONTAINER || 'badminton_postgres';
    const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-Fc', '-U', decodeURIComponent(parsed.username), '-d', database], { maxBuffer: 1024 ** 3 });
    fs.writeFileSync(file, dump);
  }
  if (fs.statSync(file).size === 0) throw new Error(`Backup ${file} is empty; aborting before wiping the database`);
  log(`Đã sao lưu DB vào ${file}`);
}
