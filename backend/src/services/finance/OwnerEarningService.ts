import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';
import { financeQueryRepository } from '../../repositories/finance/FinanceQueryRepository';
import { ownerEarningSettlementRepository } from '../../repositories/finance/OwnerEarningSettlementRepository';
import { walletService } from '../payments/WalletService';
import { financeAuditService } from './FinanceAuditService';
import { notifyAdmins } from '../notifications/admin-notifications';
import { notifyOwnerEarning } from '../notifications/owner-notifications';
import { userRepository } from '../../repositories/user/UserRepository';
import { financeConfig } from '../../shared/config/finance-config';
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
  pending: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  autoCreditEnabled: boolean;
  creditedBookings: Array<{ bookingId: number; ownerId: number; amount: string }>;
  pendingBookings: Array<{ bookingId: number; ownerId: number; amount: string; settlementId: number }>;
  failures: Array<{ bookingId: number; error: string }>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export class OwnerEarningService {
  async sweep(input: OwnerEarningSweepInput = {}): Promise<OwnerEarningSweepResult> {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
    const config = await financeConfig.getOwnerEarningConfig();
    const rows = await financeQueryRepository.eligibleOwnerEarnings({
      from: input.from,
      to: input.to,
      limit,
    });
    const result: OwnerEarningSweepResult = {
      scanned: rows.length,
      credited: 0,
      pending: 0,
      skipped: 0,
      failed: 0,
      dryRun: Boolean(input.dryRun),
      autoCreditEnabled: config.autoCreditEnabled,
      creditedBookings: [],
      pendingBookings: [],
      failures: [],
    };

    for (const row of rows) {
      const bookingId = Number(row.booking_id);
      const ownerId = Number(row.owner_id);
      const amount = String(row.total_amount);
      const bookingCode = row.booking_code;

      if (input.dryRun) {
        if (config.autoCreditEnabled) result.credited += 1;
        else result.pending += 1;
        continue;
      }

      try {
        if (config.autoCreditEnabled) {
          const settlement = await db.transaction(async tx => {
            // USERS before wallet rows: the notification below KEY SHARE-locks the Owner.
            await userRepository.lockUsersAscending([ownerId], tx);
            const credited = await walletService.credit({
              userId: ownerId,
              amount,
              entryType: 'OWNER_EARNING',
              referenceType: 'BOOKING',
              referenceId: bookingId,
              idempotencyKey: `owner-earning:${bookingId}`,
              description: `Doanh thu booking ${bookingCode}`.slice(0, 200),
            }, tx);
            const created = await ownerEarningSettlementRepository.create({
              bookingId,
              ownerId,
              amount,
              status: 'CREDITED',
              mode: 'AUTO',
              ledgerEntryId: credited.entry.id,
              decidedAt: new Date(),
            }, tx);
            await notifyOwnerEarning(tx, created, {
              type: 'OWNER_EARNING_CREDITED',
              title: 'Doanh thu booking đã được cộng ví',
              content: `Booking ${bookingCode} đã được cộng ${Number(amount).toLocaleString('vi-VN')}đ vào ví chủ sân.`,
              resource: { type: 'OWNER_EARNING', id: created.id },
              dedupKey: `owner-earning:${created.id}`,
            });
            return created;
          });
          result.credited += 1;
          result.creditedBookings.push({ bookingId, ownerId, amount });
          void settlement;
        } else {
          const settlement = await db.transaction(async tx => {
            const created = await ownerEarningSettlementRepository.create({
              bookingId,
              ownerId,
              amount,
              status: 'PENDING',
              mode: 'MANUAL',
            }, tx);
            await notifyAdmins(tx, {
              type: 'ADMIN_OWNER_EARNING_PENDING',
              title: 'Owner earning chờ duyệt',
              content: `Booking ${bookingCode} của Owner #${ownerId} có ${Number(amount).toLocaleString('vi-VN')}đ chờ duyệt.`,
              resource: { type: 'ADMIN_OWNER_EARNING', id: created.id },
              dedupKey: `admin-owner-earning:${bookingId}`,
            });
            return created;
          });
          result.pending += 1;
          result.pendingBookings.push({ bookingId, ownerId, amount, settlementId: settlement.id });
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          result.skipped += 1;
          continue;
        }
        result.failed += 1;
        result.failures.push({ bookingId, error: error instanceof Error ? error.message : String(error) });
        logger.error('Owner earning credit failed', {
          bookingId,
          ownerId,
          error: error instanceof Error ? error.message : String(error),
        });
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
          autoCreditEnabled: config.autoCreditEnabled,
          scanned: result.scanned,
          credited: result.credited,
          pending: result.pending,
          skipped: result.skipped,
          failed: result.failed,
        },
      });
    }

    return result;
  }

  /**
   * Settle one booking immediately after a successful payment. Idempotent by
   * booking; safe to call inside the payment transaction.
   */
  async settleBooking(bookingId: number, tx: TransactionContext) {
    const eligibility = await financeQueryRepository.ownerEarningEligibility(bookingId, tx);
    if (
      !eligibility
      || !['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(eligibility.booking_status)
      || !eligibility.has_success_payment
      || Number(eligibility.total_amount) <= 0
      || eligibility.has_settlement
      || eligibility.has_owner_earning
    ) {
      return { status: 'skipped' as const };
    }

    const config = await financeConfig.getOwnerEarningConfig();
    const ownerId = Number(eligibility.owner_id);
    const amount = String(eligibility.total_amount);
    const bookingCode = eligibility.booking_code;

    if (config.autoCreditEnabled) {
      const credited = await walletService.credit({
        userId: ownerId,
        amount,
        entryType: 'OWNER_EARNING',
        referenceType: 'BOOKING',
        referenceId: bookingId,
        idempotencyKey: `owner-earning:${bookingId}`,
        description: `Doanh thu booking ${bookingCode}`.slice(0, 200),
      }, tx);
      const settlement = await ownerEarningSettlementRepository.createIfAbsent({
        bookingId,
        ownerId,
        amount,
        status: 'CREDITED',
        mode: 'AUTO',
        ledgerEntryId: credited.entry.id,
        decidedAt: new Date(),
      }, tx);
      if (settlement) {
        await notifyOwnerEarning(tx, settlement, {
          type: 'OWNER_EARNING_CREDITED',
          title: 'Doanh thu booking đã được cộng ví',
          content: `Booking ${bookingCode} đã được cộng ${Number(amount).toLocaleString('vi-VN')}đ vào ví chủ sân.`,
          resource: { type: 'OWNER_EARNING', id: settlement.id },
          dedupKey: `owner-earning:${settlement.id}`,
        });
      }
      return { status: settlement ? ('credited' as const) : ('skipped' as const), settlement };
    }

    const settlement = await ownerEarningSettlementRepository.createIfAbsent({
      bookingId,
      ownerId,
      amount,
      status: 'PENDING',
      mode: 'MANUAL',
    }, tx);
    if (!settlement) return { status: 'skipped' as const };

    await notifyAdmins(tx, {
      type: 'ADMIN_OWNER_EARNING_PENDING',
      title: 'Owner earning chờ duyệt',
      content: `Booking ${bookingCode} của Owner #${ownerId} có ${Number(amount).toLocaleString('vi-VN')}đ chờ duyệt.`,
      resource: { type: 'ADMIN_OWNER_EARNING', id: settlement.id },
      dedupKey: `admin-owner-earning:${bookingId}`,
    });
    return { status: 'pending' as const, settlement };
  }

  /**
   * Keep Owner money consistent when a payment is refunded.
   * A pending settlement is rejected; an already-credited settlement is reversed
   * only when the Owner wallet still has enough available balance.
   */
  async handlePaymentRefund(bookingId: number, reason: string, tx: TransactionContext) {
    const settlement = await ownerEarningSettlementRepository.findByBookingId(bookingId, tx, true);
    if (!settlement || settlement.status === 'REJECTED') return { status: 'none' as const };

    if (settlement.status === 'PENDING') {
      await ownerEarningSettlementRepository.updateDecision(settlement.id, {
        status: 'REJECTED',
        decidedAt: new Date(),
        note: `Payment refunded: ${reason}`.slice(0, 500),
      }, tx);
      return { status: 'rejected' as const };
    }

    const existingReversal = await financeQueryRepository.ownerEarningByBooking(
      bookingId,
      'OWNER_EARNING_REVERSAL',
      tx,
    );
    if (existingReversal) return { status: 'reversed' as const };

    await userRepository.lockUsersAscending([settlement.ownerId], tx);
    const wallet = await walletService.getWallet(settlement.ownerId, tx);
    if (Number(wallet.available) < Number(settlement.amount)) {
      return { status: 'insufficient' as const, settlement };
    }

    await walletService.debit({
      userId: settlement.ownerId,
      amount: settlement.amount,
      entryType: 'OWNER_EARNING_REVERSAL',
      referenceType: 'BOOKING',
      referenceId: bookingId,
      idempotencyKey: `owner-earning-reversal:${bookingId}`,
      description: `Thu hồi doanh thu booking do hoàn tiền: ${reason}`.slice(0, 200),
    }, tx);
    await notifyOwnerEarning(tx, settlement, {
      type: 'OWNER_EARNING_REVERSED',
      title: 'Doanh thu booking đã được thu hồi',
      content: `Booking #${bookingId} đã hoàn tiền nên ${Number(settlement.amount).toLocaleString('vi-VN')}đ doanh thu đã được thu hồi khỏi ví chủ sân.`,
      resource: { type: 'OWNER_EARNING', id: settlement.id },
      dedupKey: `owner-earning-reversal:${bookingId}`,
    });
    return { status: 'reversed' as const, settlement };
  }

  async approve(settlementId: number, actorId: number, note?: string) {
    return db.transaction(async tx => {
      const settlement = await ownerEarningSettlementRepository.findById(settlementId, tx, true);
      if (!settlement) {
        throw new AppError('FINANCE_OWNER_EARNING_NOT_FOUND', 404, 'Owner earning settlement not found');
      }
      if (settlement.status === 'CREDITED') return settlement;
      if (settlement.status === 'REJECTED') {
        throw new AppError('FINANCE_OWNER_EARNING_REJECTED', 409, 'Owner earning settlement was rejected');
      }

      const eligibility = await financeQueryRepository.ownerEarningEligibility(settlement.bookingId, tx);
      if (!eligibility || !['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(eligibility.booking_status) || !eligibility.has_success_payment) {
        throw new AppError(
          'FINANCE_OWNER_EARNING_NOT_ELIGIBLE',
          409,
          'Booking is no longer eligible for an Owner earning',
        );
      }

      await userRepository.lockUsersAscending([settlement.ownerId], tx);
      const credited = await walletService.credit({
        userId: settlement.ownerId,
        amount: settlement.amount,
        entryType: 'OWNER_EARNING',
        referenceType: 'BOOKING',
        referenceId: settlement.bookingId,
        idempotencyKey: `owner-earning:${settlement.bookingId}`,
        description: `Doanh thu booking ${eligibility.booking_code}`.slice(0, 200),
      }, tx);

      const updated = await ownerEarningSettlementRepository.updateDecision(settlement.id, {
        status: 'CREDITED',
        ledgerEntryId: credited.entry.id,
        decidedBy: actorId,
        decidedAt: new Date(),
        note: note?.trim() || null,
      }, tx);

      await financeAuditService.record({
        actorId,
        action: 'OWNER_EARNING_APPROVE',
        entityType: 'BOOKING',
        entityId: settlement.bookingId,
        metadata: {
          settlementId: settlement.id,
          bookingId: settlement.bookingId,
          ownerId: settlement.ownerId,
          amount: settlement.amount,
          mode: settlement.mode,
          note: note?.trim() || null,
        },
      }, tx);

      await notifyOwnerEarning(tx, updated, {
        type: 'OWNER_EARNING_CREDITED',
        title: 'Doanh thu booking đã được cộng ví',
        content: `Booking ${eligibility.booking_code} đã được cộng ${Number(settlement.amount).toLocaleString('vi-VN')}đ vào ví chủ sân.`,
        resource: { type: 'OWNER_EARNING', id: updated.id },
        dedupKey: `owner-earning:${updated.id}`,
      });

      return updated;
    });
  }

  async reject(settlementId: number, actorId: number, reason: string) {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new AppError('FINANCE_OWNER_EARNING_REASON_REQUIRED', 400, 'Rejection reason is required');
    }
    return db.transaction(async tx => {
      const settlement = await ownerEarningSettlementRepository.findById(settlementId, tx, true);
      if (!settlement) {
        throw new AppError('FINANCE_OWNER_EARNING_NOT_FOUND', 404, 'Owner earning settlement not found');
      }
      if (settlement.status === 'REJECTED') return settlement;
      if (settlement.status === 'CREDITED') {
        throw new AppError('FINANCE_OWNER_EARNING_ALREADY_CREDITED', 409, 'Owner earning settlement was already credited');
      }

      const updated = await ownerEarningSettlementRepository.updateDecision(settlement.id, {
        status: 'REJECTED',
        decidedBy: actorId,
        decidedAt: new Date(),
        note: trimmed,
      }, tx);

      await financeAuditService.record({
        actorId,
        action: 'OWNER_EARNING_REJECT',
        entityType: 'BOOKING',
        entityId: settlement.bookingId,
        metadata: {
          settlementId: settlement.id,
          bookingId: settlement.bookingId,
          ownerId: settlement.ownerId,
          amount: settlement.amount,
          mode: settlement.mode,
          reason: trimmed,
        },
      }, tx);

      return updated;
    });
  }

  async listSettlements(filter: {
    status?: 'PENDING' | 'CREDITED' | 'REJECTED';
    ownerId?: number;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }) {
    return ownerEarningSettlementRepository.list(filter);
  }

  async getSettlement(settlementId: number) {
    return ownerEarningSettlementRepository.findViewById(settlementId);
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
        await userRepository.lockUsersAscending([earning.userId], tx);
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
        const settlement = await ownerEarningSettlementRepository.findByBookingId(bookingId, tx);
        if (settlement) {
          await notifyOwnerEarning(tx, settlement, {
            type: 'OWNER_EARNING_REVERSED',
            title: 'Doanh thu booking đã được thu hồi',
            content: `Booking #${bookingId}: ${Number(earning.amount).toLocaleString('vi-VN')}đ doanh thu đã được thu hồi khỏi ví chủ sân.`,
            resource: { type: 'OWNER_EARNING', id: settlement.id },
            dedupKey: `owner-earning-reversal:${bookingId}`,
          });
        }
        return reversal;
      });
      return { reversed: true, entry: result.entry, wallet: result.wallet };
    } catch (error) {
      if (error instanceof AppError && error.code === 'WALLET_INSUFFICIENT_BALANCE') {
        await financeAuditService.record({
          actorId, action: 'OWNER_EARNING_REVERSAL', entityType: 'BOOKING', entityId: bookingId,
          metadata: { outcome: 'INSUFFICIENT_BALANCE', ownerId: earning.userId, amount: earning.amount, reason },
        });
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
