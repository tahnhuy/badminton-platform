import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { payments, paymentRefunds } from '../db/schema/bookings';
import { walletLedgerEntries } from '../db/schema/wallet';
import { matches } from '../db/schema/matchmaking';
import { tournaments, tournamentMatches, tournamentRegistrations } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { tournamentFeeService } from '../services/tournaments/TournamentFeeService';
import { createTestUser } from './test-helpers';

// TRN-03 — Singles registration, eligibility, wallet fees, withdraw/remove/refund, Organizer credit.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let levelIdByRank: Map<number, number>;

beforeEach(async () => {
  const levels = await db.select().from(skillLevels);
  levelIdByRank = new Map(levels.map(level => [level.rank, level.id]));
});

async function player(rank = 4, topUp = 0) {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `Người chơi ${user.id}`, skillLevelId: levelIdByRank.get(rank)! });
  if (topUp > 0) await walletService.credit({ userId: user.id, amount: String(topUp), entryType: 'TOP_UP', idempotencyKey: `test-topup:${user.id}` });
  return user.id;
}

const balance = async (userId: number) => Number((await walletService.getWallet(userId)).balance);
const api = (userId: number | null) => ({
  get: (url: string) => (userId ? request(app).get(url).set('x-user-id', String(userId)) : request(app).get(url)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  delete: (url: string) => request(app).delete(url).set('x-user-id', String(userId)),
});

async function openTournament(organizer: number, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const created = await api(organizer).post('/api/v1/tournaments', {
    name: 'Giải test đăng ký', matchType: 'SINGLES', participantLimit: 8, entryFee: 0, venueNote: 'Sân A',
    registrationStart: new Date(now - HOUR).toISOString(), registrationEnd: new Date(now + DAY).toISOString(),
    tournamentStart: new Date(now + 2 * DAY).toISOString(), tournamentEnd: new Date(now + 3 * DAY).toISOString(),
    ...overrides,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const opened = await api(organizer).post(`/api/v1/tournaments/${created.body.data.id}/open`, { version: 1 });
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
  return opened.body.data as { id: number; version: number };
}

const register = (userId: number, tournamentId: number) => api(userId).post(`/api/v1/tournaments/${tournamentId}/registrations`);
const version = async (tournamentId: number) => (await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)))[0].version;

describe('Singles registration', () => {
  it('confirms a free registration at once and lists the participant without contact data', async () => {
    const organizer = await player();
    const t = await openTournament(organizer);
    const p = await player(4);
    const res = await register(p, t.id);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'CONFIRMED', registrationType: 'SINGLES', paidAmount: 0, refundedAt: null });
    expect(await db.select().from(payments)).toHaveLength(0);
    const list = await api(null).get(`/api/v1/tournaments/${t.id}/registrations`);
    expect(list.body.data).toEqual([{
      registrationId: res.body.data.id, seedNo: null, registeredAt: expect.any(String), teamName: null,
      players: [{ id: p, fullName: `Người chơi ${p}`, avatarUrl: null, skillLevel: expect.objectContaining({ rank: 4 }) }],
    }]);
    expect(JSON.stringify(list.body)).not.toContain('@');
  });

  it('rejects the Organizer, Doubles without a team, outside the window, ineligible levels and duplicates', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { minSkillLevelId: levelIdByRank.get(3), maxSkillLevelId: levelIdByRank.get(5) });
    expect((await register(organizer, t.id)).body.error.code).toBe('TOURNAMENT_ORGANIZER_CANNOT_PLAY');
    const low = await register(await player(2), t.id);
    expect(low.status).toBe(403);
    expect(low.body.error).toMatchObject({ code: 'TOURNAMENT_NOT_ELIGIBLE', details: [{ code: 'BELOW_MIN_LEVEL', minRank: 3, maxRank: 5, playerRank: 2 }] });
    const p = await player(4);
    expect((await register(p, t.id)).status).toBe(201);
    expect((await register(p, t.id)).body.error.code).toBe('TOURNAMENT_ALREADY_REGISTERED');

    const doubles = await openTournament(organizer, { matchType: 'DOUBLES' });
    expect((await register(p, doubles.id)).body.error.code).toBe('TOURNAMENT_TEAM_REQUIRED');

    const later = await openTournament(organizer, { registrationStart: new Date(Date.now() + HOUR).toISOString() });
    expect((await register(p, later.id)).body.error.code).toBe('TOURNAMENT_REGISTRATION_CLOSED');
    const draft = (await api(organizer).post('/api/v1/tournaments', {
      name: 'Nháp', matchType: 'SINGLES', registrationStart: new Date(Date.now() - HOUR).toISOString(),
      registrationEnd: new Date(Date.now() + DAY).toISOString(), tournamentStart: new Date(Date.now() + 2 * DAY).toISOString(),
      tournamentEnd: new Date(Date.now() + 3 * DAY).toISOString(),
    })).body.data;
    expect((await register(p, draft.id)).status).toBe(404);
  });

  it('gives the last slot to exactly one of many concurrent Players and charges only that Player', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { participantLimit: 2, entryFee: 50000 });
    expect((await register(await player(4, 50000), t.id)).status).toBe(201);
    // 12 racers > the 10-connection pool: no request may need a second connection while holding the lock.
    const racers = await Promise.all(Array.from({ length: 12 }, () => player(4, 50000)));
    const results = await Promise.all(racers.map(id => register(id, t.id)));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 409).every(r => r.body.error.code === 'TOURNAMENT_FULL')).toBe(true);
    const balances = await Promise.all(racers.map(balance));
    expect(balances.filter(b => b === 0)).toHaveLength(1);
    expect(balances.filter(b => b === 50000)).toHaveLength(11);
  });

  it('rejects a team id on a Singles tournament (TRN-09)', async () => {
    const organizer = await player();
    const t = await openTournament(organizer);
    const res = await api(await player()).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_TEAM_NOT_ALLOWED');
  });
});

describe('Entry fees through the wallet', () => {
  it('debits the fee, records a SUCCESS payment and a PAYMENT ledger entry', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 120000 });
    const p = await player(4, 200000);
    const res = await register(p, t.id);
    expect(res.body.data.paidAmount).toBe(120000);
    expect(await balance(p)).toBe(80000);
    const [payment] = await db.select().from(payments).where(eq(payments.registrationId, res.body.data.id));
    expect(payment).toMatchObject({ provider: 'WALLET', status: 'SUCCESS', amount: '120000.00', bookingId: null });
    const ledger = await db.select().from(walletLedgerEntries).where(and(eq(walletLedgerEntries.userId, p), eq(walletLedgerEntries.entryType, 'PAYMENT')));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: '-120000.00', referenceType: 'TOURNAMENT_REGISTRATION', referenceId: res.body.data.id });
  });

  it('rejects an insufficient balance without creating a registration', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 120000 });
    const p = await player(4, 100000);
    const res = await register(p, t.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE', details: [{ required: '120000.00', balance: '100000.00' }] });
    expect(await db.select().from(tournamentRegistrations)).toHaveLength(0);
    expect(await balance(p)).toBe(100000);
  });

  it('refunds a withdrawal once, allows registering again, and forbids withdrawing after close', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 100000 });
    const p = await player(4, 300000);
    const first = (await register(p, t.id)).body.data;
    const out = await api(p).delete(`/api/v1/tournaments/${t.id}/registrations/${first.id}`);
    expect(out.body.data).toMatchObject({ status: 'CANCELLED', refundedAt: expect.any(String) });
    expect(await balance(p)).toBe(300000);
    const [payment] = await db.select().from(payments).where(eq(payments.registrationId, first.id));
    expect(payment.status).toBe('REFUNDED');
    expect(await db.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, payment.id))).toEqual([
      expect.objectContaining({ status: 'REFUNDED', reason: 'rút đăng ký' }),
    ]);
    expect((await api(p).delete(`/api/v1/tournaments/${t.id}/registrations/${first.id}`)).status).toBe(404);
    expect(await balance(p)).toBe(300000);
    expect((await api(await player()).delete(`/api/v1/tournaments/${t.id}/registrations/${first.id}`)).status).toBe(403);

    const again = (await register(p, t.id)).body.data;
    expect(again.id).not.toBe(first.id);
    expect(await balance(p)).toBe(200000);
    await register(await player(4, 100000), t.id);
    expect((await api(organizer).post(`/api/v1/tournaments/${t.id}/close`, { version: await version(t.id) })).body.data.status).toBe('REGISTRATION_CLOSED');
    expect((await api(p).delete(`/api/v1/tournaments/${t.id}/registrations/${again.id}`)).body.error.code).toBe('TOURNAMENT_REGISTRATION_CLOSED');
  });

  it('forbids withdrawing once registration_end has passed, even before the tournament is closed', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 10000 });
    const p = await player(4, 10000);
    const reg = (await register(p, t.id)).body.data;
    await db.update(tournaments).set({ registrationEnd: new Date(Date.now() - 1000) }).where(eq(tournaments.id, t.id));
    expect((await api(p).delete(`/api/v1/tournaments/${t.id}/registrations/${reg.id}`)).body.error.code).toBe('TOURNAMENT_REGISTRATION_CLOSED');
    expect(await balance(p)).toBe(0);
  });

  it('refunds exactly once when a withdrawal races a second withdrawal and the cancellation', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 40000 });
    const p = await player(4, 40000);
    const reg = (await register(p, t.id)).body.data;
    const url = `/api/v1/tournaments/${t.id}/registrations/${reg.id}`;
    const results = await Promise.all([
      api(p).delete(url),
      api(p).delete(url),
      api(organizer).post(`/api/v1/tournaments/${t.id}/cancel`, { version: await version(t.id) }),
    ]);
    expect(results.some(r => r.status === 200)).toBe(true);
    expect(await balance(p)).toBe(40000);
    expect(await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'REFUND'))).toHaveLength(1);
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);
  });

  it('refunds the single paid registration when closing cancels the tournament', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 30000 });
    const p = await player(4, 30000);
    await register(p, t.id);
    const closed = await api(organizer).post(`/api/v1/tournaments/${t.id}/close`, { version: await version(t.id) });
    expect(closed.body.data.status).toBe('CANCELLED');
    expect(await balance(p)).toBe(30000);
  });

  it('lets only the Organizer remove a participant with a refund and renumbers seeds', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 50000 });
    const ps = await Promise.all([0, 1, 2].map(() => player(4, 50000)));
    const regs = [];
    for (const p of ps) regs.push((await register(p, t.id)).body.data.id);
    await api(organizer).post(`/api/v1/tournaments/${t.id}/close`, { version: await version(t.id) });
    for (const [i, id] of regs.entries()) await db.update(tournamentRegistrations).set({ seedNo: i + 1 }).where(eq(tournamentRegistrations.id, id));
    const url = `/api/v1/tournaments/${t.id}/registrations/${regs[0]}/remove`;
    expect((await api(ps[1]).post(url, { reason: 'x' })).status).toBe(403);
    const removed = await api(organizer).post(url, { reason: 'Sai trình độ' });
    expect(removed.body.data).toMatchObject({ status: 'REMOVED', refundedAt: expect.any(String) });
    expect(await balance(ps[0])).toBe(50000);
    const seeds = await db.select({ id: tournamentRegistrations.id, seedNo: tournamentRegistrations.seedNo }).from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.status, 'CONFIRMED'));
    expect(seeds.sort((a, b) => a.seedNo! - b.seedNo!)).toEqual([{ id: regs[1], seedNo: 1 }, { id: regs[2], seedNo: 2 }]);
  });

  it('refunds everyone exactly once when the tournament is cancelled', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 70000 });
    const ps = await Promise.all([0, 1, 2].map(() => player(4, 70000)));
    for (const p of ps) expect((await register(p, t.id)).status).toBe(201);
    const out = await api(ps[2]).delete(`/api/v1/tournaments/${t.id}/registrations/${(await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.playerId, ps[2])))[0].id}`);
    expect(out.status).toBe(200);
    const res = await api(organizer).post(`/api/v1/tournaments/${t.id}/cancel`, { version: await version(t.id), reason: 'Mưa bão' });
    expect(res.body.data.status).toBe('CANCELLED');
    expect(await Promise.all(ps.map(balance))).toEqual([70000, 70000, 70000]);
    const refunds = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'REFUND'));
    expect(refunds).toHaveLength(3);
    expect(await db.select().from(paymentRefunds)).toHaveLength(3);
  });

  it('credits the Organizer once with the fees still held when the tournament completes', async () => {
    const organizer = await player();
    const t = await openTournament(organizer, { entryFee: 60000 });
    const ps = await Promise.all([0, 1, 2].map(() => player(4, 60000)));
    for (const p of ps) await register(p, t.id);
    const leaving = (await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.playerId, ps[2])))[0];
    await api(ps[2]).delete(`/api/v1/tournaments/${t.id}/registrations/${leaving.id}`);
    const regs = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.status, 'CONFIRMED'));
    await db.update(tournaments).set({ status: 'IN_PROGRESS' }).where(eq(tournaments.id, t.id));
    const [match] = await db.insert(matches).values({ matchType: 'SINGLES', scheduledAt: new Date(), status: 'COMPLETED' }).returning();
    await db.insert(tournamentMatches).values({
      tournamentId: t.id, matchId: match.id, registration1Id: regs[0].id, registration2Id: regs[1].id,
      winnerRegistrationId: regs[0].id, roundIndex: 1, matchIndex: 0, resolution: 'WINNER_DECLARED',
    });
    const done = await api(organizer).post(`/api/v1/tournaments/${t.id}/complete`, { version: await version(t.id) });
    expect(done.body.data.status).toBe('COMPLETED');
    expect(await balance(organizer)).toBe(120000);
    await db.transaction(tx => tournamentFeeService.creditOrganizer({ id: t.id, creatorId: organizer, name: 'x' }, tx));
    expect(await balance(organizer)).toBe(120000);
    const earnings = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'TOURNAMENT_EARNING'));
    expect(earnings).toEqual([expect.objectContaining({ userId: organizer, amount: '120000.00', referenceType: 'TOURNAMENT', referenceId: t.id })]);
  });
});
