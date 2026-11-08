import type { TransactionContext } from './TransactionContext';

export interface BookingPaymentGuard {
  /** Locks bookings in ascending order (rank 80), then checks all payment attempts. */
  hasSuccessfulPayment(bookingIds: number[], tx: TransactionContext): Promise<boolean>;
}
