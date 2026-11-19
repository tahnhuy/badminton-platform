import { AppError } from '../../errors/AppError';
import { financeReportRepository, ReconciliationAggregatePair } from '../../repositories/finance/FinanceReportRepository';
import { FinanceAuditService, financeAuditService } from './FinanceAuditService';
import { FinanceBounds, resolveFinanceRange } from './finance-range';

export interface ReconciliationDiscrepancy {
  key: string;
  type: string;
  entityType: string;
  entityId: string | null;
  expected: string;
  actual: string;
  delta: string;
  message: string;
}

const EPSILON = 0.005;

function differs(expected: string, actual: string): boolean {
  return Math.abs(Number(expected) - Number(actual)) > EPSILON;
}

function delta(expected: string, actual: string): string {
  return (Number(actual) - Number(expected)).toFixed(2);
}

function addPair(
  discrepancies: ReconciliationDiscrepancy[],
  type: string,
  entityType: string,
  keySuffix: string,
  pair: ReconciliationAggregatePair,
  message: string,
) {
  if (!differs(pair.expected, pair.actual)) return;
  discrepancies.push({
    key: `${type}:${keySuffix}`,
    type,
    entityType,
    entityId: null,
    expected: pair.expected,
    actual: pair.actual,
    delta: delta(pair.expected, pair.actual),
    message,
  });
}

export class ReconciliationService {
  constructor(private readonly auditService: FinanceAuditService = financeAuditService) {}

  async run(query: { range?: any; startDate?: string; endDate?: string }) {
    const bounds: FinanceBounds = resolveFinanceRange(query);
    const [pairs, wallets, unmatched] = await Promise.all([
      financeReportRepository.reconciliationPairs(bounds),
      financeReportRepository.reconciliationWallets(),
      financeReportRepository.reconciliationUnmatched(),
    ]);

    const discrepancies: ReconciliationDiscrepancy[] = [];
    addPair(discrepancies, 'TOP_UP_TOTAL', 'TOP_UP', 'range', pairs.topUp, 'Top-up SUCCESS total differs from TOP_UP ledger total');
    addPair(discrepancies, 'PAYMENT_TOTAL', 'PAYMENT', 'range', pairs.payment, 'Payment SUCCESS total differs from PAYMENT ledger total');
    addPair(discrepancies, 'REFUND_TOTAL', 'REFUND', 'range', pairs.refund, 'Refunded total differs from REFUND ledger total');
    addPair(discrepancies, 'PAYOUT_TOTAL', 'PAYOUT', 'range', pairs.payout, 'Paid payout total differs from WITHDRAWAL/PAYOUT ledger total');
    addPair(discrepancies, 'OWNER_EARNING_TOTAL', 'BOOKING', 'range', pairs.ownerEarning, 'Completed paid bookings differ from OWNER_EARNING ledger total');

    for (const wallet of wallets) {
      const expected = String(wallet.ledger_total);
      const actual = String(wallet.balance);
      if (differs(expected, actual)) {
        discrepancies.push({
          key: `WALLET_BALANCE:${wallet.user_id}`,
          type: 'WALLET_BALANCE',
          entityType: 'WALLET',
          entityId: String(wallet.user_id),
          expected,
          actual,
          delta: delta(expected, actual),
          message: `Wallet #${wallet.user_id} balance differs from its ledger sum`,
        });
      }
    }

    for (const id of unmatched.top_up_ids) {
      discrepancies.push({
        key: `TOP_UP_MISSING_LEDGER:${id}`,
        type: 'TOP_UP_MISSING_LEDGER',
        entityType: 'TOP_UP',
        entityId: String(id),
        expected: 'ledger TOP_UP entry',
        actual: 'missing',
        delta: '',
        message: `Top-up #${id} is SUCCESS but has no matching ledger entry`,
      });
    }
    for (const id of unmatched.payout_ids) {
      discrepancies.push({
        key: `PAYOUT_MISSING_LEDGER:${id}`,
        type: 'PAYOUT_MISSING_LEDGER',
        entityType: 'PAYOUT',
        entityId: String(id),
        expected: 'ledger WITHDRAWAL/PAYOUT entry',
        actual: 'missing',
        delta: '',
        message: `Payout #${id} is PAID but has no matching ledger entry`,
      });
    }
    for (const id of unmatched.refund_payment_ids) {
      discrepancies.push({
        key: `REFUND_MISSING_LEDGER:${id}`,
        type: 'REFUND_MISSING_LEDGER',
        entityType: 'REFUND',
        entityId: String(id),
        expected: 'ledger REFUND entry',
        actual: 'missing',
        delta: '',
        message: `Refund for payment #${id} is REFUNDED but has no matching ledger entry`,
      });
    }
    for (const id of unmatched.payment_ids) {
      discrepancies.push({
        key: `PAYMENT_MISSING_LEDGER:${id}`,
        type: 'PAYMENT_MISSING_LEDGER',
        entityType: 'PAYMENT',
        entityId: String(id),
        expected: 'ledger PAYMENT entry',
        actual: 'missing',
        delta: '',
        message: `Payment #${id} is SUCCESS but has no matching ledger entry`,
      });
    }
    for (const id of unmatched.owner_booking_ids) {
      discrepancies.push({
        key: `OWNER_EARNING_MISSING:${id}`,
        type: 'OWNER_EARNING_MISSING',
        entityType: 'BOOKING',
        entityId: String(id),
        expected: 'OWNER_EARNING ledger or settlement',
        actual: 'missing',
        delta: '',
        message: `Booking #${id} is COMPLETED and paid but has no Owner earning settlement`,
      });
    }

    const max = 500;
    const truncated = discrepancies.length > max;
    return {
      range: bounds.range,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        checks: 5 + wallets.length + 5,
        failed: discrepancies.length,
        truncated,
      },
      discrepancies: discrepancies.slice(0, max),
    };
  }

  async resolve(key: string, actorId: number, note: string) {
    if (!key.trim()) throw new AppError('FINANCE_RECONCILIATION_NOT_FOUND', 404, 'Discrepancy key is required');
    await this.auditService.record({
      actorId,
      action: 'RECONCILIATION_RESOLVE',
      entityType: 'RECONCILIATION',
      entityId: key,
      metadata: { note },
    });
    return { resolved: true, key, note };
  }
}

export const reconciliationService = new ReconciliationService();
