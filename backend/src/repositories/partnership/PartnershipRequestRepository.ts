import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, users } from '../../db';
import { ownerPartnershipRequests as requests } from '../../db/schema/partnership';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { OwnerRequestStatus } from '../../validation/partnership';

type Executor = typeof db | TransactionContext;

export type OwnerRequestRow = typeof requests.$inferSelect;
export type NewOwnerRequest = typeof requests.$inferInsert;

export interface OwnerRequestView extends Omit<OwnerRequestRow, 'processedBy' | 'createdUserId'> {
  processedBy: { id: number; email: string } | null;
  createdUser: { id: number; email: string } | null;
}

const processor = alias(users, 'processor');
const createdUser = alias(users, 'created_user');

export const OPEN_STATUSES: OwnerRequestStatus[] = ['PENDING', 'CONTACTED'];

function viewQuery(executor: Executor) {
  return executor
    .select({
      request: requests,
      processorEmail: processor.email,
      createdUserEmail: createdUser.email,
    })
    .from(requests)
    .leftJoin(processor, eq(processor.id, requests.processedBy))
    .leftJoin(createdUser, eq(createdUser.id, requests.createdUserId));
}

function toView(row: { request: OwnerRequestRow; processorEmail: string | null; createdUserEmail: string | null }): OwnerRequestView {
  const { processedBy, createdUserId, ...rest } = row.request;
  return {
    ...rest,
    processedBy: processedBy !== null && row.processorEmail !== null ? { id: processedBy, email: row.processorEmail } : null,
    createdUser: createdUserId !== null && row.createdUserEmail !== null ? { id: createdUserId, email: row.createdUserEmail } : null,
  };
}

export const partnershipRequestRepository = {
  /** Inserts unless the email already has an open request (partial unique index); returns the id or null. */
  async insertIfNoOpen(tx: TransactionContext, data: NewOwnerRequest): Promise<number | null> {
    const [row] = await tx
      .insert(requests)
      .values(data)
      .onConflictDoNothing({ target: requests.email, where: sql`${requests.status} IN ('PENDING', 'CONTACTED')` })
      .returning({ id: requests.id });
    return row?.id ?? null;
  },

  async findView(executor: Executor, id: number): Promise<OwnerRequestView | null> {
    const [row] = await viewQuery(executor).where(eq(requests.id, id)).limit(1);
    return row ? toView(row) : null;
  },

  async lockById(tx: TransactionContext, id: number): Promise<OwnerRequestRow | null> {
    const [row] = await tx.select().from(requests).where(eq(requests.id, id)).for('update').limit(1);
    return row ?? null;
  },

  /** Conditional update: applies only while the request is in one of `from`; returns whether it applied. */
  async updateIfStatus(tx: TransactionContext, id: number, from: OwnerRequestStatus[], values: Partial<NewOwnerRequest>): Promise<boolean> {
    const updated = await tx
      .update(requests)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(requests.id, id), inArray(requests.status, from)))
      .returning({ id: requests.id });
    return updated.length > 0;
  },

  async list(options: { status?: OwnerRequestStatus; q?: string; page: number; limit: number }) {
    const filters: SQL[] = [];
    if (options.status) filters.push(eq(requests.status, options.status));
    if (options.q) {
      const term = `%${options.q.replace(/[\\%_]/g, char => `\\${char}`)}%`;
      filters.push(or(ilike(requests.contactName, term), ilike(requests.email, term), ilike(requests.phone, term), ilike(requests.facilityName, term))!);
    }
    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await viewQuery(db).where(where).orderBy(desc(requests.createdAt), desc(requests.id))
      .limit(options.limit).offset((options.page - 1) * options.limit);
    const [{ total }] = await db.select({ total: count() }).from(requests).where(where);
    return { rows: rows.map(toView), total: Number(total) };
  },

  async countsByStatus(): Promise<Record<OwnerRequestStatus, number>> {
    const rows = await db.select({ status: requests.status, n: count() }).from(requests).groupBy(requests.status);
    const counts: Record<OwnerRequestStatus, number> = { PENDING: 0, CONTACTED: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of rows) counts[row.status as OwnerRequestStatus] = Number(row.n);
    return counts;
  },
};
