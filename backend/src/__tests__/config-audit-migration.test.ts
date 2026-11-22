import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool } from '../db';

describe('SYSTEM_CONFIG_AUDIT migration', () => {
  it('creates the append-only table with its supporting index and user FK', async () => {
    const table = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'system_config_audit'
      ORDER BY ordinal_position
    `);
    expect(table.rows.map(row => row.column_name)).toEqual([
      'id', 'config_key', 'old_value', 'new_value', 'changed_by', 'changed_at',
    ]);
    expect(table.rows.find(row => row.column_name === 'old_value')?.is_nullable).toBe('YES');

    const index = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'system_config_audit'
    `);
    expect(index.rows.map(row => row.indexname)).toContain('system_config_audit_key_changed_at_idx');

    const fk = await pool.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'system_config_audit'
        AND constraint_type = 'FOREIGN KEY'
    `);
    expect(fk.rows.length).toBeGreaterThan(0);
  });

  it.each([false, true])('applies the migration on isolated fresh/populated fixtures (populated=%s)', async (populated) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA config_audit_migration_fixture');
      await client.query('SET LOCAL search_path TO config_audit_migration_fixture, public');
      await client.query(`
        CREATE TABLE users (id bigint PRIMARY KEY);
        CREATE TABLE system_configs (
          config_key varchar UNIQUE NOT NULL,
          config_value text NOT NULL,
          description text
        );
      `);
      if (populated) {
        await client.query(`
          INSERT INTO system_configs (config_key, config_value, description) VALUES
            ('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'true', 'legacy seed'),
            ('BOOKING_ENABLED', 'false', 'admin choice');
        `);
      }

      const migration = readFileSync(
        resolve(process.cwd(), 'src/db/migrations/0023_overrated_phantom_reporter.sql'),
        'utf8',
      ).replaceAll('"public"."users"', '"config_audit_migration_fixture"."users"');
      await client.query(migration);

      const table = await client.query(
        `SELECT to_regclass('config_audit_migration_fixture.system_config_audit') AS name`,
      );
      expect(table.rows[0].name).toBe('system_config_audit');

      const tournamentKeys = await client.query(
        `SELECT config_key FROM system_configs
         WHERE config_key IN ('TOURNAMENT_ENABLED', 'TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT',
                              'TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES', 'TEAM_INVITATION_TIMEOUT_MINUTES')
         ORDER BY config_key`,
      );
      expect(tournamentKeys.rows).toHaveLength(4);

      if (populated) {
        const values = await client.query(
          `SELECT config_key, config_value FROM system_configs
           WHERE config_key IN ('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'BOOKING_ENABLED')
           ORDER BY config_key`,
        );
        expect(values.rows).toEqual([
          { config_key: 'BOOKING_ENABLED', config_value: 'false' },
          { config_key: 'PLAYER_SKILL_ADJUSTMENT_ENABLED', config_value: 'false' },
        ]);
      }

      await client.query(
        `INSERT INTO system_config_audit (config_key, old_value, new_value, changed_by)
         VALUES ('BOOKING_ENABLED', 'false', 'true', NULL)`,
      );
      const history = await client.query(
        `SELECT config_key, old_value, new_value FROM system_config_audit`,
      );
      expect(history.rows).toEqual([{ config_key: 'BOOKING_ENABLED', old_value: 'false', new_value: 'true' }]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('accepts insert/read history rows and preserves old/new values', async () => {
    await pool.query('DELETE FROM system_config_audit');
    await pool.query(
      `INSERT INTO system_config_audit (config_key, old_value, new_value, changed_by)
       VALUES ('BOOKING_ENABLED', NULL, 'false', NULL)`,
    );
    const result = await pool.query(
      `SELECT config_key, old_value, new_value FROM system_config_audit WHERE config_key = 'BOOKING_ENABLED'`,
    );
    expect(result.rows[0]).toEqual({ config_key: 'BOOKING_ENABLED', old_value: null, new_value: 'false' });
    await pool.query('DELETE FROM system_config_audit');
  });
});
