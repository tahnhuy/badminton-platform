import { and, eq, sql, inArray } from 'drizzle-orm';
import { db, facilities, courts, courtSlotBlocks } from '../../db';
export type OccupancyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const courtOccupancyRepository = {
  async activeBlocks(courtIds: number[], date: string) {
    if (!courtIds.length) return [];
    return db.select({ courtId: courtSlotBlocks.courtId, startTime: courtSlotBlocks.startTime, endTime: courtSlotBlocks.endTime }).from(courtSlotBlocks).where(and(inArray(courtSlotBlocks.courtId, courtIds), eq(courtSlotBlocks.bookingDate, date), eq(courtSlotBlocks.status, 'ACTIVE')));
  },
  async lockFacility(courtId: number, tx: OccupancyTransaction) {
    const [target] = await tx.select({ facilityId: courts.facilityId }).from(courts).where(eq(courts.id, courtId));
    if (!target) return null;
    const [facility] = await tx.select().from(facilities).where(eq(facilities.id, target.facilityId)).for('update');
    return facility ?? null;
  },
  async lockDate(courtId: number, date: string, tx: OccupancyTransaction) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('court:' || ${String(courtId)} || ':' || ${date}))`);
  },
  async blocked(courtId: number, date: string, startTime: string, endTime: string, tx: OccupancyTransaction) {
    const [row] = await tx.select({ id: courtSlotBlocks.id }).from(courtSlotBlocks).where(and(
      eq(courtSlotBlocks.courtId, courtId), eq(courtSlotBlocks.status, 'ACTIVE'),
      sql`${courtSlotBlocks.blockRange} && tsrange(${date}::date + ${startTime}::time, ${date}::date + ${endTime}::time, '[)')`,
    )).limit(1);
    return !!row;
  },
};
