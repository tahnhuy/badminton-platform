import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, courts, facilities, courtProfileChanges, courtOwnerProfiles } from '../db';
import { createTestUser } from './test-helpers';

async function setup() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const other = await createTestUser({ role: 'COURT_OWNER' });
  const admin = await createTestUser({ role: 'ADMIN' });
  await db.insert(courtOwnerProfiles).values([
    { userId: owner.id, businessName: 'Owner Club', phone: '0900000000' },
    { userId: other.id, businessName: 'Other Club', phone: '0900000001' },
  ]);
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id,
    name: 'Profile Facility',
    phone: '0900000000',
    status: 'ACTIVE',
    address: '1 Test',
    district: 'D',
    city: 'Hồ Chí Minh',
    openingTime: '06:00:00',
    closingTime: '23:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({
    facilityId: facility.id,
    name: 'Sân 01',
    status: 'ACTIVE',
  }).returning();
  return { owner, other, admin, facility, court };
}

function api(id: number, method: 'get' | 'post' | 'put' | 'patch', url: string) {
  return request(app)[method](url).set('x-user-id', String(id));
}

describe('Court profile and condition', () => {
  afterAll(async () => { await db.delete(courtProfileChanges); });
  beforeEach(async () => {
    await db.delete(courtProfileChanges);
    await db.delete(courts);
    await db.delete(facilities);
  });

  it('lets the owning Owner update profile and condition with history and a version bump', async () => {
    const { owner, court } = await setup();
    const response = await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0,
      surfaceType: 'PU_ACRYLIC',
      surfaceBrand: 'Yonex',
      surfaceModel: 'Pro 2026',
      surfaceThicknessMm: 4.5,
      condition: 'UNDER_MAINTENANCE',
      conditionNote: 'Thay lưới',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      surfaceType: 'PU_ACRYLIC',
      surfaceThicknessMm: '4.5',
      condition: 'UNDER_MAINTENANCE',
      profileVersion: 1,
    });

    const changes = await db.select().from(courtProfileChanges).where(eqChanges(court.id));
    expect(changes).toHaveLength(2);
    expect(changes.map(row => row.changeType).sort()).toEqual(['CONDITION', 'PROFILE']);

    const history = await api(owner.id, 'get', `/api/v1/owner/courts/${court.id}/profile-changes`);
    expect(history.status).toBe(200);
    expect(history.body.meta.total).toBe(2);
  });

  it('rejects a stale profileVersion and blocks cross-owner edits', async () => {
    const { owner, other, court } = await setup();
    await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0,
      surfaceBrand: 'A',
    });
    const stale = await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0,
      surfaceBrand: 'B',
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('COURT_PROFILE_VERSION_CONFLICT');

    const cross = await api(other.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 1,
      surfaceBrand: 'B',
    });
    expect(cross.status).toBe(404);
  });

  it('requires a note for maintenance and does not write history for a no-op', async () => {
    const { owner, court } = await setup();
    const missingNote = await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0,
      condition: 'UNDER_MAINTENANCE',
    });
    expect(missingNote.status).toBe(400);

    const noop = await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0,
      surfaceType: null,
    });
    expect(noop.status).toBe(200);
    const changes = await db.select().from(courtProfileChanges).where(eqChanges(court.id));
    expect(changes).toHaveLength(0);
  });

  it('requires an Admin reason, persists it and filters facilities by condition', async () => {
    const { owner, admin, facility, court } = await setup();
    const withoutReason = await api(admin.id, 'patch', `/api/v1/admin/facilities/${facility.id}/courts/${court.id}/profile`).send({
      profileVersion: 0,
      condition: 'NEEDS_MAINTENANCE',
      conditionNote: 'Lưới rách',
    });
    expect(withoutReason.status).toBe(400);

    const updated = await api(admin.id, 'patch', `/api/v1/admin/facilities/${facility.id}/courts/${court.id}/profile`).send({
      profileVersion: 0,
      condition: 'NEEDS_MAINTENANCE',
      conditionNote: 'Lưới rách',
      reason: 'Phát hiện khi kiểm tra',
    });
    expect(updated.status).toBe(200);
    const changes = await db.select().from(courtProfileChanges).where(eqChanges(court.id));
    expect(changes).toHaveLength(1);
    expect(changes[0].reason).toBe('Phát hiện khi kiểm tra');
    expect(changes[0].actorId).toBe(admin.id);

    const filtered = await api(admin.id, 'get', '/api/v1/admin/facilities').query({ condition: 'NEEDS_MAINTENANCE' });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0].courtStats.conditionSummary.NEEDS_MAINTENANCE).toBe(1);

    const ownerAccess = await api(owner.id, 'patch', `/api/v1/admin/facilities/${facility.id}/courts/${court.id}/profile`).send({
      profileVersion: 1,
      reason: 'x',
      surfaceBrand: 'x',
    });
    expect(ownerAccess.status).toBe(403);
  });
});

function eqChanges(courtId: number) {
  const { eq } = require('drizzle-orm') as typeof import('drizzle-orm');
  return eq(courtProfileChanges.courtId, courtId);
}
