import { Router } from 'express';
import { adminWalletController } from '../../controllers/admin/AdminWalletController';
import {
  adminPayoutActionBodySchema,
  adminPayoutListQuerySchema,
  adminRefundListQuerySchema,
  adminWalletAdjustBodySchema,
  adminWalletUserParamSchema,
  payoutIdParamSchema,
} from '../../validation/wallet';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/reconciliation', adminWalletController.reconciliation);
router.get('/payouts', validate({ query: adminPayoutListQuerySchema }), adminWalletController.listPayouts);
router.get('/refunds', validate({ query: adminRefundListQuerySchema }), adminWalletController.listRefunds);
router.post('/payouts/:id/approve', validate({ params: payoutIdParamSchema, body: adminPayoutActionBodySchema }), adminWalletController.approve);
router.post('/payouts/:id/reject', validate({ params: payoutIdParamSchema, body: adminPayoutActionBodySchema }), adminWalletController.reject);
router.post('/payouts/:id/paid', validate({ params: payoutIdParamSchema, body: adminPayoutActionBodySchema }), adminWalletController.markPaid);
router.post('/users/:userId/credit', validate({ params: adminWalletUserParamSchema, body: adminWalletAdjustBodySchema }), adminWalletController.credit);
router.post('/users/:userId/debit', validate({ params: adminWalletUserParamSchema, body: adminWalletAdjustBodySchema }), adminWalletController.debit);

export default router;
