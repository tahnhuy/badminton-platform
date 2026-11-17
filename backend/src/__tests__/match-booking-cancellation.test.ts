import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, payments, paymentRefunds, notifications,
  matches, matchPlayers, matchmakingRequests, matchmakingMatches, matchmakingInvitations, matchBookingCancellationJobs, posts,
} from '../db';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { skillIds } from './social-fixture';
import { bookingService } from '../services/booking/booking.service';
import { matchBookingCancellationService } from '../services/matchmaking/MatchBookingCancellationService';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { refundService } from '../services/payments/RefundService';
import { ownerConfig } from '../shared/config/owner-config';
import { setConfig } from './social-fixture';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
const START = new Date(`${BOOKING_DATE}T18:00:00+07:00`);
let host: number;
let member: number;
let courtId: number;

async function fixture(matchStatus: 'PENDING_COURT' | 'CONFIRMED' = 'CONFIRMED') {
  host = (await createTestUser({ role: 'PLAYER' })).id;
  member = (await createTestUser({ role: 'PLAYER' })).id;
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Cancel Match Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', latitude: '10', longitude: '106',
    openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });

  const [booking] = await db.insert(bookings).values({
    playerId: host, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `MMC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();
  await walletService.credit({ userId: host, amount: '100000', entryType: 'TOP_UP' });
  await paymentService.createBookingPayment({ bookingId: booking.id, actorId: host, provider: 'WALLET' });

  const recruitment = await recruitmentFixtureColumns(host, 'SINGLES', START, 60);
  const skills = await skillIds();
  const [request] = await db.insert(matchmakingRequests).values({
    playerId: host, matchType: 'SINGLES', minSkillLevelId: skills.min, maxSkillLevelId: skills.max,
    status: 'MATCHED', bookingId: booking.id, ...recruitment,
  }).returning();
  const [match] = await db.insert(matches).values({
    matchType: 'SINGLES', scheduledAt: START, bookingDeadlineAt: START, bookingId: booking.id,
    courtId, status: matchStatus,
  }).returning();
  await db.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });
  await db.insert(matchPlayers).values([
    { matchId: match.id, playerId: host, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
    { matchId: match.id, playerId: member, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
  ]);
  await db.insert(matchmakingInvitations).values({
    requestId: request.id, createdBy: host, playerId: member, kind: 'INVITE',
    decidedBy: member, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000), respondedAt: new Date(),
  });
  const [job] = await db.insert(matchBookingCancellationJobs).values({
    matchId: match.id, requestId: request.id, bookingId: booking.id, status: 'PENDING', attempts: 0, nextAttemptAt: new Date(),
  }).returning();
  return { matchId: match.id, requestId: request.id, bookingId: booking.id, jobId: job.id };
}

beforeEach(async () => {
  ownerConfig.clearCache();
  await db.delete(notifications);
  await db.delete(matchBookingCancellationJobs);
  await db.delete(matchmakingInvitations);
  await db.delete(matchmakingMatches);
  await db.delete(matchPlayers);
  await db.delete(matchmakingRequests);
  await db.delete(posts);
  await db.delete(matches);
  await db.delete(paymentRefunds);
  await db.delete(payments);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);
});

describe('MM-20 booking/Match cancellation reconciliation', () => {
  it('booking cancellation cancels the linked Match synchronously and persists one recovery job', async () => {
    const fx = await fixture('CONFIRMED');
    await bookingService.cancelBooking(host, fx.bookingId);

    expect((await db.select().from(matches).where(eq(matches.id, fx.matchId)))[0].status).toBe('CANCELLED');
    expect((await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, fx.requestId)))[0].status).toBe('CANCELLED');
    expect(await db.select().from(matchBookingCancellationJobs)).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_BOOKING_CANCELLED'))).toHaveLength(2);
  });

  it('worker cancels the linked booking and refunds exactly once when the Match was cancelled', async () => {
    const fx = await fixture('PENDING_COURT');
    await db.update(matches).set({ status: 'CANCELLED' }).where(eq(matches.id, fx.matchId));

    const first = await matchBookingCancellationService.processPending();
    const second = await matchBookingCancellationService.processPending();
    expect(first).toBe(1);
    expect(second).toBe(0);

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, fx.bookingId));
    expect(booking.status).toBe('CANCELLED');
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);

    await refundService.processPending();
    await refundService.processPending();
    expect((await walletService.getWallet(host)).balance).toBe('100000.00');
    expect((await db.select().from(matchBookingCancellationJobs).where(eq(matchBookingCancellationJobs.id, fx.jobId)))[0].status).toBe('DONE');
  });

  it('treats a policy refusal as a terminal outcome instead of retrying forever', async () => {
    const fx = await fixture('PENDING_COURT');
    await setConfig('OWNER_CAN_CANCEL_BOOKING', 'false');
    ownerConfig.clearCache();
    await db.update(matches).set({ status: 'CANCELLED' }).where(eq(matches.id, fx.matchId));

    await matchBookingCancellationService.processPending();
    await matchBookingCancellationService.processPending();
    const [job] = await db.select().from(matchBookingCancellationJobs).where(eq(matchBookingCancellationJobs.id, fx.jobId));
    expect(job.status).toBe('FAILED');
    expect(job.lastErrorCode).toBe('OWNER_CANCELLATION_DISABLED');
    expect((await db.select().from(bookings).where(eq(bookings.id, fx.bookingId)))[0].status).toBe('CONFIRMED');
    expect(await db.select().from(paymentRefunds)).toHaveLength(0);
  });

  it('reclaims a PROCESSING job left behind by a crash', async () => {
    const fx = await fixture('PENDING_COURT');
    await db.update(matches).set({ status: 'CANCELLED' }).where(eq(matches.id, fx.matchId));
    await db.update(matchBookingCancellationJobs).set({
      status: 'PROCESSING',
      attempts: 1,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    }).where(eq(matchBookingCancellationJobs.id, fx.jobId));

    expect(await matchBookingCancellationService.processPending()).toBe(1);
    expect((await db.select().from(bookings).where(eq(bookings.id, fx.bookingId)))[0].status).toBe('CANCELLED');
    expect((await db.select().from(matchBookingCancellationJobs).where(eq(matchBookingCancellationJobs.id, fx.jobId)))[0].status).toBe('DONE');
  });

  it('does not create a second refund or notification on repeated processing', async () => {
    const fx = await fixture('PENDING_COURT');
    await db.update(matches).set({ status: 'CANCELLED' }).where(eq(matches.id, fx.matchId));
    await matchBookingCancellationService.processPending();
    await matchBookingCancellationService.processPending();
    await refundService.processPending();
    await refundService.processPending();

    expect((await walletService.getWallet(host)).balance).toBe('100000.00');
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_CANCELLED'))).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_REFUNDED'))).toHaveLength(1);
  });
});
