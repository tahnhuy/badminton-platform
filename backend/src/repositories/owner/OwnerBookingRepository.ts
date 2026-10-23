import { and, eq, gt, inArray, ne, or, sql } from 'drizzle-orm';
import { db, bookings, courts } from '../../db';
import { OwnerExecutor } from './owner-db';
export const ownerBookingRepository = {
  async conflictsWithHours(facilityId: number, opening: string, closing: string, executor: OwnerExecutor = db) {
    const [row] = await executor.select({ id: bookings.id }).from(bookings).innerJoin(courts, eq(bookings.courtId, courts.id)).where(and(
      eq(courts.facilityId, facilityId), inArray(bookings.status, ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS']),
      or(ne(bookings.status, 'PENDING_PAYMENT'), gt(bookings.expiresAt, new Date())),
      sql`((${bookings.bookingDate} + ${bookings.endTime}) AT TIME ZONE 'Asia/Ho_Chi_Minh') > now()`,
      or(sql`${bookings.startTime} < ${opening}::time`, sql`${bookings.endTime} > ${closing}::time`),
    )).limit(1);
    return !!row;
  },
};
