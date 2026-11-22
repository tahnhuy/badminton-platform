import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/AppError';
import { walletPayoutService } from '../../services/payments/WalletPayoutService';
import { walletService } from '../../services/payments/WalletService';
import { adminRefundService } from '../../services/payments/AdminRefundService';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

function adminId(req: Request): number {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  return req.user.id;
}

export class AdminWalletController {
  listPayouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.query as { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED' };
      res.status(200).json({ data: await walletPayoutService.listAdmin(status) });
    } catch (err) {
      next(err);
    }
  };

  listRefunds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status?: 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED'; page: number; limit: number;
      };
      res.status(200).json(await adminRefundService.list({ status, page, limit }));
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { note } = req.body as { note?: string };
      res.status(200).json({ data: await walletPayoutService.approve(id, adminId(req), note) });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { note } = req.body as { note?: string };
      res.status(200).json({ data: await walletPayoutService.reject(id, adminId(req), note || 'Rejected by Admin') });
    } catch (err) {
      next(err);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { transferReference } = req.body as { transferReference?: string };
      res.status(200).json({ data: await walletPayoutService.markPaid(id, adminId(req), transferReference || '') });
    } catch (err) {
      next(err);
    }
  };

  credit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const { amount, reason } = req.body as { amount: string; reason: string };
      res.status(200).json({ data: await walletPayoutService.adminCredit(userId, adminId(req), amount, reason) });
    } catch (err) {
      next(err);
    }
  };

  debit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const { amount, reason } = req.body as { amount: string; reason: string };
      res.status(200).json({ data: await walletPayoutService.adminDebit(userId, adminId(req), amount, reason) });
    } catch (err) {
      next(err);
    }
  };

  reconciliation = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const topUps = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'SUCCESS'), 0) AS success_amount
        FROM wallet_top_ups
      `);
      const topUpLedger = await db.execute(sql`
        SELECT COUNT(*) AS entry_count, COALESCE(SUM(amount), 0) AS entry_amount
        FROM wallet_ledger_entries WHERE entry_type = 'TOP_UP'
      `);
      const payouts = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'PAID') AS paid_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) AS paid_amount
        FROM wallet_payout_requests
      `);
      const payoutLedger = await db.execute(sql`
        SELECT COUNT(*) AS entry_count, COALESCE(SUM(-amount), 0) AS entry_amount
        FROM wallet_ledger_entries WHERE entry_type IN ('WITHDRAWAL', 'PAYOUT')
      `);
      const unmatchedTopUps = await db.execute(sql`
        SELECT t.id FROM wallet_top_ups t
        WHERE t.status = 'SUCCESS'
          AND NOT EXISTS (
            SELECT 1 FROM wallet_ledger_entries l
            WHERE l.entry_type = 'TOP_UP' AND l.reference_type = 'TOP_UP' AND l.reference_id = t.id
          )
        ORDER BY t.id LIMIT 100
      `);
      const unmatchedPayouts = await db.execute(sql`
        SELECT p.id FROM wallet_payout_requests p
        WHERE p.status = 'PAID'
          AND NOT EXISTS (
            SELECT 1 FROM wallet_ledger_entries l
            WHERE l.entry_type IN ('WITHDRAWAL', 'PAYOUT') AND l.reference_id = p.id
          )
        ORDER BY p.id LIMIT 100
      `);
      res.status(200).json({
        data: {
          topUps: topUps.rows[0],
          topUpLedger: topUpLedger.rows[0],
          payouts: payouts.rows[0],
          payoutLedger: payoutLedger.rows[0],
          unmatchedTopUpIds: unmatchedTopUps.rows.map(row => Number((row as { id: number }).id)),
          unmatchedPayoutIds: unmatchedPayouts.rows.map(row => Number((row as { id: number }).id)),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const adminWalletController = new AdminWalletController();
