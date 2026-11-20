import { env } from '../../shared/config/env';
import { AppError } from '../../errors/AppError';
import { PaymentProvider } from './provider.interface';
import { MockPaymentAdapter } from './adapters/mock.adapter';
import { vnpayPaymentAdapter } from './adapters/vnpay.adapter';
import { sepayPaymentAdapter } from './adapters/sepay.adapter';

export type SupportedPaymentProvider = 'MOCK' | 'VNPAY' | 'SEPAY';

export class PaymentProviderFactory {
  private static mockAdapter = new MockPaymentAdapter();

  static getProvider(providerName?: string): PaymentProvider {
    const target = (providerName || env.PAYMENT_PROVIDER || 'MOCK').toUpperCase();

    switch (target) {
      case 'MOCK':
        if (env.NODE_ENV === 'production') {
          throw new AppError('PAYMENT_PROVIDER_MOCK_FORBIDDEN', 500, 'Mock payment provider is not allowed in production');
        }
        return this.mockAdapter;
      case 'VNPAY':
        if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET) {
          throw new AppError('VNPAY_CONFIG_MISSING', 500, 'VNPAY payment provider is selected but credentials are missing');
        }
        return vnpayPaymentAdapter;
      case 'SEPAY':
        if (!env.SEPAY_MERCHANT_ID || !env.SEPAY_SECRET_KEY) {
          throw new AppError('SEPAY_CONFIG_MISSING', 500, 'SePay payment provider is selected but credentials are missing');
        }
        return sepayPaymentAdapter;
      default:
        throw new AppError('PAYMENT_PROVIDER_INVALID', 500, `Unsupported payment provider: ${target}`);
    }
  }
}
