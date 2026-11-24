import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { systemConfigs } from '../db/schema/config';
import { clearConfigCache } from '../shared/config/config-registry';
import { users } from '../db/schema/users';
import { authChallenges, authResetTokens, withdrawalPins } from '../db/schema/auth';
import { emailOutbox } from '../db/schema/email';
import { adminActionAudits } from '../db/schema/admin-audit';
import { walletPayoutRequests } from '../db/schema/wallet';
import { authRepository } from '../repositories/auth/AuthRepository';
import {
  createTestUser,
  TEST_WITHDRAWAL_PIN,
  ensureWithdrawalPin,
  flushEmailOutbox,
  latestOtp,
  registerPayload,
} from './test-helpers';

async function startRegistration(payload = registerPayload()) {
  const response = await request(app).post('/api/v1/auth/register').send(payload);
  expect(response.status).toBe(202);
  await flushEmailOutbox();
  const otp = await latestOtp(payload.email, 'REGISTER_OTP');
  return { response, otp, payload };
}

describe('Email OTP registration (email-otp plan §3.1)', () => {
  it('creates no user before verification and verifies the email afterwards', async () => {
    const { response, otp, payload } = await startRegistration();
    expect(await db.select().from(users)).toHaveLength(0);

    const verified = await request(app)
      .post('/api/v1/auth/register/verify')
      .send({ challengeId: response.body.data.challengeId, otp });

    expect(verified.status).toBe(201);
    expect(verified.body.meta.skillSurveyResult).toBeDefined();
    const [user] = await db.select().from(users).where(eq(users.id, verified.body.data.id));
    expect(user.email).toBe(payload.email.toLowerCase());
    expect(user.emailVerifiedAt).not.toBeNull();
    const [pin] = await db.select().from(withdrawalPins).where(eq(withdrawalPins.userId, user.id));
    expect(pin).toBeDefined();
  });

  it('rejects wrong OTP, counts the attempt and then accepts the right one', async () => {
    const { response, otp } = await startRegistration();
    const wrong = await request(app)
      .post('/api/v1/auth/register/verify')
      .send({ challengeId: response.body.data.challengeId, otp: otp === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('AUTH_OTP_INVALID');

    const [challenge] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, response.body.data.challengeId));
    expect(challenge.failedAttempts).toBe(1);

    const verified = await request(app)
      .post('/api/v1/auth/register/verify')
      .send({ challengeId: response.body.data.challengeId, otp });
    expect(verified.status).toBe(201);
  });

  it('resend rotates the code and invalidates the previous one', async () => {
    const { response, otp: firstOtp, payload } = await startRegistration();
    await db
      .update(authChallenges)
      .set({ resendAvailableAt: new Date(Date.now() - 1000) })
      .where(eq(authChallenges.id, response.body.data.challengeId));
    const resent = await request(app)
      .post('/api/v1/auth/register/resend')
      .send({ challengeId: response.body.data.challengeId });
    expect(resent.status, JSON.stringify(resent.body)).toBe(200);
    await flushEmailOutbox();
    const secondOtp = await latestOtp(payload.email, 'REGISTER_OTP');
    expect(secondOtp).not.toBe(firstOtp);

    const stale = await request(app)
      .post('/api/v1/auth/register/verify')
      .send({ challengeId: response.body.data.challengeId, otp: firstOtp });
    expect(stale.status).toBe(400);

    const verified = await request(app)
      .post('/api/v1/auth/register/verify')
      .send({ challengeId: response.body.data.challengeId, otp: secondOtp });
    expect(verified.status).toBe(201);
  });

  it('reads the OTP attempt limit from the Admin system configuration', async () => {
    await db.insert(systemConfigs).values({ configKey: 'OTP_MAX_ATTEMPTS', configValue: '1' })
      .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: '1' } });
    clearConfigCache();
    try {
      const { response, otp } = await startRegistration();
      const wrong = await request(app)
        .post('/api/v1/auth/register/verify')
        .send({ challengeId: response.body.data.challengeId, otp: otp === '000000' ? '111111' : '000000' });
      expect(wrong.status).toBe(429);
      expect(wrong.body.error.code).toBe('AUTH_OTP_LOCKED');
    } finally {
      await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'OTP_MAX_ATTEMPTS'));
      clearConfigCache();
    }
  });

  it('returns 409 for an existing email without creating a pending registration or sending mail', async () => {
    const existing = await createTestUser({ email: 'exists@example.com' });
    const before = await db.select().from(emailOutbox);
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registerPayload({ email: 'EXISTS@example.com' }));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
    expect(await db.select().from(emailOutbox)).toHaveLength(before.length);
    expect((await db.select().from(users)).find(user => user.id === existing.id)).toBeTruthy();
  });
});

describe('Password recovery (email-otp plan §3.2)', () => {
  it('uses the same response shape for known and unknown emails but only mails a real account', async () => {
    await createTestUser({ email: 'known@example.com' });
    const known = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'known@example.com' });
    const unknown = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'unknown@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(Object.keys(known.body.data).sort()).toEqual(Object.keys(unknown.body.data).sort());
    expect(known.body.data.challengeId).not.toBe(unknown.body.data.challengeId);

    await flushEmailOutbox();
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, 'known@example.com'))).toHaveLength(1);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, 'unknown@example.com'))).toHaveLength(0);

    const fake = await request(app)
      .post('/api/v1/auth/password/reset/verify')
      .send({ challengeId: unknown.body.data.challengeId, otp: '123456' });
    expect(fake.status).toBe(400);
    expect(fake.body.error.code).toBe('AUTH_OTP_INVALID');
  });

  it('resets the password, consumes the token and revokes every session', async () => {
    const user = await createTestUser({ email: 'reset@example.com', role: 'PLAYER' });
    const session = await authRepository.createSession(user.id, 'PLAYER');

    const forgot = await request(app).post('/api/v1/auth/password/forgot').send({ email: user.email });
    await flushEmailOutbox();
    const otp = await latestOtp(user.email, 'PASSWORD_RESET_OTP');
    const verified = await request(app)
      .post('/api/v1/auth/password/reset/verify')
      .send({ challengeId: forgot.body.data.challengeId, otp });
    expect(verified.status).toBe(200);

    const reserved = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ resetToken: verified.body.data.resetToken, newPassword: 'BrandNewPass123!' });
    expect(reserved.status).toBe(200);

    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect(await authRepository.findActiveSessionWithUser(session.rawToken)).toBeNull();
    expect(await db.select().from(authResetTokens).where(and(
      eq(authResetTokens.userId, user.id),
      eq(authResetTokens.purpose, 'PASSWORD_RESET'),
    ))).toHaveLength(1);

    const replay = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ resetToken: verified.body.data.resetToken, newPassword: 'AnotherPass123!' });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('AUTH_RESET_TOKEN_INVALID');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'BrandNewPass123!' });
    expect(login.status).toBe(200);
  });
});

describe('Withdrawal PIN and payout authorization (email-otp plan §3.3-§3.4)', () => {
  it('sets the PIN through email OTP and reports the status', async () => {
    const user = await createTestUser({ role: 'PLAYER' });
    const headers = { 'x-user-id': String(user.id) };

    const before = await request(app).get('/api/v1/wallet/withdrawal-pin').set(headers);
    expect(before.body.data).toEqual({ hasPin: false, lockedUntil: null });

    const requested = await request(app).post('/api/v1/wallet/withdrawal-pin/reset/request').set(headers);
    expect(requested.status).toBe(200);
    await flushEmailOutbox();
    const otp = await latestOtp(user.email, 'WITHDRAWAL_PIN_RESET_OTP');

    const verified = await request(app)
      .post('/api/v1/wallet/withdrawal-pin/reset/verify')
      .set(headers)
      .send({ challengeId: requested.body.data.challengeId, otp });
    expect(verified.status).toBe(200);

    const saved = await request(app)
      .post('/api/v1/wallet/withdrawal-pin/reset')
      .set(headers)
      .send({ resetToken: verified.body.data.resetToken, newPin: '481632', confirmPin: '481632' });
    expect(saved.status).toBe(200);

    const after = await request(app).get('/api/v1/wallet/withdrawal-pin').set(headers);
    expect(after.body.data.hasPin).toBe(true);
  });

  it('rejects a wrong PIN without creating a payout and makes clientRequestId idempotent', async () => {
    const user = await createTestUser({ role: 'PLAYER' });
    await ensureWithdrawalPin(user.id);
    const { walletService } = await import('../services/payments/WalletService');
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    const bank = await request(app)
      .post('/api/v1/wallet/bank-accounts')
      .set('x-user-id', String(user.id))
      .send({ bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'PLAYER' });

    const clientRequestId = randomUUID();
    const wrong = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('x-user-id', String(user.id))
      .send({ amount: '40000', bankAccountId: bank.body.data.id, withdrawalPin: '000000', clientRequestId });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WALLET_PIN_INVALID');
    expect(await db.select().from(walletPayoutRequests)).toHaveLength(0);

    const body = { amount: '40000', bankAccountId: bank.body.data.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId };
    const first = await request(app).post('/api/v1/wallet/withdrawals').set('x-user-id', String(user.id)).send(body);
    expect(first.status).toBe(201);
    const replay = await request(app).post('/api/v1/wallet/withdrawals').set('x-user-id', String(user.id)).send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(await db.select().from(walletPayoutRequests)).toHaveLength(1);

    const conflict = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('x-user-id', String(user.id))
      .send({ ...body, amount: '50000' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('WALLET_PAYOUT_IDEMPOTENCY_CONFLICT');
  });

  it('locks the PIN after five wrong attempts and returns lockedUntil', async () => {
    const user = await createTestUser({ role: 'PLAYER' });
    await ensureWithdrawalPin(user.id);
    const { walletService } = await import('../services/payments/WalletService');
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await request(app)
      .post('/api/v1/wallet/bank-accounts')
      .set('x-user-id', String(user.id))
      .send({ bankCode: 'ACB', accountNumber: '99999999', accountName: 'PLAYER' });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/wallet/withdrawals')
        .set('x-user-id', String(user.id))
        .send({ amount: '10000', bankAccountId: bank.body.data.id, withdrawalPin: '000000', clientRequestId: randomUUID() });
      expect(response.body.error.code).toBe('WALLET_PIN_INVALID');
    }
    const fifth = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('x-user-id', String(user.id))
      .send({ amount: '10000', bankAccountId: bank.body.data.id, withdrawalPin: '000000', clientRequestId: randomUUID() });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('WALLET_PIN_LOCKED');
    expect(fifth.body.error.details[0].lockedUntil).toBeDefined();

    const status = await request(app).get('/api/v1/wallet/withdrawal-pin').set('x-user-id', String(user.id));
    expect(status.body.data.lockedUntil).not.toBeNull();
  });
});

describe('Admin password reset audit (email-otp plan §3.5)', () => {
  it('generates a temporary password, writes an audit row and never emails the password', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const owner = await createTestUser({ role: 'COURT_OWNER', email: 'owner-reset@example.com' });

    const response = await request(app)
      .post(`/api/v1/admin/users/${owner.id}/password`)
      .set('x-user-id', String(admin.id))
      .send({ reason: 'Owner lost access' });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.temporaryPassword).toHaveLength(20);

    const [audit] = await db.select().from(adminActionAudits);
    expect(audit).toMatchObject({
      adminId: admin.id,
      targetUserId: owner.id,
      action: 'ADMIN_RESET_PASSWORD',
      reason: 'Owner lost access',
      result: 'SUCCESS',
    });
    expect(JSON.stringify(audit)).not.toContain(response.body.temporaryPassword);

    await flushEmailOutbox();
    const mail = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, owner.email));
    expect(mail).toHaveLength(1);
    expect(mail[0].template).toBe('ADMIN_PASSWORD_RESET');
    expect(JSON.stringify(mail[0].payload)).not.toContain(response.body.temporaryPassword);
  });
});

describe('Voluntary password change (email-otp plan extension 2026-11-24)', () => {
  function authCookies(response: request.Response): { cookie: string; csrf: string } {
    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    const list = setCookie ?? [];
    const cookie = list.map(value => value.split(';')[0]).join('; ');
    const csrf = list.find(value => value.startsWith('csrf_token='))!.split(';')[0].slice('csrf_token='.length);
    return { cookie, csrf };
  }

  it('requires email OTP for a voluntary change and accepts the one-time authorization', async () => {
    const user = await createTestUser({ email: 'voluntary-change@example.com', password: 'OldPassword123!' });
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'OldPassword123!' });
    expect(login.status).toBe(200);
    const { cookie, csrf } = authCookies(login);

    const withoutOtp = await request(app)
      .post('/api/v1/auth/password/change')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' });
    expect(withoutOtp.status).toBe(400);
    expect(withoutOtp.body.error.code).toBe('AUTH_PASSWORD_CHANGE_OTP_REQUIRED');

    const requested = await request(app)
      .post('/api/v1/auth/password/change/request')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(requested.status).toBe(200);
    await flushEmailOutbox();
    const otp = await latestOtp(user.email, 'PASSWORD_CHANGE_OTP');

    const verified = await request(app)
      .post('/api/v1/auth/password/change/verify')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ challengeId: requested.body.data.challengeId, otp });
    expect(verified.status).toBe(200);
    expect(verified.body.data.resetToken).toBeDefined();

    const changed = await request(app)
      .post('/api/v1/auth/password/change')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!', resetToken: verified.body.data.resetToken });
    expect(changed.status).toBe(200);

    const replay = await request(app)
      .post('/api/v1/auth/password/change')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'NewPassword123!', newPassword: 'AnotherPassword123!', resetToken: verified.body.data.resetToken });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('does not require OTP for the forced first change after an Admin reset', async () => {
    const user = await createTestUser({ email: 'forced-change@example.com', password: 'TempPassword123!', mustChangePassword: true });
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'TempPassword123!' });
    const { cookie, csrf } = authCookies(login);

    const changed = await request(app)
      .post('/api/v1/auth/password/change')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'TempPassword123!', newPassword: 'NewPassword123!' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.requiresPasswordChange).toBe(false);
  });
});
