import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, payments, notifications,
} from '../db';
import { createTestUser } from './test-helpers';
import { paymentService } from '../services/payments/payment.service';
import { bookingService } from '../services/booking/booking.service';
import { walletService } from '../services/payments/WalletService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let playerId: number;
let courtId: number;

async function createBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [booking] = await db.insert(bookings).values({
    playerId, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...overrides,
  }).returning();
  return booking;
}

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(payments);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);

  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const player = await createTestUser({ role: 'PLAYER' });
  playerId = player.id;
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Payment Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
});

describe('BK-06 booking payment integration (wallet-first)', () => {
  it('confirms once, creates one SUCCESS payment and one notification', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const booking = await createBooking();

    const first = await paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' });
    const replay = await paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' });

    expect(replay.paymentId).toBe(first.paymentId);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe('CONFIRMED');
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SUCCESS');
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CONFIRMED'))).toHaveLength(1);
    expect((await walletService.getWallet(playerId)).balance).toBe('0.00');
  });

  it('rejects a payment after the hold expired and never reopens the booking', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const booking = await createBooking({ expiresAt: new Date(Date.now() - 1000) });

    await expect(paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' }))
      .rejects.toMatchObject({ code: 'BOOKING_HOLD_EXPIRED' });
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe('PENDING_PAYMENT');
    expect((await walletService.getWallet(playerId)).balance).toBe('100000.00');
  });

  it('a valid late confirmation on an EXPIRED booking only signals a refund', async () => {
    const booking = await createBooking({ status: 'EXPIRED' });
    const result = await bookingService.confirmBookingInTransaction({ bookingId: booking.id, paymentId: 0 }, db as any);
    expect(result.refundSignal).toBe(true);
    expect(result.status).toBe('EXPIRED');
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe('EXPIRED');
  });

  it('a valid late confirmation on a CANCELLED booking never reopens it', async () => {
    const booking = await createBooking({ status: 'CANCELLED' });
    const result = await bookingService.confirmBookingInTransaction({ bookingId: booking.id, paymentId: 0 }, db as any);
    expect(result.refundSignal).toBe(true);
    expect(result.status).toBe('CANCELLED');
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe('CANCELLED');
  });

  it('concurrent confirm and cancel leave one consistent terminal outcome without a double debit', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const booking = await createBooking();

    const results = await Promise.allSettled([
      paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' }),
      bookingService.cancelBooking(playerId, booking.id),
    ]);

    const [current] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(['CONFIRMED', 'CANCELLED']).toContain(current.status);
    const paymentRows = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(paymentRows.length).toBeLessThanOrEqual(1);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
  });
});
