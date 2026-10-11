import { db, matches, matchPlayers, matchGames } from '../../db';
import { and, asc, eq } from 'drizzle-orm';
import {
  type CreateMatchInput,
  type CreateMatchWithPlayersInput,
  type LinkBookingInput,
  type MatchGameInput,
  type MatchModule,
  type MatchOutcome,
  type MatchRowSummary,
  type MatchStatus,
  type TransitionStatusInput,
} from '../../contracts/MatchModule';

type Executor = any;

export class MatchCoreService implements MatchModule {
  async createMatchWithPlayers(
    input: CreateMatchWithPlayersInput,
    executor?: Executor
  ): Promise<{ matchId: number }> {
    if (!executor || executor === db) return db.transaction((tx) => this.createMatchWithPlayers(input, tx));
    const [row] = await executor
      .insert(matches)
      .values({
        matchType: input.matchType,
        scheduledAt: input.scheduledAt,
        courtId: input.courtId ?? null,
        bookingId: input.bookingId ?? null,
        bookingDeadlineAt: input.bookingDeadlineAt ?? null,
        status: input.status ?? 'PENDING_COURT',
      })
      .returning({ id: matches.id });

    if (input.players.length > 0) {
      const joinedAt = new Date();
      await executor.insert(matchPlayers).values(
        input.players.map((player) => ({
          matchId: row.id,
          playerId: player.playerId,
          teamNo: player.teamNo,
          status: 'ACTIVE',
          joinedAt,
        }))
      );
    }

    return { matchId: row.id };
  }

  async createMatch(input: CreateMatchInput, executor: Executor = db): Promise<{ matchId: number }> {
    return this.createMatchWithPlayers(
      {
        matchType: input.matchType,
        scheduledAt: input.scheduledAt,
        courtId: input.courtId ?? null,
        bookingId: input.bookingId ?? null,
        players: [],
      },
      executor
    );
  }

  async linkBooking(input: LinkBookingInput, executor: Executor = db): Promise<boolean> {
    const rows = await executor
      .update(matches)
      .set({
        bookingId: input.bookingId,
        courtId: input.courtId,
        scheduledAt: input.scheduledAt,
        status: 'CONFIRMED',
        updatedAt: new Date(),
      })
      .where(and(eq(matches.id, input.matchId), eq(matches.status, 'PENDING_COURT')))
      .returning({ id: matches.id });
    return rows.length > 0;
  }

  async transitionStatus(input: TransitionStatusInput, executor: Executor = db): Promise<boolean> {
    const set: Record<string, unknown> = {
      status: input.to,
      updatedAt: new Date(),
    };
    if (input.startedAt !== undefined) set.startedAt = input.startedAt;
    if (input.completedAt !== undefined) set.completedAt = input.completedAt;
    if (input.cancellationReason !== undefined) set.cancellationReason = input.cancellationReason;

    const rows = await executor
      .update(matches)
      .set(set)
      .where(and(eq(matches.id, input.matchId), eq(matches.status, input.from)))
      .returning({ id: matches.id });
    return rows.length > 0;
  }

  async markPlayerLeft(input: { matchId: number; playerId: number }, executor: Executor = db): Promise<boolean> {
    const rows = await executor
      .update(matchPlayers)
      .set({ status: 'LEFT', updatedAt: new Date() })
      .where(
        and(
          eq(matchPlayers.matchId, input.matchId),
          eq(matchPlayers.playerId, input.playerId),
          eq(matchPlayers.status, 'ACTIVE')
        )
      )
      .returning({ id: matchPlayers.id });
    return rows.length > 0;
  }

  async getMatchRow(matchId: number, executor: Executor = db): Promise<MatchRowSummary | null> {
    const rows = await executor
      .select({
        id: matches.id,
        matchType: matches.matchType,
        status: matches.status,
        courtId: matches.courtId,
        bookingId: matches.bookingId,
        scheduledAt: matches.scheduledAt,
        bookingDeadlineAt: matches.bookingDeadlineAt,
        startedAt: matches.startedAt,
        completedAt: matches.completedAt,
        cancellationReason: matches.cancellationReason,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    return rows[0] ?? null;
  }

  async lockMatch(matchId: number, executor: Executor = db): Promise<MatchRowSummary | null> {
    const rows = await executor
      .select({
        id: matches.id,
        matchType: matches.matchType,
        status: matches.status,
        courtId: matches.courtId,
        bookingId: matches.bookingId,
        scheduledAt: matches.scheduledAt,
        bookingDeadlineAt: matches.bookingDeadlineAt,
        startedAt: matches.startedAt,
        completedAt: matches.completedAt,
        cancellationReason: matches.cancellationReason,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .for('update');
    return rows[0] ?? null;
  }

  async getPlayerIdsForMatch(matchId: number, executor: Executor = db): Promise<number[]> {
    const rows = await executor
      .select({ playerId: matchPlayers.playerId })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId));
    return rows.map((row: { playerId: number }) => row.playerId);
  }

  async findActiveMatchPlayer(
    matchId: number,
    playerId: number,
    executor: Executor = db
  ): Promise<{ id: number; teamNo: number; status: string } | null> {
    const rows = await executor
      .select({ id: matchPlayers.id, teamNo: matchPlayers.teamNo, status: matchPlayers.status })
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, playerId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async recordGames(input: { matchId: number; games: MatchGameInput[] }): Promise<void> {
    if (input.games.length === 0) return;
    await db.insert(matchGames).values(
      input.games.map((game) => ({
        matchId: input.matchId,
        gameNo: game.gameNo,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
      }))
    );
  }

  async getOutcome(matchId: number): Promise<MatchOutcome> {
    const [matchRow] = await db
      .select({ status: matches.status })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    const games = await db
      .select({ team1Score: matchGames.team1Score, team2Score: matchGames.team2Score })
      .from(matchGames)
      .where(eq(matchGames.matchId, matchId))
      .orderBy(asc(matchGames.gameNo));

    let team1Wins = 0;
    let team2Wins = 0;
    for (const game of games) {
      if (game.team1Score > game.team2Score) team1Wins += 1;
      else if (game.team2Score > game.team1Score) team2Wins += 1;
    }

    let winningTeamNo: 1 | 2 | null = null;
    if (team1Wins > team2Wins) winningTeamNo = 1;
    else if (team2Wins > team1Wins) winningTeamNo = 2;

    return {
      matchId,
      status: (matchRow?.status ?? 'CANCELLED') as MatchStatus,
      winningTeamNo,
    };
  }
}

export const matchModule = new MatchCoreService();
