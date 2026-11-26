import { parseAvatarUpload } from '../../middleware/avatar-upload.middleware';
import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { csrfProtection } from '../../middleware/csrf.middleware';
import { validate } from '../../middleware/validate.middleware';
import { playerIdParamSchema, updatePlayerProfileSchema } from '../../validation/players';
import { PlayerProfileController } from '../../controllers/players/PlayerProfileController';
import { PlayerProfileService } from '../../services/players/PlayerProfileService';
import type { ProfileRatingsReader } from '../../contracts/PlayerProfileRead';
import { tournamentController } from '../../controllers/tournaments/TournamentController';
import { playerHistoryQuerySchema } from '../../validation/tournaments';

/** Identity is live independently; optional capabilities remain explicit nulls until enabled. */
export function createProfileRouter(ratings: ProfileRatingsReader | null = null, options: { statisticsEnabled?: boolean } = {}): Router {
  const router = Router();
  const controller = new PlayerProfileController(new PlayerProfileService(ratings, undefined, options));
  router.use(authenticate, requireRole('PLAYER'), csrfProtection);
  router.get('/me', controller.own);
  router.get('/me/skill-survey', controller.ownSkillSurvey);
  // Skill rating R, owner only (Tournament PRD Decision #28, TRN-14).
  router.get('/me/skill-rating', tournamentController.ownSkillRating);
  router.post('/me/avatar', parseAvatarUpload, controller.uploadAvatar);
  router.patch('/me', validate({ body: updatePlayerProfileSchema }), controller.update);
  router.get('/:id', validate({ params: playerIdParamSchema }), controller.publicProfile);
  // Tournament history with placements (Tournament Tech Design §3.4b, TRN-16).
  router.get('/:id/tournaments', validate({ params: playerIdParamSchema, query: playerHistoryQuerySchema }), tournamentController.playerHistory);
  return router;
}
