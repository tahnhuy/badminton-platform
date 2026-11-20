import { Request, Response, NextFunction } from 'express';
import { matchService, MatchService } from '../../services/matchmaking/MatchService';
import { matchBookingLinkService } from '../../services/matchmaking/MatchBookingLinkService';
import { matchBookingSplitService } from '../../services/matchmaking/MatchBookingSplitService';
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

  linkBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { bookingId } = req.body as { bookingId: number };
      const result = await matchBookingLinkService.linkBooking(this.actorId(req), id, bookingId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  bookingCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await matchBookingLinkService.listCandidates(this.actorId(req), id);
      res.status(200).json({ data: result.items });
    } catch (err) {
      next(err);
    }
  };

  bookingPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { courtId } = req.query as unknown as { courtId: number };
      const result = await matchBookingSplitService.previewBooking(this.actorId(req), id, courtId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  createSplitBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { courtId } = req.body as { courtId: number };
      const result = await matchBookingSplitService.placeBooking(this.actorId(req), id, courtId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  remindTopup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { courtId, playerIds } = req.body as { courtId: number; playerIds?: number[] };
      const result = await matchBookingSplitService.remindTopup(this.actorId(req), id, courtId, playerIds);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const matchController = new MatchController();
