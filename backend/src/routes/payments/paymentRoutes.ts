import { Router } from 'express';
import { paymentController } from '../../controllers/payments/PaymentController';
import {
  mockConfirmPaymentBodySchema,
  paymentIdParamSchema,
} from '../../validation/payment';
import { topUpIdParamSchema } from '../../validation/wallet';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// VNPAY IPN is provider-facing; signature verification replaces session auth/CSRF.
router.get('/vnpay/webhook', paymentController.vnpayWebhook);
router.post('/vnpay/webhook', paymentController.vnpayWebhook);
router.post('/sepay/webhook', paymentController.sepayWebhook);
router.post('/sepay/bank-webhook', paymentController.sepayBankWebhook);

router.use(authenticate);

router.get('/sepay/checkout/:id', validate({ params: topUpIdParamSchema }), paymentController.sepayCheckout);

// Mock payment confirmation endpoint
router.post(
  '/mock/confirm',
  validate({ body: mockConfirmPaymentBodySchema }),
  paymentController.mockConfirm
);

// Payment details endpoint
router.get(
  '/:id',
  validate({ params: paymentIdParamSchema }),
  paymentController.detail
);

export default router;
