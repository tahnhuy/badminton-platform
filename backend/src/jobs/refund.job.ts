import { refundService } from '../services/payments/RefundService';
import { logger } from '../shared/logging/logger';

const INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    const processed = await refundService.processPending(20);
    if (processed > 0) logger.info('Processed wallet refunds', { processed });
  } catch (error) {
    logger.error('Refund worker tick failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startRefundWorker(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
}
