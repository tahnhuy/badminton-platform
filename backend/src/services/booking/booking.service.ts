import { courtOccupancyRepository } from '../../repositories/facility/CourtOccupancyRepository';
import { db } from '../../db';
import { courtRepository, CourtSummary } from '../../repositories/facility/CourtRepository';
import { courtStandardRepository } from '../../repositories/facility/CourtStandardRepository';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { bookingConfig } from '../../shared/config/booking-config';
import { AppError, ConflictError, ForbiddenError, NotFoundError, TransactionRetryError } from '../../errors/AppError';
import { bookingEvents, type BookingDomainEventType } from './booking-events';
import { refundService } from '../payments/RefundService';
import { logger } from '../../shared/logging/logger';
import type {
  MatchBookingPort,
  MatchHoldInput,
  MatchHoldResult,
} from '../../contracts/MatchBookingPort';
import type {
  CreateSystemBookingInput,
  ReleaseSystemBookingInput,
  SystemBookingResult,
} from '../../contracts/BookingService';
import { matchModule } from '../match/match.module';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchmakingNotifications } from '../matchmaking/matchmaking-notifications';
import { notificationService } from '../notifications/NotificationService';
import { cleanNotificationReason, notifyOwner } from '../notifications/owner-notifications';
import { ownerConfig } from '../../shared/config/owner-config';
import type { TransactionContext } from '../../contracts/TransactionContext';

import {
  computeFreeIntervals,
  computeWindowPricing,
  dateTimeToInstant,
  intervalCovers,
  addDaysToDateString,
  isStartTimePast,
  minutesToTime,
  notBeforeMinutesForDate,
  timeToMinutes,
  todayInAppTimezone,
  type FreeInterval,
} from './availability.service';

export interface CourtSearchInput {
  name?: string;
  city?: string;
  district?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  page: number;
  limit: number;
}

export interface CreateBookingInput {
  courtId: number;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
}

export interface MyBookingsInput {
  status?: string;
  timeScope?: 'UPCOMING' | 'PAST' | 'ALL';
  page: number;
  limit: number;
}

export interface CourtSummaryDTO {
  id: number;
  name: string;
  description: string | null;
  priceFrom: number | null;
  available: boolean;
  facility: {
    id: number;
    name: string;
    address: string;
    ward: string | null;
    district: string;
    city: string;
    phone: string;
    openingTime: string;
    closingTime: string;
  };
}

/** One facility in a facility-paged search, with its matching courts (Tech Design §9.1a). */
export interface FacilitySearchItemDTO {
  facility: CourtSummaryDTO['facility'];
  priceFrom: number | null;
  courts: { id: number; name: string; description: string | null; priceFrom: number | null }[];
}

export interface CourtAvailabilityDTO {
  date: string;
  durationMinutes: number | null;
  court: { id: number; name: string; description: string | null; status: string };
  facility: {
    id: number;
    name: string;
    address: string;
    ward: string | null;
    district: string;
    city: string;
    phone: string;
  };
  openingTime: string;
  closingTime: string;
  intervals: FreeInterval[];
}

export interface BookingPricingSegmentDTO {
  startTime: string;
  endTime: string;
  price: number;
  amount: number;
}

export interface BookingSummaryDTO {
  id: number;
  bookingCode: string;
  status: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  unitPrice: number;
  totalAmount: number;
  expiresAt: Date | null;
  refundStatus: string;
  court: { id: number; name: string };
  facility: { id: number; name: string; address: string; ward: string | null; district: string; city: string };
  createdAt: Date;
}

export interface BookingDetailDTO extends BookingSummaryDTO {
  pricingDetails: BookingPricingSegmentDTO[];
  payment: { id: number; status: string; amount: number; paidAt: Date | null } | null;
}

export interface BookingConfirmationResult {
  bookingId: number;
  status: string;
  refundSignal: boolean;
}

export interface FacilityCourtDTO {
  id: number;
  name: string;
  description: string | null;
  status: string;
  priceFrom: number | null;
  standards: { code: string; name: string; reviewedAt: Date | null }[];
}

export interface FacilityDetailDTO {
  id: number;
  name: string;
  description: string | null;
  phone: string;
  status: string;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  openingTime: string;
  closingTime: string;
  courts: FacilityCourtDTO[];
}

interface BookingJoinedRow {
  id: number;
  bookingCode: string;
  playerId: number;
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  unitPrice: string;
  totalAmount: string;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  courtName: string;
  courtDescription: string | null;
  courtStatus: string;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  facilityWard: string | null;
  facilityDistrict: string;
  facilityCity: string;
  facilityPhone: string;
  facilityOpeningTime: string;
  facilityClosingTime: string;
  paymentStatus?: string | null;
}

const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'];

function durationMinutesBetween(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function effectiveStatus(row: Pick<BookingJoinedRow, 'status' | 'expiresAt' | 'bookingDate' | 'startTime' | 'endTime'>, now: Date): string {
  const startInstant = dateTimeToInstant(row.bookingDate, row.startTime);
  const endInstant = dateTimeToInstant(row.bookingDate, row.endTime);

  if (row.status === 'PENDING_PAYMENT' && row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  if (row.status === 'CONFIRMED') {
    if (endInstant.getTime() <= now.getTime()) {
      return 'COMPLETED';
    }
    if (startInstant.getTime() <= now.getTime()) {
      return 'IN_PROGRESS';
    }
  }
  if (row.status === 'IN_PROGRESS' && endInstant.getTime() <= now.getTime()) {
    return 'COMPLETED';
  }
  return row.status;
}

function refundStatusFrom(status: string, paymentStatus?: string | null): string {
  if (status !== 'CANCELLED') return 'NONE';
  if (paymentStatus === 'REFUND_PENDING' || paymentStatus === 'REFUNDED' || paymentStatus === 'REFUND_FAILED') {
    return paymentStatus;
  }
  if (paymentStatus === 'SUCCESS') return 'PENDING';
  return 'NONE';
}

function generateBookingCode(now: Date): string {
  const date = todayInAppTimezone(now).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `BK-${date}-${random}`;
}

function toPricingIntervals(rows: { id: number; startTime: string; endTime: string; price: string }[]) {
  return rows.map((row) => ({
    id: row.id,
    startTime: row.startTime,
    endTime: row.endTime,
    price: Number(row.price),
  }));
}

function paginate<T>(rows: T[], page: number, limit: number) {
  const total = rows.length;
  const offset = (page - 1) * limit;
  return {
    items: rows.slice(offset, offset + limit),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

function toSummaryDTO(row: CourtSummary, available: boolean): CourtSummaryDTO {
  return {
    id: row.courtId,
    name: row.courtName,
    description: row.courtDescription,
    priceFrom: row.priceFrom,
    available,
    facility: {
      id: row.facilityId,
      name: row.facilityName,
      address: row.facilityAddress,
      ward: row.facilityWard,
      district: row.facilityDistrict,
      city: row.facilityCity,
      phone: row.facilityPhone,
      openingTime: row.openingTime,
      closingTime: row.closingTime,
    },
  };
}

function isPostgresError(error: unknown, code: string): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === code || candidate?.cause?.code === code;
}

interface PersistBookingInput {
    playerId: number;
    courtId: number;
    bookingDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    totalAmount: number;
    unitPrice: number;
    expiresAt: Date | null;
    segments: { courtPricingId: number | null; startTime: string; endTime: string; price: number; amount: number }[];
    activeLimitMode: string;
    maxActivePerPlayer: number;
    /** Defaults to PENDING_PAYMENT; tournament system bookings hold the slot as CONFIRMED. */
    status?: string;
}
type BookingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class BookingService {
  async searchCourts(input: CourtSearchInput) {
    const matching = await this.findMatchingCourts(input);
    return paginate(matching, input.page, input.limit);
  }

  /**
   * Same eligibility and time-window rules as `searchCourts`, paginated by facility.
   * Facilities are ordered by their lowest matching price, then id, so pages are stable.
   */
  async searchFacilities(input: CourtSearchInput) {
    const matching = await this.findMatchingCourts(input);
    const groups = new Map<number, FacilitySearchItemDTO>();
    for (const court of matching) {
      const group = groups.get(court.facility.id) ?? { facility: court.facility, priceFrom: null, courts: [] };
      group.courts.push({ id: court.id, name: court.name, description: court.description, priceFrom: court.priceFrom });
      if (court.priceFrom != null) {
        group.priceFrom = group.priceFrom == null ? court.priceFrom : Math.min(group.priceFrom, court.priceFrom);
      }
      groups.set(court.facility.id, group);
    }
    const items = [...groups.values()];
    for (const item of items) {
      item.courts.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0)
        || a.name.localeCompare(b.name, 'vi', { numeric: true }) || a.id - b.id);
    }
    items.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0) || a.facility.id - b.facility.id);
    return paginate(items, input.page, input.limit);
  }

  private async findMatchingCourts(input: Omit<CourtSearchInput, 'page' | 'limit'>): Promise<CourtSummaryDTO[]> {
    const pricingDate = input.date ?? todayInAppTimezone();
    const rows = await courtRepository.findAllBookableCourts({
      name: input.name,
      city: input.city,
      district: input.district,
      pricingDate,
    });

    const priced = rows.filter((row) => row.priceFrom != null);
    const hasWindow = Boolean(input.date && input.startTime && input.endTime);

    let matching: CourtSummaryDTO[];
    if (hasWindow && priced.length > 0) {
      matching = await this.filterCourtsByWindow(priced, input.date!, input.startTime!, input.endTime!);
    } else {
      matching = priced.map((row) => toSummaryDTO(row, true));
    }

    matching.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0));
    return matching;
  }

  async getCourtAvailability(
    courtId: number,
    date: string,
    durationMinutes?: number | null
  ): Promise<CourtAvailabilityDTO> {
    const court = await courtRepository.findCourtWithFacility(courtId);
    if (!court) {
      throw new NotFoundError('Court not found', 'COURT_NOT_FOUND');
    }
    this.assertBookable(court.courtStatus, court.courtDeletedAt, court.facilityStatus, court.facilityDeletedAt);

    const [pricingRows, occupied, blocked] = await Promise.all([
      courtRepository.findPricingsForDate(courtId, date),
      bookingRepository.findActiveIntervals(courtId, date),
      courtOccupancyRepository.activeBlocks([courtId], date),
    ]);

    const intervals = computeFreeIntervals({
      openingTime: court.openingTime,
      closingTime: court.closingTime,
      pricings: toPricingIntervals(pricingRows),
      occupied: [...occupied, ...blocked],
      durationMinutes: durationMinutes ?? null,
      notBeforeMinutes: notBeforeMinutesForDate(date),
    });

    return {
      date,
      durationMinutes: durationMinutes ?? null,
      court: {
        id: court.courtId,
        name: court.courtName,
        description: court.courtDescription,
        status: court.courtStatus,
      },
      facility: {
        id: court.facilityId,
        name: court.facilityName,
        address: court.facilityAddress,
        ward: court.facilityWard,
        district: court.facilityDistrict,
        city: court.facilityCity,
        phone: court.facilityPhone,
      },
      openingTime: court.openingTime,
      closingTime: court.closingTime,
      intervals,
    };
  }

  async createBooking(playerId: number, input: CreateBookingInput): Promise<BookingDetailDTO> {
    const config = await bookingConfig.get();
    if (!config.bookingEnabled) {
      throw new AppError('BOOKING_DISABLED', 409, 'Booking is currently disabled');
    }
    if (
      input.durationMinutes < config.minDurationMinutes ||
      input.durationMinutes > config.maxDurationMinutes
    ) {
      throw new AppError(
        'BOOKING_DURATION_OUT_OF_RANGE',
        400,
        `Duration must be between ${config.minDurationMinutes} and ${config.maxDurationMinutes} minutes`
      );
    }

    const today = todayInAppTimezone();
    const maxDate = addDaysToDateString(today, config.advanceWindowDays);
    if (input.bookingDate < today || input.bookingDate > maxDate) {
      throw new AppError('BOOKING_OUTSIDE_ADVANCE_WINDOW', 400, 'Booking date is outside the allowed window');
    }

    const court = await courtRepository.findCourtWithFacility(input.courtId);
    if (!court) {
      throw new NotFoundError('Court not found', 'COURT_NOT_FOUND');
    }
    this.assertBookable(court.courtStatus, court.courtDeletedAt, court.facilityStatus, court.facilityDeletedAt);

    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = startMinutes + input.durationMinutes;
    if (endMinutes > timeToMinutes(court.closingTime) || startMinutes < timeToMinutes(court.openingTime)) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is outside opening hours');
    }
    const endTime = minutesToTime(endMinutes);

    if (isStartTimePast(input.bookingDate, input.startTime)) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested start time is in the past');
    }

    const pricing = computeWindowPricing(
      toPricingIntervals(await courtRepository.findPricingsForDate(input.courtId, input.bookingDate)),
      input.startTime,
      endTime
    );
    if (!pricing) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is not covered by pricing');
    }

    const expiresAt = new Date(Date.now() + config.paymentTimeoutMinutes * 60 * 1000);
    const durationHours = input.durationMinutes / 60;
    const unitPrice = pricing.segments.length === 1
      ? pricing.segments[0].price
      : Math.round((pricing.totalAmount / durationHours) * 100) / 100;

    const bookingId = await this.persistBooking({
      playerId,
      courtId: input.courtId,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime,
      durationMinutes: input.durationMinutes,
      totalAmount: pricing.totalAmount,
      unitPrice,
      expiresAt,
      segments: pricing.segments,
      activeLimitMode: config.activeLimitMode,
      maxActivePerPlayer: config.maxActivePerPlayer,
    });

    return this.getBookingDetail(playerId, bookingId);
  }

  async listMyBookings(playerId: number, input: MyBookingsInput) {
    const { items, total } = await bookingRepository.findBookingsForPlayer(playerId, {
      status: input.status,
      timeScope: input.timeScope,
      page: input.page,
      limit: input.limit,
    });

    const now = new Date();
    return {
      items: items.map((row) => this.toBookingSummary(row as BookingJoinedRow, now)),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: input.limit > 0 ? Math.ceil(total / input.limit) : 0,
      },
    };
  }

  async getBookingDetail(playerId: number, bookingId: number): Promise<BookingDetailDTO> {
    const result = await bookingRepository.findBookingById(bookingId);
    if (!result) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    if (result.booking.playerId !== playerId) {
      throw new ForbiddenError('You are not the owner of this booking', 'BOOKING_FORBIDDEN_OWNER');
    }
    if (await bookingRepository.findTournamentContextByBookingId(result.booking.id)) {
      // Tournament system reservations are read through the Organizer/Tournament surface.
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    const now = new Date();
    const bookingRow: BookingJoinedRow = {
      ...(result.booking as BookingJoinedRow),
      paymentStatus: result.payment?.status ?? null,
    };
    const summary = this.toBookingSummary(bookingRow, now);
    return {
      ...summary,
      pricingDetails: result.pricing.map(
        (detail: { startTime: string; endTime: string; price: string; amount: string }) => ({
          startTime: detail.startTime,
          endTime: detail.endTime,
          price: Number(detail.price),
          amount: Number(detail.amount),
        })
      ),
      payment: result.payment
        ? {
            id: result.payment.id,
            status: result.payment.status,
            amount: Number(result.payment.amount),
            paidAt: result.payment.paidAt,
          }
        : null,
    };
  }

  async cancelBooking(playerId: number, bookingId: number) {
    const result = await this.runCancellation(bookingId, {
      mode: 'PLAYER',
      actorId: playerId,
      reason: 'Player cancellation',
      cancelLinkedMatch: true,
    });

    // Publish only after the transaction commits so a failed commit never emits.
    if (result.cancelled) {
      bookingEvents.publish({ type: 'BookingCancelled', bookingId: result.id });
    }
    return { id: result.id, status: result.status, refundStatus: result.refundStatus };
  }

  /** CO-05: Owner cancellation of an eligible booking on an owned court. */
  async cancelBookingAsOwner(ownerId: number, bookingId: number, reason: string) {
    return this.runCancellation(bookingId, {
      mode: 'OWNER',
      actorId: ownerId,
      reason,
      cancelLinkedMatch: true,
    });
  }

  /**
   * MM-20 internal cancellation used by the booking-cancellation worker when a
   * linked Match was cancelled. It applies the same policy as Owner cancellation
   * but is authorized by the linked Match, never by participant impersonation.
   */
  async cancelBookingForMatch(bookingId: number, reason: string) {
    return this.runCancellation(bookingId, {
      mode: 'SYSTEM',
      actorId: 0,
      reason,
      cancelLinkedMatch: false,
    });
  }

  private async runCancellation(
    bookingId: number,
    options: {
      mode: 'PLAYER' | 'OWNER' | 'SYSTEM';
      actorId: number;
      reason: string;
      cancelLinkedMatch: boolean;
    },
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await db.transaction((tx) => this.cancelBookingTransaction(bookingId, options, tx));
      } catch (error) {
        // The linked Match set changed while waiting. Nothing was written; retry
        // with a fresh snapshot so Match locks always precede Booking locks.
        if (error instanceof TransactionRetryError && attempt < 2) continue;
        throw error;
      }
    }
    throw new TransactionRetryError();
  }

  private async cancelBookingTransaction(
    bookingId: number,
    options: {
      mode: 'PLAYER' | 'OWNER' | 'SYSTEM';
      actorId: number;
      reason: string;
      cancelLinkedMatch: boolean;
    },
    tx: BookingTransaction,
  ) {
    // Matchmaking lock order (Tech Design §24.7.3):
    // users(10) → request(30) → Match(50) → Booking(80).
    // Snapshot the link without locks, then take every lock in that order. If a
    // link appears or changes while waiting, roll back and retry so a concurrent
    // link/cancel can never deadlock.
    const matchBefore = await bookingRepository.findMatchByBookingId(bookingId, tx);
    // The Booking owner's USERS row is locked first even without a linked Match:
    // the cancellation notification inserts a FK reference to it, and confirmation
    // takes USERS before BOOKING. Locking it after the Booking would deadlock.
    const bookingOwnerId = await bookingRepository.findBookingOwner(bookingId, tx);
    const facilityOwnerId = await bookingRepository.findBookingFacilityOwner(bookingId, tx);
    const linkedRecruitment = await this.lockLinkedMatchContext(
      tx,
      matchBefore && !matchBefore.isTournament ? matchBefore.id : null,
      [bookingOwnerId, facilityOwnerId].filter((id): id is number => id !== null),
    );
    if (matchBefore && !matchBefore.isTournament) {
      await matchModule.lockMatch(matchBefore.id, tx);
    }
    const row = await bookingRepository.lockBookingById(bookingId, tx);
    if (!row) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    const matchAfter = await bookingRepository.findMatchByBookingId(bookingId, tx);
    if ((matchAfter?.id ?? null) !== (matchBefore?.id ?? null)) {
      throw new TransactionRetryError();
    }

    await this.assertCancellationActor(options, row, bookingId, tx);

    if (row.status === 'CANCELLED') {
      const existing = await bookingRepository.findBookingById(bookingId, tx);
      return {
        id: bookingId,
        status: 'CANCELLED',
        refundStatus: refundStatusFrom('CANCELLED', existing?.payment?.status),
        cancelled: false,
      };
    }
    await this.assertCancellableBooking(row, options, bookingId, tx);

    const startInstant = dateTimeToInstant(row.bookingDate, row.startTime);
    await this.assertCancellationDeadline(options, startInstant);

    const wasPaid = row.status === 'CONFIRMED';
    await bookingRepository.updateBookingStatus(bookingId, 'CANCELLED', tx, {
      cancellationReason: options.reason,
      cancelledAt: new Date(),
    });
    if (wasPaid) {
      await refundService.createBookingRefundIntent(bookingId, options.reason, tx);
    }

    await this.notifyBooking(tx, row, 'BOOKING_CANCELLED', 'Lịch đặt sân đã bị hủy', this.cancellationContent(options.mode, options.reason));

    await this.notifyPlayerCancellationOwner(options, facilityOwnerId, row, tx);

    if (options.cancelLinkedMatch && matchAfter && !matchAfter.isTournament) {
      await this.cancelLinkedMatchInTransaction(
        tx,
        matchAfter.id,
        bookingId,
        linkedRecruitment,
      );
    }

    return {
      id: bookingId,
      status: 'CANCELLED',
      refundStatus: wasPaid ? 'PENDING' : 'NONE',
      cancelled: true,
    };
  }

  private async assertCancellationActor(
    options: { mode: "PLAYER" | "OWNER" | "SYSTEM"; actorId: number; reason: string; cancelLinkedMatch: boolean; },
    row: any,
    bookingId: number,
    tx: TransactionContext,
  ) {
    if (options.mode === 'PLAYER' && row.playerId !== options.actorId) {
      throw new ForbiddenError('You are not the owner of this booking', 'BOOKING_FORBIDDEN_OWNER');
    }
    if (options.mode === 'OWNER') {
      const ownerId = await bookingRepository.findBookingFacilityOwner(bookingId, tx);
      if (ownerId !== options.actorId) {
        throw new NotFoundError('Booking not found', 'OWNER_BOOKING_NOT_FOUND');
      }
    }
  }

  private async assertCancellableBooking(
    row: any,
    options: { mode: "PLAYER" | "OWNER" | "SYSTEM"; actorId: number; reason: string; cancelLinkedMatch: boolean; },
    bookingId: number,
    tx: TransactionContext,
  ) {
    if (row.status !== 'PENDING_PAYMENT' && row.status !== 'CONFIRMED') {
      throw new AppError(
        options.mode === 'OWNER' ? 'OWNER_BOOKING_NOT_CANCELLABLE' : 'BOOKING_NOT_CANCELLABLE',
        409,
        'Booking status does not allow cancellation'
      );
    }

    const tournament = await bookingRepository.findTournamentContextByBookingId(bookingId, tx);
    if (tournament) {
      throw new AppError(
        options.mode === 'OWNER' ? 'OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE' : 'BOOKING_NOT_CANCELLABLE',
        409,
        'Tournament system bookings are managed by the Organizer'
      );
    }
  }

  private async assertCancellationDeadline(options: { mode: "PLAYER" | "OWNER" | "SYSTEM"; actorId: number; reason: string; cancelLinkedMatch: boolean; }, startInstant: Date) {
    if (options.mode === 'PLAYER') {
      const config = await bookingConfig.get();
      if (!config.playerCanCancelBooking) {
        throw new AppError('BOOKING_CANCELLATION_DISABLED', 409, 'Player cancellation is disabled');
      }
      const deadline = startInstant.getTime() - config.playerCancellationDeadlineMinutes * 60 * 1000;
      if (Date.now() >= deadline) {
        throw new AppError('BOOKING_CANCELLATION_DEADLINE_PASSED', 409, 'Cancellation deadline has passed');
      }
    } else {
      const policy = await ownerConfig.get();
      if (!policy.canCancelBooking) {
        throw new AppError('OWNER_CANCELLATION_DISABLED', 409, 'Owner cancellation is disabled');
      }
      const deadline = startInstant.getTime() - policy.cancellationDeadlineMinutes * 60 * 1000;
      if (Date.now() >= deadline) {
        throw new AppError('OWNER_CANCELLATION_DEADLINE_PASSED', 409, 'Cancellation deadline has passed');
      }
    }
  }

  private async notifyPlayerCancellationOwner(
    options: { mode: "PLAYER" | "OWNER" | "SYSTEM"; actorId: number; reason: string; cancelLinkedMatch: boolean; },
    facilityOwnerId: number | null,
    row: any,
    tx: TransactionContext,
  ) {
    if (options.mode === 'PLAYER' && facilityOwnerId !== null) {
      const context = await bookingRepository.findBookingNotificationContext(row.id, tx);
      const reason = cleanNotificationReason(options.reason);
      if (context) {
        await notifyOwner(tx, context.ownerId, {
          type: 'OWNER_BOOKING_CANCELLED',
          title: 'Booking đã bị hủy',
          content: `Booking ${row.bookingCode} tại ${context.courtName} (${context.facilityName}) ngày ${row.bookingDate} ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)} đã bị người chơi hủy${reason ? ` (lý do: ${reason.replace(/[.\s]+$/, '')})` : ''}. Khung giờ đã được giải phóng.`,
          resource: { type: 'OWNER_BOOKING', id: row.id },
          dedupKey: `owner-booking-cancelled:${row.id}`,
        });
      }
    }
  }

  private async lockLinkedMatchContext(tx: TransactionContext, matchId: number | null, extraUserIds: number[] = []) {
    if (matchId === null) {
      await matchmakingRepository.lockUsersAscending(extraUserIds, tx);
      return null;
    }
    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId, tx);
    if (!link) {
      await matchmakingRepository.lockUsersAscending(extraUserIds, tx);
      return null;
    }
    const snapshot = await matchmakingRepository.findRequestById(link.requestId, tx);
    const membersBefore = await matchmakingRepository.findAcceptedInvitees(link.requestId, tx);
    const hostId = snapshot?.playerId ?? null;
    const userIds = [...new Set([
      ...(hostId ? [hostId] : []),
      ...membersBefore.map((member: { playerId: number }) => member.playerId),
      ...extraUserIds,
    ])].sort((a, b) => a - b);
    await matchmakingRepository.lockUsersAscending(userIds, tx);
    const request = await matchmakingRepository.lockRequestById(link.requestId, tx);
    if (!request) return null;
    const members = await matchmakingRepository.findAcceptedInvitees(link.requestId, tx);
    if (members.some((member: { playerId: number }) => !userIds.includes(member.playerId))) {
      throw new TransactionRetryError();
    }
    return {
      requestId: link.requestId,
      hostId: request.playerId,
      recipients: [...new Set([request.playerId, ...members.map((member: { playerId: number }) => member.playerId)])],
    };
  }

  private cancellationContent(mode: 'PLAYER' | 'OWNER' | 'SYSTEM', reason: string): string {
    if (mode === 'OWNER') return `Chủ sân đã hủy lịch đặt: ${reason}`;
    if (mode === 'SYSTEM') return `Lịch đặt sân đã bị hủy: ${reason}`;
    return 'Bạn đã hủy lịch đặt sân.';
  }

  private async notifyBooking(
    tx: TransactionContext,
    booking: { id: number; playerId: number },
    type: string,
    title: string,
    content: string,
  ): Promise<void> {
    await notificationService.notify(tx, [{
      recipientId: booking.playerId,
      type,
      title,
      content,
      resource: { type: 'BOOKING', id: booking.id },
      dedupKey: `booking:${booking.id}:${type}`,
    }]);
  }

  private async cancelLinkedMatchInTransaction(
    tx: TransactionContext,
    matchId: number,
    bookingId: number,
    recruitment: { requestId: number; recipients: number[] } | null,
  ): Promise<void> {
    const match = await matchModule.lockMatch(matchId, tx);
    if (!match) return;
    if (match.status !== 'CANCELLED') {
      await matchModule.transitionStatus({
        matchId,
        from: match.status as any,
        to: 'CANCELLED',
        cancellationReason: 'BOOKING_CANCELLED',
      }, tx);
      if (recruitment) {
        await matchmakingRepository.cancelRecruitment(recruitment.requestId, 'BOOKING_CANCELLED', tx);
        await matchmakingNotifications.bookingCancelled(tx, recruitment.requestId, recruitment.recipients);
      }
    }
    await matchmakingRepository.insertCancellationJob(matchId, bookingId, tx);
  }

  async getFacilityDetail(facilityId: number, date?: string): Promise<FacilityDetailDTO> {
    const pricingDate = date ?? todayInAppTimezone();
    const result = await courtRepository.findFacilityWithCourts(facilityId, pricingDate);
    if (!result) {
      throw new NotFoundError('Facility not found', 'FACILITY_NOT_FOUND');
    }
    const { facility, courts } = result;
    const standards = await courtStandardRepository.verifiedForCourts(courts.map(court => court.id));
    return {
      id: facility.id,
      name: facility.name,
      description: facility.description,
      phone: facility.phone,
      status: facility.status,
      address: facility.address,
      ward: facility.ward,
      district: facility.district,
      city: facility.city,
      openingTime: facility.openingTime,
      closingTime: facility.closingTime,
      courts: courts.map(court => ({ ...court, standards: standards.get(court.id) ?? [] })),
    };
  }

  async confirmBooking(input: { bookingId: number; paymentId: number }): Promise<BookingConfirmationResult> {
    const result = await db.transaction(async (tx) => {
      const [bookingPlayerId, facilityOwnerId] = await Promise.all([
        bookingRepository.findBookingOwner(input.bookingId, tx),
        bookingRepository.findBookingFacilityOwner(input.bookingId, tx),
      ]);
      await bookingRepository.lockUsersAscending(
        [bookingPlayerId, facilityOwnerId].filter((id): id is number => id !== null),
        tx,
      );
      return this.confirmBookingInTransaction(input, tx);
    });

    // Publish only after the transaction commits so a failed commit never emits.
    if (result.event) {
      bookingEvents.publish({ type: result.event, bookingId: result.bookingId });
    }
    return {
      bookingId: result.bookingId,
      status: result.status,
      refundSignal: result.refundSignal,
    };
  }

  // The caller owns the transaction and publishes the returned event after commit.
  async confirmBookingInTransaction(
    input: { bookingId: number; paymentId: number },
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) {
    const row = await bookingRepository.lockBookingById(input.bookingId, tx);
    if (!row) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    if (row.status === 'CONFIRMED' || row.status === 'IN_PROGRESS' || row.status === 'COMPLETED') {
      return { bookingId: row.id, status: row.status, refundSignal: false, event: null };
    }
    if (row.status === 'PENDING_PAYMENT') {
      // A null expires_at on a pending hold is treated as already released, so
      // a late/duplicate confirmation never reopens a slot (consistent with the
      // scheduler sweep, the stale-hold sweep and the active-interval reads).
      const expired = row.expiresAt === null || row.expiresAt.getTime() <= Date.now();
      const nextStatus = expired ? 'EXPIRED' : 'CONFIRMED';
      await bookingRepository.updateBookingStatus(row.id, nextStatus, tx);
      await this.notifyBooking(
        tx,
        row,
        expired ? 'BOOKING_EXPIRED' : 'BOOKING_CONFIRMED',
        expired ? 'Lịch đặt sân đã hết hạn' : 'Lịch đặt sân đã được xác nhận',
        expired
          ? 'Lịch giữ sân đã hết thời gian thanh toán và không còn hiệu lực.'
          : 'Thanh toán thành công. Lịch đặt sân của bạn đã được xác nhận.',
      );
      await this.notifyConfirmedBookingOwner(expired, row, tx);
      return {
        bookingId: row.id,
        status: nextStatus,
        refundSignal: expired,
        event: (expired ? 'BookingExpired' : 'BookingConfirmed') as BookingDomainEventType,
      };
    }
    // EXPIRED / CANCELLED: never reopen; a valid late payment must be refunded.
    return { bookingId: row.id, status: row.status, refundSignal: true, event: null };
  }

  private async notifyConfirmedBookingOwner(expired: boolean, row: any, tx: TransactionContext) {
    if (!expired) {
      const context = await bookingRepository.findBookingNotificationContext(row.id, tx);
      if (context) {
        await notifyOwner(tx, context.ownerId, {
          type: 'OWNER_BOOKING_CREATED',
          title: 'Có booking mới',
          content: `Booking ${row.bookingCode} tại ${context.courtName} (${context.facilityName}) ngày ${row.bookingDate} ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}, ${Number(row.totalAmount).toLocaleString('vi-VN')}đ đã được xác nhận.`,
          resource: { type: 'OWNER_BOOKING', id: row.id },
          dedupKey: `owner-booking-created:${row.id}`,
        });
      }
    }
  }

  /**
   * SYS-BK-01: tournament court reservation. Holds the slot exactly like a Player
   * booking but never creates a payment or refund. The caller links the returned
   * booking through `MATCHES.booking_id` (Owner Tech Design §7.7), which is also how
   * Owner/Player reads recognise a tournament system booking.
   */
  async createSystemBooking(input: CreateSystemBookingInput): Promise<SystemBookingResult> {
    if (input.source !== 'TOURNAMENT') {
      throw new AppError('SYSTEM_BOOKING_SOURCE_INVALID', 400, 'Only TOURNAMENT system bookings are supported');
    }
    const config = await bookingConfig.get();
    if (!config.bookingEnabled) {
      throw new AppError('BOOKING_DISABLED', 409, 'Booking is currently disabled');
    }

    const { endMinutes, startMinutes, durationMinutes } = this.validateTournamentBookingWindow(input);

    const context = await bookingRepository.findTournamentContextByTournamentMatchId(input.sourceId);
    if (!context) {
      throw new NotFoundError('Tournament match not found', 'TOURNAMENT_MATCH_NOT_FOUND');
    }
    // An existing link is decided inside the transaction: a CANCELLED (released)
    // booking is replaceable for rescheduling, an active one is not.

    const pricing = await this.resolveTournamentCourtPricing(input, endMinutes, startMinutes);

    try {
      const bookingId = await db.transaction(async (tx) => {
        const id = await this.persistBookingTransaction({
          playerId: input.actorId,
          courtId: input.courtId,
          bookingDate: input.date,
          startTime: input.startTime,
          endTime: minutesToTime(endMinutes),
          durationMinutes,
          totalAmount: pricing.totalAmount,
          unitPrice: 0,
          expiresAt: null,
          segments: pricing.segments,
          activeLimitMode: 'NONE',
          maxActivePerPlayer: 0,
          status: 'CONFIRMED',
        }, tx);
        const linked = await bookingRepository.linkSystemBookingToMatch(context.matchId, id, tx);
        if (!linked) {
          throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Tournament match already has a court booking');
        }
        return id;
      });
      return { bookingId };
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === 'BOOKING_DISABLED') throw error;
        if (['BOOKING_SLOT_UNAVAILABLE', 'COURT_NOT_BOOKABLE', 'BOOKING_INVALID_TIME_RANGE'].includes(error.code)) {
          throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Court/time is not available for the tournament match');
        }
        throw error;
      }
      if (isPostgresError(error, '23P01') || isPostgresError(error, '23505')) {
        throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Court/time is not available for the tournament match');
      }
      throw error;
    }
  }

  private validateTournamentBookingWindow(input: CreateSystemBookingInput) {
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);
    if (endMinutes <= startMinutes) {
      throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Requested time range is invalid');
    }
    const durationMinutes = endMinutes - startMinutes;
    if (isStartTimePast(input.date, input.startTime)) {
      throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Requested start time is in the past');
    }
    return { endMinutes, startMinutes, durationMinutes };
  }

  private async resolveTournamentCourtPricing(input: CreateSystemBookingInput, endMinutes: number, startMinutes: number) {
    const court = await courtRepository.findCourtWithFacility(input.courtId);
    if (!court) {
      throw new NotFoundError('Court not found', 'COURT_NOT_FOUND');
    }
    try {
      this.assertBookable(court.courtStatus, court.courtDeletedAt, court.facilityStatus, court.facilityDeletedAt);
    } catch {
      throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Court is not eligible for new bookings');
    }
    if (endMinutes > timeToMinutes(court.closingTime) || startMinutes < timeToMinutes(court.openingTime)) {
      throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Requested time is outside opening hours');
    }

    const pricing = computeWindowPricing(
      toPricingIntervals(await courtRepository.findPricingsForDate(input.courtId, input.date)),
      input.startTime,
      minutesToTime(endMinutes)
    );
    if (!pricing) {
      throw new AppError('TOURNAMENT_COURT_UNAVAILABLE', 409, 'Requested time is not covered by pricing');
    }
    return pricing;
  }

  /** Releases a tournament system booking. Idempotent; never creates a refund or payment. */
  async releaseSystemBooking(input: ReleaseSystemBookingInput): Promise<void> {
    await db.transaction(async (tx) => {
      const context = await bookingRepository.findTournamentContextByBookingId(input.bookingId, tx);
      if (!context) {
        throw new NotFoundError('Tournament system booking not found', 'TOURNAMENT_BOOKING_NOT_FOUND');
      }
      const row = await bookingRepository.lockBookingById(input.bookingId, tx);
      if (!row || row.status === 'CANCELLED') return;
      await bookingRepository.updateBookingStatus(row.id, 'CANCELLED', tx, {
        cancellationReason: input.reason,
        cancelledAt: new Date(),
      });
    });
  }

  async createMatchHold(input: MatchHoldInput): Promise<MatchHoldResult> {
    const config = await bookingConfig.get();
    if (!config.bookingEnabled) {
      throw new AppError('BOOKING_DISABLED', 409, 'Booking is currently disabled');
    }

    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);
    if (endMinutes <= startMinutes) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time range is invalid');
    }
    const durationMinutes = endMinutes - startMinutes;

    const today = todayInAppTimezone();
    const maxDate = addDaysToDateString(today, config.advanceWindowDays);
    if (input.bookingDate < today || input.bookingDate > maxDate) {
      throw new AppError('BOOKING_OUTSIDE_ADVANCE_WINDOW', 400, 'Booking date is outside the allowed window');
    }

    const court = await courtRepository.findCourtWithFacility(input.courtId);
    if (!court) {
      throw new NotFoundError('Court not found', 'COURT_NOT_FOUND');
    }
    this.assertBookable(court.courtStatus, court.courtDeletedAt, court.facilityStatus, court.facilityDeletedAt);

    if (endMinutes > timeToMinutes(court.closingTime) || startMinutes < timeToMinutes(court.openingTime)) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is outside opening hours');
    }
    const endTime = minutesToTime(endMinutes);
    if (isStartTimePast(input.bookingDate, input.startTime)) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested start time is in the past');
    }

    const pricing = computeWindowPricing(
      toPricingIntervals(await courtRepository.findPricingsForDate(input.courtId, input.bookingDate)),
      input.startTime,
      endTime
    );
    if (!pricing) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is not covered by pricing');
    }

    const expiresAt = new Date(Date.now() + config.paymentTimeoutMinutes * 60 * 1000);
    const durationHours = durationMinutes / 60;
    const unitPrice =
      pricing.segments.length === 1
        ? pricing.segments[0].price
        : Math.round((pricing.totalAmount / durationHours) * 100) / 100;

    const bookingId = await this.persistBooking({
      playerId: input.ownerPlayerId,
      courtId: input.courtId,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime,
      durationMinutes,
      totalAmount: pricing.totalAmount,
      unitPrice,
      expiresAt,
      segments: pricing.segments,
      activeLimitMode: 'NONE',
      maxActivePerPlayer: 0,
    });

    return { bookingId, expiresAt };
  }

  async releaseMatchHold(input: { bookingId: number; reason: string; notify?: boolean }): Promise<void> {
    const cancelled = await db.transaction(async (tx) => {
      // Cancellation notifies the Booking owner, whose notification row takes a FK
      // lock on USERS: lock it before the Booking to keep the USERS → BOOKING order.
      const ownerId = await bookingRepository.findBookingOwner(input.bookingId, tx);
      if (ownerId) await bookingRepository.lockPlayer(ownerId, tx);
      const row = await bookingRepository.lockBookingById(input.bookingId, tx);
      if (!row || row.status === 'CANCELLED') {
        return false;
      }
      if (row.status === 'PENDING_PAYMENT' || row.status === 'CONFIRMED') {
        const wasPaid = row.status === 'CONFIRMED';
        await bookingRepository.updateBookingStatus(row.id, 'CANCELLED', tx, {
          cancellationReason: input.reason,
          cancelledAt: new Date(),
        });
        if (wasPaid) {
          await refundService.createBookingRefundIntent(row.id, input.reason, tx);
        }
        if (input.notify !== false) {
          await this.notifyBooking(tx, row, 'BOOKING_CANCELLED', 'Lịch đặt sân đã bị hủy',
            `Lịch giữ sân cho kèo đã được giải phóng: ${input.reason}`);
        }
        return true;
      }
      throw new AppError('BOOKING_NOT_CANCELLABLE', 409, 'Booking status does not allow release');
    });

    if (cancelled) {
      logger.info('Match hold released', {
        bookingId: input.bookingId,
        reason: input.reason,
      });
      bookingEvents.publish({
        type: 'BookingCancelled',
        bookingId: input.bookingId,
        reason: input.reason,
      });
    }
  }

  private async persistBooking(data: PersistBookingInput): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await db.transaction(tx => this.persistBookingTransaction(data, tx));
      } catch (error) {
        if (isPostgresError(error, '23P01')) {
          throw new AppError('BOOKING_SLOT_UNAVAILABLE', 409, 'Requested slot is no longer available');
        }
        if (isPostgresError(error, '23505') && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
    throw new AppError('BOOKING_SLOT_UNAVAILABLE', 409, 'Could not create booking');
  }


  private async revalidateCourtAndPricing(data: PersistBookingInput, tx: BookingTransaction): Promise<void> {
    const facility = await courtOccupancyRepository.lockFacility(data.courtId, tx);
    await courtOccupancyRepository.lockDate(data.courtId, data.bookingDate, tx);
    const lockedCourt = await bookingRepository.lockCourt(data.courtId, tx);
    if (!facility || facility.status !== 'ACTIVE' || facility.deletedAt || !lockedCourt || lockedCourt.status !== 'ACTIVE' || lockedCourt.deletedAt) {
      throw new ConflictError('Court is not eligible for new bookings', 'COURT_NOT_BOOKABLE');
    }
    if (timeToMinutes(data.startTime) < timeToMinutes(facility.openingTime) || timeToMinutes(data.endTime) > timeToMinutes(facility.closingTime)) {
      throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is outside opening hours');
    }
    if (await courtOccupancyRepository.blocked(data.courtId, data.bookingDate, data.startTime, data.endTime, tx)) {
      throw new AppError('BOOKING_SLOT_UNAVAILABLE', 409, 'Requested slot is blocked for maintenance');
    }
    const currentPrice = computeWindowPricing(toPricingIntervals(await courtRepository.findPricingsForDate(data.courtId, data.bookingDate, tx)), data.startTime, data.endTime);
    if (!currentPrice) throw new AppError('BOOKING_INVALID_TIME_RANGE', 400, 'Requested time is not covered by pricing');
    data.segments = currentPrice.segments;
    data.totalAmount = currentPrice.totalAmount;
    data.unitPrice = currentPrice.segments.length === 1 ? currentPrice.segments[0].price : Math.round(currentPrice.totalAmount / (data.durationMinutes / 60) * 100) / 100;
  }

  private async persistBookingTransaction(data: PersistBookingInput, tx: BookingTransaction): Promise<number> {
    await this.revalidateCourtAndPricing(data, tx);

    // Release elapsed holds for this court/date in the same transaction so
    // they no longer block the slot via the partial exclusion constraint,
    // which cannot itself reference the non-immutable now().
    const staleHolds = await bookingRepository.findStaleHoldsForCourt(data.courtId, data.bookingDate, tx);
    // Lock every affected USERS row in one ascending pass: expiry notifications and
    // the active-limit check both need it, and locking the requester separately
    // after the stale-hold owners would invert the order and risk a deadlock.
    const lockUserIds = staleHolds.map((row: { playerId: number }) => row.playerId);
    if (data.activeLimitMode === 'LIMITED') lockUserIds.push(data.playerId);
    if (lockUserIds.length > 0) {
      await bookingRepository.lockUsersAscending(lockUserIds, tx);
    }
    const expiredHolds = await bookingRepository.expireBookingsByIds(staleHolds.map((row: { id: number }) => row.id), tx);
    if (expiredHolds.length > 0) {
      await notificationService.notify(tx, expiredHolds.map((row: { id: number; playerId: number }) => ({
        recipientId: row.playerId,
        type: 'BOOKING_EXPIRED',
        title: 'Lịch đặt sân đã hết hạn',
        content: 'Lịch giữ sân đã hết thời gian thanh toán và không còn hiệu lực.',
        resource: { type: 'BOOKING', id: row.id },
        dedupKey: `booking:${row.id}:BOOKING_EXPIRED`,
      })));
    }

    if (data.activeLimitMode === 'LIMITED') {
      const activeCount = await bookingRepository.countActiveForPlayer(data.playerId, tx);
      if (activeCount >= data.maxActivePerPlayer) {
        throw new AppError('BOOKING_ACTIVE_LIMIT_REACHED', 409, 'Active booking limit reached');
      }
    }

    const occupied = await bookingRepository.findActiveIntervals(
      data.courtId,
      data.bookingDate,
      new Date(),
      tx
    );
    const hasOverlap = (occupied as { startTime: string; endTime: string }[]).some((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      return timeToMinutes(data.startTime) < slotEnd && slotStart < timeToMinutes(data.endTime);
    });
    if (hasOverlap) {
      throw new AppError('BOOKING_SLOT_UNAVAILABLE', 409, 'Requested slot is no longer available');
    }

    return this.insertBookingSnapshot(data, tx);
  }

  private async insertBookingSnapshot(data: PersistBookingInput, tx: BookingTransaction): Promise<number> {
    const bookingCode = generateBookingCode(new Date());
    const booking = await bookingRepository.insertBooking(
      {
        playerId: data.playerId,
        courtId: data.courtId,
        bookingCode,
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        unitPrice: data.unitPrice.toFixed(2),
        totalAmount: data.totalAmount.toFixed(2),
        expiresAt: data.expiresAt,
        status: data.status,
      },
      tx
    );

    await bookingRepository.insertPricingDetails(
      data.segments.map((segment) => ({
        bookingId: booking.id,
        courtPricingId: segment.courtPricingId ?? 0,
        startTime: segment.startTime,
        endTime: segment.endTime,
        price: segment.price.toFixed(2),
        amount: segment.amount.toFixed(2),
      })),
      tx
    );

    return booking.id;
  }

  private assertBookable(
    courtStatus: string,
    courtDeletedAt: Date | null,
    facilityStatus: string,
    facilityDeletedAt: Date | null
  ): void {
    const bookable =
      courtStatus === 'ACTIVE' &&
      courtDeletedAt === null &&
      facilityStatus === 'ACTIVE' &&
      facilityDeletedAt === null;
    if (!bookable) {
      throw new ConflictError('Court is not eligible for new bookings', 'COURT_NOT_BOOKABLE');
    }
  }

  private toBookingSummary(row: BookingJoinedRow, now: Date): BookingSummaryDTO {
    const status = effectiveStatus(row, now);
    return {
      id: row.id,
      bookingCode: row.bookingCode,
      status,
      bookingDate: row.bookingDate,
      startTime: row.startTime,
      endTime: row.endTime,
      durationMinutes: durationMinutesBetween(row.startTime, row.endTime),
      unitPrice: Number(row.unitPrice),
      totalAmount: Number(row.totalAmount),
      expiresAt: row.expiresAt,
      refundStatus: refundStatusFrom(status, row.paymentStatus),
      court: { id: row.courtId, name: row.courtName },
      facility: {
        id: row.facilityId,
        name: row.facilityName,
        address: row.facilityAddress,
        ward: row.facilityWard,
        district: row.facilityDistrict,
        city: row.facilityCity,
      },
      createdAt: row.createdAt,
    };
  }

  private async filterCourtsByWindow(
    rows: CourtSummary[],
    date: string,
    startTime: string,
    endTime: string
  ): Promise<CourtSummaryDTO[]> {
    const courtIds = rows.map((row) => row.courtId);
    const [pricingRows, occupiedRows, blockedRows] = await Promise.all([
      courtRepository.findPricingsForCourts(courtIds, date),
      bookingRepository.findActiveIntervalsForCourts(courtIds, date),
      courtOccupancyRepository.activeBlocks(courtIds, date),
    ]);

    const pricingsByCourt = new Map<number, { id: number; startTime: string; endTime: string; price: string }[]>();
    for (const pricing of pricingRows) {
      const list = pricingsByCourt.get(pricing.courtId) ?? [];
      list.push(pricing);
      pricingsByCourt.set(pricing.courtId, list);
    }

    const occupiedByCourt = new Map<number, { startTime: string; endTime: string }[]>();
    for (const slot of [...occupiedRows, ...blockedRows]) {
      const list = occupiedByCourt.get(slot.courtId) ?? [];
      list.push(slot);
      occupiedByCourt.set(slot.courtId, list);
    }

    const notBeforeMinutes = notBeforeMinutesForDate(date);
    const matching: CourtSummaryDTO[] = [];
    for (const row of rows) {
      const intervals = computeFreeIntervals({
        openingTime: row.openingTime,
        closingTime: row.closingTime,
        pricings: toPricingIntervals(pricingsByCourt.get(row.courtId) ?? []),
        occupied: occupiedByCourt.get(row.courtId) ?? [],
        notBeforeMinutes,
      });
      if (!intervalCovers(intervals, startTime, endTime)) {
        continue;
      }
      matching.push(toSummaryDTO(row, true));
    }
    return matching;
  }
}

export const bookingService = new BookingService();

export const matchBookingPort: MatchBookingPort = {
  createMatchHold: (input) => bookingService.createMatchHold(input),
  releaseMatchHold: (input) => bookingService.releaseMatchHold(input),
};
