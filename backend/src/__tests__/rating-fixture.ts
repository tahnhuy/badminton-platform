import { db, playerProfiles, skillLevels, matches, matchPlayers, playerRatings, matchmakingRequests, matchmakingMatches, systemConfigs } from '../db';
import { sql } from 'drizzle-orm';
import { ratingsConfig, RATINGS_CONFIG_DEFAULTS } from '../shared/config/ratings-config';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';

/** Test-runner-only fixture. No route is registered in the production app. */
export async function seedRatingFixture() {
  const current = await db.execute(sql`SELECT current_database() AS name`);
  if (current.rows[0].name !== 'badminton_test') throw new Error('Ratings fixture requires badminton_test');
  // The automatic adjustment path is disabled by product default; enable it only in this
  // test fixture so the E2E spec can still exercise RT-06 against a real database.
  const config = { ...RATINGS_CONFIG_DEFAULTS, PLAYER_SKILL_ADJUSTMENT_ENABLED: true, PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS: 0 };
  for (const [configKey, value] of Object.entries(config)) {
    await db.insert(systemConfigs).values({ configKey, configValue: String(value), description: 'Ratings E2E default' })
      .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: String(value) } });
  }
  ratingsConfig.clearCache();
  const levels = await db.select().from(skillLevels);
  const beginner = levels.find(level => level.code === 'BEGINNER')!;
  const players = [];
  for (const fullName of ['Rating Rater', 'Rating Target', 'Rating Partner', 'Rating Opponent']) {
    const user = await createTestUser({ role: 'PLAYER' });
    await db.insert(playerProfiles).values({ userId: user.id, fullName, skillLevelId: beginner.id });
    players.push({ ...user, fullName });
  }
  const [rater, target, partner, opponent] = players;
  const admin = await createTestUser({ role: 'ADMIN' });
  // Four historical scores plus the browser submission exercise the default N=5.
  for (let i = 0; i < 4; i++) {
    const [old] = await db.insert(matches).values({ matchType: 'SINGLES', status: 'COMPLETED', scheduledAt: new Date('2026-01-01'), completedAt: new Date('2026-01-01') }).returning();
    await db.insert(matchPlayers).values([
      { matchId: old.id, playerId: partner.id, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
      { matchId: old.id, playerId: target.id, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
    ]);
    await db.insert(playerRatings).values({ matchId: old.id, raterId: partner.id, ratedPlayerId: target.id, skillRating: 5, attitudeRating: 5 });
  }
  const [match] = await db.insert(matches).values({ matchType: 'DOUBLES', status: 'COMPLETED', scheduledAt: new Date('2026-01-02'), completedAt: new Date('2026-01-02') }).returning();
  await db.insert(matchPlayers).values(players.map((player, i) => ({ matchId: match.id, playerId: player.id, teamNo: i < 2 ? 1 : 2, status: 'ACTIVE', joinedAt: new Date() })));
  const [request] = await db.insert(matchmakingRequests).values({ playerId: rater.id, matchType: 'DOUBLES', minSkillLevelId: beginner.id, maxSkillLevelId: levels.at(-1)!.id, preferredDate: '2026-01-02', preferredStartTime: '10:00', preferredEndTime: '12:00', matchDurationMinutes: 120, status: 'MATCHED', expiresAt: new Date('2026-01-02'), ...(await recruitmentFixtureColumns(rater.id, 'DOUBLES', new Date('2026-01-02T03:00:00Z'), 120)) }).returning();
  await db.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date('2026-01-02') });
  return { matchId: match.id, rater, target, partner, opponent, admin };
}
