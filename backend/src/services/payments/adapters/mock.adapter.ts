import {
  PaymentProvider,
  CreatePaymentUrlParams,
  PaymentVerifyResult,
  RefundParams,
  RefundResult,
} from '../provider.interface';

export class MockPaymentAdapter implements PaymentProvider {
  readonly name = 'MOCK';

  async createPaymentUrl(params: CreatePaymentUrlParams): Promise<string | null> {
    // For Mock Provider, we don't need an external redirect URL.
    // The client UI handles the simulation directly via modal or mock confirmation API.
    return null;
  }

  async verifyWebhook(payload: Record<string, unknown>): Promise<PaymentVerifyResult> {
    const status = payload.status === 'FAILED' ? 'FAILED' : 'SUCCESS';
    return {
      isValid: true,
      paymentId: typeof payload.paymentId === 'number' ? payload.paymentId : undefined,
      transactionId: (payload.transactionId as string) || `MOCK_TXN_${Date.now()}`,
      amount: typeof payload.amount === 'number' ? payload.amount : undefined,
      status,
      message: 'Mock verification passed',
    };
  }

  async processRefund(params: RefundParams): Promise<RefundResult> {
    return {
      success: true,
      refundStatus: 'REFUNDED',
      message: 'Mock refund processed immediately',
    };
  }
}
