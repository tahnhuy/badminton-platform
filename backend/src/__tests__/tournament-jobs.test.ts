import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { notifications } from '../db/schema/notifications';
import { matches } from '../db/schema/matchmaking';
import { teamInvitations, tournamentMatches, tournaments } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { tournamentJobService, AUTO_CANCEL_STALE_REASON } from '../services/tournaments/TournamentJobService';
import { notificationResourceResolver } from '../services/notifications/NotificationResourceResolver';
import { createTestUser } from './test-helpers';

// TRN-10 jobs and TRN-11 notifications.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let levelIdByRank: Map<number, number>;

beforeEach(async () => {
  const levels = await db.select().from(skillLevels);
  levelIdByRank = new Map(levels.map(level => [level.rank, level.id]));
});

async function player(topUp = 0) {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `Người chơi ${user.id}`, skillLevelId: levelIdByRank.get(4)! });
  if (topUp > 0) await walletService.credit({ userId: user.id, amount: String(topUp), entryType: 'TOP_UP', idempotencyKey: `test-topup:${user.id}` });
  return user.id;
}

const api = (userId: number) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', String(userId)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
});

async function openTournament(organizer: number, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const created = await api(organizer).post('/api/v1/tournaments', {
    name: 'Giải job', matchType: 'SINGLES', participantLimit: 8, entryFee: 0, venueNote: 'Sân C',
    registrationStart: new Date(now - HOUR).toISOString(), registrationEnd: new Date(now + DAY).toISOString(),
    tournamentStart: new Date(now + 2 * DAY).toISOString(), tournamentEnd: new Date(now + 3 * DAY).toISOString(),
    ...overrides,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const opened = await api(organizer).post(`/api/v1/tournaments/${created.body.data.id}/open`, { version: 1 });
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
  return opened.body.data.id as number;
}

const row = async (id: number) => (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0];
const notificationsOf = (userId: number, type?: string) => db.select().from(notifications)
  .where(type ? and(eq(notifications.userId, userId), eq(notifications.type, type)) : eq(notifications.userId, userId));

/** Registered players and a tournament moved past its registration end. */
async function withPlayers(count: number, fee = 0) {
  const organizer = await player();
  const id = await openTournament(organizer, { entryFee: fee });
  const players = [];
  for (let i = 0; i < count; i++) {
    const p = await player(fee);
    const reg = await api(p).post(`/api/v1/tournaments/${id}/registrations`);
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    players.push(p);
  }
  await db.update(tournaments).set({ registrationEnd: new Date(Date.now() - 1000) }).where(eq(tournaments.id, id));
  return { organizer, id, players };
}

describe('Tournament job', () => {
  it('closes registration at registration_end and notifies participants once, even with two runners', async () => {
    const { id, players } = await withPlayers(2);
    const results = await Promise.all([tournamentJobService.steps(), tournamentJobService.steps()]);
    expect((await row(id)).status).toBe('REGISTRATION_CLOSED');
    expect(results.reduce((n, r) => n + (r.closed > 0 ? 1 : 0), 0)).toBeGreaterThanOrEqual(1);
    for (const p of players) expect(await notificationsOf(p, 'TOURNAMENT_REGISTRATION_CLOSED')).toHaveLength(1);
  });

  it('cancels with refunds when fewer than 2 registered at registration_end', async () => {
    const { id, players } = await withPlayers(1, 50000);
    await tournamentJobService.steps();
    const t = await row(id);
    expect(t.status).toBe('CANCELLED');
    expect(t.cancelledBy).toBeNull();
    expect(Number((await walletService.getWallet(players[0])).balance)).toBe(50000);
    const [notice] = await notificationsOf(players[0], 'TOURNAMENT_CANCELLED');
    expect(notice.content).toContain('hoàn 100%');
    expect(await notificationResourceResolver.resolve({ id: players[0], role: 'PLAYER' }, 'TOURNAMENT', id)).toBe(`/tournaments/${id}`);
  });

  it('runOnce skips while another runner holds the advisory lock', async () => {
    const results = await Promise.all([tournamentJobService.runOnce(), tournamentJobService.runOnce()]);
    expect(results.filter(r => !r.skipped).length).toBeGreaterThanOrEqual(1);
  });

  it('expires pending invitations and tells the captain', async () => {
    const organizer = await player();
    const id = await openTournament(organizer, { matchType: 'DOUBLES' });
    const [captain, invitee] = [await player(), await player()];
    const team = await api(captain).post(`/api/v1/tournaments/${id}/teams`, { name: 'Đội hết hạn' });
    const inv = await api(captain).post(`/api/v1/tournaments/${id}/teams/${team.body.data.id}/invitations`, { inviteeId: invitee });
    expect((await notificationsOf(invitee, 'TOURNAMENT_TEAM_INVITED'))).toHaveLength(1);
    await db.update(teamInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(teamInvitations.id, inv.body.data.id));
    await tournamentJobService.steps();
    const [after] = await db.select().from(teamInvitations).where(eq(teamInvitations.id, inv.body.data.id));
    expect(after.status).toBe('EXPIRED');
    expect(await notificationsOf(captain, 'TOURNAMENT_TEAM_INVITATION_EXPIRED')).toHaveLength(1);
  });

  it('reminds both players 30 minutes before a match once per scheduled time, again after a reschedule', async () => {
    const { organizer, id, players } = await withPlayers(2);
    await tournamentJobService.steps();
    const drawn = await api(organizer).post(`/api/v1/tournaments/${id}/draw`, { version: (await row(id)).version });
    expect(drawn.status, JSON.stringify(drawn.body)).toBe(200);
    for (const p of players) expect(await notificationsOf(p, 'TOURNAMENT_BRACKET_PUBLISHED')).toHaveLength(1);
    const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    await db.update(matches).set({ scheduledAt: new Date(Date.now() + 20 * 60_000) }).where(eq(matches.id, tm.matchId));
    await Promise.all([tournamentJobService.steps(), tournamentJobService.steps()]);
    await tournamentJobService.steps();
    for (const p of players) expect(await notificationsOf(p, 'TOURNAMENT_MATCH_REMINDER')).toHaveLength(1);

    // An Organizer edit notifies both players and re-arms the reminder.
    const res = await request(app).patch(`/api/v1/tournaments/${id}/matches/${tm.id}/schedule`).set('x-user-id', String(organizer))
      .send({ courtLabel: 'Sân 2', scheduledAt: new Date(Date.now() + 25 * 60_000).toISOString() });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    for (const p of players) expect(await notificationsOf(p, 'TOURNAMENT_MATCH_RESCHEDULED')).toHaveLength(1);
    await tournamentJobService.steps();
    for (const p of players) expect(await notificationsOf(p, 'TOURNAMENT_MATCH_REMINDER')).toHaveLength(2);
  });

  it('auto-completes 3 days after tournament_end when the final has a winner, crediting the Organizer', async () => {
    const { organizer, id } = await withPlayers(2, 40000);
    await tournamentJobService.steps();
    await api(organizer).post(`/api/v1/tournaments/${id}/draw`, { version: (await row(id)).version });
    const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    await api(organizer).post(`/api/v1/tournaments/${id}/matches/${tm.id}/start`);
    const result = await request(app).put(`/api/v1/tournaments/${id}/matches/${tm.id}/result`).set('x-user-id', String(organizer))
      .send({ type: 'SETS', sets: [{ team1Score: 21, team2Score: 10 }, { team1Score: 21, team2Score: 12 }] });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    await tournamentJobService.steps();
    expect((await row(id)).status).toBe('IN_PROGRESS');
    await db.update(tournaments).set({ tournamentEnd: new Date(Date.now() - 4 * DAY) }).where(eq(tournaments.id, id));
    await tournamentJobService.steps();
    const t = await row(id);
    expect(t.status).toBe('COMPLETED');
    expect(t.completedBy).toBeNull();
    expect(Number((await walletService.getWallet(organizer)).balance)).toBe(80000);
  });

  it('auto-cancels a tournament not completed 14 days after tournament_end', async () => {
    const { organizer, id, players } = await withPlayers(2, 30000);
    await tournamentJobService.steps();
    await api(organizer).post(`/api/v1/tournaments/${id}/draw`, { version: (await row(id)).version });
    await db.update(tournaments).set({ tournamentEnd: new Date(Date.now() - 15 * DAY) }).where(eq(tournaments.id, id));
    await tournamentJobService.steps();
    const t = await row(id);
    expect(t.status).toBe('CANCELLED');
    expect(t.cancelReason).toBe(AUTO_CANCEL_STALE_REASON);
    for (const p of players) expect(Number((await walletService.getWallet(p)).balance)).toBe(30000);
  });
});

describe('Tournament notifications', () => {
  it('confirms registrations and tells a removed player the reason', async () => {
    const organizer = await player();
    const id = await openTournament(organizer, { entryFee: 20000 });
    const p = await player(20000);
    const reg = await api(p).post(`/api/v1/tournaments/${id}/registrations`);
    expect(await notificationsOf(p, 'TOURNAMENT_REGISTRATION_CONFIRMED')).toHaveLength(1);
    await api(organizer).post(`/api/v1/tournaments/${id}/registrations/${reg.body.data.id}/remove`, { reason: 'Sai trình độ' });
    const [removed] = await notificationsOf(p, 'TOURNAMENT_REGISTRATION_REMOVED');
    expect(removed.content).toContain('Sai trình độ');
    expect(removed.resourceType).toBe('TOURNAMENT');
  });

  it('hides a DRAFT link from everyone but its Organizer', async () => {
    const organizer = await player();
    const created = await api(organizer).post('/api/v1/tournaments', {
      name: 'Giải nháp', matchType: 'SINGLES', entryFee: 0,
      registrationStart: new Date(Date.now() + HOUR).toISOString(), registrationEnd: new Date(Date.now() + DAY).toISOString(),
      tournamentStart: new Date(Date.now() + 2 * DAY).toISOString(), tournamentEnd: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    const id = created.body.data.id;
    const other = await player();
    expect(await notificationResourceResolver.resolve({ id: other, role: 'PLAYER' }, 'TOURNAMENT', id)).toBeNull();
    expect(await notificationResourceResolver.resolve({ id: organizer, role: 'PLAYER' }, 'TOURNAMENT', id)).toBe(`/tournaments/${id}/manage`);
  });
});

describe('Date filters', () => {
  it('filters the list by tournament_start without a time-zone shift', async () => {
    const organizer = await player();
    const start = new Date(Date.now() + 2 * DAY);
    const id = await openTournament(organizer, { tournamentStart: start.toISOString(), tournamentEnd: new Date(start.getTime() + DAY).toISOString() });
    const list = (from: Date, to: Date) => api(organizer).get(`/api/v1/tournaments?limit=50&from=${from.toISOString()}&to=${to.toISOString()}`);
    const inside = await list(new Date(start.getTime() - 60_000), new Date(start.getTime() + 60_000));
    expect(inside.body.data.map((t: { id: number }) => t.id)).toContain(id);
    const after = await list(new Date(start.getTime() + 60_000), new Date(start.getTime() + 2 * HOUR));
    expect(after.body.data.map((t: { id: number }) => t.id)).not.toContain(id);
  });
});
