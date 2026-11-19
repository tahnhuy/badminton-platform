import { refundRepository, PaymentRefundListFilter } from '../../repositories/payment/RefundRepository';

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
}

export const adminRefundService = new AdminRefundService();
