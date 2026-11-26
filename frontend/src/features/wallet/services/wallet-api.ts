import { httpClient } from '../../../shared/api/http-client';
import type {
  TopUpInitiation,
  WalletEntryPage,
  WalletBankAccount,
  WalletPayoutRequest,
  WalletSnapshot,
  WithdrawalPinStatus,
  WithdrawalPinChallenge,
  WithdrawalPinResetAuthorization,
} from '../types';

type Envelope<T> = { data: T };

export const walletApi = {
  async getWallet(): Promise<WalletSnapshot> {
    const result = await httpClient<Envelope<WalletSnapshot>>('/api/v1/wallet');
    return result.data;
  },

  async getEntries(page = 1, limit = 20): Promise<WalletEntryPage> {
    return httpClient<WalletEntryPage>(`/api/v1/wallet/entries?page=${page}&limit=${limit}`);
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

  async getWithdrawalPinStatus(): Promise<WithdrawalPinStatus> {
    const result = await httpClient<Envelope<WithdrawalPinStatus>>('/api/v1/wallet/withdrawal-pin');
    return result.data;
  },

  async requestWithdrawalPinReset(): Promise<WithdrawalPinChallenge> {
    const result = await httpClient<Envelope<WithdrawalPinChallenge>>('/api/v1/wallet/withdrawal-pin/reset/request', {
      method: 'POST',
    });
    return result.data;
  },

  async verifyWithdrawalPinReset(input: { challengeId: string; otp: string }): Promise<WithdrawalPinResetAuthorization> {
    const result = await httpClient<Envelope<WithdrawalPinResetAuthorization>>('/api/v1/wallet/withdrawal-pin/reset/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },

  async resendWithdrawalPinOtp(input: { challengeId: string }): Promise<WithdrawalPinChallenge> {
    const result = await httpClient<Envelope<WithdrawalPinChallenge>>('/api/v1/wallet/withdrawal-pin/reset/resend', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },

  async resetWithdrawalPin(input: { resetToken: string; newPin: string; confirmPin: string }): Promise<void> {
    await httpClient<Envelope<{ success: boolean }>>('/api/v1/wallet/withdrawal-pin/reset', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async createWithdrawal(input: { amount: string; bankAccountId: number; withdrawalPin: string; clientRequestId: string }): Promise<WalletPayoutRequest> {
    const result = await httpClient<Envelope<WalletPayoutRequest>>('/api/v1/wallet/withdrawals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.data;
  },

  async createOwnerPayout(input: { amount: string; bankAccountId: number; withdrawalPin: string; clientRequestId: string }): Promise<WalletPayoutRequest> {
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
