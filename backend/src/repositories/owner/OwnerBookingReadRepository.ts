import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, bookings, courts, facilities, users, playerProfiles, matches, bookingPricingDetails } from '../../db';
import { OwnerExecutor } from './owner-db';
const effectiveStatus = sql<string>`CASE
  WHEN ${bookings.status} = 'PENDING_PAYMENT' AND (${bookings.expiresAt} IS NULL OR ${bookings.expiresAt} <= now()) THEN 'EXPIRED'
  WHEN ${bookings.status} IN ('CONFIRMED','IN_PROGRESS') AND (${bookings.bookingDate} + ${bookings.endTime}) AT TIME ZONE 'Asia/Ho_Chi_Minh' <= now() THEN 'COMPLETED'
  WHEN ${bookings.status} = 'CONFIRMED' AND (${bookings.bookingDate} + ${bookings.startTime}) AT TIME ZONE 'Asia/Ho_Chi_Minh' <= now() THEN 'IN_PROGRESS'
  ELSE ${bookings.status} END`;
const selection = {
  id: bookings.id, bookingCode: bookings.bookingCode, courtId: bookings.courtId, facilityId: facilities.id,
  bookingDate: bookings.bookingDate, startTime: bookings.startTime, endTime: bookings.endTime,
  status: effectiveStatus, totalAmount: bookings.totalAmount, unitPrice: bookings.unitPrice,
  cancellationReason: bookings.cancellationReason, cancelledAt: bookings.cancelledAt,
  expiresAt: bookings.expiresAt, playerId: bookings.playerId,
  playerName: playerProfiles.fullName, playerEmail: users.email, playerPhone: playerProfiles.phone,
  matchId: matches.id,
  tournamentId: sql<number | null>`(SELECT tournament_id FROM tournament_matches WHERE match_id = ${matches.id} ORDER BY id LIMIT 1)`.mapWith(Number),
  paymentStatus: sql<string | null>`(SELECT status FROM payments WHERE booking_id = ${bookings.id} ORDER BY id DESC LIMIT 1)`,
};
function query(executor: OwnerExecutor = db) {
  return executor.select(selection).from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId)).innerJoin(facilities, eq(facilities.id, courts.facilityId))
    .innerJoin(users, eq(users.id, bookings.playerId)).leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
    .leftJoin(matches, eq(matches.bookingId, bookings.id));
}
export interface OwnerHistoryFilter { page: number; limit: number; status?: string; dateFrom?: string; dateTo?: string }
export const ownerBookingReadRepository = {
  async detail(ownerId: number, id: number) {
    const [row] = await query().where(and(eq(facilities.ownerId, ownerId), eq(bookings.id, id)));
    return row ?? null;
  },
  async active(ownerId: number, facilityId: number, date: string, executor: OwnerExecutor = db) {
    return query(executor).where(and(eq(facilities.ownerId, ownerId), eq(facilities.id, facilityId), eq(bookings.bookingDate, date), sql`${effectiveStatus} IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS')`));
  },
  async history(ownerId: number, facilityId: number, filter: OwnerHistoryFilter) {
    const predicate = and(eq(facilities.ownerId, ownerId), eq(facilities.id, facilityId), filter.status ? sql`${effectiveStatus} = ${filter.status}` : undefined, filter.dateFrom ? gte(bookings.bookingDate, filter.dateFrom) : undefined, filter.dateTo ? lte(bookings.bookingDate, filter.dateTo) : undefined);
    const [rows, [total]] = await Promise.all([
      query().where(predicate).orderBy(desc(bookings.bookingDate), desc(bookings.startTime), desc(bookings.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      db.select({ value: count() }).from(bookings).innerJoin(courts, eq(courts.id, bookings.courtId)).innerJoin(facilities, eq(facilities.id, courts.facilityId)).where(predicate),
    ]);
    return { rows, total: total.value };
  },
  async pricingDetails(id: number) {
    return db.select({ startTime: bookingPricingDetails.startTime, endTime: bookingPricingDetails.endTime, price: bookingPricingDetails.price, amount: bookingPricingDetails.amount }).from(bookingPricingDetails).where(eq(bookingPricingDetails.bookingId, id));
  },
};
export type OwnerBookingRead = NonNullable<Awaited<ReturnType<typeof ownerBookingReadRepository.detail>>>;
