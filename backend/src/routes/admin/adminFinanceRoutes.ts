import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { adminFinanceController } from '../../controllers/admin/AdminFinanceController';
import {
  auditQuerySchema,
  bookingIdParamSchema,
  exportParamSchema,
  exportQuerySchema,
  financeAdjustmentBodySchema,
  financeRangeQuerySchema,
  financeUserParamSchema,
  manualMatchBodySchema,
  ownerEarningReversalBodySchema,
  ownerEarningSweepBodySchema,
  ownerEarningsQuerySchema,
  payoutActionBodySchema,
  payoutIdParamSchema,
  payoutListQuerySchema,
  reconciliationKeyParamSchema,
  reconciliationQuerySchema,
  reconciliationResolveBodySchema,
  refundListQuerySchema,
  refundParamSchema,
  refundResolveBodySchema,
  reportQuerySchema,
  topUpIdParamSchema,
  topUpListQuerySchema,
  transactionParamSchema,
  transactionQuerySchema,
  walletEntriesQuerySchema,
  walletHoldsQuerySchema,
} from '../../validation/admin-finance';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/overview', validate({ query: financeRangeQuerySchema }), adminFinanceController.overview);

router.get('/transactions', validate({ query: transactionQuerySchema }), adminFinanceController.transactions);
router.get('/transactions/:source/:id', validate({ params: transactionParamSchema }), adminFinanceController.transactionDetail);

router.get('/wallets/:userId', validate({ params: financeUserParamSchema }), adminFinanceController.wallet);
router.get('/wallets/:userId/entries', validate({ params: financeUserParamSchema, query: walletEntriesQuerySchema }), adminFinanceController.walletEntries);
router.get('/wallets/:userId/holds', validate({ params: financeUserParamSchema, query: walletHoldsQuerySchema }), adminFinanceController.walletHolds);
router.post('/wallets/:userId/credit', validate({ params: financeUserParamSchema, body: financeAdjustmentBodySchema }), adminFinanceController.credit);
router.post('/wallets/:userId/debit', validate({ params: financeUserParamSchema, body: financeAdjustmentBodySchema }), adminFinanceController.debit);

router.get('/top-ups', validate({ query: topUpListQuerySchema }), adminFinanceController.topUps);
router.get('/top-ups/:id', validate({ params: topUpIdParamSchema }), adminFinanceController.topUp);
router.post('/top-ups/:id/manual-match', validate({ params: topUpIdParamSchema, body: manualMatchBodySchema }), adminFinanceController.manualMatch);

router.get('/payouts', validate({ query: payoutListQuerySchema }), adminFinanceController.payouts);
router.get('/payouts/:id', validate({ params: payoutIdParamSchema }), adminFinanceController.payout);
router.post('/payouts/:id/approve', validate({ params: payoutIdParamSchema, body: payoutActionBodySchema }), adminFinanceController.approvePayout);
router.post('/payouts/:id/reject', validate({ params: payoutIdParamSchema, body: payoutActionBodySchema }), adminFinanceController.rejectPayout);
router.post('/payouts/:id/paid', validate({ params: payoutIdParamSchema, body: payoutActionBodySchema }), adminFinanceController.markPayoutPaid);

router.get('/refunds', validate({ query: refundListQuerySchema }), adminFinanceController.refunds);
router.get('/refunds/:paymentId', validate({ params: refundParamSchema }), adminFinanceController.refund);
router.post('/refunds/:paymentId/retry', validate({ params: refundParamSchema }), adminFinanceController.retryRefund);
router.post('/refunds/:paymentId/resolve-note', validate({ params: refundParamSchema, body: refundResolveBodySchema }), adminFinanceController.resolveRefund);

router.get('/owner-earnings', validate({ query: ownerEarningsQuerySchema }), adminFinanceController.ownerEarnings);
router.post('/owner-earnings/sweep', validate({ body: ownerEarningSweepBodySchema }), adminFinanceController.ownerEarningSweep);
router.post('/owner-earnings/:bookingId/reverse', validate({ params: bookingIdParamSchema, body: ownerEarningReversalBodySchema }), adminFinanceController.reverseOwnerEarning);

router.get('/reconciliation', validate({ query: reconciliationQuerySchema }), adminFinanceController.reconciliation);
router.post(
  '/reconciliation/discrepancies/:key/resolve',
  validate({ params: reconciliationKeyParamSchema, body: reconciliationResolveBodySchema }),
  adminFinanceController.resolveReconciliation,
);

router.get('/reports/cash-flow', validate({ query: financeRangeQuerySchema }), adminFinanceController.cashFlow);
router.get('/reports/revenue', validate({ query: reportQuerySchema }), adminFinanceController.revenue);

router.get('/exports/:type', validate({ params: exportParamSchema, query: exportQuerySchema }), adminFinanceController.exportData);

router.get('/audit', validate({ query: auditQuerySchema }), adminFinanceController.audit);

router.post('/jobs/owner-earnings/run', validate({ body: ownerEarningSweepBodySchema }), adminFinanceController.ownerEarningSweep);

export default router;
