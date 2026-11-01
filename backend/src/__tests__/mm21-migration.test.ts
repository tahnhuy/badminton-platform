import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMm21Preflight } from '../db/preflight/mm21-preflight';

// MM-21 (migration 0014) on isolated scratch databases; never touches badminton_db data.
const dir = join(__dirname, '../db/migrations');
const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
const before = files.filter(name => name < '0014');
const mm21 = readFileSync(join(dir, files.find(name => name.startsWith('0014'))!), 'utf8');

function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

interface Fixture {
  host: number; member: number; other: number;
  openReq: number; matchedReq: number; bookedReq: number; cancelledReq: number; expiredReq: number;
  bookingId: number; bookedMatch: number;
}

async function populate(c: Client): Promise<Fixture> {
  const user = async (email: string) => Number((await c.query("INSERT INTO users (email,password_hash,role,status) VALUES ($1,'x','PLAYER','ACTIVE') RETURNING id", [email])).rows[0].id);
  const host = await user('host@t.t');
  const member = await user('member@t.t');
  const other = await user('other@t.t');
  const owner = Number((await c.query("INSERT INTO users (email,password_hash,role,status) VALUES ('owner@t.t','x','COURT_OWNER','ACTIVE') RETURNING id")).rows[0].id);
  const skill = Number((await c.query('SELECT id FROM skill_levels ORDER BY id LIMIT 1')).rows[0].id);
  const request = async (type: string, status: string, date: string, start: string, end: string, duration: number) =>
    Number((await c.query(
      `INSERT INTO matchmaking_requests (player_id,match_type,min_skill_level_id,max_skill_level_id,preferred_date,preferred_start_time,preferred_end_time,match_duration_minutes,status,expires_at,created_at,updated_at)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,'2030-01-01','2026-05-01 01:02:03','2026-05-02 04:05:06') RETURNING id`,
      [host, type, skill, date, start, end, duration, status])).rows[0].id);
  const openReq = await request('DOUBLES', 'OPEN', '2030-03-01', '10:00', '12:00', 90);
  const matchedReq = await request('SINGLES', 'MATCHED', '2030-03-02', '08:00', '10:00', 90);
  const bookedReq = await request('SINGLES', 'MATCHED', '2030-03-03', '18:00', '21:00', 90);
  const cancelledReq = await request('SINGLES', 'CANCELLED', '2030-03-04', '10:00', '12:00', 60);
  const expiredReq = await request('DOUBLES', 'EXPIRED', '2030-03-05', '10:00', '12:00', 120);
  const invite = (req: number, player: number, status: string) =>
    c.query('INSERT INTO matchmaking_invitations (request_id,inviter_id,invitee_id,status,expires_at) VALUES ($1,$2,$3,$4,$5)', [req, host, player, status, '2030-01-01']);
  await invite(openReq, member, 'ACCEPTED');
  await invite(openReq, other, 'PENDING');
  await invite(matchedReq, member, 'ACCEPTED');
  await invite(cancelledReq, member, 'WITHDRAWN');
  await invite(expiredReq, other, 'DECLINED');
  const facility = Number((await c.query(
    "INSERT INTO facilities (owner_id,name,phone,status,address,ward,district,city,latitude,longitude,opening_time,closing_time) VALUES ($1,'F','0900000000','ACTIVE','a','w','d','c',10,106,'06:00','22:00') RETURNING id", [owner])).rows[0].id);
  const court = Number((await c.query("INSERT INTO courts (facility_id,name,status) VALUES ($1,'C','ACTIVE') RETURNING id", [facility])).rows[0].id);
  const bookingId = Number((await c.query(
    "INSERT INTO bookings (player_id,court_id,booking_date,start_time,end_time,unit_price,total_amount,status,booking_code) VALUES ($1,$2,'2030-03-03','19:00','21:00',100,200,'CONFIRMED','MM21-B') RETURNING id", [host, court])).rows[0].id);
  const match = async (status: string, booking: number | null) =>
    Number((await c.query("INSERT INTO matches (match_type,scheduled_at,status,booking_id) VALUES ('SINGLES','2030-03-02',$1,$2) RETURNING id", [status, booking])).rows[0].id);
  const pendingMatch = await match('PENDING_COURT', null);
  const bookedMatch = await match('CONFIRMED', bookingId);
  for (const [req, m] of [[matchedReq, pendingMatch], [bookedReq, bookedMatch]]) {
    await c.query("INSERT INTO matchmaking_matches (matchmaking_request_id,match_id,status,matched_at) VALUES ($1,$2,'MATCHED',now())", [req, m]);
    await c.query("INSERT INTO match_players (match_id,player_id,team_no,status,joined_at) VALUES ($1,$2,1,'ACTIVE',now()),($1,$3,2,'ACTIVE',now())", [m, host, member]);
  }
  await c.query("INSERT INTO match_booking_cancellation_jobs (match_id,booking_id,status) VALUES ($1,$2,'PENDING')", [bookedMatch, bookingId]);
  return { host, member, other, openReq, matchedReq, bookedReq, cancelledReq, expiredReq, bookingId, bookedMatch };
}

describe('MM-21 migration 0014', () => {
  const name = `mm21_${process.pid}`;
  let admin: Client;
  let c: Client;
  let fx: Fixture;
  let snapshotBefore: { requests: unknown[]; invitations: unknown[] };

  beforeAll(async () => {
    admin = new Client({ connectionString: urlFor('badminton_db') });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    c = new Client({ connectionString: urlFor(name) });
    await c.connect();
    for (const file of before) await c.query(readFileSync(join(dir, file), 'utf8'));
    fx = await populate(c);
    snapshotBefore = {
      requests: (await c.query('SELECT id,player_id,match_type,status,preferred_date,preferred_start_time,expires_at,created_at,updated_at FROM matchmaking_requests ORDER BY id')).rows,
      invitations: (await c.query('SELECT id,request_id,inviter_id AS created_by,invitee_id AS player_id,status,expires_at,responded_at,created_at FROM matchmaking_invitations ORDER BY id')).rows,
    };
  });

  afterAll(async () => {
    await c?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  });

  async function stopsOn(setup: (client: Client) => Promise<void>, expected: RegExp) {
    await c.query('BEGIN');
    try {
      await setup(c);
      await c.query('SAVEPOINT mm21');
      await expect(c.query(mm21)).rejects.toThrow(expected);
      await c.query('ROLLBACK TO SAVEPOINT mm21');
      expect((await c.query("SELECT 1 FROM information_schema.columns WHERE table_name='matchmaking_invitations' AND column_name='player_id'")).rowCount).toBe(0);
    } finally {
      await c.query('ROLLBACK');
    }
  }

  it('read-only preflight reports the status counts and finds no anomaly on valid data', async () => {
    const outcome = await runMm21Preflight(urlFor(name));
    expect(outcome).toMatchObject({ ok: true, alreadyMigrated: false, anomalies: null });
    expect(outcome.notices.join('\n')).toMatch(/requests by status: CANCELLED=1, EXPIRED=1, MATCHED=2, OPEN=1/);
    expect(outcome.notices.join('\n')).toMatch(/Matches with booking_id: 1/);
  });

  it('stops with a report on a window shorter than the duration snapshot', async () => {
    await stopsOn(cl => cl.query('UPDATE matchmaking_requests SET match_duration_minutes = 180 WHERE id = $1', [fx.cancelledReq]).then(() => {}),
      new RegExp(`request ${fx.cancelledReq}: window shorter than duration snapshot`));
  });

  it('stops on a Player with both a pending and an accepted row, and on a booking shared by two requests', async () => {
    await stopsOn(cl => cl.query("INSERT INTO matchmaking_invitations (request_id,inviter_id,invitee_id,status,expires_at) VALUES ($1,$2,$3,'PENDING','2030-01-01')",
      [fx.openReq, fx.host, fx.member]).then(() => {}), /2 active rows/);
    await stopsOn(async cl => {
      const m = Number((await cl.query("INSERT INTO matches (match_type,scheduled_at,status,booking_id) VALUES ('SINGLES','2030-03-02','PENDING_COURT',NULL) RETURNING id")).rows[0].id);
      await cl.query("INSERT INTO matchmaking_matches (matchmaking_request_id,match_id,status,matched_at) VALUES ($1,$2,'MATCHED',now())", [fx.openReq, m]);
      await cl.query('UPDATE matches SET booking_id = NULL WHERE id = $1', [fx.bookedMatch]);
      await cl.query('UPDATE matches SET booking_id = $1 WHERE id = $2', [fx.bookingId, m]);
      const m2 = Number((await cl.query("INSERT INTO matches (match_type,scheduled_at,status) VALUES ('SINGLES','2030-03-02','CANCELLED') RETURNING id")).rows[0].id);
      await cl.query("INSERT INTO matchmaking_matches (matchmaking_request_id,match_id,status,matched_at) VALUES ($1,$2,'CANCELLED',now())", [fx.bookedReq, m2]);
      await cl.query('UPDATE matches SET booking_id = NULL WHERE id = $1', [m2]);
      await cl.query('ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_booking_id_unique');
      await cl.query('UPDATE matches SET booking_id = $1 WHERE id = $2', [fx.bookingId, m2]);
    }, /linked to several requests/);
  });

  it('migrates populated data: one post per request, history unchanged, booking source copied, no conversation', async () => {
    await c.query(mm21);
    const requests = (await c.query('SELECT * FROM matchmaking_requests ORDER BY id')).rows;
    const posts = (await c.query('SELECT * FROM posts ORDER BY id')).rows;
    expect(posts).toHaveLength(5);
    expect(new Set(requests.map(r => r.post_id)).size).toBe(5);
    for (const req of requests) {
      const post = posts.find(p => p.id === req.post_id)!;
      expect(post).toMatchObject({ type: 'MATCH_FINDING', published_at: null, author_id: req.player_id, creation_hash: null, title: null });
      expect(post.created_at.toISOString()).toBe('2026-05-01T01:02:03.000Z');
    }
    expect((await c.query('SELECT id,player_id,match_type,status,preferred_date,preferred_start_time,expires_at,created_at,updated_at FROM matchmaking_requests ORDER BY id')).rows).toEqual(snapshotBefore.requests);
    const byId = new Map(requests.map(r => [Number(r.id), r]));
    expect(byId.get(fx.openReq)).toMatchObject({ duration_minutes: 90, capacity: 4, min_players: 4, companion_count: 0, booking_id: null });
    expect(byId.get(fx.openReq)!.start_at.toISOString()).toBe('2030-03-01T03:00:00.000Z');
    expect(byId.get(fx.bookedReq)).toMatchObject({ duration_minutes: 120, capacity: 2, booking_id: String(fx.bookingId) });
    expect(byId.get(fx.bookedReq)!.start_at.toISOString()).toBe('2030-03-03T12:00:00.000Z');
    expect(byId.get(fx.expiredReq)).toMatchObject({ duration_minutes: 120 });

    expect((await c.query('SELECT id,request_id,created_by,player_id,status,expires_at,responded_at,created_at FROM matchmaking_invitations ORDER BY id')).rows).toEqual(snapshotBefore.invitations);
    expect((await c.query("SELECT count(*)::int AS n FROM matchmaking_invitations WHERE kind <> 'INVITE' OR decided_by IS NOT NULL OR close_reason IS NOT NULL")).rows[0].n).toBe(0);
    expect((await c.query('SELECT request_id FROM match_booking_cancellation_jobs')).rows[0].request_id).toBe(String(fx.bookedReq));
    expect((await c.query("SELECT to_regclass('conversations') AS t")).rows[0].t).toBeNull();
    expect((await c.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('uq_matchmaking_open_request','uq_matchmaking_invites_pending')")).rowCount).toBe(0);

    // AC: pending + accepted for one Player and request is rejected by the active-row index.
    await expect(c.query("INSERT INTO matchmaking_invitations (request_id,created_by,player_id,kind,status,expires_at) VALUES ($1,$2,$3,'INVITE','PENDING','2030-01-01')",
      [fx.openReq, fx.host, fx.member])).rejects.toMatchObject({ constraint: 'uq_matchmaking_membership_active' });
    await expect(c.query("INSERT INTO matchmaking_invitations (request_id,created_by,player_id,kind,status,expires_at) VALUES ($1,$2,$2,'INVITE','PENDING','2030-01-01')",
      [fx.openReq, fx.other])).rejects.toMatchObject({ constraint: 'chk_matchmaking_invitations_invite_not_self' });
    await expect(c.query("UPDATE match_players SET team_no = 3 WHERE match_id = $1", [fx.bookedMatch]))
      .rejects.toMatchObject({ constraint: 'chk_match_players_team_no' });
    expect((await runMm21Preflight(urlFor(name))).alreadyMigrated).toBe(true);
  });
});

describe('MM-21 migration on a fresh database', () => {
  it('applies every migration in order on an empty database', async () => {
    const name = `mm21_${process.pid}_fresh`;
    const admin = new Client({ connectionString: urlFor('badminton_db') });
    await admin.connect();
    let c: Client | undefined;
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      c = new Client({ connectionString: urlFor(name) });
      await c.connect();
      for (const file of files) await c.query(readFileSync(join(dir, file), 'utf8'));
      const notNull = (await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='matchmaking_requests' AND is_nullable='NO' AND column_name IN ('post_id','start_at','duration_minutes','capacity','min_players') ORDER BY 1")).rows;
      expect(notNull.map(r => r.column_name)).toEqual(['capacity', 'duration_minutes', 'min_players', 'post_id', 'start_at']);
    } finally {
      await c?.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
    }
  });
});
