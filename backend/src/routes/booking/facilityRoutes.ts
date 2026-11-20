import { Router } from 'express';
import { facilityController } from '../../controllers/booking/FacilityController';
import { courtIdParamSchema, facilityDetailQuerySchema, facilitySearchQuerySchema } from '../../validation/booking';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// Public facility-paged court search (Tech Design §9.1a).
router.get('/', validate({ query: facilitySearchQuerySchema }), facilityController.searchFacilities);

router.get(
  '/:id',
  validate({ params: courtIdParamSchema, query: facilityDetailQuerySchema }),
  facilityController.getFacility
);

export default router;
