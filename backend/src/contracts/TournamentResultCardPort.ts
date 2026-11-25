import type { TransactionContext } from './TransactionContext';

/**
 * Projection of a `TOURNAMENT_RESULT` post card, derived from the tournament — never from
 * user text (Tournament Tech Design §7.7). Provided by the Tournament module.
 */
export interface TournamentResultCard {
  tournament: { id: number; name: string; matchType: string; completedAt: string | null; tournamentEnd: string };
  champion: string | null;
  runnerUp: string | null;
  /** The author's placement, or `ORGANIZER`. */
  authorPlacement: string | null;
}

export interface TournamentResultCardPort {
  getCards(posts: ReadonlyArray<{ id: number; authorId: number; tournamentId: number }>, reader?: TransactionContext): Promise<Map<number, TournamentResultCard>>;
}

let provider: TournamentResultCardPort | null = null;
export const registerTournamentResultCardPort = (port: TournamentResultCardPort | null) => { provider = port; };
export const tournamentResultCards = (): TournamentResultCardPort | null => provider;
