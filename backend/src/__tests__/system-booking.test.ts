import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, users, facilities, courts, courtPricings, bookings, payments, bookingPricingDetails,
  matches, tournaments, tournamentMatches, paymentRefunds,
} from '../db';
import { createTestUser } from './test-helpers';
import { bookingService } from '../services/booking/booking.service';
import { ownerBookingReadService } from '../services/owner/OwnerBookingReadService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 3);

let ownerId: number;
let actorId: number;
let courtId: number;
let tournamentMatchId: number;

async function fixture() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const actor = await createTestUser({ role: 'ADMIN' });
  ownerId = owner.id;
  actorId = actor.id;

  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'System Court', phone: '0900000000', status: 'ACTIVE',
    address: '1 Test', district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });

  const [tournament] = await db.insert(tournaments).values({
    creatorId: actor.id, name: 'Giải test', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES',
    participantLimit: 8, status: 'DRAFT', registrationStart: new Date(), registrationEnd: new Date(Date.now() + 86400000),
    tournamentStart: new Date(Date.now() + 86400000), tournamentEnd: new Date(Date.now() + 172800000),
  }).returning();
  const [match] = await db.insert(matches).values({
    matchType: 'SINGLES', scheduledAt: new Date(`${BOOKING_DATE}T10:00:00+07:00`), status: 'PENDING_COURT',
  }).returning();
  const [tournamentMatch] = await db.insert(tournamentMatches).values({
    tournamentId: tournament.id, matchId: match.id, roundIndex: 0, matchIndex: 0, resolution: 'PENDING',
  }).returning();
  tournamentMatchId = tournamentMatch.id;
}

beforeEach(async () => {
  await db.delete(paymentRefunds);
  await db.delete(payments);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(tournamentMatches);
  await db.delete(matches);
  await db.delete(tournaments);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);
  await fixture();
});

describe('SYS-BK-01 tournament system booking', () => {
  it('creates a CONFIRMED non-payment booking and links it through MATCHES.booking_id', async () => {
    const { bookingId } = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.expiresAt).toBeNull();
    expect(await db.select().from(payments).where(eq(payments.bookingId, bookingId))).toHaveLength(0);

    const [link] = await db.select().from(matches).where(eq(matches.bookingId, bookingId));
    expect(link.id).toBeTruthy();

    const detail = await ownerBookingReadService.detail(ownerId, bookingId);
    expect(detail.bookingKind).toBe('TOURNAMENT');
    expect(detail.refundStatus).toBe('NONE');

    // Not exposed as a Player booking: hidden from My Bookings and detail.
    const mine = await bookingService.listMyBookings(actorId, { page: 1, limit: 10 });
    expect(mine.items).toHaveLength(0);
    await expect(bookingService.getBookingDetail(actorId, bookingId)).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND' });
  });

  it('rejects an overlapping system booking with TOURNAMENT_COURT_UNAVAILABLE', async () => {
    await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });

    const [otherMatch] = await db.insert(matches).values({ matchType: 'SINGLES', scheduledAt: new Date(`${BOOKING_DATE}T10:30:00+07:00`), status: 'PENDING_COURT' }).returning();
    const [otherTournamentMatch] = await db.insert(tournamentMatches).values({ tournamentId: (await db.select().from(tournaments))[0].id, matchId: otherMatch.id, roundIndex: 0, matchIndex: 1, resolution: 'PENDING' }).returning();

    await expect(bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:30', endTime: '11:30',
      source: 'TOURNAMENT', sourceId: otherTournamentMatch.id, actorId,
    })).rejects.toMatchObject({ code: 'TOURNAMENT_COURT_UNAVAILABLE' });
  });

  it('releases idempotently without creating a refund or payment', async () => {
    const { bookingId } = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });

    await bookingService.releaseSystemBooking({ bookingId, reason: 'Tournament match cancelled' });
    await bookingService.releaseSystemBooking({ bookingId, reason: 'Tournament match cancelled' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking.status).toBe('CANCELLED');
    expect(booking.cancellationReason).toBe('Tournament match cancelled');
    expect(await db.select().from(payments).where(eq(payments.bookingId, bookingId))).toHaveLength(0);
    expect(await db.select().from(paymentRefunds)).toHaveLength(0);
  });

  it('is not Player- or Owner-cancellable', async () => {
    const { bookingId } = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });

    await expect(bookingService.cancelBooking(actorId, bookingId)).rejects.toMatchObject({ code: 'BOOKING_NOT_CANCELLABLE' });
    await expect(bookingService.cancelBookingAsOwner(ownerId, bookingId, 'Incident')).rejects.toMatchObject({
      code: 'OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE',
    });
  });

  it('rejects a second booking for the same tournament match', async () => {
    await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });
    await expect(bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '12:00', endTime: '13:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    })).rejects.toMatchObject({ code: 'TOURNAMENT_COURT_UNAVAILABLE' });
  });

  it('allows rescheduling after the previous system booking was released', async () => {
    const first = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '10:00', endTime: '11:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });
    await bookingService.releaseSystemBooking({ bookingId: first.bookingId, reason: 'Reschedule' });

    const second = await bookingService.createSystemBooking({
      courtId, date: BOOKING_DATE, startTime: '12:00', endTime: '13:00',
      source: 'TOURNAMENT', sourceId: tournamentMatchId, actorId,
    });

    const [linked] = await db.select().from(matches).where(eq(matches.bookingId, second.bookingId));
    expect(linked).toBeTruthy();
    const [oldBooking] = await db.select().from(bookings).where(eq(bookings.id, first.bookingId));
    expect(oldBooking.status).toBe('CANCELLED');
  });
});
