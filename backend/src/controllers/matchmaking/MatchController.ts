import { Request, Response, NextFunction } from 'express';
import { matchService, MatchService } from '../../services/matchmaking/MatchService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  ListMatchesQuery,
  listMatchesQuerySchema,
  matchIdParamSchema,
} from '../../validation/matchmaking';

export { listMatchesQuerySchema, matchIdParamSchema };

export class MatchController {
  constructor(private readonly service: MatchService = matchService) {}

  private actorId(req: Request): number {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    return req.user.id;
  }

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListMatchesQuery;
      const result = await this.service.listMatches(this.actorId(req), query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.getMatchDetail(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  leave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.leaveMatch(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const matchController = new MatchController();
