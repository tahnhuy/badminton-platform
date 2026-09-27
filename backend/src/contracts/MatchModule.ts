export type MatchType = 'SINGLES' | 'DOUBLES';

export type MatchStatus =
  | 'WAITING_FOR_COURT'
  | 'WAITING_FOR_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreateMatchInput {
  matchType: MatchType;
  scheduledAt: Date;
  courtId?: number | null;
  bookingId?: number | null;
}

export interface MatchGameInput {
  gameNo: number;
  team1Score: number;
  team2Score: number;
}

export interface MatchOutcome {
  matchId: number;
  status: MatchStatus;
  winningTeamNo: 1 | 2 | null;
}

export interface MatchModule {
  createMatch(input: CreateMatchInput): Promise<{ matchId: number }>;
  recordGames(input: { matchId: number; games: MatchGameInput[] }): Promise<void>;
  getOutcome(matchId: number): Promise<MatchOutcome>;
}
