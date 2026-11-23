import { env } from '../../../shared/config/env';
import { AppError } from '../../../errors/AppError';
import {
  PaymentProvider,
  CreatePaymentUrlParams,
  PaymentVerifyResult,
  RefundParams,
  RefundResult,
} from '../provider.interface';
import {
  canonicalVnpayQuery,
  formatVnpayDate,
  signVnpayParams,
  verifyVnpaySignature,
  VnpayParams,
} from '../vnpay-signature';

const VNPAY_VERSION = '2.1.0';

function requireConfig(): { tmnCode: string; secret: string; paymentUrl: string; returnUrl: string } {
  const tmnCode = env.VNPAY_TMN_CODE?.trim();
  const secret = env.VNPAY_HASH_SECRET?.trim();
  if (!tmnCode || !secret) {
    throw new AppError('VNPAY_CONFIG_MISSING', 500, 'VNPAY_TMN_CODE and VNPAY_HASH_SECRET are required');
  }
  return {
    tmnCode,
    secret,
    paymentUrl: env.VNPAY_PAYMENT_URL,
    returnUrl: env.VNPAY_RETURN_URL,
  };
}

export class VnpayPaymentAdapter implements PaymentProvider {
  readonly name = 'VNPAY';

  async createPaymentUrl(params: CreatePaymentUrlParams): Promise<string | null> {
    const config = requireConfig();
    const now = new Date();
    const orderRef = params.txnRef || `BOOKING-${params.bookingId ?? params.paymentId}-${params.paymentId}`;
    const payload: VnpayParams = {
      vnp_Version: VNPAY_VERSION,
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderRef,
      vnp_OrderInfo: params.orderInfo || `Thanh toan ${orderRef}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(params.amount * 100),
      vnp_ReturnUrl: config.returnUrl,
      vnp_IpAddr: params.ipAddress || '127.0.0.1',
      vnp_CreateDate: formatVnpayDate(now),
    };
    if (params.expiresAt) {
      payload.vnp_ExpireDate = formatVnpayDate(params.expiresAt);
    }

    const hash = signVnpayParams(payload, config.secret);
    return `${config.paymentUrl}?${canonicalVnpayQuery(payload)}&vnp_SecureHash=${hash}`;
  }

  async verifyWebhook(rawPayload: Record<string, unknown>): Promise<PaymentVerifyResult> {
    const config = requireConfig();
    const payload: VnpayParams = Object.fromEntries(
      Object.entries(rawPayload).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );

    if (!verifyVnpaySignature(payload, config.secret)) {
      return {
        isValid: false,
        status: 'FAILED',
        responseCode: '97',
        message: 'Invalid VNPAY signature',
      };
    }

    const responseCode = String(payload.vnp_ResponseCode ?? '');
    const transactionStatus = String(payload.vnp_TransactionStatus ?? '');
    const success = responseCode === '00' && (transactionStatus === '' || transactionStatus === '00');
    return {
      isValid: true,
      orderRef: payload.vnp_TxnRef ? String(payload.vnp_TxnRef) : undefined,
      transactionId: payload.vnp_TransactionNo ? String(payload.vnp_TransactionNo) : undefined,
      amount: payload.vnp_Amount !== undefined ? Number(payload.vnp_Amount) / 100 : undefined,
      status: success ? 'SUCCESS' : 'FAILED',
      responseCode,
      message: success ? 'VNPAY payment confirmed' : `VNPAY response ${responseCode}`,
    };
  }

  async processRefund(_params: RefundParams): Promise<RefundResult> {
    // WAL-04 refunds to wallet; VNPAY payout/refund is a separate manual/sandbox step (WAL-05).
    throw new AppError('VNPAY_REFUND_NOT_IMPLEMENTED', 501, 'VNPAY refund is not enabled in this release');
  }
}

export const vnpayPaymentAdapter = new VnpayPaymentAdapter();
