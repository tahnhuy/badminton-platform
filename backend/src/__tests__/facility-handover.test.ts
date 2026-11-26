import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, facilities, courts, courtPricings } from '../db';
import { createTestUser } from './test-helpers';
import { findExisting, type ImportedFacility } from '../db/seed/lib/google-places';

const ownerRoot = '/api/v1/owner/facility-handovers';
const adminRoot = '/api/v1/admin/facilities/handovers';
function api(id: number, method: 'post' | 'get', url: string) { return request(app)[method](url).set('x-user-id', String(id)); }
async function setup() {
  const previous = await createTestUser({ role: 'COURT_OWNER' });
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const other = await createTestUser({ role: 'COURT_OWNER' });
  const admin = await createTestUser({ role: 'ADMIN' });
  const [facility] = await db.insert(facilities).values({ ownerId: previous.id, name: 'Imported Club', phone: '', status: 'ACTIVE', address: '1 Test', district: 'D', city: 'Hồ Chí Minh', openingTime: '06:00', closingTime: '23:00', dataSource: 'GOOGLE_PLACES_IMPORT' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE', dataSource: 'GOOGLE_PLACES_IMPORT' }).returning();
  const [price] = await db.insert(courtPricings).values({ courtId: court.id, startTime: '06:00', endTime: '23:00', price: '100000', validFrom: '2025-01-01' }).returning();
  return { previous, owner, other, admin, facility, court, price };
}
async function submit(ownerId: number, facilityId: number) {
  const response = await api(ownerId, 'post', ownerRoot).send({ facilityId, evidence: 'Giấy phép kinh doanh và liên hệ để Admin kiểm tra.' });
  expect(response.status).toBe(201);
  return response.body.data.id as number;
}
describe('Imported facility handover', () => {
  it('requires Admin review, preserves inventory/prices, then confirms the exact Owner-reviewed data', async () => {
    const { previous, owner, other, admin, facility, court, price } = await setup();
    const id = await submit(owner.id, facility.id);
    expect((await api(owner.id, 'get', `${ownerRoot}/${id}/preview`)).status).toBe(404);
    const duplicate = await api(other.id, 'post', ownerRoot).send({ facilityId: facility.id, evidence: 'Yêu cầu tiếp nhận khác đang chờ xác minh.' });
    expect(duplicate.status).toBe(409);
    expect((await api(owner.id, 'post', `${adminRoot}/${id}/decision`).send({ approve: true, reason: 'Tự duyệt yêu cầu tiếp nhận.' })).status).toBe(403);
    const decision = await api(admin.id, 'post', `${adminRoot}/${id}/decision`).send({ approve: true, reason: 'Đã đối chiếu giấy phép và xác minh chủ sở hữu.' });
    expect(decision.status).toBe(200);
    const [transferred] = await db.select().from(facilities).where(eq(facilities.id, facility.id));
    expect(transferred!.ownerId).toBe(owner.id);
    expect(transferred!.ownerId).not.toBe(previous.id);
    expect(transferred!.confirmedAt).toBeNull();
    expect((await api(other.id, 'get', `${ownerRoot}/${id}/preview`)).status).toBe(404);
    const preview = await api(owner.id, 'get', `${ownerRoot}/${id}/preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.courts[0].pricing[0].id).toBe(price.id);
    const missingAck = await api(owner.id, 'post', `${ownerRoot}/${id}/confirm`).send({ snapshot: preview.body.data });
    expect(missingAck.status).toBe(400);
    const confirmed = await api(owner.id, 'post', `${ownerRoot}/${id}/confirm`).send({ acknowledged: true, snapshot: preview.body.data });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    const [savedCourt] = await db.select().from(courts).where(eq(courts.id, court.id));
    expect(savedCourt!.confirmedBy).toBe(owner.id);
    expect(savedCourt!.confirmedAt).not.toBeNull();
    expect((await api(owner.id, 'post', `${ownerRoot}/${id}/confirm`).send({ acknowledged: true, snapshot: preview.body.data })).status).toBe(409);
  });
  it('rejects stale price snapshots and allows retry with a fresh preview', async () => {
    const { owner, admin, facility, price } = await setup();
    const id = await submit(owner.id, facility.id);
    await api(admin.id, 'post', `${adminRoot}/${id}/decision`).send({ approve: true, reason: 'Đã xác minh quyền sở hữu cơ sở.' });
    const preview = await api(owner.id, 'get', `${ownerRoot}/${id}/preview`);
    await db.update(courtPricings).set({ price: '150000' }).where(eq(courtPricings.id, price.id));
    const response = await api(owner.id, 'post', `${ownerRoot}/${id}/confirm`).send({ acknowledged: true, snapshot: preview.body.data });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('HANDOVER_SNAPSHOT_CHANGED');
    const fresh = await api(owner.id, 'get', `${ownerRoot}/${id}/preview`);
    expect((await api(owner.id, 'post', `${ownerRoot}/${id}/confirm`).send({ acknowledged: true, snapshot: fresh.body.data })).status).toBe(200);
  });
  it('rejects without transferring ownership and permits a new request', async () => {
    const { owner, other, admin, previous, facility } = await setup();
    const id = await submit(owner.id, facility.id);
    const rejected = await api(admin.id, 'post', `${adminRoot}/${id}/decision`).send({ approve: false, reason: 'Thông tin chưa đủ để xác minh quyền quản lý.' });
    expect(rejected.status).toBe(200);
    expect((await db.select().from(facilities).where(eq(facilities.id, facility.id)))[0]!.ownerId).toBe(previous.id);
    expect((await api(owner.id, 'get', `${ownerRoot}/${id}/preview`)).status).toBe(404);
    await submit(other.id, facility.id);
  });
  it('matches legacy normalized names and reads their actual confirmation state', async () => {
    const { owner, facility } = await setup();
    await db.update(facilities).set({ name: '  Imported   CLUB ', confirmedAt: new Date(), confirmedBy: owner.id }).where(eq(facilities.id, facility.id));
    const result = await findExisting({ ...facility, name: 'imported club', placeId: 'test-place-id' } as unknown as ImportedFacility);
    expect(result?.row.id).toBe(facility.id);
    expect(result?.row.confirmedAt).not.toBeNull();
    expect((await api(owner.id, 'post', ownerRoot).send({ facilityId: facility.id, evidence: 'Không được tiếp nhận cơ sở đã xác nhận.' })).status).toBe(404);
  });
});
