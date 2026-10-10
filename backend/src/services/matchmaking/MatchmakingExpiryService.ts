import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';

export const MATCHMAKING_BATCH_SIZE = 200;

export interface MatchmakingSweepResult {
  requestsExpired: number;
  invitationsExpired: number;
  matchesCancelled: number;
  matchesStarted: number;
  matchesCompleted: number;
}

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

  async runOnce(batchSize: number = MATCHMAKING_BATCH_SIZE): Promise<MatchmakingSweepResult> {
    const requestsExpired = await this.expireRequests(batchSize);
    const invitationsExpired = await this.expireInvitations(batchSize);
    const matchesCancelled = (await matchmakingRepository.reconcileCancelledBookings(batchSize)).length
      + (await matchmakingRepository.cancelOverduePendingCourtMatches(batchSize)).length;
    const matchesStarted = (await matchmakingRepository.advanceConfirmedToInProgress(batchSize)).length;
    const matchesCompleted = (await matchmakingRepository.advanceInProgressToCompleted(batchSize)).length;
    return { requestsExpired, invitationsExpired, matchesCancelled, matchesStarted, matchesCompleted };
  }
}

export const matchmakingExpiryService = new MatchmakingExpiryService();
