import {
  db,
  bookings,
  bookingPricingDetails,
  payments,
  courts,
  facilities,
  users,
} from '../../db';
import { and, count, desc, eq, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] as const;

type Executor = any;

export interface NewBookingData {
  playerId: number;
  courtId: number;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  unitPrice: string;
  totalAmount: string;
  expiresAt: Date;
}

export interface NewPricingDetail {
  bookingId: number;
  courtPricingId: number;
  startTime: string;
  endTime: string;
  price: string;
  amount: string;
}

export interface PlayerBookingFilter {
  status?: string;
  timeScope?: 'UPCOMING' | 'PAST' | 'ALL';
  page: number;
  limit: number;
}

export class BookingRepository {
  /**
   * Active intervals for a court/date. A PENDING_PAYMENT hold whose
   * `expires_at` has elapsed is treated as inactive so a timed-out hold does
   * not block a slot between scheduler sweeps.
   */
  async findActiveIntervals(
    courtId: number,
    date: string,
    now: Date = new Date(),
    executor: Executor = db
  ) {
    return executor
      .select({ startTime: bookings.startTime, endTime: bookings.endTime })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.bookingDate, date),
          inArray(bookings.status, [...ACTIVE_STATUSES]),
          or(ne(bookings.status, 'PENDING_PAYMENT'), gt(bookings.expiresAt, now))
        )
      );
  }

  async findActiveIntervalsForCourts(
    courtIds: number[],
    date: string,
    now: Date = new Date(),
    executor: Executor = db
  ) {
    if (courtIds.length === 0) return [];
    return executor
      .select({
        courtId: bookings.courtId,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.courtId, courtIds),
          eq(bookings.bookingDate, date),
          inArray(bookings.status, [...ACTIVE_STATUSES]),
          or(ne(bookings.status, 'PENDING_PAYMENT'), gt(bookings.expiresAt, now))
        )
      );
  }

  async countActiveForPlayer(
    playerId: number,
    executor: Executor = db,
    now: Date = new Date()
  ): Promise<number> {
    const [row] = await executor
      .select({ total: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.playerId, playerId),
          or(
            inArray(bookings.status, ['CONFIRMED', 'IN_PROGRESS']),
            and(eq(bookings.status, 'PENDING_PAYMENT'), gt(bookings.expiresAt, now))
          )
        )
      );
    return Number(row?.total || 0);
  }

  async lockCourt(courtId: number, executor: Executor) {
    const [court] = await executor
      .select({ id: courts.id, status: courts.status, deletedAt: courts.deletedAt, facilityId: courts.facilityId })
      .from(courts)
      .where(eq(courts.id, courtId))
      .for('update');
    return court ?? null;
  }

  async lockPlayer(playerId: number, executor: Executor) {
    const [player] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, playerId))
      .for('update');
    return player ?? null;
  }

  /**
   * Marks elapsed (or never-deadlined) PENDING_PAYMENT holds for a court/date
   * as EXPIRED. Called inside booking creation so a timed-out hold can neither
   * block the slot through the partial exclusion constraint nor keep counting
   * against the Player's active-booking limit before the scheduler sweep.
   */
  async expireStaleHoldsForCourt(
    courtId: number,
    date: string,
    executor: Executor = db
  ): Promise<number> {
    const rows = await executor
      .update(bookings)
      .set({ status: 'EXPIRED', version: sql`${bookings.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.bookingDate, date),
          eq(bookings.status, 'PENDING_PAYMENT'),
          or(isNull(bookings.expiresAt), lte(bookings.expiresAt, new Date()))
        )
      )
      .returning({ id: bookings.id });
    return rows.length;
  }

  async insertBooking(data: NewBookingData, executor: Executor): Promise<{ id: number; createdAt: Date }> {
    const [row] = await executor
      .insert(bookings)
      .values({
        playerId: data.playerId,
        courtId: data.courtId,
        bookingCode: data.bookingCode,
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        unitPrice: data.unitPrice,
        totalAmount: data.totalAmount,
        status: 'PENDING_PAYMENT',
        expiresAt: data.expiresAt,
      })
      .returning({ id: bookings.id, createdAt: bookings.createdAt });
    return row;
  }

  async insertPricingDetails(rows: NewPricingDetail[], executor: Executor): Promise<void> {
    if (rows.length === 0) return;
    await executor.insert(bookingPricingDetails).values(rows);
  }

  async findBookingsForPlayer(playerId: number, filter: PlayerBookingFilter) {
    const conditions = [eq(bookings.playerId, playerId)];

    if (filter.status) {
      conditions.push(this.effectiveStatusMatches(filter.status));
    }
    if (filter.timeScope === 'UPCOMING') {
      conditions.push(sql`(${bookings.bookingDate} + ${bookings.endTime}) > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
    } else if (filter.timeScope === 'PAST') {
      conditions.push(sql`(${bookings.bookingDate} + ${bookings.endTime}) <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
    }

    const [countRow] = await db
      .select({ total: count() })
      .from(bookings)
      .where(and(...conditions));
    const total = Number(countRow?.total || 0);

    const rows = await db
      .select({ ...this.bookingColumns(), ...this.courtFacilityColumns(), paymentStatus: payments.status })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.createdAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return { items: rows, total };
  }

  async findBookingById(bookingId: number, executor: Executor = db) {
    const rows = await executor
      .select({ ...this.bookingColumns(), ...this.courtFacilityColumns() })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (rows.length === 0) return null;

    const [pricing, payment] = await Promise.all([
      executor
        .select()
        .from(bookingPricingDetails)
        .where(eq(bookingPricingDetails.bookingId, bookingId))
        .orderBy(bookingPricingDetails.startTime),
      executor
        .select({
          id: payments.id,
          status: payments.status,
          amount: payments.amount,
          paidAt: payments.paidAt,
          transactionId: payments.transactionId,
        })
        .from(payments)
        .where(eq(payments.bookingId, bookingId))
        .orderBy(desc(payments.id))
        .limit(1),
    ]);

    return { booking: rows[0], pricing, payment: payment[0] ?? null };
  }

  async lockBookingById(bookingId: number, executor: Executor) {
    const [row] = await executor
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for('update');
    return row ?? null;
  }

  async updateBookingStatus(
    bookingId: number,
    status: string,
    executor: Executor
  ): Promise<void> {
    await executor
      .update(bookings)
      .set({ status, version: sql`${bookings.version} + 1`, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
  }

  async expireDueBookings(limit: number): Promise<number> {
    const result = (await db.execute(sql`
      UPDATE ${bookings}
      SET status = 'EXPIRED', version = version + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM ${bookings}
        WHERE status = 'PENDING_PAYMENT'
          AND (expires_at IS NULL OR expires_at <= now())
        ORDER BY expires_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
    `)) as unknown as { rowCount: number | null };
    return result.rowCount ?? 0;
  }

  async advanceConfirmedToInProgress(limit: number): Promise<number> {
    const result = (await db.execute(sql`
      UPDATE ${bookings}
      SET status = 'IN_PROGRESS', version = version + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM ${bookings}
        WHERE status = 'CONFIRMED'
          AND (booking_date + start_time) <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
        ORDER BY booking_date, start_time
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
    `)) as unknown as { rowCount: number | null };
    return result.rowCount ?? 0;
  }

  async advanceInProgressToCompleted(limit: number): Promise<number> {
    const result = (await db.execute(sql`
      UPDATE ${bookings}
      SET status = 'COMPLETED', version = version + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM ${bookings}
        WHERE status = 'IN_PROGRESS'
          AND (booking_date + end_time) <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
        ORDER BY booking_date, end_time
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
    `)) as unknown as { rowCount: number | null };
    return result.rowCount ?? 0;
  }

  /**
   * SQL mirror of the service-side effective-status derivation (Tech Design
   * §15) so that list filtering matches what the client is shown, even before
   * the state-transition worker persists the transition.
   */
  private effectiveStatusMatches(status: string) {
    const localNow = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    return sql`(
      CASE
        WHEN ${bookings.status} = 'PENDING_PAYMENT'
          AND ${bookings.expiresAt} IS NOT NULL
          AND ${bookings.expiresAt} <= now()
          THEN 'EXPIRED'
        WHEN ${bookings.status} = 'CONFIRMED'
          AND (${bookings.bookingDate} + ${bookings.endTime}) <= ${localNow}
          THEN 'COMPLETED'
        WHEN ${bookings.status} = 'CONFIRMED'
          AND (${bookings.bookingDate} + ${bookings.startTime}) <= ${localNow}
          THEN 'IN_PROGRESS'
        WHEN ${bookings.status} = 'IN_PROGRESS'
          AND (${bookings.bookingDate} + ${bookings.endTime}) <= ${localNow}
          THEN 'COMPLETED'
        ELSE ${bookings.status}
      END
    ) = ${status}`;
  }

  private bookingColumns() {
    return {
      id: bookings.id,
      bookingCode: bookings.bookingCode,
      playerId: bookings.playerId,
      courtId: bookings.courtId,
      bookingDate: bookings.bookingDate,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      unitPrice: bookings.unitPrice,
      totalAmount: bookings.totalAmount,
      status: bookings.status,
      expiresAt: bookings.expiresAt,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
    };
  }

  private courtFacilityColumns() {
    return {
      courtName: courts.name,
      courtDescription: courts.description,
      courtStatus: courts.status,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilityAddress: facilities.address,
      facilityWard: facilities.ward,
      facilityDistrict: facilities.district,
      facilityCity: facilities.city,
      facilityPhone: facilities.phone,
      facilityOpeningTime: facilities.openingTime,
      facilityClosingTime: facilities.closingTime,
    };
  }
}

export const bookingRepository = new BookingRepository();
