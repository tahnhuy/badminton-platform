import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, facilities, courts, bookings, courtOwnerReviews, notifications } from '../db';
import { createTestUser } from './test-helpers';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

async function fixture() {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const other = await createTestUser({ role: 'COURT_OWNER' });
  const admin = await createTestUser({ role: 'ADMIN' });
  const player = await createTestUser({ role: 'PLAYER' });
  const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Club', phone: '0900000000', address: '1 Test', district: 'D', city: 'C', openingTime: '06:00', closingTime: '23:00', status: 'ACTIVE' }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  const ownerPath = `/api/v1/owner/courts/${court.id}/deletion-requests`;
  const adminPath = `/api/v1/admin/facilities/${facility.id}/courts/${court.id}/deletion-requests`;
  const submit = () => request(app).post(ownerPath).set('x-user-id', String(owner.id)).send({ reason: 'Ngừng khai thác sân để cải tạo' });
  const decide = (id: number, action = 'approve', reason?: string) => request(app).post(`${adminPath}/${action}`).set('x-user-id', String(admin.id)).send({ reviewId: id, ...(reason ? { reason } : {}) });
  return { owner, other, admin, player, facility, court, ownerPath, adminPath, submit, decide };
}

describe('Owner court deletion requests', () => {
  it('requires ownership and a reason, keeps the court live and prevents duplicate pending requests', async () => {
    const f = await fixture();
    expect((await request(app).post(f.ownerPath).set('x-user-id', String(f.other.id)).send({ reason: 'Delete' })).status).toBe(404);
    expect((await request(app).post(f.ownerPath).set('x-user-id', String(f.player.id)).send({ reason: 'Delete' })).status).toBe(403);
    for (const reason of ['', '   ', 'a'.repeat(1001)]) expect((await request(app).post(f.ownerPath).set('x-user-id', String(f.owner.id)).send({ reason })).status).toBe(400);
    const results = await Promise.all([f.submit(), f.submit()]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const [court] = await db.select().from(courts).where(eq(courts.id, f.court.id));
    expect(court).toMatchObject({ status: 'ACTIVE', deletedAt: null });
    const detail = await request(app).get(`/api/v1/owner/facilities/${f.facility.id}`).set('x-user-id', String(f.owner.id));
    expect(detail.body.data.courts[0].pendingDeletionReview).toMatchObject({ kind: 'COURT_DELETION', status: 'PENDING', submittedValues: { reason: 'Ngừng khai thác sân để cải tạo' } });
  });

  it('supports rejection and resubmission, then soft-deletes only after Admin approval with history and notification', async () => {
    const f = await fixture();
    const first = await f.submit();
    expect((await request(app).post(`${f.adminPath}/approve`).set('x-user-id', String(f.owner.id)).send({ reviewId: first.body.data.id })).status).toBe(403);
    expect((await f.decide(first.body.data.id, 'reject')).status).toBe(400);
    expect((await f.decide(first.body.data.id, 'reject', 'Cần bổ sung thông tin')).status).toBe(200);
    const second = await f.submit(); expect(second.status).toBe(201);
    expect((await f.decide(second.body.data.id)).status).toBe(200);
    const [court] = await db.select().from(courts).where(eq(courts.id, f.court.id));
    expect(court.status).toBe('SUSPENDED'); expect(court.deletedAt).not.toBeNull();
    const history = await db.select().from(courtOwnerReviews).where(eq(courtOwnerReviews.courtId, f.court.id));
    expect(history.map(r => r.status).sort()).toEqual(['APPROVED', 'REJECTED']);
    expect(history.every(r => r.submittedValues.reason === 'Ngừng khai thác sân để cải tạo')).toBe(true);
    const detail = await request(app).get(`/api/v1/owner/facilities/${f.facility.id}`).set('x-user-id', String(f.owner.id));
    expect(detail.body.data.courts).toHaveLength(0);
    const messages = await db.select().from(notifications).where(eq(notifications.userId, f.owner.id));
    expect(messages.some(n => n.title === 'Yêu cầu xóa sân đã được duyệt')).toBe(true);
  });

  for (const status of ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT']) it(`blocks approval while a ${status} booking is still effective`, async () => {
    const f = await fixture();
    const attempt = await f.submit(); expect(attempt.status).toBe(201);
    // A booking created AFTER submission must also block deletion at decision time.
    const [booking] = await db.insert(bookings).values({ courtId: f.court.id, playerId: f.player.id,
      bookingDate: addDaysToDateString(todayInAppTimezone(), 1), startTime: '10:00', endTime: '11:00', unitPrice: '100000', totalAmount: '100000', status,
      expiresAt: new Date(Date.now() + 600000), bookingCode: `DELETE-TEST-${f.court.id}` }).returning();
    const result = await f.decide(attempt.body.data.id);
    expect(result.status).toBe(409); expect(result.body.error.code).toBe('COURT_DELETION_ACTIVE_BOOKINGS');
    const [pending] = await db.select().from(courtOwnerReviews).where(eq(courtOwnerReviews.id, attempt.body.data.id)); expect(pending.status).toBe('PENDING');
    await db.update(bookings).set({ status: 'CANCELLED' }).where(eq(bookings.id, booking.id));
    expect((await f.decide(attempt.body.data.id)).status).toBe(200);
    const [historical] = await db.select().from(bookings).where(eq(bookings.id, booking.id)); expect(historical.status).toBe('CANCELLED');
  });
});
