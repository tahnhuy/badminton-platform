import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { tournaments } from '../../db/schema/tournaments';
import { messagingWsHub } from '../messaging/MessagingWsHub';
import { logger } from '../../shared/logging/logger';
import { tournamentRepository } from '../../repositories/tournaments/TournamentRepository';

/**
 * Realtime refresh of open tournament pages (PRD FR-63, Tech Design §7.9; TRN-15).
 * Called after the change committed; the payload only tells clients what to refetch.
 */

export type TournamentUpdateScope = 'STATUS' | 'BRACKET' | 'SCHEDULE' | 'MATCH';

export interface TournamentUpdatedEvent {
  tournamentId: number;
  scope: TournamentUpdateScope;
  tournamentMatchId?: number;
  version: number;
}

/** A Player may watch a visible tournament; a DRAFT only as its Organizer (Tech Design §8). */
export async function canWatchTournament(userId: number, tournamentId: number): Promise<boolean> {
  const t = await tournamentRepository.findById(tournamentId);
  return Boolean(t && (t.status !== 'DRAFT' || t.creatorId === userId));
}

messagingWsHub.setTournamentWatchAuthorizer(canWatchTournament);

export const tournamentRealtime = {
  /** Never throws: realtime is best effort, clients also refetch on reconnect and poll without a socket. */
  async publish(tournamentId: number, scope: TournamentUpdateScope, tournamentMatchId?: number): Promise<void> {
    try {
      const [row] = await db.select({ version: tournaments.version }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!row) return;
      messagingWsHub.publishTournament<TournamentUpdatedEvent>(tournamentId, {
        tournamentId, scope, version: row.version, ...(tournamentMatchId ? { tournamentMatchId } : {}),
      });
    } catch (error) {
      logger.warn('Tournament realtime publish failed', { tournamentId, message: error instanceof Error ? error.message : String(error) });
    }
  },
};
