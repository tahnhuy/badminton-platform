import { AppError } from '../../errors/AppError';
import { refundRepository, PaymentRefundListFilter } from '../../repositories/payment/RefundRepository';
import { refundService } from './RefundService';

export class AdminRefundService {
  async list(filter: PaymentRefundListFilter) {
    const { rows, total } = await refundRepository.list(filter);
    return {
      data: rows.map(row => ({
        paymentId: row.paymentId,
        status: row.status,
        attempts: row.attempts,
        lastError: row.lastError,
        reason: row.reason,
        amount: row.amount,
        provider: row.provider,
        bookingId: row.bookingId,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      })),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }

  async retry(paymentId: number) {
    const refund = await refundRepository.findById(paymentId);
    if (!refund) throw new AppError('PAYMENT_REFUND_NOT_FOUND', 404, 'Refund intent not found');
    if (refund.status !== 'FAILED') {
      throw new AppError('FINANCE_REFUND_NOT_RETRYABLE', 409, 'Only FAILED refunds can be retried');
    }
    if (refund.attempts >= 5) {
      throw new AppError('FINANCE_REFUND_NOT_RETRYABLE', 409, 'Refund attempt limit reached');
    }
    await refundService.refundPayment(paymentId);
    return refundRepository.findById(paymentId);
  }
}

export const adminRefundService = new AdminRefundService();
