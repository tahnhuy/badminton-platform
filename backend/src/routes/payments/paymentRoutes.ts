import { Router } from 'express';
import { paymentController } from '../../controllers/payments/PaymentController';
import {
  mockConfirmPaymentBodySchema,
  paymentIdParamSchema,
} from '../../validation/payment';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate);

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
