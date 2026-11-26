import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  users,
  facilities,
  courts,
  bookings,
  bookingPricingDetails,
} from '../db';
import { createTestUser } from './test-helpers';
import { bookingStateService } from '../services/booking/booking-state.service';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { eq } from 'drizzle-orm';

const TODAY = todayInAppTimezone();
const YESTERDAY = addDaysToDateString(TODAY, -1);
const TOMORROW = addDaysToDateString(TODAY, 1);

describe('Booking state worker (BK-09)', () => {
  let playerId: number;
  let courtIds: number[];

  beforeEach(async () => {
    await db.delete(bookingPricingDetails);
    await db.delete(bookings);
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(users);

    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const player = await createTestUser({ role: 'PLAYER' });
    playerId = player.id;

    const [facility] = await db
      .insert(facilities)
      .values({
        ownerId: owner.id,
        name: 'CLB Worker Test',
        phone: '0908123456',
        status: 'ACTIVE',
        address: '1 Test',
        ward: 'W',
        district: 'D',
        city: 'C',
        openingTime: '00:00:00',
        closingTime: '23:59:59',
      })
      .returning();

    courtIds = [];
    for (let i = 0; i < 5; i += 1) {
      const [court] = await db
        .insert(courts)
        .values({ facilityId: facility.id, name: `Sân ${i + 1}`, status: 'ACTIVE' })
        .returning();
      courtIds.push(court.id);
    }
  });

  async function insertBooking(
    index: number,
    status: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    expiresAt: Date | null = null
  ) {
    await db.insert(bookings).values({
      playerId,
      courtId: courtIds[index],
      bookingCode: `BK-WORKER-${index}`,
      bookingDate,
      startTime,
      endTime,
      unitPrice: '100000',
      totalAmount: '100000',
      status,
      expiresAt,
    });
  }

  async function statusOf(index: number): Promise<string> {
    const rows = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.bookingCode, `BK-WORKER-${index}`));
    return rows[0].status;
  }

  it('expires due holds and advances time-based states exactly once', async () => {
    await insertBooking(0, 'PENDING_PAYMENT', TOMORROW, '10:00:00', '11:00:00', new Date(Date.now() - 60_000));
    await insertBooking(1, 'PENDING_PAYMENT', TOMORROW, '12:00:00', '13:00:00', new Date(Date.now() + 600_000));
    await insertBooking(2, 'CONFIRMED', TODAY, '00:00:00', '23:59:59');
    await insertBooking(3, 'CONFIRMED', TOMORROW, '10:00:00', '11:00:00');
    await insertBooking(4, 'IN_PROGRESS', YESTERDAY, '00:00:00', '00:00:01');

    const result = await bookingStateService.runOnce();
    expect(result).toEqual({ expired: 1, started: 1, completed: 1 });

    expect(await statusOf(0)).toBe('EXPIRED');
    expect(await statusOf(1)).toBe('PENDING_PAYMENT');
    expect(await statusOf(2)).toBe('IN_PROGRESS');
    expect(await statusOf(3)).toBe('CONFIRMED');
    expect(await statusOf(4)).toBe('COMPLETED');
  });

  it('is idempotent on a second sweep', async () => {
    await insertBooking(0, 'PENDING_PAYMENT', TOMORROW, '10:00:00', '11:00:00', new Date(Date.now() - 60_000));
    await bookingStateService.runOnce();

    const second = await bookingStateService.runOnce();
    expect(second).toEqual({ expired: 0, started: 0, completed: 0 });
  });
});
