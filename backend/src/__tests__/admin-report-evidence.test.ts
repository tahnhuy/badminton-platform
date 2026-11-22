import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import {
  db, posts, postImages, postComments, mediaFiles, conversations, conversationMembers,
  messages, messageAttachments, systemConfigs,
} from '../db';
import { reportConfig } from '../shared/config/report-config';
import { privateMediaService } from '../services/media/PrivateMediaService';
import { privateMediaStorage } from '../shared/storage/private-media-storage';
import { createTestUser } from './test-helpers';

// RP-07 (Report Management Tech Design §16): Admin evidence is report-scoped,
// immutable and never a path into hidden content or the conversation.

const hash = 'a'.repeat(64);

async function createPost(authorId: number, body: string) {
  const [row] = await db.insert(posts).values({
    authorId, type: 'FREE', body, publishedAt: new Date(), creationHash: hash,
  }).returning();
  return row;
}

async function createMedia(ownerId: number, withFile = false) {
  const storageKey = withFile
    ? await privateMediaService.storage.write(Buffer.from('evidence-bytes'))
    : randomUUID();
  const [row] = await db.insert(mediaFiles).values({
    ownerId,
    kind: 'IMAGE',
    mimeType: 'image/png',
    byteSize: withFile ? 14 : 3,
    sha256: createHash('sha256').update('img').digest('hex'),
    storageKey,
    originalName: null,
  }).returning();
  return row;
}

async function submit(userId: number, body: Record<string, unknown>) {
  return request(app).post('/api/v1/reports').set('x-user-id', String(userId)).send(body);
}

describe('Admin report evidence (RP-07)', () => {
  let admin: number;
  let reporter: number;
  let author: number;

  beforeEach(async () => {
    admin = (await createTestUser({ role: 'ADMIN' })).id;
    reporter = (await createTestUser({ role: 'PLAYER' })).id;
    author = (await createTestUser({ role: 'PLAYER' })).id;
    await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'REPORT_ENABLED'));
    reportConfig.clearCache();
  });

  it('returns captured evidence in detail and serves only this report media', async () => {
    const post = await createPost(author, 'original evidence text');
    const evidenceMedia = await createMedia(author, true);
    await db.insert(postImages).values({ postId: post.id, mediaId: evidenceMedia.id, position: 1 });

    const created = await submit(reporter, { targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' });
    expect(created.status).toBe(201);
    const reportId = created.body.data.id;

    // Author edits and Admin hides the post; the evidence snapshot must not change.
    await db.update(posts).set({ body: 'changed', hiddenAt: new Date(), hiddenBy: admin }).where(eq(posts.id, post.id));

    const detail = await request(app).get(`/api/v1/admin/reports/${reportId}`).set('x-user-id', String(admin));
    expect(detail.status).toBe(200);
    expect(detail.body.data.evidence.text).toBe('original evidence text');
    expect(detail.body.data.target).toMatchObject({
      type: 'POST',
      available: true,
      post: { id: String(post.id), body: 'changed', author: { id: String(author) }, hiddenBy: String(admin) },
    });
    expect(detail.body.data.target.post.hiddenAt).not.toBeNull();
    expect(detail.body.data.evidence.media).toHaveLength(1);
    expect(detail.body.data.evidence.media[0]).toMatchObject({
      mediaId: String(evidenceMedia.id), kind: 'IMAGE', mimeType: 'image/png',
      url: `/api/v1/admin/reports/${reportId}/evidence/media/${evidenceMedia.id}`,
    });

    const download = await request(app)
      .get(`/api/v1/admin/reports/${reportId}/evidence/media/${evidenceMedia.id}`)
      .set('x-user-id', String(admin));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['content-disposition']).toBe('inline');

    const outsiderMedia = await createMedia(author, true);
    const outside = await request(app)
      .get(`/api/v1/admin/reports/${reportId}/evidence/media/${outsiderMedia.id}`)
      .set('x-user-id', String(admin));
    expect(outside.status).toBe(404);
    expect(outside.body.error.code).toBe('MEDIA_NOT_FOUND');

    const player = await request(app)
      .get(`/api/v1/admin/reports/${reportId}/evidence/media/${evidenceMedia.id}`)
      .set('x-user-id', String(reporter));
    expect(player.status).toBe(403);
  });

  it('captures only the selected message attachment and never the conversation', async () => {
    const [conversation] = await db.insert(conversations).values({
      type: 'GROUP', title: 'Kèo evidence', createdBy: author,
    }).returning();
    await db.insert(conversationMembers).values([
      { conversationId: conversation.id, userId: author },
      { conversationId: conversation.id, userId: reporter },
    ]);
    const [message] = await db.insert(messages).values({
      conversationId: conversation.id, seq: 1, senderId: author, body: 'reported text',
      clientMessageId: randomUUID(), contentHash: hash,
    }).returning();
    const attachmentKey = await privateMediaStorage.writeAtomic(Buffer.from('attachment-bytes'), 'png');
    const [selectedMedia] = await db.insert(mediaFiles).values({
      ownerId: author,
      kind: 'IMAGE',
      mimeType: 'image/png',
      byteSize: 16,
      sha256: createHash('sha256').update('attachment-bytes').digest('hex'),
      storageKey: attachmentKey,
      originalName: null,
    }).returning();
    const otherMedia = await createMedia(author);
    const [selected] = await db.insert(messageAttachments).values([
      { messageId: message.id, mediaId: selectedMedia.id, position: 1 },
      { messageId: message.id, mediaId: otherMedia.id, position: 2 },
    ]).returning();

    const created = await submit(reporter, {
      targetType: 'MESSAGE', targetId: message.id, attachmentId: selected.id, reasonCode: 'SCAM',
    });
    expect(created.status).toBe(201);

    // A message edited after the report must keep showing the captured snapshot,
    // not the current row content.
    await db.update(messages).set({ body: 'edited after report' }).where(eq(messages.id, message.id));

    const detail = await request(app)
      .get(`/api/v1/admin/reports/${created.body.data.id}`)
      .set('x-user-id', String(admin));
    expect(detail.status).toBe(200);
    expect(detail.body.data.targetType).toBe('MESSAGE');
    expect(detail.body.data.reportedAttachmentId).toBe(String(selected.id));
    expect(detail.body.data.evidence.text).toBe('reported text');
    expect(detail.body.data.evidence.media.map((media: { mediaId: string }) => media.mediaId))
      .toEqual([String(selectedMedia.id)]);
    expect(detail.body.data.evidence).not.toHaveProperty('conversationId');
    expect(detail.body.data.target).toMatchObject({
      type: 'MESSAGE',
      available: true,
      message: { id: String(message.id), body: 'reported text', sender: { id: String(author) } },
    });
    expect(detail.body.data.target.message).not.toHaveProperty('conversationId');

    // Message attachments use the Messaging storage-key format; Admin evidence must
    // still read them through the same authorized report route.
    const download = await request(app)
      .get(`/api/v1/admin/reports/${created.body.data.id}/evidence/media/${selectedMedia.id}`)
      .set('x-user-id', String(admin));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('image/png');
  });

  it('returns the reported comment and its parent post as target detail', async () => {
    const post = await createPost(author, 'parent post');
    const [comment] = await db.insert(postComments).values({
      postId: post.id, authorId: author, body: 'reported comment', creationHash: hash,
    }).returning();
    const created = await submit(reporter, { targetType: 'COMMENT', targetId: comment.id, reasonCode: 'HARASSMENT' });
    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/api/v1/admin/reports/${created.body.data.id}`)
      .set('x-user-id', String(admin));
    expect(detail.status).toBe(200);
    expect(detail.body.data.evidence.text).toBe('reported comment');
    expect(detail.body.data.target).toMatchObject({
      type: 'COMMENT',
      available: true,
      comment: { id: String(comment.id), body: 'reported comment', author: { id: String(author) } },
      post: { id: String(post.id), bodyExcerpt: 'parent post', author: { id: String(author) } },
    });
  });

  it('does not expose evidence for reports that have none', async () => {
    const post = await createPost(author, 'no media');
    const created = await submit(reporter, { targetType: 'POST', targetId: post.id, reasonCode: 'SPAM' });
    const detail = await request(app)
      .get(`/api/v1/admin/reports/${created.body.data.id}`)
      .set('x-user-id', String(admin));
    expect(detail.body.data.evidence).toEqual({ text: 'no media', media: [] });
  });
});
