import { and, inArray, isNotNull, or } from 'drizzle-orm';
import { payments } from '../../db';
import type { BookingPaymentGuard } from '../../contracts/BookingPaymentGuard';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { bookingRepository } from '../../repositories/booking/BookingRepository';

export const bookingPaymentGuard: BookingPaymentGuard = {
  async hasSuccessfulPayment(bookingIds: number[], tx: TransactionContext) {
    const ids = [...new Set(bookingIds)].sort((a, b) => a - b);
    if (!ids.length) return false;
    // Payment confirmation takes this same booking lock before writing PAYMENTS.
    for (const id of ids) await bookingRepository.lockBookingById(id, tx);
    const [paid] = await tx.select({ id: payments.id }).from(payments).where(and(
      inArray(payments.bookingId, ids),
      or(isNotNull(payments.paidAt), inArray(payments.status, ['SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'])),
    )).limit(1);
    return Boolean(paid);
  },
};
