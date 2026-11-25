import { it, expect, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, facilities, courts, courtPricings, bookings, playerProfiles, skillLevels, payments, systemConfigs, matches, tournaments, tournamentMatches } from '../db';
import { createTestUser } from './test-helpers';
import { ownerSlotBlockService as blocks } from '../services/owner/OwnerSlotBlockService';
import { ownerScheduleService } from '../services/owner/OwnerScheduleService';
import { bookingConfig } from '../shared/config/booking-config';
import { bookingService } from '../services/booking/booking.service';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { ownerFacilityRepository } from '../repositories/owner/OwnerFacilityRepository';
const nextDate = () => addDaysToDateString(todayInAppTimezone(), 1);
async function fixture() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const player = await createTestUser({ role: 'PLAYER' });
  const [skill] = await db.select().from(skillLevels).limit(1);
  await db.insert(playerProfiles).values({ userId: player.id, fullName: 'Private Player', skillLevelId: skill.id, phone: '0901234567' });
  const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Schedule Club', phone: '0900000000', status: 'ACTIVE', address: 'A', district: 'D', city: 'C', latitude: '10', longitude: '106', openingTime: '06:00', closingTime: '23:00' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'C1', status: 'ACTIVE' }).returning();
  await db.insert(courtPricings).values({ courtId: court.id, startTime: '06:00', endTime: '22:00', price: '100000', validFrom: '2026-01-01' });
  return { owner, player, facility, court };
}
it('blocks Player availability/creation, releases one whole block idempotently', async () => {
  const { owner, player, court } = await fixture();
  const date = nextDate();
  const result = await blocks.create(owner.id, court.id, { bookingDate: date, startTime: '10:00', endTime: '11:00', reason: 'Repair' });
  const availability = await bookingService.getCourtAvailability(court.id, date);
  expect(availability.intervals.some(row => row.startTime <= '10:00' && row.endTime >= '11:00')).toBe(false);
  await expect(bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '10:00', durationMinutes: 60 })).rejects.toMatchObject({ code: 'BOOKING_SLOT_UNAVAILABLE' });
  await blocks.release(owner.id, court.id, result.blocks[0].id);
  await blocks.release(owner.id, court.id, result.blocks[0].id);
  expect((await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '10:00', durationMinutes: 60 })).status).toBe('PENDING_PAYMENT');
});
it('serializes concurrent Player booking vs maintenance: exactly one succeeds', async () => {
  const { owner, player, court } = await fixture();
  const date = nextDate();
  const result = await Promise.allSettled([blocks.create(owner.id, court.id, { bookingDate: date, startTime: '10:00', endTime: '11:00', reason: 'Repair' }), bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '10:00', durationMinutes: 60 })]);
  expect(result.filter(row => row.status === 'fulfilled')).toHaveLength(1);
});
it('rechecks facility eligibility after waiting for the maintenance facility lock', async () => {
  const { owner, facility, court } = await fixture();
  const lock = ownerFacilityRepository.lock.bind(ownerFacilityRepository);
  const spy = vi.spyOn(ownerFacilityRepository, 'lock').mockImplementationOnce(async (...args) => {
    await db.update(facilities).set({ status: 'SUSPENDED' }).where(eq(facilities.id, facility.id));
    return lock(...args);
  });
  try {
    await expect(blocks.create(owner.id, court.id, { bookingDate: nextDate(), startTime: '10:00', endTime: '11:00', reason: 'Repair' })).rejects.toMatchObject({ code: 'COURT_NOT_ELIGIBLE' });
  } finally {
    spy.mockRestore();
  }
});
it('displays availability causes and retains occupied slots after price/status changes', async () => {
  const { owner, player, facility, court } = await fixture();
  const date = nextDate();
  await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '10:00', durationMinutes: 60 });
  await blocks.create(owner.id, court.id, { bookingDate: date, startTime: '12:00', endTime: '13:00', reason: 'Repair' });
  await db.update(courtPricings).set({ validTo: todayInAppTimezone() });
  await db.update(facilities).set({ status: 'SUSPENDED' }).where(eq(facilities.id, facility.id));
  const schedule = await ownerScheduleService.read(owner.id, facility.id, date);
  const slots = schedule.courts[0].slots;
  expect(slots.some(row => row.state === 'BOOKED' && row.player?.phone === '0901234567')).toBe(true);
  expect(slots.some(row => row.state === 'BLOCKED')).toBe(true);
  expect(slots.filter(row => row.state === 'UNAVAILABLE').every(row => row.unavailableReasons?.includes('FACILITY_INACTIVE'))).toBe(true);
  expect(slots.filter(row => row.state === 'UNAVAILABLE').every(row => row.unavailableReasons?.includes('NO_PRICING'))).toBe(true);
});
it('reads the real private phone only for owned detail/schedule, excludes it from history', async () => {
  const { owner, player, facility, court } = await fixture();
  const held = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: nextDate(), startTime: '10:00', durationMinutes: 60 });
  const detailUrl = `/api/v1/owner/bookings/${held.id}`;
  const detail = await request(app).get(detailUrl).set('x-user-id', String(owner.id));
  expect(detail.status).toBe(200);
  expect(detail.body.data.player).toMatchObject({ fullName: 'Private Player', email: player.email, phone: '0901234567' });
  const other = await createTestUser({ role: 'COURT_OWNER' });
  expect((await request(app).get(detailUrl).set('x-user-id', String(other.id))).status).toBe(404);
  await db.update(playerProfiles).set({ phone: null }).where(eq(playerProfiles.userId, player.id));
  expect((await request(app).get(detailUrl).set('x-user-id', String(owner.id))).body.data.player.phone).toBeNull();
  const history = await request(app).get(`/api/v1/owner/facilities/${facility.id}/bookings`).set('x-user-id', String(owner.id));
  expect(history.body.data[0]).not.toHaveProperty('player');
});
it('allows maintenance beyond the Player booking window and marks sales unavailable', async () => {
  const { owner, facility, court } = await fixture();
  const date = addDaysToDateString(todayInAppTimezone(), 30);
  await blocks.create(owner.id, court.id, { bookingDate: date, startTime: '10:00', endTime: '11:00', reason: 'Planned repair' });
  const schedule = await ownerScheduleService.read(owner.id, facility.id, date);
  expect(schedule.courts[0].slots.find(row => row.state === 'UNAVAILABLE' && row.startTime === '06:00')?.unavailableReasons).toContain('OUTSIDE_BOOKING_WINDOW');
  expect(schedule.courts[0].slots.some(row => row.state === 'BLOCKED')).toBe(true);
  await expect(blocks.create(owner.id, court.id, { bookingDate: addDaysToDateString(todayInAppTimezone(), 91), startTime: '10:00', endTime: '11:00', reason: 'Too far' })).rejects.toMatchObject({ code: 'SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW' });
});

it('releases expired holds before maintenance and accepts touching effective bookings', async () => {
  const { owner, player, court } = await fixture();
  const date = nextDate();
  const stale = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '10:00', durationMinutes: 60 });
  await db.update(bookings).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(bookings.id, stale.id));
  await blocks.create(owner.id, court.id, { bookingDate: date, startTime: '10:00', endTime: '11:00', reason: 'Repair' });
  await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '14:00', durationMinutes: 60 });
  await blocks.create(owner.id, court.id, { bookingDate: date, startTime: '15:00', endTime: '16:00', reason: 'Adjacent' });
  const [expired] = await db.select().from(bookings).where(eq(bookings.id, stale.id));
  expect(expired.status).toBe('EXPIRED');
});
it('distinguishes past time and globally disabled booking without suppressing occupancy', async () => {
  const { owner, facility } = await fixture();
  const [original] = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, 'BOOKING_ENABLED'));
  try {
    await db.insert(systemConfigs).values({ configKey: 'BOOKING_ENABLED', configValue: 'false' }).onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'false' } });
    bookingConfig.clearCache();
    const future = await ownerScheduleService.read(owner.id, facility.id, nextDate());
    expect(future.courts[0].slots.every(row => row.unavailableReasons?.includes('BOOKING_DISABLED'))).toBe(true);
    const past = await ownerScheduleService.read(owner.id, facility.id, addDaysToDateString(todayInAppTimezone(), -1));
    expect(past.courts[0].slots.every(row => row.unavailableReasons?.includes('PAST'))).toBe(true);
  } finally {
    if (original) await db.update(systemConfigs).set({ configValue: original.configValue }).where(eq(systemConfigs.configKey, 'BOOKING_ENABLED'));
    else await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'BOOKING_ENABLED'));
    bookingConfig.clearCache();
  }
});
it('retains cancelled history and reads actual refund state instead of inferring it from cancellation', async () => {
  const { owner, player, facility, court } = await fixture();
  const held = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: nextDate(), startTime: '10:00', durationMinutes: 60 });
  await db.update(bookings).set({ status: 'CANCELLED', cancellationReason: 'Incident', cancelledAt: new Date() }).where(eq(bookings.id, held.id));
  const [payment] = await db.insert(payments).values({ bookingId: held.id, amount: '100000', provider: 'MOCK', paymentMethod: 'ONLINE', status: 'REFUND_PENDING' }).returning();
  const url = `/api/v1/owner/bookings/${held.id}`;
  expect((await request(app).get(url).set('x-user-id', String(owner.id))).body.data).toMatchObject({ status: 'CANCELLED', refundStatus: 'PENDING', cancellationReason: 'Incident' });
  await db.update(payments).set({ status: 'REFUND_FAILED' }).where(eq(payments.id, payment.id));
  expect((await request(app).get(url).set('x-user-id', String(owner.id))).body.data.refundStatus).toBe('FAILED');
  const history = await request(app).get(`/api/v1/owner/facilities/${facility.id}/bookings?status=CANCELLED`).set('x-user-id', String(owner.id));
  expect(history.body.meta.total).toBe(1);
});
it('shows tournament context without fabricated paid Player contact', async () => {
  const { owner, player, court } = await fixture();
  const held = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate: nextDate(), startTime: '10:00', durationMinutes: 60 });
  await db.update(bookings).set({ status: 'CONFIRMED' }).where(eq(bookings.id, held.id));
  const [match] = await db.insert(matches).values({ matchType: 'SINGLES', courtId: court.id, bookingId: held.id, scheduledAt: new Date(nextDate() + 'T10:00:00+07:00'), status: 'SCHEDULED' }).returning();
  const [tournament] = await db.insert(tournaments).values({ creatorId: player.id, name: 'Fixture tournament', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES', participantLimit: 8, status: 'DRAFT', registrationStart: new Date(), registrationEnd: new Date(), tournamentStart: new Date(), tournamentEnd: new Date() }).returning();
  await db.insert(tournamentMatches).values({ tournamentId: tournament.id, matchId: match.id, roundIndex: 0, matchIndex: 0, resolution: 'UNRESOLVED' });
  const detail = await request(app).get(`/api/v1/owner/bookings/${held.id}`).set('x-user-id', String(owner.id));
  expect(detail.body.data).toMatchObject({ bookingKind: 'TOURNAMENT', tournamentId: tournament.id, matchId: match.id, refundStatus: 'NONE' });
  expect(detail.body.data).not.toHaveProperty('player');
  await expect(blocks.create(owner.id, court.id, { bookingDate: nextDate(), startTime: '10:00', endTime: '11:00', reason: 'Repair' })).rejects.toMatchObject({ code: 'SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING' });
});
