import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import {
  walletRepository,
  WalletPayoutRequestRecord,
  WalletPayoutType,
} from '../../repositories/wallet/WalletRepository';
import { parseWalletAmount, walletService } from './WalletService';
import { notifyAdmins } from '../notifications/admin-notifications';
import { notifyPayoutOwner } from '../notifications/owner-notifications';
import { userRepository } from '../../repositories/user/UserRepository';
import { financeConfig } from '../../shared/config/finance-config';
import { withdrawalPinService } from '../wallet/WithdrawalPinService';

export class WalletPayoutService {
  private async withTx<T>(tx: TransactionContext | undefined, work: (executor: TransactionContext) => Promise<T>): Promise<T> {
    if (tx) return work(tx);
    return db.transaction(work);
  }

  async createBankAccount(userId: number, input: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    isDefault?: boolean;
  }) {
    return walletRepository.createBankAccount({ userId, ...input });
  }

  async listBankAccounts(userId: number) {
    return walletRepository.listBankAccounts(userId);
  }

  async createRequest(userId: number, input: {
    requestType: WalletPayoutType;
    amount: string | number;
    bankAccountId: number;
    withdrawalPin: string;
    clientRequestId: string;
  }): Promise<WalletPayoutRequestRecord> {
    const amount = parseWalletAmount(input.amount);
    const sameRequest = (request: WalletPayoutRequestRecord) =>
      request.requestType === input.requestType &&
      request.amount === amount.value &&
      request.bankAccountId === input.bankAccountId;

    // Replays return the original request without re-checking the PIN (§3.4 step 2).
    const existing = await walletRepository.findPayoutRequestByClientRequestId(
      userId,
      input.clientRequestId
    );
    if (existing) {
      if (sameRequest(existing)) return existing;
      throw new AppError(
        'WALLET_PAYOUT_IDEMPOTENCY_CONFLICT',
        409,
        'This clientRequestId was already used with different payout details'
      );
    }

    // PIN verification commits its own counter update before the main transaction,
    // so a failed payout never rolls back a wrong-attempt increment.
    const { pinVersion } = await withdrawalPinService.verifyForPayout(userId, input.withdrawalPin);
    const payoutConfig = await financeConfig.getPayoutConfig();

    try {
      return await db.transaction(async tx => {
        const replay = await walletRepository.findPayoutRequestByClientRequestId(
          userId,
          input.clientRequestId,
          tx,
          true
        );
        if (replay) {
          if (sameRequest(replay)) return replay;
          throw new AppError(
            'WALLET_PAYOUT_IDEMPOTENCY_CONFLICT',
            409,
            'This clientRequestId was already used with different payout details'
          );
        }

        await withdrawalPinService.assertPinUnchanged(userId, pinVersion, tx);

        const bank = await walletRepository.findBankAccount(input.bankAccountId, tx);
        if (!bank) throw new NotFoundError('Bank account not found', 'WALLET_BANK_ACCOUNT_NOT_FOUND');
        if (bank.userId !== userId) throw new ForbiddenError('You do not own this bank account', 'WALLET_BANK_ACCOUNT_FORBIDDEN');

        await userRepository.lockUsersAscending([userId], tx);
        const request = await walletRepository.createPayoutRequest({
          userId,
          requestType: input.requestType,
          amount: amount.value,
          bankAccountId: input.bankAccountId,
          clientRequestId: input.clientRequestId,
        }, tx);

        const held = await walletService.hold({
          userId,
          amount: amount.value,
          referenceType: input.requestType,
          referenceId: request.id,
          idempotencyKey: `payout-hold:${request.id}`,
        }, tx);
        const withHold = await walletRepository.setPayoutHold(request.id, held.hold.id, tx);
        if (payoutConfig.autoApprovePayouts) {
          const approved = await walletRepository.updatePayoutStatus(request.id, 'APPROVED', {
            adminNote: 'Auto-approved for sandbox payout testing',
          }, tx);
          await notifyPayoutOwner(tx, approved.id, {
            type: 'OWNER_PAYOUT_APPROVED',
            title: 'Yêu cầu chi trả đã được duyệt',
            content: `Yêu cầu chi trả #${approved.id} với số tiền ${Number(approved.amount).toLocaleString('vi-VN')}đ đã được duyệt và đang chờ chuyển khoản.`,
            resource: { type: 'OWNER_PAYOUT', id: approved.id },
            dedupKey: `owner-payout:${approved.id}:approved`,
          });
          return approved;
        }
        await notifyAdmins(tx, {
          type: 'ADMIN_PAYOUT_PENDING',
          title: input.requestType === 'OWNER_PAYOUT' ? 'Yêu cầu chi trả chủ sân chờ duyệt' : 'Yêu cầu rút ví chờ duyệt',
          content: `${input.requestType === 'OWNER_PAYOUT' ? 'Chủ sân' : 'Người chơi'} #${userId} yêu cầu ${Number(amount.value).toLocaleString('vi-VN')}đ, mã #${request.id}, đang chờ Admin xử lý.`,
          resource: { type: 'ADMIN_PAYOUT', id: request.id },
          dedupKey: `admin-payout:${request.id}`,
        });
        return withHold;
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        const replay = await walletRepository.findPayoutRequestByClientRequestId(
          userId,
          input.clientRequestId
        );
        if (replay && sameRequest(replay)) return replay;
        throw new AppError(
          'WALLET_PAYOUT_IDEMPOTENCY_CONFLICT',
          409,
          'This clientRequestId was already used with different payout details'
        );
      }
      throw err;
    }
  }

  async listMine(userId: number): Promise<WalletPayoutRequestRecord[]> {
    return walletRepository.listPayoutRequestsByUser(userId);
  }

  async listAdmin(status?: WalletPayoutRequestRecord['status']): Promise<WalletPayoutRequestRecord[]> {
    return walletRepository.listPayoutRequests(status ?? undefined);
  }

  async approve(id: number, adminId: number, note?: string, tx?: TransactionContext): Promise<WalletPayoutRequestRecord> {
    return this.withTx(tx, async executor => {
      const request = await walletRepository.findPayoutRequest(id, executor, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'APPROVED' || request.status === 'PAID') return request;
      if (request.status !== 'PENDING') {
        throw new AppError('WALLET_PAYOUT_NOT_APPROVABLE', 409, 'Payout request is not pending');
      }
      await userRepository.lockUsersAscending([request.userId], executor);
      const approved = await walletRepository.updatePayoutStatus(id, 'APPROVED', { adminId, adminNote: note ?? null }, executor);
      await notifyPayoutOwner(executor, approved.id, {
        type: 'OWNER_PAYOUT_APPROVED',
        title: 'Yêu cầu chi trả đã được duyệt',
        content: `Yêu cầu chi trả #${approved.id} với số tiền ${Number(approved.amount).toLocaleString('vi-VN')}đ đã được duyệt và đang chờ chuyển khoản.`,
        resource: { type: 'OWNER_PAYOUT', id: approved.id },
        dedupKey: `owner-payout:${approved.id}:approved`,
      });
      return approved;
    });
  }

  async reject(id: number, adminId: number, note: string, tx?: TransactionContext): Promise<WalletPayoutRequestRecord> {
    return this.withTx(tx, async executor => {
      const request = await walletRepository.findPayoutRequest(id, executor, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'REJECTED') return request;
      if (request.status === 'PAID') throw new AppError('WALLET_PAYOUT_ALREADY_PAID', 409, 'Payout was already paid');
      await userRepository.lockUsersAscending([request.userId], executor);
      if (request.holdId) await walletService.releaseHold(request.holdId, executor);
      const rejected = await walletRepository.updatePayoutStatus(id, 'REJECTED', { adminId, adminNote: note }, executor);
      await notifyPayoutOwner(executor, rejected.id, {
        type: 'OWNER_PAYOUT_REJECTED',
        title: 'Yêu cầu chi trả bị từ chối',
        content: `Yêu cầu chi trả #${rejected.id} với số tiền ${Number(rejected.amount).toLocaleString('vi-VN')}đ đã bị từ chối.`,
        resource: { type: 'OWNER_PAYOUT', id: rejected.id },
        dedupKey: `owner-payout:${rejected.id}:rejected`,
      });
      return rejected;
    });
  }

  async markPaid(id: number, adminId: number, transferReference: string, tx?: TransactionContext): Promise<WalletPayoutRequestRecord> {
    if (!transferReference.trim()) {
      throw new AppError('WALLET_PAYOUT_REFERENCE_REQUIRED', 400, 'Bank transfer reference is required');
    }
    return this.withTx(tx, async executor => {
      const request = await walletRepository.findPayoutRequest(id, executor, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'PAID') return request;
      if (request.status !== 'APPROVED') {
        throw new AppError('WALLET_PAYOUT_NOT_APPROVED', 409, 'Payout must be approved before marking paid');
      }
      if (!request.holdId) throw new AppError('WALLET_PAYOUT_HOLD_MISSING', 409, 'Payout hold is missing');

      await userRepository.lockUsersAscending([request.userId], executor);
      await walletService.captureHold(request.holdId, {
        entryType: request.requestType === 'OWNER_PAYOUT' ? 'PAYOUT' : 'WITHDRAWAL',
        idempotencyKey: `payout-capture:${request.id}`,
      }, executor);
      const paid = await walletRepository.updatePayoutStatus(id, 'PAID', {
        adminId,
        transferReference: transferReference.trim(),
      }, executor);
      await notifyPayoutOwner(executor, paid.id, {
        type: 'OWNER_PAYOUT_PAID',
        title: 'Yêu cầu chi trả đã được chuyển khoản',
        content: `Yêu cầu chi trả #${paid.id} với số tiền ${Number(paid.amount).toLocaleString('vi-VN')}đ đã được chuyển khoản.`,
        resource: { type: 'OWNER_PAYOUT', id: paid.id },
        dedupKey: `owner-payout:${paid.id}:paid`,
      });
      return paid;
    });
  }

  async adminCredit(userId: number, adminId: number, amount: string | number, reason: string) {
    return walletService.adminCredit({ userId, adminId, amount, description: reason });
  }

  async adminDebit(userId: number, adminId: number, amount: string | number, reason: string) {
    return walletService.adminDebit({ userId, adminId, amount, description: reason });
  }
}

export const walletPayoutService = new WalletPayoutService();
