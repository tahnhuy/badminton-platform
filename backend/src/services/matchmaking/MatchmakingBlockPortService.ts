import { PgTransaction } from 'drizzle-orm/pg-core';
import type { MatchmakingBlockPort } from '../../contracts/MatchmakingBlockPort';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';

// MM-22 provider of contracts/MatchmakingBlockPort (Tech Design §24.2, lock order
// "Block": users(10, both ascending, held by the caller) → requests(30) → invitations(40)).
export class MatchmakingBlockPortService implements MatchmakingBlockPort {
  async closePendingBetween(a: number, b: number, tx: TransactionContext): Promise<void> {
    if (!(tx instanceof PgTransaction)) {
      throw new Error('closePendingBetween requires the caller block transaction');
    }
    if (a === b) return;
    // New pending rows between the pair cannot appear concurrently: Invite/Apply send locks
    // both Players' USERS rows first, and the caller already holds them.
    const { requestIds } = await matchmakingRepository.findPendingBetween(a, b, tx);
    if (requestIds.length === 0) return;
    await matchmakingRepository.lockRequestsAscending(requestIds, tx);
    const { rowIds } = await matchmakingRepository.findPendingBetween(a, b, tx);
    await matchmakingRepository.lockMembershipRowsAscending(rowIds, tx);
    await matchmakingRepository.closePendingRows(rowIds, 'BLOCKED', tx);
  }
}

export const matchmakingBlockPort: MatchmakingBlockPort = new MatchmakingBlockPortService();
