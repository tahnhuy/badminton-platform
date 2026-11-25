import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { users, playerProfiles, skillLevels } from '../db/schema/users';
import { authSessions, authLoginLockouts } from '../db/schema/auth';
import { createTestUser, surveyBody, registerPayload, flushEmailOutbox, latestOtp } from './test-helpers';
import { authService } from '../services/auth/AuthService';

function extractCookies(res: request.Response): { sid?: string; csrf_token?: string } {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return {};
  const cookies: { sid?: string; csrf_token?: string } = {};
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const item of list) {
    if (item.includes('sid=')) {
      const match = item.match(/sid=([^;]+)/);
      if (match) cookies.sid = match[1];
    }
    if (item.includes('csrf_token=')) {
      const match = item.match(/csrf_token=([^;]+)/);
      if (match) cookies.csrf_token = match[1];
    }
  }
  return cookies;
}

describe('Core Auth Endpoints (Wave 6)', () => {
  describe('AUTH-09: POST /api/v1/auth/register', () => {
    it('registers a Player only after the email OTP without signing in (PRD AC 15.1-1, 15.1-7, Decision #28)', async () => {
      const payload = registerPayload({
        email: 'NewPlayer@Example.com',
        fullName: 'Nguyen Van A',
      });

      const pending = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(pending.status).toBe(202);
      expect(pending.body.data.challengeId).toBeDefined();
      expect(pending.body.data.expiresAt).toBeDefined();
      // No user or session exists before OTP verification.
      expect(await db.select().from(users)).toHaveLength(0);

      await flushEmailOutbox();
      const otp = await latestOtp('newplayer@example.com', 'REGISTER_OTP');
      const res = await request(app)
        .post('/api/v1/auth/register/verify')
        .send({ challengeId: pending.body.data.challengeId, otp });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        email: 'newplayer@example.com',
        role: 'PLAYER',
        requiresPasswordChange: false,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.meta.skillSurveyResult).toBeDefined();

      // Registration does not sign in: no cookies and no session row
      expect(res.headers['set-cookie']).toBeUndefined();
      const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, res.body.data.id));
      expect(sessions).toHaveLength(0);

      // Check database state
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, res.body.data.id));
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe('newplayer@example.com');
      expect(dbUser.role).toBe('PLAYER');
      expect(dbUser.status).toBe('ACTIVE');
      expect(dbUser.mustChangePassword).toBe(false);
      expect(dbUser.emailVerifiedAt).not.toBeNull();

      // Check player profile
      const [profile] = await db
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, res.body.data.id));
      expect(profile).toBeDefined();
      expect(profile.fullName).toBe('Nguyen Van A');

      // Check linked skill level rank
      const [skill] = await db
        .select()
        .from(skillLevels)
        .where(eq(skillLevels.id, profile.skillLevelId));
      expect(skill.rank).toBe(4);
      expect(skill.code).toBe('AVERAGE');

      // Verify sign in with different letter cases
      const loginRes1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'newplayer@example.com', password: 'ValidPassword123!' });
      expect(loginRes1.status).toBe(200);

      const loginRes2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'NEWPLAYER@EXAMPLE.COM', password: 'ValidPassword123!' });
      expect(loginRes2.status).toBe(200);
    });

    it('rejects duplicate email in different letter case, active or soft-deleted, with 409 (PRD AC 15.1-2)', async () => {
      // 1. Create an active user
      await createTestUser({ email: 'active_dupe@example.com' });

      const res1 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'ACTIVE_DUPE@EXAMPLE.COM',
          password: 'ValidPassword123!',
          fullName: 'Test Player',
          withdrawalPin: '284691',
          withdrawalPinConfirm: '284691',
          skillSurvey: surveyBody(),
        });

      expect(res1.status).toBe(409);
      expect(res1.body.error.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');

      // 2. Create a soft-deleted user
      await createTestUser({
        email: 'deleted_user@example.com',
        deletedAt: new Date(),
      });

      const userCountBefore = (await db.select().from(users)).length;

      const res2 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'DELETED_USER@EXAMPLE.COM',
          password: 'ValidPassword123!',
          fullName: 'Another Test',
          withdrawalPin: '284691',
          withdrawalPinConfirm: '284691',
          skillSurvey: surveyBody(),
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');

      const userCountAfter = (await db.select().from(users)).length;
      expect(userCountAfter).toBe(userCountBefore);
    });

    it('rejects invalid password and malformed input with correct errors (PRD AC 15.1-3, 15.1-4, 15.1-5, 15.1-6)', async () => {
      // Password policy violation
      const resPass = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'shortpass@example.com',
          password: 'short',
          fullName: 'Short Pass',
          withdrawalPin: '284691',
          withdrawalPinConfirm: '284691',
          skillSurvey: surveyBody(),
        });
      expect(resPass.status).toBe(400);
      expect(resPass.body.error.code).toBe('AUTH_PASSWORD_POLICY_VIOLATION');

      // Extra forbidden field like role
      const resRole = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'roleinject@example.com',
          password: 'ValidPassword123!',
          fullName: 'Role Inject',
          withdrawalPin: '284691',
          withdrawalPinConfirm: '284691',
          skillSurvey: surveyBody(),
          role: 'ADMIN',
        });
      expect(resRole.status).toBe(400);
      expect(resRole.body.error.code).toBe('VALIDATION_FAILED');

    });
  });

  describe('AUTH-10: POST /api/v1/auth/login', () => {
    it('signs in active user with correct password and cleans up expired sessions (PRD AC 15.3-1, 15.3-2)', async () => {
      const user = await createTestUser({
        email: 'signin_test@example.com',
        password: 'ValidPassword123!',
        role: 'PLAYER',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'SignIn_Test@Example.com', password: 'ValidPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        role: 'PLAYER',
        requiresPasswordChange: false,
      });

      const cookies = extractCookies(res);
      expect(cookies.sid).toBeDefined();
      expect(cookies.csrf_token).toBeDefined();
    });

    it('returns byte-identical 401 AUTH_INVALID_CREDENTIALS for unknown email and wrong password (PRD AC 15.3-3, 15.3-4)', async () => {
      await createTestUser({
        email: 'existing_user@example.com',
        password: 'CorrectPassword123!',
      });

      const resUnknown = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown_user@example.com', password: 'AnyPassword123!' });

      const resWrongPass = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'existing_user@example.com', password: 'WrongPassword123!' });

      expect(resUnknown.status).toBe(401);
      expect(resWrongPass.status).toBe(401);

      // Verify byte-identical bodies
      expect(resUnknown.text).toBe(resWrongPass.text);
      expect(resUnknown.body).toEqual({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: [],
        },
      });
    });

    it('soft-deleted account always receives 401, never 429, and creates no lockout row (PRD Decision #16)', async () => {
      const deletedUser = await createTestUser({
        email: 'soft_del@example.com',
        password: 'ValidPassword123!',
        deletedAt: new Date(),
      });

      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'soft_del@example.com', password: 'WrongPassword123!' });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      }

      const [lockout] = await db
        .select()
        .from(authLoginLockouts)
        .where(eq(authLoginLockouts.userId, deletedUser.id));
      expect(lockout).toBeUndefined();
    });

    it('rejects SUSPENDED and DEACTIVATED accounts with 403 AUTH_ACCOUNT_RESTRICTED (PRD AC 15.3-6)', async () => {
      await createTestUser({
        email: 'suspended@example.com',
        password: 'ValidPassword123!',
        status: 'SUSPENDED',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'suspended@example.com', password: 'ValidPassword123!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
    });

    it('locks account after 5 consecutive failed attempts with 429 AUTH_ACCOUNT_LOCKED (PRD AC 15.3-7, 15.3-10)', async () => {
      const user = await createTestUser({
        email: 'lockout_test@example.com',
        password: 'CorrectPassword123!',
      });

      // 5 wrong attempts
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'lockout_test@example.com', password: 'WrongPassword123!' });
        expect(res.status).toBe(401);
      }

      // 6th attempt with correct password -> still locked
      const res6 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lockout_test@example.com', password: 'CorrectPassword123!' });

      expect(res6.status).toBe(429);
      expect(res6.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(res6.headers['retry-after']).toBeDefined();
      expect(res6.body.error.details[0]?.lockedUntil).toBeDefined();

      // Check lockout record in database
      const [lockout] = await db
        .select()
        .from(authLoginLockouts)
        .where(eq(authLoginLockouts.userId, user.id));
      expect(lockout).toBeDefined();
      expect(lockout.failedAttempts).toBe(5);
      expect(lockout.lockedUntil).not.toBeNull();
    });

    it('resets lockout failed attempts upon successful login (PRD AC 15.3-8)', async () => {
      const user = await createTestUser({
        email: 'reset_counter@example.com',
        password: 'CorrectPassword123!',
      });

      // 1 failure
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reset_counter@example.com', password: 'WrongPassword123!' });

      // 1 success
      const resSuccess = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reset_counter@example.com', password: 'CorrectPassword123!' });
      expect(resSuccess.status).toBe(200);

      // Check counter is 0
      const [lockout1] = await db
        .select()
        .from(authLoginLockouts)
        .where(eq(authLoginLockouts.userId, user.id));
      expect(lockout1.failedAttempts).toBe(0);

      // 1 more failure
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reset_counter@example.com', password: 'WrongPassword123!' });

      const [lockout2] = await db
        .select()
        .from(authLoginLockouts)
        .where(eq(authLoginLockouts.userId, user.id));
      expect(lockout2.failedAttempts).toBe(1);
    });

    it('atomic lockout increments correctly with parallel failed attempts', async () => {
      const user = await createTestUser({
        email: 'parallel_lock@example.com',
        password: 'CorrectPassword123!',
      });

      // Send 2 parallel wrong-password requests
      await Promise.all([
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'parallel_lock@example.com', password: 'WrongPassword123!' }),
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'parallel_lock@example.com', password: 'WrongPassword123!' }),
      ]);

      const [lockout] = await db
        .select()
        .from(authLoginLockouts)
        .where(eq(authLoginLockouts.userId, user.id));
      expect(lockout.failedAttempts).toBe(2);
    });
  });

  describe('AUTH-11: GET /api/v1/auth/me & POST /api/v1/auth/logout', () => {
    it('GET /me returns user info and issues csrf_token if missing', async () => {
      const user = await createTestUser({
        email: 'me_test@example.com',
        password: 'ValidPassword123!',
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'me_test@example.com', password: 'ValidPassword123!' });
      const cookies = extractCookies(loginRes);

      // Call /me with sid only (no csrf_token cookie)
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookies.sid}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        id: user.id,
        email: user.email,
        role: 'PLAYER',
        requiresPasswordChange: false,
      });

      // Verify csrf_token was re-issued
      const reissued = extractCookies(res);
      expect(reissued.csrf_token).toBeDefined();
    });

    it('POST /logout revokes session and clears cookies (PRD AC 15.4-3)', async () => {
      await createTestUser({
        email: 'logout_test@example.com',
        password: 'ValidPassword123!',
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'logout_test@example.com', password: 'ValidPassword123!' });
      const cookies = extractCookies(loginRes);

      // Logout with sid and CSRF token
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`sid=${cookies.sid}`, `csrf_token=${cookies.csrf_token}`])
        .set('X-CSRF-Token', cookies.csrf_token!);

      expect(logoutRes.status).toBe(204);

      // Old cookie is now rejected with 401
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookies.sid}`);
      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('multi-device sign-out: signing out device A leaves device B session intact (PRD AC 15.4-4)', async () => {
      await createTestUser({
        email: 'multidevice@example.com',
        password: 'ValidPassword123!',
      });

      // Sign in on Device A
      const loginA = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'multidevice@example.com', password: 'ValidPassword123!' });
      const cookiesA = extractCookies(loginA);

      // Sign in on Device B
      const loginB = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'multidevice@example.com', password: 'ValidPassword123!' });
      const cookiesB = extractCookies(loginB);

      // Device A logs out
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`sid=${cookiesA.sid}`, `csrf_token=${cookiesA.csrf_token}`])
        .set('X-CSRF-Token', cookiesA.csrf_token!);

      // Device A is invalid
      const checkA = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookiesA.sid}`);
      expect(checkA.status).toBe(401);

      // Device B is still valid 200
      const checkB = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookiesB.sid}`);
      expect(checkB.status).toBe(200);
      expect(checkB.body.data.email).toBe('multidevice@example.com');
    });

    it('POST /logout with no session returns 204 (idempotent)', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(204);
    });
  });

  describe('AUTH-12: POST /api/v1/auth/password/change', () => {
    it('successfully changes password and clears mustChangePassword requirement (PRD AC 15.5-1)', async () => {
      const user = await createTestUser({
        email: 'change_pass@example.com',
        password: 'OldPassword123!',
        mustChangePassword: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'change_pass@example.com', password: 'OldPassword123!' });
      const cookies = extractCookies(loginRes);

      // Change password
      const changeRes = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Cookie', [`sid=${cookies.sid}`, `csrf_token=${cookies.csrf_token}`])
        .set('X-CSRF-Token', cookies.csrf_token!)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'BrandNewPassword123!',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        requiresPasswordChange: false,
      });

      // Verify sign in with old password fails
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'change_pass@example.com', password: 'OldPassword123!' });
      expect(oldLogin.status).toBe(401);

      // Verify sign in with new password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'change_pass@example.com', password: 'BrandNewPassword123!' });
      expect(newLogin.status).toBe(200);

      // Current session is still valid
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookies.sid}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.requiresPasswordChange).toBe(false);
    });

    it('rejects wrong currentPassword with 400 AUTH_CURRENT_PASSWORD_INCORRECT (PRD AC 15.5-2)', async () => {
      await createTestUser({
        email: 'wrong_current@example.com',
        password: 'ActualPassword123!',
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong_current@example.com', password: 'ActualPassword123!' });
      const cookies = extractCookies(loginRes);

      const changeRes = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Cookie', [`sid=${cookies.sid}`, `csrf_token=${cookies.csrf_token}`])
        .set('X-CSRF-Token', cookies.csrf_token!)
        .send({
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'SomeNewPassword123!',
        });

      expect(changeRes.status).toBe(400);
      expect(changeRes.body.error.code).toBe('AUTH_CURRENT_PASSWORD_INCORRECT');
    });
  });

  describe('AUTH-13: Admin User Management Service Functions', () => {
    it('authService.createCourtOwnerAccount creates COURT_OWNER with mustChangePassword = true', async () => {
      const owner = await authService.createCourtOwnerAccount({
        email: 'Owner_Business@Example.com',
        initialPassword: 'TempOwnerPass123!',
        businessName: 'San Cau Long ABC',
        phone: '0901234567',
      });

      expect(owner.id).toBeDefined();
      expect(owner.email).toBe('owner_business@example.com');
      expect(owner.role).toBe('COURT_OWNER');
      expect(owner.status).toBe('ACTIVE');
      expect(owner.mustChangePassword).toBe(true);

      // Sign in with initial password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'owner_business@example.com', password: 'TempOwnerPass123!' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.requiresPasswordChange).toBe(true);
    });

    it('authService.adminSetPassword updates hash, sets mustChangePassword=true, revokes sessions, and resets lockout', async () => {
      const user = await createTestUser({
        email: 'admin_reset_user@example.com',
        password: 'UserOriginalPass123!',
      });

      // Login to get session
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin_reset_user@example.com', password: 'UserOriginalPass123!' });
      const cookies = extractCookies(loginRes);

      // Admin resets password
      await authService.adminSetPassword(user.id, 'AdminForcedNewPass123!');

      // Old session is now revoked (401)
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `sid=${cookies.sid}`);
      expect(meRes.status).toBe(401);

      // Login with new password succeeds and requires password change
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin_reset_user@example.com', password: 'AdminForcedNewPass123!' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.requiresPasswordChange).toBe(true);
    });
  });

  describe('AUTH-14: Operator Script to Provision Admin Accounts', () => {
    it('creates admin account with correct role and normalizes email via authService.createAdminAccount', async () => {
      const admin = await authService.createAdminAccount({
        email: 'Admin_Operator@Example.com',
        password: 'AdminPassword123!',
      });

      expect(admin.id).toBeDefined();
      expect(admin.email).toBe('admin_operator@example.com');
      expect(admin.role).toBe('ADMIN');
      expect(admin.status).toBe('ACTIVE');
      expect(admin.mustChangePassword).toBe(false);

      // Sign in works
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ADMIN_OPERATOR@EXAMPLE.COM', password: 'AdminPassword123!' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.role).toBe('ADMIN');
      expect(loginRes.body.data.requiresPasswordChange).toBe(false);
    });

    it('runs create-admin.ts script via child process with password from stdin', async () => {
      const { spawn } = await import('child_process');
      const path = await import('path');

      const scriptPath = path.resolve(__dirname, '../scripts/create-admin.ts');
      const testEmail = 'script_admin@example.com';
      const testPassword = 'ScriptAdminPass123!';

      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolve, reject) => {
          const child = spawn(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['tsx', scriptPath, testEmail],
            {
              shell: true,
              env: {
                ...process.env,
                DATABASE_URL: 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test',
              },
            }
          );

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });
          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            resolve({ code, stdout, stderr });
          });
          child.on('error', (err) => {
            reject(err);
          });

          child.stdin?.write(testPassword);
          child.stdin?.end();
        }
      );

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Admin account created successfully with ID:');

      // Verify in database
      const [dbAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail));
      expect(dbAdmin).toBeDefined();
      expect(dbAdmin.role).toBe('ADMIN');
      expect(dbAdmin.status).toBe('ACTIVE');
      expect(dbAdmin.mustChangePassword).toBe(false);
    });
  });
});

