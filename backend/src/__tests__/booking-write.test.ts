import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  payments,
  systemConfigs,
} from '../db';
import { createTestUser } from '../test/test-helpers';
import { bookingConfig } from '../shared/config/booking-config';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { eq } from 'drizzle-orm';

const TODAY = todayInAppTimezone();
const BOOKING_DATE = addDaysToDateString(TODAY, 1);

describe('Player booking write-path (BK-05, BK-07, BK-08)', () => {
  let playerId: number;
  let otherPlayerId: number;
  let courtId: number;

  const asPlayer = (method: 'post' | 'get', url: string, id = playerId) =>
    request(app)[method](url).set('x-user-id', String(id));

  beforeEach(async () => {
    await db.delete(bookingPricingDetails);
    await db.delete(bookings);
    await db.delete(courtPricings);
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(users);

    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const player = await createTestUser({ role: 'PLAYER' });
    const other = await createTestUser({ role: 'PLAYER' });
    playerId = player.id;
    otherPlayerId = other.id;

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

    await db.insert(courtPricings).values([
      { courtId, startTime: '06:00:00', endTime: '16:00:00', price: '90000', validFrom: '2020-01-01' },
      { courtId, startTime: '16:00:00', endTime: '21:00:00', price: '140000', validFrom: '2020-01-01' },
      { courtId, startTime: '21:00:00', endTime: '22:00:00', price: '110000', validFrom: '2020-01-01' },
    ]);
  });

  it('creates a PENDING_PAYMENT hold with code, snapshot price and expiry', async () => {
    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 120,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.bookingCode).toMatch(/^BK-\d{8}-[A-Z0-9]{6}$/);
    expect(res.body.data.totalAmount).toBe(180000);
    expect(res.body.data.durationMinutes).toBe(120);
    expect(res.body.data.expiresAt).toBeTruthy();
    expect(res.body.data.pricingDetails).toHaveLength(1);
  });

  it('rejects an overlapping booking for the same court', async () => {
    await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });

    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:30',
      durationMinutes: 60,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('rejects a duration outside the configured min/max', async () => {
    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 30,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_DURATION_OUT_OF_RANGE');
  });

  it('rejects a date outside the advance window', async () => {
    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: addDaysToDateString(TODAY, 30),
      startTime: '10:00',
      durationMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_OUTSIDE_ADVANCE_WINDOW');
  });

  it('rejects a window outside opening hours / pricing coverage', async () => {
    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '05:00',
      durationMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_INVALID_TIME_RANGE');
  });

  it('rejects a player over the active-booking limit', async () => {
    await db
      .insert(systemConfigs)
      .values({ configKey: 'BOOKING_MAX_ACTIVE_PER_PLAYER', configValue: '1' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '1' },
      });
    bookingConfig.clearCache();

    try {
      const first = await asPlayer('post', '/api/v1/bookings').send({
        courtId,
        bookingDate: BOOKING_DATE,
        startTime: '10:00',
        durationMinutes: 60,
      });
      expect(first.status).toBe(201);

      const second = await asPlayer('post', '/api/v1/bookings').send({
        courtId,
        bookingDate: BOOKING_DATE,
        startTime: '12:00',
        durationMinutes: 60,
      });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('BOOKING_ACTIVE_LIMIT_REACHED');
    } finally {
      await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
      bookingConfig.clearCache();
    }
  });

  it('lists a player booking and filters by timeScope/status', async () => {
    const created = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });
    const bookingId = created.body.data.id;

    const upcoming = await asPlayer('get', '/api/v1/bookings/my-bookings').query({ timeScope: 'UPCOMING' });
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.meta.total).toBe(1);
    expect(upcoming.body.data[0].id).toBe(bookingId);

    const past = await asPlayer('get', '/api/v1/bookings/my-bookings').query({ timeScope: 'PAST' });
    expect(past.body.meta.total).toBe(0);

    const byStatus = await asPlayer('get', '/api/v1/bookings/my-bookings').query({ status: 'PENDING_PAYMENT' });
    expect(byStatus.body.meta.total).toBe(1);
  });

  it('enforces owner-only detail access', async () => {
    const created = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });
    const bookingId = created.body.data.id;

    const owner = await asPlayer('get', `/api/v1/bookings/${bookingId}`);
    expect(owner.status).toBe(200);

    const stranger = await asPlayer('get', `/api/v1/bookings/${bookingId}`, otherPlayerId);
    expect(stranger.status).toBe(403);
    expect(stranger.body.error.code).toBe('BOOKING_FORBIDDEN_OWNER');

    const missing = await asPlayer('get', '/api/v1/bookings/99999');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('cancels an unpaid hold, releases the slot and is idempotent', async () => {
    const created = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });
    const bookingId = created.body.data.id;

    const cancelled = await asPlayer('post', `/api/v1/bookings/${bookingId}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.refundStatus).toBe('NONE');

    const availability = await request(app)
      .get(`/api/v1/courts/${courtId}/availability`)
      .query({ date: BOOKING_DATE });
    const windows = availability.body.data.intervals.map(
      (i: { startTime: string; endTime: string }) => `${i.startTime}-${i.endTime}`
    );
    expect(windows).toContain('06:00-22:00');

    const again = await asPlayer('post', `/api/v1/bookings/${bookingId}/cancel`);
    expect(again.status).toBe(200);
    expect(again.body.data.status).toBe('CANCELLED');
  });

  it('rejects cancellation by a non-owner', async () => {
    const created = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });
    const bookingId = created.body.data.id;

    const res = await asPlayer('post', `/api/v1/bookings/${bookingId}/cancel`, otherPlayerId);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BOOKING_FORBIDDEN_OWNER');
  });

  it('releases an elapsed hold so the slot can be rebooked immediately', async () => {
    await db.insert(bookings).values({
      playerId,
      courtId,
      bookingCode: 'BK-STALE-0001',
      bookingDate: BOOKING_DATE,
      startTime: '10:00:00',
      endTime: '11:00:00',
      unitPrice: '90000',
      totalAmount: '90000',
      status: 'PENDING_PAYMENT',
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await asPlayer('post', '/api/v1/bookings').send({
      courtId,
      bookingDate: BOOKING_DATE,
      startTime: '10:00',
      durationMinutes: 60,
    });

    expect(res.status).toBe(201);

    const [stale] = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.bookingCode, 'BK-STALE-0001'));
    expect(stale.status).toBe('EXPIRED');
  });

  it('does not count elapsed holds toward the active-booking limit', async () => {
    await db
      .insert(systemConfigs)
      .values({ configKey: 'BOOKING_MAX_ACTIVE_PER_PLAYER', configValue: '1' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '1' },
      });
    bookingConfig.clearCache();

    try {
      await db.insert(bookings).values({
        playerId,
        courtId,
        bookingCode: 'BK-STALE-0002',
        bookingDate: BOOKING_DATE,
        startTime: '08:00:00',
        endTime: '09:00:00',
        unitPrice: '90000',
        totalAmount: '90000',
        status: 'PENDING_PAYMENT',
        expiresAt: new Date(Date.now() - 60_000),
      });

      const res = await asPlayer('post', '/api/v1/bookings').send({
        courtId,
        bookingDate: BOOKING_DATE,
        startTime: '10:00',
        durationMinutes: 60,
      });
      expect(res.status).toBe(201);
    } finally {
      await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
      bookingConfig.clearCache();
    }
  });

  it('rejects a start time that has already passed today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T10:00:00+07:00'));
    try {
      const res = await asPlayer('post', '/api/v1/bookings').send({
        courtId,
        bookingDate: todayInAppTimezone(),
        startTime: '06:00',
        durationMinutes: 60,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_INVALID_TIME_RANGE');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns zero total pages when the player has no bookings', async () => {
    const res = await asPlayer('get', '/api/v1/bookings/my-bookings');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('reports refund status from the payment on a cancelled paid booking', async () => {
    const [booking] = await db
      .insert(bookings)
      .values({
        playerId,
        courtId,
        bookingCode: 'BK-REFUND-0001',
        bookingDate: BOOKING_DATE,
        startTime: '14:00:00',
        endTime: '15:00:00',
        unitPrice: '90000',
        totalAmount: '90000',
        status: 'CANCELLED',
      })
      .returning();

    await db.insert(payments).values({
      bookingId: booking.id,
      amount: '90000',
      provider: 'VNPAY',
      paymentMethod: 'CARD',
      status: 'SUCCESS',
    });

    const res = await asPlayer('get', `/api/v1/bookings/${booking.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.refundStatus).toBe('PENDING');
    expect(res.body.data.payment.status).toBe('SUCCESS');
  });

  it('derives COMPLETED for a past confirmed booking and filters by it', async () => {
    await db.insert(bookings).values({
      playerId,
      courtId,
      bookingCode: 'BK-PAST-0001',
      bookingDate: addDaysToDateString(TODAY, -2),
      startTime: '10:00:00',
      endTime: '11:00:00',
      unitPrice: '90000',
      totalAmount: '90000',
      status: 'CONFIRMED',
    });

    const res = await asPlayer('get', '/api/v1/bookings/my-bookings').query({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].bookingCode).toBe('BK-PAST-0001');
    expect(res.body.data[0].status).toBe('COMPLETED');
  });
});
