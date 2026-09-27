import { Router } from 'express';
import {
  adminFacilityController,
  listFacilitiesQuerySchema,
  facilityIdParamSchema,
  courtParamsSchema,
  updateFacilityStatusBodySchema,
  createFacilityBodySchema,
} from '../../controllers/admin/AdminFacilityController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.post(
  '/',
  validate({ body: createFacilityBodySchema }),
  adminFacilityController.createFacility
);

router.get(
  '/',
  validate({ query: listFacilitiesQuerySchema }),
  adminFacilityController.listFacilities
);

router.get(
  '/:id',
  validate({ params: facilityIdParamSchema }),
  adminFacilityController.getFacilityById
);

router.patch(
  '/:id',
  validate({ params: facilityIdParamSchema, body: updateFacilityStatusBodySchema }),
  adminFacilityController.updateStatus
);

router.delete(
  '/:id',
  validate({ params: facilityIdParamSchema }),
  adminFacilityController.softDelete
);

router.patch(
  '/:facilityId/courts/:courtId',
  validate({ params: courtParamsSchema, body: updateFacilityStatusBodySchema }),
  adminFacilityController.updateCourtStatus
);

router.delete(
  '/:facilityId/courts/:courtId',
  validate({ params: courtParamsSchema }),
  adminFacilityController.deleteCourt
);

export default router;
