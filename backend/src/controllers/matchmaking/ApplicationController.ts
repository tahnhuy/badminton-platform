import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/AppError';
import { applicationService } from '../../services/matchmaking/ApplicationService';
import type { ApplicationsQuery } from '../../validation/matchmaking';

function actor(req: Request) {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  return req.user.id;
}
const id = (req: Request) => (req.params as unknown as { id: number }).id;
export const applicationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await applicationService.create(actor(req), id(req)) }); } catch (error) { next(error); }
  },
  async listForHost(req: Request, res: Response, next: NextFunction) {
    try { const result = await applicationService.listForHost(actor(req), id(req), req.query as unknown as ApplicationsQuery); res.json({ data: result.items, meta: result.meta }); } catch (error) { next(error); }
  },
  async listMine(req: Request, res: Response, next: NextFunction) {
    try { const result = await applicationService.listMine(actor(req), req.query as unknown as ApplicationsQuery); res.json({ data: result.items, meta: result.meta }); } catch (error) { next(error); }
  },
  async decide(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await applicationService.decide(actor(req), id(req), req.body.decision) }); } catch (error) { next(error); }
  },
  async cancel(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await applicationService.cancel(actor(req), id(req)) }); } catch (error) { next(error); }
  },
};
