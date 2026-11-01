import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import path from 'path';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { app } from '../app';
import { db, mediaFiles, posts, postImages } from '../db';
import { createTestUser } from './test-helpers';
import { privateMediaService } from '../services/media/PrivateMediaService';
import { socialRepository } from '../repositories/social/SocialRepository';
import { as, freePost, multipartPost, player, png, setConfig } from './social-fixture';

// SOC-03: free post create/edit/delete, quota, idempotency, gate (Social Tech Design
// §7.2, §7.5, §8, §9, §13). Runs against badminton_test only.

const mediaDir = () => path.join(privateMediaService.storage.root, 'media');
const postRow = async (id: number) => (await db.select().from(posts).where(eq(posts.id, id)))[0];
const activeImages = (postId: number) => db.select().from(postImages)
  .where(and(eq(postImages.postId, postId), isNull(postImages.detachedAt))).orderBy(postImages.position);

describe('POST /api/v1/posts (FREE)', () => {
  let author: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player();
  });

  it('creates a published free post with trimmed text and private images', async () => {
    const res = await multipartPost(author, { type: 'FREE', body: '  Chào cả nhà  ', clientRequestId: randomUUID() }, [await png(), await png('#00f')]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ type: 'FREE', body: 'Chào cả nhà', title: null, isEdited: false, isAuthor: true, commentCount: 0 });
    expect(res.body.data.images.map((i: any) => i.position)).toEqual([1, 2]);
    expect(res.body.data.images[0].url).toBe(`/api/v1/media/${res.body.data.images[0].id}`);
    const row = await postRow(res.body.data.id);
    expect(row.publishedAt).not.toBeNull();
    expect(row.creationHash).toMatch(/^[a-f0-9]{64}$/);
    const media = await as(author, 'get', res.body.data.images[0].url);
    expect(media.status).toBe(200);
  });

  it('validates content with the approved codes', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ type: 'FREE', body: '   ', clientRequestId: randomUUID() }, 'SOCIAL_CONTENT_EMPTY'],
      [{ type: 'FREE', body: 'x'.repeat(2001), clientRequestId: randomUUID() }, 'SOCIAL_CONTENT_TOO_LONG'],
      [{ type: 'FREE', body: 'a', title: 'T', clientRequestId: randomUUID() }, 'VALIDATION_FAILED'],
      [{ type: 'FREE', body: 'a', clientRequestId: 'not-a-uuid' }, 'VALIDATION_FAILED'],
      [{ type: 'MATCH_FINDING', body: 'a', clientRequestId: randomUUID(), recruitment: {} }, 'VALIDATION_FAILED'],
    ];
    for (const [body, code] of cases) {
      const res = await as(author, 'post', '/api/v1/posts').send(body);
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body.error.code).toBe(code);
    }
    expect(await db.select().from(posts)).toEqual([]);
    const five = await multipartPost(author, { type: 'FREE', body: 'a', clientRequestId: randomUUID() }, await Promise.all([1, 2, 3, 4, 5].map(() => png())));
    expect(five.status).toBe(400);
    expect(five.body.error.code).toBe('SOCIAL_IMAGE_LIMIT');
    const invalid = await as(author, 'post', '/api/v1/posts')
      .field('payload', JSON.stringify({ type: 'FREE', clientRequestId: randomUUID() }))
      .attach('images', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('SOCIAL_IMAGE_INVALID');
    expect(await db.select().from(mediaFiles)).toEqual([]);
  });

  it('enforces role, session and CSRF', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const admin = await createTestUser({ role: 'ADMIN' });
    for (const user of [owner.id, admin.id]) {
      const res = await freePost(user);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
    }
    expect((await request(app).post('/api/v1/posts').send({ type: 'FREE', body: 'a', clientRequestId: randomUUID() })).status).toBe(401);
    const csrf = await request(app).post('/api/v1/posts').set('Cookie', 'sid=abc').send({ type: 'FREE', body: 'a', clientRequestId: randomUUID() });
    expect(csrf.status).toBe(403);
    expect(csrf.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
  });

  it('replays the same key and content with 200 and the stored post, uncounted; different content → 409', async () => {
    await setConfig('SOCIAL_FREE_POSTS_PER_DAY', '2');
    const key = randomUUID();
    const first = await freePost(author, 'Một', key);
    expect(first.status).toBe(201);
    const replay = await freePost(author, '  Một ', key); // same canonical (trimmed) payload
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect((await freePost(author, 'Hai', key)).body.error.code).toBe('SOCIAL_CLIENT_ID_CONFLICT');
    // The replay was not counted: one more post fits in the quota of 2.
    expect((await freePost(author, 'Ba')).status).toBe(201);
    expect((await db.select().from(posts)).length).toBe(2);
  });

  it('compares the replay with the original hash, not the edited content, and authorizes before replaying', async () => {
    const key = randomUUID();
    const first = await freePost(author, 'Gốc', key);
    const id = first.body.data.id;
    expect((await as(author, 'patch', `/api/v1/posts/${id}`).send({ body: 'Đã sửa' })).status).toBe(200);
    const replay = await freePost(author, 'Gốc', key);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({ id, body: 'Đã sửa', isEdited: true });
    expect((await freePost(author, 'Đã sửa', key)).body.error.code).toBe('SOCIAL_CLIENT_ID_CONFLICT');
    // After deletion the stored post is unavailable: the replay is masked, nothing is recreated.
    expect((await as(author, 'delete', `/api/v1/posts/${id}`)).status).toBe(200);
    const masked = await freePost(author, 'Gốc', key);
    expect(masked.status).toBe(404);
    expect(masked.body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
    expect((await db.select().from(posts)).length).toBe(1);
  });

  it('counts deleted posts in the daily quota and answers 429 with Retry-After until local midnight', async () => {
    await setConfig('SOCIAL_FREE_POSTS_PER_DAY', '10');
    const ids: number[] = [];
    for (let i = 0; i < 10; i += 1) ids.push((await freePost(author, `p${i}`)).body.data.id);
    await as(author, 'delete', `/api/v1/posts/${ids[0]}`);
    const res = await freePost(author, 'p10');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('SOCIAL_RATE_LIMITED');
    const retry = Number(res.headers['retry-after']);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(24 * 3600);
    expect((await db.select().from(posts)).length).toBe(10);
  });

  it('counts the quota by calendar day in Asia/Ho_Chi_Minh', async () => {
    await setConfig('SOCIAL_FREE_POSTS_PER_DAY', '1');
    const id = (await freePost(author, 'hôm qua')).body.data.id;
    // Move it to one second before local midnight: not counted today.
    await db.execute(sql`UPDATE posts SET created_at = (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '1 second' WHERE id = ${id}`);
    expect((await freePost(author, 'hôm nay')).status).toBe(201);
    const [{ id: second }] = await db.select({ id: posts.id }).from(posts).where(eq(posts.body, 'hôm nay'));
    await db.execute(sql`UPDATE posts SET created_at = (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') WHERE id = ${second}`);
    expect((await freePost(author, 'quá hạn')).status).toBe(429);
  });

  it('allows exactly the limit under concurrent creates and one row for concurrent identical retries', async () => {
    await setConfig('SOCIAL_FREE_POSTS_PER_DAY', '3');
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => freePost(author, `c${i}`)));
    expect(results.filter(r => r.status === 201)).toHaveLength(3);
    expect(results.filter(r => r.status === 429)).toHaveLength(3);
    const other = await player();
    const key = randomUUID();
    const retries = await Promise.all(Array.from({ length: 4 }, () => freePost(other, 'same', key)));
    expect(retries.map(r => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(new Set(retries.map(r => r.body.data.id)).size).toBe(1);
  });

  it('rolls back media files and rows when the post insert fails', async () => {
    const before = readdirSync(mediaDir()).length;
    const spy = vi.spyOn(socialRepository, 'insertImages').mockRejectedValueOnce(new Error('insert failed'));
    try {
      const res = await multipartPost(author, { type: 'FREE', body: 'a', clientRequestId: randomUUID() }, [await png()]);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(readdirSync(mediaDir()).length).toBe(before);
    expect(await db.select().from(mediaFiles)).toEqual([]);
    expect(await db.select().from(posts)).toEqual([]);
  });

  it('blocks create and edit when SOCIAL_FEED_ENABLED is false but still allows deletion', async () => {
    const id = (await freePost(author)).body.data.id;
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    expect((await freePost(author)).body.error.code).toBe('SOCIAL_DISABLED');
    const edit = await as(author, 'patch', `/api/v1/posts/${id}`).send({ body: 'x' });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('SOCIAL_DISABLED');
    expect((await as(author, 'delete', `/api/v1/posts/${id}`)).status).toBe(200);
  });
});

describe('PATCH/DELETE /api/v1/posts/:id', () => {
  let author: number;
  let other: number;
  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player();
    other = await player();
  });

  it('keeps published_at, sets edited_at, detaches removed images and reorders by keepImageIds', async () => {
    const created = await multipartPost(author, { type: 'FREE', body: 'a', clientRequestId: randomUUID() }, [await png(), await png('#f00'), await png('#00f')]);
    const id = created.body.data.id;
    const [m1, m2, m3] = created.body.data.images.map((i: any) => i.id);
    const before = await postRow(id);
    const res = await as(author, 'patch', `/api/v1/posts/${id}`)
      .field('payload', JSON.stringify({ body: 'b', keepImageIds: [m3, m1] }))
      .attach('images', await png('#ff0'), { filename: 'n.png', contentType: 'image/png' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await postRow(id);
    expect(after.publishedAt).toEqual(before.publishedAt);
    expect(after.editedAt).not.toBeNull();
    expect(res.body.data).toMatchObject({ body: 'b', isEdited: true });
    const images = await activeImages(id);
    expect(images.map(i => i.mediaId).slice(0, 2)).toEqual([m3, m1]);
    expect(images.map(i => i.position)).toEqual([1, 2, 3]);
    // The removed image is detached (media row kept) and no longer downloadable.
    expect((await db.select().from(mediaFiles).where(eq(mediaFiles.id, m2)))).toHaveLength(1);
    expect((await as(other, 'get', `/api/v1/media/${m2}`)).status).toBe(404);
    expect((await as(other, 'get', `/api/v1/media/${m3}`)).status).toBe(200);
  });

  it('validates edits: image limit, foreign keepImageIds, empty free post, title on free post', async () => {
    const created = await multipartPost(author, { type: 'FREE', body: 'a', clientRequestId: randomUUID() }, [await png()]);
    const id = created.body.data.id;
    const foreign = await multipartPost(other, { type: 'FREE', body: 'x', clientRequestId: randomUUID() }, [await png()]);
    const bad = await as(author, 'patch', `/api/v1/posts/${id}`).send({ keepImageIds: [foreign.body.data.images[0].id] });
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect((await as(author, 'patch', `/api/v1/posts/${id}`).send({ body: ' ', keepImageIds: [] })).body.error.code).toBe('SOCIAL_CONTENT_EMPTY');
    expect((await as(author, 'patch', `/api/v1/posts/${id}`).send({ title: 'T' })).body.error.code).toBe('VALIDATION_FAILED');
    let req = as(author, 'patch', `/api/v1/posts/${id}`).field('payload', JSON.stringify({}));
    for (let i = 0; i < 4; i += 1) req = req.attach('images', await png(), { filename: `${i}.png`, contentType: 'image/png' });
    expect((await req).body.error.code).toBe('SOCIAL_IMAGE_LIMIT');
    expect((await postRow(id)).editedAt).toBeNull();
  });

  it('authorizes edit/delete: other Player 403 on a visible post, 404 when unavailable; hidden → 409 for the author', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const id = (await freePost(author)).body.data.id;
    expect((await as(other, 'patch', `/api/v1/posts/${id}`).send({ body: 'x' })).body.error.code).toBe('SOCIAL_FORBIDDEN');
    expect((await as(other, 'delete', `/api/v1/posts/${id}`)).body.error.code).toBe('SOCIAL_FORBIDDEN');
    expect((await as(admin.id, 'post', `/api/v1/admin/posts/${id}/hide`)).status).toBe(200);
    const hidden = await as(author, 'patch', `/api/v1/posts/${id}`).send({ body: 'x' });
    expect(hidden.status).toBe(409);
    expect(hidden.body.error.code).toBe('SOCIAL_POST_NOT_EDITABLE');
    const otherView = await as(other, 'patch', `/api/v1/posts/${id}`).send({ body: 'x' });
    expect(otherView.status).toBe(404);
    expect(otherView.body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
    expect((await as(other, 'patch', '/api/v1/posts/999999999').send({ body: 'x' })).status).toBe(404);
  });

  it('soft-deletes idempotently; the post leaves feed, detail and media', async () => {
    const created = await multipartPost(author, { type: 'FREE', body: 'a', clientRequestId: randomUUID() }, [await png()]);
    const id = created.body.data.id;
    const first = await as(author, 'delete', `/api/v1/posts/${id}`);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ id, deleted: true });
    expect((await as(author, 'delete', `/api/v1/posts/${id}`)).status).toBe(200);
    expect((await postRow(id)).deletedAt).not.toBeNull();
    expect((await as(other, 'get', `/api/v1/posts/${id}`)).body.error.code).toBe('SOCIAL_POST_NOT_FOUND');
    expect((await as(other, 'get', '/api/v1/posts')).body.data).toEqual([]);
    expect((await as(author, 'get', `/api/v1/media/${created.body.data.images[0].id}`)).status).toBe(404);
    const edit = await as(author, 'patch', `/api/v1/posts/${id}`).send({ body: 'x' });
    expect(edit.body.error.code).toBe('SOCIAL_POST_NOT_EDITABLE');
  });
});
