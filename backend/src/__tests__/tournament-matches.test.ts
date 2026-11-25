import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { matches, matchGames, matchPlayers } from '../db/schema/matchmaking';
import { tournaments, tournamentMatches, tournamentRegistrations } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { createTestUser } from './test-helpers';

// TRN-06 — match operations: start, sets, retirement, walkover, cancel, corrections, advancement.

const DAY = 86_400_000;
let levelId: number;
beforeEach(async () => {
  levelId = (await db.select().from(skillLevels).where(eq(skillLevels.rank, 4)))[0].id;
});

async function player() {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `VĐV ${user.id}`, skillLevelId: levelId });
  return user.id;
}

const api = (userId: number) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', String(userId)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  put: (url: string, body: object) => request(app).put(url).set('x-user-id', String(userId)).send(body),
});

type Slot = { registrationId: number | null };
type BracketMatch = { id: number; roundIndex: number; matchIndex: number; slot1: Slot; slot2: Slot; winnerRegistrationId: number | null; resolution: string; status: string; sets: unknown[]; nextMatchId: number | null };

/** n paid (10 000 each) Singles registrations, drawn → READY. */
async function readyTournament(n: number) {
  const organizer = await player();
  const [t] = await db.insert(tournaments).values({
    creatorId: organizer, name: 'Giải thi đấu', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES', participantLimit: 16, entryFee: '10000',
    status: 'REGISTRATION_CLOSED', venueNote: 'Sân A', registrationStart: new Date(Date.now() - 2 * DAY),
    registrationEnd: new Date(Date.now() - DAY), tournamentStart: new Date(Date.now() + DAY), tournamentEnd: new Date(Date.now() + 2 * DAY),
  }).returning();
  for (let i = 0; i < n; i += 1) {
    const p = await player();
    await db.insert(tournamentRegistrations).values({
      tournamentId: t.id, playerId: p, payerId: p, paidAmount: '10000.00', registrationType: 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
    });
  }
  const drawn = await api(organizer).post(`/api/v1/tournaments/${t.id}/draw`, { version: t.version });
  expect(drawn.status, JSON.stringify(drawn.body)).toBe(200);
  return { organizer, id: t.id };
}

const bracket = async (organizer: number, id: number): Promise<BracketMatch[]> =>
  (await api(organizer).get(`/api/v1/tournaments/${id}/bracket`)).body.data.rounds.flatMap((r: { matches: BracketMatch[] }) => r.matches);
const url = (id: number, matchId: number, action: string) => `/api/v1/tournaments/${id}/matches/${matchId}/${action}`;
const win1 = { type: 'SETS', sets: [{ team1Score: 21, team2Score: 15 }, { team1Score: 21, team2Score: 18 }] };
const win2 = { type: 'SETS', sets: [{ team1Score: 19, team2Score: 21 }, { team1Score: 21, team2Score: 17 }, { team1Score: 25, team2Score: 27 }] };

async function play(organizer: number, id: number, m: BracketMatch, body: object = win1) {
  expect((await api(organizer).post(url(id, m.id, 'start'))).status).toBe(200);
  const res = await api(organizer).put(url(id, m.id, 'result'), body);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

describe('match operations', () => {
  it('plays a full 8-player tournament through the API and credits the Organizer on completion', async () => {
    const { organizer, id } = await readyTournament(8);
    for (let round = 0; round < 3; round += 1) {
      for (const m of (await bracket(organizer, id)).filter(x => x.roundIndex === round)) await play(organizer, id, m, round === 1 ? win2 : win1);
    }
    const final = (await bracket(organizer, id)).find(m => m.nextMatchId === null)!;
    expect(final).toMatchObject({ resolution: 'WINNER_DECLARED', status: 'COMPLETED' });
    expect(final.winnerRegistrationId).toBe(final.slot1.registrationId);
    expect((await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].status).toBe('IN_PROGRESS');
    expect(await db.select().from(matchPlayers)).toHaveLength(14); // 7 matches × 2 players
    const version = (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version;
    const done = await api(organizer).post(`/api/v1/tournaments/${id}/complete`, { version });
    expect(done.body.data.status).toBe('COMPLETED');
    expect(Number((await walletService.getWallet(organizer)).balance)).toBe(80000);
  });

  it('rejects invalid scores, results before the start, unplayable matches and other users', async () => {
    const { organizer, id } = await readyTournament(5);
    const all = await bracket(organizer, id);
    const playable = all.find(m => m.roundIndex === 0)!;
    const waiting = all.find(m => m.slot1.registrationId === null || m.slot2.registrationId === null)!;
    expect((await api(organizer).put(url(id, playable.id, 'result'), win1)).body.error.code).toBe('TOURNAMENT_MATCH_LOCKED');
    expect((await api(organizer).post(url(id, waiting.id, 'start'))).body.error.code).toBe('TOURNAMENT_MATCH_NOT_PLAYABLE');
    expect((await api(await player()).post(url(id, playable.id, 'start'))).body.error.code).toBe('TOURNAMENT_FORBIDDEN');
    await api(organizer).post(url(id, playable.id, 'start'));
    expect((await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].status).toBe('IN_PROGRESS');
    const bad = await api(organizer).put(url(id, playable.id, 'result'), { type: 'SETS', sets: [{ team1Score: 21, team2Score: 20 }, { team1Score: 21, team2Score: 10 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatchObject({ code: 'TOURNAMENT_RESULT_INVALID', details: [{ setNo: 1, reason: 'NOT_A_FINISHED_SET' }] });
    expect((await api(organizer).put(url(id, playable.id, 'result'), { type: 'SETS', sets: [{ team1Score: 31, team2Score: 29 }] })).status).toBe(400);
  });

  it('records walkovers without play, retirements with partial sets, and cancellations without advancement', async () => {
    const { organizer, id } = await readyTournament(8);
    const [a, b, c] = (await bracket(organizer, id)).filter(m => m.roundIndex === 0);
    const walkover = await api(organizer).put(url(id, a.id, 'result'), { type: 'WALKOVER', winnerSlot: 2, reason: 'Không đến' });
    expect(walkover.status).toBe(200);
    await api(organizer).post(url(id, b.id, 'start'));
    await api(organizer).put(url(id, b.id, 'result'), { type: 'RETIRED', retiredSlot: 1, sets: [{ team1Score: 21, team2Score: 18 }, { team1Score: 9, team2Score: 11 }] });
    await api(organizer).put(url(id, c.id, 'result'), { type: 'CANCEL', reason: 'Mất điện' });
    const after = await bracket(organizer, id);
    const semi = after.find(m => m.id === a.nextMatchId)!;
    expect([semi.slot1.registrationId, semi.slot2.registrationId]).toEqual([a.slot2.registrationId, b.slot2.registrationId]);
    expect(after.find(m => m.id === b.id)).toMatchObject({ resolution: 'RETIRED', winnerRegistrationId: b.slot2.registrationId, sets: [{ setNo: 1 }, { setNo: 2 }] });
    expect(after.find(m => m.id === c.id)).toMatchObject({ resolution: 'NONE', status: 'CANCELLED', winnerRegistrationId: null });
    const otherSemi = after.find(m => m.id === c.nextMatchId)!;
    expect(otherSemi.slot1.registrationId === c.slot1.registrationId || otherSemi.slot2.registrationId === c.slot1.registrationId).toBe(false);
    // The semi between the walkover and retirement winners is playable and has a roster.
    expect(await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, (await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, semi.id)))[0].matchId))).toHaveLength(2);
  });

  it('corrects a winner while the next match has not started, and locks it afterwards', async () => {
    const { organizer, id } = await readyTournament(4);
    const [a, b] = (await bracket(organizer, id)).filter(m => m.roundIndex === 0);
    await play(organizer, id, a, win1);
    await play(organizer, id, b, win1);
    const corrected = await api(organizer).put(url(id, a.id, 'result'), { type: 'SETS', sets: [{ team1Score: 15, team2Score: 21 }, { team1Score: 18, team2Score: 21 }] });
    expect(corrected.status).toBe(200);
    const final = (await bracket(organizer, id)).find(m => m.nextMatchId === null)!;
    expect([final.slot1.registrationId, final.slot2.registrationId]).toContain(a.slot2.registrationId);
    const finalMatchId = (await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, final.id)))[0].matchId;
    const roster = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, finalMatchId));
    expect(roster.map(r => r.playerId)).not.toContain((await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.id, a.slot1.registrationId!)))[0].playerId);
    await api(organizer).post(url(id, final.id, 'start'));
    expect((await api(organizer).put(url(id, a.id, 'result'), win1)).body.error.code).toBe('TOURNAMENT_MATCH_LOCKED');
  });

  it('allows score corrections within 48 h after completion but never a non-final winner change', async () => {
    const { organizer, id } = await readyTournament(2);
    const [final] = await bracket(organizer, id);
    await play(organizer, id, final, win1);
    const version = (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version;
    expect((await api(organizer).post(`/api/v1/tournaments/${id}/complete`, { version })).body.data.status).toBe('COMPLETED');
    const fixScore = await api(organizer).put(url(id, final.id, 'result'), { type: 'SETS', sets: [{ team1Score: 21, team2Score: 10 }, { team1Score: 21, team2Score: 12 }] });
    expect(fixScore.status, JSON.stringify(fixScore.body)).toBe(200);
    const games = await db.select().from(matchGames).where(eq(matchGames.matchId, (await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, final.id)))[0].matchId));
    expect(games.map(g => [g.team1Score, g.team2Score])).toEqual([[21, 10], [21, 12]]);
    await db.update(tournaments).set({ completedAt: new Date(Date.now() - 49 * 3_600_000) }).where(eq(tournaments.id, id));
    expect((await api(organizer).put(url(id, final.id, 'result'), win1)).body.error.code).toBe('TOURNAMENT_CORRECTION_WINDOW_CLOSED');

    const four = await readyTournament(4);
    for (const round of [0, 1]) for (const m of (await bracket(four.organizer, four.id)).filter(x => x.roundIndex === round)) await play(four.organizer, four.id, m, win1);
    const v = (await db.select().from(tournaments).where(eq(tournaments.id, four.id)))[0].version;
    await api(four.organizer).post(`/api/v1/tournaments/${four.id}/complete`, { version: v });
    const semi = (await bracket(four.organizer, four.id)).find(m => m.roundIndex === 0)!;
    expect((await api(four.organizer).put(url(four.id, semi.id, 'result'), win2)).body.error.code).toBe('TOURNAMENT_MATCH_LOCKED');
    expect((await api(four.organizer).put(url(four.id, semi.id, 'result'), { type: 'WALKOVER', winnerSlot: 1 })).body.error.code).toBe('TOURNAMENT_MATCH_LOCKED');
    const before = (await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, semi.id)))[0];
    const completedBefore = (await db.select().from(matches).where(eq(matches.id, before.matchId)))[0].completedAt;
    expect((await api(four.organizer).put(url(four.id, semi.id, 'result'), { type: 'SETS', sets: [{ team1Score: 21, team2Score: 3 }, { team1Score: 21, team2Score: 4 }] })).status).toBe(200);
    expect((await db.select().from(matches).where(eq(matches.id, before.matchId)))[0].completedAt).toEqual(completedBefore);
  });
});

describe('cancellation before play', () => {
  it('does not start the tournament', async () => {
    const { organizer, id } = await readyTournament(4);
    const [a] = (await bracket(organizer, id)).filter(m => m.roundIndex === 0);
    expect((await api(organizer).put(url(id, a.id, 'result'), { type: 'CANCEL', reason: 'Sân hỏng' })).status).toBe(200);
    expect((await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].status).toBe('READY');
  });
});
