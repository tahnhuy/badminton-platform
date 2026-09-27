import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../shared/config/env';

const BCRYPT_SALT_ROUNDS = 12;
const DUMMY_PASSWORD = 'badminton-platform-dummy-password-timing-equalization';

let dummyHashPromise: Promise<string> | null = null;

function getPepperKey(): Buffer {
  return Buffer.from(env.PASSWORD_PEPPER, 'base64');
}

/**
 * Computes base64(HMAC-SHA-256(pepper_bytes, NFKC(password_utf8)))
 */
export function computePreHash(password: string): string {
  const normalized = password.normalize('NFKC');
  const key = getPepperKey();
  return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('base64');
}

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    const dummyHmac = computePreHash(DUMMY_PASSWORD);
    dummyHashPromise = bcrypt.hash(dummyHmac, BCRYPT_SALT_ROUNDS);
  }
  return dummyHashPromise;
}

export const passwordHasher = {
  /**
   * Hashes a password using Unicode NFKC -> HMAC-SHA-256 (with secret pepper) -> bcrypt (cost 12)
   */
  async hash(password: string): Promise<string> {
    const preHash = computePreHash(password);
    return bcrypt.hash(preHash, BCRYPT_SALT_ROUNDS);
  },

  async hashPassword(password: string): Promise<string> {
    return this.hash(password);
  },

  /**
   * Verifies a candidate password against the stored bcrypt hash using the same pipeline
   */
  async verify(candidatePassword: string, storedHash: string): Promise<boolean> {
    const preHash = computePreHash(candidatePassword);
    return bcrypt.compare(preHash, storedHash);
  },

  async verifyPassword(candidatePassword: string, storedHash: string): Promise<boolean> {
    return this.verify(candidatePassword, storedHash);
  },

  /**
   * Timing equalization: runs HMAC and bcrypt comparison against a dummy hash when user is not found
   * Always resolves to false
   */
  async dummyVerify(candidatePassword: string): Promise<boolean> {
    const preHash = computePreHash(candidatePassword);
    const dummyHash = await getDummyHash();
    await bcrypt.compare(preHash, dummyHash);
    return false;
  },
};

