import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, payments, notifications,
  matches, matchPlayers, matchmakingRequests, matchmakingMatches, matchmakingInvitations, posts, matchBookingCancellationJobs,
} from '../db';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { skillIds } from './social-fixture';
import { matchBookingLinkService } from '../services/matchmaking/MatchBookingLinkService';
import { bookingService } from '../services/booking/booking.service';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { matchmakingExpiryService } from '../services/matchmaking/MatchmakingExpiryService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
const START = new Date(`${BOOKING_DATE}T18:00:00+07:00`);

let host: number;
let member: number;
let other: number;
let courtId: number;

async function createBooking(owner: number, overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [booking] = await db.insert(bookings).values({
    playerId: owner, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `LNK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...overrides,
  }).returning();
  return booking;
}

async function paidBooking(owner: number, overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const booking = await createBooking(owner, overrides);
  await walletService.credit({ userId: owner, amount: '100000', entryType: 'TOP_UP' });
  await paymentService.createBookingPayment({ bookingId: booking.id, actorId: owner, provider: 'WALLET' });
  return booking;
}

async function createMatchWithRequest(owner: number, participants: number[], options: { startAt?: Date; bookingId?: number } = {}) {
  const startAt = options.startAt ?? START;
  const recruitment = await recruitmentFixtureColumns(owner, 'SINGLES', startAt, 60);
  const skills = await skillIds();
  const [request] = await db.insert(matchmakingRequests).values({
    playerId: owner, matchType: 'SINGLES', minSkillLevelId: skills.min, maxSkillLevelId: skills.max,
    status: 'MATCHED', bookingId: options.bookingId, ...recruitment,
    startAt, durationMinutes: 60,
  }).returning();
  const [match] = await db.insert(matches).values({
    matchType: 'SINGLES', scheduledAt: startAt, bookingDeadlineAt: startAt,
    bookingId: options.bookingId, courtId: options.bookingId ? courtId : null, status: 'PENDING_COURT',
  }).returning();
  await db.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });
  await db.insert(matchPlayers).values(participants.map((playerId, index) => ({ matchId: match.id, playerId, teamNo: index + 1, status: 'ACTIVE', joinedAt: new Date() })));
  const members = participants.filter((playerId) => playerId !== owner);
  if (members.length > 0) {
    await db.insert(matchmakingInvitations).values(members.map((playerId) => ({
      requestId: request.id, createdBy: owner, playerId, kind: 'INVITE' as const,
      decidedBy: playerId, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000), respondedAt: new Date(),
    })));
  }
  return { requestId: request.id, matchId: match.id };
}

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(matchBookingCancellationJobs);
  await db.delete(matchmakingInvitations);
  await db.delete(matchmakingMatches);
  await db.delete(matchPlayers);
  await db.delete(matchmakingRequests);
  await db.delete(posts);
  await db.delete(matches);
  await db.delete(payments);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);

  host = (await createTestUser({ role: 'PLAYER' })).id;
  member = (await createTestUser({ role: 'PLAYER' })).id;
  other = (await createTestUser({ role: 'PLAYER' })).id;
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Link Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', latitude: '10', longitude: '106',
    openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
});

describe('MM-07 Match booking linkage service', () => {
  it('links a paid, same-window booking owned by the host and notifies members', async () => {
    const { matchId, requestId } = await createMatchWithRequest(host, [host, member]);
    const booking = await paidBooking(host);

    const result = await matchBookingLinkService.linkBooking(host, matchId, booking.id);
    expect(result).toMatchObject({ matchId, status: 'CONFIRMED', bookingId: booking.id, courtId });

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(match).toMatchObject({ status: 'CONFIRMED', bookingId: booking.id, courtId });
    const [request] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, requestId));
    expect(request.bookingId).toBe(booking.id);
    expect(await db.select().from(notifications).where(eq(notifications.userId, member))).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.type, 'MM_COURT_UPDATED'))).toHaveLength(1);

    const replay = await matchBookingLinkService.linkBooking(host, matchId, booking.id);
    expect(replay.status).toBe('CONFIRMED');
  });

  it('rejects an unpaid booking', async () => {
    const { matchId } = await createMatchWithRequest(host, [host, member]);
    const booking = await createBooking(host);
    await expect(matchBookingLinkService.linkBooking(host, matchId, booking.id))
      .rejects.toMatchObject({ code: 'MATCH_BOOKING_INVALID' });
  });

  it('rejects a booking owned by someone else', async () => {
    const { matchId } = await createMatchWithRequest(host, [host, member]);
    const booking = await paidBooking(other);
    await expect(matchBookingLinkService.linkBooking(host, matchId, booking.id))
      .rejects.toMatchObject({ code: 'MATCH_BOOKING_INVALID' });
  });

  it('rejects a booking outside the recruitment window or duration', async () => {
    const { matchId } = await createMatchWithRequest(host, [host, member]);
    const booking = await paidBooking(host, { startTime: '19:00:00', endTime: '20:00:00' });
    await expect(matchBookingLinkService.linkBooking(host, matchId, booking.id))
      .rejects.toMatchObject({ code: 'MATCH_BOOKING_INVALID' });
  });

  it('rejects a booking already linked to another Match', async () => {
    const otherMatch = await createMatchWithRequest(other, [other, member]);
    const booking = await paidBooking(host);
    await db.update(matches).set({ bookingId: booking.id, status: 'CONFIRMED' }).where(eq(matches.id, otherMatch.matchId));
    const { matchId } = await createMatchWithRequest(host, [host, member]);

    await expect(matchBookingLinkService.linkBooking(host, matchId, booking.id))
      .rejects.toMatchObject({ code: 'MATCH_BOOKING_ALREADY_LINKED' });
  });

  it('lets exactly one of two concurrent Matches link the same booking', async () => {
    const first = await createMatchWithRequest(host, [host, member]);
    const second = await createMatchWithRequest(host, [host, member]);
    const booking = await paidBooking(host);

    const results = await Promise.allSettled([
      matchBookingLinkService.linkBooking(host, first.matchId, booking.id),
      matchBookingLinkService.linkBooking(host, second.matchId, booking.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rows = await db.select().from(matches).where(eq(matches.bookingId, booking.id));
    expect(rows).toHaveLength(1);
  });

  it('cancelling a booking while linking never leaves a CONFIRMED Match on a cancelled booking', async () => {
    const { matchId } = await createMatchWithRequest(host, [host, member]);
    const booking = await paidBooking(host);

    await Promise.allSettled([
      matchBookingLinkService.linkBooking(host, matchId, booking.id),
      bookingService.cancelBooking(host, booking.id),
    ]);
    await matchmakingExpiryService.runOnce();

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    const [current] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    if (match.status === 'CONFIRMED') expect(current.status).not.toBe('CANCELLED');
    if (current.status === 'CANCELLED') expect(match.status).not.toBe('CONFIRMED');
  });

  it('lists only the host paid bookings with a disable reason', async () => {
    const { matchId } = await createMatchWithRequest(host, [host, member]);
    const good = await paidBooking(host);
    await paidBooking(host, { startTime: '20:00:00', endTime: '21:00:00' });

    const candidates = await matchBookingLinkService.listCandidates(host, matchId);
    expect(candidates.items).toHaveLength(2);
    const eligible = candidates.items.find((item: { id: number }) => item.id === good.id);
    expect(eligible).toMatchObject({ eligible: true, reason: null });
    expect(candidates.items.some((item: { eligible: boolean; reason: string | null }) => !item.eligible && item.reason === 'WRONG_WINDOW')).toBe(true);
  });
});
