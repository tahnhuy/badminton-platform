import { assertWalletRequestActive } from '../payments/WalletRequestExpiryService';
import { randomUUID } from 'crypto';
import { sql, and, eq } from 'drizzle-orm';
import { walletTopUps } from '../../db/schema/wallet';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import { walletService } from '../payments/WalletService';
import { financeAuditService } from './FinanceAuditService';

export interface ManualTopUpMatchInput {
  topUpId?: number;
  provider: string;
  providerReference: string;
  amount: string;
  userId: number;
  reason: string;
  transferTime?: string;
}

export class FinanceTopUpService {
  async manualMatch(input: ManualTopUpMatchInput, actorId: number) {
    const amount = String(input.amount);
    return db.transaction(async tx => {
      // Serialize manual retries for this provider evidence. The database unique
      // index also protects against webhook/manual races across different intents.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.provider + ':' + input.providerReference}, 0))`);
      const [used] = await tx.select().from(walletTopUps).where(and(
        eq(walletTopUps.provider, input.provider),
        eq(walletTopUps.providerTransactionId, input.providerReference),
      )).limit(1);
      let topUp = input.topUpId
        ? await walletRepository.findTopUpById(input.topUpId, tx, true)
        : used;
      if (input.topUpId && !topUp) throw new AppError('WALLET_TOP_UP_NOT_FOUND', 404, 'Top-up not found');
      if (used && input.topUpId && used.id !== input.topUpId) {
        throw new AppError('FINANCE_MANUAL_MATCH_ALREADY_USED', 409, 'Provider transaction is already linked to another top-up');
      }
      if (!topUp) {
        // A missing intent is an explicit collection action, never a fallback
        // from a misspelled intent id. Refuse ambiguous outstanding intents.
        const [pending] = await tx.select({ id: walletTopUps.id }).from(walletTopUps).where(and(
          eq(walletTopUps.userId, input.userId), eq(walletTopUps.provider, input.provider),
          eq(walletTopUps.amount, amount), eq(walletTopUps.status, 'PENDING'),
        )).limit(1);
        if (pending) throw new AppError('FINANCE_MANUAL_MATCH_INTENT_REQUIRED', 409, 'Select the existing pending top-up instead');
        topUp = await walletRepository.createTopUp({
          userId: input.userId, amount, provider: input.provider,
          txnRef: `MANUAL-${randomUUID()}`,
        }, tx);
      }
      if (topUp.provider !== input.provider || topUp.userId !== input.userId || Number(topUp.amount) !== Number(amount)) {
        throw new AppError('FINANCE_MANUAL_MATCH_ALREADY_USED', 409, 'Provider, user or amount does not match the top-up');
      }
      if (topUp.status === 'SUCCESS') {
        if (topUp.providerTransactionId !== input.providerReference) {
          throw new AppError('FINANCE_MANUAL_MATCH_ALREADY_USED', 409, 'Top-up was completed with different provider evidence');
        }
        return topUp;
      }
      assertWalletRequestActive(topUp, 'WALLET_TOP_UP_EXPIRED');
      if (topUp.status !== 'PENDING') throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not pending');

      await walletService.credit({
        userId: topUp.userId,
        amount: topUp.amount,
        entryType: 'TOP_UP',
        referenceType: 'TOP_UP',
        referenceId: topUp.id,
        idempotencyKey: `wallet-topup:${topUp.id}`,
        description: `Admin manual top-up ${topUp.txnRef}`.slice(0, 200),
      }, tx);

      const updated = await walletRepository.updateTopUpStatus(topUp.id, 'SUCCESS', input.providerReference, tx);
      await financeAuditService.record({
        actorId,
        action: 'TOP_UP_MANUAL_MATCH',
        entityType: 'TOP_UP',
        entityId: updated.id,
        metadata: {
          provider: input.provider,
          providerReference: input.providerReference,
          amount,
          userId: input.userId,
          reason: input.reason,
          transferTime: input.transferTime ?? null,
        },
      }, tx);
      return updated;
    }).catch(error => {
      const code = error?.code ?? error?.cause?.code;
      if (code === '23505') throw new AppError('FINANCE_MANUAL_MATCH_ALREADY_USED', 409, 'Provider reference is already linked to another top-up');
      throw error;
    });
  }
}

export const financeTopUpService = new FinanceTopUpService();
