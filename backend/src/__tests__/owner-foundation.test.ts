import { describe, it, expect } from 'vitest';
import { db, pool, facilities, courts, courtPricings, courtOwnerReviews, courtSlotBlocks } from '../db';
import { createTestUser } from './test-helpers';
import { ownerFacilityRepository } from '../repositories/owner/OwnerFacilityRepository';
import { ownerCourtRepository } from '../repositories/owner/OwnerCourtRepository';
import { lockCourtDate } from '../repositories/owner/owner-db';
import { courtSlotBlockRepository } from '../repositories/owner/CourtSlotBlockRepository';
import { parseOwnerConfig } from '../shared/config/owner-config';
import fs from 'node:fs';
import path from 'node:path';

async function fixture() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Owner fixture', phone: '0900000000', status: 'ACTIVE', address: '1 Test', district: 'D', city: 'C', openingTime: '06:00', closingTime: '23:00' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Court', status: 'ACTIVE' }).returning();
  return { owner, facility, court };
}
async function price(courtId: number, startTime: string, endTime: string, validFrom = '2026-10-01', validTo: string | null = null) {
  return db.insert(courtPricings).values({ courtId, startTime, endTime, validFrom, validTo, price: '100000' });
}
async function block(courtId: number, ownerId: number, startTime: string, endTime: string, status = 'ACTIVE') {
  return db.insert(courtSlotBlocks).values({ courtId, createdBy: ownerId, bookingDate: '2026-10-24', startTime, endTime, status, reason: 'Repair' });
}

describe('Owner persistence invariants', () => {
  it('keeps omitted ward NULL and isolates owned resource lookups', async () => {
    const { owner, facility, court } = await fixture();
    const other = await createTestUser({ role: 'COURT_OWNER' });
    expect((await ownerFacilityRepository.find(owner.id, facility.id))?.ward).toBeNull();
    expect(await ownerFacilityRepository.find(other.id, facility.id)).toBeNull();
    expect(await ownerCourtRepository.find(other.id, court.id)).toBeNull();
  });
  it('rejects invalid moderation status without changing valid rows', async () => {
    const { facility } = await fixture();
    await expect(pool.query('UPDATE facilities SET status=$1 WHERE id=$2', ['MAINTENANCE', facility.id])).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects overlapping prices on an inclusive final validity date, but allows touching hours/dates', async () => {
    const { court } = await fixture();
    await price(court.id, '06:00', '09:00', '2026-10-01', '2026-10-24');
    await expect(price(court.id, '08:00', '10:00', '2026-10-24', '2026-11-01')).rejects.toThrow();
    await price(court.id, '09:00', '10:00', '2026-10-24');
    await price(court.id, '06:00', '09:00', '2026-10-25');
  });
  it('accepts adjacent active blocks and released overlaps; rejects empty/inverted intervals and blank reasons', async () => {
    const { owner, court } = await fixture();
    await block(court.id, owner.id, '06:00', '07:00');
    await block(court.id, owner.id, '07:00', '08:00');
    await block(court.id, owner.id, '06:30', '07:30', 'RELEASED');
    await expect(block(court.id, owner.id, '06:30', '07:30')).rejects.toThrow();
    await expect(block(court.id, owner.id, '09:00', '09:00')).rejects.toThrow();
    await expect(db.insert(courtSlotBlocks).values({ courtId: court.id, createdBy: owner.id, bookingDate: '2026-10-24', startTime: '10:00', endTime: '11:00', status: 'ACTIVE', reason: ' ' })).rejects.toThrow();
  });
  it('serializes concurrent block writes and persists exactly one overlapping active block', async () => {
    const { owner, court } = await fixture();
    const attempt = () => db.transaction(async tx => {
      await lockCourtDate(tx, court.id, '2026-10-24');
      if (await courtSlotBlockRepository.overlaps(court.id, '2026-10-24', '12:00', '13:00', tx)) return false;
      await courtSlotBlockRepository.create({ courtId: court.id, createdBy: owner.id, bookingDate: '2026-10-24', startTime: '12:00', endTime: '13:00', status: 'ACTIVE', reason: 'Repair' }, tx);
      return true;
    });
    expect((await Promise.all([attempt(), attempt()])).sort()).toEqual([false, true]);
    expect(await courtSlotBlockRepository.active(court.id, '2026-10-24')).toHaveLength(1);
  });
  it('requires one review target, one pending attempt and a non-empty rejection reason', async () => {
    const { owner, facility, court } = await fixture();
    const admin = await createTestUser({ role: 'ADMIN' });
    const base = { kind: 'ONBOARDING', submittedValues: { name: 'Submitted' }, submittedBy: owner.id, status: 'PENDING' };
    await db.insert(courtOwnerReviews).values({ ...base, facilityId: facility.id });
    await expect(db.insert(courtOwnerReviews).values({ ...base, facilityId: facility.id })).rejects.toThrow();
    await expect(db.insert(courtOwnerReviews).values({ ...base, courtId: court.id, facilityId: facility.id })).rejects.toThrow();
    await expect(db.insert(courtOwnerReviews).values({ ...base, courtId: court.id, kind: 'ADDRESS_CHANGE' })).rejects.toThrow();
    await expect(db.insert(courtOwnerReviews).values({ ...base, courtId: court.id, status: 'REJECTED', reviewedBy: admin.id, reviewedAt: new Date(), rejectionReason: '' })).rejects.toThrow();
    await db.insert(courtOwnerReviews).values({ ...base, courtId: court.id, status: 'REJECTED', reviewedBy: admin.id, reviewedAt: new Date(), rejectionReason: 'Incomplete' });
    await db.insert(courtOwnerReviews).values({ ...base, courtId: court.id });
  });
  it('falls back on invalid/missing config and honors configured cancellation/maintenance values', () => {
    expect(parseOwnerConfig(new Map())).toEqual({ canCancelBooking: true, cancellationDeadlineMinutes: 0, maintenanceAdvanceWindowDays: 90 });
    expect(parseOwnerConfig(new Map([['OWNER_CAN_CANCEL_BOOKING', 'false'], ['OWNER_CANCELLATION_DEADLINE_MINUTES', '30'], ['MAINTENANCE_ADVANCE_WINDOW_DAYS', '120']]))).toEqual({ canCancelBooking: false, cancellationDeadlineMinutes: 30, maintenanceAdvanceWindowDays: 120 });
    expect(parseOwnerConfig(new Map([['MAINTENANCE_ADVANCE_WINDOW_DAYS', '0'], ['OWNER_CANCELLATION_DEADLINE_MINUTES', '-1']]))).toMatchObject({ maintenanceAdvanceWindowDays: 90, cancellationDeadlineMinutes: 0 });
  });
});

it.each([false, true])('migration preserves fresh/populated baseline (populated=%s)', async (populated) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA owner_migration_fixture');
    await client.query('SET LOCAL search_path = owner_migration_fixture, public');
    await client.query(`CREATE TABLE owner_migration_fixture.users(id bigint PRIMARY KEY);
      CREATE TABLE owner_migration_fixture.facilities(id bigint PRIMARY KEY, ward varchar NOT NULL, status varchar NOT NULL);
      CREATE TABLE owner_migration_fixture.courts(id bigint PRIMARY KEY, status varchar NOT NULL);
      CREATE TABLE owner_migration_fixture.bookings(id bigint PRIMARY KEY);
      CREATE TABLE owner_migration_fixture.system_configs(config_key varchar UNIQUE, config_value text, description text);
      CREATE TABLE owner_migration_fixture.court_pricings(id bigint PRIMARY KEY, court_id bigint, start_time time, end_time time, valid_from date, valid_to date, price decimal);
      `);
    if (populated) await client.query(`INSERT INTO owner_migration_fixture.facilities VALUES (1,'Preserved ward','ACTIVE'); INSERT INTO owner_migration_fixture.courts VALUES (1,'ACTIVE'); INSERT INTO owner_migration_fixture.court_pricings VALUES (1,1,'06:00','09:00','2026-01-01',NULL,123000);`);
    const migration = fs.readFileSync(path.resolve(__dirname, '../db/migrations/0009_court_owner_foundation.sql'), 'utf8').replaceAll('"public".', '"owner_migration_fixture".');
    await client.query(migration);
    if (populated) {
      expect((await client.query('SELECT ward FROM owner_migration_fixture.facilities')).rows[0].ward).toBe('Preserved ward');
      expect((await client.query('SELECT price FROM owner_migration_fixture.court_pricings')).rows[0].price).toBe('123000');
    }
    await client.query("INSERT INTO owner_migration_fixture.facilities VALUES (2,NULL,'PENDING_APPROVAL')");
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
