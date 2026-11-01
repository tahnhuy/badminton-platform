import type { BlockPort } from '../contracts/BlockPort';

// TEST-ONLY consumer-side double for the Messaging BlockPort (MSG-08 foundation is not
// merged yet). Production registers no provider, so block-checked actions fail closed.
// Integration acceptance of MM-22/MM-24 still requires the real provider.
const blocked = new Set<string>();
const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export const testBlockPort: BlockPort & { block(a: number, b: number): void; clear(): void } = {
  async isBlockedEitherWay(a, b) {
    return blocked.has(key(a, b));
  },
  block(a, b) {
    blocked.add(key(a, b));
  },
  clear() {
    blocked.clear();
  },
};
