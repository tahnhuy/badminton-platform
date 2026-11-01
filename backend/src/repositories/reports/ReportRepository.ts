import { and, count, desc, eq, isNotNull, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { reports } from '../../db/schema/reports';
import type { TransactionContext } from '../../contracts/TransactionContext';

export type ReportTargetType = 'PLAYER' | 'FACILITY' | 'TOURNAMENT';

export interface ReportListFilter {
  targetType?: ReportTargetType;
  status?: 'OPEN' | 'RESOLVED';
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
  reasonCode: string;
  description: string | null;
  status: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const targetColumn = {
  PLAYER: reports.reportedPlayerId,
  FACILITY: reports.reportedFacilityId,
  TOURNAMENT: reports.reportedTournamentId,
} as const;

function listConditions(filter: ReportListFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (filter.targetType) conditions.push(isNotNull(targetColumn[filter.targetType]));
  if (filter.status) conditions.push(eq(reports.status, filter.status));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const reportRepository = {
  async list(filter: ReportListFilter): Promise<{ rows: ReportRecord[]; total: number }> {
    const where = listConditions(filter);
    const rows = await db
      .select(reportColumns)
      .from(reports)
      .where(where)
      .orderBy(desc(reports.createdAt), desc(reports.id))
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
};
