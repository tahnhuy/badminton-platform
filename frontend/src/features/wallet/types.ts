export interface WalletSnapshot {
  userId: number;
  balance: string;
  held: string;
  available: string;
  updatedAt: string;
}

export interface TopUpInitiation {
  topUpId: number;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  provider: string;
  redirectUrl: string;
  txnRef: string;
  isMock: boolean;
  qrUrl?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  transferContent?: string;
}

export interface WalletBankAccount {
  id: number;
  userId: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: string;
}

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED';

export interface WalletPayoutRequest {
  id: number;
  userId: number;
  requestType: 'WITHDRAWAL' | 'OWNER_PAYOUT';
  amount: string;
  status: PayoutStatus;
  bankAccountId: number;
  holdId: number | null;
  adminId: number | null;
  adminNote: string | null;
  transferReference: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WalletEntryType =
  | 'TOP_UP'
  | 'PAYMENT'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'PAYOUT'
  | 'ADMIN_ADJUSTMENT'
  | 'OWNER_EARNING'
  | 'OWNER_EARNING_REVERSAL'
  | 'TOURNAMENT_EARNING';

export interface WalletLedgerEntry {
  id: number;
  userId: number;
  entryType: WalletEntryType;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  createdAt: string;
}

export interface WalletEntryPage {
  data: WalletLedgerEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface WithdrawalPinStatus {
  hasPin: boolean;
  lockedUntil: string | null;
}

export interface WithdrawalPinChallenge {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface WithdrawalPinResetAuthorization {
  resetToken: string;
  expiresAt: string;
}
