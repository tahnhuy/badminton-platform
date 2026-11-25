import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels, systemConfigs } from '../db/schema';
import { matches } from '../db/schema/matchmaking';
import { tournaments, tournamentMatches, tournamentRegistrations } from '../db/schema/tournaments';
import { tournamentConfig } from '../shared/config/tournament-config';
import { checkEligibility, lockedFields, validateTournamentFields, type TournamentFields } from '../services/tournaments/rules';
import { createTestUser } from './test-helpers';

// TRN-02 — tournament CRUD, lifecycle, visibility (Tournament Tech Design §2.1, §3.1, §6, §8).

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let levelIdByRank: Map<number, number>;

async function player(rank = 4) {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `Player ${user.id}`, skillLevelId: levelIdByRank.get(rank)! });
  return user.id;
}

const as = (userId: number | null) => ({
  get: (url: string) => (userId ? request(app).get(url).set('x-user-id', String(userId)) : request(app).get(url)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('x-user-id', String(userId)).send(body),
});

function body(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    name: 'Giải mùa đông',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 100000,
    venueNote: 'Nhà thi đấu Phú Thọ',
    registrationStart: new Date(now - HOUR).toISOString(),
    registrationEnd: new Date(now + 2 * DAY).toISOString(),
    tournamentStart: new Date(now + 3 * DAY).toISOString(),
    tournamentEnd: new Date(now + 4 * DAY).toISOString(),
    ...overrides,
  };
}

async function createTournament(organizer: number, overrides: Record<string, unknown> = {}) {
  const res = await as(organizer).post('/api/v1/tournaments', body(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: number; version: number };
}

async function openTournament(organizer: number, overrides: Record<string, unknown> = {}) {
  const t = await createTournament(organizer, overrides);
  const res = await as(organizer).post(`/api/v1/tournaments/${t.id}/open`, { version: t.version });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as { id: number; version: number };
}

async function confirm(tournamentId: number, playerId: number) {
  await db.insert(tournamentRegistrations).values({
    tournamentId, playerId, registrationType: 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
  });
}

async function setEnabled(value: boolean) {
  const key = 'TOURNAMENT_ENABLED';
  const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, key)).limit(1);
  if (existing.length === 0) await db.insert(systemConfigs).values({ configKey: key, configValue: String(value), description: key });
  else await db.update(systemConfigs).set({ configValue: String(value) }).where(eq(systemConfigs.configKey, key));
  tournamentConfig.clearCache();
}

beforeEach(async () => {
  const levels = await db.select().from(skillLevels);
  levelIdByRank = new Map(levels.map(level => [level.rank, level.id]));
});

describe('pure rules', () => {
  const fields: TournamentFields = {
    name: 'x', description: null, matchType: 'SINGLES', participantLimit: 8, entryFee: 0,
    minSkillLevelId: 3, maxSkillLevelId: 5, venueNote: 'v',
    registrationStart: new Date('2030-01-01T00:00:00Z'), registrationEnd: new Date('2030-01-05T00:00:00Z'),
    tournamentStart: new Date('2030-01-06T00:00:00Z'), tournamentEnd: new Date('2030-01-07T00:00:00Z'),
    courtCount: 2, matchDurationMinutes: 45, minRestMinutes: 15, dailyStartTime: '08:00', dailyEndTime: '21:00',
  };

  it('checks inclusive eligibility bounds', () => {
    expect(checkEligibility({ minRank: 3, maxRank: 5 }, 3)).toBeNull();
    expect(checkEligibility({ minRank: 3, maxRank: 5 }, 5)).toBeNull();
    expect(checkEligibility({ minRank: 3, maxRank: 5 }, 2)).toBe('BELOW_MIN_LEVEL');
    expect(checkEligibility({ minRank: 3, maxRank: 5 }, 6)).toBe('ABOVE_MAX_LEVEL');
    expect(checkEligibility({ minRank: null, maxRank: null }, 7)).toBeNull();
  });

  it('applies the editing rules per status', () => {
    const now = new Date('2030-01-02T00:00:00Z');
    expect(lockedFields('DRAFT', fields, { matchType: 'DOUBLES' }, { confirmedCount: 0, now })).toEqual([]);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { matchType: 'DOUBLES' }, { confirmedCount: 0, now })).toEqual(['matchType']);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { registrationStart: new Date('2030-01-01T06:00:00Z') }, { confirmedCount: 0, now })).toEqual(['registrationStart']);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { registrationEnd: new Date('2030-01-04T00:00:00Z') }, { confirmedCount: 0, now })).toEqual(['registrationEnd']);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { registrationEnd: new Date('2030-01-05T12:00:00Z') }, { confirmedCount: 0, now })).toEqual([]);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { entryFee: 5, participantLimit: 4 }, { confirmedCount: 5, now })).toEqual(['entryFee', 'participantLimit']);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { entryFee: 5 }, { confirmedCount: 0, now })).toEqual([]);
    expect(lockedFields('READY', fields, { name: 'y', courtCount: 4, venueNote: 'w' }, { confirmedCount: 4, now })).toEqual(['name']);
    expect(lockedFields('COMPLETED', fields, { venueNote: 'w' }, { confirmedCount: 4, now })).toEqual(['venueNote']);
    expect(lockedFields('OPEN_FOR_REGISTRATION', fields, { matchType: 'SINGLES' }, { confirmedCount: 0, now })).toEqual([]);
  });

  it('validates cross-field consistency', () => {
    const ranks = new Map([[3, 3], [5, 5]]);
    expect(validateTournamentFields(fields, ranks)).toEqual([]);
    const bad = { ...fields, registrationEnd: fields.registrationStart, tournamentEnd: fields.tournamentStart,
      minSkillLevelId: 5, maxSkillLevelId: 3, dailyStartTime: '20:30', matchDurationMinutes: 45 };
    expect(validateTournamentFields(bad, ranks).map(p => p.code)).toEqual([
      'REGISTRATION_END_BEFORE_START', 'TOURNAMENT_END_BEFORE_START', 'MATCH_LONGER_THAN_DAILY_WINDOW', 'MAX_LEVEL_BELOW_MIN_LEVEL',
    ]);
    expect(validateTournamentFields({ ...fields, minSkillLevelId: 99 }, ranks).map(p => p.code)).toEqual(['UNKNOWN_SKILL_LEVEL']);
  });
});

describe('create and visibility', () => {
  it('creates a DRAFT with defaults; only Players may create', async () => {
    const organizer = await player();
    const res = await as(organizer).post('/api/v1/tournaments', body({ participantLimit: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'DRAFT', format: 'SINGLE_ELIMINATION', competitionType: 'PROFESSIONAL', participantLimit: 16,
      entryFee: 100000, confirmedCount: 0, slotsLeft: 16, version: 1, organizer: { id: organizer },
      schedule: { courtCount: 2, matchDurationMinutes: 45, minRestMinutes: 15, dailyStartTime: '08:00', dailyEndTime: '21:00' },
    });
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    expect((await as(owner.id).post('/api/v1/tournaments', body())).status).toBe(403);
  });

  it('rejects invalid settings with field details', async () => {
    const organizer = await player();
    const res = await as(organizer).post('/api/v1/tournaments', body({
      tournamentEnd: new Date(Date.now()).toISOString(), minSkillLevelId: levelIdByRank.get(6), maxSkillLevelId: levelIdByRank.get(2),
    }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.map((d: { code: string }) => d.code)).toEqual(['TOURNAMENT_END_BEFORE_START', 'MAX_LEVEL_BELOW_MIN_LEVEL']);
    expect((await as(organizer).post('/api/v1/tournaments', body({ entryFee: -1 }))).status).toBe(400);
    expect((await as(organizer).post('/api/v1/tournaments', body({ unknown: 1 }))).status).toBe(400);
  });

  it('hides a DRAFT from visitors and other Players but not from its Organizer and Admins', async () => {
    const organizer = await player();
    const other = await player();
    const admin = await createTestUser({ role: 'ADMIN' });
    const t = await createTournament(organizer);
    const url = `/api/v1/tournaments/${t.id}`;
    expect((await as(null).get(url)).status).toBe(404);
    expect((await as(other).get(url)).body.error.code).toBe('TOURNAMENT_NOT_FOUND');
    expect((await as(organizer).get(url)).status).toBe(200);
    expect((await as(admin.id).get(url)).status).toBe(200);
    expect((await as(null).get('/api/v1/tournaments')).body.data).toEqual([]);
    const mine = await as(organizer).get('/api/v1/tournaments/mine?role=organized');
    expect(mine.body.data.map((x: { id: number }) => x.id)).toEqual([t.id]);
  });
});

describe('editing and lifecycle', () => {
  it('enforces Organizer rights and the optimistic version', async () => {
    const organizer = await player();
    const other = await player();
    const t = await openTournament(organizer);
    expect((await as(other).patch(`/api/v1/tournaments/${t.id}`, { version: t.version, name: 'Hack' })).body.error.code).toBe('TOURNAMENT_FORBIDDEN');
    expect((await as(organizer).patch(`/api/v1/tournaments/${t.id}`, { version: t.version - 1, name: 'Stale' })).body.error.code).toBe('TOURNAMENT_VERSION_CONFLICT');
    const ok = await as(organizer).patch(`/api/v1/tournaments/${t.id}`, { version: t.version, name: 'Giải đổi tên' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ name: 'Giải đổi tên', version: t.version + 1 });
  });

  it('locks fields while open: match type, shortening the deadline, fee and levels once someone is confirmed', async () => {
    const organizer = await player();
    let t = await openTournament(organizer);
    const url = `/api/v1/tournaments/${t.id}`;
    const locked = await as(organizer).patch(url, { version: t.version, matchType: 'DOUBLES' });
    expect(locked.status).toBe(409);
    expect(locked.body.error).toMatchObject({ code: 'TOURNAMENT_FIELD_LOCKED', details: [{ field: 'matchType', code: 'TOURNAMENT_FIELD_LOCKED' }] });
    const row = (await db.select().from(tournaments).where(eq(tournaments.id, t.id)))[0];
    const later = new Date(row.registrationEnd.getTime() + HOUR).toISOString();
    const extended = await as(organizer).patch(url, { version: t.version, registrationEnd: later });
    expect(extended.status, JSON.stringify(extended.body)).toBe(200);
    t = extended.body.data;
    const earlier = new Date(row.registrationEnd.getTime() - HOUR).toISOString();
    expect((await as(organizer).patch(url, { version: t.version, registrationEnd: earlier })).body.error.code).toBe('TOURNAMENT_FIELD_LOCKED');
    expect((await as(organizer).patch(url, { version: t.version, entryFee: 50000 })).status).toBe(200);
    t = (await as(organizer).get(url)).body.data;
    await confirm(t.id, await player());
    const fee = await as(organizer).patch(url, { version: t.version, entryFee: 0, minSkillLevelId: levelIdByRank.get(2) });
    expect(fee.body.error.details.map((d: { field: string }) => d.field)).toEqual(['entryFee', 'minSkillLevelId']);
  });

  it('opens only a valid DRAFT', async () => {
    const organizer = await player();
    const t = await createTournament(organizer, { venueNote: null });
    const noVenue = await as(organizer).post(`/api/v1/tournaments/${t.id}/open`, { version: t.version });
    expect(noVenue.status).toBe(400);
    expect(noVenue.body.error.details).toEqual([{ field: 'venueNote', code: 'VENUE_REQUIRED' }]);
    const opened = await openTournament(organizer);
    expect((await as(organizer).post(`/api/v1/tournaments/${opened.id}/open`, { version: opened.version })).body.error.code).toBe('TOURNAMENT_INVALID_STATE');
  });

  it('closes into REGISTRATION_CLOSED with 2+ registrations and cancels with fewer', async () => {
    const organizer = await player();
    const empty = await openTournament(organizer);
    const cancelled = await as(organizer).post(`/api/v1/tournaments/${empty.id}/close`, { version: empty.version });
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Không đủ người tham gia khi đóng đăng ký' });
    const full = await openTournament(organizer);
    await confirm(full.id, await player());
    await confirm(full.id, await player());
    const closed = await as(organizer).post(`/api/v1/tournaments/${full.id}/close`, { version: full.version });
    expect(closed.body.data).toMatchObject({ status: 'REGISTRATION_CLOSED', confirmedCount: 2 });
    const rename = await as(organizer).patch(`/api/v1/tournaments/${full.id}`, { version: closed.body.data.version, name: 'Tên mới', venueNote: 'Sân mới' });
    expect(rename.body.error.details).toEqual([{ field: 'name', code: 'TOURNAMENT_FIELD_LOCKED' }]);
    const venue = await as(organizer).patch(`/api/v1/tournaments/${full.id}`, { version: closed.body.data.version, venueNote: 'Sân mới' });
    expect(venue.body.data.venueNote).toBe('Sân mới');
  });

  it('cancels from allowed states only and completes only after the final', async () => {
    const organizer = await player();
    const t = await openTournament(organizer);
    const res = await as(organizer).post(`/api/v1/tournaments/${t.id}/cancel`, { version: t.version, reason: 'Thiếu sân' });
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Thiếu sân' });
    expect(res.body.data.cancelledAt).not.toBeNull();

    const live = await openTournament(organizer);
    await db.update(tournaments).set({ status: 'IN_PROGRESS' }).where(eq(tournaments.id, live.id));
    expect((await as(organizer).post(`/api/v1/tournaments/${live.id}/cancel`, { version: live.version })).body.error.code).toBe('TOURNAMENT_INVALID_STATE');
    expect((await as(organizer).post(`/api/v1/tournaments/${live.id}/complete`, { version: live.version })).body.error.code).toBe('TOURNAMENT_NOT_FINISHED');

    const [a, b] = [await player(), await player()];
    await confirm(live.id, a);
    await confirm(live.id, b);
    const regs = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.tournamentId, live.id));
    const [match] = await db.insert(matches).values({ matchType: 'SINGLES', scheduledAt: new Date(), status: 'COMPLETED' }).returning();
    await db.insert(tournamentMatches).values({
      tournamentId: live.id, matchId: match.id, registration1Id: regs[0].id, registration2Id: regs[1].id,
      winnerRegistrationId: regs[0].id, roundIndex: 1, matchIndex: 0, resolution: 'WINNER_DECLARED',
    });
    const done = await as(organizer).post(`/api/v1/tournaments/${live.id}/complete`, { version: live.version });
    expect(done.body.data).toMatchObject({ status: 'COMPLETED' });
    expect(done.body.data.completedAt).not.toBeNull();
  });

  it('blocks writes while TOURNAMENT_ENABLED is false', async () => {
    const organizer = await player();
    await setEnabled(false);
    try {
      expect((await as(organizer).post('/api/v1/tournaments', body())).body.error.code).toBe('TOURNAMENT_DISABLED');
    } finally {
      await setEnabled(true);
    }
  });
});

describe('detail viewer block and listing', () => {
  it('explains eligibility to each kind of viewer', async () => {
    const organizer = await player(4);
    const t = await openTournament(organizer, { minSkillLevelId: levelIdByRank.get(3), maxSkillLevelId: levelIdByRank.get(5) });
    const url = `/api/v1/tournaments/${t.id}`;
    expect((await as(null).get(url)).body.data.viewer).toEqual({ isOrganizer: false, registrationId: null, eligible: false, ineligibleReason: 'NOT_SIGNED_IN', canShare: false, sharedPostId: null });
    expect((await as(organizer).get(url)).body.data.viewer).toMatchObject({ isOrganizer: true, ineligibleReason: 'ORGANIZER' });
    expect((await as(await player(2)).get(url)).body.data.viewer.ineligibleReason).toBe('BELOW_MIN_LEVEL');
    expect((await as(await player(6)).get(url)).body.data.viewer.ineligibleReason).toBe('ABOVE_MAX_LEVEL');
    const registered = await player(4);
    await confirm(t.id, registered);
    const view = (await as(registered).get(url)).body.data;
    expect(view.viewer).toMatchObject({ eligible: true, ineligibleReason: null });
    expect(view.viewer.registrationId).toEqual(expect.any(Number));
    expect(view).toMatchObject({ confirmedCount: 1, slotsLeft: 7, minSkillLevel: { rank: 3 }, maxSkillLevel: { rank: 5 } });
  });

  it('filters the public list and the registered tab', async () => {
    const organizer = await player(4);
    const free = await openTournament(organizer, { name: 'Giải miễn phí', entryFee: 0 });
    const paid = await openTournament(organizer, { name: 'Giải có phí đôi', matchType: 'DOUBLES' });
    const strong = await openTournament(organizer, { name: 'Giải trình cao', minSkillLevelId: levelIdByRank.get(6) });
    const ids = async (query: string, viewer: number | null = null) =>
      (await as(viewer).get(`/api/v1/tournaments${query}`)).body.data.map((x: { id: number }) => x.id).sort();
    expect(await ids('')).toEqual([free.id, paid.id, strong.id].sort());
    expect(await ids('?free=true')).toEqual([free.id]);
    expect(await ids('?matchType=DOUBLES')).toEqual([paid.id]);
    expect(await ids('?q=trình')).toEqual([strong.id]);
    const mid = await player(4);
    expect(await ids('?eligibleForMe=true', mid)).toEqual([free.id, paid.id].sort());
    await confirm(free.id, mid);
    const registered = await as(mid).get('/api/v1/tournaments/mine?role=registered');
    expect(registered.body.data.map((x: { id: number }) => x.id)).toEqual([free.id]);
    expect(registered.body.meta).toEqual({ page: 1, limit: 12, total: 1, totalPages: 1 });
  });
});

describe('Review fix: venue stays required once open', () => {
  it('rejects clearing the venue of an open tournament', async () => {
    const { api: kitApi, makePlayer: mk, openTournament: open, versionOf: ver } = await import('./tournament-test-kit');
    const organizer = await mk();
    const id = await open(organizer);
    const res = await kitApi(organizer).patch(`/api/v1/tournaments/${id}`, { version: await ver(id), venueNote: null });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'venueNote', code: 'VENUE_REQUIRED' }]);
  });
});
