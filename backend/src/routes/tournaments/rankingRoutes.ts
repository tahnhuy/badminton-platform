import { Router } from 'express';
import { tournamentController } from '../../controllers/tournaments/TournamentController';
import { optionalAuthenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { rankingQuerySchema, tournamentIdParamSchema } from '../../validation/tournaments';

// Achievement leaderboards (Tournament Tech Design §3.4b, §7.11; TRN-18). Mounted at /api/v1/tournament-rankings.
const router = Router();
router.get('/', optionalAuthenticate, validate({ query: rankingQuerySchema }), tournamentController.rankings);
router.get('/players/:id', optionalAuthenticate, validate({ params: tournamentIdParamSchema }), tournamentController.playerRanking);
export default router;
