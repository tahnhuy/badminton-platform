export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED';
export type PayoutType = 'WITHDRAWAL' | 'OWNER_PAYOUT';
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED';

export interface AdminPayout {
  id: number;
  userId: number;
  requestType: PayoutType;
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

export interface AdminRefund {
  paymentId: number;
  status: RefundStatus;
  attempts: number;
  lastError: string | null;
  reason: string | null;
  amount: string;
  provider: string;
  bookingId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Reconciliation {
  topUps: { success_count: string | number; success_amount: string | number };
  topUpLedger: { entry_count: string | number; entry_amount: string | number };
  payouts: { paid_count: string | number; paid_amount: string | number };
  payoutLedger: { entry_count: string | number; entry_amount: string | number };
  unmatchedTopUpIds: number[];
  unmatchedPayoutIds: number[];
}
