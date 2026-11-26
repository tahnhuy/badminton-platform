import crypto from 'crypto';
import { env } from '../../shared/config/env';

export type OtpPurpose = 'REGISTER' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE' | 'WITHDRAWAL_PIN_RESET';
export type ResetPurpose = 'PASSWORD_RESET' | 'PASSWORD_CHANGE' | 'WITHDRAWAL_PIN_RESET';

export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateChallengeId(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function computeOtpDigest(input: {
  challengeId: string;
  purpose: OtpPurpose;
  generation: number;
  otp: string;
}): string {
  const secret = Buffer.from(env.OTP_HMAC_SECRET, 'utf8');
  return crypto
    .createHmac('sha256', secret)
    .update(`${input.challengeId}:${input.purpose}:${input.generation}:${input.otp}`, 'utf8')
    .digest('hex');
}

export function otpDigestMatches(expected: string | null, actualDigest: string): boolean {
  if (!expected) return false;
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actualDigest, 'utf8');
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
