import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { courtStandardService } from '../../services/facility/CourtStandardService';
import { standardClaimQuerySchema, standardClaimDecisionBodySchema } from '../../validation/admin';

export class AdminStandardController {
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, status } = req.query as unknown as z.infer<typeof standardClaimQuerySchema>;
      res.status(200).json(await courtStandardService.listAdmin(status, page, limit));
    } catch (error) { next(error); }
  };

  decide = (approve: boolean) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const claimId = Number((req.params as { id: string }).id);
      const { reason } = req.body as z.infer<typeof standardClaimDecisionBodySchema>;
      res.status(200).json({ data: await courtStandardService.decide(req.user!.id, claimId, approve, reason) });
    } catch (error) { next(error); }
  };
}

export const adminStandardController = new AdminStandardController();
