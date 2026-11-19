import { and, count, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { financeAuditEvents } from '../../db/schema/finance';

type Executor = any;

export interface FinanceAuditRecord {
  id: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface CreateFinanceAuditInput {
  actorId: number;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown> | null;
}

export interface FinanceAuditListFilter {
  action?: string;
  actorId?: number;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export class FinanceAuditRepository {
  async insert(input: CreateFinanceAuditInput, executor: Executor = db): Promise<FinanceAuditRecord> {
    const [row] = await executor
      .insert(financeAuditEvents)
      .values({
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
        metadata: input.metadata ?? null,
      })
      .returning();
    return row as FinanceAuditRecord;
  }

  async list(filter: FinanceAuditListFilter): Promise<{ rows: FinanceAuditRecord[]; total: number }> {
    const conditions: SQL[] = [];
    if (filter.action) conditions.push(eq(financeAuditEvents.action, filter.action));
    if (filter.actorId) conditions.push(eq(financeAuditEvents.actorId, filter.actorId));
    if (filter.entityType) conditions.push(eq(financeAuditEvents.entityType, filter.entityType));
    if (filter.entityId) conditions.push(eq(financeAuditEvents.entityId, filter.entityId));
    if (filter.from) conditions.push(gte(financeAuditEvents.createdAt, filter.from));
    if (filter.to) conditions.push(lte(financeAuditEvents.createdAt, filter.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(financeAuditEvents)
      .where(where)
      .orderBy(desc(financeAuditEvents.createdAt), desc(financeAuditEvents.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    const [totalRow] = await db
      .select({ total: count() })
      .from(financeAuditEvents)
      .where(where);

    return { rows: rows as FinanceAuditRecord[], total: Number(totalRow?.total ?? 0) };
  }
}

export const financeAuditRepository = new FinanceAuditRepository();
