import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, facilities, courts, courtPricings, bookings, bookingPricingDetails } from '../db';
import { createTestUser } from './test-helpers';
import { ownerPricingService } from '../services/owner/OwnerPricingService';
import { bookingService } from '../services/booking/booking.service';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';
import { ownerFacilityRepository } from '../repositories/owner/OwnerFacilityRepository';
const rate = { startTime: '06:00', endTime: '23:00', pricePerHour: 100000, validFrom: '2026-01-01' };
async function setup() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Club', phone: '0900000000', status: 'ACTIVE', address: 'A', district: 'D', city: 'C', latitude: '10', longitude: '106', openingTime: '06:00', closingTime: '23:00' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'C1', status: 'ACTIVE' }).returning();
  return { owner, court };
}
describe('Owner pricing', () => {
  it('updates the explicit ID even when times change; unknown ID never inserts', async () => {
    const { owner, court } = await setup();
    const url = `/api/v1/owner/courts/${court.id}/pricings`;
    const create = await request(app).post(url).set('x-user-id', String(owner.id)).send(rate);
    expect(create.status).toBe(201);
    const update = await request(app).post(url).set('x-user-id', String(owner.id)).send({ ...rate, pricingId: create.body.data.id, endTime: '22:00', validTo: '2026-12-31' });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ id: create.body.data.id, endTime: '22:00:00', validTo: '2026-12-31' });
    const unknown = await request(app).post(url).set('x-user-id', String(owner.id)).send({ ...rate, pricingId: 999999 });
    expect(unknown.status).toBe(404);
    expect((await ownerPricingService.list(owner.id, court.id))).toHaveLength(1);
  });
  it('rejects cross-owner pricing access and invalid ranges', async () => {
    const { owner, court } = await setup();
    const other = await createTestUser({ role: 'COURT_OWNER' });
    expect((await request(app).get(`/api/v1/owner/courts/${court.id}/pricings`).set('x-user-id', String(other.id))).status).toBe(404);
    expect((await request(app).post(`/api/v1/owner/courts/${court.id}/pricings`).set('x-user-id', String(owner.id)).send({ ...rate, endTime: '05:00' })).status).toBe(400);
  });
  it('concurrent overlapping requests create one interval and one conflict', async () => {
    const { owner, court } = await setup();
    const attempts = await Promise.allSettled([ownerPricingService.save(owner.id, court.id, rate), ownerPricingService.save(owner.id, court.id, rate)]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.code).toBe('PRICING_INTERVAL_OVERLAP');
  });
  it.each(['facility', 'court'])('rejects pricing when the %s is deleted while waiting for the facility lock', async target => {
    const { owner, court } = await setup();
    const lock = ownerFacilityRepository.lock.bind(ownerFacilityRepository);
    // Commit the concurrent deletion after the initial ownership read, before
    // the pricing transaction acquires the facility lock.
    const spy = vi.spyOn(ownerFacilityRepository, 'lock').mockImplementationOnce(async (...args) => {
      if (target === 'facility') await db.update(facilities).set({ deletedAt: new Date() }).where(eq(facilities.id, court.facilityId));
      else await db.update(courts).set({ deletedAt: new Date() }).where(eq(courts.id, court.id));
      return lock(...args);
    });
    try {
      await expect(ownerPricingService.save(owner.id, court.id, rate)).rejects.toMatchObject({ code: 'OWNER_COURT_NOT_FOUND' });
    } finally {
      spy.mockRestore();
    }
    expect(await db.select().from(courtPricings).where(eq(courtPricings.courtId, court.id))).toHaveLength(0);
  });
  it('price edits retain both unpaid and confirmed booking snapshots and their pricing detail', async () => {
    const { owner, court } = await setup();
    const price = await ownerPricingService.save(owner.id, court.id, rate);
    const player = await createTestUser({ role: 'PLAYER' });
    const bookingDate = addDaysToDateString(todayInAppTimezone(), 1);
    const first = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate, startTime: '10:00', durationMinutes: 60 });
    const second = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate, startTime: '12:00', durationMinutes: 60 });
    await db.update(bookings).set({ status: 'CONFIRMED' }).where(eq(bookings.id, second.id));
    await ownerPricingService.save(owner.id, court.id, { ...rate, pricingId: price.data.id, pricePerHour: 200000 });
    const rows = await db.select().from(bookings).where(eq(bookings.courtId, court.id));
    expect(rows.map(row => Number(row.totalAmount))).toEqual([100000, 100000]);
    const details = await db.select().from(bookingPricingDetails).where(eq(bookingPricingDetails.bookingId, first.id));
    expect(Number(details[0].price)).toBe(100000);
    const fresh = await bookingService.createBooking(player.id, { courtId: court.id, bookingDate, startTime: '14:00', durationMinutes: 60 });
    expect(Number(fresh.totalAmount)).toBe(200000);
  });
});
