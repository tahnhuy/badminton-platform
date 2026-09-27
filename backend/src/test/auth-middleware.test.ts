import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createAuthTestApp } from './test-routes';
import { createTestUser } from './test-helpers';
import { authRepository } from '../modules/auth/auth.repository';
import { db } from '../db/client';
import { users } from '../db/schema/users';
import { authSessions } from '../db/schema/auth';
import { eq } from 'drizzle-orm';
import { Express } from 'express';

describe('Auth Middleware (AUTH-07: authenticate & requireRole)', () => {
  let testApp: Express;

  beforeAll(() => {
    testApp = createAuthTestApp();
  });

  describe('test helper environment guard', () => {
    it('refuses to create test app when NODE_ENV is not test', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        expect(() => createAuthTestApp()).toThrowError(
          'createAuthTestApp must only be called when NODE_ENV=test'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('authenticate middleware', () => {
    it('returns 401 AUTH_SESSION_INVALID and clears cookies when sid is missing', async () => {
      const res = await request(testApp).get('/test/protected');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 AUTH_SESSION_INVALID when sid is not in database', async () => {
      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', 'sid=non_existent_token_123');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('returns 401 AUTH_SESSION_INVALID when session has been revoked', async () => {
      const user = await createTestUser();
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');
      await authRepository.revokeSessionByToken(rawToken);

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('returns 401 AUTH_SESSION_INVALID when user status is SUSPENDED or DEACTIVATED', async () => {
      const user = await createTestUser({ status: 'ACTIVE' });
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');

      // Suspend user
      await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, user.id));

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('returns 401 AUTH_SESSION_INVALID when user is soft deleted', async () => {
      const user = await createTestUser();
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');

      // Soft delete user
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('returns 401 AUTH_SESSION_EXPIRED when idle timeout is exceeded', async () => {
      const user = await createTestUser();
      const { rawToken, session } = await authRepository.createSession(user.id, 'PLAYER');

      // Set last_seen_at to 8 days ago (idle timeout is 7 days)
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await db
        .update(authSessions)
        .set({ lastSeenAt: eightDaysAgo })
        .where(eq(authSessions.id, session.id));

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_EXPIRED');
    });

    it('returns 403 AUTH_PASSWORD_CHANGE_REQUIRED when must_change_password is true on normal routes', async () => {
      const user = await createTestUser({ mustChangePassword: true });
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_PASSWORD_CHANGE_REQUIRED');
    });

    it('returns 200 and attaches user when valid session is provided', async () => {
      const user = await createTestUser({ role: 'PLAYER' });
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');

      const res = await request(testApp)
        .get('/test/protected')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.role).toBe('PLAYER');
    });
  });

  describe('requireRole middleware', () => {
    it('PLAYER accessing /test/player-only succeeds with 200', async () => {
      const user = await createTestUser({ role: 'PLAYER' });
      const { rawToken } = await authRepository.createSession(user.id, 'PLAYER');

      const res = await request(testApp)
        .get('/test/player-only')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Player access granted');
    });

    it('COURT_OWNER accessing /test/player-only gets 403 AUTH_FORBIDDEN_ROLE', async () => {
      const user = await createTestUser({ role: 'COURT_OWNER' });
      const { rawToken } = await authRepository.createSession(user.id, 'COURT_OWNER');

      const res = await request(testApp)
        .get('/test/player-only')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
    });

    it('ADMIN accessing /test/player-only gets 403 AUTH_FORBIDDEN_ROLE', async () => {
      const user = await createTestUser({ role: 'ADMIN' });
      const { rawToken } = await authRepository.createSession(user.id, 'ADMIN');

      const res = await request(testApp)
        .get('/test/player-only')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
    });

    it('ADMIN accessing /test/admin-only succeeds with 200', async () => {
      const user = await createTestUser({ role: 'ADMIN' });
      const { rawToken } = await authRepository.createSession(user.id, 'ADMIN');

      const res = await request(testApp)
        .get('/test/admin-only')
        .set('Cookie', `sid=${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Admin access granted');
    });
  });
});
