import { pgTable, bigint, varchar, timestamp, text, check, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { facilities } from './facilities';
import { tournaments } from './tournaments';
import { posts, postComments } from './social';
import { messages, messageAttachments } from './messaging';
import { mediaFiles } from './media';

// database-schema.md §3.25 and §13.8: exactly one target among the six allowed
// columns; the attachment may only accompany a reported message.
export const reports = pgTable('reports', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  reporterId: bigint('reporter_id', { mode: 'number' }).notNull().references(() => users.id),
  reportedPlayerId: bigint('reported_player_id', { mode: 'number' }).references(() => users.id),
  reportedFacilityId: bigint('reported_facility_id', { mode: 'number' }).references(() => facilities.id),
  reportedTournamentId: bigint('reported_tournament_id', { mode: 'number' }).references(() => tournaments.id),
  reportedPostId: bigint('reported_post_id', { mode: 'number' }).references(() => posts.id),
  reportedCommentId: bigint('reported_comment_id', { mode: 'number' }).references(() => postComments.id),
  reportedMessageId: bigint('reported_message_id', { mode: 'number' }).references(() => messages.id),
  reportedAttachmentId: bigint('reported_attachment_id', { mode: 'number' }).references(() => messageAttachments.id),
  reasonCode: varchar('reason_code').notNull(),
  description: text('description'),
  status: varchar('status').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  checkReportTarget: check(
    'chk_report_target',
    sql`(
      (CASE WHEN ${t.reportedPlayerId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedFacilityId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedTournamentId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedPostId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedCommentId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedMessageId} IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1`
  ),
  checkAttachmentRequiresMessage: check(
    'chk_report_attachment_requires_message',
    sql`${t.reportedAttachmentId} IS NULL OR ${t.reportedMessageId} IS NOT NULL`
  ),
  checkNotSelfReport: check(
    'chk_not_self_report',
    sql`${t.reporterId} != ${t.reportedPlayerId} OR ${t.reportedPlayerId} IS NULL`
  ),
}));

export const reportEvidence = pgTable('report_evidence', {
  reportId: bigint('report_id', { mode: 'number' }).primaryKey().references(() => reports.id),
  contentText: text('content_text'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reportEvidenceMedia = pgTable('report_evidence_media', {
  reportId: bigint('report_id', { mode: 'number' }).notNull().references(() => reports.id),
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaFiles.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.reportId, t.mediaId] }),
}));
