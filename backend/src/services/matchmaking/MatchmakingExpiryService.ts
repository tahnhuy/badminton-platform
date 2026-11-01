import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { recruitmentLifecycleService } from './RecruitmentLifecycleService';
import { logger } from '../../shared/logging/logger';

export const MATCHMAKING_BATCH_SIZE = 200;

export interface MatchmakingSweepResult {
  requestsExpired: number;
  invitationsExpired: number;
  /** MM-27: due recruitments processed at start (formed/started, expired or cancelled). */
  recruitmentsProcessed: number;
  matchesCancelled: number;
  matchesStarted: number;
  matchesCompleted: number;
}

/**
 * Matchmaking scheduler tick (Tech Design §24.8, MM-27), in order:
 * 1. reconcile cancelled bookings (legacy matches.booking_id) before any time advancement;
 * 2. expire pending Apply/Invite rows, then legacy Singles/Doubles request expiry;
 * 3. start-time processing per due recruitment, one transaction each (§24.4 start rows,
 *    §24.7 order, SKIP LOCKED claim);
 * 4. legacy deadline/booking statements for Matches with matches.booking_id;
 * 5. completion: IN_PROGRESS → COMPLETED at start_at + duration_minutes.
 * Every step re-checks state under its own locks, so repeated runs, restarts and catch-up
 * after downtime are idempotent.
 */
export class MatchmakingExpiryService {
  async expireInvitations(batchSize: number = MATCHMAKING_BATCH_SIZE): Promise<number> {
    const ids = await matchmakingRepository.claimExpiredInvitations(batchSize);
    return ids.length;
  }

  async expireRequests(batchSize: number = MATCHMAKING_BATCH_SIZE): Promise<number> {
    const ids = await matchmakingRepository.claimExpiredRequests(batchSize);
    for (const id of ids) {
      await matchmakingRepository.closePendingInvitationsForRequest(id, 'EXPIRED');
    }
    return ids.length;
  }

  /** Start-time processing; one failing recruitment never stops the others. */
  async processDueRecruitments(batchSize: number = MATCHMAKING_BATCH_SIZE): Promise<{ processed: number; started: number }> {
    const ids = await matchmakingRepository.claimDueRecruitments(batchSize);
    let processed = 0;
    let started = 0;
    for (const id of ids) {
      try {
        const outcome = await recruitmentLifecycleService.processStart(id);
        if (outcome !== 'NOOP') processed += 1;
        if (outcome === 'START' || outcome === 'START_MATCHED') started += 1;
      } catch (error) {
        logger.error('Matchmaking start processing failed', {
          requestId: id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { processed, started };
  }

  async runOnce(batchSize: number = MATCHMAKING_BATCH_SIZE): Promise<MatchmakingSweepResult> {
    const reconciled = (await matchmakingRepository.reconcileCancelledBookings(batchSize)).length;
    const invitationsExpired = await this.expireInvitations(batchSize);
    const requestsExpired = await this.expireRequests(batchSize);
    const due = await this.processDueRecruitments(batchSize);
    const overdueCourt = (await matchmakingRepository.cancelOverduePendingCourtMatches(batchSize)).length;
    const matchesStarted = (await matchmakingRepository.advanceConfirmedToInProgress(batchSize)).length + due.started;
    const matchesCompleted = (await matchmakingRepository.advanceInProgressToCompleted(batchSize)).length
      + (await matchmakingRepository.completeRecruitmentMatches(batchSize)).length;
    return {
      requestsExpired,
      invitationsExpired,
      recruitmentsProcessed: due.processed,
      matchesCancelled: reconciled + overdueCourt,
      matchesStarted,
      matchesCompleted,
    };
  }
}

export const matchmakingExpiryService = new MatchmakingExpiryService();
