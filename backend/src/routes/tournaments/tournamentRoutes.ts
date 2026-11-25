import { Router } from 'express';
import { tournamentController } from '../../controllers/tournaments/TournamentController';
import { authenticate, optionalAuthenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  cancelBodySchema, createTournamentBodySchema, listTournamentsQuerySchema, myTournamentsQuerySchema,
  tournamentIdParamSchema, transitionBodySchema, updateTournamentBodySchema,
} from '../../validation/tournaments';

// Tournament Tech Design §3.1 (TRN-02). Mounted at /api/v1/tournaments.
const router = Router();
const player = [authenticate, requireRole('PLAYER')];
const byId = { params: tournamentIdParamSchema };

router.get('/', optionalAuthenticate, validate({ query: listTournamentsQuerySchema }), tournamentController.list);
router.get('/mine', ...player, validate({ query: myTournamentsQuerySchema }), tournamentController.mine);
router.get('/:id', optionalAuthenticate, validate(byId), tournamentController.detail);

router.post('/', ...player, validate({ body: createTournamentBodySchema }), tournamentController.create);
router.patch('/:id', ...player, validate({ ...byId, body: updateTournamentBodySchema }), tournamentController.update);
router.post('/:id/open', ...player, validate({ ...byId, body: transitionBodySchema }), tournamentController.open);
router.post('/:id/close', ...player, validate({ ...byId, body: transitionBodySchema }), tournamentController.close);
router.post('/:id/cancel', ...player, validate({ ...byId, body: cancelBodySchema }), tournamentController.cancel);
router.post('/:id/complete', ...player, validate({ ...byId, body: transitionBodySchema }), tournamentController.complete);

export default router;
