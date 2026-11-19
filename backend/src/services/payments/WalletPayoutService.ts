import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import {
  walletRepository,
  WalletPayoutRequestRecord,
  WalletPayoutType,
} from '../../repositories/wallet/WalletRepository';
import { parseWalletAmount, walletService } from './WalletService';
import { notifyAdmins } from '../notifications/admin-notifications';
import { env } from '../../shared/config/env';

export class WalletPayoutService {
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
  }): Promise<WalletPayoutRequestRecord> {
    const amount = parseWalletAmount(input.amount);
    return db.transaction(async tx => {
      const bank = await walletRepository.findBankAccount(input.bankAccountId, tx);
      if (!bank) throw new NotFoundError('Bank account not found', 'WALLET_BANK_ACCOUNT_NOT_FOUND');
      if (bank.userId !== userId) throw new ForbiddenError('You do not own this bank account', 'WALLET_BANK_ACCOUNT_FORBIDDEN');

      const request = await walletRepository.createPayoutRequest({
        userId,
        requestType: input.requestType,
        amount: amount.value,
        bankAccountId: input.bankAccountId,
      }, tx);

      const held = await walletService.hold({
        userId,
        amount: amount.value,
        referenceType: input.requestType,
        referenceId: request.id,
        idempotencyKey: `payout-hold:${request.id}`,
      }, tx);
      const withHold = await walletRepository.setPayoutHold(request.id, held.hold.id, tx);
      if (env.WALLET_AUTO_APPROVE_PAYOUTS) {
        return walletRepository.updatePayoutStatus(request.id, 'APPROVED', {
          adminNote: 'Auto-approved for sandbox payout testing',
        }, tx);
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
  }

  async listMine(userId: number): Promise<WalletPayoutRequestRecord[]> {
    return walletRepository.listPayoutRequestsByUser(userId);
  }

  async listAdmin(status?: WalletPayoutRequestRecord['status']): Promise<WalletPayoutRequestRecord[]> {
    return walletRepository.listPayoutRequests(status ?? undefined);
  }

  async approve(id: number, adminId: number, note?: string): Promise<WalletPayoutRequestRecord> {
    return db.transaction(async tx => {
      const request = await walletRepository.findPayoutRequest(id, tx, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'APPROVED' || request.status === 'PAID') return request;
      if (request.status !== 'PENDING') {
        throw new AppError('WALLET_PAYOUT_NOT_APPROVABLE', 409, 'Payout request is not pending');
      }
      return walletRepository.updatePayoutStatus(id, 'APPROVED', { adminId, adminNote: note ?? null }, tx);
    });
  }

  async reject(id: number, adminId: number, note: string): Promise<WalletPayoutRequestRecord> {
    return db.transaction(async tx => {
      const request = await walletRepository.findPayoutRequest(id, tx, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'REJECTED') return request;
      if (request.status === 'PAID') throw new AppError('WALLET_PAYOUT_ALREADY_PAID', 409, 'Payout was already paid');
      if (request.holdId) await walletService.releaseHold(request.holdId, tx);
      return walletRepository.updatePayoutStatus(id, 'REJECTED', { adminId, adminNote: note }, tx);
    });
  }

  async markPaid(id: number, adminId: number, transferReference: string): Promise<WalletPayoutRequestRecord> {
    if (!transferReference.trim()) {
      throw new AppError('WALLET_PAYOUT_REFERENCE_REQUIRED', 400, 'Bank transfer reference is required');
    }
    return db.transaction(async tx => {
      const request = await walletRepository.findPayoutRequest(id, tx, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'PAID') return request;
      if (request.status !== 'APPROVED') {
        throw new AppError('WALLET_PAYOUT_NOT_APPROVED', 409, 'Payout must be approved before marking paid');
      }
      if (!request.holdId) throw new AppError('WALLET_PAYOUT_HOLD_MISSING', 409, 'Payout hold is missing');

      await walletService.captureHold(request.holdId, {
        entryType: request.requestType === 'OWNER_PAYOUT' ? 'PAYOUT' : 'WITHDRAWAL',
        idempotencyKey: `payout-capture:${request.id}`,
      }, tx);
      return walletRepository.updatePayoutStatus(id, 'PAID', {
        adminId,
        transferReference: transferReference.trim(),
      }, tx);
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
