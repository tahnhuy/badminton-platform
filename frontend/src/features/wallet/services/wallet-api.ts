import { httpClient } from '../../../shared/api/http-client';
import type {
  TopUpInitiation,
  WalletBankAccount,
  WalletPayoutRequest,
  WalletSnapshot,
} from '../types';

type Envelope<T> = { data: T };

export const walletApi = {
  async getWallet(): Promise<WalletSnapshot> {
    const result = await httpClient<Envelope<WalletSnapshot>>('/api/v1/wallet');
    return result.data;
  },

  async createTopUp(amount: string): Promise<TopUpInitiation> {
    const result = await httpClient<Envelope<TopUpInitiation>>('/api/v1/wallet/top-ups', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    return result.data;
  },

  async mockConfirmTopUp(topUpId: number): Promise<{ status: string; wallet: WalletSnapshot }> {
    return httpClient<Envelope<{ status: string; wallet: WalletSnapshot }>>(`/api/v1/wallet/top-ups/${topUpId}/mock-confirm`, {
      method: 'POST',
    }).then(result => result.data);
  },

  async getBankAccounts(): Promise<WalletBankAccount[]> {
    const result = await httpClient<Envelope<WalletBankAccount[]>>('/api/v1/wallet/bank-accounts');
    return result.data;
  },

  async createBankAccount(input: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    isDefault?: boolean;
  }): Promise<WalletBankAccount> {
    const result = await httpClient<Envelope<WalletBankAccount>>('/api/v1/wallet/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },

  async getPayouts(): Promise<WalletPayoutRequest[]> {
    const result = await httpClient<Envelope<WalletPayoutRequest[]>>('/api/v1/wallet/payouts');
    return result.data;
  },

  async createWithdrawal(input: { amount: string; bankAccountId: number }): Promise<WalletPayoutRequest> {
    const result = await httpClient<Envelope<WalletPayoutRequest>>('/api/v1/wallet/withdrawals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },

  async createOwnerPayout(input: { amount: string; bankAccountId: number }): Promise<WalletPayoutRequest> {
    const result = await httpClient<Envelope<WalletPayoutRequest>>('/api/v1/wallet/owner-payouts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },
};

export function formatVnd(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}
