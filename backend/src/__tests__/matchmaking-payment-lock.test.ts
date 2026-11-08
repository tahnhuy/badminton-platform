import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  db, bookings, courts, facilities, payments, matchmakingRequests, matchmakingInvitations,
  matchmakingMatches, matches, matchPlayers, notifications,
} from '../db';
import { as, matchFindingPost, player, setConfig } from './social-fixture';
import { createTestUser } from './test-helpers';
import { bookingRepository } from '../repositories/booking/BookingRepository';
import { bookingPaymentGuard } from '../services/payments/BookingPaymentGuardService';
import { paymentService } from '../services/payments/payment.service';

beforeEach(async () => {
  await setConfig('MATCHMAKING_ENABLED', 'true');
  await setConfig('SOCIAL_FEED_ENABLED', 'true');
});

async function fixture(sealed = false, legacy = false, matchType: 'SINGLES' | 'GROUP' = 'SINGLES') {
  const host = await player(); const member = await player();
  const { requestId } = await matchFindingPost(host, { matchType, ...(matchType === 'GROUP' ? { capacity: 4, minPlayers: 2 } : {}) }, true);
  const invitation = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: member });
  expect(invitation.status).toBe(201);
  expect((await as(member, 'put', `/api/v1/matchmaking-invitations/${invitation.body.data.id}`).send({ decision: 'ACCEPTED' })).status).toBe(200);
  if (sealed) expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(200);
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Court', phone: '0900000000',
    status: 'ACTIVE', address: '1 Street', district: 'District', city: 'City', latitude: '10', longitude: '106',
    openingTime: '06:00', closingTime: '23:00' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: '1', status: 'ACTIVE' }).returning();
  const [booking] = await db.insert(bookings).values({ playerId: host, courtId: court.id, bookingDate: '2026-12-01',
    startTime: '08:00', endTime: '09:00', unitPrice: '100000', totalAmount: '100000', status: 'PENDING_PAYMENT',
    bookingCode: `test-${requestId}`, expiresAt: new Date(Date.now() + 600_000) }).returning();
  const [payment] = await db.insert(payments).values({ bookingId: booking.id, amount: '100000', provider: 'MOCK',
    paymentMethod: 'ONLINE', status: 'PENDING' }).returning();
  const [link] = await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId));
  if (legacy) await db.update(matches).set({ bookingId: booking.id }).where(eq(matches.id, link.matchId));
  else await db.update(matchmakingRequests).set({ bookingId: booking.id }).where(eq(matchmakingRequests.id, requestId));
  return { host, member, requestId, booking, payment, matchId: link?.matchId, invitationId: invitation.body.data.id as number };
}

const withdraw = (f: Awaited<ReturnType<typeof fixture>>) => as(f.member, 'post', `/api/v1/matchmaking-requests/${f.requestId}/withdraw`);
const remove = (f: Awaited<ReturnType<typeof fixture>>) => as(f.host, 'delete', `/api/v1/matchmaking-requests/${f.requestId}/members/${f.member}`);
const confirm = (f: Awaited<ReturnType<typeof fixture>>) => paymentService.processMockPaymentConfirm({ bookingId: f.booking.id, paymentId: f.payment.id, actorId: f.host });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

async function assertUnchanged(f: Awaited<ReturnType<typeof fixture>>) {
  const [row] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, f.invitationId));
  expect(row.status).toBe('ACCEPTED');
  const [request] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, f.requestId));
  expect(request.status).toBe(f.matchId ? 'MATCHED' : 'OPEN');
  if (f.matchId) {
    const [participant] = await db.select().from(matchPlayers).where(and(eq(matchPlayers.matchId, f.matchId), eq(matchPlayers.playerId, f.member)));
    expect(participant.status).toBe('ACTIVE');
  }
}

describe('Payment barrier for member departures', () => {
  it.each([false, true])('rejects withdrawal and host removal after payment, sealed=%s', async sealed => {
    const f = await fixture(sealed);
    expect((await confirm(f)).success).toBe(true);
    const notes = await db.select().from(notifications);
    expect((await withdraw(f)).status).toBe(409);
    expect((await remove(f)).status).toBe(409);
    await assertUnchanged(f);
    expect(await db.select().from(notifications)).toEqual(notes);
  });

  it.each(['REFUNDED', 'REFUND_PENDING', 'REFUND_FAILED'])('keeps the lock for %s even if a newer attempt is pending', async status => {
    const f = await fixture();
    await db.update(payments).set({ status }).where(eq(payments.id, f.payment.id));
    await db.insert(payments).values({ bookingId: f.booking.id, amount: '100000', provider: 'MOCK', paymentMethod: 'ONLINE', status: 'PENDING' });
    expect((await withdraw(f)).status).toBe(409);
    expect((await remove(f)).status).toBe(409);
    await assertUnchanged(f);
  });

  it('does not reopen a paid GROUP or release its match player', async () => {
    const f = await fixture(true, false, 'GROUP');
    expect((await confirm(f)).success).toBe(true);
    expect((await remove(f)).status).toBe(409);
    await assertUnchanged(f);
  });

  it('honors a persisted paid_at even when the current status is different', async () => {
    const f = await fixture();
    await db.update(payments).set({ status: 'FAILED', paidAt: new Date() }).where(eq(payments.id, f.payment.id));
    expect((await withdraw(f)).status).toBe(409);
    await assertUnchanged(f);
  });

  it('checks a legacy Match booking and both withdrawal aliases', async () => {
    const f = await fixture(true, true);
    expect((await confirm(f)).success).toBe(true);
    expect((await as(f.member, 'post', `/api/v1/matches/${f.matchId}/leave`)).status).toBe(409);
    expect((await as(f.member, 'post', `/api/v1/matchmaking-invitations/${f.invitationId}/withdraw`)).status).toBe(409);
    await assertUnchanged(f);
  });

  it.each(['PENDING', 'FAILED', 'EXPIRED'])('permits departures without a successful payment (%s)', async status => {
    const f = await fixture();
    await db.update(payments).set({ status }).where(eq(payments.id, f.payment.id));
    expect((await remove(f)).status).toBe(200);
  });

  it('allows host cancellation after payment under its separate policy', async () => {
    const f = await fixture(true);
    expect((await confirm(f)).success).toBe(true);
    expect((await as(f.host, 'post', `/api/v1/matchmaking-requests/${f.requestId}/cancel`).send({ bookingAction: 'KEEP' })).status).toBe(200);
  });

  it.each(['withdraw', 'remove'])('rejects %s waiting behind a successful payment transaction', async action => {
    const f = await fixture(true);
    const locked = deferred(); const release = deferred(); const waiting = deferred();
    const original = bookingRepository.lockBookingById.bind(bookingRepository);
    let calls = 0;
    const spy = vi.spyOn(bookingRepository, 'lockBookingById').mockImplementation(async (...args) => {
      const call = ++calls;
      if (call === 2) waiting.resolve();
      const row = await original(...args);
      if (call === 1) { locked.resolve(); await release.promise; }
      return row;
    });
    const payment = confirm(f);
    let departure: PromiseLike<unknown> | undefined;
    try {
      await locked.promise;
      departure = (action === 'remove' ? remove(f) : withdraw(f)).then(r => r);
      await waiting.promise;
      release.resolve();
      expect((await payment).success).toBe(true);
      expect(await departure).toMatchObject({ status: 409 });
      await assertUnchanged(f);
    } finally { release.resolve(); await Promise.allSettled([payment, departure]); spy.mockRestore(); }
  });

  it('commits a departure that holds the booking barrier before payment starts', async () => {
    const f = await fixture(true);
    const locked = deferred(); const release = deferred(); const waiting = deferred();
    const guard = bookingPaymentGuard.hasSuccessfulPayment.bind(bookingPaymentGuard);
    const guardSpy = vi.spyOn(bookingPaymentGuard, 'hasSuccessfulPayment').mockImplementation(async (...args) => {
      const result = await guard(...args); locked.resolve(); await release.promise; return result;
    });
    const original = bookingRepository.lockBookingById.bind(bookingRepository);
    let calls = 0;
    const spy = vi.spyOn(bookingRepository, 'lockBookingById').mockImplementation(async (...args) => {
      if (++calls === 2) waiting.resolve();
      return original(...args);
    });
    const departure = withdraw(f).then(r => r);
    let payment: ReturnType<typeof confirm> | undefined;
    try {
      await locked.promise;
      payment = confirm(f);
      await waiting.promise;
      release.resolve();
      expect((await departure).status).toBe(200);
      expect((await payment).success).toBe(true);
    } finally { release.resolve(); await Promise.allSettled([payment, departure]); spy.mockRestore(); guardSpy.mockRestore(); }
  });
});
