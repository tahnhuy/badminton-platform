import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// TRN-01 — migration 0033 on an isolated scratch database populated with legacy
// (pre-2026-11-25) tournament rows. Never touches badminton_db data.
const dir = join(__dirname, '../db/migrations');
const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
// Renumbered 0033 → 0040 when merging develop (which took 0033–0039): replay everything before it.
const before = files.filter(name => Number(name.slice(0, 4)) < 40);
const migration0033 = readFileSync(join(dir, files.find(name => name.startsWith('0040_tournament_professional'))!), 'utf8');

function adminUrl(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function withScratchDatabase(run: (client: Client) => Promise<void>): Promise<void> {
  const name = `trn01_${process.pid}_${Date.now()}`;
  const admin = new Client({ connectionString: adminUrl('badminton_db') });
  await admin.connect();
  let client: Client | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    client = new Client({ connectionString: adminUrl(name) });
    await client.connect();
    for (const file of before) await client.query(readFileSync(join(dir, file), 'utf8'));
    await run(client);
  } finally {
    await client?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}

async function rejects(client: Client, statement: string, params: unknown[] = []): Promise<string> {
  await client.query('SAVEPOINT s');
  try {
    await client.query(statement, params);
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT s');
    return (error as { constraint?: string; message: string }).constraint ?? (error as Error).message;
  }
  await client.query('RELEASE SAVEPOINT s');
  throw new Error(`expected rejection: ${statement}`);
}

async function insertUser(client: Client, email: string): Promise<number> {
  const { rows } = await client.query(
    "INSERT INTO users (email, password_hash, role, status) VALUES ($1, 'x', 'PLAYER', 'ACTIVE') RETURNING id",
    [email],
  );
  return Number(rows[0].id);
}

/** Legacy rows using values that the new CHECKs reject; returns their ids. */
async function seedLegacy(client: Client) {
  const [a, b, c] = [await insertUser(client, 'a@x.test'), await insertUser(client, 'b@x.test'), await insertUser(client, 'c@x.test')];
  const { rows: [t] } = await client.query(
    `INSERT INTO tournaments (creator_id, name, format, match_type, participant_limit, status,
       registration_start, registration_end, tournament_start, tournament_end)
     VALUES ($1, 'Legacy', 'KNOCKOUT', 'DOUBLES', 8, 'OPEN', now(), now(), now(), now()) RETURNING id`, [a],
  );
  const tournamentId = Number(t.id);
  const { rows: [team] } = await client.query(
    "INSERT INTO tournament_teams (tournament_id, name, captain_id, status) VALUES ($1, 'T', $2, 'CONFIRMED') RETURNING id",
    [tournamentId, b],
  );
  const { rows: [loneTeam] } = await client.query(
    "INSERT INTO tournament_teams (tournament_id, name, captain_id, status) VALUES ($1, 'Lone', $2, 'ACTIVE') RETURNING id",
    [tournamentId, c],
  );
  await client.query(
    "INSERT INTO tournament_team_players (team_id, player_id, role, joined_at) VALUES ($1, $2, 'CAPTAIN', now()), ($1, $3, 'PLAYER', now())",
    [team.id, b, a],
  );
  await client.query(
    "INSERT INTO tournament_registrations (tournament_id, team_id, registration_type, status, registered_at) VALUES ($1, $2, 'DOUBLES', 'CONFIRMED', now())",
    [tournamentId, team.id],
  );
  const { rows: [match] } = await client.query(
    "INSERT INTO matches (match_type, scheduled_at, status) VALUES ('DOUBLES', now(), 'PENDING_COURT') RETURNING id",
  );
  await client.query(
    "INSERT INTO tournament_matches (tournament_id, match_id, round_index, match_index, resolution) VALUES ($1, $2, 1, 1, 'PENDING')",
    [tournamentId, match.id],
  );
  return { a, b, c, tournamentId, teamId: Number(team.id), loneTeamId: Number(loneTeam.id) };
}

describe('migration 0033 — professional tournaments (TRN-01)', () => {
  it('backfills team-player tournament ids and normalises legacy values on a populated database', async () => {
    await withScratchDatabase(async client => {
      const ids = await seedLegacy(client);
      await client.query(migration0033);

      const { rows: [t] } = await client.query('SELECT * FROM tournaments WHERE id = $1', [ids.tournamentId]);
      expect(t).toMatchObject({
        status: 'OPEN_FOR_REGISTRATION', format: 'SINGLE_ELIMINATION', competition_type: 'PROFESSIONAL',
        court_count: 2, match_duration_minutes: 45, min_rest_minutes: 15,
        daily_start_time: '08:00:00', daily_end_time: '21:00:00', conversation_id: null, completed_by: null,
      });
      const players = await client.query('SELECT tournament_id, role FROM tournament_team_players ORDER BY id');
      expect(players.rows.map(r => [Number(r.tournament_id), r.role])).toEqual([[ids.tournamentId, 'CAPTAIN'], [ids.tournamentId, 'MEMBER']]);
      const teams = await client.query('SELECT id, status FROM tournament_teams ORDER BY id');
      expect(teams.rows.map(r => r.status)).toEqual(['REGISTERED', 'DISBANDED']);
      const match = await client.query('SELECT resolution, court_label FROM tournament_matches');
      expect(match.rows[0]).toEqual({ resolution: 'UNRESOLVED', court_label: null });
      const reg = await client.query('SELECT paid_amount, seed_no, payer_id FROM tournament_registrations');
      expect(reg.rows[0]).toEqual({ paid_amount: '0.00', seed_no: null, payer_id: null });
    });
  });

  it('enforces the new tournament, team, registration and match constraints', async () => {
    await withScratchDatabase(async client => {
      const ids = await seedLegacy(client);
      await client.query(migration0033);
      await client.query('BEGIN');
      const tid = ids.tournamentId;

      expect(await rejects(client, "UPDATE tournaments SET status = 'OPEN' WHERE id = $1", [tid])).toBe('chk_tournament_status');
      expect(await rejects(client, "UPDATE tournaments SET competition_type = 'FRIENDLY' WHERE id = $1", [tid])).toBe('chk_tournament_competition_type');
      expect(await rejects(client, 'UPDATE tournaments SET court_count = 21 WHERE id = $1', [tid])).toBe('chk_tournament_court_count');
      expect(await rejects(client, "UPDATE tournaments SET daily_start_time = '22:00' WHERE id = $1", [tid])).toBe('chk_tournament_daily_window');
      expect(await rejects(client, 'UPDATE tournaments SET participant_limit = 129 WHERE id = $1', [tid])).toBe('chk_tournament_participant_limit');

      // One active membership per Player per tournament, even across teams (Tech Design §4.2).
      expect(await rejects(client,
        "INSERT INTO tournament_team_players (team_id, tournament_id, player_id, role, joined_at) VALUES ($1, $2, $3, 'MEMBER', now())",
        [ids.loneTeamId, tid, ids.a])).toBe('uq_tournament_team_player_tournament_active');
      await client.query('UPDATE tournament_team_players SET left_at = now() WHERE player_id = $1', [ids.a]);
      await client.query(
        "INSERT INTO tournament_team_players (team_id, tournament_id, player_id, role, joined_at) VALUES ($1, $2, $3, 'MEMBER', now())",
        [ids.loneTeamId, tid, ids.a]);

      // One pending invitation per team.
      await client.query("INSERT INTO team_invitations (team_id, inviter_id, invitee_id, status, expires_at) VALUES ($1, $2, $3, 'PENDING', now())", [ids.loneTeamId, ids.c, ids.b]);
      expect(await rejects(client,
        "INSERT INTO team_invitations (team_id, inviter_id, invitee_id, status, expires_at) VALUES ($1, $2, $3, 'PENDING', now())",
        [ids.loneTeamId, ids.c, ids.a])).toBe('uq_team_invitations_pending_team');

      // A withdrawn Singles Player can register again; only one CONFIRMED at a time.
      const reg = "INSERT INTO tournament_registrations (tournament_id, player_id, registration_type, status, registered_at) VALUES ($1, $2, 'SINGLES', $3, now()) RETURNING id";
      await client.query(reg, [tid, ids.c, 'CANCELLED']);
      const { rows: [r1] } = await client.query(reg, [tid, ids.c, 'CONFIRMED']);
      expect(await rejects(client, reg, [tid, ids.c, 'CONFIRMED'])).toBe('uq_tournament_singles_player');
      expect(await rejects(client, "INSERT INTO tournament_registrations (tournament_id, player_id, team_id, registration_type, status, registered_at) VALUES ($1, $2, $3, 'SINGLES', 'CONFIRMED', now())",
        [tid, ids.b, ids.teamId])).toBe('chk_tournament_registration_type');
      expect(await rejects(client, "UPDATE tournament_registrations SET status = 'PAID' WHERE id = $1", [r1.id])).toBe('chk_tournament_registration_status');

      // Seed numbers are unique per tournament.
      await client.query('UPDATE tournament_registrations SET seed_no = 1 WHERE id = $1', [r1.id]);
      expect(await rejects(client, "UPDATE tournament_registrations SET seed_no = 1 WHERE team_id = $1", [ids.teamId])).toBe('uq_tournament_registration_seed_no');

      expect(await rejects(client, "UPDATE tournament_matches SET resolution = 'PENDING'")).toBe('chk_tournament_match_resolution');
      await client.query("UPDATE tournament_matches SET resolution = 'RETIRED'");
      await client.query('ROLLBACK');
    });
  });

  it('extends posts, conversations and the wallet ledger', async () => {
    await withScratchDatabase(async client => {
      const ids = await seedLegacy(client);
      await client.query(migration0033);
      await client.query('BEGIN');
      const post = "INSERT INTO posts (author_id, type, body, published_at, tournament_id) VALUES ($1, $2, 'x', now(), $3)";
      expect(await rejects(client, post, [ids.a, 'TOURNAMENT_RESULT', null])).toBe('chk_posts_tournament');
      expect(await rejects(client, post, [ids.a, 'FREE', ids.tournamentId])).toBe('chk_posts_tournament');
      await client.query(post, [ids.a, 'TOURNAMENT_RESULT', ids.tournamentId]);
      expect(await rejects(client, post, [ids.a, 'TOURNAMENT_RESULT', ids.tournamentId])).toBe('uq_posts_author_tournament_result');
      await client.query("UPDATE posts SET deleted_at = now() WHERE type = 'TOURNAMENT_RESULT'");
      await client.query(post, [ids.a, 'TOURNAMENT_RESULT', ids.tournamentId]);

      expect(await rejects(client, "INSERT INTO conversations (type, title, system_kind) VALUES ('GROUP', 'x', 'MATCH')")).toBe('chk_conversations_system_kind');
      await client.query("INSERT INTO conversations (type, title, system_kind) VALUES ('GROUP', 'Giải', 'TOURNAMENT')");

      await client.query(
        "INSERT INTO wallet_ledger_entries (user_id, entry_type, amount, balance_after) VALUES ($1, 'TOURNAMENT_EARNING', 100000, 100000)", [ids.a]);
      expect(await rejects(client,
        "INSERT INTO wallet_ledger_entries (user_id, entry_type, amount, balance_after) VALUES ($1, 'PRIZE', 1, 1)", [ids.a])).toBe('chk_wallet_entry_type');
      await client.query('ROLLBACK');
    });
  });
});
