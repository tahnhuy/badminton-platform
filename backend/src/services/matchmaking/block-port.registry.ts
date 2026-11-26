import type { BlockPort } from '../../contracts/BlockPort';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';

// Matchmaking consumes the real BlockPort from Messaging (MSG-08 foundation). There is no
// production fallback: until a provider is registered, every block-checked Matchmaking
// action fails closed with a neutral unavailable response instead of assuming "not blocked".
let provider: BlockPort | null = null;

export class BlockPortUnavailableError extends AppError {
  constructor() {
    super('MATCHMAKING_ACTION_NOT_AVAILABLE', 409, 'Tính năng tham gia kèo tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
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

/**
 * Batch counterpart lookup for Social visibility. Unlike Matchmaking mutations, a missing
 * provider must not make every feed request fail: blocks simply cannot be applied yet.
 */
export async function blockedCounterpartIds(
  userId: number,
  reader?: TransactionContext
): Promise<ReadonlySet<number>> {
  if (!provider) return new Set();
  return provider.blockedCounterpartIds(userId, reader);
}
