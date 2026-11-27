import { and, eq, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import { walletTopUps, walletPayoutRequests } from '../../db/schema/wallet';
import { AppError } from '../../errors/AppError';
import { loadConfigValues } from '../../shared/config/config-registry';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import { userRepository } from '../../repositories/user/UserRepository';
import { walletService } from './WalletService';

export async function newWalletRequestDeadline(): Promise<Date> {
  const values = await loadConfigValues(['WALLET_REQUEST_TIMEOUT_MINUTES'] as const);
  return new Date(Date.now() + values.WALLET_REQUEST_TIMEOUT_MINUTES * 60_000);
}

/** Checked inside the same row lock used for payment/approval. Completed replays are handled by the caller. */
export function assertWalletRequestActive(request: { expiresAt: Date | null }, code: string): void {
  if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
    throw new AppError(code, 409, 'Yêu cầu đã hết hạn. Vui lòng tạo yêu cầu mới.');
  }
}

export const walletRequestExpiryService = {
  async runOnce(now = new Date()): Promise<void> {
    await db.update(walletTopUps).set({ status: 'EXPIRED', updatedAt: now })
      .where(and(eq(walletTopUps.status, 'PENDING'), lte(walletTopUps.expiresAt, now)));
    const candidates = await db.select({ id: walletPayoutRequests.id }).from(walletPayoutRequests)
      .where(and(inArray(walletPayoutRequests.status, ['PENDING', 'APPROVED']), lte(walletPayoutRequests.expiresAt, now)))
      .orderBy(walletPayoutRequests.expiresAt).limit(200);
    for (const { id } of candidates) {
      await db.transaction(async tx => {
        const request = await walletRepository.findPayoutRequest(id, tx, true);
        if (!request || !['PENDING', 'APPROVED'].includes(request.status) || request.expiresAt > now) return;
        await userRepository.lockUsersAscending([request.userId], tx);
        if (request.holdId) await walletService.releaseHold(request.holdId, tx);
        await walletRepository.updatePayoutStatus(id, 'FAILED', {
          adminNote: 'Yêu cầu đã hết hạn. Tiền đang giữ đã được giải phóng.',
        }, tx);
      });
    }
  },
};
