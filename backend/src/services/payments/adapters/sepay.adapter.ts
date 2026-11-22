import { AppError } from '../../../errors/AppError';
import { env } from '../../../shared/config/env';
import {
  PaymentProvider,
  CreatePaymentUrlParams,
  PaymentVerifyResult,
  RefundParams,
  RefundResult,
} from '../provider.interface';

export class SepayPaymentAdapter implements PaymentProvider {
  readonly name = 'SEPAY';

  async createPaymentUrl(params: CreatePaymentUrlParams): Promise<string | null> {
    if (!env.SEPAY_MERCHANT_ID || !env.SEPAY_SECRET_KEY) {
      throw new AppError('SEPAY_CONFIG_MISSING', 500, 'SEPAY_MERCHANT_ID and SEPAY_SECRET_KEY are required');
    }
    // The browser is redirected to this local page, which renders and auto-submits the SePay form.
    return `/api/v1/payments/sepay/checkout/${params.paymentId}`;
  }

  async verifyWebhook(payload: Record<string, unknown>): Promise<PaymentVerifyResult> {
    const order = (payload.order ?? {}) as Record<string, unknown>;
    const transaction = (payload.transaction ?? {}) as Record<string, unknown>;
    const success = payload.notification_type === 'ORDER_PAID'
      && String(transaction.transaction_status ?? '') === 'APPROVED';
    return {
      isValid: true,
      orderRef: order.order_invoice_number ? String(order.order_invoice_number) : undefined,
      transactionId: transaction.transaction_id ? String(transaction.transaction_id) : undefined,
      amount: order.order_amount !== undefined ? Number(order.order_amount) : undefined,
      status: success ? 'SUCCESS' : 'FAILED',
      responseCode: String(transaction.transaction_status ?? ''),
      message: success ? 'SePay payment confirmed' : 'SePay payment not successful',
    };
  }

  async processRefund(_params: RefundParams): Promise<RefundResult> {
    throw new AppError('SEPAY_PAYOUT_NOT_IMPLEMENTED', 501, 'SePay payout is not enabled; owner payouts are Admin-approved manual transfers');
  }
}

export const sepayPaymentAdapter = new SepayPaymentAdapter();
