import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails,
  payments, paymentRefunds, notifications, matches, tournaments, tournamentMatches,
} from '../db';
import { app } from '../app';
import { createTestUser } from './test-helpers';
import { setConfig } from './social-fixture';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { ownerConfig } from '../shared/config/owner-config';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let ownerId: number;
let otherOwnerId: number;
let playerId: number;
let courtId: number;
let tournamentMatchId: number;

async function createBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [booking] = await db.insert(bookings).values({
    playerId, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `OWN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...overrides,
  }).returning();
  return booking;
}

async function pay(bookingId: number) {
  await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
  return paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
}

const cancelAs = (owner: number, bookingId: number, reason = 'Sân gặp sự cố', method: 'post' | 'get' = 'post') =>
  request(app)[method](`/api/v1/owner/bookings/${bookingId}/cancel`).set('x-user-id', String(owner)).send({ reason });

beforeEach(async () => {
  ownerConfig.clearCache();
  await db.delete(notifications);
  await db.delete(paymentRefunds);
  await db.delete(payments);
  await db.delete(tournamentMatches);
  await db.delete(matches);
  await db.delete(tournaments);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);

  const owner = await createTestUser({ role: 'COURT_OWNER' });
  ownerId = owner.id;
  otherOwnerId = (await createTestUser({ role: 'COURT_OWNER' })).id;
  playerId = (await createTestUser({ role: 'PLAYER' })).id;

  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Owner Cancel Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', latitude: '10', longitude: '106',
    openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });

  const [tournament] = await db.insert(tournaments).values({
    creatorId: playerId, name: 'Giải test', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES',
    participantLimit: 8, status: 'DRAFT', registrationStart: new Date(), registrationEnd: new Date(Date.now() + 86400000),
    tournamentStart: new Date(Date.now() + 86400000), tournamentEnd: new Date(Date.now() + 172800000),
  }).returning();
  const [match] = await db.insert(matches).values({ matchType: 'SINGLES', scheduledAt: new Date(`${BOOKING_DATE}T10:00:00+07:00`), status: 'PENDING_COURT' }).returning();
  tournamentMatchId = (await db.insert(tournamentMatches).values({ tournamentId: tournament.id, matchId: match.id, roundIndex: 0, matchIndex: 0, resolution: 'PENDING' }).returning())[0].id;
});

describe('CO-05 owner cancellation API', () => {
  it('hides bookings on another owner\'s facility', async () => {
    const booking = await createBooking();
    const response = await cancelAs(otherOwnerId, booking.id);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('OWNER_BOOKING_NOT_FOUND');
  });

  it('cancels an unpaid hold without a refund', async () => {
    const booking = await createBooking();
    const response = await cancelAs(ownerId, booking.id);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'CANCELLED', refundStatus: 'NONE' });
    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(row.status).toBe('CANCELLED');
    expect(row.cancellationReason).toBe('Sân gặp sự cố');
    expect(row.cancelledAt).not.toBeNull();
    expect(await db.select().from(paymentRefunds)).toHaveLength(0);
  });

  it('cancels a paid booking with one refund intent and one notification', async () => {
    const booking = await createBooking();
    await pay(booking.id);
    const response = await cancelAs(ownerId, booking.id);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.refundStatus).toBe('PENDING');
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CANCELLED'))).toHaveLength(1);

    const replay = await cancelAs(ownerId, booking.id);
    expect(replay.status).toBe(200);
    expect(replay.body.data.refundStatus).toBe('PENDING');
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CANCELLED'))).toHaveLength(1);
  });

  it('refuses a tournament system booking', async () => {
    const { bookingService } = await import('../services/booking/booking.service');
    const { bookingId } = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId: ownerId,
    });
    const response = await cancelAs(ownerId, bookingId);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE');
  });

  it('refuses a started booking and respects the configured deadline', async () => {
    const started = await createBooking({
      bookingDate: addDaysToDateString(todayInAppTimezone(), -1),
      startTime: '18:00:00', endTime: '19:00:00', status: 'CONFIRMED',
    });
    const startedResponse = await cancelAs(ownerId, started.id);
    expect(startedResponse.status).toBe(409);
    expect(startedResponse.body.error.code).toBe('OWNER_CANCELLATION_DEADLINE_PASSED');

    await setConfig('OWNER_CANCELLATION_DEADLINE_MINUTES', '4320');
    ownerConfig.clearCache();
    const soon = await createBooking({ status: 'PENDING_PAYMENT' });
    const soonResponse = await cancelAs(ownerId, soon.id);
    expect(soonResponse.status).toBe(409);
    expect(soonResponse.body.error.code).toBe('OWNER_CANCELLATION_DEADLINE_PASSED');
  });

  it('keeps one terminal outcome under confirm-vs-cancel race', async () => {
    const booking = await createBooking();
    await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });

    const [confirm, cancel] = await Promise.allSettled([
      paymentService.createBookingPayment({ bookingId: booking.id, actorId: playerId, provider: 'WALLET' }),
      cancelAs(ownerId, booking.id),
    ]);
    void confirm;
    void cancel;

    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(['CONFIRMED', 'CANCELLED']).toContain(row.status);
    expect((await db.select().from(paymentRefunds)).length).toBeLessThanOrEqual(1);
  });
});
