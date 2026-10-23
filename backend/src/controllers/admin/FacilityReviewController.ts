import { Request, Response, NextFunction } from 'express';
import { facilityReviewService as service } from '../../services/admin/FacilityReviewService';
export const facilityReviewController = {
  decide(approve: boolean, kind: 'ONBOARDING' | 'ADDRESS_CHANGE', court = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilityId = Number(req.params.facilityId ?? req.params.id);
        const reviewId = Number(req.params.reviewId ?? req.body.reviewId);
        res.json({ data: await service.decide(req.user!.id, facilityId, reviewId, approve, kind, req.body.reason, court ? Number(req.params.courtId) : undefined) });
      } catch (error) { next(error); }
    };
  },
  history(court = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await service.history(Number(req.params.facilityId ?? req.params.id), Number(req.query.page), Number(req.query.limit), court ? Number(req.params.courtId) : undefined)); } catch (error) { next(error); }
    };
  },
};
