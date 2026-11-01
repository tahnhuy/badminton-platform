import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, posts, postImages, matchmakingRequests, matchmakingInvitations, matches } from '../db';
import { createTestUser } from './test-helpers';
import { privateMediaService } from '../services/media/PrivateMediaService';
import { socialRepository } from '../repositories/social/SocialRepository';
import { recruitmentPort, RECRUITMENT_PROJECTION_FIELDS } from '../services/matchmaking/RecruitmentService';
import { as, freePost, matchFindingPost, player, png, setConfig, skillIds } from './social-fixture';

// SOC-05 feed/detail/shared visibility and SOC-07 Admin hide (Social Tech Design §7.3,
// §7.6, §8, §9; Matchmaking §24.9 tiers). Runs against badminton_test only.

async function attachImage(postId: number, ownerId: number): Promise<number> {
  const [stored] = await privateMediaService.transaction(tx => privateMediaService.storeImages(
    [{ buffer: pngBuffer!, mimetype: 'image/png' }], ownerId, tx, { invalidImageCode: 'SOCIAL_IMAGE_INVALID' }));
  await db.insert(postImages).values({ postId, mediaId: stored.id, position: 1 });
  return stored.id;
}
let pngBuffer: Buffer | null = null;

async function invite(host: number, requestId: number, target: number, status: 'PENDING' | 'ACCEPTED' = 'PENDING') {
  const [row] = await db.insert(matchmakingInvitations).values({
    requestId, createdBy: host, playerId: target, kind: 'INVITE', status, expiresAt: new Date(Date.now() + 3_600_000),
    respondedAt: status === 'ACCEPTED' ? new Date() : null,
  }).returning();
  return row.id;
}

describe('GET /api/v1/posts feed', () => {
  let author: number;
  let viewer: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player();
    viewer = await player();
  });

  it('orders by published_at DESC, id DESC; edits do not reorder; asOf excludes later posts; paginates', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await freePost(author, `p${i}`)).body.data.id);
    // Same published_at for two posts: id breaks the tie.
    await db.execute(sql`UPDATE posts SET published_at = (SELECT published_at FROM posts WHERE id = ${ids[3]}) WHERE id = ${ids[4]}`);
    await as(author, 'patch', `/api/v1/posts/${ids[0]}`).send({ body: 'edited' });
    const page1 = await as(viewer, 'get', '/api/v1/posts?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.data.map((p: any) => p.id)).toEqual([ids[4], ids[3]]);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    const asOf = page1.body.meta.asOf;
    const late = (await freePost(author, 'late')).body.data.id;
    await db.execute(sql`UPDATE posts SET published_at = now() + interval '1 second' WHERE id = ${late}`);
    const page3 = await as(viewer, 'get', `/api/v1/posts?limit=2&page=3&asOf=${encodeURIComponent(asOf)}`);
    expect(page3.body.data.map((p: any) => p.id)).toEqual([ids[0]]);
    const all = await as(viewer, 'get', `/api/v1/posts?limit=50&asOf=${encodeURIComponent(asOf)}`);
    expect(all.body.data.map((p: any) => p.id)).not.toContain(late);
    expect((await as(viewer, 'get', '/api/v1/posts?limit=51')).status).toBe(400);
  });

  it('applies recruitment filters to match-finding posts only and excludes ended posts by default', async () => {
    const levels = await skillIds();
    await freePost(author, 'free');
    const doubles = await matchFindingPost(author, { matchType: 'DOUBLES', startAt: '2099-01-10T03:00:00.000Z' }, true); // 10:00 local
    const host2 = await player();
    const group = await matchFindingPost(host2, {
      matchType: 'GROUP', capacity: 6, minPlayers: 3, companionCount: 1, startAt: '2099-01-11T12:00:00.000Z', // 19:00 local
      minSkillLevelId: levels.mid, maxSkillLevelId: levels.mid,
    }, true);
    const host3 = await player();
    const ended = await matchFindingPost(host3, { matchType: 'SINGLES' }, true);
    await db.update(matchmakingRequests).set({ status: 'CANCELLED' }).where(eq(matchmakingRequests.id, ended.requestId));
    const unpublished = await matchFindingPost(await player(), { matchType: 'SINGLES' }, false);

    const ids = async (query: string) => (await as(viewer, 'get', `/api/v1/posts?${query}`)).body.data.map((p: any) => p.id);
    const defaultFeed = await ids('');
    expect(defaultFeed).toContain(doubles.postId);
    expect(defaultFeed).toContain(group.postId);
    expect(defaultFeed).not.toContain(ended.postId);
    expect(defaultFeed).not.toContain(unpublished.postId);
    expect(defaultFeed).toHaveLength(3);
    expect(await ids('includeEnded=true')).toContain(ended.postId);
    expect(await ids('type=FREE')).toHaveLength(1);
    expect(await ids('matchType=GROUP')).toEqual([group.postId]);
    expect(await ids('date=2099-01-10')).toEqual([doubles.postId]);
    expect(await ids('timeFrom=18:00&timeTo=20:00')).toEqual([group.postId]);
    expect(await ids(`skillLevelId=${levels.min}`)).toEqual([doubles.postId]);
    expect(await ids('hasOpenSlots=true')).toEqual(expect.arrayContaining([doubles.postId, group.postId]));
    // Full recruitment (1 + companions + accepted = capacity) has no open slot.
    for (let i = 0; i < 4; i += 1) await invite(host2, group.requestId, await player(), 'ACCEPTED');
    expect(await ids('hasOpenSlots=true')).toEqual([doubles.postId]);
    // Ended posts remain reachable by link while visible; detail shows the ended state.
    const detail = await as(viewer, 'get', `/api/v1/posts/${ended.postId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.recruitment).toMatchObject({ status: 'CANCELLED', ended: true });
    // Feed reads do not change recruitment state.
    expect((await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, doubles.requestId)))[0].status).toBe('OPEN');
  });

  it('rejects non-calendar dates with 400 VALIDATION_FAILED before the repository; accepts real leap days', async () => {
    const spy = vi.spyOn(socialRepository, 'findFeedPage');
    try {
      for (const date of ['2026-13-01', '2026-00-10', '2026-01-00', '2026-01-32', '2026-04-31', '2026-02-29', '2100-02-29', '0000-01-01', '2026-1-01', '2026-02-3a']) {
        const res = await as(viewer, 'get', `/api/v1/posts?date=${date}`);
        expect(res.status, date).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(res.body.error.details[0].field).toBe('date');
      }
      expect(spy).not.toHaveBeenCalled();
      for (const date of ['2028-02-29', '2000-02-29', '2026-12-31']) {
        expect((await as(viewer, 'get', `/api/v1/posts?date=${date}`)).status, date).toBe(200);
      }
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('batches the card projection per page (no per-post recruitment query)', async () => {
    for (let i = 0; i < 3; i += 1) await matchFindingPost(await player(), { matchType: 'SINGLES' }, true);
    const spy = vi.spyOn(recruitmentPort, 'getCardProjection');
    try {
      const res = await as(viewer, 'get', '/api/v1/posts');
      expect(res.body.data).toHaveLength(3);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toHaveLength(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('returns 403 to Court Owner and Admin, 401 without a session', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const admin = await createTestUser({ role: 'ADMIN' });
    expect((await as(owner.id, 'get', '/api/v1/posts')).status).toBe(403);
    expect((await as(admin.id, 'get', '/api/v1/posts')).status).toBe(403);
  });
});

describe('Shared canView: detail, comments and media', () => {
  let host: number;
  let pending: number;
  let accepted: number;
  let stranger: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    pngBuffer = await png();
    host = await player();
    pending = await player();
    accepted = await player();
    stranger = await player();
  });

  it('unpublished match-finding post: host and PENDING/ACCEPTED members only, everywhere; expired PENDING denied', async () => {
    const mf = await matchFindingPost(host, { matchType: 'DOUBLES' }, false);
    const mediaId = await attachImage(mf.postId, host);
    await invite(host, mf.requestId, pending, 'PENDING');
    await invite(host, mf.requestId, accepted, 'ACCEPTED');
    const expired = await player();
    const expiredRow = await invite(host, mf.requestId, expired, 'PENDING');
    await db.update(matchmakingInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingInvitations.id, expiredRow));
    for (const user of [host, pending, accepted]) {
      expect((await as(user, 'get', `/api/v1/posts/${mf.postId}`)).status, String(user)).toBe(200);
      expect((await as(user, 'get', `/api/v1/posts/${mf.postId}/comments`)).status).toBe(200);
      expect((await as(user, 'get', `/api/v1/media/${mediaId}`)).status).toBe(200);
    }
    for (const user of [stranger, expired]) {
      const detail = await as(user, 'get', `/api/v1/posts/${mf.postId}`);
      expect(detail.status).toBe(404);
      expect(detail.body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
      expect((await as(user, 'get', `/api/v1/posts/${mf.postId}/comments`)).status).toBe(404);
      expect((await as(user, 'get', `/api/v1/media/${mediaId}`)).status).toBe(404);
      expect((await as(user, 'put', `/api/v1/posts/${mf.postId}/reaction`).send({ type: 'LIKE' })).status).toBe(404);
    }
    expect((await as(stranger, 'get', '/api/v1/posts')).body.data).toEqual([]);
    // Pending invitee of an unpublished post: response context only (no roster).
    const detail = await as(pending, 'get', `/api/v1/posts/${mf.postId}`);
    expect(detail.body.data.recruitment).toMatchObject({ access: 'INVITEE', viewerRelation: 'PENDING', filledSlots: 2 });
    expect(detail.body.data.recruitment.members).toBeUndefined();
    const member = await as(accepted, 'get', `/api/v1/posts/${mf.postId}`);
    expect(member.body.data.recruitment).toMatchObject({ access: 'FULL', viewerRelation: 'ACCEPTED', acceptedCount: 1 });
    expect(member.body.data.recruitment.members.map((m: any) => m.playerId)).toEqual([accepted]);
  });

  it('cuts the recruitment projection to the allowlist of each viewer tier and publication state, in sync with GET /matchmaking-requests/:id', async () => {
    const mf = await matchFindingPost(host, { matchType: 'DOUBLES' }, false);
    await invite(host, mf.requestId, pending, 'PENDING');
    await invite(host, mf.requestId, accepted, 'ACCEPTED');
    const keysOf = async (user: number) => Object.keys((await as(user, 'get', `/api/v1/posts/${mf.postId}`)).body.data.recruitment).sort();
    const allow = (tier: keyof typeof RECRUITMENT_PROJECTION_FIELDS) => [...RECRUITMENT_PROJECTION_FIELDS[tier]].sort();
    const mmDetail = async (user: number) => (await as(user, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).body.data;

    // Unpublished: host and accepted member FULL; pending invitee INVITEE; others nothing.
    expect(await keysOf(host)).toEqual(allow('FULL'));
    expect(await keysOf(accepted)).toEqual(allow('FULL'));
    expect(await keysOf(pending)).toEqual(allow('INVITEE'));
    for (const forbidden of ['members', 'acceptedCount', 'externalCourt']) expect(allow('INVITEE')).not.toContain(forbidden);
    const none = (await recruitmentPort.getCardProjection([mf.postId], stranger)).get(mf.postId)!;
    expect(Object.keys(none).sort()).toEqual(allow('NONE'));
    const mmPending = await mmDetail(pending);
    expect(mmPending.access).toBe('INVITEE');
    expect(mmPending.members).toBeUndefined();
    expect((await mmDetail(accepted)).access).toBe('MEMBER');

    // Published: every Player who can see the post gets PUBLIC; members keep FULL.
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${mf.requestId}/publish`)).status).toBe(200);
    expect(await keysOf(stranger)).toEqual(allow('PUBLIC'));
    expect(await keysOf(pending)).toEqual(allow('PUBLIC'));
    expect(await keysOf(accepted)).toEqual(allow('FULL'));
    const mmPublished = await mmDetail(pending);
    expect(mmPublished).toMatchObject({ access: 'PUBLIC', members: [{ playerId: accepted }] });
    expect(mmPublished.invitationId).toBeGreaterThan(0);
    expect((await mmDetail(stranger)).access).toBe('PUBLIC');
  });

  it('masks hidden and deleted posts with the same 404 for everyone', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const hidden = (await freePost(host, 'h')).body.data.id;
    const deleted = (await freePost(host, 'd')).body.data.id;
    await as(admin.id, 'post', `/api/v1/admin/posts/${hidden}/hide`);
    await as(host, 'delete', `/api/v1/posts/${deleted}`);
    for (const id of [hidden, deleted]) {
      for (const user of [host, stranger]) {
        const res = await as(user, 'get', `/api/v1/posts/${id}`);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: 'SOCIAL_POST_NOT_FOUND', message: 'Nội dung không khả dụng', details: [] } });
      }
    }
    const missing = await as(stranger, 'get', '/api/v1/posts/999999999');
    expect(missing.body).toEqual({ error: { code: 'SOCIAL_POST_NOT_FOUND', message: 'Nội dung không khả dụng', details: [] } });
  });
});

describe('Admin hide (SOC-07)', () => {
  let admin: number;
  let host: number;
  let member: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    pngBuffer = await png();
    admin = (await createTestUser({ role: 'ADMIN' })).id;
    host = await player();
    member = await player();
  });

  it('is Admin-only and idempotent; sets hidden_at/hidden_by once; works with Social disabled', async () => {
    const id = (await freePost(host)).body.data.id;
    expect((await as(host, 'post', `/api/v1/admin/posts/${id}/hide`)).status).toBe(403);
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    const first = await as(admin, 'post', `/api/v1/admin/posts/${id}/hide`);
    expect(first.status).toBe(200);
    const second = await as(admin, 'post', `/api/v1/admin/posts/${id}/hide`);
    expect(second.status).toBe(200);
    expect(second.body.data.hiddenAt).toBe(first.body.data.hiddenAt);
    const [row] = await db.select().from(posts).where(eq(posts.id, id));
    expect(row.hiddenBy).toBe(admin);
    expect((await as(admin, 'post', '/api/v1/admin/posts/999999999/hide')).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
  });

  it('hides a match-finding post without changing recruitment or Match; members keep Matchmaking management', async () => {
    const mf = await matchFindingPost(host, { matchType: 'GROUP', capacity: 6, minPlayers: 3 }, true);
    const mediaId = await attachImage(mf.postId, host);
    await invite(host, mf.requestId, member, 'ACCEPTED');
    const [match] = await db.insert(matches).values({ matchType: 'DOUBLES', scheduledAt: new Date(Date.now() + 86_400_000), status: 'CONFIRMED' }).returning();
    const requestBefore = (await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, mf.requestId)))[0];
    expect((await as(admin, 'post', `/api/v1/admin/posts/${mf.postId}/hide`)).status).toBe(200);
    const requestAfter = (await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, mf.requestId)))[0];
    expect(requestAfter).toEqual(requestBefore);
    expect((await db.select().from(matches).where(eq(matches.id, match.id)))[0]).toEqual(match);
    for (const user of [host, member]) {
      expect((await as(user, 'get', `/api/v1/posts/${mf.postId}`)).status).toBe(404);
      expect((await as(user, 'get', `/api/v1/media/${mediaId}`)).status).toBe(404);
    }
    // Recruitment management is not tied to the Social post being visible.
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).status).toBe(200);
    expect((await as(member, 'get', `/api/v1/matchmaking-requests/${mf.requestId}`)).status).toBe(200);
    const edit = await as(host, 'patch', `/api/v1/matchmaking-requests/${mf.requestId}`).send({ costNote: 'Chia đều' });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
  });

  it('hides a comment idempotently; it leaves the list for everyone', async () => {
    const postId = (await freePost(host)).body.data.id;
    const comment = await as(member, 'post', `/api/v1/posts/${postId}/comments`).send({ body: 'spam', clientRequestId: randomUUID() });
    expect((await as(member, 'post', `/api/v1/admin/comments/${comment.body.data.id}/hide`)).status).toBe(403);
    expect((await as(admin, 'post', `/api/v1/admin/comments/${comment.body.data.id}/hide`)).status).toBe(200);
    expect((await as(admin, 'post', `/api/v1/admin/comments/${comment.body.data.id}/hide`)).status).toBe(200);
    expect((await as(host, 'get', `/api/v1/posts/${postId}/comments`)).body.data).toEqual([]);
    expect((await as(host, 'get', `/api/v1/posts/${postId}`)).body.data.commentCount).toBe(0);
    expect((await as(member, 'delete', `/api/v1/comments/${comment.body.data.id}`)).body.error.code).toBe('SOCIAL_COMMENT_NOT_FOUND');
  });
});
