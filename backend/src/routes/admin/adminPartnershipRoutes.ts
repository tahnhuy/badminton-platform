import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { partnershipRequestController as controller } from '../../controllers/partnership/PartnershipRequestController';
import {
  ownerRequestApproveBodySchema, ownerRequestIdParamsSchema, ownerRequestListQuerySchema,
  ownerRequestNoteBodySchema, ownerRequestRejectBodySchema,
} from '../../validation/partnership';

/** Admin queue of Court Owner partnership requests. */
const router = Router();
router.use(authenticate, requireRole('ADMIN'));

const params = ownerRequestIdParamsSchema;
router.get('/', validate({ query: ownerRequestListQuerySchema }), controller.list);
router.get('/pending-count', controller.pendingCount);
router.get('/:id', validate({ params }), controller.get);
router.patch('/:id/note', validate({ params, body: ownerRequestNoteBodySchema }), controller.saveNote);
router.post('/:id/contact', validate({ params }), controller.contact);
router.post('/:id/approve', validate({ params, body: ownerRequestApproveBodySchema }), controller.approve);
router.post('/:id/reject', validate({ params, body: ownerRequestRejectBodySchema }), controller.reject);

export default router;
