import { Router } from 'express';
import { matchController } from '../../controllers/matchmaking/MatchController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listMatchesQuerySchema,
  linkMatchBookingBodySchema,
  matchIdParamSchema,
  matchBookingPreviewQuerySchema,
  createMatchSplitBookingBodySchema,
  remindTopupBodySchema,
} from '../../validation/matchmaking';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.get('/', validate({ query: listMatchesQuerySchema }), matchController.listMine);

router.get('/:id/booking-candidates', validate({ params: matchIdParamSchema }), matchController.bookingCandidates);

router.get('/:id', validate({ params: matchIdParamSchema }), matchController.detail);

router.post('/:id/leave', validate({ params: matchIdParamSchema }), matchController.leave);

router.post(
  '/:id/booking',
  validate({ params: matchIdParamSchema, body: linkMatchBookingBodySchema }),
  matchController.linkBooking,
);

router.get(
  '/:id/booking/preview',
  validate({ params: matchIdParamSchema, query: matchBookingPreviewQuerySchema }),
  matchController.bookingPreview,
);

router.post(
  '/:id/booking/create',
  validate({ params: matchIdParamSchema, body: createMatchSplitBookingBodySchema }),
  matchController.createSplitBooking,
);

router.post(
  '/:id/booking/remind-topup',
  validate({ params: matchIdParamSchema, body: remindTopupBodySchema }),
  matchController.remindTopup,
);

export default router;
