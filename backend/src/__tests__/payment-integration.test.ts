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
} from '../db';
import { createTestUser } from './test-helpers';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { paymentRepository } from '../repositories/payment/PaymentRepository';
import { PaymentProviderFactory } from '../services/payments/provider.factory';
import { env } from '../shared/config/env';
import { eq } from 'drizzle-orm';

const TODAY = todayInAppTimezone();
const BOOKING_DATE = addDaysToDateString(TODAY, 1);

describe('Payment Core & Mock Adapter Integration (BK-06, PAY-01, PAY-02, PAY-06)', () => {
  let playerId: number;
  let otherPlayerId: number;
  let courtId: number;

  const asPlayer = (method: 'post' | 'get', url: string, id = playerId) =>
    request(app)[method](url).set('x-user-id', String(id));

  beforeEach(async () => {
    await db.delete(payments);
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
        name: 'Sân Cầu Lông Test Payment',
        phone: '0908123456',
        status: 'ACTIVE',
        address: '123 Đường Số 1',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        latitude: '10.7500',
        longitude: '106.7000',
        openingTime: '06:00:00',
        closingTime: '23:00:00',
      })
      .returning();

    const [court] = await db
      .insert(courts)
      .values({
        facilityId: facility.id,
        name: 'Sân 1',
        status: 'ACTIVE',
      })
      .returning();
    courtId = court.id;

    await db.insert(courtPricings).values({
      courtId,
      startTime: '06:00:00',
      endTime: '23:00:00',
      price: '100000',
      validFrom: TODAY,
    });
  });

  async function createPendingBooking(overrides: { expiresAt?: Date; playerId?: number } = {}) {
    const res = await asPlayer('post', '/api/v1/bookings', overrides.playerId ?? playerId)
      .send({
        courtId,
        bookingDate: BOOKING_DATE,
        startTime: '08:00',
        durationMinutes: 60,
      });
    expect(res.status).toBe(201);
    const booking = res.body.data;

    if (overrides.expiresAt) {
      await db
        .update(bookings)
        .set({ expiresAt: overrides.expiresAt })
        .where(eq(bookings.id, booking.id));
      booking.expiresAt = overrides.expiresAt.toISOString();
    }
    return booking;
  }

  describe('Payment Initiation (POST /api/v1/bookings/:id/payment)', () => {
    it('creates a pending payment record and returns mock details for the owner', async () => {
      const booking = await createPendingBooking();

      const res = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`)
        .send({ provider: 'MOCK' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        isMock: true,
      });
      expect(Number(res.body.data.amount)).toBe(100000);
      expect(res.body.data.paymentId).toBeDefined();

      // Check DB payment record
      const [dbPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, res.body.data.paymentId));
      expect(dbPayment).toBeDefined();
      expect(dbPayment.status).toBe('PENDING');
      expect(Number(dbPayment.amount)).toBe(100000);
    });

    it('rejects initiation if caller is not the owner of the booking', async () => {
      const booking = await createPendingBooking();

      const res = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`, otherPlayerId)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BOOKING_NOT_OWNER');
    });

    it('rejects initiation if booking hold has expired', async () => {
      const expiredPast = new Date(Date.now() - 5 * 60 * 1000);
      const booking = await createPendingBooking({ expiresAt: expiredPast });

      const res = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_HOLD_EXPIRED');
    });
  });

  describe('Mock Payment Confirmation (POST /api/v1/payments/mock/confirm)', () => {
    it('successfully confirms booking and transitions payment to SUCCESS', async () => {
      const booking = await createPendingBooking();

      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      const confirmRes = await asPlayer('post', '/api/v1/payments/mock/confirm').send({
        bookingId: booking.id,
        paymentId,
      });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data).toMatchObject({
        success: true,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
      });
      expect(confirmRes.body.data.transactionId).toMatch(/^MOCK_TXN_/);

      // Verify booking status in database
      const [dbBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id));
      expect(dbBooking.status).toBe('CONFIRMED');

      // Verify payment status in database
      const [dbPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));
      expect(dbPayment.status).toBe('SUCCESS');
      expect(dbPayment.paidAt).not.toBeNull();
    });

    it('handles duplicate confirmation idempotently', async () => {
      const booking = await createPendingBooking();
      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      // First confirmation
      await asPlayer('post', '/api/v1/payments/mock/confirm').send({
        bookingId: booking.id,
        paymentId,
      });

      // Second confirmation (replay / duplicate callback)
      const res2 = await asPlayer('post', '/api/v1/payments/mock/confirm').send({
        bookingId: booking.id,
        paymentId,
      });

      expect(res2.status).toBe(200);
      expect(res2.body.data.success).toBe(true);
      expect(res2.body.data.bookingStatus).toBe('CONFIRMED');
      expect(res2.body.data.paymentStatus).toBe('SUCCESS');
    });

    it('simulates failure when simulateFailure is requested', async () => {
      const booking = await createPendingBooking();
      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      const confirmRes = await asPlayer('post', '/api/v1/payments/mock/confirm').send({
        bookingId: booking.id,
        paymentId,
        simulateFailure: true,
      });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.success).toBe(false);
      expect(confirmRes.body.data.paymentStatus).toBe('FAILED');

      // Booking remains PENDING_PAYMENT
      const [dbBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id));
      expect(dbBooking.status).toBe('PENDING_PAYMENT');
    });

    it('marks transaction as REFUNDED if booking expired before payment confirmation was processed', async () => {
      const booking = await createPendingBooking();
      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      // Simulate expiry right before confirm
      await db
        .update(bookings)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(bookings.id, booking.id));

      const confirmRes = await asPlayer('post', '/api/v1/payments/mock/confirm').send({
        bookingId: booking.id,
        paymentId,
      });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.success).toBe(false);
      expect(confirmRes.body.data.bookingStatus).toBe('EXPIRED');
      expect(confirmRes.body.data.paymentStatus).toBe('REFUNDED');

      // Slot is NOT opened/confirmed
      const [dbBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id));
      expect(dbBooking.status).toBe('EXPIRED');
    });
  });

  describe('Payment regression cases', () => {
    it('reuses one pending payment across concurrent initiation requests', async () => {
      const booking = await createPendingBooking();
      const responses = await Promise.all(Array.from({ length: 5 }, () =>
        asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({})));
      expect(responses.every((res) => res.status === 201)).toBe(true);
      expect(new Set(responses.map((res) => res.body.data.paymentId)).size).toBe(1);
      expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(1);
    });

    it('keeps the transaction identity and status across concurrent confirmations and failure replays', async () => {
      const booking = await createPendingBooking();
      const init = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const body = { bookingId: booking.id, paymentId: init.body.data.paymentId };
      const responses = await Promise.all(Array.from({ length: 3 }, () =>
        asPlayer('post', '/api/v1/payments/mock/confirm').send(body)));
      expect(responses.every((res) => res.status === 200)).toBe(true);
      expect(new Set(responses.map((res) => res.body.data.transactionId)).size).toBe(1);
      const replay = await asPlayer('post', '/api/v1/payments/mock/confirm')
        .send({ ...body, simulateFailure: true });
      expect(replay.body.data.paymentStatus).toBe('SUCCESS');
    });

    it('does not resurrect a failed attempt', async () => {
      const booking = await createPendingBooking();
      const init = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const body = { bookingId: booking.id, paymentId: init.body.data.paymentId };
      await asPlayer('post', '/api/v1/payments/mock/confirm').send({ ...body, simulateFailure: true });
      const replay = await asPlayer('post', '/api/v1/payments/mock/confirm').send(body);
      expect(replay.body.data.paymentStatus).toBe('FAILED');
      const retry = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      expect(retry.body.data.paymentId).not.toBe(body.paymentId);
    });

    it('rolls back booking confirmation if writing payment fails', async () => {
      const booking = await createPendingBooking();
      const init = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const spy = vi.spyOn(paymentRepository, 'updateTransactionId').mockRejectedValueOnce(new Error('write failed'));
      try {
        const res = await asPlayer('post', '/api/v1/payments/mock/confirm').send({
          bookingId: booking.id, paymentId: init.body.data.paymentId,
        });
        expect(res.status).toBe(500);
        const [stored] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
        expect(stored.status).toBe('PENDING_PAYMENT');
        expect((await paymentRepository.findById(init.body.data.paymentId))?.status).toBe('PENDING');
      } finally {
        spy.mockRestore();
      }
    });

    it('preserves refunded payment identity on replay', async () => {
      const booking = await createPendingBooking();
      const init = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      await db.update(bookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, booking.id));
      const body = { bookingId: booking.id, paymentId: init.body.data.paymentId };
      const first = await asPlayer('post', '/api/v1/payments/mock/confirm').send(body);
      const replay = await asPlayer('post', '/api/v1/payments/mock/confirm').send({ ...body, simulateFailure: true });
      expect(first.body.data.paymentStatus).toBe('REFUNDED');
      expect(replay.body.data).toMatchObject({ paymentStatus: 'REFUNDED', transactionId: first.body.data.transactionId });
    });

    it('rejects initiation for a pending hold without an expiry', async () => {
      const booking = await createPendingBooking();
      await db.update(bookings).set({ expiresAt: null }).where(eq(bookings.id, booking.id));
      const res = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_HOLD_EXPIRED');
    });

    it('denies access to payments without an authorized booking target', async () => {
      const booking = await createPendingBooking();
      const payment = await paymentRepository.create({ bookingId: booking.id, amount: '100000', provider: 'MOCK', paymentMethod: 'ONLINE', status: 'PENDING' });
      const spy = vi.spyOn(paymentRepository, 'findById').mockResolvedValueOnce({ ...payment, bookingId: null, registrationId: 1 });
      try {
        const res = await asPlayer('get', `/api/v1/payments/${payment.id}`);
        expect(res.status).toBe(403);
      } finally {
        spy.mockRestore();
      }
    });

    it('does not silently fall back from VNPAY/Mock and rejects unknown providers', () => {
      const previousNodeEnv = env.NODE_ENV;
      const previousTmn = env.VNPAY_TMN_CODE;
      const previousSecret = env.VNPAY_HASH_SECRET;
      try {
        env.VNPAY_TMN_CODE = '';
        env.VNPAY_HASH_SECRET = '';
        expect(() => PaymentProviderFactory.getProvider('VNPAY')).toThrowError(/credentials are missing/);
        expect(() => PaymentProviderFactory.getProvider('unknown')).toThrowError(/Unsupported payment provider/);

        env.NODE_ENV = 'production';
        expect(() => PaymentProviderFactory.getProvider('MOCK')).toThrowError(/Mock payment provider/);
      } finally {
        env.NODE_ENV = previousNodeEnv;
        env.VNPAY_TMN_CODE = previousTmn;
        env.VNPAY_HASH_SECRET = previousSecret;
      }
    });
  });

  describe('Payment Query (GET /api/v1/payments/:id)', () => {
    it('returns payment details to the booking owner', async () => {
      const booking = await createPendingBooking();
      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      const res = await asPlayer('get', `/api/v1/payments/${paymentId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentId);
      expect(Number(res.body.data.amount)).toBe(100000);
    });

    it('rejects access from another player', async () => {
      const booking = await createPendingBooking();
      const initRes = await asPlayer('post', `/api/v1/bookings/${booking.id}/payment`).send({});
      const paymentId = initRes.body.data.paymentId;

      const res = await asPlayer('get', `/api/v1/payments/${paymentId}`, otherPlayerId);
      expect(res.status).toBe(403);
    });
  });
});
