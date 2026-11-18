import { env } from './env';
import { clearConfigCache, loadConfigValues, loadStoredConfigValues } from './config-registry';

const refundKeys = ['REFUND_ENABLED', 'REFUND_PROCESSING_TIMEOUT_MINUTES'] as const;

export interface RefundConfig {
  enabled: boolean;
  processingTimeoutMinutes: number;
}

export const refundConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<RefundConfig> {
    const [values, stored] = await Promise.all([
      loadConfigValues(refundKeys),
      loadStoredConfigValues(),
    ]);
    // SC-D10: the stored value wins; env remains the fallback when no row exists.
    return {
      enabled: stored.has('REFUND_ENABLED') ? values.REFUND_ENABLED : env.REFUND_ENABLED,
      processingTimeoutMinutes: stored.has('REFUND_PROCESSING_TIMEOUT_MINUTES')
        ? values.REFUND_PROCESSING_TIMEOUT_MINUTES
        : env.REFUND_PROCESSING_TIMEOUT_MINUTES,
    };
  },
};
