import { attachFinanceIdentity } from './finance-identities';
import type { TransactionContext } from '../../contracts/TransactionContext';
import {
  financeAuditRepository,
  FinanceAuditListFilter,
  FinanceAuditRecord,
} from '../../repositories/finance/FinanceAuditRepository';

export interface RecordFinanceAuditInput {
  actorId: number;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown> | null;
}

export class FinanceAuditService {
  async record(input: RecordFinanceAuditInput, tx?: TransactionContext): Promise<FinanceAuditRecord> {
    return financeAuditRepository.insert(input, tx);
  }

  async list(filter: FinanceAuditListFilter) {
    const result = await financeAuditRepository.list(filter);
    const rows = await attachFinanceIdentity(result.rows, row => row.actorId, 'actor');
    const total = result.total;
    return {
      data: rows.map(row => ({
        id: row.id,
        actorId: row.actorId,
        actorName: row.actorName,
        actorEmail: row.actorEmail,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }
}

export const financeAuditService = new FinanceAuditService();
