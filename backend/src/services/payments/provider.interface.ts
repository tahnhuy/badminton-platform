export interface CreatePaymentUrlParams {
  paymentId: number;
  bookingId?: number;
  bookingCode?: string;
  txnRef?: string;
  orderInfo?: string;
  amount: number;
  expiresAt?: Date;
  ipAddress?: string;
}

export interface PaymentVerifyResult {
  isValid: boolean;
  paymentId?: number;
  orderRef?: string;
  transactionId?: string;
  amount?: number;
  status: 'SUCCESS' | 'FAILED';
  responseCode?: string;
  message?: string;
}

export interface RefundParams {
  paymentId: number;
  transactionId?: string | null;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundStatus: 'REFUNDED' | 'REFUND_FAILED';
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentUrl(params: CreatePaymentUrlParams): Promise<string | null>;
  verifyWebhook(payload: Record<string, unknown>): Promise<PaymentVerifyResult>;
  processRefund(params: RefundParams): Promise<RefundResult>;
}
