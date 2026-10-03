import { passwordHasher } from '../services/auth/password-hasher';

/**
 * Compatibility wrappers around the canonical authentication password hasher.
 *
 * The admin/seed flows previously used a standalone implementation; they now share the
 * exact same NFKC -> HMAC-SHA-256(pepper) -> bcrypt pipeline as the auth module so that
 * users created by any flow can authenticate through the login endpoint.
 */
export async function hashPassword(password: string): Promise<string> {
  return passwordHasher.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return passwordHasher.verify(password, hash);
}
