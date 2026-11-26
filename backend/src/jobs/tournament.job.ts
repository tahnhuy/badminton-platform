import { tournamentJobService } from '../services/tournaments/TournamentJobService';
import { logger } from '../shared/logging/logger';

// Tournament Tech Design §10 (TRN-10): every minute, guarded by an advisory lock.
export const TOURNAMENT_TICK_MS = 60 * 1000;
const CATCH_UP_DELAY_MS = 10 * 1000;

let timer: NodeJS.Timeout | null = null;
let catchUpTimer: NodeJS.Timeout | null = null;
let running = false;

async function runSafely(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await tournamentJobService.runOnce();
    if (result.closed || result.invitationsExpired || result.completed || result.cancelled || result.reminders) {
      logger.info('Tournament job applied transitions', { ...result });
    }
  } catch (error) {
    logger.error('Tournament job failed', { message: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }
}

export function startTournamentWorker(): void {
  if (timer) return;
  catchUpTimer = setTimeout(() => void runSafely(), CATCH_UP_DELAY_MS);
  catchUpTimer.unref?.();
  timer = setInterval(() => void runSafely(), TOURNAMENT_TICK_MS);
  timer.unref?.();
  logger.info('Tournament worker started', { tickMs: TOURNAMENT_TICK_MS });
}

export function stopTournamentWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (catchUpTimer) { clearTimeout(catchUpTimer); catchUpTimer = null; }
}
