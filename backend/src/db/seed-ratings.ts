import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db, pool, users, skillLevels, matches, matchPlayers, playerRatings, matchmakingRequests, matchmakingMatches, posts } from './index';
import { ensureSeedPlayerProfile, type SeedLevelCode } from './seeds/skill-survey-seed';
import { hashPassword } from '../utils/password';
import { ratingsConfig } from '../shared/config/ratings-config';

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Rating demo is for local development only');
  const connection = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) {
    throw new Error('Rating demo requires a local PostgreSQL database');
  }
  const batch = process.env.RATING_DEMO_BATCH || 'default';
  if (!/^[a-z0-9-]{1,32}$/.test(batch)) throw new Error('RATING_DEMO_BATCH: use 1–32 lowercase letters, digits or hyphens');
  const config = await ratingsConfig.get();
  const password = 'Password@123';
  const passwordHash = await hashPassword(password);
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(64102819)`);
    const email = (name: string) => `rating.${batch}.${name}@example.com`;
    const existing = await tx.select().from(users).where(eq(users.email, email('rater')));
    if (existing.length) {
      const links = await tx.select({ matchId: matchmakingMatches.matchId, status: matches.status })
        .from(matchmakingRequests).innerJoin(matchmakingMatches, eq(matchmakingRequests.id, matchmakingMatches.matchmakingRequestId))
        .innerJoin(matches, eq(matches.id, matchmakingMatches.matchId)).where(eq(matchmakingRequests.playerId, existing[0].id));
      return { reused: true, matches: links, accounts: ['rater', 'target', 'partner', 'opponent', 'outsider', 'admin'].map(email) };
    }
    const levels = await tx.select().from(skillLevels);
    const beginner = levels.find(level => level.code === 'BEGINNER');
    const highest = [...levels].sort((a, b) => b.rank - a.rank)[0];
    if (!beginner || !highest) throw new Error('Run npm run db:migrate first (skill levels are required)');
    const accounts = [];
    for (const name of ['rater', 'target', 'partner', 'opponent', 'outsider', 'admin']) {
      const [user] = await tx.insert(users).values({ email: email(name), passwordHash, role: name === 'admin' ? 'ADMIN' : 'PLAYER', status: 'ACTIVE' }).returning();
      if (name !== 'admin') await ensureSeedPlayerProfile(tx, { userId: user.id, fullName: `Rating ${batch} ${name}`, levelCode: 'BEGINNER' });
      accounts.push(user);
    }
    const [rater, target, partner] = accounts;
    const participants = accounts.slice(0, 4);
    const now = new Date();
    const past = new Date(now.getTime() - 86400000);
    for (let i = 0; i < config.skillAdjustment.minRatings - 1; i++) {
      const [match] = await tx.insert(matches).values({ matchType: 'SINGLES', status: 'COMPLETED', scheduledAt: past, startedAt: past, completedAt: past }).returning();
      await tx.insert(matchPlayers).values([partner, target].map((user, index) => ({ matchId: match.id, playerId: user.id, teamNo: index + 1, status: 'ACTIVE', joinedAt: past })));
      await tx.insert(playerRatings).values({ matchId: match.id, raterId: partner.id, ratedPlayerId: target.id, skillRating: 5, attitudeRating: 4, comment: 'Dữ liệu mẫu trước khi test', createdAt: past, updatedAt: past });
    }
    const extraGiven = Number(process.env.RATING_DEMO_GIVEN ?? '0');
    if (!Number.isInteger(extraGiven) || extraGiven < 0 || extraGiven > 100) {
      throw new Error('RATING_DEMO_GIVEN: use an integer between 0 and 100');
    }
    const demoMatches = [];
    for (const status of ['COMPLETED', 'IN_PROGRESS']) {
      const [match] = await tx.insert(matches).values({ matchType: 'DOUBLES', status, scheduledAt: past, startedAt: past, completedAt: status === 'COMPLETED' ? past : null }).returning();
      await tx.insert(matchPlayers).values(participants.map((user, index) => ({ matchId: match.id, playerId: user.id, teamNo: index < 2 ? 1 : 2, status: 'ACTIVE', joinedAt: past })));
      // MM-21: each recruitment has its unpublished MATCH_FINDING post and interval fields.
      const [post] = await tx.insert(posts).values({ authorId: rater.id, type: 'MATCH_FINDING' }).returning({ id: posts.id });
      const [request] = await tx.insert(matchmakingRequests).values({ postId: post.id, startAt: past, durationMinutes: 120, capacity: 4, minPlayers: 4, playerId: rater.id, matchType: 'DOUBLES', minSkillLevelId: beginner.id, maxSkillLevelId: highest.id, preferredDate: past.toISOString().slice(0, 10), preferredStartTime: '10:00', preferredEndTime: '12:00', matchDurationMinutes: 120, status: 'MATCHED', expiresAt: past, area: `Rating demo ${batch}` }).returning();
      await tx.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: past });
      demoMatches.push({ matchId: match.id, status });
    }
    const givenMatches: number[] = [];
    for (let i = 0; i < extraGiven; i++) {
      const scheduled = new Date(past.getTime() - (i + 1) * 86400000);
      const [match] = await tx.insert(matches).values({
        matchType: 'SINGLES', status: 'COMPLETED', scheduledAt: scheduled, startedAt: scheduled, completedAt: scheduled,
      }).returning();
      await tx.insert(matchPlayers).values([
        { matchId: match.id, playerId: rater.id, teamNo: 1, status: 'ACTIVE', joinedAt: scheduled },
        { matchId: match.id, playerId: target.id, teamNo: 2, status: 'ACTIVE', joinedAt: scheduled },
      ]);
      const [post] = await tx.insert(posts).values({ authorId: rater.id, type: 'MATCH_FINDING' }).returning({ id: posts.id });
      const [request] = await tx.insert(matchmakingRequests).values({
        postId: post.id, startAt: scheduled, durationMinutes: 90, capacity: 2, minPlayers: 2,
        playerId: rater.id, matchType: 'SINGLES', minSkillLevelId: beginner.id, maxSkillLevelId: highest.id,
        preferredDate: scheduled.toISOString().slice(0, 10), preferredStartTime: '10:00', preferredEndTime: '11:30',
        matchDurationMinutes: 90, status: 'MATCHED', expiresAt: scheduled, area: `Rating demo ${batch}`,
      }).returning();
      await tx.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: scheduled });
      await tx.insert(playerRatings).values({
        matchId: match.id, raterId: rater.id, ratedPlayerId: target.id,
        skillRating: 4 + (i % 2), attitudeRating: 4, comment: `Đánh giá mẫu lịch sử #${i + 1}`,
        createdAt: scheduled, updatedAt: scheduled,
      });
      givenMatches.push(match.id);
    }
    return { reused: false, matches: demoMatches, givenRatings: givenMatches.length, givenMatches,
      accounts: accounts.map(user => ({ id: user.id, email: user.email, role: user.role })) };
  });
  console.log(JSON.stringify({ ...result, password, skillAdjustment: config.skillAdjustment }, null, 2));
  for (const match of result.matches) console.log(`${match.status}: http://localhost:5173/matchmaking/matches/${match.matchId}`);
}

seed().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
