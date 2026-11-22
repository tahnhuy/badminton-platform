import { Request, Response, NextFunction } from 'express';
import { NotFoundError, UnauthorizedError } from '../../errors/AppError';
import { db } from '../../db';
import { walletService } from '../../services/payments/WalletService';
import { walletPayoutService } from '../../services/payments/WalletPayoutService';
import { adminRefundService } from '../../services/payments/AdminRefundService';
import { financeAuditService } from '../../services/finance/FinanceAuditService';
import { financeQueryService } from '../../services/finance/FinanceQueryService';
import { financeExportService, FinanceExportQuery, FinanceExportType } from '../../services/finance/FinanceExportService';
import { financeTopUpService } from '../../services/finance/FinanceTopUpService';
import { ownerEarningService } from '../../services/finance/OwnerEarningService';
import { reconciliationService } from '../../services/finance/ReconciliationService';

function adminId(req: Request): number {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  return req.user.id;
}

function auditDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00+07:00`) : undefined;
}

function auditEndDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T23:59:59.999+07:00`) : undefined;
}

function dayStart(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00+07:00`) : undefined;
}

function dayEnd(value?: string): Date | undefined {
  return value ? new Date(`${value}T23:59:59.999+07:00`) : undefined;
}

export class AdminFinanceController {
  overview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await financeQueryService.overview(req.query) });
    } catch (err) { next(err); }
  };

  transactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      res.status(200).json(await financeQueryService.transactions(query));
    } catch (err) { next(err); }
  };

  transactionDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { source, id } = req.params as unknown as { source: string; id: number };
      res.status(200).json({ data: await financeQueryService.transactionDetail(source, id) });
    } catch (err) { next(err); }
  };

  wallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      res.status(200).json({ data: await financeQueryService.wallet(userId) });
    } catch (err) { next(err); }
  };

  walletEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      res.status(200).json(await financeQueryService.walletEntries(userId, page, limit));
    } catch (err) { next(err); }
  };

  walletHolds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
      res.status(200).json(await financeQueryService.walletHolds(userId, status, page, limit));
    } catch (err) { next(err); }
  };

  credit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { userId } = req.params as unknown as { userId: number };
      const { amount, reason } = req.body as { amount: string; reason: string };
      const result = await db.transaction(async tx => {
        const credited = await walletService.adminCredit({ userId, amount, description: reason, adminId: actorId }, tx);
        await financeAuditService.record({
          actorId,
          action: 'WALLET_CREDIT',
          entityType: 'WALLET',
          entityId: userId,
          metadata: { amount, reason },
        }, tx);
        return credited;
      });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  debit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { userId } = req.params as unknown as { userId: number };
      const { amount, reason } = req.body as { amount: string; reason: string };
      const result = await db.transaction(async tx => {
        const debited = await walletService.adminDebit({ userId, amount, description: reason, adminId: actorId }, tx);
        await financeAuditService.record({
          actorId,
          action: 'WALLET_DEBIT',
          entityType: 'WALLET',
          entityId: userId,
          metadata: { amount, reason },
        }, tx);
        return debited;
      });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  topUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await financeQueryService.topUps(req.query as any));
    } catch (err) { next(err); }
  };

  topUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await financeQueryService.topUp(id) });
    } catch (err) { next(err); }
  };

  manualMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const body = req.body as any;
      const topUp = await financeTopUpService.manualMatch({ ...body }, actorId);
      res.status(200).json({ data: topUp, meta: { requestedTopUpId: id } });
    } catch (err) { next(err); }
  };

  payouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await financeQueryService.payouts(req.query as any));
    } catch (err) { next(err); }
  };

  payout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await financeQueryService.payout(id) });
    } catch (err) { next(err); }
  };

  approvePayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const { note } = req.body as { note?: string };
      const result = await db.transaction(async tx => {
        const updated = await walletPayoutService.approve(id, actorId, note, tx);
        await financeAuditService.record({ actorId, action: 'PAYOUT_APPROVE', entityType: 'PAYOUT', entityId: id, metadata: { note: note ?? null } }, tx);
        return updated;
      });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  rejectPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const { note } = req.body as { note?: string };
      const result = await db.transaction(async tx => {
        const updated = await walletPayoutService.reject(id, actorId, note || 'Rejected by Admin', tx);
        await financeAuditService.record({ actorId, action: 'PAYOUT_REJECT', entityType: 'PAYOUT', entityId: id, metadata: { note: note ?? 'Rejected by Admin' } }, tx);
        return updated;
      });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  markPayoutPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const { transferReference } = req.body as { transferReference?: string };
      const result = await db.transaction(async tx => {
        const updated = await walletPayoutService.markPaid(id, actorId, transferReference || '', tx);
        await financeAuditService.record({ actorId, action: 'PAYOUT_MARK_PAID', entityType: 'PAYOUT', entityId: id, metadata: { transferReference: transferReference ?? null } }, tx);
        return updated;
      });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  refunds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await financeQueryService.refunds(req.query as any));
    } catch (err) { next(err); }
  };

  refund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentId } = req.params as unknown as { paymentId: number };
      res.status(200).json({ data: await financeQueryService.refund(paymentId) });
    } catch (err) { next(err); }
  };

  retryRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { paymentId } = req.params as unknown as { paymentId: number };
      const result = await adminRefundService.retry(paymentId);
      await financeAuditService.record({ actorId, action: 'REFUND_RETRY', entityType: 'REFUND', entityId: paymentId, metadata: { status: result?.status ?? null } });
      res.status(200).json({ data: result });
    } catch (err) { next(err); }
  };

  resolveRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { paymentId } = req.params as unknown as { paymentId: number };
      const { note } = req.body as { note: string };
      await financeAuditService.record({ actorId, action: 'REFUND_RESOLVE', entityType: 'REFUND', entityId: paymentId, metadata: { note } });
      res.status(200).json({ data: { paymentId, note } });
    } catch (err) { next(err); }
  };

  ownerEarnings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await financeQueryService.ownerEarnings(req.query as any));
    } catch (err) { next(err); }
  };

  ownerEarningSweep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const body = req.body as any;
      res.status(200).json({ data: await ownerEarningService.sweep({ ...body, actorId }) });
    } catch (err) { next(err); }
  };

  reverseOwnerEarning = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { bookingId } = req.params as unknown as { bookingId: number };
      const { reason } = req.body as { reason: string };
      res.status(200).json({ data: await ownerEarningService.reverse(bookingId, actorId, reason) });
    } catch (err) { next(err); }
  };

  ownerEarningSettlements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const { rows, total } = await ownerEarningService.listSettlements({
        status: query.status,
        ownerId: query.ownerId,
        from: dayStart(query.from),
        to: dayEnd(query.to),
        page: query.page,
        limit: query.limit,
      });
      res.status(200).json({
        data: rows,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: query.limit > 0 ? Math.ceil(total / query.limit) : 0,
        },
      });
    } catch (err) { next(err); }
  };

  ownerEarningSettlementDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const settlement = await ownerEarningService.getSettlement(id);
      if (!settlement) throw new NotFoundError('Owner earning settlement not found', 'FINANCE_OWNER_EARNING_NOT_FOUND');
      res.status(200).json({ data: settlement });
    } catch (err) { next(err); }
  };

  approveOwnerEarningSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const { note } = req.body as { note?: string };
      res.status(200).json({ data: await ownerEarningService.approve(id, actorId, note) });
    } catch (err) { next(err); }
  };

  rejectOwnerEarningSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { id } = req.params as unknown as { id: number };
      const { reason } = req.body as { reason: string };
      res.status(200).json({ data: await ownerEarningService.reject(id, actorId, reason) });
    } catch (err) { next(err); }
  };

  reconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await reconciliationService.run(req.query) });
    } catch (err) { next(err); }
  };

  resolveReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { key: keyParam } = req.params as unknown as { key?: string };
      const { key: keyBody, note } = req.body as { key?: string; note: string };
      const key = keyParam ?? keyBody ?? '';
      res.status(200).json({ data: await reconciliationService.resolve(key, actorId, note) });
    } catch (err) { next(err); }
  };

  cashFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await financeQueryService.cashFlow(req.query) });
    } catch (err) { next(err); }
  };

  revenue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await financeQueryService.revenue(req.query as any) });
    } catch (err) { next(err); }
  };

  exportData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = adminId(req);
      const { type } = req.params as unknown as { type: FinanceExportType };
      const result = await financeExportService.build(type, req.query as FinanceExportQuery, actorId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(result.buffer);
    } catch (err) { next(err); }
  };

  audit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const result = await financeAuditService.list({
        action: query.action,
        actorId: query.actorId,
        entityType: query.entityType,
        entityId: query.entityId,
        from: auditDate(query.from),
        to: auditEndDate(query.to),
        page: query.page,
        limit: query.limit,
      });
      res.status(200).json(result);
    } catch (err) { next(err); }
  };
}

export const adminFinanceController = new AdminFinanceController();
