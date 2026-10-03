import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import {
  db,
  users,
  courtOwnerProfiles,
  facilities,
  courts,
  courtPricings,
  bookings,
} from '../db';
import { hashPassword } from '../utils/password';
import {
  computeFreeIntervals,
  todayInAppTimezone,
  addDaysToDateString,
} from '../services/booking/availability.service';

const TEST_DATE = addDaysToDateString(todayInAppTimezone(), 1);

describe('Blocking availability computation', () => {
  it('subtracts an occupied interval and keeps boundary-touching free time', () => {
    const intervals = computeFreeIntervals({
      openingTime: '06:00:00',
      closingTime: '22:00:00',
      pricings: [
        { startTime: '06:00:00', endTime: '16:00:00', price: 90000 },
        { startTime: '16:00:00', endTime: '21:00:00', price: 140000 },
        { startTime: '21:00:00', endTime: '22:00:00', price: 110000 },
      ],
      occupied: [{ startTime: '18:00:00', endTime: '19:00:00' }],
    });

    const windows = intervals.map((i) => `${i.startTime}-${i.endTime}`);
    expect(windows).toContain('06:00-18:00');
    expect(windows).toContain('19:00-22:00');
    expect(windows).not.toContain('18:00-19:00');

    const merged = intervals.find((i) => i.startTime === '06:00');
    expect(merged?.segments.map((s) => s.price)).toEqual([90000, 140000]);
  });

  it('prices a requested duration across multiple pricing segments', () => {
    const [interval] = computeFreeIntervals({
      openingTime: '06:00:00',
      closingTime: '22:00:00',
      pricings: [
        { startTime: '16:00:00', endTime: '17:00:00', price: 100000 },
        { startTime: '17:00:00', endTime: '18:00:00', price: 200000 },
      ],
      occupied: [],
      durationMinutes: 90,
    });

    expect(interval.startTime).toBe('16:00');
    expect(interval.estimatedPrice).toBe(100000 + 200000 * 0.5);
  });

  it('excludes gaps not covered by pricing', () => {
    const intervals = computeFreeIntervals({
      openingTime: '06:00:00',
      closingTime: '22:00:00',
      pricings: [{ startTime: '08:00:00', endTime: '10:00:00', price: 90000 }],
      occupied: [],
    });

    expect(intervals).toHaveLength(1);
    expect(intervals[0].startTime).toBe('08:00');
    expect(intervals[0].endTime).toBe('10:00');
  });
});

describe('Court search & availability API', () => {
  let courtId: number;
  let suspendedCourtId: number;
  let playerId: number;

  beforeEach(async () => {
    await db.delete(bookings);
    await db.delete(courtPricings);
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(courtOwnerProfiles);
    await db.delete(users);

    const [owner] = await db
      .insert(users)
      .values({
        email: 'booking-owner@badminton.com',
        passwordHash: await hashPassword('OwnerPass123!'),
        role: 'COURT_OWNER',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(courtOwnerProfiles).values({
      userId: owner.id,
      businessName: 'CLB Cầu Lông Phúc Thịnh',
      phone: '0908123456',
    });

    const [facility] = await db
      .insert(facilities)
      .values({
        ownerId: owner.id,
        name: 'CLB Cầu Lông Phúc Thịnh',
        phone: '0908123456',
        status: 'ACTIVE',
        address: '18D Huỳnh Tấn Phát',
        ward: 'Tân Thuận Đông',
        district: 'Quận 7',
        city: 'TP. Hồ Chí Minh',
        latitude: '10.7483',
        longitude: '106.7212',
        openingTime: '06:00:00',
        closingTime: '22:00:00',
      })
      .returning();

    const [court] = await db
      .insert(courts)
      .values({ facilityId: facility.id, name: 'Sân 03', status: 'ACTIVE' })
      .returning();
    courtId = court.id;

    const [suspendedCourt] = await db
      .insert(courts)
      .values({ facilityId: facility.id, name: 'Sân 04', status: 'SUSPENDED' })
      .returning();
    suspendedCourtId = suspendedCourt.id;

    await db.insert(courtPricings).values([
      { courtId, startTime: '06:00:00', endTime: '16:00:00', price: '90000', validFrom: '2020-01-01' },
      { courtId, startTime: '16:00:00', endTime: '21:00:00', price: '140000', validFrom: '2020-01-01' },
      { courtId, startTime: '21:00:00', endTime: '22:00:00', price: '110000', validFrom: '2020-01-01' },
    ]);

    const [player] = await db
      .insert(users)
      .values({
        email: 'booking-player@badminton.com',
        passwordHash: await hashPassword('PlayerPass123!'),
        role: 'PLAYER',
        status: 'ACTIVE',
      })
      .returning();
    playerId = player.id;

    await db.insert(bookings).values({
      playerId: player.id,
      courtId,
      bookingCode: 'BK-20260101-TEST',
      bookingDate: TEST_DATE,
      startTime: '18:00:00',
      endTime: '19:00:00',
      unitPrice: '140000',
      totalAmount: '140000',
      status: 'CONFIRMED',
    });
  });

  it('returns bookable courts with price-from and pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/courts')
      .query({ city: 'Hồ Chí Minh' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(courtId);
    expect(res.body.data[0].priceFrom).toBe(90000);
  });

  it('allows a date-only search without a time window', async () => {
    const res = await request(app).get('/api/v1/courts').query({ date: TEST_DATE });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(courtId);
  });

  it('rejects a time window without the matching counterpart', async () => {
    const res = await request(app)
      .get('/api/v1/courts')
      .query({ date: TEST_DATE, startTime: '10:00' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('excludes a court when the requested window overlaps an active booking', async () => {
    const res = await request(app).get('/api/v1/courts').query({
      date: TEST_DATE,
      startTime: '18:00',
      endTime: '19:00',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totalPages).toBe(0);
  });

  it('rejects overlapping active intervals at the database level', async () => {
    let error: unknown;
    try {
      await db.insert(bookings).values({
        playerId,
        courtId,
        bookingCode: 'BK-OVERLAP-0001',
        bookingDate: TEST_DATE,
        startTime: '18:30:00',
        endTime: '19:30:00',
        unitPrice: '140000',
        totalAmount: '140000',
        status: 'CONFIRMED',
      });
    } catch (err) {
      error = err;
    }

    const code =
      (error as { cause?: { code?: string } })?.cause?.code ??
      (error as { code?: string })?.code;
    expect(code).toBe('23P01');
  });

  it('accepts boundary-touching intervals at the database level', async () => {
    const [created] = await db
      .insert(bookings)
      .values({
        playerId,
        courtId,
        bookingCode: 'BK-BOUNDARY-0001',
        bookingDate: TEST_DATE,
        startTime: '19:00:00',
        endTime: '20:00:00',
        unitPrice: '140000',
        totalAmount: '140000',
        status: 'CONFIRMED',
      })
      .returning();

    expect(created.id).toBeDefined();
  });

  it('includes a court for a boundary-touching requested window', async () => {
    const res = await request(app).get('/api/v1/courts').query({
      date: TEST_DATE,
      startTime: '19:00',
      endTime: '20:00',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(courtId);
  });

  it('returns merged free intervals excluding the booked slot', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${courtId}/availability`)
      .query({ date: TEST_DATE, durationMinutes: 120 });

    expect(res.status).toBe(200);
    const windows = res.body.data.intervals.map(
      (i: { startTime: string; endTime: string }) => `${i.startTime}-${i.endTime}`
    );
    expect(windows).toContain('06:00-18:00');
    expect(windows).toContain('19:00-22:00');
    expect(windows).not.toContain('18:00-19:00');
  });

  it('returns 404 for an unknown court', async () => {
    const res = await request(app)
      .get('/api/v1/courts/99999/availability')
      .query({ date: TEST_DATE });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COURT_NOT_FOUND');
  });

  it('returns 409 for a non-bookable court', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${suspendedCourtId}/availability`)
      .query({ date: TEST_DATE });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURT_NOT_BOOKABLE');
  });

  it('returns 400 when date is missing', async () => {
    const res = await request(app).get(`/api/v1/courts/${courtId}/availability`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for an impossible calendar date instead of a server error', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${courtId}/availability`)
      .query({ date: '2026-13-45' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns no bookable intervals for a past date', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${courtId}/availability`)
      .query({ date: '2020-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.intervals).toHaveLength(0);
  });
});
