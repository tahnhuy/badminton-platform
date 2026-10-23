import { and, eq, isNull } from 'drizzle-orm';
import { db, courts, facilities } from '../../db';
import { OwnerExecutor, OwnerTransaction } from './owner-db';

export const ownerCourtRepository = {
  async find(ownerId: number, id: number, executor: OwnerExecutor = db) {
    const [row] = await executor.select({ court: courts, facility: facilities }).from(courts)
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(and(eq(courts.id, id), eq(facilities.ownerId, ownerId), isNull(courts.deletedAt), isNull(facilities.deletedAt)));
    return row ?? null;
  },
  async create(input: typeof courts.$inferInsert, tx: OwnerTransaction) {
    const [row] = await tx.insert(courts).values(input).returning();
    return row;
  },
  async update(id: number, input: Partial<Pick<typeof courts.$inferInsert, 'name' | 'description' | 'status'>>, tx: OwnerTransaction) {
    const [row] = await tx.update(courts).set({ ...input, updatedAt: new Date() }).where(eq(courts.id, id)).returning();
    return row;
  },
};
