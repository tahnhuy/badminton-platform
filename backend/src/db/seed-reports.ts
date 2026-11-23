import 'dotenv/config';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { and, desc, eq } from 'drizzle-orm';
import {
  db, pool, users, posts, postComments, postImages,
  conversations, conversationMembers, messages, messageAttachments, reports, systemConfigs,
} from './index';
import { ensureSeedPlayerProfile, type SeedLevelCode } from './seeds/skill-survey-seed';
import { hashPassword } from '../utils/password';
import { socialPostService } from '../services/social/SocialPostService';
import { socialInteractionService } from '../services/social/SocialInteractionService';
import { reportSubmissionService } from '../services/reports/ReportSubmissionService';
import { reportConfig } from '../shared/config/report-config';
import { privateMediaService } from '../services/media/PrivateMediaService';

// Local demo fixtures for the Report Management flow (RP-06/RP-07). Re-running is
// idempotent: users, post/comment/message and reports are reused by stable keys.

function stableUuid(key: string): string {
  const hex = createHash('sha256').update(`report-demo:v1:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function demoImage(): Promise<{ buffer: Buffer; mimetype: string }> {
  return {
    buffer: await sharp({ create: { width: 16, height: 16, channels: 3, background: '#0a7a2f' } }).png().toBuffer(),
    mimetype: 'image/png',
  };
}

async function ensurePlayer(email: string, fullName: string, levelCode: SeedLevelCode, passwordHash: string): Promise<number> {
  await db.insert(users).values({ email, passwordHash, role: 'PLAYER', status: 'ACTIVE' })
    .onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.role !== 'PLAYER' || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new Error(`Demo account unavailable: ${email}`);
  }
  await ensureSeedPlayerProfile(db, { userId: user.id, fullName, levelCode });
  return user.id;
}

async function ensureAdmin(email: string, passwordHash: string): Promise<number> {
  await db.insert(users).values({ email, passwordHash, role: 'ADMIN', status: 'ACTIVE' })
    .onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new Error(`Demo admin unavailable: ${email}`);
  }
  return user.id;
}

async function ensurePost(authorId: number, body: string) {
  const clientRequestId = stableUuid('post');
  const [existing] = await db.select().from(posts)
    .where(and(eq(posts.authorId, authorId), eq(posts.clientRequestId, clientRequestId)));
  if (existing) return existing;

  const created = await socialPostService.create(
    { id: authorId, role: 'PLAYER' },
    { type: 'FREE', body, clientRequestId },
    [await demoImage()],
  );
  const [row] = await db.select().from(posts).where(eq(posts.id, created.post.id));
  return row;
}

async function ensureComment(postId: number, authorId: number, body: string) {
  const clientRequestId = stableUuid('comment');
  const [existing] = await db.select().from(postComments)
    .where(and(eq(postComments.authorId, authorId), eq(postComments.clientRequestId, clientRequestId)));
  if (existing) return existing;
  const result = await socialInteractionService.createComment(
    { id: authorId, role: 'PLAYER' }, postId, body, clientRequestId,
  );
  const [row] = await db.select().from(postComments).where(eq(postComments.id, result.comment.id));
  return row;
}

async function ensureConversation(reporterId: number, authorId: number) {
  const low = Math.min(reporterId, authorId);
  const high = Math.max(reporterId, authorId);
  let [conversation] = await db.select().from(conversations)
    .where(and(eq(conversations.type, 'DIRECT'), eq(conversations.directUserLowId, low), eq(conversations.directUserHighId, high)));
  if (!conversation) {
    [conversation] = await db.insert(conversations).values({
      type: 'DIRECT', directUserLowId: low, directUserHighId: high,
    }).returning();
  }
  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId: reporterId, state: 'ACTIVE' },
    { conversationId: conversation.id, userId: authorId, state: 'ACTIVE' },
  ]).onConflictDoNothing();
  return conversation;
}

async function ensureMessage(conversationId: number, senderId: number, body: string) {
  const clientMessageId = stableUuid('message');
  const [existing] = await db.select().from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, senderId), eq(messages.clientMessageId, clientMessageId)));
  if (existing) return existing;

  const [last] = await db.select({ seq: messages.seq }).from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.seq)).limit(1);
  const [row] = await db.insert(messages).values({
    conversationId,
    seq: (last?.seq ?? 0) + 1,
    senderId,
    body,
    clientMessageId,
    contentHash: createHash('sha256').update(body).digest('hex'),
  }).returning();
  return row;
}

async function ensureMessageAttachment(messageId: number, ownerId: number) {
  const [existing] = await db.select().from(messageAttachments)
    .where(eq(messageAttachments.messageId, messageId)).limit(1);
  if (existing) return existing;

  const image = await demoImage();
  const [stored] = await privateMediaService.transaction(tx => privateMediaService.storeImages(
    [image], ownerId, tx, { invalidImageCode: 'REPORT_IMAGE_INVALID' },
  ));
  const [row] = await db.insert(messageAttachments).values({
    messageId, mediaId: stored.id, position: 1,
  }).returning();
  return row;
}

async function ensurePostImage(postId: number, authorId: number): Promise<void> {
  const [existing] = await db.select().from(postImages).where(eq(postImages.postId, postId)).limit(1);
  if (existing) return;
  const image = await demoImage();
  const [stored] = await privateMediaService.transaction(tx => privateMediaService.storeImages(
    [image], authorId, tx, { invalidImageCode: 'REPORT_IMAGE_INVALID' },
  ));
  await db.insert(postImages).values({ postId, mediaId: stored.id, position: 1 });
}

async function ensureReport(input: {
  reporterId: number;
  targetType: 'POST' | 'COMMENT' | 'MESSAGE';
  targetId: number;
  attachmentId?: number;
  reasonCode: string;
  description: string | null;
}): Promise<number> {
  const targetColumn = {
    POST: reports.reportedPostId,
    COMMENT: reports.reportedCommentId,
    MESSAGE: reports.reportedMessageId,
  } as const;
  const [existing] = await db.select({ id: reports.id }).from(reports)
    .where(and(
      eq(reports.reporterId, input.reporterId),
      eq(targetColumn[input.targetType], input.targetId),
    )).limit(1);
  if (existing) return existing.id;

  const created = await reportSubmissionService.create(
    { id: input.reporterId, role: 'PLAYER' },
    {
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.attachmentId !== undefined ? { attachmentId: input.attachmentId } : {}),
      reasonCode: input.reasonCode,
      ...(input.description ? { description: input.description } : {}),
    },
  );
  return Number(created.data.id);
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Report demo is for local development only');
  const connection = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) {
    throw new Error('Report demo requires a local PostgreSQL database');
  }

  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(64102821)');

    const password = 'Password@123';
    const passwordHash = await hashPassword(password);
    const adminId = await ensureAdmin('report.admin@example.com', passwordHash);
    const reporterId = await ensurePlayer('report.reporter@example.com', 'Report Reporter', 'AVERAGE', passwordHash);
    const authorId = await ensurePlayer('report.author@example.com', 'Report Author', 'AVERAGE', passwordHash);
    const outsiderId = await ensurePlayer('report.outsider@example.com', 'Report Outsider', 'AVERAGE', passwordHash);

    const cfg = await reportConfig.get();
    if (!cfg.enabled) {
      await db.insert(systemConfigs).values({ configKey: 'REPORT_ENABLED', configValue: 'true' })
        .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'true' } });
      reportConfig.clearCache();
    }

    const post = await ensurePost(authorId, 'Bài viết demo để kiểm duyệt báo cáo. Nội dung gốc sẽ được giữ trong evidence.');
    await ensurePostImage(post.id, authorId);
    const comment = await ensureComment(post.id, authorId, 'Bình luận demo có nội dung cần kiểm duyệt.');
    const conversation = await ensureConversation(reporterId, authorId);
    const message = await ensureMessage(conversation.id, authorId, 'Tin nhắn demo có tệp đính kèm để kiểm duyệt.');
    const attachment = await ensureMessageAttachment(message.id, authorId);

    const postReportId = await ensureReport({
      reporterId, targetType: 'POST', targetId: post.id, reasonCode: 'SPAM', description: null,
    });
    const commentReportId = await ensureReport({
      reporterId, targetType: 'COMMENT', targetId: comment.id, reasonCode: 'HARASSMENT', description: null,
    });
    const messageReportId = await ensureReport({
      reporterId, targetType: 'MESSAGE', targetId: message.id, attachmentId: attachment.id,
      reasonCode: 'OTHER', description: 'Tin nhắn kèm tệp demo cần Admin xem evidence.',
    });

    console.log(JSON.stringify({
      password,
      accounts: {
        admin: 'report.admin@example.com',
        reporter: 'report.reporter@example.com',
        author: 'report.author@example.com',
        outsider: 'report.outsider@example.com',
      },
      targets: {
        postId: post.id,
        commentId: comment.id,
        conversationId: conversation.id,
        messageId: message.id,
        attachmentId: attachment.id,
      },
      reports: {
        post: postReportId,
        comment: commentReportId,
        message: messageReportId,
      },
      adminApi: {
        list: 'GET /api/v1/admin/reports?targetType=POST',
        detail: `GET /api/v1/admin/reports/${postReportId}`,
        evidenceMedia: `GET /api/v1/admin/reports/${messageReportId}/evidence/media/{mediaId}`,
        resolve: `PATCH /api/v1/admin/reports/${postReportId}/status  { "status": "RESOLVED" }`,
      },
      playerApi: {
        reportPost: `POST /api/v1/reports  { "targetType": "POST", "targetId": ${post.id}, "reasonCode": "SPAM" }`,
        outsiderMessageReport: `POST /api/v1/reports  { "targetType": "MESSAGE", "targetId": ${message.id}, "reasonCode": "SPAM" }`,
      },
      ids: { adminId, reporterId, authorId, outsiderId },
    }, null, 2));
  } finally {
    await lock.query('SELECT pg_advisory_unlock(64102821)');
    lock.release();
  }
}

seed().catch(error => {
  console.error(error instanceof Error ? error.message : 'Report demo seed failed');
  process.exitCode = 1;
}).finally(() => pool.end());
