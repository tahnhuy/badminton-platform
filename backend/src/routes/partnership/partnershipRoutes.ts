import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { ownerRequestRateLimiter } from '../../middleware/rate-limit.middleware';
import { partnershipRequestController as controller } from '../../controllers/partnership/PartnershipRequestController';
import { ownerRequestBodySchema } from '../../validation/partnership';

/** Public Court Owner partnership form (no session needed). */
const router = Router();

router.get('/availability', controller.availability);
router.post('/', ownerRequestRateLimiter, validate({ body: ownerRequestBodySchema }), controller.submit);

export default router;
