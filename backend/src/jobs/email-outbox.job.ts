import { logger } from '../shared/logging/logger';
import { systemConfig } from '../shared/config/system-config';
import { emailOutboxService } from '../services/email/EmailOutboxService';

const DEFAULT_TICK_MS = 15_000;

let timer: NodeJS.Timeout | null = null;
let stopped = false;

async function runSafely(): Promise<void> {
  try {
    const result = await emailOutboxService.processPending();
    if (result.sent || result.failed) {
      logger.info('Email outbox processed', result);
    }
  } catch (error) {
    logger.error('Email outbox worker failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function resolveTickMs(): Promise<number> {
  try {
    return (await systemConfig.getEmailOutboxConfig()).tickMs;
  } catch {
    return DEFAULT_TICK_MS;
  }
}

async function scheduleNext(delayMs?: number): Promise<void> {
  if (stopped) return;
  const tickMs = delayMs ?? (await resolveTickMs());
  timer = setTimeout(() => {
    void runSafely().finally(() => void scheduleNext());
  }, tickMs);
  timer.unref?.();
}

/** Starts a self-rescheduling worker so Admin changes to EMAIL_OUTBOX_TICK_MS apply after the current cycle. */
export function startEmailOutboxWorker(): void {
  if (timer || stopped) return;
  stopped = false;
  timer = setTimeout(() => {
    void runSafely().finally(() => void scheduleNext());
  }, 5_000);
  timer.unref?.();
  logger.info('Email outbox worker started');
}

export function stopEmailOutboxWorker(): void {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
}
