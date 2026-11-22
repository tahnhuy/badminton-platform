import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import { walletService } from '../payments/WalletService';
import { financeAuditService } from './FinanceAuditService';

export interface ManualTopUpMatchInput {
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
      let topUp = await walletRepository.findTopUpByTxnRef(input.providerReference, tx, true);
      if (topUp) {
        if (topUp.userId !== input.userId || Number(topUp.amount) !== Number(amount)) {
          throw new AppError('FINANCE_MANUAL_MATCH_ALREADY_USED', 409, 'Provider reference is already linked to another top-up');
        }
        if (topUp.status === 'SUCCESS') {
          await financeAuditService.record({
            actorId,
            action: 'TOP_UP_MANUAL_MATCH',
            entityType: 'TOP_UP',
            entityId: topUp.id,
            metadata: { provider: input.provider, providerReference: input.providerReference, amount, userId: input.userId, reason: input.reason, alreadyMatched: true },
          }, tx);
          return topUp;
        }
      } else {
        topUp = await walletRepository.createTopUp({
          userId: input.userId,
          amount,
          provider: input.provider,
          txnRef: input.providerReference,
        }, tx);
      }

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
    });
  }
}

export const financeTopUpService = new FinanceTopUpService();
