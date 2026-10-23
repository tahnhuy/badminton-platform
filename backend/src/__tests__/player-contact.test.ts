import { it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { createTestUser } from './test-helpers';
import { db, playerProfiles } from '../db';
import { eq } from 'drizzle-orm';
async function register(phone?: string) {
  const agent = request.agent(app);
  const result = await agent.post('/api/v1/auth/register').send({ email: `phone_${Date.now()}_${Math.random()}@example.com`, password: 'ValidPassword123!', fullName: 'Contact Player', skillLevelCode: 'AVERAGE', ...(phone === undefined ? {} : { phone }) });
  expect(result.status).toBe(201);
  const cookies = result.headers['set-cookie'] as unknown as string[];
  const csrf = cookies.find(value => value.startsWith('csrf_token='))!.split(';')[0].split('=')[1];
  return { agent, csrf, user: result.body.data };
}
it('registers an optional normalized phone privately, not in AuthUser', async () => {
  const { agent, user } = await register('+84 (912) 345-678');
  expect(user).not.toHaveProperty('phone');
  expect((await agent.get('/api/v1/auth/me')).body.data).not.toHaveProperty('phone');
  expect((await agent.get('/api/v1/players/me/contact')).body.data.phone).toBe('+84912345678');
});
it('keeps phone optional, allows self update and clearing, rejects injection and invalid values', async () => {
  const { agent, csrf } = await register();
  const url = '/api/v1/players/me/contact';
  expect((await agent.get(url)).body.data.phone).toBeNull();
  expect((await agent.patch(url).set('X-CSRF-Token', csrf).send({ phone: '0901 234 567' })).body.data.phone).toBe('0901234567');
  expect((await agent.patch(url).set('X-CSRF-Token', csrf).send({ phone: 'abcdef' })).status).toBe(400);
  expect((await agent.patch(url).set('X-CSRF-Token', csrf).send({ phone: '0901234567', userId: 123 })).status).toBe(400);
  expect((await agent.patch(url).set('X-CSRF-Token', csrf).send({ phone: '' })).body.data.phone).toBeNull();
});
it('enforces real-session CSRF, Player role and self-targeting', async () => {
  const first = await register('0901234567');
  const second = await register('0907654321');
  const url = '/api/v1/players/me/contact';
  expect((await first.agent.patch(url).send({ phone: '0909999999' })).status).toBe(403);
  await first.agent.patch(url).set('X-CSRF-Token', first.csrf).send({ phone: '0908888888' });
  expect((await second.agent.get(url)).body.data.phone).toBe('0907654321');
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  expect((await request(app).get(url).set('x-user-id', String(owner.id))).status).toBe(403);
  const [row] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, first.user.id));
  expect(row.phone).toBe('0908888888');
});
