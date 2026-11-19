import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { financeQueryRepository } from '../../repositories/finance/FinanceQueryRepository';
import { walletService } from '../payments/WalletService';
import { financeAuditService } from './FinanceAuditService';
import { logger } from '../../shared/logging/logger';

export interface OwnerEarningSweepInput {
  from?: string;
  to?: string;
  limit?: number;
  dryRun?: boolean;
  actorId?: number;
}

export interface OwnerEarningSweepResult {
  scanned: number;
  credited: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  creditedBookings: Array<{ bookingId: number; ownerId: number; amount: string }>;
  failures: Array<{ bookingId: number; error: string }>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export class OwnerEarningService {
  async sweep(input: OwnerEarningSweepInput = {}): Promise<OwnerEarningSweepResult> {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
    const rows = await financeQueryRepository.eligibleOwnerEarnings({
      from: input.from,
      to: input.to,
      limit,
    });
    const result: OwnerEarningSweepResult = {
      scanned: rows.length,
      credited: 0,
      skipped: 0,
      failed: 0,
      dryRun: Boolean(input.dryRun),
      creditedBookings: [],
      failures: [],
    };

    for (const row of rows) {
      const bookingId = Number(row.booking_id);
      const ownerId = Number(row.owner_id);
      const amount = String(row.total_amount);
      if (input.dryRun) {
        result.credited += 1;
        result.creditedBookings.push({ bookingId, ownerId, amount });
        continue;
      }
      try {
        await db.transaction(async tx => {
          await walletService.credit({
            userId: ownerId,
            amount,
            entryType: 'OWNER_EARNING',
            referenceType: 'BOOKING',
            referenceId: bookingId,
            idempotencyKey: `owner-earning:${bookingId}`,
            description: `Doanh thu booking ${row.booking_code}`.slice(0, 200),
          }, tx);
        });
        result.credited += 1;
        result.creditedBookings.push({ bookingId, ownerId, amount });
      } catch (error) {
        if (isUniqueViolation(error)) {
          result.skipped += 1;
          continue;
        }
        result.failed += 1;
        result.failures.push({ bookingId, error: error instanceof Error ? error.message : String(error) });
        logger.error('Owner earning credit failed', { bookingId, ownerId, error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!input.dryRun && input.actorId) {
      await financeAuditService.record({
        actorId: input.actorId,
        action: 'OWNER_EARNING_SWEEP',
        entityType: 'BOOKING',
        entityId: null,
        metadata: {
          from: input.from ?? null,
          to: input.to ?? null,
          limit,
          scanned: result.scanned,
          credited: result.credited,
          skipped: result.skipped,
          failed: result.failed,
        },
      });
    }

    return result;
  }

  async reverse(bookingId: number, actorId: number, reason: string) {
    const earning = await financeQueryRepository.ownerEarningByBooking(bookingId, 'OWNER_EARNING');
    if (!earning) {
      throw new AppError('FINANCE_OWNER_EARNING_NOT_ELIGIBLE', 409, 'Owner earning not found for this booking');
    }
    const existingReversal = await financeQueryRepository.ownerEarningByBooking(bookingId, 'OWNER_EARNING_REVERSAL');
    if (existingReversal) {
      return { reversed: false, entry: existingReversal };
    }

    try {
      const result = await db.transaction(async tx => {
        const reversal = await walletService.debit({
          userId: earning.userId,
          amount: earning.amount,
          entryType: 'OWNER_EARNING_REVERSAL',
          referenceType: 'BOOKING',
          referenceId: bookingId,
          idempotencyKey: `owner-earning-reversal:${bookingId}`,
          description: reason.slice(0, 200),
          createdBy: actorId,
        }, tx);
        await financeAuditService.record({
          actorId,
          action: 'OWNER_EARNING_REVERSAL',
          entityType: 'BOOKING',
          entityId: bookingId,
          metadata: { amount: earning.amount, ownerId: earning.userId, reason },
        }, tx);
        return reversal;
      });
      return { reversed: true, entry: result.entry, wallet: result.wallet };
    } catch (error) {
      if (error instanceof AppError && error.code === 'WALLET_INSUFFICIENT_BALANCE') {
        throw new AppError(
          'FINANCE_OWNER_EARNING_INSUFFICIENT_BALANCE',
          409,
          'Owner wallet balance is insufficient for this reversal',
        );
      }
      throw error;
    }
  }
}

export const ownerEarningService = new OwnerEarningService();
