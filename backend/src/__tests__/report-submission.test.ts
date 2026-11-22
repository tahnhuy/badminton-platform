import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import {
  db, posts, postComments, postImages, mediaFiles, conversations, conversationMembers,
  messages, messageAttachments, systemConfigs,
} from '../db';
import { reportConfig } from '../shared/config/report-config';
import { authRepository } from '../repositories/auth/AuthRepository';
import { createTestUser } from './test-helpers';

// RP-06 (Report Management Tech Design §16): access checks, reason codes, evidence.

const hash = 'a'.repeat(64);

async function createPost(authorId: number, body = 'original body') {
  const [row] = await db.insert(posts).values({
    authorId, type: 'FREE', body, publishedAt: new Date(), creationHash: hash,
  }).returning();
  return row;
}

async function createComment(postId: number, authorId: number, body = 'comment body') {
  const [row] = await db.insert(postComments).values({
    postId, authorId, body, creationHash: hash,
  }).returning();
  return row;
}

async function createMedia(ownerId: number, kind: 'IMAGE' | 'FILE' = 'IMAGE') {
  const [row] = await db.insert(mediaFiles).values({
    ownerId,
    kind,
    mimeType: kind === 'IMAGE' ? 'image/png' : 'application/pdf',
    byteSize: 3,
    sha256: createHash('sha256').update('img').digest('hex'),
    storageKey: randomUUID(),
    originalName: kind === 'FILE' ? 'evidence.pdf' : null,
  }).returning();
  return row;
}

async function createConversation(creatorId: number, memberIds: number[], title = 'Kèo test') {
  const [conversation] = await db.insert(conversations).values({
    type: 'GROUP', title, createdBy: creatorId,
  }).returning();
  await db.insert(conversationMembers).values(
    [...new Set([creatorId, ...memberIds])].map(userId => ({ conversationId: conversation.id, userId })),
  );
  return conversation;
}

async function createMessage(conversationId: number, senderId: number, body = 'message body', seq = 1) {
  const [row] = await db.insert(messages).values({
    conversationId,
    seq,
    senderId,
    body,
    clientMessageId: randomUUID(),
    contentHash: hash,
  }).returning();
  return row;
}

async function attach(messageId: number, mediaId: number, position = 1) {
  const [row] = await db.insert(messageAttachments).values({ messageId, mediaId, position }).returning();
  return row;
}

function submit(userId: number, body: Record<string, unknown>) {
  return request(app).post('/api/v1/reports').set('x-user-id', String(userId)).send(body);
}

describe('Player report creation API (RP-06)', () => {
  let reporter: number;
  let author: number;
  let outsider: number;

  beforeEach(async () => {
    reporter = (await createTestUser({ role: 'PLAYER' })).id;
    author = (await createTestUser({ role: 'PLAYER' })).id;
    outsider = (await createTestUser({ role: 'PLAYER' })).id;
    await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'REPORT_ENABLED'));
    reportConfig.clearCache();
  });

  afterEach(() => {
    reportConfig.clearCache();
  });

  it('creates a POST report and captures the original text plus active images', async () => {
    const post = await createPost(author, 'original post text');
    const active = await createMedia(author);
    const detached = await createMedia(author);
    await db.insert(postImages).values([
      { postId: post.id, mediaId: active.id, position: 1 },
      { postId: post.id, mediaId: detached.id, position: 2, detachedAt: new Date() },
    ]);

    const res = await submit(reporter, {
      targetType: 'POST', targetId: post.id, reasonCode: 'SPAM',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      targetType: 'POST', targetId: String(post.id), reasonCode: 'SPAM', status: 'OPEN',
    });

    await db.update(posts).set({ body: 'edited later' }).where(eq(posts.id, post.id));
    const admin = await request(app)
      .get(`/api/v1/admin/reports/${res.body.data.id}`)
      .set('x-user-id', String((await createTestUser({ role: 'ADMIN' })).id));
    expect(admin.status).toBe(200);
    expect(admin.body.data.evidence.text).toBe('original post text');
    expect(admin.body.data.evidence.media.map((media: { mediaId: string }) => media.mediaId))
      .toEqual([String(active.id)]);
  });

  it('creates a COMMENT report only while the comment and its post are visible', async () => {
    const post = await createPost(author);
    const comment = await createComment(post.id, author, 'original comment');
    const res = await submit(reporter, {
      targetType: 'COMMENT', targetId: comment.id, reasonCode: 'HARASSMENT',
    });
    expect(res.status).toBe(201);

    await db.update(postComments).set({ deletedAt: new Date() }).where(eq(postComments.id, comment.id));
    expect((await submit(reporter, {
      targetType: 'COMMENT', targetId: comment.id, reasonCode: 'SPAM',
    })).status).toBe(404);

    const selfComment = await createComment(post.id, reporter, 'mine');
    expect((await submit(reporter, {
      targetType: 'COMMENT', targetId: selfComment.id, reasonCode: 'SPAM',
    })).status).toBe(409);
  });

  it('creates a MESSAGE report only for members, and validates the selected attachment', async () => {
    const conversation = await createConversation(author, [reporter]);
    const message = await createMessage(conversation.id, author, 'reported message');
    const ownMedia = await createMedia(author);
    const otherMedia = await createMedia(author);
    const selected = await attach(message.id, ownMedia.id, 1);
    await attach(message.id, otherMedia.id, 2);

    const res = await submit(reporter, {
      targetType: 'MESSAGE', targetId: message.id, attachmentId: selected.id, reasonCode: 'SCAM',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ targetType: 'MESSAGE', attachmentId: String(selected.id) });

    const outsiderAttempt = await submit(outsider, {
      targetType: 'MESSAGE', targetId: message.id, reasonCode: 'SPAM',
    });
    expect(outsiderAttempt.status).toBe(404);
    expect(outsiderAttempt.body.error.code).toBe('REPORT_TARGET_NOT_FOUND');

    const otherMessage = await createMessage(conversation.id, author, 'second', 2);
    const otherAttachment = await attach(otherMessage.id, otherMedia.id, 1);
    expect((await submit(reporter, {
      targetType: 'MESSAGE', targetId: message.id, attachmentId: otherAttachment.id, reasonCode: 'SPAM',
    })).status).toBe(400);
  });

  it('enforces the REPORT_ENABLED gate, reason codes and OTHER description', async () => {
    const post = await createPost(author);
    const body = { targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' };
    expect((await submit(reporter, { ...body, attachmentId: 1 })).body.error.code)
      .toBe('REPORT_ATTACHMENT_MISMATCH');

    expect((await submit(reporter, { ...body, reasonCode: 'NOT_A_REASON' })).body.error.code)
      .toBe('REPORT_INVALID_REASON');
    expect((await submit(reporter, { ...body, reasonCode: 'OTHER', description: '   ' })).body.error.code)
      .toBe('REPORT_DESCRIPTION_REQUIRED');
    expect((await submit(reporter, { ...body, reasonCode: 'OTHER', description: 'context' })).status).toBe(201);

    await db.insert(systemConfigs).values({ configKey: 'REPORT_ENABLED', configValue: 'false' });
    reportConfig.clearCache();
    const disabled = await submit(reporter, body);
    expect(disabled.status).toBe(409);
    expect(disabled.body.error.code).toBe('REPORT_DISABLED');
  });

  it('rejects hidden/deleted posts, self-reports and non-Player callers', async () => {
    const post = await createPost(author);
    await db.update(posts).set({ hiddenAt: new Date(), hiddenBy: author }).where(eq(posts.id, post.id));
    expect((await submit(reporter, { targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' })).status).toBe(404);

    const ownPost = await createPost(reporter);
    const self = await submit(reporter, { targetType: 'POST', targetId: ownPost.id, reasonCode: 'SPAM' });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('REPORT_SELF_FORBIDDEN');

    const admin = (await createTestUser({ role: 'ADMIN' })).id;
    expect((await submit(admin, { targetType: 'POST', targetId: ownPost.id, reasonCode: 'SPAM' })).status).toBe(403);
  });

  it('requires the CSRF token for a session-authenticated report', async () => {
    const post = await createPost(author);
    const session = await authRepository.createSession(reporter, 'PLAYER');
    const cookie = `sid=${session.rawToken}; csrf_token=csrf-rp`;
    const missing = await request(app).post('/api/v1/reports').set('Cookie', cookie)
      .send({ targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    const ok = await request(app).post('/api/v1/reports').set('Cookie', cookie)
      .set('X-CSRF-Token', 'csrf-rp')
      .send({ targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' });
    expect(ok.status).toBe(201);
  });

  it('validates the request shape and requires authentication', async () => {
    expect((await request(app).post('/api/v1/reports').send({})).status).toBe(401);
    for (const body of [
      {},
      { targetType: 'PLAYER', targetId: 1, reasonCode: 'SPAM' },
      { targetType: 'POST', targetId: 0, reasonCode: 'SPAM' },
      { targetType: 'POST', targetId: 1, reasonCode: 'SPAM', extra: true },
    ]) {
      const res = await submit(reporter, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});
