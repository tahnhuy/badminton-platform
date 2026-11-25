import { adminHandoverRoutes } from '../owner/facilityHandoverRoutes';
import { z } from 'zod';
import { ownerPage, ownerIdParams } from '../../validation/owner';
import { facilityReviewQueueQuerySchema } from '../../validation/admin';
import { facilityReviewController as reviews } from '../../controllers/admin/FacilityReviewController';
import { Router } from 'express';
import {
  adminFacilityController,
  listFacilitiesQuerySchema,
  facilityIdParamSchema,
  courtParamsSchema,
  updateFacilityStatusBodySchema,
  createFacilityBodySchema,
  updateCourtProfileBodySchema,
} from '../../controllers/admin/AdminFacilityController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));
router.use('/handovers', adminHandoverRoutes);

router.get('/reviews/pending-count', reviews.pendingCount());

router.get(
  '/reviews',
  validate({ query: facilityReviewQueueQuerySchema }),
  reviews.queue()
);

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

router.patch(
  '/:facilityId/courts/:courtId/profile',
  validate({ params: courtParamsSchema, body: updateCourtProfileBodySchema }),
  adminFacilityController.updateCourtProfile
);

router.get(
  '/:facilityId/courts/:courtId/profile-changes',
  validate({ params: courtParamsSchema, query: ownerPage }),
  adminFacilityController.courtProfileHistory
);

router.delete(
  '/:facilityId/courts/:courtId',
  validate({ params: courtParamsSchema }),
  adminFacilityController.deleteCourt
);

const identifier = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const courtReviewParams = z.object({ facilityId: identifier, courtId: identifier });
const addressReviewParams = z.object({ id: identifier, reviewId: identifier });
for (const approve of [true, false]) {
  const action = approve ? 'approve' : 'reject';
  const reason = approve ? z.string().trim().min(1).optional() : z.string().trim().min(1);
  const decision = z.object({ reviewId: z.number().int().positive(), reason }).strict();
  router.post(`/:id/${action}`, validate({ params: ownerIdParams, body: decision }), reviews.decide(approve, 'ONBOARDING'));
  router.post(`/:facilityId/courts/:courtId/${action}`, validate({ params: courtReviewParams, body: decision }), reviews.decide(approve, 'ONBOARDING', true));
  router.post(`/:id/address-change-requests/:reviewId/${action}`, validate({ params: addressReviewParams, body: z.object({ reason }).strict() }), reviews.decide(approve, 'ADDRESS_CHANGE'));
}
router.get('/:id/reviews', validate({ params: ownerIdParams, query: ownerPage }), reviews.history());
router.get('/:facilityId/courts/:courtId/reviews', validate({ params: courtReviewParams, query: ownerPage }), reviews.history(true));

export default router;
