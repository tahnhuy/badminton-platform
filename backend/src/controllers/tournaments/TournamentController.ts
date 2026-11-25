import { Request, Response, NextFunction } from 'express';
import { tournamentService, type TournamentViewer } from '../../services/tournaments/TournamentService';
import { tournamentRegistrationService } from '../../services/tournaments/TournamentRegistrationService';
import { tournamentBracketService } from '../../services/tournaments/TournamentBracketService';
import { tournamentScheduleService } from '../../services/tournaments/TournamentScheduleService';
import { tournamentMatchService } from '../../services/tournaments/TournamentMatchService';


/** Thin HTTP adapter (Tournament Tech Design §3.1). */
function viewer(req: Request): TournamentViewer | null {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}
function actor(req: Request): TournamentViewer {
  return viewer(req)!;
}
const id = (req: Request) => Number(req.params.id);

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);

export const tournamentController = {
  list: wrap(async (req, res) => {
    const result = await tournamentService.list(viewer(req), req.query as never);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  mine: wrap(async (req, res) => {
    const result = await tournamentService.mine(actor(req), req.query as never);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  detail: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.detail(viewer(req), id(req)) });
  }),
  create: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentService.create(actor(req), req.body) });
  }),
  update: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.update(actor(req), id(req), req.body) });
  }),
  open: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.open(actor(req), id(req), req.body.version) });
  }),
  close: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.close(actor(req), id(req), req.body.version) });
  }),
  cancel: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.cancel(actor(req), id(req), req.body.version, req.body.reason) });
  }),
  participants: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.participants(viewer(req), id(req)) });
  }),
  register: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentRegistrationService.registerSingles(actor(req), id(req)) });
  }),
  withdraw: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.withdraw(actor(req), id(req), Number(req.params.registrationId)) });
  }),
  removeRegistration: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.remove(actor(req), id(req), Number(req.params.registrationId), req.body.reason) });
  }),
  seeds: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.getSeeds(actor(req), id(req)) });
  }),
  setSeeds: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.setSeeds(actor(req), id(req), req.body.version, req.body.seeds) });
  }),
  draw: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.draw(actor(req), id(req), req.body.version) });
  }),
  bracket: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
  }),
  schedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.schedule(viewer(req), id(req)) });
  }),
  rerunSchedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.rerun(actor(req), id(req), req.body.version) });
  }),
  editMatchSchedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.editMatch(actor(req), id(req), Number(req.params.tournamentMatchId), req.body) });
  }),
  startMatch: wrap(async (req, res) => {
    await tournamentMatchService.start(actor(req), id(req), Number(req.params.tournamentMatchId));
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
  }),
  matchResult: wrap(async (req, res) => {
    await tournamentMatchService.result(actor(req), id(req), Number(req.params.tournamentMatchId), req.body);
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
  }),
  complete: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.complete(actor(req), id(req), req.body.version) });
  }),
};
