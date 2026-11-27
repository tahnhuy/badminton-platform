import { createHash } from 'node:crypto';

/** Stable UUID (v4-shaped) for client request ids, so a reset always produces the same ids. */
export function uuidFor(key: string): string {
  const hex = createHash('sha256').update(`demo-seed:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
