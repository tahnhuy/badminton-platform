import { Router } from 'express';
import { matchmakingRequestController } from '../../controllers/matchmaking/MatchmakingRequestController';
import { matchInvitationController } from '../../controllers/matchmaking/MatchInvitationController';
import { applicationController } from '../../controllers/matchmaking/ApplicationController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  cancelRecruitmentBodySchema,
  candidatesQuerySchema,
  createMatchmakingRequestBodySchema,
  editRecruitmentBodySchema,
  listRequestsQuerySchema,
  matchmakingRequestIdParamSchema,
  sendInvitationBodySchema,
  setCourtBodySchema,
  createApplicationBodySchema,
  hostApplicationsQuerySchema,
} from '../../validation/matchmaking';

const router = Router();

router.use(authenticate, requireRole('PLAYER'));
router.post('/:id/applications', validate({ params: matchmakingRequestIdParamSchema, body: createApplicationBodySchema }), applicationController.create);
router.get('/:id/applications', validate({ params: matchmakingRequestIdParamSchema, query: hostApplicationsQuerySchema }), applicationController.listForHost);

router.post('/', validate({ body: createMatchmakingRequestBodySchema }), matchmakingRequestController.create);

router.get('/', validate({ query: listRequestsQuerySchema }), matchmakingRequestController.listMine);

router.get(
  '/:id',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.detail
);

// MM-23 (Tech Design §24.9): recruitment edit with locks, publish guards.
router.patch(
  '/:id',
  validate({ params: matchmakingRequestIdParamSchema, body: editRecruitmentBodySchema }),
  matchmakingRequestController.edit
);
router.post(
  '/:id/publish',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.publish
);
// MM-25 (Tech Design §24.9): host cancel { bookingAction }, withdrawal, GROUP early close.
router.post(
  '/:id/cancel',
  validate({ params: matchmakingRequestIdParamSchema, body: cancelRecruitmentBodySchema }),
  matchmakingRequestController.cancel
);
router.post(
  '/:id/withdraw',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.withdraw
);
router.post(
  '/:id/close',
  validate({ params: matchmakingRequestIdParamSchema }),
  matchmakingRequestController.close
);
// MM-28: external court; booking link unavailable until MM-19/BK-15.
router.put(
  '/:id/court',
  validate({ params: matchmakingRequestIdParamSchema, body: setCourtBodySchema }),
  matchmakingRequestController.setCourt
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
