import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATION_LOCK_ID = 123456789; // Abstract advisory lock ID

async function runMigrations() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.error('DIRECT_URL is not defined in environment variables.');
    process.exit(1);
  }

  const client = new Client({ connectionString: directUrl });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database via DIRECT_URL.');

    // Acquire lock
    console.log('Acquiring migration lock...');
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    if (!lockRes.rows[0].pg_try_advisory_lock) {
      console.error('Could not acquire migration lock. Another process is running migrations.');
      process.exit(1);
    }
    console.log('Migration lock acquired.');

    // Ensure migration history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_migration_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        hash VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations folder found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort deterministically based on Drizzle Kit's zero-padded numerical prefix

    const appliedRes = await client.query('SELECT filename, hash FROM custom_migration_history');
    const appliedMigrations = new Map(appliedRes.rows.map(r => [r.filename, r.hash]));

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

      if (appliedMigrations.has(file)) {
        if (appliedMigrations.get(file) !== hash) {
          console.error(`ERROR: Checksum mismatch for applied migration: ${file}`);
          console.error(`Existing hash: ${appliedMigrations.get(file)}`);
          console.error(`New hash: ${hash}`);
          process.exit(1);
        }
        console.log(`Skipping already-applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      
      try {
        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('INSERT INTO custom_migration_history (filename, hash) VALUES ($1, $2)', [file, hash]);
        await client.query('COMMIT');
        console.log(`Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error applying migration ${file}:`, err);
        throw err;
      }
    }
    console.log('All pending migrations applied.');
  } catch (err) {
    console.error('Migration execution failed:', err);
    process.exit(1);
  } finally {
    // Release lock
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
      console.log('Migration lock released.');
    } catch (unlockErr) {
      console.error('Failed to release migration lock:', unlockErr);
    }
    await client.end();
  }
}

runMigrations();
