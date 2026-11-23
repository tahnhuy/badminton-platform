import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails,
  payments, paymentRefunds, notifications, matches, matchmakingRequests, matchmakingMatches, posts,
} from '../db';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { skillIds } from './social-fixture';
import { bookingService } from '../services/booking/booking.service';
import { walletService } from '../services/payments/WalletService';
import { refundService } from '../services/payments/RefundService';
import { paymentService } from '../services/payments/payment.service';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let playerId: number;
let courtId: number;
let facilityId: number;

async function createBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [booking] = await db.insert(bookings).values({
    playerId, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `CXL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...overrides,
  }).returning();
  return booking;
}

async function pay(bookingId: number) {
  await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
  return paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
}

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(paymentRefunds);
  await db.delete(payments);
  await db.delete(matchmakingMatches);
  await db.delete(matchmakingRequests);
  await db.delete(posts);
  await db.delete(matches);
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
    ownerId: owner.id, name: 'Cancel Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', latitude: '10', longitude: '106',
    openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  facilityId = facility.id;
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
});

describe('BK-07 cancellation and durable refund', () => {
  it('cancels an unpaid hold without a refund and notifies exactly once', async () => {
    const booking = await createBooking();
    const result = await bookingService.cancelBooking(playerId, booking.id);
    expect(result).toMatchObject({ status: 'CANCELLED', refundStatus: 'NONE' });
    expect(await db.select().from(paymentRefunds)).toHaveLength(0);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CANCELLED'))).toHaveLength(1);

    const replay = await bookingService.cancelBooking(playerId, booking.id);
    expect(replay.status).toBe('CANCELLED');
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CANCELLED'))).toHaveLength(1);
  });

  it('cancels a paid booking, persists one refund intent and credits the wallet exactly once', async () => {
    const booking = await createBooking();
    await pay(booking.id);

    const result = await bookingService.cancelBooking(playerId, booking.id);
    expect(result).toMatchObject({ status: 'CANCELLED', refundStatus: 'PENDING' });
    const intent = await db.select().from(paymentRefunds);
    expect(intent).toHaveLength(1);
    expect(intent[0].status).toBe('PENDING');

    await refundService.processPending();
    await refundService.processPending();

    expect((await walletService.getWallet(playerId)).balance).toBe('100000.00');
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(payment.status).toBe('REFUNDED');
    expect((await db.select().from(paymentRefunds))[0].status).toBe('REFUNDED');
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_REFUNDED'))).toHaveLength(1);
  });

  it('cancelling a linked Match follow-up cancels the Match and persists one job', async () => {
    const booking = await createBooking();
    await pay(booking.id);
    const host = await createTestUser({ role: 'PLAYER' });
    const recruitment = await recruitmentFixtureColumns(host.id, 'SINGLES', new Date(`${BOOKING_DATE}T18:00:00+07:00`), 60);
    const skills = await skillIds();
    const [request] = await db.insert(matchmakingRequests).values({
      playerId: host.id, matchType: 'SINGLES', minSkillLevelId: skills.min, maxSkillLevelId: skills.max,
      status: 'MATCHED', bookingId: booking.id, ...recruitment,
    }).returning();
    const [match] = await db.insert(matches).values({
      matchType: 'SINGLES', scheduledAt: new Date(`${BOOKING_DATE}T18:00:00+07:00`),
      bookingId: booking.id, courtId, status: 'CONFIRMED',
    }).returning();
    await db.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });

    await bookingService.cancelBooking(playerId, booking.id);

    expect((await db.select().from(matches).where(eq(matches.id, match.id)))[0].status).toBe('CANCELLED');
    expect((await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, request.id)))[0].status).toBe('CANCELLED');
    const jobs = await db.execute('SELECT id FROM match_booking_cancellation_jobs');
    expect(jobs.rows).toHaveLength(1);
  });
});
