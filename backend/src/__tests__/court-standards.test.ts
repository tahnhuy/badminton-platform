import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../app';
import { db, courts, facilities, courtStandardClaims, courtStandardEvidence, courtOwnerProfiles, mediaFiles } from '../db';
import { courtProfileChanges } from '../db/schema/facilities';
import { createTestUser } from './test-helpers';

const png = () => sharp({ create: { width: 2, height: 2, channels: 3, background: '#0f0' } }).png().toBuffer();

async function setup(brand = 'Yonex', model = 'Pro 2026') {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const admin = await createTestUser({ role: 'ADMIN' });
  const other = await createTestUser({ role: 'PLAYER' });
  await db.insert(courtOwnerProfiles).values({ userId: owner.id, businessName: 'Standard Club', phone: '0900000000' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Standard Facility', phone: '0900000000', status: 'ACTIVE',
    address: '1 Test', district: 'D', city: 'Hồ Chí Minh', openingTime: '06:00:00', closingTime: '23:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({
    facilityId: facility.id, name: 'Sân 01', status: 'ACTIVE',
    surfaceBrand: brand, surfaceModel: model, surfaceType: 'PVC',
  }).returning();
  return { owner, admin, other, facility, court };
}

function api(id: number, method: 'get' | 'post' | 'put' | 'patch', url: string) {
  return request(app)[method](url).set('x-user-id', String(id));
}

async function submit(ownerId: number, courtId: number, payload: Record<string, unknown>) {
  return api(ownerId, 'post', `/api/v1/owner/courts/${courtId}/standard-claims`)
    .field('payload', JSON.stringify(payload))
    .attach('evidence', await png(), { filename: 'label.png', contentType: 'image/png' });
}

describe('Court standard claims', () => {
  afterAll(async () => {
    await db.delete(courtStandardEvidence);
    await db.delete(courtStandardClaims);
    await db.delete(courtProfileChanges);
  });
  beforeEach(async () => {
    await db.delete(courtStandardEvidence);
    await db.delete(courtStandardClaims);
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(mediaFiles);
  });

  it('submits, verifies and publishes only valid verified claims with private evidence', async () => {
    const { owner, admin, other, facility, court } = await setup();
    const created = await submit(owner.id, court.id, {
      standardCode: 'BWF_GRADE_2', issuer: 'BWF', referenceNo: 'BWF-2026-001', expiresAt: '2030-12-31',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.status).toBe('PENDING');
    const mediaId = created.body.data.evidenceMediaIds[0];

    expect((await api(owner.id, 'get', `/api/v1/media/${mediaId}`)).status).toBe(200);
    expect((await api(admin.id, 'get', `/api/v1/media/${mediaId}`)).status).toBe(200);
    expect((await api(other.id, 'get', `/api/v1/media/${mediaId}`)).status).toBe(404);

    const list = await api(admin.id, 'get', '/api/v1/admin/standards/claims').query({ status: 'PENDING' });
    expect(list.body.data).toHaveLength(1);
    const approved = await api(admin.id, 'post', `/api/v1/admin/standards/claims/${created.body.data.id}/approve`).send({});
    expect(approved.status).toBe(200);

    const detail = await api(other.id, 'get', `/api/v1/facilities/${facility.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.courts[0].standards.map((s: any) => s.code)).toContain('BWF_GRADE_2');
  });

  it('requires a reason to reject and enforces brand/model and expiry rules', async () => {
    const { owner, admin, court } = await setup();
    const missingExpiry = await submit(owner.id, court.id, {
      standardCode: 'BWF_GRADE_1', issuer: 'BWF', referenceNo: 'X',
    });
    expect(missingExpiry.status).toBe(400);

    const created = await submit(owner.id, court.id, {
      standardCode: 'EN_14904', issuer: 'Lab', referenceNo: 'EN-1',
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await api(admin.id, 'post', `/api/v1/admin/standards/claims/${id}/reject`).send({})).status).toBe(400);
    expect((await api(admin.id, 'post', `/api/v1/admin/standards/claims/${id}/reject`).send({ reason: 'Ảnh mờ' })).status).toBe(200);

    const [blank] = await db.update(courts).set({ surfaceBrand: null }).where((await import('drizzle-orm')).eq(courts.id, court.id)).returning();
    expect(blank.surfaceBrand).toBeNull();
    const blocked = await submit(owner.id, court.id, { standardCode: 'EN_14904', issuer: 'Lab', referenceNo: 'EN-2' });
    expect(blocked.status).toBe(400);
  });

  it('invalidates a verified claim when the surface brand or model changes', async () => {
    const { owner, admin, court } = await setup();
    const created = await submit(owner.id, court.id, {
      standardCode: 'EN_14904', issuer: 'Lab', referenceNo: 'EN-1',
    });
    await api(admin.id, 'post', `/api/v1/admin/standards/claims/${created.body.data.id}/approve`).send({});
    const updated = await api(owner.id, 'put', `/api/v1/owner/courts/${court.id}/profile`).send({
      profileVersion: 0, surfaceBrand: 'NewBrand',
    });
    expect(updated.status).toBe(200);
    const claims = await db.select().from(courtStandardClaims);
    expect(claims[0].status).toBe('INVALIDATED');
  });
});
