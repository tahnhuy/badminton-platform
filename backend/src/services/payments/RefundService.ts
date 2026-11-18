import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { paymentRepository } from '../../repositories/payment/PaymentRepository';
import { refundRepository } from '../../repositories/payment/RefundRepository';
import { walletService } from './WalletService';
import { refundConfig } from '../../shared/config/refund-config';
import { notificationService } from '../notifications/NotificationService';

function refundOutcomeEvent(type: 'BOOKING_REFUNDED' | 'BOOKING_REFUND_FAILED', bookingId: number, recipientId: number) {
  return {
    recipientId,
    type,
    title: type === 'BOOKING_REFUNDED' ? 'Hoàn tiền booking thành công' : 'Hoàn tiền booking thất bại',
    content: type === 'BOOKING_REFUNDED'
      ? 'Tiền đặt sân đã được hoàn vào ví của bạn.'
      : 'Hệ thống chưa thể hoàn tiền cho booking này. Chúng tôi sẽ tiếp tục xử lý.',
    resource: { type: 'BOOKING', id: bookingId },
    dedupKey: `booking:${bookingId}:${type}`,
  };
}

export class RefundService {
  async createBookingRefundIntent(bookingId: number, reason: string, tx: TransactionContext): Promise<void> {
    const payment = await paymentRepository.findByBookingId(bookingId, tx);
    if (!payment || payment.status !== 'SUCCESS') return;
    await refundRepository.createIntent(payment.id, reason, tx);
  }

  async processPending(limit = 20): Promise<number> {
    const config = await refundConfig.get();
    if (!config.enabled) return 0;
    let processed = 0;
    for (let index = 0; index < limit; index += 1) {
      const paymentId = await db.transaction(tx => refundRepository.claimNext(config.processingTimeoutMinutes, tx));
      if (paymentId === null) break;
      try {
        await this.refundPayment(paymentId);
        processed += 1;
      } catch (error) {
        await this.failRefund(paymentId, error instanceof Error ? error.message : String(error));
      }
    }
    return processed;
  }

  async refundPayment(paymentId: number): Promise<void> {
    await db.transaction(async tx => {
      const refund = await refundRepository.findById(paymentId, tx, true);
      if (!refund) throw new AppError('PAYMENT_REFUND_NOT_FOUND', 404, 'Refund intent not found');
      if (refund.status === 'REFUNDED') return;

      const payment = await paymentRepository.lockById(paymentId, tx);
      if (!payment) throw new AppError('PAYMENT_NOT_FOUND', 404, 'Payment not found');
      if (payment.status === 'REFUNDED') {
        await refundRepository.markRefunded(paymentId, tx);
        return;
      }
      if (payment.status !== 'SUCCESS') {
        throw new AppError('PAYMENT_NOT_REFUNDABLE', 409, `Payment status ${payment.status} is not refundable`);
      }

      const bookingId = payment.bookingId;
      if (!bookingId) {
        throw new AppError('PAYMENT_REFUND_TARGET_UNSUPPORTED', 409, 'Only booking payments can be refunded to wallet');
      }
      const bookingResult = await bookingRepository.findBookingById(bookingId, tx);
      if (!bookingResult) throw new AppError('BOOKING_NOT_FOUND', 404, 'Booking not found');

      await walletService.credit({
        userId: bookingResult.booking.playerId,
        amount: payment.amount,
        entryType: 'REFUND',
        referenceType: 'BOOKING',
        referenceId: bookingId,
        idempotencyKey: `payment-refund:${payment.id}`,
        description: refund.reason || 'Hoàn tiền booking',
      }, tx);
      await paymentRepository.updateStatus(payment.id, 'REFUNDED', new Date(), tx);
      await refundRepository.markRefunded(paymentId, tx);
      await notificationService.notify(tx, [
        refundOutcomeEvent('BOOKING_REFUNDED', bookingId, bookingResult.booking.playerId),
      ]);
    });
  }

  private async failRefund(paymentId: number, error: string): Promise<void> {
    await db.transaction(async (tx) => {
      await refundRepository.markFailed(paymentId, error, tx);
      const payment = await paymentRepository.findById(paymentId, tx);
      if (!payment?.bookingId) return;
      const booking = await bookingRepository.findBookingById(payment.bookingId, tx);
      if (!booking) return;
      await notificationService.notify(tx, [
        refundOutcomeEvent('BOOKING_REFUND_FAILED', payment.bookingId, booking.booking.playerId),
      ]);
    });
  }
}

export const refundService = new RefundService();
