import { Router } from 'express';
import { courtController } from '../../controllers/booking/CourtController';
import {
  courtIdParamSchema,
  courtSearchQuerySchema,
  courtAvailabilityQuerySchema,
} from '../../validation/booking';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.get(
  '/',
  validate({ query: courtSearchQuerySchema }),
  courtController.searchCourts
);

router.get(
  '/:id/availability',
  validate({ params: courtIdParamSchema, query: courtAvailabilityQuerySchema }),
  courtController.getAvailability
);

export default router;
