import { Router } from 'express';
import { ratingController } from '../../controllers/ratings/RatingController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listRatingsQuerySchema,
  ratingUserIdParamSchema,
  skillAdjustmentListQuerySchema,
} from '../../validation/ratings';

const router = Router();

router.use(authenticate);

router.get(
  '/:userId/ratings/summary',
  requireRole('PLAYER', 'ADMIN'),
  validate({ params: ratingUserIdParamSchema }),
  ratingController.summary
);

router.get(
  '/:userId/ratings',
  requireRole('PLAYER', 'ADMIN'),
  validate({ params: ratingUserIdParamSchema, query: listRatingsQuerySchema }),
  ratingController.list
);

router.get(
  '/:userId/skill-adjustments',
  requireRole('ADMIN'),
  validate({ params: ratingUserIdParamSchema, query: skillAdjustmentListQuerySchema }),
  ratingController.skillAdjustments
);

export default router;
