import type { TransactionContext } from './TransactionContext';

/**
 * Matchmaking Tech Design §24.2. Provider: Matchmaking (MM-22). Consumer: Messaging
 * block transaction (MSG-08 integration).
 *
 * The caller passes the same transaction that inserts the block and already holds both
 * USERS row locks in ascending id order. Closes only PENDING Apply/Invite rows between
 * the pair (either direction, host ↔ joiner) with close_reason BLOCKED, locking
 * requests(30) then membership rows(40) ascending. Never commits, notifies, or changes
 * ACCEPTED rows, Matches or conversations.
 */
export interface MatchmakingBlockPort {
  closePendingBetween(a: number, b: number, tx: TransactionContext): Promise<void>;
}
