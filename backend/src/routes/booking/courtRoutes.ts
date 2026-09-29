import { Router } from 'express';
import {
  courtController,
  courtIdParamSchema,
  courtSearchQuerySchema,
  courtAvailabilityQuerySchema,
} from '../../controllers/booking/CourtController';
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
