import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db, facilities, courts } from '../../db';
import { OwnerExecutor, OwnerTransaction } from './owner-db';

type FacilityInput = Omit<typeof facilities.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export const ownerFacilityRepository = {
  async find(ownerId: number, id: number, executor: OwnerExecutor = db) {
    const [row] = await executor.select().from(facilities).where(and(eq(facilities.id, id), eq(facilities.ownerId, ownerId), isNull(facilities.deletedAt)));
    return row ?? null;
  },
  async lock(ownerId: number, id: number, tx: OwnerTransaction) {
    const [row] = await tx.select().from(facilities).where(and(eq(facilities.id, id), eq(facilities.ownerId, ownerId), isNull(facilities.deletedAt))).for('update');
    return row ?? null;
  },
  async list(ownerId: number, page: number, limit: number, status?: string) {
    const predicate = and(eq(facilities.ownerId, ownerId), isNull(facilities.deletedAt), status ? eq(facilities.status, status) : undefined);
    const [rows, [total]] = await Promise.all([
      db.select().from(facilities).where(predicate).orderBy(desc(facilities.id)).limit(limit).offset((page - 1) * limit),
      db.select({ value: count() }).from(facilities).where(predicate),
    ]);
    return { rows, total: total.value };
  },
  async courts(facilityId: number, executor: OwnerExecutor = db) {
    return executor.select().from(courts).where(and(eq(courts.facilityId, facilityId), isNull(courts.deletedAt))).orderBy(courts.id);
  },
  async create(input: FacilityInput, tx: OwnerTransaction) {
    const [row] = await tx.insert(facilities).values(input).returning();
    return row;
  },
  async update(ownerId: number, id: number, input: Partial<FacilityInput>, tx: OwnerTransaction) {
    const [row] = await tx.update(facilities).set({ ...input, updatedAt: new Date() }).where(and(eq(facilities.id, id), eq(facilities.ownerId, ownerId), isNull(facilities.deletedAt))).returning();
    return row ?? null;
  },
};
