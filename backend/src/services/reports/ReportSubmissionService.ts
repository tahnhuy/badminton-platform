import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { reportRepository, ReportRecord } from '../../repositories/reports/ReportRepository';
import { reportConfig } from '../../shared/config/report-config';
import { socialRepository } from '../../repositories/social/SocialRepository';
import { postVisibility, type SocialViewer } from '../social/post-visibility';
import { messagingRepository } from '../../repositories/messaging/MessagingRepository';
import { messagingService } from '../messaging/MessagingService';
import { notifyAdmins } from '../notifications/admin-notifications';
import type { TransactionContext } from '../../contracts/TransactionContext';

// RP-06 (Report Management Tech Design §16). Access is re-checked against the owning
// module at report time, and the original text/media references are captured in the
// same transaction. Evidence access is limited to Report Management; it never grants
// access to hidden/deleted content.

export type ReportCreationTarget = 'POST' | 'COMMENT' | 'MESSAGE';

export interface CreateReportInput {
  targetType: ReportCreationTarget;
  targetId: number;
  attachmentId?: number;
  reasonCode: string;
  description?: string;
}

export interface ReportSubmissionView {
  id: string;
  targetType: ReportCreationTarget;
  targetId: string;
  attachmentId?: string;
  reasonCode: string;
  description: string | null;
  status: string;
  createdAt: string;
}

const REASON_CODES = new Set([
  'SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SCAM', 'PRIVACY_VIOLATION', 'OTHER',
]);

function targetNotFound(): NotFoundError {
  return new NotFoundError('Report target not found', 'REPORT_TARGET_NOT_FOUND');
}

function selfReport(): AppError {
  return new AppError('REPORT_SELF_FORBIDDEN', 409, 'You cannot report your own content');
}

function attachmentMismatch(): AppError {
  return new AppError('REPORT_ATTACHMENT_MISMATCH', 400, 'Attachment does not belong to the reported message');
}

function invalidReason(): AppError {
  return new AppError('REPORT_INVALID_REASON', 400, 'Unknown report reason');
}

function descriptionRequired(): AppError {
  return new AppError('REPORT_DESCRIPTION_REQUIRED', 400, 'A description is required when the reason is OTHER');
}

function toSubmissionView(row: ReportRecord, targetType: ReportCreationTarget): ReportSubmissionView {
  return {
    id: String(row.id),
    targetType,
    targetId: String(
      targetType === 'POST' ? row.reportedPostId
        : targetType === 'COMMENT' ? row.reportedCommentId
          : row.reportedMessageId,
    ),
    ...(row.reportedAttachmentId !== null ? { attachmentId: String(row.reportedAttachmentId) } : {}),
    reasonCode: row.reasonCode,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function postText(row: { title: string | null; body: string | null }): string | null {
  const parts = [row.title?.trim(), row.body?.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join('\n\n') : null;
}

export class ReportSubmissionService {
  async create(viewer: SocialViewer, input: CreateReportInput): Promise<{ data: ReportSubmissionView }> {
    if (viewer.role !== 'PLAYER') throw new ForbiddenError('Access denied for the current user role');

    const config = await reportConfig.get();
    if (!config.enabled) {
      throw new AppError('REPORT_DISABLED', 409, 'Reporting is temporarily unavailable');
    }

    if (input.attachmentId !== undefined && input.targetType !== 'MESSAGE') throw attachmentMismatch();

    const reasonCode = input.reasonCode.trim().toUpperCase();
    if (!REASON_CODES.has(reasonCode)) throw invalidReason();
    const description = input.description?.trim() ? input.description.trim() : null;
    if (reasonCode === 'OTHER' && !description) throw descriptionRequired();

    const created = await db.transaction(async tx => {
      const target = await this.resolveTarget(viewer, input, tx);
      const row = await reportRepository.insertReport(tx, {
        reporterId: viewer.id,
        reasonCode,
        description,
        target: { type: input.targetType, id: input.targetId },
        attachmentId: target.attachmentId ?? null,
      });
      await reportRepository.insertEvidence(tx, row.id, target.contentText);
      await reportRepository.insertEvidenceMedia(tx, row.id, target.mediaIds);
      await notifyAdmins(tx, {
        type: 'ADMIN_REPORT_CREATED',
        title: 'Báo cáo mới cần xử lý',
        content: `Báo cáo #${row.id} (${input.targetType}) với lý do ${reasonCode} đang chờ Admin xem xét.`,
        resource: { type: 'ADMIN_REPORT', id: row.id },
        dedupKey: `admin-report:${row.id}`,
      });

      const windowMs = config.highRiskWindowHours * 60 * 60 * 1000;
      const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
      const distinctReporters = await reportRepository.countDistinctReportersForTarget(
        tx, input.targetType, input.targetId, windowStart,
      );
      if (distinctReporters >= config.highRiskThreshold) {
        await notifyAdmins(tx, {
          type: 'ADMIN_HIGH_RISK_REPORT',
          title: 'Báo cáo rủi ro cao',
          content: `${input.targetType} #${input.targetId} có ${distinctReporters} người report trong ${config.highRiskWindowHours} giờ.`,
          resource: { type: 'ADMIN_REPORT', id: row.id },
          dedupKey: `admin-report-risk:${input.targetType}:${input.targetId}:${windowStart.getTime()}`,
        });
      }
      return row;
    });

    return { data: toSubmissionView(created, input.targetType) };
  }

  private async resolveTarget(
    viewer: SocialViewer,
    input: CreateReportInput,
    tx: TransactionContext,
  ): Promise<{ contentText: string | null; mediaIds: number[]; attachmentId?: number }> {
    if (input.targetType === 'POST') {
      const post = await socialRepository.findPost(input.targetId, tx);
      if (!post) throw targetNotFound();
      const visible = await postVisibility.filterVisible([post], viewer, tx);
      if (!visible.has(post.id)) throw targetNotFound();
      if (post.authorId === viewer.id) throw selfReport();
      const images = await socialRepository.findActiveImages([post.id], tx);
      return { contentText: postText(post), mediaIds: images.map((image: { mediaId: number }) => image.mediaId) };
    }

    if (input.targetType === 'COMMENT') {
      const comment = await socialRepository.findComment(input.targetId, tx);
      if (!comment || comment.deletedAt || comment.hiddenAt) throw targetNotFound();
      const post = await socialRepository.findPost(comment.postId, tx);
      if (!post) throw targetNotFound();
      const visible = await postVisibility.filterVisible([post], viewer, tx);
      if (!visible.has(post.id)) throw targetNotFound();
      if (comment.authorId === viewer.id) throw selfReport();
      return { contentText: comment.body, mediaIds: [] };
    }

    const message = await messagingRepository.findMessageById(input.targetId, tx);
    if (!message || message.deletedAt) throw targetNotFound();
    if (message.senderId === viewer.id) throw selfReport();
    // No read access maps to the same 404 as a missing target (never reveal it exists).
    try {
      await messagingService.getConversationAccess(viewer.id, message.conversationId, tx);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) throw targetNotFound();
      throw error;
    }
    if (await messagingRepository.isMessageHiddenForUser(message.id, viewer.id, tx)) throw targetNotFound();

    const attachments = await messagingRepository.findMessageAttachments(message.id, tx);
    if (input.attachmentId !== undefined) {
      const selected = attachments.find(attachment => attachment.id === input.attachmentId);
      if (!selected) throw attachmentMismatch();
      return { contentText: message.body, mediaIds: [selected.mediaId], attachmentId: selected.id };
    }
    return { contentText: message.body, mediaIds: attachments.map(attachment => attachment.mediaId) };
  }
}

export const reportSubmissionService = new ReportSubmissionService();
