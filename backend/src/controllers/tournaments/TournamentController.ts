import { Request, Response, NextFunction } from 'express';
import { tournamentService, type TournamentViewer } from '../../services/tournaments/TournamentService';

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
  complete: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.complete(actor(req), id(req), req.body.version) });
  }),
};
