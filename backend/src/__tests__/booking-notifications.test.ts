import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, payments, paymentRefunds, notifications,
} from '../db';
import { createTestUser } from './test-helpers';
import { paymentService } from '../services/payments/payment.service';
import { bookingService } from '../services/booking/booking.service';
import { walletService } from '../services/payments/WalletService';
import { refundService } from '../services/payments/RefundService';
import { notificationService } from '../services/notifications/NotificationService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let playerId: number;
let courtId: number;

async function createBooking() {
  const [booking] = await db.insert(bookings).values({
    playerId, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();
  return booking;
}

const notes = (type: string) => db.select().from(notifications).where(and(eq(notifications.userId, playerId), eq(notifications.type, type)));

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(paymentRefunds);
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
    ownerId: owner.id, name: 'Notification Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
});

describe('BK-10 booking notifications', () => {
  it('persists one BOOKING_CONFIRMED notification with a BOOKING resource link and dedup key', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const booking = await createBooking();

    await paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' });
    await bookingService.confirmBooking({ bookingId: booking.id, paymentId: 1 });

    const rows = await notes('BOOKING_CONFIRMED');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ resourceType: 'BOOKING', resourceId: booking.id, dedupKey: `booking:${booking.id}:BOOKING_CONFIRMED` });
  });

  it('deduplicates cancellation and refund-outcome notifications on retry', async () => {
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
    const booking = await createBooking();
    await paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' });

    await bookingService.cancelBooking(playerId, booking.id);
    await bookingService.cancelBooking(playerId, booking.id);
    expect(await notes('BOOKING_CANCELLED')).toHaveLength(1);

    await refundService.processPending();
    await refundService.processPending();
    expect(await notes('BOOKING_REFUNDED')).toHaveLength(1);
  });

  it('rolls the domain change back when notification persistence fails in the same transaction', async () => {
    const booking = await createBooking();
    await expect(db.transaction(async (tx) => {
      await tx.update(bookings).set({ status: 'CONFIRMED' }).where(eq(bookings.id, booking.id));
      await notificationService.notify(tx, [{
        recipientId: 0,
        type: 'BOOKING_CONFIRMED',
        title: 'x',
        content: 'x',
        dedupKey: `booking:${booking.id}:BOOKING_CONFIRMED`,
      }]);
    })).rejects.toThrow();
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe('PENDING_PAYMENT');
  });
});
