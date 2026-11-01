import type { TransactionContext } from './TransactionContext';

/**
 * Two-way block check (Matchmaking Tech Design §24.2). Provider: Messaging, MSG-08
 * foundation. Consumers: Matchmaking (MM-22 acceptance recheck, Invite send; MM-24 Apply).
 *
 * Defined here from the approved §24.2 signature so the consumer compiles. The Messaging
 * branch implements it and should keep this exact file and signature (coordination point).
 */
export interface BlockPort {
  isBlockedEitherWay(a: number, b: number, tx: TransactionContext): Promise<boolean>;
}
