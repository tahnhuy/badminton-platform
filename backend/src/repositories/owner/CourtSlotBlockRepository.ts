import { and, eq, sql } from 'drizzle-orm';
import { db, courtSlotBlocks } from '../../db';
import { OwnerExecutor, OwnerTransaction } from './owner-db';

export const courtSlotBlockRepository = {
  async active(courtId: number, date: string, executor: OwnerExecutor = db) {
    return executor.select().from(courtSlotBlocks).where(and(eq(courtSlotBlocks.courtId, courtId), eq(courtSlotBlocks.bookingDate, date), eq(courtSlotBlocks.status, 'ACTIVE'))).orderBy(courtSlotBlocks.startTime);
  },
  async overlaps(courtId: number, date: string, start: string, end: string, executor: OwnerExecutor = db) {
    const [row] = await executor.select({ id: courtSlotBlocks.id }).from(courtSlotBlocks).where(and(eq(courtSlotBlocks.courtId, courtId), eq(courtSlotBlocks.status, 'ACTIVE'), sql`${courtSlotBlocks.blockRange} && tsrange(${date}::date + ${start}::time, ${date}::date + ${end}::time, '[)')`)).limit(1);
    return !!row;
  },
  async create(input: typeof courtSlotBlocks.$inferInsert, tx: OwnerTransaction) {
    const [row] = await tx.insert(courtSlotBlocks).values(input).returning();
    return row;
  },
  async release(courtId: number, id: number, tx: OwnerTransaction) {
    const [row] = await tx.update(courtSlotBlocks).set({ status: 'RELEASED', updatedAt: new Date() }).where(and(eq(courtSlotBlocks.id, id), eq(courtSlotBlocks.courtId, courtId))).returning();
    return row ?? null;
  },
};
