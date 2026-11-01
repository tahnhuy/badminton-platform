import { matchmakingExpiryService, type MatchmakingSweepResult } from '../services/matchmaking/MatchmakingExpiryService';
import { logger } from '../shared/logging/logger';

export const MATCHMAKING_TICK_MS = 60 * 1000;
const CATCH_UP_DELAY_MS = 5 * 1000;

let timer: NodeJS.Timeout | null = null;
let catchUpTimer: NodeJS.Timeout | null = null;

async function runSafely(): Promise<MatchmakingSweepResult | null> {
  try {
    const result = await matchmakingExpiryService.runOnce();
    if (
      result.requestsExpired ||
      result.invitationsExpired ||
      result.recruitmentsProcessed ||
      result.matchesCancelled ||
      result.matchesStarted ||
      result.matchesCompleted
    ) {
      logger.info('Matchmaking sweep applied transitions', { ...result });
    }
    return result;
  } catch (error) {
    logger.error('Matchmaking sweep failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function startMatchmakingScheduler(): void {
  if (timer) return;

  catchUpTimer = setTimeout(() => {
    void runSafely();
  }, CATCH_UP_DELAY_MS);
  catchUpTimer.unref?.();

  timer = setInterval(() => {
    void runSafely();
  }, MATCHMAKING_TICK_MS);
  timer.unref?.();

  logger.info('Matchmaking scheduler started', { tickMs: MATCHMAKING_TICK_MS });
}

export function stopMatchmakingScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (catchUpTimer) {
    clearTimeout(catchUpTimer);
    catchUpTimer = null;
  }
}

export const matchmakingScheduler = { runSafely };
