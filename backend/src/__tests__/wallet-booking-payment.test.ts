import { describe, it, expect, beforeEach } from 'vitest';
import { db, bookings, courtPricings, courts, facilities, paymentRefunds, payments } from '../db';
import { eq } from 'drizzle-orm';
import { createTestUser } from './test-helpers';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { bookingService } from '../services/booking/booking.service';
import { refundService } from '../services/payments/RefundService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let playerId: number;
let bookingId: number;

async function createBooking(status = 'PENDING_PAYMENT', amount = '100000') {
  const [booking] = await db.insert(bookings).values({
    playerId,
    courtId,
    bookingDate: BOOKING_DATE,
    startTime: '18:00:00',
    endTime: '19:00:00',
    unitPrice: '100000',
    totalAmount: amount,
    status,
    bookingCode: `WALLET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();
  return booking;
}

let courtId: number;

beforeEach(async () => {
  await db.delete(payments);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);

  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const player = await createTestUser({ role: 'PLAYER' });
  playerId = player.id;

  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id,
    name: 'Wallet Court',
    phone: '0908123456',
    status: 'ACTIVE',
    address: '123 Wallet',
    ward: 'Phường 1',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    openingTime: '06:00:00',
    closingTime: '23:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  bookingId = (await createBooking()).id;
});

describe('Wallet booking payment (WAL-03)', () => {
  it('debits the wallet, creates a WALLET payment and confirms the booking', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });

    const result = await paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
    expect(result.isMock).toBe(false);
    expect(result.redirectUrl).toBe('');
    expect(result.amount).toBe('100000');

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking.status).toBe('CONFIRMED');
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId));
    expect(payment.provider).toBe('WALLET');
    expect(payment.status).toBe('SUCCESS');
    expect((await walletService.getWallet(playerId)).balance).toBe('0.00');
  });

  it('rejects insufficient balance without confirming the booking', async () => {
    await expect(
      paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' }),
    ).rejects.toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(await db.select().from(payments).where(eq(payments.bookingId, bookingId))).toHaveLength(0);
  });

  it('creates a refund intent on cancellation and credits the wallet exactly once', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    await paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });

    const cancelled = await bookingService.cancelBooking(playerId, bookingId);
    expect(cancelled.refundStatus).toBe('PENDING');
    expect((await walletService.getWallet(playerId)).balance).toBe('0.00');

    await refundService.processPending();
    expect((await walletService.getWallet(playerId)).balance).toBe('100000.00');
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId));
    expect(payment.status).toBe('REFUNDED');
    const [refund] = await db.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, payment.id));
    expect(refund.status).toBe('REFUNDED');

    await refundService.processPending();
    expect((await walletService.getWallet(playerId)).balance).toBe('100000.00');
  });

  it('replays the confirmed booking without a second debit', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const first = await paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
    const replay = await paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });

    expect(replay.paymentId).toBe(first.paymentId);
    expect((await walletService.getWallet(playerId)).balance).toBe('0.00');
    expect(await db.select().from(payments).where(eq(payments.bookingId, bookingId))).toHaveLength(1);
  });
});
