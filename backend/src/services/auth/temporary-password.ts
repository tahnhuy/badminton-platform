import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=?';
const TEMP_PASSWORD_LENGTH = 20;

/**
 * Cryptographically random temporary password using rejection sampling: bytes
 * outside the largest full multiple of the alphabet size are discarded instead
 * of using modulo bias.
 */
export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let result = '';
  while (result.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte >= limit) continue;
      result += ALPHABET[byte % ALPHABET.length];
      if (result.length === length) break;
    }
  }
  return result;
}
