import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { bookingService } from '../booking/booking.service';
import { matchmakingNotifications } from './matchmaking-notifications';
import { logger } from '../../shared/logging/logger';

const POLICY_REFUSALS = new Set([
  'OWNER_CANCELLATION_DISABLED',
  'OWNER_CANCELLATION_DEADLINE_PASSED',
  'OWNER_BOOKING_NOT_CANCELLABLE',
  'OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE',
  'BOOKING_NOT_CANCELLABLE',
  'BOOKING_CANCELLATION_DEADLINE_PASSED',
]);

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = 2;

type ClaimedJob = { id: number; matchId: number | null; bookingId: number; attempts: number };

/**
 * MM-20: durable booking/Match cancellation reconciliation. The forward path is
 * synchronous (booking cancellation cancels its Match in the same transaction);
 * this worker handles the opposite direction (Match cancelled → apply Booking
 * policy + refund) and recovers an interrupted forward path. Policy refusals are
 * terminal outcomes, not infinite retries.
 */
export class MatchBookingCancellationService {
  async processPending(limit = 50): Promise<number> {
    const jobs = await matchmakingRepository.claimCancellationJobs(limit);
    let done = 0;
    for (const job of jobs) {
      try {
        await this.processJob(job);
        await matchmakingRepository.markCancellationJobDone(job.id);
        done += 1;
      } catch (error) {
        const code = error instanceof AppError ? error.code : 'TRANSIENT_ERROR';
        if (code !== 'TRANSIENT_ERROR' && POLICY_REFUSALS.has(code)) {
          await matchmakingRepository.markCancellationJobFailed(job.id, code);
          logger.info('Booking cancellation job refused by policy', { jobId: job.id, bookingId: job.bookingId, code });
        } else if (job.attempts >= MAX_ATTEMPTS) {
          await matchmakingRepository.markCancellationJobFailed(job.id, 'RETRY_EXHAUSTED');
        } else {
          const next = new Date(Date.now() + job.attempts * BACKOFF_MINUTES * 60_000);
          await matchmakingRepository.rescheduleCancellationJob(job.id, code, next);
        }
      }
    }
    return done;
  }

  /** Resolves when reconciled; failures are classified by processPending. */
  private async processJob(job: ClaimedJob): Promise<void> {
    const bookingResult = await bookingRepository.findBookingById(job.bookingId);
    const booking = bookingResult?.booking;
    const match = job.matchId ? await matchModule.getMatchRow(job.matchId) : null;

    if (!booking) return;

    if (booking.status === 'CANCELLED') {
      if (!match || match.status === 'CANCELLED' || match.status === 'COMPLETED') return;
      await this.cancelMatchForCancelledBooking(match.id);
      return;
    }

    if (match?.status === 'CANCELLED') {
      await bookingService.cancelBookingForMatch(job.bookingId, 'Match cancelled');
      return;
    }

    // Neither side is cancelled: the originating transition was rolled back.
  }

  private async cancelMatchForCancelledBooking(matchId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Same lock order as Matchmaking writers: users → request → Match.
      const link = await matchmakingRepository.findMatchLinkByMatchId(matchId, tx);
      let request: { playerId: number } | null = null;
      let recipients: number[] = [];
      if (link) {
        const snapshot = await matchmakingRepository.findRequestById(link.requestId, tx);
        const membersBefore = await matchmakingRepository.findAcceptedInvitees(link.requestId, tx);
        const userIds = [...new Set([
          ...(snapshot?.playerId ? [snapshot.playerId] : []),
          ...membersBefore.map((member: { playerId: number }) => member.playerId),
        ])].sort((a, b) => a - b);
        await matchmakingRepository.lockUsersAscending(userIds, tx);
        request = await matchmakingRepository.lockRequestById(link.requestId, tx);
        const members = await matchmakingRepository.findAcceptedInvitees(link.requestId, tx);
        recipients = [...new Set([request?.playerId, ...members.map((member: { playerId: number }) => member.playerId)])]
          .filter((id): id is number => typeof id === 'number');
      }

      const match = await matchModule.lockMatch(matchId, tx);
      if (!match || match.status === 'CANCELLED' || match.status === 'COMPLETED') return;
      await matchModule.transitionStatus({
        matchId,
        from: match.status as any,
        to: 'CANCELLED',
        cancellationReason: 'BOOKING_CANCELLED',
      }, tx);
      if (!link || !request) return;
      await matchmakingRepository.cancelRecruitment(link.requestId, 'BOOKING_CANCELLED', tx);
      await matchmakingNotifications.bookingCancelled(tx, link.requestId, recipients);
    });
  }
}

export const matchBookingCancellationService = new MatchBookingCancellationService();
