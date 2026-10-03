import { describe, it, expect } from 'vitest';
import { parseCookies, generateCsrfToken } from '../utils/session-cookie';
import { authRepository, hashSessionToken } from '../repositories/auth/AuthRepository';
import { createTestUser } from './test-helpers';
import { db } from '../db';
import { authSessions } from '../db/schema/auth';
import { eq } from 'drizzle-orm';

describe('Session Store & Cookie Helpers (AUTH-06)', () => {
  describe('Cookie parser', () => {
    it('handles undefined, empty string, and whitespace', () => {
      expect(parseCookies(undefined)).toEqual({});
      expect(parseCookies('')).toEqual({});
      expect(parseCookies('   ')).toEqual({});
    });

    it('parses sid and csrf_token amidst other cookies', () => {
      const header = 'other=123; sid=session_token_abc; analytics_id=xyz; csrf_token=csrf_token_123';
      const result = parseCookies(header);
      expect(result.sid).toBe('session_token_abc');
      expect(result.csrf_token).toBe('csrf_token_123');
    });

    it('handles quoted values and URI encoded values', () => {
      const header = 'sid="token%20with%20quotes"; csrf_token="csrf_val"';
      const result = parseCookies(header);
      expect(result.sid).toBe('token with quotes');
      expect(result.csrf_token).toBe('csrf_val');
    });
  });

  describe('Session Repository', () => {
    it('creates session with hashed token and role-based timeout', async () => {
      const user = await createTestUser({ role: 'PLAYER' });
      const { rawToken, session } = await authRepository.createSession(user.id, 'PLAYER');

      expect(rawToken).toBeDefined();
      expect(session.tokenHash).not.toBe(rawToken);
      expect(session.tokenHash).toBe(hashSessionToken(rawToken));
      expect(session.idleTimeoutMinutes).toBe(10080); // 7 days

      const elapsedMs = session.expiresAt.getTime() - session.createdAt.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(elapsedMs - thirtyDaysMs)).toBeLessThan(5000);
    });

    it('findActiveSessionWithUser returns session joined with user data', async () => {
      const user = await createTestUser({ role: 'ADMIN' });
      const { rawToken } = await authRepository.createSession(user.id, 'ADMIN');

      const found = await authRepository.findActiveSessionWithUser(rawToken);
      expect(found).not.toBeNull();
      expect(found?.user.id).toBe(user.id);
      expect(found?.user.email).toBe(user.email);
      expect(found?.user.role).toBe('ADMIN');
      expect(found?.user.status).toBe('ACTIVE');
    });

    it('revokeSessionByToken revokes only the matching session', async () => {
      const user = await createTestUser();
      const s1 = await authRepository.createSession(user.id, 'PLAYER');
      const s2 = await authRepository.createSession(user.id, 'PLAYER');

      await authRepository.revokeSessionByToken(s1.rawToken);

      const found1 = await authRepository.findActiveSessionWithUser(s1.rawToken);
      const found2 = await authRepository.findActiveSessionWithUser(s2.rawToken);

      expect(found1).toBeNull();
      expect(found2).not.toBeNull();
    });

    it('revokeAllSessionsForUser revokes all sessions of that user only', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const u1s1 = await authRepository.createSession(user1.id, 'PLAYER');
      const u1s2 = await authRepository.createSession(user1.id, 'PLAYER');
      const u2s1 = await authRepository.createSession(user2.id, 'PLAYER');

      await authRepository.revokeAllSessionsForUser(user1.id);

      expect(await authRepository.findActiveSessionWithUser(u1s1.rawToken)).toBeNull();
      expect(await authRepository.findActiveSessionWithUser(u1s2.rawToken)).toBeNull();
      expect(await authRepository.findActiveSessionWithUser(u2s1.rawToken)).not.toBeNull();
    });

    it('cleanupUserSessions deletes only revoked or expired sessions of that user', async () => {
      const user = await createTestUser();
      const sActive = await authRepository.createSession(user.id, 'PLAYER');
      const sRevoked = await authRepository.createSession(user.id, 'PLAYER');

      await authRepository.revokeSessionByToken(sRevoked.rawToken);
      await authRepository.cleanupUserSessions(user.id);

      const rows = await db.select().from(authSessions).where(eq(authSessions.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(sActive.session.id);
    });

    it('touchSessionLastSeen does not update timestamp if within 60 seconds', async () => {
      const user = await createTestUser();
      const { session } = await authRepository.createSession(user.id, 'PLAYER');

      const recentTime = new Date();
      await authRepository.touchSessionLastSeen(session.id, recentTime);

      const [after] = await db.select().from(authSessions).where(eq(authSessions.id, session.id));
      expect(after.lastSeenAt.getTime()).toBe(session.lastSeenAt.getTime());
    });
  });
});
