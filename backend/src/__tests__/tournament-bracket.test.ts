import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, pool } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { matches, matchPlayers } from '../db/schema/matchmaking';
import { tournaments, tournamentMatches, tournamentRegistrations } from '../db/schema/tournaments';
import { createTestUser } from './test-helpers';

// TRN-04 — seeds, draw and bracket persistence (Tournament Tech Design §3.3, §7.1, §7.2).

const DAY = 86_400_000;
let levelIdByRank: Map<number, number>;

beforeEach(async () => {
  const levels = await db.select().from(skillLevels);
  levelIdByRank = new Map(levels.map(level => [level.rank, level.id]));
});

async function player(rank = 4) {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `VĐV ${user.id}`, skillLevelId: levelIdByRank.get(rank)! });
  return user.id;
}

const api = (userId: number | null) => ({
  get: (url: string) => (userId ? request(app).get(url).set('x-user-id', String(userId)) : request(app).get(url)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  put: (url: string, body: object) => request(app).put(url).set('x-user-id', String(userId)).send(body),
});

/** A REGISTRATION_CLOSED Singles tournament with one confirmed registration per rank. */
async function closedTournament(ranks: number[]) {
  const organizer = await player();
  const now = Date.now();
  const [t] = await db.insert(tournaments).values({
    creatorId: organizer, name: 'Giải bốc thăm', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES', participantLimit: 32,
    status: 'REGISTRATION_CLOSED', venueNote: 'Sân A', registrationStart: new Date(now - 3 * DAY), registrationEnd: new Date(now - DAY),
    tournamentStart: new Date(now + DAY), tournamentEnd: new Date(now + 2 * DAY),
  }).returning();
  const regs: Array<{ id: number; playerId: number; rank: number }> = [];
  for (const rank of ranks) {
    const playerId = await player(rank);
    const [reg] = await db.insert(tournamentRegistrations).values({
      tournamentId: t.id, playerId, registrationType: 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
    }).returning();
    regs.push({ id: reg.id, playerId, rank });
  }
  return { organizer, tournamentId: t.id, version: t.version, regs };
}

const currentVersion = async (id: number) => (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version;

describe('seeds', () => {
  it('suggests seeds by skill (stable across reads) and is Organizer-only', async () => {
    const { organizer, tournamentId, regs } = await closedTournament([3, 6, 4, 7]);
    const url = `/api/v1/tournaments/${tournamentId}/seeds`;
    const first = await api(organizer).get(url);
    expect(first.body.data.editable).toBe(true);
    const suggested = first.body.data.entries.map((e: { registrationId: number; suggestedSeedNo: number }) => [e.registrationId, e.suggestedSeedNo]);
    expect(suggested).toEqual([[regs[3].id, 1], [regs[1].id, 2], [regs[2].id, 3], [regs[0].id, 4]]);
    expect((await api(organizer).get(url)).body.data.entries).toEqual(first.body.data.entries);
    expect((await api(await player()).get(url)).body.error.code).toBe('TOURNAMENT_FORBIDDEN');
  });

  it('validates and saves seeds 1..k', async () => {
    const { organizer, tournamentId, version, regs } = await closedTournament([4, 4, 4]);
    const url = `/api/v1/tournaments/${tournamentId}/seeds`;
    const gap = await api(organizer).put(url, { version, seeds: [{ registrationId: regs[0].id, seedNo: 2 }] });
    expect(gap.body.error).toMatchObject({ code: 'TOURNAMENT_SEED_INVALID', details: [{ code: 'SEEDS_MUST_BE_1_TO_K' }] });
    const foreign = await api(organizer).put(url, { version, seeds: [{ registrationId: 999999, seedNo: 1 }] });
    expect(foreign.body.error.details[0].code).toBe('NOT_A_CONFIRMED_REGISTRATION');
    const ok = await api(organizer).put(url, { version, seeds: [{ registrationId: regs[2].id, seedNo: 1 }, { registrationId: regs[0].id, seedNo: 2 }] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.version).toBe(version + 1);
    const saved = await db.select({ id: tournamentRegistrations.id, seedNo: tournamentRegistrations.seedNo }).from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.tournamentId, tournamentId));
    expect(Object.fromEntries(saved.map(r => [r.id, r.seedNo]))).toEqual({ [regs[0].id]: 2, [regs[1].id]: null, [regs[2].id]: 1 });
    expect((await api(organizer).put(url, { version, seeds: [] })).body.error.code).toBe('TOURNAMENT_VERSION_CONFLICT');
  });
});

describe('draw', () => {
  it('persists a 5-player bracket of size 8 with BYEs to the top 3 seeds, links and rosters, then locks', async () => {
    const { organizer, tournamentId, version, regs } = await closedTournament([7, 6, 5, 4, 3]);
    const res = await api(organizer).post(`/api/v1/tournaments/${tournamentId}/draw`, { version });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'READY', drawSeed: expect.any(Number) });

    // No seeds were saved → the suggestion became the seeds.
    const seeds = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.tournamentId, tournamentId));
    expect(Object.fromEntries(seeds.map(r => [r.id, r.seedNo]))).toEqual(Object.fromEntries(regs.map((r, i) => [r.id, i + 1])));

    const rows = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));
    expect(rows).toHaveLength(4); // 8 - 1 - 3 BYEs
    expect(rows.filter(r => r.nextMatchId === null)).toHaveLength(1); // the final
    expect(rows.every(r => r.resolution === 'UNRESOLVED')).toBe(true);
    const matchRows = await db.select().from(matches);
    expect(matchRows.every(m => m.matchType === 'SINGLES' && m.status === 'CONFIRMED')).toBe(true);
    // Round 0: seeds 4 v 5. Round 1: seed 1 v (winner) and seeds 2 v 3 (playable). Final.
    const playable = rows.filter(r => r.registration1Id !== null && r.registration2Id !== null);
    expect(playable.map(r => [r.roundIndex, [r.registration1Id, r.registration2Id].sort()])).toEqual(expect.arrayContaining([
      [0, [regs[3].id, regs[4].id].sort()], [1, [regs[1].id, regs[2].id].sort()],
    ]));
    expect(await db.select().from(matchPlayers)).toHaveLength(4);

    const bracket = await api(null).get(`/api/v1/tournaments/${tournamentId}/bracket`);
    expect(bracket.body.data).toMatchObject({ generated: true, totalRounds: 3 });
    const byeIds = bracket.body.data.rounds.flatMap((round: { matches: Array<{ slot1: { fromBye: boolean; registrationId: number }; slot2: { fromBye: boolean; registrationId: number } }> }) =>
      round.matches.flatMap(m => [m.slot1, m.slot2]).filter(s => s.fromBye).map(s => s.registrationId));
    expect(byeIds.sort()).toEqual([regs[0].id, regs[1].id, regs[2].id].sort());

    const v = await currentVersion(tournamentId);
    // A retry with the pre-draw version still reports the real reason.
    expect((await api(organizer).post(`/api/v1/tournaments/${tournamentId}/draw`, { version })).body.error.code).toBe('TOURNAMENT_BRACKET_ALREADY_GENERATED');
    expect((await api(organizer).post(`/api/v1/tournaments/${tournamentId}/draw`, { version: v })).body.error.code).toBe('TOURNAMENT_BRACKET_ALREADY_GENERATED');
    expect((await api(organizer).put(`/api/v1/tournaments/${tournamentId}/seeds`, { version: v, seeds: [] })).body.error.code).toBe('TOURNAMENT_BRACKET_ALREADY_GENERATED');
    expect((await api(organizer).get(`/api/v1/tournaments/${tournamentId}/seeds`)).body.data.editable).toBe(false);
  });

  it('rejects a draw with fewer than 2 registrations', async () => {
    const { organizer, tournamentId, version } = await closedTournament([4]);
    expect((await api(organizer).post(`/api/v1/tournaments/${tournamentId}/draw`, { version })).body.error.code).toBe('TOURNAMENT_NOT_ENOUGH_PARTICIPANTS');
  });

  it('leaves nothing behind when the draw fails half-way', async () => {
    const { organizer, tournamentId, version } = await closedTournament([4, 4, 4, 4, 4, 4]);
    await pool.query(`CREATE OR REPLACE FUNCTION test_fail_bracket() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.round_index = 1 THEN RAISE EXCEPTION 'bracket insert failed'; END IF; RETURN NEW; END $$`);
    await pool.query('CREATE TRIGGER test_fail_bracket BEFORE INSERT ON tournament_matches FOR EACH ROW EXECUTE FUNCTION test_fail_bracket()');
    let res;
    try {
      res = await api(organizer).post(`/api/v1/tournaments/${tournamentId}/draw`, { version });
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS test_fail_bracket ON tournament_matches');
      await pool.query('DROP FUNCTION IF EXISTS test_fail_bracket()');
    }
    expect(res.status).toBe(500);
    expect(await db.select().from(tournamentMatches)).toHaveLength(0);
    expect(await db.select().from(matches)).toHaveLength(0);
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    expect(t).toMatchObject({ status: 'REGISTRATION_CLOSED', drawSeed: null, version });
    expect((await db.select().from(tournamentRegistrations)).every(r => r.seedNo === null)).toBe(true);
  });

  it('hides the bracket of a DRAFT and reports an empty bracket before the draw', async () => {
    const { tournamentId } = await closedTournament([4, 4]);
    expect((await api(null).get(`/api/v1/tournaments/${tournamentId}/bracket`)).body.data).toEqual({ generated: false, totalRounds: 0, rounds: [] });
    await db.update(tournaments).set({ status: 'DRAFT' }).where(eq(tournaments.id, tournamentId));
    expect((await api(null).get(`/api/v1/tournaments/${tournamentId}/bracket`)).status).toBe(404);
  });
});
