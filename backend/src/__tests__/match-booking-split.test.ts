import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingCostShares, payments, paymentRefunds,
  notifications, matches, matchPlayers, matchmakingRequests, matchmakingMatches, matchmakingInvitations,
  matchBookingCancellationJobs, posts,
} from '../db';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { skillIds } from './social-fixture';
import { matchBookingSplitService } from '../services/matchmaking/MatchBookingSplitService';
import { matchBookingCancellationService } from '../services/matchmaking/MatchBookingCancellationService';
import { refundService } from '../services/payments/RefundService';
import { recruitmentLifecycleService } from '../services/matchmaking/RecruitmentLifecycleService';
import { walletService } from '../services/payments/WalletService';
import { bookingConfig } from '../shared/config/booking-config';
import { refundConfig } from '../shared/config/refund-config';
import { ownerConfig } from '../shared/config/owner-config';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
const START = new Date(`${BOOKING_DATE}T18:00:00+07:00`);

interface Fixture {
  host: number;
  member: number;
  matchId: number;
  requestId: number;
  courtId: number;
}

async function fixture(price = '100000.00'): Promise<Fixture> {
  const host = (await createTestUser({ role: 'PLAYER' })).id;
  const member = (await createTestUser({ role: 'PLAYER' })).id;
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Split Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  await db.insert(courtPricings).values({
    courtId: court.id, startTime: '06:00:00', endTime: '22:00:00', price, validFrom: '2020-01-01',
  });

  const recruitment = await recruitmentFixtureColumns(host, 'SINGLES', START, 60);
  const skills = await skillIds();
  const [request] = await db.insert(matchmakingRequests).values({
    playerId: host, matchType: 'SINGLES', minSkillLevelId: skills.min, maxSkillLevelId: skills.max,
    status: 'MATCHED', ...recruitment,
  }).returning();
  const [match] = await db.insert(matches).values({
    matchType: 'SINGLES', scheduledAt: START, bookingDeadlineAt: START, status: 'PENDING_COURT',
  }).returning();
  await db.insert(matchmakingMatches).values({
    matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date(),
  });
  await db.insert(matchPlayers).values([
    { matchId: match.id, playerId: host, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
    { matchId: match.id, playerId: member, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
  ]);
  await db.insert(matchmakingInvitations).values({
    requestId: request.id, createdBy: host, playerId: member, kind: 'INVITE',
    decidedBy: member, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000), respondedAt: new Date(),
  });

  return { host, member, matchId: match.id, requestId: request.id, courtId: court.id };
}

async function fund(userId: number, amount: string) {
  await walletService.credit({ userId, amount, entryType: 'TOP_UP' });
}

beforeEach(async () => {
  bookingConfig.clearCache();
  refundConfig.clearCache();
  ownerConfig.clearCache();
});

describe('split booking for a closed recruitment', () => {
  it('previews equal shares, assigns the rounding cent to the host and places the booking', async () => {
    const fx = await fixture('100000.01');
    await fund(fx.host, '500000');
    await fund(fx.member, '500000');

    const preview = await matchBookingSplitService.previewBooking(fx.host, fx.matchId, fx.courtId);
    expect(preview.canBook).toBe(true);
    expect(preview.totalAmount).toBe(100000.01);
    expect(preview.members).toHaveLength(2);
    expect(preview.members.find(m => m.playerId === fx.host)?.amount).toBe(50000.01);
    expect(preview.members.find(m => m.playerId === fx.member)?.amount).toBe(50000);

    const result = await matchBookingSplitService.placeBooking(fx.host, fx.matchId, fx.courtId);
    expect(result.status).toBe('CONFIRMED');

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, result.bookingId));
    expect(booking.status).toBe('CONFIRMED');
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(payment.provider).toBe('WALLET_SPLIT');
    expect(payment.status).toBe('SUCCESS');
    expect(payment.amount).toBe('100000.01');

    const shares = await db.select().from(bookingCostShares).where(eq(bookingCostShares.bookingId, booking.id));
    expect(shares).toHaveLength(2);
    expect(shares.every(share => share.status === 'PAID')).toBe(true);
    expect(shares.reduce((sum, share) => sum + Number(share.amount), 0)).toBeCloseTo(100000.01, 2);

    expect((await walletService.getWallet(fx.host)).balance).toBe('449999.99');
    expect((await walletService.getWallet(fx.member)).balance).toBe('450000.00');

    const [match] = await db.select().from(matches).where(eq(matches.id, fx.matchId));
    expect(match.status).toBe('CONFIRMED');
    expect(match.bookingId).toBe(booking.id);
    expect(match.courtId).toBe(fx.courtId);
    const [request] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, fx.requestId));
    expect(request.bookingId).toBe(booking.id);

    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_SPLIT_COST_SHARED'))).toHaveLength(2);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_COURT_UPDATED'))).toHaveLength(1);
  });

  it('rejects the whole booking when one member has insufficient wallet balance', async () => {
    const fx = await fixture();
    await fund(fx.host, '500000');

    await expect(matchBookingSplitService.placeBooking(fx.host, fx.matchId, fx.courtId)).rejects.toMatchObject({
      code: 'MATCH_SPLIT_INSUFFICIENT_WALLET',
      details: [expect.objectContaining({ playerId: fx.member, shortfall: 50000 })],
    });

    expect(await db.select().from(bookings)).toHaveLength(0);
    expect(await db.select().from(payments)).toHaveLength(0);
    expect(await db.select().from(bookingCostShares)).toHaveLength(0);
    expect((await walletService.getWallet(fx.host)).balance).toBe('500000.00');
    const [match] = await db.select().from(matches).where(eq(matches.id, fx.matchId));
    expect(match.status).toBe('PENDING_COURT');
  });

  it('notifies only the members with insufficient balance and deduplicates reminders per day', async () => {
    const fx = await fixture();
    await fund(fx.host, '500000');

    const first = await matchBookingSplitService.remindTopup(fx.host, fx.matchId, fx.courtId);
    expect(first.sent).toBe(1);
    expect(first.recipients[0]).toMatchObject({ playerId: fx.member, shortfall: 50000 });
    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_SPLIT_TOPUP_REQUIRED'))).toHaveLength(1);

    const second = await matchBookingSplitService.remindTopup(fx.host, fx.matchId, fx.courtId);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_SPLIT_TOPUP_REQUIRED'))).toHaveLength(1);
  });

  it('is idempotent for a repeated place request', async () => {
    const fx = await fixture();
    await fund(fx.host, '500000');
    await fund(fx.member, '500000');

    const first = await matchBookingSplitService.placeBooking(fx.host, fx.matchId, fx.courtId);
    const second = await matchBookingSplitService.placeBooking(fx.host, fx.matchId, fx.courtId);

    expect(second.bookingId).toBe(first.bookingId);
    expect((await walletService.getWallet(fx.host)).balance).toBe('450000.00');
    expect((await walletService.getWallet(fx.member)).balance).toBe('450000.00');
    expect(await db.select().from(payments).where(eq(payments.bookingId, first.bookingId))).toHaveLength(1);
    expect(await db.select().from(bookingCostShares).where(eq(bookingCostShares.bookingId, first.bookingId))).toHaveLength(2);
  });

  it('cancels the split booking and refunds every share when the host cancels with KEEP', async () => {
    const fx = await fixture();
    await fund(fx.host, '500000');
    await fund(fx.member, '500000');
    const placed = await matchBookingSplitService.placeBooking(fx.host, fx.matchId, fx.courtId);

    const cancelled = await recruitmentLifecycleService.cancel(fx.host, fx.requestId, 'KEEP');
    expect(cancelled.status).toBe('CANCELLED');
    expect(await db.select().from(matchBookingCancellationJobs).where(eq(matchBookingCancellationJobs.bookingId, placed.bookingId))).toHaveLength(1);

    await matchBookingCancellationService.processPending();
    await refundService.processPending();

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, placed.bookingId));
    expect(booking.status).toBe('CANCELLED');
    const shares = await db.select().from(bookingCostShares).where(eq(bookingCostShares.bookingId, placed.bookingId));
    expect(shares.every(share => share.status === 'REFUNDED')).toBe(true);
    expect((await walletService.getWallet(fx.host)).balance).toBe('500000.00');
    expect((await walletService.getWallet(fx.member)).balance).toBe('500000.00');
    expect(await db.select().from(paymentRefunds)).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'BOOKING_REFUNDED'))).toHaveLength(2);
  });
});
