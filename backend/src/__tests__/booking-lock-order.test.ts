import { describe, it, expect, beforeEach } from 'vitest';
import {
  db, users, facilities, courts, courtPricings, bookings, bookingPricingDetails, courtSlotBlocks,
} from '../db';
import { createTestUser } from './test-helpers';
import { bookingService } from '../services/booking/booking.service';
import { ownerFacilityService } from '../services/owner/OwnerFacilityService';
import { ownerSlotBlockService } from '../services/owner/OwnerSlotBlockService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let ownerId: number;
let playerId: number;
let facilityId: number;
let courtId: number;

beforeEach(async () => {
  await db.delete(courtSlotBlocks);
  await db.delete(bookingPricingDetails);
  await db.delete(bookings);
  await db.delete(courtPricings);
  await db.delete(courts);
  await db.delete(facilities);
  await db.delete(users);

  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const player = await createTestUser({ role: 'PLAYER' });
  ownerId = owner.id;
  playerId = player.id;
  const [facility] = await db.insert(facilities).values({
    ownerId, name: 'Lock Order Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
    district: 'Quận 1', city: 'TP. Hồ Chí Minh', latitude: '10', longitude: '106',
    openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  facilityId = facility.id;
  const [court] = await db.insert(courts).values({ facilityId, name: 'Sân 1', status: 'ACTIVE' }).returning();
  courtId = court.id;
  await db.insert(courtPricings).values({ courtId, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
});

describe('BK-15 booking lock order', () => {
  it('booking-creation vs maintenance block serializes on facility → court/date', async () => {
    const results = await Promise.allSettled([
      bookingService.createBooking(playerId, { courtId, bookingDate: BOOKING_DATE, startTime: '10:00', durationMinutes: 60 }),
      ownerSlotBlockService.create(ownerId, courtId, { bookingDate: BOOKING_DATE, startTime: '10:00', endTime: '11:00', reason: 'Repair' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await db.select().from(bookings)).length + (await db.select().from(courtSlotBlocks)).length).toBe(1);
  });

  it('booking-creation vs owner-hours update serializes on the facility row', async () => {
    const results = await Promise.allSettled([
      bookingService.createBooking(playerId, { courtId, bookingDate: BOOKING_DATE, startTime: '21:00', durationMinutes: 60 }),
      ownerFacilityService.update(ownerId, facilityId, { closingTime: '21:00' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('two concurrent duplicate bookings produce exactly one active hold', async () => {
    const input = { courtId, bookingDate: BOOKING_DATE, startTime: '14:00', durationMinutes: 60 } as const;
    const results = await Promise.allSettled([
      bookingService.createBooking(playerId, input),
      bookingService.createBooking(playerId, input),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });
});
