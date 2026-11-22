import {
  db,
  bookings,
  bookingPricingDetails,
  bookingCostShares,
  payments,
  courts,
  facilities,
  users,
  matches,
  tournamentMatches,
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
  expiresAt: Date | null;
  status?: string;
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

  async lockUsersAscending(ids: number[], executor: Executor): Promise<void> {
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
      await this.lockPlayer(id, executor);
    }
  }

  async findBookingOwner(bookingId: number, executor: Executor = db): Promise<number | null> {
    const [row] = await executor
      .select({ playerId: bookings.playerId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row?.playerId ?? null;
  }

  async insertCostShares(
    rows: {
      bookingId: number;
      paymentId: number;
      playerId: number;
      amount: string;
      isHost: boolean;
      status: 'PAID';
      paidAt: Date;
    }[],
    executor: Executor,
  ): Promise<void> {
    if (rows.length === 0) return;
    await executor.insert(bookingCostShares).values(rows);
  }

  async findCostSharesByBookingId(bookingId: number, executor: Executor = db) {
    return executor
      .select()
      .from(bookingCostShares)
      .where(eq(bookingCostShares.bookingId, bookingId))
      .orderBy(bookingCostShares.id);
  }

  async markCostShareRefunded(
    id: number,
    refundLedgerEntryId: number | null,
    executor: Executor,
  ): Promise<void> {
    await executor
      .update(bookingCostShares)
      .set({
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundLedgerEntryId,
        updatedAt: new Date(),
      })
      .where(and(eq(bookingCostShares.id, id), eq(bookingCostShares.status, 'PAID')));
  }

  /**
   * Marks elapsed (or never-deadlined) PENDING_PAYMENT holds for a court/date
   * as EXPIRED. Called inside booking creation so a timed-out hold can neither
   * block the slot through the partial exclusion constraint nor keep counting
   * against the Player's active-booking limit before the scheduler sweep.
   */
  async findStaleHoldsForCourt(courtId: number, date: string, executor: Executor = db) {
    return executor
      .select({ id: bookings.id, playerId: bookings.playerId })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.bookingDate, date),
          eq(bookings.status, 'PENDING_PAYMENT'),
          or(isNull(bookings.expiresAt), lte(bookings.expiresAt, new Date()))
        )
      );
  }

  async expireBookingsByIds(ids: number[], executor: Executor = db): Promise<{ id: number; playerId: number }[]> {
    if (ids.length === 0) return [];
    return executor
      .update(bookings)
      .set({ status: 'EXPIRED', version: sql`${bookings.version} + 1`, updatedAt: new Date() })
      .where(and(inArray(bookings.id, ids), eq(bookings.status, 'PENDING_PAYMENT')))
      .returning({ id: bookings.id, playerId: bookings.playerId });
  }

  async findDueExpirations(limit: number, executor: Executor = db) {
    return executor
      .select({ id: bookings.id, playerId: bookings.playerId })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'PENDING_PAYMENT'),
          or(isNull(bookings.expiresAt), lte(bookings.expiresAt, new Date()))
        )
      )
      .orderBy(bookings.expiresAt)
      .limit(limit);
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
        status: data.status ?? 'PENDING_PAYMENT',
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
    const conditions = [
      eq(bookings.playerId, playerId),
      // Tournament system reservations are not a Player's paid bookings.
      sql`NOT EXISTS (
        SELECT 1 FROM tournament_matches tm
        INNER JOIN matches tm_match ON tm_match.id = tm.match_id
        WHERE tm_match.booking_id = ${bookings.id}
      )`,
    ];

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

  /**
   * Owner Tech Design §7.7: a tournament system booking is identified by the
   * TOURNAMENT_MATCHES → MATCHES.booking_id link, not by a BOOKINGS column.
   */
  async findTournamentContextByBookingId(bookingId: number, executor: Executor = db) {
    const [row] = await executor
      .select({
        matchId: matches.id,
        status: matches.status,
        tournamentMatchId: tournamentMatches.id,
        tournamentId: tournamentMatches.tournamentId,
      })
      .from(matches)
      .innerJoin(tournamentMatches, eq(tournamentMatches.matchId, matches.id))
      .where(eq(matches.bookingId, bookingId))
      .limit(1);
    return row ?? null;
  }

  async findTournamentContextByTournamentMatchId(tournamentMatchId: number, executor: Executor = db) {
    const [row] = await executor
      .select({
        matchId: matches.id,
        bookingId: matches.bookingId,
        tournamentId: tournamentMatches.tournamentId,
      })
      .from(tournamentMatches)
      .innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(eq(tournamentMatches.id, tournamentMatchId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Links a tournament system booking to its Match. A previously released
   * (CANCELLED) reservation may be replaced so the Organizer can reschedule; an
   * active reservation still blocks a second booking atomically.
   */
  async linkSystemBookingToMatch(matchId: number, bookingId: number, executor: Executor) {
    const rows = await executor
      .update(matches)
      .set({ bookingId, updatedAt: new Date() })
      .where(and(
        eq(matches.id, matchId),
        or(
          isNull(matches.bookingId),
          sql`EXISTS (SELECT 1 FROM bookings b WHERE b.id = ${matches.bookingId} AND b.status = 'CANCELLED')`,
        ),
      ))
      .returning({ id: matches.id });
    return rows.length > 0;
  }

  /** Any Match linked to this booking; `isTournament` comes from TOURNAMENT_MATCHES. */
  async findMatchByBookingId(bookingId: number, executor: Executor = db) {
    const [row] = await executor
      .select({
        id: matches.id,
        status: matches.status,
        tournamentMatchId: tournamentMatches.id,
      })
      .from(matches)
      .leftJoin(tournamentMatches, eq(tournamentMatches.matchId, matches.id))
      .where(eq(matches.bookingId, bookingId))
      .limit(1);
    if (!row) return null;
    return { id: row.id, status: row.status, isTournament: row.tournamentMatchId !== null };
  }

  async findBookingFacilityOwner(bookingId: number, executor: Executor = db): Promise<number | null> {
    const [row] = await executor
      .select({ ownerId: facilities.ownerId })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .innerJoin(facilities, eq(facilities.id, courts.facilityId))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row?.ownerId ?? null;
  }

  async findMatchesByBookingIds(bookingIds: number[], executor: Executor = db) {
    if (bookingIds.length === 0) return [];
    return executor
      .select({ id: matches.id, bookingId: matches.bookingId, status: matches.status })
      .from(matches)
      .where(inArray(matches.bookingId, bookingIds));
  }

  async updateBookingStatus(
    bookingId: number,
    status: string,
    executor: Executor,
    extra?: { cancellationReason?: string | null; cancelledAt?: Date | null }
  ): Promise<void> {
    await executor
      .update(bookings)
      .set({
        status,
        version: sql`${bookings.version} + 1`,
        updatedAt: new Date(),
        ...(extra?.cancellationReason !== undefined ? { cancellationReason: extra.cancellationReason } : {}),
        ...(extra?.cancelledAt !== undefined ? { cancelledAt: extra.cancelledAt } : {}),
      })
      .where(eq(bookings.id, bookingId));
  }

  async expireDueBookings(limit: number, executor: Executor = db): Promise<{ id: number; playerId: number }[]> {
    const result = (await executor.execute(sql`
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
      RETURNING id, player_id
    `)) as unknown as { rows: { id: number | string; player_id: number | string }[] };
    return (result.rows ?? []).map((row) => ({ id: Number(row.id), playerId: Number(row.player_id) }));
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
