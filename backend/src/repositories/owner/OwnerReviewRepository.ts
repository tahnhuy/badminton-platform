import { and, count, desc, eq } from 'drizzle-orm';
import { db, courtOwnerReviews } from '../../db';
import { OwnerExecutor, OwnerTransaction } from './owner-db';

export type ReviewTarget = { facilityId: number; courtId?: never } | { courtId: number; facilityId?: never };
function targetWhere(target: ReviewTarget) {
  return target.facilityId !== undefined ? eq(courtOwnerReviews.facilityId, target.facilityId) : eq(courtOwnerReviews.courtId, target.courtId);
}
export const ownerReviewRepository = {
  async latest(target: ReviewTarget, kind: string, executor: OwnerExecutor = db) {
    const [row] = await executor.select().from(courtOwnerReviews).where(and(targetWhere(target), eq(courtOwnerReviews.kind, kind))).orderBy(desc(courtOwnerReviews.id)).limit(1);
    return row ?? null;
  },
  async create(input: typeof courtOwnerReviews.$inferInsert, tx: OwnerTransaction) {
    const [row] = await tx.insert(courtOwnerReviews).values(input).returning();
    return row;
  },
  async pending(target: ReviewTarget, kind: string, executor: OwnerExecutor = db) {
    const [row] = await executor.select().from(courtOwnerReviews).where(and(targetWhere(target), eq(courtOwnerReviews.kind, kind), eq(courtOwnerReviews.status, 'PENDING')));
    return row ?? null;
  },
  async list(target: ReviewTarget, page: number, limit: number) {
    const [rows, [total]] = await Promise.all([
      db.select().from(courtOwnerReviews).where(targetWhere(target)).orderBy(desc(courtOwnerReviews.createdAt), desc(courtOwnerReviews.id)).limit(limit).offset((page - 1) * limit),
      db.select({ value: count() }).from(courtOwnerReviews).where(targetWhere(target)),
    ]);
    return { rows, total: total.value };
  },
};

export function reviewDto(row: typeof courtOwnerReviews.$inferSelect) {
  return { id: row.id, kind: row.kind, status: row.status, submittedValues: row.submittedValues, rejectionReason: row.rejectionReason, submittedAt: row.createdAt, reviewedAt: row.reviewedAt };
}
