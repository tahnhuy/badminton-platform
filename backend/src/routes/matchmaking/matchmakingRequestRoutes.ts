import { Router } from 'express';
import { matchmakingRequestController } from '../../controllers/matchmaking/MatchmakingRequestController';
import { matchInvitationController } from '../../controllers/matchmaking/MatchInvitationController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  candidatesQuerySchema,
  createMatchmakingRequestBodySchema,
  listRequestsQuerySchema,
  matchmakingRequestIdParamSchema,
  sendInvitationBodySchema,
} from '../../validation/matchmaking';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));

router.post('/', validate({ body: createMatchmakingRequestBodySchema }), matchmakingRequestController.create);

router.get('/', validate({ query: listRequestsQuerySchema }), matchmakingRequestController.listMine);

router.get(
  '/:id',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.detail
);

router.post(
  '/:id/cancel',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.cancel
);

router.get(
  '/:id/candidates',
  validate({ params: matchmakingRequestIdParamSchema, query: candidatesQuerySchema }),
  matchmakingRequestController.candidates
);

router.post(
  '/:id/invitations',
  validate({ params: matchmakingRequestIdParamSchema, body: sendInvitationBodySchema }),
  matchInvitationController.send
);

export default router;
