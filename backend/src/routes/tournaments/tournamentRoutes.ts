import { Router } from 'express';
import { tournamentController } from '../../controllers/tournaments/TournamentController';
import { authenticate, optionalAuthenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  cancelBodySchema, createTournamentBodySchema, registerBodySchema, registrationParamSchema, removeRegistrationBodySchema, setSeedsBodySchema, tournamentMatchParamSchema, editMatchScheduleBodySchema, matchResultBodySchema, listTournamentsQuerySchema, myTournamentsQuerySchema,
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

// Registrations (Tech Design §3.2, TRN-03; Doubles teams in TRN-09).
router.get('/:id/registrations', optionalAuthenticate, validate(byId), tournamentController.participants);
router.post('/:id/registrations', ...player, validate({ ...byId, body: registerBodySchema }), tournamentController.register);
router.delete('/:id/registrations/:registrationId', ...player, validate({ params: registrationParamSchema }), tournamentController.withdraw);
router.post('/:id/registrations/:registrationId/remove', ...player,
  validate({ params: registrationParamSchema, body: removeRegistrationBodySchema }), tournamentController.removeRegistration);

// Seeds, draw, bracket (Tech Design §3.3, TRN-04).
router.get('/:id/seeds', ...player, validate(byId), tournamentController.seeds);
router.put('/:id/seeds', ...player, validate({ ...byId, body: setSeedsBodySchema }), tournamentController.setSeeds);
router.post('/:id/draw', ...player, validate({ ...byId, body: transitionBodySchema }), tournamentController.draw);
router.get('/:id/bracket', optionalAuthenticate, validate(byId), tournamentController.bracket);

// Schedule (Tech Design §3.4, TRN-05).
router.get('/:id/schedule', optionalAuthenticate, validate(byId), tournamentController.schedule);
router.post('/:id/schedule/auto', ...player, validate({ ...byId, body: transitionBodySchema }), tournamentController.rerunSchedule);
router.patch('/:id/matches/:tournamentMatchId/schedule', ...player,
  validate({ params: tournamentMatchParamSchema, body: editMatchScheduleBodySchema }), tournamentController.editMatchSchedule);

// Match operations (Tech Design §3.4, TRN-06).
router.post('/:id/matches/:tournamentMatchId/start', ...player, validate({ params: tournamentMatchParamSchema }), tournamentController.startMatch);
router.put('/:id/matches/:tournamentMatchId/result', ...player,
  validate({ params: tournamentMatchParamSchema, body: matchResultBodySchema }), tournamentController.matchResult);

export default router;
