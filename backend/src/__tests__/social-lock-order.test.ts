import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, mediaFiles, postComments, postImages, posts } from '../db';
import { privateMediaService } from '../services/media/PrivateMediaService';
import { socialRepository } from '../repositories/social/SocialRepository';
import { as, multipartPost, player, png, setConfig } from './social-fixture';

// Step-3 review finding 1: global lock order users(10) → posts(100) → post_comments(105),
// including the implicit KEY SHARE lock an FK check takes on USERS (media_files.owner_id).
// Before the fix, an image edit locked the post FOR UPDATE and then waited for the author's
// USERS row (FK), while the same author's comment held USERS FOR UPDATE and waited for the
// post FOR SHARE → deadlock. Barriers force both interleavings; both requests must finish.

type Gate = { wait: Promise<void>; open: () => void };
function gate(): Gate {
  let open!: () => void;
  const wait = new Promise<void>(resolve => { open = resolve; });
  return { wait, open };
}

/** Resolves once another backend of the test database is waiting on a row/heavyweight lock. */
async function untilSomeoneWaitsOnLock(timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await db.execute(sql`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`);
    if (Number((result.rows[0] as { n: number }).n) > 0) return;
    if (Date.now() > deadline) throw new Error('no backend started waiting on a lock');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

const mediaPath = (key: string) => path.join(privateMediaService.storage.root, 'media', key);

describe('Social lock order: image edit and comment of the same author', () => {
  let author: number;
  let postId: number;
  let originalMediaId: number;

  beforeEach(async () => {
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    author = await player();
    const created = await multipartPost(author, { type: 'FREE', body: 'gốc', clientRequestId: randomUUID() }, [await png()]);
    expect(created.status).toBe(201);
    postId = created.body.data.id;
    originalMediaId = created.body.data.images[0].id;
  });

  const editWithImage = async () => as(author, 'patch', `/api/v1/posts/${postId}`)
    .field('payload', JSON.stringify({ body: 'đã sửa' }))
    .attach('images', await png('#f00'), { filename: 'n.png', contentType: 'image/png' });
  const commentOnPost = () => as(author, 'post', `/api/v1/posts/${postId}/comments`).send({ body: 'bình luận', clientRequestId: randomUUID() });

  async function assertFinalState(editStatus: number, commentStatus: number): Promise<void> {
    expect(editStatus).toBe(200);
    expect(commentStatus).toBe(201);
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    expect(post).toMatchObject({ body: 'đã sửa' });
    expect(post.editedAt).not.toBeNull();
    const images = await db.select().from(postImages).where(and(eq(postImages.postId, postId), isNull(postImages.detachedAt))).orderBy(postImages.position);
    expect(images.map(i => i.position)).toEqual([1, 2]);
    expect(images[0].mediaId).toBe(originalMediaId);
    const media = await db.select().from(mediaFiles).where(inArray(mediaFiles.id, images.map(i => i.mediaId)));
    expect(media).toHaveLength(2);
    for (const row of media) expect(existsSync(mediaPath(row.storageKey)), row.storageKey).toBe(true);
    expect(readdirSync(path.join(privateMediaService.storage.root, 'tmp'))).toEqual([]);
    const comments = await db.select().from(postComments).where(eq(postComments.postId, postId));
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ authorId: author, body: 'bình luận', deletedAt: null });
  }

  it('edit holds the post, then the comment arrives: the comment waits at USERS (rank 10), both complete', async () => {
    const editHoldsPost = gate();
    const releaseEdit = gate();
    const originalLockPost = socialRepository.lockPost.bind(socialRepository);
    const spy = vi.spyOn(socialRepository, 'lockPost').mockImplementation(async (id, mode, tx) => {
      const row = await originalLockPost(id, mode, tx);
      if (mode === 'update') {
        editHoldsPost.open();
        await releaseEdit.wait;
      }
      return row;
    });
    try {
      const edit = editWithImage();
      const editDone = edit.then(res => res);
      await editHoldsPost.wait;
      const commentDone = commentOnPost().then(res => res);
      // Old order: the comment would get USERS and wait for the post, the edit's FK check
      // would then wait for USERS → deadlock. Now the edit already holds USERS KEY SHARE.
      await untilSomeoneWaitsOnLock();
      releaseEdit.open();
      const [editRes, commentRes] = await Promise.all([editDone, commentDone]);
      await assertFinalState(editRes.status, commentRes.status);
    } finally {
      releaseEdit.open();
      spy.mockRestore();
    }
  });

  it('comment holds USERS, then the edit arrives: the edit waits at USERS before the post, both complete', async () => {
    const commentHoldsUser = gate();
    const releaseComment = gate();
    const originalLockUsers = socialRepository.lockUsers.bind(socialRepository);
    const spy = vi.spyOn(socialRepository, 'lockUsers').mockImplementation(async (entries, tx) => {
      await originalLockUsers(entries, tx);
      if (entries.some(entry => entry.mode === 'update')) {
        commentHoldsUser.open();
        await releaseComment.wait;
      }
    });
    try {
      const commentDone = commentOnPost().then(res => res);
      await commentHoldsUser.wait;
      const editDone = editWithImage().then(res => res);
      // The edit must block on the author's USERS row, i.e. before taking the post lock,
      // so the comment can still take the post FOR SHARE.
      await untilSomeoneWaitsOnLock();
      releaseComment.open();
      const [editRes, commentRes] = await Promise.all([editDone, commentDone]);
      await assertFinalState(editRes.status, commentRes.status);
    } finally {
      releaseComment.open();
      spy.mockRestore();
    }
  });
});
