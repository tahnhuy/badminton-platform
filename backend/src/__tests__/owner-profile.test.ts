import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, courtOwnerProfiles } from '../db';
import { createTestUser } from './test-helpers';

async function ownerWithProfile(phone = '0901234567') {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  await db.insert(courtOwnerProfiles).values({ userId: owner.id, businessName: 'CLB Test', phone });
  return owner;
}
const as = (userId: number) => ({ 'x-user-id': String(userId) });

describe('Owner profile contact phone', () => {
  it('reads the profile and updates the phone immediately without review or OTP', async () => {
    const owner = await ownerWithProfile();
    const read = await request(app).get('/api/v1/owner/profile').set(as(owner.id));
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ businessName: 'CLB Test', phone: '0901234567' });

    const update = await request(app).patch('/api/v1/owner/profile').set(as(owner.id)).send({ phone: ' 0912 345-678 ' });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ businessName: 'CLB Test', phone: '0912345678' });
    const [stored] = await db.select().from(courtOwnerProfiles).where(eq(courtOwnerProfiles.userId, owner.id));
    expect(stored.phone).toBe('0912345678');
    expect((await request(app).get('/api/v1/owner/profile').set(as(owner.id))).body.data.phone).toBe('0912345678');
  });

  it('accepts an international prefix and rejects invalid, empty and unknown fields', async () => {
    const owner = await ownerWithProfile();
    const patch = (body: unknown) => request(app).patch('/api/v1/owner/profile').set(as(owner.id)).send(body as object);
    expect((await patch({ phone: '+84 912 345 678' })).body.data.phone).toBe('+84912345678');
    for (const body of [{ phone: '12ab' }, { phone: '123' }, { phone: '' }, { phone: null }, {}, { phone: '0912345678', businessName: 'Đổi tên' }]) {
      expect((await patch(body)).status).toBe(400);
    }
    const [stored] = await db.select().from(courtOwnerProfiles).where(eq(courtOwnerProfiles.userId, owner.id));
    expect(stored).toMatchObject({ phone: '+84912345678', businessName: 'CLB Test' });
  });

  it('only changes the caller\'s own profile and is closed to other roles', async () => {
    const owner = await ownerWithProfile('0901111111');
    const other = await ownerWithProfile('0902222222');
    await request(app).patch('/api/v1/owner/profile').set(as(owner.id)).send({ phone: '0903333333' }).expect(200);
    const [untouched] = await db.select().from(courtOwnerProfiles).where(eq(courtOwnerProfiles.userId, other.id));
    expect(untouched.phone).toBe('0902222222');
    const player = await createTestUser({ role: 'PLAYER' });
    expect((await request(app).get('/api/v1/owner/profile').set(as(player.id))).status).toBe(403);
    expect((await request(app).patch('/api/v1/owner/profile').set(as(player.id)).send({ phone: '0903333333' })).status).toBe(403);
    expect((await request(app).get('/api/v1/owner/profile')).status).toBe(401);
  });

  it('returns 404 for an Owner account without a profile row', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const res = await request(app).get('/api/v1/owner/profile').set(as(owner.id));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('OWNER_PROFILE_NOT_FOUND');
  });
});
