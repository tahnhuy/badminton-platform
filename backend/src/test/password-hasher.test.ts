import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { passwordHasher, computePreHash } from '../modules/auth/password-hasher';
import {
  validateRegisterInput,
  validateLoginInput,
  validateChangePasswordInput,
  isPasswordPolicySatisfied,
  countCodePoints,
} from '../modules/auth/auth.validation';
import { AppError } from '../shared/http/app-error';

import { env } from '../shared/config/env';

describe('Password Hasher & Validation (AUTH-05)', () => {
  it('correctly counts code points and emojis', () => {
    expect(countCodePoints('🏸')).toBe(1);
    expect(countCodePoints('1234567')).toBe(7);
    expect(countCodePoints('12345678')).toBe(8);
  });

  it('rejects passwords shorter than 8 or longer than 64 code points', () => {
    expect(isPasswordPolicySatisfied('1234567')).toBe(false);
    expect(isPasswordPolicySatisfied('12345678')).toBe(true);
    expect(isPasswordPolicySatisfied('a'.repeat(64))).toBe(true);
    expect(isPasswordPolicySatisfied('a'.repeat(65))).toBe(false);
  });

  it('rejects passwords matching normalized email case-insensitively', () => {
    expect(isPasswordPolicySatisfied('User@Example.com', 'user@example.com')).toBe(false);
    expect(isPasswordPolicySatisfied('DifferentPass123', 'user@example.com')).toBe(true);
  });

  it('verifies composed vs decomposed Vietnamese Unicode NFKC forms', async () => {
    const composed = 'TiếngViệtCầuLông123!';
    const decomposed = composed.normalize('NFD');
    expect(composed).not.toBe(decomposed);

    const hash = await passwordHasher.hash(composed);
    const verified = await passwordHasher.verify(decomposed, hash);
    expect(verified).toBe(true);
  });

  it('hashes and verifies Vietnamese passwords exceeding 72 bytes without truncation', async () => {
    const longVietnamesePass = 'CầuLôngViệtNamVôĐịch'.repeat(3) + '1234'; // 64 code points
    const byteLength = Buffer.from(longVietnamesePass, 'utf8').length;
    expect(byteLength).toBeGreaterThan(72);

    const hash = await passwordHasher.hash(longVietnamesePass);
    const verified = await passwordHasher.verify(longVietnamesePass, hash);
    expect(verified).toBe(true);

    const altered = longVietnamesePass.slice(0, -1) + '5';
    const failedVerify = await passwordHasher.verify(altered, hash);
    expect(failedVerify).toBe(false);
  });

  it('matches independent HMAC-SHA-256 computation', () => {
    const pepperKey = Buffer.from(env.PASSWORD_PEPPER, 'base64');
    const independent = crypto
      .createHmac('sha256', pepperKey)
      .update('mySecretPassword'.normalize('NFKC'), 'utf8')
      .digest('base64');

    const result = computePreHash('mySecretPassword');
    expect(result).toBe(independent);
  });

  it('dummyVerify always returns false', async () => {
    const result = await passwordHasher.dummyVerify('anyPassword');
    expect(result).toBe(false);
  });

  it('validation maps multiple failing fields to top-level VALIDATION_FAILED with specific details', () => {
    expect(() =>
      validateRegisterInput({
        email: 'invalid-email',
        password: 'short',
        fullName: 'John',
        skillLevelCode: 'BEGINNER',
      })
    ).toThrowError(AppError);

    try {
      validateRegisterInput({
        email: 'invalid-email',
        password: 'short',
        fullName: 'John',
        skillLevelCode: 'BEGINNER',
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_FAILED');
      expect(err.details).toEqual([
        { field: 'email', code: 'VALIDATION_FAILED' },
        { field: 'password', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }
  });

  it('validation with only password error inherits top-level AUTH_PASSWORD_POLICY_VIOLATION', () => {
    try {
      validateRegisterInput({
        email: 'user@example.com',
        password: 'short',
        fullName: 'John',
        skillLevelCode: 'BEGINNER',
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('AUTH_PASSWORD_POLICY_VIOLATION');
      expect(err.details).toEqual([
        { field: 'password', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }
  });
});
