import { bookingStateService, type BookingStateSweepResult } from '../services/booking/booking-state.service';
import { logger } from '../shared/logging/logger';

export const BOOKING_STATE_TICK_MS = 60 * 1000;
const CATCH_UP_DELAY_MS = 5 * 1000;

let timer: NodeJS.Timeout | null = null;
let catchUpTimer: NodeJS.Timeout | null = null;

async function runSafely(): Promise<BookingStateSweepResult | null> {
  try {
    const result = await bookingStateService.runOnce();
    if (result.expired || result.started || result.completed) {
      logger.info('Booking state sweep applied transitions', {
        expired: result.expired,
        started: result.started,
        completed: result.completed,
      });
    }
    return result;
  } catch (error) {
    logger.error('Booking state sweep failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function startBookingStateWorker(): void {
  if (timer) return;

  catchUpTimer = setTimeout(() => {
    void runSafely();
  }, CATCH_UP_DELAY_MS);
  catchUpTimer.unref?.();

  timer = setInterval(() => {
    void runSafely();
  }, BOOKING_STATE_TICK_MS);
  timer.unref?.();

  logger.info('Booking state worker started', { tickMs: BOOKING_STATE_TICK_MS });
}

export function stopBookingStateWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (catchUpTimer) {
    clearTimeout(catchUpTimer);
    catchUpTimer = null;
  }
}

export const bookingStateWorker = { runSafely };
