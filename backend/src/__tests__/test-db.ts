import { Client } from 'pg';
import { runMigrations } from '../db/migrate';
import { pool } from '../db';

const ADMIN_DB_URL = 'postgres://badminton_user:badminton_password@localhost:5433/badminton_db';
export const TEST_DB_URL = 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test';


export async function ensureTestDatabase(): Promise<void> {
  const adminClient = new Client({ connectionString: ADMIN_DB_URL });
  try {
    await adminClient.connect();
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'badminton_test'"
    );

    if (res.rowCount === 0) {
      console.log('Test database badminton_test does not exist. Creating...');
      await adminClient.query('CREATE DATABASE badminton_test');
      console.log('Database badminton_test created successfully.');
    }
  } catch (err) {
    console.error('Error ensuring test database exists:', err);
    throw err;
  } finally {
    await adminClient.end();
  }

  // Run migrations on test database
  await runMigrations(TEST_DB_URL);
}

export async function cleanTestDatabase(): Promise<void> {

  try {
    const current = await pool.query('SELECT current_database() AS name');
    if (current.rows[0].name !== 'badminton_test') {
      throw new Error('Refusing test cleanup outside badminton_test');
    }
    // Truncate tables with cascade, excluding system_configs and skill_levels to preserve seed data
    await pool.query(`
      TRUNCATE TABLE 
        auth_sessions, 
        auth_login_lockouts, 
        player_profiles, 
        court_owner_profiles, 
        conversations,
        media_files,
        users 
      RESTART IDENTITY CASCADE;
    `);
  } catch (err) {
    console.error('Error cleaning test database:', err);
    throw err;
  }
}

