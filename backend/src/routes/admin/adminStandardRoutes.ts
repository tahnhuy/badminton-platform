import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { adminStandardController as controller } from '../../controllers/admin/AdminStandardController';
import { standardClaimQuerySchema, standardClaimDecisionBodySchema } from '../../validation/admin';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/claims', validate({ query: standardClaimQuerySchema }), controller.list);
router.post('/claims/:id/approve', validate({ params: z.object({ id: z.coerce.number().int().positive() }), body: standardClaimDecisionBodySchema }), controller.decide(true));
router.post('/claims/:id/reject', validate({ params: z.object({ id: z.coerce.number().int().positive() }), body: standardClaimDecisionBodySchema }), controller.decide(false));

export default router;
