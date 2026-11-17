import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import {
  reportRepository, ReportRecord, ReportListFilter, ReportTargetType,
} from '../../repositories/reports/ReportRepository';
import { privateMediaService } from '../../services/media/PrivateMediaService';

// Report Management Tech Design §2–§7, §16 (RP-01/RP-02/RP-07). Admin review and
// the single OPEN → RESOLVED transition; evidence is read-only and report-scoped.

export interface ReportActor {
  id: number;
  role: string;
}

export interface AdminEvidenceMediaView {
  mediaId: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  originalName: string | null;
  url: string;
}

export interface AdminEvidenceView {
  text: string | null;
  media: AdminEvidenceMediaView[];
}

/** Response allowlist (Tech Design §2.1): camelCase ids as strings, one target column only. */
export interface AdminReportView {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  reportedPlayerId?: string;
  reportedFacilityId?: string;
  reportedTournamentId?: string;
  reportedPostId?: string;
  reportedCommentId?: string;
  reportedMessageId?: string;
  reportedAttachmentId?: string;
  reasonCode: string;
  description: string | null;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only in the detail response (RP-07). */
  evidence?: AdminEvidenceView;
}

function targetOf(row: ReportRecord): { type: ReportTargetType; field: string; id: number } {
  const targets = [
    { type: 'PLAYER' as const, field: 'reportedPlayerId', id: row.reportedPlayerId },
    { type: 'FACILITY' as const, field: 'reportedFacilityId', id: row.reportedFacilityId },
    { type: 'TOURNAMENT' as const, field: 'reportedTournamentId', id: row.reportedTournamentId },
    { type: 'POST' as const, field: 'reportedPostId', id: row.reportedPostId },
    { type: 'COMMENT' as const, field: 'reportedCommentId', id: row.reportedCommentId },
    { type: 'MESSAGE' as const, field: 'reportedMessageId', id: row.reportedMessageId },
  ].filter((target): target is { type: ReportTargetType; field: string; id: number } => target.id !== null);
  // chk_report_target guarantees exactly one; anything else is an integrity failure.
  if (targets.length !== 1) throw new Error(`Report ${row.id} violates the single-target invariant`);
  return targets[0];
}

export function toAdminReportView(row: ReportRecord): AdminReportView {
  const target = targetOf(row);
  return {
    id: String(row.id),
    reporterId: String(row.reporterId),
    targetType: target.type,
    [target.field]: String(target.id),
    ...(row.reportedAttachmentId !== null
      ? { reportedAttachmentId: String(row.reportedAttachmentId) }
      : {}),
    reasonCode: row.reasonCode,
    description: row.description,
    status: row.status,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertAdmin(actor: ReportActor | undefined): ReportActor {
  if (!actor || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Access denied for the current user role');
  }
  return actor;
}

function reportNotFound(): NotFoundError {
  return new NotFoundError('Report not found', 'ADMIN_REPORT_NOT_FOUND');
}

function mediaNotFound(): NotFoundError {
  return new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');
}

export class AdminReportService {
  async listReports(actor: ReportActor | undefined, filter: ReportListFilter) {
    assertAdmin(actor);
    const { rows, total } = await reportRepository.list(filter);
    return {
      data: rows.map(toAdminReportView),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }

  async getReport(actor: ReportActor | undefined, id: number) {
    assertAdmin(actor);
    const row = await reportRepository.findById(id);
    if (!row) throw reportNotFound();
    const evidence = await reportRepository.findEvidence(id);
    return {
      data: {
        ...toAdminReportView(row),
        evidence: {
          text: evidence?.contentText ?? null,
          media: (evidence?.media ?? []).map(media => ({
            mediaId: String(media.mediaId),
            kind: media.kind,
            mimeType: media.mimeType,
            byteSize: media.byteSize,
            originalName: media.originalName,
            url: `/api/v1/admin/reports/${id}/evidence/media/${media.mediaId}`,
          })),
        } satisfies AdminEvidenceView,
      },
    };
  }

  /** RP-07: Admin only; the media must belong to this report's captured evidence. */
  async getEvidenceMedia(actor: ReportActor | undefined, reportId: number, mediaId: number) {
    const admin = assertAdmin(actor);
    const belongs = await reportRepository.findEvidenceMedia(reportId, mediaId);
    if (!belongs) throw mediaNotFound();
    const file = await privateMediaService.openForDownload(mediaId, { id: admin.id, role: admin.role });
    if (!file) throw mediaNotFound();
    return file;
  }

  async updateStatus(actor: ReportActor | undefined, id: number, status: string) {
    assertAdmin(actor);
    if (status !== 'RESOLVED') {
      throw new AppError('ADMIN_REPORT_INVALID_STATUS', 400, 'Only RESOLVED is a supported target status');
    }
    const updated = await db.transaction(async tx => {
      const current = await reportRepository.findByIdForUpdate(tx, id);
      if (!current) throw reportNotFound();
      if (current.status !== 'OPEN') {
        throw new AppError('ADMIN_REPORT_INVALID_TRANSITION', 400, 'Only an OPEN report can be resolved');
      }
      const row = await reportRepository.markResolvedIfOpen(tx, id);
      if (!row) throw new AppError('ADMIN_REPORT_INVALID_TRANSITION', 400, 'Only an OPEN report can be resolved');
      return row;
    });
    return { data: toAdminReportView(updated) };
  }
}

export const adminReportService = new AdminReportService();
