import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import {
  db,
  pool,
  users,
  playerProfiles,
  skillLevels,
  matches,
  matchPlayers,
  playerRatings,
  playerSkillAdjustments,
  tournaments,
  tournamentMatches,
  systemConfigs,
  notifications,
} from '../db';
import { createTestUser } from './test-helpers';
import { ratingsConfig, RATINGS_CONFIG_DEFAULTS } from '../shared/config/ratings-config';
import { targetRankFromAverage, skillAdjustmentService } from '../services/ratings/SkillAdjustmentService';
import { and, eq, sql } from 'drizzle-orm';

async function resetRatingTables() {
  // TRUNCATE bypasses the row-level immutability triggers, unlike DELETE.
  await db.execute(sql`TRUNCATE TABLE player_skill_adjustments, player_ratings RESTART IDENTITY CASCADE`);
  await db.delete(notifications).where(eq(notifications.type, 'RATING_RECEIVED'));
  await db.delete(matchPlayers);
  await db.delete(tournamentMatches);
  await db.delete(tournaments);
  await db.delete(matches);
  for (const [key, value] of Object.entries(RATINGS_CONFIG_DEFAULTS)) {
    await setConfig(key, String(value));
  }
}

async function skillId(code: string): Promise<number> {
  const [row] = await db.select().from(skillLevels).where(eq(skillLevels.code, code)).limit(1);
  return row.id;
}

async function createPlayer(skillCode = 'AVERAGE') {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({
    userId: user.id,
    fullName: `Player ${user.id}`,
    skillLevelId: await skillId(skillCode),
  });
  return user;
}

async function createCompletedMatch(matchType: 'SINGLES' | 'DOUBLES', playerIds: number[]) {
  const [match] = await db
    .insert(matches)
    .values({ matchType, scheduledAt: new Date('2026-01-01T10:00:00Z'), status: 'COMPLETED', completedAt: new Date() })
    .returning({ id: matches.id });
  await db.insert(matchPlayers).values(
    playerIds.map((playerId, index) => ({
      matchId: match.id,
      playerId,
      teamNo: index < Math.ceil(playerIds.length / 2) ? 1 : 2,
      status: 'ACTIVE',
      joinedAt: new Date(),
    }))
  );
  return match.id;
}

async function createTournamentMatch(matchId: number, resolution: string) {
  const creator = await createPlayer();
  const [tournament] = await db
    .insert(tournaments)
    .values({
      creatorId: creator.id,
      name: `Test Cup ${Date.now()}`,
      format: 'SINGLE_ELIMINATION',
      matchType: 'SINGLES',
      participantLimit: 8,
      status: 'IN_PROGRESS',
      registrationStart: new Date('2026-01-01T00:00:00Z'),
      registrationEnd: new Date('2026-01-02T00:00:00Z'),
      tournamentStart: new Date('2026-01-03T00:00:00Z'),
      tournamentEnd: new Date('2026-01-04T00:00:00Z'),
    })
    .returning({ id: tournaments.id });
  await db.insert(tournamentMatches).values({
    tournamentId: tournament.id,
    matchId,
    roundIndex: 1,
    matchIndex: 0,
    resolution,
  });
}

async function setConfig(key: string, value: string) {
  const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, key)).limit(1);
  if (existing.length === 0) {
    await db.insert(systemConfigs).values({ configKey: key, configValue: value, description: key });
  } else {
    await db.update(systemConfigs).set({ configValue: value }).where(eq(systemConfigs.configKey, key));
  }
  ratingsConfig.clearCache();
}

const as = (id: number, method: 'get' | 'post', url: string) =>
  request(app)[method](url).set('x-user-id', String(id));

const ratingBody = (items: Array<{ ratedPlayerId: number; skillRating?: number; attitudeRating?: number; comment?: string }>) => ({
  ratings: items.map((item) => ({
    skillRating: 4,
    attitudeRating: 5,
    ...item,
  })),
});

describe('target rank mapping (RT-06)', () => {
  it('maps unrounded averages to continuous bands', () => {
    expect(targetRankFromAverage(1.0)).toBe(1);
    expect(targetRankFromAverage(1.49)).toBe(1);
    expect(targetRankFromAverage(1.5)).toBe(2);
    expect(targetRankFromAverage(2.49)).toBe(2);
    expect(targetRankFromAverage(2.5)).toBe(3);
    expect(targetRankFromAverage(3.49)).toBe(3);
    expect(targetRankFromAverage(3.5)).toBe(4);
    expect(targetRankFromAverage(4.49)).toBe(4);
    expect(targetRankFromAverage(4.5)).toBe(5);
    expect(targetRankFromAverage(4.99)).toBe(5);
    expect(targetRankFromAverage(5)).toBe(6);
  });
});

describe('Player ratings', () => {
  beforeEach(async () => {
    await resetRatingTables();
    await ratingsConfig.clearCache();
  });

  it('creates one row per target and returns 201 (RT-02)', async () => {
    const rater = await createPlayer();
    const targetA = await createPlayer();
    const targetB = await createPlayer();
    const matchId = await createCompletedMatch('DOUBLES', [rater.id, targetA.id, targetB.id]);

    const res = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([
        { ratedPlayerId: targetA.id, comment: 'Tốt' },
        { ratedPlayerId: targetB.id, skillRating: 3, attitudeRating: 4 },
      ])
    );

    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.alreadyRated).toEqual([]);
    const rows = await db.select().from(playerRatings).where(eq(playerRatings.matchId, matchId));
    expect(rows).toHaveLength(2);
  });

  it('notifies each rated Player once per new rating and never on replay (2026-11-23)', async () => {
    const rater = await createPlayer();
    const targetA = await createPlayer();
    const targetB = await createPlayer();
    const matchId = await createCompletedMatch('DOUBLES', [rater.id, targetA.id, targetB.id]);
    const body = ratingBody([{ ratedPlayerId: targetA.id, comment: 'Tốt' }, { ratedPlayerId: targetB.id, comment: 'Tốt' }]);

    const first = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(body);
    expect(first.status).toBe(201);
    const created = first.body.data.created as Array<{ id: number; ratedPlayerId: number }>;
    const rows = await db.select().from(notifications).where(eq(notifications.type, 'RATING_RECEIVED'));
    expect(rows).toHaveLength(2);
    for (const target of [targetA.id, targetB.id]) {
      const rating = created.find(row => row.ratedPlayerId === target)!;
      const notification = rows.find(row => row.userId === target)!;
      expect(notification).toMatchObject({
        type: 'RATING_RECEIVED', resourceType: 'PROFILE', resourceId: target,
        dedupKey: `rating-received:${rating.id}`, isRead: false,
      });
      expect(notification.content).not.toContain('Tốt');
    }

    const replay = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(body);
    expect(replay.status).toBe(200);
    expect(await db.select().from(notifications).where(and(
      eq(notifications.type, 'RATING_RECEIVED'),
      eq(notifications.userId, targetA.id),
    ))).toHaveLength(1);
  });

  it('treats a duplicate submission as a successful idempotent no-op (RT-02)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);

    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(ratingBody([{ ratedPlayerId: target.id }]));
    const res = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 1, attitudeRating: 1 }])
    );

    expect(res.status).toBe(200);
    expect(res.body.data.created).toEqual([]);
    expect(res.body.data.alreadyRated).toEqual([{ ratedPlayerId: target.id }]);
    const rows = await db.select().from(playerRatings).where(eq(playerRatings.matchId, matchId));
    expect(rows).toHaveLength(1);
    expect(rows[0].skillRating).toBe(4);
    expect(rows[0].attitudeRating).toBe(5);
  });

  it('rejects self-rating, non-participant target, and non-participant rater (RT-02)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const outsider = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);

    const self = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: rater.id }])
    );
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('RATING_SELF_FORBIDDEN');

    const notParticipant = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: outsider.id }])
    );
    expect(notParticipant.status).toBe(409);
    expect(notParticipant.body.error.code).toBe('RATING_TARGET_NOT_PARTICIPANT');

    const raterOutsider = await as(outsider.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(raterOutsider.status).toBe(403);
    expect(raterOutsider.body.error.code).toBe('RATING_NOT_PARTICIPANT');
    expect(await db.select().from(playerRatings)).toHaveLength(0);
  });

  it('rejects a non-completed Match and validates rating range (RT-02)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const [match] = await db
      .insert(matches)
      .values({ matchType: 'SINGLES', scheduledAt: new Date(), status: 'CONFIRMED' })
      .returning({ id: matches.id });
    await db.insert(matchPlayers).values([
      { matchId: match.id, playerId: rater.id, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
      { matchId: match.id, playerId: target.id, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
    ]);

    const notCompleted = await as(rater.id, 'post', `/api/v1/matches/${match.id}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(notCompleted.status).toBe(409);
    expect(notCompleted.body.error.code).toBe('MATCH_NOT_COMPLETED');

    const completedId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const invalid = await as(rater.id, 'post', `/api/v1/matches/${completedId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 6 }])
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('denies Admin submission (RT-02)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const admin = await createTestUser({ role: 'ADMIN' });
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);

    const res = await as(admin.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
  });

  it('enforces the tournament gate and played-result eligibility (RT-02)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await createTournamentMatch(matchId, 'WINNER_DECLARED');

    await setConfig('TOURNAMENT_RATING_ENABLED', 'false');
    const disabled = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(disabled.status).toBe(409);
    expect(disabled.body.error.code).toBe('RATING_DISABLED');

    await setConfig('TOURNAMENT_RATING_ENABLED', 'true');
    await db.update(tournamentMatches).set({ resolution: 'WALKOVER' }).where(eq(tournamentMatches.matchId, matchId));
    const walkover = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(walkover.status).toBe(409);
    expect(walkover.body.error.code).toBe('RATING_MATCH_NOT_PLAYED');

    await db.update(tournamentMatches).set({ resolution: 'WINNER_DECLARED' }).where(eq(tournamentMatches.matchId, matchId));
    const ok = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(ok.status).toBe(201);
  });

  it('rolls back all rating writes when adjustment fails (RT-02/RT-06)', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);

    const spy = vi
      .spyOn(skillAdjustmentService, 'evaluateTarget')
      .mockRejectedValueOnce(new Error('adjustment boom'));

    const res = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id }])
    );
    expect(res.status).toBe(500);
    expect(await db.select().from(playerRatings)).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('Rating queries', () => {
  beforeEach(async () => {
    await resetRatingTables();
    await ratingsConfig.clearCache();
  });

  it('partitions pending and caller-rated players (RT-03)', async () => {
    const rater = await createPlayer();
    const targetA = await createPlayer();
    const targetB = await createPlayer();
    const matchId = await createCompletedMatch('DOUBLES', [rater.id, targetA.id, targetB.id]);

    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: targetA.id }])
    );

    const res = await as(rater.id, 'get', `/api/v1/matches/${matchId}/ratings/pending`);
    expect(res.status).toBe(200);
    expect(res.body.data.matchType).toBe('DOUBLES');
    expect(res.body.data.ratedPlayers.map((p: any) => p.playerId)).toEqual([targetA.id]);
    expect(res.body.data.ratedPlayers[0].rating.skillRating).toBe(4);
    expect(res.body.data.pendingPlayers.map((p: any) => p.playerId)).toEqual([targetB.id]);
  });

  it('masks another active Player below three ratings and returns 404 for inactive (RT-03)', async () => {
    const viewer = await createPlayer();
    const target = await createPlayer();
    const raterA = await createPlayer();
    const raterB = await createPlayer();
    const matchId = await createCompletedMatch('DOUBLES', [raterA.id, raterB.id, target.id]);

    await db.insert(playerRatings).values([
      { raterId: raterA.id, ratedPlayerId: target.id, matchId, skillRating: 4, attitudeRating: 5 },
      { raterId: raterB.id, ratedPlayerId: target.id, matchId, skillRating: 4, attitudeRating: 5 },
    ]);

    const masked = await as(viewer.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(masked.status).toBe(200);
    expect(masked.body.data.totalRatings).toBe(2);
    expect(masked.body.data.notEnoughData).toBe(true);
    expect(masked.body.data.averageSkillRating).toBeNull();
    expect(masked.body.data.skillDistribution).toBeNull();

    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, target.id));
    const inactive = await as(viewer.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('gives self and Admin full aggregates with threshold >=3 (RT-03)', async () => {
    const target = await createPlayer();
    const raterA = await createPlayer();
    const raterB = await createPlayer();
    const raterC = await createPlayer();
    const admin = await createTestUser({ role: 'ADMIN' });
    const matchId = await createCompletedMatch('DOUBLES', [raterA.id, raterB.id, target.id, raterC.id]);

    await db.insert(playerRatings).values([
      { raterId: raterA.id, ratedPlayerId: target.id, matchId, skillRating: 4, attitudeRating: 5 },
      { raterId: raterB.id, ratedPlayerId: target.id, matchId, skillRating: 4, attitudeRating: 4 },
      { raterId: raterC.id, ratedPlayerId: target.id, matchId, skillRating: 5, attitudeRating: 4 },
    ]);

    const self = await as(target.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(self.status).toBe(200);
    expect(self.body.data.averageSkillRating).toBe(4.33);
    expect(self.body.data.averageAttitudeRating).toBe(4.33);
    expect(self.body.data.skillDistribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 });

    const adminRes = await as(admin.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.averageSkillRating).toBe(4.33);

    const viewer = await createPlayer();
    const other = await as(viewer.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(other.body.data.averageSkillRating).toBe(4.33);
  });

  it('restricts the paginated list to own given ratings for Players (RT-03)', async () => {
    const rater = await createPlayer();
    const targetA = await createPlayer();
    const targetB = await createPlayer();
    const matchId = await createCompletedMatch('DOUBLES', [rater.id, targetA.id, targetB.id]);

    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: targetA.id }, { ratedPlayerId: targetB.id }])
    );

    const own = await as(rater.id, 'get', `/api/v1/users/${rater.id}/ratings?direction=given&page=1&limit=20`);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(2);
    expect(own.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });

    const received = await as(rater.id, 'get', `/api/v1/users/${rater.id}/ratings?direction=received`);
    expect(received.status).toBe(403);
    expect(received.body.error.code).toBe('RATING_SUMMARY_FORBIDDEN');

    const other = await as(rater.id, 'get', `/api/v1/users/${targetA.id}/ratings?direction=given`);
    expect(other.status).toBe(403);
  });
});

describe('Automatic skill adjustment (RT-06)', () => {
  beforeEach(async () => {
    await resetRatingTables();
    await setConfig('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'true');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '5');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_THRESHOLD', '1');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '0');
  });

  async function seedReceivedSkillRatings(targetId: number, skill: number, count: number) {
    const raters: number[] = [];
    for (let i = 0; i < count; i++) raters.push((await createPlayer()).id);
    const matchId = await createCompletedMatch('DOUBLES', [targetId, ...raters]);
    await db.insert(playerRatings).values(
      raters.map((raterId) => ({ raterId, ratedPlayerId: targetId, matchId, skillRating: skill, attitudeRating: skill }))
    );
  }

  it('moves exactly one level toward the target and writes one history row', async () => {
    const target = await createPlayer('BEGINNER');
    await seedReceivedSkillRatings(target.id, 5, 5);

    const profile = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, target.id));
    const beforeRank = (await db.select().from(skillLevels).where(eq(skillLevels.id, profile[0].skillLevelId)))[0].rank;
    expect(beforeRank).toBe(1);

    const newRater = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [newRater.id, target.id]);
    const res = await as(newRater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 5, attitudeRating: 5 }])
    );
    expect(res.status).toBe(201);

    const updated = (await db.select().from(playerProfiles).where(eq(playerProfiles.userId, target.id)))[0];
    const afterRank = (await db.select().from(skillLevels).where(eq(skillLevels.id, updated.skillLevelId)))[0].rank;
    expect(afterRank).toBe(2);
    const history = await db.select().from(playerSkillAdjustments).where(eq(playerSkillAdjustments.playerId, target.id));
    expect(history).toHaveLength(1);
    expect(history[0].ratingsConsidered).toBe(5);
    expect(history[0].source).toBe('AUTO_RATING');
  });

  it('does not adjust below the minimum ratings or when disabled', async () => {
    const target = await createPlayer('BEGINNER');
    await seedReceivedSkillRatings(target.id, 5, 3);

    const newRater = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [newRater.id, target.id]);
    await as(newRater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 5, attitudeRating: 5 }])
    );
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(0);

    await setConfig('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'false');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '1');
    const target2 = await createPlayer('BEGINNER');
    const ratingPlayer = await createPlayer();
    const match2 = await createCompletedMatch('SINGLES', [ratingPlayer.id, target2.id]);
    await as(ratingPlayer.id, 'post', `/api/v1/matches/${match2}/ratings`).send(
      ratingBody([{ ratedPlayerId: target2.id, skillRating: 5, attitudeRating: 5 }])
    );
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(0);
  });

  it('respects the cooldown and never adjusts on duplicate replay', async () => {
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '1');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '14');

    const target = await createPlayer('BEGINNER');
    const rater = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 5, attitudeRating: 5 }])
    );
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(1);

    // A new distinct submission inside the cooldown window must not adjust.
    const rater2 = await createPlayer();
    const match2 = await createCompletedMatch('SINGLES', [rater2.id, target.id]);
    await as(rater2.id, 'post', `/api/v1/matches/${match2}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 5, attitudeRating: 5 }])
    );
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(1);

    // Duplicate replay with cooldown zero must still never adjust.
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '0');
    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(
      ratingBody([{ ratedPlayerId: target.id, skillRating: 1, attitudeRating: 1 }])
    );
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(1);
  });
});

describe('Rating persistence integrity (RT-01)', () => {
  beforeEach(async () => {
    await resetRatingTables();
    await ratingsConfig.clearCache();
  });

  it('enforces range, no-self, and participant constraints at the database', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const outsider = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);

    await expect(
      db.insert(playerRatings).values({ raterId: rater.id, ratedPlayerId: target.id, matchId, skillRating: 6, attitudeRating: 3 })
    ).rejects.toThrow();

    await expect(
      db.insert(playerRatings).values({ raterId: rater.id, ratedPlayerId: rater.id, matchId, skillRating: 4, attitudeRating: 3 })
    ).rejects.toThrow();

    await expect(
      db.insert(playerRatings).values({ raterId: rater.id, ratedPlayerId: outsider.id, matchId, skillRating: 4, attitudeRating: 3 })
    ).rejects.toThrow();
  });

  it('rejects UPDATE and DELETE through the immutability trigger', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await db.insert(playerRatings).values({ raterId: rater.id, ratedPlayerId: target.id, matchId, skillRating: 4, attitudeRating: 3 });

    await expect(
      db.update(playerRatings).set({ skillRating: 1 }).where(eq(playerRatings.matchId, matchId))
    ).rejects.toThrow();
    await expect(db.delete(playerRatings).where(eq(playerRatings.matchId, matchId))).rejects.toThrow();
  });

  it('creates exactly one row for parallel identical submissions', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const body = ratingBody([{ ratedPlayerId: target.id }]);

    const [first, second] = await Promise.all([
      as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(body),
      as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(body),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(await db.select().from(playerRatings).where(eq(playerRatings.matchId, matchId))).toHaveLength(1);
  });
});

describe('Rating summary edge cases and Admin oversight (RT-03/RT-08)', () => {
  beforeEach(async () => {
    await resetRatingTables();
    await ratingsConfig.clearCache();
  });

  it('returns null averages and zeroed distributions for a user with no ratings', async () => {
    const player = await createPlayer();
    const res = await as(player.id, 'get', `/api/v1/users/${player.id}/ratings/summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalRatings).toBe(0);
    expect(res.body.data.averageSkillRating).toBeNull();
    expect(res.body.data.averageAttitudeRating).toBeNull();
    expect(res.body.data.skillDistribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  });

  it('exposes skill-adjustment history to Admin only with pagination meta', async () => {
    const target = await createPlayer('WEAK');
    await db.insert(playerSkillAdjustments).values({
      playerId: target.id,
      previousSkillLevelId: await skillId('BEGINNER'),
      newSkillLevelId: await skillId('WEAK'),
      averageSkillRating: '5',
      ratingsConsidered: 5,
      source: 'AUTO_RATING',
    });

    const admin = await createTestUser({ role: 'ADMIN' });
    const player = await createPlayer();
    const owner = await createTestUser({ role: 'COURT_OWNER' });

    const adminRes = await as(admin.id, 'get', `/api/v1/users/${target.id}/skill-adjustments`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(1);
    expect(adminRes.body.data[0].newSkillLevel.code).toBe('WEAK');
    expect(adminRes.body.data[0].averageSkillRating).toBe(5);
    expect(adminRes.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });

    const playerRes = await as(player.id, 'get', `/api/v1/users/${target.id}/skill-adjustments`);
    expect(playerRes.status).toBe(403);
    expect(playerRes.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

    const ownerRes = await as(owner.id, 'get', `/api/v1/users/${target.id}/skill-adjustments`);
    expect(ownerRes.status).toBe(403);

    const missing = await as(admin.id, 'get', '/api/v1/users/99999999/skill-adjustments');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('Ratings review regressions', () => {
  beforeEach(async () => { await resetRatingTables(); });

  it('rejects coerced JSON scores/identities, duplicate targets and incomplete batches atomically', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const outsider = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const valid = { ratedPlayerId: target.id, skillRating: 4, attitudeRating: 5 };
    for (const invalid of [
      { ...valid, skillRating: true }, { ...valid, attitudeRating: '5' },
      { ...valid, ratedPlayerId: String(target.id) }, { ...valid, attitudeRating: null },
      { ...valid, attitudeRating: undefined }, { ...valid, comment: 'x'.repeat(501) },
    ]) {
      const res = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send({ ratings: [invalid] });
      expect(res.status).toBe(400);
    }
    const repeated = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send({ ratings: [valid, valid] });
    expect(repeated.status).toBe(400);
    const mixed = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send({ ratings: [valid, { ...valid, ratedPlayerId: outsider.id }] });
    expect(mixed.status).toBe(409);
    expect(await db.select().from(playerRatings)).toHaveLength(0);
  });

  it('rejects non-Player targets even for Admin summary/history', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    for (const suffix of ['ratings/summary', 'ratings', 'skill-adjustments']) {
      const res = await as(admin.id, 'get', `/api/v1/users/${owner.id}/${suffix}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    }
  });

  it('keeps self/Admin full aggregates below three, masks both dimensions publicly and hides deleted targets', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const admin = await createTestUser({ role: 'ADMIN' });
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(ratingBody([{ ratedPlayerId: target.id }]));
    for (const viewer of [target, admin]) {
      const res = await as(viewer.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
      expect(res.body.data.averageSkillRating).toBe(4);
      expect(res.body.data.averageAttitudeRating).toBe(5);
      expect(res.body.data.notEnoughData).toBe(true);
    }
    const masked = await as(rater.id, 'get', `/api/v1/users/${target.id}/ratings/summary`);
    expect(masked.body.data).toMatchObject({ averageSkillRating: null, averageAttitudeRating: null, skillDistribution: null, attitudeDistribution: null });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, target.id));
    expect((await as(rater.id, 'get', `/api/v1/users/${target.id}/ratings/summary`)).status).toBe(404);
    expect((await as(admin.id, 'get', `/api/v1/users/${target.id}/ratings/summary`)).status).toBe(200);
  });

  it('serializes crossed multi-target submissions and never adjusts replay after cooldown', async () => {
    await setConfig('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'true');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '1');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '14');
    const a = await createPlayer();
    const b = await createPlayer();
    const x = await createPlayer('BEGINNER');
    const y = await createPlayer('BEGINNER');
    const matchId = await createCompletedMatch('DOUBLES', [a.id, b.id, x.id, y.id]);
    const batch = (ids: number[]) => ratingBody(ids.map(ratedPlayerId => ({ ratedPlayerId, skillRating: 5 })));
    const responses = await Promise.all([
      as(a.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(batch([x.id, y.id])),
      as(b.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(batch([y.id, x.id])),
    ]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(await db.select().from(playerRatings)).toHaveLength(4);
    expect(await db.select().from(playerSkillAdjustments)).toHaveLength(2);
    const evaluate = vi.spyOn(skillAdjustmentService, 'evaluateTarget');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '0');
    const replay = await as(a.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(batch([x.id, y.id]));
    expect(replay.status).toBe(200);
    expect(evaluate).not.toHaveBeenCalled();
    evaluate.mockRestore();
  });

  it('rolls back earlier target level/history writes when a later target adjustment fails', async () => {
    await setConfig('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'true');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '1');
    const rater = await createPlayer();
    const a = await createPlayer('BEGINNER');
    const b = await createPlayer('BEGINNER');
    const matchId = await createCompletedMatch('DOUBLES', [rater.id, a.id, b.id]);
    const original = skillAdjustmentService.evaluateTarget.bind(skillAdjustmentService);
    const spy = vi.spyOn(skillAdjustmentService, 'evaluateTarget')
      .mockImplementationOnce(original).mockRejectedValueOnce(new Error('second target failed'));
    try {
      const res = await as(rater.id, 'post', `/api/v1/matches/${matchId}/ratings`).send(ratingBody([
        { ratedPlayerId: a.id, skillRating: 5 }, { ratedPlayerId: b.id, skillRating: 5 },
      ]));
      expect(res.status).toBe(500);
      expect(await db.select().from(playerRatings)).toHaveLength(0);
      expect(await db.select().from(playerSkillAdjustments)).toHaveLength(0);
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, a.id));
      expect(profile.skillLevelId).toBe(await skillId('BEGINNER'));
    } finally { spy.mockRestore(); }
  });

  it('uses strict registry parsing, defaults, defensive copies and invalidation', async () => {
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '0x10');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_THRESHOLD', '1e0');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '366');
    await setConfig('TOURNAMENT_RATING_ENABLED', 'yes');
    const fallback = await ratingsConfig.get();
    expect(fallback).toEqual({ tournamentRatingEnabled: true, skillAdjustment: { enabled: false, minRatings: 5, threshold: 1, cooldownDays: 14 } });
    fallback.skillAdjustment.minRatings = 99;
    expect((await ratingsConfig.get()).skillAdjustment.minRatings).toBe(5);
    await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '0');
    await setConfig('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '100');
    await setConfig('TOURNAMENT_RATING_ENABLED', ' FALSE ');
    expect(await ratingsConfig.get()).toMatchObject({ tournamentRatingEnabled: false, skillAdjustment: { minRatings: 100, cooldownDays: 0 } });
  });

  it('enforces actual session authentication and CSRF for submission', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const url = `/api/v1/matches/${matchId}/ratings`;
    expect((await request(app).post(url).send(ratingBody([{ ratedPlayerId: target.id }]))).status).toBe(401);
    const session = request.agent(app);
    const login = await session.post('/api/v1/auth/login').send({ email: rater.email, password: rater.plainPassword });
    expect(login.status).toBe(200);
    const denied = await session.post(url).send(ratingBody([{ ratedPlayerId: target.id }]));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const csrf = cookies.find(cookie => cookie.startsWith('csrf_token='))!.split(';')[0].slice('csrf_token='.length);
    const created = await session.post(url).set('X-CSRF-Token', csrf).send(ratingBody([{ ratedPlayerId: target.id }]));
    expect(created.status).toBe(201);
  });

  it('rejects all non-played Tournament resolutions on pending and POST', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await createTournamentMatch(matchId, 'WALKOVER');
    for (const resolution of ['WALKOVER', 'UNRESOLVED', 'NONE']) {
      await db.update(tournamentMatches).set({ resolution }).where(eq(tournamentMatches.matchId, matchId));
      const pending = await as(rater.id, 'get', `/api/v1/matches/${matchId}/ratings/pending`);
      expect(pending.status).toBe(409);
      expect(pending.body.error.code).toBe('RATING_MATCH_NOT_PLAYED');
    }
  });
});

describe('Ratings migration and timestamp regressions', () => {
  beforeEach(async () => { await resetRatingTables(); });

  it.each([false, true])('applies the actual migration to isolated legacy schema (populated=%s), preserving FKs/config', async (populated) => {
    const client = await pool.connect();
    try {
      expect((await client.query('select current_database() as name')).rows[0].name).toBe('badminton_test');
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA ratings_migration_review');
      await client.query('SET LOCAL search_path TO ratings_migration_review');
      await client.query(`
        CREATE TABLE users (id bigint PRIMARY KEY);
        CREATE TABLE skill_levels (id bigint PRIMARY KEY);
        CREATE TABLE matches (id bigint PRIMARY KEY);
        CREATE TABLE match_players (match_id bigint, player_id bigint, UNIQUE(match_id, player_id));
        CREATE TABLE system_configs (config_key text UNIQUE, config_value text, description text);
        CREATE TABLE player_ratings (
          id bigint PRIMARY KEY, rater_id bigint REFERENCES users(id), rated_player_id bigint REFERENCES users(id),
          match_id bigint REFERENCES matches(id), rating integer NOT NULL, comment text,
          created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
          CONSTRAINT uq_player_rating UNIQUE(rater_id, rated_player_id, match_id),
          FOREIGN KEY(match_id, rater_id) REFERENCES match_players(match_id, player_id),
          FOREIGN KEY(match_id, rated_player_id) REFERENCES match_players(match_id, player_id)
        );
        INSERT INTO users VALUES (1),(2);
        INSERT INTO matches VALUES (1);
        INSERT INTO match_players VALUES (1,1),(1,2);
        ${populated ? 'INSERT INTO player_ratings(id,rater_id,rated_player_id,match_id,rating) VALUES (1,1,2,1,4);' : ''}
        INSERT INTO system_configs VALUES ('TOURNAMENT_RATING_ENABLED','false','custom');
      `);
      await client.query(readFileSync('src/db/migrations/0008_ratings_two_dimensions.sql', 'utf8'));
      expect((await client.query('SELECT skill_rating, attitude_rating FROM player_ratings')).rows).toEqual(populated ? [{ skill_rating: 4, attitude_rating: 4 }] : []);
      expect((await client.query('SELECT config_value FROM system_configs WHERE config_key=$1', ['TOURNAMENT_RATING_ENABLED'])).rows[0].config_value).toBe('false');
      expect((await client.query("SELECT count(*)::int AS total FROM pg_constraint WHERE conrelid='player_ratings'::regclass AND contype='f'")).rows[0].total).toBe(5);
      expect((await client.query('SELECT count(*)::int AS total FROM system_configs')).rows[0].total).toBe(5);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('timestamps a rating at insertion time rather than transaction start before a lock wait', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const matchId = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const { ratingRepository } = await import('../repositories/ratings/RatingRepository');
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT now()`);
      const [row] = await ratingRepository.insertRatings([{ raterId: rater.id, ratedPlayerId: target.id, matchId, skillRating: 5, attitudeRating: 5, comment: null }], tx);
      const timing = await tx.execute(sql`SELECT created_at > transaction_timestamp()::timestamp AS after_start FROM player_ratings WHERE id = ${row.id}`);
      expect(timing.rows[0].after_start).toBe(true);
    });
  });

  it('enforces append-only adjustment history and paginates for inactive Player oversight', async () => {
    const target = await createPlayer();
    const admin = await createTestUser({ role: 'ADMIN' });
    const values = { playerId: target.id, previousSkillLevelId: await skillId('BEGINNER'), newSkillLevelId: await skillId('WEAK'), averageSkillRating: '4.995', ratingsConsidered: 5, createdAt: new Date('2026-01-01') };
    const history = await db.insert(playerSkillAdjustments).values([values, values]).returning();
    await expect(db.update(playerSkillAdjustments).set({ ratingsConsidered: 1 }).where(eq(playerSkillAdjustments.id, history[0].id))).rejects.toThrow();
    await expect(db.delete(playerSkillAdjustments).where(eq(playerSkillAdjustments.id, history[0].id))).rejects.toThrow();
    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, target.id));
    const res = await as(admin.id, 'get', `/api/v1/users/${target.id}/skill-adjustments?page=1&limit=1`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe(history[1].id);
    expect(res.body.data[0].averageSkillRating).toBe(5);
    expect(res.body.meta).toMatchObject({ total: 2, totalPages: 2 });
  });
});

describe('Ratings configuration cache and recent window', () => {
  beforeEach(async () => { await resetRatingTables(); });

  it('uses a bounded cache TTL and logs missing/invalid values', async () => {
    const { logger } = await import('../shared/logging/logger');
    const warn = vi.spyOn(logger, 'warn');
    const error = vi.spyOn(logger, 'error');
    const timestamp = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(timestamp);
    try {
      await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'PLAYER_SKILL_ADJUSTMENT_THRESHOLD'));
      await setConfig('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', '-1');
      expect((await ratingsConfig.get()).skillAdjustment).toMatchObject({ threshold: 1, cooldownDays: 14 });
      expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ configKey: 'PLAYER_SKILL_ADJUSTMENT_THRESHOLD' }));
      expect(error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ configKey: 'PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS' }));
      await db.update(systemConfigs).set({ configValue: '7' }).where(eq(systemConfigs.configKey, 'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS'));
      expect((await ratingsConfig.get()).skillAdjustment.minRatings).toBe(5);
      clock.mockReturnValue(timestamp + 60001);
      expect((await ratingsConfig.get()).skillAdjustment.minRatings).toBe(7);
    } finally { warn.mockRestore(); error.mockRestore(); clock.mockRestore(); ratingsConfig.clearCache(); }
  });

  it('selects the latest N submissions by timestamp and ID rather than Match date', async () => {
    const rater = await createPlayer();
    const target = await createPlayer();
    const first = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const second = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    const third = await createCompletedMatch('SINGLES', [rater.id, target.id]);
    await db.insert(playerRatings).values([
      { raterId: rater.id, ratedPlayerId: target.id, matchId: first, skillRating: 1, attitudeRating: 1, createdAt: new Date('2026-01-02') },
      { raterId: rater.id, ratedPlayerId: target.id, matchId: second, skillRating: 3, attitudeRating: 3, createdAt: new Date('2026-01-02') },
      { raterId: rater.id, ratedPlayerId: target.id, matchId: third, skillRating: 5, attitudeRating: 5, createdAt: new Date('2026-01-01') },
    ]);
    const { skillAdjustmentRepository } = await import('../repositories/ratings/SkillAdjustmentRepository');
    expect(await skillAdjustmentRepository.findRecentSkillRatings(target.id, 2)).toEqual([3, 1]);
  });
});
