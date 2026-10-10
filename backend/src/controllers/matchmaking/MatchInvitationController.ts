import { Request, Response, NextFunction } from 'express';
import { matchInvitationService, MatchInvitationService } from '../../services/matchmaking/MatchInvitationService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  ListInvitationsQuery,
  RespondInvitationBody,
  SendInvitationBody,
  listInvitationsQuerySchema,
  matchmakingInvitationIdParamSchema,
  matchmakingRequestIdParamSchema,
  respondInvitationBodySchema,
  sendInvitationBodySchema,
} from '../../validation/matchmaking';

export {
  sendInvitationBodySchema,
  listInvitationsQuerySchema,
  respondInvitationBodySchema,
  matchmakingInvitationIdParamSchema,
  matchmakingRequestIdParamSchema,
};

export class MatchInvitationController {
  constructor(private readonly service: MatchInvitationService = matchInvitationService) {}

  private actorId(req: Request): number {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    return req.user.id;
  }

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const body = req.body as SendInvitationBody;
      const result = await this.service.sendInvitation(this.actorId(req), id, body.inviteeId);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListInvitationsQuery;
      const result = await this.service.listInvitations(this.actorId(req), query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  respond = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const body = req.body as RespondInvitationBody;
      const result = await this.service.respond(this.actorId(req), id, body.decision);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.cancelInvitation(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.withdrawInvitation(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const matchInvitationController = new MatchInvitationController();
