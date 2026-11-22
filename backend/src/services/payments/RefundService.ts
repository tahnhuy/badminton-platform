import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { paymentRepository } from '../../repositories/payment/PaymentRepository';
import { refundRepository } from '../../repositories/payment/RefundRepository';
import { walletService } from './WalletService';
import { refundConfig } from '../../shared/config/refund-config';
import { notificationService } from '../notifications/NotificationService';
import { notifyAdmins } from '../notifications/admin-notifications';
import { ownerEarningService } from '../finance/OwnerEarningService';

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

      const shares = await bookingRepository.findCostSharesByBookingId(bookingId, tx) as {
        id: number; playerId: number; amount: string; status: string;
      }[];
      const refundRecipients: number[] = [];
      if (shares.length > 0) {
        // Split booking: return each member's own share instead of paying the
        // whole booking amount to the booking owner.
        for (const share of shares) {
          if (share.status === 'REFUNDED') continue;
          const credited = await walletService.credit({
            userId: Number(share.playerId),
            amount: share.amount,
            entryType: 'REFUND',
            referenceType: 'BOOKING',
            referenceId: bookingId,
            idempotencyKey: `match-booking-share-refund:${bookingId}:${share.playerId}`,
            description: refund.reason || 'Hoàn tiền phần sân kèo',
          }, tx);
          await bookingRepository.markCostShareRefunded(share.id, credited.entry.id, tx);
          refundRecipients.push(Number(share.playerId));
        }
      } else {
        await walletService.credit({
          userId: bookingResult.booking.playerId,
          amount: payment.amount,
          entryType: 'REFUND',
          referenceType: 'BOOKING',
          referenceId: bookingId,
          idempotencyKey: `payment-refund:${payment.id}`,
          description: refund.reason || 'Hoàn tiền booking',
        }, tx);
        refundRecipients.push(bookingResult.booking.playerId);
      }
      await paymentRepository.updateStatus(payment.id, 'REFUNDED', new Date(), tx);
      await refundRepository.markRefunded(paymentId, tx);

      const earningOutcome = await ownerEarningService.handlePaymentRefund(
        bookingId,
        refund.reason || 'Hoàn tiền booking',
        tx,
      );
      if (earningOutcome.status === 'insufficient' && earningOutcome.settlement) {
        await notifyAdmins(tx, {
          type: 'ADMIN_OWNER_EARNING_REVERSAL_FAILED',
          title: 'Không thu hồi được doanh thu Owner',
          content: `Booking #${bookingId} đã hoàn tiền nhưng ví Owner không đủ số dư để thu hồi. Cần xử lý thủ công.`,
          resource: { type: 'ADMIN_OWNER_EARNING', id: earningOutcome.settlement.id },
          dedupKey: `admin-owner-earning-reversal:${bookingId}`,
        });
      }

      await notificationService.notify(tx, [...new Set(refundRecipients)].map(recipientId =>
        refundOutcomeEvent('BOOKING_REFUNDED', bookingId, recipientId),
      ));
    });
  }

  private async failRefund(paymentId: number, error: string): Promise<void> {
    await db.transaction(async (tx) => {
      await refundRepository.markFailed(paymentId, error, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_REFUND_FAILED',
        title: 'Hoàn tiền thất bại cần xử lý',
        content: `Khoản hoàn tiền cho payment #${paymentId} thất bại: ${error.slice(0, 300)}`,
        resource: { type: 'ADMIN_REFUND', id: paymentId },
        dedupKey: `admin-refund:${paymentId}`,
      });
      const payment = await paymentRepository.findById(paymentId, tx);
      if (!payment?.bookingId) return;
      const booking = await bookingRepository.findBookingById(payment.bookingId, tx);
      if (!booking) return;
      const shares = await bookingRepository.findCostSharesByBookingId(payment.bookingId, tx) as { playerId: number }[];
      const recipients = shares.length > 0
        ? [...new Set(shares.map(share => Number(share.playerId)))]
        : [booking.booking.playerId];
      await notificationService.notify(tx, recipients.map(recipientId =>
        refundOutcomeEvent('BOOKING_REFUND_FAILED', payment.bookingId!, recipientId),
      ));
    });
  }
}

export const refundService = new RefundService();
