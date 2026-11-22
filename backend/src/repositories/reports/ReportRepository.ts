import { and, asc, count, desc, eq, gte, isNotNull, lte, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { reports, reportEvidence, reportEvidenceMedia } from '../../db/schema/reports';
import { mediaFiles } from '../../db/schema/media';
import type { TransactionContext } from '../../contracts/TransactionContext';

export type ReportTargetType = 'PLAYER' | 'FACILITY' | 'TOURNAMENT' | 'POST' | 'COMMENT' | 'MESSAGE';
export type ReportStatus = 'OPEN' | 'RESOLVED';

export interface ReportListFilter {
  sort?: 'newest' | 'oldest';
  targetType?: ReportTargetType;
  status?: ReportStatus;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

// Explicit column allowlist; rows are never selected with `*`.
const reportColumns = {
  id: reports.id,
  reporterId: reports.reporterId,
  reportedPlayerId: reports.reportedPlayerId,
  reportedFacilityId: reports.reportedFacilityId,
  reportedTournamentId: reports.reportedTournamentId,
  reportedPostId: reports.reportedPostId,
  reportedCommentId: reports.reportedCommentId,
  reportedMessageId: reports.reportedMessageId,
  reportedAttachmentId: reports.reportedAttachmentId,
  reasonCode: reports.reasonCode,
  description: reports.description,
  status: reports.status,
  resolvedAt: reports.resolvedAt,
  createdAt: reports.createdAt,
  updatedAt: reports.updatedAt,
};

export type ReportRecord = {
  id: number;
  reporterId: number;
  reportedPlayerId: number | null;
  reportedFacilityId: number | null;
  reportedTournamentId: number | null;
  reportedPostId: number | null;
  reportedCommentId: number | null;
  reportedMessageId: number | null;
  reportedAttachmentId: number | null;
  reasonCode: string;
  description: string | null;
  status: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface NewReport {
  reporterId: number;
  reasonCode: string;
  description: string | null;
  target: { type: ReportTargetType; id: number };
  attachmentId?: number | null;
}

export interface ReportEvidenceRecord {
  contentText: string | null;
  capturedAt: Date;
  media: Array<{
    mediaId: number;
    kind: string;
    mimeType: string;
    byteSize: number;
    originalName: string | null;
  }>;
}

const targetColumn = {
  PLAYER: reports.reportedPlayerId,
  FACILITY: reports.reportedFacilityId,
  TOURNAMENT: reports.reportedTournamentId,
  POST: reports.reportedPostId,
  COMMENT: reports.reportedCommentId,
  MESSAGE: reports.reportedMessageId,
} as const;

const targetValueField = {
  PLAYER: 'reportedPlayerId',
  FACILITY: 'reportedFacilityId',
  TOURNAMENT: 'reportedTournamentId',
  POST: 'reportedPostId',
  COMMENT: 'reportedCommentId',
  MESSAGE: 'reportedMessageId',
} as const;

function startOfDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00+07:00`) : undefined;
}

function endOfDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T23:59:59.999+07:00`) : undefined;
}

function listConditions(filter: ReportListFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (filter.targetType) conditions.push(isNotNull(targetColumn[filter.targetType]));
  if (filter.status) conditions.push(eq(reports.status, filter.status));
  const from = startOfDate(filter.startDate);
  const to = endOfDate(filter.endDate);
  if (from) conditions.push(gte(reports.createdAt, from));
  if (to) conditions.push(lte(reports.createdAt, to));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const reportRepository = {
  async list(filter: ReportListFilter): Promise<{ rows: ReportRecord[]; total: number }> {
    const where = listConditions(filter);
    const rows = await db
      .select(reportColumns)
      .from(reports)
      .where(where)
      .orderBy(...(filter.sort === 'oldest' ? [asc(reports.createdAt), asc(reports.id)] : [desc(reports.createdAt), desc(reports.id)]))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
    const [{ total }] = await db.select({ total: count() }).from(reports).where(where);
    return { rows, total: Number(total) };
  },

  async findById(id: number): Promise<ReportRecord | null> {
    const [row] = await db.select(reportColumns).from(reports).where(eq(reports.id, id)).limit(1);
    return row ?? null;
  },

  async findByIdForUpdate(tx: TransactionContext, id: number): Promise<ReportRecord | null> {
    const [row] = await tx.select(reportColumns).from(reports).where(eq(reports.id, id)).for('update').limit(1);
    return row ?? null;
  },

  /** State-transition guard: only an OPEN row is changed. */
  async markResolvedIfOpen(tx: TransactionContext, id: number): Promise<ReportRecord | null> {
    const [row] = await tx
      .update(reports)
      .set({ status: 'RESOLVED', resolvedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(reports.id, id), eq(reports.status, 'OPEN')))
      .returning(reportColumns);
    return row ?? null;
  },

  /** New Player report; the target value is set on exactly one of the six columns. */
  async insertReport(tx: TransactionContext, input: NewReport): Promise<ReportRecord> {
    const [row] = await tx.insert(reports).values({
      reporterId: input.reporterId,
      reasonCode: input.reasonCode,
      description: input.description,
      status: 'OPEN',
      [targetValueField[input.target.type]]: input.target.id,
      ...(input.attachmentId !== null && input.attachmentId !== undefined
        ? { reportedAttachmentId: input.attachmentId }
        : {}),
    }).returning(reportColumns);
    return row;
  },

  async insertEvidence(tx: TransactionContext, reportId: number, contentText: string | null): Promise<void> {
    await tx.insert(reportEvidence).values({ reportId, contentText });
  },

  async insertEvidenceMedia(tx: TransactionContext, reportId: number, mediaIds: readonly number[]): Promise<void> {
    const unique = [...new Set(mediaIds)];
    if (unique.length === 0) return;
    await tx.insert(reportEvidenceMedia).values(unique.map(mediaId => ({ reportId, mediaId })));
  },

  /** Admin detail evidence (RP-07), including the media metadata captured at report time. */
  async countDistinctReportersForTarget(
    tx: TransactionContext,
    targetType: keyof typeof targetColumn,
    targetId: number,
    since: Date,
  ): Promise<number> {
    const column = targetColumn[targetType];
    const [row] = await tx
      .select({ total: sql<number>`count(distinct ${reports.reporterId})` })
      .from(reports)
      .where(and(eq(column, targetId), gte(reports.createdAt, since)));
    return Number(row?.total ?? 0);
  },

  async findEvidence(reportId: number): Promise<ReportEvidenceRecord | null> {
    const [evidence] = await db
      .select({ contentText: reportEvidence.contentText, capturedAt: reportEvidence.capturedAt })
      .from(reportEvidence)
      .where(eq(reportEvidence.reportId, reportId))
      .limit(1);
    if (!evidence) return null;
    const media = await db
      .select({
        mediaId: reportEvidenceMedia.mediaId,
        kind: mediaFiles.kind,
        mimeType: mediaFiles.mimeType,
        byteSize: mediaFiles.byteSize,
        originalName: mediaFiles.originalName,
      })
      .from(reportEvidenceMedia)
      .innerJoin(mediaFiles, eq(mediaFiles.id, reportEvidenceMedia.mediaId))
      .where(eq(reportEvidenceMedia.reportId, reportId))
      .orderBy(asc(reportEvidenceMedia.mediaId));
    return { ...evidence, media };
  },

  /** Evidence media must belong to this report (RP-07); anything else is not found. */
  async findEvidenceMedia(reportId: number, mediaId: number): Promise<boolean> {
    const [row] = await db
      .select({ mediaId: reportEvidenceMedia.mediaId })
      .from(reportEvidenceMedia)
      .where(and(eq(reportEvidenceMedia.reportId, reportId), eq(reportEvidenceMedia.mediaId, mediaId)))
      .limit(1);
    return Boolean(row);
  },

  /** True when the media was captured as evidence by at least one report. */
  async hasEvidenceForMedia(mediaId: number): Promise<boolean> {
    const [row] = await db
      .select({ mediaId: reportEvidenceMedia.mediaId })
      .from(reportEvidenceMedia)
      .where(eq(reportEvidenceMedia.mediaId, mediaId))
      .limit(1);
    return Boolean(row);
  },
};
