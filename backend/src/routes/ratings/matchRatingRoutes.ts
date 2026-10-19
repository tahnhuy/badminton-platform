import { Router } from 'express';
import { ratingController } from '../../controllers/ratings/RatingController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createRatingsBodySchema, ratingMatchIdParamSchema } from '../../validation/ratings';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.post(
  '/:matchId/ratings',
  validate({ params: ratingMatchIdParamSchema, body: createRatingsBodySchema }),
  ratingController.createRatings
);

router.get(
  '/:matchId/ratings/pending',
  validate({ params: ratingMatchIdParamSchema }),
  ratingController.pending
);

export default router;
