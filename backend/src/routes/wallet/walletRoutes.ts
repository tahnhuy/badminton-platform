import { Router } from 'express';
import { walletController } from '../../controllers/wallet/WalletController';
import {
  createTopUpBodySchema,
  topUpIdParamSchema,
  bankAccountBodySchema,
  payoutRequestBodySchema,
  walletEntriesQuerySchema,
} from '../../validation/wallet';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate);

router.get('/', walletController.wallet);
router.get('/entries', validate({ query: walletEntriesQuerySchema }), walletController.entries);
router.post('/top-ups', validate({ body: createTopUpBodySchema }), walletController.createTopUp);
router.post('/top-ups/:id/mock-confirm', validate({ params: topUpIdParamSchema }), walletController.mockConfirmTopUp);

router.get('/bank-accounts', walletController.bankAccounts);
router.post('/bank-accounts', validate({ body: bankAccountBodySchema }), walletController.createBankAccount);
router.get('/payouts', walletController.payouts);
router.post('/withdrawals', requireRole('PLAYER'), validate({ body: payoutRequestBodySchema }), walletController.createWithdrawal);
router.post('/owner-payouts', requireRole('COURT_OWNER'), validate({ body: payoutRequestBodySchema }), walletController.createOwnerPayout);

export default router;
