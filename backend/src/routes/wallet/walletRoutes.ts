import { Router } from 'express';
import { walletController } from '../../controllers/wallet/WalletController';
import {
  createTopUpBodySchema,
  topUpIdParamSchema,
  bankAccountBodySchema,
  payoutRequestBodySchema,
  withdrawalPinResetBodySchema,
  walletEntriesQuerySchema,
} from '../../validation/wallet';
import { challengeIdSchema, challengeOtpSchema } from '../../validation/auth';
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
router.get('/withdrawal-pin', walletController.withdrawalPinStatus);
router.post('/withdrawal-pin/reset/request', walletController.requestWithdrawalPinReset);
router.post('/withdrawal-pin/reset/verify', validate({ body: challengeOtpSchema }), walletController.verifyWithdrawalPinReset);
router.post('/withdrawal-pin/reset/resend', validate({ body: challengeIdSchema }), walletController.resendWithdrawalPinOtp);
router.post('/withdrawal-pin/reset', validate({ body: withdrawalPinResetBodySchema }), walletController.resetWithdrawalPin);

router.get('/payouts', walletController.payouts);
router.post('/withdrawals', requireRole('PLAYER'), validate({ body: payoutRequestBodySchema }), walletController.createWithdrawal);
router.post('/owner-payouts', requireRole('COURT_OWNER'), validate({ body: payoutRequestBodySchema }), walletController.createOwnerPayout);

export default router;
