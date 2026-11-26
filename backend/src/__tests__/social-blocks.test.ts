import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { db, matchmakingInvitations } from '../db';
import { as, freePost, matchFindingPost, player, setConfig } from './social-fixture';

// 2026-11-23: blocking hides the pair's posts and match-finding posts from feed/detail/
// interactions, while comments by a blocked Player on a third Player's post stay visible
// and an existing ACCEPTED/PENDING match membership keeps its post readable.

const block = (actor: number, target: number) =>
  as(actor, 'post', '/api/v1/blocks').send({ playerId: target });

const comment = (user: number, postId: number, body: string) =>
  as(user, 'post', `/api/v1/posts/${postId}/comments`).send({ body, clientRequestId: randomUUID() });

describe('Social block visibility', () => {
  let a: number;
  let b: number;
  let c: number;
  let aFree: number;
  let bFree: number;
  let cFree: number;

  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    a = await player('A');
    b = await player('B');
    c = await player('C');
    aFree = (await freePost(a, 'bài của A')).body.data.id;
    bFree = (await freePost(b, 'bài của B')).body.data.id;
    cFree = (await freePost(c, 'bài của C')).body.data.id;
    expect((await block(b, a)).status).toBe(204);
  });

  it('hides the pair’s posts from feed, detail, comments and new interactions', async () => {
    const bFeed = await as(b, 'get', '/api/v1/posts');
    expect(bFeed.status).toBe(200);
    expect(bFeed.body.data.map((p: any) => p.id)).toEqual(expect.arrayContaining([bFree, cFree]));
    expect(bFeed.body.data.map((p: any) => p.id)).not.toContain(aFree);
    expect(bFeed.body.meta.total).toBe(2);

    const aFeed = await as(a, 'get', '/api/v1/posts');
    expect(aFeed.body.data.map((p: any) => p.id)).toEqual(expect.arrayContaining([aFree, cFree]));
    expect(aFeed.body.data.map((p: any) => p.id)).not.toContain(bFree);
    expect(aFeed.body.meta.total).toBe(2);

    for (const [viewer, postId] of [[b, aFree], [a, bFree]]) {
      expect((await as(viewer, 'get', `/api/v1/posts/${postId}`)).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
      expect((await as(viewer, 'get', `/api/v1/posts/${postId}/comments`)).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
      expect((await comment(viewer, postId, 'ẩn')).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
      expect((await as(viewer, 'put', `/api/v1/posts/${postId}/reaction`).send({ type: 'LIKE' })).body.error.code)
        .toBe('SOCIAL_POST_NOT_FOUND');
    }

    // A post by a third Player stays visible to both sides.
    expect((await as(b, 'get', `/api/v1/posts/${cFree}`)).status).toBe(200);
    expect((await as(a, 'get', `/api/v1/posts/${cFree}`)).status).toBe(200);
  });

  it('hides the pair’s match-finding posts from the feed and direct access', async () => {
    const aMatch = await matchFindingPost(a, {}, true);
    const bFeed = await as(b, 'get', '/api/v1/posts?type=MATCH_FINDING');
    expect(bFeed.body.data).toEqual([]);
    expect(bFeed.body.meta.total).toBe(0);
    expect((await as(b, 'get', `/api/v1/posts/${aMatch.postId}`)).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
  });

  it('keeps an ACCEPTED match membership readable but out of the feed', async () => {
    const aMatch = await matchFindingPost(a, {}, true);
    await db.insert(matchmakingInvitations).values({
      requestId: aMatch.requestId,
      createdBy: a,
      playerId: b,
      kind: 'INVITE',
      status: 'ACCEPTED',
      expiresAt: new Date(Date.now() + 3_600_000),
      respondedAt: new Date(),
    });
    // Blocking after acceptance does not close ACCEPTED rows.
    expect((await block(b, a)).status).toBe(204);

    expect((await as(b, 'get', `/api/v1/posts/${aMatch.postId}`)).status).toBe(200);
    const feed = await as(b, 'get', '/api/v1/posts?type=MATCH_FINDING');
    expect(feed.body.data.map((p: any) => p.id)).not.toContain(aMatch.postId);
  });

  it('keeps a blocked Player’s comments on a third Player’s post visible', async () => {
    expect((await comment(a, cFree, 'bình luận của A')).status).toBe(201);
    const list = await as(b, 'get', `/api/v1/posts/${cFree}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((x: any) => x.body)).toContain('bình luận của A');
    expect((await as(b, 'get', `/api/v1/posts/${cFree}`)).body.data.commentCount).toBe(1);
  });
});
