import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../shared/config/env';

const BCRYPT_SALT_ROUNDS = 12;

function pepperKey(): Buffer {
  return crypto.createHash('sha256').update(env.WITHDRAWAL_PIN_PEPPER, 'utf8').digest();
}

function preHash(pin: string): string {
  return crypto
    .createHmac('sha256', pepperKey())
    .update(pin.normalize('NFKC'), 'utf8')
    .digest('base64');
}

export const withdrawalPinHasher = {
  async hash(pin: string): Promise<string> {
    return bcrypt.hash(preHash(pin), BCRYPT_SALT_ROUNDS);
  },

  async verify(pin: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(preHash(pin), storedHash);
  },
};

/** Strong PINs only: 6 digits, no uniform/repeated/sequential patterns (§6). */
export function isWithdrawalPinAcceptable(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  if (new Set(pin).size === 1) return false;

  let ascending = true;
  let descending = true;
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) !== Number(pin[i - 1]) + 1) ascending = false;
    if (Number(pin[i]) !== Number(pin[i - 1]) - 1) descending = false;
  }
  if (ascending || descending) return false;

  // Two-digit repeating block (121212) or three-digit repeating block (123123).
  for (const size of [2, 3]) {
    const block = pin.slice(0, size);
    if (block.repeat(6 / size) === pin) return false;
  }

  return true;
}
