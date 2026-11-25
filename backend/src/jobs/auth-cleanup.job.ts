import { sql } from 'drizzle-orm';
import { db } from '../db';
import { challengeRepository } from '../repositories/auth/ChallengeRepository';
import { logger } from '../shared/logging/logger';

const TICK_MS = 60 * 60 * 1000;
const OUTBOX_RETENTION_DAYS = 30;

let timer: NodeJS.Timeout | null = null;

async function runSafely(): Promise<void> {
  try {
    await challengeRepository.deleteExpired();
    await db.execute(sql`
      DELETE FROM email_outbox
      WHERE status IN ('SENT', 'FAILED')
        AND created_at < now() - (${OUTBOX_RETENTION_DAYS} || ' days')::interval;
    `);
  } catch (error) {
    logger.error('Auth cleanup job failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startAuthCleanupWorker(): void {
  if (timer) return;
  setTimeout(() => void runSafely(), 10_000).unref?.();
  timer = setInterval(() => void runSafely(), TICK_MS);
  timer.unref?.();
  logger.info('Auth cleanup worker started', { tickMs: TICK_MS });
}

export function stopAuthCleanupWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
