import { Router } from 'express';
import { matchController } from '../../controllers/matchmaking/MatchController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listMatchesQuerySchema, matchIdParamSchema } from '../../validation/matchmaking';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.get('/', validate({ query: listMatchesQuerySchema }), matchController.listMine);

router.get('/:id', validate({ params: matchIdParamSchema }), matchController.detail);

router.post('/:id/leave', validate({ params: matchIdParamSchema }), matchController.leave);

export default router;
