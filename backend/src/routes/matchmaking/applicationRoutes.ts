import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { applicationController } from '../../controllers/matchmaking/ApplicationController';
import { applicationDecisionSchema, applicationIdParamSchema, applicationsQuerySchema } from '../../validation/matchmaking';

const router = Router();
router.use(authenticate, requireRole('PLAYER'));
router.get('/', validate({ query: applicationsQuerySchema }), applicationController.listMine);
router.put('/:id', validate({ params: applicationIdParamSchema, body: applicationDecisionSchema }), applicationController.decide);
router.post('/:id/cancel', validate({ params: applicationIdParamSchema }), applicationController.cancel);
export default router;
