import { Router } from 'express';
import { bookingController } from '../../controllers/booking/BookingController';
import { paymentController } from '../../controllers/payments/PaymentController';
import {
  bookingIdParamSchema,
  createBookingBodySchema,
  myBookingsQuerySchema,
} from '../../validation/booking';
import { initiateBookingPaymentBodySchema } from '../../validation/payment';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.post(
  '/',
  validate({ body: createBookingBodySchema }),
  bookingController.create
);

router.get(
  '/my-bookings',
  validate({ query: myBookingsQuerySchema }),
  bookingController.listMine
);

router.get(
  '/:id',
  validate({ params: bookingIdParamSchema }),
  bookingController.detail
);

router.post(
  '/:id/cancel',
  validate({ params: bookingIdParamSchema }),
  bookingController.cancel
);

router.post(
  '/:id/payment',
  validate({ params: bookingIdParamSchema, body: initiateBookingPaymentBodySchema }),
  paymentController.createBookingPayment
);

export default router;
