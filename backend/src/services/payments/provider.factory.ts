import { env } from '../../shared/config/env';
import { PaymentProvider } from './provider.interface';
import { MockPaymentAdapter } from './adapters/mock.adapter';

export type SupportedPaymentProvider = 'MOCK' | 'VNPAY';

export class PaymentProviderFactory {
  private static mockAdapter = new MockPaymentAdapter();

  static getProvider(providerName?: string): PaymentProvider {
    const target = (providerName || env.PAYMENT_PROVIDER || 'MOCK').toUpperCase();

    switch (target) {
      case 'MOCK':
        return this.mockAdapter;
      case 'VNPAY':
        // If VNPAY adapter is not yet implemented or configured, in non-production fallback to Mock
        // or instantiate VnPayPaymentAdapter once Phase 4 is reached.
        return this.mockAdapter;
      default:
        return this.mockAdapter;
    }
  }
}
