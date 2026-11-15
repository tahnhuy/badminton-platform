import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const dir = join(__dirname, '../db/migrations');
const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();

describe('invitation-only migration', () => {
  for (const populated of [false, true]) {
    it(`preserves schema and history on a ${populated ? 'populated' : 'fresh'} database`, async () => {
      const name = `mm_migration_${process.pid}_${populated ? 'legacy' : 'fresh'}`;
      const url = new URL(process.env.DATABASE_URL!);
      url.pathname = '/badminton_db';
      const admin = new Client({ connectionString: url.toString() });
      await admin.connect();
      let client: Client | undefined;
      let created = false;
      try {
        await admin.query(`CREATE DATABASE "${name}"`); created = true;
        url.pathname = `/${name}`;
        client = new Client({ connectionString: url.toString() }); await client.connect();
        // Only the migrations that precede 0007; later migrations (e.g. 0012 config seed) must not run before it.
        for (const file of files.filter(name => name < '0007')) await client.query(readFileSync(join(dir, file), 'utf8'));
        let requestId: string | undefined;
        let matchId: string | undefined;
        if (populated) {
          const user = await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('legacy@test.test','unused','PLAYER','ACTIVE') RETURNING id");
          const skill = await client.query('SELECT id FROM skill_levels LIMIT 1');
          await client.query("UPDATE system_configs SET config_value='120' WHERE config_key='MATCHMAKING_MATCH_DURATION_MINUTES'");
          const request = await client.query(`INSERT INTO matchmaking_requests (player_id,match_type,min_skill_level_id,max_skill_level_id,preferred_date,preferred_start_time,preferred_end_time,latitude,longitude,max_distance_km,status,expires_at) VALUES ($1,'SINGLES',$2,$2,'2030-01-01','10:00','14:00',1,1,5,'OPEN','2030-01-01') RETURNING id`, [user.rows[0].id, skill.rows[0].id]);
          requestId = request.rows[0].id;
          const match = await client.query("INSERT INTO matches (match_type,scheduled_at,status) VALUES ('SINGLES','2030-01-01','COMPLETED') RETURNING id");
          matchId = match.rows[0].id;
          await client.query("INSERT INTO matchmaking_matches (matchmaking_request_id,match_id,status,matched_at) VALUES ($1,$2,'SUCCESS',now())", [requestId,matchId]);
        }
        const sql = readFileSync(join(dir, files.find(name => name.startsWith('0007'))!), 'utf8');
        await client.query(sql);
        expect((await client.query("SELECT to_regclass('match_confirmations') AS removed")).rows[0].removed).toBeNull();
        expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='matchmaking_requests' AND column_name IN ('area','match_duration_minutes','latitude','longitude','max_distance_km') ORDER BY column_name")).rows.map(r => r.column_name)).toEqual(['area','match_duration_minutes']);
        expect((await client.query("SELECT indexname FROM pg_indexes WHERE indexname='uq_matchmaking_invites_pending'")).rowCount).toBe(1);
        const seed = sql.slice(sql.indexOf('INSERT INTO "system_configs"'));
        await client.query(seed);
        const configs = await client.query("SELECT config_key,config_value FROM system_configs WHERE config_key LIKE 'MATCHMAKING_%' ORDER BY config_key");
        expect(configs.rows).toEqual([
          {config_key:'MATCHMAKING_ENABLED',config_value:'true'},
          {config_key:'MATCHMAKING_INVITATION_TIMEOUT_MINUTES',config_value:'15'},
          {config_key:'MATCHMAKING_MATCH_DURATION_MINUTES',config_value:populated ? '120' : '90'},
          {config_key:'MATCHMAKING_MIN_LEAD_TIME_MINUTES',config_value:'60'},
          {config_key:'MATCHMAKING_REQUEST_EXPIRATION_MINUTES',config_value:'30'},
        ]);
        if (populated) {
          expect((await client.query('SELECT id,area,match_duration_minutes FROM matchmaking_requests WHERE id=$1',[requestId])).rows[0]).toEqual({id:requestId,area:null,match_duration_minutes:120});
          expect((await client.query('SELECT status FROM matches WHERE id=$1',[matchId])).rows[0].status).toBe('COMPLETED');
          expect((await client.query('SELECT match_id FROM matchmaking_matches WHERE matchmaking_request_id=$1',[requestId])).rows[0].match_id).toBe(matchId);
        }
      } finally {
        await client?.end();
        if (created) await admin.query(`DROP DATABASE "${name}"`);
        await admin.end();
      }
    });
  }
});
