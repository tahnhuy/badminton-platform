import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, notifications, postComments, postReactions, matchmakingRequests } from '../db';
import { createTestUser } from './test-helpers';
import { notificationService } from '../services/notifications/NotificationService';
import { as, freePost, matchFindingPost, player, setConfig } from './social-fixture';

// SOC-06: reactions, flat comments, comment quota/idempotency and SOCIAL_POST_COMMENTED
// (Social Tech Design §7.5, §9, §13, §15). Runs against badminton_test only.

const comment = (user: number, postId: number, body: string, key: string = randomUUID()) =>
  as(user, 'post', `/api/v1/posts/${postId}/comments`).send({ body, clientRequestId: key });

describe('Reactions', () => {
  let author: number;
  let viewer: number;
  let postId: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player();
    viewer = await player();
    postId = (await freePost(author)).body.data.id;
  });

  it('accepts exactly the six types, upserts idempotently, removes idempotently and never notifies', async () => {
    for (const type of ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY']) {
      const res = await as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type });
      expect(res.status).toBe(200);
    }
    const invalid = await as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type: 'CLAP' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('SOCIAL_REACTION_INVALID');
    await as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type: 'LOVE' });
    const rows = await db.select().from(postReactions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('LOVE');
    const card = (await as(viewer, 'get', `/api/v1/posts/${postId}`)).body.data;
    expect(card.reactions).toMatchObject({ total: 1, viewerReaction: 'LOVE' });
    expect(card.reactions.counts.LOVE).toBe(1);
    expect((await as(viewer, 'delete', `/api/v1/posts/${postId}/reaction`)).status).toBe(200);
    expect((await as(viewer, 'delete', `/api/v1/posts/${postId}/reaction`)).status).toBe(200);
    expect(await db.select().from(postReactions)).toEqual([]);
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it('converges to one row under concurrent toggles', async () => {
    await Promise.all(['LIKE', 'HAHA', 'SAD', 'LIKE', 'WOW'].map(type =>
      as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type })));
    expect(await db.select().from(postReactions)).toHaveLength(1);
  });

  it('is blocked when Social is disabled', async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    expect((await as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type: 'LIKE' })).body.error.code).toBe('SOCIAL_DISABLED');
    expect((await as(viewer, 'delete', `/api/v1/posts/${postId}/reaction`)).body.error.code).toBe('SOCIAL_DISABLED');
  });
});

describe('Comments', () => {
  let author: number;
  let viewer: number;
  let postId: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player('Tác giả');
    viewer = await player('Người xem');
    postId = (await freePost(author)).body.data.id;
  });

  it('creates flat comments in time order and one SOCIAL_POST_COMMENTED for the post author', async () => {
    const first = await comment(viewer, postId, '  Hay quá  ');
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data).toMatchObject({ body: 'Hay quá', canDelete: true, author: { id: viewer, displayName: 'Người xem' } });
    await comment(author, postId, 'Cảm ơn'); // self-comment: no notification
    const list = await as(viewer, 'get', `/api/v1/posts/${postId}/comments`);
    expect(list.body.data.map((c: any) => c.body)).toEqual(['Hay quá', 'Cảm ơn']);
    expect(list.body.meta).toMatchObject({ total: 2, page: 1 });
    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: author, type: 'SOCIAL_POST_COMMENTED', resourceType: 'POST', resourceId: postId,
      dedupKey: `post-comment:${first.body.data.id}:${author}`,
    });
    expect((await as(viewer, 'get', `/api/v1/posts/${postId}`)).body.data.commentCount).toBe(2);
  });

  it('validates the body with the approved codes', async () => {
    expect((await comment(viewer, postId, '   ')).body.error.code).toBe('SOCIAL_CONTENT_EMPTY');
    expect((await comment(viewer, postId, 'x'.repeat(501))).body.error.code).toBe('SOCIAL_CONTENT_TOO_LONG');
    expect((await comment(viewer, postId, 'x'.repeat(500))).status).toBe(201);
  });

  it('replays without a second notification or quota use; different content → 409; authorizes first', async () => {
    await setConfig('SOCIAL_COMMENTS_PER_MINUTE', '2');
    const key = randomUUID();
    const first = await comment(viewer, postId, 'Một', key);
    const replays = await Promise.all([comment(viewer, postId, ' Một ', key), comment(viewer, postId, 'Một', key)]);
    expect(replays.map(r => r.status)).toEqual([200, 200]);
    expect(replays.every(r => r.body.data.id === first.body.data.id)).toBe(true);
    expect((await comment(viewer, postId, 'Khác', key)).body.error.code).toBe('SOCIAL_CLIENT_ID_CONFLICT');
    const otherPost = (await freePost(author, 'khác')).body.data.id;
    expect((await comment(viewer, otherPost, 'Một', key)).body.error.code).toBe('SOCIAL_CLIENT_ID_CONFLICT');
    expect(await db.select().from(postComments)).toHaveLength(1);
    expect(await db.select().from(notifications)).toHaveLength(1);
    expect((await comment(viewer, postId, 'Hai')).status).toBe(201); // replays were not counted
    // After the post is hidden, the replay is masked like any other access.
    const admin = await createTestUser({ role: 'ADMIN' });
    await as(admin.id, 'post', `/api/v1/admin/posts/${postId}/hide`);
    expect((await comment(viewer, postId, 'Một', key)).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
  });

  it('rejects the 11th comment within 60 s with Retry-After, counting deleted comments', async () => {
    await setConfig('SOCIAL_COMMENTS_PER_MINUTE', '10');
    const ids: number[] = [];
    for (let i = 0; i < 10; i += 1) ids.push((await comment(viewer, postId, `c${i}`)).body.data.id);
    await as(viewer, 'delete', `/api/v1/comments/${ids[0]}`);
    const res = await comment(viewer, postId, 'c10');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('SOCIAL_RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
    // Window boundary: rows older than 60 s no longer count.
    await db.execute(sql`UPDATE post_comments SET created_at = now() - interval '61 seconds'`);
    expect((await comment(viewer, postId, 'c11')).status).toBe(201);
  });

  it('allows exactly the limit under concurrent comments', async () => {
    await setConfig('SOCIAL_COMMENTS_PER_MINUTE', '3');
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => comment(viewer, postId, `k${i}`)));
    expect(results.filter(r => r.status === 201)).toHaveLength(3);
    expect(results.filter(r => r.status === 429)).toHaveLength(3);
  });

  it('rolls back the comment when the notification insert fails', async () => {
    const spy = vi.spyOn(notificationService, 'notify').mockRejectedValueOnce(new Error('notify failed'));
    try {
      expect((await comment(viewer, postId, 'mất')).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await db.select().from(postComments)).toEqual([]);
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it('lets the comment author or the post author delete; others get 403; deletion is idempotent and allowed with Social off', async () => {
    const third = await player();
    const c1 = (await comment(viewer, postId, 'a')).body.data.id;
    const c2 = (await comment(viewer, postId, 'b')).body.data.id;
    expect((await as(third, 'delete', `/api/v1/comments/${c1}`)).body.error.code).toBe('SOCIAL_FORBIDDEN');
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    expect((await as(viewer, 'delete', `/api/v1/comments/${c1}`)).status).toBe(200);
    expect((await as(viewer, 'delete', `/api/v1/comments/${c1}`)).status).toBe(200);
    expect((await as(author, 'delete', `/api/v1/comments/${c2}`)).status).toBe(200);
    const rows = await db.select().from(postComments).orderBy(postComments.id);
    expect(rows.map(r => r.deletedBy)).toEqual([viewer, author]);
    expect((await as(third, 'delete', `/api/v1/comments/${c1}`)).body.error.code).toBe('SOCIAL_COMMENT_NOT_FOUND');
    expect((await comment(viewer, postId, 'tắt')).body.error.code).toBe('SOCIAL_DISABLED');
    expect((await as(viewer, 'get', `/api/v1/posts/${postId}/comments`)).body.data).toEqual([]);
  });

  it('returns 404 for comments on hidden or deleted posts and accepts them on ended visible posts', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    await as(admin.id, 'post', `/api/v1/admin/posts/${postId}/hide`);
    const hidden = await comment(viewer, postId, 'x');
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
    const deleted = (await freePost(author, 'd')).body.data.id;
    await as(author, 'delete', `/api/v1/posts/${deleted}`);
    expect((await comment(viewer, deleted, 'x')).status).toBe(404);
    const ended = await matchFindingPost(author, { matchType: 'SINGLES' }, true);
    await db.update(matchmakingRequests).set({ status: 'EXPIRED' }).where(eq(matchmakingRequests.id, ended.requestId));
    expect((await comment(viewer, ended.postId, 'Kèo hôm qua vui')).status).toBe(201);
    expect((await as(viewer, 'put', `/api/v1/posts/${ended.postId}/reaction`).send({ type: 'LIKE' })).status).toBe(200);
  });
});
