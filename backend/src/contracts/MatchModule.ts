export type MatchType = 'SINGLES' | 'DOUBLES';

export type MatchStatus =
  | 'PENDING_COURT'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type MatchPlayerStatus = 'ACTIVE' | 'LEFT';

export interface MatchPlayerInput {
  playerId: number;
  teamNo: number;
}

export interface CreateMatchWithPlayersInput {
  matchType: MatchType;
  scheduledAt: Date;
  courtId?: number | null;
  bookingId?: number | null;
  bookingDeadlineAt?: Date | null;
  status?: MatchStatus;
  players: MatchPlayerInput[];
}

export interface LinkBookingInput {
  matchId: number;
  bookingId: number;
  courtId: number;
  scheduledAt: Date;
}

export interface TransitionStatusInput {
  matchId: number;
  from: MatchStatus;
  to: MatchStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancellationReason?: string | null;
}

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

export interface MatchRowSummary {
  id: number;
  matchType: string;
  status: string;
  courtId: number | null;
  bookingId: number | null;
  scheduledAt: Date;
  bookingDeadlineAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancellationReason: string | null;
}

export interface MatchModule {
  createMatchWithPlayers(
    input: CreateMatchWithPlayersInput,
    executor?: unknown
  ): Promise<{ matchId: number }>;
  linkBooking(input: LinkBookingInput, executor?: unknown): Promise<boolean>;
  transitionStatus(input: TransitionStatusInput, executor?: unknown): Promise<boolean>;
  markPlayerLeft(
    input: { matchId: number; playerId: number },
    executor?: unknown
  ): Promise<boolean>;
  createMatch(input: CreateMatchInput, executor?: unknown): Promise<{ matchId: number }>;
  recordGames(input: { matchId: number; games: MatchGameInput[] }): Promise<void>;
  getOutcome(matchId: number): Promise<MatchOutcome>;
}
