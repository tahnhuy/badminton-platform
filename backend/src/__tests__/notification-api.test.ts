import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, notifications } from '../db';
import { authRepository } from '../repositories/auth/AuthRepository';
import { createTestUser } from './test-helpers';

// NTF-03 (Notifications Tech Design): caller-scoped list/unread/detail/read.
const fields = ['id', 'type', 'title', 'content', 'resourceType', 'resourceId', 'isRead', 'readAt'].sort();

describe('Notification read APIs (NTF-03)', () => {
  let alice: number;
  let bob: number;
  let aliceIds: number[];
  let bobId: number;

  const as = (id: number) => ({
    get: (url: string) => request(app).get(url).set('x-user-id', String(id)),
    post: (url: string) => request(app).post(url).set('x-user-id', String(id)),
  });

  beforeEach(async () => {
    alice = (await createTestUser({ role: 'PLAYER' })).id;
    bob = (await createTestUser({ role: 'COURT_OWNER' })).id;
    const rows = await db.insert(notifications).values([
      { userId: alice, type: 'T', title: 'old', content: 'c1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { userId: alice, type: 'T', title: 'mid', content: 'c2', resourceType: 'POST', resourceId: 9, dedupKey: 'k2', createdAt: new Date('2026-01-02T00:00:00Z') },
      { userId: alice, type: 'T', title: 'new', content: 'c3', isRead: true, readAt: new Date('2026-01-04T00:00:00Z'), createdAt: new Date('2026-01-03T00:00:00Z') },
      { userId: bob, type: 'T', title: 'bob', content: 'secret', createdAt: new Date('2026-01-05T00:00:00Z') },
    ]).returning();
    aliceIds = rows.slice(0, 3).map(row => row.id);
    bobId = rows[3].id;
  });

  it('lists only the caller notifications newest first with allowlisted fields and pagination', async () => {
    const res = await as(alice).get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(res.body.data.map((row: { title: string }) => row.title)).toEqual(['new', 'mid', 'old']);
    expect(Object.keys(res.body.data[1]).sort()).toEqual(fields);
    expect(res.body.data[1]).toMatchObject({ resourceType: 'POST', resourceId: 9, isRead: false, readAt: null });
    const page = await as(alice).get('/api/v1/notifications?page=2&limit=2');
    expect(page.body).toMatchObject({ meta: { page: 2, limit: 2, total: 3, totalPages: 2 } });
    expect(page.body.data.map((row: { title: string }) => row.title)).toEqual(['old']);
    const read = await as(alice).get('/api/v1/notifications?isRead=true');
    expect(read.body.data.map((row: { title: string }) => row.title)).toEqual(['new']);
    const bobList = await as(bob).get('/api/v1/notifications');
    expect(bobList.body.data.map((row: { id: number }) => row.id)).toEqual([bobId]);
  });

  it('returns the unread count and unread items only', async () => {
    const res = await as(alice).get('/api/v1/notifications/unread?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.data.items.map((row: { title: string }) => row.title)).toEqual(['mid']);
    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('shares 404 for missing and non-owned ids and never changes read state on GET', async () => {
    const own = await as(alice).get(`/api/v1/notifications/${aliceIds[0]}`);
    expect(own.status).toBe(200);
    expect(own.body.data.isRead).toBe(false);
    for (const url of [`/api/v1/notifications/${bobId}`, '/api/v1/notifications/999999999']) {
      const res = await as(alice).get(url);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    }
    const foreignRead = await as(alice).post(`/api/v1/notifications/${bobId}/read`);
    expect(foreignRead.status).toBe(404);
    expect(foreignRead.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    const rows = await db.select().from(notifications);
    expect(rows.filter(row => row.isRead).map(row => row.id)).toEqual([aliceIds[2]]);
  });

  it('marks read idempotently and keeps the first read_at', async () => {
    const first = await as(alice).post(`/api/v1/notifications/${aliceIds[0]}/read`);
    expect(first.status).toBe(200);
    expect(first.body.data.isRead).toBe(true);
    const firstReadAt = first.body.data.readAt;
    expect(Date.parse(firstReadAt)).not.toBeNaN();
    await new Promise(resolve => setTimeout(resolve, 20));
    const replay = await as(alice).post(`/api/v1/notifications/${aliceIds[0]}/read`);
    expect(replay.status).toBe(200);
    expect(replay.body.data.readAt).toBe(firstReadAt);
    const already = await as(alice).post(`/api/v1/notifications/${aliceIds[2]}/read`);
    expect(already.body.data.readAt).toBe('2026-01-04T00:00:00.000Z');
    const [row] = await db.select().from(notifications).where(eq(notifications.id, aliceIds[0]));
    expect(row.readAt!.toISOString()).toBe(firstReadAt);
  });

  it('requires a session and the CSRF token on the read mutation; rejects malformed input', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    expect((await request(app).post(`/api/v1/notifications/${aliceIds[0]}/read`)).status).toBe(401);
    const session = await authRepository.createSession(alice, 'PLAYER');
    const cookie = `sid=${session.rawToken}; csrf_token=csrf-ntf`;
    const missing = await request(app).post(`/api/v1/notifications/${aliceIds[0]}/read`).set('Cookie', cookie);
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    const ok = await request(app).post(`/api/v1/notifications/${aliceIds[0]}/read`).set('Cookie', cookie).set('X-CSRF-Token', 'csrf-ntf');
    expect(ok.status).toBe(200);
    const listed = await request(app).get('/api/v1/notifications').set('Cookie', cookie);
    expect(listed.body.meta.total).toBe(3);
    for (const url of ['/api/v1/notifications?page=0', '/api/v1/notifications?limit=101', '/api/v1/notifications?isRead=yes', '/api/v1/notifications/abc']) {
      expect((await as(alice).get(url)).status, url).toBe(400);
    }
    // Recipient comes from the session; a client-supplied userId is ignored.
    const spoof = await as(alice).get(`/api/v1/notifications?userId=${bob}`);
    expect(spoof.body.data.every((row: { id: number }) => row.id !== bobId)).toBe(true);
  });
});
