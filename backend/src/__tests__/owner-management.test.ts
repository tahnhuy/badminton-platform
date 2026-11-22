import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, courts, courtOwnerReviews, facilities, bookings, courtPricings } from '../db';
import { eq } from 'drizzle-orm';
import { createTestUser } from './test-helpers';
import { ownerFacilityService } from '../services/owner/OwnerFacilityService';
import { bookingService } from '../services/booking/booking.service';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const body = { name: 'Owner club', phone: '0900000000', address: '1 Test', district: 'D', city: 'C', latitude: 10, longitude: 106, openingTime: '06:00', closingTime: '23:00' };
async function setup() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const admin = await createTestUser({ role: 'ADMIN' });
  const facility = await ownerFacilityService.create(owner.id, body);
  const [review] = await db.select().from(courtOwnerReviews).where(eq(courtOwnerReviews.facilityId, facility.id));
  return { owner, admin, facility, review };
}
function api(id: number, method: 'get' | 'post' | 'put' | 'patch', url: string) {
  return request(app)[method](url).set('x-user-id', String(id));
}

describe('Owner management and Admin review integration', () => {
  it('rejects null, boolean and empty coordinates instead of storing zero', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    for (const field of ['latitude', 'longitude']) {
      for (const value of [null, false, '', '   ']) {
        const response = await api(owner.id, 'post', '/api/v1/owner/facilities').send({ ...body, [field]: value });
        expect(response.status).toBe(400);
      }
    }
    expect((await ownerFacilityService.list(owner.id, 1, 20)).meta.total).toBe(0);
  });
  it('uses a real session and enforces CSRF on facility creation', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: owner.email, password: owner.plainPassword });
    expect(login.status).toBe(200);
    expect((await agent.post('/api/v1/owner/facilities').send(body)).status).toBe(403);
    const cookie = (login.headers['set-cookie'] as unknown as string[]).find(v => v.startsWith('csrf_token='))!;
    const csrf = cookie.split(';')[0].split('=')[1];
    const created = await agent.post('/api/v1/owner/facilities').set('X-CSRF-Token', csrf).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'PENDING_APPROVAL', ward: null, ownerId: owner.id });
    expect((await agent.get('/api/v1/owner/facilities')).body.meta.total).toBe(1);
  });
  it('rejects cross-owner resources, wrong roles, and moderation/transfer writes', async () => {
    const { owner, admin, facility } = await setup();
    const other = await createTestUser({ role: 'COURT_OWNER' });
    expect((await api(other.id, 'get', `/api/v1/owner/facilities/${facility.id}`)).status).toBe(404);
    expect((await api(admin.id, 'get', '/api/v1/owner/facilities')).status).toBe(403);
    expect((await api(owner.id, 'put', `/api/v1/owner/facilities/${facility.id}`).send({ status: 'ACTIVE' })).status).toBe(400);
    expect((await api(owner.id, 'put', `/api/v1/owner/facilities/${facility.id}`).send({ name: 'Changed' })).status).toBe(409);
  });
  it('rejects then edits/resubmits the same facility retaining prior attempts', async () => {
    const { owner, admin, facility, review } = await setup();
    const url = `/api/v1/admin/facilities/${facility.id}`;
    expect((await api(admin.id, 'post', `${url}/reject`).send({ reviewId: review.id })).status).toBe(400);
    expect((await api(admin.id, 'post', `${url}/reject`).send({ reviewId: review.id, reason: 'Missing details' })).status).toBe(200);
    expect((await api(owner.id, 'put', `/api/v1/owner/facilities/${facility.id}`).send({ description: 'Updated' })).status).toBe(200);
    const resubmitted = await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/resubmit`).send({});
    expect(resubmitted.body.data.id).toBe(facility.id);
    const history = await api(owner.id, 'get', `/api/v1/owner/facilities/${facility.id}/reviews`);
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[1].rejectionReason).toBe('Missing details');
    expect((await api(admin.id, 'post', `${url}/approve`).send({ reviewId: review.id })).status).toBe(409);
    expect((await api(admin.id, 'post', `${url}/approve`).send({ reviewId: resubmitted.body.data.reviewId })).status).toBe(200);
  });
  it('keeps an approved address live pending review and preserves suspension on approval', async () => {
    const { owner, admin, facility, review } = await setup();
    await api(admin.id, 'post', `/api/v1/admin/facilities/${facility.id}/approve`).send({ reviewId: review.id });
    await db.update(facilities).set({ status: 'SUSPENDED' }).where(eq(facilities.id, facility.id));
    expect((await api(owner.id, 'put', `/api/v1/owner/facilities/${facility.id}`).send({ address: 'New' })).body.error.code).toBe('ADDRESS_CHANGE_REQUIRES_REVIEW');
    const proposal = await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/address-change-requests`).send({ address: 'New', city: 'C', district: 'D', latitude: 11, longitude: 107 });
    expect(proposal.status).toBe(201);
    expect((await api(owner.id, 'get', `/api/v1/owner/facilities/${facility.id}`)).body.data.address).toBe('1 Test');
    expect((await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/address-change-requests`).send({ address: 'Again', city: 'C', district: 'D', latitude: 11, longitude: 107 })).status).toBe(409);
    await api(admin.id, 'post', `/api/v1/admin/facilities/${facility.id}/address-change-requests/${proposal.body.data.reviewId}/approve`).send({});
    expect((await api(owner.id, 'get', `/api/v1/owner/facilities/${facility.id}`)).body.data).toMatchObject({ address: 'New', ward: null, status: 'SUSPENDED' });
  });
  it('does not bypass review or approve pending courts when reactivating a facility', async () => {
    const { owner, admin, facility, review } = await setup();
    expect((await api(admin.id, 'patch', `/api/v1/admin/facilities/${facility.id}`).send({ status: 'ACTIVE' })).status).toBe(409);
    await api(admin.id, 'post', `/api/v1/admin/facilities/${facility.id}/approve`).send({ reviewId: review.id });
    const created = await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/courts`).send({ name: 'C1' });
    expect(created.status).toBe(201);
    expect((await api(owner.id, 'put', `/api/v1/owner/courts/${created.body.data.id}`).send({ name: 'New', facilityId: 123 })).status).toBe(400);
    await api(admin.id, 'patch', `/api/v1/admin/facilities/${facility.id}`).send({ status: 'SUSPENDED' });
    await api(admin.id, 'patch', `/api/v1/admin/facilities/${facility.id}`).send({ status: 'ACTIVE' });
    const [court] = await db.select().from(courts).where(eq(courts.id, created.body.data.id));
    expect(court.status).toBe('PENDING_APPROVAL');
  });
  it('serializes hours changes versus booking creation without invalid effective bookings', async () => {
    const { owner, facility } = await setup();
    await db.update(facilities).set({ status: 'ACTIVE' }).where(eq(facilities.id, facility.id));
    const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'C', status: 'ACTIVE' }).returning();
    await db.insert(courtPricings).values({ courtId: court.id, startTime: '06:00', endTime: '23:00', price: '100000', validFrom: '2026-01-01' });
    const player = await createTestUser({ role: 'PLAYER' });
    const date = addDaysToDateString(todayInAppTimezone(), 1);
    const results = await Promise.allSettled([
      bookingService.createBooking(player.id, { courtId: court.id, bookingDate: date, startTime: '20:00', durationMinutes: 60 }),
      ownerFacilityService.update(owner.id, facility.id, { closingTime: '19:00' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const [current] = await db.select().from(facilities).where(eq(facilities.id, facility.id));
    const held = await db.select().from(bookings).where(eq(bookings.courtId, court.id));
    expect(held.length === 0 || held[0].endTime <= current.closingTime).toBe(true);
  });
  it('rejects a partial hours update that makes opening equal to stored closing time', async () => {
    const { owner, facility } = await setup();
    await db.update(facilities).set({ status: 'ACTIVE' }).where(eq(facilities.id, facility.id));
    const response = await api(owner.id, 'put', `/api/v1/owner/facilities/${facility.id}`).send({ openingTime: '23:00' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OPENING_HOURS_CONFLICT');
    expect((await ownerFacilityService.detail(owner.id, facility.id)).openingTime).toBe('06:00:00');
  });
  it('lists every facility, court and address review with status and time filters', async () => {
    const { owner, admin, facility, review } = await setup();
    const queueUrl = '/api/v1/admin/facilities/reviews';
    const countUrl = `${queueUrl}/pending-count`;
    expect((await api(owner.id, 'get', queueUrl)).status).toBe(403);
    expect((await api(owner.id, 'get', countUrl)).status).toBe(403);
    const baselinePending = (await api(admin.id, 'get', countUrl)).body.data.total;
    expect(baselinePending).toBeGreaterThanOrEqual(1);

    let queue = await api(admin.id, 'get', `${queueUrl}?range=day`);
    expect(queue.status).toBe(200);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: review.id, status: 'PENDING', kind: 'ONBOARDING', facilityId: facility.id, courtId: null, facilityName: 'Owner club' }),
    ]));

    const created = await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/courts`).send({ name: 'Sân góc' });
    expect(created.status).toBe(201);
    expect((await api(admin.id, 'get', countUrl)).body.data.total).toBe(baselinePending + 1);
    queue = await api(admin.id, 'get', `${queueUrl}?range=day&status=PENDING`);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'ONBOARDING', facilityId: facility.id, courtId: created.body.data.id, courtName: 'Sân góc' }),
    ]));
    const newest = await api(admin.id, 'get', `${queueUrl}?range=day&sort=newest&limit=100`);
    const oldest = await api(admin.id, 'get', `${queueUrl}?range=day&sort=oldest&limit=100`);
    expect(oldest.status).toBe(200);
    expect(oldest.body.data.map((item: { id: number }) => item.id)).toEqual(
      newest.body.data.map((item: { id: number }) => item.id).reverse(),
    );
    const oldestPage = await api(admin.id, 'get', `${queueUrl}?range=day&sort=oldest&limit=1&page=2`);
    expect(oldestPage.body.data[0].id).toBe(oldest.body.data[1].id);
    expect((await api(admin.id, 'get', `${queueUrl}?sort=invalid`)).status).toBe(400);
    const byFacilityName = await api(admin.id, 'get', `${queueUrl}?range=day&search=Owner`);
    expect(byFacilityName.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: review.id, facilityName: 'Owner club' }),
    ]));
    const byCourtName = await api(admin.id, 'get', `${queueUrl}?range=day&search=góc`);
    expect(byCourtName.body.data).toEqual([
      expect.objectContaining({ courtId: created.body.data.id, courtName: 'Sân góc' }),
    ]);

    await api(admin.id, 'post', `/api/v1/admin/facilities/${facility.id}/approve`).send({ reviewId: review.id });
    expect((await api(admin.id, 'get', countUrl)).body.data.total).toBe(baselinePending);
    queue = await api(admin.id, 'get', `${queueUrl}?range=day&status=PENDING`);
    expect(queue.body.data.some((item: { id: number }) => item.id === review.id)).toBe(false);
    queue = await api(admin.id, 'get', `${queueUrl}?range=day&status=APPROVED`);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: review.id, status: 'APPROVED', facilityId: facility.id }),
    ]));

    const proposal = await api(owner.id, 'post', `/api/v1/owner/facilities/${facility.id}/address-change-requests`).send({ address: '2 Test', city: 'C', district: 'D', latitude: 11, longitude: 107 });
    expect(proposal.status).toBe(201);
    expect((await api(admin.id, 'get', countUrl)).body.data.total).toBe(baselinePending + 1);
    queue = await api(admin.id, 'get', `${queueUrl}?range=day`);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: proposal.body.data.reviewId, kind: 'ADDRESS_CHANGE', status: 'PENDING', facilityId: facility.id, courtId: null }),
      expect.objectContaining({ kind: 'ONBOARDING', courtId: created.body.data.id }),
    ]));

    const facilityTarget = await api(admin.id, 'get', `${queueUrl}?range=day&target=FACILITY`);
    expect(facilityTarget.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: proposal.body.data.reviewId, kind: 'ADDRESS_CHANGE' }),
      expect.objectContaining({ id: review.id, facilityId: facility.id }),
    ]));
    expect(facilityTarget.body.data.every((item: { courtId: number | null }) => item.courtId === null)).toBe(true);
    const courtTarget = await api(admin.id, 'get', `${queueUrl}?range=day&target=COURT`);
    expect(courtTarget.body.data).toEqual([
      expect.objectContaining({ courtId: created.body.data.id, courtName: 'Sân góc' }),
    ]);

    const excluded = await api(admin.id, 'get', `${queueUrl}?range=custom&startDate=2000-01-01&endDate=2000-01-02`);
    expect(excluded.body.data).toHaveLength(0);
    expect((await api(admin.id, 'get', `${queueUrl}?range=custom&startDate=2026-01-01`)).status).toBe(400);
  });
});
