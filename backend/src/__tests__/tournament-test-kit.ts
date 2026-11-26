import { expect } from 'vitest';
import request from 'supertest';
import { asc, eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { tournamentMatches, tournaments } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { createTestUser } from './test-helpers';

/** Shared helpers to run whole tournaments through the API (TRN-16, TRN-14, TRN-18 tests). */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const api = (userId: number) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', String(userId)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  put: (url: string, body: object = {}) => request(app).put(url).set('x-user-id', String(userId)).send(body),
  patch: (url: string, body: object = {}) => request(app).patch(url).set('x-user-id', String(userId)).send(body),
  delete: (url: string) => request(app).delete(url).set('x-user-id', String(userId)),
});

export async function levelIds(): Promise<Map<number, number>> {
  const levels = await db.select().from(skillLevels);
  return new Map(levels.map(level => [level.rank, level.id]));
}

export async function makePlayer(options: { rank?: number; topUp?: number; name?: string } = {}): Promise<number> {
  const user = await createTestUser({ role: 'PLAYER' });
  const ids = await levelIds();
  await db.insert(playerProfiles).values({ userId: user.id, fullName: options.name ?? `Người chơi ${user.id}`, skillLevelId: ids.get(options.rank ?? 4)! });
  if (options.topUp) await walletService.credit({ userId: user.id, amount: String(options.topUp), entryType: 'TOP_UP', idempotencyKey: `test-topup:${user.id}` });
  return user.id;
}

export const versionOf = async (id: number) => (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version;

export async function openTournament(organizer: number, overrides: Record<string, unknown> = {}): Promise<number> {
  const now = Date.now();
  const created = await api(organizer).post('/api/v1/tournaments', {
    name: 'Giải kiểm thử', matchType: 'SINGLES', participantLimit: 16, entryFee: 0, venueNote: 'Sân test',
    registrationStart: new Date(now - HOUR).toISOString(), registrationEnd: new Date(now + DAY).toISOString(),
    tournamentStart: new Date(now + 2 * DAY).toISOString(), tournamentEnd: new Date(now + 3 * DAY).toISOString(),
    ...overrides,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const opened = await api(organizer).post(`/api/v1/tournaments/${created.body.data.id}/open`, { version: 1 });
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
  return created.body.data.id;
}

/** Registers Singles players, closes and draws. Returns registration id by player. */
export async function drawSingles(organizer: number, id: number, players: number[]): Promise<Map<number, number>> {
  const regs = new Map<number, number>();
  for (const p of players) {
    const res = await api(p).post(`/api/v1/tournaments/${id}/registrations`);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    regs.set(p, res.body.data.id);
  }
  const closed = await api(organizer).post(`/api/v1/tournaments/${id}/close`, { version: await versionOf(id) });
  expect(closed.status, JSON.stringify(closed.body)).toBe(200);
  const drawn = await api(organizer).post(`/api/v1/tournaments/${id}/draw`, { version: await versionOf(id) });
  expect(drawn.status, JSON.stringify(drawn.body)).toBe(200);
  return regs;
}

/**
 * Plays every playable match round by round; `winner(reg1, reg2)` picks the winning registration
 * (default: lower registration id). Stops when no playable unresolved match remains.
 */
export async function playAll(organizer: number, id: number, winner: (a: number, b: number) => number = (a, b) => Math.min(a, b),
  result: (winnerSlot: 1 | 2) => object = slot => ({ type: 'SETS', sets: slot === 1 ? [{ team1Score: 21, team2Score: 15 }, { team1Score: 21, team2Score: 17 }] : [{ team1Score: 15, team2Score: 21 }, { team1Score: 17, team2Score: 21 }] })) {
  for (let guard = 0; guard < 64; guard++) {
    const rows = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id)).orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex));
    const next = rows.find(r => r.resolution === 'UNRESOLVED' && r.registration1Id !== null && r.registration2Id !== null);
    if (!next) return;
    const w = winner(next.registration1Id!, next.registration2Id!);
    const body = result(w === next.registration1Id ? 1 : 2) as { type: string };
    if (body.type === 'SETS' || body.type === 'RETIRED') {
      const started = await api(organizer).post(`/api/v1/tournaments/${id}/matches/${next.id}/start`);
      expect(started.status, JSON.stringify(started.body)).toBe(200);
    }
    const res = await api(organizer).put(`/api/v1/tournaments/${id}/matches/${next.id}/result`, body);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
}

export async function complete(organizer: number, id: number) {
  const res = await api(organizer).post(`/api/v1/tournaments/${id}/complete`, { version: await versionOf(id) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res;
}
