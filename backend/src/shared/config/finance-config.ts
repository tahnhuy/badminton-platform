import { clearConfigCache, configDefinitions, loadConfigValues } from './config-registry';

const financeKeys = [
  'OWNER_EARNING_AUTO_CREDIT_ENABLED',
  'WALLET_AUTO_APPROVE_PAYOUTS',
] as const;

export const FINANCE_CONFIG_DEFAULTS = {
  OWNER_EARNING_AUTO_CREDIT_ENABLED: configDefinitions.OWNER_EARNING_AUTO_CREDIT_ENABLED.defaultValue,
  WALLET_AUTO_APPROVE_PAYOUTS: configDefinitions.WALLET_AUTO_APPROVE_PAYOUTS.defaultValue,
} as const;

export interface OwnerEarningConfig {
  autoCreditEnabled: boolean;
}

export interface PayoutConfig {
  autoApprovePayouts: boolean;
}

export const financeConfig = {
  clearCache: clearConfigCache,

  async getOwnerEarningConfig(): Promise<OwnerEarningConfig> {
    const values = await loadConfigValues(financeKeys);
    return {
      autoCreditEnabled: values.OWNER_EARNING_AUTO_CREDIT_ENABLED,
    };
  },

  async getPayoutConfig(): Promise<PayoutConfig> {
    const values = await loadConfigValues(financeKeys);
    return {
      autoApprovePayouts: values.WALLET_AUTO_APPROVE_PAYOUTS,
    };
  },
};
