import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import {
  db, posts, postImages, mediaFiles, matchmakingRequests, matchmakingInvitations, matches, notifications,
} from '../db';
import { as, multipartPost, player, png, setConfig, skillIds, startIn } from './social-fixture';
import { socialRepository } from '../repositories/social/SocialRepository';

// SOC-04: canonical POST /posts MATCH_FINDING (post, images and recruitment in one transaction)
// and author deletion through RecruitmentPort.cancelForAuthorDeletion (Social Tech Design §7.2,
// §8, §12, §13; Matchmaking Tech Design §24.4, §24.7.3, §24.10). badminton_test only.

const mediaDir = () => join(process.env.PRIVATE_UPLOADS_DIR!, 'media');
const requestByPost = async (postId: number) => (await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.postId, postId)))[0];
const postRow = async (id: number) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

async function recruitment(overrides: Record<string, unknown> = {}) {
  const levels = await skillIds();
  return { matchType: 'GROUP', startAt: startIn(48), capacity: 4, minPlayers: 2, minSkillLevelId: levels.min, maxSkillLevelId: levels.max, ...overrides };
}

function create(author: number, body: Record<string, unknown>) {
  return as(author, 'post', '/api/v1/posts').send({ type: 'MATCH_FINDING', clientRequestId: randomUUID(), ...body });
}

describe('SOC-04 canonical MATCH_FINDING creation', () => {
  let author: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    author = await player();
  });

  it('creates post, ordered images and recruitment together; unpublished unless publish is requested', async () => {
    const res = await multipartPost(author, {
      type: 'MATCH_FINDING', title: '  Giao lưu tối thứ 7 ', body: 'Cần thêm 2 người', clientRequestId: randomUUID(),
      recruitment: await recruitment({ costNote: '50k' }),
    }, [await png('#111'), await png('#222')]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const post = await postRow(res.body.data.id);
    expect(post).toMatchObject({ type: 'MATCH_FINDING', title: 'Giao lưu tối thứ 7', publishedAt: null });
    expect(post.creationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await requestByPost(post.id)).toMatchObject({ playerId: author, matchType: 'GROUP', status: 'OPEN', costNote: '50k' });
    expect((await db.select().from(postImages).where(eq(postImages.postId, post.id))).map(i => i.position)).toEqual([1, 2]);
    expect(res.body.data.recruitment).toMatchObject({ access: 'FULL', viewerRelation: 'HOST', capacity: 4 });

    const published = await create(author, { recruitment: await recruitment({ startAt: startIn(60) }), publish: true });
    expect(published.status).toBe(201);
    expect((await postRow(published.body.data.id)).publishedAt).not.toBeNull();
  });

  it('rolls back post, recruitment and media when recruitment validation fails', async () => {
    const before = readdirSync(mediaDir()).length;
    const res = await multipartPost(author, {
      type: 'MATCH_FINDING', clientRequestId: randomUUID(), recruitment: await recruitment({ capacity: 2 }),
    }, [await png()]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATCHMAKING_INVALID_CAPACITY');
    const limit = await multipartPost(author, {
      type: 'MATCH_FINDING', clientRequestId: randomUUID(), recruitment: await recruitment({ court: { kind: 'BOOKING', bookingId: 1 } }),
    }, [await png()]);
    expect(limit.status).toBe(409);
    expect(limit.body.error.code).toBe('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE');
    // Failure inside the transaction after the post and media rows were written.
    const spy = vi.spyOn(socialRepository, 'insertImages').mockRejectedValueOnce(new Error('insert failed'));
    try {
      const late = await multipartPost(author, { type: 'MATCH_FINDING', clientRequestId: randomUUID(), recruitment: await recruitment() }, [await png()]);
      expect(late.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await db.select().from(posts)).toEqual([]);
    expect(await db.select().from(matchmakingRequests)).toEqual([]);
    expect(await db.select().from(mediaFiles)).toEqual([]);
    expect(readdirSync(mediaDir()).length).toBe(before);
  });

  it('replays identical retries (also after edit) and rejects a different canonical payload', async () => {
    const key = randomUUID();
    const draft = await recruitment();
    const first = await create(author, { clientRequestId: key, body: 'A', recruitment: draft });
    expect(first.status).toBe(201);
    // Same content in another field order and with untrimmed text normalizes to the same hash.
    const same = await create(author, { clientRequestId: key, body: '  A ', recruitment: { ...draft, minPlayers: 2, companionCount: 0 } });
    expect(same.status).toBe(200);
    expect(same.body.data.id).toBe(first.body.data.id);
    for (const changed of [{ publish: true }, { title: 'T' }, { recruitment: { ...draft, capacity: 5 } }]) {
      const res = await create(author, { clientRequestId: key, body: 'A', recruitment: draft, ...changed });
      expect(res.status, JSON.stringify(changed)).toBe(409);
      expect(res.body.error.code).toBe('SOCIAL_CLIENT_ID_CONFLICT');
    }
    const edited = await as(author, 'patch', `/api/v1/posts/${first.body.data.id}`).send({ body: 'B' });
    expect(edited.status).toBe(200);
    const afterEdit = await create(author, { clientRequestId: key, body: 'A', recruitment: draft });
    expect(afterEdit.status).toBe(200);
    expect(afterEdit.body.data.body).toBe('B');
    expect(await db.select().from(matchmakingRequests)).toHaveLength(1);
    // Authorization before replay: a deleted post is not returned.
    await as(author, 'delete', `/api/v1/posts/${first.body.data.id}`);
    expect((await create(author, { clientRequestId: key, body: 'A', recruitment: draft })).status).toBe(404);
  });

  it('concurrent identical retries create one post; concurrent distinct creates stop at the open-post limit', async () => {
    const key = randomUUID();
    const draft = await recruitment();
    const retries = await Promise.all(Array.from({ length: 4 }, () => create(author, { clientRequestId: key, recruitment: draft })));
    expect(retries.map(r => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(new Set(retries.map(r => r.body.data.id)).size).toBe(1);
    const other = await player();
    const distinct = await Promise.all([30, 40, 50, 60, 70].map(async h => create(other, { recruitment: await recruitment({ startAt: startIn(h) }) })));
    expect(distinct.filter(r => r.status === 201)).toHaveLength(3);
    expect(distinct.filter(r => r.body.error?.code === 'MATCHMAKING_OPEN_POST_LIMIT')).toHaveLength(2);
    expect(await db.select().from(posts).where(eq(posts.authorId, other))).toHaveLength(3);
    // A replay at the limit is resolved before the limit check.
    const replayAtLimit = await create(author, { clientRequestId: key, recruitment: draft });
    expect(replayAtLimit.status).toBe(200);
  });

  it('applies the §24.10 gates without writing rows', async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    expect((await create(author, { recruitment: await recruitment() })).body.error.code).toBe('SOCIAL_DISABLED');
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    await setConfig('MATCHMAKING_ENABLED', 'false');
    expect((await create(author, { recruitment: await recruitment() })).body.error.code).toBe('MATCHMAKING_DISABLED');
    expect(await db.select().from(posts)).toEqual([]);
    expect((await create(author, {})).body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('SOC-04 author deletion through cancellation', () => {
  let author: number;
  let member: number;
  let pending: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    author = await player();
    member = await player();
    pending = await player();
  });

  async function activePost(capacity = 3) {
    const res = await create(author, { recruitment: await recruitment({ capacity }), publish: true });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const requestId = res.body.data.recruitment.requestId as number;
    const inviteRes = await as(author, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: member });
    expect((await as(member, 'put', `/api/v1/matchmaking-invitations/${inviteRes.body.data.id}`).send({ decision: 'ACCEPTED' })).status).toBe(200);
    const pendingRes = await as(author, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: pending });
    return { postId: res.body.data.id as number, requestId, pendingRow: pendingRes.body.data.id as number };
  }

  it('KEEP cancels the recruitment (AUTHOR_DELETED), notifies members and pending Players, then hides the post', async () => {
    const { postId, requestId, pendingRow } = await activePost();
    const res = await as(author, 'delete', `/api/v1/posts/${postId}?bookingAction=KEEP`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toEqual({ id: postId, deleted: true });
    expect(await requestByPost(postId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'AUTHOR_DELETED' });
    expect((await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, pendingRow)))[0])
      .toMatchObject({ status: 'CANCELLED', closeReason: 'POST_CANCELLED' });
    expect((await postRow(postId)).deletedAt).not.toBeNull();
    for (const recipient of [member, pending]) {
      const notes = (await db.select().from(notifications).where(eq(notifications.userId, recipient))).filter(n => n.type === 'MM_POST_CANCELLED');
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({ resourceType: 'MATCHMAKING_REQUEST', resourceId: requestId });
    }
    expect((await as(member, 'get', `/api/v1/posts/${postId}`)).status).toBe(404);
    expect((await as(author, 'delete', `/api/v1/posts/${postId}`)).status).toBe(200); // idempotent
    expect((await db.select().from(notifications)).filter(n => n.type === 'MM_POST_CANCELLED')).toHaveLength(2);
  });

  it('cancels a formed Match too; CANCEL is unavailable and changes nothing', async () => {
    const { postId, requestId } = await activePost(3); // host + member + one more fills it
    const third = await player();
    const row = await as(author, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: third });
    const formed = await as(third, 'put', `/api/v1/matchmaking-invitations/${row.body.data.id}`).send({ decision: 'ACCEPTED' });
    const matchId = formed.body.data.matchId as number;
    expect(matchId).toBeGreaterThan(0);
    const before = { notes: await db.select().from(notifications), request: await requestByPost(postId) };
    const rejected = await as(author, 'delete', `/api/v1/posts/${postId}?bookingAction=CANCEL`);
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE');
    expect(await requestByPost(postId)).toEqual(before.request);
    expect((await postRow(postId)).deletedAt).toBeNull();
    expect(await db.select().from(notifications)).toEqual(before.notes);
    expect((await as(author, 'delete', `/api/v1/posts/${postId}`)).status).toBe(200);
    expect((await db.select().from(matches).where(eq(matches.id, matchId)))[0].status).toBe('CANCELLED');
  });

  it('terminal post deletion only hides the post; a failure after cancellation rolls back everything', async () => {
    const { postId, requestId } = await activePost();
    await db.update(matchmakingRequests).set({ status: 'EXPIRED' }).where(eq(matchmakingRequests.id, requestId));
    const terminal = await as(author, 'delete', `/api/v1/posts/${postId}?bookingAction=CANCEL`);
    expect(terminal.status).toBe(200);
    expect(await requestByPost(postId)).toMatchObject({ status: 'EXPIRED', cancellationReason: null });

    const second = await activePost();
    const notesBefore = await db.select().from(notifications);
    const spy = vi.spyOn(socialRepository, 'softDeletePost').mockRejectedValueOnce(new Error('delete failed'));
    try {
      expect((await as(author, 'delete', `/api/v1/posts/${second.postId}`)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await requestByPost(second.postId)).toMatchObject({ status: 'OPEN', cancellationReason: null });
    expect(await db.select().from(notifications)).toEqual(notesBefore);
    expect((await postRow(second.postId)).deletedAt).toBeNull();
  });

  it('non-authors cannot delete; deletion still works with Social disabled', async () => {
    const { postId } = await activePost();
    const res = await as(member, 'delete', `/api/v1/posts/${postId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SOCIAL_FORBIDDEN');
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    expect((await as(author, 'delete', `/api/v1/posts/${postId}`)).status).toBe(200);
    expect(await requestByPost(postId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'AUTHOR_DELETED' });
  });

  it('deletion racing with an acceptance and a withdrawal keeps the users → requests → posts order (no deadlock)', async () => {
    for (let i = 0; i < 5; i += 1) {
      const host = await player();
      const joiner = await player();
      const leaver = await player();
      const res = await create(host, { recruitment: await recruitment({ capacity: 5, startAt: startIn(30 + i) }), publish: true });
      const requestId = res.body.data.recruitment.requestId as number;
      const inviteLeaver = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: leaver });
      await as(leaver, 'put', `/api/v1/matchmaking-invitations/${inviteLeaver.body.data.id}`).send({ decision: 'ACCEPTED' });
      const inviteJoiner = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: joiner });
      const results = await Promise.all([
        as(host, 'delete', `/api/v1/posts/${res.body.data.id}`),
        as(joiner, 'put', `/api/v1/matchmaking-invitations/${inviteJoiner.body.data.id}`).send({ decision: 'ACCEPTED' }),
        as(leaver, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`),
        as(host, 'post', `/api/v1/posts/${res.body.data.id}/comments`).send({ body: 'hi', clientRequestId: randomUUID() }),
      ]);
      expect(results[0].status, JSON.stringify(results.map(r => r.body))).toBe(200);
      expect(results.every(r => r.status !== 500)).toBe(true);
      expect(await requestByPost(res.body.data.id)).toMatchObject({ status: 'CANCELLED' });
    }

  });
});
