import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const DEFAULT_PEPPER = 'badminton_platform_secret_pepper_min_32_bytes_long';

export async function hashPassword(password: string): Promise<string> {
  const pepper = process.env.PASSWORD_PEPPER || DEFAULT_PEPPER;
  const normalized = password.normalize('NFKC');
  const preHashed = crypto
    .createHmac('sha256', pepper)
    .update(normalized, 'utf8')
    .digest('base64');

  return bcrypt.hash(preHashed, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const pepper = process.env.PASSWORD_PEPPER || DEFAULT_PEPPER;
  const normalized = password.normalize('NFKC');
  const preHashed = crypto
    .createHmac('sha256', pepper)
    .update(normalized, 'utf8')
    .digest('base64');

  return bcrypt.compare(preHashed, hash);
}
