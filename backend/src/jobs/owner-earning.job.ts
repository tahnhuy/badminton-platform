import { ownerEarningService } from '../services/finance/OwnerEarningService';
import { logger } from '../shared/logging/logger';

export const OWNER_EARNING_TICK_MS = 5 * 60 * 1000;
const CATCH_UP_DELAY_MS = 15 * 1000;

let timer: NodeJS.Timeout | null = null;
let catchUpTimer: NodeJS.Timeout | null = null;

async function runSafely(): Promise<void> {
  try {
    const result = await ownerEarningService.sweep({ limit: 200 });
    if (result.credited || result.pending || result.failed) {
      logger.info('Owner earning sweep applied', {
        scanned: result.scanned,
        credited: result.credited,
        pending: result.pending,
        skipped: result.skipped,
        failed: result.failed,
      });
    }
  } catch (error) {
    logger.error('Owner earning sweep failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startOwnerEarningWorker(): void {
  if (timer) return;
  catchUpTimer = setTimeout(() => void runSafely(), CATCH_UP_DELAY_MS);
  catchUpTimer.unref?.();
  timer = setInterval(() => void runSafely(), OWNER_EARNING_TICK_MS);
  timer.unref?.();
  logger.info('Owner earning worker started', { tickMs: OWNER_EARNING_TICK_MS });
}

export function stopOwnerEarningWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (catchUpTimer) { clearTimeout(catchUpTimer); catchUpTimer = null; }
}
