import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import {
  db,
  users,
  facilities,
  courts,
  courtPricings,
  bookings,
  bookingPricingDetails,
} from '../db';
import { createTestUser } from './test-helpers';
import { bookingService, matchBookingPort } from '../services/booking/booking.service';
import { bookingEvents, type BookingDomainEvent } from '../services/booking/booking-events';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { eq } from 'drizzle-orm';

const TODAY = todayInAppTimezone();
const BOOKING_DATE = addDaysToDateString(TODAY, 1);

describe('Booking confirmation, match holds and facility detail', () => {
  let facilityId: number;
  let courtIds: number[];
  let playerId: number;
  let ownerId: number;

  async function insertBooking(
    courtIndex: number,
    status: string,
    startTime: string,
    endTime: string,
    expiresAt: Date | null = null
  ): Promise<number> {
    const [row] = await db
      .insert(bookings)
      .values({
        playerId,
        courtId: courtIds[courtIndex],
        bookingCode: `BK-CONF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bookingDate: BOOKING_DATE,
        startTime,
        endTime,
        unitPrice: '80000',
        totalAmount: '80000',
        status,
        expiresAt,
      })
      .returning({ id: bookings.id });
    return row.id;
  }

  async function statusOf(bookingId: number): Promise<string> {
    const rows = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId));
    return rows[0].status;
  }

  beforeEach(async () => {
    await db.delete(bookingPricingDetails);
    await db.delete(bookings);
    await db.delete(courtPricings);
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(users);

    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const player = await createTestUser({ role: 'PLAYER' });
    playerId = player.id;
    ownerId = owner.id;

    const [facility] = await db
      .insert(facilities)
      .values({
        ownerId: owner.id,
        name: 'CLB Confirm Test',
        phone: '0908123456',
        status: 'ACTIVE',
        address: '1 Test',
        ward: 'W',
        district: 'Quận 7',
        city: 'Hồ Chí Minh',
        latitude: '10.7',
        longitude: '106.7',
        openingTime: '06:00:00',
        closingTime: '22:00:00',
      })
      .returning();
    facilityId = facility.id;

    courtIds = [];
    for (let i = 0; i < 6; i += 1) {
      const [court] = await db
        .insert(courts)
        .values({ facilityId: facility.id, name: `Sân ${i + 1}`, status: 'ACTIVE' })
        .returning();
      courtIds.push(court.id);
      await db.insert(courtPricings).values([
        { courtId: court.id, startTime: '06:00:00', endTime: '17:00:00', price: '80000', validFrom: '2025-01-01' },
        { courtId: court.id, startTime: '17:00:00', endTime: '22:00:00', price: '120000', validFrom: '2025-01-01' },
      ]);
    }
  });

  describe('confirmBooking', () => {
    it('confirms a live pending hold and emits BookingConfirmed', async () => {
      const bookingId = await insertBooking(0, 'PENDING_PAYMENT', '10:00:00', '11:00:00', new Date(Date.now() + 600_000));
      const events: BookingDomainEvent[] = [];
      const unsubscribe = bookingEvents.subscribe((event) => events.push(event));

      const result = await bookingService.confirmBooking({ bookingId, paymentId: 1 });
      unsubscribe();

      expect(result).toEqual({ bookingId, status: 'CONFIRMED', refundSignal: false });
      expect(await statusOf(bookingId)).toBe('CONFIRMED');
      expect(events.map((e) => e.type)).toContain('BookingConfirmed');
    });

    it('expires an overdue hold and signals refund', async () => {
      const bookingId = await insertBooking(0, 'PENDING_PAYMENT', '10:00:00', '11:00:00', new Date(Date.now() - 60_000));
      const result = await bookingService.confirmBooking({ bookingId, paymentId: 1 });

      expect(result.status).toBe('EXPIRED');
      expect(result.refundSignal).toBe(true);
      expect(await statusOf(bookingId)).toBe('EXPIRED');
    });

    it('is a no-op for an already confirmed booking', async () => {
      const bookingId = await insertBooking(0, 'CONFIRMED', '10:00:00', '11:00:00');
      const result = await bookingService.confirmBooking({ bookingId, paymentId: 1 });

      expect(result.status).toBe('CONFIRMED');
      expect(result.refundSignal).toBe(false);
    });

    it('never reopens an expired or cancelled booking', async () => {
      const expiredId = await insertBooking(0, 'EXPIRED', '10:00:00', '11:00:00');
      const cancelledId = await insertBooking(1, 'CANCELLED', '10:00:00', '11:00:00');

      const expiredResult = await bookingService.confirmBooking({ bookingId: expiredId, paymentId: 1 });
      const cancelledResult = await bookingService.confirmBooking({ bookingId: cancelledId, paymentId: 2 });

      expect(expiredResult).toMatchObject({ status: 'EXPIRED', refundSignal: true });
      expect(cancelledResult).toMatchObject({ status: 'CANCELLED', refundSignal: true });
      expect(await statusOf(expiredId)).toBe('EXPIRED');
      expect(await statusOf(cancelledId)).toBe('CANCELLED');
    });

    it('treats a pending hold with null expires_at as expired', async () => {
      const bookingId = await insertBooking(2, 'PENDING_PAYMENT', '10:00:00', '11:00:00', null);
      const result = await bookingService.confirmBooking({ bookingId, paymentId: 1 });

      expect(result).toEqual({ bookingId, status: 'EXPIRED', refundSignal: true });
      expect(await statusOf(bookingId)).toBe('EXPIRED');
    });

    it('isolates a throwing listener and still delivers to other listeners', async () => {
      const bookingId = await insertBooking(2, 'PENDING_PAYMENT', '10:00:00', '11:00:00', new Date(Date.now() + 600_000));
      const received: BookingDomainEvent[] = [];
      const unsubscribeBad = bookingEvents.subscribe(() => {
        throw new Error('boom');
      });
      const unsubscribeGood = bookingEvents.subscribe((event) => received.push(event));

      const result = await bookingService.confirmBooking({ bookingId, paymentId: 1 });
      unsubscribeBad();
      unsubscribeGood();

      expect(result.status).toBe('CONFIRMED');
      expect(await statusOf(bookingId)).toBe('CONFIRMED');
      expect(received.some((event) => event.type === 'BookingConfirmed')).toBe(true);
    });
  });

  describe('MatchBookingPort', () => {
    it('creates a system hold and releases it idempotently', async () => {
      const events: BookingDomainEvent[] = [];
      const unsubscribe = bookingEvents.subscribe((event) => events.push(event));

      const hold = await matchBookingPort.createMatchHold({
        ownerPlayerId: playerId,
        courtId: courtIds[2],
        bookingDate: BOOKING_DATE,
        startTime: '10:00',
        endTime: '11:30',
      });
      expect(await statusOf(hold.bookingId)).toBe('PENDING_PAYMENT');

      await matchBookingPort.releaseMatchHold({ bookingId: hold.bookingId, reason: 'match cancelled' });
      await matchBookingPort.releaseMatchHold({ bookingId: hold.bookingId, reason: 'match cancelled' });
      unsubscribe();

      expect(await statusOf(hold.bookingId)).toBe('CANCELLED');
      expect(events.filter((e) => e.type === 'BookingCancelled')).toHaveLength(1);
    });

    it('rejects a match hold that overlaps an existing active booking', async () => {
      await insertBooking(3, 'CONFIRMED', '10:00:00', '11:00:00');

      await expect(
        matchBookingPort.createMatchHold({
          ownerPlayerId: playerId,
          courtId: courtIds[3],
          bookingDate: BOOKING_DATE,
          startTime: '10:30',
          endTime: '11:30',
        })
      ).rejects.toMatchObject({ code: 'BOOKING_SLOT_UNAVAILABLE' });
    });

    it('carries the release reason on the cancelled event', async () => {
      const hold = await matchBookingPort.createMatchHold({
        ownerPlayerId: playerId,
        courtId: courtIds[4],
        bookingDate: BOOKING_DATE,
        startTime: '10:00',
        endTime: '11:00',
      });
      const received: BookingDomainEvent[] = [];
      const unsubscribe = bookingEvents.subscribe((event) => received.push(event));

      await matchBookingPort.releaseMatchHold({ bookingId: hold.bookingId, reason: 'match abandoned' });
      unsubscribe();

      const cancelled = received.find((event) => event.type === 'BookingCancelled');
      expect(cancelled?.reason).toBe('match abandoned');
    });
  });

  describe('GET /api/v1/facilities/:id', () => {
    it('returns a facility with its bookable courts', async () => {
      const res = await request(app).get(`/api/v1/facilities/${facilityId}`).query({ date: BOOKING_DATE });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(facilityId);
      expect(res.body.data.courts).toHaveLength(6);
      expect(res.body.data.courts[0].priceFrom).toBe(80000);
    });

    it('returns 404 for an unknown facility', async () => {
      const res = await request(app).get('/api/v1/facilities/999999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FACILITY_NOT_FOUND');
    });

    it('returns 404 for a suspended facility', async () => {
      const [suspended] = await db
        .insert(facilities)
        .values({
          ownerId,
          name: 'CLB Suspended',
          phone: '0900000000',
          status: 'SUSPENDED',
          address: '1 Suspended',
          ward: 'W',
          district: 'Quận 7',
          city: 'Hồ Chí Minh',
          latitude: '10.7',
          longitude: '106.7',
          openingTime: '06:00:00',
          closingTime: '22:00:00',
        })
        .returning();

      const res = await request(app).get(`/api/v1/facilities/${suspended.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FACILITY_NOT_FOUND');
    });

    it('excludes non-active courts from the facility detail', async () => {
      await db.update(courts).set({ status: 'SUSPENDED' }).where(eq(courts.id, courtIds[5]));

      const res = await request(app).get(`/api/v1/facilities/${facilityId}`).query({ date: BOOKING_DATE });
      expect(res.status).toBe(200);
      expect(res.body.data.courts).toHaveLength(5);
    });
  });
});
