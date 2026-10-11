import { Router } from 'express';
import { facilityController } from '../../controllers/booking/FacilityController';
import { courtIdParamSchema, facilityDetailQuerySchema } from '../../validation/booking';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.get(
  '/:id',
  validate({ params: courtIdParamSchema, query: facilityDetailQuerySchema }),
  facilityController.getFacility
);

export default router;
