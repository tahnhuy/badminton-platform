import { AppError } from '../../errors/AppError';
import {
  FinanceQueryRepository,
  financeQueryRepository,
  FinanceTransactionFilter,
  FinanceTransactionSource,
} from '../../repositories/finance/FinanceQueryRepository';
import { FinanceReportRepository, financeReportRepository, RevenueGroupBy } from '../../repositories/finance/FinanceReportRepository';
import { FinanceBounds, resolveFinanceRange } from './finance-range';

export interface FinanceListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function meta(page: number, limit: number, total: number): FinanceListMeta {
  return { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

function startOfDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00+07:00`) : undefined;
}

function endOfDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T23:59:59.999+07:00`) : undefined;
}

function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value);
  return digits.length <= 4 ? digits : `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export class FinanceQueryService {
  constructor(
    private readonly repository: FinanceQueryRepository = financeQueryRepository,
    private readonly reportRepository: FinanceReportRepository = financeReportRepository,
  ) {}

  resolveBounds(query: { range?: any; startDate?: string; endDate?: string }): FinanceBounds {
    return resolveFinanceRange(query);
  }

  async overview(query: { range?: any; startDate?: string; endDate?: string }) {
    const bounds = this.resolveBounds(query);
    const [row, trend] = await Promise.all([
      this.repository.overview(bounds),
      this.repository.dailyTrend(bounds),
    ]);
    const gross = Number(row.gross_revenue ?? 0);
    const refunds = Number(row.refunds ?? 0);
    return {
      range: bounds.range,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      walletLiability: String(row.wallet_liability ?? '0'),
      held: String(row.held ?? '0'),
      available: Math.max(0, Number(row.wallet_liability ?? 0) - Number(row.held ?? 0)).toFixed(2),
      cashIn: String(row.cash_in ?? '0'),
      cashOut: String(row.cash_out ?? '0'),
      grossRevenue: String(row.gross_revenue ?? '0'),
      refunds: String(row.refunds ?? '0'),
      netEstimated: (gross - refunds).toFixed(2),
      ownerEarnings: String(row.owner_earnings ?? '0'),
      pendingPayouts: { count: Number(row.pending_payout_count ?? 0), amount: String(row.pending_payout_amount ?? '0') },
      failedRefunds: { count: Number(row.failed_refund_count ?? 0), amount: String(row.failed_refund_amount ?? '0') },
      isEstimate: true,
      trend,
    };
  }

  async transactions(filter: {
    source?: FinanceTransactionSource;
    status?: string;
    userId?: number;
    referenceType?: string;
    referenceId?: number;
    from?: string;
    to?: string;
    minAmount?: string;
    maxAmount?: string;
    page: number;
    limit: number;
  }) {
    const repoFilter: FinanceTransactionFilter = {
      ...filter,
      from: startOfDate(filter.from),
      to: endOfDate(filter.to),
    };
    const { rows, total } = await this.repository.transactions(repoFilter);
    return { data: rows, meta: meta(filter.page, filter.limit, total) };
  }

  async transactionDetail(source: string, id: number) {
    if (source === 'ledger') {
      const row = await this.repository.ledgerEntryWithUser(id);
      if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Transaction not found');
      return {
        source: 'ledger',
        id: row.entry.id,
        entry: row.entry,
        user: { id: row.entry.userId, email: row.userEmail },
      };
    }
    if (source === 'top-up') {
      const row = await this.repository.topUpById(id);
      if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Transaction not found');
      return { source, id, topUp: row };
    }
    if (source === 'payout') {
      const row = await this.repository.payoutById(id);
      if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Transaction not found');
      return {
        source,
        id,
        payout: { ...row, bankAccount: row.bankAccount ? { ...(row.bankAccount as any), accountNumber: maskAccountNumber((row.bankAccount as any).account_number) } : null },
      };
    }
    if (source === 'refund') {
      const row = await this.repository.refundById(id);
      if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Transaction not found');
      return { source, id, ...row };
    }
    throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Unknown transaction source');
  }

  async wallet(userId: number) {
    const snapshot = await this.repository.walletSnapshot(userId);
    if (!snapshot) throw new AppError('FINANCE_WALLET_NOT_FOUND', 404, 'User not found');
    return {
      user: snapshot.user,
      balance: snapshot.balance,
      held: snapshot.held,
      available: snapshot.available,
      updatedAt: snapshot.updatedAt,
    };
  }

  async walletEntries(userId: number, page: number, limit: number) {
    const { rows, total } = await this.repository.walletEntries(userId, page, limit);
    return { data: rows, meta: meta(page, limit, total) };
  }

  async walletHolds(userId: number, status: string | undefined, page: number, limit: number) {
    const { rows, total } = await this.repository.walletHolds(userId, status, page, limit);
    return { data: rows, meta: meta(page, limit, total) };
  }

  async topUps(filter: {
    status?: string; provider?: string; userId?: number; from?: string; to?: string; page: number; limit: number;
  }) {
    const { rows, total } = await this.repository.topUps({
      ...filter,
      from: startOfDate(filter.from),
      to: endOfDate(filter.to),
    });
    return { data: rows, meta: meta(filter.page, filter.limit, total) };
  }

  async topUp(id: number) {
    const row = await this.repository.topUpById(id);
    if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Top-up not found');
    return row;
  }

  async payouts(filter: {
    status?: string; requestType?: string; userId?: number; from?: string; to?: string; page: number; limit: number;
  }) {
    const { rows, total } = await this.repository.payouts({
      ...filter,
      from: startOfDate(filter.from),
      to: endOfDate(filter.to),
    });
    return {
      data: rows.map(row => ({ ...row, bankAccountNumber: undefined })),
      meta: meta(filter.page, filter.limit, total),
    };
  }

  async payout(id: number) {
    const row = await this.repository.payoutById(id);
    if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Payout not found');
    const bankAccount = row.bankAccount as any;
    return {
      ...row,
      bankAccount: bankAccount ? {
        bankCode: bankAccount.bank_code,
        accountName: bankAccount.account_name,
        accountNumber: maskAccountNumber(bankAccount.account_number),
      } : null,
    };
  }

  async refunds(filter: {
    status?: string; paymentId?: number; userId?: number; from?: string; to?: string; page: number; limit: number;
  }) {
    const { rows, total } = await this.repository.refunds({
      ...filter,
      from: startOfDate(filter.from),
      to: endOfDate(filter.to),
    });
    return { data: rows, meta: meta(filter.page, filter.limit, total) };
  }

  async refund(paymentId: number) {
    const row = await this.repository.refundById(paymentId);
    if (!row) throw new AppError('FINANCE_TRANSACTION_NOT_FOUND', 404, 'Refund not found');
    return row;
  }

  async ownerEarnings(filter: { ownerId?: number; from?: string; to?: string; page: number; limit: number }) {
    const { rows, total } = await this.repository.ownerEarnings({
      ...filter,
      from: startOfDate(filter.from),
      to: endOfDate(filter.to),
    });
    return { data: rows, meta: meta(filter.page, filter.limit, total) };
  }

  async cashFlow(query: { range?: any; startDate?: string; endDate?: string }) {
    const bounds = this.resolveBounds(query);
    const totals = await this.reportRepository.cashFlow(bounds);
    const trend = await this.repository.dailyTrend(bounds);
    return {
      range: bounds.range,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      totals,
      series: trend,
      isEstimate: true,
    };
  }

  async revenue(query: { range?: any; startDate?: string; endDate?: string; groupBy?: RevenueGroupBy }) {
    const bounds = this.resolveBounds(query);
    const groupBy = query.groupBy ?? 'day';
    const [totals, rows] = await Promise.all([
      this.reportRepository.cashFlow(bounds),
      this.reportRepository.revenueRows(bounds, groupBy),
    ]);
    return {
      range: bounds.range,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      groupBy,
      totals,
      rows,
      isEstimate: true,
    };
  }
}

export const financeQueryService = new FinanceQueryService();
