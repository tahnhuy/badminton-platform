import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, payments,
  matches, matchPlayers, matchmakingRequests, matchmakingMatches, matchmakingInvitations, posts,
} from '../db';
import { app } from '../app';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { skillIds } from './social-fixture';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
const START = new Date(`${BOOKING_DATE}T18:00:00+07:00`);
let host: number;
let member: number;
let courtId: number;

async function fixture() {
  host = (await createTestUser({ role: 'PLAYER' })).id;
  member = (await createTestUser({ role: 'PLAYER' })).id;
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Link API Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });

  const recruitment = await recruitmentFixtureColumns(host, 'SINGLES', START, 60);
  const skills = await skillIds();
  const [request] = await db.insert(matchmakingRequests).values({
    playerId: host, matchType: 'SINGLES', minSkillLevelId: skills.min, maxSkillLevelId: skills.max,
    status: 'MATCHED', ...recruitment,
  }).returning();
  const [match] = await db.insert(matches).values({ matchType: 'SINGLES', scheduledAt: START, bookingDeadlineAt: START, status: 'PENDING_COURT' }).returning();
  await db.insert(matchmakingMatches).values({ matchmakingRequestId: request.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date() });
  await db.insert(matchPlayers).values([
    { matchId: match.id, playerId: host, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
    { matchId: match.id, playerId: member, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
  ]);
  await db.insert(matchmakingInvitations).values({
    requestId: request.id, createdBy: host, playerId: member, kind: 'INVITE',
    decidedBy: member, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000), respondedAt: new Date(),
  });
  return { matchId: match.id };
}

async function paidBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [booking] = await db.insert(bookings).values({
    playerId: host, courtId, bookingDate: BOOKING_DATE, startTime: '18:00:00', endTime: '19:00:00',
    unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `API-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...overrides,
  }).returning();
  await walletService.credit({ userId: host, amount: '100000', entryType: 'TOP_UP' });
  await paymentService.createBookingPayment({ bookingId: booking.id, actorId: host, provider: 'WALLET' });
  return booking;
}

const as = (id: number) => ({ post: (url: string, body: unknown) => request(app).post(url).set('x-user-id', String(id)).send(body as object) });

beforeEach(async () => {
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
  await fixture();
});

describe('MM-19 booking-link API', () => {
  it('links the host booking and replays idempotently', async () => {
    const { matchId } = await fixture();
    const booking = await paidBooking();

    const first = await as(host).post(`/api/v1/matches/${matchId}/booking`, { bookingId: booking.id });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.data).toMatchObject({ matchId, status: 'CONFIRMED', bookingId: booking.id });

    const replay = await as(host).post(`/api/v1/matches/${matchId}/booking`, { bookingId: booking.id });
    expect(replay.status).toBe(200);
    expect(replay.body.data.status).toBe('CONFIRMED');
  });

  it('rejects a booking outside the window with a clear code', async () => {
    const { matchId } = await fixture();
    const booking = await paidBooking({ startTime: '20:00:00', endTime: '21:00:00' });
    const response = await as(host).post(`/api/v1/matches/${matchId}/booking`, { bookingId: booking.id });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MATCH_BOOKING_INVALID');
  });

  it('hides the Match from a non-host participant', async () => {
    const { matchId } = await fixture();
    const booking = await paidBooking();
    const response = await as(member).post(`/api/v1/matches/${matchId}/booking`, { bookingId: booking.id });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('MATCH_NOT_FOUND');
  });

  it('validates the request body', async () => {
    const { matchId } = await fixture();
    const response = await as(host).post(`/api/v1/matches/${matchId}/booking`, {});
    expect(response.status).toBe(400);
  });

  it('returns candidates with eligibility reasons', async () => {
    const { matchId } = await fixture();
    const good = await paidBooking();
    await paidBooking({ startTime: '20:00:00', endTime: '21:00:00' });
    const response = await request(app).get(`/api/v1/matches/${matchId}/booking-candidates`).set('x-user-id', String(host));
    expect(response.status).toBe(200);
    expect(response.body.data.find((row: { id: number }) => row.id === good.id)).toMatchObject({ eligible: true });
    expect(response.body.data.some((row: { eligible: boolean }) => !row.eligible)).toBe(true);
  });
});
