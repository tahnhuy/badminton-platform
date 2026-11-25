import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { tournamentController } from '../../controllers/tournaments/TournamentController';
import { adminCancelBodySchema, adminTournamentsQuerySchema, tournamentIdParamSchema } from '../../validation/tournaments';

// Admin tournaments (Tournament Tech Design §3.5; TRN-12): list every status, cancel with refunds,
// and recalculate skill ratings after a parameter change (§7.10). Mounted at /api/v1/admin/tournaments.
const router = Router();
router.use(authenticate, requireRole('ADMIN'));
router.get('/', validate({ query: adminTournamentsQuerySchema }), tournamentController.adminList);
router.post('/skill-ratings/recalculate', tournamentController.adminRecalculateRatings);
router.post('/:id/cancel', validate({ params: tournamentIdParamSchema, body: adminCancelBodySchema }), tournamentController.adminCancel);
export default router;
