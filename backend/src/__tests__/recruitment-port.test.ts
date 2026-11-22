import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, posts, matchmakingRequests, matchmakingInvitations, matchmakingMatches, matches } from '../db';
import { recruitmentPort } from '../services/matchmaking/RecruitmentService';
import { as, matchFindingPost, player, setConfig, skillIds, startIn } from './social-fixture';
import type { RecruitmentDraftInput } from '../contracts/RecruitmentPort';

// MM-23: RecruitmentPort provider tested directly through a caller transaction (the
// canonical POST /posts match-finding endpoint is SOC-04), plus PATCH/publish routes
// (Matchmaking Tech Design §24.4, §24.9, §24.10, §24.14). Runs against badminton_test only.

async function attempt(host: number, draft: Partial<RecruitmentDraftInput>, publish = false) {
  try {
    return await matchFindingPost(host, draft, publish);
  } catch (error) {
    return error as { code: string; statusCode: number };
  }
}
const requestRow = async (id: number) => (await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, id)))[0];
const postRow = async (id: number) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

describe('RecruitmentPort.createForPost', () => {
  let host: number;
  beforeEach(async () => {
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    await setConfig('MATCHMAKING_MATCH_DURATION_MINUTES', '90');
    host = await player();
  });

  it('creates a GROUP recruitment with the post in the caller transaction; Singles/Doubles snapshot duration', async () => {
    const group = await matchFindingPost(host, { matchType: 'GROUP', capacity: 8, minPlayers: 4, companionCount: 2, durationMinutes: 120, costNote: '  50k/người ' });
    expect(await requestRow(group.requestId)).toMatchObject({
      postId: group.postId, playerId: host, matchType: 'GROUP', status: 'OPEN', capacity: 8, minPlayers: 4,
      companionCount: 2, durationMinutes: 120, costNote: '50k/người', preferredDate: null, area: null,
    });
    const doubles = await matchFindingPost(host, { matchType: 'DOUBLES', startAt: startIn(100) });
    expect(await requestRow(doubles.requestId)).toMatchObject({ capacity: 4, minPlayers: 4, companionCount: 0, durationMinutes: 90 });
    const row = await requestRow(doubles.requestId);
    expect(row.expiresAt?.getTime()).toBe(row.startAt.getTime());
    expect((await postRow(doubles.postId)).publishedAt).toBeNull();
  });

  it('validates type/capacity/minimum/companions/duration/lead time/skill range with the approved codes', async () => {
    const levels = await skillIds();
    const cases: [Partial<RecruitmentDraftInput>, string][] = [
      [{ matchType: 'GROUP', capacity: 2, minPlayers: 2 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'GROUP', capacity: 13, minPlayers: 2 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'GROUP', capacity: 6, minPlayers: 1 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'GROUP', capacity: 6, minPlayers: 7 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'GROUP', capacity: 6, minPlayers: 3, companionCount: 6 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'GROUP', capacity: 6, minPlayers: 3, durationMinutes: 59 }, 'MATCHMAKING_INVALID_DURATION'],
      [{ matchType: 'GROUP', capacity: 6, minPlayers: 3, durationMinutes: 181 }, 'MATCHMAKING_INVALID_DURATION'],
      [{ matchType: 'DOUBLES', companionCount: 1 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'SINGLES', capacity: 4 }, 'MATCHMAKING_INVALID_CAPACITY'],
      [{ matchType: 'SINGLES', durationMinutes: 60 }, 'MATCHMAKING_INVALID_DURATION'],
      [{ startAt: startIn(0.5) }, 'MATCHMAKING_START_TOO_SOON'],
      [{ minSkillLevelId: levels.max, maxSkillLevelId: levels.min }, 'MATCHMAKING_INVALID_SKILL_RANGE'],
    ];
    for (const [draft, code] of cases) {
      const result = await attempt(host, draft);
      expect((result as any).code, JSON.stringify(draft)).toBe(code);
    }
    // Atomicity: no post or recruitment row survives a rejected creation.
    expect(await db.select().from(posts)).toEqual([]);
    expect(await db.select().from(matchmakingRequests)).toEqual([]);
  });

  it('counts open posts per §24.14 and rejects the 4th', async () => {
    const other = await player();
    const a = await matchFindingPost(host, { startAt: startIn(30) });                // OPEN, unpublished
    await matchFindingPost(host, { startAt: startIn(40) }, true);                    // OPEN, published
    const c = await matchFindingPost(host, { startAt: startIn(50) });
    const [match] = await db.insert(matches).values({ matchType: 'DOUBLES', scheduledAt: new Date(Date.now() + 50 * 3_600_000), status: 'PENDING_COURT' }).returning();
    await db.insert(matchmakingMatches).values({ matchmakingRequestId: c.requestId, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });
    await db.update(matchmakingRequests).set({ status: 'MATCHED' }).where(eq(matchmakingRequests.id, c.requestId)); // MATCHED, active Match
    expect((await attempt(host, { startAt: startIn(60) }) as any).code).toBe('MATCHMAKING_OPEN_POST_LIMIT');
    // Not counted: CANCELLED, EXPIRED, MATCHED with a terminal Match.
    await db.update(matchmakingRequests).set({ status: 'CANCELLED' }).where(eq(matchmakingRequests.id, a.requestId));
    const d = await matchFindingPost(host, { startAt: startIn(70) });
    expect(d.requestId).toBeGreaterThan(0);
    await db.update(matches).set({ status: 'COMPLETED' }).where(eq(matches.id, match.id));
    await db.update(matchmakingRequests).set({ status: 'EXPIRED' }).where(eq(matchmakingRequests.id, d.requestId));
    await matchFindingPost(host, { startAt: startIn(80) });
    await matchFindingPost(host, { startAt: startIn(90) });
    expect((await attempt(host, { startAt: startIn(110) }) as any).code).toBe('MATCHMAKING_OPEN_POST_LIMIT');
    // Another host's posts are independent.
    expect((await matchFindingPost(other, { startAt: startIn(30) })).requestId).toBeGreaterThan(0);
  });

  it('allows exactly the limit under concurrent creates', async () => {
    const results = await Promise.all([30, 40, 50, 60, 70, 80].map(h => attempt(host, { startAt: startIn(h) })));
    expect(results.filter((r: any) => r.requestId)).toHaveLength(3);
    expect(results.filter((r: any) => r.code === 'MATCHMAKING_OPEN_POST_LIMIT')).toHaveLength(3);
    expect(await db.select().from(posts)).toHaveLength(3);
  });

  it('rechecks the host schedule and honours the Matchmaking gate', async () => {
    const at = startIn(30);
    await matchFindingPost(host, { startAt: at });
    expect((await attempt(host, { startAt: at }) as any).code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');
    await setConfig('MATCHMAKING_ENABLED', 'false');
    expect((await attempt(host, { startAt: startIn(80) }) as any).code).toBe('MATCHMAKING_DISABLED');
  });

  it('publishes in the same transaction only with an open slot', async () => {
    const full = await attempt(host, { matchType: 'GROUP', capacity: 3, minPlayers: 2, companionCount: 2 }, true);
    expect((full as any).code).toBe('MATCHMAKING_REQUEST_FULL');
    expect(await db.select().from(posts)).toEqual([]);
    const ok = await matchFindingPost(host, { matchType: 'GROUP', capacity: 4, minPlayers: 2, companionCount: 2 }, true);
    expect(ok.publishedAt).not.toBeNull();
    expect((await postRow(ok.postId)).publishedAt).toEqual(ok.publishedAt);
  });

  it('provides cancelForAuthorDeletion from MM-25 (exercised in social-match-finding.test.ts)', () => {
    expect(typeof recruitmentPort.cancelForAuthorDeletion).toBe('function');
  });
});

describe('PATCH /matchmaking-requests/:id and POST /:id/publish', () => {
  let host: number;
  let member: number;
  beforeEach(async () => {
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    host = await player();
    member = await player();
  });

  async function accept(requestId: number, playerId: number) {
    await db.insert(matchmakingInvitations).values({
      requestId, createdBy: host, playerId, kind: 'INVITE', status: 'ACCEPTED', expiresAt: new Date(Date.now() + 3_600_000), respondedAt: new Date(),
    });
  }

  it('edits fields before acceptance and locks start, type and capacity after the first acceptance', async () => {
    const mf = await matchFindingPost(host, { matchType: 'GROUP', capacity: 6, minPlayers: 3 });
    const before = await as(host, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`)
      .send({ startAt: startIn(60), capacity: 8, durationMinutes: 150 });
    expect(before.status, JSON.stringify(before.body)).toBe(200);
    expect(await requestRow(mf.requestId)).toMatchObject({ capacity: 8, durationMinutes: 150 });
    await accept(mf.requestId, member);
    for (const body of [{ startAt: startIn(70) }, { matchType: 'DOUBLES' }, { capacity: 10 }]) {
      const res = await as(host, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`).send(body);
      expect(res.status, JSON.stringify(body)).toBe(409);
      expect(res.body.error.code).toBe('MATCHMAKING_FIELD_LOCKED');
    }
    const allowed = await as(host, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`).send({ costNote: 'Mang nước', minPlayers: 4 });
    expect(allowed.status).toBe(200);
    expect(await requestRow(mf.requestId)).toMatchObject({ costNote: 'Mang nước', minPlayers: 4 });
    const overfill = await as(host, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`).send({ companionCount: 8 });
    expect(overfill.body.error.code).toBe('MATCHMAKING_INVALID_CAPACITY');
    const stranger = await as(member, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`).send({ costNote: 'x' });
    expect(stranger.status).toBe(404);
  });

  it('publishes with guards: host only, open slot, lead time, OPEN, Matchmaking gate; idempotent', async () => {
    const mf = await matchFindingPost(host, { matchType: 'DOUBLES' });
    expect((await as(member, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`)).status).toBe(404);
    await setConfig('MATCHMAKING_ENABLED', 'false');
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`)).body.error.code).toBe('MATCHMAKING_DISABLED');
    await setConfig('MATCHMAKING_ENABLED', 'true');
    const first = await as(host, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const again = await as(host, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`);
    expect(again.body.data.publishedAt).toBe(first.body.data.publishedAt);

    const full = await matchFindingPost(host, { matchType: 'SINGLES', startAt: startIn(100) });
    await accept(full.requestId, member);
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${full.requestId}/publish`)).body.error.code).toBe('MATCHMAKING_REQUEST_FULL');

    const soon = await matchFindingPost(host, { matchType: 'SINGLES', startAt: startIn(150) });
    await db.update(matchmakingRequests).set({ startAt: new Date(Date.now() + 10 * 60_000), expiresAt: new Date(Date.now() + 10 * 60_000) })
      .where(eq(matchmakingRequests.id, soon.requestId));
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${soon.requestId}/publish`)).body.error.code).toBe('MATCHMAKING_START_TOO_SOON');
    await db.update(matchmakingRequests).set({ status: 'CANCELLED' }).where(eq(matchmakingRequests.id, soon.requestId));
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${soon.requestId}/publish`)).body.error.code).toBe('MATCHMAKING_REQUEST_NOT_OPEN');
  });

  it('serves detail tiers: pending invitee context, public fields only when published and visible', async () => {
    const stranger = await player();
    const mf = await matchFindingPost(host, { matchType: 'DOUBLES' });
    await db.insert(matchmakingInvitations).values({ requestId: mf.requestId, createdBy: host, playerId: member, kind: 'INVITE', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000) });
    const invitee = await as(member, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`);
    expect(invitee.status).toBe(200);
    expect(invitee.body.data).toMatchObject({ access: 'INVITEE', capacity: 4, filledSlots: 1 });
    expect(invitee.body.data.members).toBeUndefined();
    expect((await as(stranger, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).status).toBe(404);
    await as(host, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`);
    const pub = await as(stranger, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ access: 'PUBLIC', members: [] });
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).body.data.access).toBe('HOST');
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, mf.postId));
    expect((await as(stranger, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).status).toBe(404);
  });
});
