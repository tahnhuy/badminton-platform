import type { BlockPort } from '../../contracts/BlockPort';
import type { TransactionContext } from '../../contracts/TransactionContext';

// Matchmaking consumes the real BlockPort from Messaging (MSG-08 foundation). There is no
// production fallback: until a provider is registered, every block-checked Matchmaking
// action fails closed with an internal error instead of assuming "not blocked".
let provider: BlockPort | null = null;

export class BlockPortUnavailableError extends Error {
  constructor() {
    super('BlockPort provider is not registered (Messaging MSG-08 foundation required)');
    this.name = 'BlockPortUnavailableError';
  }
}

export function registerBlockPort(port: BlockPort | null): void {
  provider = port;
}

export function isBlockPortRegistered(): boolean {
  return provider !== null;
}

export async function isBlockedEitherWay(a: number, b: number, tx: TransactionContext): Promise<boolean> {
  if (!provider) throw new BlockPortUnavailableError();
  return provider.isBlockedEitherWay(a, b, tx);
}
