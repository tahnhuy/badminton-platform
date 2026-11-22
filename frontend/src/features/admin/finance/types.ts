export interface FinancePageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FinanceOverview {
  range: string;
  startDate: string;
  endDate: string;
  walletLiability: string;
  held: string;
  available: string;
  cashIn: string;
  cashOut: string;
  grossRevenue: string;
  refunds: string;
  netEstimated: string;
  ownerEarnings: string;
  pendingPayouts: { count: number; amount: string };
  pendingOwnerEarnings: { count: number; amount: string };
  failedRefunds: { count: number; amount: string };
  isEstimate: boolean;
  trend: {
    cashIn: Array<{ day: string; amount: string }>;
    cashOut: Array<{ day: string; amount: string }>;
    revenue: Array<{ day: string; amount: string }>;
  };
}

export interface FinanceTransaction {
  source: 'ledger' | 'top-up' | 'payout' | 'refund';
  sourceId: number;
  occurredAt: string;
  type: string;
  status: string;
  userId: number;
  amount: string;
  balanceAfter: string | null;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  actorId: number | null;
  requestType: string | null;
}

export interface FinanceWallet {
  user: { id: number; email: string; role: string };
  balance: string;
  held: string;
  available: string;
  updatedAt: string | null;
}

export interface FinanceWalletEntry {
  id: number;
  userId: number;
  entryType: string;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  idempotencyKey: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface FinanceTopUp {
  id: number;
  userId: number;
  amount: string;
  status: string;
  provider: string;
  txnRef: string;
  createdAt: string;
  paidAt: string | null;
}

export interface FinancePayout {
  id: number;
  userId: number;
  requestType: string;
  amount: string;
  status: string;
  adminNote: string | null;
  transferReference: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface FinanceRefund {
  paymentId: number;
  status: string;
  attempts: number;
  lastError: string | null;
  reason: string | null;
  amount: string;
  provider: string;
  bookingId: number | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceOwnerEarning {
  id: number;
  ownerId: number;
  ownerEmail: string;
  bookingId: number | null;
  bookingCode: string | null;
  bookingDate: string | null;
  entryType: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

export interface FinanceOwnerEarningSettlement {
  id: number;
  bookingId: number;
  ownerId: number;
  amount: string;
  status: 'PENDING' | 'CREDITED' | 'REJECTED';
  mode: 'AUTO' | 'MANUAL';
  ledgerEntryId: number | null;
  decidedBy: number | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  bookingCode: string | null;
  bookingDate: string | null;
  ownerEmail: string;
}

export interface FinanceDiscrepancy {
  key: string;
  type: string;
  entityType: string;
  entityId: string | null;
  expected: string;
  actual: string;
  delta: string;
  message: string;
}

export interface FinanceReconciliation {
  range: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: { checks: number; failed: number; truncated: boolean };
  discrepancies: FinanceDiscrepancy[];
}

export interface FinanceReportTotals {
  cashIn: string;
  cashOut: string;
  grossRevenue: string;
  refunds: string;
  netEstimated: string;
  ownerEarnings: string;
}

export interface FinanceReport {
  range: string;
  startDate: string;
  endDate: string;
  groupBy: string;
  totals: FinanceReportTotals;
  rows: Array<{ key: string; label: string; gross: string; refunds: string; net: string; ownerEarnings: string }>;
  isEstimate: boolean;
}

export interface FinanceAudit {
  id: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}
