import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/AppError';
import { walletService } from '../../services/payments/WalletService';
import { walletTopUpService } from '../../services/payments/WalletTopUpService';
import { walletPayoutService } from '../../services/payments/WalletPayoutService';
import { withdrawalPinService } from '../../services/wallet/WithdrawalPinService';
import { authService } from '../../services/auth/AuthService';

export class WalletController {
  private actorId(req: Request): number {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    return req.user.id;
  }

  wallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await walletService.getWallet(this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };

  createTopUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { amount: string; provider?: string; idempotencyKey?: string };
      const result = await walletTopUpService.createTopUp({
        userId: this.actorId(req),
        amount: body.amount,
        provider: body.provider,
        idempotencyKey: body.idempotencyKey,
        ipAddress: req.ip,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  bankAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await walletPayoutService.listBankAccounts(this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };

  createBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { bankCode: string; accountNumber: string; accountName: string; isDefault?: boolean };
      res.status(201).json({ data: await walletPayoutService.createBankAccount(this.actorId(req), body) });
    } catch (err) {
      next(err);
    }
  };

  createWithdrawal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { amount: string; bankAccountId: number; withdrawalPin: string; clientRequestId: string };
      res.status(201).json({
        data: await walletPayoutService.createRequest(this.actorId(req), {
          requestType: 'WITHDRAWAL',
          amount: body.amount,
          bankAccountId: body.bankAccountId,
          withdrawalPin: body.withdrawalPin,
          clientRequestId: body.clientRequestId,
        }),
      });
    } catch (err) {
      next(err);
    }
  };

  createOwnerPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { amount: string; bankAccountId: number; withdrawalPin: string; clientRequestId: string };
      res.status(201).json({
        data: await walletPayoutService.createRequest(this.actorId(req), {
          requestType: 'OWNER_PAYOUT',
          amount: body.amount,
          bankAccountId: body.bankAccountId,
          withdrawalPin: body.withdrawalPin,
          clientRequestId: body.clientRequestId,
        }),
      });
    } catch (err) {
      next(err);
    }
  };

  withdrawalPinStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await withdrawalPinService.getStatus(this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };

  requestWithdrawalPinReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await authService.requestWithdrawalPinReset(this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };

  verifyWithdrawalPinReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        data: await authService.verifyWithdrawalPinReset(this.actorId(req), req.body),
      });
    } catch (err) {
      next(err);
    }
  };

  resetWithdrawalPin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { resetToken: string; newPin: string };
      await authService.resetWithdrawalPin(this.actorId(req), body.resetToken, body.newPin);
      res.status(200).json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  };

  resendWithdrawalPinOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        data: await authService.resendWithdrawalPinOtp(this.actorId(req), req.body),
      });
    } catch (err) {
      next(err);
    }
  };

  payouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await walletPayoutService.listMine(this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };

  entries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await walletService.listEntryHistory(this.actorId(req), { page, limit });
      res.status(200).json({
        data: result.items.map(entry => ({
          id: entry.id,
          entryType: entry.entryType,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          description: entry.description,
          createdAt: entry.createdAt,
        })),
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  };

  mockConfirmTopUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await walletTopUpService.mockConfirm(id, this.actorId(req)) });
    } catch (err) {
      next(err);
    }
  };
}

export const walletController = new WalletController();
