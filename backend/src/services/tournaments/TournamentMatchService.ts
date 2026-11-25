import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { matchGames, matches, matchPlayers } from '../../db/schema/matchmaking';
import { tournamentMatches, tournaments } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import { tournamentBracketService } from './TournamentBracketService';
import { validateRetirement, validateSets, type SetScore } from './result/score';
import { tournamentRankingService } from './TournamentRankingService';
import { skillRatingService } from './SkillRatingService';
import { skillRatingConfig, type SkillRatingConfig } from '../../shared/config/skill-rating-config';
import type { TournamentViewer } from './TournamentService';

/**
 * Match operations (Tournament Tech Design §2.4, §3.4, §7.5 — TRN-06): start, results by
 * sets, retirement, walkover, cancellation, corrections and winner advancement.
 */

export type ResultInput =
  | { type: 'SETS'; sets: SetScore[] }
  | { type: 'RETIRED'; retiredSlot: 1 | 2; sets: SetScore[] }
  | { type: 'WALKOVER'; winnerSlot: 1 | 2; reason?: string }
  | { type: 'CANCEL'; reason: string };

type TournamentMatchRow = typeof tournamentMatches.$inferSelect;
type MatchRow = typeof matches.$inferSelect;

const CORRECTION_WINDOW_MS = 48 * 3_600_000;
const RESOLVED_WITH_WINNER: readonly string[] = ['WINNER_DECLARED', 'RETIRED', 'WALKOVER'];
const RETRY_COMPLETED_CORRECTION = Symbol('retry completed correction before taking row locks');

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  matchNotFound: () => new NotFoundError('Match not found', 'TOURNAMENT_MATCH_NOT_FOUND'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the Organizer can run matches'),
  invalidState: (status: string) => new AppError('TOURNAMENT_INVALID_STATE', 409, `Action not allowed while the tournament is ${status}`),
  notPlayable: () => new AppError('TOURNAMENT_MATCH_NOT_PLAYABLE', 409, 'Both participants of the match are not known yet'),
  locked: (message: string) => new AppError('TOURNAMENT_MATCH_LOCKED', 409, message),
  windowClosed: () => new AppError('TOURNAMENT_CORRECTION_WINDOW_CLOSED', 409, 'Results can be corrected only within 48 hours after completion'),
  invalidResult: (details: unknown[]) => new AppError('TOURNAMENT_RESULT_INVALID', 400, 'Invalid match result', details),
};

export class TournamentMatchService {
  private async lock(actor: TournamentViewer, id: number, tournamentMatchId: number, tx: TransactionContext) {
    const t = await tournamentRepository.findById(id, tx, { lock: true });
    if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
    if (t.creatorId !== actor.id) throw err.forbidden();
    const [tm] = await tx.select().from(tournamentMatches)
      .where(and(eq(tournamentMatches.id, tournamentMatchId), eq(tournamentMatches.tournamentId, t.id))).limit(1).for('update');
    if (!tm) throw err.matchNotFound();
    const [match] = await tx.select().from(matches).where(eq(matches.id, tm.matchId)).limit(1).for('update');
    return { t, tm, match };
  }

  private playable(tm: TournamentMatchRow): boolean {
    return tm.registration1Id !== null && tm.registration2Id !== null;
  }

  /** First started or resolved match moves a READY tournament to IN_PROGRESS (matrix §5.3). */
  private async markInProgress(t: TournamentRow, tx: TransactionContext): Promise<void> {
    if (t.status === 'READY') await tournamentRepository.update(t.id, { status: 'IN_PROGRESS' }, tx);
  }

  async start(actor: TournamentViewer, id: number, tournamentMatchId: number): Promise<void> {
    await db.transaction(async tx => {
      const { t, tm, match } = await this.lock(actor, id, tournamentMatchId, tx);
      if (t.status !== 'READY' && t.status !== 'IN_PROGRESS') throw err.invalidState(t.status);
      if (!this.playable(tm)) throw err.notPlayable();
      if (match.status !== 'CONFIRMED' || tm.resolution !== 'UNRESOLVED') throw err.locked('The match has already started or finished');
      await tx.update(matches).set({ status: 'IN_PROGRESS', startedAt: new Date(), updatedAt: new Date() }).where(eq(matches.id, match.id));
      await this.markInProgress(t, tx);
    });
  }

  async result(actor: TournamentViewer, id: number, tournamentMatchId: number, input: ResultInput): Promise<void> {
    // A correction of a COMPLETED tournament replays ratings: take the replay lock before the
    // row locks and load the config outside the transaction (review, TRN-14).
    const [peek] = await db.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
    const correctingCompleted = peek?.status === 'COMPLETED';
    const cfg = correctingCompleted ? await skillRatingConfig.get() : undefined;
    try {
      await this.recordResult(actor, id, tournamentMatchId, input, correctingCompleted, cfg);
    } catch (error) {
      if (error !== RETRY_COMPLETED_CORRECTION) throw error;
      // The first transaction rolled back and released its row locks. COMPLETED is terminal,
      // so one retry with the replay lock first covers completion between peek and lock.
      await this.recordResult(actor, id, tournamentMatchId, input, true, await skillRatingConfig.get());
    }
  }

  private async recordResult(
    actor: TournamentViewer, id: number, tournamentMatchId: number, input: ResultInput,
    correctingCompleted: boolean, cfg?: SkillRatingConfig,
  ): Promise<void> {
    await db.transaction(async tx => {
      if (correctingCompleted) await skillRatingService.acquireReplayLock(tx);
      const { t, tm, match } = await this.lock(actor, id, tournamentMatchId, tx);
      if (t.status === 'COMPLETED' && !correctingCompleted) throw RETRY_COMPLETED_CORRECTION;
      const correcting = tm.resolution !== 'UNRESOLVED';
      await this.assertCanRecord(t, tm, match, input, correcting, tx);

      const now = new Date();
      let winnerRegistrationId: number | null = null;
      let resolution: string;
      let sets: SetScore[] = [];
      if (input.type === 'SETS' || input.type === 'RETIRED') {
        const checked = input.type === 'SETS' ? validateSets(input.sets) : validateRetirement(input.sets, input.retiredSlot);
        if (!checked.ok) throw err.invalidResult(checked.errors);
        winnerRegistrationId = checked.winnerSlot === 1 ? tm.registration1Id : tm.registration2Id;
        resolution = input.type === 'SETS' ? 'WINNER_DECLARED' : 'RETIRED';
        sets = input.sets;
      } else if (input.type === 'WALKOVER') {
        winnerRegistrationId = input.winnerSlot === 1 ? tm.registration1Id : tm.registration2Id;
        resolution = 'WALKOVER';
      } else {
        resolution = 'NONE';
      }

      // After completion only the scores may change, or the final's winner (Tech Design §7.5).
      // The result type stays too: it decides whether the match counts for skill rating (review, TRN-06).
      if (t.status === 'COMPLETED' && tm.nextMatchId !== null
        && (winnerRegistrationId !== tm.winnerRegistrationId || resolution !== tm.resolution)) {
        throw err.locked('After completion only the scores of a non-final match can change');
      }

      await tx.delete(matchGames).where(eq(matchGames.matchId, match.id));
      if (sets.length > 0) {
        await tx.insert(matchGames).values(sets.map((set, index) => ({
          matchId: match.id, gameNo: index + 1, team1Score: set.team1Score, team2Score: set.team2Score,
        })));
      }
      await tx.update(matches).set({
        status: resolution === 'NONE' ? 'CANCELLED' : 'COMPLETED',
        startedAt: match.startedAt ?? (resolution === 'WINNER_DECLARED' || resolution === 'RETIRED' ? now : null),
        // Keep the real completion time on corrections (review, TRN-06).
        completedAt: resolution === 'NONE' ? null : (match.completedAt ?? now),
        cancellationReason: input.type === 'CANCEL' ? input.reason.slice(0, 255) : input.type === 'WALKOVER' ? input.reason?.slice(0, 255) ?? null : null,
        updatedAt: now,
      }).where(eq(matches.id, match.id));
      await tx.update(tournamentMatches).set({ resolution, winnerRegistrationId, updatedAt: now }).where(eq(tournamentMatches.id, tm.id));

      if (tm.nextMatchId !== null && winnerRegistrationId !== tm.winnerRegistrationId) {
        await this.advance(t, tm, winnerRegistrationId, tx);
      }
      // A cancellation is not play: it does not start the tournament (review, TRN-06).
      if (t.status !== 'COMPLETED' && resolution !== 'NONE') await this.markInProgress(t, tx);
      // A correction within 48 h of completion rewrites ranking points and replays skill
      // ratings (Tech Design §7.5, §7.10, §7.11); placements are computed on read.
      if (t.status === 'COMPLETED') {
        await tournamentRankingService.writeForTournament(t, tx, 'correction');
        await skillRatingService.replayInTransaction(tx, { reason: 'RECALCULATION', tournamentId: t.id }, cfg);
      }
    });
  }

  private async assertCanRecord(
    t: TournamentRow, tm: TournamentMatchRow, match: MatchRow, input: ResultInput, correcting: boolean, tx: TransactionContext,
  ): Promise<void> {
    if (t.status === 'COMPLETED') {
      if (!correcting || input.type === 'CANCEL') throw err.invalidState(t.status);
      if (!t.completedAt || Date.now() - t.completedAt.getTime() > CORRECTION_WINDOW_MS) throw err.windowClosed();
    } else if (t.status !== 'READY' && t.status !== 'IN_PROGRESS') {
      throw err.invalidState(t.status);
    }
    if (!this.playable(tm)) throw err.notPlayable();
    if (!correcting && (input.type === 'SETS' || input.type === 'RETIRED') && match.status !== 'IN_PROGRESS') {
      throw err.locked('Start the match before recording its score');
    }
    if (correcting && tm.nextMatchId !== null && t.status !== 'COMPLETED') {
      const [next] = await tx.select({ status: matches.status, resolution: tournamentMatches.resolution })
        .from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
        .where(eq(tournamentMatches.id, tm.nextMatchId)).limit(1);
      if (next.status !== 'CONFIRMED' || next.resolution !== 'UNRESOLVED') {
        throw err.locked('The next match has already started; this result can no longer change');
      }
    }
  }

  /**
   * Writes the (new) winner into the next match slot and refreshes its roster: written when
   * both slots are known, removed while one is empty (Tech Design §2.4, §7.5).
   */
  private async advance(t: TournamentRow, tm: TournamentMatchRow, winnerRegistrationId: number | null, tx: TransactionContext): Promise<void> {
    const slot = tm.nextRegistrationSlot === 'registration1' ? 'registration1Id' : 'registration2Id';
    const [next] = await tx.update(tournamentMatches).set({ [slot]: winnerRegistrationId, updatedAt: new Date() })
      .where(eq(tournamentMatches.id, tm.nextMatchId!)).returning();
    await tx.delete(matchPlayers).where(eq(matchPlayers.matchId, next.matchId));
    if (next.registration1Id !== null && next.registration2Id !== null) {
      const participants = await tournamentBracketService.participants(t.id, tx, [next.registration1Id, next.registration2Id]);
      await tournamentBracketService.writeRoster(next.matchId, next.registration1Id, next.registration2Id, participants, tx, t.matchType);
    }
  }

  /** True when the final has a winner (used by completion and the auto-complete job). */
  static finalHasWinner(final: TournamentMatchRow | null): boolean {
    return Boolean(final && final.winnerRegistrationId !== null && RESOLVED_WITH_WINNER.includes(final.resolution));
  }
}

export const tournamentMatchService = new TournamentMatchService();
