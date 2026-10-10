import { Router } from 'express';
import { matchInvitationController } from '../../controllers/matchmaking/MatchInvitationController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listInvitationsQuerySchema,
  matchmakingInvitationIdParamSchema,
  respondInvitationBodySchema,
} from '../../validation/matchmaking';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.get('/', validate({ query: listInvitationsQuerySchema }), matchInvitationController.listMine);

router.put(
  '/:id',
  validate({ params: matchmakingInvitationIdParamSchema, body: respondInvitationBodySchema }),
  matchInvitationController.respond
);

router.post(
  '/:id/cancel',
  validate({ params: matchmakingInvitationIdParamSchema }),
  matchInvitationController.cancel
);

router.post(
  '/:id/withdraw',
  validate({ params: matchmakingInvitationIdParamSchema }),
  matchInvitationController.withdraw
);

export default router;
