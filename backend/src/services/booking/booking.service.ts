import { db } from '../../db';
import { courtRepository, CourtSummary } from '../../repositories/facility/CourtRepository';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { bookingConfig } from '../../shared/config/booking-config';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import {
  computeFreeIntervals,
  computeWindowPricing,
  dateTimeToInstant,
  intervalCovers,
  addDaysToDateString,
  minutesToTime,
  notBeforeMinutesForDate,
  timeToMinutes,
  todayInAppTimezone,
  type FreeInterval,
} from './availability.service';

export interface CourtSearchInput {
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
    ward: string;
    district: string;
    city: string;
    phone: string;
    openingTime: string;
    closingTime: string;
  };
}

export interface CourtAvailabilityDTO {
  date: string;
  durationMinutes: number | null;
  court: { id: number; name: string; description: string | null; status: string };
  facility: {
    id: number;
    name: string;
    address: string;
    ward: string;
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
  facility: { id: number; name: string; address: string; ward: string; district: string; city: string };
  createdAt: Date;
}

export interface BookingDetailDTO extends BookingSummaryDTO {
  pricingDetails: BookingPricingSegmentDTO[];
  payment: { id: number; status: string; amount: number; paidAt: Date | null } | null;
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
  facilityWard: string;
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

export class BookingService {
  async searchCourts(input: CourtSearchInput) {
    const pricingDate = input.date ?? todayInAppTimezone();
    const rows = await courtRepository.findAllBookableCourts({
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

    const total = matching.length;
    const offset = (input.page - 1) * input.limit;
    return {
      items: matching.slice(offset, offset + input.limit),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: input.limit > 0 ? Math.ceil(total / input.limit) : 0,
      },
    };
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

    const [pricingRows, occupied] = await Promise.all([
      courtRepository.findPricingsForDate(courtId, date),
      bookingRepository.findActiveIntervals(courtId, date),
    ]);

    const intervals = computeFreeIntervals({
      openingTime: court.openingTime,
      closingTime: court.closingTime,
      pricings: toPricingIntervals(pricingRows),
      occupied,
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

    if (dateTimeToInstant(input.bookingDate, input.startTime).getTime() <= Date.now()) {
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
    const config = await bookingConfig.get();

    return db.transaction(async (tx) => {
      const row = await bookingRepository.lockBookingById(bookingId, tx);
      if (!row) {
        throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      }
      if (row.playerId !== playerId) {
        throw new ForbiddenError('You are not the owner of this booking', 'BOOKING_FORBIDDEN_OWNER');
      }
      if (row.status === 'CANCELLED') {
        const existing = await bookingRepository.findBookingById(bookingId, tx);
        return {
          id: bookingId,
          status: 'CANCELLED',
          refundStatus: refundStatusFrom('CANCELLED', existing?.payment?.status),
        };
      }
      if (!ACTIVE_STATUSES.includes(row.status)) {
        throw new AppError('BOOKING_NOT_CANCELLABLE', 409, 'Booking status does not allow cancellation');
      }
      if (!config.playerCanCancelBooking) {
        throw new AppError('BOOKING_CANCELLATION_DISABLED', 409, 'Player cancellation is disabled');
      }

      const startInstant = dateTimeToInstant(row.bookingDate, row.startTime);
      const deadline = startInstant.getTime() - config.playerCancellationDeadlineMinutes * 60 * 1000;
      if (Date.now() >= deadline) {
        throw new AppError('BOOKING_CANCELLATION_DEADLINE_PASSED', 409, 'Cancellation deadline has passed');
      }

      const wasPaid = row.status === 'CONFIRMED';
      await bookingRepository.updateBookingStatus(bookingId, 'CANCELLED', tx);
      return {
        id: bookingId,
        status: 'CANCELLED',
        refundStatus: wasPaid ? 'PENDING' : 'NONE',
      };
    });
  }

  private async persistBooking(data: {
    playerId: number;
    courtId: number;
    bookingDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    totalAmount: number;
    unitPrice: number;
    expiresAt: Date;
    segments: { courtPricingId: number | null; startTime: string; endTime: string; price: number; amount: number }[];
    activeLimitMode: string;
    maxActivePerPlayer: number;
  }): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await db.transaction(async (tx) => {
          const lockedCourt = await bookingRepository.lockCourt(data.courtId, tx);
          if (!lockedCourt) {
            throw new ConflictError('Court is not eligible for new bookings', 'COURT_NOT_BOOKABLE');
          }

          // Release elapsed holds for this court/date in the same transaction so
          // they no longer block the slot via the partial exclusion constraint,
          // which cannot itself reference the non-immutable now().
          await bookingRepository.expireStaleHoldsForCourt(data.courtId, data.bookingDate, tx);

          if (data.activeLimitMode === 'LIMITED') {
            await bookingRepository.lockPlayer(data.playerId, tx);
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
        });
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
    const [pricingRows, occupiedRows] = await Promise.all([
      courtRepository.findPricingsForCourts(courtIds, date),
      bookingRepository.findActiveIntervalsForCourts(courtIds, date),
    ]);

    const pricingsByCourt = new Map<number, { id: number; startTime: string; endTime: string; price: string }[]>();
    for (const pricing of pricingRows) {
      const list = pricingsByCourt.get(pricing.courtId) ?? [];
      list.push(pricing);
      pricingsByCourt.set(pricing.courtId, list);
    }

    const occupiedByCourt = new Map<number, { startTime: string; endTime: string }[]>();
    for (const slot of occupiedRows) {
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
