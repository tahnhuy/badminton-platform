import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import {
  reportRepository, ReportRecord, ReportListFilter, ReportTargetType,
} from '../../repositories/reports/ReportRepository';

// Report Management Tech Design §2–§7 (RP-01/RP-02). Admin review and the single
// OPEN → RESOLVED transition only; no moderation side effects.

export interface ReportActor {
  id: number;
  role: string;
}

/** Response allowlist (Tech Design §2.1): ids as strings, one target column only. */
export interface AdminReportView {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  reported_player_id?: string;
  reported_facility_id?: string;
  reported_tournament_id?: string;
  reason_code: string;
  description: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function targetOf(row: ReportRecord): { type: ReportTargetType; field: string; id: number } {
  const targets = [
    { type: 'PLAYER' as const, field: 'reported_player_id', id: row.reportedPlayerId },
    { type: 'FACILITY' as const, field: 'reported_facility_id', id: row.reportedFacilityId },
    { type: 'TOURNAMENT' as const, field: 'reported_tournament_id', id: row.reportedTournamentId },
  ].filter((target): target is { type: ReportTargetType; field: string; id: number } => target.id !== null);
  // chk_report_target guarantees exactly one; anything else is an integrity failure.
  if (targets.length !== 1) throw new Error(`Report ${row.id} violates the single-target invariant`);
  return targets[0];
}

export function toAdminReportView(row: ReportRecord): AdminReportView {
  const target = targetOf(row);
  return {
    id: String(row.id),
    reporter_id: String(row.reporterId),
    target_type: target.type,
    [target.field]: String(target.id),
    reason_code: row.reasonCode,
    description: row.description,
    status: row.status,
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function assertAdmin(actor: ReportActor | undefined): void {
  if (!actor || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Access denied for the current user role');
  }
}

function reportNotFound(): NotFoundError {
  return new NotFoundError('Report not found', 'ADMIN_REPORT_NOT_FOUND');
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
    return { data: toAdminReportView(row) };
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
