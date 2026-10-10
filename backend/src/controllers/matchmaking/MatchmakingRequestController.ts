import { Request, Response, NextFunction } from 'express';
import { matchmakingRequestService, MatchmakingRequestService } from '../../services/matchmaking/MatchmakingRequestService';
import { matchInvitationService, MatchInvitationService } from '../../services/matchmaking/MatchInvitationService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  CandidatesQuery,
  CreateMatchmakingRequestBody,
  ListRequestsQuery,
  candidatesQuerySchema,
  createMatchmakingRequestBodySchema,
  listRequestsQuerySchema,
  matchmakingRequestIdParamSchema,
} from '../../validation/matchmaking';

export { createMatchmakingRequestBodySchema, listRequestsQuerySchema, candidatesQuerySchema, matchmakingRequestIdParamSchema };

export class MatchmakingRequestController {
  constructor(
    private readonly service: MatchmakingRequestService = matchmakingRequestService,
    private readonly invitationService: MatchInvitationService = matchInvitationService
  ) {}

  private actorId(req: Request): number {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    return req.user.id;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateMatchmakingRequestBody;
      const result = await this.service.createRequest(this.actorId(req), body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListRequestsQuery;
      const result = await this.service.listRequests(this.actorId(req), query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.getRequestDetail(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.cancelRequest(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  candidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const query = req.query as unknown as CandidatesQuery;
      const result = await this.invitationService.browseCandidates(this.actorId(req), id, query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };
}

export const matchmakingRequestController = new MatchmakingRequestController();
