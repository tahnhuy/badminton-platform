import { Request, Response, NextFunction } from 'express';
import { ratingService, RatingService } from '../../services/ratings/RatingService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  CreateRatingsBody,
  ListRatingsQuery,
  SkillAdjustmentListQuery,
} from '../../validation/ratings';

export class RatingController {
  constructor(private readonly service: RatingService = ratingService) {}

  private actor(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    return { id: req.user.id, role: req.user.role };
  }

  createRatings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { matchId } = req.params as unknown as { matchId: number };
      const body = req.body as CreateRatingsBody;
      const actor = this.actor(req);
      const result = await this.service.createRatings(actor.id, matchId, body.ratings);
      res.status(result.created.length > 0 ? 201 : 200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  pending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { matchId } = req.params as unknown as { matchId: number };
      const actor = this.actor(req);
      const result = await this.service.getPendingPlayers(actor.id, matchId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const actor = this.actor(req);
      const result = await this.service.getSummary(actor, userId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const query = req.query as unknown as ListRatingsQuery;
      const actor = this.actor(req);
      const result = await this.service.listRatings(actor, userId, query.direction, query.page, query.limit);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  skillAdjustments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as unknown as { userId: number };
      const query = req.query as unknown as SkillAdjustmentListQuery;
      const result = await this.service.listSkillAdjustments(userId, query.page, query.limit);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };
}

export const ratingController = new RatingController();
