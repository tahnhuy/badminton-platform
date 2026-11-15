import type { BlockPort } from '../contracts/BlockPort';
import { db } from '../db';
import type { DbExecutor } from '../repositories/auth/AuthRepository';
import { messagingRepository } from '../repositories/messaging/MessagingRepository';

// Consumer-side test helper for BlockPort that supports both in-memory test blocks
// (`testBlockPort.block(a, b)`) and real database blocks (`user_blocks` table).
const blocked = new Set<string>();
const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export const testBlockPort: BlockPort & { block(a: number, b: number): void; clear(): void } = {
  async isBlockedEitherWay(a, b, tx) {
    if (blocked.has(key(a, b))) {
      return true;
    }
    return messagingRepository.isBlockedEitherWay(a, b, (tx as unknown as DbExecutor) ?? db);
  },
  block(a, b) {
    blocked.add(key(a, b));
  },
  clear() {
    blocked.clear();
  },
};
