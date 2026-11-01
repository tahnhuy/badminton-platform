import { Request, Response, NextFunction } from 'express';
import { matchmakingRequestService, MatchmakingRequestService } from '../../services/matchmaking/MatchmakingRequestService';
import { matchInvitationService, MatchInvitationService } from '../../services/matchmaking/MatchInvitationService';
import { recruitmentService, normalizeExternalCourt } from '../../services/matchmaking/RecruitmentService';
import { recruitmentLifecycleService } from '../../services/matchmaking/RecruitmentLifecycleService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  CancelRecruitmentBody,
  CandidatesQuery,
  CreateMatchmakingRequestBody,
  SetCourtBody,
  EditRecruitmentBody,
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

  edit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const actorId = this.actorId(req);
      await recruitmentService.edit(actorId, id, req.body as EditRecruitmentBody);
      res.status(200).json({ data: await this.service.getRequestDetail(actorId, id) });
    } catch (err) {
      next(err);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await recruitmentService.publish(this.actorId(req), id) });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { bookingAction } = req.body as CancelRecruitmentBody;
      const result = await this.service.cancelRequest(this.actorId(req), id, bookingAction);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** MM-25: POST /:id/withdraw (member withdrawal; the host leaving cancels with HOST_LEFT). */
  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await recruitmentLifecycleService.withdraw(this.actorId(req), id) });
    } catch (err) {
      next(err);
    }
  };

  /** MM-25: POST /:id/close (GROUP early close). */
  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      res.status(200).json({ data: await recruitmentLifecycleService.close(this.actorId(req), id) });
    } catch (err) {
      next(err);
    }
  };

  /** MM-28: PUT /:id/court (EXTERNAL; BOOKING unavailable until MM-19). */
  setCourt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const body = req.body as SetCourtBody;
      const input = body.kind === 'EXTERNAL'
        ? { kind: 'EXTERNAL' as const, court: normalizeExternalCourt(body) }
        : { kind: 'BOOKING' as const };
      res.status(200).json({ data: await recruitmentLifecycleService.setCourt(this.actorId(req), id, input) });
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
