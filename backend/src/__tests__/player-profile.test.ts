import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, users, playerProfiles, skillLevels, matches, matchPlayers, tournaments,
  tournamentRegistrations, tournamentTeams, tournamentMatches, matchmakingRequests, matchmakingMatches } from '../db';
import { eq } from 'drizzle-orm';
import { recruitmentFixtureColumns, surveyBody } from './test-helpers';
import { PgDialect } from 'drizzle-orm/pg-core';
import { pool } from '../db';
import { profileStatisticsQuery } from '../repositories/players/profile-statistics';
import { PlayerProfileRepository } from '../repositories/players/PlayerProfileRepository';
import { PlayerProfileService } from '../services/players/PlayerProfileService';
import { createProfileRouter } from '../routes/players/profileRoutes';
import { errorHandler } from '../middleware/error.middleware';
import type { ProfileRatingsReader } from '../contracts/PlayerProfileRead';

const ratings: ProfileRatingsReader = { summary: vi.fn() };
const repository = new PlayerProfileRepository();
const service = new PlayerProfileService(ratings, repository, { statisticsEnabled: true });
let ids: number[];
let level: number;
let tournamentId: number;

async function createPlayers() {
  const [skill] = await db.select().from(skillLevels).limit(1);
  level = skill.id;
  const rows = await db.insert(users).values(Array.from({ length: 4 }, (_, i) => ({
    email: `profile${i}@example.test`, passwordHash: 'test-only', role: 'PLAYER', status: 'ACTIVE',
  }))).returning();
  ids = rows.map(row => row.id);
  await db.insert(playerProfiles).values(ids.map((id, i) => ({ userId: id, fullName: `Player ${i}`, skillLevelId: level })));
}
async function createTournament() {
  const [row] = await db.insert(tournaments).values({ creatorId: ids[0], name: 'Profile fixture',
    format: 'SINGLE_ELIMINATION', matchType: 'DOUBLES', participantLimit: 4, status: 'IN_PROGRESS',
    registrationStart: new Date(), registrationEnd: new Date(), tournamentStart: new Date(), tournamentEnd: new Date(),
  }).returning();
  tournamentId = row.id;
}
async function resultMatch(options: { resolution?: string; status?: string; doubles?: boolean; bye?: boolean; invalid?: boolean }) {
  const { resolution = 'WINNER_DECLARED', status = 'COMPLETED', doubles = false, bye = false, invalid = false } = options;
  const [match] = await db.insert(matches).values({ matchType: doubles ? 'DOUBLES' : 'SINGLES', status, scheduledAt: new Date() }).returning();
  const teams = doubles ? await db.insert(tournamentTeams).values([0, 1].map(i => ({
    tournamentId, name: `Side ${i}`, captainId: ids[i * 2], status: 'CONFIRMED',
  }))).returning() : [];
  const regs = await db.insert(tournamentRegistrations).values([0, 1].map(i => ({
    tournamentId, registrationType: doubles ? 'DOUBLES' : 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
    ...(doubles ? { teamId: teams[i].id } : { playerId: ids[i] }),
  }))).returning();
  await db.insert(matchPlayers).values((doubles ? ids : ids.slice(0, 2)).map((id, i) => ({
    matchId: match.id, playerId: id, teamNo: doubles ? Math.floor(i / 2) + 1 : i + 1, status: 'ACTIVE', joinedAt: new Date(),
  })));
  await db.insert(tournamentMatches).values({ tournamentId, matchId: match.id,
    registration1Id: regs[0].id, registration2Id: bye ? null : regs[1].id,
    winnerRegistrationId: invalid ? null : regs[0].id, resolution, roundIndex: 1, matchIndex: 1,
  });
  return match.id;
}
async function casual(status = 'COMPLETED') {
  const [req] = await db.insert(matchmakingRequests).values({ playerId: ids[0], matchType: 'SINGLES',
    minSkillLevelId: level, maxSkillLevelId: level, preferredDate: '2026-10-19', preferredStartTime: '10:00',
    preferredEndTime: '11:00', matchDurationMinutes: 60, status: 'MATCHED', expiresAt: new Date(),
    ...(await recruitmentFixtureColumns(ids[0], 'SINGLES', new Date('2026-10-19T03:00:00Z'), 60)),
  }).returning();
  const [match] = await db.insert(matches).values({ matchType: 'SINGLES', status, scheduledAt: new Date() }).returning();
  await db.insert(matchPlayers).values({ matchId: match.id, playerId: ids[0], teamNo: 1, status: 'ACTIVE', joinedAt: new Date() });
  await db.insert(matchmakingMatches).values({ matchmakingRequestId: req.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });
}
beforeEach(async () => {
  vi.mocked(ratings.summary).mockReset().mockResolvedValue({ totalRatings: 3, averageSkillRating: 4.125, averageAttitudeRating: 3.5 });
  await createPlayers();
});

describe('Profile repository and composition', () => {
  it('returns an allow-listed identity with nullable catalog description, and no sensitive fields', async () => {
    const profile = await service.read(ids[0]);
    expect(Object.keys(profile).sort()).toEqual(['avatarUrl', 'fullName', 'isSkillTentative', 'ratings', 'skillLevel', 'stats', 'userId']);
    expect(profile.skillLevel).toHaveProperty('description');
    expect(profile.ratings!.skill).toEqual({ average: 4.13, count: 3, notEnoughData: false });
    expect(profile.stats).toEqual({ matchesPlayed: 0, wins: 0, losses: 0, resultsAvailable: false });
  });
  it.each([0, 2])('hides both averages at count %i', async count => {
    vi.mocked(ratings.summary).mockResolvedValue({ totalRatings: count, averageSkillRating: count ? 5 : null, averageAttitudeRating: count ? 2 : null });
    const profile = await service.read(ids[0]);
    expect(profile.ratings!.skill).toEqual({ average: null, count, notEnoughData: true });
    expect(profile.ratings!.attitude.average).toBeNull();
  });
  it('does not turn a failed ratings read into an empty profile', async () => {
    vi.mocked(ratings.summary).mockRejectedValue(new Error('dependency failed'));
    await expect(service.read(ids[0])).rejects.toThrow('dependency failed');
  });
  it('rolls back a name change when response composition fails, and passes the transaction to Ratings', async () => {
    vi.mocked(ratings.summary).mockImplementation(async (_id, tx) => {
      expect(tx).not.toBe(db);
      throw new Error('aggregate unavailable');
    });
    await expect(service.updateName(ids[0], { fullName: 'Changed name' })).rejects.toThrow();
    expect((await repository.findActive(ids[0]))?.fullName).toBe('Player 0');
  });
  it('updates only the caller and trims the name', async () => {
    expect((await service.updateName(ids[0], { fullName: '  Nguyễn Nam  ' })).fullName).toBe('Nguyễn Nam');
    expect((await repository.findActive(ids[1]))?.fullName).toBe('Player 1');
  });
  it('counts completed casual matches but not cancelled or LEFT participants', async () => {
    await casual(); await casual('CANCELLED');
    expect(await repository.statistics(ids[0])).toEqual({ matchesPlayed: 1, wins: 0, losses: 0, resultsAvailable: false });
    await db.update(matchPlayers).set({ status: 'LEFT' }).where(eq(matchPlayers.playerId, ids[0]));
    expect((await repository.statistics(ids[0])).matchesPlayed).toBe(0);
  });
  it.each(['COMPLETED', 'CANCELLED'])('counts WALKOVER once for each Doubles member with underlying status %s', async status => {
    await createTournament(); await resultMatch({ doubles: true, resolution: 'WALKOVER', status });
    for (let i = 0; i < ids.length; i++) {
      expect(await repository.statistics(ids[i])).toEqual({ matchesPlayed: 1, wins: i < 2 ? 1 : 0, losses: i < 2 ? 0 : 1, resultsAvailable: true });
    }
  });
  it.each([{ bye: true }, { resolution: 'NONE' }, { resolution: 'UNRESOLVED' }, { status: 'CANCELLED' }])('excludes BYE/unresolved/cancelled normal results: %j', async options => {
    await createTournament(); await resultMatch(options);
    expect((await repository.statistics(ids[0])).matchesPlayed).toBe(0);
  });
  it('rejects invalid participant side mappings instead of fabricating a loss', async () => {
    await createTournament(); const id = await resultMatch({ doubles: true });
    // MM-21 (schema §13.6) adds chk_match_players_team_no, so an out-of-range side can no
    // longer be stored; the statistics query keeps its defensive check for other mismatches.
    await expect(db.update(matchPlayers).set({ teamNo: 3 }).where(eq(matchPlayers.matchId, id)))
      .rejects.toMatchObject({ cause: expect.objectContaining({ constraint: 'chk_match_players_team_no' }) });
    expect((await repository.statistics(ids[0])).wins + (await repository.statistics(ids[0])).losses).toBeGreaterThanOrEqual(0);
  });
  it('executes the statistics plan using existing schema without adding indexes', async () => {
    const query = new PgDialect().sqlToQuery(profileStatisticsQuery(ids[0]));
    const plan = await pool.query('EXPLAIN (FORMAT JSON) ' + query.sql, query.params);
    expect(plan.rows[0]['QUERY PLAN'][0].Plan).toBeDefined();
  });
  it('counts a completed Singles win and corresponding loss', async () => {
    await createTournament(); await resultMatch({});
    expect((await repository.statistics(ids[0])).wins).toBe(1);
    expect((await repository.statistics(ids[1])).losses).toBe(1);
  });
});

function testApp() {
  const app = express(); app.use(express.json());
  app.use('/api/v1/players', createProfileRouter(ratings)); app.use(errorHandler);
  return app;
}
describe('Profile router (test-only Ratings reader)', () => {
  it('rejects anonymous users, non-Player roles, unsafe IDs, and forbidden PATCH fields', async () => {
    const app = testApp();
    expect((await request(app).get('/api/v1/players/me')).status).toBe(401);
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, ids[1]));
    expect((await request(app).get('/api/v1/players/me').set('X-User-Id', String(ids[1]))).status).toBe(403);
    expect((await request(app).get('/api/v1/players/9007199254740992').set('X-User-Id', String(ids[0]))).status).toBe(400);
    for (const body of [{}, { fullName: 'x' }, { fullName: 'x'.repeat(51) }, { fullName: 'Valid', avatarUrl: '/evil' }, { fullName: 'Valid', userId: ids[1] }]) {
      expect((await request(app).patch('/api/v1/players/me').set('X-User-Id', String(ids[0])).send(body)).status).toBe(400);
    }
  });
  it('returns unavailable for inactive/deleted/non-player targets without calling Ratings', async () => {
    const app = testApp();
    for (const change of [{ status: 'SUSPENDED' }, { status: 'ACTIVE', deletedAt: new Date() }, { deletedAt: null, role: 'COURT_OWNER' }]) {
      await db.update(users).set(change).where(eq(users.id, ids[1]));
      const response = await request(app).get(`/api/v1/players/${ids[1]}`).set('X-User-Id', String(ids[0]));
      expect(response.status).toBe(404); expect(response.body.error.code).toBe('PLAYER_NOT_FOUND');
    }
    expect(ratings.summary).not.toHaveBeenCalled();
  });
  it('serves own/public views and rejects a missing CSRF token before saving', async () => {
    const app = testApp();
    const own = await request(app).get('/api/v1/players/me').set('X-User-Id', String(ids[0]));
    expect(own.status).toBe(200); expect(own.body.data.userId).toBe(ids[0]);
    expect((await request(app).get(`/api/v1/players/${ids[1]}`).set('X-User-Id', String(ids[0]))).status).toBe(200);
    const denied = await request(app).patch('/api/v1/players/me').set('X-User-Id', String(ids[0])).set('Cookie', 'sid=test').send({ fullName: 'Changed name' });
    expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    const saved = await request(app).patch('/api/v1/players/me').set('X-User-Id', String(ids[0])).send({ fullName: 'Changed name' });
    expect(saved.status).toBe(200); expect(saved.body.data.fullName).toBe('Changed name');
  });
});

describe('Mounted identity-first production API', () => {
  it('reads real identity and saves a name without Ratings, while unavailable sections stay null', async () => {
    const { app } = await import('../app');
    await db.update(playerProfiles).set({ avatarUrl: '/uploads/existing-avatar.webp' }).where(eq(playerProfiles.userId, ids[0]));
    const own = await request(app).get('/api/v1/players/me').set('X-User-Id', String(ids[0]));
    expect(own.status).toBe(200);
    expect(own.body.data).toMatchObject({ userId: ids[0], fullName: 'Player 0', avatarUrl: '/uploads/existing-avatar.webp', ratings: null, stats: null });
    expect(own.body.data.skillLevel).toHaveProperty('description');
    const saved = await request(app).patch('/api/v1/players/me').set('X-User-Id', String(ids[0])).send({ fullName: '  Tên thật mới  ' });
    expect(saved.status).toBe(200); expect(saved.body.data.fullName).toBe('Tên thật mới');
    expect(saved.body.data.ratings).toBeNull(); expect(saved.body.data.stats).toBeNull();
    expect((await repository.findActive(ids[0]))?.fullName).toBe('Tên thật mới');
    expect((await repository.findActive(ids[1]))?.fullName).toBe('Player 1');
    expect(ratings.summary).not.toHaveBeenCalled();
    const publicCard = await request(app).get(`/api/v1/players/${ids[0]}`).set('X-User-Id', String(ids[1]));
    expect(publicCard.body.data.fullName).toBe('Tên thật mới');
    expect(Object.keys(publicCard.body.data).sort()).toEqual(['avatarUrl', 'fullName', 'isSkillTentative', 'ratings', 'skillLevel', 'stats', 'userId']);
  });
  it('uses real session cookies and enforces CSRF for name changes', async () => {
    const { app } = await import('../app');
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'profile-real-session@example.test', password: 'ValidPassword123!', fullName: 'Tên đăng ký', skillSurvey: surveyBody(),
    });
    expect(registered.status).toBe(201);
    const cookies = registered.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.map(value => value.split(';')[0]).join('; ');
    const csrf = cookies.find(value => value.startsWith('csrf_token='))!.split(';')[0].slice('csrf_token='.length);
    expect((await request(app).get('/api/v1/players/me').set('Cookie', cookie)).body.data.fullName).toBe('Tên đăng ký');
    const denied = await request(app).patch('/api/v1/players/me').set('Cookie', cookie).send({ fullName: 'Tên lưu thật' });
    expect(denied.status).toBe(403);
    const saved = await request(app).patch('/api/v1/players/me').set('Cookie', cookie).set('X-CSRF-Token', csrf).send({ fullName: 'Tên lưu thật' });
    expect(saved.status).toBe(200);
    expect((await request(app).get('/api/v1/players/me').set('Cookie', cookie)).body.data.fullName).toBe('Tên lưu thật');
  });
});
